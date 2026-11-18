/**
 * Site Hub (the Site screen, styles/site-hub.css): everything about one construction site, for one active site.
 *
 *   Top bar     back and Sync (the shared top bar); the large title "Site"
 *   Hero        site name and address (a button: the searchable site picker, openSiteSwitcher), a Mon-Fri day switcher, the rostered crew for the chosen day and its
 *               attendance; tapping it opens the Site Crew sheet (openCrewSheetFor, crew-status-sheet.js)
 *   Search      a full-height overlay over the site's photos, logs, drawings and schedule (openSiteSearch)
 *   Site Logs   latest daily logs; Add Log writes through siteContentService (with photos)
 *   Drawings    the drawing register, newest revision first
 *   Schedule    upcoming Trade Schedule entries; Full Schedule opens the Trade Schedule on this site
 *
 * One active-site context: siteHubState.siteId (any active SITES id). Every section and every search reads through it,
 * via the selectors (getSiteLogs, getDrawings, getSitePhotos, getCrewStatus, ...) - nothing keeps its own
 * copy of a site, a crew list or a record. The chosen day (siteHubState.day) drives the crew and attendance.
 * "Today" is the app's today (homeAttendanceDay, the same day the Home card uses).
 *
 * The picker lists every active site (SITES), the employee's own sites first ("Your Sites": the active sites of
 * their jobs, JOBS_DATA, and their roster), then the rest; an archived site drops out. Picking a site also connects its Procore project (connectProjectForSite, sheets.js), and the
 * Procore project picker drives the hub back through selectSite.
 */

const siteHubState = { siteId: null, day: null };
const SITE_HUB_PREVIEW_ROWS = 4;
const SITE_HUB_AVATARS = 5;
const SH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SH_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shToday() { return homeAttendanceDay(); }
function shTodayIso() { return DateRules.toIso(shToday()); }
// "14 Oct" / "Wed 14 Oct" from 'YYYY-MM-DD' or a Date
function shDate(d, withDay = false) {
    const x = typeof d === 'string' ? DateRules.fromIso(d) : d;
    return `${withDay ? SH_DAYS[x.getDay()] + ' ' : ''}${x.getDate()} ${SH_MONTHS[x.getMonth()]}`;
}
// "James Begg" -> "James B."
function shShortName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : (parts[0] || '');
}

// ---------- Active site and day ----------
// The employee's own sites: the active sites of their jobs (JOBS_DATA) and of their roster, today's rostered first
function getSiteHubSites() {
    const ids = [];
    const add = id => { if (id && isSiteActive(id) && !ids.includes(id)) ids.push(id); };
    (typeof JOBS_DATA === 'undefined' ? [] : JOBS_DATA).forEach(j => add(j.siteId));
    appStore.get('roster').filter(r => r.employeeId === getCurrentEmployeeId()).forEach(r => add(r.siteId));
    const rostered = getRosteredSiteId(shToday());
    return ids.map(getSiteById).filter(Boolean)
        .sort((a, b) => (a.id === rostered ? -1 : b.id === rostered ? 1 : a.shortName.localeCompare(b.shortName)));
}
// A weekday: today, or the coming Monday at a weekend
function shDefaultDay() {
    const t = shToday(), dow = t.getDay();
    return dow === 0 ? DateRules.addDays(t, 1) : dow === 6 ? DateRules.addDays(t, 2) : t;
}
function ensureSiteHubState() {
    if (!isSiteActive(siteHubState.siteId)) {
        const mine = getSiteHubSites(), all = getActiveSites();
        const rostered = getRosteredSiteId(shToday());
        siteHubState.siteId = isSiteActive(rostered) ? rostered : ((mine[0] || all[0] || {}).id || null);
    }
    if (!siteHubState.day) siteHubState.day = shDefaultDay();
    return siteHubState.siteId;
}

