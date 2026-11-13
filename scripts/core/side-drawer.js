/**
 * 3D off-canvas side drawer open / close / navigate.
 */

// ================= 3D OFF-CANVAS SIDE DRAWER CONTROLS =================

let drawerStageTimer = null;
let isSuppressingDrawerClick = false;

function blockNextClick() {
    isSuppressingDrawerClick = true;
    setTimeout(() => { isSuppressingDrawerClick = false; }, 450);
}

// Global capture-phase listener: stops any phantom click from reaching stage UI buttons when closing drawer
window.addEventListener('click', (e) => {
    if (isSuppressingDrawerClick) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }
}, true);

function handleDrawerDismissOverlayClick(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    blockNextClick();
    closeSideDrawer();
}

function openSideDrawer() {
    triggerHaptic('light');
    const container = document.getElementById('app-container');
    const hamburger = document.getElementById('btn-hamburger');
    const drawer = document.getElementById('app-side-drawer');
    const stage = document.getElementById('app-main-stage');
    if (!container) return;

    container.classList.remove('drawer-closing');
    if (drawerStageTimer) { clearTimeout(drawerStageTimer); drawerStageTimer = null; }

    // Clear overrides so CSS class takes full effect cleanly
    if (stage) {
        stage.style.transform = '';
        stage.style.transformOrigin = '';
        stage.style.borderRadius = '';
        stage.style.boxShadow = '';
        stage.style.transition = '';
        stage.style.willChange = '';
    }
    const layerCard = document.getElementById('drawer-layer-card');
    if (layerCard) {
        layerCard.style.transform = '';
        layerCard.style.opacity = '';
        layerCard.style.boxShadow = '';
        layerCard.style.transition = '';
    }
    if (drawer) {
        drawer.style.transform = '';
        drawer.style.opacity = '';
        drawer.style.pointerEvents = '';
        drawer.style.transition = '';
    }
    const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
    if (dismissOverlay) {
        dismissOverlay.style.opacity = '';
        dismissOverlay.style.pointerEvents = '';
    }

    container.classList.add('drawer-open');
    document.documentElement.classList.add('drawer-open');
    document.body.classList.add('drawer-open');
    setStatusBarThemeColor('#064e3b', true);
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    if (drawer) drawer.setAttribute('aria-hidden', 'false');
}

function closeSideDrawer() {
    const container = document.getElementById('app-container');
    if (!container || (!container.classList.contains('drawer-open') && !container.classList.contains('drawer-closing'))) return;

    blockNextClick();
    triggerHaptic('light');
    const hamburger = document.getElementById('btn-hamburger');
    const drawer = document.getElementById('app-side-drawer');
    const stage = document.getElementById('app-main-stage');

    container.classList.remove('drawer-open');
    container.classList.add('drawer-closing');
    document.documentElement.classList.remove('drawer-open');
    document.body.classList.remove('drawer-open');
    syncDynamicStatusBar();
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');

    if (drawerStageTimer) { clearTimeout(drawerStageTimer); drawerStageTimer = null; }

    if (stage) {
        drawerStageTimer = setTimeout(() => {
            drawerStageTimer = null;
            container.classList.remove('drawer-closing');
            if (!container.classList.contains('drawer-open')) {
                stage.style.transform = '';
                stage.style.transformOrigin = '';
                stage.style.borderRadius = '';
                stage.style.boxShadow = '';
                stage.style.transition = '';
                stage.style.willChange = '';
            }
            const dismissOverlay = document.getElementById('drawer-dismiss-overlay');
            if (dismissOverlay) {
                dismissOverlay.style.opacity = '';
                dismissOverlay.style.pointerEvents = '';
            }
        }, 420);
    }
}

function toggleSideDrawer() {
    const container = document.getElementById('app-container');
    if (container && container.classList.contains('drawer-open')) {
        closeSideDrawer();
    } else {
        openSideDrawer();
    }
}

function drawerNavigate(target) {
    triggerHaptic('light');
    closeSideDrawer();
    setTimeout(() => {
        if (target === 'profile') {
            openProfileModal();
        } else if (target === 'workwear') {
            openWorkWearModal();
        } else if (target === 'leave') {
            openPendingLeaveModal();
        } else if (target === 'role') {
            openRoleSignOffModal();
        } else if (target === 'safety') {
            openSafetyTrainingModal();
        } else if (target === 'guide') {
            openAppGuideModal();
        } else if (target === 'timesheets') {
            openTimeView();               // the Time screen (scripts/features/timesheets.js) replaces the old sheet
        } else if (target === 'logout') {
            showToast('Account', 'Alexander Floratos signed out (Demo)');
        } else {
            switchTab(target);
        }
    }, 280);
}
