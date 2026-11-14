/**
 * Application services: shared plumbing. Every service is created with its dependencies passed in
 * ({ provider, store, session, clock }), so tests can hand it a fresh mock provider and nothing reaches for
 * a global database.
 *
 * Pattern for every change:
 *   1. who is acting (session) and may they (Permissions.assert)
 *   2. validate the input with domain rules
 *   3. persist through the repositories - inside provider.transaction when several records change
 *   4. record an audit entry in the same transaction
 *   5. put the saved records in the cache (store.upsert) - only after the provider accepted them
 *   6. return the saved record; throw AppError on any failure
 */

function createServiceKit({ provider, store, session, clock }) {
    function actor() {
        const user = session.getCurrentUser();
        if (!user) throw new AppError(ErrorCode.UNAUTHENTICATED, 'No signed-in user');
        const employee = store.get('employees').find(e => e.id === user.employeeId);
        if (!employee) throw new AppError(ErrorCode.UNAUTHENTICATED, `Signed-in employee ${user.employeeId} not found`);
        return employee;
    }
    function todayIso() { return DateRules.toIso(clock.today()); }
    function audit(repos, entity, entityId, action, actorId, changes) {
        return repos.audit.record({ entity, entityId, action, actorId, ...(changes ? { changes } : {}) });
    }
    return { provider, store, session, clock, actor, todayIso, audit };
}
