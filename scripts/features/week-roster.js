/**
 * My Week roster: week navigation, rain-site switching, accordion cards.
 */

let activeTodayCardId = 'card-wed';
const expandedRosterCards = {};
const rosterCardStates = {};

let currentRosterMonday = new Date(2026, 9, 12); // Mon 12 Oct 2026
const ROSTER_SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ROSTER_DAY_IDS = ['card-mon', 'card-tue', 'card-wed', 'card-thu', 'card-fri'];

function applyRosterWeek(mondayDate, pickedDate = null) {
    currentRosterMonday = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate());
    const fridayDate = new Date(currentRosterMonday.getFullYear(), currentRosterMonday.getMonth(), currentRosterMonday.getDate() + 4);

    const monStr = `Mon ${String(currentRosterMonday.getDate()).padStart(2, '0')} ${ROSTER_SHORT_MONTHS[currentRosterMonday.getMonth()]}`;
    const friStr = `Fri ${String(fridayDate.getDate()).padStart(2, '0')} ${ROSTER_SHORT_MONTHS[fridayDate.getMonth()]}, ${fridayDate.getFullYear()}`;
    const weekLabel = document.getElementById('roster-week-label');
    if (weekLabel) {
        weekLabel.textContent = `${monStr} – ${friStr}`;
    }

    const nativeInput = document.getElementById('roster-native-date-input');
    if (nativeInput) {
        nativeInput.value = formatIsoDateLocal(pickedDate || currentRosterMonday);
    }

    ROSTER_DAY_IDS.forEach((id, idx) => {
        const dayDate = new Date(currentRosterMonday.getFullYear(), currentRosterMonday.getMonth(), currentRosterMonday.getDate() + idx);
        if (ROSTER_CONFIG[id]) {
            ROSTER_CONFIG[id].dateNum = String(dayDate.getDate()).padStart(2, '0');
        }
    });

    const isAnchorWeek = (
        currentRosterMonday.getFullYear() === 2026 &&
        currentRosterMonday.getMonth() === 9 &&
        currentRosterMonday.getDate() === 12
    );
    activeTodayCardId = isAnchorWeek ? 'card-wed' : '';

    if (pickedDate) {
        const dow = pickedDate.getDay();
        if (dow >= 1 && dow <= 5) {
            const pickedCardId = ROSTER_DAY_IDS[dow - 1];
            ROSTER_DAY_IDS.forEach(id => {
                expandedRosterCards[id] = (id === pickedCardId);
            });
            setTimeout(() => {
                scrollRosterCardIntoView(pickedCardId);
            }, 60);
        }
    }

    renderRosterCards();
}

function shiftRosterWeek(direction) {
    triggerHaptic('light');
    const nextMonday = new Date(
        currentRosterMonday.getFullYear(),
        currentRosterMonday.getMonth(),
        currentRosterMonday.getDate() + direction * 7
    );
    applyRosterWeek(nextMonday);
}

function handleRosterDatePick(isoValue) {
    if (!isoValue) return;
    const parts = isoValue.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return;
    triggerHaptic('light');
    const picked = new Date(parts[0], parts[1] - 1, parts[2]);
    applyRosterWeek(getMondayForDate(picked), picked);
}

function getExpectedRosterDrawerHeight(cardId, drawer) {
    if (!drawer || !expandedRosterCards[cardId]) return 0;
    const inner = drawer.querySelector('.roster-drawer-inner');
    if (!inner) return drawer.getBoundingClientRect().height;

    let height = inner.scrollHeight;
    // The rain mode shift line may be mid open / close: measure it at its end state
    const pillSlot = inner.querySelector('.roster-shift-slot');
    if (pillSlot) {
        const currentPillH = pillSlot.getBoundingClientRect().height;
        if (pillSlot.classList.contains('is-active')) {
            const pillContent = pillSlot.querySelector('.roster-shift-row');
            const targetPillH = (pillContent ? pillContent.offsetHeight : 0) + 10;
            height += Math.max(0, targetPillH - currentPillH);
        } else {
            height = Math.max(0, height - currentPillH);
        }
    }
    return height;
}

