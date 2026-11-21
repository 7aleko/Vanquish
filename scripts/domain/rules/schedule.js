/**
 * Domain rules: the site schedule (trade bookings and milestones). Pure functions shared by the service and
 * the Schedule screen: milestone checklist templates, checklist progress, a milestone's status and how far
 * away it is, how many days a booking spans, and the views of a site's schedule the Site Hub and Schedule share:
 * its milestones, the upcoming one, what's next on site, the stages between milestones, and what's on a day.
 *
 * A milestone is a stage gate on its due day (endDate); its progress is always counted from its checklist.
 *
 * Domain layer rule: no DOM, no storage, no provider. Dates are 'YYYY-MM-DD'.
 */
const ScheduleRules = (() => {
    // Checklists a milestone can start from (what the site manager completes before it happens)
    const TEMPLATES = Object.freeze([
        { id: 'slab', name: 'Slab pour', items: ['Set-out checked by surveyor', 'Formwork complete and certified', 'In-slab plumbing and drainage installed and pressure tested', 'In-slab electrical conduits installed', 'Reo inspection passed, engineer’s certificate received', 'Penetrations, set-downs and cast-ins checked against drawings', 'Pre-pour inspection booked and passed', 'Concrete ordered: volume, mix and start time confirmed', 'Pump and line booked', 'Concreters and finishers confirmed', 'Weather checked, no rain forecast', 'Traffic management and permits in place'] },
        { id: 'frame', name: 'Frame inspection', items: ['Frame complete to drawings', 'Tie-downs and bracing installed to engineer’s details', 'Engineer’s frame certificate received', 'Truss layout and certificate received', 'Wet area noggins and blocking installed', 'Plumbing and electrical rough-ins complete', 'Certifier inspection booked'] },
        { id: 'wp', name: 'Waterproofing', items: ['Substrate clean, dry and falls checked', 'Membrane applied (product and batch noted)', '24h flood test done', 'Waterproofing certificate received', 'Photos taken before tiling'] },
        { id: 'lift', name: 'Crane lift / delivery', items: ['Lift plan and SWMS approved', 'Crane and dogman booked', 'Exclusion zone and traffic control arranged', 'Delivery time confirmed with supplier', 'Set-down area clear and ready', 'Wind and weather checked'] },
        { id: 'pc', name: 'Handover / PC', items: ['Defects list completed', 'Certificates collected (electrical, plumbing, waterproofing, glazing)', 'Final clean done', 'Keys, manuals and warranties packed', 'Final inspection / OC issued', 'Client walkthrough booked'] },
        { id: 'blank', name: 'Blank', items: [] }
    ].map(Object.freeze));

    function template(id) { return TEMPLATES.find(t => t.id === id) || TEMPLATES[TEMPLATES.length - 1]; }
    // The template a booking's title suggests
    function guessTemplate(title) {
        const t = String(title || '').toLowerCase();
        if (/pour|slab/.test(t)) return 'slab';
        if (/frame|truss/.test(t)) return 'frame';
        if (/waterproof|membrane/.test(t)) return 'wp';
        if (/crane|lift|deliver/.test(t)) return 'lift';
        if (/handover|practical|\bpc\b/.test(t)) return 'pc';
        return 'blank';
    }

    function days(fromIso, toIso) { return DateRules.dayDiff(DateRules.fromIso(fromIso), DateRules.fromIso(toIso)); }
    function span(task) { return days(task.startDate, task.endDate) + 1; }

    function progress(task) {
        const c = task.checklist || [];
        const done = c.filter(x => x.done).length;
        return { done, total: c.length, ratio: c.length ? done / c.length : 0 };
    }
    // ready (all ticked; reads "Complete") > overdue (finished, not ready) > at risk (3 days or less away) > on track
    function milestoneStatus(task, todayIso) {
        const p = progress(task);
        if (p.total && p.done === p.total) return { key: 'ready', label: 'Complete' };
        if (days(todayIso, task.endDate) < 0) return { key: 'overdue', label: 'Overdue' };
        if (days(todayIso, task.startDate) <= 3) return { key: 'risk', label: 'At risk' };
        return { key: 'track', label: 'On track' };
    }
    function dueLabel(task, todayIso) {
        const toStart = days(todayIso, task.startDate), toEnd = days(todayIso, task.endDate);
        if (toStart > 1) return `In ${toStart} days`;
        if (toStart === 1) return 'Tomorrow';
        if (toStart === 0) return 'Today';
        if (toEnd >= 0) return 'Underway';
        return `${-toEnd} day${toEnd === -1 ? '' : 's'} ago`;
    }

    const byDate = (a, b) => (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0);
    // A site's milestones, in the order they fall due
    function milestones(tasks) { return (tasks || []).filter(t => t.milestone).slice().sort(byDate); }
    function isComplete(task) { const p = progress(task); return p.total > 0 && p.done === p.total; }
    // The local day ('YYYY-MM-DD') a complete milestone was completed: its last tick. Not complete: null.
    function completedOn(task) {
        if (!isComplete(task)) return null;
        const last = (task.checklist || []).reduce((m, x) => (x.doneAt && x.doneAt > m ? x.doneAt : m), '');
        if (!last) return null;
        const d = new Date(last);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    // The milestone to work towards: the first (by due day) whose checklist isn't complete - an overdue one comes
    // first. Given `todayIso`, one completed today stays upcoming for the rest of the day, so its win is seen
    // before the next takes its place. All complete: the last one. None: null.
    function upcomingMilestone(tasks, todayIso) {
        const list = milestones(tasks);
        return list.find(t => !isComplete(t) || (todayIso && completedOn(t) === todayIso)) || list[list.length - 1] || null;
    }
    // The next booking (not a milestone) starting on or after today, earliest first
    function nextOnSite(tasks, todayIso) {
        return (tasks || []).filter(t => !t.milestone && t.startDate >= todayIso)
            .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))[0] || null;
    }
    // Bookings (not milestones) on site on a day
    function onDay(tasks, iso) { return (tasks || []).filter(t => !t.milestone && t.startDate <= iso && t.endDate >= iso); }
    // The construction stages between milestones: each runs from the day after the previous milestone (the first
    // from `firstStart`, or its own day) to its own due day. [{ id, title, start, end }]
    function phases(tasks, firstStart) {
        const list = milestones(tasks), out = [];
        list.forEach((t, i) => {
            const start = i ? DateRules.toIso(DateRules.addDays(DateRules.fromIso(list[i - 1].endDate), 1)) : (firstStart || t.startDate);
            out.push({ id: t.id, title: t.title, start: start > t.endDate ? t.endDate : start, end: t.endDate });
        });
        return out;
    }

    return Object.freeze({ TEMPLATES, template, guessTemplate, span, progress, milestoneStatus, dueLabel,
        milestones, isComplete, completedOn, upcomingMilestone, nextOnSite, onDay, phases });
})();
