// Repositories (mock provider): contracts, CRUD, relationships, constraints, transactions and failures.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const code = c => err => err && err.code === c;

test('the mock provider fulfils every repository contract', async () => {
    const { provider } = await app.makeEnv();
    assert.doesNotThrow(() => app.assertImplementsContracts(provider));
    assert.throws(() => app.assertImplementsContracts({ name: 'broken', sites: {} }), err => /missing: sites\.list/.test(err.message));
});

test('seed: every record is valid and every reference resolves', async () => {
    const { provider } = await app.makeEnv();
    const sites = await provider.sites.list();
    const ids = new Set(sites.map(s => s.id));
    const employees = new Set((await provider.employees.list()).map(e => e.id));
    assert.equal(sites.filter(s => s.active && s.kind === 'site').length, 11);     // construction sites
    assert.deepEqual(sites.filter(s => s.kind === 'factory').map(s => s.id), ['factory']);
    for (const r of await provider.roster.list()) { assert.ok(ids.has(r.siteId)); assert.ok(employees.has(r.employeeId)); }
    for (const t of await provider.timesheets.list()) { app.assertValidEntity('timesheet', t); assert.ok(ids.has(t.siteId)); }
    for (const l of await provider.crewLogs.list()) { app.assertValidEntity('crewLog', l); assert.ok(ids.has(l.siteId)); }
    for (const tool of await provider.equipment.list()) { app.assertValidEntity('tool', tool); assert.ok(tool.siteId === null || ids.has(tool.siteId)); }
});

test('reads return copies: changing one never changes stored data', async () => {
    const { provider } = await app.makeEnv();
    const site = await provider.sites.getById('lugarno');
    site.shortName = 'Changed';
    assert.equal((await provider.sites.getById('lugarno')).shortName, 'Lugarno');
});

test('sites: create, update, archive keeps the record, duplicate id conflicts', async () => {
    const { provider } = await app.makeEnv();
    await provider.sites.create({ id: 'menai', shortName: 'Menai', address: '1 Allison Cres', suburb: 'Menai' });
    await assert.rejects(provider.sites.create({ id: 'menai', shortName: 'Menai', address: 'x', suburb: 'y' }), code('CONFLICT'));
    assert.equal((await provider.sites.update('menai', { shortName: 'Menai North', id: 'ignored' })).id, 'menai');
    await provider.sites.archive('menai');
    assert.equal((await provider.sites.getById('menai')).active, false);
    assert.ok(!(await provider.sites.list({ includeArchived: false })).some(s => s.id === 'menai'));
    await assert.rejects(provider.sites.update('nowhere', {}), code('NOT_FOUND'));
    await assert.rejects(provider.sites.update('menai', { shortName: '' }), code('VALIDATION'));
});

test('roster: one entry per employee per day; foreign keys are checked', async () => {
    const { provider } = await app.makeEnv();
    const before = (await provider.roster.list()).length;
    await provider.roster.assign({ date: '2026-11-13', employeeId: 'team-1', siteId: 'bondi' });
    assert.equal((await provider.roster.list()).length, before);
    assert.equal((await provider.roster.getForEmployeeOnDate('team-1', '2026-11-13')).siteId, 'bondi');
    await assert.rejects(provider.roster.assign({ date: '2026-11-13', employeeId: 'team-1', siteId: 'nowhere' }), code('VALIDATION'));
    await assert.rejects(provider.roster.assign({ date: '2026-11-13', employeeId: 'ghost', siteId: 'bondi' }), code('VALIDATION'));
});

test('timesheets: unique per employee and day; cost codes must exist', async () => {
    const { provider } = await app.makeEnv();
    const t = { date: '2026-11-12', employeeId: 'team-1', siteId: 'lugarno', siteAssignmentType: 'rostered', status: 'submitted',
                blocks: [{ id: 'b1', code: '006-1', start: '07:00', finish: '15:30', breakMins: 30, task: 'x' }] };
    await provider.timesheets.create(t);
    await assert.rejects(provider.timesheets.create(t), code('CONFLICT'));
    await assert.rejects(provider.timesheets.create({ ...t, date: '2026-11-13', blocks: [{ ...t.blocks[0], code: '999-9' }] }), code('VALIDATION'));
    assert.equal((await provider.timesheets.getForEmployeeOnDate('team-1', '2026-11-12')).siteId, 'lugarno');
    assert.equal(await provider.timesheets.getForEmployeeOnDate('team-1', '2026-11-20'), null);
});

test('crew logs: filtered by both date and siteId', async () => {
    const { provider } = await app.makeEnv();
    const logs = await provider.crewLogs.list({ date: '2026-11-13', siteId: 'castlecrag' });
    assert.equal(logs.length, 2);
    assert.ok(logs.every(l => l.date === '2026-11-13' && l.siteId === 'castlecrag'));
    assert.equal((await provider.crewLogs.list({ date: '2026-11-16', siteId: 'lugarno' })).length, 0);   // not started yet
});

test('transactions: a failure undoes every write in it', async () => {
    const { provider } = await app.makeEnv();
    await assert.rejects(provider.transaction(async repos => {
        await repos.sites.update('lugarno', { shortName: 'Half done' });
        throw new Error('boom');
    }));
    assert.equal((await provider.sites.getById('lugarno')).shortName, 'Lugarno');
});

test('simulated network failures surface as NETWORK errors', async () => {
    const { provider } = await app.makeEnv();
    provider.debug.failNext('sites.list');
    await assert.rejects(provider.sites.list(), code('NETWORK'));
    assert.equal((await provider.sites.list()).length, 13);
});
