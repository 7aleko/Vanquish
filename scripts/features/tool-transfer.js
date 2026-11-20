/**
 * Tool transfer sheet: the tool, a From -> To route (tap the To card for the site list), quantity, note,
 * confirm, gestures. Layout and colours: styles/tool-transfer.css; the route and the action take the
 * tool's status colour (emerald transfer, blue move request, amber service hold).
 */

let currentTransferTool = null;
let currentTransferToIndex = 0;
// The "To" choices: the active sites (SITES), taken when the sheet opens so the list's order holds while
// it is open
let transferSites = [];

// Today's rostered site (ROSTER), as a siteId
function getCurrentWorkingSiteId() {
    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    return getRosteredSiteId(today);
}

function parseToolLastLog(lastLogged) {
    if (!lastLogged) return { dateText: 'N/A', byText: '' };
    const parts = String(lastLogged).split(/\s+by\s+/i);
    if (parts.length >= 2) {
        return {
            dateText: parts[0].trim(),
            byText: `by ${parts.slice(1).join(' by ').trim()}`
        };
    }
    return { dateText: String(lastLogged).trim(), byText: '' };
}

function getToolCategoryIcon(category) {
    const map = {
        'power tools': 'fa-solid fa-screwdriver-wrench',
        'setout': 'fa-solid fa-compass-drafting',
        'access': 'fa-solid fa-stairs',
        'concrete': 'fa-solid fa-trowel-bricks',
        'safety': 'fa-solid fa-kit-medical',
        'trailers': 'fa-solid fa-trailer',
        'scaffolds': 'fa-solid fa-layer-group',
        'bobcat': 'fa-solid fa-tractor',
        'site': 'fa-solid fa-helmet-safety'
    };
    return map[(category || '').toLowerCase()] || 'fa-solid fa-screwdriver-wrench';
}

function updateTransferConfirmButtonLabel() {
    if (!currentTransferTool) return;
    const btnLabel = document.getElementById('transfer-confirm-btn-label');
    if (!btnLabel) return;

    const tool = currentTransferTool;
    const isService = tool.status === 'Service';
    const isBulk = Boolean(tool.quantity && tool.quantity > 1);

    if (isService) {
        btnLabel.textContent = 'Unavailable Until Pickup Ready';
    } else if (isBulk) {
        btnLabel.textContent = `Transfer ${readQty('transfer-qty')} of ${tool.quantity}`;
    } else {
        btnLabel.textContent = 'Transfer Equipment';
    }
}

// A grouped (quantity-tracked) tool transfers from one bucket: its available units at `fromSiteId` (null =
// the unassigned location). The sheet then works on a view of that bucket - its location, Available, and its
// count as the quantity - so the stepper can never offer more than the bucket holds.
let currentTransferAllocation = null;

