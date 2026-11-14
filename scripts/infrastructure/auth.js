/**
 * Infrastructure: authentication boundary. Answers "who is signed in" for the rest of the app. Today a mock
 * session signed in as APP_CONFIG.auth.defaultEmployeeId; a real identity provider (Supabase Auth,
 * Firebase Auth, an OIDC login) replaces the body of createAuthSession without changing its interface.
 *
 * Interface:
 *   getCurrentUser()  -> { userId, employeeId } | null
 *   signInAs(employeeId)   mock only (development and tests)
 *   onChange(fn)      -> unsubscribe
 *
 * Signing in only establishes identity. What a user may do is decided by scripts/application/permissions.js
 * at the service boundary, and must be enforced again by the backend (never trust the browser alone).
 */

function createAuthSession(config) {
    let user = config.defaultEmployeeId ? { userId: `user-${config.defaultEmployeeId}`, employeeId: config.defaultEmployeeId } : null;
    const listeners = [];
    return {
        getCurrentUser: () => (user ? { ...user } : null),
        signInAs(employeeId) {
            if (config.provider !== 'mock') throw new AppError(ErrorCode.PERMISSION_DENIED, 'signInAs is only available with the mock auth provider');
            user = employeeId ? { userId: `user-${employeeId}`, employeeId } : null;
            listeners.slice().forEach(fn => fn(user));
        },
        onChange(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }
    };
}
