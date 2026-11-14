/**
 * Application service: timesheets. The one implementation of submitting a day (new or updated), approving
 * and rejecting. Screens collect the form and call these; they never save a timesheet themselves.
 */

function createTimesheetService(kit) {
    const { provider, store } = kit;

    /**
     * Submit (or resubmit) a day.
     * @param {{ date: string, employeeId?: string, siteId: string, blocks: Array }} input
     * @returns {Promise<Timesheet>} the saved record
     */
    async function submit(input) {
        const who = kit.actor();
        const employeeId = input.employeeId || who.id;
        Permissions.assert(who, employeeId === who.id ? 'timesheets.submitOwn' : 'timesheets.submitForOthers');

        // Validate (the same rules the editor shows live)
        const errors = [];
        if (!DateRules.isIsoDate(input.date)) errors.push({ field: 'date', message: 'must be a YYYY-MM-DD date' });
        else if (!TimesheetRules.isSubmittableDate(input.date, kit.todayIso())) errors.push({ field: 'date', message: 'hasn\'t started yet' });
        const existing = store.get('timesheets').find(t => t.employeeId === employeeId && t.date === input.date) || null;
        const site = store.get('sites').find(s => s.id === input.siteId);
        // A new day needs an active site; a day already logged at a since-archived site may keep it
        if (!site || (!site.active && !(existing && existing.siteId === site.id))) errors.push({ field: 'siteId', message: 'Choose the site you worked at' });
        TimesheetRules.blocksErrors(input.blocks, store.get('costCodes'))
            .forEach(e => errors.push({ field: `blocks[${e.index}]`, message: e.message }));
        if (errors.length) throw appErrors.validation('Timesheet is invalid', errors, 'Check the highlighted lines and try again.');

        // The assignment is decided here from the roster, not taken from the screen
        const rostered = store.get('roster').find(r => r.employeeId === employeeId && r.date === input.date);
        const siteAssignmentType = TimesheetRules.assignmentType(rostered ? rostered.siteId : null, input.siteId);
        if (existing && !TimesheetRules.canTransition(existing.status, TimesheetStatus.SUBMITTED)) {
            throw appErrors.conflict(`Timesheet ${existing.id} can't be resubmitted from ${existing.status}`);
        }
        const now = new Date().toISOString();
        const blocks = input.blocks.map((b, i) => ({
            id: b.id || `blk-${i + 1}`, code: b.code, start: b.start, finish: b.finish,
            breakMins: Number(b.breakMins) || 0, task: String(b.task || '').trim()
        }));
        const fields = {
            siteId: input.siteId, siteAssignmentType, blocks,
            status: TimesheetStatus.SUBMITTED, submittedAt: now, approvedAt: null, approvedBy: null
        };

        // Save the day and its audit entry together
        const saved = await provider.transaction(async repos => {
            const current = await repos.timesheets.getForEmployeeOnDate(employeeId, input.date);
            const record = current
                ? await repos.timesheets.update(current.id, fields)
                : await repos.timesheets.create({ id: `TS-${employeeId}-${input.date}`, date: input.date, employeeId, ...fields });
            await kit.audit(repos, 'timesheets', record.id, AuditAction.SUBMIT, who.id,
                { siteId: record.siteId, siteAssignmentType, hours: TimeRules.sumHours(record.blocks) });
            return record;
        });
        store.upsert('timesheets', saved);
        return saved;
    }

    async function decide(timesheetId, toStatus, action) {
        const who = kit.actor();
        Permissions.assert(who, 'timesheets.approve');
        const current = store.get('timesheets').find(t => t.id === timesheetId);
        if (!current) throw appErrors.notFound('Timesheet', timesheetId);
        if (current.employeeId === who.id) throw appErrors.permission('timesheets.approveOwn');
        if (!TimesheetRules.canTransition(current.status, toStatus)) throw appErrors.conflict(`Can't ${action} a ${current.status} timesheet`);
        const saved = await provider.transaction(async repos => {
            const changes = toStatus === TimesheetStatus.APPROVED
                ? { status: toStatus, approvedAt: new Date().toISOString(), approvedBy: who.id }
                : { status: toStatus, approvedAt: null, approvedBy: null };
            const record = await repos.timesheets.update(timesheetId, changes);
            await kit.audit(repos, 'timesheets', timesheetId, action, who.id);
            return record;
        });
        store.upsert('timesheets', saved);
        return saved;
    }

    return Object.freeze({
        submit,
        approve: id => decide(id, TimesheetStatus.APPROVED, AuditAction.APPROVE),
        reject: id => decide(id, TimesheetStatus.REJECTED, AuditAction.REJECT)
    });
}
