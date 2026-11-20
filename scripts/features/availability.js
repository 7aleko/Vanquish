/**
 * Equipment availability requests: the UI of one workflow across three screens.
 *
 *   Tools        "Request Availability" on an in-use tool -> a confirmation sheet (optional note) ->
 *                availabilityService.request. The tool's card then shows the request's live state.
 *   Site chat    the request's interactive card (AvailabilityRequestCard) in the tool's site group chat:
 *                Available Now / In Use - Set ETA / Missing - Not Here, then the answer; the holder of an
 *                in-use answer can move their ETA or mark it free.
 *   Notifications  a banner when one arrives while the app is open; tapping it (or the feed row) opens the
 *                chat at the card and highlights it.
 *
 * Every screen renders the one AvailabilityRequest record (getAvailabilityRequest / getToolAvailability) and
 * redraws when it changes - locally, or from another tab or device through the store's realtime refresh.
 * Answers show at once (optimistic) and roll back if the server refuses them; the server's state wins.
 * Styles: styles/availability.css.
 */

const AV_TONE = { pending: 'pending', available: 'available', in_use: 'in-use', missing: 'missing', expired: 'expired' };
const AV_BADGE = { pending: 'Pending Response', available: '✓ Available Now', in_use: 'In Use', missing: '⚠ Not At Site', expired: 'Expired' };

function avEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const avFirst = name => String(name || '').split(' ')[0];
// "Today, 1:42 PM" / "Yesterday, 1:42 PM" / "12 Oct, 1:42 PM"
function avWhen(iso) {
    const d = new Date(iso), now = new Date();
    if (Number.isNaN(d.getTime())) return '';
    const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((day0(now) - day0(d)) / 86400000);
    const day = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    return `${day}, ${formatClockTime(iso)}`;
}
function avNewKey() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) { /* older browsers */ }
    return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------- Who may do what (a hint for the UI; the service checks again) ----------------
function avSiteMembers(siteId) {
    return AvailabilityRules.siteMemberIds({
        roster: appStore.get('roster'), attendance: appStore.get('attendance'), employees: getEmployees(),
        siteId, date: DateRules.toIso(homeAttendanceDay())
    });
}
function avViewerRole(request) {
    const me = getCurrentEmployee();
    if (!me) return 'none';
    const mine = request.requesterId === me.id;
    if (mine && !Permissions.can(me, 'availability.respondOwn')) return 'requester';
    if (request.holderId === me.id) return 'holder';
    if (avSiteMembers(request.siteId).has(me.id) || Permissions.can(me, 'availability.override')) return 'member';
    return 'none';
}

// Answers on their way to the server: requestId -> the state shown until it answers
const avOptimistic = new Map();
const avErrors = new Map();                 // requestId -> the last refusal, shown on the card
function avView(requestId) {
    const r = getAvailabilityRequest(requestId);
    if (!r) return null;
    const o = avOptimistic.get(requestId);
    return o ? { ...r, ...o, liveStatus: o.status, optimistic: true } : r;
}

// ---------------- Tools: compact action pills ----------------
// Every Tools action is the same compact, right-aligned pill (styles/availability.css .tool-pill): green
// Transfer, blue Request Availability, a quiet "Requested" while a request is open, and a muted, non-interactive
// "No Site Chat" where the site has no group chat to ask in. Out-of-service units get no action.
const avPill = {
    transfer: (onclick, label) => `<button type="button" class="btn btn--card btn--glass-emerald tool-card-action tool-pill" aria-label="${avEsc(label)}" onclick="event.stopPropagation(); ${onclick}"><span>Transfer</span></button>`,
    request: (onclick, label) => `<button type="button" class="btn btn--card btn--glass-blue tool-card-action tool-pill" aria-label="${avEsc(label)}" onclick="event.stopPropagation(); ${onclick}"><span>Request Availability</span></button>`,
    requested: label => `<button type="button" aria-disabled="true" class="btn btn--card tool-card-action tool-pill tool-pill--requested" aria-label="${avEsc(label)}" onclick="event.stopPropagation()"><span>Requested</span></button>`,
    noChat: () => `<span class="tool-pill tool-pill--muted" role="note" aria-label="No site chat: this site has no group chat to ask in">No Site Chat</span>`
};
const avCanAsk = siteId => { const site = siteId ? getSiteById(siteId) : null; return !!(site && site.active && getChatForSite(siteId)); };

