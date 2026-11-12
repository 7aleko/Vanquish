/**
 * Site screen - "Your Sites": switch between assigned sites (JOBS_DATA), week navigation, day selector,
 * and the selected site's card (client / project details, weather plan, crew on site).
 * The selected site and the Site screen's connected Procore project stay in sync (selectProject in sheets.js).
 */

var currentSitesDay = 'wed';
var currentSitesMonday = new Date(2026, 9, 12);
var currentSiteId = 'job-lugarno';   // the rostered site today

function getSelectedSite() {
    return JOBS_DATA.find(j => j.id === currentSiteId) || JOBS_DATA[0];
}

// Switch site from the segmented control. Also points the connected project at that site.
function selectSite(siteId, options = {}) {
    if (!JOBS_DATA.some(j => j.id === siteId)) return;
    if (!options.silent) triggerHaptic('light');
    currentSiteId = siteId;
    if (!options.fromProject) {
        const nameEl = document.getElementById('current-project-name');
        if (nameEl) nameEl.textContent = getSelectedSite().name;
        if (typeof renderHomeNavList === 'function') renderHomeNavList();
    }
    renderSiteSites();
}

// Procore project picked (sheets.js): select the matching assigned site, if there is one
function selectSiteForProject(projectName) {
    const match = JOBS_DATA.find(j => projectName.toLowerCase().includes(j.name.toLowerCase()));
    if (match) selectSite(match.id, { fromProject: true, silent: true });
}

function setSitesDay(dayKey) {
    triggerHaptic('light');
    currentSitesDay = dayKey;
    renderSiteSites();
}

