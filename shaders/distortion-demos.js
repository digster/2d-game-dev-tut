// =============================================================================
// SHADERS TRACK — DISTORTION / GLITCH / VERTEX-FX TIER — PAGE-SIDE DEMOS
// =============================================================================
// Bend the image itself: remap the sampling UV (swirl, lens, kaleidoscope),
// tear the channels (RGB-shift, VHS, datamosh), or move actual geometry in a
// VERTEX shader (the only vertex demo in the track — every other tier is a
// full-screen fragment quad). Six fragment demos share a reference scene
// `dscene(uv)` (palette + grid + ring) so every warp is obvious; the seventh
// uses a new tiny harness, makeMeshToy.
//
// WebGL1 / GLSL ES 1.00. KEY RULE (learned the hard way): a JS-interpolated
// number becomes an INT literal in GLSL and int*float is a hard error — every
// \${n} that feeds float math is written \${n}.0.
// =============================================================================

// -----------------------------------------------------------------------------
// Shared WebGL helpers (verbatim copy of intermediate-demos.js — keep identical)
// -----------------------------------------------------------------------------

function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('Shader compile failed:\n' + log);
    }
    return sh;
}

function createShaderProgram(gl, vertSrc, fragSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog);
        gl.deleteProgram(prog);
        throw new Error('Program link failed:\n' + log);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
}

const SH_VERT_SRC = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

function setupFullscreenQuad(gl, program) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return buf;
}

function makeShaderToy(canvas, fragSrc, opts) {
    opts = opts || {};
    const info = opts.info || null;
    let timeScale = opts.timeScale != null ? opts.timeScale : 1;
    let paused = !!opts.paused;
    let uParam = opts.param != null ? opts.param : 0;
    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    function fail(msg, gl) {
        console.error(msg);
        if (info) { info.textContent = msg; info.style.color = '#ff7b72'; }
        if (gl) {
            gl.clearColor(0.23, 0.05, 0.07, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        } else {
            const c2d = canvas.getContext('2d');
            if (c2d) {
                c2d.fillStyle = '#3a0d12';
                c2d.fillRect(0, 0, canvas.width, canvas.height);
                c2d.fillStyle = '#ff7b72';
                c2d.font = '13px monospace';
                String(msg).split('\n').forEach((line, i) =>
                    c2d.fillText(line.slice(0, 92), 12, 24 + i * 18));
            }
        }
    }

    const noop = { stop() {}, setFrag() {}, setParam() {}, setPaused() {}, setTimeScale() {} };
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { fail('WebGL is not available in this browser/context.', null); return noop; }

    let program = null, quadBuf = null, uTime, uRes, uMouse, uP;
    function build(src) {
        try {
            const next = createShaderProgram(gl, SH_VERT_SRC, src);
            if (program) gl.deleteProgram(program);
            program = next;
            gl.useProgram(program);
            if (quadBuf) gl.deleteBuffer(quadBuf);
            quadBuf = setupFullscreenQuad(gl, program);
            uTime = gl.getUniformLocation(program, 'u_time');
            uRes = gl.getUniformLocation(program, 'u_resolution');
            uMouse = gl.getUniformLocation(program, 'u_mouse');
            uP = gl.getUniformLocation(program, 'u_param');
            if (info) info.style.color = '';
            return true;
        } catch (e) {
            fail(e && e.message ? e.message : String(e), gl);
            return false;
        }
    }
    if (!build(fragSrc)) {
        return { stop() {}, setFrag: build, setParam(v) { uParam = v; },
                 setPaused() {}, setTimeScale() {} };
    }

    const onMove = (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        mouse.y = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
    };
    const onLeave = () => { mouse.x = canvas.width / 2; mouse.y = canvas.height / 2; };
    const onLost = (e) => e.preventDefault();
    const onRestored = () => build(fragSrc);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    let raf = 0, acc = 0, last = performance.now();
    function frame(now) {
        if (!paused) acc += (now - last) * 0.001 * timeScale;
        last = now;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
        if (uTime) gl.uniform1f(uTime, acc);
        if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
        if (uP) gl.uniform1f(uP, uParam);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
        stop() { cancelAnimationFrame(raf); },
        setFrag(src) { build(src); },
        setParam(v) { uParam = v; },
        setPaused(b) { paused = b; if (!b) last = performance.now(); },
        setTimeScale(s) { timeScale = s; },
        destroy() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseleave', onLeave);
            canvas.removeEventListener('webglcontextlost', onLost, false);
            canvas.removeEventListener('webglcontextrestored', onRestored, false);
            try {
                if (program) gl.deleteProgram(program);
                if (quadBuf) gl.deleteBuffer(quadBuf);
            } catch (e) { /* context may already be lost */ }
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
        }
    };
}

