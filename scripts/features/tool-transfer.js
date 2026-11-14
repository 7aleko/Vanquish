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
    const isInUse = tool.status === 'In Use';
    const isBulk = Boolean(tool.quantity && tool.quantity > 1);

    if (isService) {
        btnLabel.textContent = 'Unavailable Until Pickup Ready';
    } else if (isInUse) {
        btnLabel.textContent = 'Request Move';
    } else if (isBulk) {
        const qtyInput = document.getElementById('transfer-input-qty');
        const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
        const unitName = tool.unit || 'Units';
        btnLabel.textContent = `Transfer ${qty} ${unitName}`;
    } else {
        btnLabel.textContent = 'Transfer Equipment';
    }
}

function openToolTransferModal(toolId) {
    triggerHaptic('medium');
    const tool = getToolById(toolId);
    if (!tool) return;

    currentTransferTool = tool;

    const isAvailable = tool.status === ToolStatus.AVAILABLE;
    const isService = tool.status === 'Service';
    const isInUse = tool.status === 'In Use';
    const isBulk = Boolean(tool.quantity && tool.quantity > 1);

    // Copy and colour for the tool's status (styles/tool-transfer.css reads data-tone)
    const mode = isAvailable ? {
        tone: 'available', title: 'Transfer Equipment', subtitle: 'Available now \u2014 assign to a new site',
        toLabel: 'Transfer To', note: 'e.g. Framing stage', cta: 'btn btn--cta btn--cta-emerald btn--block',
        icon: 'ph-bold ph-arrows-left-right', glow: 'bg-emerald-400/15'
    } : isInUse ? {
        tone: 'in-use', title: 'Request Equipment Move', subtitle: 'Active on site \u2014 request release & transfer',
        toLabel: 'Request For', note: 'e.g. Needed by 7:00 AM', cta: 'btn btn--cta btn--cta-blue btn--block',
        icon: 'ph-bold ph-paper-plane-tilt', glow: 'bg-sky-400/15'
    } : {
        tone: 'service', title: 'Workshop Service Hold', subtitle: 'Unavailable until workshop pickup is ready',
        toLabel: 'Transfer To', note: '', cta: 'btn btn--cta btn--block is-tone-amber',
        icon: 'ph-bold ph-lock-simple', glow: 'bg-amber-400/15'
    };
    const byId = id => document.getElementById(id);

    byId('transfer-modal-title').textContent = mode.title;
    byId('transfer-modal-subtitle').textContent = mode.subtitle;
    const glow1 = byId('transfer-sheet-glow-1');
    if (glow1) glow1.className = `absolute -top-16 -left-10 w-52 h-52 ${mode.glow} rounded-full blur-[65px] pointer-events-none transition-colors duration-500`;

    // 1. The tool: name, then category, units and where it is
    const category = (ToolCategories.find(c => c.id === tool.category) || { label: tool.category }).label;
    byId('transfer-tool-name').textContent = tool.name;
    byId('transfer-tool-meta').textContent = [category, isBulk ? `${tool.quantity} ${tool.unit || 'Units'}` : '', getSiteName(tool.siteId, 'Unknown site')]
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
    const qtySection = byId('transfer-quantity-section');

    const confirmBtn = byId('transfer-confirm-btn');
    confirmBtn.className = mode.cta;
    confirmBtn.disabled = isService;
    byId('transfer-confirm-btn-icon').className = mode.icon;

    // From: the site it was last logged to, with when and by whom
    const logInfo = parseToolLastLog(tool.lastLogged);
    byId('transfer-from-name').textContent = getSiteName(tool.siteId, 'Unknown site');
    byId('transfer-from-log').textContent = [logInfo.dateText, logInfo.byText.replace(/^by\s+/i, '')].filter(Boolean).join(' \u2022 ');
    const fromSite = getSiteById(tool.siteId);
    byId('transfer-from-icon').className = (fromSite && fromSite.icon) || 'ph-fill ph-map-pin';

    // Default "To" site: today's rostered site unless the tool is already there
    transferSites = getActiveSites();
    const workingSiteId = getCurrentWorkingSiteId();
    let defaultIndex = transferSites.findIndex(s => s.id === workingSiteId);
    if (tool.siteId === workingSiteId) {
        const altIndex = transferSites.findIndex(s => s.id !== tool.siteId);
        defaultIndex = altIndex !== -1 ? altIndex : 0;
    } else if (defaultIndex === -1) {
        defaultIndex = 0;
    }
    currentTransferToIndex = defaultIndex;

    renderTransferDestination();

    // Only show unit quantity stepper if the item actually has multiple units (e.g. Acro Props) and is not in Service
    const qtyInput = document.getElementById('transfer-input-qty');
    const unitLabel = document.getElementById('transfer-input-unit');
    const availLabel = document.getElementById('transfer-amount-available');

    if (qtySection) qtySection.hidden = !isBulk || isService;

    const unitName = tool.unit || 'Units';
    const initialQty = isBulk ? Math.min(10, tool.quantity) : 1;

    if (qtyInput) {
        qtyInput.value = initialQty;
        qtyInput.max = isBulk ? tool.quantity : 1;
    }
    if (unitLabel) unitLabel.textContent = unitName;
    if (availLabel && isBulk) {
        availLabel.textContent = `Available: ${tool.quantity} ${unitName}`;
    }
    if (descInput) descInput.value = '';

    updateTransferConfirmButtonLabel();

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
                sheet.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
                sheet.style.transform = 'translate3d(0, 0, 0)';
                syncDynamicStatusBar();
            });
        });
    }
}

