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
        'sitePhotos.create': ALL_STAFF,
        'drawings.create': ALL_STAFF,
        'schedule.edit': ALL_STAFF,                      // book, change, copy, delete; milestone checklists
        'schedule.trades': [R.ADMIN, R.PROJECT_MANAGER, R.SUPERVISOR],   // edit the trade list
        'equipment.transfer': ALL_STAFF,
        'equipment.register': ALL_STAFF,
        'equipment.setStatus': ALL_STAFF,                // in use / available / out of service
        'equipment.requestAvailability': ALL_STAFF,
        'availability.respond': ALL_STAFF,               // and only as a member of the request's site (the service checks)
        'availability.override': [R.ADMIN, R.PROJECT_MANAGER, R.SUPERVISOR],   // answer for any site; correct an in-use hold
        'availability.respondOwn': [R.ADMIN],            // answer your own request (administrative override)
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
