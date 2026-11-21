/**
 * Domain: runtime schemas for every entity, and one validator. The mock provider checks every write against
 * these (as a database's constraints would), and services check inputs before calling a repository. A
 * future backend should enforce the same rules server-side; these are the shared contract.
 *
 * A field spec: { type, required, enum, min, max, nullable, items }.
 *   type: 'string' | 'id' | 'number' | 'boolean' | 'date' ('YYYY-MM-DD') | 'time' ('HH:MM')
 *         | 'timestamp' (ISO 8601) | 'array' | 'object'
 * Relationship checks (does that siteId exist?) need data, so they live in the repositories / services.
 */

const EntitySchemas = (() => {
    const block = {
        id: { type: 'id', required: true },
        code: { type: 'string', required: true },
        start: { type: 'time', required: true },
        finish: { type: 'time', required: true },
        breakMins: { type: 'number', required: true, min: 0, max: 240 },
        task: { type: 'string', required: true }
    };
    return Object.freeze({
        site: {
            id: { type: 'id', required: true },
            shortName: { type: 'string', required: true, min: 1 },
            address: { type: 'string', required: true },
            suburb: { type: 'string', required: true },
            active: { type: 'boolean', required: true },
            icon: { type: 'string' },
            kind: { type: 'string', enum: ['site', 'factory'] },
            stage: { type: 'string', max: 60 },                   // the construction stage now ('Frame & Roof')
            lockbox: { type: 'string', max: 12 },                 // key safe code
            accessNotes: { type: 'string', max: 500 },
            createdAt: { type: 'timestamp', required: true },
            updatedAt: { type: 'timestamp', required: true }
        },
        employee: {
            id: { type: 'id', required: true },
            name: { type: 'string', required: true, min: 1 },
            role: { type: 'string', required: true },
            category: { type: 'string', required: true },
            initials: { type: 'string' },
            birthday: { type: 'string', nullable: true },
            phone: { type: 'string' },
            email: { type: 'string' },
            status: { type: 'string', required: true, enum: Object.values(EmployeeStatus) },
            active: { type: 'boolean', required: true }
        },
        rosterAssignment: {
            id: { type: 'id', required: true },
            date: { type: 'date', required: true },
            employeeId: { type: 'id', required: true },
            siteId: { type: 'id', required: true },              // the first stint's site on a split day
            stints: { type: 'array', min: 1, items: {            // a split day: one per site, in order (RosterRules)
                siteId: { type: 'id', required: true },
                start: { type: 'time', required: true },
                end: { type: 'time', required: true }
            } }
        },
        timesheetBlock: block,
        timesheet: {
            id: { type: 'id', required: true },
            date: { type: 'date', required: true },
            employeeId: { type: 'id', required: true },
            siteId: { type: 'id', required: true },
            siteAssignmentType: { type: 'string', required: true, enum: Object.values(SiteAssignmentType) },
            status: { type: 'string', required: true, enum: Object.values(TimesheetStatus) },
            blocks: { type: 'array', required: true, min: 1, items: block },
            submittedAt: { type: 'timestamp', nullable: true },
            approvedAt: { type: 'timestamp', nullable: true },
            approvedBy: { type: 'id', nullable: true },
            createdAt: { type: 'timestamp', required: true },
            updatedAt: { type: 'timestamp', required: true }
        },
        crewLog: {
            id: { type: 'id', required: true },
            date: { type: 'date', required: true },
            employeeId: { type: 'id', nullable: true },
            name: { type: 'string', required: true },
            siteId: { type: 'id', required: true },
            blocks: { type: 'array', required: true, min: 1, items: block }
        },
        attendance: {
            id: { type: 'id', required: true },
            date: { type: 'date', required: true },
            employeeId: { type: 'id', nullable: true },
            name: { type: 'string', required: true },
            siteId: { type: 'id', required: true },
            signedInAt: { type: 'timestamp', required: true },
            signedOutAt: { type: 'timestamp', nullable: true }
        },
        siteLog: {
            id: { type: 'id', required: true },
            siteId: { type: 'id', required: true },
            date: { type: 'date', required: true },
            title: { type: 'string', required: true, min: 3, max: 120 },
            body: { type: 'string', max: 4000 },
            tradeIds: { type: 'array' },                          // schedule trade ids: what the day's work was for
            authorId: { type: 'id', nullable: true },
            authorName: { type: 'string', required: true },
            createdAt: { type: 'timestamp', required: true }
        },
        drawing: {
            id: { type: 'id', required: true },
            siteId: { type: 'id', required: true },
            sheet: { type: 'string', required: true },
            title: { type: 'string', required: true },
            discipline: { type: 'string', required: true },
            revision: { type: 'string', required: true },
            updatedOn: { type: 'date', required: true }
        },
        sitePhoto: {
            id: { type: 'id', required: true },
            siteId: { type: 'id', required: true },
            date: { type: 'date', required: true },
            caption: { type: 'string', max: 200 },
            tag: { type: 'string', max: 40 },
            tradeIds: { type: 'array' },                          // schedule trade ids ("Plumbing") - search filters by them
            src: { type: 'string', required: true },
            logId: { type: 'id', nullable: true },
            takenBy: { type: 'id', nullable: true },
            createdAt: { type: 'timestamp', required: true }
        },
        costCode: {
            code: { type: 'id', required: true },
            title: { type: 'string', required: true },
            active: { type: 'boolean', required: true }
        },
        tool: {
            id: { type: 'id', required: true },
            name: { type: 'string', required: true },
            // 'individual' (one asset: siteId + status here) or 'quantity' (identical units: totalQuantity here,
            // their locations and statuses in equipmentAllocation rows; siteId and status are null)
            trackingType: { type: 'string', enum: ['individual', 'quantity'] },
            totalQuantity: { type: 'number', nullable: true, min: 1 },
            siteId: { type: 'id', nullable: true },          // individual: null = unassigned, location to confirm
            category: { type: 'string', required: true },
            status: { type: 'string', nullable: true, enum: Object.values(ToolStatus) },
            mergedIds: { type: 'array' },                    // ids of per-unit records folded into this one (history)
            needsReview: { type: 'boolean' },
            quantity: { type: 'number', min: 1 },
            unit: { type: 'string' },
            lastLogged: { type: 'string' },
            moveRequestedToSiteId: { type: 'id', nullable: true },
            missingReportedAt: { type: 'timestamp', nullable: true },
            missingReportedBy: { type: 'id', nullable: true }
        },
        // Where a grouped tool's units are: unique per (toolId, siteId, status); quantities add up to the tool's
        // totalQuantity, Service (out of service) units included
        equipmentAllocation: {
            id: { type: 'id', required: true },
            toolId: { type: 'id', required: true },
            siteId: { type: 'id', nullable: true },          // null = location to confirm
            status: { type: 'string', required: true, enum: Object.values(ToolStatus) },
            quantity: { type: 'number', required: true, min: 1 },
            updatedAt: { type: 'timestamp', required: true }
        },
        scheduleTrade: {
            id: { type: 'id', required: true },
            name: { type: 'string', required: true, min: 1, max: 40 },
            color: { type: 'string', required: true },            // '#RRGGBB'
            icon: { type: 'string' }                              // Font Awesome / Phosphor name for the trade
        },
        scheduleTask: {
            id: { type: 'id', required: true },
            siteId: { type: 'id', required: true },
            tradeId: { type: 'id', required: true },
            title: { type: 'string', required: true, min: 2, max: 120 },
            where: { type: 'string', max: 60 },
            crew: { type: 'string', max: 80 },
            notes: { type: 'string', max: 2000 },
            arrival: { type: 'string', max: 40 },                 // arrival window ('7:00 AM – 3:30 PM')
            startDate: { type: 'date', required: true },
            endDate: { type: 'date', required: true },
            milestone: { type: 'boolean', required: true },
            checklist: { type: 'array', items: {
                id: { type: 'id', required: true },
                text: { type: 'string', required: true, min: 1, max: 200 },
                done: { type: 'boolean', required: true },
                doneBy: { type: 'id', nullable: true },
                doneByName: { type: 'string', nullable: true },
                doneAt: { type: 'timestamp', nullable: true },
                note: { type: 'string', max: 500 },
                requestedBy: { type: 'string', nullable: true, max: 80 }
            } },
            createdAt: { type: 'timestamp', required: true },
            updatedAt: { type: 'timestamp', required: true }
        },
        chat: {
            id: { type: 'id', required: true },
            name: { type: 'string', required: true },
            kind: { type: 'string', required: true, enum: ['site', 'channel', 'direct', 'ai'] },
            siteId: { type: 'id', nullable: true }
        },
        chatMessage: {
            id: { type: 'id', required: true },
            chatId: { type: 'id', required: true },
            type: { type: 'string', required: true, enum: Object.values(ChatMessageType) },
            senderId: { type: 'id', required: true },
            senderName: { type: 'string', required: true },
            text: { type: 'string', max: 2000 },
            requestId: { type: 'id', nullable: true },
            createdAt: { type: 'timestamp', required: true }
        },
        availabilityRequest: {
            id: { type: 'id', required: true },
            toolId: { type: 'id', required: true },
            siteId: { type: 'id', required: true },
            chatId: { type: 'id', required: true },
            messageId: { type: 'id', required: true },
            requesterId: { type: 'id', required: true },
            requesterName: { type: 'string', required: true },
            requesterNote: { type: 'string', max: 200 },
            quantity: { type: 'number', min: 1 },             // units asked about (grouped tools; 1 otherwise)
            status: { type: 'string', required: true, enum: Object.values(AvailabilityStatus) },
            responderId: { type: 'id', nullable: true },
            responderName: { type: 'string', nullable: true },
            respondedAt: { type: 'timestamp', nullable: true },
            holderId: { type: 'id', nullable: true },
            estimatedAvailableAt: { type: 'timestamp', nullable: true },
            idempotencyKey: { type: 'string', nullable: true, max: 80 },
            version: { type: 'number', required: true, min: 1 },
            createdAt: { type: 'timestamp', required: true },
            updatedAt: { type: 'timestamp', required: true },
            expiresAt: { type: 'timestamp', required: true }
        },
        availabilityResponse: {
            id: { type: 'id', required: true },
            requestId: { type: 'id', required: true },
            responderId: { type: 'id', required: true },
            responderName: { type: 'string', required: true },
            responseType: { type: 'string', required: true, enum: Object.values(AvailabilityResponseType) },
            estimatedAvailableAt: { type: 'timestamp', nullable: true },
            previousEstimatedAvailableAt: { type: 'timestamp', nullable: true },
            createdAt: { type: 'timestamp', required: true }
        },
        notification: {
            id: { type: 'id', required: true },
            recipientId: { type: 'id', required: true },
            type: { type: 'string', required: true, enum: Object.values(NotificationType) },
            title: { type: 'string', required: true, max: 80 },
            body: { type: 'string', required: true, max: 300 },
            actorId: { type: 'id', nullable: true },
            requestId: { type: 'id', nullable: true },
            chatId: { type: 'id', nullable: true },
            messageId: { type: 'id', nullable: true },
            dedupeKey: { type: 'string', required: true },
            createdAt: { type: 'timestamp', required: true },
            readAt: { type: 'timestamp', nullable: true }
        },
        leaveRequest: {
            id: { type: 'id', required: true },
            employeeId: { type: 'id', required: true },
            type: { type: 'string', required: true, enum: Object.values(LeaveType) },
            startDate: { type: 'date', required: true },
            endDate: { type: 'date', required: true },
            days: { type: 'number', required: true, min: 0.5 },
            status: { type: 'string', required: true, enum: Object.values(LeaveStatus) },
            requestedAt: { type: 'timestamp', required: true },
            decidedAt: { type: 'timestamp', nullable: true },
            decidedBy: { type: 'id', nullable: true }
        },
        leaveBalance: {
            employeeId: { type: 'id', required: true },
            annualDays: { type: 'number', required: true, min: 0 },
            personalDays: { type: 'number', required: true, min: 0 }
        },
        auditEntry: {
            id: { type: 'id', required: true },
            entity: { type: 'string', required: true },
            entityId: { type: 'id', required: true },
            action: { type: 'string', required: true, enum: Object.values(AuditAction) },
            actorId: { type: 'id', nullable: true },
            at: { type: 'timestamp', required: true }
        }
    });
})();

