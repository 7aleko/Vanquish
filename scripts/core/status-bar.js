/**
 * Dynamic iOS status bar colour and top header surface sync.
 */

// ================= DYNAMIC IOS STATUS BAR & TOP HEADER ENGINE =================
function setStatusBarThemeColor(color, isDark = false) {
    let themeMeta = document.getElementById('app-theme-color');
    if (!themeMeta) {
        document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove());
        themeMeta = document.createElement('meta');
        themeMeta.id = 'app-theme-color';
        themeMeta.name = 'theme-color';
        document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', color);

    if (window.innerWidth < 640) {
        document.documentElement.style.backgroundColor = color;
        if (document.body) {
            document.body.style.backgroundColor = color;
        }
    }
}

let statusBarRaf = null;
function scheduleDynamicStatusBarSync() {
    if (statusBarRaf) return;
    statusBarRaf = requestAnimationFrame(() => {
        statusBarRaf = null;
        syncDynamicStatusBar();
    });
}

// iOS scroll-edge effect: once content scrolls under a pushed screen's bar, the bar fades from the surface
// colour at the top (behind the status bar) to clear at its bottom edge. No solid band, border or shadow,
// so content dissolves into the top instead of meeting a hard edge.
function applyTopBarEdgeFade(topBar, rgb) {
    // no-repeat: a repeating gradient wraps at the bar's last device-pixel row, drawing its dark top
    // colour there as a 1px line
    topBar.style.background = `linear-gradient(180deg, rgb(${rgb}) 0%, rgba(${rgb}, 0.88) 45%, rgba(${rgb}, 0.5) 72%, rgba(${rgb}, 0) 100%) no-repeat`;
    topBar.style.borderColor = 'transparent';
    topBar.style.boxShadow = 'none';
}

function applyTopBarSurface(surface) {
    const topBar = document.getElementById('app-top-bar');
    const titleEl = document.getElementById('app-top-bar-title');
    if (!topBar) return;

    // App-wide dark theme: every surface is dark, so the bar always uses white ink
    topBar.classList.toggle('on-dark', true);
    // Only the frosted surface blurs what's behind it
    topBar.style.backdropFilter = topBar.style.webkitBackdropFilter = '';

    if (surface === 'frosted') {
        // Frosted glass over scrolled content (a screen opts in with data-bar-scrolled="frosted"): dark,
        // translucent and blurred, with a hairline, so content passing under never shows through the title
        topBar.style.background = 'rgba(10, 10, 12, 0.72)';
        topBar.style.backdropFilter = topBar.style.webkitBackdropFilter = 'blur(20px) saturate(180%)';
        topBar.style.borderColor = 'transparent';
        topBar.style.boxShadow = '0 0.5px 0 rgba(255, 255, 255, 0.08)';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#0a0a0c', true);
        return;
    }

    if (surface === 'home-dark') {
        // Home is a dark (Tesla-style) screen: the bar is the same near-black, no edge
        topBar.style.background = '#08080a';
        topBar.style.borderColor = 'transparent';
        topBar.style.boxShadow = 'none';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#08080a', true);
    } else if (surface === 'emerald') {
        applyTopBarEdgeFade(topBar, '2, 44, 34');      // today's card under the bar: emerald fade
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#022c22', true);
    } else if (surface === 'rain') {
        applyTopBarEdgeFade(topBar, '11, 26, 56');
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#0b1a38', true);
    } else if (surface === 'slate') {
        applyTopBarEdgeFade(topBar, '15, 23, 42');
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#0f172a', true);
    } else if (surface === 'blue') {
        applyTopBarEdgeFade(topBar, '37, 99, 235');
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#2563eb', true);
    } else if (surface === 'light-scrolled') {
        // Content scrolled under the bar: a soft fade from the page colour, no solid band or hairline
        applyTopBarEdgeFade(topBar, '8, 8, 10');
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#08080a', true);
    } else {
        // Default 'light-top': clear, so the screen and its ambient glow show through (the page runs under
        // the bar, styles/top-bar.css); the status bar matches the dark page
        topBar.style.background = 'transparent';
        topBar.style.borderColor = 'transparent';
        topBar.style.boxShadow = '';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#08080a', true);
    }
}

function syncDynamicStatusBar() {
    if (typeof syncTopBarMode === 'function') syncTopBarMode();

    const preloader = document.getElementById('preloader');
    if (preloader && !preloader.classList.contains('fade-out')) {
        // Style the bar for the screen underneath already, so it never shows a different colour as the splash fades
        if (currentActiveViewName === 'home') applyTopBarSurface('home-dark');
        setStatusBarThemeColor('#08080a', true);
        return;
    }

    const modalOverlay = document.getElementById('modal-overlay');
    const transferOverlay = document.getElementById('tool-transfer-modal-overlay');
    const isModalOpen = (modalOverlay && !modalOverlay.classList.contains('opacity-0')) ||
                        (transferOverlay && !transferOverlay.classList.contains('opacity-0'));
    if (isModalOpen) {
        setStatusBarThemeColor('#08080a', true);
        return;
    }

    if (currentActiveViewName === 'home') {
        applyTopBarSurface('home-dark');
        return;
    }

    const topBar = document.getElementById('app-top-bar');
    const activeView = document.getElementById(`view-${currentActiveViewName}`) || document.querySelector('.view-section:not(.hidden):not(.view-transition-overlay)');
    if (!topBar || !activeView) {
        applyTopBarSurface('light-top');
        return;
    }

    const scrollTop = activeView.scrollTop || 0;
    if (scrollTop <= 6) {
        applyTopBarSurface('light-top');
        return;
    }

    const headerBottom = topBar.getBoundingClientRect().bottom;
    const themedCards = activeView.querySelectorAll('[data-statusbar-surface], .glass-card-today, .is-rain-mode, .glass-card-rain');
    for (let i = 0; i < themedCards.length; i++) {
        const card = themedCards[i];
        const rect = card.getBoundingClientRect();
        if (rect.top <= headerBottom + 6 && rect.bottom >= headerBottom - 10) {
            if (card.classList.contains('is-rain-mode') || card.classList.contains('glass-card-rain')) {
                applyTopBarSurface('rain');
                return;
            }
            const explicitSurface = card.getAttribute('data-statusbar-surface');
            if (explicitSurface) {
                applyTopBarSurface(explicitSurface);
                return;
            }
            if (card.classList.contains('glass-card-today')) {
                applyTopBarSurface('emerald');
                return;
            }
        }
    }

    applyTopBarSurface(activeView.dataset.barScrolled === 'frosted' ? 'frosted' : 'light-scrolled');
}
