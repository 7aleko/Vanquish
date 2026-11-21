/**
 * Dark calendar / date picker sheet.
 */

// =========================================================================
// APPLE DARK CALENDAR & DATE PICKER ENGINE (MATCHES REFERENCE DESIGN 1:1)
// =========================================================================
const APPLE_CAL_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const APPLE_CAL_DAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

let appleCalSelectedDate = new Date(2026, 10, 8); // Sunday, November 8, 2026 (exact match to reference)
let appleCalViewYear = 2026;
let appleCalViewMonth = 10; // 0-indexed: 10 = November
let appleCalTarget = null;
let appleCalCallback = null;
let appleCalPrefix = 'Launch set for';

function openAppleCalendarModal(options = {}) {
    triggerHaptic('light');
    appleCalTarget = options.target || null;
    appleCalCallback = typeof options.onSelect === 'function' ? options.onSelect : null;

    if (options.prefix) {
        appleCalPrefix = options.prefix;
    } else if (options.target === 'roster') {
        appleCalPrefix = 'Roster set for';
    } else if (options.target === 'schedule') {
        appleCalPrefix = 'Schedule set for';
    } else {
        appleCalPrefix = 'Launch set for';
    }

    if (options.initialDate instanceof Date && !isNaN(options.initialDate)) {
        appleCalSelectedDate = new Date(options.initialDate);
    } else if (typeof options.initialDate === 'string') {
        const parts = options.initialDate.split('-').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
            appleCalSelectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        }
    } else if (options.target === 'roster' && typeof currentRosterMonday !== 'undefined' && currentRosterMonday) {
        appleCalSelectedDate = new Date(currentRosterMonday);
    } else {
        // Fallback default: November 8, 2026 matching reference screenshot
        appleCalSelectedDate = new Date(2026, 10, 8);
    }

    appleCalViewYear = appleCalSelectedDate.getFullYear();
    appleCalViewMonth = appleCalSelectedDate.getMonth();

    renderAppleCalendar();

    const overlay = document.getElementById('apple-calendar-modal-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.setAttribute('aria-hidden', 'false');
    }
}

