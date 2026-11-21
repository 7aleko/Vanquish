// Site search: trade tags on logs and photos, finding every day a trade was on site, and re-tagging photos.
// The seeded site content is scripts/data/site-content.js; trades are the schedule's (whiteboard.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const code = c => err => err && err.code === c;
const lugarno = env => ({
    photos: env.store.get('sitePhotos').filter(p => p.siteId === 'lugarno'),
    logs: env.store.get('siteLogs').filter(l => l.siteId === 'lugarno'),
    drawings: env.store.get('drawings').filter(d => d.siteId === 'lugarno'),
    tasks: env.store.get('scheduleTasks').filter(t => t.siteId === 'lugarno'),
    trades: env.store.get('scheduleTrades')
});

test('seed: logs carry trade tags; photos are attached to their log and take its trades', async () => {
    const env = await app.makeEnv();
    const photos = env.store.get('sitePhotos').filter(p => p.siteId === 'lugarno');
    assert.equal(photos.length, 48);
    const logs = new Map(env.store.get('siteLogs').map(l => [l.id, l]));
    assert.ok(photos.every(p => logs.has(p.logId) && JSON.stringify(p.tradeIds) === JSON.stringify(logs.get(p.logId).tradeIds)));
    assert.ok(env.store.get('siteLogs').every(l => Array.isArray(l.tradeIds)));
});

test('search: a trade finds every day it was on site, its logs, photos, plans and bookings', async () => {
    const env = await app.makeEnv();
    const r = app.SiteSearchRules.search(lugarno(env), { tradeId: 'plumbing' });
    assert.deepEqual(Array.from(r.logs, l => l.date), ['2026-11-18', '2026-11-17', '2026-09-11']);
    assert.equal(r.photos.length, 7);
    assert.ok(r.photos.every(p => p.tradeIds.includes('plumbing')));
    assert.deepEqual(Array.from(r.plans, d => d.sheet), ['H101']);                       // Hydraulic
    assert.deepEqual(Array.from(r.days, t => t.title), ['Plumbing Rough-In (Ground)', 'Plumbing Rough-In', 'Gas & Hot Water Rough-In']);
});

test('search: words match loosely, including the bookings of a record\'s trades that day', async () => {
    const env = await app.makeEnv();
    const R = app.SiteSearchRules;
    // the 18 Nov pressure-test log doesn't say "rough-in", but the plumbing rough-in was booked that day
    const r = R.search(lugarno(env), { text: 'plumbing rough in' });
    assert.deepEqual(Array.from(r.logs, l => l.date), ['2026-11-18', '2026-11-17']);
    assert.ok(r.photos.length >= 6);
    assert.equal(R.search(lugarno(env), { text: 'ROUGH-IN plumbing' }).logs.length, 2);
    assert.equal(R.search(lugarno(env), { text: 'zzz' }).photos.length, 0);
    // text and trade together; nothing at all = everything (browse)
    assert.deepEqual(Array.from(R.search(lugarno(env), { text: 'pressure', tradeId: 'plumbing' }).logs, l => l.date), ['2026-11-18', '2026-09-11']);
    assert.equal(R.search(lugarno(env), {}).photos.length, 48);
});

test('tags: new logs and photos take trade tags; a photo can be re-tagged; unknown trades are refused', async () => {
    const env = await app.makeEnv();
    const src = 'data:image/jpeg;base64,AAAA';
    const log = await env.siteContent.addLog({ siteId: 'lugarno', date: '2026-11-23', title: 'Sparky first fix', tradeIds: ['electrical', 'electrical'], photos: [{ src }] });
    assert.deepEqual(Array.from(log.tradeIds), ['electrical']);
    const photo = env.store.get('sitePhotos').find(p => p.logId === log.id);
    assert.deepEqual(Array.from(photo.tradeIds), ['electrical']);
    const added = await env.siteContent.addPhotos({ siteId: 'lugarno', date: '2026-11-23', tradeIds: ['roofing'], photos: [{ src }] });
    assert.deepEqual(Array.from(added[0].tradeIds), ['roofing']);
    const re = await env.siteContent.setPhotoTrades(photo.id, ['electrical', 'plumbing']);
    assert.deepEqual(Array.from(re.tradeIds), ['electrical', 'plumbing']);
    assert.deepEqual(Array.from(env.store.get('sitePhotos').find(p => p.id === photo.id).tradeIds), ['electrical', 'plumbing']);
    await assert.rejects(env.siteContent.setPhotoTrades(photo.id, ['nope']), code('VALIDATION'));
    await assert.rejects(env.siteContent.addLog({ siteId: 'lugarno', date: '2026-11-23', title: 'Bad tags', tradeIds: ['nope'] }), code('VALIDATION'));
});
