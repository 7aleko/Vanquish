/**
 * Home list (Poppy, Team, Tools): live right-hand values from existing data.
 *  - Team:  crew on site today, across all assigned sites (JOBS_DATA, for the app's "today", APP_TODAY)
 *  - Tools: equipment currently available (TOOLS_DIRECTORY_DATA). Re-rendered whenever the tools
 *           directory re-renders (renderToolsDirectory in scripts/features/tools.js), so transfers
 *           and status changes show up here straight away.
 */

const HOME_NAV_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getCrewOnSiteToday() {
    if (typeof JOBS_DATA === 'undefined') return null;
    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    const dayKey = HOME_NAV_DAY_KEYS[today.getDay()];
    const people = new Set();
    JOBS_DATA.forEach(job => ((job.days[dayKey] || {}).crew || []).forEach(name => people.add(name)));
    return people.size;
}

function renderHomeNavList() {
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el && text != null) el.textContent = text;
    };

    const onSite = getCrewOnSiteToday();
    if (onSite != null) set('home-nav-team-value', `${onSite} on site`);

    if (typeof TOOLS_DIRECTORY_DATA !== 'undefined') {
        const available = TOOLS_DIRECTORY_DATA.filter(t => t.status === 'Available').length;
        set('home-nav-tools-value', `${available} available`);
    }
}

document.addEventListener('DOMContentLoaded', renderHomeNavList);
