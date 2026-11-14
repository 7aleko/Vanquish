/**
 * App icon system: Phosphor Icons, Fill weight (https://phosphoricons.com; line glyphs in Bold), rendered from the
 * existing `<i class="fa-solid fa-NAME ...">` markup.
 *
 * The markup, templates and data keep their icon names (fa-bell, fa-cloud-sun, ...); this file maps
 * each one to its Phosphor equivalent and renders a filled glyph inside the same <i>. The <i> stays,
 * so its size (font-size classes), colour (text-* classes) and any JS that targets it (spinners,
 * className swaps) keep working. Icons inserted or re-classed later are picked up by a
 * MutationObserver, so dynamic templates need no changes.
 *
 * Opt-out: icons inside [data-icon-lib="fa"] keep their Font Awesome glyph (the hero weather icon).
 * Sizing / colour tokens live in styles/icons.css.
 */

const FA_TO_PHOSPHOR = {
    // Navigation & chrome
    'bars': 'list', 'xmark': 'x', 'chevron-right': 'caret-right', 'chevron-left': 'caret-left',
    'arrow-left': 'arrow-left', 'arrow-right': 'arrow-right', 'arrow-up': 'arrow-up', 'arrow-up-right': 'arrow-up-right',
    'magnifying-glass': 'magnifying-glass', 'rotate': 'arrows-clockwise', 'plus': 'plus', 'minus': 'minus',
    'house': 'house', 'bell': 'bell', 'bell-slash': 'bell-slash', 'circle-info': 'info', 'copy': 'copy',
    'lock': 'lock', 'check': 'check', 'check-double': 'checks', 'check-circle': 'check-circle', 'star': 'star',
    'arrow-right-from-bracket': 'sign-out', 'right-from-bracket': 'sign-out', 'arrow-right-arrow-left': 'arrows-left-right',
    'pen-to-square': 'note-pencil', 'paper-plane': 'paper-plane-tilt', 'location-arrow': 'navigation-arrow',

    // People & communication
    'users': 'users-three', 'user-group': 'users', 'users-gear': 'user-gear', 'id-badge': 'identification-badge',
    'clipboard-user': 'clipboard-text', 'building-user': 'building', 'comment': 'chat-circle', 'message': 'chat',
    'comment-dots': 'chat-circle-dots', 'phone': 'phone', 'envelope': 'envelope-simple', 'signature': 'signature',
    'file-signature': 'signature', 'file-lines': 'file-text', 'cake-candles': 'cake',
    'wand-magic-sparkles': 'sparkle', 'sparkles': 'sparkle',

    // Time
    'clock': 'clock', 'calendar': 'calendar-blank', 'calendar-days': 'calendar-dots', 'calendar-week': 'calendar',
    'calendar-check': 'calendar-check', 'calendar-minus': 'calendar-minus',

    // Work & site
    'briefcase': 'briefcase', 'helmet-safety': 'hard-hat', 'hammer': 'hammer', 'screwdriver-wrench': 'wrench',
    'location-dot': 'map-pin', 'city': 'buildings', 'warehouse': 'warehouse', 'shield-halved': 'shield-check',
    'kit-medical': 'first-aid-kit', 'shirt': 't-shirt', 'plane-departure': 'airplane-takeoff',
    'truck-ramp-box': 'truck', 'trailer': 'truck', 'tractor': 'tractor', 'stairs': 'ladder',
    'compass': 'compass', 'compass-drafting': 'compass-tool', 'ruler': 'ruler', 'clipboard-check': 'clipboard-text',
    'code-branch': 'git-branch', 'book-open': 'book-open', 'circle-play': 'play-circle',
    'images': 'images', 'camera': 'camera',

    // Trades (whiteboard)
    'cubes-stacked': 'cube', 'faucet-drip': 'drop', 'bolt-lightning': 'lightning', 'bolt': 'lightning',
    'weight-hanging': 'barbell', 'trowel-bricks': 'wall', 'network-wired': 'traffic-cone',
    'border-all': 'grid-four', 'layer-group': 'stack',

    // Weather
    'sun': 'sun', 'moon': 'moon', 'cloud': 'cloud', 'cloud-sun': 'cloud-sun', 'cloud-moon': 'cloud-moon',
    'cloud-rain': 'cloud-rain', 'cloud-showers-heavy': 'cloud-rain', 'cloud-showers-water': 'cloud-rain',
    'cloud-bolt': 'cloud-lightning', 'smog': 'cloud-fog', 'snowflake': 'snowflake', 'umbrella': 'umbrella',
    'water': 'waves'
};

// Pure line glyphs have no real filled form (Fill turns them into boxes / solid triangles), so they use
// Phosphor's Bold weight - the same split Apple makes between filled symbols and chevrons/plus/xmark.
const PHOSPHOR_LINE_GLYPHS = new Set(['list', 'x', 'caret-left', 'caret-right', 'plus', 'minus', 'check', 'checks', 'signature']);

// Font Awesome modifier classes that are not icon names
const FA_NON_ICON = new Set(['fa-solid', 'fa-regular', 'fa-brands', 'fa-light', 'fa-thin', 'fa-fw', 'fa-spin',
    'fa-xs', 'fa-sm', 'fa-lg', 'fa-xl', 'fa-2xl', 'fa-1x', 'fa-2x', 'fa-3x']);

function getFaIconName(el) {
    for (const cls of el.classList) {
        if (cls.startsWith('fa-') && !FA_NON_ICON.has(cls)) return cls.slice(3);
    }
    return null;
}

function renderAppIcon(el) {
    if (el.closest('[data-icon-lib="fa"]')) return;
    const fa = getFaIconName(el);
    if (!fa) return;
    if (el.dataset.icon === fa) {
        // Same icon re-classed (a className swap drops ph-icon): restore it so Font Awesome's glyph stays hidden
        if (!el.classList.contains('ph-icon')) el.classList.add('ph-icon');
        return;
    }

    const name = FA_TO_PHOSPHOR[fa];
    if (!name) {
        console.warn(`icons.js: no Phosphor mapping for fa-${fa}`);
        // Swapped to an unmapped icon: drop the previous Phosphor glyph so Font Awesome draws this one alone
        if (el.dataset.icon) { el.replaceChildren(); delete el.dataset.icon; el.classList.remove('ph-icon'); }
        return;
    }
    const glyph = document.createElement('span');
    // data-icon-weight="bold" opts a glyph into the line weight (Home's bell, to match the menu icon's stroke)
    const weight = el.dataset.iconWeight || (PHOSPHOR_LINE_GLYPHS.has(name) ? 'bold' : 'fill');
    glyph.className = `ph-${weight} ph-${name}`;
    glyph.setAttribute('aria-hidden', 'true');
    el.replaceChildren(glyph);
    el.dataset.icon = fa;
    if (!el.classList.contains('ph-icon')) el.classList.add('ph-icon');
}

function upgradeIconsIn(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'I' && root.className && String(root.className).includes('fa-')) renderAppIcon(root);
    root.querySelectorAll('i[class*="fa-"]').forEach(renderAppIcon);
}

(function initIconSystem() {
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'childList') {
                m.addedNodes.forEach(upgradeIconsIn);
            } else if (m.type === 'attributes' && m.target.tagName === 'I') {
                // className swapped on an existing icon (e.g. the transfer confirm button)
                renderAppIcon(m.target);
            }
        }
    });
    observer.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    upgradeIconsIn(document.body || document.documentElement);
    document.addEventListener('DOMContentLoaded', () => upgradeIconsIn(document.body));
})();
