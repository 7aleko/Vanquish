/**
 * Schedule whiteboard: trade colour themes, 5-week runway and seed trade tasks.
 * whiteboardTradeTasks is mutable application state (tasks are added / deleted at runtime).
 * Pure data - no logic. Loaded before all feature scripts.
 */

// Visual Theme Tokens for Trade Bars (Apple High-Contrast Squircles)
const WHITEBOARD_TRADE_THEMES = {
    formwork: {
        name: 'Formwork & Stripping',
        icon: 'fa-cubes-stacked',
        badgeClass: 'bg-amber-500 text-slate-950 font-black',
        barBg: 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950',
        cardBorder: 'border-l-4 border-amber-500',
        bgLight: 'bg-amber-50/80',
        textColor: 'text-amber-700'
    },
    plumbing: {
        name: 'Plumbing Rough-In',
        icon: 'fa-faucet-drip',
        badgeClass: 'bg-blue-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
        cardBorder: 'border-l-4 border-blue-500',
        bgLight: 'bg-blue-50/80',
        textColor: 'text-blue-700'
    },
    electrical: {
        name: 'Electricians Rough-In',
        icon: 'fa-bolt-lightning',
        badgeClass: 'bg-purple-600 text-white font-black',
        barBg: 'bg-gradient-to-r from-purple-600 to-violet-500 text-white',
        cardBorder: 'border-l-4 border-purple-600',
        bgLight: 'bg-purple-50/80',
        textColor: 'text-purple-700'
    },
    steel: {
        name: 'Steel Mesh & Concrete Pour',
        icon: 'fa-weight-hanging',
        badgeClass: 'bg-emerald-500 text-slate-950 font-black',
        barBg: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950',
        cardBorder: 'border-l-4 border-emerald-500',
        bgLight: 'bg-emerald-50/80',
        textColor: 'text-emerald-700'
    },
    carpentry: {
        name: 'Carpentry & Framing',
        icon: 'fa-hammer',
        badgeClass: 'bg-orange-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white',
        cardBorder: 'border-l-4 border-orange-500',
        bgLight: 'bg-orange-50/80',
        textColor: 'text-orange-700'
    },
    masonry: {
        name: 'Masonry & Bricklaying',
        icon: 'fa-trowel-bricks',
        badgeClass: 'bg-rose-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-rose-500 to-red-600 text-white',
        cardBorder: 'border-l-4 border-rose-500',
        bgLight: 'bg-rose-50/80',
        textColor: 'text-rose-700'
    },
    scaffold: {
        name: 'Scaffolding & Rigging',
        icon: 'fa-network-wired',
        badgeClass: 'bg-cyan-500 text-slate-950 font-black',
        barBg: 'bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950',
        cardBorder: 'border-l-4 border-cyan-500',
        bgLight: 'bg-cyan-50/80',
        textColor: 'text-cyan-700'
    },
    windows: {
        name: 'Glazing & Windows',
        icon: 'fa-border-all',
        badgeClass: 'bg-sky-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white',
        cardBorder: 'border-l-4 border-sky-500',
        bgLight: 'bg-sky-50/80',
        textColor: 'text-sky-700'
    },
    finishes: {
        name: 'Linings & Drywall',
        icon: 'fa-layer-group',
        badgeClass: 'bg-indigo-600 text-white font-black',
        barBg: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
        cardBorder: 'border-l-4 border-indigo-600',
        bgLight: 'bg-indigo-50/80',
        textColor: 'text-indigo-700'
    }
};

