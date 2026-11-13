/**
 * Chat threads and seed messages for the Lifestyle chat hub.
 * Pure data - no logic. Loaded before all feature scripts.
 */

const LIFESTYLE_CHATS = [
    {
        id: 'chat-poppy',
        name: 'Poppy Bot',
        role: 'AI Assistant',
        category: 'ai',
        isGroup: false,
        isOnline: true,
        preview: 'Online & ready to check Procore specs or wet weather protocols.',
        time: 'Online',
        unread: 0,
        avatarType: 'ai',
        messages: [
            { sender: 'Poppy Bot', text: 'G\'day Alexander! How can I help you automate tasks, look up Procore specs, or check wet weather protocols today?', time: 'Just now', isIncoming: true }
        ]
    },
    {
        id: 'chat-company',
        name: 'Company All-Hands',
        role: 'General Channel',
        category: 'channel',
        isGroup: true,
        isOnline: true,
        preview: 'David Hilt: "Indoor backup site confirmed for tomorrow at Lugarno Shed B..."',
        time: '10:42 AM',
        unread: 0,
        avatarType: 'company',
        messages: [
            { sender: 'David Hilt', text: 'Indoor backup site confirmed for tomorrow at Lugarno Shed B. All gear is checked.', time: '10:35 AM', isIncoming: true },
            { sender: 'James Begg', text: 'Beauty, thanks Dave. See everyone at 7 AM sharp.', time: '10:40 AM', isIncoming: true },
            { sender: 'You', text: 'Sounds good! I\'ll bring the extra tarp setup just in case.', time: '10:42 AM', isIncoming: false }
        ]
    },
    {
        id: 'chat-bondi',
        name: 'Bondi Site Crew',
        role: '350 Bondi Rd',
        category: 'channel',
        isSite: true,
        isGroup: true,
        isOnline: true,
        preview: 'Jeremy Gillon: "Roof truss delivery on site, crane set up complete"',
        time: '8:30 AM',
        unread: 2,
        avatarType: 'site',
        messages: [
            { sender: 'Curtis Bell', text: 'Perimeter scaffolding is tagged green and safe.', time: '8:15 AM', isIncoming: true },
            { sender: 'Jeremy Gillon', text: 'Roof truss delivery on site, crane set up complete.', time: '8:30 AM', isIncoming: true }
        ]
    },
    {
        id: 'chat-james',
        name: 'James Begg',
        role: 'Project Architect',
        category: 'direct',
        isGroup: false,
        isOnline: true,
        preview: 'Can you send over the updated roof details for Bondi?',
        time: '9:15 AM',
        unread: 1,
        avatarType: 'team',
        avatarFallback: 'JB',
        messages: [
            { sender: 'James Begg', text: 'Morning Alexander, hope the setout went well today.', time: '8:55 AM', isIncoming: true },
            { sender: 'You', text: 'Morning James, setout is complete and pinned.', time: '9:00 AM', isIncoming: false },
            { sender: 'James Begg', text: 'Can you send over the updated roof details for Bondi?', time: '9:15 AM', isIncoming: true }
        ]
    },
    {
        id: 'chat-lugarno',
        name: 'Lugarno Site Crew',
        role: '935 Forest Rd',
        category: 'channel',
        isSite: true,
        isGroup: true,
        isOnline: true,
        preview: 'Jude Hudson: "Shed B framing underway, rain safe and protected"',
        time: 'Yesterday',
        unread: 0,
        avatarType: 'site',
        messages: [
            { sender: 'David Hilt', text: 'Remember all electrical leads must be elevated off the ground.', time: 'Yesterday 1:15 pm', isIncoming: true },
            { sender: 'Jude Hudson', text: 'Shed B framing underway, rain safe and protected.', time: 'Yesterday 2:30 pm', isIncoming: true }
        ]
    },
    {
        id: 'chat-david',
        name: 'David Hilt',
        role: 'Site Supervisor',
        category: 'direct',
        isGroup: false,
        isOnline: true,
        preview: 'All sorted for Lugarno tomorrow morning. Meet at 6:45 AM.',
        time: 'Yesterday',
        unread: 0,
        avatarType: 'team',
        avatarFallback: 'DH',
        messages: [
            { sender: 'David Hilt', text: 'All sorted for Lugarno tomorrow morning. Meet at 6:45 AM for pre-start brief.', time: 'Yesterday 4:30 pm', isIncoming: true },
            { sender: 'You', text: 'Copy that Dave, see you then.', time: 'Yesterday 4:35 pm', isIncoming: false }
        ]
    },
    {
        id: 'chat-nathan',
        name: 'Nathan Wild',
        role: 'Tradesman',
        category: 'direct',
        isGroup: false,
        isOnline: false,
        preview: 'Cheers for the hand on site today! Joists went up quick.',
        time: 'Oct 12',
        unread: 0,
        avatarType: 'team',
        avatarFallback: 'NW',
        messages: [
            { sender: 'Nathan Wild', text: 'Cheers for the hand on site today! Joists went up quick.', time: '12 Oct 3:30 pm', isIncoming: true },
            { sender: 'You', text: 'Anytime mate, great team effort today!', time: '12 Oct 3:35 pm', isIncoming: false }
        ]
    },
    {
        id: 'chat-jeremy',
        name: 'Jeremy Gillon',
        role: 'Foreman',
        category: 'direct',
        isGroup: false,
        isOnline: false,
        preview: 'Timber load confirmed for Monday morning brief.',
        time: 'Oct 11',
        unread: 0,
        avatarType: 'team',
        avatarFallback: 'JG',
        messages: [
            { sender: 'Jeremy Gillon', text: 'Timber load confirmed for Monday morning brief.', time: '11 Oct 10:22 am', isIncoming: true }
        ]
    },
    {
        id: 'chat-brad',
        name: 'Brad Davis',
        role: 'Site Supervisor',
        category: 'direct',
        isGroup: false,
        isOnline: false,
        preview: 'Checked depot stock, all 54V Flexvolt batteries charged.',
        time: 'Oct 10',
        unread: 0,
        avatarType: 'team',
        avatarFallback: 'BD',
        messages: [
            { sender: 'Brad Davis', text: 'Checked depot stock, all 54V Flexvolt batteries charged.', time: '10 Oct 11:15 am', isIncoming: true }
        ]
    },
    {
        id: 'chat-brendan',
        name: 'Brendan Hodge',
        role: 'Site Supervisor',
        category: 'direct',
        isGroup: false,
        isOnline: false,
        preview: 'Pre-start safety checklist approved for Castlecrag Hub.',
        time: 'Oct 8',
        unread: 0,
        avatarType: 'team',
        avatarFallback: 'BH',
        messages: [
            { sender: 'Brendan Hodge', text: 'Pre-start safety checklist approved for Castlecrag Hub.', time: '8 Oct 7:05 am', isIncoming: true }
        ]
    }
];
