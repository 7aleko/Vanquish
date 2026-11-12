/**
 * Personal account, reached from the side drawer (the drawer replaced the old Accounts & Profile page).
 *
 *  - renderAccountStatus(): the drawer's profile card, status pills and workwear badge, all from
 *    ACCOUNT_DATA (scripts/data/account.js). Call it after anything changes that data.
 *  - Profile photo: pick, downscale and keep a photo (openProfileModal in sheets.js shows the editor).
 *  - Sheets: My Role & Sign-Off, Safety & Training (Policies | Inductions), App Guide & Status.
 *    Leave & Sick Days, Workwear and the profile sheet live in scripts/features/sheets.js.
 */

const ACCOUNT_PHOTO_KEY = 'lifestyle.profilePhoto';

// ---------------- Derived values ----------------
function getLeaveTotalDays() {
    const l = ACCOUNT_DATA.leave;
    return Math.round((l.annualDays + l.personalDays) * 10) / 10;
}
function formatDays(n) { return `${n.toFixed(1)}`; }
function getWorkwearDueCount() {
    const w = ACCOUNT_DATA.workwear;
    return w.pending.length + w.ready.length;
}
function isRoleSignOffDue() { return !ACCOUNT_DATA.roleSignOff.signedOff; }
function getRoleMonthShort() { return ACCOUNT_DATA.roleSignOff.month.slice(0, 3).toUpperCase(); }

function escapeAccountHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Avatar contents: the photo if one is set, otherwise the initials */
function accountAvatarInner() {
    const p = ACCOUNT_DATA.profile;
    return p.photo
        ? `<img src="${p.photo}" alt="" class="w-full h-full object-cover">`
        : escapeAccountHtml(p.initials);
}

// ---------------- Drawer ----------------
function renderAccountStatus() {
    const p = ACCOUNT_DATA.profile;
    const byId = id => document.getElementById(id);
    const show = (el, on) => { if (el) el.hidden = !on; };

    // Profile card
    document.querySelectorAll('[data-account-avatar]').forEach(el => { el.innerHTML = accountAvatarInner(); });
    if (byId('drawer-profile-name')) byId('drawer-profile-name').textContent = p.name;
    if (byId('drawer-profile-id')) byId('drawer-profile-id').textContent = p.employeeId;
    const card = byId('drawer-profile-card');
    if (card) card.setAttribute('aria-label', `${p.name}, ${p.employeeId}. Open personal details`);

    // Leave & Sick Days
    const total = getLeaveTotalDays();
    const leavePill = byId('drawer-leave-pill');
    if (leavePill) leavePill.textContent = `${formatDays(total)}d`;
    const leaveRow = byId('drawer-row-leave');
    if (leaveRow) leaveRow.setAttribute('aria-label', `Leave and Sick Days, ${formatDays(total)} days available`);

    // My Role & Sign-Off
    const due = isRoleSignOffDue();
    const rolePill = byId('drawer-role-pill');
    if (rolePill) rolePill.textContent = `${getRoleMonthShort()} Due`;
    show(rolePill, due);
    const roleRow = byId('drawer-row-role');
    if (roleRow) roleRow.setAttribute('aria-label', due
        ? `My Role and Sign-Off, ${ACCOUNT_DATA.roleSignOff.month} sign-off due`
        : `My Role and Sign-Off, ${ACCOUNT_DATA.roleSignOff.month} signed off`);

    // Workwear
    const ww = getWorkwearDueCount();
    const wwBadge = byId('drawer-workwear-badge');
    const wwPill = byId('drawer-workwear-pill');
    if (wwBadge) wwBadge.textContent = ww;
    if (wwPill) wwPill.textContent = `${ww} Due`;
    show(wwBadge, ww > 0);
    show(wwPill, ww > 0);
    const wwRow = byId('drawer-row-workwear');
    if (wwRow) wwRow.setAttribute('aria-label', ww > 0 ? `Workwear, ${ww} due` : 'Workwear');

    // App Guide & Status
    const proc = ACCOUNT_DATA.integrations.procore;
    const statusPill = byId('drawer-app-status');
    if (statusPill) {
        const label = { synced: 'Synced', syncing: 'Syncing', offline: 'Offline' }[proc.status] || proc.status;
        statusPill.querySelector('[data-label]').textContent = label;
        statusPill.dataset.state = proc.status;
    }
    const guideRow = byId('drawer-row-guide');
    if (guideRow) guideRow.setAttribute('aria-label', `App Guide and Status, ${proc.name} ${proc.status}`);
}

