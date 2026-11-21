/**
 * Schedule (styles/schedule.css): the Site Hub's sub-page for the active site's schedule. It slides over the hub
 * ("‹ Lugarno" goes back) and shares its site (siteHubState.siteId) and records.
 *
 *   Overview     Project Milestones: one card per stage gate, its checklist ring, due day and status; a card
 *                expands to its checklist - native checkboxes, ticked through scheduleService, so the ring, the
 *                count and the Site Hub's hero ring move together. Then the next 14 days of trades, deliveries
 *                and inspections by day: company, arrival window, scope, status.
 *   2-Week Plan  a Gantt of the fortnight: Week 1 | Week 2, one row per booking (sticky labels, trade-coloured
 *                bars), milestones as diamonds, and a "trades on site" row that flags busy days and shared areas.
 *                Scrolls sideways; a bar opens its booking.
 *   Month        the month calendar (bars in lanes; tap a day to see it, tap again or hold-and-drag to book;
 *                swipe to change month), a legend (stages, trades, milestones), the chosen day's bookings and
 *                the month's key dates (milestones, stage changes, inspections, deliveries).
 *   Sheets       a booking (company, arrival, scope; a milestone's full checklist with notes; copy +1 week;
 *                delete with undo), the booking form, and the trade list - all the shared sheet.
 *
 * State (scheduleUi): the view (kept between visits), the chosen day / month, which milestones are open, and a
 * record to bring into view. Data: scheduleTasks / scheduleTrades through the selectors; every change through
 * scheduleService. Progress is always counted from the checklist (ScheduleRules.progress). "Today" is the sites'
 * day (homeAttendanceDay).
 */

const SCH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SCH_DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const SCH_DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCH_UI_KEY = 'lifestyle.schedule.ui';
const SCH_VIEWS = ['overview', '2w', 'month'];
const scheduleUi = { view: 'overview', m0: null, sel: null, days: 'ms', expanded: new Set(), focus: null, doneOpen: false, donePlayed: false };
try {
    const saved = JSON.parse(localStorage.getItem(SCH_UI_KEY) || 'null');
    if (saved) {
        scheduleUi.view = SCH_VIEWS.includes(saved.view) ? saved.view : 'overview';
        scheduleUi.days = saved.days === 'all' ? 'all' : 'ms';
    }
} catch (_) { /* storage blocked: defaults */ }
function saveScheduleUi() {
    try { localStorage.setItem(SCH_UI_KEY, JSON.stringify({ view: scheduleUi.view, days: scheduleUi.days })); } catch (_) {}
}

// ---------- Helpers ----------
const schEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const schIso = d => DateRules.toIso(d);
const schParse = s => DateRules.fromIso(s);
const schAdd = (d, n) => DateRules.addDays(d, n);
const schDiff = (a, b) => DateRules.dayDiff(a, b);           // whole days from a to b
function schToday() { return DateRules.startOfDay(homeAttendanceDay()); }
function schShort(d) { return `${d.getDate()} ${SCH_MONTHS[d.getMonth()].slice(0, 3)}`; }
function schDay(d) { return `${SCH_DAY3[d.getDay()]} ${schShort(d)}`; }
function schRange(a, b) {
    if (a === b) return schDay(schParse(a));
    const x = schParse(a), y = schParse(b);
    return `${SCH_DAY3[x.getDay()]} ${x.getDate()}${x.getMonth() !== y.getMonth() ? ' ' + SCH_MONTHS[x.getMonth()].slice(0, 3) : ''} – ${schDay(y)}`;
}
// "Mon 23–Wed 25" for a card under a dated heading (the month is in the heading); across months it keeps them
function schSpan(a, b) {
    const x = schParse(a), y = schParse(b);
    if (x.getMonth() !== y.getMonth()) return schRange(a, b);
    return `${SCH_DAY3[x.getDay()]} ${x.getDate()}–${SCH_DAY3[y.getDay()]} ${y.getDate()}`;
}
// An arrival window, compact ("7:00–3:30"), as the Site Hub's roster shows it (shCompactWindow)
function schWindow(w) { return w && typeof shCompactWindow === 'function' ? shCompactWindow(w) : (w || ''); }
function schTime(ts) { const d = new Date(ts), h = d.getHours(); return `${schDay(d)}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`; }
function schRgb(hex) { const h = String(hex || '#8E8E93').replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) || 0); }
function schTint(hex, a) { return `rgba(${schRgb(hex).join(',')},${a})`; }
function schLight(hex) { return `rgb(${schRgb(hex).map(v => Math.round(v + (255 - v) * 0.35)).join(',')})`; }
const SCH_STATUS_COL = { ready: '#22E562', overdue: '#FF6B5E', risk: '#F5A524', track: '#60A5FA' };
// Stage colours (Month): quiet, distinct from the trades' and from emerald
const SCH_STAGE_COLS = ['#94A3B8', '#60A5FA', '#A78BFA', '#2DD4BF', '#F472B6', '#FB923C'];

function scheduleSiteId() { return typeof ensureSiteHubState === 'function' ? ensureSiteHubState() : null; }
function scheduleTasks() { const id = scheduleSiteId(); return id ? getScheduleTasks(id) : []; }
function schIsDelivery(t) { return t.tradeId === 'delivery'; }
function schIsInspection(t) { return t.tradeId === 'inspection'; }

// ---------- Navigation ----------
function initSchedule() {
    const today = schToday();
    if (!scheduleUi.sel) scheduleUi.sel = schIso(today);
    if (!scheduleUi.m0) scheduleUi.m0 = schIso(DateRules.mondayOf(schParse(scheduleUi.sel)));
    renderSchedule();
}
// Opening the Schedule afresh (navigation.js): back on today with every milestone card closed - leaving resets
// the layout; only the chosen view and day filter are kept
function resetScheduleView() { scheduleUi.sel = null; scheduleUi.m0 = null; scheduleUi.expanded.clear(); scheduleUi.focus = null; scheduleUi.doneOpen = false; scheduleUi.donePlayed = false; initSchedule(); }
// From the Site Hub (hero footer, Full Schedule, a search result): this view, with `focusId` open and in view
function showScheduleFrom({ focusId = null, view = 'overview' } = {}) {
    scheduleUi.view = SCH_VIEWS.includes(view) ? view : 'overview';
    saveScheduleUi();
    switchTab('schedule');                                 // a fresh open: every card closed (resetScheduleView)
    scheduleUi.focus = focusId;
    const t = focusId ? getScheduleTask(focusId) : null;
    if (t && t.milestone) { scheduleUi.expanded.add(t.id); if (schIsFiled(t)) scheduleUi.doneOpen = scheduleUi.donePlayed = true; }   // ...then just this one open (its rings play with the page)
    renderSchedule();
    if (focusId) setTimeout(revealScheduleFocus, 470);     // once the page has slid in
    else { const page = document.getElementById('view-schedule'); if (page) page.scrollTop = 0; }   // as it is, from the top
}
// The site changed (Site Hub switcher): back on today, nothing open
function onScheduleSiteChanged() {
    scheduleUi.sel = null; scheduleUi.m0 = null; scheduleUi.focus = null;
    if (currentActiveViewName === 'schedule') initSchedule();
}
function setScheduleView(v) {
    if (!SCH_VIEWS.includes(v) || v === scheduleUi.view) return;
    triggerHaptic('light');
    scheduleUi.view = v;
    const s = schParse(scheduleUi.sel || schIso(schToday())); scheduleUi.m0 = schIso(DateRules.mondayOf(s));
    saveScheduleUi();
    const body = document.getElementById('sch-body');
    if (body && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        body.classList.remove('is-switching'); void body.offsetWidth; body.classList.add('is-switching');
    }
    renderSchedule();
    const view = document.getElementById('view-schedule'); if (view) view.scrollTo({ top: 0 });
}
function toggleScheduleDays() { triggerHaptic('light'); scheduleUi.days = scheduleUi.days === 'all' ? 'ms' : 'all'; saveScheduleUi(); renderSchedule(); }
function scheduleToToday() {
    triggerHaptic('light');
    const t = schToday(); scheduleUi.sel = schIso(t); scheduleUi.m0 = schIso(DateRules.mondayOf(t));
    renderSchedule();
}
// Back / forward: a fortnight in the 2-Week Plan, four weeks in Month
function shiftSchedule(n) {
    triggerHaptic('light');
    if (scheduleUi.view === '2w') {
        const d = schAdd(schParse(scheduleUi.sel), n * 14);
        scheduleUi.sel = schIso(d); scheduleUi.m0 = schIso(DateRules.mondayOf(d));
    } else {
        const m0 = schAdd(schParse(scheduleUi.m0), n * 28), t = schIso(schToday());
        scheduleUi.m0 = schIso(m0);
        // The chosen day stays in view: today when it's in these four weeks, otherwise their first day
        scheduleUi.sel = t >= scheduleUi.m0 && t <= schIso(schAdd(m0, 27)) ? t : scheduleUi.m0;
    }
    renderSchedule();
}
// From elsewhere (the calendar picker): this site, this day, optionally a booking
function openScheduleForSite(siteId, dateIso, taskId) {
    if (siteId && typeof siteHubState !== 'undefined' && siteId !== siteHubState.siteId && typeof selectSite === 'function') selectSite(siteId, { silent: true });
    if (dateIso) { const d = schParse(dateIso); scheduleUi.sel = dateIso; scheduleUi.m0 = schIso(DateRules.mondayOf(d)); }
    switchTab('schedule');
    renderSchedule();
    if (taskId) requestAnimationFrame(() => openScheduleTask(taskId));
}
function openTradeDetailModal(taskId) { openScheduleTask(taskId); }