// -----------------------------------------------------------------------------
// makeMeshToy — the ONLY non-fullscreen-quad runner in the track.
// Builds a GRID×GRID triangulated mesh (a_position clip-xy, a_uv 0..1), runs a
// USER vertex shader (which may displace vertices) + USER fragment shader, with
// the same uniforms as makeShaderToy in BOTH stages. Returns the makeShaderToy
// handle shape PLUS rebuild({vert,frag}) — and because shared/lazy-demo.js's
// LAZY_DEMO_METHODS already lists 'rebuild', lazyToy records/replays preset
// switches for free. No edits to shared/.
// -----------------------------------------------------------------------------
function makeMeshToy(canvas, vertSrc, fragSrc, opts) {
    opts = opts || {};
    const info = opts.info || null;
    let paused = !!opts.paused;
    let uParam = opts.param != null ? opts.param : 0;
    const GRID = opts.grid || 56;
    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    function fail(msg, gl) {
        console.error(msg);
        if (info) { info.textContent = msg; info.style.color = '#ff7b72'; }
        if (gl) { gl.clearColor(0.23, 0.05, 0.07, 1.0); gl.clear(gl.COLOR_BUFFER_BIT); }
        else {
            const c2d = canvas.getContext('2d');
            if (c2d) {
                c2d.fillStyle = '#3a0d12'; c2d.fillRect(0, 0, canvas.width, canvas.height);
                c2d.fillStyle = '#ff7b72'; c2d.font = '13px monospace';
                String(msg).split('\n').forEach((l, i) => c2d.fillText(l.slice(0, 92), 12, 24 + i * 18));
            }
        }
    }
    const noop = { stop() {}, setParam() {}, setPaused() {}, rebuild() {} };
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { fail('WebGL is not available in this browser/context.', null); return noop; }

    // Interleaved [x, y, u, v] per vertex; two triangles per grid cell.
    const verts = [];
    for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
            const u0 = gx / GRID, u1 = (gx + 1) / GRID;
            const v0 = gy / GRID, v1 = (gy + 1) / GRID;
            const X = (u) => u * 1.7 - 0.85, Y = (v) => v * 1.7 - 0.85;
            verts.push(X(u0), Y(v0), u0, v0,  X(u1), Y(v0), u1, v0,  X(u0), Y(v1), u0, v1);
            verts.push(X(u1), Y(v0), u1, v0,  X(u1), Y(v1), u1, v1,  X(u0), Y(v1), u0, v1);
        }
    }
    const vertData = new Float32Array(verts);
    const vertCount = verts.length / 4;

    let program = null, buf = null, uTime, uRes, uMouse, uP;
    function build(vsrc, fsrc) {
        try {
            const next = createShaderProgram(gl, vsrc, fsrc);
            if (program) gl.deleteProgram(program);
            program = next;
            gl.useProgram(program);
            if (!buf) {
                buf = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.STATIC_DRAW);
            } else {
                gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            }
            const pl = gl.getAttribLocation(program, 'a_position');
            const ul = gl.getAttribLocation(program, 'a_uv');
            gl.enableVertexAttribArray(pl);
            gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 16, 0);
            if (ul >= 0) {
                gl.enableVertexAttribArray(ul);
                gl.vertexAttribPointer(ul, 2, gl.FLOAT, false, 16, 8);
            }
            uTime = gl.getUniformLocation(program, 'u_time');
            uRes = gl.getUniformLocation(program, 'u_resolution');
            uMouse = gl.getUniformLocation(program, 'u_mouse');
            uP = gl.getUniformLocation(program, 'u_param');
            if (info) info.style.color = '';
            return true;
        } catch (e) {
            fail(e && e.message ? e.message : String(e), gl);
            return false;
        }
    }
    let curVert = vertSrc, curFrag = fragSrc;
    if (!build(curVert, curFrag)) {
        return { stop() {}, setParam(v) { uParam = v; }, setPaused() {},
                 rebuild(s) { curVert = s.vert; curFrag = s.frag; build(curVert, curFrag); } };
    }

    const onMove = (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        mouse.y = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
    };
    const onLeave = () => { mouse.x = canvas.width / 2; mouse.y = canvas.height / 2; };
    const onLost = (e) => e.preventDefault();
    const onRestored = () => build(curVert, curFrag);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    let raf = 0, acc = 0, last = performance.now();
    function frame(now) {
        if (!paused) acc += (now - last) * 0.001;
        last = now;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.03, 0.04, 0.07, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
        if (uTime) gl.uniform1f(uTime, acc);
        if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
        if (uP) gl.uniform1f(uP, uParam);
        gl.drawArrays(gl.TRIANGLES, 0, vertCount);
        raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return {
        stop() { cancelAnimationFrame(raf); },
        setParam(v) { uParam = v; },
        setPaused(b) { paused = b; if (!b) last = performance.now(); },
        rebuild(s) { curVert = s.vert; curFrag = s.frag; build(curVert, curFrag); },
        destroy() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseleave', onLeave);
            canvas.removeEventListener('webglcontextlost', onLost, false);
            canvas.removeEventListener('webglcontextrestored', onRestored, false);
            try {
                if (program) gl.deleteProgram(program);
                if (buf) gl.deleteBuffer(buf);
            } catch (e) { /* context may already be lost */ }
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
        }
    };
}

