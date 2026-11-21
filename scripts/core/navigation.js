/**
 * View routing (switchTab, subpage back). Home is the root; every other screen is pushed from it
 * (Quick Actions, the side drawer, cards) and pops back with its back button.
 */

const ALL_APP_VIEWS = ['home', 'week', 'sitehub', 'chat', 'conversation', 'team', 'tools', 'time', 'schedule', 'notifications'];
const VIEW_HIERARCHY_DEPTH = {
    'home': 0,
    'week': 1,
    'chat': 1,
    'team': 1,
    'sitehub': 1,
    'tools': 1,
    'time': 1,
    'notifications': 1,
    'schedule': 2,
    'conversation': 2
};
const VIEW_ANIMATION_CLASSES = [
    'view-transition-overlay',
    'view-tab-animate',
    'view-apple-push-enter',
    'view-apple-push-underlay-exit',
    'view-apple-pop-slide-away',
    'view-apple-pop-underlay-enter'
];

let currentActiveViewName = 'home';
let activeViewTransitionCleanup = null;
const subpageParentMap = {
    'week': 'home',
    'chat': 'home',
    'team': 'home',
    'sitehub': 'home',
    'schedule': 'sitehub',
    'conversation': 'chat',
    'tools': 'home',
    'time': 'home',
    'notifications': 'home'
};

function clearViewTransitionStyles(view) {
    if (!view) return;
    VIEW_ANIMATION_CLASSES.forEach(cls => view.classList.remove(cls));
    view.style.top = '';
    view.style.height = '';
    view.style.transform = '';
    view.style.opacity = '';
    view.style.filter = '';
    view.style.transition = '';
    view.style.boxShadow = '';
    view.style.zIndex = '';
}

function getBackTargetForSubpage(viewName, fallback = 'home') {
    if (viewName === 'schedule') return 'sitehub';
    if (viewName === 'notifications') return (typeof viewBeforeNotifications === 'string' && viewBeforeNotifications) ? viewBeforeNotifications : 'home';
    return subpageParentMap[viewName] || fallback || 'home';
}

function navigateSubpageBack(fallbackTab = 'home') {
    triggerHaptic('light');
    const targetTab = getBackTargetForSubpage(currentActiveViewName, fallbackTab);
    switchTab(targetTab, { forceMode: 'pop' });
}

// Per-screen resets for a fresh open (each defined beside that screen's own state)
const VIEW_FRESH_RESETTERS = {
    week: () => typeof resetRosterView === 'function' && resetRosterView(),
    sitehub: () => typeof resetSiteHubView === 'function' && resetSiteHubView(),
    team: () => typeof resetTeamView === 'function' && resetTeamView(),
    tools: () => typeof resetToolsView === 'function' && resetToolsView(),
    time: () => typeof resetTimeView === 'function' && resetTimeView(),
    schedule: () => typeof resetScheduleView === 'function' && resetScheduleView()
};

function resetViewForFreshOpen(viewName, view) {
    if (!view) return;
    try {
        const reset = VIEW_FRESH_RESETTERS[viewName];
        if (reset) reset();
    } catch (err) { console.warn('View reset notice:', err); }
}

// Scroll positions can only be set once the screen is displayed (a hidden element ignores scrollTop)
function resetViewScroll(view) {
    if (!view) return;
    view.scrollTop = 0;
    view.querySelectorAll('.filter-bar').forEach(bar => { bar.scrollLeft = 0; });
}

