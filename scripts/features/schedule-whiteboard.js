/**
 * Schedule view: multi-week trade whiteboard, Gantt timeline, trade CRUD, shared materials.
 */

// =========================================================================
// APPLE MOBILE MULTI-WEEK TRADE SCHEDULE & WHITEBOARD ROSTER ENGINE
// =========================================================================

// Active State
let currentWhiteboardWeekIndex = 1; // Default to Week 2 (This Week)
let activeWhiteboardTradeFilter = 'all';

// Initialize Whiteboard Roster
function initWhiteboardRoster() {
    renderWhiteboardRoster();
    setupWhiteboardTouchSwipe();
}

// Master Render Orchestrator
function renderWhiteboardRoster() {
    renderWhiteboardHeader();
    renderWhiteboardWeekPills();
    render7DayStrip();
    renderWeeklyTimelineBars();
    renderDailyRosterCards();
    updateTradeFilterCounts();
}

// 1. Render Week Title & Subtitle Header
function renderWhiteboardHeader() {
    const week = WHITEBOARD_WEEKS_LIST[currentWhiteboardWeekIndex];
    if (!week) return;

    const titleEl = document.getElementById('wb-week-title');
    const subtitleEl = document.getElementById('wb-week-subtitle');

    if (titleEl) titleEl.textContent = week.title;
    if (subtitleEl) {
        subtitleEl.textContent = week.subtitle;
        if (week.isCurrentWeek) {
            subtitleEl.className = 'text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider block';
        } else {
            subtitleEl.className = 'text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block';
        }
    }
}

// 2. Render Week Pills (Quick navigation to this week, next week, week after)
function renderWhiteboardWeekPills() {
    const container = document.getElementById('wb-week-pills-row');
    if (!container) return;

    let html = `
        <button onclick="jumpWhiteboardToday()" class="hit-44 px-3 py-1.5 rounded-xl bg-slate-900 text-brand-lime text-xs font-black shrink-0 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:bg-black">
            <span class="w-1.5 h-1.5 rounded-full bg-brand-lime"></span>
            <span>Today</span>
        </button>
    `;

    WHITEBOARD_WEEKS_LIST.forEach((w, idx) => {
        const isSelected = idx === currentWhiteboardWeekIndex;
        if (isSelected) {
            html += `
                <button onclick="selectWhiteboardWeek(${idx})" class="hit-44 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black shrink-0 shadow-apple flex items-center gap-1.5 cursor-pointer border border-slate-800">
                    <span>${w.shortTitle}</span>
                    <span class="text-[11px] font-black text-brand-lime">Active</span>
                </button>
            `;
        } else {
            html += `
                <button onclick="selectWhiteboardWeek(${idx})" class="hit-44 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 text-xs font-extrabold shrink-0 border border-slate-200/70 shadow-xs cursor-pointer active:scale-95 transition-all">
                    <span>${w.shortTitle}</span>
                </button>
            `;
        }
    });

    container.innerHTML = html;
}

