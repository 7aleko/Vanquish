/**
 * Account sheet: opened from the avatar in the top bar. It replaced the 3D side menu and holds every
 * destination that menu had, grouped (markup in index.html #account-sheet-overlay, styles in
 * styles/account-sheet.css). The values in it come from renderAccountStatus() (scripts/features/account.js).
 *
 * Phones: a bottom sheet (drag the handle or flick down to close). Wider screens: a centred dialog.
 * Closes with ×, the backdrop, Escape, or the drag. While open, the screen behind is inert (no focus, no
 * taps, no scroll); focus moves into the sheet, Tab stays inside it, and returns to the avatar on close.
 *
 * Rows open their page INSIDE the sheet: it slides in from the right over the list (the app's page-push
 * motion) with Back, Escape or a swipe from the left edge to return. The pages are the same content those
 * rows always showed: while the sheet is open, openModal() hands its title and content to pushAccountPage(),
 * and closeModal() (a page's own Done / Save) goes back to the list (scripts/core/modal.js).
 */

const ACCOUNT_SHEET_CLOSE_MS = 320;
let accountSheetCloseTimer = null;
let accountSheetReturnFocus = null;

let accountSheetOpen = false;                         // logical state (the is-open class follows a frame later)
let accountSheetEnterFrame = 0;

function isAccountSheetOpen() { return accountSheetOpen; }

// iOS Safari only animates from the closed position if it has painted that position first: un-hiding an
// element and moving it to its open position in the same frame shows it already open (the glass layer is
// created that frame). So: un-hide, wait two frames, then animate - as the shared modal does (modal.js).
function afterFirstPaint(fn) {
    return requestAnimationFrame(() => { accountSheetEnterFrame = requestAnimationFrame(fn); });
}

function openAccountSheet() {
    const overlay = document.getElementById('account-sheet-overlay');
    const sheet = document.getElementById('account-sheet');
    if (!overlay || !sheet || isAccountSheetOpen()) return;
    triggerHaptic('light');
    clearTimeout(accountSheetCloseTimer);
    if (typeof renderAccountStatus === 'function') renderAccountStatus();

    accountSheetReturnFocus = document.activeElement;
    sheet.style.transform = '';
    overlay.hidden = false;
    accountSheetOpen = true;
    cancelAnimationFrame(accountSheetEnterFrame);
    accountSheetEnterFrame = afterFirstPaint(() => { if (accountSheetOpen) overlay.classList.add('is-open'); });
    document.getElementById('account-sheet-overlay').querySelector('.account-sheet-body').scrollTop = 0;

    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = true;                    // nothing behind can be focused, tapped or scrolled
    document.documentElement.classList.add('account-sheet-open');
    const btn = document.getElementById('btn-account');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (typeof setBackgroundShadersPaused === 'function') setBackgroundShadersPaused(true);
    sheet.focus({ preventScroll: true });
}

// opts.instant: no exit animation (another sheet is taking over). opts.keepFocus: don't move focus back to
// the avatar (the next sheet takes it).
function closeAccountSheet(opts = {}) {
    const overlay = document.getElementById('account-sheet-overlay');
    const sheet = document.getElementById('account-sheet');
    if (!overlay || overlay.hidden) return;
    const wasOpen = accountSheetOpen;
    accountSheetOpen = false;
    cancelAnimationFrame(accountSheetEnterFrame);
    overlay.classList.remove('is-open');
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';

    const stage = document.getElementById('app-main-stage');
    if (stage) stage.inert = false;
    document.documentElement.classList.remove('account-sheet-open');
    const btn = document.getElementById('btn-account');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (wasOpen && typeof setBackgroundShadersPaused === 'function') setBackgroundShadersPaused(false);

    clearTimeout(accountSheetCloseTimer);
    const finish = () => {
        if (accountSheetOpen) return;
        overlay.hidden = true;
        resetAccountPages();                          // reopening starts on the list
    };
    if (opts.instant) finish();
    else accountSheetCloseTimer = setTimeout(finish, ACCOUNT_SHEET_CLOSE_MS);

    if (!opts.keepFocus && wasOpen) {
        const ret = accountSheetReturnFocus;
        const target = (ret && ret !== document.body && document.contains(ret)) ? ret : btn;
        if (target && target.focus) target.focus({ preventScroll: true });
    }
    accountSheetReturnFocus = null;
}

