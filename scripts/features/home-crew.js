/**
 * Home site card: crew preview under the address. Who is on the card's site today, as overlapping role
 * avatars (most senior first, up to four, then "+N") and "N crew ›". Tapping it opens the Crew Status sheet
 * (scripts/features/crew-status-sheet.js); the rest of the card opens the Roster.
 *
 * Data: the site's crew for the app's "today" (APP_TODAY, scripts/features/today-summary.js) from
 * JOBS_DATA (scripts/data/jobs.js) - the same list today's Roster card shows under "With:".
 *
 * The card's site is the employee's roster entry for today (ROSTER), resolved through SITES
 * (scripts/application/selectors.js): name, address and the card's spoken label all follow the master table.
 */

const HOME_CREW_MAX_AVATARS = 4;
const HOME_CREW_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getSiteCrewForDate(siteId, date) {
    if (typeof JOBS_DATA === 'undefined' || !date || !siteId) return [];
    const job = JOBS_DATA.find(j => j.siteId === siteId);
    const day = job && job.days ? job.days[HOME_CREW_DAY_KEYS[date.getDay()]] : null;
    return (day && day.crew) ? day.crew : [];
}

function renderHomeCrewPreview() {
    const btn = document.getElementById('home-crew-preview');
    const stack = document.getElementById('home-crew-stack');
    const count = document.getElementById('home-crew-count');
    if (!btn || !stack || !count) return;

    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    const siteId = getRosteredSiteId(today);
    const crew = sortCrewBySeniority(getSiteCrewForDate(siteId, today));
    btn.hidden = crew.length === 0;
    if (!crew.length) return;

    const shown = crew.slice(0, HOME_CREW_MAX_AVATARS);
    const extra = crew.length - shown.length;
    stack.innerHTML = shown.map(name => renderRoleAvatar(name, 'md')).join('')
        + (extra > 0 ? `<span class="home-crew-more" aria-hidden="true">+${extra}</span>` : '');
    count.textContent = `${crew.length} crew`;
    btn.setAttribute('aria-label', `${crew.length} crew at ${getSiteName(siteId)} today: ${crew.join(', ')}. Show who's on site.`);
}

// Today's rostered site on the Home card: name, street line and the card's spoken label
function renderHomeSiteCard() {
    const card = document.getElementById('site-hero-card');
    if (!card) return;
    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    const siteId = getRosteredSiteId(today);
    const name = siteId ? getSiteName(siteId) : 'Not rostered';
    const address = siteId ? getSiteAddress(siteId) : 'No site today';
    const nameEl = card.querySelector('.hero-site-name');
    const addrEl = card.querySelector('.hero-site-address .truncate');
    if (nameEl) nameEl.textContent = name;
    if (addrEl) addrEl.textContent = address;
    card.dataset.siteId = siteId || '';
    const shift = (typeof formatRosterShiftTimes === 'function') ? formatRosterShiftTimes().replace('–', 'to') : '7:00 AM to 3:30 PM';
    card.setAttribute('aria-label', siteId
        ? `Today's rostered site: ${name} at ${address}. Work shift ${shift}. Tap to view full schedule.`
        : `No site rostered today. Tap to view full schedule.`);
}

document.addEventListener('DOMContentLoaded', renderHomeCrewPreview);
subscribeSites(() => { renderHomeSiteCard(); renderHomeCrewPreview(); });
