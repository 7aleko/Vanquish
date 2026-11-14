/**
 * Application service: leave. Requesting leave and approving / rejecting a request. Approval takes the days
 * off the balance in the same transaction, so a request is never approved without its balance changing.
 */

function createLeaveService(kit) {
    const { provider, store } = kit;

    async function request({ type, startDate, endDate }) {
        const who = kit.actor();
        Permissions.assert(who, 'leave.request');
        const errors = [];
        if (!Object.values(LeaveType).includes(type)) errors.push({ field: 'type', message: 'choose a leave type' });
        if (!DateRules.isIsoDate(startDate)) errors.push({ field: 'startDate', message: 'is required' });
        if (!DateRules.isIsoDate(endDate)) errors.push({ field: 'endDate', message: 'is required' });
        if (!errors.length && endDate < startDate) errors.push({ field: 'endDate', message: 'is before the start' });
        const days = errors.length ? 0 : LeaveRules.daysRequested(startDate, endDate);
        if (!errors.length && !days) errors.push({ field: 'endDate', message: 'covers no working days' });
        const balance = store.get('leaveBalances').find(b => b.employeeId === who.id);
        if (!errors.length && balance && days > LeaveRules.balanceFor(type, balance)) errors.push({ field: 'days', message: 'is more than your balance' });
        if (errors.length) throw appErrors.validation('Leave request is invalid', errors, 'Check the dates and your balance.');

        const overlaps = store.get('leaveRequests').some(r => r.employeeId === who.id && r.status !== LeaveStatus.REJECTED &&
            r.startDate <= endDate && r.endDate >= startDate);
        if (overlaps) throw appErrors.conflict('Overlapping leave request', 'You already have leave on some of those days.');

        const saved = await provider.transaction(async repos => {
            const r = await repos.leave.createRequest({ employeeId: who.id, type, startDate, endDate, days, status: LeaveStatus.PENDING });
            await kit.audit(repos, 'leaveRequests', r.id, AuditAction.CREATE, who.id);
            return r;
        });
        store.upsert('leaveRequests', saved);
        return saved;
    }

    async function decide(requestId, toStatus, action) {
        const who = kit.actor();
        Permissions.assert(who, 'leave.approve');
        const req = store.get('leaveRequests').find(r => r.id === requestId);
        if (!req) throw appErrors.notFound('Leave request', requestId);
        if (req.employeeId === who.id) throw appErrors.permission('leave.approveOwn');
        if (req.status !== LeaveStatus.PENDING) throw appErrors.conflict(`Leave request ${requestId} is already ${req.status}`);
        const result = await provider.transaction(async repos => {
            const r = await repos.leave.updateRequest(requestId, { status: toStatus, decidedAt: new Date().toISOString(), decidedBy: who.id });
            let balance = null;
            if (toStatus === LeaveStatus.APPROVED) {
                const b = await repos.leave.getBalance(req.employeeId);
                if (b) {
                    const field = req.type === LeaveType.ANNUAL ? 'annualDays' : 'personalDays';
                    if (b[field] < req.days) throw appErrors.conflict('Insufficient leave balance', 'Not enough leave balance to approve this.');
                    balance = await repos.leave.updateBalance(req.employeeId, { [field]: Math.round((b[field] - req.days) * 10) / 10 });
                }
            }
            await kit.audit(repos, 'leaveRequests', requestId, action, who.id);
            return { request: r, balance };
        });
        store.upsert('leaveRequests', result.request);
        if (result.balance) store.upsert('leaveBalances', result.balance, 'employeeId');
        return result.request;
    }

    return Object.freeze({
        request,
        approve: id => decide(id, LeaveStatus.APPROVED, AuditAction.APPROVE),
        reject: id => decide(id, LeaveStatus.REJECTED, AuditAction.REJECT)
    });
}