// ---------------- Profile photo ----------------
function loadSavedProfilePhoto() {
    try {
        const saved = localStorage.getItem(ACCOUNT_PHOTO_KEY);
        if (saved) ACCOUNT_DATA.profile.photo = saved;
    } catch (_) {}
}

function pickProfilePhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                // Square crop from the centre, 192px: sharp at 3x for the 64px avatar, small enough to store
                const size = 192;
                const c = document.createElement('canvas');
                c.width = c.height = size;
                const side = Math.min(img.width, img.height);
                c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
                setProfilePhoto(c.toDataURL('image/jpeg', 0.85));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function setProfilePhoto(dataUrl) {
    ACCOUNT_DATA.profile.photo = dataUrl;
    try {
        if (dataUrl) localStorage.setItem(ACCOUNT_PHOTO_KEY, dataUrl);
        else localStorage.removeItem(ACCOUNT_PHOTO_KEY);
    } catch (_) {}
    renderAccountStatus();
    const removeBtn = document.getElementById('profile-photo-remove');
    if (removeBtn) removeBtn.hidden = !dataUrl;
    triggerHaptic('success');
    showToast('Profile', dataUrl ? 'Photo updated' : 'Photo removed');
}

// ---------------- Shared sheet pieces ----------------
function accountSegmented(id, tabs, onSwitch) {
    const w = `calc(${(100 / tabs.length).toFixed(2)}% - ${8 / tabs.length}px)`;
    return `
        <div class="relative flex bg-slate-200/80 backdrop-blur-xl p-1 rounded-2xl border border-slate-300/60" role="tablist">
            <div id="${id}-pill" class="absolute top-1 bottom-1 left-1 bg-white rounded-xl shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style="width:${w}"></div>
            ${tabs.map((t, i) => `
                <button type="button" role="tab" id="${id}-tab-${t.key}" aria-selected="${i === 0}" onclick="${onSwitch}('${t.key}')"
                    class="relative z-10 flex-1 py-3 text-center font-extrabold text-xs ${i === 0 ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'} transition-colors cursor-pointer">${t.label}</button>`).join('')}
        </div>`;
}
function switchAccountSegment(id, keys, key) {
    const i = keys.indexOf(key);
    const pill = document.getElementById(`${id}-pill`);
    if (pill) pill.style.transform = `translateX(${i * 100}%)`;
    keys.forEach(k => {
        const panel = document.getElementById(`${id}-panel-${k}`);
        const btn = document.getElementById(`${id}-tab-${k}`);
        if (panel) panel.classList.toggle('hidden', k !== key);
        if (btn) {
            btn.setAttribute('aria-selected', String(k === key));
            btn.classList.toggle('text-slate-900', k === key);
            btn.classList.toggle('text-slate-500', k !== key);
        }
    });
    triggerHaptic('light');
}

function accountListRow({ icon, title, sub, onclick, trailing = '' }) {
    return `
        <button type="button" onclick="${onclick}"
            class="w-full flex items-center justify-between gap-3 p-4 min-h-[56px] text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime">
            <span class="flex items-center gap-3.5 min-w-0">
                <span class="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0" aria-hidden="true">
                    <i class="fa-solid ${icon} text-sm"></i>
                </span>
                <span class="min-w-0">
                    <span class="block text-sm font-bold text-slate-900 tracking-tight">${title}</span>
                    <span class="block text-xs text-slate-500 font-medium truncate mt-0.5">${sub}</span>
                </span>
            </span>
            <span class="flex items-center gap-2 shrink-0">${trailing}<i class="fa-solid fa-chevron-right text-xs text-slate-400" aria-hidden="true"></i></span>
        </button>`;
}

