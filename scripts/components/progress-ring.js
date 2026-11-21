/**
 * Progress ring (styles/progress-ring.css): a checklist's done / total as a chunky angular-gradient ring - the Time
 * screen's ring (scripts/components/conic-arc.js: deep colour at 12 o'clock shading to the bright tip, round caps,
 * a shadow under the tip) - with the count in the middle. The Site Hub's milestone card and the Schedule's
 * milestone cards and booking sheet draw it from the same record, so they always agree.
 *
 *   renderProgressRing({ done, total }, { size, stroke, key, tone })  -> HTML; a complete ring shows a checkmark
 *                                       on a soft emerald fill instead of "10/10"
 *   animateProgressRings(root)          after inserting it: each ring eases from the value and tone it last showed
 *                                       (by `key`) to its own. A ring that closes (.is-celebrating) runs the
 *                                       completion: arc closes and turns emerald (0-300ms), the count shrinks away
 *                                       and the check springs in with a glow pulse (from 250ms). One that reopens
 *                                       (.is-reopening) trades the check back for the count.
 *   progressRingTone(statusKey)         a milestone's status (ScheduleRules.milestoneStatus) -> its tone
 *   replayProgressRings(root, delay)    a page opening (navigation.js): its rings fill again from empty
 *   lightProgressCard(card, tone)       a card lit by its ring (.ring-lit): a bloom behind the ring and a
 *                                       directional edge highlight, in the tone's colour, easing between tones
 *
 * Tone says what the progress means, not the brand: 'progress' amber -> gold (under way), 'complete' emerald ->
 * mint (every item done; the Time screen's pair), 'overdue' crimson -> coral (past due, not done - it wins over
 * progress). With no tone given, a full ring is 'complete' and anything else 'progress'.
 */
const PROGRESS_RING_PALETTE = Object.freeze({
    progress: { colours: ['#D97706', '#FBBF24'], rgb: '245, 158, 11' },
    complete: { colours: ['#0D4A38', '#1ED796'], rgb: '30, 215, 150' },
    overdue:  { colours: ['#B91C1C', '#FB7185'], rgb: '244, 63, 94' }
});
const PROGRESS_RING_TONES = Object.freeze({ ready: 'complete', track: 'progress', risk: 'progress', overdue: 'overdue' });
function progressRingTone(statusKey) { return PROGRESS_RING_TONES[statusKey] || 'progress'; }

