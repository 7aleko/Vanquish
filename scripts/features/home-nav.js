/**
 * Home list (Poppy, Team, Tools): live right-hand values from existing data. Team shows no value.
 *  - Tools: equipment currently available (TOOLS_DIRECTORY_DATA). Re-rendered whenever the tools
 *           directory re-renders (renderToolsDirectory in scripts/features/tools.js), so transfers
 *           and status changes show up here straight away.
 */

function renderHomeNavList() {
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el && text != null) el.textContent = text;
    };

    if (typeof TOOLS_DIRECTORY_DATA !== 'undefined') {
        const available = TOOLS_DIRECTORY_DATA.filter(t => t.status === 'Available').length;
        set('home-nav-tools-value', `${available} available`);
    }
}

document.addEventListener('DOMContentLoaded', renderHomeNavList);
