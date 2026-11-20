// Equipment availability requests end to end over a fresh mock database: the Tools request, the site chat
// card's state, targeted notifications, first-answer-wins, the holder's ETA, expiry and the cooldown.
// Demo day: Wed 14 Oct 2026. Lugarno that day: Alexander Floratos (team-1, rostered), James Begg (team-31,
// crew + signed in), David Hilt (team-8, site supervisor, crew + signed in).
// The inventory starts all Available, so each test's fixtures put some of it to work first:
//   eq-001 Air Compressor -> Lugarno, In Use      eq-006 Drop Saw (Factory, Available)
//   eq-013 Jackhammer Makita (Bondi) -> In Use     eq-015 Table Saw (Factory) -> Service
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const code = c => err => err && err.code === c;
const at = (h, m = 0) => new Date(2026, 9, 14, h, m);
const baseEnv = app.makeEnv;
app.makeEnv = async opts => {
    const env = await baseEnv(opts);
    await env.provider.equipment.update('eq-001', { siteId: 'lugarno', status: 'In Use' });
    await env.provider.equipment.update('eq-013', { status: 'In Use' });
    await env.provider.equipment.update('eq-015', { status: 'Service' });
    await env.store.refresh('equipment');
    return env;
};
const notesFor = async (env, employeeId) => env.provider.notifications.list({ recipientId: employeeId });

test('request: goes to the tool\'s site chat, notifies that site only, never the requester', async () => {
    const env = await app.makeEnv();
    const out = await env.availability.request({ toolId: 'eq-001', note: '  Needed for   Level 2 framing ', idempotencyKey: 'k1' });
    const r = out.request;
    assert.equal(r.status, 'pending');
    assert.equal(r.siteId, 'lugarno');
    assert.equal(r.chatId, 'chat-lugarno');
    assert.equal(r.requesterId, 'team-1');
    assert.equal(r.requesterNote, 'Needed for Level 2 framing');
    assert.equal(Date.parse(r.expiresAt) - Date.parse(r.createdAt), 30 * 60 * 1000);
    // the chat message points at the request and carries no copy of its status
    assert.equal(out.message.type, 'availability_request');
    assert.equal(out.message.requestId, r.id);
    assert.equal(out.message.status, undefined);
    assert.ok(env.store.get('chatMessages').some(m => m.id === r.messageId));
    // site members (rostered or signed in), once each; not the requester, not other sites
    const all = await env.provider.notifications.list();
    assert.deepEqual(all.map(n => n.recipientId).sort(), ['team-31', 'team-8']);
    assert.equal(all[0].body, 'Alexander Floratos is checking availability for Air Compressor on Lugarno.');
    assert.deepEqual([all[0].chatId, all[0].messageId, all[0].requestId], [r.chatId, r.messageId, r.id]);
    assert.equal(out.notified, 2);
    assert.equal((await env.provider.audit.list({ entity: 'availabilityRequests', entityId: r.id }))[0].action, 'request_availability');
});

test('request: one active request per tool; a retried submit replays instead of duplicating', async () => {
    const env = await app.makeEnv();
    const first = await env.availability.request({ toolId: 'eq-001', idempotencyKey: 'tap-1' });
    const again = await env.availability.request({ toolId: 'eq-001', idempotencyKey: 'tap-1' });
    assert.equal(again.replayed, true);
    assert.equal(again.request.id, first.request.id);
    await assert.rejects(env.availability.request({ toolId: 'eq-001', idempotencyKey: 'tap-2' }), code('CONFLICT'));
    env.session.signInAs('team-21');                                  // someone else, same tool: still one
    await assert.rejects(env.availability.request({ toolId: 'eq-001' }), code('CONFLICT'));
    assert.equal((await env.provider.availability.listRequests({ toolId: 'eq-001' })).length, 1);
    assert.equal((await env.provider.notifications.list()).length, 2);   // no second round of notifications
});

test('request: the cooldown is held by the database, not the screen (a reload / new cache cannot bypass it)', async () => {
    const env = await app.makeEnv();
    await env.availability.request({ toolId: 'eq-001' });
    await env.store.load();                                           // a fresh cache, as after a reload
    await assert.rejects(env.provider.availability.createRequest({ toolId: 'eq-001', requesterId: 'team-1' }), code('CONFLICT'));
    await assert.rejects(env.availability.request({ toolId: 'eq-001' }), code('CONFLICT'));
});

