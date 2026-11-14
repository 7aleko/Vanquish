/**
 * Domain: one error type for every layer. Repositories, providers and services throw AppError (or have
 * theirs translated into one), so the UI can always tell what kind of failure happened and has a safe
 * sentence to show. `message` is technical (logs); `userMessage` is what a person may see. A provider's raw
 * error is kept on `cause` and never shown.
 */

class AppError extends Error {
    /**
     * @param {string} code        ErrorCode
     * @param {string} message     technical description
     * @param {Object} [opts]      { userMessage, details, cause }
     */
    constructor(code, message, opts = {}) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.userMessage = opts.userMessage || AppError.defaultUserMessage(code);
        this.details = opts.details || null;     // e.g. validation errors: [{ field, message }]
        this.cause = opts.cause || null;
    }

    static defaultUserMessage(code) {
        return {
            VALIDATION: 'Some details need fixing.',
            NOT_FOUND: 'That record no longer exists.',
            CONFLICT: 'Someone else changed this. Refresh and try again.',
            PERMISSION_DENIED: 'You don\'t have permission to do that.',
            UNAUTHENTICATED: 'Please sign in again.',
            NETWORK: 'Can\'t reach the server. Check your connection and try again.',
            UNKNOWN: 'Something went wrong. Please try again.'
        }[code] || 'Something went wrong. Please try again.';
    }
}

const appErrors = {
    validation: (message, details, userMessage) => new AppError(ErrorCode.VALIDATION, message, { details, userMessage }),
    notFound: (entity, id) => new AppError(ErrorCode.NOT_FOUND, `${entity} ${id} not found`),
    conflict: (message, userMessage) => new AppError(ErrorCode.CONFLICT, message, { userMessage }),
    permission: (action) => new AppError(ErrorCode.PERMISSION_DENIED, `Not permitted: ${action}`),
    network: (message, cause) => new AppError(ErrorCode.NETWORK, message, { cause })
};

// Any thrown value as an AppError (a provider's raw error becomes UNKNOWN, keeping the original as cause)
function toAppError(err) {
    if (err instanceof AppError) return err;
    return new AppError(ErrorCode.UNKNOWN, (err && err.message) || String(err), { cause: err });
}
