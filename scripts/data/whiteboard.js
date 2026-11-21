/**
 * Site schedule: the trades (each with its colour and icon) and the schedule's bookings - the mock database's
 * scheduleTrades and scheduleTasks contents. Pure data - no logic. Loaded before the mock seed
 * (scripts/data-access/mock/seed.js), the only code that reads it; the Schedule screen goes through the
 * schedule repository, scheduleService and the selectors. Each booking belongs to a site (siteId, from SITES).
 *
 * A booking: trade (a WHITEBOARD_TRADE_THEMES key), title, crew (the company or crew), from - to, `arrival` (the
 * arrival window, '7:00 AM – 3:30 PM'), `where` on site and `notes` (the scope of work).
 * A milestone (`milestone: true`) is a stage gate on its due day with the checklist completed before it:
 * [text] still to do, or [text, who ticked it, 'YYYY-MM-DD'] done. Progress is always counted from the items.
 * Dates sit around the sites' demo day (Mon 23 Nov 2026).
 */

// Visual Theme Tokens for Trade Bars (Apple High-Contrast Squircles)
const WHITEBOARD_TRADE_THEMES = {
    formwork: {
        color: '#F59E0B',
        name: 'Formwork',
        icon: 'fa-cubes-stacked',
        badgeClass: 'bg-amber-500 text-slate-950 font-black',
        barBg: 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950',
        cardBorder: 'border-l-4 border-amber-500',
        bgLight: 'bg-amber-50/80',
        textColor: 'text-amber-700'
    },
    plumbing: {
        color: '#3B82F6',
        name: 'Plumbing',
        icon: 'fa-faucet-drip',
        badgeClass: 'bg-blue-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
        cardBorder: 'border-l-4 border-blue-500',
        bgLight: 'bg-blue-50/80',
        textColor: 'text-blue-700'
    },
    electrical: {
        color: '#A855F7',
        name: 'Electrical',
        icon: 'fa-bolt-lightning',
        badgeClass: 'bg-purple-600 text-white font-black',
        barBg: 'bg-gradient-to-r from-purple-600 to-violet-500 text-white',
        cardBorder: 'border-l-4 border-purple-600',
        bgLight: 'bg-purple-50/80',
        textColor: 'text-purple-700'
    },
    steel: {
        color: '#10B981',
        name: 'Concrete & Steel',
        icon: 'fa-weight-hanging',
        badgeClass: 'bg-emerald-500 text-slate-950 font-black',
        barBg: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950',
        cardBorder: 'border-l-4 border-emerald-500',
        bgLight: 'bg-emerald-50/80',
        textColor: 'text-emerald-700'
    },
    carpentry: {
        color: '#F97316',
        name: 'Carpentry',
        icon: 'fa-hammer',
        badgeClass: 'bg-orange-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white',
        cardBorder: 'border-l-4 border-orange-500',
        bgLight: 'bg-orange-50/80',
        textColor: 'text-orange-700'
    },
    masonry: {
        color: '#F43F5E',
        name: 'Masonry & Tiling',
        icon: 'fa-trowel-bricks',
        badgeClass: 'bg-rose-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-rose-500 to-red-600 text-white',
        cardBorder: 'border-l-4 border-rose-500',
        bgLight: 'bg-rose-50/80',
        textColor: 'text-rose-700'
    },
    scaffold: {
        color: '#06B6D4',
        name: 'Scaffolding',
        icon: 'fa-network-wired',
        badgeClass: 'bg-cyan-500 text-slate-950 font-black',
        barBg: 'bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950',
        cardBorder: 'border-l-4 border-cyan-500',
        bgLight: 'bg-cyan-50/80',
        textColor: 'text-cyan-700'
    },
    windows: {
        color: '#0EA5E9',
        name: 'Windows & Glazing',
        icon: 'fa-border-all',
        badgeClass: 'bg-sky-500 text-white font-black',
        barBg: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white',
        cardBorder: 'border-l-4 border-sky-500',
        bgLight: 'bg-sky-50/80',
        textColor: 'text-sky-700'
    },
    roofing: {
        color: '#94A3B8',
        name: 'Roofing',
        icon: 'fa-house'
    },
    delivery: {
        color: '#EAB308',
        name: 'Deliveries',
        icon: 'fa-truck-ramp-box'
    },
    inspection: {
        color: '#E879F9',
        name: 'Inspections',
        icon: 'fa-clipboard-check'
    },
    finishes: {
        color: '#6366F1',
        name: 'Linings & Insulation',
        icon: 'fa-layer-group',
        badgeClass: 'bg-indigo-600 text-white font-black',
        barBg: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white',
        cardBorder: 'border-l-4 border-indigo-600',
        bgLight: 'bg-indigo-50/80',
        textColor: 'text-indigo-700'
    }
};

