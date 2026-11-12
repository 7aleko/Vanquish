/**
 * Accessibility enhancer.
 * Rows and cards made tappable with onclick="" are plain <div>s: invisible to keyboard and
 * assistive tech. Give each one button semantics, a tab stop and Enter/Space activation,
 * including rows rendered later from templates. Containers that hold their own buttons are
 * skipped - nesting interactive roles would hide the inner buttons from screen readers.
 */
(function () {
    const CLICKABLE = '[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(label):not(option)';
    const INTERACTIVE_CHILD = 'button, a[href], input, select, textarea, [onclick]';

    function upgrade(el) {
        if (el.dataset.a11yButton || el.querySelector(INTERACTIVE_CHILD)) return;
        el.dataset.a11yButton = '1';
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    }

    function scan(node) {
        if (!(node instanceof Element)) return;
        if (node.matches(CLICKABLE)) upgrade(node);
        node.querySelectorAll(CLICKABLE).forEach(upgrade);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = e.target;
        if (!(el instanceof HTMLElement) || !el.dataset.a11yButton) return;
        e.preventDefault(); // Space would otherwise scroll the view
        el.click();
    });

    function start() {
        scan(document.body);
        new MutationObserver((mutations) => {
            for (const m of mutations) m.addedNodes.forEach(scan);
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