// Bring the focused record into view and mark it briefly
function revealScheduleFocus() {
    const id = scheduleUi.focus;
    scheduleUi.focus = null;
    if (!id || currentActiveViewName !== 'schedule') return;
    const el = document.querySelector(`#sch-body [data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
}

// ---------- Render ----------
function schPeriodTitle() {
    const a = scheduleUi.view === '2w' ? DateRules.mondayOf(schParse(scheduleUi.sel)) : schParse(scheduleUi.m0);
    const b = schAdd(a, scheduleUi.view === '2w' ? 13 : 27);
    return `${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + SCH_MONTHS[a.getMonth()].slice(0, 3) : ''} – ${b.getDate()} ${SCH_MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
}
function renderSchedule() {
    const view = document.getElementById('view-schedule');
    if (!view || appStore.status !== 'ready') return;
    if (!scheduleUi.sel) { initSchedule(); return; }
    // No address / stage line: the back button names the site and the Overview leads with the current milestone
    // Segmented control: the glass segment glides to the view
    const seg = document.getElementById('sch-seg'), idx = SCH_VIEWS.indexOf(scheduleUi.view);
    seg.style.setProperty('--sel', String(idx));
    seg.querySelectorAll('[role="tab"]').forEach(b => {
        const on = b.dataset.view === scheduleUi.view;
        b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    document.getElementById('sch-body').setAttribute('aria-labelledby', `sch-tab-${scheduleUi.view}`);
    const dated = scheduleUi.view !== 'overview';
    document.getElementById('sch-datebar').hidden = !dated;
    if (dated) document.getElementById('sch-period').textContent = schPeriodTitle();
    if (scheduleUi.view === 'overview') renderScheduleOverview();
    else if (scheduleUi.view === '2w') renderScheduleGantt();
    else renderScheduleMonth();
}
function schSectionHead(label, big, mint, buttons) {
    return `<div class="sch-sech"><div class="sch-sech-text"><p class="sch-lab${mint ? ' is-mint' : ''}">${label}</p><p class="sch-big">${big}</p></div>${buttons ? `<div class="sch-hbtns">${buttons}</div>` : ''}</div>`;
}
function schStatusPill(st) {
    const col = SCH_STATUS_COL[st.key];
    return `<span class="sch-spill" style="color:${col};border-color:${schTint(col, 0.45)};background:${schTint(col, 0.1)}"><i></i>${st.label}</span>`;
}
function schTag(tr) {
    return `<span class="sch-tag" style="color:${schLight(tr.color)};border-color:${schTint(tr.color, 0.5)};background:${schTint(tr.color, 0.1)}">${schEsc(tr.name)}</span>`;
}

// ---------- Overview: milestones, then the next 14 days ----------
function renderScheduleOverview() {
    const body = document.getElementById('sch-body');
    const tasks = scheduleTasks(), miles = ScheduleRules.milestones(tasks);
    const done = miles.filter(ScheduleRules.isComplete).length;
    let h = schSectionHead('Project Milestones', schMilestoneTally(done, miles.length), true);
    h += `<div class="sch-mslist" id="sch-mslist">${miles.length ? schMilestoneListHtml(miles)
        : '<div class="sch-card sch-empty">Make a booking a milestone to track what has to be done before it.</div>'}</div>`;
    h += `<div id="sch-feed">${schFeedHtml(tasks)}</div>`;
    body.innerHTML = h;
    animateProgressRings(body);
}
// Signed-off milestones are filed under one "N complete" row at the top, so the one being worked on leads. One
// completed today stays out with the rest until the day ends, as on the Site Hub, so its win is seen first.
function schIsFiled(t) { return ScheduleRules.isComplete(t) && ScheduleRules.completedOn(t) !== DateRules.toIso(new Date()); }
function schMilestoneOrder(miles) { return [...miles.filter(schIsFiled), ...miles.filter(t => !schIsFiled(t))]; }
function schMilestoneListHtml(miles) {
    const filed = miles.filter(schIsFiled), live = miles.filter(t => !schIsFiled(t)), open = scheduleUi.doneOpen;
    if (!filed.length) return live.map(schMilestoneCard).join('');
    return `<div class="sch-done${open ? ' is-open' : ''}" id="sch-done">
            <button type="button" class="sch-done-head" aria-expanded="${open}" aria-controls="sch-done-list" onclick="toggleScheduleDone()">
                <span class="sch-done-check" aria-hidden="true"><i class="ph-bold ph-check"></i></span>
                <span class="sch-done-main"><span class="sch-done-title">${filed.length} complete</span><span class="sch-done-sub">${schEsc(filed.map(t => t.title).join(' · '))}</span></span>
                <i class="ph-bold ph-caret-down sch-ms-chev" aria-hidden="true"></i>
            </button>
            <div class="sch-done-body" id="sch-done-list"${open ? '' : ' inert'}><div class="sch-done-inner">${filed.map(schMilestoneCard).join('')}</div></div>
        </div>${live.map(schMilestoneCard).join('')}`;
}
function toggleScheduleDone(open = !scheduleUi.doneOpen) {
    triggerHaptic('light');
    scheduleUi.doneOpen = open;
    const box = document.getElementById('sch-done');
    if (!box) return;
    box.classList.toggle('is-open', open);
    box.querySelector('.sch-done-head').setAttribute('aria-expanded', String(open));
    box.querySelector('.sch-done-body').toggleAttribute('inert', !open);
    // The first opening on this visit: the filed rings fill and land their checks as the group unfolds. Opening
    // it again shows them as they are, until the Schedule is left and opened afresh (resetScheduleView).
    if (open && !scheduleUi.donePlayed) {
        scheduleUi.donePlayed = true;
        replayProgressRings(box.querySelector('.sch-done-inner'), 90);
    }
}
// "2 of 6 complete": the count is its own span so it can roll when it changes
function schMilestoneTally(done, total) {
    return total ? `<span class="sch-tally">${done}</span> of ${total} complete` : 'No milestones yet';
}
function schMilestoneCard(t) {
    const today = schIso(schToday()), st = ScheduleRules.milestoneStatus(t, today), p = ScheduleRules.progress(t);
    const open = scheduleUi.expanded.has(t.id), id = schEsc(t.id);
    const tr = getScheduleTrade(t.tradeId);
    return `<article class="sch-ms${open ? ' is-open' : ''}${ScheduleRules.isComplete(t) ? ' is-complete' : ''}" data-id="${id}">
            <button type="button" class="sch-ms-head" aria-expanded="${open}" aria-controls="sch-msb-${id}" onclick="toggleScheduleMilestoneCard('${id}')">
                <span class="sch-ms-ring">${renderProgressRing(p, { size: 56, stroke: 10, key: `ms:${t.id}`, tone: progressRingTone(st.key) })}</span>
                <span class="sch-ms-main">
                    <span class="sch-ms-title">${schEsc(t.title)}</span>
                    <span class="sch-ms-meta"><i class="ph-fill ph-flag-checkered" aria-hidden="true"></i><span>${ScheduleRules.isComplete(t) ? 'Completed' : 'Due'} ${schDay(schParse(t.endDate))}</span></span>
                    <span class="sch-ms-pills">${schStatusPill(st)}</span>
                </span>
                <i class="ph-bold ph-caret-down sch-ms-chev" aria-hidden="true"></i>
            </button>
            <div class="sch-ms-body" id="sch-msb-${id}" role="region" aria-label="${schEsc(t.title)} checklist"${open ? '' : ' inert'}>
                <div class="sch-ms-inner">
                    ${t.notes ? `<p class="sch-ms-notes">${schEsc(t.notes)}</p>` : ''}
                    <ul class="sch-checks">${(t.checklist || []).map(x => schCheckItem(t, x)).join('') || '<li class="sch-empty">No items yet.</li>'}</ul>
                    <div class="sch-ms-actions">
                        <span class="sch-ms-trade"><i style="background:${schEsc(tr.color)}"></i>${schEsc(tr.name)}</span>
                        <button type="button" class="sch-pill-btn" onclick="openScheduleTask('${id}')"><i class="ph-fill ph-note-pencil" aria-hidden="true"></i>Notes & details</button>
                    </div>
                </div>
            </div>
        </article>`;
}
function schCheckItem(t, x) {
    const meta = x.done ? `${schEsc(x.doneByName || 'Ticked')}${x.doneAt ? ` · ${schShort(new Date(x.doneAt))}` : ''}` : (x.requestedBy ? `Added by ${schEsc(x.requestedBy)}` : '');
    return `<li><label class="sch-check${x.done ? ' is-done' : ''}">
            <input type="checkbox" ${x.done ? 'checked' : ''} data-task="${schEsc(t.id)}" data-item="${schEsc(x.id)}" onchange="onScheduleCheck(this)">
            <span class="sch-check-box" aria-hidden="true"><i class="ph-bold ph-check"></i></span>
            <span class="sch-check-text"><span>${schEsc(x.text)}</span>${meta ? `<small>${x.done ? '<i class="ph-fill ph-check-circle" aria-hidden="true"></i>' : ''}${meta}</small>` : ''}${x.note ? `<em>${schEsc(x.note)}</em>` : ''}</span>
        </label></li>`;
}
function toggleScheduleMilestoneCard(id, { quiet = false, open: want } = {}) {
    const card = document.querySelector(`#sch-mslist .sch-ms[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    if (!quiet) triggerHaptic('light');
    const open = typeof want === 'boolean' ? want : !scheduleUi.expanded.has(id);
    if (open) scheduleUi.expanded.add(id); else scheduleUi.expanded.delete(id);
    saveScheduleUi();
    card.classList.toggle('is-open', open);
    card.querySelector('.sch-ms-head').setAttribute('aria-expanded', String(open));
    card.querySelector('.sch-ms-body').toggleAttribute('inert', !open);
}
// A tick: saved through the service; the card, its ring and the Site Hub follow from the store. One save per
// item at a time - a second tap while it saves is ignored, other items stay free.
const schPendingItems = new Set();
async function onScheduleCheck(input) {
    const taskId = input.dataset.task, itemId = input.dataset.item, key = `${taskId}|${itemId}`;
    if (schPendingItems.has(key)) { input.checked = !input.checked; return; }
    schPendingItems.add(key);
    const tapped = performance.now();
    triggerHaptic(input.checked ? 'success' : 'light');
    input.closest('.sch-check').classList.toggle('is-done', input.checked);
    try {
        const t = await scheduleService.toggleItem(taskId, itemId);
        const p = ScheduleRules.progress(t), item = t.checklist.find(x => x.id === itemId);
        if (item && item.done && p.done === p.total) {
            schCelebrateHaptic(tapped);
            schCompleteSnack(t, itemId, { reopen: true });
            schAutoCollapse(taskId, tapped);
        }
    } catch (raw) {
        const err = toAppError(raw);
        triggerHaptic('error');
        input.checked = !input.checked;
        input.closest('.sch-check').classList.toggle('is-done', input.checked);
        showSnack(`Not saved. ${err.userMessage}`);
    } finally { schPendingItems.delete(key); }
}
// A milestone just completed: the ring says it, so the snack is for taking it back - Undo unticks that last item
// (and, from a card, opens its checklist again)
function schCompleteSnack(t, itemId, { reopen = false } = {}) {
    showSnack(`${t.title} complete`, 'Undo', async () => {
        const back = await schRun(() => scheduleService.toggleItem(t.id, itemId), 'Not undone');
        if (!back) { showSnack('Not undone. Try again'); return; }
        triggerHaptic('light');
        if (reopen && !scheduleUi.expanded.has(t.id)) toggleScheduleMilestoneCard(t.id, { quiet: true, open: true });
    }, { icon: 'ph-check-circle' });
}
// A second, firmer tap as the check lands in the ring (250ms after the tick)
function schCelebrateHaptic(tapped) {
    setTimeout(() => triggerHaptic('heavy'), Math.max(0, 250 - (performance.now() - tapped)));
}
// The last item ticked on an open card: the ring closes and the check lands (progress-ring.js), then at 500ms
// the checklist folds away (350ms ease-in-out), leaving the card done. Tapping it reopens it as usual; unticking
// an item takes the ring back to its count.
function schAutoCollapse(taskId, tapped) {
    const wait = Math.max(0, 500 - (performance.now() - tapped));
    setTimeout(() => {
        const card = document.querySelector(`#sch-mslist .sch-ms[data-id="${CSS.escape(taskId)}"]`);
        const t = getScheduleTask(taskId);
        if (!card || !card.classList.contains('is-open') || !t || !ScheduleRules.isComplete(t)) return;
        const head = card.querySelector('.sch-ms-head');
        const hadFocus = card.querySelector('.sch-ms-body').contains(document.activeElement);
        card.classList.add('is-auto-closing');
        toggleScheduleMilestoneCard(taskId, { quiet: true, open: false });
        if (hadFocus && head) head.focus({ preventScroll: true });      // the checklist goes inert: keep focus on the card
        clearTimeout(card._autoClose);
        card._autoClose = setTimeout(() => card.classList.remove('is-auto-closing'), 400);
    }, wait);
}
// The store changed while the Overview is showing: update the milestone cards in place (rings ease, open cards
// stay open, focus stays put); redraw them only if the milestones themselves changed. The feed is redrawn.
function patchScheduleOverview() {
    const list = document.getElementById('sch-mslist');
    if (!list) { renderSchedule(); return; }
    const tasks = scheduleTasks(), all = ScheduleRules.milestones(tasks), miles = schMilestoneOrder(all);
    const cards = [...list.querySelectorAll('.sch-ms')];
    const filedNow = all.filter(schIsFiled).length, filedShown = list.querySelectorAll('#sch-done .sch-ms').length;
    const same = filedNow === filedShown && cards.length === miles.length && cards.every((c, i) => c.dataset.id === miles[i].id
        && c.querySelectorAll('.sch-check input').length === (miles[i].checklist || []).length);
    if (!same) { renderSchedule(); return; }
    const today = schIso(schToday()), done = miles.filter(ScheduleRules.isComplete).length;
    const big = document.querySelector('#sch-body .sch-sech .sch-big'), roll = big && big.querySelector('.sch-tally');
    const was = roll ? Number(roll.textContent) : null;
    if (big && (was !== done || !roll)) {
        big.innerHTML = schMilestoneTally(done, all.length);
        const now = big.querySelector('.sch-tally');            // the count rolls up (or down) to its new value
        if (now && was !== null && was !== done) now.classList.add(done > was ? 'is-up' : 'is-down');
    }
    miles.forEach((t, i) => {
        const card = cards[i], p = ScheduleRules.progress(t), st = ScheduleRules.milestoneStatus(t, today);
        card.classList.toggle('is-complete', ScheduleRules.isComplete(t));
        card.querySelector('.sch-ms-ring').innerHTML = renderProgressRing(p, { size: 56, stroke: 10, key: `ms:${t.id}`, tone: progressRingTone(st.key) });
        const metaText = card.querySelector('.sch-ms-meta > span');
        if (metaText) metaText.textContent = `${ScheduleRules.isComplete(t) ? 'Completed' : 'Due'} ${schDay(schParse(t.endDate))}`;
        card.querySelector('.sch-ms-pills').innerHTML = schStatusPill(st);
        (t.checklist || []).forEach(x => {
            const input = card.querySelector(`input[data-item="${CSS.escape(x.id)}"]`);
            if (!input || schPendingItems.has(`${t.id}|${x.id}`)) return;
            const li = input.closest('li'), focused = document.activeElement === input;
            li.outerHTML = schCheckItem(t, x);
            if (focused) { const again = card.querySelector(`input[data-item="${CSS.escape(x.id)}"]`); if (again) again.focus({ preventScroll: true }); }
        });
    });
    animateProgressRings(list);
    const feed = document.getElementById('sch-feed');
    if (feed) feed.innerHTML = schFeedHtml(tasks);
}

// The next 14 days from today: each booking under the day it starts (one already going, under today), and
// milestones on their due day
function schFeedHtml(tasks) {
    const today = schToday(), t0 = schIso(today), end = schIso(schAdd(today, 13));
    const items = tasks.filter(t => t.startDate <= end && t.endDate >= t0);
    const byDay = new Map();
    items.forEach(t => {
        const k = t.milestone ? t.endDate : (t.startDate < t0 ? t0 : t.startDate);
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(t);
    });
    const days = [...byDay.keys()].sort();
    let h = schSectionHead('Next 14 Days', `${schShort(today)} – ${schShort(schAdd(today, 13))}`, false);
    if (!days.length) return h + '<div class="sch-card sch-empty">Nothing booked in the next two weeks. Tap + to book a trade.</div>';
    h += '<div class="sch-feed">';
    days.forEach(k => {
        const d = schParse(k), isToday = k === t0, list = byDay.get(k).sort((a, b) => (a.milestone ? 1 : 0) - (b.milestone ? 1 : 0));
        h += `<section class="sch-fday${isToday ? ' is-today' : ''}">
                <h3 class="sch-fdate"><span class="sch-fdate-d">${SCH_DAY3[d.getDay()]} ${d.getDate()} ${SCH_MONTHS[d.getMonth()].slice(0, 3)}</span>${isToday ? '<span class="sch-today-chip">Today</span>' : ''}<span class="sch-fdate-n">${list.filter(t => !t.milestone).length || ''}</span></h3>
                <div class="sch-fcards">${list.map(t => (t.milestone ? schFeedMilestone(t) : schTradeCard(t, d))).join('')}</div>
            </section>`;
    });
    return h + '</div>';
}
function schTradeCard(t, onDay) {
    const tr = getScheduleTrade(t.tradeId), n = ScheduleRules.span(t), todayIso = schIso(schToday());
    const k = schIso(onDay);
    let status;
    if (t.startDate <= todayIso && t.endDate >= todayIso) status = { cls: 'is-now', text: n > 1 ? `On site · Day ${schDiff(schParse(t.startDate), schToday()) + 1} of ${n}` : 'On site today' };
    else if (schIsDelivery(t)) status = { cls: 'is-delivery', text: 'Delivery' };
    else if (schIsInspection(t)) status = { cls: 'is-inspect', text: 'Inspection' };
    else status = { cls: '', text: n > 1 ? `${n} days` : 'Booked' };
    return `<button type="button" class="sch-trade" data-id="${schEsc(t.id)}" style="--c:${schEsc(tr.color)};--ct:${schTint(tr.color, 0.14)};--cl:${schLight(tr.color)}" onclick="openScheduleTask('${schEsc(t.id)}')">
            <span class="sch-trade-icon"><i class="fa-solid ${schEsc(tr.icon || 'fa-helmet-safety')}" aria-hidden="true"></i></span>
            <span class="sch-trade-main">
                <span class="sch-trade-top"><span class="sch-trade-title">${schEsc(t.title)}</span><span class="sch-chip ${status.cls}">${status.text}</span></span>
                <span class="sch-trade-co">${t.crew ? `${schEsc(t.crew)} · ` : ''}<span style="color:${schLight(tr.color)}">${schEsc(tr.name)}</span></span>
                <span class="sch-trade-when">${schEsc(schWindow(t.arrival) || 'All day')}${n > 1 || k !== t.startDate ? `<span>·</span>${schSpan(t.startDate, t.endDate)}` : ''}${t.where ? `<span>·</span>${schEsc(t.where)}` : ''}</span>
            </span>
        </button>`;
}
function schFeedMilestone(t) {
    const p = ScheduleRules.progress(t), complete = ScheduleRules.isComplete(t);
    return `<button type="button" class="sch-fms${complete ? ' is-complete' : ''}" data-id="${schEsc(t.id)}" onclick="focusScheduleMilestone('${schEsc(t.id)}')">
            <span class="sch-fms-icon"><i class="ph-fill ph-flag-checkered" aria-hidden="true"></i></span>
            <span class="sch-fms-text"><b>${schEsc(t.title)}</b> ${complete ? 'complete' : 'due'}</span>
            ${complete ? '<span class="sch-fms-count is-done" role="img" aria-label="All complete"><i class="ph-bold ph-check" aria-hidden="true"></i></span>' : `<span class="sch-fms-count">${p.done}/${p.total}</span>`}
        </button>`;
}
// A milestone named elsewhere on the page (feed, Gantt, Month): its card, opened and in view
function focusScheduleMilestone(id) {
    triggerHaptic('light');
    scheduleUi.expanded.add(id); scheduleUi.focus = id; saveScheduleUi();
    const t = getScheduleTask(id), filed = !!(t && schIsFiled(t));
    if (scheduleUi.view !== 'overview') { scheduleUi.view = 'overview'; if (filed) scheduleUi.doneOpen = true; saveScheduleUi(); renderSchedule(); }
    else {
        if (filed && !scheduleUi.doneOpen) toggleScheduleDone(true);
        const card = document.querySelector(`#sch-mslist .sch-ms[data-id="${CSS.escape(id)}"]`);
        if (card && !card.classList.contains('is-open')) { scheduleUi.expanded.delete(id); toggleScheduleMilestoneCard(id); }
    }
    requestAnimationFrame(revealScheduleFocus);
}

// ---------- 2-Week Plan: a Gantt of the fortnight ----------
function renderScheduleGantt() {
    const body = document.getElementById('sch-body');
    const start = DateRules.mondayOf(schParse(scheduleUi.sel)), N = 14, today = schToday(), todayIso = schIso(today);
    const k0 = schIso(start), k1 = schIso(schAdd(start, N - 1));
    const all = scheduleTasks().filter(t => t.endDate >= k0 && t.startDate <= k1);
    const bookings = all.filter(t => !t.milestone).sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.endDate < b.endDate ? 1 : -1));
    const miles = all.filter(t => t.milestone);
    const days = [...Array(N).keys()].map(i => schAdd(start, i));
    const col = i => i + 2;                                   // grid column of day i (column 1 is the labels)
    // Trades on site per day (deliveries arrive and go; they don't count) and areas two bookings share
    const load = days.map(d => { const k = schIso(d); return bookings.filter(t => !schIsDelivery(t) && t.startDate <= k && t.endDate >= k).length; });
    const clash = new Set();
    days.forEach(d => {
        const k = schIso(d), on = bookings.filter(t => t.where && t.startDate <= k && t.endDate >= k);
        on.forEach(a => { if (on.some(b => b !== a && b.where.trim().toLowerCase() === a.where.trim().toLowerCase())) clash.add(a.id); });
    });
    const rows = bookings.length + (miles.length ? 1 : 0);
    let h = `<div class="sch-card sch-gantt-card"><div class="sch-gantt-scroll" id="sch-gantt-scroll">
        <div class="sch-gantt" style="--rows:${rows}">
            <div class="sch-g-corner" style="grid-row:1 / span 2">Activity</div>
            <div class="sch-g-week" style="grid-column:2 / span 7">Week 1 <span>${schShort(days[0])} – ${schShort(days[6])}</span></div>
            <div class="sch-g-week is-2" style="grid-column:9 / span 7">Week 2 <span>${schShort(days[7])} – ${schShort(days[13])}</span></div>
            ${days.map((d, i) => `<div class="sch-g-dh${d.getDay() === 0 || d.getDay() === 6 ? ' is-we' : ''}${schIso(d) === todayIso ? ' is-today' : ''}" style="grid-column:${col(i)}"><span>${SCH_DOW[d.getDay()].slice(0, 1)}</span><b>${d.getDate()}</b></div>`).join('')}
            ${days.map((d, i) => `<div class="sch-g-col${d.getDay() === 0 || d.getDay() === 6 ? ' is-we' : ''}${schIso(d) === todayIso ? ' is-today' : ''}${i === 7 ? ' is-wk' : ''}" style="grid-column:${col(i)};grid-row:3 / span ${rows + 1}" aria-hidden="true"></div>`).join('')}`;
    let r = 3;
    if (miles.length) {
        h += `<div class="sch-g-label is-ms" style="grid-row:${r}"><span class="sch-g-dot is-ms"></span><span class="sch-g-name">Milestones</span></div>`;
        miles.forEach(t => {
            const i = schDiff(start, schParse(t.endDate)), p = ScheduleRules.progress(t);
            h += `<button type="button" class="sch-g-ms${ScheduleRules.isComplete(t) ? ' is-complete' : ''}" data-id="${schEsc(t.id)}" style="grid-row:${r};grid-column:${col(i)}" onclick="focusScheduleMilestone('${schEsc(t.id)}')" aria-label="${schEsc(t.title)}, due ${schDay(schParse(t.endDate))}, ${p.done} of ${p.total} done"><i aria-hidden="true"></i><span>${schEsc(t.title)}</span></button>`;
        });
        r++;
    }
    bookings.forEach(t => {
        const tr = getScheduleTrade(t.tradeId);
        const s = Math.max(0, schDiff(start, schParse(t.startDate))), e = Math.min(N - 1, schDiff(start, schParse(t.endDate)));
        const n = e - s + 1, cl = t.startDate < k0, cr = t.endDate > k1, warn = clash.has(t.id);
        h += `<button type="button" class="sch-g-label" data-s="${s}" data-e="${e}" style="grid-row:${r}" onclick="openScheduleTask('${schEsc(t.id)}')">
                <span class="sch-g-dot" style="background:${schEsc(tr.color)}"></span>
                <span class="sch-g-text"><span class="sch-g-name">${schEsc(t.title)}</span></span>
            </button>
            <button type="button" class="sch-g-bar${cl ? ' is-cl' : ''}${cr ? ' is-cr' : ''}${warn ? ' is-clash' : ''}${n === 1 ? ' is-one' : ''}" data-id="${schEsc(t.id)}"
                style="grid-row:${r};grid-column:${col(s)} / span ${n};--c:${schEsc(tr.color)};--ct:${schTint(tr.color, 0.24)};--cb:${schTint(tr.color, 0.7)};--cl:${schLight(tr.color)}"
                onclick="openScheduleTask('${schEsc(t.id)}')" aria-label="${schEsc(t.title)}, ${schEsc(t.crew || tr.name)}, ${schRange(t.startDate, t.endDate)}${t.arrival ? `, ${schEsc(t.arrival)}` : ''}${warn ? ', shares an area with another trade' : ''}">
                <i class="fa-solid ${schEsc(tr.icon || 'fa-helmet-safety')}" aria-hidden="true"></i>${n > 1 ? `<span>${schEsc(t.crew || t.where || '')}</span>` : ''}${warn ? '<b class="sch-g-warn" aria-hidden="true"><i class="ph-fill ph-warning"></i></b>' : ''}
            </button>`;
        r++;
    });
    if (!rows) h += `<div class="sch-g-none" style="grid-row:3;grid-column:1 / -1">Nothing booked this fortnight.</div>`;
    // Load: how many trades are on site each day; busy days stand out
    h += `<div class="sch-g-label is-load" style="grid-row:${Math.max(r, 4)}"><i class="ph-fill ph-users-three" aria-hidden="true"></i><span class="sch-g-name">On site</span></div>`;
    load.forEach((n, i) => { h += `<div class="sch-g-load${n >= 3 ? ' is-busy' : n ? '' : ' is-none'}" style="grid-row:${Math.max(r, 4)};grid-column:${col(i)}" aria-label="${schDay(days[i])}: ${n} trade${n === 1 ? '' : 's'} on site">${n || '·'}</div>`; });
    h += `</div></div></div>`;
    h += schGanttLegend(bookings, clash.size);
    body.innerHTML = h;
    // Open on today's column when it's in this fortnight
    const sc = document.getElementById('sch-gantt-scroll'), ti = schDiff(start, today);
    if (sc && ti >= 0 && ti < N) {
        const cell = sc.querySelector('.sch-g-dh.is-today');
        if (cell) sc.scrollLeft = Math.max(0, cell.offsetLeft - sc.querySelector('.sch-g-corner').offsetWidth - 8);
    }
    if (sc) { schDimGanttRows(sc); sc.addEventListener('scroll', () => { if (!sc._dimQueued) { sc._dimQueued = true; requestAnimationFrame(() => { sc._dimQueued = false; schDimGanttRows(sc); }); } }, { passive: true }); }
}
// Rows whose bar is scrolled out of view fade back, so the bookings in the days you're looking at stand out
function schDimGanttRows(sc) {
    const corner = sc.querySelector('.sch-g-corner'), head = sc.querySelector('.sch-g-dh');
    if (!corner || !head) return;
    const colW = head.offsetWidth, first = Math.floor(sc.scrollLeft / colW + 0.3), last = Math.ceil((sc.scrollLeft + sc.clientWidth - corner.offsetWidth) / colW - 0.3) - 1;
    sc.querySelectorAll('.sch-g-label[data-s]').forEach(l => { l.classList.toggle('is-off', +l.dataset.e < first || +l.dataset.s > last); });
    sc.querySelectorAll('.sch-g-bar').forEach(b => { const l = b.previousElementSibling; b.classList.toggle('is-off', !!(l && l.classList.contains('is-off'))); });
}
function schGanttLegend(bookings, clashes) {
    const used = [...new Map(bookings.map(t => [t.tradeId, getScheduleTrade(t.tradeId)])).values()];
    return `<div class="sch-legend">
            ${used.map(tr => `<span class="sch-leg"><i style="background:${schEsc(tr.color)}"></i>${schEsc(tr.name)}</span>`).join('')}
            <span class="sch-leg"><i class="is-diamond"></i>Milestone</span>
            <span class="sch-leg is-busy"><i></i>3+ trades on site</span>
            ${clashes ? '<span class="sch-leg is-warn"><i class="ph-fill ph-warning" aria-hidden="true"></i>Shared area</span>' : ''}
        </div>
        <p class="sch-foot">Scroll sideways for the whole fortnight · tap a bar for the booking</p>`;
}

// ---------- Month: calendar, legend, the chosen day, key dates ----------
function schStages() {
    const tasks = scheduleTasks(), miles = ScheduleRules.milestones(tasks);
    if (!miles.length) return [];
    const first = tasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), miles[0].endDate);
    return ScheduleRules.phases(tasks, first).map((p, i) => ({ ...p, color: SCH_STAGE_COLS[i % SCH_STAGE_COLS.length] }));
}
// Month: four weeks from the chosen week (this week on opening), so it's always what's coming. Each day is shaded
// by how many trades are on site (amber at 3+, as in the 2-Week Plan), carries a dot per trade and an icon for a
// milestone due, an inspection or a delivery; each week sums up what happens in it. Tap a day for its bookings
// (below); tap it again, or hold and drag across days, to book.
const SCH_WEEKS = 4;
function schInWindow(k) { const m0 = scheduleUi.m0; return !!m0 && k >= m0 && k <= schIso(schAdd(schParse(m0), SCH_WEEKS * 7 - 1)); }
function renderScheduleMonth() {
    const body = document.getElementById('sch-body');
    const N = scheduleUi.days === 'all' ? 7 : 6, m0 = schParse(scheduleUi.m0), today = schIso(schToday());
    const tasks = scheduleTasks(), bookings = tasks.filter(t => !t.milestone), stages = schStages();
    const ks = scheduleUi.m0, ke = schIso(schAdd(m0, SCH_WEEKS * 7 - 1));
    const dayInfo = k => {
        const on = bookings.filter(t => t.startDate <= k && t.endDate >= k);
        const trades = on.filter(t => !schIsDelivery(t) && !schIsInspection(t));
        return {
            trades, load: trades.length,
            ms: tasks.filter(t => t.milestone && t.endDate === k),
            insp: on.filter(t => schIsInspection(t) && t.startDate === k),
            del: on.filter(t => schIsDelivery(t) && t.startDate === k)
        };
    };
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const cols = `grid-template-columns:repeat(${N},1fr)`;
    let busyDays = 0, tradeDays = 0;
    let h = `<div class="sch-card sch-mcard" id="sch-mcard"><div class="sch-dow" style="${cols}">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].slice(0, N).map(d => `<span>${d}</span>`).join('')}</div><div class="sch-cal" id="sch-cal">`;
    for (let w = 0; w < SCH_WEEKS; w++) {
        const ws = schAdd(m0, w * 7);
        const wk = { ms: [], insp: 0, del: 0, busy: 0 };
        h += `<div class="sch-wk"><div class="sch-week" style="${cols}">`;
        for (let d = 0; d < N; d++) {
            const dd = schAdd(ws, d), k = schIso(dd), info = dayInfo(k);
            const ph = stages.find(p => p.start <= k && p.end >= k) || null;
            const heat = info.load >= 3 ? 'is-busy' : info.load === 2 ? 'is-h2' : info.load === 1 ? 'is-h1' : '';
            if (info.load >= 3) { busyDays++; wk.busy++; }
            tradeDays += info.load;
            wk.ms.push(...info.ms.map(t => ({ t, dd }))); wk.insp += info.insp.length; wk.del += info.del.length;
            const cls = ['sch-day', heat];
            if (d >= 5) cls.push('is-we');
            if (k < today) cls.push('is-past');
            if (k === today) cls.push('is-today');
            if (k === scheduleUi.sel) cls.push('is-sel');
            const colours = [...new Map(info.trades.map(t => { const tr = getScheduleTrade(t.tradeId); return [tr.id, tr.color]; })).values()];
            const icons = (info.ms.length ? `<i class="sch-di is-ms${info.ms.every(ScheduleRules.isComplete) ? ' is-done' : ''}"></i>` : '')
                + (info.insp.length ? '<i class="sch-di ph-fill ph-clipboard-text is-insp"></i>' : '')
                + (info.del.length ? '<i class="sch-di ph-fill ph-truck is-del"></i>' : '');
            const label = [schDay(dd), info.load ? plural(info.load, 'trade', 'trades') + ' on site' : 'no trades',
                ...info.ms.map(t => `${t.title} due`), info.insp.length ? plural(info.insp.length, 'inspection', 'inspections') : '',
                info.del.length ? plural(info.del.length, 'delivery', 'deliveries') : '', ph ? `${ph.title} stage` : ''].filter(Boolean).join(', ');
            h += `<div class="${cls.filter(Boolean).join(' ')}" data-d="${k}" role="button" tabindex="0" aria-label="${schEsc(label)}${k === scheduleUi.sel ? '. Selected: tap again to book' : ''}">
                    <span class="sch-num">${dd.getDate()}</span>
                    ${icons ? `<span class="sch-dicons" aria-hidden="true">${icons}</span>` : ''}
                    <span class="sch-dots" aria-hidden="true">${colours.slice(0, 4).map(c => `<i style="background:${schEsc(c)}"></i>`).join('')}${colours.length > 4 ? `<b>+${colours.length - 4}</b>` : ''}</span>
                </div>`;
        }
        // The week in a line: its milestones by name, then inspections, deliveries and busy days by count
        const bits = [...wk.ms.map(({ t, dd }) => `<span class="sch-wk-ms${ScheduleRules.isComplete(t) ? ' is-done' : ''}"><i aria-hidden="true"></i>${schEsc(t.title)} ${SCH_DAY3[dd.getDay()]}</span>`),
            wk.insp ? `<span>${plural(wk.insp, 'inspection', 'inspections')}</span>` : '', wk.del ? `<span>${plural(wk.del, 'delivery', 'deliveries')}</span>` : '',
            wk.busy ? `<span class="is-busy">${plural(wk.busy, 'busy day', 'busy days')}</span>` : ''].filter(Boolean);
        const we = schAdd(ws, 6);
        h += `</div><p class="sch-wk-sum"><b>${ws.getDate()}${ws.getMonth() !== we.getMonth() ? ' ' + SCH_MONTHS[ws.getMonth()].slice(0, 3) : ''}–${we.getDate()} ${SCH_MONTHS[we.getMonth()].slice(0, 3)}</b>${bits.length ? bits.join('') : '<span class="is-quiet">Quiet week</span>'}</p></div>`;
    }
    h += '</div></div>';
    // The four weeks at a glance
    const inWin = bookings.filter(t => t.startDate >= ks && t.startDate <= ke);
    const msN = tasks.filter(t => t.milestone && t.endDate >= ks && t.endDate <= ke).length;
    h += `<div class="sch-mstats">
            <div><b>${busyDays}</b><span>busy day${busyDays === 1 ? '' : 's'}</span></div>
            <div><b>${inWin.filter(t => !schIsDelivery(t) && !schIsInspection(t)).length}</b><span>bookings</span></div>
            <div><b>${inWin.filter(schIsInspection).length}</b><span>inspection${inWin.filter(schIsInspection).length === 1 ? '' : 's'}</span></div>
            <div><b>${msN}</b><span>milestone${msN === 1 ? '' : 's'}</span></div>
        </div>`;
    h += schMonthLegend(stages, tasks, ks, ke) + schDayPanel() + schMonthKeyDates(stages, tasks, ks, ke);
    body.innerHTML = h;
    body.querySelectorAll('.sch-day').forEach(el => {
        el.onclick = () => onScheduleDayTap(el.dataset.d);
        el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onScheduleDayTap(el.dataset.d); } };
    });
    bindScheduleRange();
}
function schMonthLegend(stages, tasks, ks, ke) {
    const trades = [...new Map(tasks.filter(t => !t.milestone && !schIsDelivery(t) && !schIsInspection(t) && t.endDate >= ks && t.startDate <= ke)
        .map(t => [t.tradeId, getScheduleTrade(t.tradeId)])).values()];
    return `<div class="sch-legend is-month">
            <details class="sch-leg-more"><summary>Legend<i class="ph-bold ph-caret-down" aria-hidden="true"></i></summary>
            <div class="sch-leg-row"><span class="sch-leg-h">How busy</span><span class="sch-leg is-heat"><i class="is-h1"></i>1 trade</span><span class="sch-leg is-heat"><i class="is-h2"></i>2</span><span class="sch-leg is-heat"><i class="is-busy"></i>3+ busy</span></div>
            <div class="sch-leg-row"><span class="sch-leg-h">On the day</span><span class="sch-leg"><i class="is-diamond"></i>Milestone due</span><span class="sch-leg is-ico"><i class="ph-fill ph-clipboard-text" style="color:#F0ABFC"></i>Inspection</span><span class="sch-leg is-ico"><i class="ph-fill ph-truck" style="color:#F5CF5B"></i>Delivery</span></div>
            <div class="sch-leg-row"><span class="sch-leg-h">Trades</span>${trades.map(tr => `<span class="sch-leg"><i style="background:${schEsc(tr.color)}"></i>${schEsc(tr.name)}</span>`).join('') || '<span class="sch-leg">None booked</span>'}</div>
            </details>
            <button type="button" class="sch-days-toggle" onclick="toggleScheduleDays()">${scheduleUi.days === 'all' ? 'Show Mon–Sat' : 'Show 7 days'}</button>
        </div>`;
}
// The four weeks' important dates, in order: milestones, stage starts, inspections and deliveries
function schMonthKeyDates(stages, tasks, ms, me) {
    const todayIso = schIso(schToday());
    const items = [];
    tasks.forEach(t => {
        if (t.milestone && t.endDate >= ms && t.endDate <= me) {
            const p = ScheduleRules.progress(t);
            items.push({ k: t.endDate, kind: 'Milestone', icon: 'ph-flag-checkered', tone: 'is-ms', title: t.title, sub: `${p.done} of ${p.total} prerequisites · ${ScheduleRules.milestoneStatus(t, todayIso).label}`, act: `focusScheduleMilestone('${schEsc(t.id)}')`, id: t.id });
        } else if (!t.milestone && (schIsInspection(t) || schIsDelivery(t)) && t.startDate >= ms && t.startDate <= me) {
            items.push({ k: t.startDate, kind: schIsInspection(t) ? 'Inspection' : 'Delivery', icon: schIsInspection(t) ? 'ph-clipboard-text' : 'ph-truck', tone: schIsInspection(t) ? 'is-inspect' : 'is-delivery', title: t.title, sub: `${t.crew}${t.arrival ? ` · ${t.arrival}` : ''}`, act: `openScheduleTask('${schEsc(t.id)}')`, id: t.id });
        }
    });
    stages.forEach(p => { if (p.start >= ms && p.start <= me) items.push({ k: p.start, kind: 'Stage', icon: 'ph-hard-hat', tone: 'is-stage', color: p.color, title: `${p.title} begins`, sub: `Through ${schDay(schParse(p.end))}`, act: `focusScheduleMilestone('${schEsc(p.id)}')` }); });
    items.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
    let h = schSectionHead(`${schShort(schParse(ms))} – ${schShort(schParse(me))}`, items.length ? 'Key dates' : 'No key dates', false);
    if (!items.length) return h + '<div class="sch-card sch-empty">No milestones, inspections or deliveries in these four weeks.</div>';
    return h + `<div class="sch-card sch-keys">${items.map(it => {
        const d = schParse(it.k), past = it.k < todayIso;
        return `<button type="button" class="sch-key${past ? ' is-past' : ''}" onclick="${it.act}">
                <span class="sch-key-date"><span>${SCH_DAY3[d.getDay()]}</span><b>${d.getDate()}</b></span>
                <span class="sch-key-icon ${it.tone}"${it.color ? ` style="color:${it.color};background:${schTint(it.color, 0.14)}"` : ''}><i class="ph-fill ${it.icon}" aria-hidden="true"></i></span>
                <span class="sch-key-main"><span class="sch-key-title">${schEsc(it.title)}</span><span class="sch-key-sub">${schEsc(it.kind)} · ${schEsc(it.sub)}</span></span>
                <i class="ph-bold ph-caret-right sch-key-chev" aria-hidden="true"></i>
            </button>`;
    }).join('')}</div>`;
}
function onScheduleDayTap(k) {
    if (schSuppressClick) return;
    if (scheduleUi.sel === k) { openScheduleEdit(null, k); return; }     // tap the chosen day again: book it
    triggerHaptic('light');
    scheduleUi.sel = k;
    renderSchedule();
}
// The chosen day: what's on, with a warning where two bookings share an area
function schDayPanel() {
    const k = scheduleUi.sel, d = schParse(k), isToday = +d === +schToday();
    const on = scheduleTasks().filter(t => t.startDate <= k && t.endDate >= k);
    const count = {};
    on.forEach(t => { const w = (t.where || '').trim().toLowerCase(); if (w) count[w] = (count[w] || 0) + 1; });
    const btns = `<button type="button" class="sch-hbtn" onclick="copyScheduleWeek()"><i class="ph-fill ph-copy" aria-hidden="true"></i>Copy week</button>`;   // booking: the + below
    const trades = on.filter(t => !t.milestone), miles = on.filter(t => t.milestone);
    return schSectionHead(isToday ? 'TODAY' : `${SCH_DOW[d.getDay()]} ${d.getDate()} ${SCH_MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}`, trades.length ? `${trades.length} on site` : 'Nothing on', true, btns)
        + `<div class="sch-fcards">${miles.map(schFeedMilestone).join('')}${trades.length ? trades.map(t => schTradeCard(t, d)).join('') : (miles.length ? '' : '<div class="sch-card sch-empty">No trades booked for this day.</div>')}</div>`;
}


