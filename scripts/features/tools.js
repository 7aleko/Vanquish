/**
 * Tools & gear directory: render, search, category filter.
 * Reads equipment and site names through the selectors (getTools, getSiteName); transfers go through
 * equipmentService (scripts/features/tool-transfer.js). Re-renders when equipment or sites change.
 */

let currentToolCategory = 'all';

function filterToolsCategory(category) {
    triggerHaptic('light');
    currentToolCategory = category;

    // Shared filter pills (scripts/components/filter-bar.js)
    setActiveFilterPill(document.getElementById('tool-cat-' + category.replace(/\s+/g, '-')));

    filterToolsDirectory();
}

function filterToolsDirectory() {
    const input = document.getElementById('tools-search-input');
    const clearBtn = document.getElementById('tools-clear-btn');
    if (!input) return;

    const query = input.value.toLowerCase().trim();
    if (clearBtn) clearBtn.classList.toggle('hidden', query === '');

    const filtered = getTools().filter(t => {
        const matchesCategory = (currentToolCategory === 'all' || t.category === currentToolCategory);
        const matchesSearch = t.name.toLowerCase().includes(query) ||
                              getSiteName(t.siteId).toLowerCase().includes(query) ||
                              t.status.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });

    renderToolsDirectory(filtered);
}

// Opening Tools afresh (scripts/core/navigation.js): no search, "All" category
function resetToolsView() {
    const input = document.getElementById('tools-search-input');
    if (input) input.value = '';
    currentToolCategory = 'all';
    setActiveFilterPill(document.getElementById('tool-cat-all'));
    filterToolsDirectory();
}