// The strip under a card (or under a grouped row): the latest request's state, with a link to its card
function avRequestStrip(av, tool) {
    if (!av) return '';
    const status = av.liveStatus;
    const viewLink = `<button type="button" class="tool-avail-link" onclick="event.stopPropagation(); openAvailabilityRequest('${avEsc(av.id)}')">View in chat<i class="ph-bold ph-caret-right" aria-hidden="true"></i></button>`;
    const strip = (tone, icon, label, detail) => `
        <div class="tool-avail is-${tone}">
            <i class="${icon}" aria-hidden="true"></i>
            <span class="tool-avail-text"><span class="tool-avail-label">${label}</span>${detail ? `<span class="tool-avail-detail">${detail}</span>` : ''}</span>
            ${viewLink}
        </div>`;
    const qty = av.quantity > 1 ? `${av.quantity} · ` : '';
    if (status === AvailabilityStatus.MISSING && (!tool || tool.missingReportedAt || isGroupedTool(tool))) {
        return strip('missing', 'ph-fill ph-warning', `${qty}Not at site`, `Reported by ${avEsc(av.responderName)} · ${formatClockTime(av.respondedAt)}`);
    }
    if (av.active && status === AvailabilityStatus.PENDING) {
        return strip('pending', 'ph-fill ph-hourglass-medium', `${qty}Pending Response`, `Requested by ${av.requesterId === getCurrentEmployeeId() ? 'you' : avEsc(av.requesterName)} · ${formatClockTime(av.createdAt)}`);
    }
    if (av.active && status === AvailabilityStatus.IN_USE) {
        return strip('in-use', 'ph-fill ph-clock', `${qty}In Use — Available at ${formatClockTime(av.estimatedAvailableAt)}`, avEsc(av.responderName));
    }
    if (status === AvailabilityStatus.AVAILABLE && avIsToday(av.respondedAt) && (isGroupedTool(tool) || tool.status === ToolStatus.AVAILABLE)) {
        return strip('available', 'ph-fill ph-check-circle', `${qty}Available Now`, `Confirmed by ${avEsc(av.responderName)} · ${formatClockTime(av.respondedAt)}`);
    }
    return '';
}

// An individual tool's card: { strip, action } (action null = the card keeps its own Transfer / service pill)
function toolAvailabilityParts(tool) {
    const av = getToolAvailability(tool.id);
    const stripHtml = avRequestStrip(av, tool);
    if (tool.status !== ToolStatus.IN_USE) return { strip: stripHtml, action: null };
    if (av && av.active) return { strip: stripHtml, action: avPill.requested(`Availability requested for ${tool.name}, waiting for the site`) };
    if (!avCanAsk(tool.siteId)) return { strip: stripHtml, action: avPill.noChat() };
    return { strip: stripHtml, action: avPill.request(`openRequestAvailability('${avEsc(tool.id)}')`, `Request availability of ${tool.name}`) };
}

// One bucket row of a grouped tool: { action, strip }
function allocationActionParts(tool, alloc) {
    const site = alloc.siteId ? getSiteName(alloc.siteId, '') : 'unassigned location';
    const arg = alloc.siteId ? `'${avEsc(alloc.siteId)}'` : 'null';
    if (alloc.status === ToolStatus.SERVICE) return { action: '', strip: '' };          // out of service: no action
    if (alloc.status === ToolStatus.AVAILABLE) {
        return { action: avPill.transfer(`openToolTransferModal('${avEsc(tool.id)}', ${arg})`, `Transfer ${tool.name} from ${site}`), strip: '' };
    }
    // In use: ask the site
    const av = alloc.siteId ? getToolAvailability(tool.id, alloc.siteId) : null;
    const strip = avRequestStrip(av, tool);
    if (av && av.active) return { action: avPill.requested(`Availability requested for ${tool.name} at ${site}`), strip };
    if (!avCanAsk(alloc.siteId)) return { action: avPill.noChat(), strip };
    return { action: avPill.request(`openRequestAvailability('${avEsc(tool.id)}', ${arg})`, `Request availability of ${tool.name} at ${site}`), strip };
}
function avIsToday(iso) {
    const d = new Date(iso), n = new Date();
    return !Number.isNaN(d.getTime()) && d.toDateString() === n.toDateString();
}