// 5 Multi-Week Runway Definition (35 consecutive calendar days)
const WHITEBOARD_WEEKS_LIST = [
    {
        index: 0,
        weekNum: 1,
        title: 'Week 1 (Sep 28 – Oct 4)',
        shortTitle: 'W1',
        subtitle: 'Foundation & Earthworks',
        startDate: '2026-09-28',
        endDate: '2026-10-04',
        isCurrentWeek: false,
        days: [
            { dateStr: '2026-09-28', dayName: 'Mon', dayLetter: 'M', dayNum: 28, isToday: false },
            { dateStr: '2026-09-29', dayName: 'Tue', dayLetter: 'T', dayNum: 29, isToday: false },
            { dateStr: '2026-09-30', dayName: 'Wed', dayLetter: 'W', dayNum: 30, isToday: false },
            { dateStr: '2026-10-01', dayName: 'Thu', dayLetter: 'T', dayNum: 1, isToday: false },
            { dateStr: '2026-10-02', dayName: 'Fri', dayLetter: 'F', dayNum: 2, isToday: false },
            { dateStr: '2026-10-03', dayName: 'Sat', dayLetter: 'S', dayNum: 3, isToday: false, isWeekend: true },
            { dateStr: '2026-10-04', dayName: 'Sun', dayLetter: 'S', dayNum: 4, isToday: false, isWeekend: true }
        ]
    },
    {
        index: 1,
        weekNum: 2,
        title: 'This Week (Oct 5 – 11)',
        shortTitle: 'This Week',
        subtitle: 'Week 2 • Active On Site',
        startDate: '2026-10-05',
        endDate: '2026-10-11',
        isCurrentWeek: true,
        days: [
            { dateStr: '2026-10-05', dayName: 'Mon', dayLetter: 'M', dayNum: 5, isToday: false },
            { dateStr: '2026-10-06', dayName: 'Tue', dayLetter: 'T', dayNum: 6, isToday: true }, // Today (Tuesday 6 Oct)
            { dateStr: '2026-10-07', dayName: 'Wed', dayLetter: 'W', dayNum: 7, isToday: false },
            { dateStr: '2026-10-08', dayName: 'Thu', dayLetter: 'T', dayNum: 8, isToday: false },
            { dateStr: '2026-10-09', dayName: 'Fri', dayLetter: 'F', dayNum: 9, isToday: false },
            { dateStr: '2026-10-10', dayName: 'Sat', dayLetter: 'S', dayNum: 10, isToday: false, isWeekend: true },
            { dateStr: '2026-10-11', dayName: 'Sun', dayLetter: 'S', dayNum: 11, isToday: false, isWeekend: true }
        ]
    },
    {
        index: 2,
        weekNum: 3,
        title: 'Next Week (Oct 12 – 18)',
        shortTitle: 'Next Week',
        subtitle: 'Week 3 • Superstructure & Trusses',
        startDate: '2026-10-12',
        endDate: '2026-10-18',
        isCurrentWeek: false,
        days: [
            { dateStr: '2026-10-12', dayName: 'Mon', dayLetter: 'M', dayNum: 12, isToday: false },
            { dateStr: '2026-10-13', dayName: 'Tue', dayLetter: 'T', dayNum: 13, isToday: false },
            { dateStr: '2026-10-14', dayName: 'Wed', dayLetter: 'W', dayNum: 14, isToday: false },
            { dateStr: '2026-10-15', dayName: 'Thu', dayLetter: 'T', dayNum: 15, isToday: false },
            { dateStr: '2026-10-16', dayName: 'Fri', dayLetter: 'F', dayNum: 16, isToday: false },
            { dateStr: '2026-10-17', dayName: 'Sat', dayLetter: 'S', dayNum: 17, isToday: false, isWeekend: true },
            { dateStr: '2026-10-18', dayName: 'Sun', dayLetter: 'S', dayNum: 18, isToday: false, isWeekend: true }
        ]
    },
    {
        index: 3,
        weekNum: 4,
        title: 'Week 4 (Oct 19 – 25)',
        shortTitle: 'W4 (Oct 19)',
        subtitle: 'Week 4 • Scaffolding & Glazing',
        startDate: '2026-10-19',
        endDate: '2026-10-25',
        isCurrentWeek: false,
        days: [
            { dateStr: '2026-10-19', dayName: 'Mon', dayLetter: 'M', dayNum: 19, isToday: false },
            { dateStr: '2026-10-20', dayName: 'Tue', dayLetter: 'T', dayNum: 20, isToday: false },
            { dateStr: '2026-10-21', dayName: 'Wed', dayLetter: 'W', dayNum: 21, isToday: false },
            { dateStr: '2026-10-22', dayName: 'Thu', dayLetter: 'T', dayNum: 22, isToday: false },
            { dateStr: '2026-10-23', dayName: 'Fri', dayLetter: 'F', dayNum: 23, isToday: false },
            { dateStr: '2026-10-24', dayName: 'Sat', dayLetter: 'S', dayNum: 24, isToday: false, isWeekend: true },
            { dateStr: '2026-10-25', dayName: 'Sun', dayLetter: 'S', dayNum: 25, isToday: false, isWeekend: true }
        ]
    },
    {
        index: 4,
        weekNum: 5,
        title: 'Week 5 (Oct 26 – Nov 1)',
        shortTitle: 'W5 (Oct 26)',
        subtitle: 'Week 5 • Insulation & Linings',
        startDate: '2026-10-26',
        endDate: '2026-11-01',
        isCurrentWeek: false,
        days: [
            { dateStr: '2026-10-26', dayName: 'Mon', dayLetter: 'M', dayNum: 26, isToday: false },
            { dateStr: '2026-10-27', dayName: 'Tue', dayLetter: 'T', dayNum: 27, isToday: false },
            { dateStr: '2026-10-28', dayName: 'Wed', dayLetter: 'W', dayNum: 28, isToday: false },
            { dateStr: '2026-10-29', dayName: 'Thu', dayLetter: 'T', dayNum: 29, isToday: false },
            { dateStr: '2026-10-30', dayName: 'Fri', dayLetter: 'F', dayNum: 30, isToday: false },
            { dateStr: '2026-10-31', dayName: 'Sat', dayLetter: 'S', dayNum: 31, isToday: false, isWeekend: true },
            { dateStr: '2026-11-01', dayName: 'Sun', dayLetter: 'S', dayNum: 1, isToday: false, isWeekend: true }
        ]
    }
];

