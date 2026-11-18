/**
 * App shell bootstrap: assistant orb init, zoom lock, edge-swipe back gesture, scroll-driven status bar
 * sync and resize handling.
 */

// Initialize the assistant orb on DOM ready

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initPoppySiriOrb);
    } else {
        initPoppySiriOrb();
    }
    window.addEventListener('load', initPoppySiriOrb);

    window.addEventListener('DOMContentLoaded', () => {

    // Pinch-zoom is deliberately left enabled (accessibility). Double-tap zoom and the tap
    // delay are already removed with `touch-action: manipulation`, and inputs are 16px so iOS
    // never auto-zooms on focus. No document-level non-passive touch listener is needed.

    const container = document.getElementById('app-container');
    const stage = document.getElementById('app-main-stage');

    // Interactive iOS left-edge swipe-to-slide-away gesture for Back-Arrow secondary pages
    let edgePopArmed = false;
    let edgePopDragging = false;
    let edgePopStartX = 0;
    let edgePopStartY = 0;
    let edgePopLastX = 0;
    let edgePopLastT = 0;
    let edgePopVelocity = 0;
    let edgePopOutgoing = null;
    let edgePopIncoming = null;
    let edgePopTargetName = null;
    let edgePopFollow = null;

    function onSubpageEdgeTouchStart(e) {
        if (e.touches.length !== 1 || !stage || !container) return;
        const depth = VIEW_HIERARCHY_DEPTH[currentActiveViewName] ?? 0;
        if (depth <= 0) return;

        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay && !modalOverlay.classList.contains('opacity-0')) return;
        // The Timesheets sheet (timesheets.js) covers the screen: no swipe back underneath it
        if (document.documentElement.classList.contains('ts-sheet-open')) return;

        const touch = e.touches[0];
        const stageRect = stage.getBoundingClientRect();
        const relX = touch.clientX - stageRect.left;

        // Arm when touch starts near the left edge (<= 30px)
        if (relX <= 30 && !e.target.closest('input, textarea, select')) {
            edgePopArmed = true;
            edgePopDragging = false;
            edgePopStartX = touch.clientX;
            edgePopStartY = touch.clientY;
            edgePopLastX = touch.clientX;
            edgePopLastT = performance.now();
            edgePopVelocity = 0;
        }
    }

    function onSubpageEdgeTouchMove(e) {
        if (!edgePopArmed || !stage) return;
        const touch = e.touches[0];
        const dx = touch.clientX - edgePopStartX;
        const dy = touch.clientY - edgePopStartY;

        if (!edgePopDragging) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
                edgePopArmed = false;
                return;
            }
            if (dx > 10 && dx > Math.abs(dy) * 1.15) {
                edgePopDragging = true;
                if (activeViewTransitionCleanup) {
                    activeViewTransitionCleanup();
                    activeViewTransitionCleanup = null;
                }
                edgePopTargetName = getBackTargetForSubpage(currentActiveViewName, 'home');
                edgePopOutgoing = document.getElementById(`view-${currentActiveViewName}`);
                edgePopIncoming = document.getElementById(`view-${edgePopTargetName}`);

                if (!edgePopOutgoing || !edgePopIncoming || edgePopOutgoing === edgePopIncoming) {
                    edgePopArmed = false;
                    edgePopDragging = false;
                    return;
                }

                const stageTop = edgePopOutgoing.offsetTop || 0;
                const stageHeight = edgePopOutgoing.offsetHeight || stage.clientHeight;
                const savedScroll = edgePopOutgoing.scrollTop;

                clearViewTransitionStyles(edgePopOutgoing);
                clearViewTransitionStyles(edgePopIncoming);

                edgePopOutgoing.classList.remove('hidden');
                edgePopOutgoing.classList.add('view-transition-overlay');
                edgePopOutgoing.style.top = `${stageTop}px`;
                edgePopOutgoing.style.height = `${stageHeight}px`;
                edgePopOutgoing.style.zIndex = '26';
                edgePopOutgoing.style.boxShadow = '-20px 0 44px -8px rgba(15, 23, 42, 0.24), -2px 0 10px 0 rgba(15, 23, 42, 0.08)';
                edgePopOutgoing.scrollTop = savedScroll;

                edgePopIncoming.classList.remove('hidden');
                edgePopIncoming.style.zIndex = '15';

                // The bar moves with the page being swiped away; the one underneath shows its own bar
                if (typeof startTopBarFollow === 'function') {
                    edgePopFollow = startTopBarFollow(edgePopOutgoing, edgePopIncoming, true);
                    showTopBarFor(edgePopTargetName);
                }
            }
        }

        if (edgePopDragging && edgePopOutgoing && edgePopIncoming) {
            if (e.cancelable) e.preventDefault();
            const stageWidth = Math.max(1, stage.clientWidth);
            const clampedDx = Math.max(0, dx);
            const p = Math.min(1, clampedDx / stageWidth);

            const now = performance.now();
            const dt = Math.max(1, now - edgePopLastT);
            edgePopVelocity = 0.75 * ((touch.clientX - edgePopLastX) / dt) + 0.25 * edgePopVelocity;
            edgePopLastX = touch.clientX;
            edgePopLastT = now;

            edgePopOutgoing.style.transform = `translate3d(${clampedDx}px, 0, 0)`;
            const underlayShift = -28 * (1 - p);
            const underlayScale = 0.97 + (0.03 * p);
            const underlayBrightness = 0.91 + (0.09 * p);
            edgePopIncoming.style.transform = `translate3d(${underlayShift.toFixed(2)}%, 0, 0) scale(${underlayScale.toFixed(4)})`;
            edgePopIncoming.style.filter = `brightness(${underlayBrightness.toFixed(3)})`;
        }
    }

    function onSubpageEdgeTouchEnd() {
        if (!edgePopArmed) return;
        edgePopArmed = false;
        if (!edgePopDragging || !edgePopOutgoing || !edgePopIncoming) {
            edgePopDragging = false;
            return;
        }
        edgePopDragging = false;

        const stageWidth = Math.max(1, stage ? stage.clientWidth : 375);
        const currentDx = Math.max(0, edgePopLastX - edgePopStartX);
        const progress = currentDx / stageWidth;
        const shouldCompletePop = (progress > 0.28) || (edgePopVelocity > 0.35);

        const outEl = edgePopOutgoing;
        const inEl = edgePopIncoming;
        const targetTab = edgePopTargetName;
        const follow = edgePopFollow;
        edgePopFollow = null;
        edgePopOutgoing = null;
        edgePopIncoming = null;
        edgePopTargetName = null;

        const transitionCurve = 'cubic-bezier(0.32, 0.72, 0, 1)';
        outEl.style.transition = `transform 0.32s ${transitionCurve}`;
        inEl.style.transition = `transform 0.32s ${transitionCurve}, filter 0.32s ${transitionCurve}`;

        if (shouldCompletePop) {
            triggerHaptic('light');
            outEl.style.transform = 'translate3d(104%, 0, 0)';
            inEl.style.transform = 'translate3d(0%, 0, 0) scale(1)';
            inEl.style.filter = 'brightness(1)';

            currentActiveViewName = targetTab;
            const notifBtn = document.getElementById('btn-notifications');
            if (targetTab !== 'notifications' && notifBtn) {
                notifBtn.classList.remove('border-brand-lime', 'shadow-[0_0_12px_rgba(34,229,98,0.3)]');
            }
            requestAnimationFrame(syncDynamicStatusBar);

            setTimeout(() => {
                clearViewTransitionStyles(outEl);
                clearViewTransitionStyles(inEl);
                if (currentActiveViewName === targetTab) {
                    outEl.classList.add('hidden');
                    inEl.classList.remove('hidden');
                    if (typeof stopTopBarFollow === 'function' && follow) stopTopBarFollow(follow);
                }
            }, 330);
        } else {
            outEl.style.transform = 'translate3d(0px, 0, 0)';
            inEl.style.transform = 'translate3d(-28%, 0, 0) scale(0.97)';
            inEl.style.filter = 'brightness(0.91)';

            setTimeout(() => {
                clearViewTransitionStyles(outEl);
                clearViewTransitionStyles(inEl);
                outEl.classList.remove('hidden');
                inEl.classList.add('hidden');
                if (typeof stopTopBarFollow === 'function' && follow) stopTopBarFollow(follow);
                syncDynamicStatusBar();
            }, 330);
        }
    }

    if (stage) {
        stage.addEventListener('touchstart', onSubpageEdgeTouchStart, { passive: true });
        stage.addEventListener('touchmove', onSubpageEdgeTouchMove, { passive: false });
        stage.addEventListener('touchend', onSubpageEdgeTouchEnd, { passive: true });
        stage.addEventListener('touchcancel', onSubpageEdgeTouchEnd, { passive: true });
    }

    // Bind passive scroll listeners to all view scrollers so the top header & status bar dynamically adapt
    document.querySelectorAll('.view-section').forEach(view => {
        view.addEventListener('scroll', scheduleDynamicStatusBarSync, { passive: true });
    });
});

window.addEventListener('resize', () => {
    scheduleDynamicStatusBarSync();
});