// Hold a day, drag across days: book that range. A swipe sideways changes the month.
let schSuppressClick = false;
function bindScheduleRange() {
    const cal = document.getElementById('sch-cal');
    if (!cal) return;
    let timer = null, anchor = null, cur = null, active = false, sx = 0, sy = 0, tracking = false;
    const dayAt = (x, y) => { const el = document.elementFromPoint(x, y); const d = el && el.closest ? el.closest('.sch-day') : null; return d && cal.contains(d) ? d.dataset.d : null; };
    const range = () => (anchor < cur ? [anchor, cur] : [cur, anchor]);
    const paint = () => { const r = range(); cal.querySelectorAll('.sch-day').forEach(d => d.classList.toggle('is-rng', d.dataset.d >= r[0] && d.dataset.d <= r[1])); };
    cal.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        const d = dayAt(e.clientX, e.clientY); if (!d) return;
        anchor = cur = d; sx = e.clientX; sy = e.clientY; active = false; tracking = true;
        clearTimeout(timer);
        timer = setTimeout(() => { active = true; paint(); triggerHaptic('medium'); try { cal.setPointerCapture(e.pointerId); } catch (_) {} }, 380);
    });
    cal.addEventListener('pointermove', e => {
        if (!anchor) return;
        if (!active) { if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) { clearTimeout(timer); anchor = null; } return; }
        e.preventDefault();
        const d = dayAt(e.clientX, e.clientY); if (d && d !== cur) { cur = d; paint(); }
    });
    const end = e => {
        clearTimeout(timer);
        if (active) {
            const r = range();
            schSuppressClick = true; setTimeout(() => { schSuppressClick = false; }, 450);
            cal.querySelectorAll('.is-rng').forEach(x => x.classList.remove('is-rng'));
            openScheduleEdit(null, r[0], r[1]);
        } else if (tracking && e && e.type === 'pointerup') {
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) > 60 && Math.abs(dy) < 45) { schSuppressClick = true; setTimeout(() => { schSuppressClick = false; }, 300); shiftSchedule(dx < 0 ? 1 : -1); }
        }
        anchor = null; active = false; tracking = false;
    };
    cal.addEventListener('pointerup', end);
    cal.addEventListener('pointercancel', () => { if (!active) { clearTimeout(timer); anchor = null; tracking = false; } else end(); });
    cal.addEventListener('contextmenu', e => e.preventDefault());
    cal.style.touchAction = 'pan-y';
}

