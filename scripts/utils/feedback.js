/**
 * User feedback helpers: haptics, (disabled) toasts, confetti and refresh-button spin.
 */

// Apple Haptic Feedback Simulation (Web Haptics API)
function triggerHaptic(type = 'light') {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'light') navigator.vibrate(10);
        else if (type === 'medium') navigator.vibrate(18);
        else if (type === 'success') navigator.vibrate([10, 40, 10]);
        else if (type === 'heavy') navigator.vibrate(28);
    }
}

// Toast notifications permanently disabled per user request
function showToast() {}
function dismissToast() {}

// canvas-confetti burst (library loaded from CDN in index.html)
function triggerConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}

function triggerAppleRefresh(buttonElement, title, toastMsg) {
    // Locate the inner <i> icon or rotate the button directly
    const icon = buttonElement.querySelector('i') || buttonElement;

    // Prevent double-clicking during animation
    if (icon.classList.contains('apple-spin')) return;

    // Trigger toast notification
    showToast(title, toastMsg);

    // Apply rotation class
    icon.classList.add('apple-spin');

    // Remove class after animation completes so it can be clicked again
    setTimeout(() => {
        icon.classList.remove('apple-spin');
    }, 600);
}
