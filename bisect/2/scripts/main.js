/**
 * Final boot step. Must be the last script on the page.
 */

// Initial sync of notification counter badge
updateNotificationBadges();

// Final EOF execution guard to ensure preloader is dismissed
try {
    dismissPreloaderWhenReady();
} catch (_) {
    forceDismissPreloader();
}