function openToolTransferModal(toolId, fromSiteId) {
    triggerHaptic('medium');
    const record = getToolById(toolId);
    if (!record) return;
    currentTransferAllocation = null;
    let tool = record;
    // In use: there's no moving it from here - ask its site. An open request opens in the site chat; otherwise
    // the Request Availability sheet (the same as the card's blue pill). No site chat: the card says so.
    if (!isGroupedTool(record) && record.status === ToolStatus.IN_USE) {
        const av = getToolAvailability(record.id);
        if (av && av.active) openAvailabilityRequest(av.id);
        else if (avCanAsk(record.siteId)) openRequestAvailability(record.id);
        return;
    }
    if (isGroupedTool(record)) {
        const from = fromSiteId === undefined ? undefined : (fromSiteId || null);
        const bucket = getToolAllocations(record.id).find(a => a.status === ToolStatus.AVAILABLE && (from === undefined || a.siteId === from));
        if (!bucket) return;                                  // nothing available to move
        currentTransferAllocation = bucket;
        tool = { ...record, siteId: bucket.siteId, status: ToolStatus.AVAILABLE, quantity: bucket.quantity };
    }

    currentTransferTool = tool;

    const isAvailable = tool.status === ToolStatus.AVAILABLE;
    const isService = tool.status === 'Service';
    const isBulk = Boolean(tool.quantity && tool.quantity > 1);

    // Copy and colour for the tool's status (styles/tool-transfer.css reads data-tone)
    const mode = isAvailable ? {
        tone: 'available', title: 'Transfer Equipment', subtitle: 'Available now \u2014 assign to a new site',
        toLabel: 'Transfer To', note: 'e.g. Framing stage', cta: 'sheet-btn',
        icon: 'ph-bold ph-arrows-left-right', glow: 'bg-emerald-400/15'
    } : {
        tone: 'service', title: 'Workshop Service Hold', subtitle: 'Unavailable until workshop pickup is ready',
        toLabel: 'Transfer To', note: '', cta: 'sheet-btn is-tone-amber',
        icon: 'ph-bold ph-lock-simple', glow: 'bg-amber-400/15'
    };
    const byId = id => document.getElementById(id);

    byId('transfer-modal-title').textContent = mode.title;
    byId('transfer-modal-subtitle').textContent = mode.subtitle;

    // 1. The tool: name, then category, units and where it is
    const category = (ToolCategories.find(c => c.id === tool.category) || { label: tool.category }).label;
    byId('transfer-tool-name').textContent = tool.name;
    byId('transfer-tool-meta').textContent = [category, toolLocationLabel(tool)]                        // the count is beside the stepper
        .filter(Boolean).join(' \u00b7 ');
    byId('transfer-tool-icon').className = getToolCategoryIcon(tool.category);

    // Service hold: explain why, lock the route and hide the inputs
    const banner = byId('transfer-status-banner');
    banner.hidden = !isService;
    if (isService) {
        byId('transfer-status-banner-title').textContent = 'Unavailable until pickup is ready';
        byId('transfer-status-banner-desc').textContent = `Logged ${tool.lastLogged || 'by Workshop'}. It's being serviced and can't be transferred until the workshop has it ready.`;
    }
    byId('transfer-route').dataset.tone = mode.tone;
    byId('transfer-to-label').textContent = mode.toLabel;
    byId('transfer-to-card').disabled = isService;
    byId('transfer-inputs-wrapper').hidden = isService;
    setTransferSiteListOpen(false);

    const descInput = byId('transfer-input-desc');
    if (descInput) descInput.placeholder = mode.note;

    const confirmBtn = byId('transfer-confirm-btn');
    confirmBtn.className = mode.cta;
    confirmBtn.disabled = isService;
    byId('transfer-confirm-btn-icon').className = mode.icon;
    setUiActionError(confirmBtn, '', '');

    // From: the location's name, and a meaningful second line or none at all
    byId('transfer-from-name').textContent = toolLocationLabel(tool);
    const fromSub = byId('transfer-from-log');
    fromSub.textContent = transferLocationSubtitle(tool.siteId);
    fromSub.hidden = !fromSub.textContent;
    const fromSite = getSiteById(tool.siteId);
    byId('transfer-from-icon').className = (fromSite && fromSite.icon) || 'ph-fill ph-map-pin';

    // To: where you're signed in today, if that's somewhere else; otherwise as before - today's rostered site
    // unless the tool is already there
    transferSites = getEquipmentLocations();     // the factory and the active construction sites
    const activeSiteId = transferActiveSiteId();
    const workingSiteId = getCurrentWorkingSiteId();
    let defaultIndex = activeSiteId && activeSiteId !== tool.siteId ? transferSites.findIndex(s => s.id === activeSiteId) : -1;
    if (defaultIndex === -1) {
        defaultIndex = transferSites.findIndex(s => s.id === workingSiteId);
        if (tool.siteId === workingSiteId || defaultIndex === -1) {
            const altIndex = transferSites.findIndex(s => s.id !== tool.siteId);
            defaultIndex = altIndex !== -1 ? altIndex : 0;
        }
    }
    currentTransferToIndex = defaultIndex;
    buildTransferChips(tool.siteId, activeSiteId);

    // How many: a stepper in the tool card when the source bucket holds more than one unit
    renderTransferQuantity();

    // Status at destination: only for a real move; In Use unless changed
    byId('transfer-status-section').hidden = !isAvailable;
    setTransferArrivalStatus(ToolStatus.IN_USE, true);

    renderTransferDestination();
    if (descInput) descInput.value = '';

    // Animate open
    const overlay = document.getElementById('tool-transfer-modal-overlay');
    const sheet = document.getElementById('tool-transfer-sheet');
    if (overlay && sheet) {
        sheet.classList.remove('is-dragging');
        sheet.classList.remove('translate-y-[120%]');
        sheet.style.transform = 'translate3d(0, 100%, 0)';
        sheet.style.transition = 'none';

        overlay.classList.remove('pointer-events-none', 'opacity-0');
        overlay.setAttribute('aria-hidden', 'false');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                sheet.style.transition = 'transform var(--sheet-enter) var(--sheet-ease)';   // the shared sheet motion
                sheet.style.transform = 'translate3d(0, 0, 0)';
                syncDynamicStatusBar();
            });
        });
    }
}

