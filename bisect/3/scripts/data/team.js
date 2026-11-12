/**
 * Team directory members.
 * Pure data - no logic. Loaded before all feature scripts.
 */

const TEAM_DIRECTORY_DATA = [
    { id: 'team-1', name: 'Alexander Floratos', role: 'Apprentice', category: 'apprentice', initials: 'AF', birthday: '30 Jun', phone: '+61 412 345 678', email: 'alexander.f@lifestyle.com.au', status: 'Active' },
    { id: 'team-2', name: 'Brad Davis', role: 'Site Supervisor', category: 'site supervisor', initials: 'BD', birthday: '11 Jul', phone: '+61 423 456 789', email: 'brad.d@lifestyle.com.au', status: 'Active' },
    { id: 'team-3', name: 'Brendan Hodge', role: 'Site Supervisor', category: 'site supervisor', initials: 'BH', birthday: '7 Oct', phone: '+61 434 567 890', email: 'brendan.h@lifestyle.com.au', status: 'Active' },
    { id: 'team-4', name: 'Caleb Hayden', role: 'Apprentice', category: 'apprentice', initials: 'CH', birthday: '29 May', phone: '+61 445 678 901', email: 'caleb.h@lifestyle.com.au', status: 'Active' },
    { id: 'team-5', name: 'Cameron Bates', role: 'Tradesman', category: 'tradesman', initials: 'CB', birthday: '13 Sep', phone: '+61 456 789 012', email: 'cameron.b@lifestyle.com.au', status: 'Active' },
    { id: 'team-6', name: 'Curtis Bell', role: 'Site Supervisor', category: 'site supervisor', initials: 'CB', birthday: '12 Jul', phone: '+61 467 890 123', email: 'curtis.b@lifestyle.com.au', status: 'Active' },
    { id: 'team-7', name: 'Daniel Marshall', role: 'Carpenter', category: 'carpenter', initials: 'DM', birthday: '28 Jan', phone: '+61 478 901 234', email: 'daniel.m@lifestyle.com.au', status: 'Active' },
    { id: 'team-8', name: 'David Hilt', role: 'Site Supervisor', category: 'site supervisor', initials: 'DH', birthday: '13 Mar', phone: '+61 489 012 345', email: 'david.h@lifestyle.com.au', status: 'Active' },
    { id: 'team-9', name: 'Doug Lemm', role: 'Carpenter', category: 'carpenter', initials: 'DL', birthday: null, phone: '+61 490 123 456', email: 'doug.l@lifestyle.com.au', status: 'Active' },
    { id: 'team-10', name: 'Tom Robbins', role: 'Apprentice', category: 'apprentice', initials: 'TR', birthday: '17 Aug', phone: '+61 401 234 567', email: 'tom.r@lifestyle.com.au', status: 'Active' },
    { id: 'team-11', name: 'Trent Jamieson', role: 'Carpenter', category: 'carpenter', initials: 'TJ', birthday: '24 Nov', phone: '+61 412 345 679', email: 'trent.j@lifestyle.com.au', status: 'Active' },
    { id: 'team-12', name: 'Labour Hire Carpenter 1', role: 'Carpenter', category: 'carpenter', initials: 'LH', birthday: null, phone: '+61 423 567 890', email: 'labourhire1@lifestyle.com.au', status: 'Active' },
    { id: 'team-13', name: 'Labour Hire Carpenter 2', role: 'Carpenter', category: 'carpenter', initials: 'LH', birthday: null, phone: '+61 434 678 901', email: 'labourhire2@lifestyle.com.au', status: 'Active' },
    { id: 'team-14', name: 'Labour Hire Carpenter 3', role: 'Carpenter', category: 'carpenter', initials: 'LH', birthday: null, phone: '+61 445 789 012', email: 'labourhire3@lifestyle.com.au', status: 'Active' },
    { id: 'team-15', name: 'Labour Hire Carpenter 4', role: 'Carpenter', category: 'carpenter', initials: 'LH', birthday: null, phone: '+61 456 890 123', email: 'labourhire4@lifestyle.com.au', status: 'Active' },
    { id: 'team-16', name: 'Labour Hire Carpenter 5', role: 'Carpenter', category: 'carpenter', initials: 'LH', birthday: null, phone: '+61 467 901 234', email: 'labourhire5@lifestyle.com.au', status: 'Active' },
    { id: 'team-17', name: 'Labour Hire Carpenter 6', role: 'Carpenter', category: 'carpenter', initials: 'LH', birthday: null, phone: '+61 478 012 345', email: 'labourhire6@lifestyle.com.au', status: 'Active' },
    { id: 'team-18', name: 'Labour Hire Carpenter 7', role: 'Carpenter', category: 'carpenter', initials: 'LH', birthday: null, phone: '+61 489 123 456', email: 'labourhire7@lifestyle.com.au', status: 'Active' },
    { id: 'team-19', name: 'Lachlan Swatosch', role: 'Carpenter', category: 'carpenter', initials: 'LS', birthday: '24 Sep', phone: '+61 490 234 567', email: 'lachlan.s@lifestyle.com.au', status: 'Active' },
    { id: 'team-20', name: 'Lisa Isemonger', role: 'Office', category: 'office', initials: 'LI', birthday: '9 Sep', phone: '+61 401 345 678', email: 'lisa.i@lifestyle.com.au', status: 'Active' },
    { id: 'team-21', name: 'Luke Parkes', role: 'Director', category: 'director', initials: 'LP', birthday: '22 Sep', phone: '+61 412 456 789', email: 'luke.p@lifestyle.com.au', status: 'Active' },
    { id: 'team-22', name: 'Marcus Russo', role: 'Project Manager', category: 'project manager', initials: 'MR', birthday: '19 Jan', phone: '+61 423 567 890', email: 'marcus.r@lifestyle.com.au', status: 'Active' },
    { id: 'team-23', name: 'Nathan Wild', role: 'Site Supervisor', category: 'site supervisor', initials: 'NW', birthday: '21 Oct', phone: '+61 434 678 901', email: 'nathan.w@lifestyle.com.au', status: 'Active' },
    { id: 'team-24', name: 'Rod Piper', role: 'Site Supervisor', category: 'site supervisor', initials: 'RP', birthday: '25 Nov', phone: '+61 445 789 012', email: 'rod.p@lifestyle.com.au', status: 'Active' },
    { id: 'team-25', name: 'Scott Mackenzie', role: 'Carpenter', category: 'carpenter', initials: 'SM', birthday: '21 Mar', phone: '+61 456 890 123', email: 'scott.m@lifestyle.com.au', status: 'Active' },
    { id: 'team-26', name: 'Shanelle Organista', role: 'Office', category: 'office', initials: 'SO', birthday: '10 Aug', phone: '+61 467 901 234', email: 'shanelle.o@lifestyle.com.au', status: 'Active' },
    { id: 'team-27', name: 'Shaun Terry', role: 'Labourer', category: 'labourer', initials: 'ST', birthday: '15 May', phone: '+61 478 012 345', email: 'shaun.t@lifestyle.com.au', status: 'Active' },
    { id: 'team-28', name: 'Enzo Neels', role: 'Apprentice', category: 'apprentice', initials: 'EN', birthday: '27 Apr', phone: '+61 489 123 456', email: 'enzo.n@lifestyle.com.au', status: 'Active' },
    { id: 'team-29', name: 'George Cooper', role: 'Project Manager', category: 'project manager', initials: 'GC', birthday: '4 Apr', phone: '+61 490 234 567', email: 'george.c@lifestyle.com.au', status: 'Active' },
    { id: 'team-30', name: 'Hunter Vella', role: 'Apprentice', category: 'apprentice', initials: 'HV', birthday: '26 Nov', phone: '+61 401 345 678', email: 'hunter.v@lifestyle.com.au', status: 'Active' },
    { id: 'team-31', name: 'James Begg', role: 'Apprentice', category: 'apprentice', initials: 'JB', birthday: '13 Nov', phone: '+61 412 456 789', email: 'james.b@lifestyle.com.au', status: 'Active' },
    { id: 'team-32', name: 'Jarrod Frost', role: 'Apprentice', category: 'apprentice', initials: 'JF', birthday: '31 Dec', phone: '+61 423 567 890', email: 'jarrod.f@lifestyle.com.au', status: 'Active' },
    { id: 'team-33', name: 'Jason Frazer', role: 'Site Supervisor', category: 'site supervisor', initials: 'JF', birthday: '8 Sep', phone: '+61 434 678 901', email: 'jason.f@lifestyle.com.au', status: 'Active' },
    { id: 'team-34', name: 'Jeremy Gillon', role: 'Site Supervisor', category: 'site supervisor', initials: 'JG', birthday: '30 Jun', phone: '+61 445 789 012', email: 'jeremy.g@lifestyle.com.au', status: 'Active' },
    { id: 'team-35', name: 'Jude Hudson', role: 'Apprentice', category: 'apprentice', initials: 'JH', birthday: '27 Jul', phone: '+61 456 890 123', email: 'jude.h@lifestyle.com.au', status: 'Active' },
    { id: 'team-36', name: 'Knox Greig', role: 'Carpenter', category: 'carpenter', initials: 'KG', birthday: '10 Nov', phone: '+61 467 901 234', email: 'knox.g@lifestyle.com.au', status: 'On Leave' }
];
