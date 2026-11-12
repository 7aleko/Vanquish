/**
 * Activity / notifications feed seed data.
 * Pure data - no logic. Loaded before all feature scripts.
 */

const NOTIFICATIONS_DATA = [
    {
        id: 'notif-signin',
        category: 'shifts',
        timeGroup: 'Today',
        icon: 'fa-solid fa-location-dot',
        iconBg: 'bg-emerald-950 text-brand-lime border border-brand-lime/30',
        title: "You're at Lugarno today",
        message: "Sign in when you get there to log your shift hours.",
        meta: "935 Forest Rd • 7:00 AM - 3:30 PM",
        time: "10m ago",
        read: false,
        actionType: 'signin'
    },
    {
        id: 'notif-tool',
        category: 'tools',
        timeGroup: 'Today',
        icon: 'fa-solid fa-screwdriver-wrench',
        iconBg: 'bg-amber-950 text-amber-400 border border-amber-500/30',
        title: "Tool moved",
        message: "DeWalt 54V FlexVolt Table Saw moved from Lugarno to Sutherland Depot by Dave M.",
        meta: "Asset #DW-8492 • Checked out",
        time: "28m ago",
        read: false,
        actionType: 'tool'
    },
    {
        id: 'notif-knockoff',
        category: 'shifts',
        timeGroup: 'Today',
        icon: 'fa-solid fa-arrow-right-from-bracket',
        iconBg: 'bg-rose-950 text-rose-400 border border-rose-500/30',
        title: "Knock off check",
        message: "Sign out before you leave site so your timesheet tracks accurately.",
        meta: "Shift completion • 3:30 PM finish",
        time: "2h ago",
        read: false,
        actionType: 'signout'
    },
    {
        id: 'notif-safety',
        category: 'safety',
        timeGroup: 'Yesterday',
        icon: 'fa-solid fa-cloud-bolt',
        iconBg: 'bg-cyan-950 text-cyan-400 border border-cyan-500/30',
        title: "Wet Weather Protocol Active",
        message: "Slippery conditions on outdoor concrete slabs. High-traction boots and eye protection mandatory.",
        meta: "Lugarno Site Safety Broadcast",
        time: "Yesterday • 7:15 AM",
        read: true,
        actionType: null
    },
    {
        id: 'notif-delivery',
        category: 'shifts',
        timeGroup: 'Yesterday',
        icon: 'fa-solid fa-truck-ramp-box',
        iconBg: 'bg-indigo-950 text-indigo-400 border border-indigo-500/30',
        title: "Timber delivery confirmed",
        message: "F-17 Hardwood structural pack unloaded at Forest Rd gate entrance.",
        meta: "Order #LF-8924 • Signed by Dave",
        time: "Yesterday • 11:20 AM",
        read: true,
        actionType: 'docket'
    },
    {
        id: 'notif-roster',
        category: 'shifts',
        timeGroup: 'Earlier',
        icon: 'fa-solid fa-calendar-check',
        iconBg: 'bg-slate-900 text-brand-lime border border-brand-lime/40',
        title: "Next week roster posted",
        message: "Assigned to Cronulla Point project starting Monday 7:00 AM.",
        meta: "Week 42 Schedule",
        time: "3d ago",
        read: true,
        actionType: 'roster'
    }
];
