/**
 * Progress ring (styles/progress-ring.css): a checklist's done / total as a chunky angular-gradient ring - the Time
 * screen's ring (scripts/components/conic-arc.js: deep colour at 12 o'clock shading to the bright tip, round caps,
 * a shadow under the tip) - with the count in the middle. The Site Hub's milestone card and the Schedule's
 * milestone cards and booking sheet draw it from the same record, so they always agree.
 *
 *   renderProgressRing({ done, total }, { size, stroke, key, tone })  -> HTML
 *   animateProgressRings(root)          after inserting it: each ring eases from the value it last showed (by
 *                                       `key`) to its own
 *   progressRingTone(statusKey)         a milestone's status (ScheduleRules.milestoneStatus) -> its tone
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

const progressRingShown = new Map();             // key -> the fraction it last showed
function progressRingArc(size, stroke, tone, ratio) {
    const c = size / 2, pal = PROGRESS_RING_PALETTE[tone] || PROGRESS_RING_PALETTE.progress;
    return conicArcSvg({ cx: c, cy: c, r: (size - stroke) / 2, width: stroke, laps: Math.max(0, Math.min(1, ratio)),
        colours: pal.colours, step: 1 / 72, shadowClass: 'pring-tip', shadowReach: 0.09 });
}
function renderProgressRing(p, opts = {}) {
    const size = opts.size || 56, stroke = opts.stroke || 7;
    const done = p.done || 0, total = p.total || 0, ratio = total ? done / total : 0;
    const key = opts.key || '', from = key && progressRingShown.has(key) ? progressRingShown.get(key) : 0;
    const complete = total > 0 && done === total;
    const tone = PROGRESS_RING_PALETTE[opts.tone] ? opts.tone : (complete ? 'complete' : 'progress');
    const c = size / 2;
    return `<span class="pring is-${tone}" style="--size:${size}px;--pring-rgb:${PROGRESS_RING_PALETTE[tone].rgb}" data-key="${key}" data-to="${ratio.toFixed(4)}" data-from="${from.toFixed(4)}" data-size="${size}" data-stroke="${stroke}" data-tone="${tone}" role="img" aria-label="${done} of ${total} complete">
            <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
                <circle class="pring-track" cx="${c}" cy="${c}" r="${(size - stroke) / 2}" stroke-width="${stroke}"/>
                <g class="pring-arc">${progressRingArc(size, stroke, tone, from)}</g>
            </svg>
            <span class="pring-value"><b>${done}</b><span>/${total}</span></span>
        </span>`;
}
// Each ring eases from where it was to its value (ease-out, a touch over half a second), redrawing its arc
function animateProgressRings(root = document) {
    const rings = root.querySelectorAll ? root.querySelectorAll('.pring[data-to]') : [];
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rings.forEach(ring => {
        const to = Number(ring.dataset.to) || 0, from = Number(ring.dataset.from) || 0;
        const size = Number(ring.dataset.size), stroke = Number(ring.dataset.stroke), tone = ring.dataset.tone;
        const arc = ring.querySelector('.pring-arc');
        if (ring.dataset.key) progressRingShown.set(ring.dataset.key, to);
        if (!arc) return;
        if (reduce || Math.abs(to - from) < 0.0005) { arc.innerHTML = progressRingArc(size, stroke, tone, to); return; }
        cancelAnimationFrame(ring._raf);
        const duration = 560 + 300 * Math.abs(to - from), t0 = performance.now();
        const step = now => {
            if (!ring.isConnected) return;
            const t = Math.max(0, Math.min(1, (now - t0) / duration));
            arc.innerHTML = progressRingArc(size, stroke, tone, from + (to - from) * (1 - Math.pow(1 - t, 3)));
            if (t < 1) ring._raf = requestAnimationFrame(step);
        };
        ring._raf = requestAnimationFrame(step);
    });
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
