/**
 * Crew Status sheet ("Site Crew"): who is rostered at a site on a day and who has signed in, as an iOS bottom
 * sheet (styles/crew-status-sheet.css). Opened by the Home site card's crew button ("N crew ›": the card's
 * site, today) and by the Site Hub's hero (its active site and chosen day). Nothing is hardcoded:
 *
 *   site      passed in (openCrewSheetFor) - any site works
 *   day       passed in; today / past / future is judged against the app's today (homeAttendanceDay)
 *   scheduled the signed-in worker when rostered there (ROSTER) plus the site's crew that day (JOBS_DATA,
 *             getSiteCrewForDate) - the same list the Home card's "N crew" preview shows
 *   status    each person's Attendance record at that site that day (getAttendance): signed in and still
 *             there = On Site; signed out = Shift completed; no record = Not signed in. A future day lists
 *             the rostered crew only.
 *
 * The sheet redraws whenever attendance changes (subscribeAttendance), so a sign-in arriving while it is open
 * updates the headcount and rows live.
 *
 * Dismiss: the backdrop, the × button, Escape, or dragging the handle / header down (follows the finger; a
 * flick or a long drag closes, anything less springs back). The list scrolls on its own and never drags.
 * "View Full Weekly Roster" closes the sheet and opens the Roster on that week, filtered to the site.
 */

const CREW_SHEET_CLOSE_MS = 440;
let crewSheetOpen = false;
let crewSheetSiteId = null;
let crewSheetDate = null;         // the day shown (a Date)
let crewSheetCloseTimer = null;
let crewSheetEnterFrame = null;
let crewSheetReturnFocus = null;

function isCrewSheetOpen() { return crewSheetOpen; }

function crewEscape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Where `day` sits against the app's today (homeAttendanceDay): 'today' | 'past' | 'future'
function crewDayKind(day) {
    const iso = DateRules.toIso(day), today = DateRules.toIso(homeAttendanceDay());
    return iso === today ? 'today' : (iso < today ? 'past' : 'future');
}

// The crew headline for a site and day: today "3 / 4 Signed In" (live), a past day "3 / 4 Attended" from its
// records (or "4 Rostered" when there are none), a future day "4 Rostered". { text, live, label }
function crewHeadline(siteId, day, status = getCrewStatus(siteId, day)) {
    const kind = crewDayKind(day), { onSite, off, total } = status;
    if (!total) return { text: 'No crew rostered', live: false, label: 'No crew rostered' };
    if (kind === 'today') return { text: `<b>${onSite.length}</b>&nbsp;/ ${total} Signed In`, live: true, label: `${onSite.length} of ${total} signed in` };
    const attended = onSite.length + off.filter(p => p.completed).length;
    if (kind === 'past' && attended) return { text: `<b>${attended}</b>&nbsp;/ ${total} Attended`, live: false, label: `${attended} of ${total} attended` };
    const start = kind === 'future' ? crewShiftStart() : '';         // a start time only for a day still to come
    return { text: `${total} Rostered${start ? ` • ${start}` : ''}`, live: false, label: `${total} rostered${start ? `, starting ${start}` : ''}` };
}
// The rostered start time ("7:00 AM"), from the standard shift (TIMESHEET_CONFIG.defaultStart)
function crewShiftStart() {
    const hhmm = typeof TIMESHEET_CONFIG !== 'undefined' && TIMESHEET_CONFIG.defaultStart;
    return hhmm ? formatClockTime(`2000-01-01T${hhmm}:00`) : '';
}

// Who is scheduled at `siteId` on `day`, and each person's attendance there:
// { onSite: [{ name, at }], off: [{ name, at, completed }], total }
function getCrewStatus(siteId, day) {
    const me = getCurrentEmployee();
    const names = [];
    if (me && getRosteredSiteId(day) === siteId) names.push(me.name);
    getSiteCrewForDate(siteId, day).forEach(n => { if (!names.includes(n)) names.push(n); });

    const records = getAttendance(day, siteId);
    const recordFor = name => {
        const emp = getEmployeeByName(name);
        return records.find(r => (emp && r.employeeId) ? r.employeeId === emp.id : r.name === name) || null;
    };
    const onSite = [], off = [];
    names.forEach(name => {
        const rec = recordFor(name);
        if (rec && !rec.signedOutAt) onSite.push({ name, at: rec.signedInAt });
        else off.push({ name, at: rec ? rec.signedOutAt : null, completed: !!rec });
    });
    onSite.sort((a, b) => (a.at < b.at ? -1 : 1));                      // earliest arrival first
    off.sort((a, b) => (a.completed === b.completed ? a.name.localeCompare(b.name) : a.completed ? 1 : -1));
    return { onSite, off, total: names.length };
}

