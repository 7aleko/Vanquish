/**
 * Application service: the site schedule. Trade bookings on a site (what, where, from - to), milestones with a
 * checklist completed before they happen, and the trade list.
 *
 *   saveTask(input)                  create or edit a booking; { milestone: true, template } starts a checklist
 *   deleteTask(id) / restoreTask(t)  delete, and put the same booking back (undo)
 *   copyTask(id, days = 7)           the same booking N days later (a milestone's checklist starts unticked)
 *   makeMilestone(id, templateId)    turn a booking into a milestone with a template's checklist
 *   toggleItem / setItemNote / addItem / removeItem / restoreItem   the checklist, one item at a time; ticking
 *                                    records who (the signed-in employee) and when
 *   saveTrades(trades)               the trade list (names and colours)
 *
 * Every change checks permissions, validates, saves through the schedule repository with an audit entry, and
 * puts the saved booking in the cache, so the Schedule screen and the Site Hub update together.
 */

function createScheduleService(kit) {
    const { provider, store } = kit;

    function clean(s, max) { return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').slice(0, max); }
    function invalid(field, message) { return appErrors.validation(message, [{ field, message }], message + '.'); }

    async function commit(work, action, entityId) {
        const who = kit.actor();
        const saved = await provider.transaction(async repos => {
            const row = await work(repos, who);
            await kit.audit(repos, 'scheduleTasks', entityId || row.id, action, who.id);
            return row;
        });
        return saved;
    }

    /**
     * @param {{ id?, siteId, tradeId, title, where?, crew?, notes?, arrival?, startDate, endDate, milestone?, template? }} input
     */
    async function saveTask(input = {}) {
        const who = kit.actor();
        Permissions.assert(who, 'schedule.edit');
        const existing = input.id ? store.get('scheduleTasks').find(t => t.id === input.id) : null;
        const title = clean(input.title, 120), where = clean(input.where, 60);
        const site = store.get('sites').find(s => s.id === (existing ? existing.siteId : input.siteId));
        if (!site || !site.active) throw invalid('siteId', 'Choose an active site');
        if (!store.get('scheduleTrades').some(t => t.id === input.tradeId)) throw invalid('tradeId', 'Choose a trade');
        if (title.length < 2) throw invalid('title', 'Say what is being done');
        if (!DateRules.isIsoDate(input.startDate)) throw invalid('startDate', 'Pick a start date');
        const endDate = input.endDate || input.startDate;
        if (!DateRules.isIsoDate(endDate)) throw invalid('endDate', 'Pick an end date');
        if (endDate < input.startDate) throw invalid('endDate', 'The end date is before the start date');
        const fields = { tradeId: input.tradeId, title, where, startDate: input.startDate, endDate, milestone: !!input.milestone,
            ...(input.crew !== undefined ? { crew: clean(input.crew, 80) } : {}), ...(input.arrival !== undefined ? { arrival: clean(input.arrival, 40) } : {}), ...(input.notes !== undefined ? { notes: String(input.notes || '').trim().slice(0, 2000) } : {}) };
        // A booking becoming a milestone without a checklist starts from a template (chosen, or guessed from the title)
        const needsList = fields.milestone && !(existing && (existing.checklist || []).length);
        if (needsList) fields.checklist = ScheduleRules.template(input.template || ScheduleRules.guessTemplate(title)).items.map(text => ({ text, done: false }));
        const withIds = list => list.map((x, i) => ({ id: `CK-${Date.now().toString(36)}-${i}`, doneBy: null, doneByName: null, doneAt: null, note: '', requestedBy: null, ...x }));
        if (fields.checklist) fields.checklist = withIds(fields.checklist);
        const saved = await provider.transaction(async repos => {
            const row = existing ? await repos.schedule.updateTask(existing.id, fields) : await repos.schedule.createTask({ siteId: site.id, ...fields });
            await kit.audit(repos, 'scheduleTasks', row.id, existing ? AuditAction.UPDATE : AuditAction.CREATE, who.id);
            return row;
        });
        store.upsert('scheduleTasks', saved);
        return saved;
    }

    async function deleteTask(id) {
        Permissions.assert(kit.actor(), 'schedule.edit');
        const removed = await commit(repos => repos.schedule.removeTask(id), AuditAction.DELETE, id);
        store.remove('scheduleTasks', id);
        return removed;
    }
    // Undo: the same booking, same id, back on the schedule
    async function restoreTask(task) {
        Permissions.assert(kit.actor(), 'schedule.edit');
        const saved = await commit(repos => repos.schedule.createTask({ ...task }), AuditAction.RESTORE, task.id);
        store.upsert('scheduleTasks', saved);
        return saved;
    }

    async function copyTask(id, days = 7) {
        Permissions.assert(kit.actor(), 'schedule.edit');
        const t = store.get('scheduleTasks').find(x => x.id === id);
        if (!t) throw appErrors.notFound('Booking', id);
        const shift = iso => DateRules.toIso(DateRules.addDays(DateRules.fromIso(iso), days));
        const copy = {
            siteId: t.siteId, tradeId: t.tradeId, title: t.title, where: t.where, crew: t.crew, notes: t.notes, arrival: t.arrival || '',
            startDate: shift(t.startDate), endDate: shift(t.endDate), milestone: t.milestone,
            checklist: (t.checklist || []).map((x, i) => ({ id: `CK-${Date.now().toString(36)}-${i}`, text: x.text, done: false, doneBy: null, doneByName: null, doneAt: null, note: '', requestedBy: null }))
        };
        const saved = await commit(repos => repos.schedule.createTask(copy), AuditAction.CREATE);
        store.upsert('scheduleTasks', saved);
        return saved;
    }

    async function makeMilestone(id, templateId) {
        const t = store.get('scheduleTasks').find(x => x.id === id);
        if (!t) throw appErrors.notFound('Booking', id);
        return saveTask({ ...t, milestone: true, template: templateId });
    }

    // ----- Checklist (one item at a time) -----
    async function itemOp(taskId, run, action) {
        Permissions.assert(kit.actor(), 'schedule.edit');
        const saved = await commit((repos, who) => run(repos, who), action, taskId);
        store.upsert('scheduleTasks', saved);
        return saved;
    }
    function toggleItem(taskId, itemId) {
        const t = store.get('scheduleTasks').find(x => x.id === taskId);
        const item = t && (t.checklist || []).find(x => x.id === itemId);
        if (!item) throw appErrors.notFound('Checklist item', itemId);
        return itemOp(taskId, (repos, who) => repos.schedule.updateChecklistItem(taskId, itemId, item.done
            ? { done: false, doneBy: null, doneByName: null, doneAt: null }
            : { done: true, doneBy: who.id, doneByName: who.name, doneAt: new Date(kit.now()).toISOString() }), AuditAction.TICK);
    }
    function setItemNote(taskId, itemId, note) {
        return itemOp(taskId, repos => repos.schedule.updateChecklistItem(taskId, itemId, { note: String(note || '').trim().slice(0, 500) }), AuditAction.UPDATE);
    }
    function addItem(taskId, text) {
        const clean1 = clean(text, 200);
        if (!clean1) return Promise.reject(invalid('text', 'Write the item'));
        return itemOp(taskId, (repos, who) => repos.schedule.addChecklistItem(taskId, { text: clean1, requestedBy: who.name }), AuditAction.UPDATE);
    }
    function removeItem(taskId, itemId) {
        return itemOp(taskId, repos => repos.schedule.removeChecklistItem(taskId, itemId), AuditAction.UPDATE);
    }
    // Undo: the removed item back where it was
    function restoreItem(taskId, item, index) {
        return itemOp(taskId, repos => repos.schedule.addChecklistItem(taskId, { ...item }, index), AuditAction.RESTORE);
    }

    async function saveTrades(trades) {
        const who = kit.actor();
        Permissions.assert(who, 'schedule.trades');
        const rows = (trades || []).map((t, i) => ({ id: t.id || `trade-${Date.now().toString(36)}-${i}`, name: clean(t.name, 40) || 'Trade', color: String(t.color || '').toUpperCase(), ...(t.icon ? { icon: t.icon } : {}) }));
        const saved = await provider.transaction(async repos => {
            const out = await repos.schedule.saveTrades(rows);
            await kit.audit(repos, 'scheduleTrades', 'all', AuditAction.UPDATE, who.id, { count: out.length });
            return out;
        });
        await store.refresh('scheduleTrades');
        return saved;
    }

    return Object.freeze({ saveTask, deleteTask, restoreTask, copyTask, makeMilestone, toggleItem, setItemNote, addItem, removeItem, restoreItem, saveTrades });
}
