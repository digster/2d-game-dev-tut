// =============================================================================
// SHADERS TRACK — BEGINNER TIER — PAGE-SIDE INTERACTIVE DEMOS
// =============================================================================
// Each demo is a self-contained IIFE that bails out (`if (!canvas) return;`)
// when its canvas isn't on the page, so this one file is safe to load on any
// tier page. The WebGL helpers below are the REAL implementations; their
// stringified twins live in bundles-beginner.js for the 📋 Export feature.
// Keep the two in sync.
//
// GLSL shader sources are written as multi-line template literals — this is
// plain JS (not nested inside another template literal), so no escaping is
// needed. The bundle twins escape only their delimiter backticks.
// =============================================================================

// -----------------------------------------------------------------------------
// Shared WebGL helpers (real functions — exported copies are in bundles-beginner.js)
// -----------------------------------------------------------------------------

// Compile one shader stage. On failure, surface the driver's info log loudly
// instead of letting a typo produce a silent blank canvas.
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

// Compile vertex + fragment, link, and surface link errors loudly.
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

// The whole screen is two triangles in clip space. The vertex shader is a
// pass-through; everything interesting happens per-pixel in the fragment shader.
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

// The runner. Write a fragment shader; this wires the quad, the standard
// uniforms (u_time s, u_resolution px, u_mouse px Y-flipped, u_param float),
// the render loop, context-loss recovery, and loud error reporting.
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
            gl.clearColor(0.23, 0.05, 0.07, 1.0);   // unmistakable dark red
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
        // Full teardown so the lazy wrapper can free the WebGL context when the
        // demo scrolls off-screen (delete GL objects, then lose the context).
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

