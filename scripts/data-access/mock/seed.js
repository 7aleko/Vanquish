/**
 * Mock provider: seed mapper. Turns the sample datasets in scripts/data/ (the mock "database" contents) into
 * domain records (scripts/domain/models.js). This is the only code that reads those datasets; screens and
 * services go through the repositories.
 *
 * A real provider has its own mapper (rows / documents <-> models) in place of this file.
 */

// Bump when the seed's shape changes: a saved mock database from an older seed is then started again
const MOCK_SEED_VERSION = 4;          // 4: trade tags on site logs and photos; photos attached to their day's log

// The schedule's trade ids (scripts/data/whiteboard.js): the tags site logs and photos may carry
function scheduleTradeIds() { return Object.keys(typeof WHITEBOARD_TRADE_THEMES === 'undefined' ? {} : WHITEBOARD_TRADE_THEMES); }

function buildMockSeed(options) {
    const { today, payRunPolicy } = options;
    const D = DateRules;
    const SEEDED_AT = '2026-01-01T00:00:00.000Z';
    const todayIso = D.toIso(today);

    // ----- Sites -----
    const sites = SITES.map(s => ({
        id: s.id, shortName: s.shortName, address: s.address, suburb: s.suburb, active: !!s.active,
        icon: s.icon, kind: s.kind || 'site',
        ...(s.stage ? { stage: s.stage } : {}), ...(s.lockbox ? { lockbox: s.lockbox, accessNotes: s.accessNotes || '' } : {}),
        createdAt: SEEDED_AT, updatedAt: SEEDED_AT
    }));

    // ----- Employees (the team directory) -----
    const employees = TEAM_DIRECTORY_DATA.map(m => ({
        id: m.id, name: m.name, role: m.role, category: m.category, initials: m.initials,
        birthday: m.birthday || null, phone: m.phone, email: m.email,
        status: m.status === EmployeeStatus.ON_LEAVE ? EmployeeStatus.ON_LEAVE : EmployeeStatus.ACTIVE,
        active: true
    }));
    const employeeByName = name => employees.find(e => e.name === name) || null;

    // ----- Roster -----
    const roster = ROSTER.map(r => ({ id: `RA-${r.employeeId}-${r.date}`, date: r.date, employeeId: r.employeeId, siteId: r.siteId,
        ...(r.stints ? { stints: r.stints.map(s => ({ ...s })) } : {}) }));
    const rosteredSite = (employeeId, iso) => (roster.find(r => r.employeeId === employeeId && r.date === iso) || {}).siteId || null;

    // ----- Cost codes -----
    const costCodes = TIMESHEET_COST_CODES.map(c => ({ code: c.code, title: c.title, active: true }));

    // ----- Timesheets: the signed-in worker's sample days, placed in the current and previous pay runs -----
    const employeeId = 'team-1';
    const current = PayRunRules.workdays(today, payRunPolicy);
    const previous = PayRunRules.workdays(D.addDays(PayRunRules.startOf(today, payRunPolicy), -payRunPolicy.lengthDays), payRunPolicy);
    const timesheets = [];
    [[TIMESHEET_PREVIOUS_RUN_RECORDS, previous], [TIMESHEET_SAMPLE_RECORDS, current]].forEach(([records, days]) => {
        records.forEach(r => {
            const date = days[r.workday];
            if (!date || D.dayDiff(date, today) < 0) return;            // never seed a future day
            const iso = D.toIso(date), id = `TS-${employeeId}-${iso}`;
            const submittedAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 0).toISOString();
            const approved = r.approval === 'approved';
            timesheets.push({
                id, date: iso, employeeId, siteId: r.siteId,
                siteAssignmentType: TimesheetRules.assignmentType(rosteredSite(employeeId, iso), r.siteId),
                status: approved ? TimesheetStatus.APPROVED : TimesheetStatus.SUBMITTED,
                blocks: r.blocks.map((b, i) => ({ id: `${id}-b${i + 1}`, code: b.code, start: b.start, finish: b.finish, breakMins: Number(b.breakMins), task: b.task })),
                submittedAt, approvedAt: approved ? submittedAt : null, approvedBy: null,
                createdAt: submittedAt, updatedAt: submittedAt
            });
        });
    });

    // ----- Crew logs: one record per person, site and started workday, from the crew's typical days -----
    const historyStart = D.addDays(PayRunRules.startOf(today, payRunPolicy), -payRunPolicy.lengthDays);
    const crewLogs = [];
    for (let d = historyStart; D.dayDiff(d, today) >= 0; d = D.addDays(d, 1)) {
        if (D.isWeekend(d)) continue;
        const iso = D.toIso(d), wd = Math.max(0, PayRunRules.workdayIndex(d, payRunPolicy));
        Object.keys(TIMESHEET_CREW_PLANS).forEach(siteId => {
            TIMESHEET_CREW_PLANS[siteId].forEach((c, n) => {
                const id = `CL-${iso}-${siteId}-${n + 1}`;
                const member = employeeByName(c.name);
                crewLogs.push({
                    id, date: iso, employeeId: member ? member.id : null, name: c.name, siteId,
                    blocks: c.plans[(wd + 1) % c.plans.length].map((b, i) => ({ id: `${id}-b${i + 1}`, code: b.code, start: b.start, finish: b.finish, breakMins: Number(b.breakMins), task: b.task }))
                });
            });
        });
    }

    // ----- Attendance: the sample site sign-ins (scripts/data/attendance.js), as timestamps -----
    const stamp = (date, hhmm) => {
        const [y, m, d] = date.split('-').map(Number), [h, min] = hhmm.split(':').map(Number);
        return new Date(y, m - 1, d, h, min).toISOString();
    };
    const attendance = (typeof ATTENDANCE_SAMPLE === 'undefined' ? [] : ATTENDANCE_SAMPLE).map((a, i) => {
        const member = employeeByName(a.name);
        return {
            id: `AT-${a.date}-${member ? member.id : `x${i + 1}`}`, date: a.date, employeeId: member ? member.id : null,
            name: a.name, siteId: a.siteId, signedInAt: stamp(a.date, a.signIn), signedOutAt: a.signOut ? stamp(a.date, a.signOut) : null
        };
    });

    // ----- Site crews (JOBS_DATA, the sites' daily crews) as roster assignments, so the database knows who
    // belongs to a site on a day. The signed-in worker's own roster (ROSTER) wins; a person named on two
    // crews the same day is placed where they signed in, otherwise on the first.
    const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    // siteDay is a Date (or an ISO string); the crews' "23 Nov" labels take its year
    const siteDay = options.siteDay || today;
    const crewYear = typeof siteDay === 'string' ? Number(siteDay.slice(0, 4)) : siteDay.getFullYear();
    const crewDate = label => {
        const m = /^(\d{1,2})\s+([A-Za-z]{3})/.exec(label || '');
        const mi = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
        return mi < 0 ? null : D.toIso(new Date(crewYear, mi, Number(m[1])));
    };
    const crewChoices = new Map();                  // 'employeeId|date' -> [siteId, ...]
    (typeof JOBS_DATA === 'undefined' ? [] : JOBS_DATA).forEach(job => {
        Object.values(job.days || {}).forEach(day => {
            const date = crewDate(day.date);
            if (!date) return;
            (day.crew || []).forEach(name => {
                const member = employeeByName(name);
                if (!member) return;                    // labour hire / rotational teams have no employee record
                const key = `${member.id}|${date}`;
                crewChoices.set(key, [...(crewChoices.get(key) || []), job.siteId]);
            });
        });
    });
    crewChoices.forEach((siteIds, key) => {
        const [employeeId, date] = key.split('|');
        if (roster.some(r => r.employeeId === employeeId && r.date === date)) return;
        const signedIn = attendance.find(a => a.employeeId === employeeId && a.date === date && siteIds.includes(a.siteId));
        roster.push({ id: `RA-${employeeId}-${date}`, date, employeeId, siteId: signedIn ? signedIn.siteId : siteIds[0] });
    });

    // ----- Chats the server knows about (LIFESTYLE_CHATS): a site group chat names its site -----
    const chats = (typeof LIFESTYLE_CHATS === 'undefined' ? [] : LIFESTYLE_CHATS).map(c => ({
        id: c.id, name: c.name,
        kind: c.siteId ? 'site' : (c.category === 'ai' ? 'ai' : c.category === 'direct' ? 'direct' : 'channel'),
        siteId: c.siteId || null
    }));

    // ----- Site content: daily logs, drawings and photos (scripts/data/site-content.js) -----
    // A log's photos are SitePhotos attached to it: captioned with its title, tagged with its trades
    const tradeIdsKnown = new Set(scheduleTradeIds());
    const siteLogs = [], sitePhotos = [];
    (typeof SITE_LOG_SAMPLE === 'undefined' ? [] : SITE_LOG_SAMPLE).forEach((l, i) => {
        const author = employeeByName(l.author);
        const id = `LOG-${l.siteId}-${l.date}-${i + 1}`;
        const tradeIds = (l.trades || []).filter(t => tradeIdsKnown.has(t));
        siteLogs.push({ id, siteId: l.siteId, date: l.date, title: l.title, body: l.body, tradeIds,
            authorId: author ? author.id : null, authorName: l.author, createdAt: stamp(l.date, '16:00') });
        (l.photos || []).forEach((img, n) => sitePhotos.push({
            id: `PH-${l.siteId}-${l.date}-${i + 1}-${n + 1}`, siteId: l.siteId, date: l.date, caption: l.title, tag: l.photoTag || 'Progress',
            tradeIds, src: `assets/images/site-photos/${img}.jpg`, logId: id, takenBy: author ? author.id : null,
            createdAt: stamp(l.date, `14:${String(10 + n).padStart(2, '0')}`)
        }));
    });
    const drawings = (typeof DRAWING_SAMPLE === 'undefined' ? [] : DRAWING_SAMPLE).map(d => ({
        id: `DWG-${d.siteId}-${d.sheet}`, siteId: d.siteId, sheet: d.sheet, title: d.title, discipline: d.discipline,
        revision: d.revision, updatedOn: d.updated
    }));

    // ----- Equipment: the inventory (scripts/data/tools.js). A single item is an individual record with its own
    // site and status; an item with several identical units (or bulk stock) is ONE quantity-tracked record whose
    // units sit in allocation buckets (site, status, quantity). Status follows location (EquipmentRules.statusAt).
    // Ids are sequential record keys counted per physical unit, so a grouped record keeps the id its first unit
    // had when units were separate records (saved databases migrate onto the same ids).
    let equipmentSeq = 0;
    const equipmentId = () => `eq-${String(++equipmentSeq).padStart(3, '0')}`;
    const equipment = [], equipmentAllocations = [];
    EQUIPMENT_INVENTORY.forEach(item => {
        const site = sites.find(x => x.id === item.location) || null;
        const status = EquipmentRules.statusAt(site);
        const base = {
            name: item.name, category: item.category, lastLogged: '', moveRequestedToSiteId: null,
            missingReportedAt: null, missingReportedBy: null
        };
        const qty = item.quantity || 1;
        if (qty > 1) {
            const id = equipmentId();
            for (let u = 1; u < (item.bulk ? 1 : qty); u++) equipmentId();      // the ids its other units had
            equipment.push({ ...base, id, trackingType: 'quantity', totalQuantity: qty, siteId: null, status: null,
                ...(item.unit ? { unit: item.unit } : {}) });
            equipmentAllocations.push({ id: `AL-${id}-${item.location || 'unassigned'}-${status.replace(/\s+/g, '')}`, toolId: id,
                siteId: item.location || null, status, quantity: qty, updatedAt: SEEDED_AT });
        } else {
            equipment.push({ ...base, id: equipmentId(), trackingType: 'individual', siteId: item.location || null, status });
        }
    });

    // ----- Leave: the account's history as dated requests, and its balance -----
    const leaveOwner = 'team-1';
    const LEAVE_HISTORY_DATES = {                    // the history's date labels, as dates
        'Sep 12 – Sep 14, 2026': ['2026-09-12', '2026-09-14'],
        'August 4, 2026': ['2026-08-04', '2026-08-04']
    };
    const leaveRequests = [];
    ACCOUNT_DATA.leave.history.forEach((h, i) => {
        const range = LEAVE_HISTORY_DATES[h.dates];
        if (!range) { console.warn(`Mock seed: leave dates "${h.dates}" not mapped - skipped`); return; }
        leaveRequests.push({
            id: `LR-${i + 1}`, employeeId: leaveOwner,
            type: /sick|personal/i.test(h.type) ? LeaveType.PERSONAL : LeaveType.ANNUAL,
            startDate: range[0], endDate: range[1], days: h.days,
            status: h.status === 'Approved' ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
            requestedAt: `${range[0]}T00:00:00.000Z`, decidedAt: h.status === 'Approved' ? `${range[0]}T00:00:00.000Z` : null, decidedBy: null
        });
    });
    const leaveBalances = [{ employeeId: leaveOwner, annualDays: ACCOUNT_DATA.leave.annualDays, personalDays: ACCOUNT_DATA.leave.personalDays }];

    // ----- Site schedule: trades (scripts/data/whiteboard.js themes) and bookings -----
    const scheduleTrades = (typeof WHITEBOARD_TRADE_THEMES === 'undefined' ? {} : WHITEBOARD_TRADE_THEMES);
    const scheduleTradeRows = Object.keys(scheduleTrades).map(id => ({ id, name: scheduleTrades[id].name, color: scheduleTrades[id].color, icon: scheduleTrades[id].icon }));
    // A milestone's checklist item: [text] to do, or [text, who ticked it, 'YYYY-MM-DD'] done
    const scheduleTasks = (typeof whiteboardTradeTasks === 'undefined' ? [] : whiteboardTradeTasks).map(t => ({
        id: t.id, siteId: t.siteId, tradeId: t.trade, title: t.title, where: t.where || '', crew: t.crew || '', notes: t.notes || '',
        arrival: t.arrival || '', startDate: t.startDate, endDate: t.endDate, milestone: !!t.milestone,
        checklist: (t.checklist || []).map(([text, by, on], i) => {
            const who = by ? employeeByName(by) : null;
            return { id: `CK-${t.id}-${i + 1}`, text, done: !!by, doneBy: who ? who.id : null, doneByName: by || null,
                doneAt: on ? stamp(on, '15:00') : null, note: '', requestedBy: null };
        }),
        createdAt: SEEDED_AT, updatedAt: SEEDED_AT
    }));

    // Availability requests, their responses, structured chat messages and notifications start empty: they
    // are created by people using the app
    return {
        sites, employees, roster, costCodes, timesheets, crewLogs, attendance, siteLogs, drawings, sitePhotos, equipment,
        leaveRequests, leaveBalances, equipmentAllocations, scheduleTrades: scheduleTradeRows, scheduleTasks, chats, chatMessages: [], availabilityRequests: [], availabilityResponses: [], notifications: [],
        audit: [], seededFor: `${todayIso}/${MOCK_SEED_VERSION}`,
        // A saved database whose table version differs takes that table from this seed (see the mock
        // provider): equipment v4 = quantity-tracked groups with allocation buckets (v3: one record per unit);
        // roster v3 = split days and custom hours (stints) and the site crews (their year was misread before)
        tableVersions: { equipment: 4, roster: 3 }
    };
}
