/**
 * The signed-in employee's own account: profile, leave balances and history, the monthly role
 * sign-off, workwear orders and integration status.
 *
 * Single source for the side drawer's status pills and badges (scripts/features/account.js) and for
 * the sheets they open (profile, leave and workwear in scripts/features/sheets.js; role sign-off,
 * Safety & Training and App Guide & Status in scripts/features/account.js). Sheets update this data
 * (a sign-off, a workwear request or collection, a new photo) and call renderAccountStatus(), so the
 * drawer always shows the current state.
 */

const ACCOUNT_DATA = {
    profile: {
        name: 'Alexander Floratos',
        initials: 'AF',
        employeeId: 'EMP-0415',
        role: 'Senior Product Engineer',
        department: 'Engineering & Field Ops',
        site: 'Lugarno',
        primaryProject: '935 Forest Rd, Lugarno',
        email: 'alexander@lifestyle.com.au',
        photo: null                       // data URL once the user sets a photo (kept in localStorage)
    },

    leave: {
        annualDays: 10.4,
        personalDays: 3.5,                // personal / sick
        pending: [],
        history: [
            { type: 'Annual Leave', days: 3, dates: 'Sep 12 – Sep 14, 2026', status: 'Approved' },
            { type: 'Sick Leave', days: 1, dates: 'August 4, 2026', status: 'Approved' }
        ]
    },

    // Monthly role guidelines sign-off
    roleSignOff: {
        month: 'October',
        signedOff: false,
        signedAt: null
    },

    workwear: {
        pending: [
            { item: 'Long Sleeve Shirt', size: 'M', detail: 'Submitted today • Waiting on supervisor' }
        ],
        ready: [
            { item: 'Sun Cap', size: 'Standard', detail: 'Available at Lugarno Site Office' }
        ]
    },

    integrations: {
        procore: { name: 'Procore Live API', status: 'synced', lastSync: null }   // 'synced' | 'syncing' | 'offline'
    },

    app: { name: 'Lifestyle App', version: '2.4.0' }
};