test('request: refused for available or in-service tools, sites without a chat, and inactive sites', async () => {
    const env = await app.makeEnv();
    await assert.rejects(env.availability.request({ toolId: 'eq-006' }), code('CONFLICT'));        // Available (Factory)
    await assert.rejects(env.availability.request({ toolId: 'eq-015' }), code('CONFLICT'));        // Service
    // an in-use tool at a site with no group chat
    env.session.signInAs('team-21');
    await env.equipment.register({ name: 'Festool Track Saw', category: 'power tools', siteId: 'castlecrag' });
    const saw = env.store.get('equipment').find(t => t.name === 'Festool Track Saw');
    await env.provider.equipment.update(saw.id, { status: 'In Use' });
    await assert.rejects(env.availability.request({ toolId: saw.id }), err => err.code === 'VALIDATION' && /no site group chat/.test(err.userMessage));
    // an archived site
    await env.sites.archive('bondi');
    await assert.rejects(env.availability.request({ toolId: 'eq-013' }), err => err.code === 'VALIDATION' && /active site/.test(err.userMessage));
    await assert.rejects(env.availability.request({ toolId: 'eq-001', note: 'x'.repeat(201) }), code('VALIDATION'));
});

test('respond: available now resolves it, frees the tool and tells the requester', async () => {
    const env = await app.makeEnv();
    const { request } = await env.availability.request({ toolId: 'eq-001' });
    env.session.signInAs('team-31');                                  // James Begg, on site
    env.setNow(at(10, 6));
    const out = await env.availability.respond({ requestId: request.id, response: 'available' });
    assert.equal(out.request.status, 'available');
    assert.equal(out.request.responderId, 'team-31');
    assert.equal(env.store.get('equipment').find(t => t.id === 'eq-001').status, 'Available');
    const mine = await notesFor(env, 'team-1');
    assert.equal(mine.length, 1);
    assert.equal(mine[0].body, 'James confirmed Air Compressor is available now at Lugarno.');
    // resolved: the tool can be asked about again later (it is now Available, so that is refused for that reason)
    env.session.signInAs('team-1');
    await assert.rejects(env.availability.request({ toolId: 'eq-001' }), err => /already available/.test(err.userMessage));
});

test('respond: the first answer wins; later answers from others are rejected by the database', async () => {
    const env = await app.makeEnv();
    const { request } = await env.availability.request({ toolId: 'eq-001' });
    env.session.signInAs('team-31');
    const a = env.availability.respond({ requestId: request.id, response: 'in_use', eta: { preset: '1h' } });
    env.session.signInAs('team-8');                                   // David answers at the same moment...
    // ...the session switch above affects only calls started after it, so start his directly with his id
    const b = env.provider.transaction(repos => repos.availability.respond(request.id, { responderId: 'team-8', responseType: 'available' }));
    const results = await Promise.allSettled([a, b]);
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(results.filter(x => x.status === 'rejected' && x.reason.code === 'CONFLICT').length, 1);
    const saved = await env.provider.availability.getRequest(request.id);
    assert.equal(saved.status, 'in_use');
    assert.equal(saved.holderId, 'team-31');
    // a site member who is not the holder can't change it
    env.session.signInAs('team-1');
    await env.provider.roster.assign({ date: '2026-10-14', employeeId: 'team-4', siteId: 'lugarno' });   // Caleb, apprentice
    await env.store.refresh('roster');
    env.session.signInAs('team-4');
    await assert.rejects(env.availability.respond({ requestId: request.id, response: 'available' }), code('CONFLICT'));
    await assert.rejects(env.availability.updateEta({ requestId: request.id, eta: { preset: '2h' } }), code('CONFLICT'));
});

test('respond: only the site\'s crew may answer; never your own request; supervisors can override', async () => {
    const env = await app.makeEnv();
    const { request } = await env.availability.request({ toolId: 'eq-001' });
    await assert.rejects(env.availability.respond({ requestId: request.id, response: 'available' }), code('PERMISSION_DENIED'));   // own
    env.session.signInAs('team-25');                                  // Scott Mackenzie: not at Lugarno today
    await assert.rejects(env.availability.respond({ requestId: request.id, response: 'available' }),
        err => err.code === 'PERMISSION_DENIED' && /Lugarno crew/.test(err.userMessage));
    env.session.signInAs('team-31');
    await env.availability.respond({ requestId: request.id, response: 'in_use', eta: { preset: '30m' } });
    env.session.signInAs('team-2');                                   // Brad Davis, a supervisor elsewhere: override
    const out = await env.availability.respond({ requestId: request.id, response: 'available' });
    assert.equal(out.request.status, 'available');
    assert.equal(out.request.responderId, 'team-2');
});

