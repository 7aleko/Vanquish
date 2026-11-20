/**
 * Domain: controlled values. Every status, type and role the app stores is one of these - never a free
 * string typed at the call site. Frozen so nothing can add a value at runtime.
 *
 * Domain layer rule: no DOM, no UI, no storage, no provider SDK. Pure definitions only.
 */

// How a timesheet's site was arrived at
const SiteAssignmentType = Object.freeze({
    ROSTERED: 'rostered',       // the day's roster site
    OVERRIDE: 'override',       // a different site on a rostered day (shown as TRANSFERRED / SPLIT)
    UNROSTERED: 'unrostered'    // a site chosen on a day with no roster entry (shown as MANUAL)
});

const TimesheetStatus = Object.freeze({
    DRAFT: 'draft',
    SUBMITTED: 'submitted',     // awaiting sign-off
    APPROVED: 'approved',
    REJECTED: 'rejected'
});

// Values match the existing equipment data and UI labels
const ToolStatus = Object.freeze({
    AVAILABLE: 'Available',
    IN_USE: 'In Use',
    SERVICE: 'Service'
});

const EmployeeStatus = Object.freeze({
    ACTIVE: 'Active',
    ON_LEAVE: 'On Leave'
});

// Permission roles (what a user may do). Distinct from an employee's job title (Carpenter, Apprentice...).
const PermissionRole = Object.freeze({
    ADMIN: 'admin',                     // builder / administrator
    PROJECT_MANAGER: 'project_manager',
    SUPERVISOR: 'supervisor',
    EMPLOYEE: 'employee',               // employees and apprentices
    CONTRACTOR: 'contractor'            // external trade contractor
});

const LeaveType = Object.freeze({
    ANNUAL: 'annual',
    PERSONAL: 'personal'                // personal / sick
});

const LeaveStatus = Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
});

/** Equipment categories, in the order Tools & Gear lists them (id is stored on the Tool) */
const ToolCategories = Object.freeze([
    { id: 'power tools', label: 'Power Tools' },
    { id: 'access', label: 'Access' },
    { id: 'site', label: 'Site' },
    { id: 'safety', label: 'Safety' },
    { id: 'scaffolds', label: 'Scaffolds' }
].map(Object.freeze));

const AuditAction = Object.freeze({
    CREATE: 'create',
    UPDATE: 'update',
    ARCHIVE: 'archive',
    RESTORE: 'restore',
    SUBMIT: 'submit',
    APPROVE: 'approve',
    REJECT: 'reject',
    ASSIGN: 'assign',
    TRANSFER: 'transfer',
    REQUEST_MOVE: 'request_move',
    SIGN_IN: 'sign_in',
    SIGN_OUT: 'sign_out',
    REQUEST_AVAILABILITY: 'request_availability',
    RESPOND: 'respond',
    UPDATE_ETA: 'update_eta',
    EXPIRE: 'expire'
});

// An equipment availability request's state (AvailabilityRequest.status). PENDING waits for the site's
// first answer; IN_USE has a holder and an ETA the holder can move; AVAILABLE and MISSING resolve it;
// EXPIRED: nobody answered within the cooldown.
const AvailabilityStatus = Object.freeze({
    PENDING: 'pending',
    AVAILABLE: 'available',
    IN_USE: 'in_use',
    MISSING: 'missing',
    EXPIRED: 'expired'
});

// One answer in a request's history (AvailabilityResponse.responseType)
const AvailabilityResponseType = Object.freeze({
    AVAILABLE: 'available',
    IN_USE: 'in_use',
    MISSING: 'missing',
    ETA_UPDATED: 'eta_updated'
});

// Structured chat messages (ChatMessage.type). Plain text and photos still live in the chat seed.
const ChatMessageType = Object.freeze({
    TEXT: 'text',
    AVAILABILITY_REQUEST: 'availability_request'
});

// What a targeted notification is about (Notification.type)
const NotificationType = Object.freeze({
    AVAILABILITY_REQUEST: 'availability_request',
    AVAILABILITY_AVAILABLE: 'availability_available',
    AVAILABILITY_IN_USE: 'availability_in_use',
    AVAILABILITY_ETA_UPDATED: 'availability_eta_updated',
    AVAILABILITY_MISSING: 'availability_missing',
    AVAILABILITY_MISSING_ALERT: 'availability_missing_alert'
});

// Error categories shared by every layer (see scripts/domain/errors.js)
const ErrorCode = Object.freeze({
    VALIDATION: 'VALIDATION',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    NETWORK: 'NETWORK',
    UNKNOWN: 'UNKNOWN'
});
