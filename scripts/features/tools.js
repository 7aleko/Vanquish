/**
 * Tools & gear directory: render, search, category filter, status filter (the summary tiles).
 * Reads equipment and site names through the selectors (getTools, getSiteName); transfers go through
 * equipmentService (scripts/features/tool-transfer.js). A tool in use offers Request Availability, and every
 * card shows its latest availability request (scripts/features/availability.js). Re-renders when equipment,
 * sites or availability requests change.
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

    // A grouped tool matches through any of its buckets (its locations and statuses)
    const filtered = getTools().filter(t => {
        const buckets = isGroupedTool(t) ? getToolAllocations(t.id) : null;
        const statuses = buckets ? buckets.map(a => a.status) : [t.status];
        const places = buckets ? buckets.map(a => allocationLocationLabel(a)) : [toolLocationLabel(t)];
        const matchesCategory = (currentToolCategory === 'all' || t.category === currentToolCategory);
        const matchesStatus = !currentToolStatus || statuses.includes(currentToolStatus);
        const matchesSearch = t.name.toLowerCase().includes(query) ||
                              places.some(p => p.toLowerCase().includes(query)) ||
                              statuses.some(v => toolStatusLabel(v).toLowerCase().includes(query) || v.toLowerCase().includes(query));
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

// Where a tool is, as the card shows it: a site, the Factory, or "Location to confirm" (unassigned)
function toolLocationLabel(tool) {
    if (!tool.siteId) return 'Location to confirm';
    return getSiteName(tool.siteId, 'Unknown location');
}
function allocationLocationLabel(alloc) { return toolLocationLabel({ siteId: alloc.siteId }); }
// Service is shown as "Out of Service" on grouped rows (the units are in the workshop / broken)
function toolStatusLabel(status) { return status === ToolStatus.SERVICE ? 'Out of Service' : status; }
function toolCountLabel() { return ''; }        // individual tools are single assets: no count chip
function escTool(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// A grouped (quantity-tracked) tool: name + "N Total", then one compact row per bucket - location · quantity
// status, and that bucket's action pill. With a status filter on, only that status's rows show.
function renderGroupedToolCard(t) {
    const rows = getToolAllocations(t.id).filter(a => !currentToolStatus || a.status === currentToolStatus);
    const tone = s => (s === ToolStatus.AVAILABLE ? 'is-available' : s === ToolStatus.SERVICE ? 'is-service' : 'is-in-use');
    const summary = rows.map(a => `${allocationLocationLabel(a)}, ${a.quantity} ${toolStatusLabel(a.status)}`).join('; ');
    return `
        <div onclick="openToolUnitsSheet('${t.id}')" data-tool-id="${t.id}" role="button" tabindex="0"
             aria-label="${escTool(t.name)}, ${t.totalQuantity} total: ${escTool(summary)}. Change status"
             onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openToolUnitsSheet('${t.id}');}"
             class="tool-card tool-card--grouped relative overflow-hidden transition-all group active:scale-[0.985] cursor-pointer select-none">
            <div class="tool-card-head relative z-10">
                <h4 class="tool-card-name">${escTool(t.name)}</h4>
                <span class="tool-card-total">${t.totalQuantity} Total</span>
            </div>
            <ul class="tool-alloc-list relative z-10">
                ${rows.map(a => {
                    const parts = allocationActionParts(t, a);
                    return `<li class="tool-alloc">
                        <div class="tool-alloc-row">
                            <span class="tool-alloc-text">
                                <i class="fa-solid ${isFactory(a.siteId) ? 'fa-industry' : 'fa-location-dot'}" aria-hidden="true"></i>
                                <span class="tool-alloc-loc">${escTool(allocationLocationLabel(a))}</span>
                                <span class="tool-card-sep" aria-hidden="true">·</span>
                                <span class="tool-alloc-qty tool-card-status ${tone(a.status)}">${a.quantity} ${toolStatusLabel(a.status)}</span>
                            </span>
                            ${parts.action}
                        </div>
                        ${parts.strip}
                    </li>`;
                }).join('')}
            </ul>
            ${t.needsReview ? `<p class="tool-card-review"><i class="ph-fill ph-warning" aria-hidden="true"></i>Counts migrated from older records - please check</p>` : ''}
        </div>`;
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

    // Tools (cards) with something in each status - the same cards each tile filters to
    const availableCount = countToolsWithStatus(ToolStatus.AVAILABLE);
    const inUseCount = countToolsWithStatus(ToolStatus.IN_USE);
    const serviceCount = countToolsWithStatus(ToolStatus.SERVICE);

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
        if (isGroupedTool(t)) return renderGroupedToolCard(t);
        const isAvailable = t.status === ToolStatus.AVAILABLE;
        const isService = t.status === ToolStatus.SERVICE;
        const logInfo = parseToolLastLog(t.lastLogged);

        // Status colour for the status label; the card is a plain dark surface (.tool-card, styles/tools.css)
        const statusTone = isAvailable ? 'is-available' : (isService ? 'is-service' : 'is-in-use');
        // The tool's availability request, if any (scripts/features/availability.js): a strip under the
        // meta line, and for a tool in use the Request Availability action (or its pending state)
        const avail = toolAvailabilityParts(t);

        return `
            <div onclick="openToolTransferModal('${t.id}')"
                 data-tool-id="${t.id}"
                 role="button"
                 tabindex="0"
                 aria-label="${t.name}${toolCountLabel(t) ? `, ${toolCountLabel(t)}` : ''}, ${t.siteId ? `at ${toolLocationLabel(t)}` : 'location to confirm'}, ${t.status}"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openToolTransferModal('${t.id}');}"
                 class="tool-card relative overflow-hidden transition-all group active:scale-[0.985] cursor-pointer select-none">

                <!-- Header: equipment name, then [pin] site · status -->
                <div class="relative z-10">
                    <h4 class="tool-card-name">${t.name}</h4>
                    <p class="tool-card-meta">
                        <span class="tool-card-site">
                            <i class="fa-solid ${isFactory(t.siteId) ? 'fa-industry' : 'fa-location-dot'}" aria-hidden="true"></i>
                            <span>${toolLocationLabel(t)}</span>
                        </span>
                        ${toolCountLabel(t) ? `
                            <span class="tool-card-sep" aria-hidden="true">·</span>
                            <span class="tool-card-qty">
                                <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
                                <span>${toolCountLabel(t)}</span>
                            </span>
                        ` : ''}
                        <span class="tool-card-sep" aria-hidden="true">·</span>
                        <span class="tool-card-status ${statusTone}">${t.status === 'Service' ? 'Service • Until Pickup Ready' : t.status}</span>
                    </p>
                    ${avail.strip}
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
                                class="btn btn--card btn--glass-emerald tool-card-action tool-pill">
                            <span>Transfer</span>
                        </button>
                    ` : (isService ? `
                        <button type="button"
                                onclick="event.stopPropagation(); openToolTransferModal('${t.id}')" 
                                aria-label="${t.name} in service, unavailable until pickup ready"
                                class="btn btn--card btn--glass-amber tool-card-action tool-pill">
                            <span>Pickup Pending</span>
                        </button>
                    ` : avail.action || '')}
                </div>
            </div>
        `;
    }).join('');
}

// Sites renamed or archived: redraw the list (names resolve from SITES)
subscribeSites(() => { if (document.getElementById('tools-search-input')) filterToolsDirectory(); });
appStore.subscribe(() => { if (document.getElementById('tools-search-input')) filterToolsDirectory(); },
    ['equipment', 'equipmentAllocations', 'availabilityRequests', 'chats', 'employees']);

// ---------------- Add equipment ----------------
// "+ Add" beside the Tools & Gear title. The form collects what a Tool needs; equipmentService.register
// validates, saves and audits it, and the store redraws the list (subscription above).
let registerToolCategory = null;

function openRegisterToolSheet() {
    triggerHaptic('light');
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    registerToolCategory = (currentToolCategory !== 'all') ? currentToolCategory : null;
    const hereId = getCurrentWorkingSiteId();
    const sites = getEquipmentLocations();
    const label = 'sheet-label';                          // the shared sheet field (styles/sheet.css)
    const field = 'sheet-input';
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

// ---------------- Grouped tools: change some units' status ----------------
// Tapping a grouped card: choose a bucket (where + status), how many, and the new status - Available, In Use
// or Out of Service. equipmentService.setUnitStatus moves them between buckets atomically; transfers stay on
// the rows' Transfer pills.
let unitsDraft = null;              // { toolId, from: { siteId, status }, toStatus }

function openToolUnitsSheet(toolId) {
    const tool = getToolById(toolId);
    const buckets = tool ? getToolAllocations(tool.id) : [];
    if (!tool || !buckets.length) return;
    triggerHaptic('light');
    const first = buckets[0];
    unitsDraft = { toolId: tool.id, from: { siteId: first.siteId, status: first.status }, toStatus: null };
    const label = 'sheet-label';                          // the shared sheet field (styles/sheet.css)
    openModal(tool.name, `
        <form id="units-form" class="space-y-4 pt-1" onsubmit="event.preventDefault(); submitToolUnits();" novalidate>
            <p class="av-sheet-hint">${tool.totalQuantity} total. Mark units available, in use or out of service where they are.</p>
            <div>
                <span id="units-from-label" class="${label}">Which units</span>
                <div class="units-buckets" role="radiogroup" aria-labelledby="units-from-label">
                    ${buckets.map((a, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-bucket="${i}"
                        class="units-bucket${i === 0 ? ' is-active' : ''}" onclick="pickUnitsBucket(${i})">
                        <span>${escTool(allocationLocationLabel(a))}</span><span class="tool-card-status ${a.status === ToolStatus.AVAILABLE ? 'is-available' : a.status === ToolStatus.SERVICE ? 'is-service' : 'is-in-use'}">${a.quantity} ${toolStatusLabel(a.status)}</span>
                    </button>`).join('')}
                </div>
            </div>
            <div>
                <span id="units-to-label" class="${label}">Change to</span>
                <div id="units-to" class="filter-bar filter-bar--wrap" role="radiogroup" aria-labelledby="units-to-label"></div>
            </div>
            <div class="qty-field">
                <span class="${label}">How many?</span>
                ${renderQtyStepper('units-qty', first.quantity, 'How many units')}
            </div>
            <button type="submit" id="units-submit" class="btn btn--primary btn--block" disabled>
                <i class="ph-bold ph-check" aria-hidden="true"></i><span>Update Status</span>
            </button>
        </form>`);
    renderUnitsTargets();
}
function unitsBuckets() { return unitsDraft ? getToolAllocations(unitsDraft.toolId) : []; }
function pickUnitsBucket(i) {
    const a = unitsBuckets()[i];
    if (!a) return;
    triggerHaptic('light');
    unitsDraft.from = { siteId: a.siteId, status: a.status };
    if (unitsDraft.toStatus === a.status) unitsDraft.toStatus = null;
    document.querySelectorAll('#units-form .units-bucket').forEach(b => {
        const on = Number(b.dataset.bucket) === i;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
    setQtyMax('units-qty', a.quantity);
    renderUnitsTargets();
}
function renderUnitsTargets() {
    const box = document.getElementById('units-to');
    if (!box || !unitsDraft) return;
    box.innerHTML = [ToolStatus.AVAILABLE, ToolStatus.IN_USE, ToolStatus.SERVICE].filter(s => s !== unitsDraft.from.status).map(s =>
        `<button type="button" role="radio" aria-checked="${s === unitsDraft.toStatus}" class="filter-pill${s === unitsDraft.toStatus ? ' is-active' : ''}"
            onclick="pickUnitsTarget('${s}')">${toolStatusLabel(s)}</button>`).join('');
    const submit = document.getElementById('units-submit');
    if (submit) submit.disabled = !unitsDraft.toStatus;
}
function pickUnitsTarget(status) {
    if (!unitsDraft) return;
    triggerHaptic('light');
    unitsDraft.toStatus = status;
    renderUnitsTargets();
}
async function submitToolUnits() {
    if (!unitsDraft || !unitsDraft.toStatus) return;
    const draft = { ...unitsDraft };
    const result = await runUiAction(() => equipmentService.setUnitStatus({
        toolId: draft.toolId, siteId: draft.from.siteId, fromStatus: draft.from.status, toStatus: draft.toStatus, quantity: readQty('units-qty')
    }), { button: document.getElementById('units-submit'), errorTitle: 'Status not changed', keepDisabled: () => !unitsDraft || !unitsDraft.toStatus });
    if (!result.ok) return;
    triggerHaptic('success');
    unitsDraft = null;
    closeModal();
}
