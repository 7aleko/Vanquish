// Application services: workflows end to end over a fresh mock provider and cache, including permissions,
// audit entries and how the cache (what every screen reads) reflects each change.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const code = c => err => err && err.code === c;
const block = { code: '006-1', start: '07:00', finish: '15:30', breakMins: 30, task: 'Framing' };

test('timesheet submit: saves, classifies the site from the roster, audits, updates the cache', async () => {
    const env = await app.makeEnv();
    let notified = 0;
    env.store.subscribe(() => notified++, ['timesheets']);
    const saved = await env.timesheets.submit({ date: '2026-11-12', siteId: 'bondi', siteAssignmentType: 'rostered', blocks: [block] });
    assert.equal(saved.status, 'submitted');
    assert.equal(saved.siteAssignmentType, 'override');            // decided from the roster, not trusted from the screen
    assert.equal((await env.provider.roster.getForEmployeeOnDate('team-1', '2026-11-12')).siteId, 'lugarno');   // roster untouched
    assert.ok(env.store.get('timesheets').some(t => t.id === saved.id));
    assert.equal(notified, 1);
    assert.equal((await env.provider.audit.list({ entity: 'timesheets', entityId: saved.id }))[0].action, 'submit');
});

test('timesheet submit: resubmitting updates the same record and resets approval', async () => {
    const env = await app.makeEnv();
    const day = env.store.get('timesheets').find(t => t.date === '2026-11-02');
    assert.equal(day.status, 'approved');
    const saved = await env.timesheets.submit({ date: '2026-11-02', siteId: 'lugarno', blocks: [block] });
    assert.equal(saved.id, day.id);
    assert.equal(saved.status, 'submitted');
    assert.equal(env.store.get('timesheets').filter(t => t.date === '2026-11-02' && t.employeeId === 'team-1').length, 1);
});

test('timesheet submit: validation, future days, archived sites', async () => {
    const env = await app.makeEnv();
    await assert.rejects(env.timesheets.submit({ date: '2026-11-12', siteId: 'lugarno', blocks: [{ ...block, task: '' }] }),
        err => err.code === 'VALIDATION' && err.details.some(d => d.message === 'Add a short task description'));
    await assert.rejects(env.timesheets.submit({ date: '2026-11-16', siteId: 'lugarno', blocks: [block] }), code('VALIDATION'));
    await assert.rejects(env.timesheets.submit({ date: '2026-11-12', siteId: 'miranda', blocks: [block] }), code('VALIDATION'));
    // a day already logged at a site that is later archived can still be updated there
    env.session.signInAs('team-21');
    await env.sites.archive('castlecrag');
    env.session.signInAs('team-1');
    const saved = await env.timesheets.submit({ date: '2026-11-06', siteId: 'castlecrag', blocks: [block] });
    assert.equal(saved.siteId, 'castlecrag');
});

test('timesheet approval: supervisors only, never your own', async () => {
    const env = await app.makeEnv();
    const t = env.store.get('timesheets').find(x => x.status === 'submitted');
    await assert.rejects(env.timesheets.approve(t.id), code('PERMISSION_DENIED'));        // apprentice
    env.session.signInAs('team-8');                                                       // David Hilt, site supervisor
    const approved = await env.timesheets.approve(t.id);
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approvedBy, 'team-8');
    await assert.rejects(env.timesheets.approve(t.id), code('CONFLICT'));                 // already approved
});

test('a failed save changes nothing and the cache stays as it was', async () => {
    const env = await app.makeEnv();
    const before = env.store.get('timesheets').length;
    env.provider.debug.failNext('timesheets.create');
    await assert.rejects(env.timesheets.submit({ date: '2026-11-12', siteId: 'lugarno', blocks: [block] }), code('NETWORK'));
    assert.equal(env.store.get('timesheets').length, before);
    assert.equal(await env.provider.timesheets.getForEmployeeOnDate('team-1', '2026-11-12'), null);
});

test('sites: managers rename and archive; every reader sees it; history still resolves', async () => {
    const env = await app.makeEnv();
    await assert.rejects(env.sites.update('lugarno', { shortName: 'X' }), code('PERMISSION_DENIED'));
    env.session.signInAs('team-22');                                                      // project manager
    await env.sites.update('lugarno', { shortName: 'Lugarno North' });
    assert.equal(env.store.get('sites').find(s => s.id === 'lugarno').shortName, 'Lugarno North');
    await env.sites.archive('castlecrag');
    const castlecragDay = env.store.get('timesheets').find(t => t.siteId === 'castlecrag');
    assert.ok(castlecragDay, 'historical timesheet still points at the archived site');
    assert.equal(env.store.get('sites').find(s => s.id === 'castlecrag').active, false);
});

