/**
 * Time (Timesheets) screen: week rings, daily ring, pay run stats, monthly gap chart and the inline
 * two-state editor (submitted summary cards / cost-coded time blocks) with the crew logs drawer.
 * Markup lives in #view-time (index.html); styles in styles/timesheets.css; sample data in
 * scripts/data/timesheets.js.
 *
 * One source of truth: `timesheetState.records` (submitted days, keyed by ISO date). Each record holds its
 * time blocks; every figure on screen (rings, bars, 8/10 DONE, fortnight hours, gaps) is summed from them.
 * Edits live in `timesheetState.drafts[iso]` until submitted, so switching days never leaks or loses
 * input. Replace the sample seeding in buildTimesheetState() with an API call to persist for real.
 */

const TS_DAY_MS = 86400000;
const TS_WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TS_HERO_C = 107;                                       // hero ring centre (viewBox 214)
const TS_RING_RADIUS = 87;                                   // (214 - 40) / 2
const TS_RING_CIRC = 2 * Math.PI * TS_RING_RADIUS;
const TS_MAX_LAPS = 2;
let tsBlockSeq = 0;

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
function tsIsFuture(d) { return tsDayDiff(tsToday(), d) > 0; }

function tsPayRunStart(d) {
    const anchor = TIMESHEET_CONFIG.payRunAnchor, len = TIMESHEET_CONFIG.payRunLengthDays;
    return tsAddDays(anchor, Math.floor(tsDayDiff(anchor, d) / len) * len);
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
// "Fri 13 Nov" (en-AU puts a comma after the weekday)
function tsShortDate(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
}
function tsTitleFor(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '');
}