// =============================================================================
// DEMO 1 — cpuVsGpu  (§ What Is a Shader?)
// A plain 2D-canvas explainer (no WebGL): "CPU draws shapes one at a time"
// vs "GPU colors every pixel at once". Conceptual only — not exported.
// =============================================================================
(function cpuVsGpuDemo() {
    const canvas = document.getElementById('cpuVsGpu');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('cpuVsGpuInfo');

    let mode = 'cpu';
    let raf = 0;

    function clear() {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // CPU model: a single "draw cursor" visits shapes one after another.
    function renderCPU(t) {
        clear();
        const shapes = 6;
        const active = Math.floor((t / 500) % shapes);
        for (let i = 0; i < shapes; i++) {
            const x = 90 + i * 110;
            const y = canvas.height / 2;
            ctx.beginPath();
            ctx.arc(x, y, 36, 0, Math.PI * 2);
            ctx.fillStyle = i < active ? '#388e3c'
                          : i === active ? '#ffa726' : '#2a3550';
            ctx.fill();
            ctx.strokeStyle = '#4fc3f7';
            ctx.stroke();
        }
        const cx = 90 + active * 110;
        ctx.fillStyle = '#ff7043';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('draw cursor', cx, canvas.height / 2 - 60);
        ctx.fillText('▼', cx, canvas.height / 2 - 44);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#9e9e9e';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('CPU: one object at a time, sequentially (a for-loop over shapes).', 24, 40);
    }

    // GPU model: every pixel gets its color "at once" — a wave of all cells.
    function renderGPU(t) {
        clear();
        const cell = 20;
        const cols = Math.floor(canvas.width / cell);
        const rows = Math.floor(canvas.height / cell);
        for (let gy = 0; gy < rows; gy++) {
            for (let gx = 0; gx < cols; gx++) {
                const wave = 0.5 + 0.5 * Math.sin(
                    (gx + gy) * 0.4 + t * 0.004);
                ctx.fillStyle = `rgb(${Math.floor(40 + wave * 40)},`
                    + `${Math.floor(120 + wave * 110)},`
                    + `${Math.floor(150 + wave * 90)})`;
                ctx.fillRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
            }
        }
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('GPU: every pixel runs the same program in parallel — '
            + 'no per-object loop.', 24, 40);
    }

    function loop(now) {
        if (mode === 'cpu') renderCPU(now); else renderGPU(now);
        raf = requestAnimationFrame(loop);
    }

    document.getElementById('btnPipelineCPU')?.addEventListener('click', () => {
        mode = 'cpu';
        if (info) info.textContent = 'CPU mental model: a loop visits each shape in turn.';
    });
    document.getElementById('btnPipelineGPU')?.addEventListener('click', () => {
        mode = 'gpu';
        if (info) info.textContent = 'GPU mental model: all pixels shaded together, every frame.';
    });

    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 2 — firstGL  (§ Your First Fragment Shader)
// =============================================================================
(function firstShader() {
    const canvas = document.getElementById('firstGL');
    if (!canvas) return;
    const info = document.getElementById('firstGLInfo');

    // gl_FragColor is the OUTPUT color, vec4(r, g, b, a), channels 0.0–1.0.
    function solid(r, g, b) {
        return `precision mediump float;
void main() {
  gl_FragColor = vec4(${r}, ${g}, ${b}, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, solid('0.90', '0.25', '0.22'), { info: info }));

    document.getElementById('btnColRed')?.addEventListener('click', () => {
        toy.setFrag(solid('0.90', '0.25', '0.22'));
        info.textContent = 'gl_FragColor = vec4(0.90, 0.25, 0.22, 1.0)';
    });
    document.getElementById('btnColTeal')?.addEventListener('click', () => {
        toy.setFrag(solid('0.20', '0.78', '0.70'));
        info.textContent = 'gl_FragColor = vec4(0.20, 0.78, 0.70, 1.0)';
    });
    document.getElementById('btnColBlue')?.addEventListener('click', () => {
        toy.setFrag(solid('0.31', '0.76', '0.97'));
        info.textContent = 'gl_FragColor = vec4(0.31, 0.76, 0.97, 1.0)';
    });
})();

// =============================================================================
// DEMO 3 — uvGL  (§ UV Coordinates)
// =============================================================================
(function uvShader() {
    const canvas = document.getElementById('uvGL');
    if (!canvas) return;
    const info = document.getElementById('uvGLInfo');

    // Raw uv: bottom-left (0,0) → top-right (1,1).
    const RAW = `precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = vec4(uv, 0.0, 1.0);
}`;

    // Centered: remap to -1..1 so (0,0) is the middle.
    const CENTERED = `precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution * 2.0 - 1.0;
  gl_FragColor = vec4(uv * 0.5 + 0.5, 0.0, 1.0);
}`;

    // Aspect-corrected: scale x by the aspect ratio so a circle is round.
    const ASPECT = `precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;
  float d = step(length(uv), 0.6);
  gl_FragColor = vec4(vec3(d), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, RAW, { info: info }));

    document.getElementById('btnUvRaw')?.addEventListener('click', () => {
        toy.setFrag(RAW); info.textContent = 'Raw uv 0..1 — red grows right, green grows up.';
    });
    document.getElementById('btnUvCentered')?.addEventListener('click', () => {
        toy.setFrag(CENTERED); info.textContent = 'Remapped to -1..1 — origin is the center.';
    });
    document.getElementById('btnUvAspect')?.addEventListener('click', () => {
        toy.setFrag(ASPECT); info.textContent = 'Aspect-corrected — the circle is actually round.';
    });
})();

// =============================================================================
// DEMO 4 — shapingGL  (§ Shaping Functions)
// =============================================================================
(function shapingShader() {
    const canvas = document.getElementById('shapingGL');
    if (!canvas) return;
    const info = document.getElementById('shapingGLInfo');

    // length(uv - center) is a distance field; smoothstep makes a soft edge.
    // u_param (set from JS) widens/narrows the smoothstep band.
    const CIRCLE = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_param;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float c = u_resolution.x / u_resolution.y * 0.5;
  float d = distance(uv, vec2(c, 0.5));
  float m = 1.0 - smoothstep(0.28, 0.28 + u_param, d);
  gl_FragColor = vec4(vec3(m) * vec3(0.31, 0.76, 0.97), 1.0);
}`;

    // fract() tiles space; step() turns the sawtooth into hard bars.
    const STRIPES = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_param;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float bars = step(0.5, fract(uv.x * 10.0));
  float m = mix(0.12, 1.0, bars);
  gl_FragColor = vec4(vec3(m) * vec3(0.40, 0.85, 0.55), 1.0);
}`;

    let softness = 0.03;
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, CIRCLE, { info: info, param: softness }));

    document.getElementById('btnShapeCircle')?.addEventListener('click', () => {
        toy.setFrag(CIRCLE); info.textContent = 'Distance field + smoothstep → a soft circle.';
    });
    document.getElementById('btnShapeStripes')?.addEventListener('click', () => {
        toy.setFrag(STRIPES); info.textContent = 'fract() + step() → hard repeating bars.';
    });
    document.getElementById('btnShapeSofter')?.addEventListener('click', () => {
        softness = Math.min(softness + 0.03, 0.4);
        toy.setParam(softness);
        info.textContent = 'Edge softness u_param = ' + softness.toFixed(2);
    });
    document.getElementById('btnShapeSharper')?.addEventListener('click', () => {
        softness = Math.max(softness - 0.03, 0.001);
        toy.setParam(softness);
        info.textContent = 'Edge softness u_param = ' + softness.toFixed(2);
    });
})();

