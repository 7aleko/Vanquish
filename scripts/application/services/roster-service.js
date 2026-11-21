/**
 * Application service: roster. Assigning an employee to a site for a day (or to several sites, as a split
 * day's stints), moving them between sites, and taking them off the roster. Timesheets, Home and the Roster
 * screen read the same entries, so a change shows on all of them.
 */

function createRosterService(kit) {
    const { provider, store } = kit;

    // stints (optional): a split day, [{ siteId, start: 'HH:MM', end: 'HH:MM' }]. siteId is then the first
    // stint's site and can be left out.
    async function assign({ employeeId, date, siteId, stints }) {
        const who = kit.actor();
        Permissions.assert(who, 'roster.assign');
        const errors = [];
        if (!DateRules.isIsoDate(date)) errors.push({ field: 'date', message: 'must be a YYYY-MM-DD date' });
        const split = Array.isArray(stints) && stints.length > 0;
        if (split) errors.push(...RosterRules.validateStints(stints));
        const siteIds = split ? [...new Set(stints.map(s => s.siteId))] : [siteId];
        siteIds.forEach(id => {
            const site = store.get('sites').find(s => s.id === id);
            if (!site) errors.push({ field: 'siteId', message: `${id || 'site'} does not exist` });
            else if (!site.active) errors.push({ field: 'siteId', message: `${site.shortName} is archived` });
        });
        if (!store.get('employees').some(e => e.id === employeeId)) errors.push({ field: 'employeeId', message: 'does not exist' });
        if (errors.length) throw appErrors.validation('Roster assignment is invalid', errors, 'Choose active sites, a valid day and times that don\'t overlap.');

        const saved = await provider.transaction(async repos => {
            const entry = await repos.roster.assign(split ? { employeeId, date, stints } : { employeeId, date, siteId });
            await kit.audit(repos, 'roster', entry.id, AuditAction.ASSIGN, who.id, split ? { siteId: entry.siteId, stints: entry.stints } : { siteId });
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
        // A split day: e.g. [{ siteId: 'lugarno', start: '07:00', end: '09:00' }, { siteId: 'castlecrag', start: '09:00', end: '15:30' }]
        splitDay: (employeeId, date, stints) => assign({ employeeId, date, stints }),
        unassign
    });
}
