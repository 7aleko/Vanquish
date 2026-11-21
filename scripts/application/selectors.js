/**
 * Application: selectors - the synchronous read API screens use. Each one reads the server-state cache
 * (appStore) and derives what a screen needs; none of them fetch, write or keep a copy. Writes go through the
 * services (scripts/application/services/).
 *
 * Replaces scripts/core/sites-store.js; the site and roster function names are unchanged.
 */

// ---------- Sites ----------
function getSites() { return appStore.get('sites'); }
function getSiteById(siteId) {
    if (!siteId) return null;
    return appStore.memo('sitesById', ['sites'], () => new Map(getSites().map(s => [s.id, s]))).get(siteId) || null;
}
// Construction sites that can be chosen for new work, in master order (never the factory)
function getActiveSites() { return appStore.memo('activeSites', ['sites'], () => getSites().filter(s => s.active && s.kind !== 'factory')); }
// Where equipment can be: the factory first, then the active construction sites
function getEquipmentLocations() {
    return appStore.memo('equipmentLocations', ['sites'], () => {
        const live = getSites().filter(s => s.active);
        return [...live.filter(s => s.kind === 'factory'), ...live.filter(s => s.kind !== 'factory')];
    });
}
function isFactory(siteId) { const s = getSiteById(siteId); return !!(s && s.kind === 'factory'); }
function getSiteName(siteId, fallback = '') {
    const site = getSiteById(siteId);
    return site ? site.shortName : fallback;
}
// The street line ("935 Forest Road")
function getSiteAddress(siteId) {
    const site = getSiteById(siteId);
    return site ? site.address : '';
}
// Street line and suburb ("935 Forest Road, Lugarno"); the suburb is left off when the street line already
// contains it
function getSiteFullAddress(siteId) {
    const site = getSiteById(siteId);
    if (!site) return '';
    if (!site.suburb || site.address.toLowerCase().includes(site.suburb.toLowerCase())) return site.address;
    return `${site.address}, ${site.suburb}`;
}
function isSiteActive(siteId) {
    const site = getSiteById(siteId);
    return !!(site && site.active);
}
// fn() after sites or the roster change (a rename, an archive, a new assignment). Returns unsubscribe.
function subscribeSites(fn) { return appStore.subscribe(() => fn(), ['sites', 'roster']); }

// ---------- Employees ----------
// The signed-in employee's id (scripts/infrastructure/auth.js)
function getCurrentEmployeeId() {
    const user = authSession.getCurrentUser();
    return user ? user.employeeId : null;
}
function getEmployees() { return appStore.get('employees'); }
function getEmployeeById(id) {
    return appStore.memo('employeesById', ['employees'], () => new Map(getEmployees().map(e => [e.id, e]))).get(id) || null;
}
// Lookup by full name (case-insensitive), for records that only carry a name (crew lists, chats)
function getEmployeeByName(name) {
    const key = String(name || '').trim().toLowerCase();
    return appStore.memo('employeesByName', ['employees'], () => new Map(getEmployees().map(e => [e.name.toLowerCase(), e]))).get(key) || null;
}
function getCurrentEmployee() { return getEmployeeById(getCurrentEmployeeId()); }

// ---------- Roster ----------
// An employee's roster entry for a date (Date or 'YYYY-MM-DD'), or null. An entry pointing at a site that
// doesn't exist is reported once and treated as no entry.
const reportedBadRosterEntries = new Set();
function getRosterEntry(date, employeeId = getCurrentEmployeeId()) {
    const iso = DateRules.toIso(date);
    const index = appStore.memo('rosterIndex', ['roster'], () => new Map(appStore.get('roster').map(r => [`${r.employeeId}|${r.date}`, r])));
    const entry = index.get(`${employeeId}|${iso}`);
    if (!entry) return null;
    if (!getSiteById(entry.siteId)) {
        const key = `${iso}/${employeeId}`;
        if (!reportedBadRosterEntries.has(key)) {
            reportedBadRosterEntries.add(key);
            console.warn(`Roster: ${key} points at unknown site "${entry.siteId}"`);
        }
        return null;
    }
    return entry;
}
function getRosteredSiteId(date, employeeId = getCurrentEmployeeId()) {
    const entry = getRosterEntry(date, employeeId);
    return entry ? entry.siteId : null;
}
// Everyone rostered to a site on a date
function getRosterForSite(date, siteId) {
    const iso = DateRules.toIso(date);
    return appStore.get('roster').filter(e => e.date === iso && e.siteId === siteId);
}

