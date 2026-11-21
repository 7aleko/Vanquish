/**
 * Site Hub (the Site screen, styles/site-hub.css): the command centre for one construction site.
 *
 *   Header    on the page itself, no card: the site's name as the large title (tap: the site switcher - a
 *             glass panel that grows from the title, with a search and every active site: name, street, stage,
 *             which one is active) and its street address (opens Maps) on the left; today's weather on the
 *             right (high, chance of rain, wind). The key in the top bar opens Site Access (lockbox PIN with
 *             Copy, access notes) for the active site.
 *   Milestone its own card, on the On Site card's surface: the upcoming milestone, its due day, the next trade
 *             on site (one line) and the checklist ring (coloured by the milestone's state); its full-width
 *             footer row, Full Schedule, opens the Schedule with that milestone open
 *   On Site   Mon-Fri; each day's crew (the roster), subcontractors and inspectors booked that day (the schedule)
 *             and deliveries, with today's sign-ins ("In • 6:48 AM", "Not Signed In") and a headcount. Collapsed
 *             (the default) it shows an avatar stack and who hasn't signed in; tapping it expands the full list
 *             in place (remembered per device). The headcount opens the Crew sheet (Call / Message).
 *   Search    a field under the header that opens the search page: trade chips (the schedule's trades) and
 *             words, scoped to the site (SiteSearchRules). Photos (2.15 across), Site Logs (the day, its trades
 *             and its photos) and Plans as carousels, then the days each trade was booked; each header opens
 *             all its results. Photos and logs carry trade tags: chosen when added (today's trades on site
 *             start chosen), and a photo can be re-tagged in the viewer.
 *   Bento     Drawings (PDFs, current revision) | Site Diary (latest entry), Site Photos (four, then +N); each
 *             opens its sheet (register by discipline, diary entries, photo gallery)
 *   +         speed dial: Add Photo, New Site Log, Upload Drawing - all for the active site
 *
 * State: siteHubState { siteId (the active site, shared with the Schedule), day (the On Site day) }; the open
 * overlays (switcher, search, + menu) are local flags. Every section reads through the selectors (getSiteById,
 * getScheduleTasks, getUpcomingMilestone, getAttendance, getDrawings, getSiteLogs, getSitePhotos ...) and every
 * change goes through a service, so switching site, ticking a checklist on the Schedule or signing in on Home
 * redraws the hub from the same records. "Today" is the sites' day (homeAttendanceDay, APP_CONFIG.siteDemoDay).
 */

const siteHubState = { siteId: null, day: null, scrollTop: 0, rosterOpen: false };
const SH_ROSTER_KEY = 'lifestyle.siteHub.rosterOpen';
const SH_STACK_MAX = 4;
try { siteHubState.rosterOpen = localStorage.getItem(SH_ROSTER_KEY) === '1'; } catch (_) { /* storage blocked: collapsed */ }
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
// "Mon 23 – Wed 25 Nov" / "Fri 27 Nov"
function shRange(startIso, endIso) {
    if (startIso === endIso) return shDate(startIso, true);
    const a = DateRules.fromIso(startIso), b = DateRules.fromIso(endIso);
    return `${SH_DAYS[a.getDay()]} ${a.getDate()}${a.getMonth() !== b.getMonth() ? ' ' + SH_MONTHS[a.getMonth()] : ''} – ${shDate(b, true)}`;
}
function shLongDate(iso) { return DateRules.fromIso(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }); }
// "7:00 AM – 3:30 PM": the standard shift (TIMESHEET_CONFIG)
function shShiftWindow() {
    const c = typeof TIMESHEET_CONFIG !== 'undefined' ? TIMESHEET_CONFIG : {};
    const t = hhmm => formatClockTime(`2000-01-01T${hhmm}:00`);
    return c.defaultStart && c.defaultFinish ? `${t(c.defaultStart)} – ${t(c.defaultFinish)}` : '7:00 AM – 3:30 PM';
}
// A window, compact for a roster row: a morning-to-afternoon shift drops its AM/PM ("7:00–3:30"), as site hours
// read on a whiteboard; anything else ("9:00 – 10:00 AM") only tightens its dash
function shCompactWindow(w) {
    const m = /^(\d{1,2}:\d{2})\s*AM\s*[–-]\s*(\d{1,2}:\d{2})\s*PM$/i.exec(String(w || '').trim());
    return m ? `${m[1]}–${m[2]}` : String(w || '').replace(/\s*[–-]\s*/, '–');
}
function shSite() { return getSiteById(siteHubState.siteId); }
function shStreetLine(site) { return site ? `${site.address}${site.suburb ? `, ${site.suburb}` : ''}` : ''; }

