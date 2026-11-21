/**
 * Jobs: the work running at each of the employee's assigned sites (the Site screen's "Your Sites"), with
 * per-day weather (high / low, chance of rain, wind) and crew. Each job points at its site by siteId; the name and address come from SITES.
 * Pure data - no logic. Loaded before all feature scripts.
 */

const JOBS_DATA = [
    {
        id: 'job-bondi',
        siteId: 'bondi',
        client: 'Mark and Jennifer',
        projectType: 'NEW BUILD',
        badgeText: 'ON SITE THIS WEEK',
        days: {
            mon: { date: '23 Nov', temp: '26° / 18°', rain: '10% rain', wind: '18 km/h', isRainSafe: false, crew: ['Curtis Bell', 'Jeremy Gillon', 'Labour Hire 1'] },
            tue: { date: '24 Nov', temp: '27° / 19°', rain: '0% rain', wind: '22 km/h', isRainSafe: false, crew: ['Curtis Bell', 'Shaun Terry'] },
            wed: { date: '25 Nov', temp: '24° / 18°', rain: '40% rain', wind: '26 km/h', isRainSafe: false, crew: ['Curtis Bell', 'Jeremy Gillon', 'Shaun Terry'] },
            thu: { date: '26 Nov', temp: '22° / 17°', rain: '70% rain', wind: '31 km/h', isRainSafe: true, crew: ['Curtis Bell', 'Labour Hire 1'] },
            fri: { date: '27 Nov', temp: '25° / 18°', rain: '10% rain', wind: '15 km/h', isRainSafe: false, crew: ['Curtis Bell', 'Jeremy Gillon', 'Shaun Terry', 'Labour Hire 1'] },
            sat: { date: '28 Nov', temp: '28° / 19°', rain: '0% rain', wind: '12 km/h', isRainSafe: false, crew: ['Jeremy Gillon'] }
        }
    },
    {
        id: 'job-castlecrag',
        siteId: 'castlecrag',
        client: 'Vanguard Properties',
        projectType: 'RENOVATION',
        badgeText: '5 Days this week',
        days: {
            mon: { date: '23 Nov', temp: '25° / 17°', rain: '10% rain', wind: '12 km/h', isRainSafe: true, crew: ['Brendan Hodge', 'Jude Hudson'] },
            tue: { date: '24 Nov', temp: '26° / 18°', rain: '0% rain', wind: '16 km/h', isRainSafe: true, crew: ['Brendan Hodge', 'Jude Hudson', 'Caleb Hayden'] },
            wed: { date: '25 Nov', temp: '23° / 17°', rain: '40% rain', wind: '20 km/h', isRainSafe: true, crew: ['Jude Hudson', 'Caleb Hayden'] },
            thu: { date: '26 Nov', temp: '21° / 16°', rain: '80% rain', wind: '28 km/h', isRainSafe: true, crew: ['Brendan Hodge', 'Jude Hudson'] },
            fri: { date: '27 Nov', temp: '24° / 17°', rain: '10% rain', wind: '14 km/h', isRainSafe: true, crew: ['Brendan Hodge', 'Jude Hudson', 'Caleb Hayden'] },
            sat: { date: '28 Nov', temp: '27° / 18°', rain: '0% rain', wind: '10 km/h', isRainSafe: true, crew: ['Rotational Team'] }
        }
    },
    {
        id: 'job-lugarno',
        siteId: 'lugarno',
        client: 'Johnson Family',
        projectType: 'NEW BUILD',
        badgeText: '5 Days this week',
        days: {
            mon: { date: '23 Nov', temp: '27° / 17°', rain: '0% rain', wind: '14 km/h', isRainSafe: false, crew: ['David Hilt', 'James Begg'] },
            tue: { date: '24 Nov', temp: '29° / 18°', rain: '0% rain', wind: '11 km/h', isRainSafe: false, crew: ['David Hilt', 'James Begg', 'Trent Jamieson'] },
            wed: { date: '25 Nov', temp: '25° / 17°', rain: '30% rain', wind: '17 km/h', isRainSafe: false, crew: ['David Hilt', 'Trent Jamieson', 'Tom Robbins'] },
            thu: { date: '26 Nov', temp: '22° / 16°', rain: '80% rain', wind: '24 km/h', isRainSafe: true, crew: ['David Hilt', 'James Begg', 'Lachlan Swatosch'] },
            fri: { date: '27 Nov', temp: '24° / 16°', rain: '20% rain', wind: '19 km/h', isRainSafe: false, crew: ['David Hilt', 'James Begg', 'Trent Jamieson'] },
            sat: { date: '28 Nov', temp: '28° / 18°', rain: '0% rain', wind: '9 km/h', isRainSafe: false, crew: ['James Begg'] }
        }
    }
];