// ---------- Copy (clipboard, or a sheet to select from) ----------
async function schCopy(text, okMsg, title) {
    try { await navigator.clipboard.writeText(text); triggerHaptic('success'); showSnack(okMsg, null, null, { icon: 'ph-check-circle' }); }
    catch (_) {      // no clipboard access: show it to select and copy
        openModal(title, `<p class="sheet-label">Select all and copy</p><textarea class="sheet-input sch-copy-text" readonly>${schEsc(text)}</textarea>`);
        requestAnimationFrame(() => { const ta = document.querySelector('.sch-copy-text'); if (ta) { ta.focus(); ta.select(); } });
    }
}
function copyScheduleWeek() {
    const ws = DateRules.mondayOf(schParse(scheduleUi.sel)), we = schAdd(ws, 6), k1 = schIso(ws), k2 = schIso(we);
    const list = scheduleTasks().filter(t => t.startDate <= k2 && t.endDate >= k1);
    const lines = [`${getSiteName(scheduleSiteId()).toUpperCase()} SCHEDULE: week of ${schDay(ws)}`, ''];
    if (!list.length) lines.push('Nothing booked this week.');
    list.forEach(t => {
        const tr = getScheduleTrade(t.tradeId), p = t.milestone ? ScheduleRules.progress(t) : null;
        lines.push(`• ${t.milestone ? '◆ ' : ''}${t.title} (${t.crew || tr.name})${t.where ? ' @ ' + t.where : ''}\n   ${schRange(t.startDate, t.endDate)}${t.arrival ? ` · ${t.arrival}` : ''}${p ? ` · checklist ${p.done}/${p.total}` : ''}`);
    });
    schCopy(lines.join('\n'), 'Week copied. Paste it in your group chat', 'This week');
}

