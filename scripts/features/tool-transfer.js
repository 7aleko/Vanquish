/**
 * Tool transfer sheet: dual roller site selector, quantity, confirm, gestures.
 */

// =========================================================================
// TOOLS & GEAR TRANSFER ENGINE (COMMBANK-INSPIRED DUAL ROLLER SELECTOR)
// =========================================================================

let currentTransferTool = null;
let currentTransferToIndex = 0;
// The "To" choices: the active sites (SITES), taken when the sheet opens so the roller's order holds while
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

    // 1. Update Sheet Header & Dynamic Ambient Glows
    const modalTitle = document.getElementById('transfer-modal-title');
    const modalSubtitle = document.getElementById('transfer-modal-subtitle');
    const glow1 = document.getElementById('transfer-sheet-glow-1');
    const glow2 = document.getElementById('transfer-sheet-glow-2');
    const heroCard = document.getElementById('transfer-hero-card');
    const heroOrb = document.getElementById('transfer-hero-orb');
    const iconBox = document.getElementById('transfer-tool-icon-box');
    const iconEl = document.getElementById('transfer-tool-icon');
    const nameEl = document.getElementById('transfer-tool-name');
    const metaEl = document.getElementById('transfer-tool-meta');
    const statusEl = document.getElementById('transfer-tool-status');

    if (nameEl) nameEl.textContent = tool.name;
    if (metaEl) {
        const unitBadge = isBulk ? ` • ${tool.quantity} ${tool.unit || 'Units'}` : '';
        metaEl.textContent = `${tool.category.toUpperCase()}${unitBadge} • ${getSiteName(tool.siteId, 'Unknown site')}`;
    }
    if (iconEl) iconEl.className = getToolCategoryIcon(tool.category);

    // Status Banner, Route Wrapper, Quantity & Notes
    const statusBanner = document.getElementById('transfer-status-banner');
    const bannerIcon = document.getElementById('transfer-status-banner-icon');
    const bannerTitle = document.getElementById('transfer-status-banner-title');
    const bannerDesc = document.getElementById('transfer-status-banner-desc');
    const routeWrapper = document.getElementById('transfer-route-wrapper');
    const inputsWrapper = document.getElementById('transfer-inputs-wrapper');
    const qtySection = document.getElementById('transfer-quantity-section');
    const notesSection = document.getElementById('transfer-notes-section');
    const notesLabel = document.getElementById('transfer-notes-label');
    const descInput = document.getElementById('transfer-input-desc');
    const confirmBtn = document.getElementById('transfer-confirm-btn');
    const confirmIcon = document.getElementById('transfer-confirm-btn-icon');
    const fromDot = document.getElementById('transfer-from-dot');
    const fromIconBox = document.getElementById('transfer-from-icon-box');
    const toDot = document.getElementById('transfer-to-dot');
    const toHeaderLabel = document.getElementById('transfer-to-header-label');
    const wheelGlow = document.getElementById('transfer-wheel-glow');
    const centerArrow = document.getElementById('transfer-center-arrow');

    const floatingHeaders = document.getElementById('transfer-floating-headers');
    if (floatingHeaders) {
        floatingHeaders.className = isService
            ? 'relative grid grid-cols-2 items-center px-4 pt-2.5 pb-1 select-none transition-opacity duration-300 opacity-45 pointer-events-none'
            : 'relative grid grid-cols-2 items-center px-4 pt-2.5 pb-1 select-none transition-opacity duration-300 opacity-100';
    }

    if (isAvailable) {
        if (modalTitle) modalTitle.textContent = 'Transfer Details';
        if (modalSubtitle) modalSubtitle.textContent = isBulk ? 'Select destination & unit count for instant transfer' : 'Select destination site for instant movement';
        if (glow1) glow1.className = 'absolute -top-16 -left-10 w-52 h-52 bg-emerald-400/15 rounded-full blur-[65px] pointer-events-none transition-colors duration-500';
        if (glow2) glow2.className = 'absolute top-36 -right-12 w-52 h-52 bg-slate-200/10 rounded-full blur-[65px] pointer-events-none transition-colors duration-500';
        if (heroCard) heroCard.className = 'relative overflow-hidden rounded-inset p-4 bg-white/75 backdrop-blur-2xl text-slate-900 border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.95)] transition-all duration-300';
        if (heroOrb) heroOrb.className = 'absolute -top-10 -right-10 w-32 h-32 bg-emerald-400/20 rounded-full blur-[32px] pointer-events-none';
        if (iconBox) iconBox.className = 'w-12 h-12 rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 text-slate-900 flex items-center justify-center text-lg shrink-0 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)]';
        if (statusEl) {
            statusEl.textContent = 'Available';
            statusEl.className = 'hidden';
        }
        if (statusBanner) statusBanner.classList.add('hidden');
        if (routeWrapper) routeWrapper.className = 'relative bg-white/75 backdrop-blur-xl rounded-inset border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.05),inset_0_1px_1.5px_rgba(255,255,255,0.95)] overflow-hidden transition-opacity duration-300 opacity-100';
        if (inputsWrapper) inputsWrapper.classList.remove('hidden');
        if (notesSection) notesSection.classList.remove('hidden');
        if (notesLabel) notesLabel.textContent = 'Note';
        if (descInput) descInput.placeholder = 'Optional (e.g. framing stage)';
        if (fromDot) fromDot.className = 'hidden';
        if (fromIconBox) fromIconBox.className = 'w-14 h-14 rounded-2xl bg-slate-900 text-brand-lime shadow-sm flex items-center justify-center text-lg mb-2 transition-all';
        if (toDot) toDot.className = 'hidden';
        if (toHeaderLabel) toHeaderLabel.textContent = 'Transfer To';
        if (wheelGlow) wheelGlow.className = 'absolute top-1/2 right-4 -translate-y-1/2 w-32 h-24 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none';
        if (centerArrow) centerArrow.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-brand-lime border-2 border-white flex items-center justify-center text-xs sm:text-sm shadow-md';
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.className = 'w-full min-h-[50px] py-3.5 rounded-2xl bg-slate-900 hover:bg-black active:scale-[0.98] text-brand-lime font-bold text-base tracking-tight shadow-[0_8px_20px_-6px_rgba(15,23,42,0.35)] border border-slate-800 transition-all flex items-center justify-center gap-2.5 cursor-pointer';
        }
        if (confirmIcon) confirmIcon.className = 'fa-solid fa-arrow-right-arrow-left text-xs';
    } else if (isInUse) {
        if (modalTitle) modalTitle.textContent = 'Request Equipment Move';
        if (modalSubtitle) modalSubtitle.textContent = 'Currently active on site — request release & transfer';
        if (glow1) glow1.className = 'absolute -top-16 -left-10 w-52 h-52 bg-sky-400/15 rounded-full blur-[65px] pointer-events-none transition-colors duration-500';
        if (glow2) glow2.className = 'absolute top-36 -right-12 w-52 h-52 bg-slate-200/10 rounded-full blur-[65px] pointer-events-none transition-colors duration-500';
        if (heroCard) heroCard.className = 'relative overflow-hidden rounded-inset p-4 bg-white/75 backdrop-blur-2xl text-slate-900 border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.95)] transition-all duration-300';
        if (heroOrb) heroOrb.className = 'absolute -top-10 -right-10 w-32 h-32 bg-sky-400/20 rounded-full blur-[32px] pointer-events-none';
        if (iconBox) iconBox.className = 'w-12 h-12 rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 text-slate-900 flex items-center justify-center text-lg shrink-0 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)]';
        if (statusEl) {
            statusEl.textContent = 'In Use';
            statusEl.className = 'hidden';
        }
        if (statusBanner) statusBanner.classList.add('hidden');
        if (routeWrapper) routeWrapper.className = 'relative bg-white/75 backdrop-blur-xl rounded-inset border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.05),inset_0_1px_1.5px_rgba(255,255,255,0.95)] overflow-hidden transition-opacity duration-300 opacity-100';
        if (inputsWrapper) inputsWrapper.classList.remove('hidden');
        if (notesSection) notesSection.classList.remove('hidden');
        if (notesLabel) notesLabel.textContent = 'Request Note';
        if (descInput) descInput.placeholder = 'Optional (e.g. needed by 7:00 AM)';
        if (fromDot) fromDot.className = 'hidden';
        if (fromIconBox) fromIconBox.className = 'w-14 h-14 rounded-2xl bg-slate-900 text-sky-400 shadow-sm flex items-center justify-center text-lg mb-2 transition-all';
        if (toDot) toDot.className = 'hidden';
        if (toHeaderLabel) toHeaderLabel.textContent = 'Request For';
        if (wheelGlow) wheelGlow.className = 'absolute top-1/2 right-4 -translate-y-1/2 w-32 h-24 bg-sky-400/15 rounded-full blur-2xl pointer-events-none';
        if (centerArrow) centerArrow.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-sky-400 border-2 border-white flex items-center justify-center text-xs sm:text-sm shadow-md';
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.className = 'w-full min-h-[50px] py-3.5 rounded-2xl bg-slate-900 hover:bg-black active:scale-[0.98] text-sky-400 font-bold text-base tracking-tight shadow-[0_8px_20px_-6px_rgba(15,23,42,0.35)] border border-slate-800 transition-all flex items-center justify-center gap-2.5 cursor-pointer';
        }
        if (confirmIcon) confirmIcon.className = 'fa-solid fa-paper-plane text-xs';
    } else {
        // 'Service' status — Unavailable until workshop pickup is ready (same gradient structure + Black & Orange button)
        if (modalTitle) modalTitle.textContent = 'Workshop Service Hold';
        if (modalSubtitle) modalSubtitle.textContent = 'Unavailable until workshop pickup is ready';
        if (glow1) glow1.className = 'absolute -top-16 -left-10 w-52 h-52 bg-amber-400/15 rounded-full blur-[65px] pointer-events-none transition-colors duration-500';
        if (glow2) glow2.className = 'absolute top-36 -right-12 w-52 h-52 bg-slate-200/10 rounded-full blur-[65px] pointer-events-none transition-colors duration-500';
        if (heroCard) heroCard.className = 'relative overflow-hidden rounded-inset p-4 bg-white/75 backdrop-blur-2xl text-slate-900 border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.95)] transition-all duration-300';
        if (heroOrb) heroOrb.className = 'absolute -top-10 -right-10 w-32 h-32 bg-amber-400/20 rounded-full blur-[32px] pointer-events-none';
        if (iconBox) iconBox.className = 'w-12 h-12 rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 text-slate-900 flex items-center justify-center text-lg shrink-0 shadow-[0_2px_8px_rgba(15,23,42,0.06),inset_0_1px_1px_rgba(255,255,255,1)]';
        if (statusEl) {
            statusEl.textContent = 'In Service';
            statusEl.className = 'hidden';
        }
        if (statusBanner) {
            statusBanner.className = 'rounded-[20px] p-3.5 bg-white border border-black/[0.06] shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all';
            if (bannerIcon) bannerIcon.className = 'w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-2xs';
            if (bannerIcon) bannerIcon.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i>';
            if (bannerTitle) bannerTitle.textContent = 'Unavailable Until Pickup Is Ready';
            if (bannerDesc) bannerDesc.textContent = `Logged ${tool.lastLogged || 'by Workshop'}. This item is undergoing maintenance and cannot be transferred until workshop pickup is ready.`;
        }
        if (fromDot) fromDot.className = 'hidden';
        if (fromIconBox) fromIconBox.className = 'w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 shadow-sm flex items-center justify-center text-lg mb-2 transition-all';
        if (toDot) toDot.className = 'hidden';
        if (toHeaderLabel) toHeaderLabel.textContent = 'Transfer To';
        if (wheelGlow) wheelGlow.className = 'absolute top-1/2 right-4 -translate-y-1/2 w-32 h-24 bg-amber-400/15 rounded-full blur-2xl pointer-events-none';
        if (centerArrow) centerArrow.className = 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-amber-400 border-2 border-white flex items-center justify-center text-xs sm:text-sm shadow-md';
        if (routeWrapper) routeWrapper.className = 'relative bg-white/75 backdrop-blur-xl rounded-inset border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.05),inset_0_1px_1.5px_rgba(255,255,255,0.95)] overflow-hidden transition-opacity duration-300 opacity-45 pointer-events-none select-none';
        if (inputsWrapper) inputsWrapper.classList.add('hidden');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.className = 'w-full min-h-[50px] py-3.5 rounded-2xl bg-slate-900 text-amber-400 font-bold text-base tracking-tight shadow-[0_8px_20px_-6px_rgba(15,23,42,0.35)] border border-slate-800 transition-all flex items-center justify-center gap-2.5 cursor-not-allowed';
        }
        if (confirmIcon) confirmIcon.className = 'fa-solid fa-lock text-xs text-amber-400';
    }

    // "From" card is locked to the last site it was logged to (date on line 1, "by Name" below it)
    const fromNameEl = document.getElementById('transfer-from-name');
    const fromDescEl = document.getElementById('transfer-from-desc');
    const fromByEl = document.getElementById('transfer-from-by');
    const logInfo = parseToolLastLog(tool.lastLogged);
    if (fromNameEl) fromNameEl.textContent = getSiteName(tool.siteId, 'Unknown site');
    if (fromDescEl) fromDescEl.textContent = `Last log: ${logInfo.dateText}`;
    if (fromByEl) {
        fromByEl.textContent = logInfo.byText;
        fromByEl.classList.toggle('hidden', !logInfo.byText);
    }

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

    // Render all sites into the "To" scroller
    renderTransferToItems();

    // Only show unit quantity stepper if the item actually has multiple units (e.g. Acro Props) and is not in Service
    const qtyInput = document.getElementById('transfer-input-qty');
    const unitLabel = document.getElementById('transfer-input-unit');
    const availLabel = document.getElementById('transfer-amount-available');

    if (qtySection) {
        qtySection.classList.toggle('hidden', !isBulk || isService);
    }

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

        const scroller = document.getElementById('transfer-to-scroller');
        if (scroller) {
            scroller.scrollTop = currentTransferToIndex * 120;
            updateTransferToItemStyles(currentTransferToIndex);
        }

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

