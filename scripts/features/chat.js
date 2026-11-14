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

    // 1. Filter pill badge
    const chipBadge = document.getElementById('lifestyle-unread-count-chip');
    if (chipBadge) {
        chipBadge.textContent = totalUnread;
        chipBadge.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
    }

    // 2. Home Quick Actions chat tile badge
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

function getLifestyleChatAvatar(chat) {
    if (chat.id === 'chat-poppy' || chat.avatarType === 'ai') {
        return `
                    <div class="relative shrink-0">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-lime via-emerald-400 to-teal-300 text-slate-950 font-black text-base flex items-center justify-center shadow-md shadow-brand-lime/25 group-hover:scale-105 transition-transform duration-300">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <span class="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                            <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-brand-lime border-2 border-white"></span>
                        </span>
                    </div>
                `;
    }
    if (chat.id === 'chat-company' || chat.avatarType === 'company') {
        return `
                    <div class="relative shrink-0">
                        <div class="w-12 h-12 rounded-2xl bg-slate-900 text-[#AEB6C2] font-black text-base flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <i class="fa-solid fa-house"></i>
                        </div>
                        <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                    </div>
                `;
    }
    if (chat.isSite || chat.avatarType === 'site' || (chat.name && chat.name.includes('Site'))) {
        return `
                    <div class="relative shrink-0">
                        <div class="w-12 h-12 rounded-2xl bg-slate-900 text-[#AEB6C2] font-black text-base flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <i class="fa-solid fa-helmet-safety"></i>
                        </div>
                        <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white"></span>
                    </div>
                `;
    }
    // Direct message team members — exactly matches the Team Page:
    return `
                <div class="relative shrink-0">
                    <div class="w-12 h-12 rounded-2xl bg-slate-900 text-brand-lime font-black text-sm flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        ${chat.avatarFallback || 'LB'}
                    </div>
                    <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${chat.isOnline ? 'bg-emerald-500' : 'bg-slate-300'} border-2 border-white"></span>
                </div>
            `;
}