// -----------------------------------------------------------------------------
// Shared reference scene for the six UV-warp demos: an IQ-palette gradient with
// a bright grid and a centre ring, so every distortion is unmistakable.
// -----------------------------------------------------------------------------
const D_HEAD = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_param;
`;
const D_SCENE = `vec3 dscene(vec2 uv) {
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (uv.x * 0.6 + uv.y * 0.35 + 0.05 * u_time) + vec3(0.0, 2.0, 4.0));
  vec2 gl = abs(fract(uv * 9.0) - 0.5);
  float grid = smoothstep(0.46, 0.49, max(gl.x, gl.y));
  col = mix(col, vec3(0.04, 0.04, 0.06), grid * 0.75);
  float ring = smoothstep(0.018, 0.0, abs(length(uv - 0.5) - 0.28));
  col = mix(col, vec3(1.0), ring * 0.7);
  float oob = step(uv.x, 0.0) + step(1.0, uv.x) + step(uv.y, 0.0) + step(1.0, uv.y);
  return mix(col, vec3(0.02, 0.02, 0.03), clamp(oob, 0.0, 1.0));
}
`;

// =============================================================================
// DEMO 1 — swirlGL  (§ Swirl / Pinch / Bulge)
// =============================================================================
(function swirlShader() {
    const canvas = document.getElementById('swirlGL');
    if (!canvas) return;
    const info = document.getElementById('swirlGLInfo');

    const WARP = {
        swirl: 'a += (0.6 + 1.8 * u_param) * exp(-r * 4.0);',
        pinch: 'r *= mix(1.0, smoothstep(0.0, 0.5, r), 0.5 + 0.9 * u_param);',
        bulge: 'r = pow(r, 1.0 - 0.55 * clamp(u_param, 0.0, 0.95));'
    };
    function buildFrag(mode) {
        return D_HEAD + D_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 ctr = u_mouse / u_resolution;
  vec2 d = uv - ctr;
  float r = length(d);
  float a = atan(d.y, d.x);
  ${WARP[mode]}
  vec2 wuv = ctr + vec2(cos(a), sin(a)) * r;
  gl_FragColor = vec4(dscene(wuv), 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('swirl'), { info: info, param: 0.6 }));
    function set(m, msg) { toy.setFrag(buildFrag(m)); info.textContent = msg; }
    document.getElementById('btnSwSwirl')?.addEventListener('click', () =>
        set('swirl', 'Swirl — rotate by an angle that decays with radius. Move the mouse.'));
    document.getElementById('btnSwPinch')?.addEventListener('click', () =>
        set('pinch', 'Pinch — pull radius inward (a black-hole / portal suck).'));
    document.getElementById('btnSwBulge')?.addEventListener('click', () =>
        set('bulge', 'Bulge — pow(r, <1) magnifies the centre (a fish lens).'));
    document.getElementById('btnSwStrong')?.addEventListener('click', () => {
        toy.setParam(1.6); info.textContent = 'Stronger — u_param scales the warp amount.';
    });
})();

// =============================================================================
// DEMO 2 — lensGL  (§ Fisheye / Barrel / Pincushion)
// =============================================================================
(function lensShader() {
    const canvas = document.getElementById('lensGL');
    if (!canvas) return;
    const info = document.getElementById('lensGLInfo');
    function buildFrag(sign) {
        return D_HEAD + D_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  float k = ${sign} * (0.35 + 1.4 * u_param);   // lens distortion coefficient
  vec2 luv = 0.5 + c * (1.0 + k * r2);
  gl_FragColor = vec4(dscene(luv), 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('-1.0'), { info: info, param: 0.5 }));
    document.getElementById('btnLensBarrel')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('-1.0')); info.textContent = 'Barrel — edges bow out (a GoPro / fisheye look).';
    });
    document.getElementById('btnLensPin')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('1.0')); info.textContent = 'Pincushion — edges pinch in (a cheap-lens artefact).';
    });
    document.getElementById('btnLensStrong')?.addEventListener('click', () => {
        toy.setParam(1.5); info.textContent = 'Stronger — r·r makes it grow toward the corners.';
    });
    document.getElementById('btnLensSubtle')?.addEventListener('click', () => {
        toy.setParam(0.2); info.textContent = 'Subtle — a believable in-game camera amount.';
    });
})();

// =============================================================================
// DEMO 3 — kaleidoGL  (§ Kaleidoscope / Mirror Symmetry)
// =============================================================================
(function kaleidoShader() {
    const canvas = document.getElementById('kaleidoGL');
    if (!canvas) return;
    const info = document.getElementById('kaleidoGLInfo');
    function buildFrag(seg) {
        return D_HEAD + D_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 c = uv - 0.5;
  float r = length(c);
  float a = atan(c.y, c.x) + u_time * 0.15;
  float wedge = 6.28318 / ${seg}.0;
  a = mod(a, wedge);
  a = abs(a - wedge * 0.5);                       // mirror inside the wedge
  vec2 kuv = 0.5 + vec2(cos(a), sin(a)) * r;
  gl_FragColor = vec4(dscene(kuv), 1.0);
}`;
    }
    const state = { seg: 8 };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(8), { info: info }));
    function set(n, msg) { state.seg = n; toy.setFrag(buildFrag(n)); info.textContent = msg; }
    document.getElementById('btnKal6')?.addEventListener('click', () => set(6, '6-fold — a classic kaleidoscope.'));
    document.getElementById('btnKal8')?.addEventListener('click', () => set(8, '8-fold — denser radial symmetry.'));
    document.getElementById('btnKal12')?.addEventListener('click', () => set(12, '12-fold — a mandala. Segment count is structural → rebuild.'));
    document.getElementById('btnKal3')?.addEventListener('click', () => set(3, '3-fold — bold triangular symmetry.'));
})();

