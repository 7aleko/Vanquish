/**
 * Home hero card: site sign in / sign out attendance state.
 */

// Site Sign In / Sign Out. The record is an Attendance entry (attendanceService, one per person per day);
// isSiteSignedIn mirrors the signed-in worker's record for the Home card's day, so the card, the
// notification action and the Crew Status sheet all read the same state.
let isSiteSignedIn = false;
let siteSignInPending = false;

function homeAttendanceDay() { return (typeof APP_TODAY !== 'undefined') ? APP_TODAY : new Date(); }

// Mirror the stored record (on load and after any attendance change); redraws the card only on a change
function syncSiteSignInFromStore() {
    if (siteSignInPending || typeof getMyAttendance !== 'function') return;
    const rec = getMyAttendance(homeAttendanceDay());
    const signedIn = !!(rec && !rec.signedOutAt);
    if (signedIn === isSiteSignedIn) return;
    isSiteSignedIn = signedIn;
    updateSiteAttendanceUI();
}

// The card answers at once (optimistic); the record is saved behind it, and a failure puts the card back
async function toggleSiteSignIn(e) {
    if (e) e.stopPropagation();
    if (siteSignInPending) return;
    const day = homeAttendanceDay(), date = DateRules.toIso(day), siteId = getRosteredSiteId(day);
    const signingIn = !isSiteSignedIn;
    const siteName = getSiteName(siteId, 'site');
    isSiteSignedIn = signingIn;
    updateSiteAttendanceUI();
    triggerGlowSurge(signingIn);
    triggerHaptic(signingIn ? 'success' : 'medium');
    siteSignInPending = true;
    try {
        const rec = signingIn ? await attendanceService.signIn({ siteId, date }) : await attendanceService.signOut({ date });
        showToast(
            signingIn ? 'Site Check-In' : 'Site Check-Out',
            signingIn ? `Signed into ${siteName} at ${formatClockTime(rec.signedInAt)} • Have a safe shift!` : `Signed out of ${siteName} at ${formatClockTime(rec.signedOutAt)}`
        );
    } catch (err) {
        isSiteSignedIn = !signingIn;
        updateSiteAttendanceUI();
        triggerGlowSurge(isSiteSignedIn);
        showToast(signingIn ? "Couldn't sign in" : "Couldn't sign out", (err && err.userMessage) || 'Check your connection and try again.');
    } finally {
        siteSignInPending = false;
        syncSiteSignInFromStore();
    }
}

function triggerGlowSurge(isOpening) {
    const ambientProgress = document.querySelector('.hero-ambient-progress');
    const shiftTrack = document.getElementById('site-shift-track');

    if (isOpening) {
        // Light up surge when signing in, then settle smoothly
        if (ambientProgress) {
            ambientProgress.style.transition = 'opacity 0.3s ease-out, filter 0.3s ease-out';
            ambientProgress.style.opacity = '1';
            ambientProgress.style.filter = 'brightness(1.5) saturate(1.3)';
        }
        if (shiftTrack) {
            shiftTrack.style.transition = 'filter 0.3s ease-out'; // width eases in site-card-energy.js
            shiftTrack.style.filter = 'brightness(1.4) drop-shadow(0 0 10px rgba(34,229,98,0.8))';
        }
        setTimeout(() => {
            if (ambientProgress) {
                ambientProgress.style.transition = 'filter 0.6s ease-out';
                ambientProgress.style.filter = 'none';
            }
            if (shiftTrack) {
                shiftTrack.style.filter = 'none';
            }
        }, 450);
    } else {
        // Return to resting standby
        if (ambientProgress) {
            ambientProgress.style.transition = 'opacity 0.4s ease-out, filter 0.4s ease-out';
            ambientProgress.style.opacity = '0.15';
            ambientProgress.style.filter = 'grayscale(60%)';
        }
        if (shiftTrack) {
            shiftTrack.style.filter = 'none';
        }
    }
}

