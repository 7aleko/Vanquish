/**
 * Application bootstrap (composition root). Builds the app's single instances from configuration:
 *
 *   APP_CONFIG -> data provider (createDataProvider) + auth session (createAuthSession)
 *              -> appStore (server-state cache, loaded through the repositories)
 *              -> services (the only code that changes data)
 *
 * Screens use the globals defined here: the services (sitesService, rosterService, timesheetService,
 * crewLogService, equipmentService, leaveService) for changes, and the selectors
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
    }
});
const PAY_RUN_POLICY = Object.freeze({ anchor: TIMESHEET_CONFIG.payRunAnchor, lengthDays: TIMESHEET_CONFIG.payRunLengthDays });

const dataProvider = createDataProvider(APP_CONFIG.dataProvider, { today: () => appClock.today(), payRunPolicy: PAY_RUN_POLICY });
const authSession = createAuthSession(APP_CONFIG.auth);

const appStore = createAppStore({
    sites: () => dataProvider.sites.list(),
    employees: () => dataProvider.employees.list(),
    roster: () => dataProvider.roster.list(),
    costCodes: () => dataProvider.costCodes.list(),
    // Production note: load timesheets and crew logs per employee / date range instead of everything
    timesheets: () => dataProvider.timesheets.list(),
    crewLogs: () => dataProvider.crewLogs.list(),
    equipment: () => dataProvider.equipment.list(),
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
const equipmentService = createEquipmentService(serviceKit);
const leaveService = createLeaveService(serviceKit);

appStore.load().catch(err => console.error('Initial data load failed:', err));

// A different user signed in: their data (balances, roster, permissions) differs, so reload the cache;
// every screen subscribed to it redraws for the new user
authSession.onChange(() => {
    appStore.load().catch(err => console.error('Data reload after sign-in failed:', err));
});