// 3. Render 7-Day Week Strip with Direct "+" Action for Each Day
function render7DayStrip() {
    const container = document.getElementById('wb-7day-strip');
    if (!container) return;

    const week = WHITEBOARD_WEEKS_LIST[currentWhiteboardWeekIndex];
    if (!week) return;

    let html = '';

    week.days.forEach(d => {
        // Count trades active on this day
        const activeTrades = whiteboardTradeTasks.filter(t => {
            return d.dateStr >= t.startDate && d.dateStr <= t.endDate;
        });

        const tradeCount = activeTrades.length;
        const isToday = d.isToday;

        html += `
            <div onclick="scrollToDayCard('${d.dateStr}')" 
                 class="group relative flex flex-col items-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${isToday ? 'bg-slate-900 text-white shadow-apple ring-2 ring-emerald-500/40' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'}">
                
                <!-- Day of Week Letter -->
                <span class="text-[11px] font-black uppercase tracking-wider ${isToday ? 'text-brand-lime' : 'text-slate-400'}">${d.dayLetter}</span>
                
                <!-- Date Number -->
                <span class="text-sm font-black mt-0.5 leading-none ${isToday ? 'text-white' : 'text-slate-900'}">${d.dayNum}</span>
                
                <!-- Active Trades Indicator Dots / Count -->
                <div class="h-3 flex items-center justify-center mt-1">
                    ${tradeCount > 0 
                        ? `<span class="px-1.5 py-0.5 rounded-full text-[11px] font-black ${isToday ? 'bg-brand-lime text-slate-950' : 'bg-slate-200 text-slate-800'}">${tradeCount}</span>` 
                        : `<span class="w-1 h-1 rounded-full bg-slate-300"></span>`
                    }
                </div>

                <!-- Direct Quick "+" Button to Add Trade on This Day -->
                <button onclick="event.stopPropagation(); openNewWhiteboardTradeModal('${d.dateStr}')" 
                        aria-label="Add Trade on ${d.dayName} ${d.dayNum}"
                        title="Add Trade on ${d.dayName} ${d.dayNum}"
                        class="hit-44 w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow-xs mt-1 transition-all active:scale-75 cursor-pointer ${isToday ? 'bg-brand-lime text-slate-950 hover:bg-white' : 'bg-white text-slate-900 hover:bg-slate-900 hover:text-white border border-slate-200'}">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 4. Render Weekly Visual Multi-Day Gantt Timeline (100% Mobile Screen Width!)
function renderWeeklyTimelineBars() {
    const dayHeadersContainer = document.getElementById('wb-timeline-day-headers');
    const barsContainer = document.getElementById('wb-timeline-bars');
    const badgeEl = document.getElementById('wb-active-trades-badge');
    if (!dayHeadersContainer || !barsContainer) return;

    const week = WHITEBOARD_WEEKS_LIST[currentWhiteboardWeekIndex];
    if (!week) return;

    // Render 7-day column headers (M 5, T 6, W 7, T 8, F 9, S 10, S 11)
    let headerHtml = '';
    week.days.forEach(d => {
        headerHtml += `
            <div class="py-1 rounded-lg ${d.isToday ? 'bg-brand-lime/20 text-brand-lime font-black' : 'text-slate-400'}">
                <span>${d.dayLetter}</span>
                <span class="text-[11px] font-black ml-0.5">${d.dayNum}</span>
            </div>
        `;
    });
    dayHeadersContainer.innerHTML = headerHtml;

    // Filter tasks by active week and category filter
    const weekStart = week.startDate;
    const weekEnd = week.endDate;

    const filteredTasks = whiteboardTradeTasks.filter(t => {
        if (activeWhiteboardTradeFilter !== 'all' && t.trade !== activeWhiteboardTradeFilter) {
            return false;
        }
        // Check if task overlaps this week
        return t.startDate <= weekEnd && t.endDate >= weekStart;
    });

    if (badgeEl) {
        badgeEl.textContent = `${filteredTasks.length} Trade${filteredTasks.length === 1 ? '' : 's'}`;
    }

    if (filteredTasks.length === 0) {
        barsContainer.innerHTML = `
            <div class="py-5 text-center text-xs text-slate-400 font-extrabold flex flex-col items-center justify-center gap-2">
                <span>No trades scheduled for this week</span>
                <button onclick="openNewWhiteboardTradeModal('${weekStart}')" class="px-3 py-1.5 rounded-xl bg-slate-800 text-brand-lime text-xs font-bold hover:bg-slate-700 active:scale-95 transition-all">
                    + Schedule First Trade
                </button>
            </div>
        `;
        return;
    }

    // Render Spanning Horizontal Bars within the 7-day grid
    let barsHtml = '';

    filteredTasks.forEach(task => {
        const theme = WHITEBOARD_TRADE_THEMES[task.trade] || WHITEBOARD_TRADE_THEMES.steel;

        // Calculate start col (0 to 6)
        let startCol = 0;
        let endCol = 6;

        week.days.forEach((d, idx) => {
            if (d.dateStr === task.startDate) startCol = idx;
            if (d.dateStr === task.endDate) endCol = idx;
        });

        // Clamp to week bounds
        if (task.startDate < weekStart) startCol = 0;
        if (task.endDate > weekEnd) endCol = 6;

        startCol = Math.max(0, Math.min(6, startCol));
        endCol = Math.max(startCol, Math.min(6, endCol));

        const colSpan = endCol - startCol + 1;
        const leftPercent = (startCol / 7) * 100;
        const widthPercent = (colSpan / 7) * 100;

        // Duration calculation
        const sDate = new Date(task.startDate);
        const eDate = new Date(task.endDate);
        const daysCount = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1);

        barsHtml += `
            <div class="relative w-full h-8 flex items-center">
                <!-- Grid background subtle column guides -->
                <div class="absolute inset-0 grid grid-cols-7 pointer-events-none opacity-10">
                    <div class="border-r border-white h-full"></div>
                    <div class="border-r border-white h-full"></div>
                    <div class="border-r border-white h-full"></div>
                    <div class="border-r border-white h-full"></div>
                    <div class="border-r border-white h-full"></div>
                    <div class="border-r border-white h-full"></div>
                    <div></div>
                </div>

                <!-- Continuous Spanning Capsule Bar -->
                <div onclick="openTradeDetailModal('${task.id}')"
                     style="left: ${leftPercent}%; width: ${widthPercent}%;"
                     class="absolute h-7.5 px-2.5 rounded-xl ${theme.barBg} shadow-sm flex items-center justify-between text-xs font-black cursor-pointer active:scale-98 transition-all overflow-hidden z-10 border border-white/20 hover:brightness-110">
                    
                    <div class="flex items-center gap-1.5 truncate">
                        <i class="fa-solid ${theme.icon} text-xs shrink-0" aria-hidden="true"></i>
                        <span class="truncate text-[11px] font-black">${task.title}</span>
                    </div>

                    <span class="text-[11px] font-black px-1.5 py-0.5 rounded-md bg-black/25 text-white shrink-0 ml-1">
                        ${daysCount}d
                    </span>
                </div>
            </div>
        `;
    });

    barsContainer.innerHTML = barsHtml;
}

// 5. Render Day-by-Day Detailed Site Roster Cards for This Week
function renderDailyRosterCards() {
    const container = document.getElementById('wb-daily-cards-container');
    if (!container) return;

    const week = WHITEBOARD_WEEKS_LIST[currentWhiteboardWeekIndex];
    if (!week) return;

    let html = '';

    week.days.forEach(d => {
        // Find trades active on this day
        const dayTrades = whiteboardTradeTasks.filter(t => {
            if (activeWhiteboardTradeFilter !== 'all' && t.trade !== activeWhiteboardTradeFilter) {
                return false;
            }
            return d.dateStr >= t.startDate && d.dateStr <= t.endDate;
        });

        const isToday = d.isToday;

        html += `
            <div id="wb-day-card-${d.dateStr}" class="p-3.5 sm:p-4 rounded-card bg-white/90 backdrop-blur-2xl border ${isToday ? 'border-emerald-500/80 shadow-apple-lg ring-1 ring-emerald-500/30' : 'border-white/95 shadow-apple'} space-y-3 transition-all">
                
                <!-- Day Header with Direct "+" Button -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${isToday ? 'bg-slate-900 text-brand-lime shadow-xs' : 'bg-slate-100 text-slate-800'}">
                            ${d.dayNum}
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <h4 class="text-sm font-black text-slate-900 tracking-tight">${d.dayName}, ${d.dayNum} Oct</h4>
                                ${isToday ? '<span class="px-2 py-0.5 rounded-full bg-slate-900 text-brand-lime text-[11px] font-black uppercase tracking-wider">Today</span>' : ''}
                            </div>
                            <span class="text-[11px] font-extrabold ${dayTrades.length > 0 ? 'text-slate-600' : 'text-slate-400'}">
                                ${dayTrades.length} Trade${dayTrades.length === 1 ? '' : 's'} Scheduled On Site
                            </span>
                        </div>
                    </div>

                    <!-- Direct Apple "+ Add Trade" Button for this Day -->
                    <button onclick="openNewWhiteboardTradeModal('${d.dateStr}')" 
                            aria-label="Add Trade to ${d.dayName}"
                            class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-brand-lime text-xs font-black shadow-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer">
                        <i class="fa-solid fa-plus text-[11px]"></i>
                        <span>Add Trade</span>
                    </button>
                </div>

                <!-- Trades List for This Day -->
                <div class="space-y-2">
        `;

        if (dayTrades.length === 0) {
            html += `
                <div class="p-3 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-extrabold flex items-center justify-between">
                    <span>No trades scheduled for this day</span>
                    <button onclick="openNewWhiteboardTradeModal('${d.dateStr}')" class="text-xs font-black text-slate-800 hover:text-emerald-700 flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-plus text-[11px]"></i>
                        <span>Schedule</span>
                    </button>
                </div>
            `;
        } else {
            dayTrades.forEach(task => {
                const theme = WHITEBOARD_TRADE_THEMES[task.trade] || WHITEBOARD_TRADE_THEMES.steel;

                // Duration calculation
                const sDate = new Date(task.startDate);
                const eDate = new Date(task.endDate);
                const daysCount = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1);

                html += `
                    <div onclick="openTradeDetailModal('${task.id}')" 
                         class="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 ${theme.cardBorder} space-y-2 cursor-pointer transition-all active:scale-[0.99] group shadow-xs">
                        
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-1.5">
                                <i class="fa-solid ${theme.icon} text-xs text-slate-500" aria-hidden="true"></i>
                                <span class="text-xs font-black text-slate-900 group-hover:text-emerald-700 transition-colors">${task.title}</span>
                            </div>
                            <span class="text-[11px] font-black px-2 py-0.5 rounded-full ${theme.badgeClass}">
                                ${task.startDate} → ${task.endDate} (${daysCount}d)
                            </span>
                        </div>

                        <div class="flex items-center justify-between text-[11px] font-extrabold text-slate-600">
                            <span class="text-slate-800"><i class="fa-solid fa-users-gear text-slate-400 mr-1 text-[11px]"></i>${task.crew}</span>
                            <span class="text-emerald-700 font-black"><i class="fa-solid fa-check-circle text-emerald-600 mr-1 text-[11px]"></i>Confirmed</span>
                        </div>

                        <p class="text-[11px] font-semibold text-slate-600 line-clamp-1 leading-snug">
                            ${task.notes}
                        </p>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 6. Navigation Helpers: Next Week, Previous Week, Jump Week
function navigateWhiteboardWeek(direction) {
    triggerHaptic('light');
    const newIndex = currentWhiteboardWeekIndex + direction;
    if (newIndex >= 0 && newIndex < WHITEBOARD_WEEKS_LIST.length) {
        currentWhiteboardWeekIndex = newIndex;
        renderWhiteboardRoster();
    }
}

function selectWhiteboardWeek(idx) {
    triggerHaptic('light');
    if (idx >= 0 && idx < WHITEBOARD_WEEKS_LIST.length) {
        currentWhiteboardWeekIndex = idx;
        renderWhiteboardRoster();
    }
}

function jumpWhiteboardToday() {
    triggerHaptic('medium');
    currentWhiteboardWeekIndex = 1; // Week 2 contains Today (Oct 6)
    renderWhiteboardRoster();
    setTimeout(() => {
        scrollToDayCard('2026-10-06');
    }, 100);
}

function scrollToDayCard(dateStr) {
    triggerHaptic('light');
    const el = document.getElementById('wb-day-card-' + dateStr);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-brand-lime');
        setTimeout(() => {
            el.classList.remove('ring-2', 'ring-brand-lime');
        }, 1200);
    }
}

// 7. Trade Filter
function filterTradeWhiteboard(cat, btn) {
    triggerHaptic('light');
    activeWhiteboardTradeFilter = cat;

    // Update active button classes
    document.querySelectorAll('.wb-trade-filter-btn').forEach(b => {
        b.className = 'wb-trade-filter-btn px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-xl border border-white/90 text-slate-700 text-xs font-extrabold shadow-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all hover:bg-white active:scale-95';
    });

    if (btn) {
        btn.className = 'wb-trade-filter-btn px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all active:scale-95';
    }

    renderWeeklyTimelineBars();
    renderDailyRosterCards();
}

function updateTradeFilterCounts() {
    const countEl = document.getElementById('wb-count-all');
    if (countEl) countEl.textContent = whiteboardTradeTasks.length;
}

// 8. Open Trade Details Modal
function openTradeDetailModal(taskId) {
    triggerHaptic('medium');
    const task = whiteboardTradeTasks.find(t => t.id === taskId);
    if (!task) return;

    const theme = WHITEBOARD_TRADE_THEMES[task.trade] || WHITEBOARD_TRADE_THEMES.steel;
    const sDate = new Date(task.startDate);
    const eDate = new Date(task.endDate);
    const daysCount = Math.max(1, Math.round((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1);

    openModal(task.title, `
        <div class="space-y-4 py-1 text-xs text-slate-800">
            <!-- Header Hero -->
            <div class="p-4 rounded-2xl ${theme.barBg} space-y-2 shadow-md">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-black uppercase tracking-wider bg-black/30 px-2.5 py-0.5 rounded-full text-white">
                        <i class="fa-solid ${theme.icon}" aria-hidden="true"></i> ${theme.name}
                    </span>
                    <span class="text-xs font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full text-white">
                        ${task.startDate} → ${task.endDate} (${daysCount} Days)
                    </span>
                </div>
                <h4 class="text-lg font-black tracking-tight text-white">${task.title}</h4>
            </div>

            <!-- Details -->
            <div class="space-y-3 bg-slate-100 p-4 rounded-2xl border border-slate-200">
                <div>
                    <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Assigned Subcontractor</span>
                    <p class="font-extrabold text-slate-900">${task.crew}</p>
                </div>
                <div>
                    <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Site Notes & Scope of Work</span>
                    <p class="text-slate-700 leading-relaxed font-semibold">${task.notes}</p>
                </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
                <button onclick="closeModal(); openSharedMaterialsModal();" class="btn-primary flex-1 py-3 bg-slate-900 text-brand-lime rounded-xl hover:bg-black transition-all cursor-pointer">
                    Site Materials
                </button>
                <button onclick="deleteTradeTask('${task.id}')" class="px-4 py-3 bg-red-100 text-red-600 rounded-xl font-bold text-xs hover:bg-red-200 transition-all cursor-pointer">
                    Delete Trade
                </button>
            </div>
        </div>
    `);
}

// 9. Open Schedule Trade Modal (Day-to-Day duration)
function openNewWhiteboardTradeModal(defaultStart) {
    triggerHaptic('light');
    const startVal = defaultStart || '2026-10-06';

    openModal("Add Trade to Schedule", `
        <div class="space-y-3 py-1 text-xs text-slate-800">
            <div>
                <label class="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Trade Task Name</label>
                <input id="wb-trade-title" type="text" placeholder="e.g. Formwork Stripping & Soffits" class="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-brand-lime">
            </div>

            <div>
                <label class="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Trade Category</label>
                <select id="wb-trade-cat" class="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none">
                    <option value="formwork">Formwork & Stripping</option>
                    <option value="plumbing">Plumbing Rough-In</option>
                    <option value="electrical">Electricians Rough-In</option>
                    <option value="steel">Steel Mesh & Concrete Pour</option>
                    <option value="masonry">Masonry & Bricklaying</option>
                    <option value="carpentry">Carpentry & Framing</option>
                    <option value="scaffold">Scaffolding & Rigging</option>
                    <option value="windows">Windows & Glazing</option>
                    <option value="finishes">Internal Linings & Drywall</option>
                </select>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Start Day</label>
                    <input id="wb-trade-start" type="date" value="${startVal}" class="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none">
                </div>
                <div>
                    <label class="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">End Day</label>
                    <input id="wb-trade-end" type="date" value="${startVal}" class="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none">
                </div>
            </div>

            <div>
                <label class="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Assigned Subcontractor / Crew</label>
                <input id="wb-trade-crew" type="text" placeholder="e.g. Apex Formwork (5 Subbies)" class="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none">
            </div>

            <div>
                <label class="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Site Scope & Instructions</label>
                <textarea id="wb-trade-notes" rows="2" placeholder="Work zone, plant delivery, safety sign-off..." class="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:outline-none"></textarea>
            </div>

            <button onclick="saveNewWhiteboardTrade()" class="btn-primary w-full py-3.5 bg-slate-900 text-brand-lime rounded-2xl hover:bg-black transition-all shadow-apple cursor-pointer">
                Publish Trade to Schedule
            </button>
        </div>
    `);
}

// 10. Save New Trade Task
function saveNewWhiteboardTrade() {
    const title = document.getElementById('wb-trade-title')?.value.trim();
    if (!title) {
        showToast("Missing Title", "Please enter a trade task name");
        return;
    }

    const trade = document.getElementById('wb-trade-cat')?.value || 'formwork';
    const startDate = document.getElementById('wb-trade-start')?.value || '2026-10-06';
    const endDate = document.getElementById('wb-trade-end')?.value || startDate;
    const crew = document.getElementById('wb-trade-crew')?.value.trim() || 'Site Subcontractor';
    const notes = document.getElementById('wb-trade-notes')?.value.trim() || 'Scheduled trade activity.';

    const newTask = {
        id: 'trade-' + Date.now(),
        title,
        trade,
        crew,
        startDate,
        endDate,
        notes
    };

    whiteboardTradeTasks.unshift(newTask);
    closeModal();
    renderWhiteboardRoster();
    triggerHaptic('medium');
    showToast("Trade Scheduled", `"${title}" published to schedule`);
}

// 11. Delete Trade Task
function deleteTradeTask(taskId) {
    triggerHaptic('light');
    whiteboardTradeTasks = whiteboardTradeTasks.filter(t => t.id !== taskId);
    closeModal();
    renderWhiteboardRoster();
    showToast("Task Removed", "Trade task removed from schedule");
}

// 12. Setup Touch Swipe on Schedule Container
function setupWhiteboardTouchSwipe() {
    const scheduleView = document.getElementById('view-schedule');
    if (!scheduleView || (scheduleView.dataset && scheduleView.dataset.swipeSetup === 'true')) return;
    if (scheduleView.dataset) scheduleView.dataset.swipeSetup = 'true';

    let touchStartX = 0;
    let touchStartY = 0;

    scheduleView.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    scheduleView.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Horizontal swipe detected (diffX > 60px and more horizontal than vertical)
        if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            if (diffX < 0) {
                // Swiped Left -> Next Week
                navigateWhiteboardWeek(1);
            } else {
                // Swiped Right -> Previous Week
                navigateWhiteboardWeek(-1);
            }
        }
    }, { passive: true });
}

// Auto-initialize Whiteboard Roster on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhiteboardRoster);
} else {
    setTimeout(initWhiteboardRoster, 50);
}

