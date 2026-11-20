/**
 * Application configuration: the one place that chooses the data provider and its settings.
 * Nothing here is secret. Never put service-role keys, private API keys or other privileged credentials in
 * frontend code; a real provider gets only a public (anon) key here, with access enforced server-side.
 */

const APP_CONFIG = Object.freeze({
    dataProvider: Object.freeze({
        provider: 'mock',           // 'mock' today. Add 'supabase', 'rest', ... in createDataProvider.
        latencyMs: 0,               // mock only: simulated network delay per call (try 400 to see loading states)
        failureRate: 0,             // mock only: 0..1 chance a call fails (exercises error states)
        // mock only: 'memory' (reload resets), 'session' (survives reloads in this tab) or 'local' (survives
        // reloads and is shared by every tab in this browser, with live change events between them - open
        // a second tab with ?as=team-31 to act as another person). ?reset-data starts again from the seed.
        persistence: 'local'
    }),
    auth: Object.freeze({
        provider: 'mock',           // a real identity provider plugs in at scripts/infrastructure/auth.js
        defaultEmployeeId: 'team-1' // mock sign-in: Alexander Floratos
    }),
    // The day the sites run on (Home, Roster, Site Hub, attendance, who is at a site): Wed 14 Oct 2026.
    // Timesheets keeps its own demo day (TIMESHEET_CONFIG).
    siteDemoDay: '2026-10-14'
});
