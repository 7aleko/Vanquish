/**
 * Snack bar (styles/snack.css): one quiet confirmation at the bottom of the app - "Copied", "Booking deleted
 * · Undo". It sits above every screen and sheet, so a sheet's action can confirm itself without closing.
 *
 *   showSnack(message)                    a confirmation that clears itself after ~2.6s
 *   showSnack(message, 'Undo', fn)        with one action (5s); the action runs once and clears the bar
 *   hideSnack()
 *
 * (Toasts are switched off app-wide - utils/feedback.js; this is the one transient message the app shows.)
 */
let appSnackTimer = null;
function showSnack(message, actionLabel, action, opts = {}) {
    const el = document.getElementById('app-snack');
    if (!el) return;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    el.innerHTML = `${opts.icon ? `<i class="ph-fill ${esc(opts.icon)}" aria-hidden="true"></i>` : ''}<span>${esc(message)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ''}`;
    el.classList.toggle('has-action', !!actionLabel);
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-shown'));
    if (actionLabel) el.querySelector('button').onclick = () => { hideSnack(); action(); };
    clearTimeout(appSnackTimer);
    appSnackTimer = setTimeout(hideSnack, actionLabel ? 5000 : 2600);
}
function hideSnack() {
    const el = document.getElementById('app-snack');
    if (!el) return;
    el.classList.remove('is-shown');
    setTimeout(() => { if (!el.classList.contains('is-shown')) el.hidden = true; }, 260);
}
