/**
 * Lifestyle chat hub: thread list, filters, search, conversation view, compose.
 */

// =========================================================================
// LIFESTYLE BUILDING DESIGN HUB - CHAT ENGINE (WHATSAPP-INSPIRED LAYOUT)
// =========================================================================
let currentLifestyleChatFilter = 'all';
let currentLifestyleChatSearchQuery = '';

function getLifestyleUnreadCount() {
    return LIFESTYLE_CHATS.reduce((sum, c) => sum + (c.unread || 0), 0);
}

function updateLifestyleBadges() {
    const totalUnread = getLifestyleUnreadCount();

    // Home Quick Actions chat tile badge
    const navBadge = document.getElementById('chat-badge-count');
    if (navBadge) {
        if (totalUnread > 0) {
            navBadge.style.display = 'flex';
            navBadge.textContent = totalUnread;
        } else {
            navBadge.style.display = 'none';
        }
    }
}

// Every chat avatar is the app's one avatar component (scripts/components/role-avatar.js, styled only by
// styles/role-avatar.css): people get their role avatar (the same as on Team), Poppy her orb, channels and
// sites an icon in the same circle. Only Poppy shows a status dot.
function isPoppyChat(chat) { return chat.id === 'chat-poppy' || chat.avatarType === 'ai'; }
function isSiteChat(chat) { return chat.isSite || chat.avatarType === 'site' || (chat.name && chat.name.includes('Site')); }
function getLifestyleChatAvatar(chat, size = 'lg') {
    if (isPoppyChat(chat)) return withAvatarStatus(renderPoppyAvatar(size), 'ai');
    if (chat.id === 'chat-company' || chat.avatarType === 'company') return renderIconAvatar('ph-house', size);
    if (isSiteChat(chat)) return renderIconAvatar('ph-hard-hat', size);   // channels and sites: no status
    const person = { name: chat.name, role: getPersonRole(chat.name) || chat.role, initials: chat.avatarFallback || undefined };
    return renderRoleAvatar(person, size);                 // people show no activity status
}

// ---------- Inbox ----------
// Poppy is pinned in her own card above one feed holding every other conversation (Company All-Hands and
// the sites included), newest activity first. Filters: All, Sites, Company, DMs.
const CHAT_FILTERS = {
    all: () => true,
    sites: chat => isSiteChat(chat),
    company: chat => chat.id === 'chat-company' || chat.avatarType === 'company',
    direct: chat => chat.category === 'direct'
};
const CHAT_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// A time label from the chat data as a timestamp (ms), or null: "10:42 AM" (today), "Yesterday 4:30 pm",
// "Oct 12" / "12 Oct 3:30 pm", "Mon", "Now". Used to sort the inbox and to place a thread's time dividers.
function parseChatTimeLabel(text) {
    const label = String(text || '').trim().toLowerCase(), now = new Date();
    if (!label) return null;
    const at = (d, hm) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hm ? hm[0] : 12, hm ? hm[1] : 0).getTime();
    const m = label.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    const hm = m ? [(+m[1] % 12) + ((m[3] === 'pm' || (!m[3] && +m[1] >= 12)) ? 12 : 0), +m[2]] : null;
    if (/^(now|just now|online)$/.test(label)) return now.getTime();
    if (label.startsWith('yesterday')) { const y = new Date(now); y.setDate(y.getDate() - 1); return at(y, hm); }
    if (hm && /^\d{1,2}:/.test(label)) return at(now, hm);
    const md = label.match(/^([a-z]{3})[a-z]*\s+(\d{1,2})\b/) || label.match(/^(\d{1,2})\s+([a-z]{3})/);
    if (md) {
        const [mon, day] = /^\d/.test(md[1]) ? [md[2], +md[1]] : [md[1], +md[2]];
        const mi = CHAT_MONTHS.indexOf(mon);
        if (mi >= 0) {
            const d = new Date(now.getFullYear(), mi, day);
            if (d > now) d.setFullYear(d.getFullYear() - 1);
            return at(d, hm);
        }
    }
    const wd = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(label.slice(0, 3));
    if (wd >= 0) { const d = new Date(now); d.setDate(d.getDate() - ((((now.getDay() - wd) + 7) % 7) || 7)); return at(d, hm); }
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
}
// When a conversation last moved, for sorting: a message sent here records it exactly (lastActivity)
function chatActivityTime(chat) {
    return chat.lastActivity || parseChatTimeLabel(chat.time) || 0;
}

