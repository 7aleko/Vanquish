/**
 * Data access: the repository contracts. These are the ONLY way the rest of the app reads or writes data.
 * Any provider (the mock today; Supabase, Firebase or a REST API later) must implement every method listed
 * here, with the same arguments and the same returned shapes (the models in scripts/domain/models.js).
 * createDataProvider (scripts/data-access/provider.js) refuses a provider that doesn't.
 *
 * Rules for every implementation:
 *  - Every method is async (returns a Promise), even when the data is local.
 *  - Returned records are plain objects in the app's model shape - never a provider's row/document object -
 *    and are copies: changing them doesn't change stored data.
 *  - Failures are thrown as AppError (scripts/domain/errors.js); a provider translates its own errors.
 *  - Writes enforce the schemas (scripts/domain/validation.js), referential integrity and unique keys.
 *  - Archive, don't delete, permanent records (sites, employees, cost codes, equipment).
 *
 * Signatures (filter objects are all optional):
 *
 * sites
 *   list({ includeArchived = true })        -> Site[]
 *   getById(id)                             -> Site | null
 *   create({ id, shortName, address, suburb, icon }) -> Site      (CONFLICT if the id exists)
 *   update(id, changes)                     -> Site               (id can't change)
 *   archive(id) / restore(id)               -> Site
 * employees
 *   list()                                  -> Employee[]
 *   getById(id)                             -> Employee | null
 * roster
 *   list({ employeeId, siteId, from, to })  -> RosterAssignment[]
 *   getForEmployeeOnDate(employeeId, date)  -> RosterAssignment | null
 *   assign({ date, employeeId, siteId })    -> RosterAssignment   (replaces that employee's entry that day)
 *   remove(id)                              -> void
 * timesheets
 *   list({ employeeId, from, to, status })  -> Timesheet[]
 *   getById(id)                             -> Timesheet | null
 *   getForEmployeeOnDate(employeeId, date)  -> Timesheet | null
 *   create(timesheet)                       -> Timesheet          (CONFLICT if that employee has one that day)
 *   update(id, changes)                     -> Timesheet
 * crewLogs
 *   list({ date, siteId, from, to })        -> CrewLog[]
 * attendance
 *   list({ date, siteId, employeeId })      -> Attendance[]
 *   signIn({ date, employeeId, siteId })    -> Attendance         (reopens that employee's record for the day)
 *   signOut(id)                             -> Attendance         (CONFLICT if already signed out)
 * siteLogs
 *   list({ siteId })                        -> SiteLog[]
 *   create({ siteId, date, title, body, authorId }) -> SiteLog
 * drawings
 *   list({ siteId })                        -> Drawing[]
 *   create({ siteId, sheet, title, discipline, revision, updatedOn }) -> Drawing   one record per (siteId, sheet):
 *                                              a new revision of an existing sheet replaces it; the same
 *                                              revision again is a CONFLICT
 * sitePhotos
 *   list({ siteId, logId })                 -> SitePhoto[]
 *   create({ siteId, date, caption, tag, src, logId, takenBy }) -> SitePhoto
 * costCodes
 *   list()                                  -> CostCode[]
 * equipment                                 individual tools carry siteId + status; quantity-tracked tools
 *                                            (trackingType 'quantity') carry totalQuantity and keep their units
 *                                            in allocation buckets, unique per (toolId, siteId, status), whose
 *                                            quantities are positive and add up to totalQuantity
 *   list()                                  -> Tool[]
 *   getById(id)                             -> Tool | null
 *   create(tool)                            -> Tool    (individual: status defaults to Available; quantity:
 *                                              { totalQuantity, initialAllocation: { siteId, status } })
 *   update(id, changes)                     -> Tool    (details only: trackingType / totalQuantity are fixed)
 *   listAllocations({ toolId })             -> EquipmentAllocation[]
 *   moveUnits(toolId, { from: { siteId, status }, to: { siteId, status }, quantity })
 *                                           -> { tool, allocations }  atomic: CONFLICT when the source bucket
 *                                              holds fewer than `quantity`; VALIDATION for a bad quantity
 * leave
 *   listRequests({ employeeId, status })    -> LeaveRequest[]
 *   getRequest(id)                          -> LeaveRequest | null
 *   createRequest(request)                  -> LeaveRequest
 *   updateRequest(id, changes)              -> LeaveRequest
 *   getBalance(employeeId)                  -> LeaveBalance | null
 *   updateBalance(employeeId, changes)      -> LeaveBalance
 * chats
 *   list()                                  -> Chat[]
 *   getForSite(siteId)                      -> Chat | null       (the site's group chat)
 * chatMessages
 *   list({ chatId })                        -> ChatMessage[]
 * availability                              (server functions: a real backend runs each as one RPC /
 *                                            database function that reads the caller from its auth session)
 *   listRequests({ toolId, siteId })        -> AvailabilityRequest[]
 *   getRequest(id)                          -> AvailabilityRequest | null
 *   listResponses({ requestId })            -> AvailabilityResponse[]
 *   createRequest({ toolId, requesterId, note, idempotencyKey, siteId, quantity })
 *                                           -> { request, message, replayed }  creates the request and its
 *                                              chat message together. CONFLICT while the tool has an active
 *                                              request (one per tool); VALIDATION when the tool's site is
 *                                              inactive or has no group chat. A repeated idempotencyKey
 *                                              returns the first request (replayed: true).
 *   respond(id, { responderId, responseType, estimatedAvailableAt, canOverride })
 *                                           -> { request, response, tool, unchanged }  compare-and-set: only
 *                                              a PENDING request takes a first answer; then only its holder
 *                                              (or canOverride) may change it. CONFLICT otherwise / expired.
 *                                              Updates the tool and appends the response history.
 *   expireDue()                             -> AvailabilityRequest[]   pending requests past expiresAt -> expired
 * notifications
 *   list({ recipientId })                   -> Notification[]
 *   createMany(notifications)               -> Notification[]    (unique per recipient + dedupeKey: repeats skipped)
 *   markRead(id, recipientId)               -> Notification      (PERMISSION_DENIED for someone else's)
 *   markAllRead(recipientId)                -> Notification[]
 * audit
 *   record({ entity, entityId, action, actorId, changes }) -> AuditEntry
 *   list({ entity, entityId })              -> AuditEntry[]
 *
 * Provider level
 *   transaction(async (repos) => ...)       runs several writes atomically: all of them or none
 *   subscribe(fn) (optional)                fn(changedTables) when data changes elsewhere (realtime)
 *   name                                    'mock', 'supabase', ...
 */

