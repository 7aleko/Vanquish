/**
 * Notifications / activity view: feed, filters, badges, actions.
 */

// =========================================================================
// INSTAGRAM-STYLE NOTIFICATIONS & ACTIVITY ENGINE
// =========================================================================
let currentActiveNotifFilter = 'all';
let viewBeforeNotifications = 'home';

// ---------- The feed: the signed-in user's own notifications (database) + the sample feed ----------
// Targeted notifications (availability requests and answers) come from the database through
// getMyNotifications. The sample items (NOTIFICATIONS_DATA) belong to the demo account only.
const LIVE_NOTIF_LOOK = {
    availability_request: { icon: 'fa-solid fa-bell', iconBg: 'bg-sky-950 text-sky-400 border border-sky-500/30', action: 'View' },
    availability_available: { icon: 'fa-solid fa-circle-check', iconBg: 'bg-emerald-950 text-brand-lime border border-brand-lime/30', action: 'View' },
    availability_in_use: { icon: 'fa-solid fa-clock', iconBg: 'bg-sky-950 text-sky-400 border border-sky-500/30', action: 'View' },
    availability_eta_updated: { icon: 'fa-solid fa-clock-rotate-left', iconBg: 'bg-sky-950 text-sky-400 border border-sky-500/30', action: 'View' },
    availability_missing: { icon: 'fa-solid fa-triangle-exclamation', iconBg: 'bg-amber-950 text-amber-400 border border-amber-500/30', action: 'View' },
    availability_missing_alert: { icon: 'fa-solid fa-triangle-exclamation', iconBg: 'bg-amber-950 text-amber-400 border border-amber-500/30', action: 'Check' }
};
function liveNotifTime(iso) {
    const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
function liveNotifGroup(iso) {
    const d = new Date(iso), now = new Date();
    const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((day0(now) - day0(d)) / 86400000);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : 'Earlier';
}
function getNotificationFeedItems() {
    const live = (typeof getMyNotifications === 'function' && appStore.status === 'ready') ? getMyNotifications().map(n => {
        const look = LIVE_NOTIF_LOOK[n.type] || LIVE_NOTIF_LOOK.availability_request;
        const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        return {
            id: n.id, live: true, category: 'tools', timeGroup: liveNotifGroup(n.createdAt), icon: look.icon, iconBg: look.iconBg,
            title: esc(n.title), message: esc(n.body), time: liveNotifTime(n.createdAt), read: !!n.readAt,
            actionType: n.requestId ? 'availability' : null, actionLabel: look.action
        };
    }) : [];
    const sample = getCurrentEmployeeId() === APP_CONFIG.auth.defaultEmployeeId ? NOTIFICATIONS_DATA : [];
    return [...live, ...sample];
}

function openNotificationsView() {
    triggerHaptic('light');
    if (currentActiveViewName === 'notifications') {
        closeNotificationsView();
        return;
    }
    viewBeforeNotifications = currentActiveViewName || 'home';
    subpageParentMap['notifications'] = viewBeforeNotifications;
    switchTab('notifications', { forceMode: 'push' });
    renderNotificationsFeed(currentActiveNotifFilter);

    const notifBtn = document.getElementById('btn-notifications');
    if (notifBtn) {
        notifBtn.classList.add('border-brand-lime', 'shadow-[0_0_12px_rgba(34,229,98,0.3)]');
    }
}

function closeNotificationsView() {
    triggerHaptic('light');
    const notifBtn = document.getElementById('btn-notifications');
    if (notifBtn) {
        notifBtn.classList.remove('border-brand-lime', 'shadow-[0_0_12px_rgba(34,229,98,0.3)]');
    }
    switchTab(viewBeforeNotifications || 'home', { forceMode: 'pop', silentHaptic: true });
}

function filterNotifications(category) {
    triggerHaptic('light');
    currentActiveNotifFilter = category;

    setActiveFilterPill(document.getElementById(`notif-filter-${category}`));

    renderNotificationsFeed(category);
}

function markNotificationAsRead(id) {
    const live = getNotificationFeedItems().find(n => n.id === id && n.live);
    if (live) {
        if (!live.read) availabilityService.markNotificationRead(id).catch(err => console.warn('Mark read failed:', err));
        return;
    }
    const item = NOTIFICATIONS_DATA.find(n => n.id === id);
    if (item && !item.read) {
        item.read = true;
        updateNotificationBadges();
        renderNotificationsFeed(currentActiveNotifFilter);
    }
}

function markAllNotificationsRead() {
    triggerHaptic('success');
    NOTIFICATIONS_DATA.forEach(n => n.read = true);
    availabilityService.markAllNotificationsRead().catch(err => console.warn('Mark all read failed:', err));
    updateNotificationBadges();
    renderNotificationsFeed(currentActiveNotifFilter);
    showToast('Notifications', 'All caught up!');
}

function updateNotificationBadges() {
    const unreadCount = getNotificationFeedItems().filter(n => !n.read).length;
    const badgeCount = document.getElementById('notif-badge-count');
    const badgeDot = document.getElementById('notif-badge-dot');
    const countPill = document.getElementById('notif-count-pill');

    if (badgeCount) {
        if (unreadCount > 0) {
            badgeCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badgeCount.style.display = 'flex';
        } else {
            badgeCount.style.display = 'none';
        }
    }
    if (badgeDot) {
        badgeDot.style.display = unreadCount > 0 ? 'block' : 'none';
    }
    if (countPill) {
        if (unreadCount > 0) {
            countPill.textContent = `${unreadCount} New`;
            countPill.className = 'px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black tracking-wide shadow-xs';
        } else {
            countPill.textContent = 'All caught up';
            countPill.className = 'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 text-[11px] font-black tracking-wide border border-emerald-500/30';
        }
    }
}

function handleNotificationAction(e, id, actionType) {
    if (e) e.stopPropagation();
    if (actionType === 'availability') {             // the request's card in its site chat
        openAvailabilityNotification(id);
        return;
    }
    markNotificationAsRead(id);

    if (actionType === 'signin') {
        toggleSiteSignIn(e);
        renderNotificationsFeed(currentActiveNotifFilter);
    } else if (actionType === 'signout') {
        if (isSiteSignedIn) {
            toggleSiteSignIn(e);
            renderNotificationsFeed(currentActiveNotifFilter);
        } else {
            showToast('Site Status', 'You are already signed out.');
        }
    } else if (actionType === 'tool') {
        const notifBtn = document.getElementById('btn-notifications');
        if (notifBtn) notifBtn.classList.remove('border-brand-lime', 'shadow-[0_0_12px_rgba(34,229,98,0.3)]');
        switchTab('tools');
        showToast('Tools & Gear', 'Viewing DeWalt 54V Table Saw movement');
    } else if (actionType === 'roster') {
        const notifBtn = document.getElementById('btn-notifications');
        if (notifBtn) notifBtn.classList.remove('border-brand-lime', 'shadow-[0_0_12px_rgba(34,229,98,0.3)]');
        switchTab('week');
    } else if (actionType === 'docket') {
        triggerHaptic('medium');
        showToast('Delivery Docket', 'Viewing delivery #LF-8924: 935 Forest Rd');
    }
}

function renderNotificationsFeed(filter = 'all') {
    const container = document.getElementById('notifications-feed-list');
    if (!container) return;

    updateNotificationBadges();

    const items = getNotificationFeedItems();
    const filtered = filter === 'all' ? items : items.filter(n => n.category === filter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-16 text-center text-slate-400 space-y-2">
                <div class="w-14 h-14 rounded-full bg-white/70 backdrop-blur-xl border border-white/80 shadow-apple flex items-center justify-center mx-auto text-slate-300">
                    <i class="fa-regular fa-bell-slash text-xl"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-700">No Notifications</h3>
                <p class="text-xs text-slate-500">There are no updates in this category right now.</p>
            </div>
        `;
        return;
    }

    const groups = ['Today', 'Yesterday', 'Earlier'];
    let html = '';

    groups.forEach(groupName => {
        const groupItems = filtered.filter(n => n.timeGroup === groupName);
        if (groupItems.length === 0) return;

        html += `
            <div class="space-y-2.5">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-400">${groupName}</h3>
                    <span class="text-[11px] font-bold text-slate-400">${groupItems.length} update${groupItems.length > 1 ? 's' : ''}</span>
                </div>
                <div class="space-y-2.5">
                    ${groupItems.map(item => {
                        let actionButtonHtml = '';
                        if (item.actionType === 'signin') {
                            if (isSiteSignedIn) {
                                actionButtonHtml = `
                                    <button onclick="handleNotificationAction(event, '${item.id}', 'signin')" class="hit-44 shrink-0 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-xs font-bold shadow-xs hover:bg-emerald-500/25 active:scale-95 transition-all">
                                        <i class="fa-solid fa-check text-[11px]" aria-hidden="true"></i> Signed In
                                    </button>
                                `;
                            } else {
                                actionButtonHtml = `
                                    <button onclick="handleNotificationAction(event, '${item.id}', 'signin')" class="hit-44 shrink-0 px-4 py-1.5 rounded-full bg-brand-lime hover:bg-brand-limeHover border border-brand-lime text-slate-950 text-xs font-black shadow-[0_0_12px_rgba(34,229,98,0.35)] active:scale-95 transition-all">
                                        Sign In
                                    </button>
                                `;
                            }
                        } else if (item.actionType === 'signout') {
                            actionButtonHtml = `
                                <button onclick="handleNotificationAction(event, '${item.id}', 'signout')" class="hit-44 shrink-0 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-black text-rose-300 border border-rose-500/30 text-xs font-bold active:scale-95 transition-all shadow-xs">
                                    Sign Out
                                </button>
                            `;
                        } else if (item.actionType === 'tool') {
                            actionButtonHtml = `
                                <button onclick="handleNotificationAction(event, '${item.id}', 'tool')" class="hit-44 shrink-0 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-black text-brand-lime text-xs font-bold active:scale-95 transition-all shadow-xs">
                                    Locate
                                </button>
                            `;
                        } else if (item.actionType === 'roster') {
                            actionButtonHtml = `
                                <button onclick="handleNotificationAction(event, '${item.id}', 'roster')" class="hit-44 shrink-0 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 text-xs font-bold active:scale-95 transition-all shadow-xs">
                                    View
                                </button>
                            `;
                        } else if (item.actionType === 'availability') {
                            actionButtonHtml = `
                                <button onclick="handleNotificationAction(event, '${item.id}', 'availability')" class="hit-44 shrink-0 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-black text-brand-lime text-xs font-bold active:scale-95 transition-all shadow-xs">
                                    ${item.actionLabel || 'View'}
                                </button>
                            `;
                        } else if (item.actionType === 'docket') {
                            actionButtonHtml = `
                                <button onclick="handleNotificationAction(event, '${item.id}', 'docket')" class="hit-44 shrink-0 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 text-xs font-bold active:scale-95 transition-all shadow-xs">
                                    Docket
                                </button>
                            `;
                        }

                        return `
                            <div onclick="${item.actionType === 'availability' ? `handleNotificationAction(event, '${item.id}', 'availability')` : `markNotificationAsRead('${item.id}')`}" 
                                 class="relative rounded-[22px] p-4 ${item.read ? 'bg-white/75 hover:bg-white/90 border-white/80' : 'bg-white/95 hover:bg-white border-white/90 ring-1 ring-emerald-500/25'} backdrop-blur-2xl border shadow-apple flex items-center justify-between gap-3.5 transition-all cursor-pointer group active:scale-[0.99] overflow-hidden">
                                
                                <div class="flex items-start gap-3.5 min-w-0 flex-1">
                                    <!-- Apple App Icon Squircle -->
                                    <div class="w-11 h-11 rounded-2xl ${item.iconBg} flex items-center justify-center shrink-0 shadow-xs relative mt-0.5">
                                        <i class="${item.icon} text-base"></i>
                                    </div>

                                    <!-- Content -->
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1.5">
                                            <h4 class="text-[15px] sm:text-base font-black ${item.read ? 'text-slate-900' : 'text-slate-950'} tracking-tight leading-snug">${item.title}</h4>
                                            ${!item.read ? '<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Unread"></span>' : ''}
                                        </div>
                                        <p class="text-[13px] text-slate-600 font-normal leading-relaxed mt-1">${item.message}</p>
                                        <div class="flex items-center gap-2 mt-2">
                                            <span class="text-[11px] font-semibold text-slate-400 tracking-wide">${item.time}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Action Button on Right -->
                                ${actionButtonHtml ? `<div class="shrink-0 self-center pl-1">${actionButtonHtml}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
