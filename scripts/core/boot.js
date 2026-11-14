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
        if (typeof renderConnectedProject === 'function') renderConnectedProject();
    } catch (err) { console.warn('renderSiteSites notice:', err); }

    try {
        if (typeof renderHomeSiteCard === 'function') renderHomeSiteCard();
        if (typeof renderScheduleSiteSelect === 'function') renderScheduleSiteSelect();
    } catch (err) { console.warn('renderHomeSiteCard notice:', err); }

    try {
        if (typeof renderTeamDirectory === 'function') renderTeamDirectory(getEmployees());
    } catch (err) { console.warn('renderTeamDirectory notice:', err); }

    try {
        if (typeof renderToolsDirectory === 'function') renderToolsDirectory(getTools());
    } catch (err) { console.warn('renderToolsDirectory notice:', err); }

    try {
        if (typeof renderHomeCrewPreview === 'function') renderHomeCrewPreview();
        if (typeof renderHomeNavList === 'function') renderHomeNavList();
        if (typeof renderTimesheets === 'function') renderTimesheets();
    } catch (err) { console.warn('data-driven render notice:', err); }

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

// ================= APP DATA (scripts/application/bootstrap.js) =================
function whenAppDataReady() {
    return appStore.ready.then(() => true, err => { showDataLoadError(err); return false; });
}
// A small banner over the app: the data couldn't load, with Retry. The provider's own error text is never shown.
function showDataLoadError(err) {
    console.error('App data failed to load:', err);
    let bar = document.getElementById('data-status');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'data-status';
        bar.className = 'data-status';
        bar.setAttribute('role', 'alert');
        bar.innerHTML = `<span class="data-status-text"></span><button type="button" class="data-status-retry">Retry</button>`;
        bar.querySelector('button').addEventListener('click', retryAppDataLoad);
        (document.getElementById('app-container') || document.body).appendChild(bar);
    }
    bar.querySelector('.data-status-text').textContent = (err && err.userMessage) || 'Couldn\'t load your data.';
    bar.hidden = false;
}
function retryAppDataLoad() {
    const bar = document.getElementById('data-status');
    const btn = bar && bar.querySelector('button');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    appStore.load().then(() => {
        if (bar) bar.hidden = true;
        hydrateAppViews();
    }).catch(err => showDataLoadError(err)).finally(() => {
        if (btn) { btn.disabled = false; btn.textContent = 'Retry'; }
    });
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
        // First render once the page AND the app's data (appStore, scripts/application/bootstrap.js) are in.
        // A failed load still renders (empty states) and offers Retry.
        const runHydrate = () => {
            whenAppDataReady().then(() => {
                try { hydrateAppViews(); } catch (err) { console.warn('Hydration notice:', err); }
                resolve();
            });
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
