/**
 * Application: who may do what. Services call Permissions.assert before every change, so a rule is enforced
 * no matter which screen triggers it (hiding a button is never the protection). A real backend must
 * enforce the same rules again (row-level security, server checks): the browser can be bypassed.
 */

const Permissions = (() => {
    const R = PermissionRole;
    // An employee's permission role, from their job category (until the backend stores roles itself)
    const ROLE_BY_CATEGORY = {
        'director': R.ADMIN,
        'project manager': R.PROJECT_MANAGER,
        'site supervisor': R.SUPERVISOR,
        'contractor': R.CONTRACTOR
    };
    const ALL_STAFF = [R.ADMIN, R.PROJECT_MANAGER, R.SUPERVISOR, R.EMPLOYEE];
    const RULES = Object.freeze({
        'sites.manage': [R.ADMIN, R.PROJECT_MANAGER],
        'roster.assign': [R.ADMIN, R.PROJECT_MANAGER, R.SUPERVISOR],
        'timesheets.submitOwn': ALL_STAFF,
        'timesheets.submitForOthers': [R.ADMIN, R.PROJECT_MANAGER, R.SUPERVISOR],
        'timesheets.approve': [R.ADMIN, R.PROJECT_MANAGER, R.SUPERVISOR],
        'attendance.recordOwn': ALL_STAFF,
        'siteLogs.create': ALL_STAFF,
        'equipment.transfer': ALL_STAFF,
        'equipment.register': ALL_STAFF,
        'leave.request': ALL_STAFF,
        'leave.approve': [R.ADMIN, R.PROJECT_MANAGER]
    });

    function roleOf(employee) {
        if (!employee) return null;
        return ROLE_BY_CATEGORY[String(employee.category || '').toLowerCase()] || R.EMPLOYEE;
    }
    function can(employee, action) {
        const role = roleOf(employee);
        return !!role && (RULES[action] || []).includes(role);
    }
    function assert(employee, action) {
        if (!employee) throw new AppError(ErrorCode.UNAUTHENTICATED, 'No signed-in user');
        if (!can(employee, action)) throw appErrors.permission(action);
    }
    return Object.freeze({ roleOf, can, assert, RULES });
})();
