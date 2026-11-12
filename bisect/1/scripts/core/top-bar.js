/**
 * iOS-style top bar.
 *  - Home (root): lifestyle brand, notifications and menu.
 *  - Pushed screens: "‹ Parent" back button, the screen's actions, and a small inline title that
 *    fades in once the screen's large title (h2[data-large-title]) scrolls up under the bar.
 * Kept in sync from syncDynamicStatusBar(), which already runs on every view change and scroll.
 */

// Short back-button labels (Apple uses the parent's title; long ones get shortened)
const TOP_BAR_BACK_LABELS = {
    'home': 'Home',
    'sitehub': 'Site',
    'notifications': 'Activity',
    'week': 'My Week',
    'chat': 'Messages',
    'team': 'Team',
    'tools': 'Tools'
};

let topBarMode = null;
let topBarView = null;

function topBarBack() {
    if (currentActiveViewName === 'notifications' && typeof closeNotificationsView === 'function') {
        closeNotificationsView();
    } else {
        navigateSubpageBack('home');
    }
}

function syncTopBarMode() {
    const bar = document.getElementById('app-top-bar');
    const root = document.getElementById('top-bar-root');
    const nav = document.getElementById('top-bar-nav');
    if (!bar || !root || !nav) return;

    const view = currentActiveViewName || 'home';
    const mode = view === 'home' ? 'root' : 'nav';

    if (mode !== topBarMode) {
        topBarMode = mode;
        bar.dataset.mode = mode;
        const showRoot = mode === 'root';
        root.toggleAttribute('inert', !showRoot);
        root.setAttribute('aria-hidden', String(!showRoot));
        nav.toggleAttribute('inert', showRoot);
        nav.setAttribute('aria-hidden', String(showRoot));
    }

    if (mode === 'nav' && view !== topBarView) {
        const parent = (typeof getBackTargetForSubpage === 'function') ? getBackTargetForSubpage(view, 'home') : 'home';
        const label = TOP_BAR_BACK_LABELS[parent] || 'Back';
        document.getElementById('nav-back-label').textContent = label;
        document.getElementById('nav-back-btn').setAttribute('aria-label', `Back to ${label}`);

        const large = document.querySelector(`#view-${view} [data-large-title]`);
        document.getElementById('nav-inline-title').textContent = large ? large.textContent.trim() : '';

        document.querySelectorAll('#nav-actions .nav-actions-group').forEach(g => {
            g.hidden = g.dataset.view !== view;
        });
    }
    topBarView = mode === 'nav' ? view : null;

    updateTopBarInlineTitle();
}

// Inline title shows once the large title has scrolled up under the bar
function updateTopBarInlineTitle() {
    const bar = document.getElementById('app-top-bar');
    if (!bar) return;
    let collapsed = false;
    if (topBarMode === 'nav') {
        const large = document.querySelector(`#view-${currentActiveViewName} [data-large-title]`);
        if (large) {
            collapsed = large.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom + 2;
        }
    }
    bar.classList.toggle('is-title-collapsed', collapsed);
}