// ---------------- Quantity (grouped tools) ----------------
// The limit is the source bucket's own count - never the tool's total, which includes units elsewhere or out
// of service. renderTransferQuantity draws it; the store subscription below re-checks it while the sheet is open.
function renderTransferQuantity() {
    const row = document.getElementById('transfer-qty-row');
    if (!row) return;
    const tool = currentTransferTool;
    const max = currentTransferAllocation && tool ? tool.quantity : 0;
    row.hidden = max <= 1;
    row.innerHTML = max > 1
        ? `${renderQtyStepper('transfer-qty', max, `How many ${tool.name} to transfer`)}<span id="transfer-qty-of" class="tt-qty-of">of ${max} available</span>`
        : '<output id="transfer-qty" data-max="1" hidden>1</output>';
}
// The stepper changed: the button says how many
document.addEventListener('qtychange', e => {
    if (e.target && e.target.id === 'transfer-qty') updateTransferConfirmButtonLabel();
});
// Kept for older callers
function adjustTransferQuantity(delta) { stepQty('transfer-qty', delta); }

// The source bucket as it is now (another person may have moved units since the sheet opened)
function liveTransferBucket() {
    const b = currentTransferAllocation;
    if (!b) return null;
    return getToolAllocations(b.toolId).find(a => a.status === ToolStatus.AVAILABLE && (a.siteId || null) === (b.siteId || null)) || null;
}
appStore.subscribe(() => {
    const overlay = document.getElementById('tool-transfer-modal-overlay');
    if (!overlay || overlay.classList.contains('opacity-0') || !currentTransferAllocation || !currentTransferTool) return;
    const live = liveTransferBucket();
    const btn = document.getElementById('transfer-confirm-btn');
    if (!live) {
        btn.disabled = true;
        setUiActionError(btn, 'Nothing left to transfer', `No ${currentTransferTool.name} are available at ${toolLocationLabel(currentTransferTool)} any more.`);
        return;
    }
    if (live.quantity === currentTransferTool.quantity) return;
    const keep = readQty('transfer-qty');
    currentTransferAllocation = live;
    currentTransferTool = { ...currentTransferTool, quantity: live.quantity };
    renderTransferQuantity();
    if (live.quantity > 1) { document.getElementById('transfer-qty').textContent = Math.min(keep, live.quantity); stepQty('transfer-qty', 0, true); }
    updateTransferConfirmButtonLabel();
}, ['equipmentAllocations']);

// ---------------- From: the second line ----------------
// A street address; the factory reads "Main Warehouse"; nothing meaningful -> no line at all
function transferLocationSubtitle(siteId) {
    const site = siteId ? getSiteById(siteId) : null;
    if (!site) return '';
    if (site.kind === 'factory') return 'Main Warehouse';
    const line = String(site.address || '').trim();
    return /^(n\/a|null|undefined|-)$/i.test(line) ? '' : shortStreetAddress(line);
}