// Exact cubic-bezier(0.32, 0.72, 0, 1) solver matching var(--ease-drawer)
function evaluateRosterDrawerEase(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 5; i++) {
        const x = ((1.96 * u - 1.92) * u + 0.96) * u - t;
        if (Math.abs(x) < 1e-6) break;
        const dx = (5.88 * u - 3.84) * u + 0.96;
        if (Math.abs(dx) < 1e-6) break;
        u -= x / dx;
    }
    return ((0.16 * u - 1.32) * u + 2.16) * u;
}

function scrollRosterCardIntoView(
    cardId,
    drawerEl = null,
    animated = true,
    collapseOffsetAbove = 0,
    durationMs = 340,
    startHeightOverride = null,
    collapseOffsetBelow = 0
) {
    const container = document.getElementById('view-week');
    const rowEl = document.getElementById(cardId);
    if (!container || !rowEl) return;

    const spacer = document.getElementById('roster-scroll-spacer');
    const drawer = drawerEl || rowEl.querySelector('.roster-expandable-drawer');
    const currentDrawerHeight = (startHeightOverride !== null)
        ? startHeightOverride
        : (drawer ? drawer.getBoundingClientRect().height : 0);
    const targetDrawerHeight = getExpectedRosterDrawerHeight(cardId, drawer);
    const isCardExpanded = !!expandedRosterCards[cardId];

    const containerRect = container.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();

    // Bottom boundary: 20px breathing room above the bottom of the scroll view
    const safeBottom = containerRect.bottom - 20;

    const safeTop = containerRect.top + 12;
    const safeBottomOffset = safeBottom - containerRect.top;
    const safeTopOffset = 12;

    const headerEl = rowEl.querySelector('.roster-card-header');
    const rowHeaderHeight = headerEl ? headerEl.getBoundingClientRect().height : 72;

    // Projected row top & bottom in viewport coordinates and in unscrolled container coordinates
    const projectedRowTop = rowRect.top - collapseOffsetAbove;
    const projectedBottom = projectedRowTop + rowHeaderHeight + targetDrawerHeight;

    const currentScrollTop = container.scrollTop;
    const projectedContentTop = (rowRect.top - containerRect.top) + currentScrollTop - collapseOffsetAbove;
    const projectedContentBottom = projectedContentTop + rowHeaderHeight + targetDrawerHeight;

    // Calculate unspaced scrollHeight and projected maxScroll after all drawers settle
    const currentSpacerHeight = spacer ? spacer.getBoundingClientRect().height : 0;
    const initialUnspacedScrollHeight = Math.max(
        container.clientHeight,
        container.scrollHeight - currentSpacerHeight
    );
    const netHeightGrowth = (targetDrawerHeight - currentDrawerHeight) - collapseOffsetAbove - collapseOffsetBelow;
    const projectedScrollHeight = initialUnspacedScrollHeight + netHeightGrowth;
    const projectedMaxScroll = Math.max(0, projectedScrollHeight - container.clientHeight);

    let desiredScrollTop = currentScrollTop;

    if (isCardExpanded) {
        let scrollDelta = 0;
        if (projectedBottom > safeBottom) {
            scrollDelta = projectedBottom - safeBottom;
        }
        if (projectedRowTop - scrollDelta < safeTop) {
            scrollDelta = projectedRowTop - safeTop;
        }

        if (Math.abs(scrollDelta) >= 1) {
            desiredScrollTop = currentScrollTop + scrollDelta;
        } else if (collapseOffsetBelow > 0) {
            // A lower card was open and is now collapsing; glide smoothly back to the minimum scroll needed for this card
            const minScrollNeeded = Math.max(0, projectedContentBottom - safeBottomOffset);
            const maxScrollAllowed = Math.max(0, projectedContentTop - safeTopOffset);
            desiredScrollTop = Math.min(minScrollNeeded, maxScrollAllowed);
        }
    } else {
        // Card is closing and no card remains open: glide smoothly to projectedMaxScroll (0 on standard viewports)
        desiredScrollTop = projectedMaxScroll < 48 ? 0 : Math.min(currentScrollTop, projectedMaxScroll);
    }

    const targetScrollTop = Math.max(0, Math.min(projectedMaxScroll, desiredScrollTop));

    if (container._scrollRafId) {
        cancelAnimationFrame(container._scrollRafId);
        container._scrollRafId = null;
    }
    if (container._scrollCancelCleanup) {
        container._scrollCancelCleanup();
        container._scrollCancelCleanup = null;
    }

    if (!animated) {
        if (spacer) spacer.style.height = '0px';
        container.scrollTop = targetScrollTop;
        return;
    }

    const startScroll = currentScrollTop;
    const totalDiff = targetScrollTop - startScroll;

    if (Math.abs(totalDiff) < 1 && currentSpacerHeight < 1) {
        if (spacer) spacer.style.height = '0px';
        return;
    }

    const startTime = performance.now();
    let isCancelled = false;
    let lastAppliedSpacer = currentSpacerHeight;

    const cleanupListeners = () => {
        container.removeEventListener('touchstart', cancelHandler);
        container.removeEventListener('wheel', cancelHandler);
    };
    const cancelHandler = () => {
        isCancelled = true;
        if (spacer) spacer.style.height = '0px';
        cleanupListeners();
        container._scrollCancelCleanup = null;
    };
    container.addEventListener('touchstart', cancelHandler, { passive: true, once: true });
    container.addEventListener('wheel', cancelHandler, { passive: true, once: true });
    container._scrollCancelCleanup = cleanupListeners;

    function applyScrollFrame(elapsed) {
        const progress = Math.min(Math.max(elapsed / durationMs, 0), 1);
        const ease = evaluateRosterDrawerEase(progress);
        const nextScrollTop = startScroll + (totalDiff * ease);

        if (spacer) {
            if (progress < 1 && nextScrollTop > 0.5) {
                // Guard against 1-2 frames of CSS transition lead/lag so browser never clamps scrollTop
                const guardProgress = netHeightGrowth < 0
                    ? Math.min((elapsed + 28) / durationMs, 1)
                    : Math.max((elapsed - 28) / durationMs, 0);
                const guardEase = evaluateRosterDrawerEase(guardProgress);
                const modeledUnspacedHeight = initialUnspacedScrollHeight + (netHeightGrowth * guardEase);
                const liveUnspacedHeight = container.scrollHeight - lastAppliedSpacer;
                const conservativeUnspacedHeight = Math.min(modeledUnspacedHeight, liveUnspacedHeight);
                const requiredTotalHeight = container.clientHeight + Math.ceil(nextScrollTop) + 2;
                const neededSpacer = Math.max(0, requiredTotalHeight - conservativeUnspacedHeight);
                spacer.style.height = `${neededSpacer}px`;
                lastAppliedSpacer = neededSpacer;
            } else {
                spacer.style.height = '0px';
                lastAppliedSpacer = 0;
            }
        }

        container.scrollTop = nextScrollTop;
        return progress;
    }

    // Apply initial runway immediately before first paint so frame 1 cannot snap
    applyScrollFrame(0);

    function step(now) {
        if (isCancelled) return;
        const elapsed = now - startTime;
        const progress = applyScrollFrame(elapsed);

        if (progress < 1) {
            container._scrollRafId = requestAnimationFrame(step);
        } else {
            if (spacer) spacer.style.height = '0px';
            container.scrollTop = targetScrollTop;
            container._scrollRafId = null;
            cleanupListeners();
            container._scrollCancelCleanup = null;
        }
    }

    container._scrollRafId = requestAnimationFrame(step);
}