// =============================================================================
// DEMO 4b — transformsGL  (§ 2D Transforms)
// Translate/scale/rotate happen to the SPACE (uv), not the shape. A 2x2
// rotation matrix is the whole trick; one transform line is injected so the
// buttons swap behaviour with no WebGL plumbing (same pattern as waterGL).
// =============================================================================
(function transformsShader() {
    const canvas = document.getElementById('transformsGL');
    if (!canvas) return;
    const info = document.getElementById('transformsGLInfo');

    function buildFrag(xform) {
        return `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 p = uv;
  ${xform}
  float d = sdBox(p, vec2(0.42, 0.30));
  float m = 1.0 - smoothstep(0.0, 0.02, d);
  gl_FragColor = vec4(mix(vec3(0.05, 0.07, 0.15), vec3(0.31, 0.76, 0.97), m), 1.0);
}`;
    }

    const MODES = {
        translate: 'p -= vec2(0.45 * sin(u_time * 1.2), 0.0);',
        scale:     'p /= (0.7 + 0.35 * sin(u_time * 1.5));',
        rotate:    'p = rot(u_time * 0.9) * p;',
        all:       'p = rot(u_time * 0.7) * p;\n  p /= (0.85 + 0.2 * sin(u_time));\n  p -= vec2(0.22 * sin(u_time * 1.3), 0.0);'
    };

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(MODES.rotate), { info: info }));
    function set(mode, msg) { toy.setFrag(buildFrag(MODES[mode])); info.textContent = msg; }

    document.getElementById('btnXfTranslate')?.addEventListener('click', () =>
        set('translate', 'Translate: p -= offset re-centers the space; the box behaves as if at offset.'));
    document.getElementById('btnXfScale')?.addEventListener('click', () =>
        set('scale', 'Scale: dividing p zooms — a smaller divisor makes a bigger shape.'));
    document.getElementById('btnXfRotate')?.addEventListener('click', () =>
        set('rotate', 'Rotate: a 2x2 rotation matrix spins the whole plane around the origin.'));
    document.getElementById('btnXfAll')?.addEventListener('click', () =>
        set('all', 'All three composed — order matters: rotate, then scale, then translate.'));
})();

