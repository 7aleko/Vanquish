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
 * costCodes
 *   list()                                  -> CostCode[]
 * equipment
 *   list()                                  -> Tool[]
 *   getById(id)                             -> Tool | null
 *   update(id, changes)                     -> Tool
 * leave
 *   listRequests({ employeeId, status })    -> LeaveRequest[]
 *   getRequest(id)                          -> LeaveRequest | null
 *   createRequest(request)                  -> LeaveRequest
 *   updateRequest(id, changes)              -> LeaveRequest
 *   getBalance(employeeId)                  -> LeaveBalance | null
 *   updateBalance(employeeId, changes)      -> LeaveBalance
 * audit
 *   record({ entity, entityId, action, actorId, changes }) -> AuditEntry
 *   list({ entity, entityId })              -> AuditEntry[]
 *
 * Provider level
 *   transaction(async (repos) => ...)       runs several writes atomically: all of them or none
 *   name                                    'mock', 'supabase', ...
 */

const REPOSITORY_CONTRACTS = Object.freeze({
    sites: ['list', 'getById', 'create', 'update', 'archive', 'restore'],
    employees: ['list', 'getById'],
    roster: ['list', 'getForEmployeeOnDate', 'assign', 'remove'],
    timesheets: ['list', 'getById', 'getForEmployeeOnDate', 'create', 'update'],
    crewLogs: ['list'],
    costCodes: ['list'],
    equipment: ['list', 'getById', 'update'],
    leave: ['listRequests', 'getRequest', 'createRequest', 'updateRequest', 'getBalance', 'updateBalance'],
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