// Bookings and milestones, per site
const WHITEBOARD_SHIFT = '7:00 AM – 3:30 PM';      // a full day on site
const whiteboardTradeTasks = [
    // ================= Lugarno (935 Forest Road) - Frame & Roof, heading for Lock-Up =================
    { id: 'ms-lug-slab', siteId: 'lugarno', milestone: true, trade: 'steel', title: 'Subfloor & Slab', startDate: '2026-09-25', endDate: '2026-09-25',
      notes: 'Ground floor slab and subfloor complete, ready for framing.',
      checklist: [
          ['Set-out checked by surveyor', 'David Hilt', '2026-09-01'],
          ['Footings excavated and inspected', 'David Hilt', '2026-09-04'],
          ['Termite barrier installed', 'James Begg', '2026-09-09'],
          ['Under-slab plumbing pressure tested', 'David Hilt', '2026-09-11'],
          ['Reo inspection passed', 'David Hilt', '2026-09-16'],
          ['Slab poured and finished', 'James Begg', '2026-09-18'],
          ['Slab cured, set-downs checked', 'David Hilt', '2026-09-23'],
          ['Subfloor bearers and joists to rear deck', 'James Begg', '2026-09-25']
      ] },
    { id: 'ms-lug-frame', siteId: 'lugarno', milestone: true, trade: 'carpentry', title: 'Wall & Roof Framing', startDate: '2026-11-20', endDate: '2026-11-20',
      notes: 'Wall frames, upper floor and roof trusses complete and certified.',
      checklist: [
          ['Ground floor wall frames stood and plumbed', 'David Hilt', '2026-10-09'],
          ['Upper floor joists and flooring laid', 'James Begg', '2026-10-21'],
          ['Upper floor wall frames stood', 'David Hilt', '2026-10-30'],
          ['Roof trusses craned in and fixed', 'David Hilt', '2026-11-05'],
          ['Tie-downs and bracing to engineer’s details', 'James Begg', '2026-11-10'],
          ['Wet area noggins and blocking', 'James Begg', '2026-11-12'],
          ['Engineer’s frame certificate received', 'David Hilt', '2026-11-16'],
          ['Truss layout and certificate received', 'David Hilt', '2026-11-16'],
          ['Window openings checked against schedule', 'James Begg', '2026-11-18'],
          ['Frame inspection passed', 'David Hilt', '2026-11-20']
      ] },
    { id: 'ms-lug-lockup', siteId: 'lugarno', milestone: true, trade: 'inspection', title: 'Lock-Up Stage', startDate: '2026-11-27', endDate: '2026-11-27',
      notes: 'The house is closed in: roof, windows, external doors and cladding, ready for the lock-up claim.',
      checklist: [
          ['Roof sarking and battens', 'David Hilt', '2026-11-13'],
          ['External windows and sliding doors'],
          ['Plumbing rough-in and pressure test (ground floor)', 'David Hilt', '2026-11-18'],
          ['Electrical rough-in'],
          ['Eaves and fascia lining', 'James Begg', '2026-11-17'],
          ['External cladding', 'James Begg', '2026-11-19'],
          ['Roof plumbing and flashings'],
          ['External door installation', 'James Begg', '2026-11-19'],
          ['Garage door installation', 'David Hilt', '2026-11-20'],
          ['Building envelope inspection']
      ] },
    { id: 'ms-lug-presheet', siteId: 'lugarno', milestone: true, trade: 'finishes', title: 'Pre-Sheet & Insulation', startDate: '2026-12-11', endDate: '2026-12-11',
      notes: 'Everything in the walls and ceilings before the plasterboard goes on.',
      checklist: [
          ['Electrical rough-in complete, both floors'],
          ['Plumbing and gas rough-in complete, upper floor'],
          ['Wall batts installed (R2.5)'],
          ['Ceiling batts installed (R4.0)'],
          ['Noggins for fixtures, TV mounts and grab rails'],
          ['Penetrations sealed, wall wrap taped'],
          ['Pre-sheet inspection passed']
      ] },

    { id: 'lug-cladding', siteId: 'lugarno', trade: 'carpentry', title: 'External Cladding', crew: 'Lifestyle Carpentry', startDate: '2026-11-16', endDate: '2026-11-19', arrival: WHITEBOARD_SHIFT,
      where: 'North & east elevations', notes: 'Fix weatherboard cladding over the wall wrap; corner stops and window trims.' },
    { id: 'lug-plumb-gf', siteId: 'lugarno', trade: 'plumbing', title: 'Plumbing Rough-In (Ground)', crew: 'FlowLine Plumbing', startDate: '2026-11-17', endDate: '2026-11-18', arrival: WHITEBOARD_SHIFT,
      where: 'Ground floor', notes: 'Ground floor water and waste rough-in. Pressure test witnessed by David.' },
    { id: 'lug-frame-insp', siteId: 'lugarno', trade: 'inspection', title: 'Frame Inspection', crew: 'Sydney Building Certifiers', startDate: '2026-11-20', endDate: '2026-11-20', arrival: '9:00 – 10:00 AM',
      notes: 'Certifier frame inspection, ground and upper floors. Passed.' },

    { id: 'lug-elec', siteId: 'lugarno', trade: 'electrical', title: 'Sparky Rough-In', crew: 'VoltEdge Electrical', startDate: '2026-11-23', endDate: '2026-11-25', arrival: WHITEBOARD_SHIFT,
      where: 'Ground floor', notes: 'Electrical first-fix rough-in throughout the ground floor: cabling, switch and power positions, switchboard tails.' },
    { id: 'lug-plumb', siteId: 'lugarno', trade: 'plumbing', title: 'Plumbing Rough-In', crew: 'FlowLine Plumbing', startDate: '2026-11-24', endDate: '2026-11-25', arrival: WHITEBOARD_SHIFT,
      where: 'Upper floor', notes: 'Water and drainage rough-in to the upper floor bathrooms; stacks through to the roof.' },
    { id: 'lug-roof', siteId: 'lugarno', trade: 'roofing', title: 'Roofing Metal', crew: 'Coastline Roofing', startDate: '2026-11-24', endDate: '2026-11-26', arrival: '6:30 AM – 3:00 PM',
      where: 'Roof', notes: 'Colorbond Monument sheeting, ridge capping, valley and wall flashings, box gutters.' },
    { id: 'lug-win-del', siteId: 'lugarno', trade: 'delivery', title: 'Window Delivery', crew: 'Bradnam’s Windows & Doors', startDate: '2026-11-25', endDate: '2026-11-25', arrival: '8:00 – 9:00 AM',
      where: 'Front driveway', notes: 'Delivery and unloading of external windows and sliding doors. Crane truck on the driveway; keep it clear.' },
    { id: 'lug-win', siteId: 'lugarno', trade: 'windows', title: 'Window Installation', crew: 'Bradnam’s Windows & Doors', startDate: '2026-11-26', endDate: '2026-11-27', arrival: WHITEBOARD_SHIFT,
      where: 'All elevations', notes: 'Install external windows and sliding doors with sill trays, head flashings and packers.' },
    { id: 'lug-envelope', siteId: 'lugarno', trade: 'inspection', title: 'Building Envelope Inspection', crew: 'Sydney Building Certifiers', startDate: '2026-11-27', endDate: '2026-11-27', arrival: '10:00 – 11:00 AM',
      notes: 'Lock-up inspection of the building envelope: roof, windows, external doors and cladding.' },
    { id: 'lug-scaffold', siteId: 'lugarno', trade: 'scaffold', title: 'Scaffold Adjustment', crew: 'Apex Rigging & Scaffold', startDate: '2026-11-30', endDate: '2026-11-30', arrival: '7:00 – 9:00 AM',
      where: 'Rear elevation', notes: 'Drop the working platform for gutter and downpipe install.' },
    { id: 'lug-carp', siteId: 'lugarno', trade: 'carpentry', title: 'Carpentry: Pre-Sheet Prep', crew: 'Lifestyle Carpentry', startDate: '2026-11-30', endDate: '2026-12-02', arrival: WHITEBOARD_SHIFT,
      where: 'Both floors', notes: 'Noggins for fixtures, TV mounts and grab rails; stair void trimmers; ceiling battens to the garage.' },
    { id: 'lug-frame-insp-2', siteId: 'lugarno', trade: 'inspection', title: 'Frame Inspection (Roof)', crew: 'Sydney Building Certifiers', startDate: '2026-12-01', endDate: '2026-12-01', arrival: '9:00 – 10:00 AM',
      where: 'Roof space', notes: 'Re-inspection of truss tie-downs and bracing now the roof is sheeted.' },
    { id: 'lug-batts-del', siteId: 'lugarno', trade: 'delivery', title: 'Insulation Delivery', crew: 'Bradford Insulation', startDate: '2026-12-01', endDate: '2026-12-01', arrival: '7:30 – 8:30 AM',
      where: 'Garage', notes: 'R2.5 wall and R4.0 ceiling batts. Stack in the garage off the slab.' },
    { id: 'lug-elec-2', siteId: 'lugarno', trade: 'electrical', title: 'Sparky Rough-In (Upper)', crew: 'VoltEdge Electrical', startDate: '2026-12-02', endDate: '2026-12-03', arrival: WHITEBOARD_SHIFT,
      where: 'Upper floor', notes: 'Upper floor first-fix: cabling, downlight positions, data and alarm.' },
    { id: 'lug-insul', siteId: 'lugarno', trade: 'finishes', title: 'Wall & Ceiling Insulation', crew: 'Insul-Tech Sydney', startDate: '2026-12-02', endDate: '2026-12-04', arrival: WHITEBOARD_SHIFT,
      where: 'Both floors', notes: 'Wall batts once the rough-ins are signed off; ceiling batts from the roof space.' },
    { id: 'lug-skip', siteId: 'lugarno', trade: 'delivery', title: 'Skip Bin Swap', crew: 'Kennards Waste', startDate: '2026-12-03', endDate: '2026-12-03', arrival: '6:30 – 7:30 AM',
      where: 'Front verge', notes: 'Swap the 9 m³ skip. Timber offcuts separated for recycling.' },
    { id: 'lug-gas', siteId: 'lugarno', trade: 'plumbing', title: 'Gas & Hot Water Rough-In', crew: 'FlowLine Plumbing', startDate: '2026-12-04', endDate: '2026-12-04', arrival: WHITEBOARD_SHIFT,
      where: 'Kitchen & laundry', notes: 'Gas to the cooktop and instantaneous hot water unit; hot water rough-in to the laundry.' },

    // ================= Castlecrag (8c The Bulwark) - Internal Fit-Off =================
    { id: 'ms-cc-linings', siteId: 'castlecrag', milestone: true, trade: 'finishes', title: 'Linings & Set', startDate: '2026-11-06', endDate: '2026-11-06',
      checklist: [
          ['Plasterboard to walls and ceilings', 'Brendan Hodge', '2026-10-23'],
          ['Wet area sheeting', 'Brendan Hodge', '2026-10-23'],
          ['Cornices fixed', 'Jude Hudson', '2026-10-28'],
          ['Joints set and sanded', 'Brendan Hodge', '2026-11-03'],
          ['Waterproofing certificate received', 'Brendan Hodge', '2026-11-04'],
          ['Internal door frames installed', 'Jude Hudson', '2026-11-05']
      ] },
    { id: 'ms-cc-joinery', siteId: 'castlecrag', milestone: true, trade: 'carpentry', title: 'Joinery & Cabinetry', startDate: '2026-12-04', endDate: '2026-12-04',
      notes: 'Kitchen, laundry and bathroom joinery in, ready for stone and fit-off.',
      checklist: [
          ['Final measure signed off', 'Brendan Hodge', '2026-11-09'],
          ['Kitchen carcasses installed', 'Jude Hudson', '2026-11-17'],
          ['Laundry cabinetry installed', 'Jude Hudson', '2026-11-18'],
          ['Vanities installed', 'Jude Hudson', '2026-11-20'],
          ['Stone benchtops templated'],
          ['Stone benchtops installed'],
          ['Doors, drawers and handles fitted']
      ] },
    { id: 'ms-cc-pc', siteId: 'castlecrag', milestone: true, trade: 'inspection', title: 'Practical Completion', startDate: '2026-12-18', endDate: '2026-12-18',
      checklist: [['Defects list completed'], ['Certificates collected (electrical, plumbing, waterproofing, glazing)'], ['Final clean done'], ['Keys, manuals and warranties packed'], ['Final inspection / OC issued'], ['Client walkthrough booked']] },
    { id: 'cc-paint', siteId: 'castlecrag', trade: 'finishes', title: 'Painting: Ceilings & Walls', crew: 'Harbour Painting Co.', startDate: '2026-11-23', endDate: '2026-11-26', arrival: WHITEBOARD_SHIFT,
      where: 'Upstairs', notes: 'Two coats to ceilings and walls; doors and frames undercoated.' },
    { id: 'cc-stone', siteId: 'castlecrag', trade: 'carpentry', title: 'Stone Benchtop Template', crew: 'Caesarstone Sydney', startDate: '2026-11-24', endDate: '2026-11-24', arrival: '10:00 – 11:00 AM',
      where: 'Kitchen', notes: 'Laser template for the kitchen island and back bench. Carcasses must be level and fixed.' },
    { id: 'cc-tiling', siteId: 'castlecrag', trade: 'masonry', title: 'Bathroom Tiling', crew: 'Precision Tiling', startDate: '2026-11-25', endDate: '2026-11-27', arrival: WHITEBOARD_SHIFT,
      where: 'Ensuite', notes: 'Floor and wall tiles to the ensuite; niche and shower hob.' },
    { id: 'cc-appliances', siteId: 'castlecrag', trade: 'delivery', title: 'Appliance Delivery', crew: 'Winning Appliances', startDate: '2026-11-30', endDate: '2026-11-30', arrival: '7:00 – 9:00 AM',
      where: 'Garage', notes: 'Oven, cooktop, rangehood and dishwasher. Store boxed in the garage.' },
    { id: 'cc-elec', siteId: 'castlecrag', trade: 'electrical', title: 'Electrical Fit-Off', crew: 'VoltEdge Electrical', startDate: '2026-12-01', endDate: '2026-12-02', arrival: WHITEBOARD_SHIFT,
      notes: 'Power points, switches, downlights and pendant fit-off.' },
    { id: 'cc-plumb', siteId: 'castlecrag', trade: 'plumbing', title: 'Plumbing Fit-Off', crew: 'FlowLine Plumbing', startDate: '2026-12-03', endDate: '2026-12-04', arrival: WHITEBOARD_SHIFT,
      notes: 'Tapware, toilets and vanity wastes. Dishwasher connection.' },

    // ================= Bondi (350 Bondi Road) - Excavation & Footings =================
    { id: 'ms-bon-dig', siteId: 'bondi', milestone: true, trade: 'steel', title: 'Excavation & Shoring', startDate: '2026-11-13', endDate: '2026-11-13',
      checklist: [
          ['Dilapidation reports for neighbours', 'Curtis Bell', '2026-10-20'],
          ['Bulk excavation to level', 'Curtis Bell', '2026-11-04'],
          ['Rock breaking along the boundary', 'Jeremy Gillon', '2026-11-09'],
          ['Shoring piles installed', 'Curtis Bell', '2026-11-12'],
          ['Geotech inspection of the founding level', 'Curtis Bell', '2026-11-13']
      ] },
    { id: 'ms-bon-pour', siteId: 'bondi', milestone: true, trade: 'formwork', title: 'Formwork & Pour', startDate: '2026-12-02', endDate: '2026-12-02',
      notes: 'Footings and ground floor slab formed and poured.',
      checklist: [
          ['Footing set-out by surveyor', 'Curtis Bell', '2026-11-17'],
          ['Pad footings excavated', 'Jeremy Gillon', '2026-11-20'],
          ['Formwork complete and certified'],
          ['Reo inspection passed'],
          ['Concrete pump and pour booked'],
          ['Weather checked, no rain forecast']
      ] },
    { id: 'ms-bon-slab', siteId: 'bondi', milestone: true, trade: 'steel', title: 'Ground Floor Slab', startDate: '2026-12-16', endDate: '2026-12-16',
      checklist: [['Under-slab plumbing pressure tested'], ['Termite barrier installed'], ['Vapour barrier and edge forms'], ['Reo inspection passed'], ['Pre-pour inspection passed'], ['Slab poured and finished']] },
    { id: 'bon-form', siteId: 'bondi', trade: 'formwork', title: 'Footing Formwork', crew: 'Apex Formwork', startDate: '2026-11-23', endDate: '2026-11-26', arrival: WHITEBOARD_SHIFT,
      where: 'Grid A–D', notes: 'Form the strip footings and pad footings to S201.' },
    { id: 'bon-steel', siteId: 'bondi', trade: 'steel', title: 'Steel Fixing', crew: 'Boral Steel Fixers', startDate: '2026-11-26', endDate: '2026-11-30', arrival: WHITEBOARD_SHIFT,
      where: 'Footings', notes: 'Footing cages, starter bars and bar chairs.' },
    { id: 'bon-reo-del', siteId: 'bondi', trade: 'delivery', title: 'Reo Delivery', crew: 'OneSteel Reinforcing', startDate: '2026-11-25', endDate: '2026-11-25', arrival: '7:00 – 8:00 AM',
      where: 'Bondi Road gate', notes: 'Footing cages and N12 bar. Traffic controller needed at the gate.' },
    { id: 'bon-reo-insp', siteId: 'bondi', trade: 'inspection', title: 'Reo Inspection', crew: 'Taylor Thomson Engineers', startDate: '2026-12-01', endDate: '2026-12-01', arrival: '8:00 – 9:00 AM',
      where: 'Footings', notes: 'Engineer inspection of the footing reinforcement before the pour.' },
    { id: 'bon-pour', siteId: 'bondi', trade: 'steel', title: 'Footing Pour', crew: 'Apex Concreting & Pump', startDate: '2026-12-02', endDate: '2026-12-02', arrival: '6:30 AM – 1:00 PM',
      where: 'Footings', notes: '32 MPa, 28 m³ by boom pump from Bondi Road.' }
];