// ---------------- Shared: the quantity stepper (grouped tools only) ----------------
// "−  1 / 2  +": starts at 1, never below 1 or above `max`. The value lives in the element (#id).
function renderQtyStepper(id, max, label = 'Quantity') {
    return `<div class="qty-stepper" role="group" aria-label="${avEsc(label)}">
            <button type="button" class="qty-step" data-for="${id}" data-step="-1" onclick="stepQty('${id}', -1)" aria-label="One fewer" disabled><i class="ph-bold ph-minus" aria-hidden="true"></i></button>
            <span class="qty-readout"><output id="${id}" class="qty-value" data-max="${max}" aria-live="polite">1</output><span class="qty-max">/ ${max}</span></span>
            <button type="button" class="qty-step" data-for="${id}" data-step="1" onclick="stepQty('${id}', 1)" aria-label="One more" ${max <= 1 ? 'disabled' : ''}><i class="ph-bold ph-plus" aria-hidden="true"></i></button>
        </div>`;
}
function readQty(id) { const el = document.getElementById(id); return el ? Number(el.textContent) || 1 : 1; }
function setQtyMax(id, max) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.max = max;
    const wrap = el.closest('.qty-stepper');
    if (wrap) wrap.querySelector('.qty-max').textContent = `/ ${max}`;
    stepQty(id, 0, true);
}
function stepQty(id, delta, silent) {
    const el = document.getElementById(id);
    if (!el) return;
    const max = Number(el.dataset.max) || 1;
    const next = Math.max(1, Math.min(max, (Number(el.textContent) || 1) + delta));
    if (!silent && next !== Number(el.textContent)) triggerHaptic('light');
    el.textContent = next;
    document.querySelectorAll(`.qty-step[data-for="${id}"]`).forEach(b => {
        b.disabled = b.dataset.step === '-1' ? next <= 1 : next >= max;
    });
    el.dispatchEvent(new CustomEvent('qtychange', { bubbles: true, detail: next }));
}

// ---------------- Tools: the confirmation sheet ----------------
let avRequestDraft = null;                  // { toolId, siteId, key } - one idempotency key per opened sheet

// Individual tool: its own site. Grouped tool: the in-use bucket at `siteId`, with a quantity stepper.
function openRequestAvailability(toolId, siteId) {
    const tool = getToolById(toolId);
    if (!tool) return;
    const grouped = isGroupedTool(tool);
    const where = grouped ? siteId : tool.siteId;
    const bucket = grouped ? getToolAllocations(tool.id).find(a => a.siteId === where && a.status === ToolStatus.IN_USE) : null;
    if (grouped && !bucket) return;
    triggerHaptic('light');
    avRequestDraft = { toolId, siteId: grouped ? where : undefined, key: avNewKey(), grouped };
    const label = 'sheet-label';                          // the shared sheet field (styles/sheet.css)
    const field = 'sheet-input';
    const siteName = getSiteName(where, 'No site');
    openModal('Request Availability', `
        <form id="av-request-form" class="space-y-4 pt-1" onsubmit="event.preventDefault(); submitAvailabilityRequest();" novalidate>
            <div class="av-tool">
                <span class="av-thumb" aria-hidden="true"><i class="${getToolCategoryIcon(tool.category)}"></i></span>
                <span class="av-tool-text">
                    <strong class="av-tool-name">${avEsc(tool.name)}</strong>
                    <span class="av-tool-meta">${grouped ? `${avEsc(siteName)} · ${bucket.quantity} In Use` : `Asset ID: ${avEsc(AvailabilityRules.assetTag(tool.id))} · ${avEsc(siteName)}`}</span>
                </span>
            </div>
            <p class="av-sheet-hint">Asks the ${avEsc(getSiteName(where, 'site'))} crew in their group chat whether ${grouped ? "they're" : "it's"} free.</p>
            ${grouped ? `<div class="qty-field">
                <span id="av-qty-label" class="${label}">How many?</span>
                ${renderQtyStepper('av-request-qty', bucket.quantity, 'How many to ask about')}
            </div>` : ''}
            <div>
                <label for="av-request-note" class="${label}">What do you need it for? <span class="av-optional">Optional</span></label>
                <input id="av-request-note" type="text" maxlength="${AvailabilityRules.NOTE_MAX}" autocomplete="off" enterkeyhint="send"
                       placeholder="e.g. Needed for Level 2 framing" class="${field}">
            </div>
            <div class="av-sheet-actions">
                <button type="button" class="btn btn--secondary btn--block" onclick="closeModal()">Cancel</button>
                <button type="submit" id="av-request-submit" class="sheet-btn is-tone-blue">
                    <i class="ph-bold ph-paper-plane-tilt" aria-hidden="true"></i><span>Send Request</span>
                </button>
            </div>
        </form>`);
}