// The shared sheet (styles/sheet.css): opens it, or - already open - swaps its page in place (list -> record -> back)
function shSheet(title, html) {
    const overlay = document.getElementById('modal-overlay');
    const open = overlay && !overlay.classList.contains('opacity-0');
    if (!open) { openModal(title, html); return; }
    const body = document.getElementById('modal-body'), titleEl = document.getElementById('modal-title');
    titleEl.textContent = title; titleEl.hidden = !title;
    body.innerHTML = html;
    body.scrollTop = 0;
    body.classList.remove('sh-page-in'); void body.offsetWidth; body.classList.add('sh-page-in');
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

// Switch the active site (the switcher, or the Procore project picker with { fromProject: true }). Everything on
// the hub, the Schedule, search and Site Access follows.
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
    if (changed) crossfadeSiteHub(renderSiteHub); else renderSiteHub();
    if (changed && typeof onScheduleSiteChanged === 'function') onScheduleSiteChanged();     // one active site
    if (changed) {
        const view = document.getElementById('view-sitehub');
        if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
// A short crossfade: the old site's content fades out, the new one is drawn and fades in (no reload, no jump)
let shSwapTimer = null;
function crossfadeSiteHub(render) {
    const hub = document.getElementById('view-sitehub');
    if (!hub || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { render(); return; }
    clearTimeout(shSwapTimer);
    hub.classList.add('is-swapping');
    shSwapTimer = setTimeout(() => { render(); requestAnimationFrame(() => hub.classList.remove('is-swapping')); }, 150);
}
// The site you're rostered to today ("My Site" / "Your Site"), or null
function shMySiteId() {
    const id = getRosteredSiteId(shToday());
    return isSiteActive(id) ? id : null;
}
// The site's forecast for a day from its job's daily forecast (JOBS_DATA), or null when there isn't one
function getSiteForecast(siteId, date) {
    if (typeof JOBS_DATA === 'undefined' || !siteId || !date) return null;
    const job = JOBS_DATA.find(j => j.siteId === siteId);
    const label = `${date.getDate()} ${SH_MONTHS[date.getMonth()]}`;
    const day = job && Object.values(job.days || {}).find(d => d.date === label);
    if (!day) return null;
    const high = parseInt(String(day.temp), 10), rain = parseInt(String(day.rain), 10) || 0;
    const wind = parseInt(String(day.wind || ''), 10);
    if (!Number.isFinite(high)) return null;
    const icon = rain >= 60 ? 'ph-cloud-rain' : rain >= 30 ? 'ph-cloud' : rain >= 10 ? 'ph-cloud-sun' : 'ph-sun';
    return { high, rain, wind: Number.isFinite(wind) ? wind : null, icon,
        label: `${high}°, ${rain}% chance of rain${Number.isFinite(wind) ? `, wind ${wind} kilometres an hour` : ''}` };
}

// Opening Site afresh: back on today's roster (the active site is kept)
function resetSiteHubView() {
    if (siteHubFabOpen) toggleSiteHubFab(false);
    closeSiteSwitcher();
    closeSiteSearch(true);
    siteHubState.day = shDefaultDay();
    renderSiteHub();
}

// ---------- Render ----------
function renderSiteHub() {
    if (!document.getElementById('view-sitehub')) return;
    ensureSiteHubState();
    renderSiteSwitcherPill();
    renderSiteHubHero();
    renderSiteHubSchedule();
    renderSiteHubRoster();
    applySiteHubRosterOpen(false);
    renderSiteHubTiles();
    renderSiteHubPhotos();
    if (siteSwitcherOpen) renderSiteSwitcherList();
    if (siteSearch.open) renderSiteSearch();
}

function renderSiteHubHero() {
    const site = shSite();
    const name = document.getElementById('sh-site-name');
    if (!name) return;
    // The site's name large, its street address beneath: together, the switcher (the address is read out in the
    // button's label, renderSiteSwitcherPill)
    name.textContent = site ? site.shortName : 'No site';
    if (typeof refreshTopBarTitle === 'function') refreshTopBarTitle('sitehub');    // its copy in the bar
    document.getElementById('sh-site-address').textContent = site ? site.address : 'You have no active sites';

    renderSiteHubWeather();
    // Site Access: only sites with a key safe
    const lock = document.getElementById('sh-lock');
    lock.hidden = !(site && site.lockbox);                 // the key in the top bar
    lock.setAttribute('aria-label', site ? `Site access for ${site.address}: lockbox PIN and access notes` : 'Site access');
}

// The weather for the day chosen on On Site's day strip (today by default): the high, then the chance of rain
// and the wind, from the site's daily forecast. No forecast for that day hides it.
function renderSiteHubWeather() {
    const site = shSite(), wx = document.getElementById('sh-weather');
    if (!wx) return;
    const day = siteHubState.day || shToday();
    const fc = site ? getSiteForecast(site.id, day) : null;
    wx.hidden = !fc;
    if (!fc) return;
    document.getElementById('sh-weather-icon').className = `ph-fill ${fc.icon}`;
    document.getElementById('sh-weather-temp').textContent = `${fc.high}°`;
    document.getElementById('sh-weather-meta').textContent = `${fc.rain}% rain${fc.wind != null ? ` • ${fc.wind} km/h` : ''}`;
    const isToday = DateRules.toIso(day) === shTodayIso();
    wx.setAttribute('aria-label', `Weather ${isToday ? 'today' : `on ${shLongDate(DateRules.toIso(day))}`}: ${fc.label}`);
}

// The upcoming milestone card: the milestone to work towards, its due day, the next trade on site (one line) and
// the checklist ring (a checkmark once every item is done). The body opens the Schedule at this milestone,
// expanded; the footer row opens the Schedule as it is.
function renderSiteHubSchedule() {
    const siteId = siteHubState.siteId, card = document.getElementById('sh-sched');
    if (!card) return;
    const ms = getUpcomingMilestone(siteId), next = getNextOnSite(siteId, shTodayIso());
    const title = document.getElementById('sh-ms-title'), due = document.getElementById('sh-ms-due');
    const nextEl = document.getElementById('sh-ms-next'), ring = document.getElementById('sh-ms-ring');
    const body = document.getElementById('sh-sched-body'), open = document.getElementById('sh-sched-open');
    const eyebrow = document.getElementById('sh-ms-eyebrow-text');
    let label;
    if (ms) {
        const p = ScheduleRules.progress(ms), done = ScheduleRules.isComplete(ms);
        title.textContent = ms.title;
        due.textContent = done ? `Complete • ${shDate(ms.endDate, true)}` : `Due ${shDate(ms.endDate, true)}`;
        // Completed today, it stays here until the day ends (ScheduleRules.upcomingMilestone) and says so
        const today = ScheduleRules.completedOn(ms) === DateRules.toIso(new Date());
        eyebrow.textContent = today ? 'Completed Today' : done ? 'Milestone Complete' : 'Upcoming Milestone';
        ring.hidden = false;
        const tone = progressRingTone(ScheduleRules.milestoneStatus(ms, shTodayIso()).key);
        ring.innerHTML = renderProgressRing(p, { size: 92, stroke: 16, key: `ms:${ms.id}`, tone });
        lightProgressCard(card, tone);                    // the ring lights the card in its state's colour
        label = `${done ? 'Milestone' : 'Upcoming milestone'}: ${ms.title}, ${done ? 'complete' : `due ${shLongDate(ms.endDate)}, ${p.done} of ${p.total} prerequisites done`}`;
    } else {
        title.textContent = 'No milestones yet';
        eyebrow.textContent = 'Upcoming Milestone';
        due.textContent = 'Add one on the schedule';
        ring.hidden = true; ring.innerHTML = '';
        lightProgressCard(card, null);
        label = 'No milestones yet';
    }
    // The next trade on site, on one line: "● Next: Sparky Rough-In · Today". The trade is the part that
    // truncates; the label and the day always show.
    if (next) {
        const d = DateRules.fromIso(next.startDate);
        const when = next.startDate === shTodayIso() ? 'Today' : next.startDate === DateRules.toIso(DateRules.addDays(shToday(), 1)) ? 'Tomorrow' : `${SH_DAYS[d.getDay()]} ${d.getDate()}`;
        nextEl.innerHTML = `<span class="sh-next-dot" aria-hidden="true"></span><span class="sh-next-label">Next:</span><span class="sh-next-text">${shEsc(next.title)}</span><span class="sh-next-when">· ${when}</span>`;
        label += `. Next on site: ${next.title}, ${shLongDate(next.startDate)}`;
    } else {
        nextEl.innerHTML = `<span class="sh-next-dot is-idle" aria-hidden="true"></span><span class="sh-next-text">Nothing booked yet</span>`;
    }
    body.setAttribute('aria-label', `${label}. ${ms ? 'Open it in the schedule' : 'Open the schedule'}`);
    open.setAttribute('aria-label', 'Full schedule');
    animateProgressRings(card);
}

// ---------- On Site: the weekday's crew, subcontractors, inspectors and deliveries ----------
// Who is at `siteId` on `day`: the rostered crew (getCrewStatus: roster + the site's crew) and the companies
// booked on the schedule that day (subcontractors and inspections sign in; deliveries arrive in a window and
// aren't counted). Today's rows carry the sign-in records. { rows, counted, signedIn, kind }
function getSiteDayRoster(siteId, day) {
    const kind = crewDayKind(day), iso = DateRules.toIso(day), shift = shShiftWindow();
    if (!siteId) return { rows: [], counted: 0, signedIn: 0, kind };
    const records = getAttendance(day, siteId), me = getCurrentEmployeeId();
    const status = getCrewStatus(siteId, day);
    const crew = [...status.onSite, ...status.off].map(p => {
        const emp = getEmployeeByName(p.name);
        const rec = records.find(r => (emp ? r.employeeId === emp.id : r.name === p.name)) || null;
        return { type: 'crew', name: p.name, role: emp ? emp.role : 'Labour hire', you: !!(emp && emp.id === me), rec, window: shift };
    });
    const seen = new Set();
    const booked = ScheduleRules.onDay(getScheduleTasks(siteId), iso).filter(t => t.crew).map(t => {
        const trade = getScheduleTrade(t.tradeId);
        const type = t.tradeId === 'delivery' ? 'delivery' : t.tradeId === 'inspection' ? 'inspection' : 'trade';
        return { type, name: t.crew, role: type === 'delivery' ? 'Delivery' : type === 'inspection' ? 'Inspection' : 'Subcontractor',
            task: t, trade, rec: records.find(r => !r.employeeId && r.name === t.crew) || null, window: t.arrival || shift };
    }).filter(r => (seen.has(r.name) ? false : seen.add(r.name)));
    const order = { trade: 0, inspection: 1, delivery: 2 };
    booked.sort((a, b) => order[a.type] - order[b.type]);
    const rows = [...crew, ...booked];
    const counted = rows.filter(r => r.type !== 'delivery');
    return { rows, counted: counted.length, signedIn: counted.filter(r => r.rec && !r.rec.signedOutAt).length, kind };
}
// A row's status: today "In • 6:48 AM" / "Out • 3:30 PM" / "Not Signed In"; any other day the shift or arrival window
function shRosterStatus(r, kind) {
    if (kind === 'today' && r.type !== 'delivery') {
        if (r.rec && !r.rec.signedOutAt) return { cls: 'is-in', text: `In • ${formatClockTime(r.rec.signedInAt)}` };
        if (r.rec) return { cls: 'is-out', text: `Out • ${formatClockTime(r.rec.signedOutAt)}` };
        return { cls: 'is-pending', text: 'Not Signed In' };
    }
    return { cls: 'is-window', text: shCompactWindow(r.window) };
}

function selectSiteHubDay(iso) {
    if (iso === DateRules.toIso(siteHubState.day)) return;
    triggerHaptic('light');
    siteHubState.day = DateRules.fromIso(iso);
    renderSiteHubRoster(true);
    renderSiteHubWeather();
}

function renderSiteHubRoster(dayChanged) {
    const siteId = siteHubState.siteId, day = siteHubState.day;
    const strip = document.getElementById('sh-days');
    if (!strip) return;
    // Mon-Fri of the chosen day's week; a glass segment glides to the chosen day, a dot marks it
    const monday = DateRules.mondayOf(day), selIso = DateRules.toIso(day), todayIso = shTodayIso();
    const days = [0, 1, 2, 3, 4].map(i => DateRules.addDays(monday, i));
    const sel = Math.max(0, days.findIndex(d => DateRules.toIso(d) === selIso));
    strip.style.setProperty('--sel', String(sel));
    if (!strip.querySelector('.sh-day') || strip.dataset.week !== DateRules.toIso(monday)) {
        strip.dataset.week = DateRules.toIso(monday);
        strip.innerHTML = `<span class="sh-day-pill" aria-hidden="true"></span>` + days.map(d => {
            const iso = DateRules.toIso(d);
            return `<button type="button" role="tab" class="sh-day${iso === todayIso ? ' is-today' : ''}" data-iso="${iso}"
                        aria-label="${d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}${iso === todayIso ? ', today' : ''}"
                        onclick="selectSiteHubDay('${iso}')">
                    <span class="sh-day-name">${SH_DAYS[d.getDay()]}</span><span class="sh-day-num">${d.getDate()}</span><span class="sh-day-dot" aria-hidden="true"></span>
                </button>`;
        }).join('');
    }
    strip.querySelectorAll('.sh-day').forEach(b => {
        const on = b.dataset.iso === selIso;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
    });

    const roster = getSiteDayRoster(siteId, day);
    const pill = document.getElementById('sh-crew-pill'), list = document.getElementById('sh-roster');
    const live = roster.kind === 'today';
    pill.hidden = !roster.counted;
    pill.className = `sh-crew-pill${live ? ' is-live' : ''}`;
    pill.innerHTML = live
        ? `<span class="sh-live-dot" aria-hidden="true"></span><span><b>${roster.signedIn}</b>&nbsp;/ ${roster.counted} Signed In</span>`
        : `<span>${roster.counted} Scheduled</span>`;
    pill.setAttribute('aria-label', `${live ? `${roster.signedIn} of ${roster.counted} signed in` : `${roster.counted} scheduled`}. Open the crew list`);

    list.innerHTML = roster.rows.length ? roster.rows.map((r, i) => {
        const st = shRosterStatus(r, roster.kind);
        const open = r.task ? `openScheduleTask('${shEsc(r.task.id)}')` : 'openSiteHubCrew()';
        return `<li style="--i:${i}"><button type="button" class="sh-person is-${r.type}" onclick="${open}">
                ${r.type === 'delivery' ? '<span class="sh-person-icon" aria-hidden="true"><i class="ph-fill ph-truck"></i></span>'
                  : r.type === 'inspection' ? '<span class="sh-person-icon is-inspect" aria-hidden="true"><i class="ph-fill ph-clipboard-text"></i></span>'
                  : renderRoleAvatar(r.name, 'row')}
                <span class="sh-person-main">
                    <span class="sh-person-name">${shEsc(r.name)}</span>
                    <span class="sh-person-role"><span class="sh-badge${r.type === 'crew' ? '' : ' is-sub'}">${shEsc(r.role)}</span>${r.you ? '<span class="sh-you">You</span>' : ''}${r.task ? `<span class="sh-person-task">${shEsc(r.task.title)}</span>` : ''}</span>
                </span>
                <span class="sh-person-status ${st.cls}">${st.cls === 'is-in' ? '<i class="sh-dot" aria-hidden="true"></i>' : st.cls === 'is-pending' ? '<i class="sh-dot is-amber" aria-hidden="true"></i>' : st.cls === 'is-out' ? '<i class="sh-dot is-muted" aria-hidden="true"></i>' : ''}${shEsc(st.text)}</span>
            </button></li>`;
    }).join('') : `<li class="sh-roster-empty"><i class="ph-fill ph-users-three" aria-hidden="true"></i>Nobody scheduled on ${shEsc(shDate(day, true))}</li>`;
    if (dayChanged && siteHubState.rosterOpen) { list.classList.remove('is-fresh'); void list.offsetWidth; list.classList.add('is-fresh'); }
    renderSiteHubRosterSummary(roster, dayChanged);
}
// The collapsed summary: an avatar stack of who's on site (deliveries aside) and, today, who hasn't signed in
function renderSiteHubRosterSummary(roster, dayChanged) {
    const stack = document.getElementById('sh-stack'), hint = document.getElementById('sh-roster-hint');
    const toggle = document.getElementById('sh-roster-toggle');
    if (!stack) return;
    const people = roster.rows.filter(r => r.type !== 'delivery');
    const deliveries = roster.rows.length - people.length;
    const shown = people.slice(0, SH_STACK_MAX), extra = people.length - shown.length;
    stack.innerHTML = shown.map(r => (r.type === 'inspection'
        ? '<span class="sh-person-icon is-inspect"><i class="ph-fill ph-clipboard-text"></i></span>'
        : renderRoleAvatar(r.name, 'head'))).join('') + (extra > 0 ? `<span class="sh-stack-more">+${extra}</span>` : '');
    const absent = roster.kind === 'today' ? people.filter(r => !r.rec) : [];
    const missing = absent.length;
    const open = siteHubState.rosterOpen;
    // You haven't signed in here today and it's the site you're rostered to: the row offers Sign In instead
    // (the pill above already says how many are in, so the row says what to do, not the count again)
    const me = absent.find(r => r.you);
    const canSignIn = !!(me && siteHubState.siteId === getRosteredSiteId(shToday()) && typeof toggleSiteSignIn === 'function');
    let text, cls = '';
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    if (!people.length) text = deliveries ? `${plural(deliveries, 'delivery', 'deliveries')} only` : 'Nobody scheduled';
    else if (roster.kind === 'today') {
        // Who's missing, by name when it's one person; the avatars already show who's here
        text = !missing ? 'All signed in' : canSignIn ? '' : missing === 1 ? `${absent[0].name.split(' ')[0]} not signed in` : `${missing} not signed in`;
        cls = missing ? 'is-amber' : 'is-live';
    } else {                                                // another day: the mix, not names the avatars already show
        const n = t => people.filter(r => r.type === t).length;
        text = [n('crew') && plural(n('crew'), 'crew', 'crew'), n('trade') && plural(n('trade'), 'trade', 'trades'),
            n('inspection') && plural(n('inspection'), 'inspection', 'inspections'), deliveries && plural(deliveries, 'delivery', 'deliveries')]
            .filter(Boolean).join(' · ');
    }
    hint.className = `sh-roster-hint ${cls}`;
    hint.innerHTML = text ? `${cls === 'is-amber' ? '<i class="sh-dot is-amber" aria-hidden="true"></i>' : ''}<span class="sh-roster-hint-text">${shEsc(text)}</span>` : '';
    const signIn = document.getElementById('sh-signin');
    if (signIn) {
        signIn.hidden = !canSignIn;
        document.getElementById('sh-onsite').classList.toggle('has-signin', canSignIn);
    }
    toggle.disabled = !roster.rows.length;
    toggle.setAttribute('aria-label', `${people.length ? `${people.length} on site: ${people.map(r => r.name).join(', ')}` : 'Nobody scheduled'}${missing ? `, ${missing} not signed in` : ''}. ${open ? 'Hide' : 'Show'} the list`);
    if (dayChanged && !open) { stack.classList.remove('is-fresh'); void stack.offsetWidth; stack.classList.add('is-fresh'); }
}
function toggleSiteHubRoster(open = !siteHubState.rosterOpen) {
    triggerHaptic('light');
    siteHubState.rosterOpen = open;
    try { localStorage.setItem(SH_ROSTER_KEY, open ? '1' : '0'); } catch (_) {}
    applySiteHubRosterOpen(true);
}
function applySiteHubRosterOpen(animate) {
    const card = document.getElementById('sh-onsite'), panel = document.getElementById('sh-roster-panel');
    if (!card) return;
    const open = siteHubState.rosterOpen;
    card.classList.toggle('is-open', open);
    panel.toggleAttribute('inert', !open);
    document.getElementById('sh-roster-toggle').setAttribute('aria-expanded', String(open));
    const list = document.getElementById('sh-roster');
    if (open && animate) { list.classList.remove('is-fresh'); void list.offsetWidth; list.classList.add('is-fresh'); }
    renderSiteHubRosterSummary(getSiteDayRoster(siteHubState.siteId, siteHubState.day), false);
}
function openSiteHubCrew() {
    if (siteHubState.siteId) openCrewSheetFor(siteHubState.siteId, siteHubState.day);
}

// ---------- Bento ----------
function renderSiteHubTiles() {
    const siteId = siteHubState.siteId;
    const dwgs = siteId ? getDrawings(siteId) : [];
    const dSub = document.getElementById('sh-tile-dwg-sub');
    if (!dSub) return;
    dSub.textContent = dwgs.length ? `${dwgs.length} PDF${dwgs.length === 1 ? '' : 's'} • Rev ${dwgs[0].revision}` : 'No drawings yet';
    document.getElementById('sh-tile-dwg').setAttribute('aria-label', `Drawings: ${dSub.textContent}`);
    const logs = siteId ? getSiteLogs(siteId) : [];
    const lSub = document.getElementById('sh-tile-diary-sub');
    // A working day with no entry yet says so in amber; the diary it opens has New Entry at the top
    const todayIso = shTodayIso(), wd = shToday().getDay();
    const needsLog = !!siteId && wd !== 0 && wd !== 6 && !logs.some(l => l.date === todayIso);
    const tile = document.getElementById('sh-tile-diary');
    tile.classList.toggle('is-due', needsLog);
    lSub.innerHTML = needsLog ? '<i class="sh-dot is-amber" aria-hidden="true"></i>No log today'
        : shEsc(logs.length ? (logs[0].date === todayIso ? 'Logged today' : `Latest: ${shDate(logs[0].date, true)}`) : 'No entries yet');
    tile.setAttribute('aria-label', needsLog ? `Site Diary: no log today${logs.length ? `, latest entry ${shLongDate(logs[0].date)}` : ''}. Open the diary to add today's entry`
        : `Site Diary: ${logs.length ? `latest entry ${shLongDate(logs[0].date)}, ${logs[0].title}` : 'no entries yet'}`);
}

// Recent photos: the four newest at this site; the 4th carries "+N" when there are more
function renderSiteHubPhotos() {
    const siteId = siteHubState.siteId;
    const photos = siteId ? getSitePhotos(siteId) : [];
    const count = document.getElementById('sh-photos-count'), row = document.getElementById('sh-photos');
    if (!row) return;
    count.innerHTML = `${photos.length} photo${photos.length === 1 ? '' : 's'}<i class="ph-bold ph-caret-right" aria-hidden="true"></i>`;
    if (!photos.length) {
        row.className = 'sh-photo-row is-empty';
        row.innerHTML = `<p class="sh-bento-empty"><i class="ph-fill ph-image" aria-hidden="true"></i>No photos at this site yet</p>`;
        return;
    }
    row.className = 'sh-photo-row';
    const shown = photos.slice(0, 4), more = photos.length - shown.length;
    row.innerHTML = shown.map((p, i) => {
        const overflow = i === 3 && more > 0;
        return `<button type="button" class="sh-photo" onclick="${overflow ? 'openSitePhotos()' : `openSitePhoto('${shEsc(p.id)}')`}"
                    aria-label="${overflow ? `View all ${photos.length} photos` : `${shEsc(p.caption || 'Photo')}, ${shDate(p.date)}`}">
                <img src="${shEsc(p.src)}" alt="" loading="lazy" decoding="async">${overflow ? `<span class="sh-photo-more">+${more}</span>` : ''}
            </button>`;
    }).join('');
}

// ---------- Site switcher (the pill expands in place) ----------
let siteSwitcherOpen = false;
function renderSiteSwitcherPill() {
    const site = shSite(), btn = document.getElementById('sh-site-btn');
    if (btn) btn.setAttribute('aria-label', site ? `${site.shortName}, ${shStreetLine(site)}. Switch site` : 'Choose a site');
}
function toggleSiteSwitcher(e) { if (siteSwitcherOpen) closeSiteSwitcher(); else openSiteSwitcher(e); }
function openSiteSwitcher(e) {
    if (e) e.stopPropagation();
    if (siteSwitcherOpen) return;
    const box = document.getElementById('sh-switch-box');
    if (!box) return;
    if (siteHubFabOpen) toggleSiteHubFab(false);
    closeSiteSearch(true);
    triggerHaptic('light');
    siteSwitcherOpen = true;
    const input = document.getElementById('sh-switch-input');
    input.value = '';
    renderSiteSwitcherList();
    box.classList.add('is-open');
    document.getElementById('sh-switcher').classList.add('is-open');
    document.getElementById('sh-switch-scrim').hidden = false;
    document.getElementById('sh-site-btn').setAttribute('aria-expanded', 'true');
    input.tabIndex = 0;
    box.querySelector('.sh-switch-chev').tabIndex = 0;
    input.focus({ preventScroll: true });                // in the tap itself, so iOS raises the keyboard
    const view = document.getElementById('view-sitehub');
    if (view && view.scrollTop > 0) view.scrollTo({ top: 0, behavior: 'smooth' });   // the panel opens at the title
}
function closeSiteSwitcher(refocus) {
    if (!siteSwitcherOpen) return;
    siteSwitcherOpen = false;
    const box = document.getElementById('sh-switch-box'), input = document.getElementById('sh-switch-input');
    box.classList.remove('is-open');
    document.getElementById('sh-switcher').classList.remove('is-open');
    document.getElementById('sh-switch-scrim').hidden = true;
    document.getElementById('sh-site-btn').setAttribute('aria-expanded', 'false');
    input.tabIndex = -1;
    box.querySelector('.sh-switch-chev').tabIndex = -1;
    input.blur();
    if (refocus) document.getElementById('sh-site-btn').focus({ preventScroll: true });
}
// Every active site, filtered as you type (street, suburb, name, stage): yours first, then A-Z
function renderSiteSwitcherList() {
    const input = document.getElementById('sh-switch-input');
    const tokens = shTokens(input ? input.value : '');
    const mySite = shMySiteId(), mine = getSiteHubSites().map(s => s.id);
    const rank = s => (s.id === mySite ? 0 : mine.includes(s.id) ? 1 : 2);
    const sites = getActiveSites().filter(s => !tokens.length || shMatches([s.address, s.suburb, s.shortName, getSiteStage(s.id)].join(' '), tokens))
        .slice().sort((a, b) => rank(a) - rank(b) || a.shortName.localeCompare(b.shortName));
    const list = document.getElementById('sh-switch-list');
    list.innerHTML = sites.length ? sites.map(s => {
        const on = s.id === siteHubState.siteId;
        return `<button type="button" role="option" aria-selected="${on}" class="sh-switch-row${on ? ' is-selected' : ''}" onclick="selectSite('${shEsc(s.id)}')">
                <span class="sh-switch-pin"><i class="ph-fill ph-map-pin" aria-hidden="true"></i></span>
                <span class="sh-switch-row-main">
                    <span class="sh-switch-row-name">${shMark(s.shortName, tokens)}</span>
                    <span class="sh-switch-row-sub">${shMark(s.address, tokens)}${getSiteStage(s.id) ? ` <span aria-hidden="true">•</span> ${shMark(getSiteStage(s.id), tokens)}` : ''}</span>
                </span>
                ${s.id === mySite ? '<span class="sh-your-site">Your Site</span>' : ''}
                ${on ? '<span class="sh-active-dot" role="img" aria-label="Active site"><i></i></span>' : ''}
            </button>`;
    }).join('') : `<p class="sh-switch-empty">No active sites match “${shEsc(input.value.trim())}”.</p>`;
}

// ---------- Search (scoped to the active site) ----------
// A full-height page over the hub. Trade chips (the schedule's trades that this site has records for) filter;
// typed words search titles, notes and captions, trade names and the bookings on site that day
// (SiteSearchRules). Results: Photos, Site Logs and Plans as carousels, then the days each trade was on site.
// A section's header opens all of its results; a photo opens the viewer, a log its day with its photos.
const siteSearch = { open: false, timer: null, tradeId: null, last: null };
const SH_PHOTO_PEEK = 12, SH_CARD_PEEK = 8;

function shTokens(q) { return String(q || '').toLowerCase().split(/\s+/).filter(Boolean); }
function shMatches(text, tokens) { const t = String(text || '').toLowerCase(); return tokens.every(k => t.includes(k)); }
// Escaped text with each query word subtly highlighted
function shMark(text, tokens) {
    const safe = shEsc(text);
    if (!tokens || !tokens.length) return safe;
    const re = new RegExp(`(${tokens.map(k => shEsc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return safe.replace(re, '<mark>$1</mark>');
}
// "James Begg" -> "James B."
function shShortName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : (parts[0] || '');
}
// Trade colours (the schedule's helpers when it's loaded, a neutral fallback otherwise)
function schTintSafe(hex, a) { return typeof schTint === 'function' ? schTint(hex, a) : `rgba(255,255,255,${a})`; }
function schLightSafe(hex) { return typeof schLight === 'function' ? schLight(hex) : '#fff'; }
// A small trade tag: its colour and name
function shTradeTag(id, cls = '') {
    const t = getScheduleTrade(id);
    return `<span class="sh-trade-tag ${cls}" style="--c:${shEsc(t.color)};--cl:${schLightSafe(t.color)}"><i aria-hidden="true"></i>${shEsc(t.name)}</span>`;
}

// The active site's records, as SiteSearchRules takes them
function siteSearchData(siteId) {
    return {
        photos: getSitePhotos(siteId), logs: getSiteLogs(siteId), drawings: getDrawings(siteId),
        tasks: getScheduleTasks(siteId), trades: getScheduleTrades()
    };
}
function siteSearchResults() {
    const input = document.getElementById('sh-search-input');
    return SiteSearchRules.search(siteSearchData(siteHubState.siteId), { text: input ? input.value : '', tradeId: siteSearch.tradeId });
}

function openSiteSearch(tradeId) {
    const overlay = document.getElementById('sh-search-overlay'), input = document.getElementById('sh-search-input');
    if (!overlay || !siteHubState.siteId) return;
    if (siteHubFabOpen) toggleSiteHubFab(false);
    closeSiteSwitcher();
    triggerHaptic('light');
    siteSearch.open = true;
    siteSearch.tradeId = tradeId || null;
    input.value = '';
    document.getElementById('sh-search-clear').hidden = true;
    input.placeholder = `Search ${getSiteName(siteHubState.siteId)}: photos, logs, plans...`;
    overlay.hidden = false;
    input.focus({ preventScroll: true });              // in the tap itself, so iOS raises the keyboard
    requestAnimationFrame(() => requestAnimationFrame(() => { if (siteSearch.open) overlay.classList.add('is-open'); }));
    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = true;
    renderSiteSearch();
    document.getElementById('sh-search-results').scrollTop = 0;
}
function closeSiteSearch(silent) {
    const overlay = document.getElementById('sh-search-overlay');
    if (!overlay || !siteSearch.open) return;
    siteSearch.open = false;
    clearTimeout(siteSearch.timer);
    overlay.classList.remove('is-open');
    document.getElementById('sh-search-input').blur();
    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = false;
    setTimeout(() => { if (!siteSearch.open) overlay.hidden = true; }, 280);
    if (!silent) { const btn = document.getElementById('sh-search-btn'); if (btn) btn.focus({ preventScroll: true }); }
}
function clearSiteSearch() {
    const input = document.getElementById('sh-search-input');
    triggerHaptic('light');
    input.value = '';
    document.getElementById('sh-search-clear').hidden = true;
    input.focus();
    renderSiteSearch();
}
function setSiteSearchTrade(id) {
    triggerHaptic('light');
    siteSearch.tradeId = siteSearch.tradeId === id ? null : id;
    renderSiteSearch();
    document.getElementById('sh-search-results').scrollTop = 0;
}

// The trade chips: All, then every trade this site has photos, logs or bookings for, busiest first
function renderSiteSearchChips() {
    const siteId = siteHubState.siteId, count = new Map();
    const bump = id => count.set(id, (count.get(id) || 0) + 1);
    getSitePhotos(siteId).forEach(p => (p.tradeIds || []).forEach(bump));
    getSiteLogs(siteId).forEach(l => (l.tradeIds || []).forEach(bump));
    getScheduleTasks(siteId).filter(t => !t.milestone).forEach(t => bump(t.tradeId));
    const ids = [...count.keys()].sort((a, b) => count.get(b) - count.get(a));
    if (siteSearch.tradeId && !ids.includes(siteSearch.tradeId)) ids.unshift(siteSearch.tradeId);
    const chip = (id, label, dot) => {
        const on = (siteSearch.tradeId || null) === id;
        return `<button type="button" class="filter-pill${on ? ' is-active' : ''}" aria-pressed="${on}" onclick="setSiteSearchTrade(${id ? `'${shEsc(id)}'` : 'null'})">${dot ? `<i class="sh-chip-dot" style="background:${shEsc(dot)}" aria-hidden="true"></i>` : ''}${shEsc(label)}</button>`;
    };
    document.getElementById('sh-search-chips').innerHTML = chip(null, 'All') + ids.map(id => { const t = getScheduleTrade(id); return chip(id, t.name, t.color); }).join('');
}

function renderSiteSearch() {
    const out = document.getElementById('sh-search-results');
    if (!out || !siteHubState.siteId) return;
    renderSiteSearchChips();
    const input = document.getElementById('sh-search-input'), query = input.value.trim();
    const r = siteSearchResults(), t = r.tokens, filtered = !!(query || siteSearch.tradeId);
    siteSearch.last = r;
    const site = getSiteName(siteHubState.siteId), trade = siteSearch.tradeId ? getScheduleTrade(siteSearch.tradeId).name : '';
    if (filtered && !r.photos.length && !r.logs.length && !r.plans.length && !r.days.length) {
        out.innerHTML = `<div class="sh-search-hint"><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
            <strong>No results${query ? ` for “${shEsc(query)}”` : ''}${trade ? ` in ${shEsc(trade)}` : ''}</strong>
            <span>Nothing at ${shEsc(site)} matches. Try a trade, a company or a drawing number.</span></div>`;
        return;
    }
    const head = (key, title, n, hint) => `<button type="button" class="sh-sec-head" onclick="openSiteSearchAll('${key}')"${n ? '' : ' disabled'}>
            <h3>${title}</h3><span class="sh-sec-count">${n}${hint ? ` ${hint}` : ''}</span>${n ? '<i class="ph-bold ph-caret-right" aria-hidden="true"></i>' : ''}</button>`;
    const empty = what => `<p class="sh-sec-empty">No ${what}${trade ? ` tagged ${shEsc(trade)}` : ''}${query ? ` matching “${shEsc(query)}”` : ''}.</p>`;
    let h = '';
    if (filtered) h += `<p class="sh-search-summary">${[trade, query && `“${shEsc(query)}”`].filter(Boolean).join(' · ')} at ${shEsc(site)}: ${r.logs.length} day${r.logs.length === 1 ? '' : 's'} logged, ${r.photos.length} photo${r.photos.length === 1 ? '' : 's'}</p>`;
    // Photos: 2.15 across
    const photoIds = r.photos.map(p => p.id);
    shSheetPhotoIds = photoIds;
    h += `<section class="sh-sec">${head('photos', 'Photos', r.photos.length)}
        ${r.photos.length ? `<div class="sh-carousel is-photos">${r.photos.slice(0, SH_PHOTO_PEEK).map(p => `
            <button type="button" class="sh-pcard" onclick="openSitePhoto('${shEsc(p.id)}', siteSearch.last.photos.map(x => x.id))" aria-label="${shEsc(p.caption || 'Photo')}, ${shDate(p.date, true)}">
                <img src="${shEsc(p.src)}" alt="" loading="lazy" decoding="async">
                <span class="sh-pcard-info"><span class="sh-pcard-date">${shDate(p.date, true)}</span>${(p.tradeIds || []).length ? `<span class="sh-pcard-tags">${p.tradeIds.slice(0, 2).map(id => shTradeTag(id, 'is-on-photo')).join('')}</span>` : ''}</span>
            </button>`).join('')}${r.photos.length > SH_PHOTO_PEEK ? `<button type="button" class="sh-more-card" onclick="openSiteSearchAll('photos')"><b>+${r.photos.length - SH_PHOTO_PEEK}</b><span>See all</span></button>` : ''}</div>` : empty('photos')}</section>`;
    // Site logs: the day, what happened, its trades and the photos attached to it
    h += `<section class="sh-sec">${head('logs', 'Site Logs', r.logs.length)}
        ${r.logs.length ? `<div class="sh-carousel is-logs">${r.logs.slice(0, SH_CARD_PEEK).map(l => renderLogCard(l, t)).join('')}${r.logs.length > SH_CARD_PEEK ? `<button type="button" class="sh-more-card" onclick="openSiteSearchAll('logs')"><b>+${r.logs.length - SH_CARD_PEEK}</b><span>See all</span></button>` : ''}</div>` : empty('site logs')}</section>`;
    // Plans
    h += `<section class="sh-sec">${head('plans', 'Plans', r.plans.length)}
        ${r.plans.length ? `<div class="sh-carousel is-plans">${r.plans.slice(0, SH_CARD_PEEK).map(d => `
            <button type="button" class="sh-plan-card" onclick="openSiteDrawing('${shEsc(d.id)}')">
                <span class="sh-plan-sheet"><i class="ph-fill ph-file-pdf" aria-hidden="true"></i>${shMark(d.sheet, t)}</span>
                <span class="sh-plan-title">${shMark(d.title, t)}</span>
                <span class="sh-plan-meta"><span class="sh-rev">Rev ${shEsc(d.revision)}</span>${shEsc(d.discipline)}</span>
            </button>`).join('')}${r.plans.length > SH_CARD_PEEK ? `<button type="button" class="sh-more-card is-plan" onclick="openSiteSearchAll('plans')"><b>+${r.plans.length - SH_CARD_PEEK}</b><span>See all</span></button>` : ''}</div>` : empty('plans')}</section>`;
    // Days on site: when each matching trade was booked
    if (filtered) h += `<section class="sh-sec">${head('days', 'Days on Site', r.days.length)}
        ${r.days.length ? `<div class="sh-card sh-list">${r.days.slice(0, 6).map(x => renderDayRow(x, t)).join('')}</div>` : empty('bookings')}</section>`;
    out.innerHTML = h;
}
// A site log as a card: the day, what happened, its trades and the photos taken for it
function renderLogCard(l, tokens) {
    const d = DateRules.fromIso(l.date), photos = getLogPhotos(l.id);
    return `<button type="button" class="sh-lcard" onclick="openSiteLog('${shEsc(l.id)}')">
            <span class="sh-lcard-top"><span class="sh-lcard-date">${SH_DAYS[d.getDay()]} ${d.getDate()} ${SH_MONTHS[d.getMonth()]}</span><span class="sh-lcard-by">${shEsc(shShortName(l.authorName))}</span></span>
            <span class="sh-lcard-title">${shMark(l.title, tokens)}</span>
            ${(l.tradeIds || []).length ? `<span class="sh-lcard-tags">${l.tradeIds.map(id => shTradeTag(id)).join('')}</span>` : ''}
            ${photos.length ? `<span class="sh-lcard-photos">${photos.slice(0, 3).map((p, i) => `<img src="${shEsc(p.src)}" alt="" loading="lazy">${i === 2 && photos.length > 3 ? `<b>+${photos.length - 3}</b>` : ''}`).join('')}</span>`
                : `<span class="sh-lcard-body">${shEsc(l.body || '')}</span>`}
        </button>`;
}
// A booking: its dates, what, who and when they arrive
function renderDayRow(x, tokens) {
    const tr = getScheduleTrade(x.tradeId), d = DateRules.fromIso(x.startDate), today = shTodayIso();
    const when = x.endDate < today ? 'Done' : x.startDate <= today ? 'On site' : 'Booked';
    return `<button type="button" class="sh-row" onclick="openScheduleTask('${shEsc(x.id)}')">
            <span class="sh-row-icon" style="color:${schLightSafe(tr.color)};background:${schTintSafe(tr.color, 0.14)}"><i class="fa-solid ${shEsc(tr.icon || 'fa-helmet-safety')}" aria-hidden="true"></i></span>
            <span class="sh-row-main">
                <span class="sh-row-title">${shMark(x.title, tokens)}</span>
                <span class="sh-row-meta">${shRange(x.startDate, x.endDate)} · ${shMark(x.crew || tr.name, tokens)}</span>
            </span>
            <span class="sh-when is-${when === 'Done' ? 'done' : when === 'On site' ? 'now' : 'next'}">${when}</span>
        </button>`;
}
// A section's every result, in a sheet over the search
function openSiteSearchAll(key) {
    const r = siteSearch.last;
    if (!r) return;
    triggerHaptic('light');
    const trade = siteSearch.tradeId ? getScheduleTrade(siteSearch.tradeId).name : '', q = document.getElementById('sh-search-input').value.trim();
    const what = [trade, q && `“${q}”`].filter(Boolean).join(' · ') || 'Everything';
    const kicker = n => `<p class="sh-detail-kicker">${shEsc(getSiteName(siteHubState.siteId))} · ${shEsc(what)} · ${n}</p>`;
    if (key === 'photos') {
        shSheetPhotoIds = r.photos.map(p => p.id);
        const days = [];
        r.photos.forEach(p => { const g = days[days.length - 1]; if (g && g.date === p.date) g.list.push(p); else days.push({ date: p.date, list: [p] }); });
        shSheet('Photos', `<div class="sh-sheet-list">${kicker(`${r.photos.length} photos`)}${days.map(g => `
            <section class="sh-sheet-group"><h3 class="sh-sheet-group-title">${shEsc(shDate(g.date, true))}<span>${shEsc(g.list[0].caption || '')}</span></h3>
                <div class="sh-gallery">${g.list.map(p => `<button type="button" class="sh-thumb" onclick="openSitePhoto('${shEsc(p.id)}', shSheetPhotoIds)" aria-label="${shEsc(p.caption || 'Photo')}"><img src="${shEsc(p.src)}" alt="" loading="lazy"></button>`).join('')}</div>
            </section>`).join('')}</div>`);
    } else if (key === 'logs') {
        shSheet('Site Logs', `<div class="sh-sheet-list">${kicker(`${r.logs.length} day${r.logs.length === 1 ? '' : 's'}`)}<div class="sh-lcard-list">${r.logs.map(l => renderLogCard(l, r.tokens)).join('')}</div></div>`);
    } else if (key === 'plans') {
        shSheet('Plans', `<div class="sh-sheet-list">${kicker(`${r.plans.length} sheets`)}<div class="sh-card sh-list">${r.plans.map(d => renderDrawingRow(d, r.tokens)).join('')}</div></div>`);
    } else if (key === 'days') {
        shSheet('Days on Site', `<div class="sh-sheet-list">${kicker(`${r.days.length} booking${r.days.length === 1 ? '' : 's'}`)}<div class="sh-card sh-list">${r.days.map(x => renderDayRow(x, r.tokens)).join('')}</div></div>`);
    }
}

// ---------- Site Access (lock) ----------
function openSiteAccess() {
    const site = shSite();
    if (!site || !site.lockbox) return;
    triggerHaptic('light');
    if (siteHubFabOpen) toggleSiteHubFab(false);
    shSheet('Site Access', `
        <div class="sh-access">
            <p class="sh-detail-kicker"><i class="ph-fill ph-map-pin" aria-hidden="true"></i>${shEsc(getSiteFullAddress(site.id))}</p>
            <div class="sh-pin-card">
                <span class="sh-pin-icon" aria-hidden="true"><i class="ph-fill ph-lock-key"></i></span>
                <span class="sh-pin-main">
                    <span class="sh-pin-label">Lockbox PIN</span>
                    <span class="sh-pin-value" aria-label="PIN ${shEsc(site.lockbox.split('').join(' '))}">#${shEsc(site.lockbox)}</span>
                </span>
                <button type="button" id="sh-pin-copy" class="sh-copy-btn" onclick="copySiteLockbox()"><i class="ph-fill ph-copy" aria-hidden="true"></i><span>Copy</span></button>
            </div>
            <p class="sheet-label">Access Notes</p>
            <p class="sh-access-notes"><i class="ph-fill ph-info" aria-hidden="true"></i><span>${shEsc(site.accessNotes || 'No access notes for this site.')}</span></p>
        </div>`);
}
let shCopyTimer = null;
async function copySiteLockbox() {
    const site = shSite();
    if (!site || !site.lockbox) return;
    let ok = false;
    try { await navigator.clipboard.writeText(site.lockbox); ok = true; }
    catch (_) {                                            // no Clipboard API access: the old way
        const ta = document.createElement('textarea');
        ta.value = site.lockbox; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        ta.remove();
    }
    const btn = document.getElementById('sh-pin-copy');
    if (!ok) { triggerHaptic('error'); showSnack(`Couldn’t copy. The PIN is ${site.lockbox}`); return; }
    triggerHaptic('success');
    showSnack('Lockbox PIN copied', null, null, { icon: 'ph-check-circle' });
    if (btn) {
        btn.classList.add('is-done');
        btn.innerHTML = '<i class="ph-bold ph-check" aria-hidden="true"></i><span>Copied</span>';
        clearTimeout(shCopyTimer);
        shCopyTimer = setTimeout(() => {
            const b = document.getElementById('sh-pin-copy');
            if (b) { b.classList.remove('is-done'); b.innerHTML = '<i class="ph-fill ph-copy" aria-hidden="true"></i><span>Copy</span>'; }
        }, 1800);
    }
}

// ---------- Drawings ----------
function openSiteDrawings() {
    const site = shSite();
    if (!site) return;
    triggerHaptic('light');
    const dwgs = getDrawings(site.id);
    const groups = DRAWING_DISCIPLINES.map(d => ({ d, list: dwgs.filter(x => x.discipline === d).sort((a, b) => a.sheet.localeCompare(b.sheet)) })).filter(g => g.list.length);
    shSheet('Drawings', `
        <div class="sh-sheet-list">
            <p class="sh-detail-kicker">${shEsc(site.address)} • ${dwgs.length} PDF${dwgs.length === 1 ? '' : 's'}${dwgs.length ? ` • Current Rev ${shEsc(dwgs[0].revision)}` : ''}</p>
            ${groups.length ? groups.map(g => `
                <section class="sh-sheet-group">
                    <h3 class="sh-sheet-group-title">${shEsc(g.d)}<span>${g.list.length}</span></h3>
                    <div class="sh-card sh-list">${g.list.map(d => renderDrawingRow(d)).join('')}</div>
                </section>`).join('')
            : `<div class="sh-empty"><i class="ph-fill ph-stack" aria-hidden="true"></i><span>No drawings in the register yet.</span><button type="button" class="sh-empty-action" onclick="openUploadDrawing()">Upload Drawing</button></div>`}
        </div>`);
}
function renderDrawingRow(d, tokens) {
    return `<button type="button" class="sh-row" onclick="openSiteDrawing('${shEsc(d.id)}', true)">
            <span class="sh-row-icon is-pdf"><i class="ph-fill ph-file-pdf" aria-hidden="true"></i></span>
            <span class="sh-row-main">
                <span class="sh-row-title">${shMark(d.sheet, tokens)} — ${shMark(d.title, tokens)}</span>
                <span class="sh-row-meta"><span class="sh-rev">Rev ${shMark(d.revision, tokens)}</span>PDF • Updated ${shDate(d.updatedOn)}</span>
            </span>
            <i class="ph-bold ph-caret-right sh-row-chev" aria-hidden="true"></i>
        </button>`;
}
function openSiteDrawing(id, fromList) {
    const d = getDrawingById(id);
    if (!d) return;
    triggerHaptic('light');
    shSheet('Drawing', `
        <article class="sh-detail">
            ${fromList ? '<button type="button" class="sh-back" onclick="openSiteDrawings()"><i class="ph-bold ph-caret-left" aria-hidden="true"></i>Drawings</button>' : ''}
            <div class="sh-dwg-preview" aria-hidden="true"><i class="ph-fill ph-file-pdf"></i><span>${shEsc(d.sheet)}.pdf</span></div>
            <h3 class="sh-detail-title">${shEsc(d.title)}</h3>
            <dl class="sh-facts">
                <div><dt>Sheet</dt><dd>${shEsc(d.sheet)}</dd></div>
                <div><dt>Revision</dt><dd>Rev ${shEsc(d.revision)}</dd></div>
                <div><dt>Discipline</dt><dd>${shEsc(d.discipline)}</dd></div>
                <div><dt>Updated</dt><dd>${shEsc(DateRules.fromIso(d.updatedOn).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }))}</dd></div>
            </dl>
            <p class="sh-detail-note">The PDF opens here once drawings sync from Procore. The register shows the current revision of each sheet.</p>
        </article>`);
}

// ---------- Site Diary ----------
function openSiteDiary() {
    const site = shSite();
    if (!site) return;
    triggerHaptic('light');
    const logs = getSiteLogs(site.id);
    shSheet('Site Diary', `
        <div class="sh-sheet-list">
            <div class="sh-sheet-bar">
                <p class="sh-detail-kicker">${shEsc(site.address)} • ${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}</p>
                <button type="button" class="sh-mini-btn" onclick="openAddSiteLog()"><i class="ph-bold ph-plus" aria-hidden="true"></i>New Entry</button>
            </div>
            ${logs.length ? logs.map(l => {
                const d = DateRules.fromIso(l.date), photos = getLogPhotos(l.id).length;
                return `<button type="button" class="sh-diary" onclick="openSiteLog('${shEsc(l.id)}', true)">
                        <span class="sh-diary-date"><span>${SH_DAYS[d.getDay()]}</span><b>${d.getDate()}</b><span>${SH_MONTHS[d.getMonth()]}</span></span>
                        <span class="sh-diary-main">
                            <span class="sh-diary-title">${shEsc(l.title)}</span>
                            ${l.body ? `<span class="sh-diary-body">${shEsc(l.body)}</span>` : ''}
                            <span class="sh-diary-by">${renderRoleAvatar(l.authorName, 'sm')}<span>${shEsc(l.authorName)}</span>${photos ? `<span class="sh-diary-photos"><i class="ph-fill ph-image" aria-hidden="true"></i>${photos}</span>` : ''}</span>
                        </span>
                    </button>`;
            }).join('') : `<div class="sh-empty"><i class="ph-fill ph-notebook" aria-hidden="true"></i><span>No diary entries yet.</span></div>`}
        </div>`);
}
function openSiteLog(id, fromList) {
    const l = getSiteLogById(id);
    if (!l) return;
    triggerHaptic('light');
    const photos = getLogPhotos(l.id);
    shSheetPhotoIds = photos.map(p => p.id);
    shSheet('Site Log', `
        <article class="sh-detail">
            ${fromList ? '<button type="button" class="sh-back" onclick="openSiteDiary()"><i class="ph-bold ph-caret-left" aria-hidden="true"></i>Site Diary</button>' : ''}
            <p class="sh-detail-kicker">${shEsc(shLongDate(l.date))} · ${shEsc(getSiteName(l.siteId))}</p>
            <h3 class="sh-detail-title">${shEsc(l.title)}</h3>
            <p class="sh-detail-by">${renderRoleAvatar(l.authorName, 'sm')}<span>${shEsc(l.authorName)}</span></p>
            ${l.body ? `<p class="sh-detail-body">${shEsc(l.body)}</p>` : ''}
            ${photos.length ? `<div class="sh-photo-grid">${photos.map(p => `<button type="button" class="sh-thumb" onclick="openSitePhoto('${shEsc(p.id)}', shSheetPhotoIds)" aria-label="${shEsc(p.caption || 'Photo')}"><img src="${shEsc(p.src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
        </article>`);
}

// ---------- Site Photos (gallery) ----------
function openSitePhotos() {
    const site = shSite();
    if (!site) return;
    triggerHaptic('light');
    const photos = getSitePhotos(site.id);
    shSheetPhotoIds = photos.map(p => p.id);
    const days = [];
    photos.forEach(p => { const g = days[days.length - 1]; if (g && g.date === p.date) g.list.push(p); else days.push({ date: p.date, list: [p] }); });
    shSheet('Site Photos', `
        <div class="sh-sheet-list">
            <div class="sh-sheet-bar">
                <p class="sh-detail-kicker">${shEsc(site.address)} • ${photos.length} photo${photos.length === 1 ? '' : 's'}</p>
                <button type="button" class="sh-mini-btn" onclick="openAddSitePhoto()"><i class="ph-bold ph-plus" aria-hidden="true"></i>Add Photo</button>
            </div>
            ${days.length ? days.map(g => `
                <section class="sh-sheet-group">
                    <h3 class="sh-sheet-group-title">${shEsc(shDate(g.date, true))}<span>${shEsc(g.list[0].caption || '')}</span></h3>
                    <div class="sh-gallery">${g.list.map(p => `<button type="button" class="sh-thumb" onclick="openSitePhoto('${shEsc(p.id)}', shSheetPhotoIds)" aria-label="${shEsc(p.caption || 'Photo')}, ${shDate(p.date)}">
                        <img src="${shEsc(p.src)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>
                </section>`).join('')
            : `<div class="sh-empty"><i class="ph-fill ph-camera" aria-hidden="true"></i><span>No photos at this site yet.</span><button type="button" class="sh-empty-action" onclick="openAddSitePhoto()">Add Photo</button></div>`}
        </div>`);
}

// ---------- Photo lightbox ----------
const shLightbox = { ids: [], index: 0 };
let shSheetPhotoIds = [];                // the photos of the open sheet (gallery, log), in order, for the lightbox
function openSitePhoto(id, ids) {
    const list = Array.isArray(ids) && ids.includes(id) ? ids.slice() : getSitePhotos(siteHubState.siteId).map(p => p.id);
    shLightbox.ids = list.includes(id) ? list : [id];
    shLightbox.index = Math.max(0, shLightbox.ids.indexOf(id));
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
    renderLightboxTags(photo);
}
// The photo's trade tags; Edit turns them into every trade, tap to tag or untag (saved as you go)
let shLightboxEditing = false;
function renderLightboxTags(photo) {
    const box = document.getElementById('sh-lightbox-tags');
    if (!box || !photo) return;
    const tags = photo.tradeIds || [];
    if (!shLightboxEditing) {
        box.innerHTML = `${tags.map(id => shTradeTag(id, 'is-on-photo')).join('')}<button type="button" class="sh-lb-edit" onclick="toggleLightboxTagging(true)"><i class="ph-fill ph-tag" aria-hidden="true"></i>${tags.length ? 'Edit tags' : 'Tag trades'}</button>`;
        return;
    }
    box.innerHTML = getScheduleTrades().map(t => { const on = tags.includes(t.id); return `<button type="button" role="checkbox" aria-checked="${on}" class="filter-pill${on ? ' is-active' : ''}" onclick="toggleLightboxTrade('${shEsc(t.id)}')"><i class="sh-chip-dot" style="background:${shEsc(t.color)}" aria-hidden="true"></i>${shEsc(t.name)}</button>`; }).join('')
        + `<button type="button" class="sh-lb-edit is-done" onclick="toggleLightboxTagging(false)">Done</button>`;
}
function toggleLightboxTagging(on) {
    triggerHaptic('light');
    shLightboxEditing = on;
    renderLightboxTags(appStore.get('sitePhotos').find(p => p.id === shLightbox.ids[shLightbox.index]));
}
async function toggleLightboxTrade(tradeId) {
    const photo = appStore.get('sitePhotos').find(p => p.id === shLightbox.ids[shLightbox.index]);
    if (!photo) return;
    triggerHaptic('light');
    const tags = photo.tradeIds || [];
    const next = tags.includes(tradeId) ? tags.filter(x => x !== tradeId) : [...tags, tradeId];
    try {
        const saved = await siteContentService.setPhotoTrades(photo.id, next);
        if (saved.id === shLightbox.ids[shLightbox.index]) renderLightboxTags(saved);
    } catch (raw) { triggerHaptic('error'); showSnack(`Tags not saved. ${toAppError(raw).userMessage}`); }
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
    shLightboxEditing = false;
    if (siteSearch.open) renderSiteSearch();                   // re-tagged photos move in or out of the results
    box.classList.remove('is-open');
    setTimeout(() => { if (!box.classList.contains('is-open')) box.hidden = true; }, 220);
}
function isSitePhotoOpen() { const b = document.getElementById('sh-lightbox'); return !!b && !b.hidden; }

// ---------- + Speed dial ----------
let siteHubFabOpen = false;
function toggleSiteHubFab(open = !siteHubFabOpen) {
    if (open && !siteHubState.siteId) return;
    if (open) { closeSiteSwitcher(); closeSiteSearch(true); }
    siteHubFabOpen = open;
    triggerHaptic('light');
    const fab = document.getElementById('sh-fab'), menu = document.getElementById('sh-fab-menu'), scrim = document.getElementById('sh-fab-scrim');
    fab.setAttribute('aria-expanded', String(open));
    fab.setAttribute('aria-label', open ? 'Close' : 'Add to this site');
    fab.classList.toggle('is-open', open);
    if (open) {
        menu.hidden = false; scrim.hidden = false;
        requestAnimationFrame(() => { scrim.classList.add('is-open'); menu.classList.add('is-open'); });
        const first = menu.querySelector('.sh-fab-item');
        if (first) setTimeout(() => { if (siteHubFabOpen) first.focus({ preventScroll: true }); }, 60);
    } else {
        menu.classList.remove('is-open'); scrim.classList.remove('is-open');
        setTimeout(() => { if (!siteHubFabOpen) { menu.hidden = true; scrim.hidden = true; } }, 220);
    }
}
function siteHubFabAction(kind) {
    toggleSiteHubFab(false);
    if (kind === 'log') openAddSiteLog();
    else if (kind === 'plan') openUploadDrawing();
    else if (kind === 'photo') openAddSitePhoto();
}

// Pictures picked on the device, scaled down there (max 1600px, JPEG) before they are saved
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
// The photos chosen in an open form (Add Photo / New Site Log), with their thumbnails and remove buttons
let shDraftPhotos = [];
async function addDraftPhotos(input) {
    const files = [...(input.files || [])].slice(0, SITE_LOG_MAX_PHOTOS - shDraftPhotos.length);
    input.value = '';
    for (const file of files) {
        try { shDraftPhotos.push({ src: await shDownscale(file) }); } catch (_) { /* unreadable: skipped */ }
    }
    renderDraftPhotos();
}
function renderDraftPhotos() {
    const el = document.getElementById('sh-draft-photos');
    if (!el) return;
    el.innerHTML = shDraftPhotos.map((p, i) => `<span class="sh-log-photo"><img src="${p.src}" alt="">
        <button type="button" onclick="removeDraftPhoto(${i})" aria-label="Remove photo ${i + 1}"><i class="ph-bold ph-x" aria-hidden="true"></i></button></span>`).join('');
    el.hidden = !shDraftPhotos.length;
    const add = document.getElementById('sh-draft-add');
    if (add) {
        add.hidden = shDraftPhotos.length >= SITE_LOG_MAX_PHOTOS;
        const label = add.querySelector('.sh-drop-label');
        if (label) label.textContent = shDraftPhotos.length ? 'Add More Photos' : 'Choose Photos';
    }
}
function removeDraftPhoto(i) { shDraftPhotos.splice(i, 1); renderDraftPhotos(); }
function shPhotoPicker(hint) {
    return `<div id="sh-draft-photos" class="sh-log-photos" hidden></div>
        <label id="sh-draft-add" class="sh-dropzone">
            <i class="ph-fill ph-camera" aria-hidden="true"></i><span class="sh-drop-label">Choose Photos</span><span class="sh-drop-hint">${shEsc(hint)}</span>
            <input type="file" accept="image/*" multiple class="sr-only" onchange="addDraftPhotos(this)">
        </label>`;
}

// Add Photo: photos on their own, with one description and tag (siteContentService.addPhotos)
// Trade tags for a new photo or log: every trade, the ones booked on site today chosen to start with (so a
// typical day needs no taps); several can be on. They're what search finds them by.
let shDraftTrades = new Set();
function shTradePicker() {
    const booked = ScheduleRules.onDay(getScheduleTasks(siteHubState.siteId), shTodayIso()).map(t => t.tradeId);
    shDraftTrades = new Set(booked.filter(id => id !== 'delivery'));
    const ids = [...new Set([...shDraftTrades, ...getScheduleTrades().map(t => t.id)])];
    return `<div><span id="sh-trades-label" class="sheet-label">Trades${shDraftTrades.size ? ' <span class="sh-label-note">on site today are chosen</span>' : ''}</span>
            <div class="filter-bar filter-bar--wrap" role="group" aria-labelledby="sh-trades-label">
                ${ids.map(id => { const t = getScheduleTrade(id), on = shDraftTrades.has(id); return `<button type="button" role="checkbox" aria-checked="${on}" data-v="${shEsc(id)}" class="filter-pill${on ? ' is-active' : ''}" onclick="toggleShDraftTrade(this)"><i class="sh-chip-dot" style="background:${shEsc(t.color)}" aria-hidden="true"></i>${shEsc(t.name)}</button>`; }).join('')}
            </div></div>`;
}
function toggleShDraftTrade(pill) {
    triggerHaptic('light');
    const id = pill.dataset.v, on = !shDraftTrades.has(id);
    if (on) shDraftTrades.add(id); else shDraftTrades.delete(id);
    pill.classList.toggle('is-active', on); pill.setAttribute('aria-checked', String(on));
}

let shPhotoTag = 'Progress';
function openAddSitePhoto() {
    const site = shSite();
    if (!site) return;
    triggerHaptic('light');
    shDraftPhotos = [];
    shPhotoTag = 'Progress';
    shSheet('Add Photo', `
        <form id="sh-photo-form" class="sh-form" onsubmit="event.preventDefault(); submitSitePhotos();" novalidate>
            <p class="sh-detail-kicker">${shEsc(shLongDate(shTodayIso()))} · ${shEsc(site.address)}</p>
            <div><span class="sheet-label">Photos</span>${shPhotoPicker(`Camera or library, up to ${SITE_LOG_MAX_PHOTOS}`)}</div>
            <div><label for="sh-photo-caption" class="sheet-label">Description</label>
                <textarea id="sh-photo-caption" rows="3" maxlength="200" placeholder="e.g. Sarking lapped at the valleys, north side" class="sheet-input sh-textarea"></textarea></div>
            ${shTradePicker()}
            <div><span id="sh-photo-tag-label" class="sheet-label">Tag</span>
                <div class="filter-bar filter-bar--wrap" role="radiogroup" aria-labelledby="sh-photo-tag-label">
                    ${siteContentService.PHOTO_TAGS.map(t => `<button type="button" role="radio" aria-checked="${t === shPhotoTag}" data-v="${t}" class="filter-pill${t === shPhotoTag ? ' is-active' : ''}" onclick="pickShPill(this, v => { shPhotoTag = v; })">${t}</button>`).join('')}
                </div></div>
            <button type="submit" id="sh-photo-submit" class="btn btn--primary btn--block"><i class="ph-bold ph-check" aria-hidden="true"></i><span>Save Photos</span></button>
        </form>`);
}
function pickShPill(pill, set) {
    triggerHaptic('light');
    set(pill.dataset.v);
    pill.parentElement.querySelectorAll('.filter-pill').forEach(p => { const on = p === pill; p.classList.toggle('is-active', on); p.setAttribute('aria-checked', String(on)); });
}
async function submitSitePhotos() {
    const result = await runUiAction(() => siteContentService.addPhotos({
        siteId: siteHubState.siteId, date: shTodayIso(), caption: (document.getElementById('sh-photo-caption') || {}).value || '', tag: shPhotoTag, photos: shDraftPhotos, tradeIds: [...shDraftTrades]
    }), { button: document.getElementById('sh-photo-submit'), errorTitle: 'Photos not saved' });
    if (!result.ok) return;
    triggerHaptic('success');
    shDraftPhotos = [];
    closeModal();
    showSnack(`${result.value.length} photo${result.value.length === 1 ? '' : 's'} added`, null, null, { icon: 'ph-check-circle' });
}

// New Site Log: a diary entry for today, with photos if you like (siteContentService.addLog)
function openAddSiteLog() {
    const site = shSite();
    if (!site) return;
    triggerHaptic('light');
    shDraftPhotos = [];
    shSheet('New Site Log', `
        <form id="sh-log-form" class="sh-form" onsubmit="event.preventDefault(); submitSiteLog();" novalidate>
            <p class="sh-detail-kicker">${shEsc(shLongDate(shTodayIso()))} · ${shEsc(site.address)}</p>
            <div><label for="sh-log-title" class="sheet-label">Title</label>
                <input id="sh-log-title" type="text" maxlength="120" autocomplete="off" enterkeyhint="next" placeholder="e.g. Roof sheeting started, north side" class="sheet-input"></div>
            <div><label for="sh-log-body" class="sheet-label">Notes</label>
                <textarea id="sh-log-body" rows="4" maxlength="4000" placeholder="What happened on site today? Trades, deliveries, weather, issues." class="sheet-input sh-textarea"></textarea></div>
            ${shTradePicker()}
            <div><span class="sheet-label">Photos</span>${shPhotoPicker('Optional; they take the log’s trades')}</div>
            <button type="submit" id="sh-log-submit" class="btn btn--primary btn--block"><i class="ph-bold ph-check" aria-hidden="true"></i><span>Save Log</span></button>
        </form>`);
}
async function submitSiteLog() {
    const val = id => (document.getElementById(id) || {}).value || '';
    const result = await runUiAction(() => siteContentService.addLog({
        siteId: siteHubState.siteId, date: shTodayIso(), title: val('sh-log-title'), body: val('sh-log-body'), photos: shDraftPhotos, tradeIds: [...shDraftTrades]
    }), { button: document.getElementById('sh-log-submit'), errorTitle: 'Log not saved' });
    if (!result.ok) return;
    triggerHaptic('success');
    shDraftPhotos = [];
    closeModal();
    showSnack('Site log saved', null, null, { icon: 'ph-check-circle' });
}

// Upload Drawing: the document and its sheet details into the register (siteContentService.addDrawing). A sheet
// number already in the register takes the new revision. The register keeps the details; the file stays on the
// device until drawings sync with Procore.
let shPlanDiscipline = 'Architectural';
let shPlanFile = null;
function openUploadDrawing() {
    const site = shSite();
    if (!site) return;
    triggerHaptic('light');
    shPlanDiscipline = 'Architectural';
    shPlanFile = null;
    shSheet('Upload Drawing', `
        <form id="sh-plan-form" class="sh-form" onsubmit="event.preventDefault(); submitUploadDrawing();" novalidate>
            <p class="sh-detail-kicker">${shEsc(site.address)} · Drawing register</p>
            <div><span class="sheet-label">Document</span>
                <label class="sh-dropzone" id="sh-plan-drop">
                    <i class="ph-fill ph-file-arrow-up" aria-hidden="true"></i><span class="sh-drop-label" id="sh-plan-file">Choose PDF</span><span class="sh-drop-hint" id="sh-plan-size">PDF or image of the sheet</span>
                    <input type="file" accept="application/pdf,image/*" class="sr-only" onchange="pickDrawingFile(this)">
                </label></div>
            <div><label for="sh-plan-title" class="sheet-label">Drawing Name</label>
                <input id="sh-plan-title" type="text" maxlength="120" autocomplete="off" placeholder="e.g. First Floor Plan" class="sheet-input"></div>
            <div class="grid grid-cols-2 gap-3">
                <div><label for="sh-plan-sheet" class="sheet-label">Sheet</label>
                    <input id="sh-plan-sheet" type="text" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="e.g. A103" class="sheet-input"></div>
                <div><label for="sh-plan-rev" class="sheet-label">Revision</label>
                    <input id="sh-plan-rev" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="e.g. C" class="sheet-input"></div>
            </div>
            <div><span id="sh-plan-disc-label" class="sheet-label">Discipline</span>
                <div class="filter-bar filter-bar--wrap" role="radiogroup" aria-labelledby="sh-plan-disc-label">
                    ${DRAWING_DISCIPLINES.map(d => `<button type="button" role="radio" aria-checked="${d === shPlanDiscipline}" data-v="${d}" class="filter-pill${d === shPlanDiscipline ? ' is-active' : ''}" onclick="pickShPill(this, v => { shPlanDiscipline = v; })">${d}</button>`).join('')}
                </div></div>
            <button type="submit" id="sh-plan-submit" class="btn btn--primary btn--block"><i class="ph-bold ph-check" aria-hidden="true"></i><span>Add to Register</span></button>
        </form>`);
}
// A chosen file fills in what its name tells us: "A103 First Floor Plan Rev C.pdf"
function pickDrawingFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    shPlanFile = { name: file.name, size: file.size };
    document.getElementById('sh-plan-file').textContent = file.name;
    document.getElementById('sh-plan-size').textContent = `${(file.size / 1048576).toFixed(file.size > 1048576 ? 1 : 2)} MB • tap to change`;
    document.getElementById('sh-plan-drop').classList.add('has-file');
    const base = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim();
    const sheet = /^([A-Z]{1,2}\d{2,4})\b/i.exec(base), rev = /\brev(?:ision)?\s*([A-Z0-9]{1,3})\b/i.exec(base);
    const title = base.replace(/^([A-Z]{1,2}\d{2,4})[\s-]*/i, '').replace(/[\s-]*\brev(?:ision)?\s*[A-Z0-9]{1,3}\b/i, '').trim();
    const set = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    set('sh-plan-sheet', sheet && sheet[1].toUpperCase());
    set('sh-plan-rev', rev && rev[1].toUpperCase());
    set('sh-plan-title', title);
}
async function submitUploadDrawing() {
    const val = id => (document.getElementById(id) || {}).value || '';
    const result = await runUiAction(() => siteContentService.addDrawing({
        siteId: siteHubState.siteId, sheet: val('sh-plan-sheet'), title: val('sh-plan-title'), discipline: shPlanDiscipline,
        revision: val('sh-plan-rev'), date: shTodayIso()
    }), { button: document.getElementById('sh-plan-submit'), errorTitle: 'Drawing not added' });
    if (!result.ok) return;
    triggerHaptic('success');
    closeModal();
    showSnack(`${result.value.sheet} Rev ${result.value.revision} added to the register`, null, null, { icon: 'ph-check-circle' });
}

// ---------- To the Schedule (sub-page) ----------
// The Schedule slides over the hub, on its Overview; the hub keeps its scroll for the way back.
//   { expand: true }  the milestone card's body: scrolled to the upcoming milestone, expanded
//   { focusId }       a search result: scrolled to that record (a milestone expands)
//   {}                Full Schedule: the page as it is, from the top
function openScheduleFromHub(opts = {}) {
    if (!siteHubState.siteId) return;
    triggerHaptic('light');
    const view = document.getElementById('view-sitehub');
    if (view) siteHubState.scrollTop = view.scrollTop;
    const ms = opts.expand ? getUpcomingMilestone(siteHubState.siteId) : null;
    const focusId = opts.focusId || (ms && ms.id) || null;
    if (typeof showScheduleFrom === 'function') showScheduleFrom({ focusId, view: 'overview' });
}
// Back on the hub (navigation.js after a pop): where it was
function restoreSiteHubScroll() {
    const view = document.getElementById('view-sitehub');
    if (view && siteHubState.scrollTop) view.scrollTop = siteHubState.scrollTop;
}

// ---------- Wiring ----------
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('sh-search-input');
    if (input) {
        input.addEventListener('input', () => {
            document.getElementById('sh-search-clear').hidden = !input.value;
            clearTimeout(siteSearch.timer);
            siteSearch.timer = setTimeout(renderSiteSearch, 120);         // live, debounced
        });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });   // search: put the keyboard away
    }
    const sw = document.getElementById('sh-switch-input');
    if (sw) sw.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); const first = document.querySelector('#sh-switch-list .sh-switch-row'); if (first) first.click(); }
    });
    // Arrow keys move between the weekdays
    const days = document.getElementById('sh-days');
    if (days) days.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const btns = [...days.querySelectorAll('.sh-day')], i = btns.findIndex(b => b.classList.contains('is-selected'));
        const next = btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
        if (next) { e.preventDefault(); next.click(); next.focus(); }
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
        if (modalOpen) return;                                          // the sheet closes first
        if (siteHubFabOpen) { e.stopPropagation(); toggleSiteHubFab(false); document.getElementById('sh-fab').focus(); }
        else if (siteSwitcherOpen) { e.stopPropagation(); closeSiteSwitcher(true); }
        else if (siteSearch.open) { e.stopPropagation(); closeSiteSearch(); }
    }, true);
    renderSiteHub();
});

// Everything the hub shows follows the store: sites, roster, attendance, site content and the schedule
appStore.subscribe(() => renderSiteHub(),
    ['sites', 'roster', 'attendance', 'siteLogs', 'drawings', 'sitePhotos', 'scheduleTasks', 'scheduleTrades', 'employees']);
appStore.ready.then(renderSiteHub).catch(() => {});
