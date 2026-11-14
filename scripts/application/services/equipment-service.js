/**
 * Application service: equipment. Transferring a tool to another site: an available tool moves now, a tool
 * in use gets a move request, a tool in service can't move (EquipmentRules.transferOutcome).
 * Registering new equipment: it starts Available at the chosen site.
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

    /**
     * @returns {Promise<{ outcome: 'move' | 'request', tool: Tool }>}
     */
    async function transfer(toolId, toSiteId) {
        const who = kit.actor();
        Permissions.assert(who, 'equipment.transfer');
        const tool = store.get('equipment').find(t => t.id === toolId);
        if (!tool) throw appErrors.notFound('Tool', toolId);
        const site = store.get('sites').find(s => s.id === toSiteId);
        if (!site || !site.active) throw appErrors.validation('Destination site is not active', [{ field: 'toSiteId', message: 'is not an active site' }], 'Choose an active site.');

        const outcome = EquipmentRules.transferOutcome(tool, toSiteId);
        if (outcome === 'blocked') throw appErrors.conflict(`${tool.id} is in service`, `${tool.name} is unavailable until pickup is ready.`);
        if (outcome === 'same') throw appErrors.validation('Tool is already there', [{ field: 'toSiteId', message: 'is the current site' }], `${tool.name} is already at ${site.shortName}.`);

        const changes = outcome === 'move'
            ? { siteId: toSiteId, moveRequestedToSiteId: null, lastLogged: logLine(who) }
            : { moveRequestedToSiteId: toSiteId, lastLogged: logLine(who) };
        const saved = await provider.transaction(async repos => {
            const record = await repos.equipment.update(toolId, changes);
            await kit.audit(repos, 'equipment', toolId, outcome === 'move' ? AuditAction.TRANSFER : AuditAction.REQUEST_MOVE, who.id,
                { from: tool.siteId, to: toSiteId });
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

        const record = { name, category, siteId, status: ToolStatus.AVAILABLE, lastLogged: logLine(who) };
        if (quantity > 1) { record.quantity = quantity; record.unit = unit || 'Units'; }
        const saved = await provider.transaction(async repos => {
            const created = await repos.equipment.create(record);
            await kit.audit(repos, 'equipment', created.id, AuditAction.CREATE, who.id, { siteId, category });
            return created;
        });
        store.upsert('equipment', saved);
        return saved;
    }

    return Object.freeze({ transfer, register });
}