// ---------------- To: My Site and quick chips ----------------
// Where the signed-in person is signed in today (attendance, the Home card's day) - the only source for "My Site"
function transferActiveSiteId() {
    const rec = typeof getMyAttendance === 'function' ? getMyAttendance(homeAttendanceDay()) : null;
    return rec && !rec.signedOutAt && isSiteActive(rec.siteId) ? rec.siteId : null;
}
let transferChips = [];             // [{ siteId, label, mine }]
// My Site (if signed in somewhere other than the source), then the factory and the person's own sites - up to
// three more, never the source, never twice - then More (the full list)
function buildTransferChips(fromSiteId, activeSiteId) {
    const usable = id => id && id !== fromSiteId && transferSites.some(s => s.id === id);
    const chips = [];
    if (usable(activeSiteId)) chips.push({ siteId: activeSiteId, label: 'My Site', mine: true });
    const mine = typeof getSiteHubSites === 'function' ? getSiteHubSites().map(s => (typeof s === 'string' ? s : s.id)) : [];
    const factory = transferSites.find(s => s.kind === 'factory');
    [factory && factory.id, ...mine].forEach(id => {
        if (chips.length >= (activeSiteId && usable(activeSiteId) ? 4 : 3) || !usable(id) || chips.some(c => c.siteId === id)) return;
        chips.push({ siteId: id, label: getSiteName(id), mine: false });
    });
    transferChips = chips;
    renderTransferChips();
}
function renderTransferChips() {
    const box = document.getElementById('transfer-chips');
    if (!box) return;
    const chosen = transferSites[currentTransferToIndex];
    const card = document.getElementById('transfer-to-card');
    box.hidden = !!(card && card.disabled) || !transferChips.length;
    box.innerHTML = transferChips.map(c => {
        const on = !!chosen && chosen.id === c.siteId;
        const name = getSiteName(c.siteId);
        return `<button type="button" class="tt-chip${on ? ' is-active' : ''}${c.mine ? ' is-mine' : ''}" aria-pressed="${on}"
            aria-label="${c.mine ? `My Site, ${name}` : name}" onclick="chooseTransferChip('${c.siteId}')">
            ${c.mine ? '<i class="ph-fill ph-map-pin" aria-hidden="true"></i>' : ''}<span>${c.label}</span></button>`;
    }).join('') + `<button type="button" class="tt-chip tt-chip--more" aria-label="More destinations" onclick="toggleTransferSiteList()">More<i class="ph-bold ph-caret-down" aria-hidden="true"></i></button>`;
}
function chooseTransferChip(siteId) {
    const index = transferSites.findIndex(s => s.id === siteId);
    if (index === -1) return;
    triggerHaptic('light');
    currentTransferToIndex = index;
    renderTransferDestination();
    setTransferSiteListOpen(false);
}

// ---------------- Status at destination ----------------
let transferArrivalStatus = ToolStatus.IN_USE;
function setTransferArrivalStatus(status, silent) {
    if (status !== ToolStatus.IN_USE && status !== ToolStatus.AVAILABLE) return;
    if (!silent) triggerHaptic('light');
    transferArrivalStatus = status;
    document.querySelectorAll('#transfer-status-section .sheet-seg').forEach(b => {
        const on = b.dataset.status === status;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
}

function closeToolTransferModal(fromDrag = false, startYOffset = 0, releaseVelocity = 0) {
    triggerHaptic('light');
    setTransferSiteListOpen(false);
    const overlay = document.getElementById('tool-transfer-modal-overlay');
    const sheet = document.getElementById('tool-transfer-sheet');
    if (!overlay || !sheet) return;

    sheet.classList.remove('is-dragging');
    const sheetH = sheet.offsetHeight || 500;
    const exitTarget = sheetH + 50;

    let duration = 0.32;
    if (fromDrag) {
        const remaining = Math.max(0, exitTarget - startYOffset);
        const projectedSpeed = Math.max(releaseVelocity, 1.2);
        duration = Math.min(Math.max(remaining / (projectedSpeed * 1000), 0.20), 0.32);
    }

    sheet.style.transition = `transform ${duration}s cubic-bezier(0.32, 0.72, 0, 1)`;
    sheet.style.transform = `translate3d(0, ${exitTarget}px, 0)`;
    overlay.classList.add('pointer-events-none', 'opacity-0');
    overlay.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
        sheet.classList.add('translate-y-[120%]');
        sheet.style.transition = '';
        sheet.style.transform = '';
        syncDynamicStatusBar();
    }, duration * 1000 + 20);
}