// =============================================================================
// DEMO 4c — polarGL  (§ Polar Coordinates)
// r = length(uv), a = atan(uv.y, uv.x). Radius + angle = every "round" effect.
// =============================================================================
(function polarShader() {
    const canvas = document.getElementById('polarGL');
    if (!canvas) return;
    const info = document.getElementById('polarGLInfo');

    const HEAD = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
#define TAU 6.2831853
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;
  float r = length(uv);
  float a = atan(uv.y, uv.x);
`;

    const RADIUS = HEAD + `  vec3 col = mix(vec3(0.31, 0.76, 0.97), vec3(0.04, 0.06, 0.12), clamp(r, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

    const ANGLE = HEAD + `  float seg = step(0.5, fract((a / TAU + 0.5) * 6.0));
  vec3 col = mix(vec3(0.10, 0.20, 0.35), vec3(1.0, 0.65, 0.30), seg);
  gl_FragColor = vec4(col, 1.0);
}`;

    const COOLDOWN = HEAD + `  float ang = atan(uv.x, -uv.y) / TAU + 0.5;   // 0 at top, clockwise
  float fill = fract(u_time * 0.25);
  float ring = step(r, 0.72) * (1.0 - step(r, 0.48));
  float ready = step(ang, fill);
  vec3 col = mix(vec3(0.10, 0.12, 0.20), vec3(0.31, 0.76, 0.97),
                 ring * mix(0.18, 1.0, ready));
  gl_FragColor = vec4(col, 1.0);
}`;

    const SPIRAL = HEAD + `  float s = 0.5 + 0.5 * sin(a * 5.0 + r * 26.0 - u_time * 3.0);
  vec3 col = mix(vec3(0.04, 0.06, 0.12), vec3(0.40, 0.85, 0.70), s * (1.0 - r));
  gl_FragColor = vec4(col, 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, RADIUS, { info: info }));
    document.getElementById('btnPolarRadius')?.addEventListener('click', () => {
        toy.setFrag(RADIUS); info.textContent = 'r = length(uv) → a radial gradient (glow / vignette).';
    });
    document.getElementById('btnPolarAngle')?.addEventListener('click', () => {
        toy.setFrag(ANGLE); info.textContent = 'a = atan(uv.y, uv.x) → angular slices (pie wedges).';
    });
    document.getElementById('btnPolarCooldown')?.addEventListener('click', () => {
        toy.setFrag(COOLDOWN); info.textContent = 'Angle + radius → an ability-cooldown swipe (real game UI).';
    });
    document.getElementById('btnPolarSpiral')?.addEventListener('click', () => {
        toy.setFrag(SPIRAL); info.textContent = 'sin(angle * k + radius * k - time) → a spiral.';
    });
})();

// =============================================================================
// DEMO 4d — sdfCombineGL  (§ Combining Shapes with SDFs)
// Signed distance fields combine with one-liners: min=union, max=intersect,
// max(a,-b)=subtract, smin=smooth blend (metaballs). Op injected per button.
// =============================================================================
(function sdfCombineShader() {
    const canvas = document.getElementById('sdfCombineGL');
    if (!canvas) return;
    const info = document.getElementById('sdfCombineGLInfo');

    function buildFrag(op) {
        return `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;
  float mv = 0.22 * sin(u_time * 1.3);
  float c = sdCircle(uv - vec2(-0.28 + mv, 0.0), 0.40);
  float b = sdBox(uv - vec2(0.28, 0.0), vec2(0.34, 0.34));
  float d = ${op};
  float fill = 1.0 - smoothstep(0.0, 0.012, d);
  vec3 col = mix(vec3(0.05, 0.07, 0.15), vec3(0.31, 0.76, 0.97), fill);
  col += 0.15 * exp(-8.0 * abs(d));
  gl_FragColor = vec4(col, 1.0);
}`;
    }

    const OPS = {
        union:     'min(c, b)',
        intersect: 'max(c, b)',
        subtract:  'max(c, -b)',
        smooth:    'smin(c, b, 0.18)'
    };

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(OPS.union), { info: info }));
    function set(op, msg) { toy.setFrag(buildFrag(OPS[op])); info.textContent = msg; }

    document.getElementById('btnSdfUnion')?.addEventListener('click', () =>
        set('union', 'min(a, b) → UNION: both shapes, whichever edge is closer.'));
    document.getElementById('btnSdfIntersect')?.addEventListener('click', () =>
        set('intersect', 'max(a, b) → INTERSECTION: only where the two overlap.'));
    document.getElementById('btnSdfSubtract')?.addEventListener('click', () =>
        set('subtract', 'max(a, -b) → SUBTRACTION: the box carves the circle.'));
    document.getElementById('btnSdfSmooth')?.addEventListener('click', () =>
        set('smooth', 'smin(a, b, k) → SMOOTH union: a liquid / metaball blend.'));
})();

// =============================================================================
// DEMO 5 — colorGL  (§ Color & Gradients)
// =============================================================================
(function colorShader() {
    const canvas = document.getElementById('colorGL');
    if (!canvas) return;
    const info = document.getElementById('colorGLInfo');

    const LINEAR = `precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  float t = gl_FragCoord.x / u_resolution.x;
  gl_FragColor = vec4(mix(A, B, t), 1.0);
}`;

    const RADIAL = `precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float c = u_resolution.x / u_resolution.y * 0.5;
  float t = clamp(distance(uv, vec2(c, 0.5)) * 1.6, 0.0, 1.0);
  gl_FragColor = vec4(mix(B, A, t), 1.0);
}`;

    const BANDED = `precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  float t = gl_FragCoord.x / u_resolution.x;
  t = floor(t * 6.0) / 6.0;
  gl_FragColor = vec4(mix(A, B, t), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, LINEAR, { info: info }));

    document.getElementById('btnGradLinear')?.addEventListener('click', () => {
        toy.setFrag(LINEAR); info.textContent = 'Linear: t = x / width, mix(A, B, t).';
    });
    document.getElementById('btnGradRadial')?.addEventListener('click', () => {
        toy.setFrag(RADIAL); info.textContent = 'Radial: t = distance from center.';
    });
    document.getElementById('btnGradBanded')?.addEventListener('click', () => {
        toy.setFrag(BANDED); info.textContent = 'Banded: floor(t * 6) / 6 → posterized.';
    });
})();

