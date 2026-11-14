/**
 * Home: the birthday notification banner.
 * Reads employees through the selectors (getEmployees) - no data of its own. The signed-in employee comes
 * from the auth session (getCurrentEmployeeId).
 */

// The app's "today": the anchor day the roster, sites and hero date are built around
// (Wednesday 14 October 2026 - see activeTodayCardId in week-roster.js and isToday in site-sites.js).
const APP_TODAY = new Date(2026, 9, 14);

const BIRTHDAY_LOOKAHEAD_DAYS = 5;
const BIRTHDAY_BANNER_AUTOHIDE_MS = 6000;

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/* ================= BIRTHDAYS ================= */

// '21 Oct' -> next occurrence on or after `from` (birthdays carry no year)
function nextBirthdayDate(birthday, from) {
    const m = /^(\d{1,2})\s+([A-Za-z]{3})/.exec(birthday || '');
    if (!m) return null;
    const month = MONTH_ABBR.indexOf(m[2].toLowerCase());
    if (month < 0) return null;
    const day = parseInt(m[1], 10);
    let d = new Date(from.getFullYear(), month, day);
    if (d < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
        d = new Date(from.getFullYear() + 1, month, day);
    }
    return d;
}

function daysBetween(a, b) {
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcB - utcA) / 86400000);
}

// Colleagues with a birthday today or within the next BIRTHDAY_LOOKAHEAD_DAYS days, soonest first
function getUpcomingBirthdays(from = APP_TODAY) {
    const me = getCurrentEmployeeId();
    return getEmployees()
        .filter(m => m.id !== me && m.birthday)
        .map(m => {
            const date = nextBirthdayDate(m.birthday, from);
            return date ? { member: m, date, daysAway: daysBetween(from, date) } : null;
        })
        .filter(b => b && b.daysAway >= 0 && b.daysAway <= BIRTHDAY_LOOKAHEAD_DAYS)
        .sort((a, b) => a.daysAway - b.daysAway);
}

function describeDaysAway(n) {
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    return `In ${n} days`;
}

/* ================= BANNER ================= */

let upcomingBirthdaysCache = [];
let birthdayBannerTimer = null;
const BIRTHDAY_BANNER_SESSION_KEY = 'birthdayBannerSeen';

function birthdayBannerAlreadySeen() {
    try { return sessionStorage.getItem(BIRTHDAY_BANNER_SESSION_KEY) === '1'; } catch (_) { return false; }
}
function markBirthdayBannerSeen() {
    try { sessionStorage.setItem(BIRTHDAY_BANNER_SESSION_KEY, '1'); } catch (_) {}
}

function showBirthdayBanner() {
    const banner = document.getElementById('birthday-banner');
    if (!banner || birthdayBannerAlreadySeen()) return;

    upcomingBirthdaysCache = getUpcomingBirthdays();
    if (!upcomingBirthdaysCache.length) return;

    const first = upcomingBirthdaysCache[0];
    const firstName = first.member.name;
    const dateLabel = first.date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });

    let title, message;
    if (upcomingBirthdaysCache.length === 1) {
        title = `${firstName}'s birthday`;
        message = `${describeDaysAway(first.daysAway)} · ${dateLabel}`;
    } else {
        title = `${upcomingBirthdaysCache.length} upcoming birthdays`;
        message = upcomingBirthdaysCache
            .map(b => `${b.member.name.split(' ')[0]} ${describeDaysAway(b.daysAway).toLowerCase()}`)
            .join(', ');
    }
    document.getElementById('birthday-banner-title').textContent = title;
    document.getElementById('birthday-banner-message').textContent = message;

    markBirthdayBannerSeen();
    banner.hidden = false;
    banner.classList.remove('is-leaving');
    // Commit the off-screen start position before animating in
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('is-visible')));
    scheduleBirthdayBannerAutohide();
}

function scheduleBirthdayBannerAutohide() {
    clearTimeout(birthdayBannerTimer);
    birthdayBannerTimer = setTimeout(dismissBirthdayBanner, BIRTHDAY_BANNER_AUTOHIDE_MS);
}

function dismissBirthdayBanner() {
    const banner = document.getElementById('birthday-banner');
    if (!banner || banner.hidden) return;
    clearTimeout(birthdayBannerTimer);
    banner.classList.remove('is-dragging');
    banner.classList.add('is-leaving');
    banner.style.transform = '';
    banner.classList.remove('is-visible');
    setTimeout(() => {
        if (!banner.classList.contains('is-visible')) {
            banner.hidden = true;
            banner.classList.remove('is-leaving');
        }
    }, 260);
}

function openBirthdayFromBanner() {
    const first = upcomingBirthdaysCache[0];
    dismissBirthdayBanner();
    if (!first) return;
    if (typeof triggerHaptic === 'function') triggerHaptic('light');
    openWidgetDetail('birthday', {
        name: first.member.name,
        whenText: describeDaysAway(first.daysAway),
        dateText: first.date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    });
}

// Swipe up to dismiss: 1:1 upwards, resisted downwards, velocity-aware release
function initBirthdayBannerGestures() {
    const banner = document.getElementById('birthday-banner');
    if (!banner) return;
    let startY = 0, lastY = 0, lastT = 0, velocity = 0, dragging = false, moved = false;

    banner.addEventListener('pointerdown', e => {
        if (banner.hidden) return;
        dragging = true; moved = false;
        startY = lastY = e.clientY; lastT = e.timeStamp; velocity = 0;
        clearTimeout(birthdayBannerTimer);
    });
    banner.addEventListener('pointermove', e => {
        if (!dragging) return;
        const dy = e.clientY - startY;
        if (!moved && Math.abs(dy) < 6) return;
        if (!moved) {
            moved = true;
            banner.classList.add('is-dragging');
            try { banner.setPointerCapture(e.pointerId); } catch (_) {}
        }
        const dt = Math.max(1, e.timeStamp - lastT);
        velocity = (e.clientY - lastY) / dt;
        lastY = e.clientY; lastT = e.timeStamp;
        const offset = dy < 0 ? dy : Math.sqrt(dy) * 3; // pulling down meets resistance
        banner.style.transform = `translateY(${offset}px)`;
    });
    const end = () => {
        if (!dragging) return;
        dragging = false;
        if (!moved) { scheduleBirthdayBannerAutohide(); return; }
        const dy = lastY - startY;
        if (dy < -28 || velocity < -0.35) {
            dismissBirthdayBanner();
        } else {
            banner.classList.remove('is-dragging');
            banner.style.transform = '';
            scheduleBirthdayBannerAutohide();
        }
    };
    banner.addEventListener('pointerup', end);
    banner.addEventListener('pointercancel', end);
    // A drag is not a tap
    banner.addEventListener('click', e => {
        if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);
    // Hold still while the user is reading with a pointer or keyboard
    banner.addEventListener('focusin', () => clearTimeout(birthdayBannerTimer));
    banner.addEventListener('focusout', () => { if (!banner.hidden) scheduleBirthdayBannerAutohide(); });
}

// Show the banner once the preloader has gone, so it arrives on a settled screen
function showBirthdayBannerAfterBoot() {
    let tries = 0;
    const wait = () => {
        const preloader = document.getElementById('preloader');
        if ((!preloader || preloader.classList.contains('fade-out')) || tries++ > 40) {
            setTimeout(showBirthdayBanner, 700);
        } else {
            setTimeout(wait, 100);
        }
    };
    wait();
}

document.addEventListener('DOMContentLoaded', () => {
    initBirthdayBannerGestures();
    showBirthdayBannerAfterBoot();
});
