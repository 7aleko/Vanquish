/**
 * Site content: daily site logs (the Site Diary), drawings and site photos for each site (the mock "database"
 * contents). Pure data - no logic. Loaded before the mock seed (scripts/data-access/mock/seed.js), which is the
 * only code that reads it and turns it into SiteLog / Drawing / SitePhoto records (scripts/domain/models.js).
 * A real backend (Procore) supplies these instead.
 *
 * SITE_LOG_SAMPLE: what happened on site, by day (the Site Diary). `author` is a team member's name (resolved to
 *   an employee by the seed); `trades` are the schedule's trades (whiteboard.js) the day's work was for - the
 *   tags search filters by ("Plumbing" finds every plumbing day). `photos` are the pictures taken for it (files
 *   in assets/images/site-photos/, construction photography from Unsplash): the seed makes a SitePhoto for each,
 *   attached to the log, captioned with its title, tagged with its trades and `photoTag` (Progress by default).
 *   Dates sit before the sites' demo day (Mon 23 Nov 2026).
 * DRAWING_SAMPLE: the current revision of each drawing sheet, with the day it was last updated.
 */

const SITE_LOG_SAMPLE = [
    // Lugarno: 48 photos across the slab, frame and roof
    { siteId: 'lugarno', date: '2026-11-20', author: 'David Hilt', trades: ['inspection', 'carpentry'], photoTag: 'Inspection',
      title: 'Frame inspection passed, timber stacked',
      body: 'Certifier passed the frame inspection for both floors, no defects. Leftover framing timber stacked and covered on gluts at the rear for the pre-sheet noggins. Garage door installed this afternoon.',
      photos: ['site-inspection', 'wall-framing', 'timber-cutting', 'frame-renovation'] },
    { siteId: 'lugarno', date: '2026-11-19', author: 'James Begg', trades: ['carpentry'],
      title: 'Cladding finished on north and east elevations',
      body: 'Weatherboards finished to the north and east walls, corner stops and window trims fixed. Front door frame installed and propped.',
      photos: ['saw-cut', 'wall-framing', 'frame-renovation', 'timber-cutting'] },
    { siteId: 'lugarno', date: '2026-11-18', author: 'David Hilt', trades: ['plumbing'], photoTag: 'Inspection',
      title: 'Ground floor plumbing pressure test witnessed',
      body: 'FlowLine pressure tested the ground floor water and waste rough-in: held for 30 minutes, no drop. Photos added to the job file.',
      photos: ['plumbing-pipes', 'site-inspection', 'plans-review', 'drill-site'] },
    { siteId: 'lugarno', date: '2026-11-17', author: 'David Hilt', trades: ['plumbing'],
      title: 'Plumbing rough-in started, ground floor',
      body: 'FlowLine on site 7 AM. Water and waste run through the ground floor walls to the kitchen, laundry and powder room. Penetrations through the bottom plates sealed.',
      photos: ['plumbing-pipes', 'drill-site', 'plans-review'] },
    { siteId: 'lugarno', date: '2026-11-17', author: 'James Begg', trades: ['carpentry'],
      title: 'Eaves and fascia lining complete',
      body: 'Fibre cement eave linings and fascia finished around the whole house. Gutters can go on with the roof sheeting next week.',
      photos: ['roof-plumbing', 'saw-cut', 'timber-cutting'] },
    { siteId: 'lugarno', date: '2026-11-13', author: 'David Hilt', trades: ['roofing', 'carpentry'],
      title: 'Sarking and roof battens on',
      body: 'Sarking laid and battens fixed to the whole roof ahead of the roof sheeting. Roofers booked for Tuesday 24th.',
      photos: ['roof-plumbing', 'wall-framing', 'saw-cut', 'frame-renovation'] },
    { siteId: 'lugarno', date: '2026-11-10', author: 'Brad Davis', trades: ['carpentry', 'inspection'], photoTag: 'Inspection',
      title: 'Tie-downs and bracing checked',
      body: 'Walked the frame with the engineer’s details. Two missing strap brackets on the upper floor fixed same day.',
      photos: ['frame-renovation', 'wall-framing', 'plans-review', 'site-inspection'] },
    { siteId: 'lugarno', date: '2026-11-05', author: 'David Hilt', trades: ['carpentry'],
      title: 'Roof trusses craned in',
      body: 'Crane on site 7 AM, all 26 trusses landed and fixed by 2 PM. Street closure permit returned to council.',
      photos: ['wall-framing', 'roof-plumbing', 'timber-cutting', 'saw-cut'] },
    { siteId: 'lugarno', date: '2026-10-30', author: 'James Begg', trades: ['carpentry'],
      title: 'Upper floor wall frames stood',
      body: 'All upper floor wall frames stood, plumbed and braced temporarily. Window openings checked against the schedule.',
      photos: ['timber-cutting', 'wall-framing', 'saw-cut', 'frame-renovation'] },
    { siteId: 'lugarno', date: '2026-10-21', author: 'David Hilt', trades: ['electrical', 'carpentry'],
      title: 'Temporary power moved, upper floor joists laid',
      body: 'VoltEdge moved the temporary builder’s board to the side boundary and ran site lighting to the upper floor. Joists and flooring laid on the upper level.',
      photos: ['electrician', 'electrical-rough-in', 'saw-cut', 'timber-cutting'] },
    { siteId: 'lugarno', date: '2026-10-09', author: 'David Hilt', trades: ['carpentry'],
      title: 'Ground floor frames stood',
      body: 'Ground floor wall frames stood and plumbed. Bottom plates fixed to the slab with chemical anchors.',
      photos: ['wall-framing', 'frame-renovation', 'timber-cutting', 'drill-site'] },
    { siteId: 'lugarno', date: '2026-09-18', author: 'James Begg', trades: ['steel'], photoTag: 'Slab',
      title: 'Slab poured',
      body: '42 m³ poured and power-floated. Curing compound applied; keep foot traffic off until Monday.',
      photos: ['pre-pour-walk', 'slab-reo', 'reo-fixing', 'site-inspection'] },
    { siteId: 'lugarno', date: '2026-09-16', author: 'David Hilt', trades: ['steel', 'inspection'], photoTag: 'Inspection',
      title: 'Reo inspection passed',
      body: 'Engineer inspected the slab reinforcement and set-downs. Two bar chairs replaced at the garage step; passed.',
      photos: ['slab-reo', 'reo-fixing'] },
    { siteId: 'lugarno', date: '2026-09-11', author: 'David Hilt', trades: ['plumbing', 'inspection'],
      title: 'Under-slab plumbing pressure tested',
      body: 'FlowLine finished the under-slab drainage and pressure tested it with the certifier present. Passed; ready for the termite barrier.' },
    // Castlecrag
    { siteId: 'castlecrag', date: '2026-11-20', author: 'Jude Hudson', trades: ['carpentry'], photoTag: 'Joinery',
      title: 'Vanities installed, kitchen carcasses levelled',
      body: 'Both vanities in and fixed. Kitchen carcasses re-levelled for the stone template on Tuesday.',
      photos: ['kitchen-joinery', 'kitchen-fitout', 'living-fitout', 'painting'] },
    { siteId: 'castlecrag', date: '2026-11-17', author: 'Brendan Hodge', trades: ['carpentry', 'delivery'],
      title: 'Kitchen joinery delivered and installed',
      body: 'Cabinet Co. delivered the kitchen at 7:30. Carcasses installed; panels and doors stored in the garage.' },
    { siteId: 'castlecrag', date: '2026-11-06', author: 'Brendan Hodge', trades: ['finishes'],
      title: 'Linings complete, ready for joinery',
      body: 'Set and sanded throughout. Internal door frames installed. Painters booked for the 23rd.',
      photos: ['painting', 'living-fitout', 'insulation-batts', 'electrical-rough-in'] },
    // Bondi
    { siteId: 'bondi', date: '2026-11-20', author: 'Curtis Bell', trades: ['formwork'], photoTag: 'Footings',
      title: 'Pad footings excavated',
      body: 'Pad footings dug to the geotech’s founding level. Sandstone shelf on the northern side as expected. Formwork starts Monday.',
      photos: ['excavation-inspection', 'excavator', 'earthworks'] },
    { siteId: 'bondi', date: '2026-11-17', author: 'Jeremy Gillon', trades: [],
      title: 'Footings set out by surveyor',
      body: 'Surveyor marked out the footing grid. Pegs protected with para-webbing.' },
    { siteId: 'bondi', date: '2026-11-13', author: 'Curtis Bell', trades: ['inspection'],
      title: 'Founding level signed off by geotech',
      body: 'Geotech inspected the founding level and signed off. Shoring piles complete along the boundary.' },
    { siteId: 'bondi', date: '2026-11-09', author: 'Jeremy Gillon', trades: [], photoTag: 'Excavation',
      title: 'Rock breaking on the boundary',
      body: 'Hammer on the excavator all day along the eastern boundary. Vibration monitor readings within limits.',
      photos: ['excavator-rock', 'earthworks', 'excavator'] },
    // Yowie Bay
    { siteId: 'yowie-bay', date: '2026-11-19', author: 'Brad Davis', trades: ['masonry'],
      title: 'Bathroom tiling underway, level 1',
      body: 'Floor tiles laid in the main bathroom. Wall tiling starts Monday once the niche is framed.' },
    { siteId: 'yowie-bay', date: '2026-11-12', author: 'Brendan Hodge', trades: ['delivery', 'finishes'],
      title: 'Plasterboard delivery checked off',
      body: 'Delivery checked against the order; two sheets damaged and returned for credit.' }
];

