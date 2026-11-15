/**
 * WebGL Siri-style orb (createAssistantOrb) and the Poppy assistant orb controller.
 */

// =========================================================================
// SMOOTHUI SIRI ORB ENGINE & ORGANIC PRESENCE CONTROLLER (BRAND LIME / CYAN)
// =========================================================================
    // =========================================================================
// STANDALONE VANILLA JS WEBGL ORB INITIALIZER (POPPY BOT AI ASSISTANT)
// =========================================================================
// Lattice hash used to build the orb's noise texture (the same hash the shader used to evaluate per pixel)
function orbHash3(x, y, z) {
    const fr = (v) => v - Math.floor(v);
    const px = fr(x * 0.3183099 + 0.1) * 17, py = fr(y * 0.3183099 + 0.1) * 17, pz = fr(z * 0.3183099 + 0.1) * 17;
    return fr(px * py * pz * (px + py + pz));
}

// 256x256 value-noise texture, built once per GL context (~2 ms, 256 KB): R = lattice value at slice z,
// G = the same lattice shifted by (37, 17), which is slice z+1 in the shader's lookup.
function createOrbNoiseTexture(gl) {
    const N = 256, R = new Uint8Array(N * N), data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        R[y * N + x] = Math.round(orbHash3(x, y, (x * 7 + y * 13) & 63) * 255);
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const o = (y * N + x) * 4;
        data[o] = R[y * N + x];
        data[o + 1] = R[((y + 17) & 255) * N + ((x + 37) & 255)];
        data[o + 2] = 0;
        data[o + 3] = 255;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);   // no mipmaps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
}

/**
 * One simulation clock for every Poppy orb. The Home orb and the sheet's big orb read the same phase, so
 * the sheet shows the very same clouds, just larger, and the Home orb carries on where the sheet left off.
 * Whichever orb is drawing advances it (only one draws at a time: the Home orb pauses under a sheet).
 */
const POPPY_ORB_CLOCK = { phase: 0, last: 0 };
// Shared look, so both orbs are the same orb at two sizes
const POPPY_ORB_LOOK = { speed: 0.85, creaseSharpness: 0.90, scale: 1.15, whiteIntensity: 0.35 };

/**
 * Mobile-optimised orb. Per pixel, 3D value noise is one bilinear texture fetch instead of hashing 8 cube
 * corners (10 fetches and ~150 ALU ops instead of ~1,000), values that are the same for every pixel are
 * computed on the CPU, and there is no `discard`. Per frame, the backing store is capped
 * (options.maxBuffer, px), drawing is capped at 30 fps, and it pauses off-screen, in a hidden tab, or
 * under a sheet (setPaused).
 */