// ---------- Cost codes ----------
function getCostCodes() { return appStore.get('costCodes'); }
function getCostCode(code) { return getCostCodes().find(c => c.code === code) || null; }

// ---------- Timesheets ----------
// An employee's timesheets keyed by date
function getTimesheetsByDate(employeeId = getCurrentEmployeeId()) {
    return appStore.memo(`timesheetsByDate:${employeeId}`, ['timesheets'], () => {
        const map = {};
        appStore.get('timesheets').forEach(t => { if (t.employeeId === employeeId) map[t.date] = t; });
        return map;
    });
}

// ---------- Crew logs ----------
// Crew logs for a date at a site: matched on both the date and the siteId, never on a name
function getCrewLogs(date, siteId) {
    if (!siteId) return [];
    const iso = DateRules.toIso(date);
    return appStore.get('crewLogs').filter(l => l.date === iso && l.siteId === siteId);
}

// ---------- Attendance ----------
// Site sign-ins for a date at a site (Attendance records), and one employee's record for a date
function getAttendance(date, siteId) {
    if (!siteId) return [];
    const iso = DateRules.toIso(date);
    return appStore.get('attendance').filter(a => a.date === iso && a.siteId === siteId);
}
function getMyAttendance(date, employeeId = getCurrentEmployeeId()) {
    const iso = DateRules.toIso(date);
    return appStore.get('attendance').find(a => a.date === iso && a.employeeId === employeeId) || null;
}
function subscribeAttendance(fn) { return appStore.subscribe(() => fn(), ['attendance']); }

// ---------- Site content (Site Hub) ----------
// Newest first: logs by day then time written; drawings by the day the revision was issued; photos by day
function getSiteLogs(siteId) {
    return appStore.get('siteLogs').filter(l => l.siteId === siteId)
        .slice().sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1)));
}
function getSiteLogById(id) { return appStore.get('siteLogs').find(l => l.id === id) || null; }
function getDrawings(siteId) {
    return appStore.get('drawings').filter(d => d.siteId === siteId).slice().sort((a, b) => (a.updatedOn < b.updatedOn ? 1 : -1));
}
function getDrawingById(id) { return appStore.get('drawings').find(d => d.id === id) || null; }
function getSitePhotos(siteId) {
    return appStore.get('sitePhotos').filter(p => p.siteId === siteId)
        .slice().sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1)));
}
function getLogPhotos(logId) { return appStore.get('sitePhotos').filter(p => p.logId === logId); }
function subscribeSiteContent(fn) { return appStore.subscribe(() => fn(), ['siteLogs', 'drawings', 'sitePhotos']); }

// ---------- Equipment ----------
function getTools() { return appStore.get('equipment'); }
// By id; a per-unit id folded into a grouped record (mergedIds) resolves to that record
function getToolById(id) { return getTools().find(t => t.id === id || (t.mergedIds && t.mergedIds.includes(id))) || null; }
function isGroupedTool(tool) { return EquipmentRules.isGrouped(tool); }
// A grouped tool's buckets: available first, then in use, then out of service; the factory first within each
const TOOL_STATUS_ORDER = [ToolStatus.AVAILABLE, ToolStatus.IN_USE, ToolStatus.SERVICE];
function getToolAllocations(toolId) {
    const where = a => (!a.siteId ? 2 : getSiteById(a.siteId) && getSiteById(a.siteId).kind === 'factory' ? 0 : 1);
    return appStore.get('equipmentAllocations').filter(a => a.toolId === toolId).slice().sort((a, b) =>
        (TOOL_STATUS_ORDER.indexOf(a.status) - TOOL_STATUS_ORDER.indexOf(b.status)) || (where(a) - where(b)) ||
        getSiteName(a.siteId, '').localeCompare(getSiteName(b.siteId, '')));
}
// How many tools (cards) have something in a status: an individual tool counts once for its status; a grouped
// tool counts once under each status any of its units are in. What the Tools tiles and Home show - the tiles
// filter the cards, so their numbers match the cards they show.
function countToolsWithStatus(status) {
    return appStore.memo(`toolsWith:${status}`, ['equipment', 'equipmentAllocations'], () => {
        const grouped = new Set(appStore.get('equipmentAllocations').filter(a => a.status === status).map(a => a.toolId));
        return getTools().filter(t => (isGroupedTool(t) ? grouped.has(t.id) : t.status === status)).length;
    });
}
// How many physical units are in a status (an individual tool is one unit; a grouped tool counts its buckets)
function countToolUnits(status) {
    return appStore.memo(`toolUnits:${status}`, ['equipment', 'equipmentAllocations'], () =>
        getTools().filter(t => !isGroupedTool(t) && t.status === status).length +
        appStore.get('equipmentAllocations').filter(a => a.status === status).reduce((n, a) => n + a.quantity, 0));
}