// The sheet's rows: each opens the same sheet or screen the side menu opened
const ACCOUNT_DESTINATIONS = {
    profile: () => openProfileModal(),
    role: () => openRoleSignOffModal(),
    leave: () => openPendingLeaveModal(),
    workwear: () => openWorkWearModal(),
    safety: () => openSafetyTrainingModal(),
    guide: () => openAppGuideModal(),
    logout: () => { closeAccountSheet(); signOutAccount(); }
};
function accountSheetNavigate(target) {
    const go = ACCOUNT_DESTINATIONS[target];
    if (!go) return;
    triggerHaptic('light');
    accountPageOpener = document.activeElement;       // focus returns to this row on Back
    go();                                             // its openModal() becomes a page in this sheet
}

// ---- Pages inside the sheet ----
const ACCOUNT_PAGE_MS = 440;
let accountPageState = 'root';                        // 'root' | 'shown' | 'popping'
let accountPageTimer = null;
let accountPageOpener = null;

function isAccountPageShown() { return accountPageState === 'shown'; }

function pushAccountPage(title, html) {
    const rootPage = document.getElementById('account-page-root');
    const page = document.getElementById('account-page-detail');
    const titleEl = document.getElementById('account-detail-title');
    const body = document.getElementById('account-detail-body');
    if (!rootPage || !page) return;
    titleEl.textContent = title || '';
    body.innerHTML = html;
    body.scrollTop = 0;

    if (accountPageState === 'shown') {
        // Already on a page (it reopened itself): swap the content in place
        if (body.animate) body.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    } else {
        clearTimeout(accountPageTimer);
        page.hidden = false;
        accountSheetEnterFrame = afterFirstPaint(() => {   // start from off-screen right (see afterFirstPaint)
            if (accountPageState !== 'shown') return;
            page.classList.add('is-shown');
            rootPage.classList.add('is-covered');
        });
        rootPage.inert = true;
        accountPageState = 'shown';
    }
    titleEl.focus({ preventScroll: true });
}

function popAccountPage() {
    if (accountPageState !== 'shown') return;
    triggerHaptic('light');
    const rootPage = document.getElementById('account-page-root');
    const page = document.getElementById('account-page-detail');
    page.classList.remove('is-shown');
    rootPage.classList.remove('is-covered');
    rootPage.inert = false;
    accountPageState = 'popping';
    clearTimeout(accountPageTimer);
    accountPageTimer = setTimeout(() => {
        if (accountPageState !== 'popping') return;
        page.hidden = true;
        document.getElementById('account-detail-body').innerHTML = '';
        accountPageState = 'root';
    }, ACCOUNT_PAGE_MS);
    const opener = accountPageOpener;
    accountPageOpener = null;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    else document.getElementById('account-sheet').focus({ preventScroll: true });
}

function resetAccountPages() {
    clearTimeout(accountPageTimer);
    const rootPage = document.getElementById('account-page-root');
    const page = document.getElementById('account-page-detail');
    if (!rootPage || !page) return;
    page.classList.remove('is-shown', 'is-dragging');
    page.style.transform = '';
    rootPage.classList.remove('is-covered', 'is-dragging');
    rootPage.style.transform = '';
    rootPage.style.opacity = '';
    rootPage.inert = false;
    page.hidden = true;
    document.getElementById('account-detail-body').innerHTML = '';
    accountPageState = 'root';
    accountPageOpener = null;
}

// Sign Out. There is no identity provider connected yet (scripts/infrastructure/auth.js is a mock session
// and the app has no sign-in screen), so this keeps the menu's previous demo behaviour. When a real provider
// is connected, sign out through it here (authSession) and show its sign-in screen.
function signOutAccount() {
    const p = ACCOUNT_DATA.profile;
    showToast('Account', `${p.name} signed out (Demo)`);
}