// Street line for a card: shortened street types ("1a Yelambie St"), so it fits on one line
function shortStreetAddress(address) {
    const abbr = { Street: 'St', Road: 'Rd', Avenue: 'Ave', Parade: 'Pde', Esplanade: 'Esp', Place: 'Pl', Drive: 'Dr',
        Lane: 'Ln', Highway: 'Hwy', Crescent: 'Cres', Terrace: 'Tce', Boulevard: 'Blvd', Court: 'Ct' };
    return String(address || '').replace(/\b(Street|Road|Avenue|Parade|Esplanade|Place|Drive|Lane|Highway|Crescent|Terrace|Boulevard|Court)\b/g, w => abbr[w]);
}

// The To card shows the chosen destination
function renderTransferDestination() {
    const site = transferSites[currentTransferToIndex];
    if (!site) return;
    document.getElementById('transfer-to-name').textContent = site.shortName;
    document.getElementById('transfer-to-icon').className = site.icon || 'fa-solid fa-helmet-safety';
    document.getElementById('transfer-to-card').setAttribute('aria-label',
        `${document.getElementById('transfer-to-label').textContent}: ${site.shortName}, ${site.address}. Change destination`);
    const sub = transferLocationSubtitle(site.id);
    document.getElementById('transfer-to-addr').textContent = sub;
    document.getElementById('transfer-to-addr').hidden = !sub;
    renderTransferChips();                        // the chips always show the chosen destination
    updateTransferConfirmButtonLabel();
}

// The destination list: every active site; the tool's own site is shown but can't be chosen
function renderTransferSiteList() {
    const list = document.getElementById('transfer-site-list');
    if (!list) return;
    const here = currentTransferTool ? currentTransferTool.siteId : null;
    list.innerHTML = transferSites.map((site, idx) => {
        const selected = idx === currentTransferToIndex;
        const isHere = site.id === here;
        return `
            <button type="button" role="option" id="transfer-site-option-${idx}" class="tt-site-option" tabindex="-1"
                    aria-selected="${selected}" ${isHere ? 'aria-disabled="true"' : ''} onclick="chooseTransferSite(${idx})">
                <span class="tt-site-option-icon" aria-hidden="true"><i class="${site.icon || 'fa-solid fa-helmet-safety'}"></i></span>
                <span class="tt-site-option-text">
                    <span class="tt-site-option-name">${site.shortName}</span>
                    <span class="tt-site-option-sub">${isHere ? 'Current site' : transferLocationSubtitle(site.id)}</span>
                </span>
                <i class="ph-bold ph-check tt-site-option-check" aria-hidden="true"></i>
            </button>`;
    }).join('');
}

