/**
 * Domain: the entities of Lifestyle and how they relate. JSDoc types (editors and type-checkers read them);
 * the runtime rules for each live in scripts/domain/validation.js.
 *
 * Conventions for every entity:
 *  - `id` is a stable string primary key, chosen by the app (never a provider document path).
 *  - Relations are ids (`siteId`, `employeeId`), never copied names or addresses.
 *  - Dates are 'YYYY-MM-DD' (a calendar day, no time zone), times 'HH:MM' (24h), timestamps ISO 8601 UTC.
 *  - Statuses are values from scripts/domain/enums.js.
 *  - Permanent data (sites, employees, cost codes, equipment) is archived, never deleted, so historical
 *    records keep resolving. Transactional records (timesheets, roster, crew logs, leave) refer to it.
 *  - Derived values (net hours, totals, names) are calculated from these records, not stored on them.
 *
 * Relationships (→ = references by id):
 *   RosterAssignment → Employee, Site
 *   Timesheet        → Employee, Site; owns TimesheetBlock[] → CostCode
 *   CrewLog          → Employee (when known), Site; owns TimesheetBlock[]
 *   Attendance       → Employee (when known), Site
 *   SiteLog          → Site, Employee (author)
 *   Drawing          → Site
 *   SitePhoto        → Site, Employee (taken by), SiteLog (when attached to one)
 *   Tool             → Site (where it is), Site (move requested to)
 *   LeaveRequest     → Employee (requester), Employee (decided by)
 *   LeaveBalance     → Employee
 *   AuditEntry       → any entity, Employee (actor)
 */

/**
 * @typedef {Object} Site
 * @property {string} id                 stable key ('lugarno')
 * @property {string} shortName          display name ('Lugarno')
 * @property {string} address            street line ('935 Forest Road')
 * @property {string} suburb             ('Lugarno')
 * @property {boolean} active            false = archived: hidden from pickers, still resolvable
 * @property {string} [icon]             Font Awesome class used by the transfer picker
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Employee
 * @property {string} id                 ('team-1')
 * @property {string} name               full name as it appears everywhere ('Alexander Floratos')
 * @property {string} role               job title ('Apprentice')
 * @property {string} category           job category, lower case ('apprentice') - drives the permission role
 * @property {string} initials
 * @property {?string} birthday          'D Mon' (no year), or null
 * @property {string} phone
 * @property {string} email
 * @property {string} status             EmployeeStatus
 * @property {boolean} active
 */

/**
 * @typedef {Object} RosterAssignment
 * @property {string} id
 * @property {string} date               'YYYY-MM-DD'
 * @property {string} employeeId
 * @property {string} siteId
 * Unique: (date, employeeId) - one site per employee per day.
 */

/**
 * @typedef {Object} TimesheetBlock
 * @property {string} id
 * @property {string} code               CostCode.code
 * @property {string} start              'HH:MM'
 * @property {string} finish             'HH:MM' (earlier than start = runs overnight)
 * @property {number} breakMins          unpaid break inside this block
 * @property {string} task               what was done
 */

/**
 * @typedef {Object} Timesheet
 * @property {string} id                 ('TS-team-1-2026-11-13')
 * @property {string} date               'YYYY-MM-DD'
 * @property {string} employeeId
 * @property {string} siteId
 * @property {string} siteAssignmentType SiteAssignmentType
 * @property {string} status             TimesheetStatus
 * @property {TimesheetBlock[]} blocks
 * @property {?string} submittedAt
 * @property {?string} approvedAt
 * @property {?string} approvedBy        employeeId
 * @property {string} createdAt
 * @property {string} updatedAt
 * Unique: (date, employeeId) - one timesheet per employee per day; resubmitting updates it.
 */

/**
 * @typedef {Object} CrewLog
 * @property {string} id
 * @property {string} date
 * @property {?string} employeeId        null for labour hire not in the directory
 * @property {string} name               the person as logged (labour hire has no employee record)
 * @property {string} siteId
 * @property {TimesheetBlock[]} blocks
 */

/**
 * @typedef {Object} Attendance          a site sign-in: one record per person per day
 * @property {string} id
 * @property {string} date               the day signed in for ('YYYY-MM-DD')
 * @property {?string} employeeId        null for labour hire not in the directory
 * @property {string} name               the person as signed in (labour hire has no employee record)
 * @property {string} siteId
 * @property {string} signedInAt         timestamp of the (latest) sign-in
 * @property {?string} signedOutAt       null while on site
 * Unique: (date, employeeId) for directory staff. Signing in again that day reopens the record.
 */

/**
 * @typedef {Object} SiteLog             a daily site log entry: what happened on site
 * @property {string} id
 * @property {string} siteId
 * @property {string} date               the day it describes
 * @property {string} title
 * @property {string} body
 * @property {?string} authorId          employeeId
 * @property {string} authorName         as written (an author may later leave the directory)
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Drawing             the current revision of a drawing sheet
 * @property {string} id
 * @property {string} siteId
 * @property {string} sheet              sheet number ('A102')
 * @property {string} title
 * @property {string} discipline         'Architectural', 'Structural', ...
 * @property {string} revision           'C'
 * @property {string} updatedOn          the day this revision was issued
 */

/**
 * @typedef {Object} SitePhoto
 * @property {string} id
 * @property {string} siteId
 * @property {string} date               the day it was taken
 * @property {string} caption
 * @property {string} tag                a category label ('Progress', 'Defect', ...)
 * @property {string} src                the image (a URL, or a data URL from the device)
 * @property {?string} logId             the site log it is attached to
 * @property {?string} takenBy           employeeId
 * @property {string} createdAt
 */

/**
 * @typedef {Object} CostCode
 * @property {string} code               primary key ('006-1')
 * @property {string} title
 * @property {boolean} active
 */

/**
 * @typedef {Object} Tool
 * @property {string} id
 * @property {string} name
 * @property {string} siteId             where it is
 * @property {string} category
 * @property {string} status             ToolStatus
 * @property {number} [quantity]         bulk items (props)
 * @property {string} [unit]
 * @property {string} lastLogged         'D Mon by Name' as logged
 * @property {?string} moveRequestedToSiteId
 */

/**
 * @typedef {Object} LeaveRequest
 * @property {string} id
 * @property {string} employeeId
 * @property {string} type               LeaveType
 * @property {string} startDate
 * @property {string} endDate
 * @property {number} days
 * @property {string} status             LeaveStatus
 * @property {string} requestedAt
 * @property {?string} decidedAt
 * @property {?string} decidedBy
 */

/**
 * @typedef {Object} LeaveBalance
 * @property {string} employeeId         primary key
 * @property {number} annualDays
 * @property {number} personalDays
 */

/**
 * @typedef {Object} AuditEntry
 * @property {string} id
 * @property {string} entity             collection name ('timesheets')
 * @property {string} entityId
 * @property {string} action             AuditAction
 * @property {?string} actorId           employeeId
 * @property {string} at                 timestamp
 * @property {Object} [changes]
 */