function renderTransferToItems() {
    const scroller = document.getElementById('transfer-to-scroller');
    if (!scroller) return;

    const status = currentTransferTool ? currentTransferTool.status : 'Available';
    const selectedIconClass = status === 'In Use'
        ? 'w-14 h-14 rounded-2xl bg-slate-900 text-sky-400 shadow-sm flex items-center justify-center text-lg mb-2 transition-all'
        : (status === 'Service'
            ? 'w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 shadow-sm flex items-center justify-center text-lg mb-2 transition-all'
            : 'w-14 h-14 rounded-2xl bg-slate-900 text-brand-lime shadow-sm flex items-center justify-center text-lg mb-2 transition-all');

    scroller.innerHTML = transferSites.map((site, idx) => {
        const isSelected = idx === currentTransferToIndex;
        return `
            <div onclick="selectTransferToSite(${idx})" 
                 id="transfer-to-item-${idx}" 
                 role="option"
                 aria-selected="${isSelected ? 'true' : 'false'}"
                 class="h-[120px] snap-center shrink-0 flex flex-col items-center justify-center text-center px-2.5 py-1.5 cursor-pointer transition-all duration-200 ${isSelected ? 'opacity-100 scale-100' : 'opacity-55 hover:opacity-85 scale-95'}">
                <div id="transfer-to-icon-${idx}" class="w-14 h-14 rounded-2xl ${isSelected ? selectedIconClass : 'bg-slate-200/80 text-slate-600'} flex items-center justify-center text-lg mb-2 transition-all">
                    <i class="${site.icon}" aria-hidden="true"></i>
                </div>
                <span id="transfer-to-name-${idx}" class="text-base sm:text-[17px] font-black ${isSelected ? 'text-slate-900' : 'text-slate-600'} tracking-tight line-clamp-1 leading-tight">${site.shortName}</span>
                <span id="transfer-to-addr-${idx}" class="text-[13px] sm:text-sm ${isSelected ? 'text-slate-600 font-bold' : 'text-slate-500 font-medium'} line-clamp-1 mt-0.5 leading-tight">${getSiteFullAddress(site.id)}</span>
            </div>
        `;
    }).join('');
}

