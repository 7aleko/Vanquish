/**
 * Application service: crew logs. Reading what the crew logged at a site on a day, and copying a person's
 * blocks as the starting point for your own timesheet. Copying never changes the crew record and never
 * submits anything: it returns fresh blocks for an editable draft.
 */

function createCrewLogService(kit) {
    const { store } = kit;

    // Matched on date AND siteId - never on a site's name
    function forSiteOnDate(date, siteId) {
        if (!siteId) return [];
        return store.get('crewLogs').filter(l => l.date === date && l.siteId === siteId);
    }
    // New, unsaved blocks with the same cost codes, times, breaks and tasks as a crew member's log
    function copyBlocks(crewLogId) {
        const log = store.get('crewLogs').find(l => l.id === crewLogId);
        if (!log) throw appErrors.notFound('Crew log', crewLogId);
        return log.blocks.map(b => ({ code: b.code, start: b.start, finish: b.finish, breakMins: b.breakMins, task: b.task }));
    }
    return Object.freeze({ forSiteOnDate, copyBlocks });
}