function animateRosterDrawerHeight(cardId, drawer, shouldExpand, startHeightOverride = null) {
    if (!drawer) return;
    const inner = drawer.querySelector('.roster-drawer-inner');
    if (!inner) return;

    if (drawer._onTransitionEnd) {
        drawer.removeEventListener('transitionend', drawer._onTransitionEnd);
        drawer._onTransitionEnd = null;
    }

    const currentHeight = (startHeightOverride !== null)
        ? startHeightOverride
        : drawer.getBoundingClientRect().height;
    const targetHeight = shouldExpand ? inner.scrollHeight : 0;

    drawer.style.height = `${currentHeight}px`;
    void drawer.offsetHeight;

    drawer.classList.toggle('is-expanded', shouldExpand);
    drawer.style.height = `${targetHeight}px`;

    if (shouldExpand) {
        const onEnd = (e) => {
            if (e.target !== drawer || e.propertyName !== 'height') return;
            drawer.removeEventListener('transitionend', onEnd);
            drawer._onTransitionEnd = null;
            if (expandedRosterCards[cardId]) {
                drawer.style.height = 'auto';
            }
        };
        drawer._onTransitionEnd = onEnd;
        drawer.addEventListener('transitionend', onEnd);
    }
}

function toggleCardWeatherMode(cardId) {
    triggerHaptic('medium');
    const currentMode = rosterCardStates[cardId] || 'normal';
    const newMode = currentMode === 'rain' ? 'normal' : 'rain';
    setCardWeatherMode(cardId, newMode);
}

