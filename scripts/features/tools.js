/**
 * Tools & gear directory: render, search, category filter, status filter (the summary tiles).
 * Reads equipment and site names through the selectors (getTools, getSiteName); transfers go through
 * equipmentService (scripts/features/tool-transfer.js). Re-renders when equipment or sites change.
 */

let currentToolCategory = 'all';
let currentToolStatus = null;   // null = every status; otherwise a ToolStatus value (tapped summary tile)

// Summary tiles: tap to filter by that status, tap the active tile again to show every status
function filterToolsStatus(status) {
    triggerHaptic('light');
    currentToolStatus = currentToolStatus === status ? null : status;
    syncToolStatusTiles();
    filterToolsDirectory();
}

function syncToolStatusTiles() {
    const group = document.getElementById('tools-status-tiles');
    if (!group) return;
    group.classList.toggle('has-active', !!currentToolStatus);
    group.querySelectorAll('.tool-stat').forEach(tile => {
        const on = tile.dataset.status === currentToolStatus;
        tile.classList.toggle('is-active', on);
        tile.setAttribute('aria-pressed', String(on));
    });
}

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
        const matchesStatus = !currentToolStatus || t.status === currentToolStatus;
        const matchesSearch = t.name.toLowerCase().includes(query) ||
                              getSiteName(t.siteId).toLowerCase().includes(query) ||
                              t.status.toLowerCase().includes(query);
        return matchesCategory && matchesStatus && matchesSearch;
    });

    renderToolsDirectory(filtered);
}