test('ETA: worked out by the server; the holder can move it; the same time again notifies nobody', async () => {
    const env = await app.makeEnv({ now: at(13, 40) });
    const { request } = await env.availability.request({ toolId: 'eq-001' });
    env.session.signInAs('team-31');
    env.setNow(at(13, 48));
    const first = await env.availability.respond({ requestId: request.id, response: 'in_use', eta: { preset: '2h' } });
    assert.equal(new Date(first.request.estimatedAvailableAt).getHours(), 15);
    assert.equal(new Date(first.request.estimatedAvailableAt).getMinutes(), 48);
    let mine = await notesFor(env, 'team-1');
    assert.equal(mine[0].body, 'James expects Air Compressor to be available at 3:48 PM.');

    await assert.rejects(env.availability.updateEta({ requestId: request.id, eta: { preset: 'custom', time: '09:00' } }), code('VALIDATION'));   // past
    const moved = await env.availability.updateEta({ requestId: request.id, eta: { preset: 'custom', time: '15:15' } });
    assert.equal(AvailabilityRulesClock(moved.request.estimatedAvailableAt), '3:15 PM');
    const same = await env.availability.updateEta({ requestId: request.id, eta: { preset: 'custom', time: '15:15' } });
    assert.equal(same.unchanged, true);
    mine = await notesFor(env, 'team-1');
    assert.equal(mine.length, 2);
    assert.ok(mine.some(n => n.body === 'James updated the Air Compressor availability time to 3:15 PM.'));
    const history = await env.provider.availability.listResponses({ requestId: request.id });
    assert.deepEqual(history.map(h => h.responseType), ['in_use', 'eta_updated']);
    assert.equal(AvailabilityRulesClock(history[1].previousEstimatedAvailableAt), '3:48 PM');
    // End of shift (3:30 PM) once it has passed
    env.setNow(at(16, 0));
    await assert.rejects(env.availability.updateEta({ requestId: request.id, eta: { preset: 'end_of_shift' } }), err => /shift has already finished/.test(err.userMessage));
});
function AvailabilityRulesClock(iso) { return app.AvailabilityRules.clock(iso); }

test('missing: flags the tool, resolves the request, tells the requester and alerts the supervisor', async () => {
    const env = await app.makeEnv();
    const { request } = await env.availability.request({ toolId: 'eq-001' });
    env.session.signInAs('team-31');
    const out = await env.availability.respond({ requestId: request.id, response: 'missing' });
    assert.equal(out.request.status, 'missing');
    const tool = env.store.get('equipment').find(t => t.id === 'eq-001');
    assert.equal(tool.missingReportedBy, 'team-31');
    assert.ok(tool.missingReportedAt);
    assert.equal((await notesFor(env, 'team-1'))[0].body,
        'James reported that Air Compressor is not at Lugarno. The site supervisor has been notified.');
    const alert = (await notesFor(env, 'team-8')).find(n => n.type === 'availability_missing_alert');
    assert.ok(alert, 'David Hilt (Lugarno supervisor) is alerted');
    // resolved: a new request is allowed straight away
    env.session.signInAs('team-1');
    const again = await env.availability.request({ toolId: 'eq-001' });
    assert.notEqual(again.request.id, request.id);
});

test('expiry: unanswered for 30 minutes -> expired, the card can\'t be answered, and the tool can be asked again', async () => {
    const env = await app.makeEnv();
    const { request } = await env.availability.request({ toolId: 'eq-001' });
    env.setNow(at(10, 29));
    assert.equal((await env.availability.sweepExpired()).length, 0);
    await assert.rejects(env.availability.request({ toolId: 'eq-001' }), code('CONFLICT'));
    env.setNow(at(10, 31));
    const expired = await env.availability.sweepExpired();
    assert.equal(expired.length, 1);
    assert.equal(env.store.get('availabilityRequests').find(r => r.id === request.id).status, 'expired');
    env.session.signInAs('team-31');
    await assert.rejects(env.availability.respond({ requestId: request.id, response: 'available' }), code('CONFLICT'));
    env.session.signInAs('team-1');
    assert.ok((await env.availability.request({ toolId: 'eq-001' })).request.id);
});