const REPOSITORY_CONTRACTS = Object.freeze({
    sites: ['list', 'getById', 'create', 'update', 'archive', 'restore'],
    employees: ['list', 'getById'],
    roster: ['list', 'getForEmployeeOnDate', 'assign', 'remove'],
    timesheets: ['list', 'getById', 'getForEmployeeOnDate', 'create', 'update'],
    crewLogs: ['list'],
    attendance: ['list', 'signIn', 'signOut'],
    siteLogs: ['list', 'create'],
    drawings: ['list', 'create'],
    sitePhotos: ['list', 'create'],
    costCodes: ['list'],
    equipment: ['list', 'getById', 'create', 'update', 'listAllocations', 'moveUnits'],
    leave: ['listRequests', 'getRequest', 'createRequest', 'updateRequest', 'getBalance', 'updateBalance'],
    chats: ['list', 'getForSite'],
    chatMessages: ['list'],
    availability: ['listRequests', 'getRequest', 'listResponses', 'createRequest', 'respond', 'expireDue'],
    notifications: ['list', 'createMany', 'markRead', 'markAllRead'],
    audit: ['record', 'list']
});

// Throws when a provider is missing a repository or a method
function assertImplementsContracts(provider) {
    const missing = [];
    Object.keys(REPOSITORY_CONTRACTS).forEach(repo => {
        REPOSITORY_CONTRACTS[repo].forEach(method => {
            if (!provider[repo] || typeof provider[repo][method] !== 'function') missing.push(`${repo}.${method}`);
        });
    });
    if (typeof provider.transaction !== 'function') missing.push('transaction');
    if (missing.length) throw new AppError(ErrorCode.UNKNOWN, `Data provider "${provider.name}" is missing: ${missing.join(', ')}`);
    return provider;
}