test('roster: supervisors move an employee between sites; Timesheets classification follows', async () => {
    const env = await app.makeEnv();
    await assert.rejects(env.roster.assign({ employeeId: 'team-1', date: '2026-11-12', siteId: 'bondi' }), code('PERMISSION_DENIED'));
    env.session.signInAs('team-8');
    await env.roster.moveEmployee('team-1', '2026-11-12', 'bondi');
    env.session.signInAs('team-1');
    const saved = await env.timesheets.submit({ date: '2026-11-12', siteId: 'bondi', blocks: [block] });
    assert.equal(saved.siteAssignmentType, 'rostered');
    env.session.signInAs('team-8');
    await assert.rejects(env.roster.assign({ employeeId: 'team-1', date: '2026-11-12', siteId: 'miranda' }), code('VALIDATION'));   // archived
});

test('crew logs: filtered by date and site; copying returns fresh blocks and changes nothing', async () => {
    const env = await app.makeEnv();
    const logs = env.crewLogs.forSiteOnDate('2026-11-13', 'lugarno');
    assert.equal(logs.length, 3);
    const copy = env.crewLogs.copyBlocks(logs[0].id);
    copy[0].task = 'edited';
    assert.notEqual(env.store.get('crewLogs').find(l => l.id === logs[0].id).blocks[0].task, 'edited');
    assert.equal(env.store.get('timesheets').some(t => t.date === '2026-11-13'), false);    // nothing submitted
});

test('equipment: available moves, in use requests, service refused; the factory is a location', async () => {
    const env = await app.makeEnv();
    assert.equal(env.store.get('equipment').find(t => t.id === 'eq-013').status, 'In Use');   // Jackhammer Makita, at Bondi
    await env.provider.equipment.update('eq-015', { status: 'Service' });             // Table Saw, Factory
    await env.store.refresh('equipment');
    const moved = await env.equipment.transfer('eq-006', 'bondi');                    // Drop Saw, available at the Factory
    assert.equal(moved.outcome, 'move');
    assert.equal(env.store.get('equipment').find(t => t.id === 'eq-006').siteId, 'bondi');
    assert.equal(env.store.get('equipment').find(t => t.id === 'eq-006').status, 'In Use');   // at a site = in use
    await assert.rejects(env.equipment.transfer('eq-006', 'factory'), err => err.code === 'CONFLICT' && /Request availability/.test(err.userMessage));   // in use: ask first
    await assert.rejects(env.equipment.transfer('eq-016', 'factory'), code('VALIDATION'));    // Thicknesser, already there
    await assert.rejects(env.equipment.transfer('eq-013', 'lugarno'), code('CONFLICT'));      // in use: no move requests
    assert.equal(env.store.get('equipment').find(t => t.id === 'eq-013').moveRequestedToSiteId, null);
    await assert.rejects(env.equipment.transfer('eq-015', 'bondi'), code('CONFLICT'));     // in service
    await assert.rejects(env.equipment.transfer('eq-006', 'miranda'), code('VALIDATION'));  // archived destination
    // a grouped tool moves units, not the record
    const props = env.store.get('equipment').find(t => t.name === 'Acro Props');
    await assert.rejects(env.equipment.transfer(props.id, 'oatley'), code('VALIDATION'));
});

// ---------- Quantity-tracked (grouped) equipment ----------
const bucketsOf = (env, toolId) => env.store.get('equipmentAllocations').filter(a => a.toolId === toolId)
    .map(a => `${a.siteId || 'unassigned'}|${a.status}|${a.quantity}`).sort();

