/**
 * Presentation helper: run a service call from a button or gesture with consistent pending, success and
 * error handling. The button is disabled and marked busy while the call runs; success is only shown after
 * the service resolved; a failure shows the error's userMessage (never the technical message) in a line
 * right under the button (toasts are switched off in this app), and technical failures are logged.
 *
 *   await runUiAction(() => timesheetService.submit(input), {
 *       button: el, errorTitle: 'Timesheet not saved',
 *       onSuccess: saved => ..., onError: err => ... (return true when it showed the error itself)
 *   });
 * Resolves to { ok: true, value } or { ok: false, error }.
 */

// The error line under a button (created on first use, cleared on the next attempt)
function setUiActionError(button, title, message) {
    if (!button || !button.parentNode) return;
    let line = button.nextElementSibling && button.nextElementSibling.classList.contains('ui-action-error') ? button.nextElementSibling : null;
    if (!message) { if (line) line.hidden = true; return; }
    if (!line) {
        line = document.createElement('p');
        line.className = 'ui-action-error';
        line.setAttribute('role', 'alert');
        button.insertAdjacentElement('afterend', line);
    }
    line.textContent = title ? `${title}. ${message}` : message;
    line.hidden = false;
}

async function runUiAction(work, opts = {}) {
    const btn = opts.button || null;
    if (btn) {
        if (btn.getAttribute('aria-busy') === 'true') return { ok: false, error: null };   // already running
        btn.setAttribute('aria-busy', 'true');
        btn.disabled = true;
        setUiActionError(btn, '', '');
    }
    try {
        const value = await work();
        if (opts.onSuccess) opts.onSuccess(value);
        return { ok: true, value };
    } catch (raw) {
        const error = toAppError(raw);
        if (error.code === ErrorCode.UNKNOWN || error.code === ErrorCode.NETWORK) console.error(error.message, error.cause || '');
        const handled = opts.onError ? opts.onError(error) === true : false;
        if (!handled) {
            if (btn) setUiActionError(btn, opts.errorTitle || 'Not saved', error.userMessage);
            if (typeof showToast === 'function') showToast(opts.errorTitle || 'Not saved', error.userMessage);
        }
        if (typeof triggerHaptic === 'function') triggerHaptic('error');
        return { ok: false, error };
    } finally {
        if (btn) {
            btn.removeAttribute('aria-busy');
            btn.disabled = opts.keepDisabled ? opts.keepDisabled() : false;
        }
    }
}
