/**
 * Readiness-gated preloader and first-render hydration.
 * Registers the first DOMContentLoaded / load listeners - keep this the first core script.
 */

// ================= REAL READINESS-GATED PRELOADER & BOOT ENGINE =================
function hydrateAppViews() {
    try {
        if (typeof renderRosterCards === 'function') renderRosterCards();
    } catch (err) { console.warn('renderRosterCards notice:', err); }

    try {
        if (typeof renderSiteSites === 'function') renderSiteSites();
    } catch (err) { console.warn('renderSiteSites notice:', err); }

    try {
        if (typeof renderTeamDirectory === 'function') {
            const tData = (typeof TEAM_DIRECTORY_DATA !== 'undefined') ? TEAM_DIRECTORY_DATA : [];
            renderTeamDirectory(tData);
        }
    } catch (err) { console.warn('renderTeamDirectory notice:', err); }

    try {
        if (typeof renderToolsDirectory === 'function') {
            const toolData = (typeof TOOLS_DIRECTORY_DATA !== 'undefined') ? TOOLS_DIRECTORY_DATA : [];
            renderToolsDirectory(toolData);
        }
    } catch (err) { console.warn('renderToolsDirectory notice:', err); }

    try {
        if (typeof updateSiteAttendanceUI === 'function') updateSiteAttendanceUI();
    } catch (err) { console.warn('updateSiteAttendanceUI notice:', err); }

    try {
        if (typeof renderLifestyleChats === 'function') renderLifestyleChats();
    } catch (err) { console.warn('renderLifestyleChats notice:', err); }

    try {
        if (typeof renderNotificationsFeed === 'function') renderNotificationsFeed('all');
    } catch (err) { console.warn('renderNotificationsFeed notice:', err); }

    try {
        if (typeof updateHeroGreetingAndDate === 'function') updateHeroGreetingAndDate();
        if (typeof fetchLiveWeather === 'function') fetchLiveWeather();
    } catch (err) { console.warn('weather hydrate notice:', err); }
}

// Safari (WebKit) + the Tailwind Play CDN: classes in markup that JS renders during startup (the roster
// cards, team list, tools, chats...) are marked as seen but never generated, so e.g. the roster's
// w-[68px] / h-[72px] date tiles and card headers collapse on iPhone (Chrome is unaffected). Re-assigning
// tailwind.config is the Play CDN's own trigger for a full rescan of the page; once after startup
// rendering is enough (markup added later is picked up normally).
let tailwindRescanned = false;
function rescanTailwindClasses() {
    if (tailwindRescanned) return;
    tailwindRescanned = true;
    try {
        if (window.tailwind && window.tailwind.config) window.tailwind.config = Object.assign({}, window.tailwind.config);
    } catch (err) { console.warn('Tailwind rescan notice:', err); }
}

function waitForTailwindAndLayout() {
    return new Promise((resolve) => {
        const start = performance.now();
        function checkLayout() {
            const stage = document.getElementById('app-main-stage');
            const tailwindReady = stage && window.getComputedStyle(stage).display === 'flex';

            if (tailwindReady || (performance.now() - start > 900)) {
                requestAnimationFrame(() => resolve());
            } else {
                requestAnimationFrame(checkLayout);
            }
        }
        checkLayout();
    });
}

function forceDismissPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    if (!preloader.classList.contains('fade-out')) {
        preloader.classList.add('fade-out');
    }
    setTimeout(() => {
        try { preloader.remove(); } catch (_) {}
        if (typeof syncDynamicStatusBar === 'function') syncDynamicStatusBar();
        const heroProgress = document.querySelector('.hero-ambient-progress');
        if (heroProgress) {
            heroProgress.classList.add('animate-progress');
        }
    }, 260);
}

function dismissPreloaderWhenReady() {
    const preloader = document.getElementById('preloader');
    let isWarmSession = false;
    try {
        isWarmSession = sessionStorage.getItem('lifestyle_app_booted') === '1';
        sessionStorage.setItem('lifestyle_app_booted', '1');
    } catch (_) {}

    // Unconditional safety timeout: guarantees splash screen NEVER gets stuck
    const safetyTimeout = setTimeout(forceDismissPreloader, isWarmSession ? 450 : 1200);

    const domReadyPromise = new Promise((resolve) => {
        const runHydrate = () => {
            try { hydrateAppViews(); } catch (err) { console.warn('Hydration notice:', err); }
            resolve();
        };

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', runHydrate, { once: true });
        } else {
            runHydrate();
        }
    });

    const fontsReadyPromise = (document.fonts && document.fonts.ready)
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve();

    const allChecksPromise = domReadyPromise
        .then(() => Promise.all([
            waitForTailwindAndLayout().catch(() => {}),
            fontsReadyPromise
        ]))
        .catch(() => {});

    allChecksPromise.then(() => {
        clearTimeout(safetyTimeout);
        rescanTailwindClasses();               // before the splash fades, so every screen is styled
        forceDismissPreloader();
    });
}

// Auto-boot readiness listener & preloader dismissal
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', dismissPreloaderWhenReady, { once: true });
} else {
    dismissPreloaderWhenReady();
}
window.addEventListener('load', () => { rescanTailwindClasses(); forceDismissPreloader(); });