// One person: avatar, name and role, their status for the day, and Call / Message when there's a way to reach
// them (an employee record with a phone number; never you yourself). Labour hire has no record: no actions.
function renderCrewRow(p, on, kind) {
    const emp = getEmployeeByName(p.name);
    const start = crewShiftStart();
    const badge = kind === 'future' ? { cls: 'is-neutral', text: `Rostered${start ? ` · ${start}` : ''}` }
        : on ? { cls: 'is-live', text: `Signed In · ${formatClockTime(p.at)}` }
        : p.completed ? { cls: 'is-neutral', text: `Shift Completed · ${formatClockTime(p.at)}` }
        : { cls: 'is-neutral', text: kind === 'past' ? 'No Sign-In' : 'Not Signed In' };
    const me = emp && emp.id === getCurrentEmployeeId();
    const phone = emp && !me && emp.phone ? String(emp.phone).replace(/[^\d+]/g, '') : '';
    const first = String(p.name).split(' ')[0];
    const actions = [
        phone ? `<a class="crew-act" href="tel:${crewEscape(phone)}" aria-label="Call ${crewEscape(p.name)}" onclick="event.stopPropagation(); triggerHaptic('light')"><i class="ph-fill ph-phone" aria-hidden="true"></i></a>` : '',
        emp && !me ? `<button type="button" class="crew-act" aria-label="Message ${crewEscape(first)}" onclick="messageCrewMember(${crewEscape(JSON.stringify(emp.name))})"><i class="ph-fill ph-chat-circle-text" aria-hidden="true"></i></button>` : ''
    ].join('');
    return `<li class="crew-row ${on || kind === 'future' ? 'is-on' : 'is-off'}">
            ${renderRoleAvatar(p.name, 'row')}
            <span class="crew-row-text">
                <span class="crew-row-name">${crewEscape(p.name)}${me ? ' <span class="crew-row-you">(You)</span>' : ''}</span>
                ${emp && emp.role ? `<span class="crew-row-role">${crewEscape(emp.role)}</span>` : ''}
                <span class="crew-badge ${badge.cls}">${badge.cls === 'is-live' ? '<span class="crew-row-dot" aria-hidden="true"></span>' : ''}${badge.text}</span>
            </span>
            ${actions ? `<span class="crew-acts">${actions}</span>` : ''}
        </li>`;
}
// Message: the existing direct-message conversation with them (scripts/features/chat.js)
function messageCrewMember(name) {
    triggerHaptic('light');
    closeCrewStatusSheet();
    setTimeout(() => openDirectMessage(name), 200);
}

function renderCrewStatusSheet() {
    const siteId = crewSheetSiteId;
    if (!siteId) return;
    const day = crewSheetDate || homeAttendanceDay(), kind = crewDayKind(day);
    const status = getCrewStatus(siteId, day), { onSite, off, total } = status;
    const name = getSiteName(siteId, 'Site');
    const dayLabel = kind === 'today' ? 'today' : `on ${day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}`;

    document.getElementById('crew-sheet-site').textContent = `${name} Crew`;
    document.getElementById('crew-sheet-address').textContent = day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    const head = crewHeadline(siteId, day, status);
    const count = document.getElementById('crew-sheet-count');
    count.hidden = total === 0;
    count.classList.toggle('is-live', head.live);
    count.innerHTML = head.text;
    count.setAttribute('aria-label', head.label);

    const list = document.getElementById('crew-sheet-list');
    if (!total) {
        list.innerHTML = `<div class="crew-empty-all">
                <i class="ph-fill ph-users-three" aria-hidden="true"></i>
                <strong>No crew scheduled</strong>
                <span>No one is rostered at ${crewEscape(name)} ${dayLabel}.</span>
            </div>`;
        return;
    }
    if (kind === 'future') {
        const all = [...onSite, ...off].sort((a, b) => a.name.localeCompare(b.name));
        list.innerHTML = `<section class="crew-section" aria-labelledby="crew-on-title">
                <h3 id="crew-on-title" class="crew-section-title">Rostered</h3>
                <ul class="crew-rows">${all.map(p => renderCrewRow(p, false, kind)).join('')}</ul>
            </section>`;
        return;
    }
    list.innerHTML = `
        <section class="crew-section" aria-labelledby="crew-on-title">
            <h3 id="crew-on-title" class="crew-section-title">${kind === 'today' ? 'On Site' : 'Signed In'}</h3>
            ${onSite.length
                ? `<ul class="crew-rows">${onSite.map(p => renderCrewRow(p, true, kind)).join('')}</ul>`
                : `<p class="crew-empty">${kind === 'today' ? 'No one has signed in yet.' : 'No one is still signed in.'}</p>`}
        </section>
        ${off.length ? `<section class="crew-section" aria-labelledby="crew-off-title">
            <h3 id="crew-off-title" class="crew-section-title">Not Signed In</h3>
            <ul class="crew-rows">${off.map(p => renderCrewRow(p, false, kind)).join('')}</ul>
        </section>` : ''}`;
}

// The Home card's crew button: the card's site, today
function openCrewStatusSheet(e) {
    if (e) e.stopPropagation();                // the site card itself opens the roster
    const card = document.getElementById('site-hero-card');
    const siteId = card && card.dataset.siteId;
    // No site rostered: nothing to show crew for - the roster, as before
    if (!siteId) { switchTab('week'); return; }
    openCrewSheetFor(siteId, homeAttendanceDay());
}

