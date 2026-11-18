/**
 * Attendance data: site sign-ins (the mock "database" contents). Pure data - no logic. Loaded before the
 * mock seed (scripts/data-access/mock/seed.js), which is the only code that reads it.
 *
 * ATTENDANCE_SAMPLE: who signed in at which site on the Home / Roster demo day (APP_TODAY, Wed 14 Oct 2026),
 * at what local time ('HH:MM'), and when they signed out (null = still on site). People are named as on the
 * sites' crew lists (JOBS_DATA); the seed resolves names to employees (labour hire has no employee record).
 * The signed-in worker starts not signed in: their record is written by the Home card's Sign In button
 * (attendanceService). A real backend supplies these records instead.
 */

const ATTENDANCE_SAMPLE = [
    { date: '2026-10-14', siteId: 'lugarno', name: 'James Begg',    signIn: '06:48', signOut: null },
    { date: '2026-10-14', siteId: 'lugarno', name: 'David Hilt',    signIn: '06:55', signOut: null },
    { date: '2026-10-14', siteId: 'bondi',   name: 'Curtis Bell',   signIn: '06:40', signOut: '14:30' },
    { date: '2026-10-14', siteId: 'bondi',   name: 'Labour Hire 1', signIn: '06:58', signOut: null }
];
