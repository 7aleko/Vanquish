/**
 * Timesheets sample data (scripts/features/timesheets.js): cost codes, the signed-in worker's submitted
 * days and what the rest of the crew logged.
 * Pure data - no logic. Loaded before all feature scripts.
 *
 * Sites and the roster are not kept here: every record refers to its site by siteId (SITES,
 * scripts/data/sites.js) and the rostered site for a day comes from ROSTER (scripts/data/roster.js).
 *
 * Records are written against "workday N of the current pay run", so the scenario follows
 * TIMESHEET_CONFIG.demoToday (or the real date when that is switched off). Swap these for API responses to
 * go live.
 */

// Cost codes a time block can be booked against
const TIMESHEET_COST_CODES = [
    { code: '001-2', title: 'Site Apprentice · PS' },
    { code: '004-1', title: 'Demolition works · PS' },
    { code: '006-1', title: 'Structural Framing · PS' },
    { code: '006-4', title: 'Subfloor & Decking · PS' },
    { code: '008-2', title: 'External Cladding & Eaves · PS' },
    { code: '009-3', title: 'Internal Fix-Out & Joinery · PS' },
    { code: '001-9', title: 'Site Prelim, Clean & Lockup · PS' }
];

const TIMESHEET_CONFIG = {
    targetHours: 8,                          // a full day; the ring closes at this many net hours
    defaultStart: '07:00',
    defaultFinish: '15:30',
    defaultBreakMins: 30,
    payRunAnchor: new Date(2026, 10, 2),     // a Monday on which a pay run starts; runs repeat every 14 days
    payRunLengthDays: 14,
    // Demo scenario: "today" is Friday 13 Nov 2026. Set useDemoToday to false to run on the real date.
    useDemoToday: true,
    demoToday: new Date(2026, 10, 13)
};

// Submitted days, by workday of the current pay run (0 = its first Monday, 9 = its second Friday).
// Workday 8 (Thursday) is the missed day; workday 9 is today, not yet logged. Totals: 65.5h over 8 days,
// with one overtime day (9.5h).
const TIMESHEET_SAMPLE_RECORDS = [
    { workday: 0, siteId: 'lugarno', approval: 'approved', blocks: [
        { code: '004-1', start: '07:00', finish: '09:00', breakMins: 0,  task: 'Stripped existing subfloor framing, rear wing' },
        { code: '006-1', start: '09:00', finish: '15:30', breakMins: 30, task: 'Stood & plumbed ground floor wall frames' } ] },
    { workday: 1, siteId: 'lugarno', approval: 'approved', blocks: [
        { code: '006-1', start: '07:00', finish: '12:00', breakMins: 0,  task: 'Fixed lintels & trimmers over window openings' },
        { code: '006-1', start: '12:00', finish: '16:00', breakMins: 30, task: 'Installed temp bracing to stair void' } ] },
    { workday: 2, siteId: 'yowie-bay', approval: 'approved', blocks: [
        { code: '006-4', start: '07:00', finish: '15:30', breakMins: 30, task: 'Set out deck footings, poured & levelled pier brackets' } ] },
    { workday: 3, siteId: 'yowie-bay', approval: 'approved', blocks: [
        { code: '006-4', start: '06:30', finish: '10:30', breakMins: 0,  task: 'Ran deck bearers to string lines' },
        { code: '006-4', start: '10:30', finish: '16:30', breakMins: 30, task: 'Laid & fixed deck joists, checked falls to waterfront edge' } ] },
    { workday: 4, siteId: 'castlecrag', approval: 'approved', blocks: [
        { code: '004-1', start: '07:00', finish: '11:00', breakMins: 0,  task: 'Stripped slab edge formwork, level 1' },
        { code: '001-9', start: '11:00', finish: '15:00', breakMins: 30, task: 'Cleaned & stacked formply, site lockup' } ] },
    { workday: 5, siteId: 'lugarno', approval: 'awaiting', blocks: [
        { code: '001-2', start: '07:00', finish: '09:00', breakMins: 0,  task: 'Supervised apprentice on truss set-out' },
        { code: '006-1', start: '09:00', finish: '15:30', breakMins: 30, task: 'Pitched rear wing trusses, fixed tie-downs' } ] },
    { workday: 6, siteId: 'lugarno', approval: 'awaiting', blocks: [
        { code: '008-2', start: '07:00', finish: '15:30', breakMins: 30, task: 'Fixed fascia, barge boards & eaves lining' } ] },
    { workday: 7, siteId: 'castlecrag', approval: 'awaiting', blocks: [
        { code: '009-3', start: '07:00', finish: '12:00', breakMins: 0,  task: 'Framed internal partitions, units 3 & 4' },
        { code: '009-3', start: '12:00', finish: '15:30', breakMins: 30, task: 'Set out door openings, fixed jamb studs' } ] }
];

