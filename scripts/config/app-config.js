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
        persistence: 'memory'       // mock only: 'memory' (reload resets) or 'session' (survives reloads in this tab)
    }),
    auth: Object.freeze({
        provider: 'mock',           // a real identity provider plugs in at scripts/infrastructure/auth.js
        defaultEmployeeId: 'team-1' // mock sign-in: Alexander Floratos
    })
});