function setCardWeatherMode(cardId, mode) {
    const config = ROSTER_CONFIG[cardId];
    const card = document.getElementById(cardId);
    if (!config || !card) {
        rosterCardStates[cardId] = mode;
        renderRosterCards();
        return;
    }

    const surfaceEl = card.querySelector('.roster-card-surface');
    if (!surfaceEl) {
        rosterCardStates[cardId] = mode;
        renderRosterCards();
        return;
    }

    rosterCardStates[cardId] = mode;
    const isRain = (mode === 'rain');
    const isToday = (cardId === activeTodayCardId);
    const targetSite = isRain ? config.rainSite : config.normalSite;

    // 1. Smoothly update card surface styling
    surfaceEl.classList.toggle('is-rain-mode', isRain);
    scheduleDynamicStatusBarSync();

    // 2. Smoothly update rain toggle button
    const toggleBtn = surfaceEl.querySelector('.roster-rain-btn');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-checked', isRain);
        toggleBtn.setAttribute('aria-label', isRain ? 'Rain site active. Tap to switch back to normal site' : 'Rain risk forecasted. Tap to switch to rain site');
        toggleBtn.setAttribute('title', isRain ? 'Rain site active — tap to switch to normal site' : 'Rain risk — tap to switch to wet weather site');
        toggleBtn.classList.toggle('is-active', isRain);
        toggleBtn.classList.toggle('is-inactive', !isRain);

        // Apple spring pop on the icon
        const icon = toggleBtn.querySelector('.roster-rain-icon');
        if (icon) {
            icon.classList.remove('spring-pop');
            void icon.offsetWidth; // restart keyframe animation
            icon.classList.add('spring-pop');
        }
    }

    // 3. Update chevron container dark/light style
    const chevronBtn = surfaceEl.querySelector('.roster-chevron-btn');
    if (chevronBtn && !isToday) {
        chevronBtn.classList.toggle('is-dark', isRain);
        chevronBtn.classList.toggle('is-light', !isRain);
    }

    // 4. Smooth Apple text morph / crossfade for site title and address
    const titleEl = surfaceEl.querySelector('.site-title');
    const addressLink = surfaceEl.querySelector('.site-address');
    const addressText = surfaceEl.querySelector('.site-address-text');

    if (card._titleCrossfadeTimer) {
        clearTimeout(card._titleCrossfadeTimer);
    }

    if (titleEl) {
        titleEl.style.opacity = '0';
        titleEl.style.transform = 'translateY(-3px)';
    }
    if (addressText) {
        addressText.style.opacity = '0';
        addressText.style.transform = 'translateY(-3px)';
    }

    card._titleCrossfadeTimer = setTimeout(() => {
        if (titleEl) {
            titleEl.textContent = targetSite.title;
            if (!isToday) {
                titleEl.classList.toggle('text-white', isRain);
                titleEl.classList.toggle('text-slate-900', !isRain);
            }
            titleEl.style.opacity = '1';
            titleEl.style.transform = 'translateY(0)';
        }
        if (addressLink) {
            addressLink.href = `https://maps.apple.com/?q=${encodeURIComponent(targetSite.address)}`;
            if (!isToday) {
                addressLink.className = `site-address inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors duration-300 ${isRain ? 'text-[#7DD3FC] hover:text-white' : 'text-emerald-600 hover:text-emerald-800'}`;
            }
        }
        if (addressText) {
            addressText.textContent = targetSite.address;
            addressText.style.opacity = '1';
            addressText.style.transform = 'translateY(0)';
        }
        card._titleCrossfadeTimer = null;
    }, 90);

    // 5. Rain mode shift line (times + arrangement) opens / closes under the address
    const shiftSlot = surfaceEl.querySelector('.roster-shift-slot');
    if (shiftSlot) shiftSlot.classList.toggle('is-active', isRain);

    // 6. Smooth team chips & divider update
    if (!isToday) {
        const divider = surfaceEl.querySelector('.roster-team-divider');
        if (divider) {
            divider.classList.toggle('border-slate-800', isRain);
            divider.classList.toggle('border-slate-100', !isRain);
        }
        const withLabel = surfaceEl.querySelector('.roster-with-label');
        if (withLabel) {
            withLabel.classList.toggle('text-slate-300', isRain);
            withLabel.classList.toggle('text-slate-500', !isRain);
        }
        surfaceEl.querySelectorAll('.roster-team-chip').forEach(chip => {
            chip.classList.toggle('bg-slate-800', isRain);
            chip.classList.toggle('text-white', isRain);
            chip.classList.toggle('border-slate-700', isRain);
            chip.classList.toggle('bg-slate-100', !isRain);
            chip.classList.toggle('text-slate-800', !isRain);
            chip.classList.toggle('border-slate-200/50', !isRain);
        });
    }

    // 7. If drawer is currently expanded, ensure seamless sizing & visibility above floating navbar
    if (expandedRosterCards[cardId]) {
        const drawer = document.getElementById(`drawer-${cardId}`);
        if (drawer) {
            const startDrawerHeight = drawer.getBoundingClientRect().height;
            drawer.style.height = 'auto';
            requestAnimationFrame(() => {
                scrollRosterCardIntoView(cardId, drawer, true, 0, 360, startDrawerHeight, 0);
            });
        }
    }
}