// Two lines: name + time, then the latest message + unread count. No role or category tags.
function renderLifestyleChatRow(chat) {
    const unread = chat.unread > 0;
    const label = `${chat.name}, ${chat.time}. ${chat.preview}${unread ? `. ${chat.unread} unread` : ''}`;
    return `
        <button type="button" class="chat-row${unread ? ' is-unread' : ''}" onclick="openLifestyleConversation('${chat.id}')" aria-label="${chatEscape(label)}">
            ${getLifestyleChatAvatar(chat)}
            <span class="chat-row-body">
                <span class="chat-row-line">
                    <span class="chat-row-title">${chatEscape(chat.name)}</span>
                    <span class="chat-row-time">${chatEscape(chat.time)}</span>
                </span>
                <span class="chat-row-line">
                    <span class="chat-row-preview">${chatEscape(chat.preview)}</span>
                    ${unread ? `<span class="chat-row-badge" aria-hidden="true">${chat.unread}</span>` : ''}
                </span>
            </span>
        </button>`;
}

function renderLifestyleChats(filter = currentLifestyleChatFilter, query = currentLifestyleChatSearchQuery) {
    const container = document.getElementById('lifestyle-chat-list');
    const pinnedContainer = document.getElementById('lifestyle-pinned-container');
    const pinnedList = document.getElementById('lifestyle-pinned-list');
    const feedCard = document.getElementById('lifestyle-main-feed-card');
    if (!container) return;
    if (!CHAT_FILTERS[filter]) filter = 'all';
    currentLifestyleChatFilter = filter;
    currentLifestyleChatSearchQuery = query;

    const q = String(query || '').trim().toLowerCase();
    const searching = q !== '';
    const poppy = LIFESTYLE_CHATS.find(isPoppyChat);

    // Poppy: pinned on All (not while searching - she's then one of the results)
    const showPinned = filter === 'all' && !searching && !!poppy;
    if (pinnedContainer && pinnedList) {
        pinnedContainer.hidden = !showPinned;
        pinnedList.innerHTML = showPinned ? renderLifestyleChatRow(poppy) : '';
        if (showPinned) mountPoppyAvatars(pinnedList);
    }

    const matches = chat => !searching || [chat.name, chat.role, chat.preview].some(v => String(v || '').toLowerCase().includes(q));
    const feed = LIFESTYLE_CHATS
        .filter(chat => (searching ? true : !isPoppyChat(chat)))
        .filter(chat => !isPoppyChat(chat) || filter === 'all')
        .filter(CHAT_FILTERS[filter])
        .filter(matches)
        .map((chat, i) => ({ chat, i, t: chatActivityTime(chat) }))
        .sort((a, b) => b.t - a.t || a.i - b.i)           // newest first; ties keep their order
        .map(x => x.chat);

    if (!feed.length) {
        container.innerHTML = searching
            ? `<div class="chat-empty">
                   <p class="chat-empty-title">No chats found</p>
                   <p class="chat-empty-text">Nothing matches "${chatEscape(query.trim())}"</p>
                   <button type="button" class="chat-empty-action" onclick="openPoppyBotChatWithQuery(${chatEscape(JSON.stringify(query.trim()))})">
                       <i class="ph-fill ph-sparkle" aria-hidden="true"></i>Ask Poppy
                   </button>
               </div>`
            : `<div class="chat-empty"><p class="chat-empty-title">No chats here yet</p></div>`;
    } else {
        container.innerHTML = feed.map(renderLifestyleChatRow).join('');
        mountPoppyAvatars(container);
    }
    if (feedCard) feedCard.hidden = false;
    updateLifestyleBadges();
}

