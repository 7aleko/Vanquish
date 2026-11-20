/**
 * Application: the server-state cache. One authoritative copy of every collection the screens show, loaded
 * through the repositories. Screens read it synchronously through selectors (scripts/application/
 * selectors.js) and re-render when it changes; only services write to it, after the provider has accepted
 * the change (write-through - nothing shows as saved before it is).
 *
 * Records in the cache are frozen: a screen can't change server data by accident, it has to call a
 * service. UI state (selected date, open sheet, form drafts) never lives here - it stays in each screen.
 *
 * Strategy: load everything the app needs at start-up (the preloader covers it); after a write, the service
 * puts the saved record in the cache; refresh(collection) re-fetches one collection (pull-to-refresh, a
 * conflict, or a future realtime "changed" event from the backend).
 */

function createAppStore(loaders) {
    const collections = Object.keys(loaders);
    const data = {}, versions = {};
    collections.forEach(c => { data[c] = []; versions[c] = 0; });
    const state = { status: 'idle', error: null };
    const subscribers = [];
    const memos = {};
    let readyResolve, readyReject;
    const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
    ready.catch(() => {});      // a failed first load is reported through state, not as an unhandled rejection

    function deepFreeze(o) {
        if (o && typeof o === 'object' && !Object.isFrozen(o)) {
            Object.freeze(o);
            Object.values(o).forEach(deepFreeze);
        }
        return o;
    }
    function notify(changed) {
        const set = new Set(changed);
        subscribers.slice().forEach(s => {
            if (s.collections && !s.collections.some(c => set.has(c))) return;
            try { s.fn(set); } catch (err) { console.warn('Store subscriber error:', err); }
        });
    }
    function setCollection(c, rows) {
        data[c] = Object.freeze((rows || []).map(deepFreeze));
        versions[c]++;
    }

    async function load() {
        state.status = 'loading';
        state.error = null;
        notify(['$status']);
        try {
            const results = await Promise.all(collections.map(c => loaders[c]()));
            collections.forEach((c, i) => setCollection(c, results[i]));
            state.status = 'ready';
            notify([...collections, '$status']);
            readyResolve();
        } catch (err) {
            state.status = 'error';
            state.error = toAppError(err);
            notify(['$status']);
            readyReject(state.error);
            throw state.error;
        }
    }
    async function refresh(c) {
        const rows = await loaders[c]();
        setCollection(c, rows);
        notify([c]);
    }

    return {
        ready,
        load,
        refresh,
        get status() { return state.status; },
        get error() { return state.error; },
        get: c => data[c],
        version: c => versions[c],
        // Put a saved record into the cache (match on `key`), replacing any older copy
        upsert(c, record, key = 'id') {
            const rows = data[c].filter(r => r[key] !== record[key]);
            rows.push(record);
            setCollection(c, rows);
            notify([c]);
        },
        // Replace every record matching `match` with `rows` (e.g. one tool's allocation buckets after a move)
        replaceWhere(c, match, rows) {
            setCollection(c, data[c].filter(r => !match(r)).concat(rows || []));
            notify([c]);
        },
        remove(c, value, key = 'id') {
            setCollection(c, data[c].filter(r => r[key] !== value));
            notify([c]);
        },
        // fn(changedSet) after a change to any of `collections` (all when omitted). Returns unsubscribe.
        subscribe(fn, collectionsFilter) {
            const s = { fn, collections: collectionsFilter || null };
            subscribers.push(s);
            return () => { const i = subscribers.indexOf(s); if (i >= 0) subscribers.splice(i, 1); };
        },
        // A derived value recomputed only when one of its collections changed
        memo(name, deps, compute) {
            const key = deps.map(c => versions[c]).join('.');
            const m = memos[name];
            if (m && m.key === key) return m.value;
            const value = compute();
            memos[name] = { key, value };
            return value;
        }
    };
}