// The previous pay run, all approved, so the Pay Run card's fortnight navigation has history to show.
// Each workday reuses a typical day from above (`src`) at the site worked: the rostered site, and Castlecrag
// on the unrostered Wednesday.
const TIMESHEET_PREVIOUS_RUN_RECORDS = [
    { src: 0, siteId: 'lugarno' }, { src: 1, siteId: 'lugarno' }, { src: 2, siteId: 'yowie-bay' },
    { src: 3, siteId: 'yowie-bay' }, { src: 4, siteId: 'castlecrag' }, { src: 5, siteId: 'lugarno' },
    { src: 6, siteId: 'lugarno' }, { src: 7, siteId: 'castlecrag' }, { src: 1, siteId: 'lugarno' },
    { src: 2, siteId: 'lugarno' }
].map((r, workday) => ({ workday, siteId: r.siteId, approval: 'approved', blocks: TIMESHEET_SAMPLE_RECORDS[r.src].blocks }));

// What the rest of the crew submits at each site, keyed by siteId. Each person has a few typical days
// ("plans"); a day's plan is picked by its workday number, so logs change from day to day. The Timesheets
// screen turns these into dated CREW_LOGS records (one per person, date and site) and filters them by date
// and siteId. Sites missing here have no crew logs.
const TIMESHEET_CREW_PLANS = {
    'lugarno': [
        { name: 'David Hilt', plans: [
            [ { code: '004-1', start: '07:00', finish: '09:00', breakMins: 0,  task: 'Cut out rotten bearers, north elevation' },
              { code: '006-4', start: '09:00', finish: '15:30', breakMins: 30, task: 'Set out & bolted perimeter bearers, north elevation' } ],
            [ { code: '006-1', start: '07:00', finish: '12:00', breakMins: 0,  task: 'Stood & plumbed wall frames, ground floor' },
              { code: '006-1', start: '12:00', finish: '15:30', breakMins: 30, task: 'Braced & tied off east wall' } ]
        ] },
        { name: 'Curtis Bell', plans: [
            [ { code: '006-4', start: '07:00', finish: '10:00', breakMins: 0,  task: 'Cut & fixed floor joists & blocking' },
              { code: '006-4', start: '10:00', finish: '16:00', breakMins: 30, task: 'Sheeted subfloor with 19mm yellow tongue' } ],
            [ { code: '006-1', start: '07:00', finish: '12:00', breakMins: 0,  task: 'Fixed lintels & trimmers over openings' },
              { code: '008-2', start: '12:00', finish: '16:00', breakMins: 30, task: 'Fitted fascia & gutter brackets' } ]
        ] },
        { name: 'James Begg', plans: [
            [ { code: '001-9', start: '06:30', finish: '08:30', breakMins: 0,  task: 'Site set-up, unloaded timber delivery' },
              { code: '001-2', start: '08:30', finish: '15:00', breakMins: 30, task: 'Assisted bearer set-out, cut packers' } ],
            [ { code: '006-1', start: '06:30', finish: '15:00', breakMins: 30, task: 'Fixed ceiling battens to garage' } ]
        ] }
    ],
    'yowie-bay': [
        { name: 'Shaun Terry', plans: [
            [ { code: '006-4', start: '07:00', finish: '15:30', breakMins: 30, task: 'Dug & poured deck pier footings' } ],
            [ { code: '006-4', start: '07:00', finish: '11:00', breakMins: 0,  task: 'Set deck bearers to string lines' },
              { code: '006-4', start: '11:00', finish: '15:30', breakMins: 30, task: 'Laid spotted gum decking, first 20 boards' } ]
        ] },
        { name: 'Labour Hire 1', plans: [
            [ { code: '001-9', start: '07:00', finish: '15:00', breakMins: 30, task: 'Site clean & skip loading' } ]
        ] }
    ],
    'castlecrag': [
        { name: 'Trent Jamieson', plans: [
            [ { code: '009-3', start: '07:00', finish: '15:30', breakMins: 30, task: 'Framed internal partitions, level 1' } ],
            [ { code: '004-1', start: '07:00', finish: '10:00', breakMins: 0,  task: 'Stripped slab edge formwork' },
              { code: '009-3', start: '10:00', finish: '15:30', breakMins: 30, task: 'Set out door openings & fixed jamb studs' } ]
        ] },
        { name: 'Lachlan Swatosch', plans: [
            [ { code: '001-9', start: '06:30', finish: '10:30', breakMins: 0,  task: 'Cleaned & stacked formply for reuse' },
              { code: '009-3', start: '10:30', finish: '15:00', breakMins: 30, task: 'Fixed noggings & blocking for cabinetry' } ]
        ] }
    ]
};