// ---------- Times ----------
function tsMinutes(hhmm) {
    if (!/^\d{1,2}:\d{2}$/.test(hhmm || '')) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
function tsFromMinutes(mins) {
    const m = ((mins % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
// Net hours for one block. A finish earlier than the start runs overnight; anything with no paid time is invalid.
function tsComputeShift(start, finish, breakMins) {
    const s = tsMinutes(start), f = tsMinutes(finish);
    if (s === null || f === null) return { valid: false, net: 0, message: 'Enter a start and finish time' };
    if (s === f) return { valid: false, net: 0, message: 'Finish time is the same as start' };
    const overnight = f < s;
    const gross = (overnight ? f + 1440 : f) - s;
    const net = gross - (Number(breakMins) || 0);
    if (net <= 0) return { valid: false, net: 0, message: 'Block is shorter than the lunch break' };
    if (gross > 16 * 60) return { valid: false, net: 0, message: 'Block is over 16 hours — check the times' };
    return { valid: true, net: Math.round(net / 60 * 100) / 100, overnight };
}
function tsFormatHours(h) { return `${(Math.round(h * 10) / 10).toFixed(1)}h`; }
// "7:00 AM" (crew windows) or "07:00 AM" (summary cards)
function tsFormatClock(hhmm, pad) {
    const m = tsMinutes(hhmm);
    if (m === null) return '';
    const h24 = Math.floor(m / 60) % 24, min = m % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${pad ? String(h12).padStart(2, '0') : h12}:${String(min).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

// ---------- Model ----------
function tsCostCode(code) { return TIMESHEET_COST_CODES.find(c => c.code === code) || null; }
// An editable block (drafts)
function tsNewBlock(src = {}) {
    return {
        id: `blk-${++tsBlockSeq}`,
        code: src.code || '',
        start: src.start || TIMESHEET_CONFIG.defaultStart,
        finish: src.finish || TIMESHEET_CONFIG.defaultFinish,
        breakMins: src.breakMins !== undefined ? Number(src.breakMins) : TIMESHEET_CONFIG.defaultBreakMins,
        task: src.task || '',
        chained: !!src.chained            // start follows the previous line's finish until set by hand
    };
}
// A block as stored on a submitted record (and in crew logs)
function tsStoredBlock(b) {
    const cc = tsCostCode(b.code);
    return { id: `blk-${++tsBlockSeq}`, code: b.code, title: cc ? cc.title : '', start: b.start, finish: b.finish,
             breakMins: Number(b.breakMins), netHours: tsComputeShift(b.start, b.finish, b.breakMins).net, task: (b.task || '').trim() };
}
// Sum of each valid block's own net hours (each block already took off its own lunch)
function tsSumHours(blocks) {
    return Math.round(blocks.reduce((sum, b) => {
        const s = tsComputeShift(b.start, b.finish, b.breakMins);
        return sum + (s.valid ? s.net : 0);
    }, 0) * 100) / 100;
}

function tsRosterSite(d) {
    const i = tsWorkdayIndex(d);
    return i >= 0 ? (TIMESHEET_ROSTER[i % TIMESHEET_ROSTER.length] || null) : null;
}

function buildTimesheetState() {
    const today = tsToday();
    const workdays = tsPayRunWorkdays(today);
    const records = {};
    TIMESHEET_SAMPLE_RECORDS.forEach(r => {
        const date = workdays[r.workday];
        if (!date || tsDayDiff(date, today) < 0) return;            // never seed a future day
        const iso = tsIso(date);
        const blocks = r.blocks.map(tsStoredBlock);
        records[iso] = { userId: TIMESHEET_CONFIG.userId, date: iso, siteId: r.site, rosterRef: tsRosterSite(date),
                         status: 'submitted', approval: r.approval, blocks, totalHours: tsSumHours(blocks),
                         submittedAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 0).toISOString() };
    });
    return {
        records,
        drafts: {},              // iso -> { siteId, blocks } while a day is being edited
        showErrors: {},          // iso -> true after a failed submit, so errors then update live
        historyStart: tsPayRunStart(today),   // no records exist before this, so earlier days are not "gaps"
        selected: tsIso(today),
        crewOpen: false,
        sitePickerOpen: false
    };
}
const timesheetState = buildTimesheetState();

// 'logged' (submitted) | 'missing' (a past workday with nothing submitted) | 'today' | 'upcoming' | 'weekend' | 'none'
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

// Submitted days open read-only (state A) unless an edit is under way; everything else opens in edit mode (B)
function tsMode(iso) {
    return (timesheetState.records[iso] && !timesheetState.drafts[iso]) ? 'submitted' : 'edit';
}

// The draft for a day, created on first need: from the submitted record, else one block at the roster site
function tsDraft(iso) {
    if (!timesheetState.drafts[iso]) {
        const rec = timesheetState.records[iso];
        timesheetState.drafts[iso] = rec
            ? { siteId: rec.siteId, blocks: rec.blocks.map(b => tsNewBlock(b)) }
            : { siteId: tsRosterSite(tsFromIso(iso)), blocks: [tsNewBlock()] };
    }
    return timesheetState.drafts[iso];
}
const TS_BLANK_BLOCK = { code: '', start: TIMESHEET_CONFIG.defaultStart, finish: TIMESHEET_CONFIG.defaultFinish,
                         breakMins: TIMESHEET_CONFIG.defaultBreakMins, task: '' };
function tsIsDirty(iso) {
    const draft = timesheetState.drafts[iso];
    if (!draft) return false;
    const rec = timesheetState.records[iso];
    const base = rec ? { siteId: rec.siteId, blocks: rec.blocks } : { siteId: tsRosterSite(tsFromIso(iso)), blocks: [TS_BLANK_BLOCK] };
    if (draft.siteId !== base.siteId || draft.blocks.length !== base.blocks.length) return true;
    const keys = ['code', 'start', 'finish', 'breakMins', 'task'];
    return draft.blocks.some((b, i) => keys.some(k => String(b[k]) !== String(base.blocks[i][k])));
}
function tsCurrentSiteId(iso) {
    const draft = timesheetState.drafts[iso];
    if (draft) return draft.siteId;
    const rec = timesheetState.records[iso];
    return rec ? rec.siteId : tsRosterSite(tsFromIso(iso));
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
        if (rec) hours += rec.totalHours;
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
    if (Math.floor(tsDayDiff(monday, selMonday) / 7) > 3) monday = tsAddDays(selMonday, -21);
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

// Crew logs for a day and site (same block structure as the worker's own), only for days that have started
function tsCrewLogs(iso, siteId) {
    const d = tsFromIso(iso);
    if (!siteId || tsIsFuture(d) || tsIsWeekend(d)) return [];
    const wd = Math.max(0, tsWorkdayIndex(d));
    return (TIMESHEET_SITE_CREW[siteId] || []).map(c => {
        const blocks = c.plans[(wd + 1) % c.plans.length].map(tsStoredBlock);
        return { name: c.name, blocks, totalHours: tsSumHours(blocks), start: blocks[0].start, finish: blocks[blocks.length - 1].finish };
    });
}

// ---------- Rings (Apple Fitness) ----------
// Progress is measured in laps: 1 = the 8h target, 1.5 = 12h. Past one lap a second, brighter arc runs over
// the first from 12 o'clock; a dark shadow sits behind its rounded leading tip so the overlap reads clearly.
function tsLaps(hours) { return Math.max(0, Math.min(TS_MAX_LAPS, hours / TIMESHEET_CONFIG.targetHours)); }
function tsPolar(cx, cy, r, lapFraction) {
    const a = (lapFraction * 360 - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), deg: lapFraction * 360 };
}

// A week-strip ring (static: the strip re-renders on each change). Arcs are rotated to start at 12 o'clock.
function tsMiniRing(d, status) {
    const r = 15.5, circ = 2 * Math.PI * r, rec = timesheetState.records[tsIso(d)];
    const laps = rec ? tsLaps(rec.totalHours) : (status === 'missing' ? 1 : 0);
    const lap1 = Math.min(1, laps), lap2 = Math.max(0, laps - 1);
    let out = `<circle class="ts-day-track" cx="20" cy="20" r="${r}"/>`;
    if (lap1 > 0) {
        out += `<circle class="ts-day-fill" cx="20" cy="20" r="${r}" transform="rotate(-90 20 20)"
                        stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ * (1 - lap1)).toFixed(2)}"/>`;
    }
    if (lap2 > 0.001) {
        const tip = tsPolar(20, 20, r, lap2);
        out += `<circle class="ts-ring-tip ts-ring-tip--mini" cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="4.25"/>
                <circle class="ts-day-lap2" cx="20" cy="20" r="${r}" transform="rotate(-90 20 20)"
                        stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ * (1 - lap2)).toFixed(2)}"/>`;
    }
    return out;
}

// Hero ring: one progress value in laps, eased with rAF so lap 1 fills and then lap 2 wraps on past
// 12 o'clock, in order, from wherever the ring is right now
let tsHeroLaps = 0;
let tsHeroAnim = 0;
function tsDrawHeroLaps(laps) {
    const lap1 = Math.min(1, laps), lap2 = Math.max(0, laps - 1);
    document.getElementById('ts-hero-fill').style.strokeDashoffset = (TS_RING_CIRC * (1 - lap1)).toFixed(2);
    document.getElementById('ts-hero-lap2').style.strokeDashoffset = (TS_RING_CIRC * (1 - lap2)).toFixed(2);
    const tipEl = document.getElementById('ts-hero-tip');
    if (lap2 > 0.001) {
        const tip = tsPolar(TS_HERO_C, TS_HERO_C, TS_RING_RADIUS, lap2);
        tipEl.setAttribute('cx', tip.x.toFixed(2));
        tipEl.setAttribute('cy', tip.y.toFixed(2));
        tipEl.setAttribute('opacity', '1');
    } else {
        tipEl.setAttribute('opacity', '0');
    }
    // Direction arrow on the leading end, as on the Fitness rings
    const arrow = document.getElementById('ts-hero-arrow');
    const lead = lap2 > 0.001 ? lap2 : lap1;
    if (laps > 0.06) {
        const p = tsPolar(TS_HERO_C, TS_HERO_C, TS_RING_RADIUS, lead - 0.03);
        arrow.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.deg.toFixed(1)})`);
        arrow.setAttribute('opacity', '1');
    } else {
        arrow.setAttribute('opacity', '0');
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
    const duration = 520 + 380 * Math.min(1.5, Math.abs(delta));   // a second lap doesn't rush
    const t0 = performance.now();
    const step = now => {
        const t = Math.min(1, (now - t0) / duration);
        tsHeroLaps = from + delta * (1 - Math.pow(1 - t, 3));       // ease-out cubic
        tsDrawHeroLaps(tsHeroLaps);
        if (t < 1) tsHeroAnim = requestAnimationFrame(step);
    };
    tsHeroAnim = requestAnimationFrame(step);
}
// A new day draws its ring in from empty; submitting the same day animates on from where it is
function tsRestartHeroRing() {
    cancelAnimationFrame(tsHeroAnim);
    tsHeroLaps = 0;
    tsDrawHeroLaps(0);
}

// ---------- Rendering ----------
function tsEscape(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function tsSelectedDate() { return tsFromIso(timesheetState.selected); }

function renderTimesheetTitle() {
    const view = document.getElementById('view-time');
    if (!view) return;
    const d = tsSelectedDate();
    view.dataset.barTitle = tsTitleFor(d);
    if (currentActiveViewName === 'time') {
        const el = document.getElementById('nav-inline-title');
        if (el) el.textContent = view.dataset.barTitle;
        tsFitBarTitle(d);
    }
}
// "Wednesday 11 Nov 2026" can run into the Crew pill on a narrow phone: fall back to "Wed 11 Nov 2026"
function tsFitBarTitle(d) {
    const view = document.getElementById('view-time');
    const el = document.getElementById('nav-inline-title');
    const crew = document.getElementById('ts-nav-crew');
    if (!view || !el || !crew || !crew.offsetWidth) return;
    const overlaps = () => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > crew.getBoundingClientRect().left - 6;
    if (overlaps()) {
        view.dataset.barTitle = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '');
        el.textContent = view.dataset.barTitle;
    }
}

function renderTimesheetStrip() {
    const strip = document.getElementById('ts-week-strip');
    if (!strip) return;
    const monday = getMondayForDate(tsSelectedDate());
    const todayIso = tsIso(tsToday());
    strip.innerHTML = TS_WEEKDAY_INITIALS.map((initial, i) => {
        const d = tsAddDays(monday, i), iso = tsIso(d), status = tsDayStatus(d);
        const isSel = iso === timesheetState.selected;
        const rec = timesheetState.records[iso];
        const label = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
        const statusText = rec ? `${tsFormatHours(rec.totalHours)} logged` : { missing: 'missing', today: 'today, not logged', upcoming: 'upcoming', weekend: 'weekend', none: '' }[status];
        return `<button type="button" class="ts-day is-${status}${isSel ? ' is-selected' : ''}${iso === todayIso ? ' is-today' : ''}" onclick="selectTimesheetDate('${iso}')"
                        aria-label="${label}${statusText ? ', ' + statusText : ''}" aria-pressed="${isSel}">
                    <span class="ts-day-initial">${initial}</span>
                    <svg class="ts-day-ring" viewBox="0 0 40 40" aria-hidden="true">${tsMiniRing(d, status)}</svg>
                </button>`;
    }).join('');
}

function renderTimesheetHero() {
    const sel = tsSelectedDate(), iso = timesheetState.selected;
    const status = tsDayStatus(sel), rec = timesheetState.records[iso];
    const hero = document.getElementById('ts-hero');
    if (!hero) return;
    const target = TIMESHEET_CONFIG.targetHours;
    tsAnimateHeroTo(rec ? tsLaps(rec.totalHours) : 0);
    hero.dataset.status = status;

    const ot = document.getElementById('ts-hero-ot');
    const overtime = rec ? Math.round((rec.totalHours - target) * 10) / 10 : 0;
    ot.hidden = !(overtime > 0);
    ot.textContent = overtime > 0 ? `+${overtime.toFixed(1)}h OT` : '';

    const hours = document.getElementById('ts-hero-hours');
    const sub = document.getElementById('ts-hero-sub');
    if (rec) {
        hours.textContent = tsFormatHours(rec.totalHours);
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
        const h = rec ? Math.max(0.14, Math.min(1, (rec.totalHours - 4) / 6)) : 0;
        bar.style.setProperty('--h', h.toFixed(3));
        bar.setAttribute('aria-label', `${tsShortDate(d)}: ${rec ? tsFormatHours(rec.totalHours) : status === 'missing' ? 'missing' : status}`);
        bar.setAttribute('aria-pressed', String(bar.dataset.iso === timesheetState.selected));
    });

    const gap = tsGapLabel(weeks);
    document.getElementById('ts-gap').hidden = !gap;
    document.getElementById('ts-gap-label').textContent = gap;
    document.getElementById('ts-chart-month').textContent = sel.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

// ----- Editor -----
function renderTimesheetEditor() {
    const iso = timesheetState.selected, d = tsFromIso(iso);
    const status = tsDayStatus(d), mode = tsMode(iso);
    document.getElementById('ts-editor').dataset.mode = mode;

    document.getElementById('ts-editor-title').textContent = tsShortDate(d);
    const pill = document.getElementById('ts-editor-status');
    const editingSubmitted = mode === 'edit' && !!timesheetState.records[iso];
    pill.textContent = editingSubmitted ? 'EDITING' : { logged: 'SUBMITTED', missing: 'MISSING', upcoming: 'UPCOMING', today: 'TODAY', weekend: 'WEEKEND', none: 'NOT LOGGED' }[status];
    pill.className = `ts-status-pill is-${editingSubmitted ? 'editing' : status}`;

    renderTimesheetSiteRow();
    renderTimesheetCrew();

    document.getElementById('ts-submitted').hidden = mode !== 'submitted';
    document.getElementById('ts-edit').hidden = mode !== 'edit';
    if (mode === 'submitted') renderTimesheetSummary();
    else renderTimesheetBlocks();
}

function renderTimesheetSiteRow() {
    const iso = timesheetState.selected, mode = tsMode(iso);
    const siteId = tsCurrentSiteId(iso), site = TIMESHEET_SITES[siteId];
    const roster = tsRosterSite(tsFromIso(iso));
    const row = document.getElementById('ts-site-row');
    row.disabled = mode !== 'edit';
    row.classList.toggle('is-empty', !site);
    document.getElementById('ts-site-name').textContent = site ? site.name : 'Choose a site';
    document.getElementById('ts-site-address').textContent = site ? site.short : 'Not rostered this day';
    const badge = document.getElementById('ts-site-badge');
    // ROSTERED only when the site really is this day's roster assignment; a site picked by hand says so
    if (site && roster === siteId) { badge.hidden = false; badge.textContent = 'ROSTERED'; badge.className = 'ts-site-badge is-rostered'; }
    else if (site) { badge.hidden = false; badge.textContent = 'MANUAL'; badge.className = 'ts-site-badge is-manual'; }
    else badge.hidden = true;
    if (mode !== 'edit') timesheetState.sitePickerOpen = false;
    syncTimesheetSitePicker();
}

function tsApprovalBadge(approval) {
    return approval === 'approved'
        ? '<span class="ts-approval is-approved"><i class="ph-fill ph-check-circle" aria-hidden="true"></i>Approved</span>'
        : '<span class="ts-approval is-awaiting"><i class="ph-fill ph-clock" aria-hidden="true"></i>Awaiting Sign-Off</span>';
}
function tsBlockTimes(b, pad) {
    return `${tsFormatClock(b.start, pad)} – ${tsFormatClock(b.finish, pad)}${Number(b.breakMins) ? ` · ${b.breakMins}m lunch` : ''}`;
}

// State A: one read-only card per block
function renderTimesheetSummary() {
    const rec = timesheetState.records[timesheetState.selected];
    document.getElementById('ts-summary-list').innerHTML = rec.blocks.map((b, i) => `
        <button type="button" class="ts-sum-card" onclick="editTimesheetDay(${i})" aria-label="${tsEscape(b.code)} ${tsEscape(b.title)}, ${tsFormatHours(b.netHours)}. Edit">
            <span class="ts-sum-top">
                <span class="ts-sum-code"><b>${tsEscape(b.code)}</b> · ${tsEscape(b.title)}</span>
                <span class="ts-sum-hours">${tsFormatHours(b.netHours)}</span>
            </span>
            <span class="ts-sum-times">${tsBlockTimes(b, true)}</span>
            ${b.task ? `<span class="ts-sum-task">${tsEscape(b.task)}</span>` : ''}
            <span class="ts-sum-foot">${tsApprovalBadge(rec.approval)}<span class="ts-sum-edit"><i class="ph-bold ph-pencil-simple" aria-hidden="true"></i>Edit</span></span>
        </button>`).join('');
    document.getElementById('ts-summary-total').textContent = tsFormatHours(rec.totalHours);
}

function tsCodeOptions(selected) {
    return `<option value="" disabled${selected ? '' : ' selected'}>Choose cost code</option>` +
        TIMESHEET_COST_CODES.map(c => `<option value="${c.code}"${c.code === selected ? ' selected' : ''}>${c.code} · ${tsEscape(c.title)}</option>`).join('');
}

// State B: editable blocks. Rebuilt only on structural changes (day, add, delete, copy); typing updates in place.
function renderTimesheetBlocks() {
    const draft = tsDraft(timesheetState.selected);
    document.getElementById('ts-block-list').innerHTML = draft.blocks.map((b, i) => `
        <div class="ts-block" data-id="${b.id}">
            <div class="ts-block-head">
                <span class="ts-block-num">${i + 1}</span>
                <label class="ts-code-wrap">
                    <span class="sr-only">Cost code for line ${i + 1}</span>
                    <select class="ts-code${b.code ? '' : ' is-placeholder'}" data-field="code" onchange="onTimesheetBlockInput(this)">${tsCodeOptions(b.code)}</select>
                    <i class="ph-bold ph-caret-down" aria-hidden="true"></i>
                </label>
                ${i > 0 ? `<button type="button" class="ts-block-delete" onclick="deleteTimesheetBlock('${b.id}')" aria-label="Delete line ${i + 1}"><i class="ph-bold ph-x" aria-hidden="true"></i></button>` : ''}
            </div>
            <div class="ts-block-times">
                <label class="ts-field"><span class="ts-field-label">Start</span>
                    <input type="time" class="ts-input" data-field="start" value="${b.start}" oninput="onTimesheetBlockInput(this)" onchange="onTimesheetBlockInput(this)"></label>
                <label class="ts-field"><span class="ts-field-label">Finish</span>
                    <input type="time" class="ts-input" data-field="finish" value="${b.finish}" oninput="onTimesheetBlockInput(this)" onchange="onTimesheetBlockInput(this)"></label>
            </div>
            <div class="ts-block-row">
                <div class="ts-segmented ts-segmented--sm" role="radiogroup" aria-label="Lunch for line ${i + 1}">
                    <button type="button" class="ts-seg${Number(b.breakMins) === 30 ? ' is-active' : ''}" role="radio" aria-checked="${Number(b.breakMins) === 30}" onclick="setTimesheetBlockLunch('${b.id}', 30)">30m lunch</button>
                    <button type="button" class="ts-seg${Number(b.breakMins) === 0 ? ' is-active' : ''}" role="radio" aria-checked="${Number(b.breakMins) === 0}" onclick="setTimesheetBlockLunch('${b.id}', 0)">No lunch</button>
                </div>
                <span class="ts-block-dur" data-role="dur"></span>
            </div>
            <label class="ts-field"><span class="sr-only">Task description for line ${i + 1}</span>
                <input type="text" class="ts-input ts-task" data-field="task" value="${tsEscape(b.task)}" placeholder="What did you work on?" enterkeyhint="done" oninput="onTimesheetBlockInput(this)"></label>
            <p class="ts-block-error" data-role="error" aria-live="polite"></p>
        </div>`).join('');
    updateTimesheetEditComputed();
}

function tsBlockError(b) {
    if (!b.code) return 'Choose a cost code';
    const s = tsComputeShift(b.start, b.finish, b.breakMins);
    if (!s.valid) return s.message;
    if (!String(b.task).trim()) return 'Add a short task description';
    return '';
}

// Durations, errors, total, unsaved note and the submit button: refreshed on every keystroke.
// Returns the first block with an error.
function updateTimesheetEditComputed() {
    const iso = timesheetState.selected, draft = timesheetState.drafts[iso];
    if (!draft) return null;
    const showErrors = !!timesheetState.showErrors[iso];
    let firstError = null;
    draft.blocks.forEach(b => {
        const el = document.querySelector(`#ts-block-list .ts-block[data-id="${b.id}"]`);
        if (!el) return;
        const s = tsComputeShift(b.start, b.finish, b.breakMins);
        const dur = el.querySelector('[data-role="dur"]');
        dur.textContent = s.valid ? tsFormatHours(s.net) : '—';
        dur.classList.toggle('is-invalid', !s.valid);
        const err = tsBlockError(b);
        if (err && !firstError) firstError = el;
        // Times that can't work are flagged straight away; missing details only after a submit attempt
        const timeErr = !s.valid ? s.message : '';
        const msg = showErrors ? err : (timeErr || (s.overnight ? 'Runs overnight' : ''));
        const errEl = el.querySelector('[data-role="error"]');
        errEl.textContent = msg;
        errEl.classList.toggle('is-invalid', !!msg && msg !== 'Runs overnight');
        el.classList.toggle('has-error', !!msg && msg !== 'Runs overnight');
        el.querySelector('.ts-code').classList.toggle('is-placeholder', !b.code);
    });
    document.getElementById('ts-total').textContent = tsFormatHours(tsSumHours(draft.blocks));
    document.getElementById('ts-site-error').textContent = (showErrors && !draft.siteId) ? 'Choose the site you worked at' : '';

    document.getElementById('ts-draft-note').hidden = !tsIsDirty(iso);
    const rec = timesheetState.records[iso];
    document.getElementById('ts-cancel').hidden = !rec;
    const future = tsIsFuture(tsFromIso(iso));
    document.getElementById('ts-submit').disabled = future;
    document.getElementById('ts-submit-label').textContent = rec ? 'Resubmit Timesheet' : 'Submit Timesheet';
    document.getElementById('ts-submit-hint').textContent = future ? 'You can submit this day once it starts' : '';
    return firstError;
}

// ----- Site picker -----
function renderTimesheetSiteList() {
    const q = (document.getElementById('ts-site-search').value || '').trim().toLowerCase();
    const current = tsCurrentSiteId(timesheetState.selected);
    const roster = tsRosterSite(tsFromIso(timesheetState.selected));
    const sites = TIMESHEET_SITE_ORDER.map(id => TIMESHEET_SITES[id])
        .filter(s => !q || s.name.toLowerCase().includes(q) || s.short.toLowerCase().includes(q));
    document.getElementById('ts-site-list').innerHTML = sites.length ? sites.map(s => `
        <button type="button" class="ts-site-option${s.id === current ? ' is-selected' : ''}" role="option" aria-selected="${s.id === current}" onclick="chooseTimesheetSite('${s.id}')">
            <span class="ts-site-option-text"><span class="ts-site-option-name">${tsEscape(s.name)}</span><span class="ts-site-option-addr">${tsEscape(s.short)}</span></span>
            ${s.id === roster ? '<span class="ts-site-badge is-rostered">ROSTERED</span>' : ''}
            <i class="ph-bold ph-check ts-site-check" aria-hidden="true"></i>
        </button>`).join('') : '<p class="ts-site-empty">No sites match</p>';
}
function syncTimesheetSitePicker() {
    const open = timesheetState.sitePickerOpen;
    document.getElementById('ts-site-picker').classList.toggle('is-open', open);
    document.getElementById('ts-site-picker-inner').inert = !open;
    document.getElementById('ts-site-row').setAttribute('aria-expanded', String(open));
}
function toggleTimesheetSitePicker() {
    if (tsMode(timesheetState.selected) !== 'edit') return;
    triggerHaptic('light');
    timesheetState.sitePickerOpen = !timesheetState.sitePickerOpen;
    if (timesheetState.sitePickerOpen) {
        document.getElementById('ts-site-search').value = '';
        renderTimesheetSiteList();
    }
    syncTimesheetSitePicker();
}
function closeTimesheetSitePicker() {
    timesheetState.sitePickerOpen = false;
    syncTimesheetSitePicker();
}
function chooseTimesheetSite(siteId) {
    triggerHaptic('light');
    tsDraft(timesheetState.selected).siteId = siteId;     // the date and the time blocks stay as they are
    timesheetState.sitePickerOpen = false;
    renderTimesheetSiteRow();
    renderTimesheetCrew();                                 // crew logs follow the site
    updateTimesheetEditComputed();
}

// ----- Crew drawer -----
function renderTimesheetCrew() {
    const iso = timesheetState.selected, siteId = tsCurrentSiteId(iso);
    const logs = tsCrewLogs(iso, siteId);
    const site = TIMESHEET_SITES[siteId];
    document.getElementById('ts-crew-link-count').textContent = logs.length ? `(${logs.length})` : '';
    const list = document.getElementById('ts-crew-list');
    if (!logs.length) {
        const msg = !site ? 'Choose a site to see its crew logs.'
            : tsIsFuture(tsFromIso(iso)) ? 'Crew logs show up once the day has started.'
            : `No crew logs at ${tsEscape(site.name)} for this day.`;
        list.innerHTML = `<p class="ts-crew-empty">${msg}</p>`;
    } else {
        list.innerHTML = logs.map((c, i) => `
            <div class="ts-crew-entry">
                <div class="ts-crew-head">
                    ${typeof renderRoleAvatar === 'function' ? renderRoleAvatar(c.name, 'md') : ''}
                    <div class="ts-crew-who">
                        <span class="ts-crew-name">${tsEscape(c.name)}</span>
                        <span class="ts-crew-times">${tsFormatClock(c.start)} – ${tsFormatClock(c.finish)} · ${tsFormatHours(c.totalHours)}</span>
                    </div>
                    <button type="button" class="ts-copy-btn" onclick="copyTimesheetCrewFormat(${i})" aria-label="Copy ${tsEscape(c.name)}'s time blocks into your timesheet">
                        <i class="ph-bold ph-copy" aria-hidden="true"></i><span>Copy format</span>
                    </button>
                </div>
                <ul class="ts-crew-blocks">
                    ${c.blocks.map(b => `<li class="ts-crew-block">
                        <span class="ts-crew-block-top"><span class="ts-crew-block-code"><b>${tsEscape(b.code)}</b> ${tsEscape(b.title)}</span><span class="ts-crew-block-hours">${tsFormatHours(b.netHours)}</span></span>
                        <span class="ts-crew-block-times">${tsBlockTimes(b, false)}</span>
                        <span class="ts-crew-block-task">${tsEscape(b.task)}</span>
                    </li>`).join('')}
                </ul>
            </div>`).join('');
    }
    document.getElementById('ts-crew-context').textContent = `${tsShortDate(tsFromIso(iso))}${site ? ' · ' + site.name : ''}`;
    syncTimesheetCrewDrawer();
}

function syncTimesheetCrewDrawer() {
    const open = timesheetState.crewOpen;
    const drawer = document.getElementById('ts-crew-drawer');
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
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
        tsDropCleanDraft(timesheetState.selected);
        timesheetState.selected = iso;     // unsaved edits stay in drafts[] for when the day is reopened
        timesheetState.sitePickerOpen = false;
        tsRestartHeroRing();
        renderTimesheets();
    }
    if (opts.fromChart) {
        const editor = document.getElementById('ts-editor');
        const view = document.getElementById('view-time');
        if (editor && view && editor.getBoundingClientRect().top > view.getBoundingClientRect().bottom - 160) tsScrollViewTo(editor);
    }
}
// A day opened for editing but left unchanged goes back to how it was (its summary, or a fresh form)
function tsDropCleanDraft(iso) {
    if (timesheetState.drafts[iso] && !tsIsDirty(iso)) {
        delete timesheetState.drafts[iso];
        delete timesheetState.showErrors[iso];
    }
}

// Scroll only the Time screen (scrollIntoView would also scroll the clipped stage that holds every screen)
function tsScrollViewTo(el, behavior = 'smooth') {
    const view = document.getElementById('view-time');
    if (!view || !el) return;
    const bar = document.getElementById('app-top-bar');
    const barBottom = bar ? bar.getBoundingClientRect().bottom : view.getBoundingClientRect().top;
    const top = view.scrollTop + el.getBoundingClientRect().top - barBottom - 8;
    view.scrollTo({ top: Math.max(0, top), behavior });
}

// State A -> B, keeping every block; a tapped card's line is brought into view
function editTimesheetDay(blockIndex) {
    triggerHaptic('light');
    tsDraft(timesheetState.selected);
    renderTimesheetEditor();
    if (typeof blockIndex === 'number') {
        const el = document.querySelectorAll('#ts-block-list .ts-block')[blockIndex];
        if (el) {
            tsScrollViewTo(el);
            el.classList.add('is-flash');
            setTimeout(() => el.classList.remove('is-flash'), 900);
        }
    }
}
function cancelTimesheetEdit() {
    const iso = timesheetState.selected;
    if (!timesheetState.records[iso]) return;
    triggerHaptic('light');
    delete timesheetState.drafts[iso];
    delete timesheetState.showErrors[iso];
    timesheetState.sitePickerOpen = false;
    renderTimesheetEditor();
}

function tsFindBlock(id) {
    const draft = timesheetState.drafts[timesheetState.selected];
    if (!draft) return { draft: null, index: -1 };
    return { draft, index: draft.blocks.findIndex(b => b.id === id) };
}

function onTimesheetBlockInput(input) {
    const el = input.closest('.ts-block');
    const { draft, index } = tsFindBlock(el.dataset.id);
    if (index < 0) return;
    const b = draft.blocks[index], field = input.dataset.field;
    b[field] = input.value;
    if (field === 'start') b.chained = false;          // set by hand: no longer follows the line above
    if (field === 'finish') {
        // The next line starts where this one finishes, unless its start was set by hand
        const next = draft.blocks[index + 1];
        if (next && next.chained) {
            next.start = b.finish;
            const nextEl = document.querySelector(`#ts-block-list .ts-block[data-id="${next.id}"] [data-field="start"]`);
            if (nextEl) nextEl.value = next.start;
        }
    }
    updateTimesheetEditComputed();
}

function setTimesheetBlockLunch(id, mins) {
    const { draft, index } = tsFindBlock(id);
    if (index < 0) return;
    triggerHaptic('light');
    draft.blocks[index].breakMins = mins;
    document.querySelectorAll(`#ts-block-list .ts-block[data-id="${id}"] .ts-seg`).forEach((seg, i) => {
        const on = (i === 0 && mins === 30) || (i === 1 && mins === 0);
        seg.classList.toggle('is-active', on);
        seg.setAttribute('aria-checked', String(on));
    });
    updateTimesheetEditComputed();
}

// + Add Line: starts where the last line finishes, runs 30 minutes, no lunch
function addTimesheetBlock() {
    const draft = tsDraft(timesheetState.selected);
    const last = draft.blocks[draft.blocks.length - 1];
    const start = last ? last.finish : TIMESHEET_CONFIG.defaultStart;
    const startMins = tsMinutes(start);
    const finish = startMins === null ? '' : tsFromMinutes(startMins + 30);
    triggerHaptic('light');
    draft.blocks.push(tsNewBlock({ start, finish, breakMins: 0, chained: true }));
    renderTimesheetBlocks();
    const blocks = document.querySelectorAll('#ts-block-list .ts-block');
    const added = blocks[blocks.length - 1];
    if (added) {
        added.classList.add('is-new');
        const r = added.getBoundingClientRect(), vr = document.getElementById('view-time').getBoundingClientRect();
        if (r.bottom > vr.bottom - 140) tsScrollViewTo(added);
    }
}

function deleteTimesheetBlock(id) {
    const { draft, index } = tsFindBlock(id);
    if (index <= 0 || draft.blocks.length < 2) return;   // the first line stays
    triggerHaptic('light');
    draft.blocks.splice(index, 1);
    renderTimesheetBlocks();
}

function toggleTimesheetCrew(fromNav) {
    triggerHaptic('light');
    timesheetState.crewOpen = !timesheetState.crewOpen;
    syncTimesheetCrewDrawer();
    if (timesheetState.crewOpen && fromNav) setTimeout(() => tsScrollViewTo(document.getElementById('ts-crew-link')), 60);
}

// Copy a crew member's blocks into this day's draft (never submitted, never touching their record)
function copyTimesheetCrewFormat(index) {
    const iso = timesheetState.selected;
    const c = tsCrewLogs(iso, tsCurrentSiteId(iso))[index];
    if (!c) return;
    triggerHaptic('success');
    const draft = tsDraft(iso);
    draft.blocks = c.blocks.map(b => tsNewBlock({ code: b.code, start: b.start, finish: b.finish, breakMins: b.breakMins, task: b.task }));
    renderTimesheetEditor();

    // The drawer re-rendered: mark the new copy of the button
    const btn = document.querySelectorAll('#ts-crew-list .ts-copy-btn')[index];
    if (btn) {
        btn.classList.add('is-copied');
        btn.querySelector('span').textContent = 'Copied';
        btn.querySelector('i').className = 'ph-bold ph-check';
        setTimeout(() => {
            if (!btn.isConnected) return;
            btn.classList.remove('is-copied');
            btn.querySelector('span').textContent = 'Copy format';
            btn.querySelector('i').className = 'ph-bold ph-copy';
        }, 1600);
    }
}

let tsSubmittedTimer = null;
function submitTimesheet() {
    const iso = timesheetState.selected, d = tsFromIso(iso);
    if (tsIsFuture(d)) return;
    const draft = tsDraft(iso);
    if (!draft.siteId || draft.blocks.some(b => tsBlockError(b))) {
        timesheetState.showErrors[iso] = true;
        triggerHaptic('error');
        const firstError = updateTimesheetEditComputed();
        tsScrollViewTo(!draft.siteId ? document.getElementById('ts-site-row') : firstError);
        return;
    }

    const blocks = draft.blocks.map(tsStoredBlock);
    // One record per date: resubmitting replaces it, never adds a second
    timesheetState.records[iso] = { userId: TIMESHEET_CONFIG.userId, date: iso, siteId: draft.siteId, rosterRef: tsRosterSite(d),
                                    status: 'submitted', approval: 'awaiting', blocks, totalHours: tsSumHours(blocks),
                                    submittedAt: new Date().toISOString() };
    delete timesheetState.drafts[iso];
    delete timesheetState.showErrors[iso];
    timesheetState.sitePickerOpen = false;
    triggerHaptic('success');

    renderTimesheetStrip();
    renderTimesheetHero();
    renderTimesheetStats();
    renderTimesheetChart();
    renderTimesheetEditor();
    document.getElementById('view-time').scrollTo({ top: 0, behavior: 'smooth' });   // watch the rings update

    const note = document.getElementById('ts-submitted-note');
    note.hidden = false;
    clearTimeout(tsSubmittedTimer);
    tsSubmittedTimer = setTimeout(() => { note.hidden = true; }, 2400);
}

// A fresh open (navigation.js) starts on today with the drawers shut; edits in progress are kept
function resetTimeView() {
    Object.keys(timesheetState.drafts).forEach(tsDropCleanDraft);
    timesheetState.selected = tsIso(tsToday());
    timesheetState.crewOpen = false;
    timesheetState.sitePickerOpen = false;
    tsRestartHeroRing();
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
    const search = document.getElementById('ts-site-search');
    search.addEventListener('input', renderTimesheetSiteList);
    search.addEventListener('keydown', e => { if (e.key === 'Escape') closeTimesheetSitePicker(); });
    renderTimesheets();
});
