/**
 * Domain rules: pay runs. A pay run is `lengthDays` long and starts on `anchor` and every `lengthDays`
 * after it. Pure functions; the policy (anchor, length) is passed in, not read from a global.
 */

const PayRunRules = (() => {
    const D = DateRules;

    /** @param {{ anchor: Date, lengthDays: number }} policy */
    function startOf(date, policy) {
        return D.addDays(policy.anchor, Math.floor(D.dayDiff(policy.anchor, date) / policy.lengthDays) * policy.lengthDays);
    }
    function endOf(date, policy) {
        return D.addDays(startOf(date, policy), policy.lengthDays - 1);
    }
    // Weekdays (Mon-Fri) of the pay run holding `date`
    function workdays(date, policy) {
        const start = startOf(date, policy), days = [];
        for (let i = 0; i < policy.lengthDays; i++) {
            const day = D.addDays(start, i);
            if (!D.isWeekend(day)) days.push(day);
        }
        return days;
    }
    // Position of `date` among its run's workdays (0 = first Monday), or -1 on a weekend
    function workdayIndex(date, policy) {
        if (D.isWeekend(date)) return -1;
        return workdays(date, policy).findIndex(w => D.dayDiff(w, date) === 0);
    }
    return Object.freeze({ startOf, endOf, workdays, workdayIndex });
})();
