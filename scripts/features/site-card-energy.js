/**
 * Home site card: live "energy" surface driven by the real clock.
 *
 * Sets two CSS custom properties on #site-hero-card (styles/site-card.css reads them):
 *   --p   0..1  progress through today's shift (SITE_SHIFT_START -> SITE_SHIFT_END, local time)
 *   --on  0..1  signed-in amount, eased from isSiteSignedIn (scripts/features/attendance.js)
 * and renders a WebGL shader behind the card's frosted glass: a faint ember while signed out,
 * a lime/mint energy edge that tracks the shift once signed in.
 *
 * Cost control (keeps the GPU light enough for iOS Safari to open a blurred sheet on top):
 *   - renders at a fixed 0.3x of the card's CSS size, whatever the devicePixelRatio (~7k pixels);
 *     the browser's upscale is the soft blur, so the frost needs no backdrop-filter
 *   - low-power context, no antialias / alpha / depth / stencil buffers
 *   - 3-octave noise and an early-out ahead of the energy edge (most of the card early in the shift)
 *   - the plasma only drifts while signed in; otherwise it draws while values ease, then sleeps
 *   - 120Hz screens draw every 2nd refresh (an even 60fps)
 *   - pauses off-screen, in a hidden tab, or under a sheet (setSiteCardEnergyPaused)
 * With reduced motion the plasma holds still. Without WebGL the card keeps its track, dot and times.
 */

const SITE_SHIFT_START = 7 * 60;        // 7:00 AM, minutes since midnight
const SITE_SHIFT_END = 15 * 60 + 30;    // 3:30 PM

