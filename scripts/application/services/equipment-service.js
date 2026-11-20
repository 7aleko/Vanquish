/**
 * Application service: equipment. Transferring a tool to another site: an available tool moves now, a tool
 * in use is refused - ask its site with Request Availability (availabilityService) - and a tool in service
 * can't move (EquipmentRules.transferOutcome).
 * Registering new equipment: In Use at a construction site, Available at the factory (EquipmentRules.statusAt);
 * several identical units register as one quantity-tracked tool. A move takes the destination's status the
 * same way. Quantity-tracked tools move units between allocation buckets: transferUnits, setUnitStatus.
 */

function createEquipmentService(kit) {
    const { provider, store } = kit;

    // "14 Nov by Alexander F." - how the equipment log records who touched it last
    function logLine(employee) {
        const d = kit.clock.today();
        const [first, last] = String(employee.name).split(' ');
        const who = last ? `${first} ${last[0]}.` : first;
        return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-AU', { month: 'short' })} by ${who}`;
    }

    // The status a tool arrives in: the one the person chose (In Use or Available), otherwise by location
    function arrivalStatus(requested, site, fallback) {
        if (requested === undefined || requested === null || requested === '') return fallback;
        if (requested !== ToolStatus.IN_USE && requested !== ToolStatus.AVAILABLE) {
            throw appErrors.validation(`Arrival status ${requested} not allowed`, [{ field: 'status', message: 'must be In Use or Available' }], 'Choose In Use or Available.');
        }
        return requested;
    }

    /**
     * @param {string} toolId
     * @param {string} toSiteId
     * @param {{ status?: string }} [opts]   the status it arrives in (In Use / Available); default by location
     * @returns {Promise<{ outcome: 'move', tool: Tool }>}
     */
    async function transfer(toolId, toSiteId, opts = {}) {
        const who = kit.actor();
        Permissions.assert(who, 'equipment.transfer');
        const tool = store.get('equipment').find(t => t.id === toolId);
        if (!tool) throw appErrors.notFound('Tool', toolId);
        if (EquipmentRules.isGrouped(tool)) throw appErrors.validation(`${toolId} is quantity-tracked`, [{ field: 'toolId', message: 'choose units' }], 'Choose which units to transfer.');
        const site = store.get('sites').find(s => s.id === toSiteId);
        if (!site || !site.active) throw appErrors.validation('Destination site is not active', [{ field: 'toSiteId', message: 'is not an active site' }], 'Choose an active site.');

        const outcome = EquipmentRules.transferOutcome(tool, toSiteId);
        if (outcome === 'blocked') throw appErrors.conflict(`${tool.id} is in service`, `${tool.name} is unavailable until pickup is ready.`);
        if (outcome === 'same') throw appErrors.validation('Tool is already there', [{ field: 'toSiteId', message: 'is the current site' }], `${tool.name} is already at ${site.shortName}.`);
        // In use: someone has it. There are no move requests - ask the site (Request Availability) instead.
        if (outcome === 'request') {
            const here = store.get('sites').find(s => s.id === tool.siteId);
            throw appErrors.conflict(`${tool.id} is in use`, `${tool.name} is in use${here ? ` at ${here.shortName}` : ''}. Request availability first.`);
        }

        // A move arrives in the chosen status (default: In Use at a site, Available at the factory)
        const changes = { siteId: toSiteId, status: arrivalStatus(opts.status, site, EquipmentRules.statusAt(site, tool.status)), moveRequestedToSiteId: null, lastLogged: logLine(who) };
        const saved = await provider.transaction(async repos => {
            const record = await repos.equipment.update(toolId, changes);
            await kit.audit(repos, 'equipment', toolId, AuditAction.TRANSFER, who.id, { from: tool.siteId, to: toSiteId, status: changes.status });
            return record;
        });
        store.upsert('equipment', saved);
        return { outcome, tool: saved };
    }
    /**
     * Register new equipment.
     * @param {{ name: string, category: string, siteId: string, quantity?: number, unit?: string }} input
     * @returns {Promise<Tool>}
     */
    async function register(input) {
        const who = kit.actor();
        Permissions.assert(who, 'equipment.register');
        const name = String((input && input.name) || '').trim().replace(/\s+/g, ' ');
        const category = input && input.category;
        const siteId = input && input.siteId;
        const quantity = input && input.quantity !== undefined && input.quantity !== '' ? Number(input.quantity) : 1;
        const unit = String((input && input.unit) || '').trim();

        const problems = [];
        if (name.length < 2) problems.push({ field: 'name', message: 'Enter the equipment name' });
        else if (name.length > 80) problems.push({ field: 'name', message: 'Keep the name under 80 characters' });
        if (!ToolCategories.some(c => c.id === category)) problems.push({ field: 'category', message: 'Choose a category' });
        const site = store.get('sites').find(s => s.id === siteId);
        if (!site || !site.active) problems.push({ field: 'siteId', message: 'Choose an active site' });
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) problems.push({ field: 'quantity', message: 'Quantity is a whole number from 1' });
        if (problems.length) throw appErrors.validation('Equipment is invalid', problems, problems[0].message + '.');
        const key = name.toLowerCase();
        if (store.get('equipment').some(t => t.name.toLowerCase() === key && t.siteId === siteId)) {
            throw appErrors.conflict(`${name} already at ${siteId}`, `${name} is already registered at ${site.shortName}.`);
        }

        // One item: an individual tool. Several identical units: one quantity-tracked tool, all its units in
        // one bucket at the chosen location
        const status = EquipmentRules.statusAt(site);
        const record = quantity > 1
            ? { name, category, trackingType: 'quantity', totalQuantity: quantity, ...(unit ? { unit } : {}), lastLogged: logLine(who), initialAllocation: { siteId, status } }
            : { name, category, trackingType: 'individual', siteId, status, lastLogged: logLine(who) };
        const saved = await provider.transaction(async repos => {
            const created = await repos.equipment.create(record);
            await kit.audit(repos, 'equipment', created.id, AuditAction.CREATE, who.id, { siteId, category, quantity });
            return { tool: created, allocations: await repos.equipment.listAllocations({ toolId: created.id }) };
        });
        store.upsert('equipment', saved.tool);
        if (saved.allocations.length) store.replaceWhere('equipmentAllocations', a => a.toolId === saved.tool.id, saved.allocations);
        return saved.tool;
    }

    // ----- Quantity-tracked tools: move units between allocation buckets -----
    function groupedTool(toolId) {
        const tool = store.get('equipment').find(t => t.id === toolId);
        if (!tool) throw appErrors.notFound('Tool', toolId);
        if (!EquipmentRules.isGrouped(tool)) throw appErrors.validation(`${toolId} is an individual tool`, [{ field: 'toolId', message: 'is not quantity-tracked' }]);
        return tool;
    }
    function wholeQuantity(q) {
        const n = Number(q);
        if (!Number.isInteger(n) || n < 1) throw appErrors.validation('Quantity must be a whole number of at least 1', [{ field: 'quantity', message: 'must be at least 1' }], 'Choose at least 1 unit.');
        return n;
    }
    // Atomic in the database (source checked and decremented, destination incremented, buckets reconciled),
    // with the tool's log line and an audit entry in the same transaction
    async function moveUnits(who, tool, from, to, quantity, action, extra) {
        const saved = await provider.transaction(async repos => {
            const out = await repos.equipment.moveUnits(tool.id, { from, to, quantity });
            const updated = await repos.equipment.update(tool.id, { lastLogged: logLine(who) });
            await kit.audit(repos, 'equipment', tool.id, action, who.id, { from, to, quantity, ...(extra || {}) });
            return { tool: updated, allocations: out.allocations };
        }).catch(err => {
            // Someone else moved these units first: show the real counts
            if (err && err.code === ErrorCode.CONFLICT) store.refresh('equipmentAllocations').catch(() => {});
            throw err;
        });
        store.upsert('equipment', saved.tool);
        store.replaceWhere('equipmentAllocations', a => a.toolId === tool.id, saved.allocations);
        return saved;
    }

    /**
     * Transfer available units of a quantity-tracked tool to another location, arriving In Use or Available as
     * chosen (toStatus); without a choice, In Use at a construction site, Available at the factory.
     * @param {{ toolId: string, fromSiteId: ?string, toSiteId: string, quantity: number, toStatus?: string }} input
     */
    async function transferUnits({ toolId, fromSiteId = null, toSiteId, quantity, toStatus } = {}) {
        const who = kit.actor();
        Permissions.assert(who, 'equipment.transfer');
        const tool = groupedTool(toolId);
        const n = wholeQuantity(quantity);
        const site = store.get('sites').find(s => s.id === toSiteId);
        if (!site || !site.active) throw appErrors.validation('Destination is not active', [{ field: 'toSiteId', message: 'is not an active location' }], 'Choose an active location.');
        if ((fromSiteId || null) === toSiteId) throw appErrors.validation('Already there', [{ field: 'toSiteId', message: 'is the source' }], `These ${tool.name} are already at ${site.shortName}.`);
        const from = { siteId: fromSiteId || null, status: ToolStatus.AVAILABLE };   // only available units move
        const to = { siteId: toSiteId, status: arrivalStatus(toStatus, site, EquipmentRules.statusAt(site)) };
        return moveUnits(who, tool, from, to, n, AuditAction.TRANSFER);
    }

    /**
     * Change the status of some units where they are: Available / In Use / Service (out of service).
     * @param {{ toolId: string, siteId: ?string, fromStatus: string, toStatus: string, quantity: number }} input
     */
    async function setUnitStatus({ toolId, siteId = null, fromStatus, toStatus, quantity } = {}) {
        const who = kit.actor();
        Permissions.assert(who, 'equipment.setStatus');
        const tool = groupedTool(toolId);
        const n = wholeQuantity(quantity);
        if (![fromStatus, toStatus].every(v => Object.values(ToolStatus).includes(v))) {
            throw appErrors.validation('Unknown status', [{ field: 'toStatus', message: 'is not a status' }], 'Choose a status.');
        }
        if (fromStatus === toStatus) throw appErrors.validation('Same status', [{ field: 'toStatus', message: 'is the current status' }], 'Choose a different status.');
        return moveUnits(who, tool, { siteId: siteId || null, status: fromStatus }, { siteId: siteId || null, status: toStatus }, n, AuditAction.UPDATE);
    }

    return Object.freeze({ transfer, register, transferUnits, setUnitStatus });
}
