// The site schedule over a fresh mock database: bookings, milestones and their checklists, copy, delete and
// undo, trades, and the shared views (upcoming milestone, next on site, stages). The seeded schedule comes from
// scripts/data/whiteboard.js; the sites run on Mon 23 Nov 2026.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const code = c => err => err && err.code === c;

test('schedule: the seeded bookings, milestones and trades are in the database', async () => {
    const env = await app.makeEnv();
    const tasks = await env.provider.schedule.listTasks({ siteId: 'lugarno' });
    const R = app.ScheduleRules;
    const miles = R.milestones(tasks);
    assert.deepEqual(miles.map(t => [t.title, R.progress(t).done, R.progress(t).total]),
        [['Subfloor & Slab', 8, 8], ['Wall & Roof Framing', 10, 10], ['Lock-Up Stage', 6, 10], ['Pre-Sheet & Insulation', 0, 7]]);
    const lockup = miles[2];
    assert.equal(lockup.endDate, '2026-11-27');
    assert.ok(lockup.checklist.filter(x => x.done).every(x => x.doneBy && x.doneByName && x.doneAt));
    const elec = tasks.find(t => t.title === 'Sparky Rough-In');
    assert.deepEqual([elec.crew, elec.arrival, elec.startDate], ['VoltEdge Electrical', '7:00 AM – 3:30 PM', '2026-11-23']);
    const trades = await env.provider.schedule.listTrades();
    assert.equal(trades.length, 12);
    assert.ok(trades.every(t => /^#[0-9A-F]{6}$/i.test(t.color)));
    // the other two active sites carry their own stage gates
    const cc = R.upcomingMilestone(await env.provider.schedule.listTasks({ siteId: 'castlecrag' }));
    const bon = R.upcomingMilestone(await env.provider.schedule.listTasks({ siteId: 'bondi' }));
    assert.deepEqual([cc.title, R.progress(cc).done, R.progress(cc).total], ['Joinery & Cabinetry', 4, 7]);
    assert.deepEqual([bon.title, R.progress(bon).done, R.progress(bon).total], ['Formwork & Pour', 2, 6]);
});

test('schedule views: upcoming milestone follows the checklist; next on site; stages between milestones', async () => {
    const env = await app.makeEnv();
    const R = app.ScheduleRules;
    let tasks = env.store.get('scheduleTasks').filter(t => t.siteId === 'lugarno');
    assert.equal(R.upcomingMilestone(tasks).title, 'Lock-Up Stage');
    assert.equal(R.nextOnSite(tasks, '2026-11-23').title, 'Sparky Rough-In');
    assert.deepEqual(Array.from(R.onDay(tasks, '2026-11-25'), t => t.title).sort(), ['Plumbing Rough-In', 'Roofing Metal', 'Sparky Rough-In', 'Window Delivery']);
    const stages = R.phases(tasks, '2026-08-24');
    assert.deepEqual(Array.from(stages, p => [p.title, p.start, p.end]), [
        ['Subfloor & Slab', '2026-08-24', '2026-09-25'], ['Wall & Roof Framing', '2026-09-26', '2026-11-20'],
        ['Lock-Up Stage', '2026-11-21', '2026-11-27'], ['Pre-Sheet & Insulation', '2026-11-28', '2026-12-11']]);
    // tick every open Lock-Up item: the upcoming milestone moves on, and progress is counted from the items
    const lockup = R.upcomingMilestone(tasks);
    for (const item of lockup.checklist.filter(x => !x.done)) await env.schedule.toggleItem(lockup.id, item.id);
    tasks = env.store.get('scheduleTasks').filter(t => t.siteId === 'lugarno');
    assert.equal(R.progress(tasks.find(t => t.id === lockup.id)).done, 10);
    assert.equal(R.upcomingMilestone(tasks).title, 'Pre-Sheet & Insulation');
    // ...but completed today, it stays upcoming until the day ends
    const doneDay = R.completedOn(tasks.find(t => t.id === lockup.id));
    assert.match(doneDay, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(R.upcomingMilestone(tasks, doneDay).title, 'Lock-Up Stage');
    assert.equal(R.upcomingMilestone(tasks, '2099-01-01').title, 'Pre-Sheet & Insulation');
    // every milestone complete: the last one stays upcoming
    assert.equal(R.upcomingMilestone([{ milestone: true, endDate: '2026-01-01', checklist: [{ done: true }] }]).endDate, '2026-01-01');
    assert.equal(R.upcomingMilestone([]), null);
});

test('schedule: the arrival window is saved and copied with a booking', async () => {
    const env = await app.makeEnv();
    const t = await env.schedule.saveTask({ siteId: 'lugarno', tradeId: 'delivery', title: 'Plasterboard Delivery', crew: 'Boral', arrival: ' 7:00 –  8:00 AM ', startDate: '2026-12-07' });
    assert.equal(t.arrival, '7:00 – 8:00 AM');
    const copy = await env.schedule.copyTask(t.id);
    assert.deepEqual([copy.arrival, copy.startDate], ['7:00 – 8:00 AM', '2026-12-14']);
});

test('schedule: book, edit, validate', async () => {
    const env = await app.makeEnv();
    const t = await env.schedule.saveTask({ siteId: 'lugarno', tradeId: 'plumbing', title: ' Fit-off  ', where: 'Units 1–4', startDate: '2026-10-19', endDate: '2026-10-21' });
    assert.deepEqual([t.title, t.where, t.milestone], ['Fit-off', 'Units 1–4', false]);
    const e = await env.schedule.saveTask({ ...t, endDate: '2026-10-23' });
    assert.equal(e.id, t.id);
    assert.equal(e.endDate, '2026-10-23');
    await assert.rejects(env.schedule.saveTask({ siteId: 'lugarno', tradeId: 'plumbing', title: 'X1', startDate: '2026-10-20', endDate: '2026-10-19' }), code('VALIDATION'));
    await assert.rejects(env.schedule.saveTask({ siteId: 'lugarno', tradeId: 'nope', title: 'Fit-off', startDate: '2026-10-20' }), code('VALIDATION'));
    await assert.rejects(env.schedule.saveTask({ siteId: 'miranda', tradeId: 'plumbing', title: 'Fit-off', startDate: '2026-10-20' }), code('VALIDATION'));
    assert.equal((await env.provider.audit.list({ entity: 'scheduleTasks', entityId: t.id })).length, 2);
});

test('milestones: a template checklist; ticks record who and when; notes, add, remove and undo', async () => {
    const env = await app.makeEnv();
    const m = await env.schedule.makeMilestone('lug-carp', 'frame');
    assert.equal(m.milestone, true);
    assert.equal(m.checklist.length, 7);
    const first = m.checklist[0];
    let t = await env.schedule.toggleItem(m.id, first.id);
    const ticked = t.checklist.find(x => x.id === first.id);
    assert.deepEqual([ticked.done, ticked.doneBy, ticked.doneByName], [true, 'team-1', 'Alexander Floratos']);
    assert.ok(ticked.doneAt);
    assert.equal(app.ScheduleRules.progress(t).done, 1);
    t = await env.schedule.toggleItem(m.id, first.id);
    assert.equal(t.checklist[0].done, false);
    t = await env.schedule.setItemNote(m.id, first.id, 'Cert ref ENG-2231');
    assert.equal(t.checklist[0].note, 'Cert ref ENG-2231');
    t = await env.schedule.addItem(m.id, 'Send truss photos to PM');
    const added = t.checklist[t.checklist.length - 1];
    assert.deepEqual([added.text, added.requestedBy], ['Send truss photos to PM', 'Alexander Floratos']);
    t = await env.schedule.removeItem(m.id, first.id);
    assert.equal(t.checklist.length, 7);
    t = await env.schedule.restoreItem(m.id, first, 0);
    assert.equal(t.checklist[0].id, first.id);
    // statuses
    const R = app.ScheduleRules;
    assert.equal(R.milestoneStatus({ ...t, startDate: '2026-10-15', endDate: '2026-10-17' }, '2026-10-14').key, 'risk');
    assert.equal(R.milestoneStatus({ ...t, startDate: '2026-10-25', endDate: '2026-10-25' }, '2026-10-14').key, 'track');
    assert.equal(R.milestoneStatus({ ...t, startDate: '2026-10-01', endDate: '2026-10-02' }, '2026-10-14').key, 'overdue');
    assert.equal(R.milestoneStatus({ ...t, checklist: t.checklist.map(x => ({ ...x, done: true })) }, '2026-10-14').key, 'ready');
    assert.equal(R.dueLabel({ startDate: '2026-10-16', endDate: '2026-10-16' }, '2026-10-14'), 'In 2 days');
    assert.equal(R.guessTemplate('Concrete Slab Pour Level 2'), 'slab');
});

test('copy +1 week, delete and undo', async () => {
    const env = await app.makeEnv();
    const m = await env.schedule.makeMilestone('bon-pour', 'slab');
    await env.schedule.toggleItem(m.id, m.checklist[0].id);
    const copy = await env.schedule.copyTask(m.id);
    assert.deepEqual([copy.startDate, copy.endDate], ['2026-12-09', '2026-12-09']);
    assert.ok(copy.checklist.every(x => !x.done));                         // a copy starts unticked
    assert.notEqual(copy.id, m.id);
    const removed = await env.schedule.deleteTask(m.id);
    assert.equal(env.store.get('scheduleTasks').some(t => t.id === m.id), false);
    await env.schedule.restoreTask(removed);
    const back = env.store.get('scheduleTasks').find(t => t.id === m.id);
    assert.equal(back.checklist[0].done, true);                            // exactly as it was
});

test('trades: supervisors edit the list; a trade in use cannot be removed', async () => {
    const env = await app.makeEnv();
    const trades = env.store.get('scheduleTrades');
    await assert.rejects(env.schedule.saveTrades(trades), code('PERMISSION_DENIED'));   // apprentice
    env.session.signInAs('team-8');
    await assert.rejects(env.schedule.saveTrades(trades.filter(t => t.id !== 'plumbing')), err => err.code === 'CONFLICT' && /Plumbing/.test(err.userMessage));
    const saved = await env.schedule.saveTrades([...trades.map(t => (t.id === 'plumbing' ? { ...t, name: 'Plumbing', color: '#2563eb' } : t)), { name: 'Landscaping', color: '#22D3A0' }]);
    assert.equal(saved.length, 13);
    assert.equal(env.store.get('scheduleTrades').find(t => t.id === 'plumbing').color, '#2563EB');
});