// ---------- Site schedule ----------
// A site's bookings, by start date (longer first on the same day)
function getScheduleTasks(siteId) {
    return appStore.get('scheduleTasks').filter(t => t.siteId === siteId).slice().sort((a, b) =>
        (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : (a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0)));
}
function getScheduleTask(id) { return appStore.get('scheduleTasks').find(t => t.id === id) || null; }
function getScheduleTrades() { return appStore.get('scheduleTrades'); }
function getScheduleTrade(id) { return getScheduleTrades().find(t => t.id === id) || { id, name: 'Other', color: '#8E8E93' }; }
// The site's milestones by due day, the one to work towards, and the next booking from a day ('YYYY-MM-DD')
function getSiteMilestones(siteId) { return ScheduleRules.milestones(getScheduleTasks(siteId)); }
function getUpcomingMilestone(siteId) { return siteId ? ScheduleRules.upcomingMilestone(getScheduleTasks(siteId)) : null; }
function getNextOnSite(siteId, fromIso) { return siteId ? ScheduleRules.nextOnSite(getScheduleTasks(siteId), fromIso) : null; }
function subscribeSchedule(fn) { return appStore.subscribe(() => fn(), ['scheduleTasks', 'scheduleTrades', 'sites']); }

// ---------- Chats ----------
function getChatForSite(siteId) {
    if (!siteId) return null;
    return appStore.get('chats').find(c => c.kind === 'site' && c.siteId === siteId) || null;
}
// A chat's structured messages (availability cards), oldest first
function getChatMessages(chatId) {
    return appStore.get('chatMessages').filter(m => m.chatId === chatId).slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
function getChatMessageById(id) { return appStore.get('chatMessages').find(m => m.id === id) || null; }

// ---------- Equipment availability requests ----------
// Each request with its status as of now (a pending request past its 30 minutes reads as expired)
function withLiveStatus(r) {
    return r ? { ...r, liveStatus: AvailabilityRules.effectiveStatus(r, Date.now()) } : null;
}
function getAvailabilityRequest(id) {
    return withLiveStatus(appStore.get('availabilityRequests').find(r => r.id === id) || null);
}
// The tool's latest request (what its Tools card shows), or null. Grouped tools: per site (one bucket's request).
function getToolAvailability(toolId, siteId) {
    const rows = appStore.get('availabilityRequests').filter(r => r.toolId === toolId && (siteId === undefined || r.siteId === siteId));
    if (!rows.length) return null;
    const latest = rows.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
    return { ...withLiveStatus(latest), active: AvailabilityRules.isActive(latest, Date.now()) };
}
function subscribeAvailability(fn) { return appStore.subscribe(() => fn(), ['availabilityRequests', 'chatMessages', 'equipment', 'equipmentAllocations']); }

// ---------- Notifications (the signed-in user's own) ----------
function getMyNotifications() {
    const me = getCurrentEmployeeId();
    return appStore.get('notifications').filter(n => n.recipientId === me).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
function subscribeNotifications(fn) { return appStore.subscribe(() => fn(), ['notifications']); }

// ---------- Leave ----------
function getLeaveBalance(employeeId = getCurrentEmployeeId()) {
    return appStore.get('leaveBalances').find(b => b.employeeId === employeeId) || null;
}
function getLeaveRequests({ employeeId = getCurrentEmployeeId(), status } = {}) {
    return appStore.get('leaveRequests')
        .filter(r => r.employeeId === employeeId && (!status || r.status === status))
        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}