function handleLifestyleChatSearch(query) {
    const clearBtn = document.getElementById('lifestyle-chat-search-clear');
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !query || query.trim() === '');
    }
    renderLifestyleChats(currentLifestyleChatFilter, query);
}

function clearLifestyleChatSearch() {
    const input = document.getElementById('lifestyle-chat-search');
    if (input) {
        input.value = '';
        input.focus();
    }
    const clearBtn = document.getElementById('lifestyle-chat-search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');
    renderLifestyleChats(currentLifestyleChatFilter, '');
}

function setLifestyleChatFilter(filter) {
    triggerHaptic('light');
    currentLifestyleChatFilter = filter;

    setActiveFilterPill(document.getElementById(`filter-chip-${filter}`));

    renderLifestyleChats(filter, currentLifestyleChatSearchQuery);
}

// =========================================================================
// CONVERSATION (full screen, like a WhatsApp / Instagram thread)
// =========================================================================
// Opening a chat pushes the Conversation screen (#view-conversation) over Chat: the bar carries the chat's
// avatar and name, the thread fills the screen and the reply box sits at the bottom. Back (or the edge
// swipe) returns to Chat. Poppy keeps her own sheet.
let currentLifestyleConversationId = null;

function chatEscape(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ---------- Thread (Instagram-style) ----------
// Messages from the same sender run together as a cluster: tight spacing, 4px inner corners where bubbles
// join, the sender's 28px avatar beside the last incoming bubble only. Time lives in centred dividers (a new
// one when an hour or a day has passed), not in the bubbles. "Seen" sits under your last message when it is
// the latest in the thread and has been read (a message you send here is unread until then).
const CONV_DIVIDER_GAP = 60 * 60 * 1000;
function messageTime(m) { return m.at || parseChatTimeLabel(m.time); }
function conversationDividerLabel(t, fallback) {
    if (t == null) return String(fallback || '').toUpperCase();
    const d = new Date(t), now = new Date();
    const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((day0(now) - day0(d)) / 86400000);
    const day = days === 0 ? 'Today' : days === 1 ? 'Yesterday'
        : days < 7 ? d.toLocaleDateString('en-AU', { weekday: 'short' })
        : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const hasClock = /\d:\d/.test(fallback || '') || fallback === undefined;
    const clock = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, ' ');
    return `${day}${hasClock ? ' ' + clock : ''}`.toUpperCase();
}
function renderConversationThread(chat) {
    const msgs = chat.messages;
    const times = msgs.map(messageTime);
    // A divider before the first message, and wherever an hour or a day has passed
    const divider = msgs.map((m, i) => {
        if (i === 0) return true;
        const a = times[i - 1], b = times[i];
        if (a == null || b == null) return false;
        return b - a > CONV_DIVIDER_GAP || new Date(a).toDateString() !== new Date(b).toDateString();
    });
    const sameCluster = (i, j) => j >= 0 && j < msgs.length && !divider[Math.max(i, j)] &&
        msgs[i].isIncoming === msgs[j].isIncoming && msgs[i].sender === msgs[j].sender;
    let html = '';
    msgs.forEach((m, i) => {
        if (divider[i]) html += `<div class="conv-divider">${chatEscape(conversationDividerLabel(times[i], m.time))}</div>`;
        const mine = !m.isIncoming, first = !sameCluster(i, i - 1), last = !sameCluster(i, i + 1);
        const body = m.image
            ? `<img class="conv-photo" src="${chatEscape(m.image)}" alt="Photo">`
            : `<p class="conv-text">${chatEscape(m.text)}</p>`;
        html += `<div class="conv-row ${mine ? 'is-mine' : 'is-theirs'}${first ? ' is-first' : ''}${last ? ' is-last' : ''}">
            ${chat.isGroup && !mine && first ? `<span class="conv-sender">${chatEscape(m.sender)}</span>` : ''}
            <div class="conv-row-inner">
                ${mine ? '' : `<span class="conv-row-avatar">${last ? renderRoleAvatar(chat.isGroup ? m.sender : { name: chat.name, role: getPersonRole(chat.name) || chat.role, initials: chat.avatarFallback || undefined }, 'msg') : ''}</span>`}
                <div class="conv-bubble${m.image ? ' has-photo' : ''}">${body}</div>
            </div>
        </div>`;
    });
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg && !lastMsg.isIncoming && lastMsg.seen !== false) html += `<div class="conv-seen">Seen</div>`;
    return html;
}