// ---------------- My Role & Sign-Off ----------------
function openRoleSignOffModal() {
    const p = ACCOUNT_DATA.profile;
    const r = ACCOUNT_DATA.roleSignOff;
    const statusCard = r.signedOff
        ? `<div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
               <span class="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
               <span class="min-w-0">
                   <span class="block text-sm font-black text-slate-900">${r.month} signed off</span>
                   <span class="block text-xs text-slate-500 font-medium mt-0.5">Confirmed ${r.signedAt ? new Date(r.signedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}</span>
               </span>
           </div>`
        : `<div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
               <span class="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-700 flex items-center justify-center shrink-0" aria-hidden="true"><i class="fa-solid fa-file-signature"></i></span>
               <span class="min-w-0">
                   <span class="block text-sm font-black text-slate-900">${r.month} sign-off due</span>
                   <span class="block text-xs text-slate-500 font-medium mt-0.5">Read and confirm your role guidelines and responsibilities for ${r.month}</span>
               </span>
           </div>`;

    openModal('My Role & Sign-Off', `
        <div class="space-y-4 py-1 text-xs">
            <div class="bg-slate-50/90 rounded-2xl p-4 space-y-3 border border-slate-100">
                <div class="flex justify-between items-center text-slate-500"><span class="font-medium">Role</span><span class="font-bold text-slate-900">${escapeAccountHtml(p.role)}</span></div>
                <div class="flex justify-between items-center text-slate-500"><span class="font-medium">Department</span><span class="font-bold text-slate-900">${escapeAccountHtml(p.department)}</span></div>
                <div class="flex justify-between items-center text-slate-500"><span class="font-medium">Site</span><span class="font-bold text-slate-900">${escapeAccountHtml(p.site)}</span></div>
            </div>
            ${statusCard}
            <div class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                ${accountListRow({ icon: 'fa-id-badge', title: 'Role guidelines', sub: `${r.month} sign-off and role responsibilities review`, onclick: `openAppModal('My Role', '${r.month} sign-off and role responsibilities review', 'fa-id-badge')` })}
            </div>
            ${r.signedOff ? '' : `
            <button type="button" onclick="confirmRoleSignOff()" class="btn-primary w-full py-4 bg-slate-900 text-brand-lime rounded-2xl hover:bg-black transition-all cursor-pointer shadow-apple active:scale-[0.98]">
                Confirm ${r.month} Sign-Off
            </button>`}
        </div>
    `);
}

function confirmRoleSignOff() {
    ACCOUNT_DATA.roleSignOff.signedOff = true;
    ACCOUNT_DATA.roleSignOff.signedAt = Date.now();
    renderAccountStatus();
    triggerHaptic('success');
    closeModal();
    showToast('My Role', `${ACCOUNT_DATA.roleSignOff.month} guidelines signed off`);
}

// ---------------- Safety & Training ----------------
const SAFETY_TABS = ['policies', 'inductions'];
function openSafetyTrainingModal(tab = 'policies') {
    openModal('Safety & Training', `
        <div class="space-y-4 py-1 text-xs">
            ${accountSegmented('safety', [{ key: 'policies', label: 'Policies' }, { key: 'inductions', label: 'Inductions' }], 'switchSafetyTab')}

            <div id="safety-panel-policies" role="tabpanel" class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                ${accountListRow({ icon: 'fa-shield-halved', title: 'Company Policies', sub: 'Safety, HR & operational standards', onclick: "openAppModal('Company Policies', 'HR guidelines, safety, and operational standards', 'fa-shield-halved')" })}
            </div>

            <div id="safety-panel-inductions" role="tabpanel" class="hidden bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                ${accountListRow({ icon: 'fa-circle-play', title: 'Training Videos', sub: 'On-site safety & tool inductions', onclick: "openAppModal('Training Videos', 'On-site safety, procedures & tool guides', 'fa-circle-play')" })}
            </div>
        </div>
    `);
    if (tab !== 'policies') switchSafetyTab(tab);
}
function switchSafetyTab(tab) { switchAccountSegment('safety', SAFETY_TABS, tab); }

// ---------------- App Guide & Status ----------------
const APP_GUIDE_SECTIONS = [
    { icon: 'fa-house', title: 'Home', text: "Today's site card: sign in and out of your shift and watch it fill as the day goes. Weather, quick actions, Poppy, Team and Tools are underneath." },
    { icon: 'fa-calendar-days', title: 'Roster', text: 'Your week: which site you are on each day, with rain-day changes when the weather turns.' },
    { icon: 'fa-clock', title: 'Timesheets', text: 'Log your hours day by day, auto-fill standard 8-hour days, then submit the week for review.' },
    { icon: 'fa-message', title: 'Chat', text: 'Team and site channels, direct messages, and Poppy for quick answers.' },
    { icon: 'fa-helmet-safety', title: 'Site', text: 'Your sites for the week, who is on site each day, and the field tools.' },
    { icon: 'fa-user-group', title: 'Team & Tools', text: 'Everyone on your team, and every tool with where it is and whether it is available to transfer.' },
    { icon: 'fa-bars', title: 'Menu', text: 'Your profile, leave, role sign-off, workwear, safety & training, and this guide.' }
];
const APP_GUIDE_TIPS = [
    'Tap the menu button at the top right of Home to open the menu; tap the X or swipe it closed.',
    'Swipe from the left edge of a screen to go back.',
    'Tap the sync button at the top of a screen to refresh it from Procore.',
    'Red badges show what needs you: unread messages, notifications and workwear to collect.'
];

