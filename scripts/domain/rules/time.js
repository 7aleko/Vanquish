/**
 * Domain rules: calendar days and working time. Pure functions - the one implementation of net hours, shift
 * validity and date arithmetic that every screen and service uses.
 */

const DateRules = (() => {
    const DAY_MS = 86400000;
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

    function isIsoDate(s) {
        if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
        const d = fromIso(s);
        return toIso(d) === s;
    }
    function toIso(date) {
        if (typeof date === 'string') return date;
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    function fromIso(iso) {
        const [y, m, d] = String(iso).split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
    // Whole days from a to b (DST-safe)
    function dayDiff(a, b) {
        return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
    }
    function isWeekend(d) { const g = d.getDay(); return g === 0 || g === 6; }
    function mondayOf(d) { const diff = (d.getDay() + 6) % 7; return addDays(d, -diff); }
    // Weekdays from start to end inclusive (dates or ISO strings)
    function weekdaysBetween(start, end) {
        const a = typeof start === 'string' ? fromIso(start) : start;
        const b = typeof end === 'string' ? fromIso(end) : end;
        let n = 0;
        for (let d = a; dayDiff(d, b) >= 0; d = addDays(d, 1)) if (!isWeekend(d)) n++;
        return n;
    }
    return Object.freeze({ isIsoDate, toIso, fromIso, startOfDay, addDays, dayDiff, isWeekend, mondayOf, weekdaysBetween });
})();

const TimeRules = (() => {
    const HHMM = /^\d{1,2}:\d{2}$/;
    const MAX_BLOCK_MINUTES = 16 * 60;

    function isTime(s) {
        if (typeof s !== 'string' || !HHMM.test(s)) return false;
        const [h, m] = s.split(':').map(Number);
        return h < 24 && m < 60;
    }
    function minutes(hhmm) {
        if (!HHMM.test(hhmm || '')) return null;
        const [h, m] = hhmm.split(':').map(Number);
        return h * 60 + m;
    }
    function fromMinutes(mins) {
        const m = ((mins % 1440) + 1440) % 1440;
        return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    }
    // Net hours for one block. A finish earlier than the start runs overnight; anything with no paid time
    // is invalid. Returns { valid, net, overnight, message }.
    function computeShift(start, finish, breakMins) {
        const s = minutes(start), f = minutes(finish);
        if (s === null || f === null) return { valid: false, net: 0, message: 'Enter a start and finish time' };
        if (s === f) return { valid: false, net: 0, message: 'Finish time is the same as start' };
        const overnight = f < s;
        const gross = (overnight ? f + 1440 : f) - s;
        const net = gross - (Number(breakMins) || 0);
        if (net <= 0) return { valid: false, net: 0, message: 'Block is shorter than the lunch break' };
        if (gross > MAX_BLOCK_MINUTES) return { valid: false, net: 0, message: 'Block is over 16 hours — check the times' };
        return { valid: true, net: Math.round(net / 60 * 100) / 100, overnight };
    }
    // Sum of each valid block's own net hours (each block already took off its own break)
    function sumHours(blocks) {
        return Math.round((blocks || []).reduce((sum, b) => {
            const s = computeShift(b.start, b.finish, b.breakMins);
            return sum + (s.valid ? s.net : 0);
        }, 0) * 100) / 100;
    }
    return Object.freeze({ isTime, minutes, fromMinutes, computeShift, sumHours });
})();