function setTransferSiteListOpen(open) {
    const list = document.getElementById('transfer-site-list');
    const card = document.getElementById('transfer-to-card');
    if (!list || !card) return;
    if (open) renderTransferSiteList();
    list.hidden = !open;
    card.setAttribute('aria-expanded', String(open));
    if (open) {
        list.style.setProperty('--tone-fill', getComputedStyle(document.getElementById('transfer-route')).getPropertyValue('--tone-fill'));
        list.style.setProperty('--tone-ink', getComputedStyle(document.getElementById('transfer-route')).getPropertyValue('--tone-ink'));
        const chosen = document.getElementById(`transfer-site-option-${currentTransferToIndex}`);
        if (chosen) chosen.scrollIntoView({ block: 'nearest' });
        list.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function toggleTransferSiteList() {
    const card = document.getElementById('transfer-to-card');
    if (!card || card.disabled) return;
    triggerHaptic('light');
    setTransferSiteListOpen(card.getAttribute('aria-expanded') !== 'true');
}

function chooseTransferSite(index) {
    const site = transferSites[index];
    if (!site || (currentTransferTool && site.id === currentTransferTool.siteId)) return;
    triggerHaptic('light');
    currentTransferToIndex = index;
    renderTransferDestination();
    setTransferSiteListOpen(false);
    document.getElementById('transfer-to-card').focus({ preventScroll: true });
}

// Keyboard on the To card: arrows step through the sites (skipping the tool's own), Escape closes the list
function onTransferToCardKeydown(event) {
    const card = event.currentTarget;
    if (card.disabled) return;
    if (event.key === 'Escape' && card.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        event.stopPropagation();
        setTransferSiteListOpen(false);
        return;
    }
    const delta = (event.key === 'ArrowDown' || event.key === 'ArrowRight') ? 1 : (event.key === 'ArrowUp' || event.key === 'ArrowLeft') ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const here = currentTransferTool ? currentTransferTool.siteId : null;
    let next = currentTransferToIndex;
    do { next += delta; } while (next >= 0 && next < transferSites.length && transferSites[next].id === here);
    if (next < 0 || next >= transferSites.length) return;
    currentTransferToIndex = next;
    triggerHaptic('light');
    renderTransferDestination();
    if (card.getAttribute('aria-expanded') === 'true') renderTransferSiteList();
}

// The transfer itself is equipmentService.transfer (scripts/application/services/equipment-service.js):
// an available tool moves now, a tool in use gets a move request, a tool in service can't move. The sheet
// only celebrates once the service has saved it.
async function confirmToolTransfer() {
    if (!currentTransferTool) return;
    const tool = currentTransferTool;

    // Service items: say why straight away (the service refuses them too)
    if (tool.status === ToolStatus.SERVICE) {
        triggerHaptic('light');
        showToast('Workshop Hold', `${tool.name} is unavailable until pickup is ready.`);
        return;
    }

    const confirmBtn = document.getElementById('transfer-confirm-btn');
    const dest = transferSites[currentTransferToIndex];
    // Re-check before sending (the service checks again): a live destination that isn't the source, and no
    // more units than the source bucket holds right now
    if (!dest || !isSiteActive(dest.id) || dest.id === tool.siteId) {
        triggerHaptic('error');
        setUiActionError(confirmBtn, 'Choose a destination', 'Pick a different location to transfer to.');
        return;
    }
    const fromSite = toolLocationLabel(tool);
    const isBulk = EquipmentRules.isBulk(tool);
    const qty = isBulk ? readQty('transfer-qty') : 1;
    const unitName = tool.unit || (qty > 1 ? 'Units' : 'Unit');

    const bucket = currentTransferAllocation;
    if (bucket) {
        const live = liveTransferBucket();
        if (!live || qty < 1 || qty > live.quantity) {
            triggerHaptic('error');
            setUiActionError(confirmBtn, 'Transfer not logged', live ? `Only ${live.quantity} available at ${fromSite} now.` : `No ${tool.name} are available at ${fromSite} any more.`);
            return;
        }
    }
    const status = tool.status === ToolStatus.AVAILABLE ? transferArrivalStatus : undefined;   // a real move: the chosen status
    const result = await runUiAction(() => (bucket
        ? equipmentService.transferUnits({ toolId: tool.id, fromSiteId: bucket.siteId, toSiteId: dest.id, quantity: qty, toStatus: status })
        : equipmentService.transfer(tool.id, dest.id, { status })), {
        button: document.getElementById('transfer-confirm-btn'),
        errorTitle: 'Transfer not logged'
    });
    if (!result.ok) return;
    if (!bucket) currentTransferTool = result.value.tool;
    triggerHaptic('success');

    const toastMsg = isBulk
        ? `${qty} ${unitName} (${tool.name}) transferred to ${dest.shortName}`
        : `${tool.name} transferred to ${dest.shortName}`;
    showToast('Transfer Logged', toastMsg);

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 45,
            spread: 60,
            origin: { y: 0.65 }
        });
    }

    closeToolTransferModal();
}

