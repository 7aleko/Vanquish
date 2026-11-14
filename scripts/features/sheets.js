/**
 * Content sheets opened through the shared modal: profile, Procore project selector,
 * camera capture, workwear, widget details, leave, timesheets, generic app sheet.
 */

function openProfileModal() {
    triggerHaptic('light');
    const p = ACCOUNT_DATA.profile;
    const esc = escapeAccountHtml;
    openModal("Employee Profile", `
                <div class="space-y-4 py-1 text-slate-800">
                    <div class="flex items-center gap-4 pb-4 border-b border-slate-100">
                        <div class="relative shrink-0">
                            <span data-account-avatar="page" class="account-identity-avatar" aria-hidden="true">${accountRoleAvatar('page')}</span>
                            <span class="account-presence-dot" title="Active on Duty" aria-hidden="true"></span>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h4 class="font-black text-slate-900 text-lg tracking-tight truncate">${esc(p.name)}</h4>
                                <span class="shrink-0 px-2 py-0.5 rounded-full bg-slate-900 text-brand-lime text-[11px] font-black uppercase tracking-wider">Staff</span>
                            </div>
                            <p class="text-xs text-slate-500 font-semibold truncate mt-0.5">${esc(p.role)} • ${esc(getSiteName(p.siteId))}</p>
                            <span class="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span> Active on Duty
                            </span>
                        </div>
                    </div>

                    <!-- Profile photo -->
                    <div class="flex gap-2">
                        <button type="button" onclick="pickProfilePhoto()" class="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime">
                            <i class="fa-solid fa-camera text-xs" aria-hidden="true"></i> ${p.photo ? 'Change Photo' : 'Add Photo'}
                        </button>
                        <button type="button" id="profile-photo-remove" ${p.photo ? '' : 'hidden'} onclick="setProfilePhoto(null)" class="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-rose-50 text-rose-600 font-bold text-xs transition-all cursor-pointer active:scale-[0.98]">Remove</button>
                    </div>

                    <div class="bg-slate-50/90 rounded-2xl p-4 space-y-3 text-xs border border-slate-100">
                        <div class="flex justify-between items-center text-slate-500">
                            <span class="font-medium">Department</span>
                            <span class="font-bold text-slate-900">${esc(p.department)}</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-500">
                            <span class="font-medium">Employee ID</span>
                            <span class="font-bold text-slate-900 font-mono">${esc(p.employeeId)}</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-500">
                            <span class="font-medium">Primary Project</span>
                            <span class="font-bold text-slate-900">${esc((PROCORE_PROJECTS.find(pr => pr.id === p.primaryProjectId) || { name: '' }).name)}</span>
                        </div>
                        <div class="flex justify-between items-center text-slate-500">
                            <span class="font-medium">Contact Email</span>
                            <span class="font-bold text-slate-900">${esc(p.email)}</span>
                        </div>
                    </div>

                    <div class="pt-2 flex gap-2.5">
                        <button type="button" onclick="triggerHaptic('medium'); closeModal(); showToast('Preferences', 'Profile preferences updated');" class="btn-primary flex-1 py-3.5 bg-slate-900 hover:bg-black text-brand-lime rounded-2xl transition-all cursor-pointer shadow-apple active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime">
                            Edit Preferences
                        </button>
                        <button type="button" onclick="triggerHaptic('light'); closeModal();" class="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                            Done
                        </button>
                    </div>
                </div>
            `);
}

        function openProjectSelectorModal() {
            openModal("Select project", `
                <div class="space-y-4 py-1">
                    <style>
        * {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }
        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }

                        #modal-title {
                            font-size: 1.25rem;
                            font-weight: 900;
                            letter-spacing: -0.03em;
                            color: var(--ink-primary);
                        }
                    </style>
                    <div class="search-field search-field--sheet">
                        <i class="ph-bold ph-magnifying-glass search-field-icon" aria-hidden="true"></i>
                        <input type="search" id="procore-search-input" oninput="filterProcoreProjects()" placeholder="Search project name, suburb or ID..." aria-label="Search Procore projects" autocomplete="off" enterkeyhint="search" class="search-field-input">
                        <button type="button" onclick="clearProcoreSearch()" id="procore-clear-btn" aria-label="Clear search" class="search-field-clear hidden">
                            <i class="ph-fill ph-x-circle" aria-hidden="true"></i>
                        </button>
                    </div>
                    <div class="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
                        <span>Last updated: Just now</span>
                        <span id="project-count-badge" class="font-bold text-slate-700">${PROCORE_PROJECTS.length} projects</span>
                    </div>
                    <div id="procore-project-list" class="space-y-2.5 max-h-[360px] overflow-y-auto no-scrollbar pr-0.5 pt-1">
                        ${renderProjectListItems(PROCORE_PROJECTS)}
                    </div>
                </div>
            `);
        }

        function renderProjectListItems(projects) {
            if (projects.length === 0) {
                return `
                    <div class="text-center py-10 space-y-2">
                        <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                            <i class="fa-solid fa-magnifying-glass text-base"></i>
                        </div>
                        <p class="text-sm font-extrabold text-slate-800">No projects found</p>
                        <p class="text-xs text-slate-400">Try searching for another street or suburb</p>
                    </div>
                `;
            }

            return projects.map(p => {
                const isSelected = p.id === currentProcoreProjectId;
                return `
                    <div onclick="selectProject('${p.id}')" class="p-4 rounded-2xl ${isSelected ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-emerald-50/90 border-2 border-emerald-500/80 shadow-sm' : 'bg-slate-50/90 hover:bg-slate-100/90 border border-slate-200/80'} cursor-pointer transition-all flex items-center justify-between gap-3 group active:scale-[0.99]">
                        <div class="space-y-1 min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <h4 class="text-sm font-black text-slate-900 tracking-tight leading-snug group-hover:text-emerald-700 transition-colors">
                                    ${p.name}
                                </h4>
                                <span class="text-xs font-black text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md shrink-0">${p.id}</span>
                            </div>
                            <p class="text-xs font-medium text-slate-600 truncate leading-relaxed">${p.address}</p>
                        </div>
                        <div class="shrink-0 pl-1">
                            ${isSelected ? 
                                `<span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shadow-sm shadow-emerald-500/40"><i class="fa-solid fa-check"></i></span>` : 
                                `<i class="fa-solid fa-chevron-right text-xs text-slate-300 group-hover:text-slate-500"></i>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }

        function filterProcoreProjects() {
            const input = document.getElementById('procore-search-input');
            const clearBtn = document.getElementById('procore-clear-btn');
            const listContainer = document.getElementById('procore-project-list');
            const countBadge = document.getElementById('project-count-badge');

            if (!input || !listContainer) return;

            const query = input.value.toLowerCase().trim();
            if (clearBtn) clearBtn.classList.toggle('hidden', query === '');

            const filtered = PROCORE_PROJECTS.filter(p => 
                p.name.toLowerCase().includes(query) ||
                p.address.toLowerCase().includes(query) ||
                p.id.toLowerCase().includes(query)
            );

            listContainer.innerHTML = renderProjectListItems(filtered);
            if (countBadge) countBadge.textContent = `${filtered.length} projects`;
        }

        function clearProcoreSearch() {
            const input = document.getElementById('procore-search-input');
            if (input) {
                input.value = '';
                filterProcoreProjects();
                input.focus();
            }
        }

        // The connected Procore project (Site screen card). Tracked by project id; a project linked to a site
        // (PROCORE_PROJECTS[].siteId) shows that site's name and selects it in Your Sites.
        var currentProcoreProjectId = 'P-415';

        function getConnectedProjectLabel(project) {
            if (!project) return '';
            return project.siteId ? getSiteName(project.siteId, project.name.split(',')[0]) : project.name.split(',')[0];
        }

        function renderConnectedProject() {
            const nameEl = document.getElementById('current-project-name');
            const project = PROCORE_PROJECTS.find(p => p.id === currentProcoreProjectId);
            if (nameEl && project) nameEl.textContent = getConnectedProjectLabel(project);
        }

        // A site picked in Your Sites connects its Procore project, when it has one
        function connectProjectForSite(siteId) {
            const project = PROCORE_PROJECTS.find(p => p.siteId === siteId);
            if (project) currentProcoreProjectId = project.id;
            renderConnectedProject();
        }

        function selectProject(projectId) {
            const project = PROCORE_PROJECTS.find(p => p.id === projectId);
            if (!project) return;
            currentProcoreProjectId = project.id;
            renderConnectedProject();
            if (project.siteId && typeof selectSite === 'function') selectSite(project.siteId, { fromProject: true, silent: true });
            if (typeof renderHomeNavList === 'function') renderHomeNavList();
            closeModal();
            showToast('Procore', `Switched project to ${getConnectedProjectLabel(project)}`);
        }

        function openCameraCaptureModal() {
            openModal("Procore Quick Camera", `
                <div class="text-center py-4 space-y-4">
                    <div class="w-full h-48 rounded-2xl bg-slate-900 flex flex-col items-center justify-center text-slate-400 border border-slate-800 relative overflow-hidden">
                        <i class="fa-solid fa-camera text-3xl mb-2 text-white"></i>
                        <span class="text-xs text-slate-300">Camera Viewfinder Active</span>
                        <div class="absolute bottom-2 left-2 right-2 flex justify-between text-xs text-slate-400 px-2">
                            <span>Auto-Tag: Progress</span>
                            <span>GPS: ${getSiteName(getRosteredSiteId(typeof APP_TODAY !== 'undefined' ? APP_TODAY : new Date()), 'No site')}</span>
                        </div>
                    </div>
                    <button onclick="closeModal(); showToast('Procore', 'Photo captured & uploaded to Procore album');" class="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition-all cursor-pointer">Capture & Sync Photo</button>
                </div>
            `);
        }

        function openWorkWearModal() {
    openModal("Workwear Portal", `
        <div class="space-y-4 py-2 text-xs">
            <!-- Segmented Tabs Bar (Uniform Size & Weight) -->
            <div id="ww-segmented-container" class="relative flex bg-slate-200/80 backdrop-blur-xl p-1 rounded-2xl border border-slate-300/60">
                <!-- Fluid Sliding Background Pill -->
                <div id="ww-active-pill" class="absolute top-1 bottom-1 left-1 w-[calc(33.33%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>

                <button id="ww-tab-request" onclick="switchWorkwearTab('request')" class="relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-900 transition-colors cursor-pointer">Request Gear</button>
                <button id="ww-tab-pending" onclick="switchWorkwearTab('pending')" class="relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">Pending (${ACCOUNT_DATA.workwear.pending.length})</button>
                <button id="ww-tab-ready" onclick="switchWorkwearTab('ready')" class="relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">Ready (${ACCOUNT_DATA.workwear.ready.length})</button>
            </div>

            <!-- Request Gear Form Content -->
            <div id="ww-content-request" class="space-y-4 pt-1">
                <div>
                    <label class="block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Select Item</label>
                    <select id="ww-item-select" class="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-slate-900 focus:outline-none focus:border-brand-lime shadow-inner text-xs">
                        <option value="Short Sleeve Shirt">Short Sleeve Shirt</option>
                        <option value="Long Sleeve Shirt">Long Sleeve Shirt</option>
                        <option value="Jumper">Jumper</option>
                        <option value="Office Jacket">Office Jacket</option>
                        <option value="Sun Cap">Sun Cap</option>
                        <option value="Beanie">Beanie</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Select Size</label>
                    <div class="grid grid-cols-5 gap-2" id="ww-size-container">
                        <button type="button" onclick="selectWorkwearSize(this)" class="ww-size-btn py-3 rounded-2xl border border-slate-200 font-extrabold text-slate-700 hover:border-slate-900 transition-all cursor-pointer text-xs">S</button>
                        <button type="button" onclick="selectWorkwearSize(this)" class="ww-size-btn py-3 rounded-2xl border border-slate-900 bg-slate-900 text-white font-extrabold transition-all cursor-pointer shadow-sm text-xs">M</button>
                        <button type="button" onclick="selectWorkwearSize(this)" class="ww-size-btn py-3 rounded-2xl border border-slate-200 font-extrabold text-slate-700 hover:border-slate-900 transition-all cursor-pointer text-xs">L</button>
                        <button type="button" onclick="selectWorkwearSize(this)" class="ww-size-btn py-3 rounded-2xl border border-slate-200 font-extrabold text-slate-700 hover:border-slate-900 transition-all cursor-pointer text-xs">XL</button>
                        <button type="button" onclick="selectWorkwearSize(this)" class="ww-size-btn py-3 rounded-2xl border border-slate-200 font-extrabold text-slate-700 hover:border-slate-900 transition-all cursor-pointer text-xs">2XL</button>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">Optional Note</label>
                    <textarea id="ww-note" placeholder="Add any special instructions..." class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-lime h-24 resize-none shadow-inner text-xs"></textarea>
                </div>

                <!-- Enlarged Primary Action Button -->
                <button onclick="submitWorkwearRequest()" class="btn-primary w-full py-4 bg-slate-900 text-brand-lime rounded-2xl hover:bg-black transition-all cursor-pointer shadow-apple active:scale-[0.98]">
                    Submit Request
                </button>
            </div>

            <!-- Pending Tab Content -->
            <div id="ww-content-pending" class="hidden space-y-3">
                ${ACCOUNT_DATA.workwear.pending.length ? ACCOUNT_DATA.workwear.pending.map(w => `
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                    <div class="space-y-1">
                        <span class="text-xs font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Pending Approval</span>
                        <h5 class="font-black text-slate-900 text-sm mt-1">${escapeAccountHtml(w.item)} (Size ${escapeAccountHtml(w.size)})</h5>
                        <p class="text-[11px] text-slate-500 font-medium">${escapeAccountHtml(w.detail)}</p>
                    </div>
                    <span class="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-xl font-bold text-[11px]">Review</span>
                </div>`).join('') : '<p class="text-center text-slate-400 font-medium py-6">Nothing waiting on approval</p>'}
            </div>

            <!-- Ready Tab Content -->
            <div id="ww-content-ready" class="hidden space-y-3">
                ${ACCOUNT_DATA.workwear.ready.length ? ACCOUNT_DATA.workwear.ready.map((w, i) => `
                <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div class="space-y-1">
                        <span class="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Ready to Collect</span>
                        <h5 class="font-black text-slate-900 text-sm mt-1">${escapeAccountHtml(w.item)} (${escapeAccountHtml(w.size)})</h5>
                        <p class="text-[11px] text-slate-500 font-medium">${escapeAccountHtml(w.detail)}</p>
                    </div>
                    <button onclick="collectWorkwearItem(${i})" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-sm active:scale-95">Collect</button>
                </div>`).join('') : '<p class="text-center text-slate-400 font-medium py-6">Nothing ready to collect</p>'}
            </div>
        </div>
    `);
}

        function switchWorkwearTab(tab) {
            const tabs = ['request', 'pending', 'ready'];
            const activeIndex = tabs.indexOf(tab);

            // Move the sliding background pill smoothly using CSS translateX
            const pill = document.getElementById('ww-active-pill');
            if (pill) {
                pill.style.transform = `translateX(${activeIndex * 100}%)`;
            }

            // Toggle active content and text color states smoothly
            tabs.forEach((t, index) => {
                const content = document.getElementById(`ww-content-${t}`);
                const btn = document.getElementById(`ww-tab-${t}`);

                if (content) content.classList.toggle('hidden', t !== tab);
                if (btn) {
                    // Switch text weight and color based on active state
                    if (t === tab) {
                        btn.className = "relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-900 transition-colors cursor-pointer";
                    } else {
                        btn.className = "relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer";
                    }
                }
            });
        }

        function selectWorkwearSize(btn) {
            document.querySelectorAll('.ww-size-btn').forEach(b => {
                b.className = "ww-size-btn py-3 rounded-2xl border border-slate-200 font-extrabold text-slate-700 hover:border-slate-900 transition-all cursor-pointer text-xs";
            });
            btn.className = "ww-size-btn py-3 rounded-2xl border border-slate-900 bg-slate-900 text-white font-extrabold transition-all cursor-pointer shadow-sm text-xs";
        }

        function submitWorkwearRequest() {
            const item = document.getElementById('ww-item-select').value;
            const selectedSizeBtn = document.querySelector('.ww-size-btn.bg-slate-900');
            const size = selectedSizeBtn ? selectedSizeBtn.textContent : 'M';

            ACCOUNT_DATA.workwear.pending.push({ item, size, detail: 'Submitted today • Waiting on supervisor' });
            renderAccountStatus();
            showToast("Workwear", `Requested ${item} (${size}) successfully!`);
            closeModal();
        }

        function collectWorkwearItem(index) {
            ACCOUNT_DATA.workwear.ready.splice(index, 1);
            renderAccountStatus();
            showToast('Workwear', 'Collection marked complete');
            closeModal();
        }

        function openWidgetDetail(type, detail) {
            if (type === 'birthday') {
        // detail comes from the birthday banner ({ name, whenText, dateText }); defaults are the original demo values
        const bday = Object.assign({ name: 'Nathan Wild', whenText: 'Turns 32 in 6 days', dateText: 'October 20, 2026' }, detail || {});
        openModal("Upcoming Birthday", `
            <style>
        * {
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }
        body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
        }

                @keyframes gentleFloat {
                    0% { transform: translate3d(0px, -10px, 0) rotate(0deg); opacity: 0; }
                    20% { opacity: 0.9; }
                    80% { opacity: 0.9; }
                    100% { transform: translate3d(20px, 200px, 0) rotate(360deg); opacity: 0; }
                }
                .confetti-particle {
                    will-change: transform, opacity;
                    animation: gentleFloat 3s cubic-bezier(0.25, 1, 0.5, 1) infinite;
                }
            </style>

            <div class="relative text-center py-6 px-2 space-y-4 overflow-hidden rounded-3xl">
                <!-- GPU-Accelerated Lightweight Confetti Layer -->
                <div class="absolute inset-0 pointer-events-none overflow-hidden z-0">
                    <div class="absolute w-2 h-2 rounded-full bg-amber-400 top-2 left-6 confetti-particle" style="animation-delay: 0s;"></div>
                    <div class="absolute w-3 h-1.5 rounded-sm bg-orange-500 top-0 right-10 confetti-particle" style="animation-delay: 0.5s;"></div>
                    <div class="absolute w-2 h-2 rounded-full bg-orange-400 top-4 left-1/2 confetti-particle" style="animation-delay: 1.2s;"></div>
                    <div class="absolute w-2.5 h-2.5 rounded-sm bg-yellow-400 top-6 right-1/3 confetti-particle" style="animation-delay: 0.8s;"></div>
                </div>

                <!-- Modal Content Layer -->
                <div class="relative z-10">
                    <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/30 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner backdrop-blur-md">
                        <i class="fa-solid fa-cake-candles"></i>
                    </div>
                    <h4 class="font-black text-slate-900 text-xl tracking-tight">${bday.name}</h4>
                    <p class="text-xs text-slate-500 font-medium mt-1">${bday.whenText} <br><strong class="text-slate-800">${bday.dateText}</strong></p>
                    
                    <button onclick="closeModal(); showToast('Birthday', 'Birthday card dispatched!');" class="btn-primary mt-6 w-full py-3.5 bg-slate-900 text-brand-lime rounded-2xl hover:bg-black transition-all cursor-pointer shadow-apple active:scale-[0.98]">
                        Send Birthday Card
                    </button>
                </div>
            </div>
        `);
            } else if (type === 'weather') {
                const w = window.CURRENT_WEATHER_DATA || {
                    temp: 21,
                    feelsLike: 21,
                    condition: 'Partly Cloudy',
                    tempMax: 24,
                    tempMin: 15,
                    precipitationProb: 15,
                    precipitation: 0,
                    windSpeed: 14,
                    humidity: 62,
                    locationName: DEFAULT_WEATHER_LOCATION.name,
                    icon: 'fa-cloud-sun',
                    iconColor: 'text-cyan-300'
                };
                openModal(`${w.locationName} Weather Conditions`, `
                    <div class="space-y-4 py-1 text-xs">
                        <div class="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/60 border border-emerald-500/20 text-white flex items-center justify-between shadow-inner">
                            <div>
                                <div class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">${w.locationName} · Live Conditions</div>
                                <div class="text-3xl font-black tracking-tight mt-1 flex items-baseline gap-2">
                                    <span>${Math.round(w.temp)}°C</span>
                                    <span class="text-xs font-semibold text-slate-300">${w.condition}</span>
                                </div>
                                <div class="text-[11px] text-slate-400 font-medium mt-0.5">
                                    High ${Math.round(w.tempMax)}° · Low ${Math.round(w.tempMin)}° · Feels like ${Math.round(w.feelsLike)}°
                                </div>
                            </div>
                            <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl ${w.iconColor}">
                                <i class="fa-solid ${w.icon}"></i>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2.5 text-xs">
                            <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Precipitation</span>
                                <span class="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">${w.precipitationProb}% chance</span>
                                <span class="text-[10px] text-slate-500 font-medium">${w.precipitation > 0 ? w.precipitation + ' mm' : 'No rain recorded'}</span>
                            </div>
                            <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wind Speed</span>
                                <span class="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">${Math.round(w.windSpeed)} km/h</span>
                                <span class="text-[10px] text-slate-500 font-medium">Breeze</span>
                            </div>
                            <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Humidity</span>
                                <span class="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">${Math.round(w.humidity)}%</span>
                                <span class="text-[10px] text-slate-500 font-medium">Comfortable</span>
                            </div>
                            <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Site Protocols</span>
                                <span class="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">Clear for Work</span>
                                <span class="text-[10px] text-slate-500 font-medium">Standard safety</span>
                            </div>
                        </div>
                    </div>
                `);
            }
        }

        function openPendingLeaveModal() {
    const balance = getLeaveBalance() || { annualDays: 0, personalDays: 0 };
    const l = {
        annualDays: balance.annualDays,
        personalDays: balance.personalDays,
        pending: getLeaveRequests({ status: LeaveStatus.PENDING }).map(leaveRequestView),
        history: getLeaveRequests({ status: LeaveStatus.APPROVED }).map(leaveRequestView)
    };
    const total = getLeaveTotalDays();
    const pct = v => Math.max(0, Math.min(100, (v / (total || 1)) * 100)).toFixed(1);
    const card = (r, tone) => `
        <div class="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <div>
                <span class="text-[11px] font-extrabold ${tone} px-2 py-0.5 rounded-md uppercase tracking-wider">${r.status}</span>
                <h5 class="font-black text-slate-900 text-xs mt-1">${r.type} (${r.days} Day${r.days === 1 ? '' : 's'})</h5>
                <p class="text-xs text-slate-400 mt-0.5">${r.dates}</p>
            </div>
            <span class="text-xs font-bold text-slate-500">${r.status === 'Approved' ? 'Processed' : 'Awaiting approval'}</span>
        </div>`;

    openModal("Leave & Sick Days", `
        <div class="space-y-4 py-1 text-xs">
            <!-- Balance: total accrued + breakdown -->
            <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-950 via-[#0a2218] to-slate-950 text-white border border-emerald-500/40 shadow-apple">
                <span class="text-[11px] font-extrabold text-brand-lime tracking-wider uppercase">Total Accrued</span>
                <div class="flex items-baseline gap-1.5 mt-0.5">
                    <span class="text-3xl font-black tracking-tight">${formatDays(total)}</span>
                    <span class="text-sm font-bold text-emerald-300">days</span>
                </div>
                <div class="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden flex" aria-hidden="true">
                    <span class="h-full bg-emerald-400" style="width:${pct(l.annualDays)}%"></span>
                    <span class="h-full bg-teal-200/80" style="width:${pct(l.personalDays)}%"></span>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2">
                    <div class="rounded-xl bg-white/[0.06] border border-white/10 p-2.5">
                        <span class="flex items-center gap-1.5 text-[11px] font-bold text-emerald-200/80"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true"></span>Annual leave</span>
                        <span class="block text-base font-black mt-0.5">${formatDays(l.annualDays)} days</span>
                    </div>
                    <div class="rounded-xl bg-white/[0.06] border border-white/10 p-2.5">
                        <span class="flex items-center gap-1.5 text-[11px] font-bold text-emerald-200/80"><span class="w-1.5 h-1.5 rounded-full bg-teal-200" aria-hidden="true"></span>Personal / sick</span>
                        <span class="block text-base font-black mt-0.5">${formatDays(l.personalDays)} days</span>
                    </div>
                </div>
            </div>

            <!-- Segmented Tabs Bar with Sliding Pill Indicator -->
            <div class="relative flex bg-slate-200/80 backdrop-blur-xl p-1 rounded-2xl border border-slate-300/60">
                <div id="leave-active-pill" class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"></div>

                <button id="leave-tab-pending" onclick="switchLeaveTab('pending')" class="relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-900 transition-colors cursor-pointer">Pending (${l.pending.length})</button>
                <button id="leave-tab-approved" onclick="switchLeaveTab('approved')" class="relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">Approved History</button>
            </div>

            <!-- TAB CONTENT: PENDING -->
            <div id="leave-content-pending" class="space-y-2.5 pt-1">
                ${l.pending.length ? l.pending.map(r => card(r, 'text-amber-700 bg-amber-100')).join('') : `
                <div class="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/30 backdrop-blur-2xl rounded-inset p-5 text-center space-y-2 shadow-sm">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center justify-center mx-auto text-xl shadow-inner">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div>
                        <h4 class="font-black text-slate-900 text-base tracking-tight">No Pending Requests</h4>
                        <p class="text-[11px] text-slate-500 font-medium mt-0.5">All leave submissions have been approved by management.</p>
                    </div>
                </div>`}
            </div>

            <!-- TAB CONTENT: APPROVED HISTORY -->
            <div id="leave-content-approved" class="hidden space-y-2.5 pt-1">
                ${l.history.map(r => card(r, 'text-emerald-700 bg-emerald-100')).join('')}
            </div>

            <!-- Enlarged Thumb-Friendly Primary Action Button -->
            <button onclick="closeModal(); openAppModal('Leave & Sick', 'Request leave', 'fa-paper-plane');" class="btn-primary w-full py-4 bg-slate-900 text-brand-lime rounded-2xl hover:bg-black transition-all cursor-pointer shadow-apple active:scale-[0.98]">
                Request New Leave
            </button>
        </div>
    `);
}


function switchLeaveTab(tab) {
    const tabs = ['pending', 'approved'];
    const activeIndex = tabs.indexOf(tab);

    // Slide the background pill
    const pill = document.getElementById('leave-active-pill');
    if (pill) {
        pill.style.transform = `translateX(${activeIndex * 100}%)`;
    }

    // Toggle content visibility and text styles
    tabs.forEach(t => {
        const content = document.getElementById(`leave-content-${t}`);
        const btn = document.getElementById(`leave-tab-${t}`);
        if (content) content.classList.toggle('hidden', t !== tab);
        if (btn) {
            if (t === tab) {
                btn.className = "relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-900 transition-colors cursor-pointer";
            } else {
                btn.className = "relative z-10 flex-1 py-3 text-center font-extrabold text-xs text-slate-500 hover:text-slate-900 transition-colors cursor-pointer";
            }
        }
    });
}

function openTimesheetsModal() {
    openModal("Weekly Timesheets", `
        <div class="space-y-4 py-2 text-xs">
            <!-- Period Header Banner -->
            <div class="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/60 border border-emerald-200/80 text-slate-900 flex items-center justify-between shadow-2xs">
                <div>
                    <span class="text-[11px] font-black uppercase tracking-wider text-emerald-700 block">Pay Period</span>
                    <h4 class="text-sm font-black tracking-tight text-slate-900 mt-0.5">Week Ending Sun 18 Oct</h4>
                    <p class="text-xs text-slate-500 font-medium">${getSiteName('lugarno')} • Residential Build</p>
                </div>
                <div class="text-right">
                    <span class="text-2xl font-black text-emerald-700">32.0<span class="text-xs text-slate-400 font-bold"> / 40h</span></span>
                    <span class="block text-[11px] font-bold text-amber-600 mt-0.5">4 Days to verify</span>
                </div>
            </div>

            <!-- Days List -->
            <div class="space-y-2">
                <!-- Mon 12 Oct -->
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">M</div>
                        <div>
                            <p class="font-extrabold text-slate-900 text-xs">Monday 12 Oct</p>
                            <p class="text-[11px] text-slate-500">7:00 AM – 3:30 PM (0.5h lunch)</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">8.0 hrs</span>
                </div>

                <!-- Tue 13 Oct -->
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">T</div>
                        <div>
                            <p class="font-extrabold text-slate-900 text-xs">Tuesday 13 Oct</p>
                            <p class="text-[11px] text-slate-500">7:00 AM – 3:30 PM (0.5h lunch)</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">8.0 hrs</span>
                </div>

                <!-- Wed 14 Oct (Today) -->
                <div class="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-black text-xs">W</div>
                        <div>
                            <div class="flex items-center gap-1.5">
                                <p class="font-extrabold text-slate-900 text-xs">Wednesday 14 Oct</p>
                                <span class="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[11px] uppercase">Today</span>
                            </div>
                            <p class="text-[11px] text-amber-800 font-medium">Logged: 7:00 AM – In Progress</p>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black">8.0 hrs</span>
                </div>

                <!-- Thu 15 Oct -->
                <div class="p-3 rounded-2xl bg-slate-50/60 border border-dashed border-slate-300 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-black text-xs">T</div>
                        <div>
                            <p class="font-bold text-slate-600 text-xs">Thursday 15 Oct</p>
                            <p class="text-[11px] text-slate-400">Scheduled 7:00 AM – 3:30 PM</p>
                        </div>
                    </div>
                    <button onclick="triggerHaptic('medium'); showToast('Timesheets', 'Thursday logged standard 8.0h');" class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-brand-lime font-black text-[11px] cursor-pointer active:scale-95 transition-all">Log 8h</button>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="pt-2 flex gap-2">
                <button onclick="triggerHaptic('medium'); closeModal(); showToast('Timesheets', 'All days auto-filled standard 8h');" class="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-black text-xs transition-all cursor-pointer border border-slate-200">
                    Auto-Fill 8h
                </button>
                <button onclick="triggerHaptic('success'); closeModal(); showToast('Timesheets', 'Submitted weekly timesheet for review');" class="btn-primary flex-1 py-3.5 bg-slate-900 hover:bg-black text-brand-lime rounded-2xl transition-all cursor-pointer shadow-apple active:scale-[0.98]">
                    Submit Week
                </button>
            </div>
        </div>
    `);
}

        function openAppModal(appName, appDesc, iconClass) {
            openModal(appName, `
                <div class="text-center py-4">
                    <div class="w-14 h-14 rounded-2xl bg-gray-900 text-[#AEB6C2] flex items-center justify-center mx-auto mb-3 text-xl shadow-md">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <h4 class="font-bold text-gray-900 text-base">${appName}</h4>
                    <p class="text-xs text-gray-500 mt-1">${appDesc}</p>
                    <button onclick="closeModal(); showToast('${appName}', 'Launched ${appName}');" class="mt-5 w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all cursor-pointer">Launch ${appName}</button>
                </div>
            `);
        }
