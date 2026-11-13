/**
 * Jobs view: active sites with per-day weather and crew.
 * Pure data - no logic. Loaded before all feature scripts.
 */

        const JOBS_DATA = [
    {
        id: 'job-bondi',
        name: 'Bondi',
        address: '350 Bondi Road, Bondi',
        client: 'Mark and Jennifer',
        projectType: 'NEW BUILD',
        badgeText: 'ON SITE THIS WEEK',
        days: {
            mon: { date: '12 Oct', temp: '21° / 15°', rain: '10% rain', isRainSafe: false, crew: ['Jeremy Gillon', 'Curtis Bell', 'Shaun Terry'] },
            tue: { date: '13 Oct', temp: '22° / 16°', rain: '0% rain',  isRainSafe: false, crew: ['Jeremy Gillon', 'Shaun Terry'] },
            wed: { date: '14 Oct', temp: '18° / 14°', rain: '80% rain', isRainSafe: true,  crew: ['Curtis Bell', 'Labour Hire 1'] },
            thu: { date: '15 Oct', temp: '20° / 15°', rain: '20% rain', isRainSafe: false, crew: ['Jeremy Gillon', 'Curtis Bell'] },
            fri: { date: '16 Oct', temp: '19° / 13°', rain: '100% rain',isRainSafe: true,  crew: ['Shaun Terry', 'Labour Hire 1'] },
            sat: { date: '17 Oct', temp: '23° / 16°', rain: '0% rain',  isRainSafe: false, crew: ['Jeremy Gillon'] }
        }
    },
    {
        id: 'job-castlecrag',
        name: 'Castlecrag',
        address: '8c The Bulwark, Castlecrag',
        client: 'Vanguard Properties',
        projectType: 'RENOVATION',
        badgeText: '5 Days this week',
        days: {
            mon: { date: '12 Oct', temp: '20° / 14°', rain: '10% rain', isRainSafe: true, crew: ['David Hilt', 'Jude Hudson'] },
            tue: { date: '13 Oct', temp: '21° / 15°', rain: '0% rain',  isRainSafe: true, crew: ['David Hilt', 'Jude Hudson'] },
            wed: { date: '14 Oct', temp: '17° / 13°', rain: '90% rain', isRainSafe: true, crew: ['David Hilt', 'Alexander Floratos'] },
            thu: { date: '15 Oct', temp: '19° / 14°', rain: '30% rain', isRainSafe: true, crew: ['David Hilt', 'Jude Hudson'] },
            fri: { date: '16 Oct', temp: '18° / 12°', rain: '100% rain',isRainSafe: true, crew: ['David Hilt', 'Jude Hudson', 'Lachlan Swatosch'] },
            sat: { date: '17 Oct', temp: '22° / 15°', rain: '0% rain',  isRainSafe: true, crew: ['Rotational Team'] }
        }
    },
    {
        id: 'job-lugarno',
        name: 'Lugarno',
        address: '935 Forest Road, Lugarno',
        client: 'Johnson Family',
        projectType: 'NEW BUILD',
        badgeText: '5 Days this week',
        days: {
            mon: { date: '12 Oct', temp: '21° / 15°', rain: '0% rain',  isRainSafe: false, crew: ['James Begg', 'David Hilt'] },
            tue: { date: '13 Oct', temp: '22° / 16°', rain: '0% rain',  isRainSafe: false, crew: ['James Begg', 'David Hilt'] },
            wed: { date: '14 Oct', temp: '17° / 13°', rain: '100% rain',isRainSafe: true,  crew: ['James Begg', 'David Hilt'] },
            thu: { date: '15 Oct', temp: '20° / 15°', rain: '10% rain', isRainSafe: false, crew: ['James Begg', 'David Hilt'] },
            fri: { date: '16 Oct', temp: '19° / 13°', rain: '70% rain', isRainSafe: false, crew: ['James Begg', 'David Hilt'] },
            sat: { date: '17 Oct', temp: '23° / 16°', rain: '0% rain',  isRainSafe: false, crew: ['James Begg'] }
        }
    }
];
