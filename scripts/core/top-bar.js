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
    'chat': 'Chat',
    'team': 'Team',
    'tools': 'Tools',
    'time': 'Time'
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

        const viewEl = document.getElementById(`view-${view}`);
        const large = document.querySelector(`#view-${view} [data-large-title]`);
        // A screen without a large title names itself in the bar (data-bar-title), shown at all times
        const fixedTitle = viewEl && viewEl.dataset.barTitle;
        // ...or puts richer content there (a conversation's avatar and name) in a <template data-bar-title-html>
        const titleHtml = viewEl && viewEl.querySelector(':scope > template[data-bar-title-html]');
        const titleEl = document.getElementById('nav-inline-title');
        if (titleHtml) titleEl.innerHTML = titleHtml.innerHTML;
        else titleEl.textContent = fixedTitle || (large ? large.textContent.trim() : '');

        bar.querySelectorAll('#nav-actions .nav-actions-group').forEach(g => {
            g.hidden = g.dataset.view !== view;
        });
        // Time screen: shorten its date title if it would run into the Crew pill (timesheets.js)
        if (view === 'time' && typeof tsFitBarTitle === 'function') tsFitBarTitle(tsSelectedDate());
    }
    topBarView = mode === 'nav' ? view : null;
    bar.dataset.view = view;               // per-screen bar layouts (e.g. the conversation's left-aligned contact)

    updateTopBarInlineTitle();
}

// Inline title shows once the large title has scrolled up under the bar
function updateTopBarInlineTitle() {
    const bar = document.getElementById('app-top-bar');
    if (!bar) return;
    let collapsed = false;
    if (topBarMode === 'nav') {
        const viewEl = document.getElementById(`view-${currentActiveViewName}`);
        if (viewEl && viewEl.dataset.barTitle !== undefined) {
            bar.classList.add('is-title-collapsed');
            return;
        }
        const large = document.querySelector(`#view-${currentActiveViewName} [data-large-title]`);
        if (large) {
            collapsed = large.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom + 2;
        }
    }
    bar.classList.toggle('is-title-collapsed', collapsed);
}

// The bar floats over the screens (styles/top-bar.css), so each screen starts --top-bar-h below the top.
// The CSS gives that height as a formula; measure the real bar too, so a device whose bar renders taller
// (safe-area, text size) can never tuck the first line of content (Home's date) underneath it.
(function syncTopBarHeight() {
    const bar = document.getElementById('app-top-bar');
    const stage = document.getElementById('app-main-stage');
    if (!bar || !stage || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
        const h = bar.offsetHeight;                 // layout height: unaffected by the drawer's 3D transform
        if (h > 0) stage.style.setProperty('--top-bar-h', `${h}px`);
    };
    new ResizeObserver(apply).observe(bar);
    apply();
})();

// ---- The bar belongs to its screen during push / pop / edge swipe-back ----
// The real bar takes the incoming screen's state and moves exactly as that screen does; a frozen copy of
// the outgoing screen's bar (its brand, bell and menu, or its back arrow) moves with the outgoing screen.
// The copy sits right after the real bar, so getElementById still finds the real one, while the id-based
// bar styles still apply to it. Whichever bar is underneath is clipped at the top screen's leading edge, so
// it never paints over the screen sliding above it.
let topBarFollow = null;

function startTopBarFollow(outView, inView, outOnTop) {
    stopTopBarFollow();
    const bar = document.getElementById('app-top-bar');
    if (!bar || !outView || !inView) return;

    const ghost = bar.cloneNode(true);
    ghost.classList.add('top-bar-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    bar.after(ghost);

    const origin = `50% ${Math.round((outView.offsetHeight || 0) / 2)}px`;   // the screens scale about their centre
    [bar, ghost].forEach(el => {
        el.style.transition = 'none';
        el.style.transformOrigin = origin;
        el.style.willChange = 'transform, opacity';
    });
    bar.classList.add('is-following');
    ghost.style.setProperty('z-index', outOnTop ? '41' : '39', 'important');

    const state = { bar, ghost, outView, inView, outOnTop, raf: 0 };
    const tick = () => {
        state.raf = requestAnimationFrame(tick);
        const outCs = getComputedStyle(outView), inCs = getComputedStyle(inView);
        ghost.style.transform = outCs.transform === 'none' ? '' : outCs.transform;
        ghost.style.opacity = outCs.opacity;
        ghost.style.filter = outCs.filter === 'none' ? '' : outCs.filter;
        bar.style.transform = inCs.transform === 'none' ? '' : inCs.transform;
        bar.style.opacity = inCs.opacity;
        bar.style.filter = inCs.filter === 'none' ? '' : inCs.filter;

        const under = outOnTop ? bar : ghost;
        const topLeft = (outOnTop ? outView : inView).getBoundingClientRect().left;
        const r = under.getBoundingClientRect();
        const scale = r.width / Math.max(1, under.offsetWidth);
        const cut = Math.max(0, (r.right - topLeft) / Math.max(0.01, scale));
        under.style.clipPath = cut > 0.5 ? `inset(0 ${cut.toFixed(1)}px 0 0)` : '';
        (outOnTop ? ghost : bar).style.clipPath = '';
    };
    tick();
    topBarFollow = state;
    return state;
}

// `only`: stop just that follow (a late timer from an earlier transition must not stop a newer one)
function stopTopBarFollow(only) {
    const state = topBarFollow;
    if (!state || (only && only !== state)) return;
    topBarFollow = null;
    cancelAnimationFrame(state.raf);
    state.ghost.remove();
    const bar = state.bar;
    bar.classList.remove('is-following');
    ['transition', 'transformOrigin', 'willChange', 'transform', 'opacity', 'filter', 'clipPath'].forEach(p => { bar.style[p] = ''; });
}

// Edge swipe-back: while the finger drags, the real bar already shows the screen underneath (the one the
// swipe goes back to); cancelling the swipe puts it back
function showTopBarFor(viewName) {
    const actual = currentActiveViewName;
    currentActiveViewName = viewName;
    try { syncDynamicStatusBar(); } finally { currentActiveViewName = actual; }
}