function createAssistantOrb(canvas, options = {}) {
    if (!canvas) return null;
    const gl = canvas.getContext('webgl', {
        alpha: true, premultipliedAlpha: true, antialias: false,
        depth: false, stencil: false, preserveDrawingBuffer: false,
        powerPreference: 'low-power'
    });
    if (!gl) {
        console.error('WebGL not supported');
        return null;
    }

    const config = {
        state: options.state || 'idle', // 'idle' | 'listening' | 'thinking'
        speed: options.speed ?? 0.8,
        creaseSharpness: options.creaseSharpness ?? 0.90,
        scale: options.scale ?? 1.15,
        whiteIntensity: options.whiteIntensity ?? 0.35,
        colors: options.colors || {
            c0: [0.01, 0.06, 0.36], // Deep Sapphire Pocket (#030f5c)
            c1: [0.00, 0.68, 0.58], // Rich Emerald-Cyan (#00ad94)
            c2: [0.58, 0.96, 0.12], // Lush Lifestyle Lime-Green (#94f51f)
            c3: [0.93, 1.00, 0.75]  // Luminous White-Lime Crease (#edffbf)
        }
    };
    // Backing-store cap in device pixels: the orb is soft, so upscaling isn't visible
    const maxBuffer = options.maxBuffer ?? 160;
    const clock = options.clock || { phase: 0, last: 0 };     // pass POPPY_ORB_CLOCK to share the simulation
    // crispEdge: the sphere fills the canvas and the canvas's own CSS border-radius (rounded-full) cuts the
    // outline at full screen resolution, so the rim stays sharp however small the backing store is. The
    // canvas must be sized to the sphere (93% of the old box) and be border-radius: 50%. Plain
    // border-radius, not clip-path: a clip-path on a WebGL canvas was costly on iOS under the sheet's blur.
    const crispEdge = !!options.crispEdge;
    // observe: false skips the on-screen check (a detached source canvas is never "on screen"; its owner
    // pauses it instead). onFrame(canvas) runs right after each frame is drawn, while the drawing buffer is
    // still readable, so the frame can be copied (the Poppy avatars below).
    const observe = options.observe !== false;
    const onFrame = typeof options.onFrame === 'function' ? options.onFrame : null;
    const FPS = options.fps ?? 30;
    const STATE_SPEED = { idle: 1.0, listening: 1.5, thinking: 2.1 };

    const vsSource = `
            attribute vec2 a_position;
            void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
        `;

    const fsSource = `
            precision highp float;

            uniform sampler2D u_noise;
            uniform vec2  u_resolution;
            uniform float u_radius;       // sphere radius (1 = touches the canvas edge)
            uniform float u_edgePad;      // 0 = shader anti-aliases the rim; 2 = the canvas's CSS border-radius cuts it
            uniform float u_t;            // accumulated phase (time x speed x state speed)
            uniform float u_state;        // 0 idle, 1 listening, 2 thinking
            uniform float u_freq;         // 0.92 / max(scale, 0.5)
            uniform float u_glassGlare;
            uniform float u_whiteAmount;
            uniform float u_creaseGain;   // glassGlare * (0.55 + 0.60 * whiteAmount)
            uniform float u_specGain;     // 0.28 * glassGlare * (0.4 + 0.6 * whiteAmount)
            uniform vec3  u_color0;
            uniform vec3  u_color1;
            uniform vec3  u_color2;
            uniform vec3  u_color3;
            uniform vec3  u_creaseColor;  // mix(color2, color3, clamp(whiteAmount, 0, 1))
            uniform vec3  u_rimColor;     // mix(color2, color3, 0.65)

            const vec3  LIGHT  = vec3(-0.35, 0.48, 0.80) / 0.9964437;

            // Value noise, one bilinear fetch: R = lattice at slice z, G = slice z+1. The quintic fade is
            // applied before the fetch, so hardware bilinear filtering gives the quintic blend in x/y.
            float snoise(vec3 x) {
                vec3 i = floor(x);
                vec3 f = fract(x);
                f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
                vec2 uv = mod(i.xy + vec2(37.0, 17.0) * i.z, 256.0) + f.xy;
                vec2 rg = texture2D(u_noise, (uv + 0.5) * (1.0 / 256.0)).xy;
                return mix(rg.x, rg.y, f.z);
            }

            float cloudFBM(vec3 p) {
                return 0.72 * snoise(p) + 0.28 * snoise(p * 1.75 + vec3(1.7, 3.2, 2.1));
            }

            void main() {
                float minRes = min(u_resolution.x, u_resolution.y);
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / minRes;
                float r2 = dot(p, p);
                float r  = sqrt(r2);

                float RADIUS = u_radius;
                float pd = 2.0 / minRes;
                float edge = RADIUS + pd * u_edgePad;
                float alpha = smoothstep(edge, edge - pd, r);       // ~1 buffer px edge
                if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

                float z = sqrt(max(0.0, RADIUS * RADIUS - r2));
                vec3 normal = vec3(p, z) / max(r, RADIUS);

                float t = u_t;
                vec3 pos = normal;
                if (u_state > 1.5) {
                    float ang = t * 1.4 + (1.0 - normal.z) * 1.2;
                    float ca = cos(ang), sa = sin(ang);
                    pos.xy = mat2(ca, -sa, sa, ca) * pos.xy;
                } else if (u_state > 0.5) {
                    pos *= 1.0 - sin(t * 6.0) * 0.14 * normal.z;
                }

                vec3 q = pos * u_freq + vec3(0.35, -0.28, 0.42) * t;
                vec3 warp = vec3(
                    cloudFBM(q + vec3(0.0, 1.3, 0.7)),
                    cloudFBM(q + vec3(2.4, 0.5, 1.9)),
                    cloudFBM(q + vec3(1.1, 2.8, 0.3))
                );
                float n1 = cloudFBM(q + warp * 1.65 - vec3(0.0, t * 0.32, 0.0));
                float n2 = cloudFBM(q * 1.15 - warp * 1.25 + vec3(t * 0.22, 0.0, -t * 0.28));

                float cloudDensity = smoothstep(0.18, 0.72, n1 * 0.85 + (1.0 - abs(normal.y) * 0.35) * 0.25);

                float wd1 = abs((n1 - n2) + normal.y * 0.15);
                float wd2 = abs((warp.x - warp.y) * 0.80 - 0.06);
                float crease = exp(-wd1 * 18.0) * smoothstep(0.12, 0.70, n1)
                             + exp(-wd2 * 22.0) * smoothstep(0.20, 0.75, n2) * 0.85;
                float halo = exp(-wd1 * 5.5) * 0.55 * u_glassGlare;

                vec3 col = mix(u_color0, u_color1, smoothstep(0.10, 0.48, cloudDensity + halo * 0.45));
                col = mix(col, u_color2, smoothstep(0.30, 0.75, cloudDensity));
                col = mix(col, u_color3, smoothstep(0.60, 0.95, cloudDensity * n1 * 1.35) * 0.75 * u_whiteAmount);
                col = mix(col, u_color2, min(halo, 1.0) * 0.65);
                col += u_creaseColor * (crease * u_creaseGain);

                float fresnel = pow(1.0 - max(normal.z, 0.0), 2.8);
                col = mix(col, u_rimColor, fresnel * 0.62);
                col += u_color3 * (pow(max(dot(normal, LIGHT), 0.0), 26.0) * u_specGain);

                // Premultiplied alpha for clean, halo-free iOS WebKit compositing
                gl_FragColor = vec4(col * alpha, alpha);
            }
        `;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('siri-orb:', gl.getShaderInfoLog(s));
        return s;
    }

    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one full-screen triangle
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const U = (name) => gl.getUniformLocation(program, name);
    const u = {
        res: U('u_resolution'), t: U('u_t'), state: U('u_state'), freq: U('u_freq'),
        glass: U('u_glassGlare'), white: U('u_whiteAmount'), creaseGain: U('u_creaseGain'), specGain: U('u_specGain'),
        c0: U('u_color0'), c1: U('u_color1'), c2: U('u_color2'), c3: U('u_color3'),
        creaseColor: U('u_creaseColor'), rimColor: U('u_rimColor')
    };

    const noiseTex = createOrbNoiseTexture(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(U('u_noise'), 0);
    gl.uniform1f(U('u_radius'), crispEdge ? 1.0 : 0.93);
    gl.uniform1f(U('u_edgePad'), crispEdge ? 2.0 : 0.0);

    // Uniforms that only change when the look changes: uploaded on change, not per frame
    const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    function uploadStyle() {
        const glare = config.creaseSharpness, white = config.whiteIntensity, c = config.colors;
        gl.uniform1f(u.freq, 0.92 / Math.max(config.scale, 0.5));
        gl.uniform1f(u.glass, glare);
        gl.uniform1f(u.white, white);
        gl.uniform1f(u.creaseGain, glare * (0.55 + 0.60 * white));
        gl.uniform1f(u.specGain, 0.28 * glare * (0.4 + 0.6 * white));
        gl.uniform3fv(u.c0, c.c0);
        gl.uniform3fv(u.c1, c.c1);
        gl.uniform3fv(u.c2, c.c2);
        gl.uniform3fv(u.c3, c.c3);
        gl.uniform3fv(u.creaseColor, mix3(c.c2, c.c3, Math.min(Math.max(white, 0), 1)));
        gl.uniform3fv(u.rimColor, mix3(c.c2, c.c3, 0.65));
    }
    uploadStyle();

    // Backing store: min(CSS px x DPR, maxBuffer)
    function sizeCanvas() {
        const css = canvas.clientWidth || options.cssSize || 26;
        const px = Math.max(1, Math.min(Math.round(css * (window.devicePixelRatio || 1)), maxBuffer));
        if (canvas.width !== px || canvas.height !== px) {
            canvas.width = canvas.height = px;
            gl.viewport(0, 0, px, px);
            gl.uniform2f(u.res, px, px);
        }
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);

    let rafId = null;
    let isDestroyed = false;
    let isPaused = false;                      // setPaused(): stop drawing while hidden behind a sheet
    let onScreen = true;
    let last = 0;
    const frameMs = 1000 / FPS;
    const WRAP = 25600;                        // the noise repeats every 256 units, so this wrap is seamless

    // Reduced motion: an idle orb is drawn once and held still. Listening/thinking still
    // animate, because there the motion is the state indication.
    const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const shouldHoldStill = () => !!(reduceMotion && reduceMotion.matches && config.state === 'idle');
    const canRun = () => !isDestroyed && !isPaused && onScreen && !document.hidden;

    function draw() {
        sizeCanvas();
        gl.uniform1f(u.t, clock.phase);
        gl.uniform1f(u.state, config.state === 'thinking' ? 2.0 : (config.state === 'listening' ? 1.0 : 0.0));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (onFrame) onFrame(canvas);
    }

    function frame(now) {
        rafId = null;
        if (!canRun()) return;
        if (shouldHoldStill()) { draw(); return; }
        rafId = requestAnimationFrame(frame);
        const dt = now - last;
        if (dt < frameMs - 2) return;          // 30 fps cap
        last = now;
        // Advance the (possibly shared) clock by real time since it last moved, capped so a resume
        // after a pause continues smoothly instead of jumping ahead
        const step = Math.min(Math.max(now - clock.last, 0), 100);
        clock.last = now;
        clock.phase += step / 1000 * config.speed * (STATE_SPEED[config.state] || 1) * 0.45;   // phase is accumulated, so state / speed changes never jump
        if (clock.phase > WRAP) clock.phase -= WRAP;
        draw();
    }
    function resume() {
        if (rafId || !canRun()) return;
        last = performance.now();
        clock.last = last;
        if (shouldHoldStill()) { draw(); return; }
        rafId = requestAnimationFrame(frame);
    }
    function halt() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

    const io = (observe && 'IntersectionObserver' in window)
        ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScreen ? resume() : halt(); })
        : null;
    if (io) io.observe(canvas);
    const onVisibility = () => (document.hidden ? halt() : resume());
    document.addEventListener('visibilitychange', onVisibility);
    if (reduceMotion && reduceMotion.addEventListener) reduceMotion.addEventListener('change', resume);

    // iOS can drop a GPU context (e.g. while the app is in the background): mark this orb dead so its
    // owner builds a fresh one next time
    let isLost = false;
    const onLost = () => { isLost = true; isDestroyed = true; halt(); };
    canvas.addEventListener('webglcontextlost', onLost);

    draw();                                    // first frame straight away, before the loop starts
    resume();

    return {
        canvas,
        isLost: () => isLost,
        setState: (newState) => { config.state = newState; resume(); },
        drawNow: () => { if (!isDestroyed) draw(); },
        setSpeed: (val) => { config.speed = val; },
        setScale: (val) => { config.scale = val; uploadStyle(); },
        setWhiteIntensity: (val) => { config.whiteIntensity = val; uploadStyle(); },
        setCreaseSharpness: (val) => { config.creaseSharpness = val; uploadStyle(); },
        setPaused: (paused) => {
            isPaused = !!paused;
            if (isPaused) halt(); else resume();
        },
        destroy: () => {
            isDestroyed = true;
            halt();
            if (io) io.disconnect();
            document.removeEventListener('visibilitychange', onVisibility);
            canvas.removeEventListener('webglcontextlost', onLost);
            if (reduceMotion && reduceMotion.removeEventListener) reduceMotion.removeEventListener('change', resume);
            try {
                gl.deleteTexture(noiseTex);
                gl.deleteProgram(program);
                gl.deleteShader(vs);
                gl.deleteShader(fs);
                gl.deleteBuffer(buffer);
                // Hand the GPU context back now instead of waiting for GC: iOS Safari reloads the page
                // when too many WebGL contexts / too much GPU memory pile up (each Poppy open makes one)
                const lose = gl.getExtension('WEBGL_lose_context');
                if (lose) lose.loseContext();
            } catch (_) {}
        }
    };
}