function toggleRosterCardExpand(cardId) {
    triggerHaptic('light');
    const willExpand = !expandedRosterCards[cardId];
    const rowEl = document.getElementById(cardId);
    if (!rowEl) return;

    let collapseOffsetAbove = 0;
    let collapseOffsetBelow = 0;

    if (willExpand) {
        const thisIdx = ROSTER_DAY_IDS.indexOf(cardId);
        // Accordion behavior: smoothly collapse any other currently expanded card
        ROSTER_DAY_IDS.forEach((otherId, otherIdx) => {
            if (otherId !== cardId && expandedRosterCards[otherId]) {
                expandedRosterCards[otherId] = false;
                const otherRow = document.getElementById(otherId);
                if (otherRow) {
                    const otherChevron = otherRow.querySelector('.roster-chevron');
                    if (otherChevron) otherChevron.classList.remove('rotate-180');
                    const otherDrawer = otherRow.querySelector('.roster-expandable-drawer');
                    if (otherDrawer) {
                        const otherHeight = otherDrawer.getBoundingClientRect().height;
                        if (otherIdx < thisIdx) {
                            collapseOffsetAbove += otherHeight;
                        } else {
                            collapseOffsetBelow += otherHeight;
                        }
                        animateRosterDrawerHeight(otherId, otherDrawer, false, otherHeight);
                    }
                }
            }
        });
    }

    const drawer = rowEl.querySelector('.roster-expandable-drawer');
    const chevron = rowEl.querySelector('.roster-chevron');
    const startDrawerHeight = drawer ? drawer.getBoundingClientRect().height : 0;

    expandedRosterCards[cardId] = willExpand;

    if (chevron) chevron.classList.toggle('rotate-180', willExpand);
    animateRosterDrawerHeight(cardId, drawer, willExpand, startDrawerHeight);

    scrollRosterCardIntoView(
        cardId,
        drawer,
        true,
        collapseOffsetAbove,
        340,
        startDrawerHeight,
        collapseOffsetBelow
    );
}

function openMapsForAddress(address) {
    triggerHaptic('light');
    if (navigator.userAgent.match(/(iPhone|iPod|iPad)/i)) {
        window.open(`https://maps.apple.com/?q=${encodeURIComponent(address)}`, '_blank');
    } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
}

// "7:00 AM – 3:30 PM" from the site shift window (SITE_SHIFT_START / SITE_SHIFT_END, site-card-energy.js)
function formatRosterShiftTimes() {
    const fmt = (mins) => {
        const h = Math.floor(mins / 60), m = mins % 60;
        return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    };
    const start = (typeof SITE_SHIFT_START !== 'undefined') ? SITE_SHIFT_START : 7 * 60;
    const end = (typeof SITE_SHIFT_END !== 'undefined') ? SITE_SHIFT_END : 15 * 60 + 30;
    return `${fmt(start)} – ${fmt(end)}`;
}

