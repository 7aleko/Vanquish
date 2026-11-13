/**
 * Home site card: crew preview under the address. Who is on the card's site today, as overlapping role
 * avatars (most senior first, up to four, then "+N") and "N crew ›". Tapping it opens today's roster card.
 *
 * Data: the site's crew for the app's "today" (APP_TODAY, scripts/features/today-summary.js) from
 * JOBS_DATA (scripts/data/jobs.js) - the same list today's Roster card shows under "With:".
 */

const HOME_CREW_MAX_AVATARS = 4;
const HOME_CREW_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getSiteCrewForDate(siteName, date) {
    if (typeof JOBS_DATA === 'undefined' || !date) return [];
    const job = JOBS_DATA.find(j => j.name === siteName);
    const day = job && job.days ? job.days[HOME_CREW_DAY_KEYS[date.getDay()]] : null;
    return (day && day.crew) ? day.crew : [];
}

function renderHomeCrewPreview() {
    const btn = document.getElementById('home-crew-preview');
    const stack = document.getElementById('home-crew-stack');
    const count = document.getElementById('home-crew-count');
    if (!btn || !stack || !count) return;

    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    const crew = sortCrewBySeniority(getSiteCrewForDate(btn.dataset.site, today));
    btn.hidden = crew.length === 0;
    if (!crew.length) return;

    const shown = crew.slice(0, HOME_CREW_MAX_AVATARS);
    const extra = crew.length - shown.length;
    stack.innerHTML = shown.map(name => renderRoleAvatar(name, 'md')).join('')
        + (extra > 0 ? `<span class="home-crew-more" aria-hidden="true">+${extra}</span>` : '');
    count.textContent = `${crew.length} crew`;
    btn.setAttribute('aria-label', `${crew.length} crew at ${btn.dataset.site} today: ${crew.join(', ')}. Open today's roster.`);
}

// Roster, scrolled to today with today's card expanded. Reuses the date picker's path (applyRosterWeek
// with a picked date: sets the week, expands that day's card, scrolls it into view).
function openTodayRosterForSite(e) {
    if (e) e.stopPropagation();                // the site card itself also opens the roster
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    switchTab('week');
    requestAnimationFrame(() => applyRosterWeek(getMondayForDate(today), today));
}

document.addEventListener('DOMContentLoaded', renderHomeCrewPreview);
