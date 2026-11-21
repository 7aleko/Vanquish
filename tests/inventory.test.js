// The equipment inventory (scripts/data/tools.js) as the database holds it: every item, location and quantity;
// the Factory as a location that is not a construction site; Acro Props unassigned; nothing old left over.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();

const EXPECTED = [
    ['Air Compressor', 'factory', 1], ['Abestos De Nailer', 'factory', 1], ['Biscuit Tool', 'factory', 1],
    ['Concrete Small Grinder', 'yowie-bay', 1], ['Core Hole Drill & Cores', 'bondi', 1], ['Drop Saw', 'factory', 1],
    ['Festool Saw', 'factory', 1], ['Festool Track', 'factory', 1], ['Fix Out Nailer (Air)', 'factory', 1],
    ['Floor Jackhammer Hitachi', 'factory', 1], ['Generator (Large)', 'factory', 1], ['Gerny', 'factory', 1],
    ['Jackhammer Makita', 'bondi', 1], ['Joist Hanger Nailer', 'factory', 1], ['Table Saw', 'factory', 1],
    ['Thicknesser', 'factory', 1], ['Tile Cutter', 'factory', 1], ['Floor Orbital Sander', 'factory', 1], ['Concrete Saw', 'factory', 1],
    ['1.8m Ladder', 'factory', 1], ['Extension Ladder', 'factory', 2], ['Metal Planks', 'factory', 2],
    ['Wheelbarrow', 'factory', 3], ['PLT 300', 'factory', 1], ['PLT 400', 'yowie-bay', 1], ['Brooms', 'factory', 3],
    ['Shovels', 'factory', 3], ['Site Tables', 'factory', 4], ['Double Door Fridge', 'factory', 1], ['Small Fridge', 'factory', 2],
    ['Fall Arrest Kit', 'factory', 2], ['4m Mobile Scaffold', 'oatley', 1], ['6m Mobile Scaffold', 'factory', 1]
];

test('inventory: every item at its location; several identical units are one record with buckets', async () => {
    const env = await app.makeEnv();
    const tools = await env.provider.equipment.list();
    const buckets = await env.provider.equipment.listAllocations();
    EXPECTED.forEach(([name, siteId, qty]) => {
        const rows = tools.filter(t => t.name === name);
        assert.equal(rows.length, 1, `${name}: one record`);
        const t = rows[0], status = siteId === 'factory' ? 'Available' : 'In Use';      // at a site = in use
        if (qty === 1) {
            assert.deepEqual([t.trackingType, t.siteId, t.status], ['individual', siteId, status], name);
            assert.equal(t.totalQuantity, undefined);
            assert.ok(!buckets.some(a => a.toolId === t.id));
        } else {
            assert.deepEqual([t.trackingType, t.totalQuantity, t.siteId, t.status], ['quantity', qty, null, null], name);
            assert.deepEqual(buckets.filter(a => a.toolId === t.id).map(a => [a.siteId, a.status, a.quantity]), [[siteId, status, qty]], name);
        }
    });
    const props = tools.find(t => t.name === 'Acro Props');
    assert.deepEqual([props.trackingType, props.totalQuantity], ['quantity', 40]);
    assert.deepEqual(buckets.filter(a => a.toolId === props.id).map(a => [a.siteId, a.status, a.quantity]), [[null, 'Available', 40]]);   // unassigned
    assert.equal(tools.length, EXPECTED.length + 1);                         // nothing old, no duplicates
    assert.equal(new Set(tools.map(t => t.id)).size, tools.length);
    assert.ok(!tools.some(t => /Hilti|DeWalt|Leica|Bobcat/.test(t.name)));
    // every grouped tool reconciles
    tools.filter(t => t.trackingType === 'quantity').forEach(t =>
        assert.deepEqual([...app.EquipmentRules.checkAllocations(t, buckets.filter(a => a.toolId === t.id))], []));
});

test('the factory is a location, not a construction site', async () => {
    const env = await app.makeEnv();
    const factory = await env.provider.sites.getById('factory');
    assert.equal(factory.kind, 'factory');
    assert.equal(factory.active, true);
    assert.equal((await env.provider.sites.getById('oatley')).kind, 'site');
});

