/**
 * Timesheets sample data (scripts/features/timesheets.js): sites, the pay-run calendar, the signed-in
 * worker's sample records and what the rest of the crew logged.
 * Pure data - no logic. Loaded before all feature scripts.
 *
 * Every date is derived from real Date objects: records are written against "workday N of the current pay
 * run", so the scenario follows TIMESHEET_CONFIG.demoToday (or the real date when that is switched off)
 * instead of hard-coding calendar dates.
 */

const TIMESHEET_SITES = {
    'lugarno':    { id: 'lugarno',    name: 'Lugarno',    address: '935 Forest Road, Lugarno',     short: '935 Forest Rd' },
    'yowie-bay':  { id: 'yowie-bay',  name: 'Yowie Bay',  address: '1a Yelambie Street, Yowie Bay', short: '1a Yelambie St' },
    'castlecrag': { id: 'castlecrag', name: 'Castlecrag', address: '8C The Bulwark, Castlecrag',    short: '8C The Bulwark' }
};
const TIMESHEET_SITE_ORDER = ['lugarno', 'yowie-bay', 'castlecrag'];

const TIMESHEET_CONFIG = {
    targetHours: 8,                          // a full day; the ring is full at this many net hours
    defaultStart: '07:00',
    defaultFinish: '15:30',
    defaultBreakMins: 30,
    payRunAnchor: new Date(2026, 10, 2),     // a Monday on which a pay run starts; runs repeat every 14 days
    payRunLengthDays: 14,
    // Demo scenario: "today" is Friday 13 Nov 2026. Set useDemoToday to false to run on the real date.
    useDemoToday: true,
    demoToday: new Date(2026, 10, 13)
};

// The worker's saved shifts, by workday of the current pay run (0 = its first Monday, 9 = its second
// Friday). Workday 8 (Thursday) is left out on purpose: it is the missed day. Workday 9 is today.
const TIMESHEET_SAMPLE_RECORDS = [
    { workday: 0, site: 'lugarno',    start: '07:00', finish: '15:30', breakMins: 30, notes: 'Stood wall frames to ground floor, plumbed & braced east wall' },
    { workday: 1, site: 'lugarno',    start: '07:00', finish: '16:00', breakMins: 30, notes: 'Fixed lintels over openings, installed temp bracing to stair void' },
    { workday: 2, site: 'yowie-bay',  start: '07:00', finish: '15:30', breakMins: 30, notes: 'Set out deck footings, poured & levelled pier brackets' },
    { workday: 3, site: 'yowie-bay',  start: '06:30', finish: '15:30', breakMins: 30, notes: 'Ran deck bearers & joists, checked falls to waterfront edge' },
    { workday: 4, site: 'castlecrag', start: '07:00', finish: '15:30', breakMins: 30, notes: 'Stripped formwork, cleaned & stacked ply for reuse' },
    { workday: 5, site: 'lugarno',    start: '07:00', finish: '15:30', breakMins: 30, notes: 'Pitched roof trusses to rear wing, fixed tie-downs' },
    { workday: 6, site: 'lugarno',    start: '07:00', finish: '16:00', breakMins: 30, notes: 'Battened roof, fitted fascia & barge boards' },
    { workday: 7, site: 'castlecrag', start: '07:00', finish: '15:30', breakMins: 30, notes: 'Framed internal partition walls, level 1' }
];

// Where the worker is rostered on each workday of a pay run (the editor's default site for a day with
// no record). Repeats every pay run.
const TIMESHEET_PLANNED_SITES = ['lugarno', 'lugarno', 'yowie-bay', 'yowie-bay', 'castlecrag',
                                 'lugarno', 'lugarno', 'castlecrag', 'lugarno', 'lugarno'];

// Who else logs time at each site, with their usual hours and the work they wrote up. Crew logs appear for
// days up to and including today. A day's task is picked by its workday number, so it changes day to day.
const TIMESHEET_SITE_CREW = {
    'lugarno': [
        { name: 'David Hilt', start: '07:00', finish: '15:30', breakMins: 30, tasks: [
            'Stood & plumbed ground floor wall frames',
            'Fixed lintels & trimmers over window openings',
            'Installed stair void bracing & temp handrail',
            'Pitched rear wing trusses, fixed tie-down straps',
            'Set out & bolted perimeter bearers, north elevation'
        ] },
        { name: 'Curtis Bell', start: '07:00', finish: '16:00', breakMins: 30, tasks: [
            'Sheeted ground floor with 19mm yellow tongue',
            'Battened roof & set out valley boards',
            'Fitted fascia, barge & gutter brackets',
            'Framed bathroom nibs & installed noggings',
            'Cut & fixed floor joists & blocking'
        ] },
        { name: 'James Begg', start: '06:30', finish: '15:00', breakMins: 30, tasks: [
            'Cleared & stacked timber deliveries, site tidy',
            'Cut packers & set bearer heights with laser',
            'Fixed ceiling battens to garage',
            'Installed window flashings, rear elevation'
        ] }
    ],
    'yowie-bay': [
        { name: 'Shaun Terry', start: '07:00', finish: '15:30', breakMins: 30, tasks: [
            'Dug & poured deck pier footings',
            'Set deck bearers to string lines',
            'Laid spotted gum decking, first 20 boards',
            'Built stair stringers to waterfront landing'
        ] },
        { name: 'Labour Hire 1', start: '07:00', finish: '15:00', breakMins: 30, tasks: [
            'Barrowed concrete & cleaned tools',
            'Moved decking packs down to the lower level',
            'Site clean & skip loading'
        ] }
    ],
    'castlecrag': [
        { name: 'Trent Jamieson', start: '07:00', finish: '15:30', breakMins: 30, tasks: [
            'Stripped slab edge formwork, level 1',
            'Framed internal partitions, units 3 & 4',
            'Set out door openings & fixed jamb studs'
        ] },
        { name: 'Lachlan Swatosch', start: '06:30', finish: '15:00', breakMins: 0, tasks: [
            'Cleaned & stacked formply for reuse',
            'Loaded out & sorted steel offcuts',
            'Fixed noggings & blocking for cabinetry'
        ] }
    ]
};