async function submitAvailabilityRequest() {
    if (!avRequestDraft) return;
    const draft = avRequestDraft;
    const btn = document.getElementById('av-request-submit');
    const label = btn && btn.querySelector('span');
    if (label) label.textContent = 'Sending…';
    const result = await runUiAction(() => availabilityService.request({
        toolId: draft.toolId,
        ...(draft.grouped ? { siteId: draft.siteId, quantity: readQty('av-request-qty') } : {}),
        note: (document.getElementById('av-request-note') || {}).value,
        idempotencyKey: draft.key                         // a double tap or a retry returns the same request
    }), { button: btn, errorTitle: 'Request not sent' });
    if (label) label.textContent = 'Send Request';
    if (!result.ok) return;
    triggerHaptic('success');
    avRequestDraft = null;
    closeModal();
    requestAnimationFrame(() => {
        const card = document.querySelector(`[data-tool-id="${draft.toolId}"]`);
        if (!card) return;
        card.classList.add('is-just-added');
        setTimeout(() => card.classList.remove('is-just-added'), 1600);
    });
}

// ---------------- Chat: the AvailabilityRequestCard ----------------
function renderAvailabilityRequestCard(message) {
    const r = avView(message.requestId);
    if (!r) return `<div class="avail-card is-expired"><p class="avail-card-line">This request is no longer available.</p></div>`;
    const tool = getToolById(r.toolId);
    const status = r.liveStatus, tone = AV_TONE[status] || 'pending';
    const role = avViewerRole(r);
    const toolName = tool ? tool.name : 'Equipment';
    const meId = getCurrentEmployeeId();
    const byName = (id, name) => (id === meId ? 'you' : avEsc(name));

    let state = '';
    if (status === AvailabilityStatus.PENDING) {
        state = role === 'requester'
            ? `<p class="avail-card-wait"><span class="avail-pulse" aria-hidden="true"></span>Waiting for the site · expires ${formatClockTime(r.expiresAt)}</p>`
            : '';
    } else if (status === AvailabilityStatus.AVAILABLE) {
        state = `<p class="avail-card-line">Responded by <b>${byName(r.responderId, r.responderName)}</b> · ${formatClockTime(r.respondedAt)}</p>`;
    } else if (status === AvailabilityStatus.IN_USE) {
        state = `<p class="avail-card-line">Responded by <b>${byName(r.responderId, r.responderName)}</b></p>
            <div class="avail-card-eta"><span>Estimated availability</span><strong>${formatClockTime(r.estimatedAvailableAt)}</strong></div>`;
    } else if (status === AvailabilityStatus.MISSING) {
        state = `<p class="avail-card-line">Reported by <b>${byName(r.responderId, r.responderName)}</b> · ${formatClockTime(r.respondedAt)}</p>
            <p class="avail-card-line is-warn"><i class="ph-fill ph-bell-ringing" aria-hidden="true"></i>Site supervisor notified</p>`;
    } else if (status === AvailabilityStatus.EXPIRED) {
        state = `<p class="avail-card-line is-muted">No one answered within 30 minutes. It can be requested again from Tools.</p>`;
    }

    const id = avEsc(r.id), busy = r.optimistic ? ' aria-busy="true" disabled' : '';
    let actions = '';
    if (status === AvailabilityStatus.PENDING && role === 'member') {
        actions = `<div class="avail-card-actions">
                <button type="button" class="avail-btn is-available"${busy} onclick="respondAvailability('${id}', 'available')"><i class="ph-bold ph-check" aria-hidden="true"></i>Available Now</button>
                <button type="button" class="avail-btn is-in-use"${busy} onclick="openAvailabilityEta('${id}', 'in_use')"><i class="ph-bold ph-clock" aria-hidden="true"></i>In Use — Set ETA</button>
                <button type="button" class="avail-btn is-missing"${busy} onclick="respondAvailability('${id}', 'missing')"><i class="ph-bold ph-warning" aria-hidden="true"></i>Missing / Not Here</button>
            </div>`;
    } else if (status === AvailabilityStatus.IN_USE && (role === 'holder' || (role === 'member' && Permissions.can(getCurrentEmployee(), 'availability.override')))) {
        actions = `<div class="avail-card-actions is-row">
                <button type="button" class="avail-btn is-in-use"${busy} onclick="openAvailabilityEta('${id}', 'eta_updated')"><i class="ph-bold ph-clock-clockwise" aria-hidden="true"></i>Update ETA</button>
                <button type="button" class="avail-btn is-available"${busy} onclick="respondAvailability('${id}', 'available')"><i class="ph-bold ph-check" aria-hidden="true"></i>Available Now</button>
            </div>`;
    }
    const err = avErrors.get(r.id);
    return `
        <article class="avail-card is-${tone}" aria-label="Availability request: ${avEsc(toolName)}, ${avEsc(AV_BADGE[status] || status)}">
            <header class="avail-card-head">
                <span class="avail-card-kicker">Availability Request</span>
                <span class="avail-badge is-${tone}">${avEsc(AV_BADGE[status] || status)}</span>
            </header>
            <div class="avail-card-tool">
                <span class="av-thumb" aria-hidden="true"><i class="${tool ? getToolCategoryIcon(tool.category) : 'ph-fill ph-wrench'}"></i></span>
                <span class="av-tool-text">
                    <strong class="av-tool-name">${avEsc(toolName)}</strong>
                    <span class="av-tool-meta">${r.quantity > 1 ? `${r.quantity} units` : avEsc(AvailabilityRules.assetTag(r.toolId))} • ${avEsc(getSiteName(r.siteId, r.siteId))}</span>
                </span>
            </div>
            ${r.requesterNote ? `<p class="avail-card-note">${avEsc(r.requesterNote)}</p>` : ''}
            <div class="avail-card-meta">
                <p class="avail-card-line">Requested by <b>${byName(r.requesterId, r.requesterName)}</b></p>
                <p class="avail-card-line is-muted">${avEsc(avWhen(r.createdAt))}</p>
            </div>
            ${state ? `<div class="avail-card-state">${state}</div>` : ''}
            ${actions}
            ${err ? `<p class="avail-card-error" role="alert">${avEsc(err)}</p>` : ''}
        </article>`;
}

