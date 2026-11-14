/**
 * Home site card: liquid-glass light driven by the real clock.
 *
 * Sets three CSS custom properties on #site-hero-card (styles/site-card.css reads them):
 *   --p   0..1  progress through today's shift (SITE_SHIFT_START -> SITE_SHIFT_END, local time)
 *   --on  0..1  signed-in amount, eased from isSiteSignedIn (scripts/features/attendance.js)
 *   --pp        p * on: how much light is in the card (the light front, edge light and rim)
 * toggles .sc-on while signed in, and draws a flowing emerald plasma into .sc-flowgl, covering only the
 * worked part of the shift.
 *
 * Cost control (keeps the GPU light enough for iOS Safari to open a blurred sheet on top):
 *   - the canvas covers only the filled part of the card (+ a 44px feather), resized in 8px steps
 *   - renders at 0.22x of its CSS size, whatever the devicePixelRatio; the upscale is the softness
 *   - noise comes from a 64x64 texture made once: one texture read per noise octave
 *   - low-power context, no antialias / depth / stencil buffers
 *   - the plasma flows only while signed in; otherwise it draws while values ease, then sleeps
 *   - 120Hz screens draw every 2nd refresh (an even 60fps)
 *   - pauses off-screen, in a hidden tab, or under a sheet (setSiteCardEnergyPaused)
 * With reduced motion the plasma holds still. Without WebGL the card keeps its glass, track, dot and times.
 */

const SITE_SHIFT_START = 7 * 60;        // 7:00 AM, minutes since midnight
const SITE_SHIFT_END = 15 * 60 + 30;    // 3:30 PM