test('notifications: deduplicated per recipient, private to their recipient', async () => {
    const env = await app.makeEnv();
    const row = { recipientId: 'team-31', type: 'availability_request', title: 't', body: 'b', dedupeKey: 'x:request' };
    assert.equal((await env.provider.notifications.createMany([row, row])).length, 1);
    const [n] = await env.provider.notifications.list({ recipientId: 'team-31' });
    await assert.rejects(env.provider.notifications.markRead(n.id, 'team-1'), code('PERMISSION_DENIED'));
    assert.ok((await env.provider.notifications.markRead(n.id, 'team-31')).readAt);
    // a failed delivery doesn't undo the request
    env.provider.debug.failNext('notifications.createMany', 2);
    const out = await env.availability.request({ toolId: 'eq-013' });
    assert.equal(out.request.status, 'pending');
    assert.equal(out.notified, 0);
});

test('site membership: rostered or signed in, active, once; on-leave and other sites excluded', () => {
    const { AvailabilityRules } = app;
    const employees = [
        { id: 'a', status: 'Active', active: true }, { id: 'b', status: 'Active', active: true },
        { id: 'c', status: 'On Leave', active: true }, { id: 'd', status: 'Active', active: false }, { id: 'e', status: 'Active', active: true }
    ];
    const roster = [{ date: '2026-10-14', siteId: 's1', employeeId: 'a' }, { date: '2026-10-14', siteId: 's1', employeeId: 'c' },
        { date: '2026-10-14', siteId: 's2', employeeId: 'e' }, { date: '2026-10-13', siteId: 's1', employeeId: 'e' }];
    const attendance = [{ date: '2026-10-14', siteId: 's1', employeeId: 'a', signedOutAt: null },
        { date: '2026-10-14', siteId: 's1', employeeId: 'b', signedOutAt: null }, { date: '2026-10-14', siteId: 's1', employeeId: 'd', signedOutAt: null }];
    const ids = AvailabilityRules.siteMemberIds({ roster, attendance, employees, siteId: 's1', date: '2026-10-14' });
    assert.deepEqual([...ids].sort(), ['a', 'b']);
    assert.deepEqual([...AvailabilityRules.requestRecipients(ids, 'a')], ['b']);
    assert.equal(AvailabilityRules.assetTag('tool-24'), 'TOOL-024');
});

test('grouped: ask about some of the units in use at one site; "available now" moves just those', async () => {
    const env = await app.makeEnv();
    env.session.signInAs('team-21');                                  // Luke moves 3 wheelbarrows to Lugarno (in use there)
    const wb = env.store.get('equipment').find(t => t.name === 'Wheelbarrow');
    await env.equipment.transferUnits({ toolId: wb.id, fromSiteId: 'factory', toSiteId: 'lugarno', quantity: 3 });
    env.session.signInAs('team-1');
    await assert.rejects(env.availability.request({ toolId: wb.id, siteId: 'lugarno', quantity: 4 }), code('VALIDATION'));     // only 3 there
    await assert.rejects(env.availability.request({ toolId: wb.id, siteId: 'bondi', quantity: 1 }), code('CONFLICT'));         // none in use at Bondi
    const { request } = await env.availability.request({ toolId: wb.id, siteId: 'lugarno', quantity: 2, note: 'Slab pour' });
    assert.deepEqual([request.siteId, request.chatId, request.quantity], ['lugarno', 'chat-lugarno', 2]);
    assert.equal((await env.provider.notifications.list({ recipientId: 'team-31' }))[0].body,
        'Alexander Floratos is checking availability for 2 × Wheelbarrow on Lugarno.');
    await assert.rejects(env.availability.request({ toolId: wb.id, siteId: 'lugarno', quantity: 1 }), code('CONFLICT'));        // one active per site
    env.session.signInAs('team-31');
    await env.availability.respond({ requestId: request.id, response: 'available' });
    const buckets = env.store.get('equipmentAllocations').filter(a => a.toolId === wb.id).map(a => `${a.siteId}|${a.status}|${a.quantity}`).sort();
    assert.deepEqual(buckets, ['lugarno|Available|2', 'lugarno|In Use|1']);
    assert.equal((await env.provider.notifications.list({ recipientId: 'team-1' }))[0].body,
        'James confirmed 2 × Wheelbarrow is available now at Lugarno.');
});