function renderLifestyleConversation() {
    const chat = LIFESTYLE_CHATS.find(c => c.id === currentLifestyleConversationId);
    const view = document.getElementById('view-conversation');
    if (!chat || !view) return;
    // Bar (left-aligned, top-bar.js reads this template): avatar, name, and "Active now" for someone online
    const isPerson = chat.category === 'direct';
    const online = isPerson && chat.isOnline;
    const sub = online ? 'Active now' : (isSiteChat(chat) ? chat.role : '');
    const avatar = getLifestyleChatAvatar(chat, 'head');
    view.querySelector('template[data-bar-title-html]').innerHTML = `
        <span class="conv-bar-id">${online ? withAvatarStatus(avatar, 'online') : avatar}<span class="conv-bar-text"><span class="conv-bar-name">${chatEscape(chat.name)}</span>${sub ? `<span class="conv-bar-sub">${chatEscape(sub)}</span>` : ''}</span></span>`;
    document.getElementById('conv-messages').innerHTML = renderConversationThread(chat);
}

// Empty: camera + gallery + voice note. Typing: "Send" takes gallery and voice note's place.
function syncConversationComposer() {
    const input = document.getElementById('conv-input');
    const typing = !!(input && input.value.trim());
    document.getElementById('conv-pill-idle').hidden = typing;
    document.getElementById('conv-send').hidden = !typing;
}

function scrollLifestyleConversationToEnd(behavior = 'auto') {
    const view = document.getElementById('view-conversation');
    if (view) view.scrollTo({ top: view.scrollHeight, behavior });
}

function openLifestyleConversation(chatId) {
    const chat = LIFESTYLE_CHATS.find(c => c.id === chatId);
    if (!chat) return;

    // Mark this conversation as read
    chat.unread = 0;
    renderLifestyleChats(currentLifestyleChatFilter, currentLifestyleChatSearchQuery);

    if (chat.id === 'chat-poppy') {
        triggerHaptic('medium');
        openPoppyBotChat();
        return;
    }
    const overlay = document.getElementById('modal-overlay');   // opened from a sheet: close it first
    if (overlay && !overlay.classList.contains('opacity-0')) closeModal();

    currentLifestyleConversationId = chat.id;
    document.getElementById('conv-input').value = '';
    syncConversationComposer();
    renderLifestyleConversation();
    switchTab('conversation');               // pushes it (the bar title comes from the template)
    scrollLifestyleConversationToEnd();      // the newest message, as a thread opens

    if (chat.name === 'Nathan Wild') {
        triggerConfetti();
    }
}

// Add a message of yours to the open conversation (unread by them until they see it)
function pushLifestyleMessage(chat, message, preview) {
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    chat.messages.push({ sender: 'You', time: timeStr, at: now, isIncoming: false, seen: false, ...message });
    chat.preview = preview;
    chat.time = timeStr;
    chat.lastActivity = now;               // newest first in the inbox
    renderLifestyleConversation();
    scrollLifestyleConversationToEnd('smooth');
    renderLifestyleChats(currentLifestyleChatFilter, currentLifestyleChatSearchQuery);
}

function sendLifestyleMessage() {
    const input = document.getElementById('conv-input');
    const chat = LIFESTYLE_CHATS.find(c => c.id === currentLifestyleConversationId);
    if (!input || !chat) return;
    const text = input.value.trim();
    if (!text) return;
    triggerHaptic('light');
    input.value = '';
    syncConversationComposer();
    pushLifestyleMessage(chat, { text }, text);
}