function clearToolsSearch() {
    const input = document.getElementById('tools-search-input');
    if (input) {
        input.value = '';
        filterToolsDirectory();
        input.focus();
    }
}

        function renderToolsDirectory(items) {
    const container = document.getElementById('tools-groups-container');
    if (!container) return;

    // Dynamically calculate counts using 'Service' strictly
    const availableCount = getTools().filter(t => t.status === ToolStatus.AVAILABLE).length;
    const inUseCount = getTools().filter(t => t.status === ToolStatus.IN_USE).length;
    const serviceCount = getTools().filter(t => t.status === ToolStatus.SERVICE).length;

    // Update the stat cards in the UI
    document.getElementById('stat-available').textContent = availableCount;
    document.getElementById('stat-inuse').textContent = inUseCount;
    document.getElementById('stat-service').textContent = serviceCount;
    if (typeof renderHomeNavList === 'function') renderHomeNavList();   // Home "N available"

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 space-y-2 bg-white/60 backdrop-blur-xl rounded-card border border-white/80 shadow-apple">
                <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <i class="fa-solid fa-magnifying-glass text-base"></i>
                </div>
                <p class="text-sm font-extrabold text-slate-800">No equipment found</p>
                <p class="text-xs text-slate-400">Try searching another term</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(t => {
        const isAvailable = t.status === ToolStatus.AVAILABLE;
        const isService = t.status === ToolStatus.SERVICE;
        const logInfo = parseToolLastLog(t.lastLogged);

        // Corner gradient colors strictly radiating from top-right apex (identical intensity across all 3 states)
        const theme = isAvailable ? {
            name: 'Available',
            cornerColor: 'rgba(16, 185, 129, 0.40)',
            cornerSoft: 'rgba(16, 185, 129, 0.10)',
            border: 'border-emerald-500/25 hover:border-emerald-500/40',
            statusText: 'text-emerald-600'
        } : (isService ? {
            name: 'Service',
            cornerColor: 'rgba(245, 158, 11, 0.40)',
            cornerSoft: 'rgba(245, 158, 11, 0.10)',
            border: 'border-amber-500/25 hover:border-amber-500/40',
            statusText: 'text-amber-600'
        } : {
            name: 'In Use',
            cornerColor: 'rgba(59, 130, 246, 0.40)',
            cornerSoft: 'rgba(59, 130, 246, 0.10)',
            border: 'border-blue-500/25 hover:border-blue-500/40',
            statusText: 'text-blue-600'
        });

        return `
            <div onclick="openToolTransferModal('${t.id}')"
                 role="button"
                 tabindex="0"
                 aria-label="${t.name} at ${getSiteName(t.siteId, 'an unknown site')}, ${t.status}"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openToolTransferModal('${t.id}');}"
                 class="relative overflow-hidden bg-white/85 backdrop-blur-2xl rounded-card p-5 shadow-apple border ${theme.border} transition-all space-y-3.5 group hover:shadow-apple-lg active:scale-[0.985] cursor-pointer select-none">
                <!-- Glassmorphic Corner Gradient Radiating strictly from Top-Right Corner (100% 0%) -->
                <div class="absolute top-0 right-0 w-36 h-36 pointer-events-none rounded-tr-[26px]"
                     style="background: radial-gradient(circle at 100% 0%, ${theme.cornerColor} 0%, ${theme.cornerSoft} 45%, transparent 75%);">
                </div>

                <!-- Header: Equipment Title & Inline Location/Status -->
                <div class="relative z-10 pr-6">
                    <h4 class="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug break-words">${t.name}</h4>
                    <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                        <span class="flex items-center gap-1.5 truncate">
                            <i class="fa-solid fa-location-dot text-xs text-slate-400 shrink-0"></i>
                            <span>Location: <strong class="text-slate-800 font-bold">${getSiteName(t.siteId, 'Unknown site')}</strong></span>
                        </span>
                        ${t.quantity && t.quantity > 1 ? `
                            <span class="text-slate-300">•</span>
                            <span class="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                                <i class="fa-solid fa-layer-group text-[11px] text-slate-400"></i>
                                <span>${t.quantity} ${t.unit || 'Units'}</span>
                            </span>
                        ` : ''}
                        <span class="text-slate-300">•</span>
                        <span class="font-bold ${theme.statusText}">${t.status === 'Service' ? 'Service • Until Pickup Ready' : t.status}</span>
                        ${t.moveRequestedToSiteId ? `
                            <span class="inline-flex items-center gap-1 font-extrabold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full text-[11px]">
                                <i class="fa-solid fa-paper-plane text-[11px]"></i>
                                <span>Requested → ${getSiteName(t.moveRequestedToSiteId, 'Unknown site')}</span>
                            </span>
                        ` : ''}
                    </p>
                </div>

                <!-- Footer Transfer Log Row -->
                <div class="relative z-10 pt-3.5 border-t border-slate-200/60 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 text-slate-500 font-medium text-xs min-w-0">
                        <div class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <i class="fa-regular fa-clock text-[11px]"></i>
                        </div>
                        <div class="flex flex-col leading-tight min-w-0">
                            <span class="truncate text-slate-500">Last log: <strong class="text-slate-800 font-bold">${logInfo.dateText}</strong></span>
                            ${logInfo.byText ? `<span class="text-[11px] font-semibold text-slate-400 truncate mt-0.5">${logInfo.byText}</span>` : ''}
                        </div>
                    </div>
                    ${isAvailable ? `
                        <button type="button"
                                onclick="event.stopPropagation(); openToolTransferModal('${t.id}')" 
                                aria-label="Transfer ${t.name}"
                                class="px-4 py-2.5 rounded-xl bg-slate-900 group-hover:bg-black text-brand-lime font-black transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-xs shadow-sm min-h-[44px] shrink-0">
                            <span>Transfer</span>
                            <i class="fa-solid fa-arrow-right-arrow-left text-xs"></i>
                        </button>
                    ` : (isService ? `
                        <button type="button"
                                onclick="event.stopPropagation(); openToolTransferModal('${t.id}')" 
                                aria-label="${t.name} in service, unavailable until pickup ready"
                                class="px-4 py-2.5 rounded-xl bg-slate-900 group-hover:bg-black text-amber-400 font-black transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-xs shadow-sm min-h-[44px] shrink-0">
                            <span>Pickup Pending</span>
                            <i class="fa-solid fa-lock text-[11px]"></i>
                        </button>
                    ` : `
                        <button type="button"
                                onclick="event.stopPropagation(); openToolTransferModal('${t.id}')" 
                                aria-label="Request move for ${t.name}"
                                class="px-4 py-2.5 rounded-xl bg-slate-900 group-hover:bg-black text-sky-400 font-black transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-xs shadow-sm min-h-[44px] shrink-0">
                            <span>Request Move</span>
                            <i class="fa-solid fa-paper-plane text-[11px]"></i>
                        </button>
                    `)}
                </div>
            </div>
        `;
    }).join('');
}

// Sites renamed or archived: redraw the list (names resolve from SITES)
subscribeSites(() => { if (document.getElementById('tools-search-input')) filterToolsDirectory(); });
appStore.subscribe(() => { if (document.getElementById('tools-search-input')) filterToolsDirectory(); }, ['equipment']);