function renderSiteSites() {
    const listContainer = document.getElementById('site-cards-list');
    const dayRibbonContainer = document.getElementById('sites-day-selector-container');
    const switcherContainer = document.getElementById('sites-switcher-container');
    if (!listContainer) return;

    const isAnchorWeek = (
        currentSitesMonday.getFullYear() === 2026 &&
        currentSitesMonday.getMonth() === 9 &&
        currentSitesMonday.getDate() === 12
    );
    const dayKeys = [
        { key: 'mon', label: 'MON' },
        { key: 'tue', label: 'TUE' },
        { key: 'wed', label: 'WED' },
        { key: 'thu', label: 'THU' },
        { key: 'fri', label: 'FRI' },
        { key: 'sat', label: 'SAT' }
    ];
    const daysList = dayKeys.map((d, idx) => {
        const dt = new Date(currentSitesMonday.getFullYear(), currentSitesMonday.getMonth(), currentSitesMonday.getDate() + idx);
        return {
            key: d.key,
            label: d.label,
            date: String(dt.getDate()).padStart(2, '0'),
            isToday: isAnchorWeek && d.key === 'wed'
        };
    });

    // 1. Render Master Day Selector Ribbon
    if (dayRibbonContainer) {
        dayRibbonContainer.innerHTML = `
                    <div class="grid grid-cols-6 gap-1 bg-white/80 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/90 shadow-apple">
                        ${daysList.map(d => {
                    const isSelected = currentSitesDay === d.key;
                    return `
                                <button onclick="setSitesDay('${d.key}')" class="py-2.5 min-h-[52px] rounded-xl text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected 
                            ? 'bg-slate-900 text-brand-lime shadow-md scale-[1.02]' 
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }">
                                    <span class="text-xs font-black uppercase tracking-wider ${isSelected ? 'text-brand-lime' : 'text-slate-500'}">
                                        ${d.label}
                                    </span>
                                    <span class="text-sm font-black mt-0.5 leading-none">
                                        ${d.date}
                                    </span>
                                    ${d.isToday ? `<span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-brand-lime' : 'bg-emerald-500'} mt-1"></span>` : '<span class="w-1.5 h-1.5 mt-1"></span>'}
                                </button>
                            `;
                }).join('')}
                    </div>
                `;
    }

    // 2. Crew deployed across all sites on the selected day (header)
    const totalCrew = JOBS_DATA.reduce((n, job) => n + ((job.days[currentSitesDay] || {}).crew || []).length, 0);
    const totalEl = document.getElementById('sites-crew-total');
    if (totalEl) totalEl.textContent = `${totalCrew} crew across ${JOBS_DATA.length} sites`;

    // 3. Assigned-site switcher (segmented control)
    if (switcherContainer) {
        switcherContainer.innerHTML = `
                    <div role="tablist" aria-label="Assigned sites" class="grid gap-1 bg-slate-200/70 p-1 rounded-2xl" style="grid-template-columns: repeat(${JOBS_DATA.length}, minmax(0, 1fr));">
                        ${JOBS_DATA.map(job => {
                    const isSelected = job.id === currentSiteId;
                    return `
                                <button type="button" role="tab" aria-selected="${isSelected}" onclick="selectSite('${job.id}')"
                                    class="min-h-[40px] px-2 rounded-xl text-sm font-extrabold tracking-tight truncate transition-all cursor-pointer active:scale-[0.97] ${
                            isSelected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }">${job.name}</button>
                            `;
                }).join('')}
                    </div>
                `;
    }

    // 4. Selected site card (client, project type, weather plan, crew on site)
    listContainer.innerHTML = [getSelectedSite()].map(job => {
        const dayData = job.days[currentSitesDay];
        const isNewBuild = job.projectType === 'NEW BUILD';

        return `
                    <div class="bg-white/85 backdrop-blur-3xl rounded-card p-5 shadow-apple border border-white/90 hover:border-slate-300 transition-all space-y-4 group">
                        
                        <!-- 1. SITE HEADER & PROJECT TYPE -->
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-start space-x-3 min-w-0 flex-1">
                                <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-[#AEB6C2] flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform">
                                    <i class="fa-solid fa-helmet-safety text-base"></i>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h3 class="text-xl font-black text-slate-900 tracking-tight leading-snug truncate">${job.name}</h3>
                                        <span class="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    isNewBuild 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/80 shadow-xs' 
                                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200/80 shadow-xs'
                                }">
                                            ${job.projectType}
                                        </span>
                                    </div>
                                    <p class="text-sm text-slate-600 font-semibold mt-0.5 truncate flex items-center gap-1.5">
                                        <i class="fa-solid fa-location-dot text-slate-400 text-xs shrink-0"></i>
                                        <span class="truncate">${job.address}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- 2. CLIENT & PROJECT METADATA: two equal columns, values wrap instead of truncating -->
                        <div class="bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200/60 grid grid-cols-2 gap-3">
                            <div class="min-w-0">
                                <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Client</span>
                                <p class="mt-1 text-sm leading-snug font-black text-slate-900 line-clamp-2">${job.client}</p>
                            </div>
                            <div class="min-w-0">
                                <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Working Hours</span>
                                <p class="mt-1 text-sm leading-snug font-bold text-slate-800 tabular">7:00 AM – 3:30 PM</p>
                            </div>
                        </div>

                        <!-- 3. WEATHER & RAIN SENSITIVITY STATUS: status first, forecast chip underneath -->
                        <div class="p-3.5 rounded-2xl flex items-start gap-3 border ${
                    dayData.isRainSafe 
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }">
                            <div class="w-8 h-8 rounded-xl ${dayData.isRainSafe ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'} flex items-center justify-center text-xs shrink-0 shadow-xs">
                                <i class="fa-solid ${dayData.isRainSafe ? 'fa-shield-halved' : 'fa-umbrella'}" aria-hidden="true"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <span class="text-sm font-black block leading-tight">
                                    ${dayData.isRainSafe ? 'Indoor / Rain Protected' : 'Rain Sensitive Exterior'}
                                </span>
                                <span class="text-xs font-semibold opacity-90 block mt-0.5">
                                    ${dayData.isRainSafe ? 'Work continues in wet weather' : 'Wet weather plan needed'}
                                </span>
                                <span class="mt-2 px-2.5 py-1 rounded-lg font-black text-xs inline-block whitespace-nowrap tabular ${
                            dayData.isRainSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }">
                                    ${dayData.temp} • ${dayData.rain}
                                </span>
                            </div>
                        </div>

                        <!-- 4. CREW ON SITE (WHO IS ON WHICH SITE) -->
                        <div class="space-y-2 pt-1">
                            <div class="flex items-center justify-between px-0.5">
                                <span class="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <i class="fa-solid fa-users text-slate-400"></i>
                                    Crew on Site (${dayData.crew.length})
                                </span>
                                <span class="text-xs font-semibold text-slate-400">Tap name to contact</span>
                            </div>

                            <div class="flex flex-wrap gap-2">
                                ${dayData.crew.map(member => {
                            const initials = member.split(' ').map(n => n[0]).join('').slice(0, 2);
                            return `
                                        <div onclick="openDirectMessage('${member}')" class="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 shadow-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 group/crew min-h-[38px]">
                                            <div class="w-7 h-7 rounded-full bg-slate-900 text-brand-lime font-black text-xs flex items-center justify-center shrink-0 shadow-xs group-hover/crew:scale-105 transition-transform">
                                                ${initials}
                                            </div>
                                            <span class="text-sm font-bold text-slate-900">${member}</span>
                                        </div>
                                    `;
                        }).join('')}
                            </div>
                        </div>

                        <!-- 5. CARD ACTION FOOTER -->
                        <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <button onclick="showToast('Procore Hub', 'Viewing ${job.name} project logs');" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 min-h-[44px]">
                                <i class="fa-solid fa-book-open text-xs text-slate-600"></i> Site Logs
                            </button>
                            <button onclick="showToast('Directions', 'Opening directions to ${job.name}')" class="px-4 py-2.5 bg-slate-900 text-brand-lime font-black text-sm rounded-xl hover:bg-black transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 min-h-[44px]">
                                <i class="fa-solid fa-location-arrow text-brand-lime text-xs"></i> Directions
                            </button>
                        </div>
                    </div>
                `;
    }).join('');
}

