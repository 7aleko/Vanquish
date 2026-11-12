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

function applyTopBarSurface(surface) {
    const topBar = document.getElementById('app-top-bar');
    const titleEl = document.getElementById('app-top-bar-title');
    if (!topBar) return;

    topBar.classList.toggle('on-dark', ['home-dark', 'emerald', 'rain', 'slate', 'blue'].includes(surface));

    if (surface === 'home-dark') {
        // Home is a dark (Tesla-style) screen: the bar is the same near-black, no edge
        topBar.style.background = '#08080a';
        topBar.style.borderColor = 'transparent';
        topBar.style.boxShadow = 'none';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#08080a', true);
    } else if (surface === 'emerald') {
        topBar.style.background = 'linear-gradient(135deg, rgba(2, 44, 34, 0.94) 0%, rgba(6, 30, 20, 0.94) 60%, rgba(2, 6, 23, 0.94) 100%)';
        topBar.style.borderColor = 'rgba(16, 185, 129, 0.25)';
        topBar.style.boxShadow = '0 10px 24px -8px rgba(0, 0, 0, 0.35)';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#022c22', true);
    } else if (surface === 'rain') {
        topBar.style.background = 'linear-gradient(135deg, rgba(11, 26, 56, 0.95) 0%, rgba(12, 22, 45, 0.95) 100%)';
        topBar.style.borderColor = 'rgba(96, 165, 250, 0.3)';
        topBar.style.boxShadow = '0 10px 24px -8px rgba(0, 0, 0, 0.38)';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#0b1a38', true);
    } else if (surface === 'slate') {
        topBar.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(12, 22, 45, 0.94) 100%)';
        topBar.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        topBar.style.boxShadow = '0 10px 24px -8px rgba(0, 0, 0, 0.35)';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#0f172a', true);
    } else if (surface === 'blue') {
        topBar.style.background = 'linear-gradient(135deg, rgba(37, 99, 235, 0.94) 0%, rgba(67, 56, 202, 0.94) 100%)';
        topBar.style.borderColor = 'rgba(147, 197, 253, 0.3)';
        topBar.style.boxShadow = '0 10px 24px -8px rgba(37, 99, 235, 0.3)';
        if (titleEl) { titleEl.classList.remove('text-slate-900'); titleEl.classList.add('text-white'); }
        setStatusBarThemeColor('#2563eb', true);
    } else if (surface === 'light-scrolled') {
        topBar.style.background = '#ffffff';
        topBar.style.borderColor = 'rgba(15, 23, 42, 0.06)';
        topBar.style.boxShadow = '0 6px 20px -6px rgba(15, 23, 42, 0.06)';
        if (titleEl) { titleEl.classList.remove('text-white'); titleEl.classList.add('text-slate-900'); }
        setStatusBarThemeColor('#ffffff', false);
    } else {
        // Default 'light-top': clear, so the screen and its ambient glow show through (the page runs under
        // the bar, styles/top-bar.css); the status bar colour stays the #F3F4F6 page colour
        topBar.style.background = 'transparent';
        topBar.style.borderColor = 'transparent';
        topBar.style.boxShadow = '';
        if (titleEl) { titleEl.classList.remove('text-white'); titleEl.classList.add('text-slate-900'); }
        setStatusBarThemeColor('#F3F4F6', false);
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

    const container = document.getElementById('app-container');
    if (container && container.classList.contains('drawer-open')) {
        setStatusBarThemeColor('#064e3b', true);
        return;
    }

    const modalOverlay = document.getElementById('modal-overlay');
    const transferOverlay = document.getElementById('tool-transfer-modal-overlay');
    const isModalOpen = (modalOverlay && !modalOverlay.classList.contains('opacity-0')) ||
                        (transferOverlay && !transferOverlay.classList.contains('opacity-0'));
    if (isModalOpen) {
        setStatusBarThemeColor('#e4e6ec', false);
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

    applyTopBarSurface('light-scrolled');
}
