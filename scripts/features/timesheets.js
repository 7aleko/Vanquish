/**
 * Time (Timesheets) screen: week strip, daily ring, pay run stats, monthly gap chart, inline editor and
 * the crew reference drawer. Markup lives in #view-time (index.html); styles in styles/timesheets.css;
 * sample data in scripts/data/timesheets.js.
 *
 * One source of truth: `timesheetState.records` (saved shifts, keyed by ISO date). Unsaved edits live in
 * `timesheetState.drafts` until saved, so switching days never loses them. Every number on screen (rings,
 * bars, 8/10 DONE, fortnight hours, gaps, editor status) is derived from those records on each render.
 * Swap the sample seeding in buildTimesheetState() for an API call to persist for real.
 */

const TS_DAY_MS = 86400000;
const TS_WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TS_RING_RADIUS = 87;                                   // (190 - 16) / 2
const TS_RING_CIRC = 2 * Math.PI * TS_RING_RADIUS;

// ---------- Dates ----------
function tsToday() {
    const d = TIMESHEET_CONFIG.useDemoToday ? TIMESHEET_CONFIG.demoToday : new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function tsIso(d) { return formatIsoDateLocal(d); }
function tsFromIso(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function tsAddDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function tsDayDiff(a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / TS_DAY_MS); }
function tsIsWeekend(d) { const g = d.getDay(); return g === 0 || g === 6; }

function tsPayRunStart(d) {
    const anchor = TIMESHEET_CONFIG.payRunAnchor, len = TIMESHEET_CONFIG.payRunLengthDays;
    const runs = Math.floor(tsDayDiff(anchor, d) / len);
    return tsAddDays(anchor, runs * len);
}
// The weekdays (Mon-Fri) of the pay run containing `d`
function tsPayRunWorkdays(d) {
    const start = tsPayRunStart(d), days = [];
    for (let i = 0; i < TIMESHEET_CONFIG.payRunLengthDays; i++) {
        const day = tsAddDays(start, i);
        if (!tsIsWeekend(day)) days.push(day);
    }
    return days;
}
function tsWorkdayIndex(d) {
    if (tsIsWeekend(d)) return -1;
    return tsPayRunWorkdays(d).findIndex(w => tsDayDiff(w, d) === 0);
}

// ---------- Times ----------
function tsMinutes(hhmm) {
    if (!/^\d{1,2}:\d{2}$/.test(hhmm || '')) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
// Net hours for a shift. A finish earlier than the start is an overnight shift; anything that leaves no
// paid time is invalid.
function tsComputeShift(start, finish, breakMins) {
    const s = tsMinutes(start), f = tsMinutes(finish);
    if (s === null || f === null) return { valid: false, net: 0, message: 'Enter a start and finish time' };
    if (s === f) return { valid: false, net: 0, message: 'Finish time is the same as start' };
    const overnight = f < s;
    const gross = (overnight ? f + 1440 : f) - s;
    const net = gross - (breakMins || 0);
    if (net <= 0) return { valid: false, net: 0, message: 'Shift is shorter than the break' };
    if (gross > 16 * 60) return { valid: false, net: net / 60, message: 'Shift is over 16 hours — check the times' };
    return { valid: true, net: Math.round(net / 60 * 100) / 100, overnight };
}
function tsFormatHours(h) { return `${(Math.round(h * 10) / 10).toFixed(1)}h`; }
function tsFormatClock(hhmm) {
    const m = tsMinutes(hhmm);
    if (m === null) return '';
    const h24 = Math.floor(m / 60) % 24, min = m % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(min).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

// ---------- State ----------
function buildTimesheetState() {
    const today = tsToday();
    const workdays = tsPayRunWorkdays(today);
    const records = {};
    TIMESHEET_SAMPLE_RECORDS.forEach(r => {
        const date = workdays[r.workday];
        if (!date || tsDayDiff(date, today) < 0) return;            // never seed a future day
        const iso = tsIso(date);
        records[iso] = { date: iso, siteId: r.site, start: r.start, finish: r.finish, breakMins: r.breakMins,
                         netHours: tsComputeShift(r.start, r.finish, r.breakMins).net, notes: r.notes, status: 'logged' };
    });
    return {
        records,
        drafts: {},
        historyStart: tsPayRunStart(today),   // no records exist before this, so earlier days are not "gaps"
        selected: tsIso(today),
        crewOpen: false
    };
}
const timesheetState = buildTimesheetState();

function tsPlannedSite(d) {
    const i = tsWorkdayIndex(d);
    return i >= 0 ? TIMESHEET_PLANNED_SITES[i % TIMESHEET_PLANNED_SITES.length] : TIMESHEET_SITE_ORDER[0];
}

// 'logged' | 'missing' (a past workday with nothing saved) | 'today' | 'upcoming' | 'weekend' | 'none'
function tsDayStatus(d) {
    const iso = tsIso(d), today = tsToday();
    if (timesheetState.records[iso]) return 'logged';
    if (tsIsWeekend(d)) return 'weekend';
    const diff = tsDayDiff(today, d);
    if (diff > 0) return 'upcoming';
    if (diff === 0) return 'today';
    if (tsDayDiff(timesheetState.historyStart, d) < 0) return 'none';
    return 'missing';
}

// What the editor shows for a day: an unsaved draft, else the saved record, else the planned defaults
function tsEditorValues(iso) {
    const draft = timesheetState.drafts[iso];
    if (draft) return draft;
    const rec = timesheetState.records[iso];
    if (rec) return { siteId: rec.siteId, start: rec.start, finish: rec.finish, breakMins: rec.breakMins, notes: rec.notes };
    return { siteId: tsPlannedSite(tsFromIso(iso)), start: TIMESHEET_CONFIG.defaultStart,
             finish: TIMESHEET_CONFIG.defaultFinish, breakMins: TIMESHEET_CONFIG.defaultBreakMins, notes: '' };
}
function tsIsDirty(iso) {
    const draft = timesheetState.drafts[iso];
    if (!draft) return false;
    const rec = timesheetState.records[iso];
    const base = rec ? { siteId: rec.siteId, start: rec.start, finish: rec.finish, breakMins: rec.breakMins, notes: rec.notes }
                     : { siteId: tsPlannedSite(tsFromIso(iso)), start: TIMESHEET_CONFIG.defaultStart,
                         finish: TIMESHEET_CONFIG.defaultFinish, breakMins: TIMESHEET_CONFIG.defaultBreakMins, notes: '' };
    return ['siteId', 'start', 'finish', 'breakMins', 'notes'].some(k => String(draft[k]) !== String(base[k]));
}

// ---------- Derived figures ----------
function tsPayRunSummary() {
    const today = tsToday();
    const workdays = tsPayRunWorkdays(today);
    const done = workdays.filter(d => tsDayDiff(d, today) >= 0 && timesheetState.records[tsIso(d)]).length;
    const start = tsPayRunStart(today);
    let hours = 0;
    for (let i = 0; i < TIMESHEET_CONFIG.payRunLengthDays; i++) {
        const rec = timesheetState.records[tsIso(tsAddDays(start, i))];
        if (rec) hours += rec.netHours;
    }
    return { done, total: workdays.length, hours };
}

// Four Mon-Fri weeks for the chart: from the week of the month's first weekday, moved later if needed so
// the selected day is always on it
function tsChartWeeks(selected) {
    let first = new Date(selected.getFullYear(), selected.getMonth(), 1);
    while (tsIsWeekend(first)) first = tsAddDays(first, 1);
    let monday = getMondayForDate(first);
    const selMonday = getMondayForDate(tsIsWeekend(selected) ? tsAddDays(selected, -2) : selected);
    const weeksIn = Math.floor(tsDayDiff(monday, selMonday) / 7);
    if (weeksIn > 3) monday = tsAddDays(selMonday, -21);
    return [0, 1, 2, 3].map(w => [0, 1, 2, 3, 4].map(i => tsAddDays(monday, w * 7 + i)));
}

function tsGapLabel(weeks) {
    const gaps = weeks.flat().filter(d => tsDayStatus(d) === 'missing');
    if (!gaps.length) return '';
    const thisMonday = getMondayForDate(tsToday());
    const weeksAgo = new Set(gaps.map(d => Math.floor(tsDayDiff(getMondayForDate(d), thisMonday) / 7)));
    const n = gaps.length, noun = n === 1 ? 'GAP' : 'GAPS';
    if (weeksAgo.size === 1) {
        const w = [...weeksAgo][0];
        if (w === 0) return `${n} ${noun} THIS WEEK`;
        if (w === 1) return `${n} ${noun} LAST WEEK`;
    }
    return `${n} ${noun} THIS MONTH`;
}

// Crew logs for a day and site: only for days that have happened
function tsCrewLogs(iso, siteId) {
    const d = tsFromIso(iso);
    if (tsDayDiff(tsToday(), d) > 0 || tsIsWeekend(d)) return [];
    const wd = Math.max(0, tsWorkdayIndex(d));
    return (TIMESHEET_SITE_CREW[siteId] || []).map(c => ({
        name: c.name, start: c.start, finish: c.finish, breakMins: c.breakMins,
        netHours: tsComputeShift(c.start, c.finish, c.breakMins).net,
        task: c.tasks[wd % c.tasks.length]
    }));
}

// ---------- Rendering ----------
function tsEscape(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function tsSelectedDate() { return tsFromIso(timesheetState.selected); }

// "Fri 13 Nov" (en-AU puts a comma after the weekday)
function tsShortDate(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
}
function tsTitleFor(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '');
}

function renderTimesheetTitle() {
    const view = document.getElementById('view-time');
    if (!view) return;
    const title = tsTitleFor(tsSelectedDate());
    view.dataset.barTitle = title;
    if (currentActiveViewName === 'time') {
        const el = document.getElementById('nav-inline-title');
        if (el) el.textContent = title;
    }
}

function renderTimesheetStrip() {
    const strip = document.getElementById('ts-week-strip');
    if (!strip) return;
    const sel = tsSelectedDate();
    const monday = getMondayForDate(sel);
    const r = 15, circ = 2 * Math.PI * r;
    strip.innerHTML = TS_WEEKDAY_INITIALS.map((initial, i) => {
        const d = tsAddDays(monday, i), iso = tsIso(d), status = tsDayStatus(d);
        const isSel = iso === timesheetState.selected;
        const label = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
        const statusText = { logged: 'logged', missing: 'missing', today: 'today, not logged', upcoming: 'upcoming', weekend: 'weekend', none: '' }[status];
        return `<button type="button" class="ts-day is-${status}${isSel ? ' is-selected' : ''}" onclick="selectTimesheetDate('${iso}')"
                        aria-label="${label}${statusText ? ', ' + statusText : ''}" aria-pressed="${isSel}">
                    <span class="ts-day-ring">
                        <svg viewBox="0 0 36 36" aria-hidden="true">
                            <circle class="ts-day-track" cx="18" cy="18" r="${r}"/>
                            <circle class="ts-day-fill" cx="18" cy="18" r="${r}" stroke-dasharray="${circ.toFixed(2)}"
                                    stroke-dashoffset="${(status === 'logged' || status === 'missing') ? 0 : circ.toFixed(2)}"/>
                            ${tsMiniOvertimeLap(timesheetState.records[iso], r, circ)}
                        </svg>
                        <span class="ts-day-initial">${initial}</span>
                    </span>
                    <span class="ts-day-num">${d.getDate()}</span>
                </button>`;
    }).join('');
}

// ---------- Overtime laps (Apple Fitness) ----------
// Progress is measured in laps: 1 = the 8h target, 1.5 = 12h. Past one lap a second, brighter arc runs over
// the first from 12 o'clock; a dark shadow sits behind its rounded leading tip so the overlap reads clearly.
const TS_MAX_LAPS = 2;
function tsLaps(hours) { return Math.max(0, Math.min(TS_MAX_LAPS, hours / TIMESHEET_CONFIG.targetHours)); }
function tsTipPoint(cx, cy, r, lapFraction) {
    const a = (lapFraction * 360 - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// A week-strip ring's second lap (static: the strip re-renders on each change)
function tsMiniOvertimeLap(rec, r, circ) {
    if (!rec) return '';
    const over = tsLaps(rec.netHours) - 1;
    if (over <= 0.001) return '';
    const tip = tsTipPoint(18, 18, r, over);
    // The strip's svg is rotated -90deg, so the tip is placed in that rotated space: swap back to unrotated
    // coordinates by rotating the point +90deg about the centre
    const tx = 18 - (tip.y - 18), ty = 18 + (tip.x - 18);
    return `<circle class="ts-ring-tip ts-ring-tip--mini" cx="${tx.toFixed(2)}" cy="${ty.toFixed(2)}" r="1.75"/>
            <circle class="ts-day-lap2" cx="18" cy="18" r="${r}" stroke-dasharray="${circ.toFixed(2)}"
                    stroke-dashoffset="${(circ * (1 - over)).toFixed(2)}"/>`;
}

// Hero ring: one progress value in laps, eased with rAF so lap 1 fills and then lap 2 wraps on past
// 12 o'clock, in order, from wherever the ring is right now (a new day mid-animation just re-targets)
let tsHeroLaps = 0;
let tsHeroAnim = 0;
function tsDrawHeroLaps(laps) {
    const lap1 = Math.min(1, laps), lap2 = Math.max(0, laps - 1);
    document.getElementById('ts-hero-fill').style.strokeDashoffset = (TS_RING_CIRC * (1 - lap1)).toFixed(2);
    document.getElementById('ts-hero-lap2').style.strokeDashoffset = (TS_RING_CIRC * (1 - lap2)).toFixed(2);
    const tipEl = document.getElementById('ts-hero-tip');
    if (lap2 > 0.001) {
        const tip = tsTipPoint(95, 95, TS_RING_RADIUS, lap2);
        tipEl.setAttribute('cx', tip.x.toFixed(2));
        tipEl.setAttribute('cy', tip.y.toFixed(2));
        tipEl.setAttribute('opacity', '1');
    } else {
        tipEl.setAttribute('opacity', '0');
    }
}
function tsAnimateHeroTo(target) {
    cancelAnimationFrame(tsHeroAnim);
    const from = tsHeroLaps, delta = target - from;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (Math.abs(delta) < 0.0005 || reduce) {
        tsHeroLaps = target;
        tsDrawHeroLaps(target);
        return;
    }
    // Longer travel takes a little longer, so a second lap doesn't rush
    const duration = 520 + 380 * Math.min(1.5, Math.abs(delta));
    const t0 = performance.now();
    const step = now => {
        const t = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - t, 3);                     // ease-out cubic
        tsHeroLaps = from + delta * e;
        tsDrawHeroLaps(tsHeroLaps);
        if (t < 1) tsHeroAnim = requestAnimationFrame(step);
    };
    tsHeroAnim = requestAnimationFrame(step);
}

// Start the hero ring from empty (a new day); saving the same day still animates on from where it is
function tsRestartHeroRing() {
    cancelAnimationFrame(tsHeroAnim);
    tsHeroLaps = 0;
    tsDrawHeroLaps(0);
}

function renderTimesheetHero() {
    const sel = tsSelectedDate(), iso = timesheetState.selected;
    const status = tsDayStatus(sel), rec = timesheetState.records[iso];
    const hero = document.getElementById('ts-hero');
    if (!hero) return;
    const target = TIMESHEET_CONFIG.targetHours;
    tsAnimateHeroTo(rec ? tsLaps(rec.netHours) : 0);
    hero.dataset.status = status;

    const ot = document.getElementById('ts-hero-ot');
    const overtime = rec ? Math.round((rec.netHours - target) * 10) / 10 : 0;
    ot.hidden = !(overtime > 0);
    ot.textContent = overtime > 0 ? `+${overtime.toFixed(1)}h OT` : '';

    const hours = document.getElementById('ts-hero-hours');
    const sub = document.getElementById('ts-hero-sub');
    const site = document.getElementById('ts-hero-site');
    const siteId = rec ? rec.siteId : tsEditorValues(iso).siteId;
    if (rec) {
        hours.textContent = tsFormatHours(rec.netHours);
        sub.textContent = `of ${tsFormatHours(target)}`;
    } else if (status === 'upcoming') {
        hours.textContent = '—';
        sub.textContent = 'Upcoming';
    } else if (status === 'weekend' || status === 'none') {
        hours.textContent = '—';
        sub.textContent = status === 'weekend' ? 'Weekend' : 'No timesheet';
    } else {
        hours.textContent = tsFormatHours(0);
        sub.textContent = status === 'missing' ? 'Not logged' : 'Not logged yet';
    }
    site.textContent = (status === 'weekend' && !rec) ? '' : (TIMESHEET_SITES[siteId] || {}).name || '';
}

function renderTimesheetStats() {
    const s = tsPayRunSummary();
    document.getElementById('ts-payrun-done').textContent = `${s.done}/${s.total}`;
    document.getElementById('ts-fortnight-hours').textContent = (Math.round(s.hours * 10) / 10).toFixed(1);
}

let tsChartKey = '';
function renderTimesheetChart() {
    const chart = document.getElementById('ts-chart');
    if (!chart) return;
    const sel = tsSelectedDate();
    const weeks = tsChartWeeks(sel);
    const key = tsIso(weeks[0][0]);
    const month = sel.getMonth();

    // Rebuild only when the four weeks change, so bars keep their elements and animate between values
    if (key !== tsChartKey) {
        tsChartKey = key;
        chart.innerHTML = weeks.map((week, w) => `
            <div class="ts-chart-week">
                <div class="ts-chart-bars">
                    ${week.map(d => `<button type="button" class="ts-bar" data-iso="${tsIso(d)}" onclick="selectTimesheetDate('${tsIso(d)}', { fromChart: true })">
                        <span class="ts-bar-fill"></span></button>`).join('')}
                </div>
                <span class="ts-chart-label">WK ${w + 1}</span>
            </div>`).join('');
    }
    chart.querySelectorAll('.ts-bar').forEach(bar => {
        const d = tsFromIso(bar.dataset.iso), status = tsDayStatus(d), rec = timesheetState.records[bar.dataset.iso];
        bar.className = `ts-bar is-${status}${bar.dataset.iso === timesheetState.selected ? ' is-selected' : ''}${d.getMonth() !== month ? ' is-other-month' : ''}`;
        // Height: 4h at the floor, 10h at the top, so the usual 7.5-9.5h day still shows its differences
        const h = rec ? Math.max(0.14, Math.min(1, (rec.netHours - 4) / 6)) : 0;
        bar.style.setProperty('--h', h.toFixed(3));
        const label = tsShortDate(d);
        bar.setAttribute('aria-label', `${label}: ${rec ? tsFormatHours(rec.netHours) : status === 'missing' ? 'missing' : status}`);
        bar.setAttribute('aria-pressed', String(bar.dataset.iso === timesheetState.selected));
    });

    const gap = tsGapLabel(weeks);
    const gapEl = document.getElementById('ts-gap');
    gapEl.hidden = !gap;
    document.getElementById('ts-gap-label').textContent = gap;
    document.getElementById('ts-chart-month').textContent = sel.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

function renderTimesheetEditor() {
    const iso = timesheetState.selected, d = tsFromIso(iso);
    const status = tsDayStatus(d), vals = tsEditorValues(iso), site = TIMESHEET_SITES[vals.siteId];
    const isFuture = tsDayDiff(tsToday(), d) > 0;

    document.getElementById('ts-editor-title').textContent =
        `${tsShortDate(d)} • ${site.name}`;
    document.getElementById('ts-editor-address').textContent = site.short;

    const pill = document.getElementById('ts-editor-status');
    const pillText = { logged: 'LOGGED', missing: 'MISSING', upcoming: 'UPCOMING', today: 'TODAY', weekend: 'WEEKEND', none: 'NOT LOGGED' }[status];
    pill.textContent = pillText;
    pill.className = `ts-status-pill is-${status}`;

    document.querySelectorAll('#ts-site-select .ts-seg').forEach(b => {
        const on = b.dataset.site === vals.siteId;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
    document.getElementById('ts-start').value = vals.start;
    document.getElementById('ts-finish').value = vals.finish;
    document.querySelectorAll('#ts-break-select .ts-seg').forEach(b => {
        const on = Number(b.dataset.break) === Number(vals.breakMins);
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
    document.getElementById('ts-notes').value = vals.notes;

    const form = document.getElementById('ts-editor');
    form.classList.toggle('is-locked', isFuture);
    form.querySelectorAll('input, textarea, .ts-seg').forEach(el => { el.disabled = isFuture; });

    renderTimesheetCrew();
    updateTimesheetComputed();
}

// Net hours, the unsaved-changes note and the save button: refreshed on every keystroke
function updateTimesheetComputed() {
    const iso = timesheetState.selected, vals = tsEditorValues(iso);
    const shift = tsComputeShift(vals.start, vals.finish, vals.breakMins);
    const net = document.getElementById('ts-net');
    const msg = document.getElementById('ts-net-message');
    net.textContent = shift.valid ? tsFormatHours(shift.net) : '—';
    net.classList.toggle('is-invalid', !shift.valid);
    msg.textContent = shift.valid ? (shift.overnight ? 'Overnight shift' : '') : shift.message;
    msg.classList.toggle('is-invalid', !shift.valid);

    document.getElementById('ts-draft-note').hidden = !tsIsDirty(iso);

    const btn = document.getElementById('ts-save');
    const label = document.getElementById('ts-save-label');
    if (!btn.classList.contains('is-saved')) {
        label.textContent = timesheetState.records[iso] ? 'Update Timesheet' : 'Save Timesheet';
    }
    const isFuture = tsDayDiff(tsToday(), tsFromIso(iso)) > 0;
    btn.disabled = isFuture || !shift.valid;
    document.getElementById('ts-save-hint').textContent = isFuture ? 'You can log this day once it starts' : '';
}

function renderTimesheetCrew() {
    const iso = timesheetState.selected, vals = tsEditorValues(iso);
    const logs = tsCrewLogs(iso, vals.siteId);
    const site = TIMESHEET_SITES[vals.siteId];
    document.getElementById('ts-crew-link-count').textContent = logs.length ? String(logs.length) : '';
    const list = document.getElementById('ts-crew-list');
    if (!logs.length) {
        const future = tsDayDiff(tsToday(), tsFromIso(iso)) > 0;
        list.innerHTML = `<p class="ts-crew-empty">${future ? 'Crew logs show up once the day has started.' : `No crew logs at ${tsEscape(site.name)} for this day.`}</p>`;
    } else {
        list.innerHTML = logs.map((c, i) => `
            <div class="ts-crew-row">
                ${typeof renderRoleAvatar === 'function' ? renderRoleAvatar(c.name, 'md') : ''}
                <div class="ts-crew-body">
                    <div class="ts-crew-top">
                        <span class="ts-crew-name">${tsEscape(c.name)}</span>
                        <button type="button" class="ts-copy-btn" onclick="copyTimesheetCrewFormat(${i}, this)" aria-label="Copy ${tsEscape(c.name)}'s times and task into your timesheet">
                            <i class="ph-bold ph-copy" aria-hidden="true"></i><span>Copy format</span>
                        </button>
                    </div>
                    <span class="ts-crew-times">${tsFormatClock(c.start)} – ${tsFormatClock(c.finish)} · ${tsFormatHours(c.netHours)}${c.breakMins ? '' : ' · no break'}</span>
                    <p class="ts-crew-task">${tsEscape(c.task)}</p>
                </div>
            </div>`).join('');
    }
    document.getElementById('ts-crew-context').textContent =
        `${tsShortDate(tsFromIso(iso))} · ${site.name}`;
    syncTimesheetCrewDrawer();
}

function syncTimesheetCrewDrawer() {
    const open = timesheetState.crewOpen;
    document.getElementById('ts-crew-drawer').classList.toggle('is-open', open);
    document.getElementById('ts-crew-drawer').setAttribute('aria-hidden', String(!open));
    document.getElementById('ts-crew-drawer-inner').inert = !open;
    document.getElementById('ts-crew-link').setAttribute('aria-expanded', String(open));
    document.getElementById('ts-crew-link-label').textContent = open ? 'Hide crew logs' : 'See crew logs for this day';
    const navBtn = document.getElementById('ts-nav-crew');
    if (navBtn) {
        navBtn.classList.toggle('is-active', open);
        navBtn.setAttribute('aria-expanded', String(open));
    }
}

function renderTimesheets() {
    renderTimesheetTitle();
    renderTimesheetStrip();
    renderTimesheetHero();
    renderTimesheetStats();
    renderTimesheetChart();
    renderTimesheetEditor();
}

// ---------- Actions ----------
function selectTimesheetDate(iso, opts = {}) {
    if (iso !== timesheetState.selected) {
        triggerHaptic('light');
        timesheetState.selected = iso;     // any unsaved edits stay in drafts[] for when the day is reopened
        tsRestartHeroRing();               // each day's ring draws in from empty, like opening it fresh
        resetTimesheetSaveButton();
        renderTimesheets();
    }
    if (opts.fromChart) {
        // Bring the editor up if it's mostly below the fold
        const editor = document.getElementById('ts-editor');
        const view = document.getElementById('view-time');
        if (editor && view && editor.getBoundingClientRect().top > view.getBoundingClientRect().bottom - 160) {
            tsScrollViewTo(editor);
        }
    }
}

// Scroll only the Time screen (scrollIntoView would also scroll the clipped stage that holds every screen)
function tsScrollViewTo(el) {
    const view = document.getElementById('view-time');
    if (!view || !el) return;
    const bar = document.getElementById('app-top-bar');
    const barBottom = bar ? bar.getBoundingClientRect().bottom : view.getBoundingClientRect().top;
    const top = view.scrollTop + el.getBoundingClientRect().top - barBottom - 8;
    view.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function tsUpdateDraft(patch) {
    const iso = timesheetState.selected;
    timesheetState.drafts[iso] = Object.assign({}, tsEditorValues(iso), patch);
    if (!tsIsDirty(iso)) delete timesheetState.drafts[iso];
    resetTimesheetSaveButton();
}

function setTimesheetSite(siteId) {
    if (tsEditorValues(timesheetState.selected).siteId === siteId) return;
    triggerHaptic('light');
    tsUpdateDraft({ siteId });
    renderTimesheetEditor();               // header address and the crew drawer follow the site
}
function setTimesheetBreak(mins) {
    triggerHaptic('light');
    tsUpdateDraft({ breakMins: mins });
    document.querySelectorAll('#ts-break-select .ts-seg').forEach(b => {
        const on = Number(b.dataset.break) === mins;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
    updateTimesheetComputed();
}
function onTimesheetInput() {
    tsUpdateDraft({
        start: document.getElementById('ts-start').value,
        finish: document.getElementById('ts-finish').value,
        notes: document.getElementById('ts-notes').value
    });
    updateTimesheetComputed();
}

function toggleTimesheetCrew(fromNav) {
    triggerHaptic('light');
    timesheetState.crewOpen = !timesheetState.crewOpen;
    syncTimesheetCrewDrawer();
    if (timesheetState.crewOpen && fromNav) {
        const link = document.getElementById('ts-crew-link');
        setTimeout(() => tsScrollViewTo(link), 60);
    }
}

function copyTimesheetCrewFormat(index, btn) {
    const iso = timesheetState.selected;
    const c = tsCrewLogs(iso, tsEditorValues(iso).siteId)[index];
    if (!c) return;
    triggerHaptic('success');
    tsUpdateDraft({ start: c.start, finish: c.finish, breakMins: c.breakMins, notes: c.task });
    const vals = tsEditorValues(iso);
    document.getElementById('ts-start').value = vals.start;
    document.getElementById('ts-finish').value = vals.finish;
    document.getElementById('ts-notes').value = vals.notes;
    document.querySelectorAll('#ts-break-select .ts-seg').forEach(b => {
        const on = Number(b.dataset.break) === Number(vals.breakMins);
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
    updateTimesheetComputed();

    if (btn) {
        btn.classList.add('is-copied');
        btn.querySelector('span').textContent = 'Copied';
        btn.querySelector('i').className = 'ph-bold ph-check';
        clearTimeout(btn._tsTimer);
        btn._tsTimer = setTimeout(() => {
            btn.classList.remove('is-copied');
            btn.querySelector('span').textContent = 'Copy format';
            btn.querySelector('i').className = 'ph-bold ph-copy';
        }, 1600);
    }
}

let tsSaveTimer = null;
function resetTimesheetSaveButton() {
    const btn = document.getElementById('ts-save');
    if (!btn || !btn.classList.contains('is-saved')) return;
    clearTimeout(tsSaveTimer);
    btn.classList.remove('is-saved');
    document.getElementById('ts-save-icon').className = 'ph-bold ph-floppy-disk';
}

function saveTimesheet() {
    const iso = timesheetState.selected, d = tsFromIso(iso);
    if (tsDayDiff(tsToday(), d) > 0) return;                         // can't log a day that hasn't happened
    const vals = tsEditorValues(iso);
    const shift = tsComputeShift(vals.start, vals.finish, vals.breakMins);
    if (!shift.valid) { triggerHaptic('error'); updateTimesheetComputed(); return; }

    const wasLogged = !!timesheetState.records[iso];
    // One record per date: updating replaces it, never adds a second
    timesheetState.records[iso] = { date: iso, siteId: vals.siteId, start: vals.start, finish: vals.finish,
                                    breakMins: Number(vals.breakMins), netHours: shift.net, notes: vals.notes.trim(), status: 'logged' };
    delete timesheetState.drafts[iso];
    triggerHaptic('success');

    renderTimesheetStrip();
    renderTimesheetHero();
    renderTimesheetStats();
    renderTimesheetChart();
    renderTimesheetEditor();

    const btn = document.getElementById('ts-save');
    btn.classList.add('is-saved');
    document.getElementById('ts-save-label').textContent = wasLogged ? 'Timesheet updated' : 'Timesheet saved';
    document.getElementById('ts-save-icon').className = 'ph-bold ph-check';
    clearTimeout(tsSaveTimer);
    tsSaveTimer = setTimeout(() => { resetTimesheetSaveButton(); updateTimesheetComputed(); }, 1800);
}

// A fresh open (navigation.js) starts on today with the crew drawer shut; unsaved drafts are kept
function resetTimeView() {
    timesheetState.selected = tsIso(tsToday());
    timesheetState.crewOpen = false;
    tsRestartHeroRing();
    resetTimesheetSaveButton();
    renderTimesheets();
}

function openTimeView() {
    switchTab('time');
}

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('view-time')) return;
    const circ = TS_RING_CIRC.toFixed(2);
    ['ts-hero-fill', 'ts-hero-lap2'].forEach(id => {
        const arc = document.getElementById(id);
        arc.setAttribute('stroke-dasharray', circ);
        arc.style.strokeDashoffset = circ;
    });
    renderTimesheets();
});
