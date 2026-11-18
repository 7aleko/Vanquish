/**
 * Site content: daily site logs and drawings for each site (the mock "database" contents). Pure data - no
 * logic. Loaded before the mock seed (scripts/data-access/mock/seed.js), which is the only code that reads it
 * and turns it into SiteLog / Drawing records (scripts/domain/models.js). A real backend (Procore) supplies
 * these instead.
 *
 * SITE_LOG_SAMPLE: what happened on site, by day. `author` is a team member's name (resolved to an
 *   employee by the seed). Dates sit around the Home / Roster demo day (Wed 14 Oct 2026).
 * DRAWING_SAMPLE: the current revision of each drawing sheet, with the day it was last updated.
 *
 * Site photos have no sample data: there are no image files in the project. Photos are added for real
 * from Add Log (attached to the log) and stored as SitePhoto records.
 */

const SITE_LOG_SAMPLE = [
    // Lugarno
    { siteId: 'lugarno', date: '2026-10-14', author: 'James Begg', title: 'Termite barrier & slab pre-pour inspection completed',
      body: 'Certifier signed off the termite barrier and under-slab plumbing. Reo chairs and edge forms checked; slab is clear to pour Friday, weather permitting.' },
    { siteId: 'lugarno', date: '2026-10-13', author: 'David Hilt', title: 'Formwork stripped on Level 1 soffits',
      body: 'Apex stripped the Level 1 deck and back-propped the slab. Shores stacked at the laydown area for collection.' },
    { siteId: 'lugarno', date: '2026-10-12', author: 'Brad Davis', title: 'Electrical rough-in progress, ground floor',
      body: 'Conduits run through the ground floor walls; switchboard position marked. Kitchen circuits still to go in before linings.' },
    { siteId: 'lugarno', date: '2026-10-09', author: 'David Hilt', title: 'Waterproofing inspection passed in wet areas',
      body: 'Bathrooms and laundry membranes inspected and passed. Flood test held 24 hours with no leaks.' },
    { siteId: 'lugarno', date: '2026-10-08', author: 'James Begg', title: 'Concrete pour completed, garage slab',
      body: '14 m³ poured and power-floated. Curing compound applied; keep foot traffic off until Monday.' },
    // Castlecrag
    { siteId: 'castlecrag', date: '2026-10-14', author: 'Jude Hudson', title: 'Roof sheeting delivered and loaded on scaffold',
      body: 'Colorbond sheets and flashings delivered at 7:30. Loaded onto the scaffold deck and strapped down.' },
    { siteId: 'castlecrag', date: '2026-10-12', author: 'David Hilt', title: 'Frame inspection booked for Friday',
      body: 'Certifier booked for 9 AM Friday. Bracing straps and tie-downs to be finished Thursday.' },
    { siteId: 'castlecrag', date: '2026-10-07', author: 'Jude Hudson', title: 'Rear deck demolition complete',
      body: 'Old deck removed and skip bin swapped. Bearers exposed for the engineer to inspect.' },
    // Bondi
    { siteId: 'bondi', date: '2026-10-13', author: 'Curtis Bell', title: 'Retaining wall blocks core-filled',
      body: 'Core-filled the eastern retaining wall. Ag pipe and drainage gravel placed behind before backfill.' },
    { siteId: 'bondi', date: '2026-10-12', author: 'Jeremy Gillon', title: 'Site fencing repaired after wind',
      body: 'Two fence panels blown over overnight. Re-footed and clamped; shade cloth replaced on the street side.' },
    { siteId: 'bondi', date: '2026-10-08', author: 'Shaun Terry', title: 'Excavation for pool shell started',
      body: 'Excavator on site. Spoil being trucked out; sandstone shelf found at 1.4 m on the northern side.' },
    // Yowie Bay
    { siteId: 'yowie-bay', date: '2026-10-09', author: 'Brad Davis', title: 'Bathroom tiling underway, level 1',
      body: 'Floor tiles laid in the main bathroom. Wall tiling starts Monday once the niche is framed.' },
    { siteId: 'yowie-bay', date: '2026-10-06', author: 'Brendan Hodge', title: 'Plasterboard delivery checked off',
      body: 'Delivery checked against the order; two sheets damaged and returned for credit.' }
];

const DRAWING_SAMPLE = [
    // Lugarno
    { siteId: 'lugarno', sheet: 'A102', title: 'Ground Floor Framing Plan', discipline: 'Architectural', revision: 'C', updated: '2026-10-12' },
    { siteId: 'lugarno', sheet: 'S001', title: 'Slab Plan & Details', discipline: 'Structural', revision: 'E', updated: '2026-10-07' },
    { siteId: 'lugarno', sheet: 'A101', title: 'Site Plan', discipline: 'Architectural', revision: 'D', updated: '2026-10-02' },
    { siteId: 'lugarno', sheet: 'E101', title: 'Electrical Layout, Ground Floor', discipline: 'Electrical', revision: 'A', updated: '2026-09-28' },
    { siteId: 'lugarno', sheet: 'A201', title: 'Elevations', discipline: 'Architectural', revision: 'B', updated: '2026-09-21' },
    // Castlecrag
    { siteId: 'castlecrag', sheet: 'A110', title: 'Roof Plan', discipline: 'Architectural', revision: 'C', updated: '2026-10-09' },
    { siteId: 'castlecrag', sheet: 'S101', title: 'Framing Details', discipline: 'Structural', revision: 'A', updated: '2026-10-01' },
    { siteId: 'castlecrag', sheet: 'A101', title: 'Site Plan', discipline: 'Architectural', revision: 'B', updated: '2026-09-15' },
    // Bondi
    { siteId: 'bondi', sheet: 'S201', title: 'Retaining Wall Details', discipline: 'Structural', revision: 'D', updated: '2026-10-10' },
    { siteId: 'bondi', sheet: 'C201', title: 'Pool Shell Section', discipline: 'Civil', revision: 'B', updated: '2026-10-05' },
    { siteId: 'bondi', sheet: 'A101', title: 'Site Plan', discipline: 'Architectural', revision: 'C', updated: '2026-09-24' },
    // Yowie Bay
    { siteId: 'yowie-bay', sheet: 'A301', title: 'Bathroom Elevations', discipline: 'Architectural', revision: 'B', updated: '2026-10-03' },
    { siteId: 'yowie-bay', sheet: 'A101', title: 'Floor Plan', discipline: 'Architectural', revision: 'F', updated: '2026-09-18' }
];