// key -> what it last showed: { ratio, tone, from, fromTone, at, entering }. Rings drawn for one key in the same burst
// (the Schedule's card and its open sheet, the Site Hub's card) all start from where the first one started.
const progressRingShown = new Map();
const PROGRESS_RING_BURST_MS = 150;
// A page opening (replayProgressRings): rings drawn within this window are part of its entrance
let progressRingEntrance = null;                 // { at, start }
const PROGRESS_RING_ENTRANCE_MS = 300;
function progressRingArc(size, stroke, tone, ratio, colours) {
    const c = size / 2, pal = PROGRESS_RING_PALETTE[tone] || PROGRESS_RING_PALETTE.progress;
    return conicArcSvg({ cx: c, cy: c, r: (size - stroke) / 2, width: stroke, laps: Math.max(0, Math.min(1, ratio)),
        colours: colours || pal.colours, step: 1 / 72, shadowClass: 'pring-tip', shadowReach: 0.09 });
}
function progressRingRgbMix(a, b, t) {
    const x = a.split(',').map(Number), y = b.split(',').map(Number);
    return x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(', ');
}
// The check that replaces the count once every item is done
const PROGRESS_RING_CHECK = '<svg class="pring-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.8"/></svg>';
function renderProgressRing(p, opts = {}) {
    const size = opts.size || 56, stroke = opts.stroke || 7;
    const done = p.done || 0, total = p.total || 0, ratio = total ? done / total : 0;
    const complete = total > 0 && done === total;
    const tone = PROGRESS_RING_PALETTE[opts.tone] ? opts.tone : (complete ? 'complete' : 'progress');
    const key = opts.key || '', prev = key ? progressRingShown.get(key) : null;
    const burst = prev && performance.now() - prev.at < PROGRESS_RING_BURST_MS && !prev.entering;
    // The page opening (replayProgressRings): the ring fills from empty in its own tone
    const now = performance.now();
    const entrance = progressRingEntrance && now - progressRingEntrance.at < PROGRESS_RING_ENTRANCE_MS ? progressRingEntrance.start : 0;
    const entering = !!entrance;
    const from = entering ? 0 : prev ? (burst ? prev.from : prev.ratio) : 0;
    const fromTone = entering ? tone : prev ? (burst ? prev.fromTone : prev.tone) : tone;
    // Closing the ring (the last item ticked) or reopening it (one unticked): the count and the check trade places
    const state = entering ? ' is-entering'
        : prev && complete && from < 0.9999 ? ' is-celebrating' : prev && !complete && from >= 0.9999 ? ' is-reopening' : '';
    const c = size / 2;
    return `<span class="pring is-${tone}${complete ? ' is-done' : ''}${state}" style="--size:${size}px;--pring-rgb:${PROGRESS_RING_PALETTE[fromTone].rgb}" data-key="${key}" data-to="${ratio.toFixed(4)}" data-from="${from.toFixed(4)}" data-size="${size}" data-stroke="${stroke}" data-tone="${tone}" data-from-tone="${fromTone}"${entering ? ` data-start="${entrance}"` : ''} role="img" aria-label="${complete ? `All ${total} complete` : `${done} of ${total} complete`}">
            <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
                <circle class="pring-fill" cx="${c}" cy="${c}" r="${Math.max(0, c - stroke)}"/>
                <circle class="pring-track" cx="${c}" cy="${c}" r="${(size - stroke) / 2}" stroke-width="${stroke}"/>
                <g class="pring-arc">${progressRingArc(size, stroke, fromTone, from)}</g>
            </svg>
            <span class="pring-value" aria-hidden="true"><b>${done}</b><span>/${total}</span></span>
            ${PROGRESS_RING_CHECK}
        </span>`;
}
// Each ring eases from where it was to its value, and from its last tone to its new one (amber -> emerald as it
// closes). Closing a ring is quick (300ms ease-out) so the check can land on it; other changes take a touch over
// half a second.
function animateProgressRings(root = document) {
    const rings = root.querySelectorAll ? root.querySelectorAll('.pring[data-to]') : [];
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rings.forEach(ring => {
        const to = Number(ring.dataset.to) || 0, from = Number(ring.dataset.from) || 0;
        const size = Number(ring.dataset.size), stroke = Number(ring.dataset.stroke), tone = ring.dataset.tone;
        const fromTone = PROGRESS_RING_PALETTE[ring.dataset.fromTone] ? ring.dataset.fromTone : tone;
        const arc = ring.querySelector('.pring-arc');
        const key = ring.dataset.key, prev = key && progressRingShown.get(key);
        const entering = ring.classList.contains('is-entering') && ring.dataset.start ? Number(ring.dataset.start) : 0;
        if (key && !(prev && prev.ratio === to && prev.tone === tone && performance.now() - prev.at < PROGRESS_RING_BURST_MS)) {
            progressRingShown.set(key, { ratio: to, tone, from, fromTone, at: performance.now(), entering });
        }
        if (!arc) return;
        const a = PROGRESS_RING_PALETTE[fromTone], b = PROGRESS_RING_PALETTE[tone];
        const settle = () => { arc.innerHTML = progressRingArc(size, stroke, tone, to); ring.style.setProperty('--pring-rgb', b.rgb); };
        if (reduce || (Math.abs(to - from) < 0.0005 && fromTone === tone)) { settle(); return; }
        cancelAnimationFrame(ring._raf);
        const duration = ring.classList.contains('is-celebrating') ? 300 : 560 + 300 * Math.abs(to - from);
        // Entering, it waits for its page to slide in; a complete ring's check lands as the arc closes
        const wait = entering ? Math.max(0, entering - performance.now()) : 0, t0 = performance.now() + wait;
        if (entering) {
            ring.style.setProperty('--pring-delay', `${Math.round(wait + (to >= 0.9999 ? duration * 0.72 : 120))}ms`);
            arc.innerHTML = progressRingArc(size, stroke, tone, from);
        }
        const step = now => {
            if (!ring.isConnected) return;
            if (now < t0) { ring._raf = requestAnimationFrame(step); return; }
            const t = Math.max(0, Math.min(1, (now - t0) / duration)), e = 1 - Math.pow(1 - t, 3);
            const colours = fromTone === tone ? null : [conicMixHex(a.colours[0], b.colours[0], e), conicMixHex(a.colours[1], b.colours[1], e)];
            arc.innerHTML = progressRingArc(size, stroke, tone, from + (to - from) * e, colours);
            if (fromTone !== tone) ring.style.setProperty('--pring-rgb', progressRingRgbMix(a.rgb, b.rgb, e));
            if (t < 1) ring._raf = requestAnimationFrame(step); else settle();
        };
        ring._raf = requestAnimationFrame(step);
    });
}
// A page opening: every ring in it replays from empty once `delay` ms have passed (the page sliding in), filling
// to its value; a complete one lands its check, with the glow pulse, as it closes. A page that draws its rings
// again as it opens (the Schedule does) carries the entrance on from where it is.
function replayProgressRings(root, delay = 0) {
    if (!root || !root.querySelectorAll) return;
    const now = performance.now(), start = now + delay;
    progressRingEntrance = { at: now, start };
    root.querySelectorAll('.pring[data-to]').forEach(ring => {
        cancelAnimationFrame(ring._raf);
        ring.dataset.from = '0';
        ring.dataset.fromTone = ring.dataset.tone;
        ring.dataset.start = String(start);
        ring.classList.remove('is-celebrating', 'is-reopening', 'is-entering');
        void ring.offsetWidth;                                // restart its CSS animations
        ring.classList.add('is-entering');
    });
    animateProgressRings(root);
}
// A card lit by its ring: sets the tone's colour; the bloom and edge highlight (progress-ring.css) ease to it
function lightProgressCard(card, tone) {
    if (!card) return;
    const pal = PROGRESS_RING_PALETTE[tone] || null;
    card.classList.add('ring-lit');
    card.classList.toggle('is-unlit', !pal);
    if (pal) {
        card.style.setProperty('--lit-bloom', `rgba(${pal.rgb}, 0.16)`);
        card.style.setProperty('--lit-edge', `rgba(${pal.rgb}, 0.28)`);
    }
}