// The rain site's arrangement for that day, from the jobs data (JOBS_DATA[].days[day].isRainSafe):
// rain-safe means the crew works undercover; otherwise it is only the backup site
function getRainSiteArrangement(config) {
    const dayKey = String(config.day || '').toLowerCase();
    const job = (typeof JOBS_DATA !== 'undefined') ? JOBS_DATA.find(j => j.name === config.rainSite.title) : null;
    const day = job && job.days ? job.days[dayKey] : null;
    return (day && day.isRainSafe) ? 'Undercover' : 'Backup';
}

function renderRosterCards() {
    const cardIds = Object.keys(ROSTER_CONFIG);
    cardIds.forEach((cardId) => {
        const config = ROSTER_CONFIG[cardId];
        const card = document.getElementById(cardId);
        if (!card) return;

        const isToday = (cardId === activeTodayCardId);
        const isExpanded = !!expandedRosterCards[cardId];
        const currentMode = rosterCardStates[cardId] || 'normal';
        const isRainActive = (currentMode === 'rain');
        const activeSite = (isRainActive && config.isRainRisk) ? config.rainSite : config.normalSite;
        const isDarkSurface = isToday || (isRainActive && config.isRainRisk);

        let rainToggleBtnHtml = '';
        let rainBackdropHtml = '';
        let rainPillHtml = '';

        if (config.isRainRisk) {
            rainToggleBtnHtml = `
                        <button type="button"
                                onclick="event.stopPropagation(); toggleCardWeatherMode('${cardId}')" 
                                role="switch" 
                                aria-checked="${isRainActive}"
                                aria-label="${isRainActive ? 'Rain site active. Tap to switch back to normal site' : 'Rain risk forecasted. Tap to switch to rain site'}"
                                title="${isRainActive ? 'Rain site active — tap to switch to normal site' : 'Rain risk — tap to switch to wet weather site'}"
                                class="roster-rain-btn ${isRainActive ? 'is-active' : 'is-inactive'}">
                            <i class="ph-bold ph-cloud-rain roster-rain-icon" aria-hidden="true"></i>
                        </button>`;

            rainBackdropHtml = `
                        <div class="roster-rain-backdrop">
                            <div class="storm" aria-hidden="true">
                                <span class="storm-cloud"></span>
                                <span class="storm-rain" data-count="20"></span>
                                <span class="storm-flash"></span>
                            </div>
                        </div>`;

            // Rain mode: the shift line (times + the rain site's arrangement) replaces the old banner
            rainPillHtml = `
                        <div class="roster-shift-slot ${isRainActive ? 'is-active' : ''}" id="rain-shift-${cardId}">
                            <div class="roster-shift-inner">
                                <div class="roster-shift-row">
                                    <span class="roster-shift-time">${formatRosterShiftTimes()}</span>
                                    <span class="roster-shift-status">${getRainSiteArrangement(config)}</span>
                                </div>
                            </div>
                        </div>`;
        }

        let cardSurfaceBaseClass = isToday ? 'glass-card-today text-white' : 'glass-card-apple text-slate-900';
        let cardRainClass = (config.isRainRisk && isRainActive) ? 'is-rain-mode' : '';

        card.className = "roster-day-row relative z-10";
        card.innerHTML = `
                    <div class="relative flex items-start gap-3.5">
                        <!-- Left: Fixed-Size Apple Liquid Glass Date Tile (Never shrinks or shifts) -->
                        <div class="roster-date-tile w-[68px] min-w-[68px] h-[72px] shrink-0 rounded-inset flex flex-col items-center justify-center select-none z-10 ${isToday ? 'glass-tile-today' : 'glass-tile-apple'}">
                            <span class="text-[11px] font-black uppercase tracking-widest leading-none ${isToday ? 'text-emerald-300/90' : 'text-slate-400'}">
                                ${config.day}
                            </span>
                            <span class="text-2xl font-black tracking-tight leading-none ${isToday ? 'text-white' : 'text-slate-800'} mt-1.5">
                                ${config.dateNum}
                            </span>
                        </div>

                        <!-- Right: Fixed-Header Card that Smoothly Expands Downward -->
                        <div class="flex-1 min-w-0 z-10">
                            <div class="roster-card-surface relative flex flex-col ${cardSurfaceBaseClass} ${cardRainClass} rounded-inset overflow-hidden">
                                ${isToday ? '<div class="absolute -top-12 -left-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-[40px] pointer-events-none z-0"></div><div class="absolute -bottom-12 -right-12 w-36 h-36 bg-blue-600/15 rounded-full blur-[40px] pointer-events-none z-0"></div>' : ''}
                                ${rainBackdropHtml}
                                
                                <!-- Fixed 72px Header (1:1 height match with Date Tile when closed) -->
                                <div onclick="toggleRosterCardExpand('${cardId}')" role="button" tabindex="0" aria-expanded="${isExpanded}" class="roster-card-header relative z-10 h-[72px] pl-[18px] pr-3.5 flex items-center justify-between cursor-pointer select-none gap-2.5">
                                    <div class="min-w-0 flex-1">
                                        <h3 class="site-title text-xl sm:text-[22px] font-black tracking-tight leading-snug truncate ${isDarkSurface ? 'text-white' : 'text-slate-900'}">
                                            ${activeSite.title}
                                        </h3>
                                    </div>

                                    <div class="flex items-center gap-2 shrink-0">
                                        ${rainToggleBtnHtml}
                                        <div class="roster-chevron-btn w-10 h-10 rounded-full flex items-center justify-center ${isDarkSurface ? 'is-dark' : 'is-light'}">
                                            <i class="ph-bold ph-caret-down roster-chevron text-lg leading-none ${isExpanded ? 'rotate-180' : ''}"></i>
                                        </div>
                                    </div>
                                </div>

                                <!-- Measured 240ms Accordion Drawer (Pushes lower cards down cleanly) -->
                                <div class="relative z-10 roster-expandable-drawer ${isExpanded ? 'is-expanded' : ''}" id="drawer-${cardId}" style="height: ${isExpanded ? 'auto' : '0px'};">
                                    <div class="roster-drawer-inner">
                                        <div class="px-[18px] pb-4 pt-0.5">
                                            <div>
                                                <a href="https://maps.apple.com/?q=${encodeURIComponent(activeSite.address)}" target="_blank" onclick="event.stopPropagation()" class="site-address inline-flex items-center gap-1.5 text-[13px] font-semibold ${isToday ? 'text-emerald-200/90 hover:text-white' : (isRainActive ? 'text-[#7DD3FC] hover:text-white' : 'text-emerald-600 hover:text-emerald-800')} transition-colors">
                                                    <span class="site-address-text">${activeSite.address}</span>
                                                    <i class="ph-bold ph-arrow-up-right text-xs"></i>
                                                </a>
                                            </div>

                                            ${rainPillHtml}

                                            <div class="roster-team-divider pt-3 mt-3 border-t ${isToday ? 'border-emerald-500/20' : (isRainActive ? 'border-slate-800' : 'border-slate-100')}">
                                                <span class="roster-with-label text-[11px] font-black uppercase tracking-wider ${isToday ? 'text-emerald-300/90' : (isRainActive ? 'text-slate-300' : 'text-slate-500')} block mb-2">With:</span>
                                                <div class="flex flex-wrap gap-1.5">
                                                    ${sortCrewBySeniority(config.team).map(member => `
                                                        <span class="roster-team-chip inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full ${isToday ? 'bg-emerald-950/60 text-emerald-100 border border-emerald-500/30 font-bold text-xs shadow-inner' : (isRainActive ? 'bg-slate-800 text-white border border-slate-700 font-bold text-xs' : 'bg-slate-100 text-slate-800 border border-slate-200/50 font-bold text-xs')}">${renderRoleAvatar(member, 'sm')}<span>${member}</span></span>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

        if (config.isRainRisk) {
            // Storm rain streaks (styles/roster.css): a fixed, evenly spread pattern, so the card looks the
            // same on every render
            const rain = card.querySelector('.storm-rain');
            if (rain && rain.children.length === 0) {
                const n = parseInt(rain.dataset.count, 10) || 20;
                for (let i = 0; i < n; i++) {
                    const s = document.createElement('span');
                    s.style.setProperty('--x', Math.min(((i * 37) % 100) + (i % 3) * 2, 112) + '%');
                    s.style.setProperty('--d', ((i * 0.618) % 1).toFixed(3));
                    s.style.setProperty('--len', (12 + (i * 7) % 10) + 'px');
                    rain.appendChild(s);
                }
            }
        }
    });
}
