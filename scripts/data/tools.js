/**
 * Tools & gear inventory.
 * Pure data - no logic. Loaded before all feature scripts.
 */

// Expanded sample tool dataset (ID codes removed completely)
const TOOLS_DIRECTORY_DATA = [
    { id: 'tool-1', name: 'Hilti Rotary Hammer Drill', siteId: 'lugarno', category: 'power tools', status: 'In Use', lastLogged: '12 Oct by James B.' },
    { id: 'tool-2', name: 'DeWalt Cordless Circular Saw', siteId: 'castlecrag', category: 'power tools', status: 'Available', lastLogged: '13 Oct by David H.' },
    { id: 'tool-3', name: 'Leica Laser Level Pro', siteId: 'bondi', category: 'setout', status: 'In Use', lastLogged: '14 Oct by Jeremy G.' },
    { id: 'tool-4', name: 'Bosch Heavy Duty Grinder', siteId: 'lugarno', category: 'power tools', status: 'Service', lastLogged: '10 Oct by Workshop' }, // Updated to 'Service'
    { id: 'tool-5', name: 'Aluminum Extension Ladder 6m', siteId: 'bondi', category: 'access', status: 'Available', lastLogged: '11 Oct by Curtis B.' },
    { id: 'tool-6', name: 'Honda Portable Concrete Mixer', siteId: 'lugarno', category: 'concrete', status: 'Available', lastLogged: '09 Oct by James B.' },
    { id: 'tool-7', name: 'First Aid & Spill Response Kit', siteId: 'castlecrag', category: 'safety', status: 'Available', lastLogged: '14 Oct by Safety Officer' },
    { id: 'tool-8', name: 'Dual Axle Plant Trailer', siteId: 'caringbah', category: 'trailers', status: 'Available', lastLogged: '08 Oct by Warehouse' },
    { id: 'tool-9', name: 'Aluminum Mobile Scaffold Tower', siteId: 'lugarno', category: 'scaffolds', status: 'In Use', lastLogged: '13 Oct by David H.' },
    { id: 'tool-10', name: 'Bobcat T590 Compact Track Loader', siteId: 'bondi', category: 'bobcat', status: 'In Use', lastLogged: '14 Oct by Jeremy G.' },
    { id: 'tool-11', name: 'Acro Props (Adjustable Steel)', siteId: 'caringbah', category: 'site', status: 'Available', quantity: 24, unit: 'Props', lastLogged: '14 Oct by Warehouse' }
];