function switchTab(tabName, options = {}) {
    if (typeof closeAccountSheet === 'function') closeAccountSheet({ instant: true, keepFocus: true });
    if (!options.silentHaptic) {
        triggerHaptic('medium');
    }

    // De-highlight notifications button if switching to another view
    const notifBtn = document.getElementById('btn-notifications');
    if (tabName !== 'notifications' && notifBtn) {
        notifBtn.classList.remove('border-brand-lime', 'shadow-[0_0_12px_rgba(34,229,98,0.3)]');
    }

    // Clean up any in-flight view transition immediately (interruptible at any frame)
    if (activeViewTransitionCleanup) {
        activeViewTransitionCleanup();
        activeViewTransitionCleanup = null;
    }

    const fromViewName = currentActiveViewName;
    const toViewName = tabName;
    const outgoingView = document.getElementById(`view-${fromViewName}`);
    const incomingView = document.getElementById(`view-${toViewName}`);

    if (!incomingView) return;

    // Determine transition choreography: 'push' (subpage enters), 'pop' (Apple slide-away), or 'tab' (directional navbar switch)
    let transitionMode = options.forceMode || null;
    const fromDepth = VIEW_HIERARCHY_DEPTH[fromViewName] ?? 0;
    const toDepth = VIEW_HIERARCHY_DEPTH[toViewName] ?? 0;

    if (!transitionMode) {
        if (fromViewName === toViewName) {
            transitionMode = 'none';
        } else if (toDepth > fromDepth) {
            transitionMode = 'push';
            subpageParentMap[toViewName] = fromViewName;
        } else if (fromDepth > toDepth) {
            transitionMode = 'pop';
        } else if (fromDepth > 0 && toDepth > 0) {
            if (subpageParentMap[fromViewName] === toViewName) {
                transitionMode = 'pop';
            } else {
                transitionMode = 'push';
                subpageParentMap[toViewName] = fromViewName;
            }
        } else {
            transitionMode = 'tab';
        }
    }

    currentActiveViewName = toViewName;

    // Opening a screen (push / tab) starts it fresh, like opening the page again; going back to it (pop)
    // keeps it as it was, as on iOS
    const isFreshOpen = fromViewName !== toViewName && transitionMode !== 'pop';
    if (isFreshOpen) resetViewForFreshOpen(toViewName, incomingView);

    if (fromViewName !== toViewName && outgoingView && (transitionMode === 'push' || transitionMode === 'pop')) {
        const stage = document.getElementById('app-main-stage');
        const stageTop = outgoingView.offsetTop || 0;
        const stageHeight = outgoingView.offsetHeight || (stage ? stage.clientHeight : 0);
        const savedOutgoingScroll = outgoingView.scrollTop;

        // Hide any unrelated views
        ALL_APP_VIEWS.forEach(v => {
            if (v !== fromViewName && v !== toViewName) {
                const el = document.getElementById(`view-${v}`);
                if (el) {
                    clearViewTransitionStyles(el);
                    el.classList.add('hidden');
                }
            }
        });

        clearViewTransitionStyles(outgoingView);
        clearViewTransitionStyles(incomingView);

        // Pin outgoing view into the exact stage viewport layer so both views animate simultaneously
        outgoingView.classList.remove('hidden');
        outgoingView.classList.add('view-transition-overlay');
        outgoingView.style.top = `${stageTop}px`;
        outgoingView.style.height = `${stageHeight}px`;
        outgoingView.scrollTop = savedOutgoingScroll;

        // Reveal incoming view in normal flex flow
        incomingView.classList.remove('hidden');

        // Force reflow so animations start cleanly on frame 1 across Safari/iOS/Chrome
        void incomingView.offsetWidth;

        let durationMs = 440;

        if (transitionMode === 'push') {
            incomingView.classList.add('view-apple-push-enter');
            outgoingView.classList.add('view-apple-push-underlay-exit');
            durationMs = 450;
        } else {
            outgoingView.classList.add('view-apple-pop-slide-away');
            incomingView.classList.add('view-apple-pop-underlay-enter');
            durationMs = 440;
        }

        // The top bar travels with its screen: brand, bell and menu leave with Home; the back arrow arrives
        // and leaves with its page (top-bar.js)
        if (typeof startTopBarFollow === 'function') {
            startTopBarFollow(outgoingView, incomingView, transitionMode === 'pop');
            syncDynamicStatusBar();
        }

        let transitionTimer = null;
        const cleanup = () => {
            if (transitionTimer) {
                clearTimeout(transitionTimer);
                transitionTimer = null;
            }
            ALL_APP_VIEWS.forEach(v => {
                const el = document.getElementById(`view-${v}`);
                if (!el) return;
                clearViewTransitionStyles(el);
                if (v === currentActiveViewName) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
            activeViewTransitionCleanup = null;
            if (typeof stopTopBarFollow === 'function') stopTopBarFollow();
        };

        activeViewTransitionCleanup = cleanup;
        transitionTimer = setTimeout(cleanup, durationMs);
    } else {
        ALL_APP_VIEWS.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (!el) return;
            clearViewTransitionStyles(el);
            if (v === toViewName) {
                el.classList.remove('hidden');
                void el.offsetWidth; // Force reflow
                el.classList.add('view-tab-animate');
                el.addEventListener('animationend', () => {
                    el.classList.remove('view-tab-animate');
                }, { once: true });
            } else {
                el.classList.add('hidden');
            }
        });
    }

    // Both branches above have displayed the incoming screen by now
    if (isFreshOpen) resetViewScroll(incomingView);
    // Back on the Site Hub from its Schedule: where it was
    else if (toViewName === 'sitehub' && fromViewName === 'schedule' && typeof restoreSiteHubScroll === 'function') restoreSiteHubScroll();

    requestAnimationFrame(syncDynamicStatusBar);

    // Progress rings (progress-ring.js) fill again every time their page opens, as it slides in
    if (fromViewName !== toViewName && typeof replayProgressRings === 'function') {
        replayProgressRings(incomingView, transitionMode === 'push' ? 200 : transitionMode === 'pop' ? 120 : 80);
    }

    if (tabName === 'schedule' && typeof initSchedule === 'function') {
        setTimeout(initSchedule, 40);
    }
}