// Redraw just the cards that show `requestId` (the thread keeps its scroll)
function refreshAvailabilityCards(requestId) {
    document.querySelectorAll(`[data-request-id="${requestId}"]`).forEach(row => {
        const msg = getChatMessageById(row.dataset.messageId);
        if (msg) row.querySelector('.conv-card-slot').innerHTML = renderAvailabilityRequestCard(msg);
    });
}

// An answer: shown at once, sent, then the server's version replaces it (or it rolls back with the reason)
async function respondAvailability(requestId, response, eta) {
    const me = getCurrentEmployee();
    const r = getAvailabilityRequest(requestId);
    if (!r || !me || avOptimistic.has(requestId)) return;
    triggerHaptic(response === 'missing' ? 'warning' : 'medium');
    const isEta = response === 'eta_updated';
    avErrors.delete(requestId);
    avOptimistic.set(requestId, {
        status: isEta ? AvailabilityStatus.IN_USE : response, responderId: me.id, responderName: me.name,
        respondedAt: new Date().toISOString(), holderId: response === 'in_use' || isEta ? me.id : null,
        estimatedAvailableAt: eta && eta.previewAt ? eta.previewAt : r.estimatedAvailableAt
    });
    refreshAvailabilityCards(requestId);
    try {
        if (isEta) await availabilityService.updateEta({ requestId, eta });
        else await availabilityService.respond({ requestId, response, eta });
        triggerHaptic('success');
        return { ok: true };
    } catch (raw) {
        const error = toAppError(raw);
        if (error.code === ErrorCode.UNKNOWN || error.code === ErrorCode.NETWORK) console.error(error.message, error.cause || '');
        avErrors.set(requestId, error.userMessage);
        triggerHaptic('error');
        return { ok: false, error };
    } finally {
        avOptimistic.delete(requestId);
        refreshAvailabilityCards(requestId);
    }
}