// =============================================================================
// DEMO 4 — rgbshiftGL  (§ Chromatic Aberration & RGB-Shift)
// =============================================================================
(function rgbshiftShader() {
    const canvas = document.getElementById('rgbshiftGL');
    if (!canvas) return;
    const info = document.getElementById('rgbshiftGLInfo');
    const DIR = {
        ca: 'vec2 dir = (uv - 0.5);',
        shift: 'vec2 dir = vec2(1.0, 0.0) + vec2(0.0, 0.15 * sin(u_time * 20.0));'
    };
    function buildFrag(mode) {
        return D_HEAD + D_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  ${DIR[mode]}
  float k = 0.004 + u_param * 0.03;
  vec3 col;
  col.r = dscene(uv + dir * k).r;
  col.g = dscene(uv).g;
  col.b = dscene(uv - dir * k).b;
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('ca'), { info: info, param: 0.4 }));
    document.getElementById('btnRgbCA')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('ca')); info.textContent = 'Radial CA — split grows toward the edges (a real lens).';
    });
    document.getElementById('btnRgbShift')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('shift')); info.textContent = 'Lateral RGB-shift — a wobbling digital glitch.';
    });
    document.getElementById('btnRgbStrong')?.addEventListener('click', () => {
        toy.setParam(1.4); info.textContent = 'Stronger — wider channel separation.';
    });
})();

