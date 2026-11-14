/**
 * App shell bootstrap: assistant orb init, Escape handling, zoom lock, interactive drawer swipe,
 * edge-swipe back gesture, scroll-driven status bar sync and resize handling.
 */

// Initialize the assistant orb on DOM ready

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initPoppySiriOrb);
    } else {
        initPoppySiriOrb();
    }
    window.addEventListener('load', initPoppySiriOrb);

    window.addEventListener('DOMContentLoaded', () => {

    // Keyboard support: Escape closes drawer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const container = document.getElementById('app-container');
            if (container && container.classList.contains('drawer-open')) {
                closeSideDrawer();
            }
        }
    });

    // Pinch-zoom is deliberately left enabled (accessibility). Double-tap zoom and the tap
    // delay are already removed with `touch-action: manipulation`, and inputs are 16px so iOS
    // never auto-zooms on focus. No document-level non-passive touch listener is needed.

    // ================= 3D DRAWER 1:1 INTERACTIVE IOS SWIPE & DRAG =================
    const container = document.getElementById('app-container');
    const stage = document.getElementById('app-main-stage');
    const drawer = document.getElementById('app-side-drawer');
    const layerCard = document.getElementById('drawer-layer-card');
    const hamburger = document.getElementById('btn-hamburger');

    let touchStartX = 0;
    let touchStartY = 0;
    let lastTouchX = 0;
    let lastTouchT = 0;
    let velocity = 0;
    let isArmed = false;
    let isDragging = false;
    let touchStartsOnCards = false;
    let touchStartsOnDrawer = false;
    let gestureMode = null; // 'open' | 'close'
    let currentProgress = 0;

    function renderDrawerProgress(p) {
        currentProgress = p;
        if (!stage || !layerCard || !drawer) return;

        // Stage 3D Perspective (0% to -74%, scale 1.0 to 0.85, radius 0 to 36px)
        stage.style.transformOrigin = 'left center';
        stage.style.transform = `translate3d(${-74 * p}%, 0, 0) scale(${1 - 0.15 * p})`;
        stage.style.borderRadius = `${36 * p}px`;
        stage.style.boxShadow = `20px 15px 50px rgba(0, 0, 0, ${0.45 * p}), 0 25px 50px rgba(0, 0, 0, ${0.25 * p})`;

        // Intermediate Layer Card (0% to -54%, scale 1.0 to 0.82, opacity 0 to 0.8)
        layerCard.style.transformOrigin = 'left center';
        layerCard.style.transform = `translate3d(${-54 * p}%, 0, 0) scale(${1 - 0.18 * p})`;
        layerCard.style.opacity = `${0.8 * p}`;
        layerCard.style.boxShadow = `16px 12px 40px rgba(0, 0, 0, ${0.35 * p}), 0 10px 25px rgba(0, 0, 0, ${0.2 * p})`;

        // Side Drawer (shifts from 12px to 0px, opacity 0 to 1)
        drawer.style.transform = `translate3d(${12 * (1 - p)}px, 0, 0)`;
        drawer.style.opacity = `${p}`;
        drawer.style.pointerEvents = p > 0.6 ? 'auto' : 'none';

        // Stage Scrim: fade smoothly with p, keeping stage razor-sharp (zero blur)
        const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
        if (dismissOverlay) {
            dismissOverlay.style.opacity = `${p}`;
            dismissOverlay.style.pointerEvents = p > 0.1 ? 'auto' : 'none';
        }

        if (p > 0.35) {
            setStatusBarThemeColor('#064e3b', true);
            document.documentElement.classList.add('drawer-open');
            document.body.classList.add('drawer-open');
        } else {
            document.documentElement.classList.remove('drawer-open');
            document.body.classList.remove('drawer-open');
            syncDynamicStatusBar();
        }
    }

    function animateDrawerTo(targetProgress, onComplete) {
        if (!stage || !layerCard || !drawer) return;
        const easeCurve = 'transform 0.38s var(--ease-drawer), border-radius 0.38s var(--ease-drawer), box-shadow 0.38s var(--ease-drawer), opacity 0.35s ease';
        stage.style.transition = easeCurve;
        layerCard.style.transition = easeCurve;
        drawer.style.transition = easeCurve;

        renderDrawerProgress(targetProgress);

        setTimeout(() => {
            if (stage) {
                stage.style.transition = '';
                stage.style.willChange = '';
            }
            if (layerCard) layerCard.style.transition = '';
            if (drawer) drawer.style.transition = '';
            const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
            if (dismissOverlay) {
                dismissOverlay.style.opacity = '';
                dismissOverlay.style.pointerEvents = '';
            }
            if (onComplete) onComplete();
        }, 390);
    }

    function onDrawerTouchStart(e) {
        if (!container || (e.touches && e.touches.length > 1)) return;
        const touch = e.touches[0];
        touchStartX = lastTouchX = touch.clientX;
        touchStartY = touch.clientY;
        lastTouchT = performance.now();
        velocity = 0;
        isDragging = false;
        isArmed = false;

        const isDrawerOpen = container.classList.contains('drawer-open');
        const modalOverlay = document.getElementById('modal-overlay');
        const isModalOpen = modalOverlay && !modalOverlay.classList.contains('opacity-0');

        if (isModalOpen) return;

        if (isDrawerOpen) {
            touchStartsOnDrawer = !!(drawer && drawer.contains(e.target));
            // When drawer is open: grabbing the left depth card / main stage commits to closing
            const leftZoneThreshold = container.offsetWidth * 0.52;
            touchStartsOnCards = !touchStartsOnDrawer && (touch.clientX <= leftZoneThreshold);
            isArmed = true;
            gestureMode = 'close';
            currentProgress = 1;
        } else {
            touchStartsOnDrawer = false;
            touchStartsOnCards = false;
            // Check if touch started on the right edge of container
            const rect = container.getBoundingClientRect();
            const rightEdgeThreshold = Math.max(rect.right - 80, rect.left + rect.width * 0.75);
            const notInHorizontalScroller = !e.target.closest('.overflow-x-auto, input, textarea, select');
            // The menu belongs to Home (its button only lives there), so the edge swipe does too
            const onHome = currentActiveViewName === 'home';
            if (onHome && touch.clientX >= rightEdgeThreshold && notInHorizontalScroller) {
                isArmed = true;
                gestureMode = 'open';
                currentProgress = 0;
            }
        }
    }

    function onDrawerTouchMove(e) {
        if (!isArmed || !container) return;
        const touch = e.touches[0];
        const diffX = touch.clientX - touchStartX;
        const diffY = touch.clientY - touchStartY;

        if (!isDragging) {
            const isHorizontal = Math.abs(diffX) > Math.abs(diffY) * 1.1;
            if (gestureMode === 'open' && diffX < -6 && isHorizontal) {
                isDragging = true;
                if (drawerStageTimer) { clearTimeout(drawerStageTimer); drawerStageTimer = null; }
            } else if (gestureMode === 'close') {
                if (touchStartsOnCards && diffX > 4 && (isHorizontal || Math.abs(diffX) > 4)) {
                    // Touching on the left depth card / stage: commit immediately to dragging right!
                    isDragging = true;
                    if (drawerStageTimer) { clearTimeout(drawerStageTimer); drawerStageTimer = null; }
                } else if (touchStartsOnDrawer && diffX > 18 && isHorizontal) {
                    // Swiping right intentionally across the drawer menu to dismiss
                    isDragging = true;
                    if (drawerStageTimer) { clearTimeout(drawerStageTimer); drawerStageTimer = null; }
                } else if (!touchStartsOnCards && Math.abs(diffY) > 8) {
                    isArmed = false; // scrolling vertically in drawer menu
                    return;
                }
            }
        }

        if (isDragging) {
            if (e.cancelable) e.preventDefault();

            const maxDist = Math.max(1, container.offsetWidth * 0.74);
            let p;
            if (gestureMode === 'open') {
                p = Math.max(0, Math.min(1.04, (-diffX) / maxDist));
            } else {
                p = Math.max(-0.04, Math.min(1, 1 - (diffX / maxDist)));
            }

            const now = performance.now();
            const dt = Math.max(1, now - lastTouchT);
            velocity = 0.8 * ((touch.clientX - lastTouchX) / dt) + 0.2 * velocity;
            lastTouchX = touch.clientX;
            lastTouchT = now;

            stage.style.transition = 'none';
            layerCard.style.transition = 'none';
            drawer.style.transition = 'none';
            if (stage) stage.style.willChange = 'transform, border-radius';
            renderDrawerProgress(p);
        }
    }

    function onDrawerTouchEnd(e) {
        if (!isArmed) return;
        isArmed = false;

        if (!isDragging) {
            // Tapped on stage/overlay while drawer is open -> close it
            // If tapped on the drawer itself, let the button/item click trigger normally
            if (gestureMode === 'close' && touchStartsOnCards) {
                if (e && e.cancelable) e.preventDefault();
                blockNextClick();
                closeSideDrawer();
            }
            return;
        }

        isDragging = false;
        const p = currentProgress;

        if (gestureMode === 'open') {
            // Opening threshold: needs to drag past 30% or flick with left velocity
            const shouldOpen = (p > 0.30) || (velocity < -0.32);
            if (shouldOpen) {
                animateDrawerTo(1, () => {
                    container.classList.add('drawer-open');
                    document.documentElement.classList.add('drawer-open');
                    document.body.classList.add('drawer-open');
                    setStatusBarThemeColor('#064e3b', true);
                    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
                    if (drawer) drawer.setAttribute('aria-hidden', 'false');
                    // Clear overrides to let CSS class hold state
                    stage.style.transform = '';
                    stage.style.transformOrigin = '';
                    stage.style.borderRadius = '';
                    stage.style.boxShadow = '';
                    stage.style.willChange = '';
                    layerCard.style.transform = '';
                    layerCard.style.opacity = '';
                    layerCard.style.boxShadow = '';
                    drawer.style.transform = '';
                    drawer.style.opacity = '';
                    drawer.style.pointerEvents = '';
                    const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
                    if (dismissOverlay) {
                        dismissOverlay.style.opacity = '';
                        dismissOverlay.style.pointerEvents = '';
                    }
                });
            } else {
                // Didn't drag enough -> cancel and snap back closed
                animateDrawerTo(0, () => {
                    container.classList.remove('drawer-open');
                    document.documentElement.classList.remove('drawer-open');
                    document.body.classList.remove('drawer-open');
                    syncDynamicStatusBar();
                    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
                    if (drawer) drawer.setAttribute('aria-hidden', 'true');
                    stage.style.transform = '';
                    stage.style.transformOrigin = '';
                    stage.style.borderRadius = '';
                    stage.style.boxShadow = '';
                    stage.style.willChange = '';
                    layerCard.style.transform = '';
                    layerCard.style.opacity = '';
                    layerCard.style.boxShadow = '';
                    drawer.style.transform = '';
                    drawer.style.opacity = '';
                    drawer.style.pointerEvents = '';
                    const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
                    if (dismissOverlay) {
                        dismissOverlay.style.opacity = '';
                        dismissOverlay.style.pointerEvents = '';
                    }
                });
            }
        } else if (gestureMode === 'close') {
            // Closing threshold: needs to drag rightwards past 30% (p < 0.70) or flick right
            const shouldClose = (p < 0.70) || (velocity > 0.32);
            if (shouldClose) {
                animateDrawerTo(0, () => {
                    container.classList.remove('drawer-open');
                    document.documentElement.classList.remove('drawer-open');
                    document.body.classList.remove('drawer-open');
                    syncDynamicStatusBar();
                    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
                    if (drawer) drawer.setAttribute('aria-hidden', 'true');
                    stage.style.transform = '';
                    stage.style.transformOrigin = '';
                    stage.style.borderRadius = '';
                    stage.style.boxShadow = '';
                    stage.style.willChange = '';
                    layerCard.style.transform = '';
                    layerCard.style.opacity = '';
                    layerCard.style.boxShadow = '';
                    drawer.style.transform = '';
                    drawer.style.opacity = '';
                    drawer.style.pointerEvents = '';
                    const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
                    if (dismissOverlay) {
                        dismissOverlay.style.opacity = '';
                        dismissOverlay.style.pointerEvents = '';
                    }
                });
            } else {
                // Didn't drag enough -> snap back open
                animateDrawerTo(1, () => {
                    container.classList.add('drawer-open');
                    document.documentElement.classList.add('drawer-open');
                    document.body.classList.add('drawer-open');
                    setStatusBarThemeColor('#064e3b', true);
                    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
                    if (drawer) drawer.setAttribute('aria-hidden', 'false');
                    stage.style.transform = '';
                    stage.style.transformOrigin = '';
                    stage.style.borderRadius = '';
                    stage.style.boxShadow = '';
                    stage.style.willChange = '';
                    layerCard.style.transform = '';
                    layerCard.style.opacity = '';
                    layerCard.style.boxShadow = '';
                    drawer.style.transform = '';
                    drawer.style.opacity = '';
                    drawer.style.pointerEvents = '';
                    const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
                    if (dismissOverlay) {
                        dismissOverlay.style.opacity = '';
                        dismissOverlay.style.pointerEvents = '';
                    }
                });
            }
        }
    }

    if (container) {
        container.addEventListener('touchstart', onDrawerTouchStart, { passive: true });
        container.addEventListener('touchmove', onDrawerTouchMove, { passive: false });
        container.addEventListener('touchend', onDrawerTouchEnd, { passive: true });
        container.addEventListener('touchcancel', onDrawerTouchEnd, { passive: true });
    }

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
        if (container.classList.contains('drawer-open')) return;
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
                notifBtn.classList.remove('border-brand-lime', 'shadow-[0_0_12px_rgba(204,255,0,0.3)]');
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