// ---------------- Chat: the ETA picker ----------------
let avEtaDraft = null;                     // { requestId, mode: 'in_use' | 'eta_updated', preset }
const AV_ETA_CHOICES = [
    { preset: '30m', label: '30 mins' }, { preset: '1h', label: '1 hr' }, { preset: '2h', label: '2 hrs' },
    { preset: 'end_of_shift', label: 'End of Shift' }, { preset: 'custom', label: 'Custom Time' }
];
const avShiftEnd = () => (typeof TIMESHEET_CONFIG !== 'undefined' && TIMESHEET_CONFIG.defaultFinish) || '15:30';

function openAvailabilityEta(requestId, mode) {
    const r = getAvailabilityRequest(requestId);
    if (!r) return;
    triggerHaptic('light');
    const tool = getToolById(r.toolId);
    const shiftOver = !!AvailabilityRules.estimateFrom({ preset: 'end_of_shift' }, new Date(), avShiftEnd()).error;
    avEtaDraft = { requestId, mode, preset: '1h' };
    const endLabel = formatClockTime(`2000-01-01T${avShiftEnd()}:00`);
    openModal(mode === 'eta_updated' ? 'Update ETA' : 'In Use — Set ETA', `
        <form id="av-eta-form" class="space-y-4 pt-1" onsubmit="event.preventDefault(); submitAvailabilityEta();" novalidate>
            <p class="av-sheet-hint">When will <b>${avEsc(tool ? tool.name : 'it')}</b> be free?</p>
            <div class="av-eta-grid" role="radiogroup" aria-label="Expected availability">
                ${AV_ETA_CHOICES.map(c => {
                    const off = c.preset === 'end_of_shift' && shiftOver;
                    return `<button type="button" role="radio" data-preset="${c.preset}" aria-checked="${c.preset === avEtaDraft.preset}"
                        class="av-eta-choice${c.preset === avEtaDraft.preset ? ' is-active' : ''}${c.preset === 'custom' ? ' is-wide' : ''}"
                        ${off ? 'disabled' : ''} onclick="pickAvailabilityEta('${c.preset}')">
                        <span>${c.label}</span>${c.preset === 'end_of_shift' ? `<small>${off ? 'Finished' : endLabel}</small>` : ''}
                    </button>`;
                }).join('')}
            </div>
            <div id="av-eta-custom" class="av-eta-custom" hidden>
                <label for="av-eta-time" class="sheet-label">Time today</label>
                <input id="av-eta-time" type="time" step="300" oninput="syncAvailabilityEtaPreview()"
                       class="sheet-input">
            </div>
            <p id="av-eta-preview" class="av-eta-preview" aria-live="polite"></p>
            <button type="submit" id="av-eta-submit" class="btn btn--primary btn--block">
                <i class="ph-bold ph-check" aria-hidden="true"></i><span>${mode === 'eta_updated' ? 'Update ETA' : 'Confirm ETA'}</span>
            </button>
        </form>`);
    syncAvailabilityEtaPreview();
}
function pickAvailabilityEta(preset) {
    if (!avEtaDraft) return;
    triggerHaptic('light');
    avEtaDraft.preset = preset;
    document.querySelectorAll('#av-eta-form .av-eta-choice').forEach(b => {
        const on = b.dataset.preset === preset;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
    });
    const custom = document.getElementById('av-eta-custom');
    if (custom) {
        custom.hidden = preset !== 'custom';
        const input = document.getElementById('av-eta-time');
        if (preset === 'custom' && input) {
            if (!input.value) {
                const d = new Date(Date.now() + 60 * 60 * 1000);
                input.value = `${String(d.getHours()).padStart(2, '0')}:${String(Math.ceil(d.getMinutes() / 5) * 5 % 60).padStart(2, '0')}`;
            }
            input.focus();
        }
    }
    syncAvailabilityEtaPreview();
}
function avEtaInput() {
    if (!avEtaDraft) return null;
    const time = (document.getElementById('av-eta-time') || {}).value;
    return { preset: avEtaDraft.preset, ...(avEtaDraft.preset === 'custom' ? { time } : {}) };
}
// A preview only: the server works out the real time when it saves
function syncAvailabilityEtaPreview() {
    const el = document.getElementById('av-eta-preview');
    const eta = avEtaInput();
    if (!el || !eta) return;
    const e = AvailabilityRules.estimateFrom(eta, new Date(), avShiftEnd());
    el.classList.toggle('is-error', !!e.error);
    el.textContent = e.error ? e.error + '.' : `Available at ${formatClockTime(e.at)}`;
}
async function submitAvailabilityEta() {
    const draft = avEtaDraft, eta = avEtaInput();
    if (!draft || !eta) return;
    const btn = document.getElementById('av-eta-submit');
    const preview = AvailabilityRules.estimateFrom(eta, new Date(), avShiftEnd());
    if (preview.error) { syncAvailabilityEtaPreview(); triggerHaptic('error'); return; }
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    avEtaDraft = null;
    closeModal();
    await respondAvailability(draft.requestId, draft.mode, { ...eta, previewAt: preview.at });
}

