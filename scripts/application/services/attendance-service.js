/**
 * Application service: attendance. Signing the current employee in at a site and out again (the Home site
 * card's Sign In / Sign Out). Every sign-in and sign-out is one record per person per day (Attendance,
 * scripts/domain/models.js), timestamped by the provider, audited, and put in the cache so the Home card
 * and the Crew Status sheet update together.
 *
 * The day is passed in by the screen (the Home card's day), not taken from the service clock: Home and
 * Timesheets run on different demo days.
 */

function createAttendanceService(kit) {
    const { provider, store } = kit;

    // The employee's record for `date`, or null
    function recordFor(employeeId, date) {
        return store.get('attendance').find(a => a.date === date && a.employeeId === employeeId) || null;
    }

    async function signIn({ siteId, date }) {
        const who = kit.actor();
        Permissions.assert(who, 'attendance.recordOwn');
        const errors = [];
        if (!DateRules.isIsoDate(date)) errors.push({ field: 'date', message: 'is required' });
        const site = store.get('sites').find(s => s.id === siteId);
        if (!site) errors.push({ field: 'siteId', message: 'choose a site' });
        else if (!site.active) errors.push({ field: 'siteId', message: 'is archived' });
        if (errors.length) throw appErrors.validation('Sign in is invalid', errors, 'Choose an active site to sign in to.');

        const open = recordFor(who.id, date);
        if (open && !open.signedOutAt) {
            if (open.siteId === siteId) return open;                   // already signed in here
            throw appErrors.conflict(`Already signed in at ${open.siteId}`, 'Sign out of your other site first.');
        }
        const saved = await provider.transaction(async repos => {
            const a = await repos.attendance.signIn({ date, employeeId: who.id, siteId });
            await kit.audit(repos, 'attendance', a.id, AuditAction.SIGN_IN, who.id);
            return a;
        });
        store.upsert('attendance', saved);
        return saved;
    }

    async function signOut({ date }) {
        const who = kit.actor();
        Permissions.assert(who, 'attendance.recordOwn');
        const open = recordFor(who.id, date);
        if (!open || open.signedOutAt) throw appErrors.conflict('Not signed in', 'You are not signed in.');
        const saved = await provider.transaction(async repos => {
            const a = await repos.attendance.signOut(open.id);
            await kit.audit(repos, 'attendance', a.id, AuditAction.SIGN_OUT, who.id);
            return a;
        });
        store.upsert('attendance', saved);
        return saved;
    }

    return Object.freeze({ signIn, signOut });
}