// The sheet for any site and day (the Site Hub passes its active site and chosen day)
function openCrewSheetFor(siteId, day) {
    const overlay = document.getElementById('crew-sheet-overlay');
    const sheet = document.getElementById('crew-sheet');
    if (!siteId || !overlay || !sheet || crewSheetOpen) return;
    triggerHaptic('light');
    clearTimeout(crewSheetCloseTimer);
    crewSheetSiteId = siteId;
    crewSheetDate = day ? new Date(day) : homeAttendanceDay();
    renderCrewStatusSheet();

    crewSheetReturnFocus = document.activeElement;
    sheet.style.transform = '';
    overlay.hidden = false;
    crewSheetOpen = true;
    document.getElementById('crew-sheet-list').scrollTop = 0;
    cancelAnimationFrame(crewSheetEnterFrame);
    // Two frames: the closed position is painted first, so the rise animates
    crewSheetEnterFrame = requestAnimationFrame(() => {
        crewSheetEnterFrame = requestAnimationFrame(() => { if (crewSheetOpen) overlay.classList.add('is-open'); });
    });

    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = true;                    // nothing behind can be focused, tapped or scrolled
    if (typeof setBackgroundShadersPaused === 'function') setBackgroundShadersPaused(true);
    sheet.focus({ preventScroll: true });
}

// opts.instant: no exit animation (navigating away underneath)
function closeCrewStatusSheet(opts = {}) {
    const overlay = document.getElementById('crew-sheet-overlay');
    const sheet = document.getElementById('crew-sheet');
    if (!overlay || overlay.hidden) return;
    const wasOpen = crewSheetOpen;
    crewSheetOpen = false;
    cancelAnimationFrame(crewSheetEnterFrame);
    overlay.classList.remove('is-open');
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';

    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = false;
    if (wasOpen && typeof setBackgroundShadersPaused === 'function') setBackgroundShadersPaused(false);

    clearTimeout(crewSheetCloseTimer);
    const finish = () => { if (!crewSheetOpen) overlay.hidden = true; };
    if (opts.instant) finish();
    else crewSheetCloseTimer = setTimeout(finish, CREW_SHEET_CLOSE_MS);
    if (!opts.instant && crewSheetReturnFocus && document.contains(crewSheetReturnFocus)) {
        crewSheetReturnFocus.focus({ preventScroll: true });
    }
    crewSheetReturnFocus = null;
}

// The Roster (the existing multi-day screen), on the card's week, showing only this site's days
function openCrewSiteSchedule() {
    const siteId = crewSheetSiteId, day = crewSheetDate || homeAttendanceDay();
    closeCrewStatusSheet();
    switchTab('week');
    requestAnimationFrame(() => showRosterForSite(siteId, day));
}

// Drag the handle / header down to dismiss. The sheet follows the finger (with resistance upwards); past
// 30% of its height, or a downward flick, it closes; anything less springs back.
function initCrewSheetDrag() {
    const handle = document.getElementById('crew-sheet-drag');
    const sheet = document.getElementById('crew-sheet');
    if (!handle || !sheet) return;
    let y0 = 0, dy = 0, lastY = 0, lastT = 0, v = 0, id = null;
    handle.addEventListener('pointerdown', e => {
        if (!crewSheetOpen || id !== null || e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
        id = e.pointerId; y0 = lastY = e.clientY; lastT = performance.now(); dy = 0; v = 0;
        try { handle.setPointerCapture(id); } catch (_) {}
        sheet.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        const now = performance.now();
        v = (e.clientY - lastY) / Math.max(1, now - lastT);
        lastY = e.clientY; lastT = now;
        const raw = e.clientY - y0;
        dy = raw > 0 ? raw : -Math.sqrt(-raw) * 2;
        const centred = window.matchMedia('(min-width: 640px)').matches;   // wider screens centre the sheet
        sheet.style.transform = `translate3d(${centred ? '-50%' : '0'}, ${dy}px, 0)`;
    });
    const end = e => {
        if (e.pointerId !== id) return;
        id = null;
        sheet.classList.remove('is-dragging');
        const close = e.type !== 'pointercancel' && (dy > sheet.offsetHeight * 0.3 || (dy > 24 && v > 0.5));
        if (close) closeCrewStatusSheet();
        else sheet.style.transform = '';
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
}

document.addEventListener('DOMContentLoaded', () => {
    initCrewSheetDrag();
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && crewSheetOpen) { e.stopPropagation(); closeCrewStatusSheet(); }
    });
});
// Live: a sign-in or sign-out (here or from the backend) updates the open sheet's headcount and rows
subscribeAttendance(() => { if (crewSheetOpen) renderCrewStatusSheet(); });
subscribeSites(() => { if (crewSheetOpen) renderCrewStatusSheet(); });
