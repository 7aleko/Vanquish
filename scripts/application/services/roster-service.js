/**
 * Application service: roster. Assigning an employee to a site for a day, moving them between sites, and
 * taking them off the roster. Timesheets, Home and the Roster screen read the same entries, so a change
 * shows on all of them.
 */

function createRosterService(kit) {
    const { provider, store } = kit;

    async function assign({ employeeId, date, siteId }) {
        const who = kit.actor();
        Permissions.assert(who, 'roster.assign');
        const errors = [];
        if (!DateRules.isIsoDate(date)) errors.push({ field: 'date', message: 'must be a YYYY-MM-DD date' });
        const site = store.get('sites').find(s => s.id === siteId);
        if (!site) errors.push({ field: 'siteId', message: 'does not exist' });
        else if (!site.active) errors.push({ field: 'siteId', message: 'is archived' });
        if (!store.get('employees').some(e => e.id === employeeId)) errors.push({ field: 'employeeId', message: 'does not exist' });
        if (errors.length) throw appErrors.validation('Roster assignment is invalid', errors, 'Choose an active site and a valid day.');

        const saved = await provider.transaction(async repos => {
            const entry = await repos.roster.assign({ employeeId, date, siteId });
            await kit.audit(repos, 'roster', entry.id, AuditAction.ASSIGN, who.id, { siteId });
            return entry;
        });
        store.upsert('roster', saved);
        return saved;
    }

    async function unassign(entryId) {
        const who = kit.actor();
        Permissions.assert(who, 'roster.assign');
        await provider.transaction(async repos => {
            await repos.roster.remove(entryId);
            await kit.audit(repos, 'roster', entryId, AuditAction.UPDATE, who.id, { removed: true });
        });
        store.remove('roster', entryId);
    }

    return Object.freeze({
        assign,
        // Moving someone between sites for a day is the same operation: their one entry for that day changes
        moveEmployee: (employeeId, date, toSiteId) => assign({ employeeId, date, siteId: toSiteId }),
        unassign
    });
}
