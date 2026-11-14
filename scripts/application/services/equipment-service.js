/**
 * Application service: equipment. Transferring a tool to another site: an available tool moves now, a tool
 * in use gets a move request, a tool in service can't move (EquipmentRules.transferOutcome).
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
    return Object.freeze({ transfer });
}
