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
 *   SiteLog          → Site, Employee (author), ScheduleTrade[] (trade tags)
 *   SitePhoto        → Site, Employee (taken by), SiteLog (when attached to one), ScheduleTrade[] (trade tags)
 *   Tool             → Site (where it is), Site (move requested to), Employee (missing reported by)
 *   ScheduleTask     → Site, ScheduleTrade; owns its milestone checklist (items → Employee who ticked)
 *   EquipmentAllocation → Tool, Site (a quantity-tracked tool's units at one place in one status)
 *   Chat             → Site (a site group chat)
 *   ChatMessage      → Chat, Employee (sender), AvailabilityRequest (an availability card)
 *   AvailabilityRequest  → Tool, Site, Chat, ChatMessage, Employee (requester, responder, holder)
 *   AvailabilityResponse → AvailabilityRequest, Employee (responder)
 *   Notification     → Employee (recipient, actor), AvailabilityRequest, Chat, ChatMessage
 *   LeaveRequest     → Employee (requester), Employee (decided by)
 *   LeaveBalance     → Employee
 *   AuditEntry       → any entity, Employee (actor)
 */

/**
 * @typedef {Object} Site
 * @property {string} id                 stable key ('lugarno')
 * @property {string} [kind]             'site' (construction site, default) or 'factory' (the factory / office)
 * @property {string} shortName          display name ('Lugarno')
 * @property {string} address            street line ('935 Forest Road')
 * @property {string} suburb             ('Lugarno')
 * @property {boolean} active            false = archived: hidden from pickers, still resolvable
 * @property {string} [icon]             Font Awesome class used by the transfer picker
 * @property {string} [stage]            construction stage now ('Frame & Roof')
 * @property {string} [lockbox]          key safe code ('4829'); only sites with a key safe
 * @property {string} [accessNotes]      how to get in (the Site Hub's Site Access sheet)
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
 * @property {string} siteId             the day's site; on a split day, the first stint's site
 * @property {{siteId: string, start: string, end: string}[]} [stints]  a split day: each site with its
 *                                       hours ('HH:MM'), in order. Absent = siteId for the whole shift.
 * Unique: (date, employeeId) - one entry per employee per day (several sites = stints).
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
 * @property {string[]} tradeIds         the schedule trades the day's work was for (ScheduleTrade ids) - search tags
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
 * @property {string[]} tradeIds         the trades it shows (ScheduleTrade ids) - 'every plumbing photo'
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
 * @property {?string} siteId            individual: where it is - a site, or the factory (a Site of kind
 *                                       'factory'); null = unassigned. quantity: null (see allocations)
 * @property {string} category
 * @property {?string} status            ToolStatus (individual); null for quantity tracking
 * @property {string} [unit]
 * @property {string} lastLogged         'D Mon by Name' as logged
 * @property {?string} moveRequestedToSiteId
 * @property {string} [trackingType]    'individual' (default) or 'quantity' (identical units)
 * @property {?number} [totalQuantity]   quantity: every unit, out of service included
 * @property {string[]} [mergedIds]      quantity: per-unit record ids folded into this record (history)
 * @property {boolean} [needsReview]     migrated data that could not be reconciled with confidence
 * @property {?string} [missingReportedAt]   set when someone answers an availability request "Not here"
 * @property {?string} [missingReportedBy]   employeeId
 */

/**
 * @typedef {Object} ScheduleTrade        a trade on the site schedule (Formwork, Plumbing ...): its colour
 * @property {string} id
 * @property {string} name
 * @property {string} color              '#RRGGBB'
 * @property {string} [icon]
 */

/**
 * @typedef {Object} ScheduleTask         a booking on a site's schedule: a trade, what, where, from - to
 * @property {string} id
 * @property {string} siteId
 * @property {string} tradeId
 * @property {string} title
 * @property {string} [where]            area on site ('L2', 'Units 1-4')
 * @property {string} [crew]             the company or crew ('VoltEdge Electrical')
 * @property {string} [notes]            the scope of work
 * @property {string} [arrival]          arrival window ('7:00 AM – 3:30 PM', '8:00 – 9:00 AM')
 * @property {string} startDate
 * @property {string} endDate
 * @property {boolean} milestone         a milestone has a checklist to complete before it happens
 * @property {Array<{id, text, done, doneBy, doneByName, doneAt, note, requestedBy}>} [checklist]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} EquipmentAllocation  where a quantity-tracked tool's units are
 * @property {string} id
 * @property {string} toolId
 * @property {?string} siteId            null = location to confirm
 * @property {string} status             ToolStatus
 * @property {number} quantity           > 0; unique per (toolId, siteId, status)
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Chat                 a conversation the server knows about (the site group chats)
 * @property {string} id                 'chat-lugarno'
 * @property {string} name
 * @property {string} kind               'site' | 'channel' | 'direct' | 'ai'
 * @property {?string} siteId            the site a site group chat belongs to (one chat per site)
 */

/**
 * @typedef {Object} ChatMessage          a structured message in a chat
 * @property {string} id
 * @property {string} chatId
 * @property {string} type               ChatMessageType
 * @property {string} senderId           employeeId
 * @property {string} senderName
 * @property {string} [text]
 * @property {?string} requestId         AVAILABILITY_REQUEST: the request it shows. The card renders the
 *                                       request's current state; the message stores no copy of it.
 * @property {string} createdAt
 */

/**
 * @typedef {Object} AvailabilityRequest  "is this tool free?" asked of a tool's site. The one source of
 *                                       truth for the Tools card, the chat card and the notifications.
 * @property {string} id
 * @property {string} toolId
 * @property {string} siteId             the tool's site when asked (decided by the server, not the screen)
 * @property {string} chatId             that site's group chat
 * @property {string} messageId          the chat message that shows it
 * @property {string} requesterId
 * @property {string} requesterName
 * @property {string} [requesterNote]
 * @property {string} status             AvailabilityStatus
 * @property {?string} responderId       who set the current status
 * @property {?string} responderName
 * @property {?string} respondedAt
 * @property {?string} holderId          IN_USE: who has it (may move the ETA)
 * @property {?string} estimatedAvailableAt
 * @property {?string} idempotencyKey    one per submit; a retried submit returns the same request
 * @property {number} version            bumped on every change
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} expiresAt          PENDING becomes EXPIRED at this time (createdAt + 30 min)
 */

/**
 * @typedef {Object} AvailabilityResponse one answer or ETA change (audit history)
 * @property {string} id
 * @property {string} requestId
 * @property {string} responderId
 * @property {string} responderName
 * @property {string} responseType       AvailabilityResponseType
 * @property {?string} estimatedAvailableAt
 * @property {?string} previousEstimatedAvailableAt
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Notification         an in-app notification for one person
 * @property {string} id
 * @property {string} recipientId        employeeId
 * @property {string} type               NotificationType
 * @property {string} title
 * @property {string} body
 * @property {?string} actorId
 * @property {?string} requestId         deep link: the request, its chat and its message
 * @property {?string} chatId
 * @property {?string} messageId
 * @property {string} dedupeKey          unique per recipient: the same event never notifies twice
 * @property {string} createdAt
 * @property {?string} readAt
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
