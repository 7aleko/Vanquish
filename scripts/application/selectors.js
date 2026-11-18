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
// Sites that can be chosen for new work, in master order
function getActiveSites() { return appStore.memo('activeSites', ['sites'], () => getSites().filter(s => s.active)); }
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
function getToolById(id) { return getTools().find(t => t.id === id) || null; }

// ---------- Leave ----------
function getLeaveBalance(employeeId = getCurrentEmployeeId()) {
    return appStore.get('leaveBalances').find(b => b.employeeId === employeeId) || null;
}
function getLeaveRequests({ employeeId = getCurrentEmployeeId(), status } = {}) {
    return appStore.get('leaveRequests')
        .filter(r => r.employeeId === employeeId && (!status || r.status === status))
        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}
