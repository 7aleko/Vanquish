/**
 * Squircle surfaces (iOS continuous corners) for elements marked [data-squircle].
 *
 * CSS `corner-shape: squircle` only exists in recent Chromium, so Safari would show a plain rounded
 * rectangle. Instead each element gets an inline <svg class="squircle-shape"> behind its content: one path
 * with superellipse corners, rebuilt at the element's exact size (ResizeObserver), so the corners are never
 * stretched. The element's own fill and 1px edge come from CSS variables on the path (see the
 * [data-squircle] rules, e.g. styles/quick-actions.css), so :active / :hover can still restyle it.
 *
 *   data-squircle="24"   corner extent in px (default 24); capped at half the shorter side
 */

const SQUIRCLE_EXPONENT = 4;     // 2 = circular corner; ~4-5 = Apple's continuous curve
const SQUIRCLE_STEPS = 12;       // points per corner (plenty at tile size)

function squirclePath(w, h, r, inset) {
    const n = SQUIRCLE_EXPONENT;
    const R = Math.max(0, Math.min(r, w / 2 - inset, h / 2 - inset));
    const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
    const pts = [];
    // One corner: quarter superellipse around (cx, cy); sx/sy flip it into each corner
    const corner = (cx, cy, sx, sy, from, to) => {
        for (let i = 0; i <= SQUIRCLE_STEPS; i++) {
            const t = from + (to - from) * (i / SQUIRCLE_STEPS);
            const c = Math.cos(t), s = Math.sin(t);
            const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
            const py = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
            pts.push([cx + sx * Math.abs(px) * R, cy + sy * Math.abs(py) * R]);
        }
    };
    const H = Math.PI / 2;
    corner(x1 - R, y0 + R, 1, -1, H, 0);   // top-right: from top edge to right edge
    corner(x1 - R, y1 - R, 1, 1, 0, H);    // bottom-right
    corner(x0 + R, y1 - R, -1, 1, H, 0);   // bottom-left
    corner(x0 + R, y0 + R, -1, -1, 0, H);  // top-left
    return 'M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') + 'Z';
}

(function initSquircles() {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const shapes = new WeakMap();

    function draw(el) {
        const entry = shapes.get(el);
        if (!entry) return;
        const w = el.offsetWidth, h = el.offsetHeight;
        if (!w || !h || (entry.w === w && entry.h === h)) return;
        entry.w = w; entry.h = h;
        entry.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        // Inset by half the 1px edge so the stroke sits fully inside, like a CSS border
        entry.path.setAttribute('d', squirclePath(w, h, parseFloat(el.dataset.squircle) || 24, 0.5));
    }

    const ro = ('ResizeObserver' in window) ? new ResizeObserver(list => list.forEach(e => draw(e.target))) : null;

    function upgrade(el) {
        if (shapes.has(el)) return;
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'squircle-shape');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('preserveAspectRatio', 'none');
        const path = document.createElementNS(SVG_NS, 'path');
        svg.appendChild(path);
        el.prepend(svg);
        el.classList.add('has-squircle');
        shapes.set(el, { svg, path, w: 0, h: 0 });
        draw(el);
        if (ro) ro.observe(el);
    }

    const run = () => document.querySelectorAll('[data-squircle]').forEach(upgrade);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();