// =============================================================================
// DEMO 6 — timeGL  (§ Animation with u_time)
// =============================================================================
(function timeShader() {
    const canvas = document.getElementById('timeGL');
    if (!canvas) return;
    const info = document.getElementById('timeGLInfo');

    const FRAG = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float c = u_resolution.x / u_resolution.y * 0.5;
  float r = 0.22 + 0.06 * sin(u_time * 3.0);
  float d = distance(uv, vec2(c, 0.5));
  float circle = 1.0 - smoothstep(r, r + 0.02, d);
  float wave = 0.5 + 0.5 * sin(uv.x * 12.0 - u_time * 2.0);
  vec3 bg = mix(vec3(0.05, 0.07, 0.15), vec3(0.10, 0.20, 0.35), wave);
  vec3 col = mix(bg, vec3(1.0, 0.65, 0.30), circle);
  gl_FragColor = vec4(col, 1.0);
}`;

    let paused = false;
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, FRAG, { info: info }));

    document.getElementById('btnTimePause')?.addEventListener('click', () => {
        paused = !paused;
        toy.setPaused(paused);
        info.textContent = paused ? 'Paused — u_time is frozen.' : 'Running — u_time advances in seconds.';
    });
    document.getElementById('btnTimeSlow')?.addEventListener('click', () => {
        toy.setTimeScale(0.3); info.textContent = 'Time scale 0.3× — same shader, slower clock.';
    });
    document.getElementById('btnTimeFast')?.addEventListener('click', () => {
        toy.setTimeScale(2.5); info.textContent = 'Time scale 2.5× — frame-rate independent.';
    });
})();

// =============================================================================
// DEMO 7 — mouseGL  (§ Interactivity with u_mouse)
// =============================================================================
(function mouseShader() {
    const canvas = document.getElementById('mouseGL');
    if (!canvas) return;
    const info = document.getElementById('mouseGLInfo');

    // u_mouse shares gl_FragCoord space (px, bottom-left origin).
    const SPOT = `precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  float d = distance(gl_FragCoord.xy, u_mouse) / u_resolution.y;
  float light = 1.0 - smoothstep(0.0, 0.45, d);
  vec3 col = mix(vec3(0.04, 0.05, 0.10), vec3(0.31, 0.76, 0.97), light);
  gl_FragColor = vec4(col, 1.0);
}`;

    const RIPPLE = `precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float d = distance(gl_FragCoord.xy, u_mouse) / u_resolution.y;
  float r = sin(d * 40.0 - u_time * 6.0) * exp(-d * 4.0);
  vec3 col = vec3(0.10, 0.20, 0.35) + r * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, SPOT, { info: info }));

    document.getElementById('btnMouseSpot')?.addEventListener('click', () => {
        toy.setFrag(SPOT); info.textContent = 'Spotlight: 1 - smoothstep(distance to cursor).';
    });
    document.getElementById('btnMouseRipple')?.addEventListener('click', () => {
        toy.setFrag(RIPPLE); info.textContent = 'Ripple: sin(distance * f - time) decaying outward.';
    });
})();

