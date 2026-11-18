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

test('equipment: available moves, in use requests, service refused', async () => {
    const env = await app.makeEnv();
    const moved = await env.equipment.transfer('tool-2', 'bondi');             // available, at Castlecrag
    assert.equal(moved.outcome, 'move');
    assert.equal(env.store.get('equipment').find(t => t.id === 'tool-2').siteId, 'bondi');
    const requested = await env.equipment.transfer('tool-1', 'bondi');         // in use, at Lugarno
    assert.equal(requested.outcome, 'request');
    assert.equal(requested.tool.siteId, 'lugarno');
    assert.equal(requested.tool.moveRequestedToSiteId, 'bondi');
    await assert.rejects(env.equipment.transfer('tool-4', 'bondi'), code('CONFLICT'));     // in service
    await assert.rejects(env.equipment.transfer('tool-2', 'miranda'), code('VALIDATION'));  // archived destination
});

test('equipment register: starts available at the site, audits, refuses bad input and duplicates', async () => {
    const env = await app.makeEnv();
    const tool = await env.equipment.register({ name: '  Makita  Impact Driver ', category: 'power tools', siteId: 'bondi' });
    assert.equal(tool.name, 'Makita Impact Driver');
    assert.equal(tool.status, 'Available');
    assert.equal(tool.siteId, 'bondi');
    assert.equal(tool.quantity, undefined);
    assert.ok(env.store.get('equipment').some(t => t.id === tool.id));
    assert.equal((await env.provider.audit.list({ entity: 'equipment', entityId: tool.id }))[0].action, 'create');
    const props = await env.equipment.register({ name: 'Formwork Clamps', category: 'site', siteId: 'lugarno', quantity: '40', unit: 'Clamps' });
    assert.equal(props.quantity, 40);
    assert.equal(props.unit, 'Clamps');
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
    const day = env.store.get('attendance').filter(a => a.date === '2026-10-14');
    const james = day.find(a => a.name === 'James Begg');
    assert.equal(james.employeeId, 'team-31');
    assert.equal(james.siteId, 'lugarno');
    assert.equal(james.signedOutAt, null);
    assert.equal(day.find(a => a.name === 'Labour Hire 1').employeeId, null);
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

test('site content: seeded logs and drawings per site, authors resolved, no sample photos', async () => {
    const env = await app.makeEnv();
    const logs = env.store.get('siteLogs').filter(l => l.siteId === 'lugarno');
    assert.ok(logs.length >= 3);
    assert.equal(logs.find(l => l.title.startsWith('Termite')).authorId, 'team-31');
    const a102 = env.store.get('drawings').find(d => d.siteId === 'lugarno' && d.sheet === 'A102');
    assert.equal(a102.revision, 'C');
    assert.equal(env.store.get('sitePhotos').length, 0);
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
