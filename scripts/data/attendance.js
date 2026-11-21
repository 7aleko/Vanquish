/**
 * Attendance data: site sign-ins (the mock "database" contents). Pure data - no logic. Loaded before the
 * mock seed (scripts/data-access/mock/seed.js), which is the only code that reads it.
 *
 * ATTENDANCE_SAMPLE: who signed in at which site on the sites' demo day (APP_TODAY, Mon 23 Nov 2026),
 * at what local time ('HH:MM'), and when they signed out (null = still on site). People are named as on the
 * sites' crew lists (JOBS_DATA) or, for a subcontractor, as the company on the site's schedule (whiteboard.js); the
 * seed resolves names to employees (labour hire and subcontractors have no employee record).
 * The signed-in worker starts not signed in: their record is written by the Home card's Sign In button
 * (attendanceService). A real backend supplies these records instead.
 */

const ATTENDANCE_SAMPLE = [
    { date: '2026-11-23', siteId: 'lugarno',    name: 'David Hilt',          signIn: '06:48', signOut: null },
    { date: '2026-11-23', siteId: 'lugarno',    name: 'James Begg',          signIn: '06:52', signOut: null },
    { date: '2026-11-23', siteId: 'lugarno',    name: 'VoltEdge Electrical', signIn: '07:15', signOut: null },
    { date: '2026-11-23', siteId: 'castlecrag', name: 'Brendan Hodge',       signIn: '06:41', signOut: null },
    { date: '2026-11-23', siteId: 'castlecrag', name: 'Jude Hudson',         signIn: '06:55', signOut: null },
    { date: '2026-11-23', siteId: 'castlecrag', name: 'Harbour Painting Co.', signIn: '07:05', signOut: null },
    { date: '2026-11-23', siteId: 'bondi',      name: 'Curtis Bell',         signIn: '06:40', signOut: null },
    { date: '2026-11-23', siteId: 'bondi',      name: 'Labour Hire 1',       signIn: '06:58', signOut: '11:30' },
    { date: '2026-11-23', siteId: 'bondi',      name: 'Apex Formwork',       signIn: '06:50', signOut: null }
];