// Attach overlay click & swipe down gesture listeners to transfer modal
document.addEventListener('DOMContentLoaded', () => {
    const transferOverlay = document.getElementById('tool-transfer-modal-overlay');
    const transferSheet = document.getElementById('tool-transfer-sheet');
    const dragZone = document.getElementById('transfer-drag-zone');

    if (transferOverlay) {
        transferOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'tool-transfer-modal-overlay') closeToolTransferModal();
        });
    }

    // High-Performance Apple Bottom Sheet Drag-to-Dismiss for Tool Transfer Modal
    if (transferSheet) {
        const DRAG_SLOP = 6;
        const DISMISS_DISTANCE = 0.22;
        const DISMISS_VELOCITY = 0.45;
        let startY = 0;
        let lastY = 0;
        let lastT = 0;
        let velocity = 0;
        let armed = false;
        let isDragging = false;
        let rafId = null;
        let currentTranslate = 0;

        const rubberband = (overshoot, dimension, c = 0.45) =>
            (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));

        function scheduleTransferSheetRender() {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                rafId = null;
                transferSheet.style.transform = `translate3d(0, ${currentTranslate}px, 0)`;
            });
        }

        function onTransferDragStart(clientX, clientY, target) {
            if (target && target.closest('#transfer-site-list')) return;   // the site list scrolls on its own
            const bodyScroller = document.getElementById('transfer-body-scroller');
            const touchedHeaderOrHandle = !bodyScroller || !bodyScroller.contains(target);
            armed = touchedHeaderOrHandle || (bodyScroller && bodyScroller.scrollTop <= 0);
            isDragging = false;
            startY = lastY = clientY;
            lastT = performance.now();
            velocity = 0;
            currentTranslate = 0;
        }

        function onTransferDragMove(clientX, clientY, e) {
            if (!armed) return;
            const diffY = clientY - startY;

            if (!isDragging) {
                if (diffY > DRAG_SLOP) {
                    isDragging = true;
                    transferSheet.classList.add('is-dragging');
                } else if (diffY < -DRAG_SLOP) {
                    armed = false;
                    return;
                } else {
                    return;
                }
            }

            if (e && e.cancelable) e.preventDefault();

            const now = performance.now();
            const dt = Math.max(1, now - lastT);
            velocity = 0.8 * ((clientY - lastY) / dt) + 0.2 * velocity;
            lastY = clientY;
            lastT = now;

            const offset = diffY - DRAG_SLOP;
            currentTranslate = offset >= 0
                ? offset
                : rubberband(offset, transferSheet.offsetHeight || 500);
            scheduleTransferSheetRender();
        }

        function onTransferDragEnd() {
            if (!isDragging) { armed = false; return; }
            isDragging = false;
            armed = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

            transferSheet.classList.remove('is-dragging');
            const offset = lastY - startY - DRAG_SLOP;
            const sheetH = transferSheet.offsetHeight || 500;
            const shouldDismiss =
                velocity > DISMISS_VELOCITY ||
                (offset > sheetH * DISMISS_DISTANCE && velocity > -0.15);

            if (shouldDismiss) {
                closeToolTransferModal(true, currentTranslate, velocity);
            } else {
                // Snap back fast (same timing as the shared modal sheet)
                transferSheet.style.transition = 'transform var(--dur-snap) var(--ease-out)';
                transferSheet.style.transform = 'translate3d(0, 0, 0)';
                setTimeout(() => {
                    if (!isDragging) {
                        transferSheet.style.transition = '';
                        transferSheet.style.transform = '';
                    }
                }, 280);
            }
        }

        // Touch Listeners
        transferSheet.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            onTransferDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }, { passive: true });

        transferSheet.addEventListener('touchmove', (e) => {
            onTransferDragMove(e.touches[0].clientX, e.touches[0].clientY, e);
        }, { passive: false });

        transferSheet.addEventListener('touchend', onTransferDragEnd, { passive: true });
        transferSheet.addEventListener('touchcancel', onTransferDragEnd, { passive: true });

        // Pointer Listeners for mouse/trackpad/pen drag support (touch is handled above)
        transferSheet.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            onTransferDragStart(e.clientX, e.clientY, e.target);
        });
        window.addEventListener('pointermove', (e) => {
            if (!armed || e.pointerType === 'touch') return;
            onTransferDragMove(e.clientX, e.clientY, e);
        });
        window.addEventListener('pointerup', onTransferDragEnd);
        window.addEventListener('pointercancel', onTransferDragEnd);
    }
});

// Escape key dismiss listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const transferOverlay = document.getElementById('tool-transfer-modal-overlay');
        if (transferOverlay && !transferOverlay.classList.contains('opacity-0')) {
            closeToolTransferModal();
        }
    }
});