// ---------------- Deep link: open the chat at the request's card ----------------
function openAvailabilityRequest(requestId) {
    const r = getAvailabilityRequest(requestId);
    if (!r) return;
    const chat = LIFESTYLE_CHATS.find(c => c.id === r.chatId);
    if (!chat) return;
    triggerHaptic('light');
    if (currentActiveViewName === 'conversation' && currentLifestyleConversationId === r.chatId) renderLifestyleConversation();
    else openLifestyleConversation(r.chatId);
    // The thread may still be sliding in: wait until the card is laid out, then bring it to the middle
    let tries = 0;
    const reveal = () => {
        const row = document.querySelector(`#conv-messages [data-message-id="${r.messageId}"]`);
        if (!row || !row.offsetParent) { if (tries++ < 30) requestAnimationFrame(reveal); return; }
        // Scroll the thread itself (not the page around it) so the card sits in the middle
        const view = document.getElementById('view-conversation');
        const top = view.scrollTop + row.getBoundingClientRect().top - view.getBoundingClientRect().top;
        view.scrollTo({ top: Math.max(0, top - (view.clientHeight - row.offsetHeight) / 2), behavior: tries > 2 ? 'smooth' : 'auto' });
        row.classList.remove('is-highlight');
        void row.offsetWidth;
        row.classList.add('is-highlight');
        setTimeout(() => row.classList.remove('is-highlight'), 2200);
    };
    requestAnimationFrame(reveal);
}