// ---------- Booking sheet (details + milestone checklist with notes) ----------
let schOpenId = null, schNoteOpen = null;
function openScheduleTask(id) {
    const t = getScheduleTask(id);
    if (!t) return;
    triggerHaptic('light');
    schOpenId = id; schNoteOpen = null;
    openModal(t.title, schDetailHtml(t));
    animateProgressRings(document.getElementById('modal-body'));
}
function schDetailHtml(t) {
    const tr = getScheduleTrade(t.tradeId), n = ScheduleRules.span(t), id = schEsc(t.id), today = schIso(schToday());
    let h = `<div class="sch-detail" data-detail="${id}">
        <div class="sch-dtop">
            <span class="sch-tagrow">${schTag(tr)}${t.milestone ? '<span class="sch-mstag"><i class="ph-fill ph-flag-checkered" aria-hidden="true"></i>Milestone</span>' : ''}</span>
            <button type="button" class="sch-pill-btn" onclick="openScheduleEdit('${id}')"><i class="ph-fill ph-pencil-simple" aria-hidden="true"></i>Edit</button>
        </div>
        <dl class="sch-dfacts">
            ${t.crew ? `<div><dt>Company</dt><dd>${schEsc(t.crew)}</dd></div>` : ''}
            <div><dt>${t.milestone ? (ScheduleRules.isComplete(t) ? 'Completed' : 'Due') : n > 1 ? 'Dates' : 'Date'}</dt><dd>${t.milestone ? schDay(schParse(ScheduleRules.completedOn(t) || t.endDate)) : schRange(t.startDate, t.endDate)}${n > 1 && !t.milestone ? ` <small>(${n} days)</small>` : ''}</dd></div>
            ${t.arrival ? `<div><dt>Arrival</dt><dd>${schEsc(t.arrival)}</dd></div>` : ''}
            ${t.where ? `<div><dt>Where</dt><dd>${schEsc(t.where)}</dd></div>` : ''}
        </dl>
        ${t.notes ? `<p class="sheet-label sch-fl">${t.milestone ? 'About' : 'Scope'}</p><p class="sch-dnotes">${schEsc(t.notes)}</p>` : ''}`;
    if (t.milestone) {
        const st = ScheduleRules.milestoneStatus(t, today), p = ScheduleRules.progress(t), c = t.checklist || [];
        h += `<div class="sch-msbox">${renderProgressRing(p, { size: 72, stroke: 12.5, key: `ms:${t.id}`, tone: progressRingTone(st.key) })}<div><p class="sch-msbox-big">${p.done} of ${p.total} done</p><p class="sch-msbox-sub">${ScheduleRules.isComplete(t) ? `Signed off ${schDay(schParse(ScheduleRules.completedOn(t) || t.endDate))}` : `${ScheduleRules.dueLabel({ startDate: t.endDate, endDate: t.endDate }, today)}${p.total - p.done ? ` · ${p.total - p.done} still to do` : ''}`}</p>${schStatusPill(st)}</div></div>
            <p class="sheet-label sch-fl">Checklist</p><div class="sch-cl">`;
        if (!c.length) h += '<p class="sch-empty">No items yet. Add what needs to be done before this milestone.</p>';
        c.forEach((x, i) => {
            const meta = x.done ? `✓ ${schEsc(x.doneByName || 'Ticked')}${x.doneAt ? ' · ' + schTime(x.doneAt) : ''}` : (x.requestedBy ? `Requested by ${schEsc(x.requestedBy)}` : '');
            h += `<div class="sch-ci${x.done ? ' is-done' : ''}">
                    <button type="button" class="sch-cbox" onclick="toggleScheduleItem('${id}','${schEsc(x.id)}')" role="checkbox" aria-checked="${x.done}" aria-label="${schEsc(x.text)}"><i class="ph-bold ph-check" aria-hidden="true"></i></button>
                    <button type="button" class="sch-cbody" onclick="toggleScheduleNote('${schEsc(x.id)}')" aria-expanded="${schNoteOpen === x.id}" aria-label="${schEsc(x.text)}: add a note or remove">
                        <span class="sch-ctext">${schEsc(x.text)}</span>${meta ? `<span class="sch-cmeta">${meta}</span>` : ''}${x.note ? `<span class="sch-cnote">${schEsc(x.note)}</span>` : ''}
                    </button>
                </div>
                ${schNoteOpen === x.id ? `<div class="sch-ced"><textarea id="sch-note-${i}" class="sheet-input" placeholder="Add a note, e.g. order number, who’s booked, cert reference">${schEsc(x.note || '')}</textarea>
                    <div class="sch-ced-btns"><button type="button" class="sch-ced-save" onclick="saveScheduleNote('${id}','${schEsc(x.id)}',${i})">Save note</button><button type="button" class="sch-ced-rm" onclick="removeScheduleItem('${id}','${schEsc(x.id)}',${i})">Remove item</button></div></div>` : ''}`;
        });
        h += `</div>
            <form class="sch-additem" onsubmit="event.preventDefault(); addScheduleItem('${id}')"><input id="sch-newit" class="sheet-input" placeholder="Add an item to the checklist" autocomplete="off" enterkeyhint="done"><button type="submit" class="sch-additem-btn">Add</button></form>
            <div class="sch-row2"><button type="button" class="sch-outline" onclick="copyScheduleStatus('${id}')"><i class="ph-fill ph-copy" aria-hidden="true"></i>Copy status</button><button type="button" class="sch-outline" onclick="copyScheduleTask('${id}')"><i class="ph-fill ph-copy" aria-hidden="true"></i>Copy +1 week</button></div>`;
    } else {
        h += `<p class="sheet-label sch-fl">Make it a milestone</p><p class="sch-note">Add a checklist that the site manager completes before this happens.</p>
            <div class="sch-tpls">${ScheduleRules.TEMPLATES.map(p => `<button type="button" onclick="makeScheduleMilestone('${id}','${p.id}')">${schEsc(p.name)}${p.items.length ? ` <small>${p.items.length}</small>` : ''}</button>`).join('')}</div>
            <div class="sch-row2"><button type="button" class="sch-outline" onclick="copyScheduleTask('${id}')"><i class="ph-fill ph-copy" aria-hidden="true"></i>Copy +1 week</button><button type="button" class="sch-outline is-red" onclick="deleteScheduleTask('${id}')"><i class="ph-fill ph-trash" aria-hidden="true"></i>Delete</button></div>`;
    }
    return h + '<p class="sch-err" id="sch-detail-err" role="alert"></p></div>';
}
// The open booking sheet follows the data (a tick here, on the Overview or from another device), keeping its scroll
function refreshScheduleDetail() {
    const box = document.querySelector('#modal-body .sch-detail');
    if (!box || !schOpenId) return;
    const t = getScheduleTask(schOpenId);
    if (!t) { closeModal(); return; }
    const body = document.getElementById('modal-body'), keep = body.scrollTop;
    document.getElementById('modal-title').textContent = t.title;
    body.innerHTML = schDetailHtml(t);
    body.scrollTop = keep;
    animateProgressRings(body);
}
async function schRun(work, errTitle) {
    try { return await work(); }
    catch (raw) {
        const err = toAppError(raw);
        triggerHaptic('error');
        const line = document.getElementById('sch-detail-err') || document.getElementById('sch-form-err');
        if (line) line.textContent = `${errTitle}. ${err.userMessage}`;
        return null;
    }
}
async function toggleScheduleItem(taskId, itemId) {
    triggerHaptic('light');
    const t = await schRun(() => scheduleService.toggleItem(taskId, itemId), 'Not saved');
    if (!t) return;
    const p = ScheduleRules.progress(t), item = t.checklist.find(x => x.id === itemId);
    if (item && item.done && p.done === p.total) { schCelebrateHaptic(performance.now()); schCompleteSnack(t, itemId); }
}
function toggleScheduleNote(itemId) {
    schNoteOpen = schNoteOpen === itemId ? null : itemId;
    refreshScheduleDetail();
    if (schNoteOpen) { const ta = document.querySelector('.sch-ced textarea'); if (ta) ta.focus(); }
}
async function saveScheduleNote(taskId, itemId, i) {
    const v = (document.getElementById(`sch-note-${i}`) || {}).value || '';
    schNoteOpen = null;
    await schRun(() => scheduleService.setItemNote(taskId, itemId, v), 'Note not saved');
    refreshScheduleDetail();
}
async function removeScheduleItem(taskId, itemId, index) {
    const t = getScheduleTask(taskId), item = t && t.checklist.find(x => x.id === itemId);
    if (!item) return;
    schNoteOpen = null;
    if (!(await schRun(() => scheduleService.removeItem(taskId, itemId), 'Not removed'))) return;
    showSnack('Item removed', 'Undo', () => schRun(() => scheduleService.restoreItem(taskId, item, index), 'Not restored'));
}
async function addScheduleItem(taskId) {
    const input = document.getElementById('sch-newit');
    const v = input ? input.value.trim() : '';
    if (!v) { if (input) input.focus(); return; }
    if (!(await schRun(() => scheduleService.addItem(taskId, v), 'Not added'))) return;
    const body = document.getElementById('modal-body');
    body.scrollTop = body.scrollHeight;
    const again = document.getElementById('sch-newit'); if (again) again.focus();
}
async function makeScheduleMilestone(taskId, tplId) {
    triggerHaptic('light');
    await schRun(() => scheduleService.makeMilestone(taskId, tplId), 'Not saved');
}
async function copyScheduleTask(taskId) {
    const copy = await schRun(() => scheduleService.copyTask(taskId, 7), 'Not copied');
    if (!copy) return;
    triggerHaptic('success');
    schOpenId = null; closeModal();
    showSnack(`Copied to the week of ${schShort(DateRules.mondayOf(schParse(copy.startDate)))}`, null, null, { icon: 'ph-check-circle' });
}
async function deleteScheduleTask(taskId) {
    const removed = await schRun(() => scheduleService.deleteTask(taskId), 'Not deleted');
    if (!removed) return;
    triggerHaptic('success');
    schOpenId = null; closeModal();
    showSnack('Booking deleted', 'Undo', () => scheduleService.restoreTask(removed).catch(err => console.warn('Undo failed:', err)));
}
function copyScheduleStatus(taskId) {
    const t = getScheduleTask(taskId); if (!t) return;
    const st = ScheduleRules.milestoneStatus(t, schIso(schToday())), p = ScheduleRules.progress(t), c = t.checklist || [];
    const lines = [`◆ ${t.title}${t.where ? ' @ ' + t.where : ''}: due ${schDay(schParse(t.endDate))}`, `${st.label.toUpperCase()} · ${p.done} of ${p.total} done`, ''];
    const todo = c.filter(x => !x.done), done = c.filter(x => x.done);
    if (todo.length) { lines.push('Still to do:'); todo.forEach(x => lines.push(`☐ ${x.text}${x.note ? ` (${x.note})` : ''}`)); lines.push(''); }
    if (done.length) { lines.push('Done:'); done.forEach(x => lines.push(`☑ ${x.text}${x.doneByName ? ` (${x.doneByName})` : ''}${x.note ? `: ${x.note}` : ''}`)); }
    schCopy(lines.join('\n'), 'Checklist copied', 'Milestone status');
}