// Switch the active site (the switcher, or the Procore project picker with { fromProject: true })
function selectSite(siteId, options = {}) {
    if (!isSiteActive(siteId)) return;
    if (!options.silent) triggerHaptic('light');
    const changed = siteId !== siteHubState.siteId;
    siteHubState.siteId = siteId;
    if (!options.fromProject) {
        if (typeof connectProjectForSite === 'function') connectProjectForSite(siteId);
        if (typeof renderHomeNavList === 'function') renderHomeNavList();
    }
    closeSiteSwitcher();
    renderSiteHub();
    if (changed) {
        const view = document.getElementById('view-sitehub');
        if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (siteSearch.open) renderSiteSearch();
}

function selectSiteHubDay(iso, e) {
    if (e) e.stopPropagation();                        // a day changes the day; it doesn't open the crew sheet
    if (iso === DateRules.toIso(siteHubState.day)) return;
    triggerHaptic('light');
    siteHubState.day = DateRules.fromIso(iso);
    renderSiteHubHero();
}

// Opening Site afresh: back on the default day (the active site is kept)
function resetSiteHubView() {
    siteHubState.day = shDefaultDay();
    renderSiteHub();
}

// ---------- Render ----------
function renderSiteHub() {
    if (!document.getElementById('view-sitehub')) return;
    const siteId = ensureSiteHubState();
    const btn = document.getElementById('sh-site-btn');
    if (btn) btn.setAttribute('aria-label', siteId ? `Site: ${getSiteName(siteId)}, ${getSiteAddress(siteId)}. Change site` : 'Choose a site');
    renderSiteHubHero();
    renderSiteHubLogs();
    renderSiteHubDrawings();
    renderSiteHubSchedule();
}

function renderSiteHubHero() {
    const siteId = siteHubState.siteId;
    const hero = document.getElementById('sh-hero');
    if (!hero) return;
    document.getElementById('sh-site-name').textContent = siteId ? getSiteName(siteId) : 'No site';
    document.getElementById('sh-site-address').textContent = siteId ? getSiteAddress(siteId) : 'You have no active sites';

    // Mon-Fri of the chosen day's week
    const day = siteHubState.day, monday = DateRules.mondayOf(day), selIso = DateRules.toIso(day), todayIso = shTodayIso();
    const days = [0, 1, 2, 3, 4].map(i => DateRules.addDays(monday, i));
    const sel = days.findIndex(d => DateRules.toIso(d) === selIso);
    const strip = document.getElementById('sh-days');
    strip.style.setProperty('--sel', String(Math.max(0, sel)));
    strip.innerHTML = `<span class="sh-day-pill" aria-hidden="true"></span>` + days.map(d => {
        const iso = DateRules.toIso(d), on = iso === selIso;
        return `<button type="button" role="tab" class="sh-day${on ? ' is-selected' : ''}${iso === todayIso ? ' is-today' : ''}" aria-selected="${on}"
                    aria-label="${d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}${iso === todayIso ? ', today' : ''}"
                    onclick="selectSiteHubDay('${iso}', event)" onkeydown="event.stopPropagation()">
                <span class="sh-day-name">${SH_DAYS[d.getDay()]}</span><span class="sh-day-num">${d.getDate()}</span>
            </button>`;
    }).join('');

    // Crew rostered that day, and their attendance
    const stack = document.getElementById('sh-crew-stack'), pill = document.getElementById('sh-crew-pill');
    if (!siteId) { stack.innerHTML = ''; pill.textContent = ''; return; }
    const status = getCrewStatus(siteId, day), people = [...status.onSite, ...status.off];
    const shown = people.slice(0, SITE_HUB_AVATARS), extra = people.length - shown.length;
    stack.innerHTML = shown.length
        ? shown.map(p => renderRoleAvatar(p.name, 'head')).join('') + (extra > 0 ? `<span class="sh-crew-more">+${extra}</span>` : '')
        : '<span class="sh-crew-none">No crew rostered</span>';
    const head = crewHeadline(siteId, day, status);
    pill.hidden = !people.length;
    pill.className = `sh-crew-pill${head.live ? ' is-live' : ''}`;
    pill.innerHTML = (head.live ? '<span class="sh-live-dot" aria-hidden="true"></span>' : '') + `<span>${head.text}</span>`;
    hero.setAttribute('aria-label', `${getSiteName(siteId)}, ${getSiteAddress(siteId)}. ${shDate(day, true)}: ${head.label}. Open site crew.`);
}

function renderSiteHubLogs() {
    const el = document.getElementById('sh-logs');
    const siteId = siteHubState.siteId;
    const logs = siteId ? getSiteLogs(siteId) : [];
    if (!logs.length) {
        el.innerHTML = `<div class="sh-empty"><i class="ph-fill ph-clipboard-text" aria-hidden="true"></i><span>No site logs yet.</span>
            <button type="button" class="sh-empty-action" onclick="openAddSiteLog()">Add the first log</button></div>`;
        return;
    }
    el.innerHTML = logs.slice(0, SITE_HUB_PREVIEW_ROWS).map(l => renderLogRow(l)).join('');
}
function renderLogRow(l, tokens) {
    const photos = getLogPhotos(l.id).length;
    return `<button type="button" class="sh-row" onclick="openSiteLog('${shEsc(l.id)}')">
            <span class="sh-row-date"><b>${new Date(DateRules.fromIso(l.date)).getDate()}</b>${SH_MONTHS[DateRules.fromIso(l.date).getMonth()]}</span>
            <span class="sh-row-main">
                <span class="sh-row-title">${shMark(l.title, tokens)}</span>
                ${tokens && tokens.length && !shMatches(l.title, tokens) && l.body ? `<span class="sh-row-snippet">${shSnippet(l.body, tokens)}</span>` : ''}
                <span class="sh-row-meta">By ${shMark(shShortName(l.authorName), tokens)}${photos ? ` · <i class="ph-fill ph-image" aria-hidden="true"></i> ${photos}` : ''}</span>
            </span>
            <i class="ph-bold ph-caret-right sh-row-chev" aria-hidden="true"></i>
        </button>`;
}

function renderSiteHubDrawings() {
    const el = document.getElementById('sh-drawings');
    const siteId = siteHubState.siteId;
    const dwgs = siteId ? getDrawings(siteId) : [];
    document.getElementById('sh-dwg-all').hidden = dwgs.length <= SITE_HUB_PREVIEW_ROWS;
    el.innerHTML = dwgs.length
        ? dwgs.slice(0, SITE_HUB_PREVIEW_ROWS).map(d => renderDrawingRow(d)).join('')
        : `<div class="sh-empty"><i class="ph-fill ph-file-pdf" aria-hidden="true"></i><span>No drawings for this site yet.</span></div>`;
}
function renderDrawingRow(d, tokens) {
    return `<button type="button" class="sh-row" onclick="openSiteDrawing('${shEsc(d.id)}')">
            <span class="sh-row-icon is-pdf"><i class="ph-fill ph-file-pdf" aria-hidden="true"></i></span>
            <span class="sh-row-main">
                <span class="sh-row-title">${shMark(d.sheet, tokens)} — ${shMark(d.title, tokens)}</span>
                <span class="sh-row-meta"><span class="sh-rev">Rev ${shMark(d.revision, tokens)}</span> Updated ${shDate(d.updatedOn)}</span>
            </span>
            <i class="ph-bold ph-caret-right sh-row-chev" aria-hidden="true"></i>
        </button>`;
}

// ---------- Schedule (the Trade Schedule's tasks for this site) ----------
function getSiteScheduleTasks(siteId) {
    if (typeof whiteboardTradeTasks === 'undefined' || !siteId) return [];
    return whiteboardTradeTasks.filter(t => t.siteId === siteId).slice().sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}
function shTaskDates(t) {
    return t.startDate === t.endDate ? shDate(t.startDate, true) : `${shDate(t.startDate, true)} – ${shDate(t.endDate, true)}`;
}
function shTaskStatus(t) {
    const today = shTodayIso();
    if (t.endDate < today) return { cls: 'is-done', text: 'Done' };
    if (t.startDate <= today) return { cls: 'is-now', text: 'On site' };
    return { cls: 'is-next', text: 'Upcoming' };
}
function shTradeTheme(t) { return (typeof WHITEBOARD_TRADE_THEMES !== 'undefined' && WHITEBOARD_TRADE_THEMES[t.trade]) || { name: t.trade, icon: 'fa-helmet-safety' }; }
function renderSiteHubSchedule() {
    const el = document.getElementById('sh-schedule');
    const today = shTodayIso();
    const tasks = getSiteScheduleTasks(siteHubState.siteId).filter(t => t.endDate >= today);
    el.innerHTML = tasks.length
        ? tasks.slice(0, SITE_HUB_PREVIEW_ROWS).map(t => renderScheduleRow(t)).join('')
        : `<div class="sh-empty"><i class="ph-fill ph-calendar-blank" aria-hidden="true"></i><span>Nothing scheduled at this site.</span></div>`;
}
function renderScheduleRow(t, tokens) {
    const st = shTaskStatus(t), theme = shTradeTheme(t);
    return `<button type="button" class="sh-row" onclick="openTradeDetailModal('${shEsc(t.id)}')">
            <span class="sh-row-icon"><i class="fa-solid ${shEsc(theme.icon)}" aria-hidden="true"></i></span>
            <span class="sh-row-main">
                <span class="sh-row-title">${shMark(t.title, tokens)}</span>
                <span class="sh-row-meta">${shTaskDates(t)} · ${shMark(t.crew, tokens)}</span>
            </span>
            <span class="sh-status ${st.cls}">${st.text}</span>
        </button>`;
}
function openSiteHubSchedule() {
    triggerHaptic('light');
    openScheduleForSite(siteHubState.siteId, shTodayIso());
}

function openSiteHubCrew() {
    if (siteHubState.siteId) openCrewSheetFor(siteHubState.siteId, siteHubState.day);
}

// ---------- Site picker (bottom sheet, opened from the hero's site name) ----------
let siteSwitcherOpen = false;
function openSiteSwitcher(e) {
    if (e) e.stopPropagation();                        // the name picks a site; the rest of the hero opens the crew
    const overlay = document.getElementById('sh-switch-overlay');
    if (!overlay || siteSwitcherOpen) return;
    triggerHaptic('light');
    clearSiteSwitcherSearch(true);
    overlay.hidden = false;
    siteSwitcherOpen = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (siteSwitcherOpen) overlay.classList.add('is-open'); }));
    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = true;
    document.getElementById('sh-switch-sheet').focus({ preventScroll: true });
}
// Every active site, filtered by the search (name, street, suburb): "Your Sites" first, then "All Sites"
function renderSiteSwitcherList() {
    const input = document.getElementById('sh-switch-input');
    const tokens = shTokens(input ? input.value : '');
    document.getElementById('sh-switch-clear').classList.toggle('hidden', !tokens.length);
    const hit = s => !tokens.length || shMatches([s.shortName, s.address, s.suburb].join(' '), tokens);
    const mine = getSiteHubSites(), mineIds = mine.map(s => s.id);
    const others = getActiveSites().filter(s => !mineIds.includes(s.id)).slice().sort((a, b) => a.shortName.localeCompare(b.shortName));
    const row = s => {
        const on = s.id === siteHubState.siteId;
        return `<button type="button" role="option" aria-selected="${on}" class="sh-switch-row${on ? ' is-selected' : ''}" onclick="selectSite('${shEsc(s.id)}')">
                <span class="sh-switch-row-main"><span class="sh-switch-row-name">${shMark(s.shortName, tokens)}</span><span class="sh-switch-row-addr">${shMark(getSiteFullAddress(s.id), tokens)}</span></span>
                ${on ? '<i class="ph-bold ph-check" aria-hidden="true"></i>' : ''}
            </button>`;
    };
    const group = (title, list) => list.length ? `<h3 class="sh-switch-group">${title}</h3>${list.map(row).join('')}` : '';
    const html = group('Your Sites', mine.filter(hit)) + group('All Sites', others.filter(hit));
    document.getElementById('sh-switch-list').innerHTML = html
        || `<p class="sh-switch-empty">No sites match “${shEsc(input.value.trim())}”.</p>`;
}
function clearSiteSwitcherSearch(silent) {
    const input = document.getElementById('sh-switch-input');
    if (input) input.value = '';
    renderSiteSwitcherList();
    if (!silent && input) input.focus();
}
function closeSiteSwitcher() {
    const overlay = document.getElementById('sh-switch-overlay');
    if (!overlay || !siteSwitcherOpen) return;
    siteSwitcherOpen = false;
    overlay.classList.remove('is-open');
    document.getElementById('sh-switch-input').blur();
    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = false;
    setTimeout(() => { if (!siteSwitcherOpen) overlay.hidden = true; }, 440);
    const btn = document.getElementById('sh-site-btn');
    if (btn) btn.focus({ preventScroll: true });
}