function adjustTransferQuantity(delta) {
    if (!currentTransferTool || !currentTransferTool.quantity || currentTransferTool.quantity <= 1) return;
    triggerHaptic('light');
    const input = document.getElementById('transfer-input-qty');
    if (!input) return;
    let val = parseInt(input.value) || 1;
    const max = currentTransferTool.quantity;
    val = Math.max(1, Math.min(max, val + delta));
    input.value = val;
    onTransferQuantityChange(val);
}

function onTransferQuantityChange(val) {
    if (!currentTransferTool) return;
    const max = currentTransferTool.quantity || 1;
    const clamped = Math.max(1, Math.min(max, parseInt(val) || 1));
    const input = document.getElementById('transfer-input-qty');
    if (input && String(input.value) !== String(clamped) && val !== '') {
        input.value = clamped;
    }
    updateTransferConfirmButtonLabel();
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
    document.getElementById('transfer-to-addr').textContent = shortStreetAddress(site.address);
    document.getElementById('transfer-to-icon').className = site.icon || 'fa-solid fa-helmet-safety';
    document.getElementById('transfer-to-card').setAttribute('aria-label',
        `${document.getElementById('transfer-to-label').textContent}: ${site.shortName}, ${site.address}. Change destination`);
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
                    <span class="tt-site-option-sub">${isHere ? 'Current site' : shortStreetAddress(site.address)}</span>
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

    const dest = transferSites[currentTransferToIndex] || getSiteById(getCurrentWorkingSiteId());
    if (!dest) return;
    const fromSite = getSiteName(tool.siteId, 'Unknown site');
    const isBulk = EquipmentRules.isBulk(tool);
    const qtyInput = document.getElementById('transfer-input-qty');
    const qty = isBulk && qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
    const unitName = tool.unit || (qty > 1 ? 'Units' : 'Unit');

    const result = await runUiAction(() => equipmentService.transfer(tool.id, dest.id), {
        button: document.getElementById('transfer-confirm-btn'),
        errorTitle: 'Transfer not logged'
    });
    if (!result.ok) return;
    currentTransferTool = result.value.tool;
    triggerHaptic('success');

    if (result.value.outcome === 'request') {
        showToast('Move Request Sent', `Requested ${tool.name} move from ${fromSite} to ${dest.shortName}`);
        closeToolTransferModal();
        return;
    }

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
