/**
 * My Week roster: week navigation, rain-site switching, accordion cards.
 *
 * Each card is one day from the roster (getRosterDay, scripts/application/selectors.js). A day is one or more
 * stints - a site and its hours - so a split day (Lugarno 7-9, then Castlecrag) uses the same stint row as a
 * normal day, once per site. Closed, a card is the at-a-glance week: the site (on a split day, where it
 * starts), a badge for a start time off the standard shift or more than one site, and the rain button on a
 * rain-risk day - tapping it turns the card to its wet-weather site. Opening a card shows the details:
 * address, hours and who you're working with.
 */

const ROSTER_DAY_IDS = ['card-mon', 'card-tue', 'card-wed', 'card-thu', 'card-fri'];
// The sites' day (APP_CONFIG.siteDemoDay): its week opens first and its card is "today"
const ROSTER_ANCHOR_DAY = DateRules.fromIso(APP_CONFIG.siteDemoDay);
const ROSTER_ANCHOR_MONDAY = DateRules.mondayOf(ROSTER_ANCHOR_DAY);
const ROSTER_ANCHOR_CARD = ROSTER_DAY_IDS[ROSTER_ANCHOR_DAY.getDay() - 1] || '';
let activeTodayCardId = ROSTER_ANCHOR_CARD;
const expandedRosterCards = {};
const rosterCardStates = {};             // cardId -> 'rain' while the card shows its wet-weather site