(function initSiteCardEnergy() {
    const card = document.getElementById('site-hero-card');
    const canvas = card && card.querySelector('.sc-energy-canvas');
    if (!card || !canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const RENDER_SCALE = 0.3;          // CSS px -> shader px; upscaling = free soft blur

    const signedIn = () => (typeof isSiteSignedIn !== 'undefined' && isSiteSignedIn) ? 1 : 0;
    const realProgress = () => {
        const d = new Date();
        const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
        return Math.max(0, Math.min(1, (mins - SITE_SHIFT_START) / (SITE_SHIFT_END - SITE_SHIFT_START)));
    };

    let shownP = realProgress();
    let shownOn = signedIn();

    // Ease the shown values toward the real ones (time-based, so it feels the same at any frame rate).
    // Returns true while still moving.
    function updateState(dt) {
        const targetP = realProgress();
        const targetOn = signedIn();
        shownP += (targetP - shownP) * (1 - Math.exp(-dt * 4.8));
        shownOn += (targetOn - shownOn) * (1 - Math.exp(-dt * 3));
        if (Math.abs(targetP - shownP) < 0.0005) shownP = targetP;
        if (Math.abs(targetOn - shownOn) < 0.001) shownOn = targetOn;

        card.style.setProperty('--p', shownP.toFixed(4));
        card.style.setProperty('--on', shownOn.toFixed(4));
        // "Signed In" -> "Shift Completed" once the clock passes the shift end (no-op unless it changes)
        if (typeof renderSiteSignedInStatus === 'function') renderSiteSignedInStatus();
        return shownP !== targetP || shownOn !== targetOn;
    }

    // ---------------- Shader ----------------
    const gl = canvas.getContext('webgl', {
        antialias: false, alpha: false, depth: false, stencil: false,
        preserveDrawingBuffer: false, powerPreference: 'low-power'
    });
    let draw = null;

    if (gl) {
        const vert = `attribute vec2 a; varying vec2 vUv;
            void main(){ vUv = a*.5+.5; gl_Position = vec4(a,0.,1.); }`;

        // Emerald/jade energy filling left -> right with shift progress; lime only at the leading edge.
        const frag = `
            precision highp float;
            varying vec2 vUv;
            uniform float uTime, uProgress, uOn;
            uniform vec2 uRes;

            float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
            float noise(vec2 p){
                vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
                return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
            }
            float fbm(vec2 p){
                float v = 0., a = .5; mat2 r = mat2(.8,-.6,.6,.8);
                for(int i=0;i<3;i++){ v += a*noise(p); p = r*p*2.03; a *= .5; }
                return v;
            }

            void main(){
                vec2 uv = vUv;
                float aspect = uRes.x / uRes.y;
                vec2 p = vec2(uv.x * aspect, uv.y);
                float t = mod(uTime, 600.) * .6;    // wrapped so float precision never degrades

                // Signed out: a faint ember in the bottom-left. Signed in: the edge tracks shift progress.
                float level = mix(.1, mix(.02, 1.04, uProgress), uOn);

                float edge = level
                           + (fbm(vec2(uv.y*3. + t*.35, t*.25)) - .5) * .08
                           + sin(uv.y*7. + t*1.4) * .006;
                edge -= (1. - uOn) * uv.y * .12;

                float d = (uv.x - edge) * aspect;   // <0 = inside the energy
                float haze = exp(-max(d, 0.) * 7.) * .35;

                // Early-out: far ahead of the edge there is only the base colour and a faint haze,
                // so skip the domain-warped plasma there
                if (d > .55) {
                    vec3 base = vec3(.02, .05, .045) + vec3(.184, .878, .627) * haze * .75 * mix(.4, 1., uOn);
                    gl_FragColor = vec4(base + (hash(gl_FragCoord.xy) - .5) / 255., 1.);
                    return;
                }

                vec2 q = vec2(fbm(p*1.1 + vec2(-t*.25, 0.)), fbm(p*1.1 + vec2(5.2, t*.12)));
                vec2 r = vec2(fbm(p*1.3 + 2.*q + vec2(1.7,9.2) - t*.08), fbm(p*1.3 + 2.*q + vec2(8.3,2.8) + t*.06));
                float n = fbm(p*1.1 + 1.8*r);

                float body = smoothstep(.25, -.35, d);
                float rim  = exp(-abs(d) * 9.);     // softer rim: stands in for the old frost blur

                // Orb palette (ties the card to Poppy): emerald body, deep teal pockets, jade highlights,
                // pale mint in the hottest spots, lime only as a touch at the leading edge
                vec3 c0 = vec3(.024, .165, .149);   // deep teal      #062A26
                vec3 c1 = vec3(.055, .478, .369);   // mid emerald    #0E7A5E
                vec3 c2 = vec3(.184, .878, .627);   // bright jade    #2FE0A0
                vec3 c3 = vec3(.62, 1.00, .84);     // pale mint
                vec3 lime = vec3(.58, .96, .12);    // orb lime #94F51F, leading edge only

                float dens = n*1.2 + r.y*.35;
                vec3 energy = mix(c1, c2, smoothstep(.55, .85, dens));
                energy = mix(c0, energy, smoothstep(.28, .52, dens));

                float crease = pow(clamp(n * rim * 1.5, 0., 1.), 2.5);
                energy = mix(energy, c3, crease * .6);

                float bright = .85 + .35*exp(d * 4.5);
                bright *= mix(.7, 1., uOn);

                vec3 col = vec3(.02, .05, .045);    // faint deep-teal base
                col = mix(col, energy * bright, body * (.75 + .25*n));
                col += c2 * haze * (.5 + .5*n) * mix(.4, 1., uOn);
                col += mix(lime, c3, .3) * rim * (.45 + .6*n) * smoothstep(.0, .03, level) * mix(.6, 1., uOn);
                col = min(col, vec3(1.));
                col += (hash(gl_FragCoord.xy) - .5) / 255.;
                gl_FragColor = vec4(col, 1.);
            }`;

        const compile = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.warn('site-card-energy:', gl.getShaderInfoLog(sh));
            return sh;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
        gl.linkProgram(prog);

        if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            gl.useProgram(prog);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const aLoc = gl.getAttribLocation(prog, 'a');
            gl.enableVertexAttribArray(aLoc);
            gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
            const uTime = gl.getUniformLocation(prog, 'uTime');
            const uProgress = gl.getUniformLocation(prog, 'uProgress');
            const uOn = gl.getUniformLocation(prog, 'uOn');
            const uRes = gl.getUniformLocation(prog, 'uRes');

            const resize = () => {
                // Fixed fraction of the CSS size, independent of devicePixelRatio
                const w = Math.max(1, Math.round(card.clientWidth * RENDER_SCALE));
                const h = Math.max(1, Math.round(card.clientHeight * RENDER_SCALE));
                if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
                gl.viewport(0, 0, w, h);
                gl.uniform2f(uRes, w, h);
            };
            new ResizeObserver(() => { resize(); kick(); }).observe(card);
            resize();

            draw = (time) => {
                gl.uniform1f(uTime, time);
                gl.uniform1f(uProgress, shownP);
                gl.uniform1f(uOn, shownOn);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            };
        }
    }

    // ---------------- Loop ----------------
    // Continuous only while the plasma drifts (signed in) or values ease; otherwise one frame, then a
    // slow tick so the progress and the status label keep up with the clock.
    let visible = true;
    let paused = false;                        // a sheet covers the card (scripts/core/modal.js)
    let raf = 0;
    let idleTimer = 0;
    let last = 0, lastDraw = 0, lastVsync = 0, refreshMs = 16.7;
    let animTime = 12;                         // plasma clock; frozen while not animating

    function frame(now) {
        raf = 0;
        if (!visible || document.hidden || paused) return;

        // Measure the refresh interval; on 120Hz+ screens skip every other refresh (an even 60fps)
        const vsync = now - lastVsync;
        lastVsync = now;
        if (vsync > 0 && vsync < 50) refreshMs = refreshMs * 0.9 + vsync * 0.1;
        if (refreshMs < 10 && now - lastDraw < refreshMs * 1.5) { raf = requestAnimationFrame(frame); return; }

        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        lastDraw = now;

        const animating = !!draw && signedIn() === 1 && !reducedMotion.matches;
        const moving = updateState(dt);
        if (animating) animTime += dt;
        if (draw) draw(animTime);

        if (animating || moving) raf = requestAnimationFrame(frame);
        else idleTimer = setTimeout(kick, 15000);
    }
    function kick() {
        clearTimeout(idleTimer);
        if (!raf && visible && !paused && !document.hidden) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
        }
    }

    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; kick(); }).observe(card);
    document.addEventListener('visibilitychange', kick);
    reducedMotion.addEventListener('change', kick);
    // Sign in / out (from the card or a notification): start easing straight away, the loop may be idling
    window.kickSiteCardEnergy = kick;
    window.setSiteCardEnergyPaused = (p) => {
        paused = !!p;
        if (paused) { if (raf) { cancelAnimationFrame(raf); raf = 0; } clearTimeout(idleTimer); }
        else kick();
    };

    updateState(1);
    kick();
})();