// ---- Keyboard: Escape closes; Tab stays inside the sheet ----
document.addEventListener('keydown', (e) => {
    if (!isAccountSheetOpen()) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isAccountPageShown()) popAccountPage();   // a page goes back to the list first
        else closeAccountSheet();
        return;
    }
    if (e.key === 'Tab') {
        const sheet = document.getElementById('account-sheet');
        const items = [...sheet.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
            .filter(el => !el.hidden && el.offsetParent !== null && !el.closest('[inert]'));
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});

// ---- Phones: drag the handle (or the identity area) down to close; a flick closes too ----
document.addEventListener('DOMContentLoaded', () => {
    const sheet = document.getElementById('account-sheet');
    if (!sheet) return;
    const isBottomSheet = () => window.matchMedia('(max-width: 639px)').matches;
    const handles = [...sheet.querySelectorAll('.account-sheet-grab'), sheet.querySelector('.account-identity')].filter(Boolean);
    let startY = 0, dy = 0, lastY = 0, lastT = 0, v = 0, id = null;

    handles.forEach(h => h.addEventListener('pointerdown', e => {
        if (!isBottomSheet() || !isAccountSheetOpen()) return;
        id = e.pointerId; startY = lastY = e.clientY; lastT = performance.now(); dy = 0; v = 0;
        h.setPointerCapture(id);
        sheet.classList.add('is-dragging');
    }));
    handles.forEach(h => h.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        const now = performance.now();
        v = (e.clientY - lastY) / Math.max(1, now - lastT);
        lastY = e.clientY; lastT = now;
        const raw = e.clientY - startY;
        dy = raw > 0 ? raw : -Math.sqrt(-raw) * 2;                        // a little resistance upwards
        sheet.style.transform = `translate3d(0, ${dy}px, 0)`;
    }));
    const end = e => {
        if (e.pointerId !== id) return;
        id = null;
        sheet.classList.remove('is-dragging');
        if (dy > 110 || (dy > 20 && v > 0.5)) closeAccountSheet();
        else sheet.style.transform = '';
    };
    handles.forEach(h => { h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end); });
});

// ---- Swipe from a page's left edge back to the list (like the app's own pages) ----
document.addEventListener('DOMContentLoaded', () => {
    const page = document.getElementById('account-page-detail');
    const rootPage = document.getElementById('account-page-root');
    if (!page || !rootPage) return;
    const EDGE = 24;
    let id = null, x0 = 0, y0 = 0, dx = 0, lastX = 0, lastT = 0, v = 0, dragging = false;

    page.addEventListener('pointerdown', e => {
        if (!isAccountPageShown() || e.pointerType === 'mouse') return;
        const left = page.getBoundingClientRect().left;
        if (e.clientX - left > EDGE) return;
        id = e.pointerId; x0 = lastX = e.clientX; y0 = e.clientY; dx = 0; v = 0; lastT = performance.now(); dragging = false;
    });
    page.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        const mx = e.clientX - x0, my = e.clientY - y0;
        if (!dragging) {
            if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { id = null; return; }   // a scroll, not a swipe
            if (mx < 8) return;
            dragging = true;
            page.setPointerCapture(id);
            page.classList.add('is-dragging');
            rootPage.classList.add('is-dragging');
        }
        const now = performance.now();
        v = (e.clientX - lastX) / Math.max(1, now - lastT);
        lastX = e.clientX; lastT = now;
        const w = page.offsetWidth || 1;
        dx = Math.max(0, mx);
        const p = Math.min(1, dx / w);
        page.style.transform = `translate3d(${dx}px, 0, 0)`;
        rootPage.style.transform = `translate3d(${-24 * (1 - p)}%, 0, 0) scale(${0.97 + 0.03 * p})`;
        rootPage.style.opacity = String(0.88 + 0.12 * p);
    });
    const end = e => {
        if (e.pointerId !== id) return;
        id = null;
        if (!dragging) return;
        dragging = false;
        page.classList.remove('is-dragging');
        rootPage.classList.remove('is-dragging');
        // Clearing the inline values lets the class transitions carry on from where the finger left off
        page.style.transform = '';
        rootPage.style.transform = '';
        rootPage.style.opacity = '';
        if (dx > page.offsetWidth * 0.35 || v > 0.4) popAccountPage();
    };
    page.addEventListener('pointerup', end);
    page.addEventListener('pointercancel', end);
});
