/**
 * Mock provider: seed mapper. Turns the sample datasets in scripts/data/ (the mock "database" contents) into
 * domain records (scripts/domain/models.js). This is the only code that reads those datasets; screens and
 * services go through the repositories.
 *
 * A real provider has its own mapper (rows / documents <-> models) in place of this file.
 */

function buildMockSeed(options) {
    const { today, payRunPolicy } = options;
    const D = DateRules;
    const SEEDED_AT = '2026-01-01T00:00:00.000Z';
    const todayIso = D.toIso(today);

    // ----- Sites -----
    const sites = SITES.map(s => ({
        id: s.id, shortName: s.shortName, address: s.address, suburb: s.suburb, active: !!s.active,
        icon: s.icon, createdAt: SEEDED_AT, updatedAt: SEEDED_AT
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
    const roster = ROSTER.map(r => ({ id: `RA-${r.employeeId}-${r.date}`, date: r.date, employeeId: r.employeeId, siteId: r.siteId }));
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

    // ----- Equipment -----
    const equipment = TOOLS_DIRECTORY_DATA.map(t => ({
        id: t.id, name: t.name, siteId: t.siteId, category: t.category, status: t.status,
        ...(t.quantity ? { quantity: t.quantity, unit: t.unit } : {}),
        lastLogged: t.lastLogged || '', moveRequestedToSiteId: null
    }));

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

    return { sites, employees, roster, costCodes, timesheets, crewLogs, equipment, leaveRequests, leaveBalances, audit: [], seededFor: todayIso };
}