// =============================================================================
// DEMO 5 — vhsGL  (§ VHS / Tape Distortion)
// =============================================================================
(function vhsShader() {
    const canvas = document.getElementById('vhsGL');
    if (!canvas) return;
    const info = document.getElementById('vhsGLInfo');
    function buildFrag(heavy) {
        const amp = heavy ? '1.8' : '0.7';
        return D_HEAD + D_SCENE + `float h11(float x){ return fract(sin(x * 78.233) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float A = ${amp};
  float band = floor(uv.y * 24.0);
  float jit = (h11(band + floor(u_time * 12.0)) - 0.5) * 0.03 * A;        // line jitter
  float wob = sin(uv.y * 8.0 + u_time * 2.0) * 0.004 * A;                 // tape wobble
  vec2 suv = uv + vec2(jit + wob, 0.0);
  vec3 col;
  col.r = dscene(suv + vec2(0.004 * A, 0.0)).r;
  col.g = dscene(suv).g;
  col.b = dscene(suv - vec2(0.004 * A, 0.0)).b;
  float scan = 0.85 + 0.15 * sin(uv.y * u_resolution.y * 1.6);            // scanlines
  float noise = (h11(uv.y * 700.0 + u_time * 50.0) - 0.5) * 0.10 * A;     // tape grain
  col = col * scan + noise;
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(false), { info: info }));
    document.getElementById('btnVhsOn')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(false)); info.textContent = 'VHS — line jitter, tape wobble, chroma bleed, scanlines, grain.';
    });
    document.getElementById('btnVhsHeavy')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(true)); info.textContent = 'Heavy — a badly degraded, chewed-up tape.';
    });
})();

// =============================================================================
// DEMO 6 — glitchBlockGL  (§ Datamosh / Block Slice Glitch)
// =============================================================================
(function glitchBlockShader() {
    const canvas = document.getElementById('glitchBlockGL');
    if (!canvas) return;
    const info = document.getElementById('glitchBlockGLInfo');
    function buildFrag(burst) {
        const thr = burst ? '0.45' : '0.78';
        return D_HEAD + D_SCENE + `float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float seg = floor(u_time * 3.0);
  float slice = floor(uv.y * 14.0);
  float hs = h2(vec2(slice, seg));
  float on = step(${thr}, fract(hs * 7.0 + u_time));
  vec2 g = uv;
  g.x += (hs - 0.5) * 0.35 * on;                       // slice X displacement
  vec2 blk = floor(uv * vec2(28.0, 16.0));
  float hb = h2(blk + seg);
  if (hb > 0.86) g += (vec2(hb, fract(hb * 13.0)) - 0.5) * 0.18 * on;
  vec3 col;
  col.r = dscene(g + vec2(0.01 * on, 0.0)).r;
  col.g = dscene(g).g;
  col.b = dscene(g - vec2(0.01 * on, 0.0)).b;
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(false), { info: info }));
    document.getElementById('btnGbCalm')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(false)); info.textContent = 'Glitch — sparse time-quantised slice + block displacement.';
    });
    document.getElementById('btnGbBurst')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(true)); info.textContent = 'Burst — most slices tear (a hard corruption stinger).';
    });
})();