let dockOrbInstance = null;
let modalOrbInstance = null;
let _poppyOrbState = 'idle';

function setPoppyOrbState(newState) {
    _poppyOrbState = newState;
    if (dockOrbInstance) dockOrbInstance.setState(newState);
    if (modalOrbInstance) modalOrbInstance.setState(newState);
    if (poppyAvatars.orb) poppyAvatars.orb.setState(newState);

    const ping = document.getElementById('poppy-status-ping');
    const dot = document.getElementById('poppy-status-dot');
    if (ping && dot) {
        const statusColor = (newState === 'thinking') ? '#00F0FF' : (newState === 'error' ? '#EF4444' : '#CCFF00');
        ping.style.backgroundColor = statusColor;
        dot.style.backgroundColor = statusColor;
        if (newState === 'listening' || newState === 'thinking') {
            ping.classList.remove('opacity-75');
            ping.classList.add('opacity-100');
        } else {
            ping.classList.remove('opacity-100');
            ping.classList.add('opacity-75');
        }
    }
}

function initPoppySiriOrb() {
    // Poppy's orb on Home (first row of the Home list)
    const dockCanvas = document.getElementById('home-poppy-orb-canvas');
    if (dockCanvas && !dockOrbInstance) {
        dockOrbInstance = createAssistantOrb(dockCanvas, {
            ...POPPY_ORB_LOOK,
            state: _poppyOrbState,
            clock: POPPY_ORB_CLOCK
        });
    }
}

