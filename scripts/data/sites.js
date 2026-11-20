/**
 * SITES: the mock database's sites table - the one master list of sites. Every other record (roster,
 * timesheets, crew logs, jobs, tools, Procore projects) refers to a site by its `id`. Screens never read this
 * array: the mock provider (scripts/data-access/mock/) serves it through the sites repository and screens use
 * the selectors (getSiteById, getSiteName...) in scripts/application/selectors.js.
 * Pure data - no logic.
 *
 * - `id` is the stable relational key: never change it, and never use the display name as a key.
 * - `shortName` is the label shown everywhere; renaming a site here renames it across the app.
 * - `address` is the street line, `suburb` the locality.
 * - `active: false` archives a site: it drops out of every picker, but records that point at it still
 *   resolve (historical timesheets, tools last logged there).
 * - `icon` is the Font Awesome icon the tool transfer picker shows for the site.
 * - `kind`: 'site' (a construction site, the default) or 'factory' (the Lifestyle Tradie factory / office).
 *   The factory is a real location for equipment - it can be transferred to, searched and shown on Tools -
 *   but it is not a construction site: it never appears in site pickers (Site Hub, roster, timesheets).
 *
 * Migrated from the four lists that existed before (Timesheets, tool transfer destinations, the Site screen's
 * jobs and the roster's free-text names). Street names are written out in full ("Road", not "Rd") to match the
 * roster and Home card; no address was invented.
 */

const SITES = [
    // The Lifestyle Tradie factory / office: an equipment location, not a construction site. No street address was supplied.
    { id: 'factory',          shortName: 'Factory',          address: 'Lifestyle Tradie factory & office', suburb: '', active: true, icon: 'fa-solid fa-industry', kind: 'factory' },
    { id: 'lugarno',          shortName: 'Lugarno',          address: '935 Forest Road',            suburb: 'Lugarno',    active: true,  icon: 'fa-solid fa-building-user' },
    { id: 'yowie-bay',        shortName: 'Yowie Bay',        address: '1a Yelambie Street',         suburb: 'Yowie Bay',  active: true,  icon: 'fa-solid fa-house-flood-water' },
    { id: 'castlecrag',       shortName: 'Castlecrag',       address: '8c The Bulwark',             suburb: 'Castlecrag', active: true,  icon: 'fa-solid fa-hammer' },
    { id: 'bondi',            shortName: 'Bondi',            address: '350 Bondi Road',             suburb: 'Bondi',      active: true,  icon: 'fa-solid fa-compass-drafting' },
    { id: 'coogee',           shortName: 'Coogee',           address: '14 Arden Street',            suburb: 'Coogee',     active: true,  icon: 'fa-solid fa-umbrella-beach' },
    { id: 'sutherland-depot', shortName: 'Sutherland Depot', address: 'Flora St Storage Yard',      suburb: 'Sutherland', active: true,  icon: 'fa-solid fa-truck-ramp-box' },
    { id: 'cronulla',         shortName: 'Cronulla',         address: 'Lot 4 Waterfront Esplanade', suburb: 'Cronulla',   active: true,  icon: 'fa-solid fa-water' },
    { id: 'caringbah',        shortName: 'Caringbah',        address: 'Warehouse & Central Depot',  suburb: 'Caringbah',  active: true,  icon: 'fa-solid fa-warehouse' },
    { id: 'kirrawee',         shortName: 'Kirrawee',         address: '22 Bath Road',               suburb: 'Kirrawee',   active: true,  icon: 'fa-solid fa-helmet-safety' },
    { id: 'gymea',            shortName: 'Gymea',            address: '5 Gymea Bay Road',           suburb: 'Gymea',      active: true,  icon: 'fa-solid fa-helmet-safety' },
    { id: 'oatley',           shortName: 'Oatley',           address: '41 Mulga Road',              suburb: 'Oatley',     active: true,  icon: 'fa-solid fa-helmet-safety' },
    // Archived: a former tool transfer destination ("Miranda Commercial"). Kept so anything logged there
    // still resolves; it no longer appears as a choice.
    { id: 'miranda',          shortName: 'Miranda',          address: 'The Kingsway Hub',           suburb: 'Miranda',    active: false, icon: 'fa-solid fa-city' }
];