test('grouped: transfer some units; source and destination buckets update and still add up', async () => {
    const env = await app.makeEnv();
    const wb = env.store.get('equipment').find(t => t.name === 'Wheelbarrow');
    assert.deepEqual([wb.trackingType, wb.totalQuantity], ['quantity', 3]);
    assert.deepEqual(bucketsOf(env, wb.id), ['factory|Available|3']);
    await env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 2 });
    assert.deepEqual(bucketsOf(env, wb.id), ['bondi|In Use|2', 'factory|Available|1']);     // at a site = in use
    await env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 1 });
    assert.deepEqual(bucketsOf(env, wb.id), ['bondi|In Use|3']);                              // empty bucket removed
    assert.deepEqual(bucketsOf(env, wb.id), (await env.provider.equipment.listAllocations({ toolId: wb.id })).map(a => `${a.siteId}|${a.status}|${a.quantity}`).sort());
    const audit = await env.provider.audit.list({ entity: 'equipment', entityId: wb.id });
    assert.equal(audit.length, 2);
    assert.equal(audit[0].changes.quantity, 2);
    // unassigned Acro Props: some placed, the rest still to confirm
    const props = env.store.get('equipment').find(t => t.name === 'Acro Props');
    await env.equipment.transferUnits({ toolId: props.id, fromSiteId: null, toSiteId: 'oatley', quantity: 15 });
    assert.deepEqual(bucketsOf(env, props.id), ['oatley|In Use|15', 'unassigned|Available|25']);
});

test('grouped: invalid quantities and missing units are refused, nothing changes', async () => {
    const env = await app.makeEnv();
    const wb = env.store.get('equipment').find(t => t.name === 'Wheelbarrow');
    for (const q of [0, -1, 1.5, 'x']) {
        await assert.rejects(env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: q }), code('VALIDATION'));
    }
    await assert.rejects(env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 4 }),
        err => err.code === 'CONFLICT' && /Only 3/.test(err.userMessage));
    await assert.rejects(env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'bondi', toSiteId: 'factory', quantity: 1 }), code('CONFLICT'));   // none there
    await assert.rejects(env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'factory', quantity: 1 }), code('VALIDATION'));
    await assert.rejects(env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'miranda', quantity: 1 }), code('VALIDATION'));
    await assert.rejects(env.equipment.transferUnits({ toolId: 'eq-001', fromSiteId: 'factory', toSiteId: 'bondi', quantity: 1 }), code('VALIDATION'));   // individual
    assert.deepEqual(bucketsOf(env, wb.id), ['factory|Available|3']);
});

test('grouped: simultaneous transfers can never take more units than exist', async () => {
    const env = await app.makeEnv();
    const wb = env.store.get('equipment').find(t => t.name === 'Wheelbarrow');
    const tries = [2, 2, 2].map(q => env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: q }));
    const results = await Promise.allSettled(tries);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.code === 'CONFLICT'));
    const saved = await env.provider.equipment.listAllocations({ toolId: wb.id });
    assert.deepEqual(saved.map(a => a.quantity).sort(), [1, 2]);
    assert.ok(saved.every(a => a.quantity > 0));
});

test('grouped: status changes in place; out of service units stay in the total', async () => {
    const env = await app.makeEnv();
    const wb = env.store.get('equipment').find(t => t.name === 'Wheelbarrow');
    await env.equipment.setUnitStatus({ toolId: wb.id, siteId: 'factory', fromStatus: 'Available', toStatus: 'Service', quantity: 1 });
    assert.deepEqual(bucketsOf(env, wb.id), ['factory|Available|2', 'factory|Service|1']);
    await env.equipment.setUnitStatus({ toolId: wb.id, siteId: 'factory', fromStatus: 'Available', toStatus: 'In Use', quantity: 1 });
    assert.deepEqual(bucketsOf(env, wb.id), ['factory|Available|1', 'factory|In Use|1', 'factory|Service|1']);
    assert.equal(env.store.get('equipment').find(t => t.id === wb.id).totalQuantity, 3);
    // out of service units can't be transferred (only available ones move)
    await env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 1 });
    await assert.rejects(env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 1 }), code('CONFLICT'));
    await env.equipment.setUnitStatus({ toolId: wb.id, siteId: 'factory', fromStatus: 'Service', toStatus: 'Available', quantity: 1 });
    assert.deepEqual(bucketsOf(env, wb.id), ['bondi|In Use|1', 'factory|Available|1', 'factory|In Use|1']);
    await assert.rejects(env.equipment.setUnitStatus({ toolId: wb.id, siteId: 'factory', fromStatus: 'Available', toStatus: 'Available', quantity: 1 }), code('VALIDATION'));
    // a details update can't change the count
    assert.equal((await env.provider.equipment.update(wb.id, { totalQuantity: 9, name: 'Wheelbarrow' })).totalQuantity, 3);
});