/**
 * The sheet's big orb is built once and kept: each later open moves the same canvas (and its live GPU
 * context, shader and noise texture) into the new sheet instead of creating a new context every time.
 * closeModal() pauses it (scripts/core/modal.js).
 */
function mountPoppySheetOrb(placeholder) {
    if (!placeholder) return;
    if (modalOrbInstance && modalOrbInstance.isLost()) {
        try { modalOrbInstance.destroy(); } catch (_) {}
        modalOrbInstance = null;
    }
    if (modalOrbInstance) {
        const canvas = modalOrbInstance.canvas;
        canvas.className = placeholder.className;
        canvas.id = placeholder.id;
        placeholder.replaceWith(canvas);
        modalOrbInstance.setState(_poppyOrbState);
        modalOrbInstance.setPaused(false);
        return;
    }
    modalOrbInstance = createAssistantOrb(placeholder, {
        ...POPPY_ORB_LOOK,
        state: _poppyOrbState,
        clock: POPPY_ORB_CLOCK,
        // A 190px sphere drawn from a 256px buffer: crisp at the rim, still about half the pixels of 2x
        // density, and the texture-noise shader keeps the GPU light under the sheet's blur
        maxBuffer: 256,
        crispEdge: true                        // the canvas's rounded-full draws the rim (see createAssistantOrb)
    });
}

