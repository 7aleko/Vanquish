/**
 * Domain rules: searching one site's records - photos, site logs, plans (drawings) and the days trades were
 * booked on site. Pure: the caller passes the site's records and the schedule's trades.
 *
 *   SiteSearchRules.search(data, { text, tradeId })
 *       data   { photos, logs, drawings, tasks, trades: [{ id, name }] }
 *       -> { photos, logs, plans, days, tokens }   photos and logs newest first, plans by sheet, days in date order
 *
 * A record matches when every word of `text` is in it, and (with `tradeId`) it's tagged with that trade. Words
 * are matched loosely: case, hyphens and punctuation don't count ("rough in" finds "Rough-In"). A photo or log
 * also answers to its trades' names and to the bookings of those trades on site that day, so "plumbing rough
 * in" finds the day's plumbing log and photos even when they don't say "rough-in" themselves. With no text and
 * no trade, everything comes back (the search page's browse state).
 *
 * Domain layer rule: no DOM, no storage, no provider. Dates are 'YYYY-MM-DD'.
 */
const SiteSearchRules = (() => {
    const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[-–—_/.,:;()'’"]+/g, ' ').replace(/\s+/g, ' ').trim();
    // Drawings are filed by discipline, not trade: the trade words each discipline answers to
    const DISCIPLINE_WORDS = Object.freeze({
        Hydraulic: 'plumbing drainage water gas', Electrical: 'electrical lighting power data',
        Structural: 'concrete steel formwork framing carpentry', Civil: 'drainage stormwater excavation'
    });
    function tokens(text) { return norm(text).split(' ').filter(Boolean); }
    function hits(haystack, toks) { const h = ` ${norm(haystack)} `; return toks.every(t => h.includes(t)); }

    function search(data, { text = '', tradeId = null } = {}) {
        const toks = tokens(text);
        const trades = new Map((data.trades || []).map(t => [t.id, t.name]));
        const tasks = (data.tasks || []).filter(t => !t.milestone);
        const tradeNames = ids => (ids || []).map(id => trades.get(id) || '').join(' ');
        // The bookings of a record's trades on its day: "Plumbing Rough-In (Ground)" for a plumbing log on 18 Nov
        const bookedFor = (ids, date) => tasks.filter(t => (ids || []).includes(t.tradeId) && t.startDate <= date && t.endDate >= date)
            .map(t => `${t.title} ${t.crew || ''}`).join(' ');
        const tagged = ids => !tradeId || (ids || []).includes(tradeId);
        const newest = (a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : (a.date < b.date ? 1 : -1));

        const logs = (data.logs || []).filter(l => tagged(l.tradeIds)
            && (!toks.length || hits([l.title, l.body, l.authorName, tradeNames(l.tradeIds), bookedFor(l.tradeIds, l.date)].join(' '), toks)))
            .slice().sort(newest);
        const logById = new Map((data.logs || []).map(l => [l.id, l]));
        const photos = (data.photos || []).filter(p => tagged(p.tradeIds)
            && (!toks.length || hits([p.caption, p.tag, tradeNames(p.tradeIds), bookedFor(p.tradeIds, p.date), (logById.get(p.logId) || {}).body].join(' '), toks)))
            .slice().sort(newest);
        // Plans have no trade tags: with a trade chosen they answer to its name or discipline (Plumbing -> Hydraulic)
        const tradeWord = tradeId ? tokens(trades.get(tradeId) || '') : [];
        const plans = (data.drawings || []).filter(d => {
            const hay = [d.sheet, d.title, d.discipline, DISCIPLINE_WORDS[d.discipline] || '', `rev ${d.revision}`, 'plan drawing pdf'].join(' ');
            return (!toks.length || hits(hay, toks)) && (!tradeWord.length || tradeWord.some(w => norm(hay).includes(w)));
        }).slice().sort((a, b) => a.sheet.localeCompare(b.sheet));
        const days = tasks.filter(t => (!tradeId || t.tradeId === tradeId)
            && (!toks.length || hits([t.title, t.crew, t.where, t.notes, trades.get(t.tradeId)].join(' '), toks)))
            .slice().sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
        return { photos, logs, plans, days, tokens: toks };
    }

    return Object.freeze({ search, tokens, norm });
})();