// =============================================================================
// DEMO 7 — vertfxGL  (§ Mini-Project: Vertex FX — Jelly / Wind / Flag)
// The ONLY vertex-shader demo: a real triangulated mesh, deformed in the
// vertex stage. Uses makeMeshToy. Mode is structural → rebuild({vert,frag}).
// =============================================================================
(function vertfxDemo() {
    const canvas = document.getElementById('vertfxGL');
    if (!canvas) return;
    const info = document.getElementById('vertfxGLInfo');

    const FRAG = `precision mediump float;
varying vec2 v_uv;
varying float v_shade;
void main() {
  vec2 g = abs(fract(v_uv * 12.0) - 0.5);
  float grid = smoothstep(0.42, 0.47, max(g.x, g.y));
  vec3 cloth = 0.5 + 0.5 * cos(6.2831 * (v_uv.x * 0.5 + v_uv.y * 0.5) + vec3(0.0, 2.2, 4.2));
  cloth = mix(cloth * 0.85, vec3(0.05, 0.06, 0.10), grid);
  cloth *= 0.55 + 0.65 * v_shade;                 // shade from the vertex displacement
  gl_FragColor = vec4(cloth, 1.0);
}`;

    function buildVert(mode) {
        const DISP = {
            calm:  'float dz = 0.0;',
            jelly: 'float dz = sin(a_uv.x * 6.0 + u_time * 5.0) * sin(a_uv.y * 6.0 + u_time * 4.0) * 0.10 * (0.4 + u_param);',
            wind:  'float dz = sin(a_uv.x * 5.0 + u_time * 3.0) * 0.10 * a_uv.y * (0.5 + u_param);',
            flag:  'float dz = sin(a_uv.x * 9.0 - u_time * 6.0) * 0.09 * a_uv.x * (0.5 + u_param);'
        };
        return `precision mediump float;
attribute vec2 a_position;
attribute vec2 a_uv;
uniform float u_time;
uniform float u_param;
uniform vec2 u_mouse;
uniform vec2 u_resolution;
varying vec2 v_uv;
varying float v_shade;
void main() {
  v_uv = a_uv;
  ${DISP[mode]}
  vec2 p = a_position;
  p.x += dz * 0.6;
  p.y += dz;
  // a soft grab: pull the mesh near the cursor toward it
  vec2 m = u_mouse / u_resolution * 1.7 - 0.85;
  p += (m - a_position) * smoothstep(0.30, 0.0, distance(a_position, m)) * 0.5;
  v_shade = 0.5 + dz * 3.0;
  gl_Position = vec4(p, 0.0, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeMeshToy(cv, buildVert('flag'), FRAG, { info: info, param: 0.6 }));
    function set(m, msg) { toy.rebuild({ vert: buildVert(m), frag: FRAG }); info.textContent = msg; }
    document.getElementById('btnVfxFlag')?.addEventListener('click', () =>
        set('flag', 'Flag — a travelling wave, amplitude growing along x. Real geometry moves.'));
    document.getElementById('btnVfxJelly')?.addEventListener('click', () =>
        set('jelly', 'Jelly — a 2-D standing wave: the mesh wobbles like gelatin.'));
    document.getElementById('btnVfxWind')?.addEventListener('click', () =>
        set('wind', 'Wind — sway that increases up the cloth (a banner in a breeze).'));
    document.getElementById('btnVfxCalm')?.addEventListener('click', () =>
        set('calm', 'Calm — the flat rest mesh (vertex shader = identity).'));
})();
