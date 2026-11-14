/**
 * Test helper: loads the app's non-UI layers (domain, mock data, data access, auth, application) into an
 * isolated JavaScript context - the same classic scripts the browser loads, in the same order, without a
 * DOM. Each call gives a fresh context, so tests never share state.
 *
 *   const app = loadApp();                      // the layers
 *   const env = app.makeEnv({ latencyMs: 0 });  // a fresh provider + store + services, loaded
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPTS = [
    'scripts/domain/enums.js',
    'scripts/domain/errors.js',
    'scripts/domain/models.js',
    'scripts/domain/rules/time.js',
    'scripts/domain/rules/pay-run.js',
    'scripts/domain/rules/timesheets.js',
    'scripts/domain/validation.js',
    'scripts/data/sites.js',
    'scripts/data/roster.js',
    'scripts/data/team.js',
    'scripts/data/tools.js',
    'scripts/data/account.js',
    'scripts/data/timesheets.js',
    'scripts/config/app-config.js',
    'scripts/data-access/contracts.js',
    'scripts/data-access/mock/seed.js',
    'scripts/data-access/mock/mock-provider.js',
    'scripts/data-access/provider.js',
    'scripts/infrastructure/auth.js',
    'scripts/application/permissions.js',
    'scripts/application/store.js',
    'scripts/application/services/service-kit.js',
    'scripts/application/services/sites-service.js',
    'scripts/application/services/roster-service.js',
    'scripts/application/services/timesheet-service.js',
    'scripts/application/services/crew-log-service.js',
    'scripts/application/services/equipment-service.js',
    'scripts/application/services/leave-service.js'
];
const EXPORTS = ['SiteAssignmentType', 'TimesheetStatus', 'ToolStatus', 'LeaveType', 'LeaveStatus', 'ErrorCode', 'AuditAction',
    'AppError', 'DateRules', 'TimeRules', 'PayRunRules', 'TimesheetRules', 'EquipmentRules', 'LeaveRules',
    'EntitySchemas', 'validateAgainst', 'assertValidEntity', 'REPOSITORY_CONTRACTS', 'assertImplementsContracts',
    'buildMockSeed', 'createMockDataProvider', 'createDataProvider', 'createAuthSession', 'Permissions', 'createAppStore',
    'createServiceKit', 'createSitesService', 'createRosterService', 'createTimesheetService', 'createCrewLogService',
    'createEquipmentService', 'createLeaveService', 'TIMESHEET_CONFIG'];

function loadApp() {
    const ctx = vm.createContext({ console, setTimeout, clearTimeout, structuredClone, Promise, Date, Math, JSON });
    SCRIPTS.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file }));
    const app = {};
    EXPORTS.forEach(name => { app[name] = vm.runInContext(name, ctx); });

    // A fresh, loaded set of provider, store and services on the Timesheets demo day (Fri 13 Nov 2026)
    app.makeEnv = async (opts = {}) => {
        const today = opts.today || new Date(2026, 10, 13);
        const clock = { today: () => new Date(today) };
        const policy = { anchor: app.TIMESHEET_CONFIG.payRunAnchor, lengthDays: app.TIMESHEET_CONFIG.payRunLengthDays };
        const provider = app.assertImplementsContracts(app.createMockDataProvider({
            seed: app.buildMockSeed({ today, payRunPolicy: policy }), latencyMs: opts.latencyMs || 0
        }));
        const session = app.createAuthSession({ provider: 'mock', defaultEmployeeId: opts.employeeId || 'team-1' });
        const store = app.createAppStore({
            sites: () => provider.sites.list(), employees: () => provider.employees.list(), roster: () => provider.roster.list(),
            costCodes: () => provider.costCodes.list(), timesheets: () => provider.timesheets.list(), crewLogs: () => provider.crewLogs.list(),
            equipment: () => provider.equipment.list(), leaveRequests: () => provider.leave.listRequests(),
            leaveBalances: async () => { const b = await provider.leave.getBalance(session.getCurrentUser().employeeId); return b ? [b] : []; }
        });
        await store.load();
        const kit = app.createServiceKit({ provider, store, session, clock });
        return {
            provider, store, session, clock, policy,
            sites: app.createSitesService(kit), roster: app.createRosterService(kit), timesheets: app.createTimesheetService(kit),
            crewLogs: app.createCrewLogService(kit), equipment: app.createEquipmentService(kit), leave: app.createLeaveService(kit)
        };
    };
    return app;
}

module.exports = { loadApp };