// ---------------- Incoming notifications: the banner ----------------
const AV_NOTICE_LOOK = {
    availability_request: { tone: 'blue', icon: 'ph-fill ph-bell-ringing' },
    availability_available: { tone: 'emerald', icon: 'ph-fill ph-check-circle' },
    availability_in_use: { tone: 'blue', icon: 'ph-fill ph-clock' },
    availability_eta_updated: { tone: 'blue', icon: 'ph-fill ph-clock-clockwise' },
    availability_missing: { tone: 'amber', icon: 'ph-fill ph-warning' },
    availability_missing_alert: { tone: 'amber', icon: 'ph-fill ph-warning' }
};
// Only notifications that arrive while the app is open get a banner (each once)
const AV_OPENED_AT = new Date().toISOString();
const avSeenNotices = new Set();
let avBannerNotice = null, avBannerTimer = null;

function syncAvailabilityNotices() {
    if (appStore.status !== 'ready') return;
    const mine = getMyNotifications();
    const fresh = mine.filter(n => !avSeenNotices.has(n.id) && !n.readAt && n.createdAt >= AV_OPENED_AT);
    mine.forEach(n => avSeenNotices.add(n.id));
    if (fresh.length) showAvailabilityBanner(fresh[0]);
    if (typeof updateNotificationBadges === 'function') updateNotificationBadges();
    if (typeof renderNotificationsFeed === 'function' && currentActiveViewName === 'notifications') renderNotificationsFeed(currentActiveNotifFilter);
}
function showAvailabilityBanner(n) {
    const banner = document.getElementById('avail-banner');
    if (!banner) return;
    const look = AV_NOTICE_LOOK[n.type] || AV_NOTICE_LOOK.availability_request;
    avBannerNotice = n;
    banner.dataset.tone = look.tone;
    document.getElementById('avail-banner-icon').innerHTML = `<i class="${look.icon}"></i>`;
    document.getElementById('avail-banner-title').textContent = n.title;
    document.getElementById('avail-banner-message').textContent = n.body;
    triggerHaptic(look.tone === 'amber' ? 'warning' : 'light');
    banner.hidden = false;
    banner.classList.remove('is-leaving');
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('is-visible')));
    clearTimeout(avBannerTimer);
    avBannerTimer = setTimeout(dismissAvailabilityBanner, 7000);
}
function dismissAvailabilityBanner() {
    const banner = document.getElementById('avail-banner');
    if (!banner || banner.hidden) return;
    clearTimeout(avBannerTimer);
    banner.classList.add('is-leaving');
    banner.classList.remove('is-visible');
    setTimeout(() => { if (!banner.classList.contains('is-visible')) { banner.hidden = true; banner.classList.remove('is-leaving'); } }, 260);
}
function openAvailabilityFromBanner() {
    const n = avBannerNotice;
    dismissAvailabilityBanner();
    if (!n) return;
    openAvailabilityNotification(n.id);
}
// A notification opened (banner or feed): mark it read, then go to its card
function openAvailabilityNotification(id) {
    const n = getMyNotifications().find(x => x.id === id);
    if (!n) return;
    if (!n.readAt) availabilityService.markNotificationRead(id).catch(err => console.warn('Mark read failed:', err));
    if (currentActiveViewName === 'notifications' && typeof closeNotificationsView === 'function') {
        const btn = document.getElementById('btn-notifications');
        if (btn) btn.classList.remove('border-brand-lime', 'shadow-[0_0_12px_rgba(34,229,98,0.3)]');
    }
    if (n.requestId) openAvailabilityRequest(n.requestId);
}

// ---------------- Live updates ----------------
// Any change to a request, a chat card or the tools: redraw what is on screen
subscribeAvailability(() => {
    if (currentActiveViewName === 'conversation' && typeof renderLifestyleConversation === 'function') renderLifestyleConversation();
    if (typeof renderLifestyleChats === 'function') renderLifestyleChats(currentLifestyleChatFilter, currentLifestyleChatSearchQuery);
});
subscribeNotifications(syncAvailabilityNotices);
appStore.subscribe(syncAvailabilityNotices, ['$status']);

// Requests nobody answered become expired (every 15s while open; harmless when several tabs do it)
setInterval(() => {
    if (appStore.status !== 'ready' || document.hidden) return;
    availabilityService.sweepExpired().catch(err => console.warn('Expiry sweep failed:', toAppError(err).message));
}, 15000);
