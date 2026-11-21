/**
 * Mock provider: an in-memory database that implements every repository contract
 * (scripts/data-access/contracts.js) the way a real backend would:
 *  - async methods, returning copies in the app's model shapes;
 *  - schema validation, foreign keys and unique keys enforced on every write (like database constraints);
 *  - transactions (all writes or none);
 *  - optional simulated latency and failures, to exercise loading and error states;
 *  - optional persistence: the browser session (sessionStorage), or the browser (localStorage, shared by
 *    every tab, with change events between tabs - the mock's stand-in for a realtime subscription);
 *    otherwise memory only.
 *
 * Options: { seed, latencyMs = 0, failureRate = 0, persistence = 'memory' | 'session' | 'local', storageKey, now }
 */

function createMockDataProvider(options = {}) {
    const config = {
        latencyMs: 0,
        failureRate: 0,
        persistence: 'memory',
        storageKey: 'lifestyle.mockdb.v1',
        now: () => new Date(),
        ...options
    };
    const clone = v => (v === undefined ? v : (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))));

    // ----- Storage -----
    const TABLES = ['sites', 'employees', 'roster', 'costCodes', 'timesheets', 'crewLogs', 'attendance', 'siteLogs', 'drawings', 'sitePhotos',
        'equipment', 'equipmentAllocations', 'scheduleTrades', 'scheduleTasks', 'leaveRequests', 'leaveBalances', 'chats', 'chatMessages', 'availabilityRequests', 'availabilityResponses', 'notifications', 'audit'];
    const storage = (() => {
        try {
            if (config.persistence === 'session') return sessionStorage;
            if (config.persistence === 'local') return localStorage;
        } catch (_) { /* blocked: memory only */ }
        return null;
    })();
    let db = null;
    function readSaved() {
        if (!storage) return null;
        try {
            const saved = JSON.parse(storage.getItem(config.storageKey) || 'null');
            // A table added since it was saved starts from the seed
            if (saved && saved.seededFor === (config.seed && config.seed.seededFor)) return migrate({ ...clone(config.seed || {}), ...saved }, saved.tableVersions || {});
        } catch (_) { /* unreadable: start from the seed */ }
        return null;
    }
    // Seed migrations for a saved database: a table whose version moved on (seed.tableVersions) is replaced by
    // the seed's; sites the seed has and the saved copy lacks (a new location) are added. Nothing else - other
    // tables and history (requests, notifications, audit) are kept as they are.
    function migrate(d, have) {
        const seed = config.seed || {}, want = seed.tableVersions || {};
        Object.keys(want).forEach(t => {
            if (have[t] === want[t]) return;
            // equipment v3 (one record per unit) -> v4 (grouped): converted from the saved data, keeping where each
            // unit is and what state it's in. Anything older is replaced by the seed.
            if (t === 'equipment' && have[t] === 3 && want[t] === 4) { groupEquipmentUnits(d); return; }
            d[t] = clone(seed[t] || []);
            if (t === 'equipment') d.equipmentAllocations = clone(seed.equipmentAllocations || []);
        });
        d.tableVersions = { ...have, ...want };
        (seed.sites || []).forEach(s => { if (!(d.sites || []).some(x => x.id === s.id)) d.sites.push(clone(s)); });
        return d;
    }
    // An allocation bucket's id: one per (tool, site, status)
    function bucketId(toolId, siteId, status) { return `AL-${toolId}-${siteId || 'unassigned'}-${String(status).replace(/\s+/g, '')}`; }
    // Fold per-unit equipment records (groupId) and bulk records (quantity > 1) into quantity-tracked records
    // with allocation buckets. The group keeps its first unit's id; the other unit ids are kept in mergedIds and
    // availability requests that pointed at them are re-pointed (the old id kept as legacyToolId). A group whose
    // unit count doesn't match its recorded size is flagged needsReview instead of guessing.
    function groupEquipmentUnits(d) {
        const out = [], allocations = [], t = config.now().toISOString(), groups = new Map();
        const addBucket = (toolId, siteId, status, qty) => {
            const b = allocations.find(a => a.toolId === toolId && a.siteId === (siteId || null) && a.status === status);
            if (b) b.quantity += qty;
            else allocations.push({ id: bucketId(toolId, siteId, status), toolId, siteId: siteId || null, status, quantity: qty, updatedAt: t });
        };
        (d.equipment || []).forEach(row => {
            const { groupId, unitNumber, groupSize, quantity, ...rest } = row;
            if (groupId) {
                if (!groups.has(groupId)) { groups.set(groupId, []); out.push({ groupId }); }
                groups.get(groupId).push(row);
            } else if (quantity > 1) {
                out.push({ ...rest, trackingType: 'quantity', totalQuantity: quantity, siteId: null, status: null });
                addBucket(row.id, row.siteId, row.status || ToolStatus.AVAILABLE, quantity);
            } else {
                out.push({ ...rest, trackingType: 'individual' });
            }
        });
        const remap = {};
        d.equipment = out.map(entry => {
            if (!entry.groupId) return entry;
            const units = groups.get(entry.groupId).slice().sort((a, b) => (a.unitNumber || 0) - (b.unitNumber || 0));
            const first = units[0];
            const { groupId, unitNumber, groupSize, quantity, siteId, status, ...rest } = first;
            units.forEach(u => { addBucket(first.id, u.siteId, u.status || ToolStatus.AVAILABLE, 1); if (u.id !== first.id) remap[u.id] = first.id; });
            const logged = units.map(u => u.lastLogged).filter(Boolean);
            return {
                ...rest, trackingType: 'quantity', totalQuantity: units.length, siteId: null, status: null,
                lastLogged: logged[logged.length - 1] || first.lastLogged || '',
                mergedIds: units.slice(1).map(u => u.id),
                ...(groupSize && groupSize !== units.length ? { needsReview: true } : {})
            };
        });
        d.equipmentAllocations = allocations;
        (d.availabilityRequests || []).forEach(r => {
            if (remap[r.toolId]) { r.legacyToolId = r.toolId; r.toolId = remap[r.toolId]; }
            if (!r.quantity) r.quantity = 1;
        });
    }
    function normalise(d) { TABLES.forEach(t => { if (!Array.isArray(d[t])) d[t] = []; }); return d; }
    function loadDb() { return normalise(readSaved() || clone(config.seed || {})); }
    function saveDb() {
        if (!storage) return;
        try { storage.setItem(config.storageKey, JSON.stringify(db)); } catch (_) { /* storage full or blocked: memory only */ }
    }
    db = loadDb();

    // Shared storage: read the latest saved copy before every write, so a change made in another tab is the
    // one this write builds on (the server's row, not a stale copy)
    let inTransaction = false;
    function syncFromStorage() {
        if (config.persistence !== 'local' || inTransaction) return;
        const saved = readSaved();
        if (saved) db = normalise(saved);
    }

    // ----- Realtime: another tab changed the shared database -> tell subscribers which tables changed -----
    const changeListeners = [];
    if (config.persistence === 'local' && typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('storage', e => {
            if (e.key !== config.storageKey || inTransaction) return;
            const before = db;
            const next = readSaved();
            if (!next) return;
            db = normalise(next);
            const changed = TABLES.filter(t => JSON.stringify(before[t]) !== JSON.stringify(db[t]));
            if (changed.length) changeListeners.slice().forEach(fn => { try { fn(changed); } catch (err) { console.warn('Realtime listener error:', err); } });
        });
    }

    // ----- Simulation -----
    const failNext = {};             // 'timesheets.create' -> remaining forced failures
    let idSeq = 0;
    const nowIso = () => config.now().toISOString();
    const newId = prefix => `${prefix}-${Date.now().toString(36)}${(++idSeq).toString(36)}`;
    function delay() { return config.latencyMs > 0 ? new Promise(r => setTimeout(r, config.latencyMs)) : Promise.resolve(); }
    function maybeFail(opName) {
        if (failNext[opName] > 0) { failNext[opName]--; throw appErrors.network(`Simulated failure: ${opName}`); }
        if (config.failureRate > 0 && Math.random() < config.failureRate) throw appErrors.network(`Simulated random failure: ${opName}`);
    }
    // Every operation: wait, maybe fail, run, hand back a copy
    function op(opName, fn) {
        return delay().then(() => { maybeFail(opName); return clone(fn()); });
    }
    function write(opName, fn) {
        return op(opName, () => { syncFromStorage(); const out = fn(); saveDb(); return out; });
    }

    // ----- Constraints -----
    const find = (table, key, value) => db[table].find(r => r[key] === value) || null;
    function requireRow(table, key, value, entity) {
        const row = find(table, key, value);
        if (!row) throw appErrors.notFound(entity, value);
        return row;
    }
    function requireFk(table, value, entity) {
        if (value === null || value === undefined) return;
        if (!find(table, table === 'costCodes' ? 'code' : 'id', value)) {
            throw appErrors.validation(`${entity} ${value} does not exist`, [{ field: entity, message: 'does not exist' }]);
        }
    }
    function checkBlocks(blocks) { (blocks || []).forEach(b => requireFk('costCodes', b.code, 'costCode')); }
    function inRange(date, from, to) { return (!from || date >= from) && (!to || date <= to); }

    // ----- Repositories -----
    const sites = {
        list: ({ includeArchived = true } = {}) => op('sites.list', () => db.sites.filter(s => includeArchived || s.active)),
        getById: id => op('sites.getById', () => find('sites', 'id', id)),
        create: input => write('sites.create', () => {
            if (find('sites', 'id', input.id)) throw appErrors.conflict(`Site ${input.id} exists`, 'A site with that ID already exists.');
            const t = nowIso();
            const site = { active: true, icon: 'fa-solid fa-helmet-safety', ...input, createdAt: t, updatedAt: t };
            assertValidEntity('site', site);
            db.sites.push(site);
            return site;
        }),
        update: (id, changes) => write('sites.update', () => {
            const row = requireRow('sites', 'id', id, 'Site');
            const { id: _ignored, createdAt: _c, ...rest } = changes || {};
            const next = { ...row, ...rest, updatedAt: nowIso() };
            assertValidEntity('site', next);
            Object.assign(row, next);
            return row;
        }),
        archive: id => sites.update(id, { active: false }),
        restore: id => sites.update(id, { active: true })
    };

    const employees = {
        list: () => op('employees.list', () => db.employees),
        getById: id => op('employees.getById', () => find('employees', 'id', id))
    };

    const roster = {
        list: ({ employeeId, siteId, from, to } = {}) => op('roster.list', () => db.roster.filter(r =>
            (!employeeId || r.employeeId === employeeId) && (!siteId || r.siteId === siteId) && inRange(r.date, from, to))),
        getForEmployeeOnDate: (employeeId, date) => op('roster.getForEmployeeOnDate', () =>
            db.roster.find(r => r.employeeId === employeeId && r.date === date) || null),
        assign: ({ date, employeeId, siteId }) => write('roster.assign', () => {
            requireFk('employees', employeeId, 'employee');
            requireFk('sites', siteId, 'site');
            const existing = db.roster.find(r => r.employeeId === employeeId && r.date === date);   // unique (date, employeeId)
            const row = { id: existing ? existing.id : `RA-${employeeId}-${date}`, date, employeeId, siteId };
            assertValidEntity('rosterAssignment', row);
            if (existing) Object.assign(existing, row); else db.roster.push(row);
            return row;
        }),
        remove: id => write('roster.remove', () => {
            requireRow('roster', 'id', id, 'Roster assignment');
            db.roster = db.roster.filter(r => r.id !== id);
        })
    };

    const timesheets = {
        list: ({ employeeId, from, to, status } = {}) => op('timesheets.list', () => db.timesheets.filter(t =>
            (!employeeId || t.employeeId === employeeId) && (!status || t.status === status) && inRange(t.date, from, to))),
        getById: id => op('timesheets.getById', () => find('timesheets', 'id', id)),
        getForEmployeeOnDate: (employeeId, date) => op('timesheets.getForEmployeeOnDate', () =>
            db.timesheets.find(t => t.employeeId === employeeId && t.date === date) || null),
        create: input => write('timesheets.create', () => {
            if (db.timesheets.some(t => t.employeeId === input.employeeId && t.date === input.date)) {
                throw appErrors.conflict(`Timesheet exists for ${input.employeeId} on ${input.date}`, 'This day already has a timesheet. Refresh and edit it instead.');
            }
            const t = nowIso();
            const row = { id: input.id || newId('TS'), submittedAt: null, approvedAt: null, approvedBy: null, ...input, createdAt: t, updatedAt: t };
            requireFk('employees', row.employeeId, 'employee');
            requireFk('sites', row.siteId, 'site');
            checkBlocks(row.blocks);
            assertValidEntity('timesheet', row);
            db.timesheets.push(row);
            return row;
        }),
        update: (id, changes) => write('timesheets.update', () => {
            const row = requireRow('timesheets', 'id', id, 'Timesheet');
            const { id: _i, employeeId: _e, date: _d, createdAt: _c, ...rest } = changes || {};
            const next = { ...row, ...rest, updatedAt: nowIso() };
            requireFk('sites', next.siteId, 'site');
            checkBlocks(next.blocks);
            assertValidEntity('timesheet', next);
            Object.assign(row, next);
            return row;
        })
    };

    const crewLogs = {
        list: ({ date, siteId, from, to } = {}) => op('crewLogs.list', () => db.crewLogs.filter(l =>
            (!date || l.date === date) && (!siteId || l.siteId === siteId) && inRange(l.date, from, to)))
    };

    const attendance = {
        list: ({ date, siteId, employeeId } = {}) => op('attendance.list', () => db.attendance.filter(a =>
            (!date || a.date === date) && (!siteId || a.siteId === siteId) && (!employeeId || a.employeeId === employeeId))),
        // One record per employee per day (unique (date, employeeId)): signing in again reopens it
        signIn: ({ date, employeeId, siteId }) => write('attendance.signIn', () => {
            const employee = requireRow('employees', 'id', employeeId, 'Employee');
            requireFk('sites', siteId, 'site');
            const existing = db.attendance.find(a => a.date === date && a.employeeId === employeeId);
            const row = { id: existing ? existing.id : `AT-${date}-${employeeId}`, date, employeeId, name: employee.name, siteId,
                signedInAt: nowIso(), signedOutAt: null };
            assertValidEntity('attendance', row);
            if (existing) Object.assign(existing, row); else db.attendance.push(row);
            return row;
        }),
        signOut: id => write('attendance.signOut', () => {
            const row = requireRow('attendance', 'id', id, 'Attendance');
            if (row.signedOutAt) throw appErrors.conflict(`Attendance ${id} is already signed out`, 'Already signed out.');
            row.signedOutAt = nowIso();
            return row;
        })
    };

    const siteLogs = {
        list: ({ siteId } = {}) => op('siteLogs.list', () => db.siteLogs.filter(l => !siteId || l.siteId === siteId)),
        create: ({ siteId, date, title, body, authorId, tradeIds }) => write('siteLogs.create', () => {
            requireFk('sites', siteId, 'site');
            const author = requireRow('employees', 'id', authorId, 'Employee');
            const row = { id: newId('LOG'), siteId, date, title, body: body || '', tradeIds: tradeIds || [], authorId, authorName: author.name, createdAt: nowIso() };
            assertValidEntity('siteLog', row);
            db.siteLogs.push(row);
            return row;
        })
    };

    const drawings = {
        list: ({ siteId } = {}) => op('drawings.list', () => db.drawings.filter(d => !siteId || d.siteId === siteId)),
        // Unique (siteId, sheet): the register holds each sheet's current revision
        create: input => write('drawings.create', () => {
            requireFk('sites', input.siteId, 'site');
            const existing = db.drawings.find(d => d.siteId === input.siteId && d.sheet.toLowerCase() === String(input.sheet).toLowerCase());
            if (existing && existing.revision.toLowerCase() === String(input.revision).toLowerCase()) {
                throw appErrors.conflict(`${input.sheet} rev ${input.revision} exists`, `${existing.sheet} Rev ${existing.revision} is already in the register.`);
            }
            const row = { id: existing ? existing.id : `DWG-${input.siteId}-${input.sheet}`, siteId: input.siteId, sheet: input.sheet, title: input.title,
                discipline: input.discipline, revision: input.revision, updatedOn: input.updatedOn };
            assertValidEntity('drawing', row);
            if (existing) Object.assign(existing, row); else db.drawings.push(row);
            return row;
        })
    };

    const sitePhotos = {
        list: ({ siteId, logId } = {}) => op('sitePhotos.list', () => db.sitePhotos.filter(p =>
            (!siteId || p.siteId === siteId) && (!logId || p.logId === logId))),
        create: input => write('sitePhotos.create', () => {
            requireFk('sites', input.siteId, 'site');
            requireFk('siteLogs', input.logId, 'siteLog');
            requireFk('employees', input.takenBy, 'employee');
            const row = { id: newId('PH'), caption: '', tag: '', tradeIds: [], logId: null, takenBy: null, ...input, createdAt: nowIso() };
            assertValidEntity('sitePhoto', row);
            db.sitePhotos.push(row);
            return row;
        }),
        // Re-tag a photo (its trades); nothing else about a photo changes after it's taken
        setTrades: (id, tradeIds) => write('sitePhotos.setTrades', () => {
            const row = requireRow('sitePhotos', 'id', id, 'Photo');
            const next = { ...row, tradeIds: [...tradeIds] };
            assertValidEntity('sitePhoto', next);
            Object.assign(row, next);
            return row;
        })
    };

    const costCodes = { list: () => op('costCodes.list', () => db.costCodes) };

    // ----- Equipment -----
    // Individual tools carry their own siteId and status. Quantity-tracked tools carry totalQuantity, and their
    // units live in equipmentAllocations, one row per (toolId, siteId, status). Constraints held on every write:
    // bucket quantities are positive integers, the key is unique, and the buckets add up to totalQuantity.
    const bucketsOf = toolId => db.equipmentAllocations.filter(a => a.toolId === toolId);
    function assertReconciled(tool) {
        const problems = EquipmentRules.checkAllocations(tool, bucketsOf(tool.id));
        if (problems.length) throw new AppError(ErrorCode.UNKNOWN, `Inventory for ${tool.id} does not reconcile: ${problems.join('; ')}`,
            { userMessage: 'The inventory count for this equipment does not add up. Nothing was changed.' });
    }
    function validTool(row) {
        assertValidEntity('tool', row);
        if (EquipmentRules.isGrouped(row)) {
            if (!Number.isInteger(row.totalQuantity) || row.totalQuantity < 1) throw appErrors.validation('totalQuantity must be a positive whole number', [{ field: 'totalQuantity', message: 'must be at least 1' }]);
        } else if (!row.status) {
            throw appErrors.validation('An individual tool needs a status', [{ field: 'status', message: 'is required' }]);
        }
    }
    // Move `quantity` units from one bucket to another (a transfer, a status change, or both) inside the
    // current write: the source is checked, decremented (and removed at 0), the destination incremented or
    // created, and the tool reconciled - all or nothing.
    function moveUnitsRows(tool, from, to, quantity) {
        if (!EquipmentRules.isGrouped(tool)) throw appErrors.validation(`${tool.id} is not quantity-tracked`, [{ field: 'toolId', message: 'is an individual tool' }]);
        if (!Number.isInteger(quantity) || quantity < 1) throw appErrors.validation('Quantity must be a whole number of at least 1', [{ field: 'quantity', message: 'must be at least 1' }], 'Choose at least 1 unit.');
        if (!Object.values(ToolStatus).includes(to.status)) throw appErrors.validation(`Unknown status ${to.status}`, [{ field: 'status', message: 'is not a status' }]);
        const fromSite = from.siteId || null, toSite = to.siteId || null;
        if (fromSite === toSite && from.status === to.status) throw appErrors.validation('Source and destination are the same', [{ field: 'to', message: 'is the source' }], 'Choose a different location or status.');
        requireFk('sites', toSite, 'site');
        const src = bucketsOf(tool.id).find(a => (a.siteId || null) === fromSite && a.status === from.status);
        if (!src || src.quantity < quantity) {
            const have = src ? src.quantity : 0;
            const where = fromSite ? (find('sites', 'id', fromSite) || {}).shortName || fromSite : 'the unassigned location';
            throw appErrors.conflict(`Bucket ${tool.id}/${fromSite}/${from.status} holds ${have}, asked for ${quantity}`,
                have ? `Only ${have} ${from.status === ToolStatus.SERVICE ? 'out of service' : from.status.toLowerCase()} at ${where} now. Choose ${have} or fewer.`
                     : `There are no ${tool.name} ${from.status === ToolStatus.SERVICE ? 'out of service' : from.status.toLowerCase()} at ${where} any more.`);
        }
        const t = nowIso();
        src.quantity -= quantity;
        src.updatedAt = t;
        if (src.quantity === 0) db.equipmentAllocations = db.equipmentAllocations.filter(a => a !== src);
        const dst = bucketsOf(tool.id).find(a => (a.siteId || null) === toSite && a.status === to.status);
        if (dst) { dst.quantity += quantity; dst.updatedAt = t; }
        else {
            const row = { id: bucketId(tool.id, toSite, to.status), toolId: tool.id, siteId: toSite, status: to.status, quantity, updatedAt: t };
            assertValidEntity('equipmentAllocation', row);
            db.equipmentAllocations.push(row);
        }
        assertReconciled(tool);
        return bucketsOf(tool.id);
    }

    const equipment = {
        list: () => op('equipment.list', () => db.equipment),
        getById: id => op('equipment.getById', () => find('equipment', 'id', id)),
        // A quantity-tracked tool: { trackingType: 'quantity', totalQuantity, initialAllocation: { siteId, status } }
        create: input => write('equipment.create', () => {
            const { initialAllocation, ...rest } = input || {};
            const grouped = rest.trackingType === 'quantity';
            const row = grouped
                ? { id: rest.id || newId('tool'), moveRequestedToSiteId: null, ...rest, siteId: null, status: null }
                : { id: rest.id || newId('tool'), trackingType: 'individual', status: ToolStatus.AVAILABLE, moveRequestedToSiteId: null, ...rest };
            if (find('equipment', 'id', row.id)) throw appErrors.conflict(`Tool ${row.id} exists`, 'That equipment is already registered.');
            requireFk('sites', row.siteId, 'site');
            validTool(row);
            db.equipment.push(row);
            if (grouped) {
                if (!initialAllocation) throw appErrors.validation('A grouped tool needs its units placed', [{ field: 'initialAllocation', message: 'is required' }]);
                requireFk('sites', initialAllocation.siteId, 'site');
                const a = { id: bucketId(row.id, initialAllocation.siteId, initialAllocation.status), toolId: row.id, siteId: initialAllocation.siteId || null,
                    status: initialAllocation.status, quantity: row.totalQuantity, updatedAt: nowIso() };
                assertValidEntity('equipmentAllocation', a);
                db.equipmentAllocations.push(a);
            }
            return row;
        }),
        // Details only: tracking type and total quantity can't change here (that would break the buckets)
        update: (id, changes) => write('equipment.update', () => {
            const row = requireRow('equipment', 'id', id, 'Tool');
            const { id: _i, trackingType: _t, totalQuantity: _q, ...rest } = changes || {};
            const next = { ...row, ...rest };
            if (EquipmentRules.isGrouped(row)) { next.siteId = null; next.status = null; }
            requireFk('sites', next.siteId, 'site');
            requireFk('sites', next.moveRequestedToSiteId, 'site');
            validTool(next);
            Object.assign(row, next);
            return row;
        }),
        listAllocations: ({ toolId } = {}) => op('equipment.listAllocations', () => db.equipmentAllocations.filter(a => !toolId || a.toolId === toolId)),
        // -> { tool, allocations } (all of that tool's buckets after the move)
        moveUnits: (toolId, { from, to, quantity }) => write('equipment.moveUnits', () => {
            const tool = requireRow('equipment', 'id', toolId, 'Tool');
            const allocations = moveUnitsRows(tool, from || {}, to || {}, quantity);
            return { tool, allocations };
        })
    };

    const leave = {
        listRequests: ({ employeeId, status } = {}) => op('leave.listRequests', () => db.leaveRequests.filter(r =>
            (!employeeId || r.employeeId === employeeId) && (!status || r.status === status))),
        getRequest: id => op('leave.getRequest', () => find('leaveRequests', 'id', id)),
        createRequest: input => write('leave.createRequest', () => {
            const row = { id: input.id || newId('LR'), decidedAt: null, decidedBy: null, ...input, requestedAt: nowIso() };
            requireFk('employees', row.employeeId, 'employee');
            assertValidEntity('leaveRequest', row);
            db.leaveRequests.push(row);
            return row;
        }),
        updateRequest: (id, changes) => write('leave.updateRequest', () => {
            const row = requireRow('leaveRequests', 'id', id, 'Leave request');
            const { id: _i, employeeId: _e, ...rest } = changes || {};
            const next = { ...row, ...rest };
            assertValidEntity('leaveRequest', next);
            Object.assign(row, next);
            return row;
        }),
        getBalance: employeeId => op('leave.getBalance', () => find('leaveBalances', 'employeeId', employeeId)),
        updateBalance: (employeeId, changes) => write('leave.updateBalance', () => {
            const row = requireRow('leaveBalances', 'employeeId', employeeId, 'Leave balance');
            const next = { ...row, ...changes, employeeId };
            assertValidEntity('leaveBalance', next);
            Object.assign(row, next);
            return row;
        })
    };

    // ----- Site schedule -----
    // Constraints: a booking's site and trade exist; it ends on or after it starts; a trade in use can't be
    // removed. Checklist changes are made one item at a time (two people ticking different items never
    // overwrite each other).
    function validTask(row) {
        requireFk('sites', row.siteId, 'site');
        if (!find('scheduleTrades', 'id', row.tradeId)) throw appErrors.validation(`Trade ${row.tradeId} does not exist`, [{ field: 'tradeId', message: 'does not exist' }], 'Choose a trade.');
        if (row.endDate < row.startDate) throw appErrors.validation('End before start', [{ field: 'endDate', message: 'is before the start' }], 'The end date is before the start date.');
        assertValidEntity('scheduleTask', row);
    }
    function requireItem(task, itemId) {
        const item = (task.checklist || []).find(x => x.id === itemId);
        if (!item) throw appErrors.notFound('Checklist item', itemId);
        return item;
    }
    const schedule = {
        listTasks: ({ siteId } = {}) => op('schedule.listTasks', () => db.scheduleTasks.filter(t => !siteId || t.siteId === siteId)),
        getTask: id => op('schedule.getTask', () => find('scheduleTasks', 'id', id)),
        // A new booking; `id` may be given (undo of a delete puts the same booking back)
        createTask: input => write('schedule.createTask', () => {
            const t = nowIso();
            const row = { where: '', crew: '', notes: '', milestone: false, checklist: [], ...input, id: input.id || newId('SCH'), createdAt: input.createdAt || t, updatedAt: t };
            if (find('scheduleTasks', 'id', row.id)) throw appErrors.conflict(`Task ${row.id} exists`, 'That booking already exists.');
            validTask(row);
            db.scheduleTasks.push(row);
            return row;
        }),
        updateTask: (id, changes) => write('schedule.updateTask', () => {
            const row = requireRow('scheduleTasks', 'id', id, 'Booking');
            const { id: _i, createdAt: _c, checklist: _k, ...rest } = changes || {};
            const next = { ...row, ...rest, updatedAt: nowIso() };
            if (changes && Array.isArray(changes.checklist) && !(row.checklist || []).length) next.checklist = changes.checklist;   // a new milestone's starting list
            validTask(next);
            Object.assign(row, next);
            return row;
        }),
        removeTask: id => write('schedule.removeTask', () => {
            const row = requireRow('scheduleTasks', 'id', id, 'Booking');
            db.scheduleTasks = db.scheduleTasks.filter(t => t !== row);
            return row;
        }),
        addChecklistItem: (taskId, item, index) => write('schedule.addChecklistItem', () => {
            const task = requireRow('scheduleTasks', 'id', taskId, 'Booking');
            const row = { done: false, doneBy: null, doneByName: null, doneAt: null, note: '', requestedBy: null, ...item, id: item.id || newId('CK') };
            const list = (task.checklist || []).slice();
            list.splice(Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length, 0, row);
            const next = { ...task, checklist: list, updatedAt: nowIso() };
            validTask(next);
            Object.assign(task, next);
            return task;
        }),
        updateChecklistItem: (taskId, itemId, patch) => write('schedule.updateChecklistItem', () => {
            const task = requireRow('scheduleTasks', 'id', taskId, 'Booking');
            requireItem(task, itemId);
            const next = { ...task, checklist: task.checklist.map(x => (x.id === itemId ? { ...x, ...patch, id: x.id } : x)), updatedAt: nowIso() };
            validTask(next);
            Object.assign(task, next);
            return task;
        }),
        removeChecklistItem: (taskId, itemId) => write('schedule.removeChecklistItem', () => {
            const task = requireRow('scheduleTasks', 'id', taskId, 'Booking');
            requireItem(task, itemId);
            Object.assign(task, { checklist: task.checklist.filter(x => x.id !== itemId), updatedAt: nowIso() });
            return task;
        }),
        listTrades: () => op('schedule.listTrades', () => db.scheduleTrades),
        // The whole trade list at once (the Trades sheet). A trade still used by a booking can't be dropped.
        saveTrades: trades => write('schedule.saveTrades', () => {
            const ids = new Set();
            (trades || []).forEach(t => {
                assertValidEntity('scheduleTrade', t);
                if (!/^#[0-9a-f]{6}$/i.test(t.color)) throw appErrors.validation(`Bad colour ${t.color}`, [{ field: 'color', message: 'must be #RRGGBB' }], 'Choose a colour for each trade.');
                if (ids.has(t.id)) throw appErrors.validation(`Duplicate trade ${t.id}`, [{ field: 'id', message: 'is repeated' }]);
                ids.add(t.id);
            });
            const dropped = db.scheduleTrades.filter(t => !ids.has(t.id));
            const used = dropped.find(t => db.scheduleTasks.some(x => x.tradeId === t.id));
            if (used) {
                const n = db.scheduleTasks.filter(x => x.tradeId === used.id).length;
                throw appErrors.conflict(`Trade ${used.id} in use`, `${used.name} is used by ${n} booking${n === 1 ? '' : 's'}. Delete or move those first.`);
            }
            db.scheduleTrades = (trades || []).map(t => ({ ...t }));
            return db.scheduleTrades;
        })
    };

    // ----- Chats and structured chat messages -----
    const chats = {
        list: () => op('chats.list', () => db.chats),
        getForSite: siteId => op('chats.getForSite', () => db.chats.find(c => c.kind === 'site' && c.siteId === siteId) || null)
    };
    const chatMessages = {
        list: ({ chatId } = {}) => op('chatMessages.list', () => db.chatMessages.filter(m => !chatId || m.chatId === chatId))
    };

    // ----- Equipment availability requests -----
    // The constraints a database would hold, enforced on every call:
    //  - one active request per tool (waiting for an answer until it expires, or in use with an ETA ahead);
    //  - a retried submit (same requester + idempotency key) returns the first request, never a second one;
    //  - the request's site and chat come from the tool's record, never from the caller;
    //  - the first answer wins: answering is a compare-and-set on the request's status. After that only the
    //    holder (or an override) may change it.
    // A pending request past its expiry is marked expired before anything else runs.
    const nowMs = () => config.now().getTime();
    function expireDueRows() {
        const t = nowMs(), stamp = nowIso(), changed = [];
        db.availabilityRequests.forEach(r => {
            if (r.status === AvailabilityStatus.PENDING && Date.parse(r.expiresAt) <= t) {
                Object.assign(r, { status: AvailabilityStatus.EXPIRED, updatedAt: stamp, version: r.version + 1 });
                changed.push(r);
            }
        });
        return changed;
    }
    const availability = {
        listRequests: ({ toolId, siteId } = {}) => op('availability.listRequests', () => db.availabilityRequests.filter(r =>
            (!toolId || r.toolId === toolId) && (!siteId || r.siteId === siteId))),
        getRequest: id => op('availability.getRequest', () => find('availabilityRequests', 'id', id)),
        listResponses: ({ requestId } = {}) => op('availability.listResponses', () => db.availabilityResponses.filter(r => !requestId || r.requestId === requestId)),
        expireDue: () => write('availability.expireDue', () => expireDueRows()),
        // -> { request, message, replayed }
        // Grouped tools: siteId names the bucket asked about (it must hold units in use there) and quantity how
        // many; one active request per (tool, site). Individual tools: the tool's own site, quantity 1.
        createRequest: ({ toolId, requesterId, note, idempotencyKey, siteId: askedSiteId, quantity: askedQty }) => write('availability.createRequest', () => {
            expireDueRows();
            const requester = requireRow('employees', 'id', requesterId, 'Employee');
            if (idempotencyKey) {
                const prior = db.availabilityRequests.find(r => r.requesterId === requesterId && r.idempotencyKey === idempotencyKey);
                if (prior) return { request: prior, message: find('chatMessages', 'id', prior.messageId), replayed: true };
            }
            const tool = requireRow('equipment', 'id', toolId, 'Tool');
            const grouped = EquipmentRules.isGrouped(tool);
            const siteId = grouped ? (askedSiteId || null) : tool.siteId;
            const site = siteId ? find('sites', 'id', siteId) : null;
            const where = site ? site.shortName : 'its site';
            let quantity = 1;
            if (grouped) {
                quantity = askedQty === undefined ? 1 : askedQty;
                const inUse = bucketsOf(toolId).find(a => a.siteId === siteId && a.status === ToolStatus.IN_USE);
                if (!inUse) throw appErrors.conflict(`No ${toolId} in use at ${siteId}`, `No ${tool.name} are in use at ${where}.`);
                if (!Number.isInteger(quantity) || quantity < 1 || quantity > inUse.quantity) {
                    throw appErrors.validation(`Quantity ${quantity} outside 1..${inUse.quantity}`, [{ field: 'quantity', message: `must be 1 to ${inUse.quantity}` }],
                        `Choose 1 to ${inUse.quantity} - that's how many are in use at ${where}.`);
                }
            } else {
                if (tool.status === ToolStatus.AVAILABLE && !tool.missingReportedAt) throw appErrors.conflict(`Tool ${toolId} is available`, `${tool.name} is already available at ${where}.`);
                if (tool.status === ToolStatus.SERVICE) throw appErrors.conflict(`Tool ${toolId} is in service`, `${tool.name} is in service until pickup is ready.`);
            }
            if (!site || !site.active) {
                throw appErrors.validation(`Tool ${toolId} has no active site`, [{ field: 'toolId', message: 'has no active site' }],
                    `${tool.name} isn't assigned to an active site, so there's no one to ask.`);
            }
            const chat = db.chats.find(c => c.kind === 'site' && c.siteId === site.id);
            if (!chat) {
                throw appErrors.validation(`Site ${site.id} has no group chat`, [{ field: 'siteId', message: 'has no site group chat' }],
                    `${site.shortName} has no site group chat to ask in.`);
            }
            const open = db.availabilityRequests.find(r => r.toolId === toolId && (!grouped || r.siteId === siteId) && AvailabilityRules.isActive(r, nowMs()));
            if (open) {
                const err = appErrors.conflict(`Tool ${toolId} has active request ${open.id}`, `Availability for ${tool.name} has already been requested.`);
                err.details = [{ field: 'requestId', message: open.id }];
                throw err;
            }
            const t = nowIso();
            const id = newId('AR'), messageId = newId('MSG');
            const request = {
                id, toolId, siteId: site.id, chatId: chat.id, messageId, requesterId, requesterName: requester.name,
                requesterNote: String(note || '').trim(), quantity, status: AvailabilityStatus.PENDING,
                responderId: null, responderName: null, respondedAt: null, holderId: null, estimatedAvailableAt: null,
                idempotencyKey: idempotencyKey || null, version: 1, createdAt: t, updatedAt: t,
                expiresAt: new Date(Date.parse(t) + AvailabilityRules.COOLDOWN_MS).toISOString()
            };
            const message = { id: messageId, chatId: chat.id, type: ChatMessageType.AVAILABILITY_REQUEST, senderId: requesterId,
                senderName: requester.name, text: '', requestId: id, createdAt: t };
            assertValidEntity('availabilityRequest', request);
            assertValidEntity('chatMessage', message);
            db.availabilityRequests.push(request);
            db.chatMessages.push(message);
            return { request, message, replayed: false };
        }),
        // Answer or move the ETA. -> { request, response, tool, unchanged }
        // { responderId, responseType, estimatedAvailableAt, canOverride }
        respond: (id, { responderId, responseType, estimatedAvailableAt = null, canOverride = false }) => write('availability.respond', () => {
            expireDueRows();
            const r = requireRow('availabilityRequests', 'id', id, 'Availability request');
            const responder = requireRow('employees', 'id', responderId, 'Employee');
            const T = AvailabilityResponseType, S = AvailabilityStatus;
            if (!Object.values(T).includes(responseType)) throw appErrors.validation(`Unknown response ${responseType}`, [{ field: 'responseType', message: 'is not a response' }]);
            if (r.status === S.EXPIRED) throw appErrors.conflict(`Request ${id} expired`, 'This request expired before anyone answered.');
            const isHolder = r.status === S.IN_USE && r.holderId === responderId;
            const taken = () => appErrors.conflict(`Request ${id} is ${r.status}`, `${r.responderName || 'Someone'} has already answered this request.`);
            if (responseType === T.ETA_UPDATED) {
                if (r.status !== S.IN_USE) throw taken();
                if (!isHolder && !canOverride) throw appErrors.conflict(`Not the holder of ${id}`, `Only ${r.responderName} can change this ETA.`);
            } else if (r.status !== S.PENDING) {
                // Answered already: the holder may finish their answer (free now / not here / a new time)
                // and an override may correct an in-use hold; anyone else is too late.
                if (!(isHolder || (canOverride && r.status === S.IN_USE))) throw taken();
            }
            const needsEta = responseType === T.IN_USE || responseType === T.ETA_UPDATED;
            if (needsEta && !(estimatedAvailableAt && Date.parse(estimatedAvailableAt) > nowMs())) {
                throw appErrors.validation('ETA must be in the future', [{ field: 'estimatedAvailableAt', message: 'must be in the future' }], 'Pick a time later today.');
            }
            // The same ETA again changes nothing
            if (needsEta && r.status === S.IN_USE && AvailabilityRules.sameMinute(r.estimatedAvailableAt, estimatedAvailableAt)) {
                return { request: r, response: null, tool: find('equipment', 'id', r.toolId), allocations: null, unchanged: true };
            }
            const t = nowIso();
            const status = needsEta ? S.IN_USE : (responseType === T.AVAILABLE ? S.AVAILABLE : S.MISSING);
            const response = {
                id: newId('AV'), requestId: id, responderId, responderName: responder.name,
                responseType: (responseType === T.IN_USE && r.status === S.IN_USE) ? T.ETA_UPDATED : responseType,
                estimatedAvailableAt: needsEta ? estimatedAvailableAt : null,
                previousEstimatedAvailableAt: r.estimatedAvailableAt || null, createdAt: t
            };
            const next = {
                ...r, status, responderId, responderName: responder.name, respondedAt: t,
                holderId: status === S.IN_USE ? responderId : null,
                estimatedAvailableAt: needsEta ? estimatedAvailableAt : null,
                version: r.version + 1, updatedAt: t
            };
            assertValidEntity('availabilityRequest', next);
            assertValidEntity('availabilityResponse', response);
            // The equipment follows the answer. An individual tool takes the status (or the missing flag). A grouped
            // tool: "available now" moves the asked units (or as many as are still in use there) from In Use to
            // Available in that site's buckets; the other answers leave the buckets as they are.
            const tool = requireRow('equipment', 'id', r.toolId, 'Tool');
            let allocations = null;
            if (EquipmentRules.isGrouped(tool)) {
                if (status === S.AVAILABLE) {
                    const inUse = bucketsOf(tool.id).find(a => a.siteId === r.siteId && a.status === ToolStatus.IN_USE);
                    const n = Math.min(r.quantity || 1, inUse ? inUse.quantity : 0);
                    if (n > 0) moveUnitsRows(tool, { siteId: r.siteId, status: ToolStatus.IN_USE }, { siteId: r.siteId, status: ToolStatus.AVAILABLE }, n);
                }
                allocations = bucketsOf(tool.id);
            } else {
                const toolNext = status === S.AVAILABLE ? { ...tool, status: ToolStatus.AVAILABLE, missingReportedAt: null, missingReportedBy: null }
                    : status === S.MISSING ? { ...tool, missingReportedAt: t, missingReportedBy: responderId }
                    : { ...tool, status: ToolStatus.IN_USE, missingReportedAt: null, missingReportedBy: null };
                validTool(toolNext);
                Object.assign(tool, toolNext);
            }
            Object.assign(r, next);
            db.availabilityResponses.push(response);
            return { request: r, response, tool, allocations, unchanged: false };
        })
    };

    // ----- Notifications (one row per recipient) -----
    const notifications = {
        list: ({ recipientId } = {}) => op('notifications.list', () => db.notifications.filter(n => !recipientId || n.recipientId === recipientId)),
        // Unique (recipientId, dedupeKey): the same event never reaches the same person twice. -> the rows written
        createMany: rows => write('notifications.createMany', () => {
            const out = [];
            (rows || []).forEach(input => {
                if (db.notifications.some(n => n.recipientId === input.recipientId && n.dedupeKey === input.dedupeKey)) return;
                requireFk('employees', input.recipientId, 'employee');
                const row = { id: newId('NT'), actorId: null, requestId: null, chatId: null, messageId: null, readAt: null, ...input, createdAt: nowIso() };
                assertValidEntity('notification', row);
                db.notifications.push(row);
                out.push(row);
            });
            return out;
        }),
        markRead: (id, recipientId) => write('notifications.markRead', () => {
            const row = requireRow('notifications', 'id', id, 'Notification');
            if (row.recipientId !== recipientId) throw appErrors.permission('notifications.markRead');
            if (!row.readAt) row.readAt = nowIso();
            return row;
        }),
        markAllRead: recipientId => write('notifications.markAllRead', () => {
            const t = nowIso(), out = [];
            db.notifications.forEach(n => { if (n.recipientId === recipientId && !n.readAt) { n.readAt = t; out.push(n); } });
            return out;
        })
    };

    const audit = {
        record: entry => write('audit.record', () => {
            const row = { id: newId('AU'), at: nowIso(), actorId: null, ...entry };
            assertValidEntity('auditEntry', row);
            db.audit.push(row);
            return row;
        }),
        list: ({ entity, entityId } = {}) => op('audit.list', () => db.audit.filter(a =>
            (!entity || a.entity === entity) && (!entityId || a.entityId === entityId)))
    };

    const repos = { sites, employees, roster, timesheets, crewLogs, attendance, siteLogs, drawings, sitePhotos, costCodes, equipment, leave,
        schedule, chats, chatMessages, availability, notifications, audit };

    // All-or-nothing: one transaction at a time; any throw restores the database as it was before.
    // (A real backend runs the same work as one database transaction or server-side function.)
    let txQueue = Promise.resolve();
    function transaction(work) {
        const run = txQueue.then(async () => {
            syncFromStorage();                         // build on the latest shared copy
            inTransaction = true;
            const snapshot = clone(db);
            try {
                return await work(repos);
            } catch (err) {
                db = snapshot;
                saveDb();
                throw err;
            } finally {
                inTransaction = false;
            }
        });
        txQueue = run.catch(() => {});
        return run;
    }

    return {
        name: 'mock',
        ...repos,
        transaction,
        // Realtime: fn(changedTables) when another tab changes the shared database ('local' persistence).
        // A real provider wires this to its change feed (Supabase Realtime, Firestore snapshots, a socket).
        subscribe(fn) { changeListeners.push(fn); return () => { const i = changeListeners.indexOf(fn); if (i >= 0) changeListeners.splice(i, 1); }; },
        // Development and tests only: shape latency and failures
        debug: {
            failNext(opName, times = 1) { failNext[opName] = (failNext[opName] || 0) + times; },
            setLatency(ms) { config.latencyMs = ms; },
            setFailureRate(rate) { config.failureRate = rate; },
            reset() { db = normalise(clone(config.seed || {})); saveDb(); }
        }
    };
}
