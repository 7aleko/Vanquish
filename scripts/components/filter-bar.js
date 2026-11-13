/**
 * Horizontal category filter bar (styles/filter-bar.css): one active pill at a time.
 * Used by Tools & Gear (scripts/features/tools.js) and Team (scripts/features/team.js).
 */
function setActiveFilterPill(activePill) {
    if (!activePill) return;
    const bar = activePill.closest('.filter-bar');
    if (!bar) return;
    bar.querySelectorAll('.filter-pill').forEach(pill => {
        const on = pill === activePill;
        pill.classList.toggle('is-active', on);
        pill.setAttribute('aria-pressed', String(on));
    });
    // Keep the chosen pill fully on screen (it may sit past the edge of the scrolling row)
    const barRect = bar.getBoundingClientRect(), r = activePill.getBoundingClientRect();
    if (r.left < barRect.left + 20 || r.right > barRect.right - 20) {
        activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
}
