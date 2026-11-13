/**
 * My Week roster: per-day site, rain-site and crew assignments.
 * Pure data - no logic. Loaded before all feature scripts.
 */

const ROSTER_CONFIG = {
    'card-mon': {
        day: 'MON',
        dateNum: '12',
        baseDate: 'MON 12 OCT',
        subtitle: 'Block A • Framing Stage',
        normalSite: { title: 'Lugarno', address: '935 Forest Road, Lugarno' },
        rainSite:   { title: 'Castlecrag', address: '8c The Bulwark, Castlecrag' },
        team: ['David Hilt', 'Jude Hudson', 'Trent Jamieson', 'Lachlan Swatosch'],
        isRainRisk: false
    },
    'card-tue': {
        day: 'TUE',
        dateNum: '13',
        baseDate: 'TUE 13 OCT',
        subtitle: 'Block A • Steel & Rebar',
        normalSite: { title: 'Lugarno', address: '935 Forest Road, Lugarno' },
        rainSite:   { title: 'Lugarno Indoor Hub', address: '935 Forest Road (Shed B), Lugarno' },
        team: ['James Begg', 'David Hilt'],
        isRainRisk: false
    },
    'card-wed': {
        day: 'WED',
        dateNum: '14',
        baseDate: 'WED 14 OCT',
        subtitle: 'Block A • Concrete Pour',
        normalSite: { title: 'Lugarno', address: '935 Forest Road, Lugarno' },
        rainSite:   { title: 'Lugarno Indoor Hub', address: '935 Forest Road (Shed B), Lugarno' },
        team: ['James Begg', 'David Hilt'],
        isRainRisk: false
    },
    'card-thu': {
        day: 'THU',
        dateNum: '15',
        baseDate: 'THUR 15 OCT',
        subtitle: 'Block A • Curing & Checks',
        normalSite: { title: 'Lugarno', address: '935 Forest Road, Lugarno' },
        rainSite:   { title: 'Lugarno Indoor Hub', address: '935 Forest Road (Shed B), Lugarno' },
        team: ['James Begg', 'David Hilt'],
        isRainRisk: false
    },
    'card-fri': {
        day: 'FRI',
        dateNum: '16',
        baseDate: 'FRI 16 OCT',
        subtitle: 'Lot 14 • Waterfront Groundworks',
        normalSite: { title: 'Yowie Bay', address: '1a Yelambie Street, Yowie Bay' },
        rainSite:   { title: 'Castlecrag', address: '8c The Bulwark, Castlecrag' },
        team: ['Curtis Bell', 'Shaun Terry', 'Labour Hire 1'],
        isRainRisk: true
    }
};