// ---------- Search ----------
const SITE_SEARCH_FILTERS = [
    { id: 'all', label: 'All' }, { id: 'photos', label: 'Photos' }, { id: 'logs', label: 'Site Logs' },
    { id: 'drawings', label: 'Drawings' }, { id: 'schedule', label: 'Schedule' }
];
const siteSearch = { open: false, filter: 'all', timer: null, photos: [] };

function shTokens(q) { return String(q || '').toLowerCase().split(/\s+/).filter(Boolean); }
function shMatches(text, tokens) { const t = String(text || '').toLowerCase(); return tokens.every(k => t.includes(k)); }
// Escaped text with each query word subtly highlighted
function shMark(text, tokens) {
    const safe = shEsc(text);
    if (!tokens || !tokens.length) return safe;
    const re = new RegExp(`(${tokens.map(k => shEsc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return safe.replace(re, '<mark>$1</mark>');
}
// A short window of `text` around the first query word
function shSnippet(text, tokens) {
    const lower = text.toLowerCase(), at = Math.max(0, ...tokens.map(k => lower.indexOf(k)).filter(i => i >= 0).slice(0, 1));
    const start = Math.max(0, at - 40), end = Math.min(text.length, at + 80);
    return (start ? '…' : '') + shMark(text.slice(start, end), tokens) + (end < text.length ? '…' : '');
}

// The active site's searchable records, each kept with the record it opens (nothing is copied)
function siteSearchResults(query) {
    const siteId = siteHubState.siteId, tokens = shTokens(query);
    const logs = getSiteLogs(siteId), logTitle = id => (logs.find(l => l.id === id) || {}).title || '';
    const authorOf = id => { const e = getEmployeeById(id); return e ? e.name : ''; };
    const hit = haystack => !tokens.length || shMatches(haystack, tokens);
    return {
        tokens,
        photos: getSitePhotos(siteId).filter(p => hit([p.caption, p.tag, logTitle(p.logId), authorOf(p.takenBy), shDate(p.date)].join(' '))),
        logs: logs.filter(l => hit([l.title, l.body, l.authorName, shDate(l.date, true)].join(' '))),
        drawings: getDrawings(siteId).filter(d => hit([d.sheet, d.title, d.discipline, `rev ${d.revision}`].join(' '))),
        schedule: getSiteScheduleTasks(siteId).filter(t => hit([t.title, shTradeTheme(t).name, t.crew, t.notes, shTaskDates(t)].join(' ')))
    };
}

function openSiteSearch(filter = 'all') {
    const overlay = document.getElementById('sh-search-overlay');
    const input = document.getElementById('sh-search-input');
    if (!overlay || !input || !siteHubState.siteId) return;
    triggerHaptic('light');
    siteSearch.open = true;
    siteSearch.filter = filter;
    input.value = '';
    input.placeholder = `Search ${getSiteName(siteHubState.siteId)}`;
    overlay.hidden = false;
    input.focus({ preventScroll: true });              // in the tap itself, so iOS raises the keyboard
    requestAnimationFrame(() => requestAnimationFrame(() => { if (siteSearch.open) overlay.classList.add('is-open'); }));
    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = true;
    renderSiteSearch();
}
function closeSiteSearch() {
    const overlay = document.getElementById('sh-search-overlay');
    if (!overlay || !siteSearch.open) return;
    siteSearch.open = false;
    clearTimeout(siteSearch.timer);
    overlay.classList.remove('is-open');
    document.getElementById('sh-search-input').blur();
    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = false;
    setTimeout(() => { if (!siteSearch.open) overlay.hidden = true; }, 260);
}
function setSiteSearchFilter(id) {
    if (siteSearch.filter === id) return;
    triggerHaptic('light');
    siteSearch.filter = id;
    renderSiteSearch();
    document.getElementById('sh-search-results').scrollTop = 0;
}

function renderSiteSearch() {
    const filters = document.getElementById('sh-search-filters');
    filters.innerHTML = SITE_SEARCH_FILTERS.map(f => `<button type="button" class="filter-pill${f.id === siteSearch.filter ? ' is-active' : ''}" aria-pressed="${f.id === siteSearch.filter}" onclick="setSiteSearchFilter('${f.id}')">${f.label}</button>`).join('');

    const query = document.getElementById('sh-search-input').value.trim();
    const out = document.getElementById('sh-search-results');
    const site = getSiteName(siteHubState.siteId);
    const f = siteSearch.filter;
    if (!query && f === 'all') {
        out.innerHTML = `<div class="sh-search-hint"><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
            <strong>Search ${shEsc(site)}</strong><span>Photos, site logs, drawings, schedule, trades and crew.</span></div>`;
        siteSearch.photos = [];
        return;
    }
    const r = siteSearchResults(query), t = r.tokens, all = f === 'all';
    const groups = [];
    const head = (title, n, filterId) => `<header class="sh-group-head"><h3>${title}${n ? ` <span>• ${n} ${n === 1 ? 'match' : 'matches'}</span>` : ''}</h3>
            ${all && n > 3 ? `<button type="button" class="sh-card-action" onclick="setSiteSearchFilter('${filterId}')">See all</button>` : ''}</header>`;
    siteSearch.photos = r.photos.map(p => p.id);
    if ((all || f === 'photos') && r.photos.length) {
        const list = all ? r.photos.slice(0, 3) : r.photos;
        groups.push(`<section class="sh-group">${head('Photos', r.photos.length, 'photos')}
            <div class="${all ? 'sh-photo-strip' : 'sh-photo-grid'}">${list.map(p => `
                <button type="button" class="sh-thumb" onclick="openSitePhoto('${shEsc(p.id)}')" aria-label="${shEsc(p.caption || 'Photo')}, ${shDate(p.date)}">
                    <img src="${shEsc(p.src)}" alt="" loading="lazy">
                    ${p.tag ? `<span class="sh-thumb-tag">${shEsc(p.tag)}</span>` : ''}
                    <span class="sh-thumb-date">${shDate(p.date)}</span>
                </button>`).join('')}</div></section>`);
    }
    if ((all || f === 'logs') && r.logs.length) {
        groups.push(`<section class="sh-group">${head('Site Logs', r.logs.length, 'logs')}<div class="sh-card sh-list">${(all ? r.logs.slice(0, 3) : r.logs).map(l => renderLogRow(l, t)).join('')}</div></section>`);
    }
    if ((all || f === 'drawings') && r.drawings.length) {
        groups.push(`<section class="sh-group">${head('Drawings', r.drawings.length, 'drawings')}<div class="sh-card sh-list">${(all ? r.drawings.slice(0, 3) : r.drawings).map(d => renderDrawingRow(d, t)).join('')}</div></section>`);
    }
    if ((all || f === 'schedule') && r.schedule.length) {
        groups.push(`<section class="sh-group">${head('Schedule', r.schedule.length, 'schedule')}<div class="sh-card sh-list">${(all ? r.schedule.slice(0, 3) : r.schedule).map(x => renderScheduleRow(x, t)).join('')}</div></section>`);
    }
    if (!groups.length) {
        const what = (SITE_SEARCH_FILTERS.find(x => x.id === f) || {}).label;
        out.innerHTML = `<div class="sh-search-hint"><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
            <strong>${query ? `No results for “${shEsc(query)}”` : `No ${shEsc(what.toLowerCase())} yet`}</strong>
            <span>${query ? `Nothing ${f === 'all' ? '' : `in ${shEsc(what)} `}at ${shEsc(site)} matches.` : `${shEsc(site)} has no ${shEsc(what.toLowerCase())} yet.`}</span></div>`;
        return;
    }
    out.innerHTML = groups.join('');
}

// ---------- Site log: details and Add Log ----------
function openSiteLog(id) {
    const l = getSiteLogById(id);
    if (!l) return;
    triggerHaptic('light');
    const photos = getLogPhotos(l.id);
    siteSearch.photos = photos.map(p => p.id);
    openModal('Site Log', `
        <article class="sh-detail">
            <p class="sh-detail-kicker">${shEsc(DateRules.fromIso(l.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }))} · ${shEsc(getSiteName(l.siteId))}</p>
            <h3 class="sh-detail-title">${shEsc(l.title)}</h3>
            <p class="sh-detail-by">${renderRoleAvatar(l.authorName, 'sm')}<span>${shEsc(l.authorName)}</span></p>
            ${l.body ? `<p class="sh-detail-body">${shEsc(l.body)}</p>` : ''}
            ${photos.length ? `<div class="sh-photo-grid">${photos.map(p => `<button type="button" class="sh-thumb" onclick="openSitePhoto('${shEsc(p.id)}')" aria-label="${shEsc(p.caption || 'Photo')}"><img src="${shEsc(p.src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
        </article>`);
}

let siteLogDraftPhotos = [];
function openAddSiteLog() {
    if (!siteHubState.siteId) return;
    triggerHaptic('light');
    siteLogDraftPhotos = [];
    const label = 'block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1.5';
    const field = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-lime text-base';
    openModal('New Site Log', `
        <form id="sh-log-form" class="space-y-4 pt-1" onsubmit="event.preventDefault(); submitSiteLog();" novalidate>
            <p class="sh-detail-kicker">${shEsc(shToday().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }))} · ${shEsc(getSiteName(siteHubState.siteId))}</p>
            <div>
                <label for="sh-log-title" class="${label}">Title</label>
                <input id="sh-log-title" type="text" maxlength="120" autocomplete="off" enterkeyhint="next" placeholder="e.g. Slab pre-pour inspection" class="${field}">
            </div>
            <div>
                <label for="sh-log-body" class="${label}">Notes</label>
                <textarea id="sh-log-body" rows="4" maxlength="4000" placeholder="What happened on site today?" class="${field} sh-textarea"></textarea>
            </div>
            <div>
                <span class="${label}">Photos</span>
                <div id="sh-log-photos" class="sh-log-photos"></div>
                <label class="btn btn--card sh-add-photos">
                    <i class="ph-bold ph-camera" aria-hidden="true"></i><span>Add Photos</span>
                    <input type="file" accept="image/*" multiple class="sr-only" onchange="addSiteLogPhotos(this)">
                </label>
            </div>
            <button type="submit" id="sh-log-submit" class="btn btn--primary btn--block">
                <i class="ph-bold ph-check" aria-hidden="true"></i><span>Save Log</span>
            </button>
        </form>`);
    renderSiteLogDraftPhotos();
}
// Photos from the camera or library: scaled down on the device (max 1600px, JPEG) before they are saved
async function addSiteLogPhotos(input) {
    const files = [...(input.files || [])].slice(0, SITE_LOG_MAX_PHOTOS - siteLogDraftPhotos.length);
    input.value = '';
    for (const file of files) {
        try { siteLogDraftPhotos.push({ src: await shDownscale(file) }); } catch (_) { /* unreadable: skipped */ }
    }
    renderSiteLogDraftPhotos();
}
function shDownscale(file, max = 1600) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
            const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
            const c = document.createElement('canvas');
            c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
        img.src = url;
    });
}
function renderSiteLogDraftPhotos() {
    const el = document.getElementById('sh-log-photos');
    if (!el) return;
    el.innerHTML = siteLogDraftPhotos.map((p, i) => `<span class="sh-log-photo"><img src="${p.src}" alt="">
        <button type="button" onclick="removeSiteLogPhoto(${i})" aria-label="Remove photo ${i + 1}"><i class="ph-bold ph-x" aria-hidden="true"></i></button></span>`).join('');
    el.hidden = !siteLogDraftPhotos.length;
    const add = document.querySelector('.sh-add-photos');
    if (add) add.hidden = siteLogDraftPhotos.length >= SITE_LOG_MAX_PHOTOS;
}
function removeSiteLogPhoto(i) { siteLogDraftPhotos.splice(i, 1); renderSiteLogDraftPhotos(); }
async function submitSiteLog() {
    const val = id => (document.getElementById(id) || {}).value || '';
    const result = await runUiAction(() => siteContentService.addLog({
        siteId: siteHubState.siteId, date: shTodayIso(), title: val('sh-log-title'), body: val('sh-log-body'), photos: siteLogDraftPhotos
    }), { button: document.getElementById('sh-log-submit'), errorTitle: 'Log not saved' });
    if (!result.ok) return;
    triggerHaptic('success');
    siteLogDraftPhotos = [];
    closeModal();
}

// ---------- Drawing details ----------
function openSiteDrawing(id) {
    const d = getDrawingById(id);
    if (!d) return;
    triggerHaptic('light');
    openModal('Drawing', `
        <article class="sh-detail">
            <div class="sh-dwg-hero"><i class="ph-fill ph-file-pdf" aria-hidden="true"></i><span>${shEsc(d.sheet)}</span></div>
            <h3 class="sh-detail-title">${shEsc(d.title)}</h3>
            <dl class="sh-facts">
                <div><dt>Sheet</dt><dd>${shEsc(d.sheet)}</dd></div>
                <div><dt>Revision</dt><dd>Rev ${shEsc(d.revision)}</dd></div>
                <div><dt>Discipline</dt><dd>${shEsc(d.discipline)}</dd></div>
                <div><dt>Updated</dt><dd>${shEsc(DateRules.fromIso(d.updatedOn).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }))}</dd></div>
            </dl>
            <p class="sh-detail-note">The drawing file isn't stored in the app yet. It opens here once drawings sync from Procore.</p>
        </article>`);
}

// ---------- Photo lightbox ----------
const shLightbox = { ids: [], index: 0 };
function openSitePhoto(id) {
    const ids = siteSearch.photos && siteSearch.photos.includes(id) ? siteSearch.photos.slice() : [id];
    shLightbox.ids = ids;
    shLightbox.index = Math.max(0, ids.indexOf(id));
    const box = document.getElementById('sh-lightbox');
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('is-open'));
    showSitePhoto();
    box.querySelector('.sh-lightbox-close').focus({ preventScroll: true });
}
function showSitePhoto() {
    const photo = appStore.get('sitePhotos').find(p => p.id === shLightbox.ids[shLightbox.index]);
    if (!photo) return;
    document.getElementById('sh-lightbox-img').src = photo.src;
    document.getElementById('sh-lightbox-img').alt = photo.caption || 'Site photo';
    document.getElementById('sh-lightbox-caption').textContent = photo.caption || '';
    const n = shLightbox.ids.length;
    document.getElementById('sh-lightbox-meta').textContent =
        [shDate(photo.date, true), photo.tag, n > 1 ? `${shLightbox.index + 1} of ${n}` : ''].filter(Boolean).join(' · ');
}
function stepSitePhoto(dir) {
    const next = shLightbox.index + dir;
    if (next < 0 || next >= shLightbox.ids.length) return;
    shLightbox.index = next;
    triggerHaptic('light');
    showSitePhoto();
}
function closeSitePhoto() {
    const box = document.getElementById('sh-lightbox');
    if (!box || box.hidden) return;
    box.classList.remove('is-open');
    setTimeout(() => { if (!box.classList.contains('is-open')) box.hidden = true; }, 220);
}
function isSitePhotoOpen() { const b = document.getElementById('sh-lightbox'); return !!b && !b.hidden; }

// ---------- Wiring ----------
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('sh-search-input');
    if (input) input.addEventListener('input', () => {
        clearTimeout(siteSearch.timer);
        siteSearch.timer = setTimeout(renderSiteSearch, 140);   // live, debounced
    });
    // Swipe between photos in the lightbox
    const stage = document.getElementById('sh-lightbox-stage');
    if (stage) {
        let x0 = null, id = null;
        stage.addEventListener('pointerdown', e => { x0 = e.clientX; id = e.pointerId; });
        stage.addEventListener('pointerup', e => {
            if (e.pointerId !== id || x0 === null) return;
            const dx = e.clientX - x0; x0 = null;
            if (Math.abs(dx) > 50) stepSitePhoto(dx < 0 ? 1 : -1);
        });
        stage.addEventListener('pointercancel', () => { x0 = null; });
    }
    document.addEventListener('keydown', e => {
        if (isSitePhotoOpen()) {
            if (e.key === 'Escape') { e.stopPropagation(); closeSitePhoto(); }
            else if (e.key === 'ArrowRight') stepSitePhoto(1);
            else if (e.key === 'ArrowLeft') stepSitePhoto(-1);
            return;
        }
        if (e.key !== 'Escape') return;
        const modalOpen = document.getElementById('modal-overlay') && !document.getElementById('modal-overlay').classList.contains('opacity-0');
        if (modalOpen) return;                                          // the modal closes first
        if (siteSwitcherOpen) { e.stopPropagation(); closeSiteSwitcher(); }
        else if (siteSearch.open) { e.stopPropagation(); closeSiteSearch(); }
    }, true);
    renderSiteHub();
});

// Everything the hub shows follows the store: sites, roster, attendance and site content
appStore.subscribe(() => {
    renderSiteHub();
    if (siteSearch.open) renderSiteSearch();
}, ['sites', 'roster', 'attendance', 'siteLogs', 'drawings', 'sitePhotos']);
appStore.ready.then(renderSiteHub).catch(() => {});