let currentRosterMonday = new Date(ROSTER_ANCHOR_MONDAY);
const ROSTER_SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Site filter (the Crew Status sheet's "View Full Site Schedule"): only the days at this site show.
// null = every day. Cleared by "All Sites" or by opening Roster afresh.
let rosterSiteFilter = null;

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

    const isAnchorWeek = DateRules.toIso(currentRosterMonday) === DateRules.toIso(ROSTER_ANCHOR_MONDAY);
    activeTodayCardId = isAnchorWeek ? ROSTER_ANCHOR_CARD : '';

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

// Opening Roster afresh (scripts/core/navigation.js): this week, every card collapsed and back on its
// normal site (any rain-site switch is undone)
function resetRosterView() {
    rosterSiteFilter = null;
    renderRosterSiteFilter();
    ROSTER_DAY_IDS.forEach(id => { expandedRosterCards[id] = false; delete rosterCardStates[id]; });
    const spacer = document.getElementById('roster-scroll-spacer');   // extra room left by a card scroll
    if (spacer) spacer.style.height = '0px';
    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    applyRosterWeek(getMondayForDate(today));
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

    return inner.scrollHeight;
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

// ----- Sites (scripts/application/selectors.js) -----
// A card's date in the week on screen
function getRosterCardDate(cardId) {
    const idx = ROSTER_DAY_IDS.indexOf(cardId);
    return new Date(currentRosterMonday.getFullYear(), currentRosterMonday.getMonth(), currentRosterMonday.getDate() + Math.max(0, idx));
}
// What a card shows for a site: { siteId, title, address }. An area ("Indoor Hub", in "Shed B") names a part
// of the site.
function describeRosterSite(siteId, area, areaDetail) {
    const site = getSiteById(siteId);
    if (!site) return { siteId: null, title: 'Not rostered', address: '' };
    const title = area ? `${site.shortName} ${area}` : site.shortName;
    const address = areaDetail ? `${site.address} (${areaDetail}), ${site.suburb}` : getSiteFullAddress(siteId);
    return { siteId, title, address };
}
function rosterAddressHref(address) {
    return address ? `href="https://maps.apple.com/?q=${encodeURIComponent(address)}"` : '';
}
const rosterEsc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ----- Times -----
// '07:00' -> { clock: '7:00', meridiem: 'AM' }
function rosterClock(hhmm) {
    const mins = TimeRules.minutes(hhmm) || 0;
    const h = Math.floor(mins / 60), m = mins % 60;
    return { clock: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, meridiem: h >= 12 ? 'PM' : 'AM' };
}
// "7:00 AM – 3:30 PM"; "7:00 – 9:00 AM" when both ends share AM / PM (compact)
function formatRosterRange(start, end, compact = false) {
    const a = rosterClock(start), b = rosterClock(end);
    if (compact && a.meridiem === b.meridiem) return `${a.clock} – ${b.clock} ${b.meridiem}`;
    return `${a.clock} ${a.meridiem} – ${b.clock} ${b.meridiem}`;
}
// "2h", "6h 30m"
function formatRosterDuration(start, end) {
    const mins = Math.max(0, (TimeRules.minutes(end) || 0) - (TimeRules.minutes(start) || 0));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h && m ? `${h}h ${m}m` : (h ? `${h}h` : `${m}m`);
}

// ----- A card's day -----
function rosterIsStandardShift(start, end) {
    return start === RosterRules.DEFAULT_SHIFT.start && end === RosterRules.DEFAULT_SHIFT.end;
}
// Everything a card shows for its date: the roster day (selectors), and in the demo week its rain risk and
// wet-weather site (ROSTER_CONFIG). Rain mode puts the whole day at the rain site, with the same crew.
// { date, rostered, splitDay, multiSite (false while rain mode puts the day at one site), start, end, stints: [{ site, start, end, crew }], crew, rainRisk, rainOn,
//   wetSites / drySites (a rain-risk day: the rain site, and the day's usual sites) }
function getRosterCardModel(cardId) {
    const date = getRosterCardDate(cardId);
    const day = getRosterDay(date);
    const isDemoWeek = DateRules.toIso(currentRosterMonday) === DateRules.toIso(ROSTER_ANCHOR_MONDAY);
    const config = isDemoWeek ? ROSTER_CONFIG[cardId] : null;
    const base = { date, rostered: !!day, splitDay: false, multiSite: false, start: null, end: null, stints: [], crew: [], rainRisk: false, rainOn: false };
    if (!day) return base;

    const stints = day.stints.map(s => ({
        site: describeRosterSite(s.siteId), start: s.start, end: s.end,
        crew: sortRosterCrew(getRosterCrew(date, s.siteId, s.start, s.end))
    }));
    // Everyone you work with that day, once each
    const crew = sortRosterCrew([...new Map(stints.flatMap(s => s.crew).map(p => [p.id, p])).values()]);
    const rainRisk = !!(config && config.isRainRisk && config.rainSite);
    const rainOn = rainRisk && rosterCardStates[cardId] === 'rain';
    const model = { ...base, splitDay: day.multiSite, multiSite: day.multiSite, start: day.start, end: day.end, stints, crew, rainRisk, rainOn };
    if (rainRisk) {
        // Both plans for the day, so the open card can show the one you're not looking at
        const r = config.rainSite;
        model.wetSites = [describeRosterSite(r.siteId, r.area, r.areaDetail)];
        model.drySites = stints.map(s => s.site);
    }
    if (rainOn) {
        model.multiSite = false;
        model.stints = [{ site: model.wetSites[0], start: day.start, end: day.end, crew }];
    }
    return model;
}
function sortRosterCrew(people) {
    const order = sortCrewBySeniority(people.map(p => p.name));
    return order.map(name => people.find(p => p.name === name));
}

// ----- Card pieces (each re-rendered on its own when rain mode switches) -----
function renderRosterCrewChips(crew) {
    if (!crew.length) return '';
    return `<div class="roster-crew-chips">${crew.map(p =>
        `<span class="roster-team-chip">${renderRoleAvatar(p, 'sm')}<span>${rosterEsc(p.name)}</span></span>`).join('')}</div>`;
}
// A stint's crew, compactly: their avatars and first names ("David, Trent and James")
function renderRosterCrewLine(crew) {
    if (!crew.length) return '';
    const names = crew.map(p => p.name.split(' ')[0]);
    const text = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
    return `<div class="roster-stint-crew">
                <span class="role-avatar-stack" aria-hidden="true">${crew.map(p => renderRoleAvatar(p, 'xs')).join('')}</span>
                <span class="roster-stint-crew-names">${rosterEsc(text)}</span>
            </div>`;
}
function renderRosterAddress(site) {
    return `<a ${rosterAddressHref(site.address)} target="_blank" rel="noopener" onclick="event.stopPropagation()" class="site-address">
                <span class="site-address-text">${rosterEsc(site.address)}</span><i class="ph-bold ph-arrow-up-right" aria-hidden="true"></i>
            </a>`;
}
// A rain-risk day's other plan, so both can be seen in the open card: "If it's wet" (the rain site) on the
// usual plan, "If it's dry" (the usual sites) once the card is switched to the rain site
function renderRosterOtherPlan(model) {
    if (!model.rainRisk) return '';
    const wet = !model.rainOn;
    const sites = wet ? model.wetSites : model.drySites;
    return `<div class="roster-other-plan ${wet ? 'is-wet' : 'is-dry'}">
                <span class="roster-other-plan-label"><i class="ph-fill ${wet ? 'ph-cloud-rain' : 'ph-sun'}" aria-hidden="true"></i>${wet ? "If it's wet" : "If it's dry"}</span>
                <span class="roster-other-plan-site">${sites.map(x => rosterEsc(x.title)).join(' <span class="roster-other-plan-then">then</span> ')}</span>
                ${sites.length === 1 ? renderRosterAddress(sites[0]) : ''}
            </div>`;
}
// The open card's body. One site: its hours (off the standard shift), address, the other rain plan, crew.
// A split day: a stint row per site - hours and length, site, address, crew - on a rail that joins them in
// order, then the other rain plan.
function renderRosterStints(model) {
    if (!model.multiSite) {
        const s = model.stints[0];
        return `<div class="roster-stint-single">
                    ${rosterIsStandardShift(model.start, model.end) ? '' : `<div class="roster-stint-time roster-single-hours">${formatRosterRange(model.start, model.end)}</div>`}
                    <div class="roster-address-row">${renderRosterAddress(s.site)}</div>
                    ${renderRosterOtherPlan(model)}
                    ${s.crew.length ? `<div class="roster-team-divider"><span class="roster-with-label">Working with</span>${renderRosterCrewChips(s.crew)}</div>` : ''}
                </div>`;
    }
    return `<ol class="roster-stints" aria-label="${model.stints.length} sites today">${model.stints.map((s, i) => `
                <li class="roster-stint">
                    <span class="roster-stint-dot" aria-hidden="true">${i + 1}</span>
                    <div class="roster-stint-body">
                        <div class="roster-stint-when">
                            <span class="roster-stint-time">${formatRosterRange(s.start, s.end, true)}</span>
                            <span class="roster-stint-length">${formatRosterDuration(s.start, s.end)}</span>
                        </div>
                        <div class="roster-stint-site">${rosterEsc(s.site.title)}</div>
                        ${renderRosterAddress(s.site)}
                        ${renderRosterCrewLine(s.crew)}
                    </div>
                </li>`).join('')}
            </ol>${renderRosterOtherPlan(model)}`;
}
// Closed card title: the site, or on a split day where it starts
function rosterCardTitle(model) {
    if (!model.rostered) return 'Not rostered';
    return model.stints[0].site.title;
}
function rosterCardLabel(cardId, model) {
    const d = model.date;
    const when = `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]} ${d.getDate()} ${ROSTER_SHORT_MONTHS[d.getMonth()]}`;
    if (!model.rostered) return `${when}: not rostered`;
    const where = model.multiSite
        ? model.stints.map(s => `${s.site.title} ${formatRosterRange(s.start, s.end)}`).join(', then ')
        : `${model.stints[0].site.title}, ${formatRosterRange(model.start, model.end)}`;
    const rain = model.rainOn ? '. Rain site' : (model.rainRisk ? '. Rain risk' : '');
    return `${when}: ${where}${rain}${model.crew.length ? `. ${model.crew.length} crew` : ''}`;
}

function toggleCardWeatherMode(cardId) {
    triggerHaptic('medium');
    const currentMode = rosterCardStates[cardId] || 'normal';
    setCardWeatherMode(cardId, currentMode === 'rain' ? 'normal' : 'rain');
}

// Rain mode on / off in place: the surface and button change at once, the title and body crossfade, and an
// open drawer animates to its new height
function setCardWeatherMode(cardId, mode) {
    rosterCardStates[cardId] = mode;
    const card = document.getElementById(cardId);
    const surfaceEl = card && card.querySelector('.roster-card-surface');
    if (!surfaceEl) { renderRosterCards(); return; }

    const model = getRosterCardModel(cardId);
    const isRain = model.rainOn;
    surfaceEl.classList.toggle('is-rain-mode', isRain);
    scheduleDynamicStatusBarSync();

    const toggleBtn = surfaceEl.querySelector('.roster-rain-btn');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-checked', isRain);
        toggleBtn.setAttribute('aria-label', isRain ? 'Rain site active. Tap to switch back to normal site' : 'Rain risk forecasted. Tap to switch to rain site');
        toggleBtn.classList.toggle('is-active', isRain);
        toggleBtn.classList.toggle('is-inactive', !isRain);
        const icon = toggleBtn.querySelector('.roster-rain-icon');
        if (icon) {
            icon.classList.remove('spring-pop');
            void icon.offsetWidth;                // restart the keyframe animation
            icon.classList.add('spring-pop');
        }
    }
    // A split day's badge stands down while the day is at the rain site
    const splitBadge = surfaceEl.querySelector('.roster-badge--split');
    if (splitBadge) splitBadge.hidden = !model.multiSite;

    const titleEl = surfaceEl.querySelector('.site-title');
    const bodyEl = surfaceEl.querySelector('.roster-card-body');
    const fading = [titleEl, bodyEl].filter(Boolean);
    fading.forEach(el => el.classList.add('is-swapping'));
    if (card._titleCrossfadeTimer) clearTimeout(card._titleCrossfadeTimer);
    card._titleCrossfadeTimer = setTimeout(() => {
        const drawer = document.getElementById(`drawer-${cardId}`);
        const open = !!expandedRosterCards[cardId] && drawer;
        const startDrawerHeight = open ? drawer.getBoundingClientRect().height : 0;
        if (titleEl) titleEl.textContent = rosterCardTitle(model);
        if (bodyEl) bodyEl.innerHTML = renderRosterStints(model);
        const header = surfaceEl.querySelector('.roster-card-header');
        if (header) header.setAttribute('aria-label', rosterCardLabel(cardId, model));
        requestAnimationFrame(() => fading.forEach(el => el.classList.remove('is-swapping')));
        if (open) {
            animateRosterDrawerHeight(cardId, drawer, true, startDrawerHeight);
            requestAnimationFrame(() => scrollRosterCardIntoView(cardId, drawer, true, 0, 340, startDrawerHeight, 0));
        }
        card._titleCrossfadeTimer = null;
    }, 90);
}

function toggleRosterCardExpand(cardId) {
    const rowEl = document.getElementById(cardId);
    if (!rowEl || !rowEl.querySelector('.roster-expandable-drawer')) return;   // not rostered: nothing to open
    triggerHaptic('light');
    const willExpand = !expandedRosterCards[cardId];

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
                    const otherHeader = otherRow.querySelector('.roster-card-header');
                    if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
                    const otherSurface = otherRow.querySelector('.roster-card-surface');
                    if (otherSurface) otherSurface.classList.remove('is-open');
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
    const header = rowEl.querySelector('.roster-card-header');
    const startDrawerHeight = drawer ? drawer.getBoundingClientRect().height : 0;

    expandedRosterCards[cardId] = willExpand;

    if (chevron) chevron.classList.toggle('rotate-180', willExpand);
    if (header) header.setAttribute('aria-expanded', String(willExpand));
    const surface = rowEl.querySelector('.roster-card-surface');
    if (surface) surface.classList.toggle('is-open', willExpand);
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

const ROSTER_DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const ROSTER_TODAY_LIGHT = '<div class="roster-today-light" aria-hidden="true"><div class="rtl-pool rtl-pool-a"></div><div class="rtl-pool rtl-pool-b"></div><div class="rtl-pool rtl-pool-c"></div><div class="rtl-channel"></div><div class="rtl-edges"></div><div class="rtl-glass"></div></div>';
// Light rain inside an open rain-risk card (the usual site): a warning, not the storm. Switching to the rain
// site crossfades it into the full storm (ROSTER_STORM).
const ROSTER_DRIZZLE = '<div class="roster-drizzle" aria-hidden="true"><span class="storm-rain" data-count="14"></span></div>';
const ROSTER_STORM = '<div class="roster-rain-backdrop"><div class="storm" aria-hidden="true"><span class="storm-cloud"></span><span class="storm-rain" data-count="20"></span><span class="storm-flash"></span></div></div>';

function renderRosterCards() {
    ROSTER_DAY_IDS.forEach((cardId) => {
        const card = document.getElementById(cardId);
        if (!card) return;

        const model = getRosterCardModel(cardId);
        const isToday = (cardId === activeTodayCardId);
        const isOff = !model.rostered;
        if (isOff) expandedRosterCards[cardId] = false;
        const isExpanded = !!expandedRosterCards[cardId];
        const d = model.date;

        // Badges: what's different about the day, at a glance - an unusual start ("6:00"; a morning start needs
        // no AM, so the site name keeps its room), more than one site - in the rain button's glass family
        const badges = [];
        if (model.rostered && model.start !== RosterRules.DEFAULT_SHIFT.start) {
            badges.push(`<span class="roster-badge roster-badge--time" title="Starts ${formatRosterRange(model.start, model.end)}"><i class="ph-bold ph-clock" aria-hidden="true"></i>${rosterClock(model.start).meridiem === 'AM' ? rosterClock(model.start).clock : `${rosterClock(model.start).clock} PM`}</span>`);
        }
        if (model.splitDay) {
            badges.push(`<span class="roster-badge roster-badge--split" ${model.multiSite ? '' : 'hidden'} title="More than one site this day"><i class="ph-bold ph-path" aria-hidden="true"></i>${new Set(getRosterDay(d).stints.map(s => s.siteId)).size}</span>`);
        }
        if (model.rainRisk) {
            badges.push(`
                        <button type="button" onclick="event.stopPropagation(); toggleCardWeatherMode('${cardId}')" role="switch"
                                aria-checked="${model.rainOn}"
                                aria-label="${model.rainOn ? 'Rain site active. Tap to switch back to normal site' : 'Rain risk forecasted. Tap to switch to rain site'}"
                                title="${model.rainOn ? 'Rain site active: tap to switch to normal site' : 'Rain risk: tap to switch to wet weather site'}"
                                class="roster-rain-btn ${model.rainOn ? 'is-active' : 'is-inactive'}">
                            <i class="ph-bold ph-cloud-rain roster-rain-icon" aria-hidden="true"></i>
                        </button>`);
        }

        const surfaceClass = [
            'roster-card-surface relative flex flex-col rounded-inset overflow-hidden',
            isToday ? 'glass-card-today' : 'glass-card-apple',
            model.rainOn ? 'is-rain-mode' : '',
            isOff ? 'is-off' : '',
            isExpanded ? 'is-open' : ''
        ].join(' ');

        card.className = 'roster-day-row relative z-10';
        card.innerHTML = `
                    <div class="relative flex items-start gap-3.5">
                        <div class="roster-date-tile ${isToday ? 'glass-tile-today' : 'glass-tile-apple'} ${isOff ? 'is-off' : ''}" aria-hidden="true">
                            <span class="roster-date-dow">${ROSTER_DAY_SHORT[d.getDay()]}</span>
                            <span class="roster-date-num">${String(d.getDate()).padStart(2, '0')}</span>
                        </div>

                        <div class="flex-1 min-w-0 z-10">
                            <div class="${surfaceClass}">
                                ${isToday ? ROSTER_TODAY_LIGHT : ''}
                                ${model.rainRisk ? ROSTER_STORM + ROSTER_DRIZZLE : ''}

                                <div ${isOff ? '' : `onclick="toggleRosterCardExpand('${cardId}')" role="button" tabindex="0" aria-expanded="${isExpanded}" aria-controls="drawer-${cardId}"`}
                                     aria-label="${rosterEsc(rosterCardLabel(cardId, model))}"
                                     class="roster-card-header relative z-10 ${isOff ? '' : 'cursor-pointer'} select-none">
                                    <div class="roster-head-row">
                                        <h3 class="site-title truncate">${rosterEsc(rosterCardTitle(model))}</h3>
                                        ${isOff ? '' : `
                                        <div class="roster-head-actions">
                                            ${badges.join('')}
                                            <div class="roster-chevron-btn w-10 h-10 rounded-full flex items-center justify-center ${(isToday || model.rainOn) ? 'is-dark' : 'is-light'}" aria-hidden="true">
                                                <i class="ph-bold ph-caret-down roster-chevron text-lg leading-none ${isExpanded ? 'rotate-180' : ''}"></i>
                                            </div>
                                        </div>`}
                                    </div>
                                </div>

                                ${isOff ? '' : `
                                <div class="relative z-10 roster-expandable-drawer ${isExpanded ? 'is-expanded' : ''}" id="drawer-${cardId}" style="height: ${isExpanded ? 'auto' : '0px'};">
                                    <div class="roster-drawer-inner">
                                        <div class="roster-card-body">${renderRosterStints(model)}</div>
                                    </div>
                                </div>`}
                            </div>
                        </div>
                    </div>
                `;

        if (model.rainRisk) {
            // Storm rain streaks (styles/roster.css): a fixed, evenly spread pattern, so the card looks the
            // same on every render
            card.querySelectorAll('.storm-rain').forEach(rain => {
            if (rain.children.length === 0) {
                const n = parseInt(rain.dataset.count, 10) || 20;
                for (let i = 0; i < n; i++) {
                    const s = document.createElement('span');
                    s.style.setProperty('--x', Math.min(((i * 37) % 100) + (i % 3) * 2, 112) + '%');
                    s.style.setProperty('--d', ((i * 0.618) % 1).toFixed(3));
                    s.style.setProperty('--len', (12 + (i * 7) % 10) + 'px');
                    rain.appendChild(s);
                }
            }
            });
        }
        // Site filter: a day shows when any of its stints is at the site
        const atFilter = !rosterSiteFilter || model.stints.some(s => s.site.siteId === rosterSiteFilter);
        card.style.display = atFilter ? '' : 'none';
    });
    const empty = document.getElementById('roster-filter-empty');
    if (empty) {
        const none = !!rosterSiteFilter && ROSTER_DAY_IDS.every(id => { const c = document.getElementById(id); return !c || c.style.display === 'none'; });
        empty.hidden = !none;
        if (none) empty.textContent = `No days at ${getSiteName(rosterSiteFilter, 'this site')} this week`;
    }
}

// Roster for one site: the week of `date`, today's card open, only the days at `siteId`
function showRosterForSite(siteId, date) {
    rosterSiteFilter = siteId || null;
    renderRosterSiteFilter();
    applyRosterWeek(getMondayForDate(date), date);
}
function clearRosterSiteFilter() {
    if (!rosterSiteFilter) return;
    triggerHaptic('light');
    rosterSiteFilter = null;
    renderRosterSiteFilter();
    renderRosterCards();
}
// The filter bar (shared filter pills): "All Sites" and the filtered site, shown only while filtering
function renderRosterSiteFilter() {
    const bar = document.getElementById('roster-site-filter');
    if (!bar) return;
    bar.hidden = !rosterSiteFilter;
    if (!rosterSiteFilter) { bar.innerHTML = ''; return; }
    const name = getSiteName(rosterSiteFilter, 'Site');
    bar.innerHTML = `<button type="button" class="filter-pill" aria-pressed="false" onclick="clearRosterSiteFilter()">All Sites</button>`
        + `<button type="button" class="filter-pill is-active" aria-pressed="true"><i class="ph-fill ph-map-pin" aria-hidden="true"></i>${name}</button>`;
}

// Sites renamed or archived: redraw the cards
subscribeSites(() => renderRosterCards());
