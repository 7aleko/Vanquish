/**
 * Application service: equipment availability requests (Tools -> site group chat -> notifications).
 *
 *   request({ toolId, note, idempotencyKey })   ask a tool's site whether it is free. The database decides
 *                                               the site and its chat from the tool, refuses a second active
 *                                               request for the tool (the 30-minute cooldown) and replays a
 *                                               retried submit instead of creating another.
 *   respond({ requestId, response, eta })       answer: 'available' | 'in_use' (with an ETA) | 'missing'.
 *                                               The first answer wins (compare-and-set in the database);
 *                                               the holder of an in-use answer may finish or change it.
 *   updateEta({ requestId, eta })               the holder moves their ETA (an identical one tells nobody)
 *   sweepExpired()                              records requests nobody answered as expired
 *   markNotificationRead(id) / markAllNotificationsRead()
 *
 * Who is acting always comes from the auth session; who belongs to a site (rostered there today, or signed
 * in there) is read from the database inside the transaction - never from the screen. ETAs are worked out
 * here from a preset or a clock time, with this service's clock.
 *
 * Notifications are written after the change is saved: a failed delivery never undoes the request or the
 * answer, and delivering again is harmless (unique per recipient + dedupeKey).
 */

function createAvailabilityService(kit) {
    const { provider, store } = kit;
    const T = AvailabilityResponseType, S = AvailabilityStatus, N = NotificationType;
    const shiftEnd = () => (typeof TIMESHEET_CONFIG !== 'undefined' && TIMESHEET_CONFIG.defaultFinish) || '15:30';

    function denied(action, userMessage) {
        return new AppError(ErrorCode.PERMISSION_DENIED, `Not permitted: ${action}`, { userMessage });
    }

    // The site's members today, read from the database
    async function siteMembers(repos, siteId) {
        const date = kit.siteDayIso();
        const [roster, attendance, employees] = await Promise.all([
            repos.roster.list({ siteId, from: date, to: date }),
            repos.attendance.list({ date, siteId }),
            repos.employees.list()
        ]);
        return { members: AvailabilityRules.siteMemberIds({ roster, attendance, employees, siteId, date }), employees };
    }

    // Write notifications; one retry, then give up quietly (logged). Only the signed-in user's own rows go in
    // the cache - everyone else receives theirs through their own session.
    async function deliver(rows) {
        if (!rows.length) return [];
        let saved = [];
        for (let attempt = 0; attempt < 2; attempt++) {
            try { saved = await provider.notifications.createMany(rows); break; } catch (err) {
                if (attempt === 1) { console.warn('Availability notifications not delivered:', toAppError(err).message); return []; }
            }
        }
        const me = kit.session.getCurrentUser();
        saved.filter(n => me && n.recipientId === me.employeeId).forEach(n => store.upsert('notifications', n));
        return saved;
    }
    const linkOf = r => ({ requestId: r.id, chatId: r.chatId, messageId: r.messageId });

    /**
     * @returns {Promise<{ request: AvailabilityRequest, message: ChatMessage, replayed: boolean, notified: number }>}
     */
    async function request(input) {
        const who = kit.actor();
        Permissions.assert(who, 'equipment.requestAvailability');
        const toolId = input && input.toolId;
        const siteId = input && input.siteId ? String(input.siteId) : undefined;            // grouped: the bucket's site
        const quantity = input && input.quantity !== undefined && input.quantity !== '' ? Number(input.quantity) : undefined;
        const note = String((input && input.note) || '').trim().replace(/\s+/g, ' ');
        const idempotencyKey = input && input.idempotencyKey ? String(input.idempotencyKey) : null;
        const problems = [];
        if (!toolId) problems.push({ field: 'toolId', message: 'Choose the equipment' });
        if (note.length > AvailabilityRules.NOTE_MAX) problems.push({ field: 'note', message: `Keep the note under ${AvailabilityRules.NOTE_MAX} characters` });
        if (idempotencyKey && idempotencyKey.length > 80) problems.push({ field: 'idempotencyKey', message: 'is too long' });
        if (problems.length) throw appErrors.validation('Availability request is invalid', problems, problems[0].message + '.');

        const created = await provider.transaction(async repos => {
            const out = await repos.availability.createRequest({ toolId, requesterId: who.id, note, idempotencyKey, siteId, quantity });
            if (!out.replayed) {
                await kit.audit(repos, 'availabilityRequests', out.request.id, AuditAction.REQUEST_AVAILABILITY, who.id,
                    { toolId, siteId: out.request.siteId });
            }
            return out;
        }).catch(err => {
            // Someone else asked first: show their request
            if (err && err.code === ErrorCode.CONFLICT) store.refresh('availabilityRequests').catch(() => {});
            throw err;
        });
        store.upsert('availabilityRequests', created.request);
        if (created.message) store.upsert('chatMessages', created.message);
        if (created.replayed) return { ...created, notified: 0 };

        // Tell the site: its members today, not the person asking
        const r = created.request;
        const tool = store.get('equipment').find(t => t.id === r.toolId) || await provider.equipment.getById(r.toolId);
        const site = store.get('sites').find(s => s.id === r.siteId);
        const { members } = await siteMembers(provider, r.siteId);
        const words = AvailabilityRules.text.request(who.name, AvailabilityRules.itemLabel(tool.name, r.quantity), site ? site.shortName : r.siteId);
        const sent = await deliver(AvailabilityRules.requestRecipients(members, who.id).map(recipientId => ({
            recipientId, type: N.AVAILABILITY_REQUEST, ...words, actorId: who.id, ...linkOf(r), dedupeKey: `${r.id}:request`
        })));
        return { ...created, notified: sent.length };
    }

    // One answer (or ETA change) by the signed-in user
    async function answer(requestId, responseType, eta) {
        const who = kit.actor();
        Permissions.assert(who, 'availability.respond');
        if (![T.AVAILABLE, T.IN_USE, T.MISSING, T.ETA_UPDATED].includes(responseType)) {
            throw appErrors.validation(`Unknown response ${responseType}`, [{ field: 'response', message: 'is not a response' }], 'Choose an answer.');
        }
        let estimatedAvailableAt = null;
        if (responseType === T.IN_USE || responseType === T.ETA_UPDATED) {
            const e = AvailabilityRules.estimateFrom(eta || {}, kit.now(), shiftEnd());
            if (e.error) throw appErrors.validation(e.error, [{ field: 'eta', message: e.error }], e.error + '.');
            estimatedAvailableAt = e.at;
        }
        const canOverride = Permissions.can(who, 'availability.override');

        const before = store.get('availabilityRequests').find(r => r.id === requestId) || null;
        let out;
        try {
            out = await provider.transaction(async repos => {
                const r = await repos.availability.getRequest(requestId);
                if (!r) throw appErrors.notFound('Availability request', requestId);
                if (r.requesterId === who.id && !Permissions.can(who, 'availability.respondOwn')) {
                    throw denied('availability.respondOwn', "You can't answer your own request.");
                }
                const { members } = await siteMembers(repos, r.siteId);
                if (!members.has(who.id) && !canOverride && r.holderId !== who.id) {
                    const site = await repos.sites.getById(r.siteId);
                    throw denied('availability.respond', `Only the ${site ? site.shortName : 'site'} crew can answer this request.`);
                }
                const result = await repos.availability.respond(requestId, { responderId: who.id, responseType, estimatedAvailableAt, canOverride });
                if (!result.unchanged) {
                    await kit.audit(repos, 'availabilityRequests', requestId,
                        result.response.responseType === T.ETA_UPDATED ? AuditAction.UPDATE_ETA : AuditAction.RESPOND, who.id,
                        { status: result.request.status, ...(estimatedAvailableAt ? { estimatedAvailableAt } : {}) });
                }
                return result;
            });
        } catch (err) {
            // The server's state wins: reload what this screen got wrong
            if (err && (err.code === ErrorCode.CONFLICT || err.code === ErrorCode.NOT_FOUND)) {
                Promise.all([store.refresh('availabilityRequests'), store.refresh('equipment'), store.refresh('equipmentAllocations')]).catch(() => {});
            }
            throw err;
        }
        store.upsert('availabilityRequests', out.request);
        if (out.tool) store.upsert('equipment', out.tool);
        if (out.allocations) store.replaceWhere('equipmentAllocations', a => a.toolId === out.request.toolId, out.allocations);
        if (out.unchanged) return { request: out.request, unchanged: true, notified: 0 };

        // Tell the person who asked; a missing tool also alerts the site's supervisor
        const r = out.request, kind = out.response.responseType;
        const found = out.tool || store.get('equipment').find(t => t.id === r.toolId);
        const tool = { ...found, name: AvailabilityRules.itemLabel(found.name, r.quantity) };      // "2 × Wheelbarrow"
        const site = store.get('sites').find(s => s.id === r.siteId);
        const siteName = site ? site.shortName : r.siteId;
        const rows = [];
        const toRequester = (type, words, key) => {
            if (r.requesterId !== who.id) rows.push({ recipientId: r.requesterId, type, ...words, actorId: who.id, ...linkOf(r), dedupeKey: key });
        };
        if (kind === T.AVAILABLE) toRequester(N.AVAILABILITY_AVAILABLE, AvailabilityRules.text.available(who.name, tool.name, siteName), `${r.id}:available`);
        else if (kind === T.IN_USE) toRequester(N.AVAILABILITY_IN_USE, AvailabilityRules.text.inUse(who.name, tool.name, r.estimatedAvailableAt), `${r.id}:eta:${r.estimatedAvailableAt}`);
        else if (kind === T.ETA_UPDATED) toRequester(N.AVAILABILITY_ETA_UPDATED, AvailabilityRules.text.etaUpdated(who.name, tool.name, r.estimatedAvailableAt), `${r.id}:eta:${r.estimatedAvailableAt}`);
        else if (kind === T.MISSING) {
            toRequester(N.AVAILABILITY_MISSING, AvailabilityRules.text.missing(who.name, tool.name, siteName), `${r.id}:missing`);
            const { members, employees } = await siteMembers(provider, r.siteId);
            AvailabilityRules.supervisorRecipients(members, employees, who.id).forEach(recipientId => rows.push({
                    recipientId, type: N.AVAILABILITY_MISSING_ALERT, ...AvailabilityRules.text.missingAlert(who.name, tool.name, siteName),
                    actorId: who.id, ...linkOf(r), dedupeKey: `${r.id}:missing-alert`
                }));
        }
        const sent = await deliver(rows);
        return { request: r, response: out.response, unchanged: false, notified: sent.length };
    }

    function respond({ requestId, response, eta } = {}) { return answer(requestId, response, eta); }
    function updateEta({ requestId, eta } = {}) { return answer(requestId, T.ETA_UPDATED, eta); }

    // Pending requests past their 30 minutes become expired (any client may run this; it is idempotent)
    async function sweepExpired() {
        const now = kit.now().getTime();
        const due = store.get('availabilityRequests').some(r => r.status === S.PENDING && Date.parse(r.expiresAt) <= now);
        if (!due) return [];
        const expired = await provider.transaction(async repos => {
            const rows = await repos.availability.expireDue();
            for (const r of rows) await kit.audit(repos, 'availabilityRequests', r.id, AuditAction.EXPIRE, null);
            return rows;
        });
        expired.forEach(r => store.upsert('availabilityRequests', r));
        return expired;
    }

    async function markNotificationRead(id) {
        const who = kit.actor();
        const saved = await provider.notifications.markRead(id, who.id);
        store.upsert('notifications', saved);
        return saved;
    }
    async function markAllNotificationsRead() {
        const who = kit.actor();
        const rows = await provider.notifications.markAllRead(who.id);
        if (rows.length) await store.refresh('notifications');
        return rows;
    }

    return Object.freeze({ request, respond, updateEta, sweepExpired, markNotificationRead, markAllNotificationsRead });
}