// ---------- Booking form ----------
let schDraft = null;
const SCH_QUICK = [{ q: '0', label: '1 day' }, { q: 'wk', label: 'To Friday' }, { q: '4', label: '5 days' }, { q: '13', label: '2 weeks' }];
const SCH_ARRIVALS = ['7:00 AM – 3:30 PM', '7:00 – 9:00 AM', '8:00 – 9:00 AM', '10:00 – 11:00 AM'];
function openScheduleEdit(id, dayIso, endIso) {
    const t = id ? getScheduleTask(id) : null;
    const siteId = scheduleSiteId();
    if (!siteId) return;
    triggerHaptic('light');
    const trades = getScheduleTrades();
    schDraft = t ? { ...t } : { id: null, tradeId: (trades[0] || {}).id, title: '', where: '', crew: '', arrival: '', startDate: dayIso || schIso(schToday()), endDate: endIso || dayIso || schIso(schToday()), milestone: false };
    schDraft.template = null;
    schOpenId = null;
    const mine = scheduleTasks();
    const recent = [], seen = new Set();
    if (!t) mine.slice().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).forEach(x => {
        const k = `${x.title.toLowerCase()}|${x.tradeId}|${(x.where || '').toLowerCase()}`;
        if (!x.milestone && !seen.has(k) && recent.length < 8) { seen.add(k); recent.push(x); }
    });
    const places = [...new Set(mine.map(x => x.where).filter(Boolean))], titles = [...new Set(mine.map(x => x.title))];
    const companies = [...new Set(appStore.get('scheduleTasks').map(x => x.crew).filter(Boolean))];
    const canTrades = Permissions.can(getCurrentEmployee(), 'schedule.trades');
    openModal(t ? 'Edit booking' : 'New booking', `
        <form id="sch-form" class="sch-form" onsubmit="event.preventDefault(); submitScheduleEdit();" novalidate>
            ${recent.length ? `<p class="sheet-label sch-fl">Recent · tap to reuse</p><div class="sch-rec">${recent.map((r, i) => `<button type="button" onclick="reuseScheduleRecent(${i})"><i style="background:${schEsc(getScheduleTrade(r.tradeId).color)}"></i>${schEsc(r.title)}${r.crew ? ` <small>${schEsc(r.crew)}</small>` : ''}</button>`).join('')}</div>` : ''}
            <p class="sheet-label sch-fl">Trade ${canTrades ? '<button type="button" class="sch-lnk" onclick="openScheduleTrades()">Edit trades</button>' : ''}</p>
            <div class="sch-tpick" id="sch-tpick">${trades.map(tr => `<button type="button" data-t="${schEsc(tr.id)}" class="${tr.id === schDraft.tradeId ? 'is-on' : ''}" style="--c:${schTint(tr.color, 0.7)};--bgc:${schTint(tr.color, 0.14)};--fg:${schLight(tr.color)}" onclick="pickScheduleTrade('${schEsc(tr.id)}')" aria-pressed="${tr.id === schDraft.tradeId}"><i style="background:${schEsc(tr.color)}"></i>${schEsc(tr.name)}</button>`).join('')}</div>
            <label class="sheet-label sch-fl" for="sch-fT">What</label>
            <input class="sheet-input" id="sch-fT" list="sch-dlT" maxlength="120" autocomplete="off" placeholder="e.g. Sparky Rough-In, Window Delivery" value="${schEsc(schDraft.title)}" onchange="onScheduleTitleChange()">
            <label class="sheet-label sch-fl" for="sch-fC">Company</label>
            <input class="sheet-input" id="sch-fC" list="sch-dlC" maxlength="80" autocomplete="off" placeholder="e.g. VoltEdge Electrical" value="${schEsc(schDraft.crew || '')}">
            <label class="sheet-label sch-fl" for="sch-fA">Arrival window</label>
            <input class="sheet-input" id="sch-fA" maxlength="40" autocomplete="off" placeholder="e.g. 7:00 AM – 3:30 PM" value="${schEsc(schDraft.arrival || '')}">
            <div class="sch-quick">${SCH_ARRIVALS.map(a => `<button type="button" onclick="document.getElementById('sch-fA').value = this.textContent">${schEsc(a)}</button>`).join('')}</div>
            <label class="sheet-label sch-fl" for="sch-fW">Where</label>
            <input class="sheet-input" id="sch-fW" list="sch-dlW" maxlength="60" autocomplete="off" placeholder="e.g. Ground floor, Roof, Front driveway" value="${schEsc(schDraft.where || '')}">
            <label class="sheet-label sch-fl" for="sch-fN">Scope</label>
            <textarea class="sheet-input sch-scope" id="sch-fN" maxlength="2000" rows="3" placeholder="What they're doing on site">${schEsc(schDraft.notes || '')}</textarea>
            <datalist id="sch-dlT">${titles.map(x => `<option value="${schEsc(x)}">`).join('')}</datalist>
            <datalist id="sch-dlW">${places.map(x => `<option value="${schEsc(x)}">`).join('')}</datalist>
            <datalist id="sch-dlC">${companies.map(x => `<option value="${schEsc(x)}">`).join('')}</datalist>
            <div class="sch-two">
                <div><label class="sheet-label sch-fl" for="sch-fS">From</label><input class="sheet-input" type="date" id="sch-fS" value="${schDraft.startDate}" onchange="onScheduleStartChange()"></div>
                <div><label class="sheet-label sch-fl" for="sch-fE">To</label><input class="sheet-input" type="date" id="sch-fE" value="${schDraft.endDate}"></div>
            </div>
            <div class="sch-quick">${SCH_QUICK.map(x => `<button type="button" onclick="setScheduleQuick('${x.q}')">${x.label}</button>`).join('')}</div>
            <p class="sheet-label sch-fl">Milestone</p>
            <button type="button" class="sch-tog${schDraft.milestone ? ' is-on' : ''}" id="sch-msT" role="switch" aria-checked="${schDraft.milestone}" onclick="toggleScheduleMilestone()"><span class="sch-tog-lbl">Milestone with a checklist</span><span class="sch-sw"></span></button>
            <div id="sch-tplw" hidden><p class="sheet-label sch-fl">Start the checklist from</p><div class="sch-tpls" id="sch-tpl">${ScheduleRules.TEMPLATES.map(p => `<button type="button" data-tp="${p.id}" onclick="pickScheduleTemplate('${p.id}')">${schEsc(p.name)}${p.items.length ? ` <small>${p.items.length}</small>` : ''}</button>`).join('')}</div></div>
            <p class="sch-err" id="sch-form-err" role="alert"></p>
            <button type="submit" id="sch-save" class="sheet-btn sch-save"><i class="ph-bold ph-check" aria-hidden="true"></i><span>${t ? 'Save changes' : 'Add to schedule'}</span></button>
            ${t ? `<div class="sch-row2"><button type="button" class="sch-outline" onclick="openScheduleTask('${schEsc(t.id)}')">Back</button><button type="button" class="sch-outline is-red" onclick="deleteScheduleTask('${schEsc(t.id)}')"><i class="ph-fill ph-trash" aria-hidden="true"></i>Delete</button></div>` : ''}
        </form>`);
    schDraft.recent = recent;
    syncScheduleMilestone();
}
function pickScheduleTrade(id) {
    schDraft.tradeId = id;
    document.querySelectorAll('#sch-tpick button').forEach(b => { const on = b.dataset.t === id; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
}
function pickScheduleTemplate(id) {
    schDraft.template = id;
    document.querySelectorAll('#sch-tpl button').forEach(b => b.classList.toggle('is-on', b.dataset.tp === id));
}
function syncScheduleMilestone() {
    const btn = document.getElementById('sch-msT'); if (!btn) return;
    btn.classList.toggle('is-on', schDraft.milestone); btn.setAttribute('aria-checked', String(schDraft.milestone));
    const existing = schDraft.id && getScheduleTask(schDraft.id);
    const need = schDraft.milestone && !(existing && (existing.checklist || []).length);
    document.getElementById('sch-tplw').hidden = !need;
    if (need && !schDraft.template) pickScheduleTemplate(ScheduleRules.guessTemplate(document.getElementById('sch-fT').value));
}
function toggleScheduleMilestone() { triggerHaptic('light'); schDraft.milestone = !schDraft.milestone; syncScheduleMilestone(); }
function setScheduleQuick(q) {
    const fs = document.getElementById('sch-fS'), s = fs.value ? schParse(fs.value) : schToday();
    const n = q === 'wk' ? Math.max(0, 5 - s.getDay()) : +q;
    document.getElementById('sch-fE').value = schIso(schAdd(s, n));
}
function onScheduleStartChange() {
    const s = document.getElementById('sch-fS').value, e = document.getElementById('sch-fE');
    if (!e.value || e.value < s) e.value = s;
}
// Typing a title used before: its trade, company, arrival and area come with it
function onScheduleTitleChange() {
    const v = document.getElementById('sch-fT').value.trim().toLowerCase();
    if (!v) return;
    const prev = scheduleTasks().slice().reverse().find(x => x.title.toLowerCase() === v && x.id !== schDraft.id);
    if (prev) {
        pickScheduleTrade(prev.tradeId);
        const fill = (id, val) => { const el = document.getElementById(id); if (el && !el.value && val) el.value = val; };
        fill('sch-fW', prev.where); fill('sch-fC', prev.crew); fill('sch-fA', prev.arrival);
        if (prev.milestone && !schDraft.milestone) { schDraft.milestone = true; syncScheduleMilestone(); }
    }
    if (schDraft.milestone && !document.getElementById('sch-tplw').hidden) pickScheduleTemplate(ScheduleRules.guessTemplate(v));
}
function reuseScheduleRecent(i) {
    const r = schDraft.recent && schDraft.recent[i]; if (!r) return;
    triggerHaptic('light');
    document.getElementById('sch-fT').value = r.title;
    document.getElementById('sch-fW').value = r.where || '';
    document.getElementById('sch-fC').value = r.crew || '';
    document.getElementById('sch-fA').value = r.arrival || '';
    document.getElementById('sch-fN').value = r.notes || '';
    pickScheduleTrade(r.tradeId);
    const fS = document.getElementById('sch-fS'), fE = document.getElementById('sch-fE');
    if (r.startDate !== r.endDate && fE.value === fS.value) fE.value = schIso(schAdd(schParse(fS.value), schDiff(schParse(r.startDate), schParse(r.endDate))));
}
async function submitScheduleEdit() {
    const val = id => (document.getElementById(id) || {}).value || '';
    const input = {
        id: schDraft.id || undefined, siteId: scheduleSiteId(), tradeId: schDraft.tradeId, title: val('sch-fT'), where: val('sch-fW'), crew: val('sch-fC'),
        arrival: val('sch-fA'), notes: val('sch-fN'),
        startDate: val('sch-fS'), endDate: val('sch-fE') || val('sch-fS'), milestone: schDraft.milestone, template: schDraft.template || undefined
    };
    const result = await runUiAction(() => scheduleService.saveTask(input), { button: document.getElementById('sch-save'), errorTitle: 'Not saved' });
    if (!result.ok) return;
    triggerHaptic('success');
    const saved = result.value;
    if (!schDraft.id) { const s = schParse(saved.startDate); scheduleUi.sel = saved.startDate; if (!schInWindow(saved.startDate)) scheduleUi.m0 = schIso(DateRules.mondayOf(s)); }
    renderSchedule();
    if (saved.milestone) openScheduleTask(saved.id); else { closeModal(); showSnack(schDraft.id ? 'Booking saved' : 'Booked', null, null, { icon: 'ph-check-circle' }); }
}

// ---------- Trades ----------
let schTradeDraft = null;
const SCH_PALETTE = ['#64D2FF', '#FF7AB6', '#8B7CFF', '#66D4CF', '#F0A92E', '#94A3B8'];
function openScheduleTrades() {
    schTradeDraft = getScheduleTrades().map(t => ({ ...t }));
    openModal('Trades', `<div id="sch-trades"></div>`);
    drawScheduleTrades();
}
function drawScheduleTrades() {
    const box = document.getElementById('sch-trades'); if (!box) return;
    box.innerHTML = `<p class="sheet-label sch-fl">Colour · Name</p>
        ${schTradeDraft.map((t, i) => `<div class="sch-trow"><input type="color" value="${schEsc(t.color)}" aria-label="${schEsc(t.name)} colour" oninput="schTradeDraft[${i}].color = this.value"><input class="sheet-input" value="${schEsc(t.name)}" maxlength="40" aria-label="Trade name" oninput="schTradeDraft[${i}].name = this.value"><button type="button" class="sch-trow-x" aria-label="Remove ${schEsc(t.name)}" onclick="removeScheduleTrade(${i})"><i class="ph-bold ph-x" aria-hidden="true"></i></button></div>`).join('')}
        <button type="button" class="sch-hbtn" onclick="addScheduleTrade()"><i class="ph-bold ph-plus" aria-hidden="true"></i>Add trade</button>
        <p class="sch-note" id="sch-trades-note">Tap a colour to change it.</p>
        <button type="button" id="sch-trades-save" class="sheet-btn sch-save" onclick="saveScheduleTrades()"><i class="ph-bold ph-check" aria-hidden="true"></i><span>Save trades</span></button>`;
}
function removeScheduleTrade(i) {
    const t = schTradeDraft[i];
    const used = appStore.get('scheduleTasks').filter(x => x.tradeId === t.id).length;
    if (used) { const n = document.getElementById('sch-trades-note'); n.classList.add('is-error'); n.textContent = `${t.name} is used by ${used} booking${used > 1 ? 's' : ''}. Delete or move those first.`; return; }
    schTradeDraft.splice(i, 1); drawScheduleTrades();
}
function addScheduleTrade() {
    schTradeDraft.push({ id: null, name: 'New trade', color: SCH_PALETTE[schTradeDraft.length % SCH_PALETTE.length] });
    drawScheduleTrades();
    const names = document.querySelectorAll('#sch-trades .sheet-input'); const last = names[names.length - 1]; if (last) { last.focus(); last.select(); }
}
async function saveScheduleTrades() {
    const result = await runUiAction(() => scheduleService.saveTrades(schTradeDraft), { button: document.getElementById('sch-trades-save'), errorTitle: 'Trades not saved' });
    if (!result.ok) return;
    triggerHaptic('success');
    closeModal();
}

// ---------- Wiring ----------
document.addEventListener('DOMContentLoaded', () => {
    // Arrow keys move between the views (a tablist)
    const seg = document.getElementById('sch-seg');
    if (seg) seg.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const i = SCH_VIEWS.indexOf(scheduleUi.view), next = SCH_VIEWS[(i + (e.key === 'ArrowRight' ? 1 : SCH_VIEWS.length - 1)) % SCH_VIEWS.length];
        setScheduleView(next);
        const tab = document.getElementById(`sch-tab-${next}`); if (tab) tab.focus();
    });
});
// Live: the Overview updates in place (rings ease, open cards stay open); other views redraw
subscribeSchedule(() => {
    if (currentActiveViewName === 'schedule') { if (scheduleUi.view === 'overview') patchScheduleOverview(); else renderSchedule(); }
    refreshScheduleDetail();
});
appStore.ready.then(() => { if (currentActiveViewName === 'schedule') initSchedule(); }).catch(() => {});