test('a saved database from before the replacement takes the new inventory and keeps everything else', async () => {
    // A browser that saved the mock database before this change (localStorage, 'local' persistence)
    const saved = new Map();
    const storage = { getItem: k => (saved.has(k) ? saved.get(k) : null), setItem: (k, v) => saved.set(k, v) };
    const app2 = loadApp({ localStorage: storage });
    const policy = { anchor: app2.TIMESHEET_CONFIG.payRunAnchor, lengthDays: app2.TIMESHEET_CONFIG.payRunLengthDays };
    const seed = app2.buildMockSeed({ today: new Date(2026, 10, 13), payRunPolicy: policy, siteDay: new Date(2026, 10, 23) });
    const old = JSON.parse(JSON.stringify(seed));
    delete old.tableVersions;
    old.equipment = [{ id: 'tool-1', name: 'Hilti Rotary Hammer Drill', siteId: 'lugarno', category: 'power tools', status: 'In Use' }];
    old.sites = old.sites.filter(s => s.id !== 'factory').map(s => (s.id === 'bondi' ? { ...s, shortName: 'Bondi Beach' } : s));
    old.audit = [{ id: 'AU-1', entity: 'equipment', entityId: 'tool-1', action: 'transfer', actorId: 'team-1', at: '2026-11-01T00:00:00.000Z' }];
    storage.setItem('lifestyle.mockdb.v1', JSON.stringify(old));

    const provider = app2.createMockDataProvider({ seed, persistence: 'local' });
    const tools = await provider.equipment.list();
    assert.ok(!tools.some(t => t.id === 'tool-1'));                          // the old inventory is gone
    assert.equal(tools.length, seed.equipment.length);
    assert.equal((await provider.equipment.listAllocations()).length, seed.equipmentAllocations.length);
    assert.ok(await provider.sites.getById('factory'));                      // the factory location added
    assert.equal((await provider.sites.getById('bondi')).shortName, 'Bondi Beach');   // a saved rename kept
    assert.equal((await provider.audit.list()).length, 1);                   // history kept
});

test('a saved database with one record per unit (v3) is folded into groups, keeping each unit\'s place', async () => {
    const saved = new Map();
    const storage = { getItem: k => (saved.has(k) ? saved.get(k) : null), setItem: (k, v) => saved.set(k, v) };
    const app2 = loadApp({ localStorage: storage });
    const policy = { anchor: app2.TIMESHEET_CONFIG.payRunAnchor, lengthDays: app2.TIMESHEET_CONFIG.payRunLengthDays };
    const seed = app2.buildMockSeed({ today: new Date(2026, 10, 13), payRunPolicy: policy, siteDay: new Date(2026, 10, 23) });
    const old = JSON.parse(JSON.stringify(seed));
    old.tableVersions = { equipment: 3 };
    delete old.equipmentAllocations;
    const unit = (id, n, siteId, status) => ({ id, name: 'Wheelbarrow', category: 'site', siteId, status, groupId: 'grp-wheelbarrow', unitNumber: n, groupSize: 3, lastLogged: '' });
    old.equipment = [
        { id: 'eq-001', name: 'Air Compressor', category: 'power tools', siteId: 'factory', status: 'Available', lastLogged: '' },
        unit('eq-023', 1, 'factory', 'Available'), unit('eq-024', 2, 'bondi', 'In Use'), unit('eq-025', 3, 'factory', 'Available'),
        { id: 'eq-047', name: 'Acro Props', category: 'scaffolds', siteId: 'oatley', status: 'In Use', quantity: 40, unit: 'Props', lastLogged: '' },
        { id: 'eq-x', name: 'Small Fridge', category: 'site', siteId: 'factory', status: 'Available', groupId: 'grp-small-fridge', unitNumber: 1, groupSize: 2, lastLogged: '' }
    ];
    old.availabilityRequests = [{ id: 'AR-1', toolId: 'eq-024', siteId: 'bondi', status: 'available' }];
    storage.setItem('lifestyle.mockdb.v1', JSON.stringify(old));

    const provider = app2.createMockDataProvider({ seed, persistence: 'local' });
    const tools = await provider.equipment.list();
    const byName = n => tools.find(t => t.name === n);
    assert.equal(byName('Air Compressor').trackingType, 'individual');
    const wb = byName('Wheelbarrow');
    assert.deepEqual([wb.id, wb.trackingType, wb.totalQuantity, [...wb.mergedIds]], ['eq-023', 'quantity', 3, ['eq-024', 'eq-025']]);
    const b = (await provider.equipment.listAllocations({ toolId: 'eq-023' })).map(a => `${a.siteId}|${a.status}|${a.quantity}`).sort();
    assert.deepEqual(b, ['bondi|In Use|1', 'factory|Available|2']);
    const props = byName('Acro Props');
    assert.deepEqual([props.id, props.totalQuantity], ['eq-047', 40]);
    assert.equal(byName('Small Fridge').needsReview, true);                 // 1 unit found, group said 2: flagged, not guessed
    const r = await provider.availability.getRequest('AR-1');
    assert.deepEqual([r.toolId, r.legacyToolId], ['eq-023', 'eq-024']);    // history re-pointed, original kept
});
