/**
 * Roster data. Pure data - no logic. Loaded before all feature scripts.
 *
 * ROSTER: who is rostered to which site on which date - the one table both the Roster screen and Timesheets
 * read (through getRosterEntry / getRosteredSiteId in scripts/application/selectors.js). Each entry stores only
 * the date ('YYYY-MM-DD'), the employee (TEAM_DIRECTORY_DATA id) and the siteId; the site's name and address
 * always come from SITES. Several employees can share a site and date. A day with no entry means the
 * employee isn't rostered that day.
 *
 * ROSTER_CONFIG: the Roster screen's weekday cards - the job stage, the crew they work with, the rain risk
 * and the wet-weather site. The rain site is a siteId too; `area` / `areaDetail` name a part of that site
 * ("Indoor Hub", in "Shed B").
 */

// Migrated from the two rosters that existed before: the Roster screen's week of 12 Oct (Lugarno Mon-Thu,
// Yowie Bay Fri) and Timesheets' fortnightly pattern for the pay runs from 19 Oct (Lugarno, Lugarno,
// Yowie Bay, Yowie Bay, Castlecrag, Lugarno, Lugarno, not rostered, Lugarno, Lugarno).
const ROSTER = [
    // Week of 12 Oct
    { date: '2026-10-12', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-13', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-14', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-15', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-16', employeeId: 'team-1', siteId: 'yowie-bay' },
    // Pay run 19 Oct - 1 Nov (not rostered Wed 28 Oct)
    { date: '2026-10-19', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-20', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-21', employeeId: 'team-1', siteId: 'yowie-bay' },
    { date: '2026-10-22', employeeId: 'team-1', siteId: 'yowie-bay' },
    { date: '2026-10-23', employeeId: 'team-1', siteId: 'castlecrag' },
    { date: '2026-10-26', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-27', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-29', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-10-30', employeeId: 'team-1', siteId: 'lugarno' },
    // Pay run 2 - 15 Nov (not rostered Wed 11 Nov)
    { date: '2026-11-02', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-03', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-04', employeeId: 'team-1', siteId: 'yowie-bay' },
    { date: '2026-11-05', employeeId: 'team-1', siteId: 'yowie-bay' },
    { date: '2026-11-06', employeeId: 'team-1', siteId: 'castlecrag' },
    { date: '2026-11-09', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-10', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-12', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-13', employeeId: 'team-1', siteId: 'lugarno' },
    // Pay run 16 - 29 Nov (not rostered Wed 25 Nov)
    { date: '2026-11-16', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-17', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-18', employeeId: 'team-1', siteId: 'yowie-bay' },
    { date: '2026-11-19', employeeId: 'team-1', siteId: 'yowie-bay' },
    { date: '2026-11-20', employeeId: 'team-1', siteId: 'castlecrag' },
    { date: '2026-11-23', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-24', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-26', employeeId: 'team-1', siteId: 'lugarno' },
    { date: '2026-11-27', employeeId: 'team-1', siteId: 'lugarno' }
];

const ROSTER_CONFIG = {
    'card-mon': {
        day: 'MON',
        dateNum: '12',
        baseDate: 'MON 12 OCT',
        subtitle: 'Block A • Framing Stage',
        rainSite: { siteId: 'castlecrag' },
        team: ['David Hilt', 'Jude Hudson', 'Trent Jamieson', 'Lachlan Swatosch'],
        isRainRisk: false
    },
    'card-tue': {
        day: 'TUE',
        dateNum: '13',
        baseDate: 'TUE 13 OCT',
        subtitle: 'Block A • Steel & Rebar',
        rainSite: { siteId: 'lugarno', area: 'Indoor Hub', areaDetail: 'Shed B' },
        team: ['James Begg', 'David Hilt'],
        isRainRisk: false
    },
    'card-wed': {
        day: 'WED',
        dateNum: '14',
        baseDate: 'WED 14 OCT',
        subtitle: 'Block A • Concrete Pour',
        rainSite: { siteId: 'lugarno', area: 'Indoor Hub', areaDetail: 'Shed B' },
        team: ['James Begg', 'David Hilt'],
        isRainRisk: false
    },
    'card-thu': {
        day: 'THU',
        dateNum: '15',
        baseDate: 'THUR 15 OCT',
        subtitle: 'Block A • Curing & Checks',
        rainSite: { siteId: 'lugarno', area: 'Indoor Hub', areaDetail: 'Shed B' },
        team: ['James Begg', 'David Hilt'],
        isRainRisk: false
    },
    'card-fri': {
        day: 'FRI',
        dateNum: '16',
        baseDate: 'FRI 16 OCT',
        subtitle: 'Lot 14 • Waterfront Groundworks',
        rainSite: { siteId: 'castlecrag' },
        team: ['Curtis Bell', 'Shaun Terry', 'Labour Hire 1'],
        isRainRisk: true
    }
};
