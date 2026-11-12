/**
 * Home site card: live "energy" surface driven by the real clock.
 *
 * Sets two CSS custom properties on #site-hero-card (styles/site-card.css reads them):
 *   --p   0..1  progress through today's shift (SITE_SHIFT_START -> SITE_SHIFT_END, local time)
 *   --on  0..1  signed-in amount, eased from isSiteSignedIn (scripts/features/attendance.js)
 * and renders a WebGL shader behind the card's frosted glass: a faint ember while signed out,
 * a lime/mint energy edge that tracks the shift once signed in.
 *
 * Cost control: renders at reduced resolution (the frost blurs it anyway), pauses when the card is
 * off-screen or the tab is hidden, and with reduced motion it stays still and only redraws when the
 * progress changes. Without WebGL the card keeps its track, dot and times; only the glow is absent.
 */

const SITE_SHIFT_START = 7 * 60;        // 7:00 AM, minutes since midnight
const SITE_SHIFT_END = 15 * 60 + 30;    // 3:30 PM

(function initSiteCardEnergy() {
    const card = document.getElementById('site-hero-card');
    const canvas = card && card.querySelector('.sc-energy-canvas');
    if (!card || !canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const RENDER_SCALE = 0.6;

    const signedIn = () => (typeof isSiteSignedIn !== 'undefined' && isSiteSignedIn) ? 1 : 0;
    const realProgress = () => {
        const d = new Date();
        const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
        return Math.max(0, Math.min(1, (mins - SITE_SHIFT_START) / (SITE_SHIFT_END - SITE_SHIFT_START)));
    };

    let shownP = realProgress();
    let shownOn = signedIn();

    // Ease the shown values toward the real ones. Returns true while still moving.
    function updateState() {
        const targetP = realProgress();
        const targetOn = signedIn();
        shownP += (targetP - shownP) * 0.08;
        shownOn += (targetOn - shownOn) * 0.05;
        if (Math.abs(targetP - shownP) < 0.0005) shownP = targetP;
        if (Math.abs(targetOn - shownOn) < 0.001) shownOn = targetOn;

        card.style.setProperty('--p', shownP.toFixed(4));
        card.style.setProperty('--on', shownOn.toFixed(4));
        // "Signed In" -> "Shift Completed" once the clock passes the shift end (no-op unless it changes)
        if (typeof renderSiteSignedInStatus === 'function') renderSiteSignedInStatus();
        return shownP !== targetP || shownOn !== targetOn;
    }

    // ---------------- Shader ----------------
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
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
                for(int i=0;i<4;i++){ v += a*noise(p); p = r*p*2.03; a *= .5; }
                return v;
            }

            void main(){
                vec2 uv = vUv;
                float aspect = uRes.x / uRes.y;
                vec2 p = vec2(uv.x * aspect, uv.y);
                float t = uTime * .6;

                // Signed out: a faint ember in the bottom-left. Signed in: the edge tracks shift progress.
                float level = mix(.1, mix(.02, 1.04, uProgress), uOn);

                vec2 q = vec2(fbm(p*1.1 + vec2(-t*.25, 0.)), fbm(p*1.1 + vec2(5.2, t*.12)));
                vec2 r = vec2(fbm(p*1.3 + 2.*q + vec2(1.7,9.2) - t*.08), fbm(p*1.3 + 2.*q + vec2(8.3,2.8) + t*.06));
                float n = fbm(p*1.1 + 1.8*r);

                float edge = level
                           + (fbm(vec2(uv.y*3. + t*.35, t*.25)) - .5) * .08
                           + sin(uv.y*7. + t*1.4) * .006;
                edge -= (1. - uOn) * uv.y * .12;

                float d = (uv.x - edge) * aspect;
                float body = smoothstep(.25, -.35, d);
                float rim  = exp(-abs(d) * 16.);
                float haze = exp(-max(d, 0.) * 7.) * .35;

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
                col += (hash(gl_FragCoord.xy + uTime) - .5) / 255.;
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
                const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * RENDER_SCALE;
                const w = Math.max(1, Math.round(card.clientWidth * dpr));
                const h = Math.max(1, Math.round(card.clientHeight * dpr));
                if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
                gl.viewport(0, 0, w, h);
                gl.uniform2f(uRes, w, h);
            };
            new ResizeObserver(() => { resize(); kick(); }).observe(card);
            resize();

            const t0 = performance.now();
            draw = (now) => {
                // Reduced motion: the energy holds still (fixed time) and only moves with progress
                gl.uniform1f(uTime, reducedMotion.matches ? 12 : (now - t0) / 1000);
                gl.uniform1f(uProgress, shownP);
                gl.uniform1f(uOn, shownOn);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            };
        }
    }

    // ---------------- Loop ----------------
    // Continuous while the shader is animating on screen; otherwise only while values ease,
    // then a slow tick so the progress keeps up with the clock.
    let visible = true;
    let paused = false;                        // a sheet covers the card (scripts/core/modal.js)
    let raf = 0;
    let idleTimer = 0;

    function frame(now) {
        raf = 0;
        const moving = updateState();
        if (draw) draw(now);
        if (!visible || document.hidden || paused) return;
        if (moving || (draw && !reducedMotion.matches)) {
            raf = requestAnimationFrame(frame);
        } else {
            idleTimer = setTimeout(kick, 15000);
        }
    }
    function kick() {
        clearTimeout(idleTimer);
        if (!raf && visible && !paused && !document.hidden) raf = requestAnimationFrame(frame);
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

    updateState();
    kick();
})();