// Multi-Day Continuous Trade Schedule Data (Simultaneous & Spanning Overlaps)
let whiteboardTradeTasks = [
    // --- THIS WEEK (WEEK 2: OCT 5 – OCT 11) ---
    {
        id: 'trade-formwork',
        title: 'Formwork Stripping & Soffits',
        trade: 'formwork',
        crew: 'Apex Formwork (5 Subbies)',
        startDate: '2026-10-06',
        endDate: '2026-10-09',
        notes: 'Strip formwork deck shores, back-prop Level 2 slabs, crane soffits to laydown.'
    },
    {
        id: 'trade-plumbing',
        title: 'Plumbing Rough-In & Drainage',
        trade: 'plumbing',
        crew: 'FlowLine Plumbing (3 Subbies)',
        startDate: '2026-10-05',
        endDate: '2026-10-07',
        notes: 'Sewer stacks, branch penetrations, hot/cold PEX run to wet areas before slab pour.'
    },
    {
        id: 'trade-electrical',
        title: 'Electricians Rough-In & Conduits',
        trade: 'electrical',
        crew: 'VoltEdge Electrical (4 Subbies)',
        startDate: '2026-10-07',
        endDate: '2026-10-09',
        notes: 'Sub-board feeder conduit, cable tray runs, cast-in ceiling lighting drops.'
    },
    {
        id: 'trade-steel',
        title: 'SL82 Steel Mesh Laying',
        trade: 'steel',
        crew: 'Boral Steel Fixers (2 Subbies)',
        startDate: '2026-10-07',
        endDate: '2026-10-08',
        notes: 'Place bar chairs, SL82 reinforcement top & bottom mesh, tie starter bars.'
    },
    {
        id: 'trade-concrete',
        title: 'Concrete Slab Pour Level 2',
        trade: 'steel',
        crew: 'Apex Concreting & Pump (8 Subbies)',
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        notes: '120m3 32MPa concrete boom pump pour. Helo trowel finish, curing compound applied.'
    },

    // --- WEEK 1: FOUNDATION (SEP 28 – OCT 4) ---
    {
        id: 'trade-w1-excavation',
        title: 'Bulk Earthworks & Footings',
        trade: 'steel',
        crew: 'Dino Earthmoving (3 Operators)',
        startDate: '2026-09-28',
        endDate: '2026-09-30',
        notes: 'Excavate pad footings, laser grade trench lines, stockpile engineered fill.'
    },
    {
        id: 'trade-w1-piers',
        title: 'Bored Piers & Steel Cages',
        trade: 'steel',
        crew: 'Sydney Foundation Group (4 Subbies)',
        startDate: '2026-09-30',
        endDate: '2026-10-02',
        notes: 'Drill 600mm bored piers down to sandstone bearing stratum, insert cages & pour.'
    },
    {
        id: 'trade-w1-geotech',
        title: 'Geotechnical Soil Sign-Off',
        trade: 'scaffold',
        crew: 'Douglas Partners Geotechnical',
        startDate: '2026-10-02',
        endDate: '2026-10-02',
        notes: 'Certified engineer penetrometer verification and foundation sign-off.'
    },

    // --- NEXT WEEK (WEEK 3: OCT 12 – OCT 18) ---
    {
        id: 'trade-w3-brickwork',
        title: 'Ground Floor Perimeter Brickwork',
        trade: 'masonry',
        crew: 'Precision Bricklaying (6 Subbies)',
        startDate: '2026-10-12',
        endDate: '2026-10-16',
        notes: 'Face bricks to perimeter, damp proof coursing, cavity flashing install.'
    },
    {
        id: 'trade-w3-trusses',
        title: 'Roof Truss Crane Framing',
        trade: 'carpentry',
        crew: 'Timberline Framing (5 Subbies)',
        startDate: '2026-10-14',
        endDate: '2026-10-17',
        notes: 'Mobile crane setup, hoist pre-fab roof trusses, nail plates and tie-downs.'
    },

    // --- WEEK 4: OCT 19 – OCT 25 ---
    {
        id: 'trade-w4-scaffold',
        title: 'Heavy Duty Perimeter Scaffolding',
        trade: 'scaffold',
        crew: 'Apex Rigging & Scaffold (4 Subbies)',
        startDate: '2026-10-19',
        endDate: '2026-10-21',
        notes: 'Erect 2-stage perimeter aluminium scaffold with safety handrails & mesh.'
    },
    {
        id: 'trade-w4-glazing',
        title: 'Architectural Window Suites & Glazing',
        trade: 'windows',
        crew: 'Architectural Glass Sydney (3 Subbies)',
        startDate: '2026-10-21',
        endDate: '2026-10-24',
        notes: 'Low-E double glazed window suites, install flashings and silicone perimeter seals.'
    },

    // --- WEEK 5: OCT 26 – NOV 1 ---
    {
        id: 'trade-w5-insulation',
        title: 'Thermal & Acoustic Wall Batts',
        trade: 'finishes',
        crew: 'Insul-Tech Sydney (3 Subbies)',
        startDate: '2026-10-26',
        endDate: '2026-10-28',
        notes: 'Install R2.5 acoustic batts to external studs and acoustic baffles.'
    },
    {
        id: 'trade-w5-drywall',
        title: 'Plasterboard Drywall Sheeting',
        trade: 'finishes',
        crew: 'Drywall Masters (5 Subbies)',
        startDate: '2026-10-28',
        endDate: '2026-10-31',
        notes: '13mm Gyprock plasterboard ceiling and wall linings, glue and screw fix.'
    }
];
