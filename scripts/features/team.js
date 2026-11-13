/**
 * Team directory: render, search, category filter, contact sheet.
 */

    function renderTeamDirectory(members) {
const container = document.getElementById('team-directory-list');
if (!container) return;

if (members.length === 0) {
    container.innerHTML = `
            <div class="text-center py-12 space-y-2 bg-white/80 backdrop-blur-xl rounded-card border border-white/90 shadow-apple">
                <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <i class="fa-solid fa-magnifying-glass text-base"></i>
                </div>
                <p class="text-sm font-extrabold text-slate-800">No team members found</p>
                <p class="text-xs text-slate-400">Try searching another name or role</p>
            </div>
        `;
    return;
}

// Render as a clean, unified iOS Inset Grouped Card
container.innerHTML = `
        <div class="bg-white/80 backdrop-blur-2xl rounded-card shadow-apple border border-white/90 overflow-hidden divide-y divide-slate-100">
            ${members.map(m => {
            const isOnLeave = m.status === 'On Leave';
            return `
                    <div onclick="openTeamContactModal('${m.id}')" class="p-4 hover:bg-slate-50/80 cursor-pointer transition-all flex items-center justify-between group active:bg-slate-100/60 min-h-[68px]">
                        <div class="flex items-center space-x-3.5 min-w-0">
                            ${renderRoleAvatar(m, 'lg')}
                            <div class="min-w-0 pr-2">
                                <div class="flex items-center gap-2">
                                    <h4 class="text-base font-black text-slate-900 tracking-tight truncate">${m.name}</h4>
                                </div>
                                <!-- Status only when it's the exception: "On Leave" shows, "Active" (the default) doesn't -->
                                <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span class="text-xs font-bold text-slate-700">${m.role}</span>
                                    ${isOnLeave ? `<span class="text-slate-300">•</span>
                                    <span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">${m.status}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-brand-lime flex items-center justify-center transition-colors shadow-inner">
                                <i class="fa-solid fa-chevron-right text-xs"></i>
                            </span>
                        </div>
                    </div>
                `;
        }).join('')}
        </div>
    `;
}

function clearTeamSearch() {
    const input = document.getElementById('team-search-input');
    if (input) {
        input.value = '';
        filterTeamDirectory();
        input.focus();
    }
}

function getMemberSite(member) {
    if (['David Hilt', 'Jude Hudson', 'Trent Jamieson', 'Lachlan Swatosch', 'Alexander Floratos', 'Brad Davis'].includes(member.name)) {
        return 'Lugarno Site • Block A';
    } else if (['Curtis Bell', 'Brendan Hodge', 'Jeremy G.'].includes(member.name)) {
        return 'Castlecrag Hub • Lot 8';
    } else if (['Marcus Russo', 'Luke Parkes', 'Lisa Isemonger', 'Shanelle Organista'].includes(member.name)) {
        return 'Caringbah HQ & Warehouse';
    } else {
        return 'Miranda Commercial Site';
    }
}

function openTeamContactModal(memberId) {
    const member = TEAM_DIRECTORY_DATA.find(m => m.id === memberId);
    if (!member) return;

    const isOnLeave = member.status === 'On Leave';

    openModal("", `
                <div class="space-y-5 pt-1 pb-2">
                    <!-- Profile Hero Section (Apple Contacts Hero) -->
                    <div class="flex flex-col items-center text-center">
                        <!-- Prominent 88px Squircle Avatar with Apple Presence Indicator -->
                        <div class="relative mb-3">
                            <div class="w-20 h-20 sm:w-22 sm:h-22 rounded-card bg-gradient-to-br from-slate-900 via-[#141b24] to-slate-950 text-brand-lime font-black text-2xl sm:text-3xl flex items-center justify-center shadow-xl shadow-slate-950/25 border-2 border-slate-800">
                                ${member.initials}
                            </div>
                            <!-- Clean Apple Presence Status Dot -->
                            <span class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${isOnLeave ? 'bg-amber-400' : 'bg-emerald-500'} border-[2.5px] border-white shadow-sm"></span>
                        </div>
                        
                        <!-- Member Name in Confident Apple Typography -->
                        <h3 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">${member.name}</h3>
                        
                        <!-- Role & Apple Status Badges -->
                        <div class="flex items-center justify-center gap-2 mt-2.5">
                            <span class="text-xs font-black bg-slate-900 text-brand-lime px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs">${member.role}</span>
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isOnLeave ? 'bg-amber-50 text-amber-700 border border-amber-200/80' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'} shadow-2xs">
                                <span class="w-1.5 h-1.5 rounded-full ${isOnLeave ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                                <span>${isOnLeave ? 'On Leave' : 'Active'}</span>
                            </span>
                        </div>
                    </div>

                    <!-- Apple HIG 3-Column Action Cards Bar (Call, Message, Email) -->
                    <div class="grid grid-cols-3 gap-3 pt-1">
                        <!-- Action 1: Call -->
                        <button onclick="closeModal(); showToast('Calling', 'Dialing ${member.phone}...');" aria-label="Call ${member.name}" class="flex flex-col items-center justify-center py-4 px-3 min-h-[86px] rounded-2xl bg-slate-100 hover:bg-slate-200/90 active:scale-95 transition-all cursor-pointer border border-slate-200/70 shadow-xs group">
                            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-xl mb-1.5 group-hover:scale-110 transition-transform">
                                <i class="fa-solid fa-phone"></i>
                            </div>
                            <span class="text-xs sm:text-[13px] font-extrabold text-slate-800 tracking-tight">Call</span>
                        </button>

                        <!-- Action 2: Message -->
                        <button onclick="closeModal(); showToast('Messages', 'Opening SMS thread with ${member.name}');" aria-label="Text ${member.name}" class="flex flex-col items-center justify-center py-4 px-3 min-h-[86px] rounded-2xl bg-slate-100 hover:bg-slate-200/90 active:scale-95 transition-all cursor-pointer border border-slate-200/70 shadow-xs group">
                            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-xl mb-1.5 group-hover:scale-110 transition-transform">
                                <i class="fa-solid fa-comment-dots"></i>
                            </div>
                            <span class="text-xs sm:text-[13px] font-extrabold text-slate-800 tracking-tight">Message</span>
                        </button>

                        <!-- Action 3: Email -->
                        <button onclick="closeModal(); showToast('Email', 'Drafting email to ${member.email}');" aria-label="Email ${member.name}" class="flex flex-col items-center justify-center py-4 px-3 min-h-[86px] rounded-2xl bg-slate-100 hover:bg-slate-200/90 active:scale-95 transition-all cursor-pointer border border-slate-200/70 shadow-xs group">
                            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-xl mb-1.5 group-hover:scale-110 transition-transform">
                                <i class="fa-solid fa-envelope"></i>
                            </div>
                            <span class="text-xs sm:text-[13px] font-extrabold text-slate-800 tracking-tight">Email</span>
                        </button>
                    </div>

                    <!-- Apple Inset Grouped Details Card -->
                    <div class="bg-slate-100/80 border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-200/70 shadow-xs">
                        <!-- Phone Row -->
                        <div class="p-4 sm:p-4.5 flex items-center justify-between hover:bg-white/60 transition-colors">
                            <div class="min-w-0 pr-3">
                                <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Mobile Number</span>
                                <a href="tel:${member.phone.replace(/\s+/g, '')}" class="text-base sm:text-lg font-black text-slate-900 hover:text-emerald-600 transition-colors tracking-tight truncate block mt-0.5">${member.phone}</a>
                            </div>
                            <button onclick="copyToClipboard('${member.phone}', 'Phone number copied to clipboard')" aria-label="Copy phone number" class="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-900 hover:text-brand-lime text-slate-800 border border-slate-200/80 text-xs font-black transition-all shrink-0 active:scale-90 flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]">
                                <i class="fa-regular fa-copy text-xs"></i>
                                <span>Copy</span>
                            </button>
                        </div>

                        <!-- Email Row -->
                        <div class="p-4 sm:p-4.5 flex items-center justify-between hover:bg-white/60 transition-colors">
                            <div class="min-w-0 pr-3">
                                <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Email Address</span>
                                <a href="mailto:${member.email}" class="text-sm sm:text-base font-black text-slate-900 hover:text-blue-600 transition-colors tracking-tight truncate block mt-0.5">${member.email}</a>
                            </div>
                            <button onclick="copyToClipboard('${member.email}', 'Email copied to clipboard')" aria-label="Copy email" class="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-900 hover:text-brand-lime text-slate-800 border border-slate-200/80 text-xs font-black transition-all shrink-0 active:scale-90 flex items-center gap-1.5 cursor-pointer shadow-xs min-h-[44px]">
                                <i class="fa-regular fa-copy text-xs"></i>
                                <span>Copy</span>
                            </button>
                        </div>

                        <!-- Birthday Row (No Apprentice / Category badge) -->
                        <div class="p-4 sm:p-4.5 flex items-center justify-between hover:bg-white/60 transition-colors">
                            <div>
                                <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Birthday</span>
                                <span class="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-0.5">
                                    <i class="fa-solid fa-cake-candles text-amber-500 text-sm"></i>
                                    <span>${member.birthday ? member.birthday : 'Not listed'}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- In-App Direct Message Action (Primary CTA) -->
                    <button onclick="closeModal(); openDirectMessage('${member.name}');" class="btn-primary w-full py-4 bg-slate-900 hover:bg-black text-brand-lime rounded-2xl transition-all cursor-pointer shadow-apple active:scale-[0.98] flex items-center justify-center gap-2.5 min-h-[52px]">
                        <i class="fa-solid fa-comment text-brand-lime text-base"></i>
                        <span>Start Conversation</span>
                    </button>
                </div>
            `);
}

let currentTeamCategory = 'all';

function filterTeamCategory(category) {
    triggerHaptic('light');
    currentTeamCategory = category;

    // Shared filter pills (scripts/components/filter-bar.js)
    setActiveFilterPill(document.getElementById('team-cat-' + category.replace(/\s+/g, '-')));

    filterTeamDirectory();
}

function filterTeamDirectory() {
    const input = document.getElementById('team-search-input');
    const clearBtn = document.getElementById('team-clear-btn');
    if (!input) return;

    const query = input.value.toLowerCase().trim();
    if (clearBtn) clearBtn.classList.toggle('hidden', query === '');

    const filtered = TEAM_DIRECTORY_DATA.filter(m => {
        const matchesCategory = (currentTeamCategory === 'all' || m.category === currentTeamCategory);
        const matchesSearch = m.name.toLowerCase().includes(query) ||
                            m.role.toLowerCase().includes(query) ||
                            m.category.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });

    renderTeamDirectory(filtered);
}