function openAppGuideModal() {
    const proc = ACCOUNT_DATA.integrations.procore;
    const statusText = { synced: 'Synced', syncing: 'Syncing', offline: 'Offline' }[proc.status] || proc.status;
    const statusTone = proc.status === 'synced' ? 'emerald' : proc.status === 'syncing' ? 'amber' : 'rose';
    const lastSync = proc.lastSync ? new Date(proc.lastSync).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : '—';
    const projects = typeof PROCORE_PROJECTS !== 'undefined' ? PROCORE_PROJECTS.length : null;
    const row = (k, v) => `<div class="flex justify-between items-center gap-3 text-slate-500"><span class="font-medium">${k}</span><span class="font-bold text-slate-900 text-right">${v}</span></div>`;

    openModal('App Guide & Status', `
        <div class="space-y-5 py-1 text-xs">
            <p class="text-sm text-slate-600 leading-relaxed">Lifestyle keeps your day on site in one place: where you are working, your hours, your team and your gear, synced with Procore.</p>

            <section class="space-y-2" aria-labelledby="guide-sections-h">
                <h4 id="guide-sections-h" class="text-xs font-bold tracking-wider text-slate-400 uppercase px-1">Getting around</h4>
                <div class="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
                    ${APP_GUIDE_SECTIONS.map(s => `
                        <div class="flex items-start gap-3.5 p-4">
                            <span class="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0" aria-hidden="true"><i class="fa-solid ${s.icon} text-sm"></i></span>
                            <span class="min-w-0">
                                <span class="block text-sm font-bold text-slate-900 tracking-tight">${s.title}</span>
                                <span class="block text-xs text-slate-500 font-medium leading-relaxed mt-0.5">${s.text}</span>
                            </span>
                        </div>`).join('')}
                </div>
            </section>

            <section class="space-y-2" aria-labelledby="guide-tips-h">
                <h4 id="guide-tips-h" class="text-xs font-bold tracking-wider text-slate-400 uppercase px-1">Tips</h4>
                <ul class="bg-slate-50/90 rounded-2xl border border-slate-100 p-4 space-y-2.5">
                    ${APP_GUIDE_TIPS.map(t => `<li class="flex gap-2.5 text-xs text-slate-600 font-medium leading-relaxed"><span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true"></span>${t}</li>`).join('')}
                </ul>
            </section>

            <section class="space-y-2" aria-labelledby="guide-status-h">
                <h4 id="guide-status-h" class="text-xs font-bold tracking-wider text-slate-400 uppercase px-1">System status</h4>
                <div class="bg-slate-50/90 rounded-2xl border border-slate-100 p-4 space-y-3">
                    <div class="flex justify-between items-center gap-3">
                        <span class="font-bold text-slate-900">${escapeAccountHtml(proc.name)}</span>
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-${statusTone}-100 text-${statusTone}-800 text-[11px] font-extrabold uppercase tracking-wider">
                            <span class="w-1.5 h-1.5 rounded-full bg-${statusTone}-500" aria-hidden="true"></span>${statusText}
                        </span>
                    </div>
                    ${row('Last synced', lastSync)}
                    ${projects != null ? row('Projects available', projects) : ''}
                    ${row('App version', `${escapeAccountHtml(ACCOUNT_DATA.app.name)} v${escapeAccountHtml(ACCOUNT_DATA.app.version)}`)}
                </div>
            </section>
        </div>
    `);
}

// ---------------- Init ----------------
loadSavedProfilePhoto();
ACCOUNT_DATA.integrations.procore.lastSync = ACCOUNT_DATA.integrations.procore.lastSync || Date.now();
document.addEventListener('DOMContentLoaded', renderAccountStatus);
