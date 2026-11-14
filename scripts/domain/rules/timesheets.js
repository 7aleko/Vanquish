/**
 * Domain rules: timesheets. What makes a block or a day valid, how a day's site assignment is classified,
 * which status changes are allowed and how a day is summarised. Pure functions over plain records.
 */

const TimesheetRules = (() => {
    const S = TimesheetStatus;

    // A block's first problem, as a sentence for the person filling it in ('' when it is fine)
    function blockError(block, costCodes) {
        if (!block.code) return 'Choose a cost code';
        if (costCodes && !costCodes.some(c => c.code === block.code)) return 'Choose a cost code';
        const s = TimeRules.computeShift(block.start, block.finish, block.breakMins);
        if (!s.valid) return s.message;
        if (!String(block.task || '').trim()) return 'Add a short task description';
        return '';
    }
    // Every problem with a day's blocks: [{ index, message }]
    function blocksErrors(blocks, costCodes) {
        if (!Array.isArray(blocks) || !blocks.length) return [{ index: -1, message: 'Add at least one time block' }];
        return blocks.map((b, index) => ({ index, message: blockError(b, costCodes) })).filter(e => e.message);
    }

    function assignmentType(rosteredSiteId, siteId) {
        if (!siteId) return null;
        if (rosteredSiteId === siteId) return SiteAssignmentType.ROSTERED;
        return rosteredSiteId ? SiteAssignmentType.OVERRIDE : SiteAssignmentType.UNROSTERED;
    }

    // Allowed status changes. Editing an approved or rejected day sends it back for sign-off.
    const TRANSITIONS = {
        [S.DRAFT]: [S.SUBMITTED],
        [S.SUBMITTED]: [S.SUBMITTED, S.APPROVED, S.REJECTED],
        [S.APPROVED]: [S.SUBMITTED],
        [S.REJECTED]: [S.SUBMITTED]
    };
    function canTransition(from, to) {
        if (!from) return to === S.SUBMITTED || to === S.DRAFT;
        return (TRANSITIONS[from] || []).includes(to);
    }

    // A day can be submitted once it has started (today counts)
    function isSubmittableDate(dateIso, todayIso) {
        return DateRules.dayDiff(DateRules.fromIso(dateIso), DateRules.fromIso(todayIso)) >= 0;
    }

    function totalHours(timesheet) { return TimeRules.sumHours(timesheet.blocks); }

    return Object.freeze({ blockError, blocksErrors, assignmentType, canTransition, isSubmittableDate, totalHours });
})();

/**
 * Domain rules: equipment. What a transfer does depends on the tool's status.
 */
const EquipmentRules = (() => {
    // 'blocked' (in service), 'request' (in use: ask for a move), 'move' (available: moves now), or 'same'
    function transferOutcome(tool, toSiteId) {
        if (tool.status === ToolStatus.SERVICE) return 'blocked';
        if (tool.siteId === toSiteId) return 'same';
        if (tool.status === ToolStatus.IN_USE) return 'request';
        return 'move';
    }
    function isBulk(tool) { return Boolean(tool.quantity && tool.quantity > 1); }
    return Object.freeze({ transferOutcome, isBulk });
})();

/**
 * Domain rules: leave.
 */
const LeaveRules = (() => {
    // Working days a request covers (weekends don't count)
    function daysRequested(startDate, endDate) {
        return DateRules.weekdaysBetween(startDate, endDate);
    }
    function balanceFor(type, balance) {
        return type === LeaveType.ANNUAL ? balance.annualDays : balance.personalDays;
    }
    return Object.freeze({ daysRequested, balanceFor });
})();