(function initSiteCardEnergy() {
    const card = document.getElementById('site-hero-card');
    if (!card) return;
    const canvas = card.querySelector('.sc-flowgl');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const RENDER_SCALE = 0.22;         // CSS px -> shader px
    const FEATHER = 44;                // CSS px drawn past the light front for the soft fade
    const WIDTH_STEP = 8;              // resize the canvas in 8px steps, not every easing frame
    const PAD = 20;                    // the card's padding: the light front lines up with the track's dot

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
    let lastP = '', lastOn = '', lastPP = '';
    function updateState(dt) {
        const targetP = realProgress();
        const targetOn = signedIn();
        shownP += (targetP - shownP) * (1 - Math.exp(-dt * 4.8));
        shownOn += (targetOn - shownOn) * (1 - Math.exp(-dt * 3));
        if (Math.abs(targetP - shownP) < 0.0005) shownP = targetP;
        if (Math.abs(targetOn - shownOn) < 0.001) shownOn = targetOn;

        // Write to the DOM only when a value actually changes
        const p = shownP.toFixed(4), on = shownOn.toFixed(4), pp = (shownP * shownOn).toFixed(4);
        if (p !== lastP) { card.style.setProperty('--p', p); lastP = p; }
        if (on !== lastOn) { card.style.setProperty('--on', on); lastOn = on; }
        if (pp !== lastPP) { card.style.setProperty('--pp', pp); lastPP = pp; }
        card.classList.toggle('sc-on', targetOn === 1);
        // "Signed In" -> "Shift Completed" once the clock passes the shift end (no-op unless it changes)
        if (typeof renderSiteSignedInStatus === 'function') renderSiteSignedInStatus();
        return shownP !== targetP || shownOn !== targetOn;
    }

    // ---------------- Plasma (WebGL) ----------------
    let draw = null, fitCanvas = () => {};
    const gl = canvas && canvas.getContext('webgl', {
        premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false,
        preserveDrawingBuffer: false, powerPreference: 'low-power'
    });

    if (gl) {
        const vert = `attribute vec2 a; varying vec2 vUv; void main(){ vUv = a*.5+.5; gl_Position = vec4(a,0.,1.); }`;
        const frag = `
            #ifdef GL_FRAGMENT_PRECISION_HIGH
            precision highp float;
            #else
            precision mediump float;
            #endif
            varying vec2 vUv;
            uniform sampler2D uNoise;
            uniform float uTime, uEdge, uAmt, uSpan, uAspect;
            float noise(vec2 p){
                vec2 i = floor(p), f = fract(p);
                f = f*f*(3.-2.*f);                                  // smooth (Hermite) interpolation
                return texture2D(uNoise, (i + f + .5) / 64.).r;     // one fetch, hardware bilinear does the rest
            }
            float fbm(vec2 p){
                float v = .5*noise(p);
                p = mat2(.8,-.6,.6,.8)*p*2.03; v += .25*noise(p);
                p = mat2(.8,-.6,.6,.8)*p*2.03; v += .125*noise(p);
                return v;
            }
            void main(){
                vec2 uv = vec2(vUv.x * uSpan, vUv.y);                // canvas covers only the fill: map back to card space
                float d = (uv.x - uEdge) * uAspect;
                vec2 p = vec2(uv.x * uAspect, uv.y);
                float t = uTime * .5;
                vec2 q = vec2(fbm(p*1.2 + vec2(-t*.3, 0.)), fbm(p*1.2 + vec2(5.2, t*.15)));
                vec2 r = vec2(fbm(p*1.4 + 2.*q + vec2(1.7,9.2) - t*.1), fbm(p*1.4 + 2.*q + vec2(8.3,2.8) + t*.08));
                float n = fbm(p*1.1 + 1.8*r);
                vec3 c1 = vec3(.055,.478,.369), c2 = vec3(.184,.878,.627), c3 = vec3(.62,1.,.84);
                float dens = n*1.2 + r.y*.35;
                vec3 col = mix(c1*1.2, c2, smoothstep(.3,.62,dens));
                col = mix(col, c3, smoothstep(.58,.8,dens)*.55);
                col = mix(col, c3, pow(clamp(n*exp(-abs(d)*7.)*1.4,0.,1.),2.5)*.6);
                float mask  = 1. - smoothstep(-.04, .2, d);
                float build = .3 + .7*exp(min(d,0.)*2.2);
                float low   = .6 + .4*(1. - uv.y);
                float a = min(mask * build * low * (.3 + .7*smoothstep(.22,.6,dens)) * 1.05 * uAmt, .9);
                gl_FragColor = vec4(col*a, a);
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

            // 64x64 tiling noise texture, made once (4 KB), from the same hash a per-pixel shader would use
            // (32-bit float maths, matching how the GPU evaluates it)
            const N = 64, data = new Uint8Array(N * N), F = Math.fround, fr = x => F(x - Math.floor(x));
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
                let px = fr(F(x * F(123.34))), py = fr(F(y * F(456.21)));
                const dd = F(F(px * F(px + F(45.32))) + F(py * F(py + F(45.32))));
                px = F(px + dd); py = F(py + dd);
                data[y * N + x] = Math.round(fr(F(px * py)) * 255);
            }
            gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, N, N, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            const U = {};
            ['uNoise', 'uTime', 'uEdge', 'uAmt', 'uSpan', 'uAspect'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
            gl.uniform1i(U.uNoise, 0);
            gl.clearColor(0, 0, 0, 0);

            // The canvas covers only the filled part of the card (+ feather)
            let cardW = card.clientWidth, cardH = card.clientHeight, cssW = -1;
            const edgePx = () => PAD + shownP * shownOn * (cardW - 2 * PAD);
            fitCanvas = (force) => {
                const want = Math.max(WIDTH_STEP, Math.min(cardW, Math.ceil((edgePx() + FEATHER) / WIDTH_STEP) * WIDTH_STEP));
                if (want === cssW && !force) return;
                cssW = want;
                canvas.style.width = want + 'px';
                canvas.width = Math.max(1, Math.round(want * RENDER_SCALE));
                canvas.height = Math.max(1, Math.round(cardH * RENDER_SCALE));
                gl.viewport(0, 0, canvas.width, canvas.height);
            };
            new ResizeObserver(() => {
                cardW = card.clientWidth; cardH = card.clientHeight;
                fitCanvas(true);
                kick();
            }).observe(card);

            draw = (time) => {
                if (!cardW || !cardH) return;
                gl.uniform1f(U.uTime, time % 12800);   // 12800s: every drift offset is a whole number of noise tiles, so the wrap is seamless
                gl.uniform1f(U.uEdge, edgePx() / cardW);
                gl.uniform1f(U.uAmt, shownOn);
                gl.uniform1f(U.uSpan, cssW / cardW);
                gl.uniform1f(U.uAspect, cardW / cardH);
                gl.clear(gl.COLOR_BUFFER_BIT);
                if (shownOn > 0.005) gl.drawArrays(gl.TRIANGLES, 0, 3);
            };
        }
    }

    // ---------------- Loop ----------------
    // Continuous only while the plasma flows (signed in) or values ease; otherwise one frame, then a
    // slow tick so the progress and the status label keep up with the clock.
    let visible = true;
    let paused = false;                        // a sheet covers the card (scripts/core/modal.js)
    let raf = 0;
    let idleTimer = 0;
    let last = 0, lastDraw = 0, lastVsync = 0, refreshMs = 16.7;
    let animTime = 12;                         // plasma clock; frozen while not flowing

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

        const flowing = !!draw && signedIn() === 1 && !reducedMotion.matches;
        const moving = updateState(dt);
        fitCanvas();
        if (flowing) animTime += dt;
        if (draw) draw(animTime);

        if (flowing || moving) raf = requestAnimationFrame(frame);
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
    fitCanvas(true);
    kick();
})();