// Opening Tools afresh (scripts/core/navigation.js): no search, "All" category, every status
function resetToolsView() {
    const input = document.getElementById('tools-search-input');
    if (input) input.value = '';
    currentToolCategory = 'all';
    currentToolStatus = null;
    syncToolStatusTiles();
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
                    <i class="ph-bold ph-magnifying-glass text-lg" aria-hidden="true"></i>
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

        // Status colour for the status label; the card is a plain dark surface (.tool-card, styles/tools.css)
        const statusTone = isAvailable ? 'is-available' : (isService ? 'is-service' : 'is-in-use');

        return `
            <div onclick="openToolTransferModal('${t.id}')"
                 data-tool-id="${t.id}"
                 role="button"
                 tabindex="0"
                 aria-label="${t.name} at ${getSiteName(t.siteId, 'an unknown site')}, ${t.status}"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openToolTransferModal('${t.id}');}"
                 class="tool-card relative overflow-hidden transition-all group active:scale-[0.985] cursor-pointer select-none">

                <!-- Header: equipment name, then [pin] site · status -->
                <div class="relative z-10">
                    <h4 class="tool-card-name">${t.name}</h4>
                    <p class="tool-card-meta">
                        <span class="tool-card-site">
                            <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
                            <span>${getSiteName(t.siteId, 'Unknown site')}</span>
                        </span>
                        ${t.quantity && t.quantity > 1 ? `
                            <span class="tool-card-sep" aria-hidden="true">·</span>
                            <span class="tool-card-qty">
                                <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                                <span>${t.quantity} ${t.unit || 'Units'}</span>
                            </span>
                        ` : ''}
                        <span class="tool-card-sep" aria-hidden="true">·</span>
                        <span class="tool-card-status ${statusTone}">${t.status === 'Service' ? 'Service • Until Pickup Ready' : t.status}</span>
                        ${t.moveRequestedToSiteId ? `
                            <span class="tool-card-request">
                                <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
                                <span>Requested → ${getSiteName(t.moveRequestedToSiteId, 'Unknown site')}</span>
                            </span>
                        ` : ''}
                    </p>
                </div>

                <!-- Footer: last transfer log and the card's action -->
                <div class="tool-card-foot relative z-10">
                    <div class="tool-card-log">
                        <span class="tool-card-clock" aria-hidden="true"><i class="fa-regular fa-clock"></i></span>
                        <div class="tool-card-log-text">
                            <span>Last log: <strong>${logInfo.dateText}</strong></span>
                            ${logInfo.byText ? `<span class="tool-card-by">${logInfo.byText}</span>` : ''}
                        </div>
                    </div>
                    ${isAvailable ? `
                        <button type="button"
                                onclick="event.stopPropagation(); openToolTransferModal('${t.id}')" 
                                aria-label="Transfer ${t.name}"
                                class="btn btn--card btn--glass-emerald tool-card-action">
                            <span>Transfer</span>
                            <i class="ph-bold ph-arrows-left-right" aria-hidden="true"></i>
                        </button>
                    ` : (isService ? `
                        <button type="button"
                                onclick="event.stopPropagation(); openToolTransferModal('${t.id}')" 
                                aria-label="${t.name} in service, unavailable until pickup ready"
                                class="btn btn--card btn--glass-amber tool-card-action">
                            <span>Pickup Pending</span>
                            <i class="ph-bold ph-lock-simple" aria-hidden="true"></i>
                        </button>
                    ` : `
                        <button type="button"
                                onclick="event.stopPropagation(); openToolTransferModal('${t.id}')" 
                                aria-label="Request move for ${t.name}"
                                class="btn btn--card btn--glass-blue tool-card-action">
                            <span>Request Move</span>
                            <i class="ph-bold ph-paper-plane-tilt" aria-hidden="true"></i>
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

// ---------------- Add equipment ----------------
// "+ Add" beside the Tools & Gear title. The form collects what a Tool needs; equipmentService.register
// validates, saves and audits it, and the store redraws the list (subscription above).
let registerToolCategory = null;

function openRegisterToolSheet() {
    triggerHaptic('light');
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    registerToolCategory = (currentToolCategory !== 'all') ? currentToolCategory : null;
    const hereId = getCurrentWorkingSiteId();
    const sites = getActiveSites();
    const label = 'block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1.5';
    const field = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-lime text-base';
    openModal('Add Equipment', `
        <form id="register-tool-form" class="space-y-4 pt-1" onsubmit="event.preventDefault(); submitRegisterTool();" novalidate>
            <div>
                <label for="register-tool-name" class="${label}">Name</label>
                <input id="register-tool-name" type="text" maxlength="80" autocomplete="off" enterkeyhint="next" placeholder="e.g. Makita Impact Driver" class="${field}">
            </div>
            <div>
                <span id="register-tool-category-label" class="${label}">Category</span>
                <div class="filter-bar filter-bar--wrap" role="radiogroup" aria-labelledby="register-tool-category-label">
                    ${ToolCategories.map(c => `<button type="button" role="radio" aria-checked="${c.id === registerToolCategory}" data-category="${esc(c.id)}" onclick="pickRegisterToolCategory(this)" class="filter-pill${c.id === registerToolCategory ? ' is-active' : ''}">${esc(c.label)}</button>`).join('')}
                </div>
            </div>
            <div>
                <label for="register-tool-site" class="${label}">Site</label>
                <select id="register-tool-site" class="${field}">
                    ${sites.map(s => `<option value="${esc(s.id)}"${s.id === hereId ? ' selected' : ''}>${esc(s.shortName)} · ${esc(s.address)}</option>`).join('')}
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label for="register-tool-qty" class="${label}">Quantity</label>
                    <input id="register-tool-qty" type="number" inputmode="numeric" min="1" max="9999" value="1" class="${field}">
                </div>
                <div>
                    <label for="register-tool-unit" class="${label}">Unit</label>
                    <input id="register-tool-unit" type="text" maxlength="20" autocomplete="off" placeholder="e.g. Props" class="${field}">
                </div>
            </div>
            <button type="submit" id="register-tool-submit" class="btn btn--primary btn--block">
                <i class="ph-bold ph-plus" aria-hidden="true"></i><span>Add Equipment</span>
            </button>
        </form>
    `);
}

function pickRegisterToolCategory(pill) {
    triggerHaptic('light');
    registerToolCategory = pill.dataset.category;
    pill.parentElement.querySelectorAll('.filter-pill').forEach(p => {
        const on = p === pill;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-checked', String(on));
    });
}

async function submitRegisterTool() {
    const val = id => (document.getElementById(id) || {}).value;
    const result = await runUiAction(() => equipmentService.register({
        name: val('register-tool-name'),
        category: registerToolCategory,
        siteId: val('register-tool-site'),
        quantity: val('register-tool-qty'),
        unit: val('register-tool-unit')
    }), { button: document.getElementById('register-tool-submit'), errorTitle: 'Equipment not added' });
    if (!result.ok) return;
    triggerHaptic('success');
    closeModal();
    // Show it: clear search and filters, then bring the new card into view with a brief highlight
    resetToolsView();
    requestAnimationFrame(() => {
        const card = document.querySelector(`[data-tool-id="${result.value.id}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('is-just-added');
        setTimeout(() => card.classList.remove('is-just-added'), 1600);
    });
}
