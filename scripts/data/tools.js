/**
 * Equipment inventory: the mock database's equipment contents. Pure data - no logic. Loaded before the mock
 * seed (scripts/data-access/mock/seed.js), the only code that reads it; screens go through the equipment
 * repository and selectors.
 *
 * Each line is one inventory item: its name, category (ToolCategories id), location (a SITES id - 'factory'
 * is the Lifestyle Tradie factory / office, not a construction site; null = unassigned, location to
 * confirm) and how many there are.
 *  - `quantity` > 1: the seed creates one equipment record per physical unit, linked by a shared groupId,
 *    so each unit has its own status, location and transfer history.
 *  - `bulk: true`: counted stock kept as one record with a quantity (Acro Props).
 * Status follows location (EquipmentRules.statusAt): at a construction site In Use, at the factory or
 * unassigned Available. No transfer log was supplied, and no serial numbers are stored.
 */

const EQUIPMENT_INVENTORY = [
    // Power Tools & Machinery
    { name: 'Air Compressor',            category: 'power tools', location: 'factory' },
    { name: 'Abestos De Nailer',         category: 'power tools', location: 'factory' },
    { name: 'Biscuit Tool',              category: 'power tools', location: 'factory' },
    { name: 'Concrete Small Grinder',    category: 'power tools', location: 'yowie-bay' },
    { name: 'Core Hole Drill & Cores',   category: 'power tools', location: 'bondi' },
    { name: 'Drop Saw',                  category: 'power tools', location: 'factory' },
    { name: 'Festool Saw',               category: 'power tools', location: 'factory' },
    { name: 'Festool Track',             category: 'power tools', location: 'factory' },
    { name: 'Fix Out Nailer (Air)',      category: 'power tools', location: 'factory' },
    { name: 'Floor Jackhammer Hitachi',  category: 'power tools', location: 'factory' },
    { name: 'Generator (Large)',         category: 'power tools', location: 'factory' },
    { name: 'Gerny',                     category: 'power tools', location: 'factory' },
    { name: 'Jackhammer Makita',         category: 'power tools', location: 'bondi' },
    { name: 'Joist Hanger Nailer',       category: 'power tools', location: 'factory' },
    { name: 'Table Saw',                 category: 'power tools', location: 'factory' },
    { name: 'Thicknesser',               category: 'power tools', location: 'factory' },
    { name: 'Tile Cutter',               category: 'power tools', location: 'factory' },
    { name: 'Floor Orbital Sander',      category: 'power tools', location: 'factory' },
    { name: 'Concrete Saw',              category: 'power tools', location: 'factory' },

    // Ladders & Access Equipment
    { name: '1.8m Ladder',               category: 'access', location: 'factory', quantity: 1 },
    { name: 'Extension Ladder',          category: 'access', location: 'factory', quantity: 2 },
    { name: 'Metal Planks',              category: 'access', location: 'factory', quantity: 2 },

    // Transport & Site Equipment
    { name: 'Wheelbarrow',               category: 'site', location: 'factory',   quantity: 3 },
    { name: 'PLT 300',                   category: 'site', location: 'factory',   quantity: 1 },
    { name: 'PLT 400',                   category: 'site', location: 'yowie-bay', quantity: 1 },
    { name: 'Brooms',                    category: 'site', location: 'factory',   quantity: 3 },
    { name: 'Shovels',                   category: 'site', location: 'factory',   quantity: 3 },
    { name: 'Site Tables',               category: 'site', location: 'factory',   quantity: 4 },
    { name: 'Double Door Fridge',        category: 'site', location: 'factory',   quantity: 1 },
    { name: 'Small Fridge',              category: 'site', location: 'factory',   quantity: 2 },

    // Safety Equipment
    { name: 'Fall Arrest Kit',           category: 'safety', location: 'factory', quantity: 2 },

    // Scaffolding & Structural Equipment
    { name: '4m Mobile Scaffold',        category: 'scaffolds', location: 'oatley',  quantity: 1 },
    { name: '6m Mobile Scaffold',        category: 'scaffolds', location: 'factory', quantity: 1 },
    { name: 'Acro Props',                category: 'scaffolds', location: null,      quantity: 40, bulk: true, unit: 'Props' }
];