function applySitesWeek(mondayDate, pickedDate = null) {
    currentSitesMonday = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate());
    const saturdayDate = new Date(currentSitesMonday.getFullYear(), currentSitesMonday.getMonth(), currentSitesMonday.getDate() + 5);

    const monStr = `Mon ${String(currentSitesMonday.getDate()).padStart(2, '0')} ${ROSTER_SHORT_MONTHS[currentSitesMonday.getMonth()]}`;
    const satStr = `Sat ${String(saturdayDate.getDate()).padStart(2, '0')} ${ROSTER_SHORT_MONTHS[saturdayDate.getMonth()]}, ${saturdayDate.getFullYear()}`;
    const weekLabel = document.getElementById('sites-week-label');
    if (weekLabel) {
        weekLabel.textContent = `${monStr} – ${satStr}`;
    }

    const nativeInput = document.getElementById('sites-native-date-input');
    if (nativeInput) {
        nativeInput.value = formatIsoDateLocal(pickedDate || currentSitesMonday);
    }

    if (pickedDate) {
        const dow = pickedDate.getDay(); // 1..6 = Mon..Sat
        const map = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        if (dow >= 1 && dow <= 6) {
            currentSitesDay = map[dow - 1];
        }
    }

    renderSiteSites();
}

function shiftSitesWeek(direction) {
    triggerHaptic('light');
    const nextMonday = new Date(
        currentSitesMonday.getFullYear(),
        currentSitesMonday.getMonth(),
        currentSitesMonday.getDate() + direction * 7
    );
    applySitesWeek(nextMonday);
}

function handleSitesDatePick(isoValue) {
    if (!isoValue) return;
    const parts = isoValue.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return;
    triggerHaptic('light');
    const picked = new Date(parts[0], parts[1] - 1, parts[2]);
    applySitesWeek(getMondayForDate(picked), picked);
}