test('equipment register: in use at a site, available at the factory, audits, refuses bad input and duplicates', async () => {
    const env = await app.makeEnv();
    const tool = await env.equipment.register({ name: '  Makita  Impact Driver ', category: 'power tools', siteId: 'bondi' });
    assert.equal(tool.name, 'Makita Impact Driver');
    assert.equal(tool.status, 'In Use');                                             // at a construction site
    assert.equal((await env.equipment.register({ name: 'Nail Gun', category: 'power tools', siteId: 'factory' })).status, 'Available');
    assert.equal(tool.siteId, 'bondi');
    assert.equal(tool.trackingType, 'individual');
    assert.ok(env.store.get('equipment').some(t => t.id === tool.id));
    assert.equal((await env.provider.audit.list({ entity: 'equipment', entityId: tool.id }))[0].action, 'create');
    const props = await env.equipment.register({ name: 'Formwork Clamps', category: 'site', siteId: 'lugarno', quantity: '40', unit: 'Clamps' });
    assert.deepEqual([props.trackingType, props.totalQuantity, props.unit, props.siteId], ['quantity', 40, 'Clamps', null]);   // one record
    assert.deepEqual(env.store.get('equipmentAllocations').filter(a => a.toolId === props.id).map(a => [a.siteId, a.status, a.quantity]),
        [['lugarno', 'In Use', 40]]);
    await assert.rejects(env.equipment.register({ name: 'x', category: 'power tools', siteId: 'bondi' }), code('VALIDATION'));
    await assert.rejects(env.equipment.register({ name: 'Saw', category: 'nope', siteId: 'bondi' }), code('VALIDATION'));
    await assert.rejects(env.equipment.register({ name: 'Saw', category: 'power tools', siteId: 'miranda' }), code('VALIDATION'));  // archived
    await assert.rejects(env.equipment.register({ name: 'Saw', category: 'power tools', siteId: 'bondi', quantity: 0 }), code('VALIDATION'));
    await assert.rejects(env.equipment.register({ name: 'makita impact driver', category: 'power tools', siteId: 'bondi' }), code('CONFLICT'));
});

test('leave: request, overlapping refused, approval deducts the balance atomically', async () => {
    const env = await app.makeEnv();
    const r = await env.leave.request({ type: 'annual', startDate: '2026-12-04', endDate: '2026-12-08' });
    assert.equal(r.days, 3);
    assert.equal(r.status, 'pending');
    await assert.rejects(env.leave.request({ type: 'annual', startDate: '2026-12-07', endDate: '2026-12-07' }), code('CONFLICT'));
    await assert.rejects(env.leave.approve(r.id), code('PERMISSION_DENIED'));             // can't approve as an apprentice
    env.session.signInAs('team-22');
    const approved = await env.leave.approve(r.id);
    assert.equal(approved.status, 'approved');
    assert.equal((await env.provider.leave.getBalance('team-1')).annualDays, 7.4);
});

test('the cache freezes records: screens cannot change data without a service', async () => {
    const env = await app.makeEnv();
    const site = env.store.get('sites')[0];
    assert.throws(() => { 'use strict'; site.shortName = 'Hacked'; });
});

test('attendance: seeded sign-ins resolve to employees; labour hire keeps its name', async () => {
    const env = await app.makeEnv();
    const day = env.store.get('attendance').filter(a => a.date === '2026-11-23');
    const james = day.find(a => a.name === 'James Begg');
    assert.equal(james.employeeId, 'team-31');
    assert.equal(james.siteId, 'lugarno');
    assert.equal(james.signedOutAt, null);
    assert.equal(day.find(a => a.name === 'Labour Hire 1').employeeId, null);
    assert.equal(day.find(a => a.name === 'VoltEdge Electrical').employeeId, null);   // a subcontractor, by company
    assert.ok(!day.some(a => a.employeeId === 'team-1'));          // the worker starts not signed in
});