// =============================================================================
// DEMO 8 — waterGL  (§ Mini-Project: Animated Water Tint)
// =============================================================================
(function waterShader() {
    const canvas = document.getElementById('waterGL');
    if (!canvas) return;
    const info = document.getElementById('waterGLInfo');

    const state = { amp: '0.018', scanline: false, murky: false };

    // Build the fragment shader from the current state. Everything the tier
    // taught shows up here: uv, distance fields, mix(), u_time, u_mouse.
    function buildFrag(s) {
        const shallow = s.murky ? 'vec3(0.18, 0.38, 0.30)' : 'vec3(0.35, 0.78, 0.92)';
        const deep    = s.murky ? 'vec3(0.02, 0.10, 0.09)' : 'vec3(0.03, 0.18, 0.38)';
        const scan = s.scanline
            ? '  col *= 0.86 + 0.14 * sin(gl_FragCoord.y * 3.14159);\n'
            : '';
        return `precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 m = u_mouse / u_resolution;
  float md = distance(uv, m);
  float ripple = sin(md * 38.0 - u_time * 4.0) * exp(-md * 6.0) * 0.025;
  float wave = sin(uv.x * 11.0 + u_time * 1.4) * ${s.amp}
             + sin(uv.y * 17.0 - u_time * 2.0) * ${s.amp} * 0.6
             + ripple;
  float depth = clamp(uv.y + wave, 0.0, 1.0);
  vec3 col = mix(${deep}, ${shallow}, depth);
  float caustic = smoothstep(0.55, 1.0,
      sin(uv.x * 26.0 + u_time * 2.0 + wave * 22.0)
    * sin(uv.y * 20.0 - u_time * 1.6));
  col += caustic * 0.10;
${scan}  gl_FragColor = vec4(col, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state)); info.textContent = msg; }

    document.getElementById('btnWaterCalm')?.addEventListener('click', () => {
        state.amp = '0.018'; refresh('Calm water — small wave amplitude.');
    });
    document.getElementById('btnWaterChoppy')?.addEventListener('click', () => {
        state.amp = '0.055'; refresh('Choppy water — larger wave amplitude.');
    });
    document.getElementById('btnWaterScanline')?.addEventListener('click', () => {
        state.scanline = !state.scanline;
        refresh('Scanline overlay ' + (state.scanline ? 'ON' : 'OFF') + ' — a retro CRT-style post FX.');
    });
    document.getElementById('btnWaterMurky')?.addEventListener('click', () => {
        state.murky = !state.murky;
        refresh('Tint: ' + (state.murky ? 'murky swamp' : 'clear ocean') + ' — just different mix() colors.');
    });
})();
