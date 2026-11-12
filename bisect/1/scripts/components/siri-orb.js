/**
 * WebGL Siri-style orb (createAssistantOrb) and the Poppy assistant orb controller.
 */

// =========================================================================
// SMOOTHUI SIRI ORB ENGINE & ORGANIC PRESENCE CONTROLLER (BRAND LIME / CYAN)
// =========================================================================
    // =========================================================================
// STANDALONE VANILLA JS WEBGL ORB INITIALIZER (POPPY BOT AI ASSISTANT)
// =========================================================================
function createAssistantOrb(canvas, options = {}) {
    if (!canvas) return null;
    const gl = canvas.getContext('webgl', { 
        alpha: true, 
        premultipliedAlpha: true, 
        antialias: true,
        powerPreference: 'high-performance'
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

    const vsSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = (a_position + 1.0) * 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

    const fsSource = `
            precision highp float;
            varying vec2 v_uv;

            uniform float u_time;
            uniform vec2 u_resolution;
            uniform float u_state;
            uniform float u_speed;
            uniform float u_glassGlare;
            uniform float u_scale;
            uniform float u_whiteAmount;
            uniform vec3 u_color0;
            uniform vec3 u_color1;
            uniform vec3 u_color2;
            uniform vec3 u_color3;

            float hash(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float snoise(vec3 x) {
                vec3 i = floor(x);
                vec3 f = fract(x);
                f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
                return mix(
                    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
                );
            }

            float cloudFBM(vec3 p) {
                float v = 0.0;
                v += 0.72 * snoise(p);
                v += 0.28 * snoise(p * 1.75 + vec3(1.7, 3.2, 2.1));
                return v;
            }

            void main() {
                vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                float r = length(p);

                float radius = 0.93;
                float pixelDelta = 2.0 / min(u_resolution.x, u_resolution.y);
                float alpha = smoothstep(radius, radius - pixelDelta * 1.75, r);
                if (alpha <= 0.0) {
                    discard;
                }

                float z = sqrt(max(0.0, radius * radius - r * r));
                vec3 normal = normalize(vec3(p.x, p.y, z));

                float stateSpeed = u_speed * (u_state == 2.0 ? 2.1 : (u_state == 1.0 ? 1.5 : 1.0));
                float t = u_time * stateSpeed * 0.45;

                vec3 pos = normal;
                if (u_state == 2.0) {
                    float ang = t * 1.4 + (1.0 - normal.z) * 1.2;
                    float ca = cos(ang), sa = sin(ang);
                    pos.xy = mat2(ca, -sa, sa, ca) * pos.xy;
                } else if (u_state == 1.0) {
                    pos *= 1.0 - sin(t * 6.0) * 0.14 * normal.z;
                }

                float freq = 0.92 / max(u_scale, 0.5);
                vec3 q = pos * freq + vec3(t * 0.35, -t * 0.28, t * 0.42);
                vec3 warp = vec3(
                    cloudFBM(q + vec3(0.0, 1.3, 0.7)),
                    cloudFBM(q + vec3(2.4, 0.5, 1.9)),
                    cloudFBM(q + vec3(1.1, 2.8, 0.3))
                );

                float n1 = cloudFBM(q + warp * 1.65 - vec3(0.0, t * 0.32, 0.0));
                float n2 = cloudFBM(q * 1.15 - warp * 1.25 + vec3(t * 0.22, 0.0, -t * 0.28));

                float latitudeBlend = 1.0 - abs(normal.y) * 0.35;
                float cloudDensity = smoothstep(0.18, 0.72, n1 * 0.85 + latitudeBlend * 0.25);

                float waveDiff1 = (n1 - n2) + normal.y * 0.15;
                float waveDiff2 = (warp.x - warp.y) * 0.80 - 0.06;

                float crease1 = exp(-abs(waveDiff1) * 18.0) * smoothstep(0.12, 0.70, n1);
                float creaseHalo1 = exp(-abs(waveDiff1) * 5.5) * 0.55;
                float crease2 = exp(-abs(waveDiff2) * 22.0) * smoothstep(0.20, 0.75, n2) * 0.85;

                float totalCrease = (crease1 + crease2) * u_glassGlare;
                float totalHalo = creaseHalo1 * u_glassGlare;

                vec3 col = u_color0;
                col = mix(col, u_color1, smoothstep(0.10, 0.48, cloudDensity + totalHalo * 0.45));
                col = mix(col, u_color2, smoothstep(0.30, 0.75, cloudDensity));

                float innerCloudGlow = smoothstep(0.60, 0.95, cloudDensity * n1 * 1.35);
                col = mix(col, u_color3, innerCloudGlow * 0.75 * u_whiteAmount);

                col = mix(col, u_color2, clamp(totalHalo, 0.0, 1.0) * 0.65);
                col += mix(u_color2, u_color3, clamp(u_whiteAmount, 0.0, 1.0)) * totalCrease * (0.55 + 0.60 * u_whiteAmount);

                float fresnel = pow(1.0 - max(normal.z, 0.0), 2.8);
                vec3 rimColor = mix(u_color2, u_color3, 0.65);
                col = mix(col, rimColor, fresnel * 0.62);

                vec3 lightDir = normalize(vec3(-0.35, 0.48, 0.80));
                float spec = pow(max(dot(normal, lightDir), 0.0), 26.0) * 0.28 * u_glassGlare * (0.4 + 0.6 * u_whiteAmount);
                col += u_color3 * spec;

                // Hardware-accelerated premultiplied alpha for clean, halo-free iOS WebKit compositing
                gl_FragColor = vec4(col * alpha, alpha);
            }
        `;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    }

    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const u = {
        time: gl.getUniformLocation(program, 'u_time'),
        res: gl.getUniformLocation(program, 'u_resolution'),
        state: gl.getUniformLocation(program, 'u_state'),
        speed: gl.getUniformLocation(program, 'u_speed'),
        glass: gl.getUniformLocation(program, 'u_glassGlare'),
        scale: gl.getUniformLocation(program, 'u_scale'),
        white: gl.getUniformLocation(program, 'u_whiteAmount'),
        c0: gl.getUniformLocation(program, 'u_color0'),
        c1: gl.getUniformLocation(program, 'u_color1'),
        c2: gl.getUniformLocation(program, 'u_color2'),
        c3: gl.getUniformLocation(program, 'u_color3')
    };

    let rafId = null;
    let isDestroyed = false;
    const start = performance.now();

    // Reduced motion: an idle orb is drawn once and held still. Listening/thinking still
    // animate, because there the motion is the state indication.
    const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const shouldHoldStill = () => !!(reduceMotion && reduceMotion.matches && config.state === 'idle');
    const resume = () => { if (!isDestroyed && !rafId) frame(); };
    if (reduceMotion && reduceMotion.addEventListener) reduceMotion.addEventListener('change', resume);

    function frame() {
        rafId = null;
        if (isDestroyed) return;
        const t = (performance.now() - start) * 0.001;
        const stateVal = config.state === 'thinking' ? 2.0 : (config.state === 'listening' ? 1.0 : 0.0);

        // High-DPI Retina resolution sync (auto-adapts up to 3x on mobile OLED / Super Retina displays)
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const displayW = canvas.clientWidth || 180;
        const displayH = canvas.clientHeight || 180;
        const targetW = Math.round(displayW * dpr);
        const targetH = Math.round(displayH * dpr);
        if (targetW > 0 && targetH > 0 && (canvas.width !== targetW || canvas.height !== targetH)) {
            canvas.width = targetW;
            canvas.height = targetH;
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.uniform1f(u.time, t);
        gl.uniform2f(u.res, canvas.width, canvas.height);
        gl.uniform1f(u.state, stateVal);
        gl.uniform1f(u.speed, config.speed);
        gl.uniform1f(u.glass, config.creaseSharpness);
        gl.uniform1f(u.scale, config.scale);
        gl.uniform1f(u.white, config.whiteIntensity);

        gl.uniform3fv(u.c0, config.colors.c0);
        gl.uniform3fv(u.c1, config.colors.c1);
        gl.uniform3fv(u.c2, config.colors.c2);
        gl.uniform3fv(u.c3, config.colors.c3);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (shouldHoldStill()) return;
        rafId = requestAnimationFrame(frame);
    }

    frame();

    return {
        setState: (newState) => { config.state = newState; resume(); },
        setSpeed: (val) => { config.speed = val; },
        setScale: (val) => { config.scale = val; },
        setWhiteIntensity: (val) => { config.whiteIntensity = val; },
        setCreaseSharpness: (val) => { config.creaseSharpness = val; },
        destroy: () => {
            isDestroyed = true;
            if (rafId) cancelAnimationFrame(rafId);
            if (reduceMotion && reduceMotion.removeEventListener) reduceMotion.removeEventListener('change', resume);
            try {
                gl.deleteProgram(program);
                gl.deleteShader(vs);
                gl.deleteShader(fs);
                gl.deleteBuffer(buffer);
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
            state: _poppyOrbState,
            speed: 0.8,
            creaseSharpness: 0.90,
            scale: 1.4,
            whiteIntensity: 0.35
        });
    }
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
