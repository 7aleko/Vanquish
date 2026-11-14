/**
 * Timesheets screen: week strip, daily ring, the fortnight Pay Run card, the selected day's submitted
 * cost-coded blocks, a floating action button and a slide-up sheet holding the cost-coded editor, with the
 * crew logs drawer. Markup lives in #view-time and #ts-sheet-overlay (index.html); styles in
 * styles/timesheets.css; sample data in scripts/data/timesheets.js.
 *
 * Layers: this file is presentation only.
 *  - Data: submitted days come from the server-state cache (getTimesheetsByDate, scripts/application/
 *    selectors.js) - `timesheetState.records` is a read-only view of it. Crew logs, cost codes, sites and the
 *    roster come from selectors too.
 *  - Rules: net hours, block validity, pay runs and the site assignment are domain rules
 *    (scripts/domain/rules/); the ts* helpers below only adapt them for this screen.
 *  - Changes: submitting goes through timesheetService.submit (scripts/application/services/), which
 *    validates, saves through the repository and updates the cache. Nothing here saves a record.
 *  - UI state stays here: `timesheetState.selected` (the one selected date; the strip, ring, Pay Run chart,
 *    day card, button and sheet all read it), the sheet / picker / drawer state, and the unsaved edits in
 *    `timesheetState.drafts[iso]`, so closing the sheet or switching days never loses input.
 *
 * Sites are relational: records, drafts and crew logs store a siteId and every name / address is resolved
 * through SITES (scripts/application/selectors.js). The rostered site for a date comes from ROSTER for the
 * signed-in employee. Each record and draft carries a siteAssignmentType:
 *   'rostered'   - the day's roster site (ROSTERED badge)
 *   'override'   - a different site chosen by hand on a rostered day (TRANSFERRED / SPLIT badge)
 *   'unrostered' - a site chosen on a day with no roster entry (MANUAL badge)
 * The roster itself is never changed by a timesheet.
 */

const TS_WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TS_HERO_C = 107;                                       // hero ring centre (viewBox 214)
const TS_RING_RADIUS = 87;                                   // (214 - 40) / 2
const TS_RING_CIRC = 2 * Math.PI * TS_RING_RADIUS;
const TS_MAX_LAPS = 2;
let tsBlockSeq = 0;

// ---------- Dates (DateRules / PayRunRules, scripts/domain/rules/) ----------
function tsToday() { return appClock.today(); }
function tsIso(d) { return DateRules.toIso(d); }
function tsFromIso(iso) { return DateRules.fromIso(iso); }
function tsAddDays(d, n) { return DateRules.addDays(d, n); }
function tsDayDiff(a, b) { return DateRules.dayDiff(a, b); }
function tsIsWeekend(d) { return DateRules.isWeekend(d); }
function tsIsFuture(d) { return tsDayDiff(tsToday(), d) > 0; }

function tsPayRunStart(d) { return PayRunRules.startOf(d, PAY_RUN_POLICY); }
// The weekdays (Mon-Fri) of the pay run containing `d`
function tsPayRunWorkdays(d) { return PayRunRules.workdays(d, PAY_RUN_POLICY); }
function tsWorkdayIndex(d) { return PayRunRules.workdayIndex(d, PAY_RUN_POLICY); }
// "Fri 13 Nov" (en-AU puts a comma after the weekday)
function tsShortDate(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
}
function tsTitleFor(d) {
    return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '');
}

// ---------- Times (TimeRules, scripts/domain/rules/time.js) ----------
function tsMinutes(hhmm) { return TimeRules.minutes(hhmm); }
function tsFromMinutes(mins) { return TimeRules.fromMinutes(mins); }
function tsComputeShift(start, finish, breakMins) { return TimeRules.computeShift(start, finish, breakMins); }
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
function tsCostCode(code) { return getCostCode(code); }
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
// A stored block (a submitted day's or a crew log's) as this screen shows it: with its cost code's title
// and net hours derived
function tsBlockView(b) {
    const cc = tsCostCode(b.code);
    return { id: b.id, code: b.code, title: cc ? cc.title : '', start: b.start, finish: b.finish,
             breakMins: Number(b.breakMins), netHours: tsComputeShift(b.start, b.finish, b.breakMins).net, task: b.task || '' };
}
// Sum of each valid block's own net hours (each block already took off its own lunch)
function tsSumHours(blocks) { return TimeRules.sumHours(blocks); }

// ---------- Sites & roster (scripts/application/selectors.js) ----------
// The signed-in employee's rostered site for a day (ROSTER), or null
function tsRosterSite(d) {
    return getRosteredSiteId(d, getCurrentEmployeeId());
}
// How a day's site was arrived at (see the header)
function tsAssignmentType(iso, siteId) {
    return TimesheetRules.assignmentType(tsRosterSite(tsFromIso(iso)), siteId);
}

// The signed-in employee's submitted days, keyed by date, as this screen shows them (derived titles, net
// hours and totals; `approval` for the status pill). Read-only: rebuilt when the cache changes.
function tsRecordsView() {
    const employeeId = getCurrentEmployeeId();
    return appStore.memo(`tsRecordsView:${employeeId}`, ['timesheets', 'costCodes'], () => {
        const byDate = getTimesheetsByDate(employeeId), view = {};
        Object.keys(byDate).forEach(iso => {
            const t = byDate[iso], blocks = t.blocks.map(tsBlockView);
            view[iso] = { ...t, blocks, totalHours: tsSumHours(t.blocks),
                          approval: t.status === TimesheetStatus.APPROVED ? 'approved' : 'awaiting' };
        });
        return Object.freeze(view);
    });
}