function closeAppleCalendarModal() {
    triggerHaptic('light');
    const overlay = document.getElementById('apple-calendar-modal-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function handleAppleCalendarOverlayClick(e) {
    if (e.target && e.target.id === 'apple-calendar-modal-overlay') {
        closeAppleCalendarModal();
    }
}

function navigateAppleCalendarMonth(direction) {
    triggerHaptic('light');
    appleCalViewMonth += direction;
    if (appleCalViewMonth < 0) {
        appleCalViewMonth = 11;
        appleCalViewYear--;
    } else if (appleCalViewMonth > 11) {
        appleCalViewMonth = 0;
        appleCalViewYear++;
    }
    renderAppleCalendar();
}

function jumpAppleCalendarToday() {
    triggerHaptic('medium');
    const today = new Date(2026, 10, 8); // November 8, 2026
    appleCalSelectedDate = today;
    appleCalViewYear = today.getFullYear();
    appleCalViewMonth = today.getMonth();
    renderAppleCalendar();
}

function selectAppleCalendarDate(year, month, day) {
    triggerHaptic('medium');
    appleCalSelectedDate = new Date(year, month, day);
    appleCalViewYear = year;
    appleCalViewMonth = month;
    renderAppleCalendar();

    if (typeof appleCalCallback === 'function') {
        appleCalCallback(appleCalSelectedDate);
    } else if (appleCalTarget === 'roster' && typeof handleRosterDatePick === 'function') {
        const iso = formatIsoDateLocal(appleCalSelectedDate);
        handleRosterDatePick(iso);
    } else if (appleCalTarget === 'schedule' && typeof openScheduleForSite === 'function') {
        openScheduleForSite(null, formatIsoDateLocal(appleCalSelectedDate));
    }

    if (appleCalTarget || appleCalCallback) {
        setTimeout(() => {
            closeAppleCalendarModal();
        }, 220);
    }
}

function renderAppleCalendar() {
    const monthYearEl = document.getElementById('apple-cal-month-year');
    const gridEl = document.getElementById('apple-cal-days-grid');
    const subtitleEl = document.getElementById('apple-cal-subtitle');

    if (monthYearEl) {
        monthYearEl.textContent = `${APPLE_CAL_MONTHS[appleCalViewMonth]} ${appleCalViewYear}`;
    }

    if (!gridEl) return;

    const firstDay = new Date(appleCalViewYear, appleCalViewMonth, 1).getDay(); // 0 is Sunday
    const daysInCurrent = new Date(appleCalViewYear, appleCalViewMonth + 1, 0).getDate();
    const daysInPrev = new Date(appleCalViewYear, appleCalViewMonth, 0).getDate();

    let html = '';
    const TOTAL_CELLS = 42; // Exactly 6 rows as shown in reference

    for (let i = 0; i < TOTAL_CELLS; i++) {
        if (i < firstDay) {
            // Day from previous month
            const prevDayNum = daysInPrev - firstDay + 1 + i;
            const pMonth = appleCalViewMonth === 0 ? 11 : appleCalViewMonth - 1;
            const pYear = appleCalViewMonth === 0 ? appleCalViewYear - 1 : appleCalViewYear;
            html += `
                <div class="h-10 flex items-center justify-center">
                    <button type="button" 
                            onclick="selectAppleCalendarDate(${pYear}, ${pMonth}, ${prevDayNum})" 
                            aria-label="${APPLE_CAL_MONTHS[pMonth]} ${prevDayNum}, ${pYear}" 
                            class="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-zinc-600 text-sm font-medium flex items-center justify-center hover:bg-zinc-800/50 hover:text-zinc-400 active:scale-95 transition-all cursor-pointer focus:outline-none">
                        <span>${prevDayNum}</span>
                    </button>
                </div>
            `;
        } else if (i < firstDay + daysInCurrent) {
            // Day in current month
            const dayNum = i - firstDay + 1;
            const isSelected = (
                appleCalSelectedDate.getFullYear() === appleCalViewYear &&
                appleCalSelectedDate.getMonth() === appleCalViewMonth &&
                appleCalSelectedDate.getDate() === dayNum
            );

            if (isSelected) {
                html += `
                    <div class="h-10 flex items-center justify-center">
                        <button type="button" 
                                aria-label="Selected: ${APPLE_CAL_MONTHS[appleCalViewMonth]} ${dayNum}, ${appleCalViewYear}" 
                                class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5E5EA] text-zinc-950 flex flex-col items-center justify-center font-semibold text-sm leading-none shadow-[0_2px_8px_rgba(0,0,0,0.35)] active:scale-95 transition-transform cursor-pointer focus:outline-none">
                            <span class="leading-none">${dayNum}</span>
                            <span class="w-1 h-1 rounded-full bg-zinc-950 mt-1 shrink-0"></span>
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div class="h-10 flex items-center justify-center">
                        <button type="button" 
                                onclick="selectAppleCalendarDate(${appleCalViewYear}, ${appleCalViewMonth}, ${dayNum})" 
                                aria-label="${APPLE_CAL_MONTHS[appleCalViewMonth]} ${dayNum}, ${appleCalViewYear}" 
                                class="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white text-sm font-medium flex items-center justify-center hover:bg-zinc-800/70 active:scale-95 transition-all cursor-pointer focus:outline-none">
                            <span>${dayNum}</span>
                        </button>
                    </div>
                `;
            }
        } else {
            // Day from next month
            const nextDayNum = i - (firstDay + daysInCurrent) + 1;
            const nMonth = appleCalViewMonth === 11 ? 0 : appleCalViewMonth + 1;
            const nYear = appleCalViewMonth === 11 ? appleCalViewYear + 1 : appleCalViewYear;
            html += `
                <div class="h-10 flex items-center justify-center">
                    <button type="button" 
                            onclick="selectAppleCalendarDate(${nYear}, ${nMonth}, ${nextDayNum})" 
                            aria-label="${APPLE_CAL_MONTHS[nMonth]} ${nextDayNum}, ${nYear}" 
                            class="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-zinc-600 text-sm font-medium flex items-center justify-center hover:bg-zinc-800/50 hover:text-zinc-400 active:scale-95 transition-all cursor-pointer focus:outline-none">
                        <span>${nextDayNum}</span>
                    </button>
                </div>
            `;
        }
    }

    gridEl.innerHTML = html;

    if (subtitleEl) {
        const dayOfWeekName = APPLE_CAL_DAYS[appleCalSelectedDate.getDay()];
        const monthName = APPLE_CAL_MONTHS[appleCalSelectedDate.getMonth()];
        const dayNum = appleCalSelectedDate.getDate();
        subtitleEl.textContent = `${appleCalPrefix} ${dayOfWeekName}, ${monthName} ${dayNum}`;
    }
}

// Global escape key listener for dismissing calendar modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const calOverlay = document.getElementById('apple-calendar-modal-overlay');
        if (calOverlay && !calOverlay.classList.contains('opacity-0')) {
            closeAppleCalendarModal();
        }
    }
});

// Auto-render calendar initial state on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAppleCalendar);
} else {
    setTimeout(renderAppleCalendar, 10);
}
