/**
 * Home hero card: site sign in / sign out attendance state.
 */

// Site Sign In / Sign Out Attendance State Management
let isSiteSignedIn = false;

function toggleSiteSignIn(e) {
    if (e) e.stopPropagation();
    isSiteSignedIn = !isSiteSignedIn;
    updateSiteAttendanceUI();
    triggerGlowSurge(isSiteSignedIn);
    triggerHaptic(isSiteSignedIn ? 'success' : 'medium');
    showToast(
        isSiteSignedIn ? 'Site Check-In' : 'Site Check-Out',
        isSiteSignedIn ? 'Signed into Lugarno Site at 7:02 AM • Have a safe shift!' : 'Signed out of Lugarno Site successfully'
    );
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
            shiftTrack.style.filter = 'brightness(1.4) drop-shadow(0 0 10px rgba(204,255,0,0.8))';
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

function updateSiteAttendanceUI() {
    const kicker = document.getElementById('site-status-kicker');
    const btn = document.getElementById('site-signin-btn');
    const ambientProgress = document.querySelector('.hero-ambient-progress');
    const glowBeam = document.getElementById('site-card-glow-beam');

    if (!btn || !kicker) return;

    if (isSiteSignedIn) {
        // Bolder text above Lugarno: "Signed In"
        kicker.className = "min-w-0 flex items-center gap-2 text-xs font-black tracking-wide text-brand-lime uppercase whitespace-nowrap";
        kicker.innerHTML = `<span class="relative flex h-2 w-2"><span class="relative inline-flex rounded-full h-2 w-2 bg-brand-lime shadow-[0_0_6px_rgba(204,255,0,0.8)]"></span></span><span>Signed In</span>`;

        // Apple Control Centre transition: activate signed-in state
        btn.classList.add('is-signed-in');
        btn.title = "Tap to Sign Out";
        btn.setAttribute('aria-label', "Site attendance: Signed In. Tap to Sign Out.");

        // Track fill width / opacity follow the real shift clock (scripts/features/site-card-energy.js)

        // Smooth Apple-esque ease-out opacity transition when signed in
        if (glowBeam) {
            glowBeam.classList.add('is-signed-in-hidden');
        }
    } else {
        // Bolder text above Lugarno: "Not Signed In"
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