test('attendance: sign in, sign in again (no duplicate), sign out, reopen; audited; cache updated', async () => {
    const env = await app.makeEnv();
    let notified = 0;
    env.store.subscribe(() => notified++, ['attendance']);
    const a = await env.attendance.signIn({ siteId: 'lugarno', date: '2026-10-14' });
    assert.equal(a.employeeId, 'team-1');
    assert.equal(a.name, 'Alexander Floratos');
    assert.equal(a.signedOutAt, null);
    assert.ok(!Number.isNaN(Date.parse(a.signedInAt)));
    assert.equal((await env.attendance.signIn({ siteId: 'lugarno', date: '2026-10-14' })).id, a.id);
    await assert.rejects(env.attendance.signIn({ siteId: 'bondi', date: '2026-10-14' }), code('CONFLICT'));
    const out = await env.attendance.signOut({ date: '2026-10-14' });
    assert.ok(out.signedOutAt);
    await assert.rejects(env.attendance.signOut({ date: '2026-10-14' }), code('CONFLICT'));
    const back = await env.attendance.signIn({ siteId: 'lugarno', date: '2026-10-14' });
    assert.equal(back.id, a.id);
    assert.equal(back.signedOutAt, null);
    assert.equal(env.store.get('attendance').filter(r => r.employeeId === 'team-1' && r.date === '2026-10-14').length, 1);
    assert.equal(notified, 3);
    const actions = (await env.provider.audit.list({ entity: 'attendance', entityId: a.id })).map(e => e.action);
    assert.deepEqual(actions, ['sign_in', 'sign_out', 'sign_in']);
});

test('attendance: validation and failures leave nothing behind', async () => {
    const env = await app.makeEnv();
    await assert.rejects(env.attendance.signIn({ siteId: 'nowhere', date: '2026-10-14' }), code('VALIDATION'));
    await assert.rejects(env.attendance.signIn({ siteId: 'lugarno', date: '14 Oct' }), code('VALIDATION'));
    env.provider.debug.failNext('attendance.signIn');
    await assert.rejects(env.attendance.signIn({ siteId: 'lugarno', date: '2026-10-14' }));
    assert.ok(!env.store.get('attendance').some(r => r.employeeId === 'team-1'));
    assert.equal((await env.provider.attendance.list({ employeeId: 'team-1' })).length, 0);
});

test('site content: seeded logs, drawings and photos per site, authors resolved', async () => {
    const env = await app.makeEnv();
    const logs = env.store.get('siteLogs').filter(l => l.siteId === 'lugarno');
    assert.ok(logs.length >= 3);
    const latest = logs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    assert.deepEqual([latest.date, latest.title, latest.authorId], ['2026-11-20', 'Frame inspection passed, timber stacked', 'team-8']);
    const dwgs = env.store.get('drawings').filter(d => d.siteId === 'lugarno');
    assert.equal(dwgs.length, 14);
    assert.equal(dwgs.slice().sort((a, b) => (a.updatedOn < b.updatedOn ? 1 : -1))[0].revision, 'C');
    const photos = env.store.get('sitePhotos').filter(p => p.siteId === 'lugarno');
    assert.equal(photos.length, 48);
    assert.ok(photos.every(p => /^assets\/images\/site-photos\/[a-z-]+\.jpg$/.test(p.src) && p.takenBy));
    const site = env.store.get('sites').find(s => s.id === 'lugarno');
    assert.deepEqual([site.stage, site.lockbox], ['Frame & Roof', '4829']);
});

test('site content: add a log with photos in one transaction; audited; cache updated', async () => {
    const env = await app.makeEnv();
    const photo = { src: 'data:image/jpeg;base64,AAAA', caption: 'Slab edge' };
    const log = await env.siteContent.addLog({ siteId: 'bondi', date: '2026-10-14', title: 'Pool shell steel fixed', body: 'Ready for inspection', photos: [photo, { src: 'data:image/png;base64,BBBB' }] });
    assert.equal(log.authorId, 'team-1');
    assert.equal(log.authorName, 'Alexander Floratos');
    const photos = env.store.get('sitePhotos').filter(p => p.logId === log.id);
    assert.equal(photos.length, 2);
    assert.equal(photos[0].caption, 'Slab edge');
    assert.equal(photos[1].caption, 'Pool shell steel fixed');          // defaults to the log title
    assert.ok(env.store.get('siteLogs').some(l => l.id === log.id));
    assert.equal((await env.provider.audit.list({ entity: 'siteLogs', entityId: log.id }))[0].action, 'create');
});

