/**
 * Domain rules: a roster day. Pure functions.
 *
 * A roster entry is one employee on one day. Most days are one site for the whole shift; a split day lists
 * its stints in order - { siteId, start, end } - e.g. Lugarno 07:00-09:00, then Castlecrag 09:00-15:30.
 * The entry's siteId is always the first stint's site: where the day starts, and what Home, attendance and
 * Timesheets treat as "the rostered site".
 */

const RosterRules = (() => {
    const DEFAULT_SHIFT = Object.freeze({ start: '07:00', end: '15:30' });

    // A day's stints in order. An entry without stints is one stint at its site for the whole shift.
    function stintsOf(entry, shift = DEFAULT_SHIFT) {
        if (!entry) return [];
        if (Array.isArray(entry.stints) && entry.stints.length) {
            return entry.stints
                .map(s => ({ siteId: s.siteId, start: s.start, end: s.end }))
                .sort((a, b) => TimeRules.minutes(a.start) - TimeRules.minutes(b.start));
        }
        return [{ siteId: entry.siteId, start: shift.start, end: shift.end }];
    }

    // Problems with a split day's stints, as [{ field, message }] (empty = valid). Each stint ends after it
    // starts and stints don't overlap; a gap between them (travel, a break off site) is allowed.
    function validateStints(stints) {
        const errors = [];
        if (!Array.isArray(stints) || !stints.length) return [{ field: 'stints', message: 'needs at least one stint' }];
        const sorted = [...stints].sort((a, b) => (TimeRules.minutes(a.start) || 0) - (TimeRules.minutes(b.start) || 0));
        sorted.forEach((s, i) => {
            const at = `stints[${i}]`;
            if (!s || !s.siteId) errors.push({ field: `${at}.siteId`, message: 'is required' });
            if (!TimeRules.isTime(s && s.start)) errors.push({ field: `${at}.start`, message: 'must be HH:MM' });
            if (!TimeRules.isTime(s && s.end)) errors.push({ field: `${at}.end`, message: 'must be HH:MM' });
            else if (TimeRules.isTime(s.start) && TimeRules.minutes(s.end) <= TimeRules.minutes(s.start)) {
                errors.push({ field: `${at}.end`, message: 'must be after the start' });
            }
            const prev = sorted[i - 1];
            if (prev && TimeRules.isTime(prev.end) && TimeRules.isTime(s.start) && TimeRules.minutes(s.start) < TimeRules.minutes(prev.end)) {
                errors.push({ field: `${at}.start`, message: 'overlaps the stint before it' });
            }
        });
        return errors;
    }

    // The day's span: first start to last end
    function dayWindow(stints) {
        if (!stints.length) return null;
        return { start: stints[0].start, end: stints[stints.length - 1].end };
    }

    // More than one site that day (two stints at the same site, e.g. either side of a gap, are still one site)
    function isMultiSite(stints) { return new Set(stints.map(s => s.siteId)).size > 1; }

    // Do two time ranges share any time?
    function overlaps(a, b) {
        return TimeRules.minutes(a.start) < TimeRules.minutes(b.end) && TimeRules.minutes(b.start) < TimeRules.minutes(a.end);
    }

    return Object.freeze({ DEFAULT_SHIFT, stintsOf, validateStints, dayWindow, isMultiSite, overlaps });
})();