// Camera (a site photo, straight from the camera where the device offers it) or the photo library
function pickConversationPhoto(fromCamera) {
    const picker = document.getElementById('conv-photo-input');
    if (!picker) return;
    triggerHaptic('light');
    if (fromCamera) picker.setAttribute('capture', 'environment');
    else picker.removeAttribute('capture');
    picker.click();
}
function sendConversationPhoto(picker) {
    const file = picker.files && picker.files[0];
    const chat = LIFESTYLE_CHATS.find(c => c.id === currentLifestyleConversationId);
    picker.value = '';
    if (!file || !chat || !/^image\//.test(file.type)) return;
    pushLifestyleMessage(chat, { text: '', image: URL.createObjectURL(file) }, 'Photo');
}

function startConversationVoiceNote() {
    triggerHaptic('light');
    showToast('Voice notes', 'Voice notes are coming soon');
}

// =========================================================================
// NEW MESSAGE / COMPOSE MODAL (TEAM DIRECTORY PICKER)
// =========================================================================
function openNewMessageModal() {
    triggerHaptic('light');
    const members = getEmployees();

    openModal("New Conversation", `
                <div class="space-y-3 py-1">
                    <p class="text-xs text-slate-500 font-medium">Select a crew member or channel to start messaging:</p>
                    
                    <div class="divide-y divide-slate-100 py-1">
                        <div onclick="closeModal(); openLifestyleConversation('chat-company');" class="flex items-center gap-3 py-2.5 px-2 hover:bg-slate-50 cursor-pointer rounded-xl">
                            ${renderIconAvatar('ph-house', 'top')}
                            <div>
                                <p class="text-sm font-bold text-slate-900">Company All-Hands</p>
                                <p class="text-xs text-slate-500">General broadcast channel</p>
                            </div>
                        </div>

                        <div onclick="closeModal(); openPoppyBotChat();" class="flex items-center gap-3 py-2.5 px-2 hover:bg-slate-50 cursor-pointer rounded-xl">
                            ${renderPoppyAvatar('top')}
                            <div>
                                <p class="text-sm font-bold text-slate-900">Poppy Bot AI</p>
                                <p class="text-xs text-slate-500">Automate tasks, look up specs & safety</p>
                            </div>
                        </div>
                    </div>

                    <div class="pt-1">
                        <span class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Team Members (${members.length})</span>
                        <div class="mt-2 space-y-1 max-h-[260px] overflow-y-auto no-scrollbar">
                            ${members.map(m => `
                                <div onclick="closeModal(); openDirectMessage('${m.name}')" class="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl cursor-pointer">
                                    <div class="flex items-center gap-3">
                                        ${renderRoleAvatar(m, 'top')}
                                        <div>
                                            <p class="text-sm font-bold text-slate-900">${m.name}</p>
                                            <p class="text-xs text-slate-500">${m.role}</p>
                                        </div>
                                    </div>
                                    <i class="fa-solid fa-comment text-slate-400 text-xs"></i>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `);
    mountPoppyAvatars(document.getElementById('modal-body'));
}

// =========================================================================
// BACKWARDS COMPATIBILITY WRAPPERS
// =========================================================================
function openGroupChat() {
    openLifestyleConversation('chat-company');
}

function openDirectMessage(name) {
    let chat = LIFESTYLE_CHATS.find(c => c.name.toLowerCase() === name.toLowerCase());

    if (!chat) {
        const member = getEmployeeByName(name);
        const initials = member ? member.initials : name.split(' ').map(n => n[0]).join('').slice(0, 2);
        const role = member ? member.role : 'Team Member';

        chat = {
            id: `chat-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            name: name,
            role: role,
            category: 'direct',
            isGroup: false,
            isOnline: true,
            preview: 'Start a conversation...',
            time: 'Now',
            lastActivity: Date.now(),
            unread: 0,
            avatarType: 'text',
            avatarFallback: initials,
            messages: [
                { sender: name, text: `Hey Alexander, touching base regarding our allocation for next week.`, time: '9:00 am', isIncoming: true }
            ]
        };
        LIFESTYLE_CHATS.push(chat);
    }

    openLifestyleConversation(chat.id);
}
