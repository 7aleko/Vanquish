/**
 * Home list (Poppy, Team, Tools): live right-hand values from existing data. Team shows no value.
 *  - Tools: equipment currently available (getTools, scripts/application/selectors.js). Re-rendered
 *           whenever equipment changes in the cache, so transfers and status changes show up straight away.
 */

function renderHomeNavList() {
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el && text != null) el.textContent = text;
    };

    const available = countToolsWithStatus(ToolStatus.AVAILABLE);   // tools, as the Tools tiles count them
    set('home-nav-tools-value', `${available} available`);
}

document.addEventListener('DOMContentLoaded', renderHomeNavList);
appStore.subscribe(renderHomeNavList, ['equipment']);
