/**
 * Application bootstrap (composition root). Builds the app's single instances from configuration:
 *
 *   APP_CONFIG -> data provider (createDataProvider) + auth session (createAuthSession)
 *              -> appStore (server-state cache, loaded through the repositories)
 *              -> services (the only code that changes data)
 *
 * Screens use the globals defined here: the services (sitesService, rosterService, timesheetService,
 * crewLogService, attendanceService, siteContentService, equipmentService, leaveService) for changes, and the selectors
 * (scripts/application/selectors.js) for reads. Nothing else creates a provider or touches one.
 *
 * Loading starts immediately; boot.js waits for appStore.ready before the first render and shows an error
 * with Retry if it fails.
 */

// The app's clock. Timesheets runs on a fixed demo day while TIMESHEET_CONFIG.useDemoToday is on.
const appClock = Object.freeze({
    today() {
        const d = TIMESHEET_CONFIG.useDemoToday ? TIMESHEET_CONFIG.demoToday : new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    },
    now: () => new Date(),
    // The sites' day (Home, Roster, attendance, who is at a site)
    siteDay: () => (APP_CONFIG.siteDemoDay ? DateRules.fromIso(APP_CONFIG.siteDemoDay) : appClock.today())
});
const PAY_RUN_POLICY = Object.freeze({ anchor: TIMESHEET_CONFIG.payRunAnchor, lengthDays: TIMESHEET_CONFIG.payRunLengthDays });

const dataProvider = createDataProvider(APP_CONFIG.dataProvider, { today: () => appClock.today(), siteDay: () => appClock.siteDay(), payRunPolicy: PAY_RUN_POLICY });

// Mock only (development): ?reset-data starts the shared mock database again from the seed, and ?as=<employeeId>
// signs this tab in as someone else - e.g. a second tab as James Begg (?as=team-31) to answer a request.
// The choice holds for the tab across reloads. A real identity provider ignores both.
const mockAuthConfig = (() => {
    if (APP_CONFIG.auth.provider !== 'mock' || typeof location === 'undefined') return APP_CONFIG.auth;
    const params = new URLSearchParams(location.search);
    if (params.has('reset-data') && dataProvider.debug) dataProvider.debug.reset();
    let as = params.get('as');
    try {
        if (as) sessionStorage.setItem('lifestyle.mockUser', as);
        else as = sessionStorage.getItem('lifestyle.mockUser');
    } catch (_) { /* storage blocked */ }
    return as && /^[\w-]{1,40}$/.test(as) ? { ...APP_CONFIG.auth, defaultEmployeeId: as } : APP_CONFIG.auth;
})();
const authSession = createAuthSession(mockAuthConfig);

const appStore = createAppStore({
    sites: () => dataProvider.sites.list(),
    employees: () => dataProvider.employees.list(),
    roster: () => dataProvider.roster.list(),
    costCodes: () => dataProvider.costCodes.list(),
    // Production note: load timesheets and crew logs per employee / date range instead of everything
    timesheets: () => dataProvider.timesheets.list(),
    crewLogs: () => dataProvider.crewLogs.list(),
    attendance: () => dataProvider.attendance.list(),
    siteLogs: () => dataProvider.siteLogs.list(),
    drawings: () => dataProvider.drawings.list(),
    sitePhotos: () => dataProvider.sitePhotos.list(),
    equipment: () => dataProvider.equipment.list(),
    equipmentAllocations: () => dataProvider.equipment.listAllocations(),
    chats: () => dataProvider.chats.list(),
    chatMessages: () => dataProvider.chatMessages.list(),
    availabilityRequests: () => dataProvider.availability.listRequests(),
    // Only the signed-in user's own notifications are ever loaded
    notifications: async () => {
        const user = authSession.getCurrentUser();
        return user ? dataProvider.notifications.list({ recipientId: user.employeeId }) : [];
    },
    leaveRequests: () => dataProvider.leave.listRequests(),
    leaveBalances: async () => {
        const user = authSession.getCurrentUser();
        const balance = user ? await dataProvider.leave.getBalance(user.employeeId) : null;
        return balance ? [balance] : [];
    }
});

const serviceKit = createServiceKit({ provider: dataProvider, store: appStore, session: authSession, clock: appClock });
const sitesService = createSitesService(serviceKit);
const rosterService = createRosterService(serviceKit);
const timesheetService = createTimesheetService(serviceKit);
const crewLogService = createCrewLogService(serviceKit);
const attendanceService = createAttendanceService(serviceKit);
const siteContentService = createSiteContentService(serviceKit);
const equipmentService = createEquipmentService(serviceKit);
const leaveService = createLeaveService(serviceKit);
const availabilityService = createAvailabilityService(serviceKit);

appStore.load().catch(err => console.error('Initial data load failed:', err));

// Realtime: data changed elsewhere (another tab or device) -> re-fetch those collections; every screen
// subscribed to them redraws. Coming back online or to the tab re-fetches the live collections too, in case
// a change was missed while away.
const STORE_COLLECTIONS = new Set(['sites', 'employees', 'roster', 'costCodes', 'timesheets', 'crewLogs', 'attendance', 'siteLogs', 'drawings',
    'sitePhotos', 'equipment', 'equipmentAllocations', 'chats', 'chatMessages', 'availabilityRequests', 'notifications', 'leaveRequests', 'leaveBalances']);
const LIVE_COLLECTIONS = ['equipment', 'equipmentAllocations', 'chatMessages', 'availabilityRequests', 'notifications', 'attendance'];
function refreshCollections(names) {
    if (appStore.status !== 'ready') return;
    names.filter(c => STORE_COLLECTIONS.has(c)).forEach(c => appStore.refresh(c).catch(err => console.warn(`Refresh of ${c} failed:`, err)));
}
if (typeof dataProvider.subscribe === 'function') dataProvider.subscribe(refreshCollections);
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => refreshCollections(LIVE_COLLECTIONS));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCollections(LIVE_COLLECTIONS); });
}

// A different user signed in: their data (balances, roster, permissions) differs, so reload the cache;
// every screen subscribed to it redraws for the new user
authSession.onChange(() => {
    appStore.load().catch(err => console.error('Data reload after sign-in failed:', err));
});