const DRAWING_SAMPLE = [
    // Lugarno: the full set, current revision C (issued for construction after the frame amendments)
    { siteId: 'lugarno', sheet: 'A001', title: 'Cover Sheet & Drawing Register', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'A101', title: 'Site Plan', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'A102', title: 'Ground Floor Plan', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'A103', title: 'First Floor Plan', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'A104', title: 'Roof Plan', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'A201', title: 'Elevations North & East', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'A202', title: 'Elevations South & West', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'A301', title: 'Sections', discipline: 'Architectural', revision: 'B', updated: '2026-10-02' },
    { siteId: 'lugarno', sheet: 'A501', title: 'Window & Door Schedule', discipline: 'Architectural', revision: 'C', updated: '2026-11-12' },
    { siteId: 'lugarno', sheet: 'S001', title: 'Structural Notes', discipline: 'Structural', revision: 'B', updated: '2026-09-02' },
    { siteId: 'lugarno', sheet: 'S101', title: 'Slab & Footing Plan', discipline: 'Structural', revision: 'B', updated: '2026-09-02' },
    { siteId: 'lugarno', sheet: 'S201', title: 'Framing & Tie-Down Details', discipline: 'Structural', revision: 'C', updated: '2026-11-04' },
    { siteId: 'lugarno', sheet: 'E101', title: 'Electrical & Lighting Layout', discipline: 'Electrical', revision: 'C', updated: '2026-11-16' },
    { siteId: 'lugarno', sheet: 'H101', title: 'Hydraulic Services Plan', discipline: 'Hydraulic', revision: 'B', updated: '2026-10-14' },
    // Castlecrag
    { siteId: 'castlecrag', sheet: 'A301', title: 'Kitchen Joinery Elevations', discipline: 'Architectural', revision: 'D', updated: '2026-11-09' },
    { siteId: 'castlecrag', sheet: 'A302', title: 'Bathroom & Laundry Joinery', discipline: 'Architectural', revision: 'C', updated: '2026-11-09' },
    { siteId: 'castlecrag', sheet: 'A110', title: 'Ground Floor Plan', discipline: 'Architectural', revision: 'C', updated: '2026-10-09' },
    { siteId: 'castlecrag', sheet: 'E201', title: 'Lighting Plan', discipline: 'Electrical', revision: 'B', updated: '2026-10-30' },
    { siteId: 'castlecrag', sheet: 'A101', title: 'Site Plan', discipline: 'Architectural', revision: 'B', updated: '2026-09-15' },
    // Bondi
    { siteId: 'bondi', sheet: 'S201', title: 'Footing Plan & Details', discipline: 'Structural', revision: 'D', updated: '2026-11-16' },
    { siteId: 'bondi', sheet: 'S101', title: 'Shoring Piles Layout', discipline: 'Structural', revision: 'C', updated: '2026-10-21' },
    { siteId: 'bondi', sheet: 'C201', title: 'Stormwater & Drainage', discipline: 'Civil', revision: 'B', updated: '2026-10-05' },
    { siteId: 'bondi', sheet: 'A101', title: 'Site Plan', discipline: 'Architectural', revision: 'C', updated: '2026-09-24' },
    // Yowie Bay
    { siteId: 'yowie-bay', sheet: 'A301', title: 'Bathroom Elevations', discipline: 'Architectural', revision: 'B', updated: '2026-10-03' },
    { siteId: 'yowie-bay', sheet: 'A101', title: 'Floor Plan', discipline: 'Architectural', revision: 'F', updated: '2026-09-18' }
];
