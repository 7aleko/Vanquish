/**
 * Shared bottom-sheet modal: open / close, overlay click, Escape and drag-to-dismiss.
 */

function openLiveChat() {
    switchTab('chat');
}

function openModal(title, htmlContent) {
    closeSideDrawer();
    triggerHaptic('medium');
    const titleEl = document.getElementById('modal-title');
    const headerContainer = document.getElementById('modal-header-container');
    if (titleEl) {
        if (title && title.trim() !== '') {
            titleEl.textContent = title;
            titleEl.classList.remove('hidden');
            if (headerContainer) headerContainer.className = "flex items-center justify-between pb-3.5 mb-2.5 border-b border-slate-100 shrink-0";
        } else {
            titleEl.textContent = '';
            titleEl.classList.add('hidden');
            if (headerContainer) headerContainer.className = "flex items-center justify-end pb-1 shrink-0 -mt-2";
        }
    }
    document.getElementById('modal-body').innerHTML = htmlContent;
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;

    // Clear any leftover drag offset so the sheet always rises from fully closed
    content.classList.remove('is-dragging');
    content.classList.remove('translate-y-[120%]');
    content.style.transform = 'translate3d(0, 100%, 0)';
    content.style.transition = 'none';

    const bodyScroller = document.getElementById('modal-body');
    if (bodyScroller) bodyScroller.scrollTop = 0;

    overlay.classList.remove('pointer-events-none', 'opacity-0');
    overlay.setAttribute('aria-hidden', 'false');

    // Double RAF guarantees frame 1 begins cleanly offscreen, animating with Apple spring curve
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            content.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
            content.style.transform = 'translate3d(0, 0, 0)';
            syncDynamicStatusBar();
        });
    });
}

function closeModal(fromDrag = false, startYOffset = 0, releaseVelocity = 0) {
    triggerHaptic('light');
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;

    // Reset Poppy Bot Siri Orb state and remove dark luxury modal styling
    if (content.classList.contains('poppy-dark-modal')) {
        setTimeout(() => { content.classList.remove('poppy-dark-modal'); }, 300);
    }
    if (typeof modalOrbInstance !== 'undefined' && modalOrbInstance) {
        try { modalOrbInstance.destroy(); } catch (_) {}
        modalOrbInstance = null;
    }
    if (typeof _poppyOrbState !== 'undefined' && _poppyOrbState !== 'idle') {
        if (typeof setPoppyOrbState === 'function') setPoppyOrbState('idle');
    }

    content.classList.remove('is-dragging');
    const sheetH = content.offsetHeight || 500;
    const exitTarget = sheetH + 50;

    let duration = 0.32;
    if (fromDrag) {
        const remaining = Math.max(0, exitTarget - startYOffset);
        const projectedSpeed = Math.max(releaseVelocity, 1.2);
        duration = Math.min(Math.max(remaining / (projectedSpeed * 1000), 0.20), 0.32);
    }

    // Animate smoothly from current position off the screen (pure transform, no opacity fade out on sheet)
    content.style.transition = `transform ${duration}s cubic-bezier(0.32, 0.72, 0, 1)`;
    content.style.transform = `translate3d(0, ${exitTarget}px, 0)`;
    overlay.classList.add('pointer-events-none', 'opacity-0');
    overlay.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
        content.classList.add('translate-y-[120%]');
        content.style.transition = '';
        content.style.transform = '';
        syncDynamicStatusBar();
    }, duration * 1000 + 20);
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const overlay = document.getElementById('modal-overlay');
    if (overlay && !overlay.classList.contains('opacity-0')) closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') closeModal();
        });
    }

    // High-Performance Apple Bottom Sheet Drag-to-Dismiss
    // 120fps rAF batching, velocity momentum release, subpixel rubberband past top, zero choppiness, pure transform
    if (content) {
        const DRAG_SLOP = 6;           // px before dragging commits
        const DISMISS_DISTANCE = 0.22; // fraction of sheet height
        const DISMISS_VELOCITY = 0.45; // px/ms flick threshold
        let startY = 0;
        let lastY = 0;
        let lastT = 0;
        let velocity = 0;
        let armed = false;
        let dragging = false;
        let rafId = null;
        let currentTranslate = 0;

        const rubberband = (overshoot, dimension, c = 0.45) =>
            (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));

        function scheduleSheetRender() {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                content.style.transform = `translate3d(0, ${currentTranslate}px, 0)`;
            });
        }

        function onDragStart(clientX, clientY, target) {
            const bodyScroller = document.getElementById('modal-body');
            const dragZone = document.getElementById('modal-drag-zone');
            const touchedHandle = dragZone && dragZone.contains(target);
            const touchedHeader = !bodyScroller || !bodyScroller.contains(target);

            armed = touchedHandle || touchedHeader || (bodyScroller && bodyScroller.scrollTop <= 0);
            dragging = false;
            startY = lastY = clientY;
            lastT = performance.now();
            velocity = 0;
            currentTranslate = 0;
        }

        function onDragMove(clientX, clientY, e) {
            if (!armed) return;
            const diffY = clientY - startY;

            if (!dragging) {
                if (diffY > DRAG_SLOP) {
                    dragging = true;
                    content.classList.add('is-dragging');
                } else if (diffY < -DRAG_SLOP) {
                    armed = false; // scrolling upward pass through
                    return;
                } else {
                    return;
                }
            }

            if (e && e.cancelable) e.preventDefault();

            const now = performance.now();
            const dt = Math.max(1, now - lastT);
            velocity = 0.8 * ((clientY - lastY) / dt) + 0.2 * velocity;
            lastY = clientY;
            lastT = now;

            const offset = diffY - DRAG_SLOP;
            currentTranslate = offset >= 0
                ? offset
                : rubberband(offset, content.offsetHeight || 500);
            scheduleSheetRender();
        }

        function onDragEnd() {
            if (!dragging) { armed = false; return; }
            dragging = false;
            armed = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

            content.classList.remove('is-dragging');
            const offset = lastY - startY - DRAG_SLOP;
            const sheetH = content.offsetHeight || 500;
            const shouldDismiss =
                velocity > DISMISS_VELOCITY ||
                (offset > sheetH * DISMISS_DISTANCE && velocity > -0.15);

            if (shouldDismiss) {
                closeModal(true, currentTranslate, velocity);
            } else {
                // Snap back fast: a slow return reads as the UI disagreeing with the user
                content.style.transition = 'transform var(--dur-snap) var(--ease-out)';
                content.style.transform = 'translate3d(0, 0, 0)';
                setTimeout(() => {
                    if (!dragging) {
                        content.style.transition = '';
                        content.style.transform = '';
                    }
                }, 280);
            }
        }

        // Touch Listeners
        content.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            onDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }, { passive: true });

        content.addEventListener('touchmove', (e) => {
            onDragMove(e.touches[0].clientX, e.touches[0].clientY, e);
        }, { passive: false });

        content.addEventListener('touchend', onDragEnd, { passive: true });
        content.addEventListener('touchcancel', onDragEnd, { passive: true });

        // Pointer Listeners for mouse/trackpad/pen drag support.
        // Touch is already handled by the touch listeners above; handling its pointer
        // events too would restart the gesture mid-drag.
        content.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            onDragStart(e.clientX, e.clientY, e.target);
        });
        window.addEventListener('pointermove', (e) => {
            if (!armed || e.pointerType === 'touch') return;
            onDragMove(e.clientX, e.clientY, e);
        });
        window.addEventListener('pointerup', onDragEnd);
        window.addEventListener('pointercancel', onDragEnd);
    }
});
