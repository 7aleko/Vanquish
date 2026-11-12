/**
 * Clipboard helper.
 */

function copyToClipboard(text, message = 'Copied to clipboard') {
    triggerHaptic('light');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied', message);
        }).catch(() => {
            showToast('Copied', message);
        });
    } else {
        showToast('Copied', message);
    }
}
