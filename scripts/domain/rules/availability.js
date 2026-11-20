/**
 * Domain rules: equipment availability requests. Pure functions shared by the mock database (constraints)
 * and the availability service (workflow): the cooldown, when a request still blocks a new one, who belongs
 * to a site on a day, who is told, how an ETA is worked out and how each event is worded.
 *
 * Domain layer rule: no DOM, no storage, no provider. Timestamps in, values out.
 */
const AvailabilityRules = (() => {
    const COOLDOWN_MS = 30 * 60 * 1000;           // a request waits 30 minutes for an answer
    const NOTE_MAX = 200;
    const ETA_PRESETS = Object.freeze(['30m', '1h', '2h', 'end_of_shift', 'custom']);
    const PRESET_MINUTES = { '30m': 30, '1h': 60, '2h': 120 };

    const ms = iso => (iso ? Date.parse(iso) : NaN);

    // What a request shows now: PENDING past its expiry reads as EXPIRED even before the sweep records it
    function effectiveStatus(request, nowMs) {
        if (!request) return null;
        if (request.status === AvailabilityStatus.PENDING && ms(request.expiresAt) <= nowMs) return AvailabilityStatus.EXPIRED;
        return request.status;
    }
    // Does it still block a new request for the same tool? Waiting for an answer (until it expires), or in use
    // with an ETA still ahead. AVAILABLE, MISSING and EXPIRED leave the tool free to ask about again.
    function isActive(request, nowMs) {
        const status = effectiveStatus(request, nowMs);
        if (status === AvailabilityStatus.PENDING) return true;
        if (status === AvailabilityStatus.IN_USE) return !(ms(request.estimatedAvailableAt) <= nowMs);
        return false;
    }
    function isResolved(status) {
        return status === AvailabilityStatus.AVAILABLE || status === AvailabilityStatus.MISSING || status === AvailabilityStatus.EXPIRED;
    }

    // Employees who belong to a site on a day: rostered there, or signed in there and not yet signed out.
    // Active, not on leave. A Set of employeeIds (one entry per person however they qualify).
    function siteMemberIds({ roster, attendance, employees, siteId, date }) {
        const ok = new Map(employees.filter(e => e.active !== false && e.status !== EmployeeStatus.ON_LEAVE).map(e => [e.id, e]));
        const ids = new Set();
        roster.forEach(r => { if (r.date === date && r.siteId === siteId && ok.has(r.employeeId)) ids.add(r.employeeId); });
        attendance.forEach(a => {
            if (a.date === date && a.siteId === siteId && !a.signedOutAt && a.employeeId && ok.has(a.employeeId)) ids.add(a.employeeId);
        });
        return ids;
    }
    // Who hears about a new request: the site's members, never the person asking
    function requestRecipients(memberIds, requesterId) {
        return [...memberIds].filter(id => id !== requesterId);
    }
    // Who is alerted when a tool is reported missing: the site's supervisors; when the site has none (or the
    // reporter is its only one), the directors. Never the reporter.
    function supervisorRecipients(memberIds, employees, reporterId) {
        const byId = new Map(employees.map(e => [e.id, e]));
        const live = e => e && e.active !== false && e.status !== EmployeeStatus.ON_LEAVE && e.id !== reporterId;
        const supervisors = [...memberIds].map(id => byId.get(id)).filter(e => live(e) && /supervisor/i.test(e.category));
        if (supervisors.length) return supervisors.map(e => e.id);
        return employees.filter(e => live(e) && /director/i.test(e.category)).map(e => e.id);
    }

    // When an "In use" answer expects the tool back. `now` is a Date; `shiftEnd` 'HH:MM'; custom `time` 'HH:MM'
    // today. Returns { at: ISO } or { error: message } - the server works this out, never the screen.
    function estimateFrom({ preset, time }, now, shiftEnd) {
        if (!ETA_PRESETS.includes(preset)) return { error: 'Choose when it will be free' };
        const at = new Date(now.getTime());
        at.setSeconds(0, 0);
        if (PRESET_MINUTES[preset]) {
            at.setMinutes(at.getMinutes() + PRESET_MINUTES[preset]);
            return { at: at.toISOString() };
        }
        const hhmm = preset === 'end_of_shift' ? shiftEnd : time;
        if (!TimeRules.isTime(hhmm || '')) return { error: 'Pick a time' };
        const [h, m] = hhmm.split(':').map(Number);
        at.setHours(h, m, 0, 0);
        if (at.getTime() <= now.getTime() + 60 * 1000) {
            return { error: preset === 'end_of_shift' ? 'The shift has already finished. Pick a time instead' : 'Pick a time later today' };
        }
        return { at: at.toISOString() };
    }
    // The same minute: an ETA "change" to the same time changes nothing and tells nobody
    function sameMinute(a, b) {
        return !!a && !!b && Math.floor(ms(a) / 60000) === Math.floor(ms(b) / 60000);
    }

    // 'TOOL-001' from 'tool-1'; registered equipment ('tool-mh3k2a') reads 'TOOL-MH3K2A'
    function assetTag(toolId) {
        const m = /^tool-(\d+)$/i.exec(String(toolId || ''));
        return m ? `TOOL-${m[1].padStart(3, '0')}` : String(toolId || '').toUpperCase();
    }
    function clock(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const h = d.getHours();
        return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    }
    const first = name => String(name || '').split(' ')[0];
    // "2 × Wheelbarrow" when several units were asked about
    const itemLabel = (name, quantity) => (quantity > 1 ? `${quantity} × ${name}` : String(name));

    // The wording of every notification, so the server and any client say the same thing
    const text = Object.freeze({
        request: (requester, tool, site) => ({ title: 'Availability request', body: `${requester} is checking availability for ${tool} on ${site}.` }),
        available: (responder, tool, site) => ({ title: 'Available now', body: `${first(responder)} confirmed ${tool} is available now at ${site}.` }),
        inUse: (responder, tool, etaIso) => ({ title: 'In use', body: `${first(responder)} expects ${tool} to be available at ${clock(etaIso)}.` }),
        etaUpdated: (responder, tool, etaIso) => ({ title: 'ETA updated', body: `${first(responder)} updated the ${tool} availability time to ${clock(etaIso)}.` }),
        missing: (responder, tool, site) => ({ title: 'Not at site', body: `${first(responder)} reported that ${tool} is not at ${site}. The site supervisor has been notified.` }),
        missingAlert: (responder, tool, site) => ({ title: 'Missing equipment', body: `${responder} reported that ${tool} is not at ${site}. Please check the site.` })
    });

    return Object.freeze({
        COOLDOWN_MS, NOTE_MAX, ETA_PRESETS, effectiveStatus, isActive, isResolved, siteMemberIds, requestRecipients,
        supervisorRecipients, estimateFrom, sameMinute, assetTag, clock, itemLabel, text
    });
})();
