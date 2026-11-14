// Domain rules and schemas: pure functions, no data. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const plain = v => JSON.parse(JSON.stringify(v));      // objects from the app's context, compared as data
const { TimeRules, DateRules, PayRunRules, TimesheetRules, EquipmentRules, LeaveRules, SiteAssignmentType, TimesheetStatus, ToolStatus } = app;

test('net hours: a day block takes off its break', () => {
    assert.deepEqual(plain(TimeRules.computeShift('07:00', '15:30', 30)), { valid: true, net: 8, overnight: false });
});
test('net hours: overnight blocks and invalid blocks', () => {
    assert.equal(TimeRules.computeShift('22:00', '06:00', 0).net, 8);
    assert.equal(TimeRules.computeShift('22:00', '06:00', 0).overnight, true);
    assert.equal(TimeRules.computeShift('07:00', '07:00', 0).message, 'Finish time is the same as start');
    assert.equal(TimeRules.computeShift('07:00', '07:20', 30).message, 'Block is shorter than the lunch break');
    assert.equal(TimeRules.computeShift('', '15:30', 0).valid, false);
    assert.equal(TimeRules.computeShift('06:00', '23:00', 0).message, 'Block is over 16 hours — check the times');
});
test('total hours: sums only valid blocks', () => {
    const blocks = [
        { start: '07:00', finish: '11:00', breakMins: 0 },
        { start: '11:00', finish: '15:30', breakMins: 30 },
        { start: '09:00', finish: '09:00', breakMins: 0 }
    ];
    assert.equal(TimeRules.sumHours(blocks), 8);
});
test('dates: ISO round trip, validity and day differences', () => {
    assert.equal(DateRules.toIso(new Date(2026, 10, 3)), '2026-11-03');
    assert.equal(DateRules.isIsoDate('2026-02-30'), false);
    assert.equal(DateRules.isIsoDate('2026-11-13'), true);
    assert.equal(DateRules.dayDiff(new Date(2026, 9, 31), new Date(2026, 10, 2)), 2);
    assert.equal(DateRules.weekdaysBetween('2026-11-13', '2026-11-16'), 2);   // Fri + Mon
});
test('pay runs: fortnights from the anchor, ten workdays each', () => {
    const policy = { anchor: new Date(2026, 10, 2), lengthDays: 14 };
    assert.equal(DateRules.toIso(PayRunRules.startOf(new Date(2026, 10, 13), policy)), '2026-11-02');
    assert.equal(DateRules.toIso(PayRunRules.startOf(new Date(2026, 9, 25), policy)), '2026-10-19');
    assert.equal(PayRunRules.workdays(new Date(2026, 10, 13), policy).length, 10);
    assert.equal(PayRunRules.workdayIndex(new Date(2026, 10, 13), policy), 9);
    assert.equal(PayRunRules.workdayIndex(new Date(2026, 10, 14), policy), -1);   // Saturday
});
test('cost-coded blocks: each problem has its message', () => {
    const codes = [{ code: '006-1', title: 'Structural Framing', active: true }];
    const ok = { code: '006-1', start: '07:00', finish: '15:30', breakMins: 30, task: 'Framing' };
    assert.equal(TimesheetRules.blockError(ok, codes), '');
    assert.equal(TimesheetRules.blockError({ ...ok, code: '' }, codes), 'Choose a cost code');
    assert.equal(TimesheetRules.blockError({ ...ok, code: '999-9' }, codes), 'Choose a cost code');
    assert.equal(TimesheetRules.blockError({ ...ok, task: '  ' }, codes), 'Add a short task description');
    assert.equal(TimesheetRules.blocksErrors([], codes).length, 1);
});
test('site assignment: rostered, override (transferred / split) and unrostered', () => {
    assert.equal(TimesheetRules.assignmentType('lugarno', 'lugarno'), SiteAssignmentType.ROSTERED);
    assert.equal(TimesheetRules.assignmentType('lugarno', 'bondi'), SiteAssignmentType.OVERRIDE);
    assert.equal(TimesheetRules.assignmentType(null, 'bondi'), SiteAssignmentType.UNROSTERED);
    assert.equal(TimesheetRules.assignmentType('lugarno', null), null);
});
test('timesheet status transitions', () => {
    const S = TimesheetStatus;
    assert.ok(TimesheetRules.canTransition(null, S.SUBMITTED));
    assert.ok(TimesheetRules.canTransition(S.SUBMITTED, S.APPROVED));
    assert.ok(TimesheetRules.canTransition(S.APPROVED, S.SUBMITTED));     // editing sends it back for sign-off
    assert.ok(!TimesheetRules.canTransition(S.APPROVED, S.REJECTED));
    assert.ok(!TimesheetRules.canTransition(S.DRAFT, S.APPROVED));
    assert.ok(TimesheetRules.isSubmittableDate('2026-11-13', '2026-11-13'));
    assert.ok(!TimesheetRules.isSubmittableDate('2026-11-16', '2026-11-13'));
});
test('equipment transfer outcomes', () => {
    assert.equal(EquipmentRules.transferOutcome({ status: ToolStatus.SERVICE, siteId: 'a' }, 'b'), 'blocked');
    assert.equal(EquipmentRules.transferOutcome({ status: ToolStatus.IN_USE, siteId: 'a' }, 'b'), 'request');
    assert.equal(EquipmentRules.transferOutcome({ status: ToolStatus.AVAILABLE, siteId: 'a' }, 'b'), 'move');
    assert.equal(EquipmentRules.transferOutcome({ status: ToolStatus.AVAILABLE, siteId: 'a' }, 'a'), 'same');
});
test('leave counts working days only', () => {
    assert.equal(LeaveRules.daysRequested('2026-12-04', '2026-12-08'), 3);   // Fri, Mon, Tue
});
test('schemas: a valid timesheet passes, broken fields are listed', () => {
    const t = {
        id: 'TS-1', date: '2026-11-13', employeeId: 'team-1', siteId: 'lugarno', siteAssignmentType: 'rostered', status: 'submitted',
        blocks: [{ id: 'b1', code: '006-1', start: '07:00', finish: '15:30', breakMins: 30, task: 'x' }],
        submittedAt: null, approvedAt: null, approvedBy: null, createdAt: '2026-11-13T05:00:00.000Z', updatedAt: '2026-11-13T05:00:00.000Z'
    };
    assert.deepEqual(plain(app.validateAgainst(app.EntitySchemas.timesheet, t)), []);
    const bad = app.validateAgainst(app.EntitySchemas.timesheet, { ...t, date: '13/11/2026', status: 'done', blocks: [{ ...t.blocks[0], start: '7am' }] });
    assert.deepEqual(plain(bad.map(e => e.field).sort()), ['blocks[0].start', 'date', 'status']);
    assert.throws(() => app.assertValidEntity('timesheet', { ...t, siteId: '' }), err => err.code === 'VALIDATION');
});