// UI state only. `records` reads the server-state cache (it can't be assigned).
function buildTimesheetState() {
    const today = tsToday();
    const prevStart = tsAddDays(tsPayRunStart(today), -TIMESHEET_CONFIG.payRunLengthDays);
    return {
        get records() { return tsRecordsView(); },
        drafts: {},              // iso -> { siteId, siteAssignmentType, blocks } while a day is being edited
        showErrors: {},          // iso -> true after a failed submit, so errors then update live
        historyStart: prevStart,  // no records exist before this, so earlier days are not "gaps"
        selected: tsIso(today),
        crewOpen: false,
        sitePickerOpen: false,
        sheetOpen: false,
        editingIndex: -1          // the block the sheet was opened for (highlighted)
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

// The draft for a day, created on first need: from the submitted record, else one block at the roster site
function tsDraft(iso) {
    if (!timesheetState.drafts[iso]) {
        const rec = timesheetState.records[iso];
        const siteId = rec ? rec.siteId : tsRosterSite(tsFromIso(iso));
        timesheetState.drafts[iso] = {
            siteId,
            // a submitted day keeps the assignment it was submitted with; a new day starts at its roster site
            siteAssignmentType: rec ? (rec.siteAssignmentType || tsAssignmentType(iso, siteId)) : tsAssignmentType(iso, siteId),
            blocks: rec ? rec.blocks.map(b => tsNewBlock(b)) : [tsNewBlock()]
        };
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
// The pay run shown on the Pay Run card is always the one holding the selected day
function tsSelectedRunStart() { return tsPayRunStart(tsSelectedDate()); }
function tsRunWorkdays(start) { return tsPayRunWorkdays(start); }
// Workdays of a run that count: started (today or earlier) and inside the history we hold
function tsRunEligible(start) {
    const today = tsToday();
    return tsRunWorkdays(start).filter(d => tsDayDiff(d, today) >= 0 && tsDayDiff(timesheetState.historyStart, d) >= 0);
}
// Started workdays with nothing submitted, earliest first (today included: it still needs logging)
function tsRunUnlogged(start) { return tsRunEligible(start).filter(d => !timesheetState.records[tsIso(d)]); }
// Gaps: past workdays with nothing submitted (today is still in progress, so it isn't a gap yet)
function tsRunGaps(start) { return tsRunUnlogged(start).filter(d => tsDayStatus(d) === 'missing'); }
function tsRunSummary(start) {
    const eligible = tsRunEligible(start);
    const logged = eligible.filter(d => timesheetState.records[tsIso(d)]).length;
    let hours = 0;
    for (let i = 0; i < TIMESHEET_CONFIG.payRunLengthDays; i++) {
        const rec = timesheetState.records[tsIso(tsAddDays(start, i))];
        if (rec) hours += rec.totalHours;
    }
    return { eligible: eligible.length, workdays: tsRunWorkdays(start).length, logged, hours, gaps: tsRunGaps(start) };
}
// Fortnight navigation: from the first run we hold to the one after the current run
function tsRunBounds() {
    return { min: tsPayRunStart(timesheetState.historyStart), max: tsAddDays(tsPayRunStart(tsToday()), TIMESHEET_CONFIG.payRunLengthDays) };
}
function tsRangeLabel(start) {
    const end = tsAddDays(start, TIMESHEET_CONFIG.payRunLengthDays - 1);
    const fmt = d => `${d.getDate()} ${d.toLocaleDateString('en-AU', { month: 'short' })}`.toUpperCase();
    return `${fmt(start)} – ${fmt(end)}`;
}

// Crew logs for a day and site (same block structure as the worker's own), matched on both the date and the
// siteId (crewLogService). Only days that have started have any.
function tsCrewLogs(iso, siteId) {
    return crewLogService.forSiteOnDate(iso, siteId).map(log => {
        const blocks = log.blocks.map(tsBlockView);
        return { id: log.id, name: log.name, employeeId: log.employeeId, blocks, totalHours: tsSumHours(blocks),
                 start: blocks[0].start, finish: blocks[blocks.length - 1].finish };
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
    const laps = rec ? tsLaps(rec.totalHours) : 0;      // no hours, no arc: a gap shows as an amber track (CSS)
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

// The bar's title is fixed ("Timesheets", data-bar-title); the date lives in the strip and the day card
function renderTimesheetTitle() {
    const view = document.getElementById('view-time');
    if (view) view.dataset.barTitle = 'Timesheets';
}
// Called by top-bar.js when the screen opens; the fixed title always fits beside the Crew pill
function tsFitBarTitle() {}

// The strip: every calendar day the Pay Run arrows can reach (the first run we hold to the run after the
// current one), paged by week: each Monday-Sunday is one page and a swipe moves a whole week. Built once;
// each render only updates the cells, so the user's own scroll position is kept. Cells are keyed by date
// (data-iso), never by index.
function tsStripRange() {
    const b = tsRunBounds();
    const days = [], len = tsDayDiff(b.min, b.max) + TIMESHEET_CONFIG.payRunLengthDays;
    for (let i = 0; i < len; i++) days.push(tsAddDays(b.min, i));
    return days;
}
let tsStripKey = '';
function renderTimesheetStrip() {
    const strip = document.getElementById('ts-week-strip');
    if (!strip) return;
    const days = tsStripRange();
    const key = tsIso(days[0]) + '/' + days.length;
    if (key !== tsStripKey) {
        tsStripKey = key;
        const cell = d => `<button type="button" class="ts-day" data-iso="${tsIso(d)}" onclick="selectTimesheetDate('${tsIso(d)}', { fromStrip: true })">
                    <span class="ts-day-initial">${TS_WEEKDAY_INITIALS[(d.getDay() + 6) % 7]}</span>
                    <svg class="ts-day-ring" viewBox="0 0 40 40" aria-hidden="true"></svg>
                    <span class="ts-day-num">${d.getDate()}</span>
                </button>`;
        const weeks = [];
        for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
        strip.innerHTML = weeks.map(w => `<div class="ts-week-page">${w.map(cell).join('')}</div>`).join('');
    }
    const todayIso = tsIso(tsToday());
    strip.querySelectorAll('.ts-day').forEach(btn => {
        const iso = btn.dataset.iso, d = tsFromIso(iso), status = tsDayStatus(d);
        const isSel = iso === timesheetState.selected;
        const rec = timesheetState.records[iso];
        btn.className = `ts-day is-${status}${isSel ? ' is-selected' : ''}${iso === todayIso ? ' is-today' : ''}`;
        btn.querySelector('.ts-day-ring').innerHTML = tsMiniRing(d, status);
        const label = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
        const statusText = rec ? `${tsFormatHours(rec.totalHours)} logged` : { missing: 'missing', today: 'today, not logged', upcoming: 'upcoming', weekend: 'weekend', none: '' }[status];
        btn.setAttribute('aria-label', `${label}${statusText ? ', ' + statusText : ''}`);
        btn.setAttribute('aria-pressed', String(isSel));
    });
}
// Bring a day's week into view in the strip. Scrolls only the strip (scrollIntoView would also scroll the
// page and the clipped stage that holds every screen). The name is kept for its callers.
function tsCenterStripDay(iso, behavior = 'smooth') {
    const strip = document.getElementById('ts-week-strip');
    const cell = strip && strip.querySelector(`.ts-day[data-iso="${iso}"]`);
    const page = cell && cell.closest('.ts-week-page');
    if (!page || !strip.clientWidth) return;
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    const left = strip.scrollLeft + page.getBoundingClientRect().left - strip.getBoundingClientRect().left - pad;
    strip.scrollTo({ left: Math.max(0, Math.round(left)), behavior });
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

// ----- Pay Run card -----
let tsRunKey = '';
function renderTimesheetPayRun() {
    const chart = document.getElementById('ts-run-chart');
    if (!chart) return;
    const start = tsSelectedRunStart();
    const workdays = tsRunWorkdays(start);
    const sum = tsRunSummary(start);
    const bounds = tsRunBounds();

    document.getElementById('ts-run-range').textContent = tsRangeLabel(start);
    document.getElementById('ts-run-range').setAttribute('aria-label', `Pay run ${tsRangeLabel(start)}`);
    document.getElementById('ts-run-prev').disabled = tsDayDiff(bounds.min, start) <= 0;
    document.getElementById('ts-run-next').disabled = tsDayDiff(start, bounds.max) <= 0;

    // Badge: gaps (amber, tap jumps to the earliest) / complete (lime) / nothing due yet
    const badge = document.getElementById('ts-run-badge');
    const n = sum.gaps.length;
    if (n) {
        badge.className = 'ts-run-badge is-gap';
        badge.disabled = false;
        badge.innerHTML = `<i class="ph-fill ph-warning" aria-hidden="true"></i>${n} ${n === 1 ? 'GAP' : 'GAPS'}`;
        badge.setAttribute('aria-label', `${n} ${n === 1 ? 'day' : 'days'} missing. Show the earliest`);
    } else if (!sum.eligible) {
        badge.className = 'ts-run-badge is-idle';
        badge.disabled = true;
        badge.textContent = 'UPCOMING';
        badge.removeAttribute('aria-label');
    } else if (sum.logged === sum.eligible) {
        badge.className = 'ts-run-badge is-complete';
        badge.disabled = true;
        badge.innerHTML = `<i class="ph-fill ph-check-circle" aria-hidden="true"></i>${sum.logged}/${sum.eligible} COMPLETE`;
        badge.removeAttribute('aria-label');
    } else {
        badge.className = 'ts-run-badge is-ok';                  // only today still to log
        badge.disabled = true;
        badge.textContent = 'NO GAPS';
        badge.removeAttribute('aria-label');
    }

    // Bars: rebuilt only when the run changes, so heights animate between values
    const key = tsIso(start);
    if (key !== tsRunKey) {
        tsRunKey = key;
        const weeks = [workdays.slice(0, 5), workdays.slice(5, 10)];
        chart.innerHTML = `<span class="ts-run-target" aria-hidden="true"><span>8h</span></span>` + weeks.map(week => `
            <div class="ts-run-week">
                <div class="ts-run-bars">
                    ${week.map(d => `<button type="button" class="ts-bar" data-iso="${tsIso(d)}" onclick="selectTimesheetDate('${tsIso(d)}')"><span class="ts-bar-fill"></span></button>`).join('')}
                </div>
                <span class="ts-run-label" data-iso="${tsIso(week[0])}">${tsRangeLabel(week[0]).split(' – ')[0]}</span>
            </div>`).join('');
    }
    // Scale: the top is 10h, or the longest day if longer, so overtime days are never clipped
    const maxHours = Math.max(10, ...workdays.map(d => (timesheetState.records[tsIso(d)] || {}).totalHours || 0));
    chart.style.setProperty('--target', (TIMESHEET_CONFIG.targetHours / maxHours).toFixed(3));
    chart.querySelectorAll('.ts-bar').forEach(bar => {
        const iso = bar.dataset.iso, d = tsFromIso(iso), status = tsDayStatus(d), rec = timesheetState.records[iso];
        const isSel = iso === timesheetState.selected;
        bar.className = `ts-bar is-${status}${isSel ? ' is-selected' : ''}`;
        bar.style.setProperty('--h', rec ? Math.max(0.06, rec.totalHours / maxHours).toFixed(3) : '0');
        bar.setAttribute('aria-label', `${tsShortDate(d)}: ${rec ? tsFormatHours(rec.totalHours) : status === 'missing' ? 'missing' : status}`);
        bar.setAttribute('aria-pressed', String(isSel));
    });
    // The week holding the selected day is labelled in white
    const selMonday = tsIso(getMondayForDate(tsSelectedDate()));
    chart.querySelectorAll('.ts-run-label').forEach(l => l.classList.toggle('is-active', l.dataset.iso === selMonday));

    const hrs = (Math.round(sum.hours * 10) / 10).toFixed(1);
    document.getElementById('ts-run-foot').innerHTML = sum.eligible
        ? `<b>${sum.logged} / ${sum.eligible}</b> days logged · <b>${hrs}</b> hrs total`
        : `<b>${sum.workdays}</b> workdays ahead · <b>${hrs}</b> hrs logged`;
}

// ----- Day card: the selected day's site, status and submitted blocks -----
const TS_STATUS_LABELS = { missing: 'MISSING', upcoming: 'UPCOMING', today: 'TODAY', weekend: 'WEEKEND', none: 'NOT LOGGED' };
const TS_ASSIGNMENT_BADGES = {
    rostered:   { text: 'ROSTERED',            cls: 'is-rostered' },
    override:   { text: 'TRANSFERRED / SPLIT', cls: 'is-override' },
    unrostered: { text: 'MANUAL',              cls: 'is-manual' }
};
// The badge follows the stored assignment type, so ROSTERED only shows when the site came from the roster
function tsSiteBadge(el, siteId, type) {
    const badge = getSiteById(siteId) && TS_ASSIGNMENT_BADGES[type];
    el.hidden = !badge;
    if (badge) { el.textContent = badge.text; el.className = `ts-site-badge ${badge.cls}`; }
}
// The site and assignment for a day: the draft while one exists, else the submitted record, else the roster
function tsDaySite(iso) {
    const draft = timesheetState.drafts[iso], rec = timesheetState.records[iso];
    if (draft) return { siteId: draft.siteId, type: draft.siteAssignmentType };
    if (rec) return { siteId: rec.siteId, type: rec.siteAssignmentType || tsAssignmentType(iso, rec.siteId) };
    const siteId = tsRosterSite(tsFromIso(iso));
    return { siteId, type: tsAssignmentType(iso, siteId) };
}
function renderTimesheetDay() {
    const iso = timesheetState.selected, d = tsFromIso(iso);
    const status = tsDayStatus(d), rec = timesheetState.records[iso];
    document.getElementById('ts-day-date').textContent = tsShortDate(d).toUpperCase();

    const pill = document.getElementById('ts-day-status');
    if (rec) {
        const approved = rec.status === TimesheetStatus.APPROVED;
        pill.textContent = approved ? 'APPROVED' : 'AWAITING SIGN-OFF';
        pill.className = `ts-status-pill is-${approved ? 'approved' : 'awaiting'}`;
    } else {
        pill.textContent = TS_STATUS_LABELS[status];
        pill.className = `ts-status-pill is-${status}`;
    }

    // The card shows what was submitted; an unsaved site change shows once it is submitted
    const daySite = rec ? { siteId: rec.siteId, type: rec.siteAssignmentType || tsAssignmentType(iso, rec.siteId) } : tsDaySite(iso);
    const site = getSiteById(daySite.siteId);
    document.getElementById('ts-day-site-name').textContent = site ? site.shortName : 'No site';
    document.getElementById('ts-day-site-address').textContent = site ? tsSiteAddressLine(site) : 'Not rostered this day';
    document.getElementById('ts-day-site-name').classList.toggle('is-empty', !site);
    tsSiteBadge(document.getElementById('ts-day-site-badge'), daySite.siteId, daySite.type);

    document.getElementById('ts-day-draft').hidden = !tsIsDirty(iso);

    const list = document.getElementById('ts-summary-list');
    const empty = document.getElementById('ts-day-empty');
    if (rec) {
        list.innerHTML = rec.blocks.map((b, i) => `
            <button type="button" class="ts-sum-row" onclick="openTimesheetSheet({ blockIndex: ${i} })" aria-label="${tsEscape(b.code)} ${tsEscape(b.title)}, ${tsFormatHours(b.netHours)}, ${tsBlockTimes(b, true)}. Edit">
                <span class="ts-sum-top">
                    <span class="ts-sum-code"><b>${tsEscape(b.code)}</b> · ${tsEscape(b.title.replace(/ · PS$/, ''))}</span>
                    <span class="ts-sum-hours">${tsFormatHours(b.netHours)}</span>
                </span>
                <span class="ts-sum-times">${tsBlockTimes(b, true)}</span>
                ${b.task ? `<span class="ts-sum-task">${tsEscape(b.task)}</span>` : ''}
            </button>`).join('');
        list.hidden = false;
        empty.hidden = true;
        document.getElementById('ts-summary-total').textContent = tsFormatHours(rec.totalHours);
        document.getElementById('ts-day-total-row').hidden = false;
    } else {
        list.innerHTML = '';
        list.hidden = true;
        empty.hidden = false;
        empty.textContent = status === 'upcoming' ? 'This day hasn\'t started yet'
            : status === 'weekend' ? 'No hours logged · weekend'
            : 'No hours logged for this day';
        document.getElementById('ts-day-total-row').hidden = true;
    }
    renderTimesheetCrew();
}

// ----- Floating button -----
function renderTimesheetCta() {
    const iso = timesheetState.selected, rec = timesheetState.records[iso];
    const btn = document.getElementById('ts-cta');
    if (!btn) return;
    const dirty = tsIsDirty(iso);
    btn.classList.toggle('is-primary', !rec);
    btn.classList.toggle('is-glass', !!rec);
    // Logged day: Edit Hours (pencil). Unlogged day: Log Hours for <date> (plus). A day with unsaved
    // changes keeps Continue Editing.
    document.getElementById('ts-cta-icon').className = (dirty || rec) ? 'ph-bold ph-pencil' : 'ph-bold ph-plus';
    document.getElementById('ts-cta-label').textContent = dirty ? 'Continue Editing'
        : rec ? 'Edit Hours' : `Log Hours for ${tsShortDate(tsFromIso(iso))}`;
}

// ----- Sheet (the editor) -----
function renderTimesheetEditor() {
    if (!timesheetState.sheetOpen) return;
    const iso = timesheetState.selected, d = tsFromIso(iso), rec = timesheetState.records[iso];
    const site = getSiteById(tsCurrentSiteId(iso));
    document.getElementById('ts-sheet-title').textContent = `${tsShortDate(d)}${site ? ' · ' + site.shortName : ''}`;
    const pill = document.getElementById('ts-editor-status');
    const status = tsDayStatus(d);
    pill.textContent = rec ? 'EDITING' : (status === 'missing' ? 'MISSING' : 'NEW');
    pill.className = `ts-status-pill is-${rec ? 'editing' : status === 'missing' ? 'missing' : 'today'}`;
    renderTimesheetSiteRow();
    renderTimesheetCrew();
    renderTimesheetBlocks();
}

function renderTimesheetSiteRow() {
    const iso = timesheetState.selected;
    const daySite = tsDaySite(iso), site = getSiteById(daySite.siteId);
    const row = document.getElementById('ts-site-row');
    row.classList.toggle('is-empty', !site);
    document.getElementById('ts-site-name').textContent = site ? site.shortName : 'Choose a site';
    document.getElementById('ts-site-address').textContent = site ? tsSiteAddressLine(site) : 'Not rostered this day';
    tsSiteBadge(document.getElementById('ts-site-badge'), daySite.siteId, daySite.type);
    syncTimesheetSitePicker();
}

// A site's street line; an archived site says so (it still resolves for the days logged there)
function tsSiteAddressLine(site) {
    return site.active ? site.address : `${site.address} · archived`;
}

function tsBlockTimes(b, pad) {
    return `${tsFormatClock(b.start, pad)} – ${tsFormatClock(b.finish, pad)}${Number(b.breakMins) ? ` · ${b.breakMins}m lunch` : ''}`;
}

function tsCodeOptions(selected) {
    return `<option value="" disabled${selected ? '' : ' selected'}>Choose cost code</option>` +
        getCostCodes().filter(c => c.active || c.code === selected).map(c => `<option value="${c.code}"${c.code === selected ? ' selected' : ''}>${c.code} · ${tsEscape(c.title)}</option>`).join('');
}

// State B: editable blocks. Rebuilt only on structural changes (day, add, delete, copy); typing updates in place.
function renderTimesheetBlocks() {
    const draft = tsDraft(timesheetState.selected);
    document.getElementById('ts-block-list').innerHTML = draft.blocks.map((b, i) => `
        <div class="ts-block${i === timesheetState.editingIndex ? ' is-editing' : ''}" data-id="${b.id}">
            ${i === timesheetState.editingIndex ? '<span class="ts-block-editing"><i class="ph-bold ph-pencil-simple" aria-hidden="true"></i>Editing this line</span>' : ''}
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

function tsBlockError(b) { return TimesheetRules.blockError(b, getCostCodes()); }

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

    const dirty = tsIsDirty(iso);
    document.getElementById('ts-draft-note').hidden = !dirty;
    document.getElementById('ts-discard').hidden = !dirty;
    const rec = timesheetState.records[iso];
    const future = tsIsFuture(tsFromIso(iso));
    document.getElementById('ts-submit').disabled = future;
    document.getElementById('ts-submit-label').textContent = rec ? 'Update Timesheet' : 'Submit Hours';
    document.getElementById('ts-submit-hint').textContent = future ? 'You can submit this day once it starts' : '';
    // Save & Next Gap: only for a day not yet logged, and only when another unlogged workday is waiting
    const next = !rec && !future && tsNextUnlogged(iso);
    const saveNext = document.getElementById('ts-save-next');
    saveNext.hidden = !next;
    if (next) saveNext.setAttribute('aria-label', `Save and go to ${tsShortDate(next)}`);
    return firstError;
}

// ----- Site picker -----
function renderTimesheetSiteList() {
    const q = (document.getElementById('ts-site-search').value || '').trim().toLowerCase();
    const current = tsCurrentSiteId(timesheetState.selected);
    const roster = tsRosterSite(tsFromIso(timesheetState.selected));
    // New choices are the active sites only (an archived site stays on the days already logged there)
    const sites = getActiveSites()
        .filter(s => !q || s.shortName.toLowerCase().includes(q) || s.address.toLowerCase().includes(q) || s.suburb.toLowerCase().includes(q));
    document.getElementById('ts-site-list').innerHTML = sites.length ? sites.map(s => `
        <button type="button" class="ts-site-option${s.id === current ? ' is-selected' : ''}" role="option" aria-selected="${s.id === current}" onclick="chooseTimesheetSite('${s.id}')">
            <span class="ts-site-option-text"><span class="ts-site-option-name">${tsEscape(s.shortName)}</span><span class="ts-site-option-addr">${tsEscape(s.address)}</span></span>
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
    if (!getSiteById(siteId)) return;
    triggerHaptic('light');
    const iso = timesheetState.selected, draft = tsDraft(iso);
    draft.siteId = siteId;                                 // the date and the time blocks stay as they are
    draft.siteAssignmentType = tsAssignmentType(iso, siteId);   // the roster entry itself is untouched
    timesheetState.sitePickerOpen = false;
    renderTimesheetSiteRow();
    renderTimesheetCrew();                                 // crew logs follow the site
    updateTimesheetEditComputed();
    const site = getSiteById(siteId), d = tsSelectedDate();
    document.getElementById('ts-sheet-title').textContent = `${tsShortDate(d)}${site ? ' · ' + site.shortName : ''}`;
    renderTimesheetDay();
    renderTimesheetCta();
}

// ----- Crew drawer -----
function renderTimesheetCrew() {
    const iso = timesheetState.selected, siteId = tsCurrentSiteId(iso);
    const logs = tsCrewLogs(iso, siteId);
    const site = getSiteById(siteId);
    document.getElementById('ts-crew-link-count').textContent = logs.length ? `(${logs.length})` : '';
    const list = document.getElementById('ts-crew-list');
    if (!logs.length) {
        const msg = !site ? 'Choose a site to see its crew logs.'
            : tsIsFuture(tsFromIso(iso)) ? 'Crew logs show up once the day has started.'
            : `No crew logs at ${tsEscape(site.shortName)} for this day.`;
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
    document.getElementById('ts-crew-context').textContent = `${tsShortDate(tsFromIso(iso))}${site ? ' · ' + site.shortName : ''}`;
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

// The crew drawer is one element: in the day card, or inside the sheet while it is open
function tsPlaceCrewSection() {
    const section = document.getElementById('ts-crew-section');
    const slot = document.getElementById(timesheetState.sheetOpen ? 'ts-sheet-crew-slot' : 'ts-day-crew-slot');
    if (section && slot && section.parentElement !== slot) slot.appendChild(section);
}

function renderTimesheets() {
    renderTimesheetTitle();
    renderTimesheetStrip();
    renderTimesheetHero();
    renderTimesheetPayRun();
    renderTimesheetDay();
    renderTimesheetCta();
    renderTimesheetEditor();
}

// ---------- Actions ----------
// opts.fromStrip: tapped in the strip itself, so the strip stays where the user scrolled it; a date chosen
// anywhere else (chart, gap badge, pay run arrows, Save & Next) is centred in the strip
// A failed save's message belongs to the day it was for
function tsClearSubmitErrors() {
    ['ts-submit', 'ts-save-next'].forEach(id => setUiActionError(document.getElementById(id), '', ''));
}
function selectTimesheetDate(iso, opts = {}) {
    if (iso === timesheetState.selected) return;
    triggerHaptic('light');
    tsClearSubmitErrors();
    tsDropCleanDraft(timesheetState.selected);
    timesheetState.selected = iso;     // unsaved edits stay in drafts[] for when the day is reopened
    timesheetState.sitePickerOpen = false;
    timesheetState.editingIndex = -1;
    document.getElementById('ts-submitted-note').hidden = true;
    tsRestartHeroRing();
    renderTimesheets();
    if (!opts.fromStrip) tsCenterStripDay(iso);
}
// A day opened for editing but left unchanged goes back to how it was (its summary, or a fresh form)
function tsDropCleanDraft(iso) {
    if (timesheetState.drafts[iso] && !tsIsDirty(iso)) {
        delete timesheetState.drafts[iso];
        delete timesheetState.showErrors[iso];
    }
}

// Previous / next fortnight: select today if it is in that run, else the run's first workday
function shiftTimesheetPayRun(dir) {
    const start = tsAddDays(tsSelectedRunStart(), dir * TIMESHEET_CONFIG.payRunLengthDays);
    const b = tsRunBounds();
    if (tsDayDiff(b.min, start) < 0 || tsDayDiff(start, b.max) < 0) return;
    const today = tsToday();
    const inRun = tsDayDiff(start, today) >= 0 && tsDayDiff(start, today) < TIMESHEET_CONFIG.payRunLengthDays;
    selectTimesheetDate(tsIso(inRun ? today : tsRunWorkdays(start)[0]));
}
// The gap badge: jump to the earliest missing workday of the shown run
function jumpToTimesheetGap() {
    const gap = tsRunGaps(tsSelectedRunStart())[0];
    if (gap) selectTimesheetDate(tsIso(gap));
}
// The next started workday with nothing submitted in the same run, other than `iso` (earliest first)
function tsNextUnlogged(iso) {
    return tsRunUnlogged(tsPayRunStart(tsFromIso(iso))).find(d => tsIso(d) !== iso) || null;
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
// Scroll the sheet's body so `el` sits near its top
function tsScrollSheetTo(el, behavior = 'smooth') {
    const body = document.getElementById('ts-sheet-body');
    if (!body || !el) return;
    const top = body.scrollTop + el.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
    body.scrollTo({ top: Math.max(0, top), behavior });
}

// ----- Opening / closing the sheet -----
let tsSheetSnapshot = null;          // what the draft looked like right after opening, to tell real edits apart
function tsDraftJson(iso) {
    const d = timesheetState.drafts[iso];
    return d ? JSON.stringify({ s: d.siteId, b: d.blocks.map(b => [b.code, b.start, b.finish, b.breakMins, b.task]) }) : '';
}
// opts.blockIndex: open on that submitted block; opts.addBlock: append a new line to a logged day
function openTimesheetSheet(opts = {}) {
    const iso = timesheetState.selected;
    const hadDraft = tsIsDirty(iso);
    const draft = tsDraft(iso);
    timesheetState.editingIndex = typeof opts.blockIndex === 'number' ? opts.blockIndex : -1;
    if (opts.addBlock && !hadDraft) {
        tsAppendBlock(draft);
        timesheetState.editingIndex = -1;
    }
    tsSheetSnapshot = { iso, hadDraft, json: tsDraftJson(iso) };
    timesheetState.sheetOpen = true;
    timesheetState.sitePickerOpen = false;
    document.getElementById('ts-sheet-note').hidden = true;
    tsPlaceCrewSection();
    renderTimesheetEditor();
    tsShowSheet(true);
    triggerHaptic('light');

    // Bring the line being edited / just added into view
    const blocks = document.querySelectorAll('#ts-block-list .ts-block');
    const focus = timesheetState.editingIndex >= 0 ? blocks[timesheetState.editingIndex] : (opts.addBlock ? blocks[blocks.length - 1] : null);
    const body = document.getElementById('ts-sheet-body');
    body.scrollTop = 0;
    if (focus) {
        requestAnimationFrame(() => tsScrollSheetTo(focus, 'auto'));
        if (opts.addBlock) focus.classList.add('is-new');
    }
}
function closeTimesheetSheet() {
    if (!timesheetState.sheetOpen) return;
    tsClearSubmitErrors();
    const iso = timesheetState.selected;
    // Opening alone (or adding a line and leaving it untouched) isn't an edit: drop that draft again.
    // Anything actually changed stays as an unsaved draft (the day card offers Resume / Discard).
    if (tsSheetSnapshot && tsSheetSnapshot.iso === iso && !tsSheetSnapshot.hadDraft && tsDraftJson(iso) === tsSheetSnapshot.json) {
        delete timesheetState.drafts[iso];
        delete timesheetState.showErrors[iso];
    }
    tsDropCleanDraft(iso);
    tsSheetSnapshot = null;
    timesheetState.sheetOpen = false;
    timesheetState.sitePickerOpen = false;
    timesheetState.editingIndex = -1;
    tsPlaceCrewSection();
    tsShowSheet(false);
    renderTimesheetDay();
    renderTimesheetCta();
}
function tsShowSheet(open, instant) {
    const overlay = document.getElementById('ts-sheet-overlay');
    const sheet = document.getElementById('ts-sheet');
    if (!overlay) return;
    sheet.style.transform = '';
    sheet.style.transition = '';
    if (instant) {
        overlay.classList.add('no-anim');
        requestAnimationFrame(() => overlay.classList.remove('no-anim'));
    }
    overlay.classList.toggle('is-open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    overlay.inert = !open;
    document.documentElement.classList.toggle('ts-sheet-open', open);   // app-shell.js: no edge-swipe back
    if (open) setTimeout(() => { if (timesheetState.sheetOpen) document.getElementById('ts-sheet').focus({ preventScroll: true }); }, 60);
}

// The floating button: log an unlogged day, or edit a logged day's existing blocks (a draft carries on as is)
function onTimesheetCta() {
    openTimesheetSheet();
}

// Throw away the selected day's unsaved changes (its record, if any, is untouched)
function discardTimesheetDraft() {
    const iso = timesheetState.selected;
    triggerHaptic('light');
    delete timesheetState.drafts[iso];
    delete timesheetState.showErrors[iso];
    if (timesheetState.sheetOpen) {
        if (timesheetState.records[iso]) { closeTimesheetSheet(); return; }
        tsDraft(iso);                                  // a fresh form for a day not yet logged
        tsSheetSnapshot = { iso, hadDraft: false, json: tsDraftJson(iso) };
        timesheetState.editingIndex = -1;
        renderTimesheetEditor();
    }
    renderTimesheetDay();
    renderTimesheetCta();
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
    tsAfterDraftChange();
}
// The day card's "Unsaved changes" note and the button label follow the draft
function tsAfterDraftChange() {
    updateTimesheetEditComputed();
    const iso = timesheetState.selected;
    const dirty = tsIsDirty(iso);
    if (dirty !== tsAfterDraftChange.last) {
        tsAfterDraftChange.last = dirty;
        document.getElementById('ts-day-draft').hidden = !dirty;
        renderTimesheetCta();
    }
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
    tsAfterDraftChange();
}

// + Add Line: starts where the last line finishes, runs 30 minutes, no lunch
function tsAppendBlock(draft) {
    const last = draft.blocks[draft.blocks.length - 1];
    const start = last ? last.finish : TIMESHEET_CONFIG.defaultStart;
    const startMins = tsMinutes(start);
    const finish = startMins === null ? '' : tsFromMinutes(startMins + 30);
    draft.blocks.push(tsNewBlock({ start, finish, breakMins: 0, chained: true }));
}
function addTimesheetBlock() {
    tsAppendBlock(tsDraft(timesheetState.selected));
    triggerHaptic('light');
    renderTimesheetBlocks();
    tsAfterDraftChange();
    const blocks = document.querySelectorAll('#ts-block-list .ts-block');
    const added = blocks[blocks.length - 1];
    if (added) {
        added.classList.add('is-new');
        const body = document.getElementById('ts-sheet-body');
        if (added.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom - 20) tsScrollSheetTo(added);
    }
}

function deleteTimesheetBlock(id) {
    const { draft, index } = tsFindBlock(id);
    if (index <= 0 || draft.blocks.length < 2) return;   // the first line stays
    triggerHaptic('light');
    if (timesheetState.editingIndex === index) timesheetState.editingIndex = -1;
    else if (timesheetState.editingIndex > index) timesheetState.editingIndex--;
    draft.blocks.splice(index, 1);
    renderTimesheetBlocks();
    tsAfterDraftChange();
}

function toggleTimesheetCrew(fromNav) {
    triggerHaptic('light');
    timesheetState.crewOpen = !timesheetState.crewOpen;
    syncTimesheetCrewDrawer();
    if (timesheetState.crewOpen && fromNav) {
        const link = document.getElementById('ts-crew-link');
        setTimeout(() => (timesheetState.sheetOpen ? tsScrollSheetTo(link) : tsScrollViewTo(link)), 60);
    }
}

// Copy a crew member's blocks into this day's draft (never submitted, never touching their record)
function copyTimesheetCrewFormat(index) {
    const iso = timesheetState.selected;
    const c = tsCrewLogs(iso, tsCurrentSiteId(iso))[index];
    if (!c) return;
    triggerHaptic('success');
    const draft = tsDraft(iso);
    // Fresh blocks for the editable draft; the crew record is untouched and nothing is submitted
    draft.blocks = crewLogService.copyBlocks(c.id).map(b => tsNewBlock(b));
    timesheetState.editingIndex = -1;
    if (timesheetState.sheetOpen) {
        renderTimesheetEditor();
        tsAfterDraftChange();
    } else {
        openTimesheetSheet();                          // copying switches straight into editing (never submits)
    }
    renderTimesheetDay();
    renderTimesheetCta();

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
// Submit Hours / Update Timesheet (andNext = false), or Save & Next Gap (andNext = true).
// timesheetService.submit validates, saves (one record per day: resubmitting updates it) and updates the
// cache; the sheet only moves on once that has succeeded. A failure keeps the draft and says why.
function tsShowSubmitErrors(iso) {
    const draft = tsDraft(iso);
    timesheetState.showErrors[iso] = true;
    triggerHaptic('error');
    const firstError = updateTimesheetEditComputed();
    tsScrollSheetTo(!draft.siteId ? document.getElementById('ts-site-row') : firstError);
}
async function submitTimesheet(andNext) {
    const iso = timesheetState.selected, d = tsFromIso(iso);
    if (tsIsFuture(d)) return;
    const draft = tsDraft(iso);
    if (!draft.siteId || draft.blocks.some(b => tsBlockError(b))) { tsShowSubmitErrors(iso); return; }

    const button = document.getElementById(andNext ? 'ts-save-next' : 'ts-submit');
    const result = await runUiAction(() => timesheetService.submit({
        date: iso, siteId: draft.siteId,
        blocks: draft.blocks.map(b => ({ id: b.id, code: b.code, start: b.start, finish: b.finish, breakMins: b.breakMins, task: b.task }))
    }), {
        button,
        errorTitle: 'Timesheet not saved',
        keepDisabled: () => tsIsFuture(tsFromIso(timesheetState.selected)),
        onError: err => {
            if (err.code === ErrorCode.VALIDATION && timesheetState.selected === iso) { tsShowSubmitErrors(iso); }
            return false;
        }
    });
    if (!result.ok) return;
    // The person may have moved to another day while it saved: only the day that was submitted changes
    if (timesheetState.selected !== iso) { delete timesheetState.drafts[iso]; delete timesheetState.showErrors[iso]; renderTimesheets(); return; }

    delete timesheetState.drafts[iso];
    delete timesheetState.showErrors[iso];
    timesheetState.sitePickerOpen = false;
    timesheetState.editingIndex = -1;
    tsSheetSnapshot = null;
    triggerHaptic('success');

    const next = andNext ? tsNextUnlogged(iso) : null;
    if (next) {
        // Straight on to the next unlogged day, in the same sheet, with its roster site and default block
        timesheetState.selected = tsIso(next);
        tsRestartHeroRing();
        renderTimesheets();
        tsCenterStripDay(timesheetState.selected);
        openTimesheetSheet();
        const note = document.getElementById('ts-sheet-note');
        note.innerHTML = `<i class="ph-fill ph-check-circle" aria-hidden="true"></i>${tsShortDate(d)} saved`;
        note.hidden = false;
        clearTimeout(tsSubmittedTimer);
        tsSubmittedTimer = setTimeout(() => { note.hidden = true; }, 2400);
        return;
    }

    closeTimesheetSheet();
    renderTimesheetStrip();
    renderTimesheetHero();
    renderTimesheetPayRun();
    renderTimesheetDay();
    renderTimesheetCta();
    document.getElementById('view-time').scrollTo({ top: 0, behavior: 'smooth' });   // watch the rings update

    const note = document.getElementById('ts-submitted-note');
    note.hidden = false;
    clearTimeout(tsSubmittedTimer);
    tsSubmittedTimer = setTimeout(() => { note.hidden = true; }, 2400);
}

// A fresh open (navigation.js) starts on today with the drawers shut; edits in progress are kept
function resetTimeView() {
    if (timesheetState.sheetOpen) {
        timesheetState.sheetOpen = false;
        tsPlaceCrewSection();
        tsShowSheet(false, true);
    }
    Object.keys(timesheetState.drafts).forEach(tsDropCleanDraft);
    timesheetState.selected = tsIso(tsToday());
    timesheetState.crewOpen = false;
    timesheetState.sitePickerOpen = false;
    timesheetState.editingIndex = -1;
    document.getElementById('ts-submitted-note').hidden = true;
    tsRestartHeroRing();
    renderTimesheets();
    requestAnimationFrame(() => tsCenterStripDay(timesheetState.selected, 'auto'));   // once the screen shows
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
    search.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeTimesheetSitePicker(); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && timesheetState.sheetOpen) closeTimesheetSheet(); });
    tsInitSheetDrag();
    renderTimesheets();
});

// Drag the sheet down by its handle / header to dismiss it (follows the finger; a flick or a long drag
// closes, anything else springs back)
function tsInitSheetDrag() {
    const grab = document.getElementById('ts-sheet-grab');
    const sheet = document.getElementById('ts-sheet');
    if (!grab || !sheet) return;
    let y0 = 0, dy = 0, lastY = 0, lastT = 0, v = 0, dragging = false, id = null;
    grab.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        id = e.pointerId; dragging = true; y0 = lastY = e.clientY; lastT = performance.now(); dy = 0; v = 0;
        grab.setPointerCapture(id);
        sheet.style.transition = 'none';
    });
    grab.addEventListener('pointermove', e => {
        if (!dragging || e.pointerId !== id) return;
        const now = performance.now();
        v = (e.clientY - lastY) / Math.max(1, now - lastT);
        lastY = e.clientY; lastT = now;
        const raw = e.clientY - y0;
        dy = raw > 0 ? raw : -Math.sqrt(-raw) * 2;              // a little resistance upwards
        sheet.style.transform = `translateY(${dy}px)`;
    });
    const end = e => {
        if (!dragging || e.pointerId !== id) return;
        dragging = false;
        sheet.style.transition = '';
        if (dy > 120 || (dy > 24 && v > 0.5)) closeTimesheetSheet();
        else sheet.style.transform = '';
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
}

// Sites renamed, added or archived: every name, address and the picker follow SITES at once
subscribeSites(() => {
    if (!document.getElementById('view-time')) return;
    renderTimesheets();
    if (timesheetState.sitePickerOpen) renderTimesheetSiteList();
});

// Timesheets, crew logs or cost codes changed in the cache (a submit, an approval, a refresh): redraw what
// shows them on the next frame. The open editor is left alone so typing is never interrupted.
let tsDataRenderQueued = false;
appStore.subscribe(() => {
    if (tsDataRenderQueued) return;
    tsDataRenderQueued = true;
    requestAnimationFrame(() => {
        tsDataRenderQueued = false;
        if (!document.getElementById('view-time')) return;
        renderTimesheetStrip();
        renderTimesheetHero();
        renderTimesheetPayRun();
        renderTimesheetDay();
        renderTimesheetCta();
        if (timesheetState.sheetOpen) { renderTimesheetCrew(); updateTimesheetEditComputed(); }
    });
}, ['timesheets', 'crewLogs', 'costCodes']);
