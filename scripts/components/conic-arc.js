/**
 * Conic arc: an arc with an angular gradient - the start colour at 12 o'clock shading to the end colour at the
 * leading tip, stretched over however far the arc has run (as on the Apple Fitness rings). The Time screen's
 * rings (timesheets.js) and the progress ring (progress-ring.js) both draw with it.
 *
 * SVG has no conic gradient, so the arc is drawn as short butt-capped segments, each a step further along the
 * gradient, overlapping slightly so no seams show, with round caps as discs at both ends. Laps past one run
 * over the first from 12 o'clock. A blurred shadow disc sits under the leading tip: segments within its blur
 * are drawn after it, so the shadow only shows ahead of the tip (on the track, or on lap one in overtime).
 *
 *   conicArcSvg({ cx, cy, r, width, laps, colours: [from, to], step (laps per segment), shadowClass, shadowReach (laps) })
 *                                -> '<g class="ts-arc">…</g>' ('' for an empty arc)
 *   conicPolar(cx, cy, r, lapFraction) -> { x, y, deg }
 */
function conicPolar(cx, cy, r, lapFraction) {
    const a = (lapFraction * 360 - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), deg: lapFraction * 360 };
}
function conicHexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function conicMix(from, to, t) {
    const a = conicHexRgb(from), b = conicHexRgb(to);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}
function conicArcSvg(o) {
    const { cx, cy, r, width, laps, colours, step, shadowClass, shadowReach } = o;
    if (laps <= 0.001) return '';
    const at = p => conicMix(colours[0], colours[1], Math.min(1, p / laps));
    const pt = p => conicPolar(cx, cy, r, p);
    const disc = (p, fill, cls = '') => { const q = pt(p); return `<circle${cls ? ` class="${cls}"` : ''} cx="${q.x.toFixed(2)}" cy="${q.y.toFixed(2)}" r="${(width / 2).toFixed(2)}" fill="${fill}"/>`; };
    const overlap = 0.004;
    const segs = [];
    for (let lapStart = 0; lapStart < laps; lapStart += 1) {
        const lapEnd = Math.min(laps, lapStart + 1);
        for (let a = lapStart; a < lapEnd - 1e-6; a += step) {
            const b = Math.min(lapEnd, a + step);
            const bb = b < laps ? Math.min(b + overlap, lapStart + 1) : b;   // overlap into the next segment
            const p0 = pt(a), p1 = pt(bb);
            segs.push({ end: b, svg: `<path d="M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}A${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}" stroke="${at((a + b) / 2)}" stroke-width="${width}"/>` });
        }
    }
    const tipFrom = laps - shadowReach;
    let out = disc(0, colours[0]);
    let shadowDone = false;
    segs.forEach(s => {
        if (!shadowDone && s.end > tipFrom) { out += disc(laps, colours[1], shadowClass); shadowDone = true; }
        out += s.svg;
    });
    return `<g class="ts-arc">${out}${disc(laps, colours[1])}</g>`;
}