function onTransferToScrolled(scroller) {
    if (!scroller) return;
    const scrollTop = scroller.scrollTop;
    const activeIndex = Math.max(0, Math.min(transferSites.length - 1, Math.round(scrollTop / 120)));

    if (activeIndex !== currentTransferToIndex) {
        currentTransferToIndex = activeIndex;
        triggerHaptic('light');
    }
    updateTransferToItemStyles(activeIndex);
}

function selectTransferToSite(index) {
    const clampedIndex = Math.max(0, Math.min(transferSites.length - 1, index));
    currentTransferToIndex = clampedIndex;
    triggerHaptic('light');
    const scroller = document.getElementById('transfer-to-scroller');
    if (scroller) {
        scroller.scrollTo({ top: clampedIndex * 120, behavior: 'smooth' });
    }
    updateTransferToItemStyles(clampedIndex);
}

function stepTransferSite(delta) {
    const nextIndex = Math.max(0, Math.min(transferSites.length - 1, currentTransferToIndex + delta));
    selectTransferToSite(nextIndex);
}

function onTransferScrollerKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        stepTransferSite(1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        stepTransferSite(-1);
    }
}

function updateTransferToItemStyles(activeIndex) {
    const status = currentTransferTool ? currentTransferTool.status : 'Available';
    const selectedIconClass = status === 'In Use'
        ? "w-14 h-14 rounded-2xl bg-slate-900 text-sky-400 shadow-sm flex items-center justify-center text-lg mb-2 transition-all"
        : (status === 'Service'
            ? "w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 shadow-sm flex items-center justify-center text-lg mb-2 transition-all"
            : "w-14 h-14 rounded-2xl bg-slate-900 text-brand-lime shadow-sm flex items-center justify-center text-lg mb-2 transition-all");
    const selectedAddrClass = "text-[13px] sm:text-sm text-slate-600 font-bold line-clamp-1 mt-0.5 leading-tight";

    transferSites.forEach((site, idx) => {
        const item = document.getElementById(`transfer-to-item-${idx}`);
        const icon = document.getElementById(`transfer-to-icon-${idx}`);
        const name = document.getElementById(`transfer-to-name-${idx}`);
        const addr = document.getElementById(`transfer-to-addr-${idx}`);

        if (!item) return;

        const isSelected = idx === activeIndex;
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) {
            item.className = "h-[120px] snap-center shrink-0 flex flex-col items-center justify-center text-center px-2.5 py-1.5 cursor-pointer transition-all duration-200 opacity-100 scale-100";
            if (icon) icon.className = selectedIconClass;
            if (name) name.className = "text-base sm:text-[17px] font-black text-slate-900 tracking-tight line-clamp-1 leading-tight";
            if (addr) addr.className = selectedAddrClass;
        } else {
            item.className = "h-[120px] snap-center shrink-0 flex flex-col items-center justify-center text-center px-2.5 py-1.5 cursor-pointer transition-all duration-200 opacity-55 hover:opacity-85 scale-95";
            if (icon) icon.className = "w-14 h-14 rounded-2xl bg-slate-200/80 text-slate-600 flex items-center justify-center text-lg mb-2 transition-all";
            if (name) name.className = "text-[15px] sm:text-base font-bold text-slate-600 tracking-tight line-clamp-1 leading-tight";
            if (addr) addr.className = "text-[13px] text-slate-500 font-medium line-clamp-1 mt-0.5 leading-tight";
        }
    });

    updateTransferConfirmButtonLabel();
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
            if (target && target.closest('#transfer-to-scroller')) return;
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