// Open Centralised Shared Material List & Setup Checklist
function openSharedMaterialsModal() {
    openModal("Shared Site Materials & Setup", `
        <div class="space-y-4 py-1 text-xs">
            <!-- Segmented Control Bar -->
            <div class="flex bg-slate-200/80 p-1 rounded-2xl font-bold text-slate-600">
                <button class="flex-1 py-2 bg-white text-slate-900 rounded-xl shadow-sm text-center">Bunnings & Suppliers</button>
                <button onclick="showToast('Checklist', 'Switched to Site Setup Checklist')" class="flex-1 py-2 text-center hover:text-slate-900">Setup Checklist</button>
            </div>

            <div class="space-y-2.5 max-h-[260px] overflow-y-auto no-scrollbar pr-1">
                <!-- Item 1 -->
                <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" checked class="w-4 h-4 rounded text-brand-lime focus:ring-brand-lime cursor-pointer">
                        <div>
                            <h5 class="font-black text-slate-900">Formwork Release Oil (20L)</h5>
                            <p class="text-xs text-slate-400">Bunnings Warehouse • Added by David H.</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black">Ordered</span>
                </div>

                <!-- Item 2 -->
                <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" class="w-4 h-4 rounded text-brand-lime focus:ring-brand-lime cursor-pointer">
                        <div>
                            <h5 class="font-black text-slate-900">PVC Conduit 25mm (Bundle)</h5>
                            <p class="text-xs text-slate-400">Reece Plumbing • Added by Alexander F.</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black">Needed</span>
                </div>

                <!-- Item 3 -->
                <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" class="w-4 h-4 rounded text-brand-lime focus:ring-brand-lime cursor-pointer">
                        <div>
                            <h5 class="font-black text-slate-900">Heavy Duty Tarps 10x8m</h5>
                            <p class="text-xs text-slate-400">Bunnings Warehouse • Added by James B.</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-black">Needed</span>
                </div>
            </div>

            <!-- Add New Item Input -->
            <div class="flex space-x-2 pt-2 border-t border-slate-100">
                <input type="text" id="new-material-input" placeholder="Add material or item needed..." class="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:border-brand-lime">
                <button onclick="showToast('Materials', 'New item added to centralized list'); closeModal();" class="bg-slate-900 text-brand-lime px-4 py-3 rounded-xl text-xs font-bold hover:bg-black">Add</button>
            </div>
        </div>
    `);
}

// The schedule's site picker: the active sites (SITES), today's rostered site selected. Keeps the current
// choice across a redraw while that site is still active.
function renderScheduleSiteSelect() {
    const select = document.getElementById('schedule-site-select');
    if (!select) return;
    const today = (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date();
    const current = select.value || getRosteredSiteId(today);
    const sites = getActiveSites();
    select.innerHTML = sites.map(s => `<option value="${s.id}">${s.shortName}</option>`).join('');
    select.value = sites.some(s => s.id === current) ? current : (sites[0] ? sites[0].id : '');
}
subscribeSites(renderScheduleSiteSelect);
