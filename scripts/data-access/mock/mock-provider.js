/**
 * Mock provider: an in-memory database that implements every repository contract
 * (scripts/data-access/contracts.js) the way a real backend would:
 *  - async methods, returning copies in the app's model shapes;
 *  - schema validation, foreign keys and unique keys enforced on every write (like database constraints);
 *  - transactions (all writes or none);
 *  - optional simulated latency and failures, to exercise loading and error states;
 *  - optional persistence for the browser session (sessionStorage), otherwise memory only.
 *
 * Options: { seed, latencyMs = 0, failureRate = 0, persistence = 'memory' | 'session', storageKey, now }
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
    let db = null;
    function loadDb() {
        if (config.persistence === 'session') {
            try {
                const saved = JSON.parse(sessionStorage.getItem(config.storageKey) || 'null');
                if (saved && saved.seededFor === (config.seed && config.seed.seededFor)) return saved;
            } catch (_) { /* unreadable: start from the seed */ }
        }
        return clone(config.seed || {});
    }
    function saveDb() {
        if (config.persistence !== 'session') return;
        try { sessionStorage.setItem(config.storageKey, JSON.stringify(db)); } catch (_) { /* storage full or blocked: memory only */ }
    }
    db = loadDb();
    ['sites', 'employees', 'roster', 'costCodes', 'timesheets', 'crewLogs', 'equipment', 'leaveRequests', 'leaveBalances', 'audit']
        .forEach(t => { if (!Array.isArray(db[t])) db[t] = []; });

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
        return op(opName, () => { const out = fn(); saveDb(); return out; });
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

    const costCodes = { list: () => op('costCodes.list', () => db.costCodes) };

    const equipment = {
        list: () => op('equipment.list', () => db.equipment),
        getById: id => op('equipment.getById', () => find('equipment', 'id', id)),
        create: input => write('equipment.create', () => {
            const row = { id: input.id || newId('tool'), status: ToolStatus.AVAILABLE, moveRequestedToSiteId: null, ...input };
            if (find('equipment', 'id', row.id)) throw appErrors.conflict(`Tool ${row.id} exists`, 'That equipment is already registered.');
            requireFk('sites', row.siteId, 'site');
            assertValidEntity('tool', row);
            db.equipment.push(row);
            return row;
        }),
        update: (id, changes) => write('equipment.update', () => {
            const row = requireRow('equipment', 'id', id, 'Tool');
            const { id: _i, ...rest } = changes || {};
            const next = { ...row, ...rest };
            requireFk('sites', next.siteId, 'site');
            requireFk('sites', next.moveRequestedToSiteId, 'site');
            assertValidEntity('tool', next);
            Object.assign(row, next);
            return row;
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

    const repos = { sites, employees, roster, timesheets, crewLogs, costCodes, equipment, leave, audit };

    // All-or-nothing: one transaction at a time; any throw restores the database as it was before.
    // (A real backend runs the same work as one database transaction or server-side function.)
    let txQueue = Promise.resolve();
    function transaction(work) {
        const run = txQueue.then(async () => {
            const snapshot = clone(db);
            try {
                return await work(repos);
            } catch (err) {
                db = snapshot;
                saveDb();
                throw err;
            }
        });
        txQueue = run.catch(() => {});
        return run;
    }

    return {
        name: 'mock',
        ...repos,
        transaction,
        // Development and tests only: shape latency and failures
        debug: {
            failNext(opName, times = 1) { failNext[opName] = (failNext[opName] || 0) + times; },
            setLatency(ms) { config.latencyMs = ms; },
            setFailureRate(rate) { config.failureRate = rate; },
            reset() { db = clone(config.seed || {}); saveDb(); }
        }
    };
}