// Check a value against a schema. Returns [{ field, message }] (empty = valid). Unknown fields are allowed.
function validateAgainst(schema, value, path = '') {
    const errors = [];
    if (!value || typeof value !== 'object') return [{ field: path || '(record)', message: 'must be an object' }];
    Object.keys(schema).forEach(key => {
        const spec = schema[key], v = value[key], field = path + key;
        if (v === undefined || (v === null && !spec.nullable)) {
            if (spec.required || (v === null && !spec.nullable && v !== undefined)) errors.push({ field, message: 'is required' });
            return;
        }
        if (v === null) return;
        const fail = message => errors.push({ field, message });
        switch (spec.type) {
            case 'id': if (typeof v !== 'string' || !v.trim()) fail('must be a non-empty id'); break;
            case 'string':
                if (typeof v !== 'string') fail('must be text');
                else if (spec.min && v.trim().length < spec.min) fail('is required');
                else if (spec.max && v.length > spec.max) fail(`must be at most ${spec.max} characters`);
                break;
            case 'number':
                if (typeof v !== 'number' || !isFinite(v)) fail('must be a number');
                else if (spec.min !== undefined && v < spec.min) fail(`must be at least ${spec.min}`);
                else if (spec.max !== undefined && v > spec.max) fail(`must be at most ${spec.max}`);
                break;
            case 'boolean': if (typeof v !== 'boolean') fail('must be true or false'); break;
            case 'date': if (!DateRules.isIsoDate(v)) fail('must be a YYYY-MM-DD date'); break;
            case 'time': if (!TimeRules.isTime(v)) fail('must be an HH:MM time'); break;
            case 'timestamp': if (typeof v !== 'string' || isNaN(Date.parse(v))) fail('must be an ISO timestamp'); break;
            case 'array':
                if (!Array.isArray(v)) { fail('must be a list'); break; }
                if (spec.min && v.length < spec.min) fail(`needs at least ${spec.min}`);
                if (spec.items) v.forEach((item, i) => errors.push(...validateAgainst(spec.items, item, `${field}[${i}].`)));
                break;
            case 'object': if (typeof v !== 'object') fail('must be an object'); break;
        }
        if (spec.enum && !spec.enum.includes(v)) errors.push({ field, message: `must be one of ${spec.enum.join(', ')}` });
    });
    return errors;
}

// Validate an entity by schema name; throws a VALIDATION AppError listing every problem
function assertValidEntity(schemaName, value) {
    const schema = EntitySchemas[schemaName];
    if (!schema) throw new AppError(ErrorCode.UNKNOWN, `No schema named ${schemaName}`);
    const errors = validateAgainst(schema, value);
    if (errors.length) {
        throw appErrors.validation(`${schemaName} is invalid: ${errors.map(e => `${e.field} ${e.message}`).join('; ')}`, errors);
    }
    return value;
}