function handlePoppyOrbClick(e) {
    if (e) e.stopPropagation();
    triggerHaptic('medium');

    const modal = document.getElementById('modal-overlay');
    const isModalOpen = modal && !modal.classList.contains('opacity-0');

    if (isModalOpen) {
        closeModal();
        setPoppyOrbState('idle');
    } else {
        setPoppyOrbState('listening');
        openPoppyBotChat();
    }
}

// ---------- Poppy avatars ----------
// Poppy's profile picture wherever people's avatars appear (chat list, new-conversation sheet): the real orb,
// small. One hidden orb (one WebGL context, whatever the number of avatars) renders off-screen and each frame
// is copied into every visible avatar canvas (2D). It only runs while an avatar is on screen and not hidden
// behind a sheet. Markup: renderPoppyAvatar() (scripts/components/role-avatar.js); after inserting it, call
// mountPoppyAvatars(container).
const poppyAvatars = { orb: null, canvases: new Set(), visible: new Set(), io: null };
const POPPY_AVATAR_BUFFER = 128;
function poppyAvatarShown(c) {
    if (!c.isConnected) return false;
    const covered = document.documentElement.classList.contains('sheet-covers-page');
    return !covered || !!c.closest('#modal-content');
}
function poppyAvatarPrune() {
    poppyAvatars.canvases.forEach(c => {
        if (c.isConnected) return;
        poppyAvatars.canvases.delete(c);
        poppyAvatars.visible.delete(c);
        if (poppyAvatars.io) poppyAvatars.io.unobserve(c);
    });
}
function poppyAvatarPaint(src) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    poppyAvatars.visible.forEach(c => {
        if (!poppyAvatarShown(c)) return;
        const px = Math.max(1, Math.round((c.clientWidth || 44) * dpr));
        if (c.width !== px || c.height !== px) { c.width = c.height = px; }
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, px, px);
        ctx.drawImage(src, 0, 0, px, px);
    });
}
// Run the hidden orb only while some avatar is visible
function syncPoppyAvatars() {
    poppyAvatarPrune();
    const active = [...poppyAvatars.visible].some(poppyAvatarShown);
    if (poppyAvatars.orb && poppyAvatars.orb.isLost()) {
        try { poppyAvatars.orb.destroy(); } catch (_) {}
        poppyAvatars.orb = null;
    }
    if (active && !poppyAvatars.orb && typeof createAssistantOrb === 'function') {
        const src = document.createElement('canvas');
        src.width = src.height = POPPY_AVATAR_BUFFER;
        poppyAvatars.orb = createAssistantOrb(src, {
            ...POPPY_ORB_LOOK,
            state: _poppyOrbState,
            observe: false,
            cssSize: POPPY_AVATAR_BUFFER,
            maxBuffer: POPPY_AVATAR_BUFFER,
            onFrame: poppyAvatarPaint
        });
    }
    if (poppyAvatars.orb) {
        poppyAvatars.orb.setPaused(!active);
        if (active) poppyAvatars.orb.drawNow();          // new avatars get a frame at once (and when held still)
    }
}
function mountPoppyAvatars(root = document) {
    if (!root || !root.querySelectorAll) return;
    if (!poppyAvatars.io && 'IntersectionObserver' in window) {
        poppyAvatars.io = new IntersectionObserver(entries => {
            entries.forEach(e => (e.isIntersecting ? poppyAvatars.visible.add(e.target) : poppyAvatars.visible.delete(e.target)));
            syncPoppyAvatars();
        });
    }
    root.querySelectorAll('canvas.poppy-avatar-canvas').forEach(c => {
        if (poppyAvatars.canvases.has(c)) return;
        poppyAvatars.canvases.add(c);
        if (poppyAvatars.io) poppyAvatars.io.observe(c);
        else poppyAvatars.visible.add(c);
    });
    syncPoppyAvatars();
}