function renderLifestyleChatRow(chat, isPinned = false) {
    const isUnread = chat.unread > 0;
    const timeColor = isUnread ? 'text-red-500 font-bold' : (chat.id === 'chat-poppy' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium');

    let roleBadgeClass = 'bg-slate-100 text-slate-600 border border-slate-200/60';
    if (chat.id === 'chat-poppy' || chat.category === 'ai') {
        roleBadgeClass = 'bg-brand-lime/20 text-slate-950 border border-brand-lime/30';
    } else if (chat.isSite || (chat.name && chat.name.includes('Site'))) {
        roleBadgeClass = 'bg-slate-100 text-slate-700 border border-slate-200/60';
    }

    // Messages-style row: the name owns line 1 (time trails it), context and the unread
    // count live on line 2, so metadata never truncates the person you're looking for.
    return `
                <div onclick="openLifestyleConversation('${chat.id}')"
                     class="px-4 py-3.5 ${isPinned ? 'hover:bg-white/60 active:bg-white/80' : 'hover:bg-slate-50/80 active:bg-slate-100/60'} cursor-pointer transition-colors flex items-center gap-3.5 min-h-[72px]">
                    ${getLifestyleChatAvatar(chat)}
                    <div class="min-w-0 flex-1">
                        <div class="flex items-baseline gap-2">
                            <h4 class="flex-1 min-w-0 text-[15px] leading-5 font-black text-slate-900 tracking-tight truncate">${chat.name}</h4>
                            <span class="shrink-0 text-[11px] tabular ${timeColor}">${chat.time}</span>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="shrink-0 max-w-[45%] truncate text-[11px] leading-4 font-bold px-1.5 py-px rounded-md ${roleBadgeClass}">${chat.role}</span>
                            <p class="flex-1 min-w-0 text-[13px] leading-[18px] ${isUnread ? 'text-slate-900 font-semibold' : 'text-slate-500 font-medium'} truncate">${chat.preview}</p>
                            ${isUnread ? `<span class="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center tabular" aria-label="${chat.unread} unread">${chat.unread}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
}

function renderLifestyleChats(filter = currentLifestyleChatFilter, query = currentLifestyleChatSearchQuery) {
    const container = document.getElementById('lifestyle-chat-list');
    const pinnedContainer = document.getElementById('lifestyle-pinned-container');
    const pinnedList = document.getElementById('lifestyle-pinned-list');
    const mainFeedCard = document.getElementById('lifestyle-main-feed-card');
    if (!container) return;

    currentLifestyleChatFilter = filter;
    currentLifestyleChatSearchQuery = query;

    const isSearching = Boolean(query && query.trim() !== '');

    // 1. Pinned Glass Gradient Card: Poppy Bot & Company All-Hands
    if (pinnedContainer && pinnedList) {
        if (filter === 'all' && !isSearching) {
            pinnedContainer.style.display = 'block';
            const poppyChat = LIFESTYLE_CHATS.find(c => c.id === 'chat-poppy');
            const companyChat = LIFESTYLE_CHATS.find(c => c.id === 'chat-company');
            let pinnedHtml = '';
            if (poppyChat) pinnedHtml += renderLifestyleChatRow(poppyChat, true);
            if (companyChat) pinnedHtml += renderLifestyleChatRow(companyChat, true);
            pinnedList.innerHTML = pinnedHtml;
        } else {
            pinnedContainer.style.display = 'none';
        }
    }

    // 2. Main List Filtering
    let filtered = LIFESTYLE_CHATS.filter(chat => {
        if (isSearching) return true;
        if (filter === 'all') {
            // Poppy Bot & Company All-Hands are pinned at the top in their dedicated glass gradient card
            return chat.id !== 'chat-poppy' && chat.id !== 'chat-company';
        }
        if (filter === 'unread') return chat.unread > 0;
        if (filter === 'channel') return chat.category === 'channel';
        if (filter === 'direct') return chat.category === 'direct';
        if (filter === 'ai') return chat.category === 'ai' || chat.id === 'chat-poppy';
        return true;
    });

    if (isSearching) {
        const q = query.toLowerCase().trim();
        filtered = filtered.filter(chat => 
            chat.name.toLowerCase().includes(q) ||
            chat.role.toLowerCase().includes(q) ||
            chat.preview.toLowerCase().includes(q)
        );
    }

    if (mainFeedCard) {
        mainFeedCard.style.display = (filtered.length === 0 && !isSearching && filter === 'all') ? 'none' : 'block';
    }

    if (filtered.length === 0) {
        if (isSearching) {
            container.innerHTML = `
                        <div class="py-12 px-6 text-center space-y-3">
                            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                                <i class="fa-solid fa-magnifying-glass text-lg"></i>
                            </div>
                            <div>
                                <h4 class="text-sm font-bold text-slate-900">No chats found</h4>
                                <p class="text-xs text-slate-500 mt-0.5 font-medium">No results for "${query}"</p>
                            </div>
                            <button onclick="openPoppyBotChatWithQuery('${query.replace(/'/g, "\\'")}')" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-brand-lime font-bold text-xs shadow-apple active:scale-95 transition-all">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                                <span>Ask Poppy AI "${query}"</span>
                            </button>
                        </div>
                    `;
        } else if (filter !== 'all') {
            container.innerHTML = `
                        <div class="py-12 px-6 text-center space-y-1">
                            <p class="text-sm font-bold text-slate-800">No ${filter} messages</p>
                            <p class="text-xs text-slate-400">You're all caught up!</p>
                        </div>
                    `;
        } else {
            container.innerHTML = '';
        }
        updateLifestyleBadges();
        return;
    }

    container.innerHTML = filtered.map(chat => renderLifestyleChatRow(chat, false)).join('');
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

    const chips = ['all', 'unread', 'channel', 'direct', 'ai'];
    chips.forEach(c => {
        const chip = document.getElementById(`filter-chip-${c}`);
        if (chip) {
            const extraGap = (c === 'unread' || c === 'ai') ? ' gap-1.5' : '';
            if (c === filter) {
                chip.className = "lifestyle-chat-chip shrink-0 px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-black bg-slate-900 text-brand-lime shadow-sm transition-all cursor-pointer flex items-center justify-center" + extraGap;
            } else {
                chip.className = "lifestyle-chat-chip shrink-0 px-4 py-2.5 min-h-[40px] rounded-xl text-xs font-bold text-slate-700 bg-white/70 backdrop-blur-xl border border-white/80 hover:text-slate-900 hover:bg-white shadow-2xs transition-all cursor-pointer flex items-center justify-center" + extraGap;
            }
        }
    });

    renderLifestyleChats(filter, currentLifestyleChatSearchQuery);
}

// =========================================================================
// CONVERSATION VIEW (WHATSAPP-INSPIRED SPEECH BUBBLES & THREAD)
// =========================================================================
function openLifestyleConversation(chatId) {
    triggerHaptic('medium');
    const chat = LIFESTYLE_CHATS.find(c => c.id === chatId);
    if (!chat) return;

    // Mark this conversation as read
    chat.unread = 0;
    renderLifestyleChats(currentLifestyleChatFilter, currentLifestyleChatSearchQuery);

    if (chat.id === 'chat-poppy') {
        openPoppyBotChat();
        return;
    }

    if (chat.name === 'Nathan Wild') {
        triggerConfetti();
    }

    const modalHtml = `
                <div class="flex flex-col h-[70vh] max-h-[550px] -mx-5 -mt-3 -mb-5 select-none">
                    
                    <!-- Top Thread Header -->
                    <div class="bg-white px-4 py-3 border-b border-slate-200/80 flex items-center justify-between shrink-0">
                        <div class="flex items-center gap-3 min-w-0">
                            <button onclick="closeModal()" aria-label="Back to messages" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 flex items-center justify-center text-slate-700 cursor-pointer">
                                <i class="fa-solid fa-chevron-left text-xs"></i>
                            </button>
                            <div class="min-w-0">
                                <h3 class="text-sm font-black text-slate-900 truncate leading-snug">${chat.name}</h3>
                                <p class="text-[11px] text-slate-500 font-semibold truncate leading-none mt-0.5">${chat.role} ${chat.isOnline ? '• Online' : ''}</p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 text-slate-700">
                            <button onclick="showToast('Call', 'Connecting call...')" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 flex items-center justify-center text-xs">
                                <i class="fa-solid fa-phone"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Messages Scroll Canvas -->
                    <div id="lifestyle-msg-scroll-area" class="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/70">
                        
                        <!-- Date Badge -->
                        <div class="text-center my-1">
                            <span class="inline-block px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[11px] font-bold text-slate-500 shadow-2xs border border-slate-200/60 uppercase tracking-wider">
                                Today
                            </span>
                        </div>

                        <!-- Message Bubbles -->
                        <div id="lifestyle-msg-list" class="space-y-2.5">
                            ${chat.messages.map(m => {
                        if (m.isIncoming) {
                            return `
                                        <div class="flex flex-col items-start max-w-[85%]">
                                            ${chat.isGroup && m.sender !== chat.name ? `<span class="text-[11px] font-bold text-slate-500 ml-1 mb-0.5">${m.sender}</span>` : ''}
                                            <div class="bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm p-3 shadow-2xs text-slate-900 text-xs leading-relaxed">
                                                <p class="break-words">${m.text}</p>
                                                <div class="text-right mt-1">
                                                    <span class="text-[11px] text-slate-400 font-medium">${m.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                        } else {
                            return `
                                        <div class="flex flex-col items-end max-w-[85%] ml-auto">
                                            <div class="bg-slate-900 text-white rounded-2xl rounded-tr-sm p-3 shadow-2xs text-xs leading-relaxed">
                                                <p class="break-words">${m.text}</p>
                                                <div class="flex items-center justify-end gap-1 mt-1 text-slate-400">
                                                    <span class="text-[11px] text-slate-400 font-medium">${m.time}</span>
                                                    <i class="fa-solid fa-check-double text-[11px] text-brand-lime"></i>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                        }
                    }).join('')}
                        </div>
                    </div>

                    <!-- Input Bar -->
                    <div class="bg-white p-3 border-t border-slate-200/80 flex items-center gap-2 shrink-0">
                        <div class="flex-1 relative flex items-center bg-slate-100 rounded-2xl px-3.5 py-2 border border-slate-200/80 focus-within:bg-white focus-within:border-slate-400 transition-all">
                            <input id="lifestyle-msg-input" 
                                   type="text" 
                                   placeholder="Reply to ${chat.name}..." 
                                   onkeydown="if(event.key === 'Enter') sendLifestyleMessage('${chat.id}')"
                                   class="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none">
                        </div>

                        <button onclick="sendLifestyleMessage('${chat.id}')" 
                                aria-label="Send message" 
                                class="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-slate-900 hover:bg-black text-brand-lime active:scale-90 flex items-center justify-center shadow-md transition-all shrink-0">
                            <i class="fa-solid fa-paper-plane text-xs"></i>
                        </button>
                    </div>
                </div>
            `;

    openModal("", modalHtml);

    setTimeout(() => {
        const scroller = document.getElementById('lifestyle-msg-scroll-area');
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
    }, 80);
}

function sendLifestyleMessage(chatId) {
    const input = document.getElementById('lifestyle-msg-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    triggerHaptic('light');
    const chat = LIFESTYLE_CHATS.find(c => c.id === chatId);
    if (!chat) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

    chat.messages.push({
        sender: 'You',
        text: text,
        time: timeStr,
        isIncoming: false
    });

    chat.preview = text;
    chat.time = timeStr;

    input.value = '';

    const list = document.getElementById('lifestyle-msg-list');
    if (list) {
        const msgEl = document.createElement('div');
        msgEl.className = "flex flex-col items-end max-w-[85%] ml-auto";
        msgEl.innerHTML = `
                    <div class="bg-slate-900 text-white rounded-2xl rounded-tr-sm p-3 shadow-2xs text-xs leading-relaxed">
                        <p class="break-words">${text}</p>
                        <div class="flex items-center justify-end gap-1 mt-1 text-slate-400">
                            <span class="text-[11px] text-slate-400 font-medium">${timeStr}</span>
                            <i class="fa-solid fa-check-double text-[11px] text-brand-lime"></i>
                        </div>
                    </div>
                `;
        list.appendChild(msgEl);
    }

    const scroller = document.getElementById('lifestyle-msg-scroll-area');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;

    renderLifestyleChats(currentLifestyleChatFilter, currentLifestyleChatSearchQuery);
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
                            <div class="w-9 h-9 rounded-xl bg-slate-900 text-[#AEB6C2] flex items-center justify-center font-bold text-sm">
                                <i class="fa-solid fa-house"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-slate-900">Company All-Hands</p>
                                <p class="text-xs text-slate-500">General broadcast channel</p>
                            </div>
                        </div>

                        <div onclick="closeModal(); openPoppyBotChat();" class="flex items-center gap-3 py-2.5 px-2 hover:bg-slate-50 cursor-pointer rounded-xl">
                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-lime to-emerald-400 text-slate-950 flex items-center justify-center font-bold text-sm shadow-sm">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
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
                                        <div class="w-9 h-9 rounded-xl bg-slate-900 text-brand-lime font-black text-xs flex items-center justify-center shadow-xs">
                                            ${m.initials}
                                        </div>
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
            unread: 0,
            avatarType: 'text',
            avatarBg: 'bg-slate-100 text-slate-800',
            avatarFallback: initials,
            messages: [
                { sender: name, text: `Hey Alexander, touching base regarding our allocation for next week.`, time: '9:00 am', isIncoming: true }
            ]
        };
        LIFESTYLE_CHATS.push(chat);
    }

    openLifestyleConversation(chat.id);
}