test('site content: validation, and a failed photo rolls back the whole log', async () => {
    const env = await app.makeEnv();
    await assert.rejects(env.siteContent.addLog({ siteId: 'bondi', date: '2026-10-14', title: 'x' }), code('VALIDATION'));
    await assert.rejects(env.siteContent.addLog({ siteId: 'miranda', date: '2026-10-14', title: 'Archived site' }), code('VALIDATION'));
    await assert.rejects(env.siteContent.addLog({ siteId: 'bondi', date: '2026-10-14', title: 'Bad photo', photos: [{ src: 'javascript:alert(1)' }] }), code('VALIDATION'));
    const before = (await env.provider.siteLogs.list({ siteId: 'bondi' })).length;
    env.provider.debug.failNext('sitePhotos.create');
    await assert.rejects(env.siteContent.addLog({ siteId: 'bondi', date: '2026-10-14', title: 'Rolled back', photos: [{ src: 'data:image/png;base64,AA' }] }));
    assert.equal((await env.provider.siteLogs.list({ siteId: 'bondi' })).length, before);
    assert.ok(!env.store.get('siteLogs').some(l => l.title === 'Rolled back'));
});

test('transfer: the arrival status is the one chosen (In Use / Available), recorded and validated', async () => {
    const env = await app.makeEnv();
    const drop = await env.equipment.transfer('eq-006', 'bondi', { status: 'Available' });      // Drop Saw, Factory -> Bondi
    assert.deepEqual([drop.tool.siteId, drop.tool.status], ['bondi', 'Available']);
    const log = (await env.provider.audit.list({ entity: 'equipment', entityId: 'eq-006' })).slice(-1)[0];
    assert.equal(log.changes.status, 'Available');
    await assert.rejects(env.equipment.transfer('eq-007', 'bondi', { status: 'Service' }), code('VALIDATION'));
    // grouped: units arrive in the chosen bucket; an existing bucket is topped up, never duplicated
    const wb = env.store.get('equipment').find(t => t.name === 'Wheelbarrow');
    await env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 1, toStatus: 'Available' });
    await env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 1, toStatus: 'Available' });
    await env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'bondi', quantity: 1, toStatus: 'In Use' });
    assert.deepEqual(bucketsOf(env, wb.id), ['bondi|Available|2', 'bondi|In Use|1']);
    await assert.rejects(env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'bondi', toSiteId: 'factory', quantity: 1, toStatus: 'Service' }), code('VALIDATION'));
});

test('drawings: add a sheet; a new revision replaces it; the same revision is refused', async () => {
    const env = await app.makeEnv();
    const d = await env.siteContent.addDrawing({ siteId: 'lugarno', sheet: 'a 103', title: 'First Floor Plan', discipline: 'Architectural', revision: 'a', date: '2026-10-14' });
    assert.deepEqual([d.sheet, d.revision, d.updatedOn], ['A103', 'A', '2026-10-14']);
    const r = await env.siteContent.addDrawing({ siteId: 'lugarno', sheet: 'A103', title: 'First Floor Plan', discipline: 'Architectural', revision: 'B', date: '2026-10-15' });
    assert.equal(r.id, d.id);
    assert.equal(env.store.get('drawings').filter(x => x.siteId === 'lugarno' && x.sheet === 'A103').length, 1);
    await assert.rejects(env.siteContent.addDrawing({ siteId: 'lugarno', sheet: 'A103', title: 'First Floor Plan', discipline: 'Architectural', revision: 'B', date: '2026-10-15' }), code('CONFLICT'));
    await assert.rejects(env.siteContent.addDrawing({ siteId: 'lugarno', sheet: '', title: 'x', discipline: 'Nope', revision: '', date: '2026-10-15' }), code('VALIDATION'));
});

test('site content: Add Photo saves photos on their own, with one description and tag', async () => {
    const env = await app.makeEnv();
    const src = 'data:image/jpeg;base64,AAAA';
    const before = env.store.get('sitePhotos').filter(p => p.siteId === 'lugarno').length;
    const added = await env.siteContent.addPhotos({ siteId: 'lugarno', date: '2026-11-23', caption: ' Sparky  conduits ', tag: 'Progress', photos: [{ src }, { src }] });
    assert.equal(added.length, 2);
    assert.ok(added.every(p => p.caption === 'Sparky conduits' && p.takenBy === 'team-1' && p.logId === null));
    assert.equal(env.store.get('sitePhotos').filter(p => p.siteId === 'lugarno').length, before + 2);
    await assert.rejects(env.siteContent.addPhotos({ siteId: 'lugarno', date: '2026-11-23', photos: [] }), err => err.code === 'VALIDATION');
    await assert.rejects(env.siteContent.addPhotos({ siteId: 'lugarno', date: '2026-11-23', tag: 'Nope', photos: [{ src }] }), err => err.code === 'VALIDATION');
});