/**
 * True once a signed-in shift reaches its scheduled end (SITE_SHIFT_END, local time, from
 * scripts/features/site-card-energy.js). Only the status label changes: the employee stays signed in
 * until they tap Sign Out themselves.
 */
function isSiteShiftCompleted() {
    if (!isSiteSignedIn || typeof SITE_SHIFT_END === 'undefined') return false;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() >= SITE_SHIFT_END;
}

// Status label above the site name: "Signed In" -> "Shift Completed" at the end of the shift.
// Called by updateSiteAttendanceUI() and by the card's clock tick (site-card-energy.js), which only
// rewrites the label when the state actually changes.
function renderSiteSignedInStatus() {
    const kicker = document.getElementById('site-status-kicker');
    const btn = document.getElementById('site-signin-btn');
    if (!kicker || !btn || !isSiteSignedIn) return;

    const completed = isSiteShiftCompleted();
    const state = completed ? 'completed' : 'signed-in';
    if (kicker.dataset.state === state) return;
    kicker.dataset.state = state;

    const label = completed ? 'Shift Completed' : 'Signed In';
    kicker.className = "min-w-0 flex items-center gap-2 text-xs font-black tracking-wide text-brand-emerald uppercase whitespace-nowrap";
    kicker.innerHTML = `<span class="relative flex h-2 w-2"><span class="relative inline-flex rounded-full h-2 w-2 bg-brand-emerald shadow-[0_0_6px_rgba(34,229,98,0.8)]"></span></span><span>${label}</span>`;
    btn.setAttribute('aria-label', `Site attendance: ${label}. Tap to Sign Out.`);
}

function updateSiteAttendanceUI() {
    const kicker = document.getElementById('site-status-kicker');
    const btn = document.getElementById('site-signin-btn');
    const ambientProgress = document.querySelector('.hero-ambient-progress');
    const glowBeam = document.getElementById('site-card-glow-beam');

    if (!btn || !kicker) return;

    if (isSiteSignedIn) {
        // Bolder text above the site name: "Signed In", or "Shift Completed" once the shift has ended
        delete kicker.dataset.state;
        renderSiteSignedInStatus();

        // Apple Control Centre transition: activate signed-in state
        btn.classList.add('is-signed-in');
        btn.title = "Tap to Sign Out";

        // Track fill width / opacity follow the real shift clock (scripts/features/site-card-energy.js)

        // Smooth Apple-esque ease-out opacity transition when signed in
        if (glowBeam) {
            glowBeam.classList.add('is-signed-in-hidden');
        }
    } else {
        // Bolder text above the site name: "Not Signed In"
        kicker.dataset.state = 'signed-out';
        kicker.className = "min-w-0 flex items-center gap-2 text-xs font-black tracking-wide text-amber-400 uppercase whitespace-nowrap";
        kicker.innerHTML = `
                    <span class="relative flex h-2 w-2">
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                    </span>
                    <span>Not Signed In</span>
                `;

        // Apple Control Centre transition: return to resting / sign-in state
        btn.classList.remove('is-signed-in');
        btn.title = "Tap to Sign In";
        btn.setAttribute('aria-label', "Site attendance: Not Signed In. Tap to Sign In.");

        if (ambientProgress) {
            ambientProgress.style.opacity = "0.15";
            ambientProgress.style.filter = "grayscale(60%)";
        }

        // Smooth Apple-esque ease-in opacity transition when not signed in
        if (glowBeam) {
            glowBeam.classList.remove('is-signed-in-hidden');
        }
    }

    if (typeof kickSiteCardEnergy === 'function') kickSiteCardEnergy();

    if (typeof renderNotificationsFeed === 'function') {
        renderNotificationsFeed(currentActiveNotifFilter);
    }
}

if (typeof subscribeAttendance === 'function') {
    subscribeAttendance(syncSiteSignInFromStore);
    appStore.ready.then(syncSiteSignInFromStore).catch(() => {});
}
