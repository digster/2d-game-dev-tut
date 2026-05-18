// =============================================================================
// SHADERS TRACK — RAYMARCHING / 3D / FRACTALS TIER — PAGE-SIDE DEMOS
// =============================================================================
// The whole rest of the track is 2D. Here a single fragment shader becomes a
// renderer: per pixel, shoot a ray and sphere-trace a Signed Distance Field
// until it hits a surface. Same makeShaderToy runner; the camera orbits with
// the mouse (u_mouse). GLSL ES 1.00 → loop bounds MUST be constant, so step
// counts / fractal iterations bake in and the buttons rebuild via setFrag.
// Fractal shaders use `precision highp float;` (legal in WebGL1) — mediump
// bands the deep zoom / distance estimator.
//
// HARD RULE (learned in the stylization tier): a JS-interpolated number is an
// INT literal in GLSL and int*float is a compile error — every \${n} feeding
// float math is written \${n}.0; loop bounds stay integer.
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
// Shared raymarch GLSL kit. RM_HEAD: precision (mediump for SDF demos), the
// uniforms, an explicit 2x2 rotation (GLSL ES 1.00 has no inverse()/mat-from-
// vec helpers — write rotations out). RM_CAM: builds a mouse-orbited ray.
// -----------------------------------------------------------------------------
const RM_UNI = `uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_param;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;
const RM_HEAD = `precision mediump float;
` + RM_UNI;
const RM_HEAD_HP = `precision highp float;
` + RM_UNI;
// Emits ro/rd for a camera at distance `dist`, orbited by the mouse.
const RM_CAM = `vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  float yaw = (u_mouse.x / u_resolution.x - 0.5) * 6.2831;
  float pit = (u_mouse.y / u_resolution.y - 0.5) * 2.0;
  vec3 ro = vec3(0.0, 0.0, -CAMDIST);
  vec3 rd = normalize(vec3(uv, 1.6));
  ro.yz = rot(pit) * ro.yz;  rd.yz = rot(pit) * rd.yz;
  ro.xz = rot(yaw) * ro.xz;  rd.xz = rot(yaw) * rd.xz;`;

// =============================================================================
// DEMO 1 — marchGL  (§ The Raymarch Loop)
// =============================================================================
(function marchShader() {
    const canvas = document.getElementById('marchGL');
    if (!canvas) return;
    const info = document.getElementById('marchGLInfo');
    function buildFrag(steps) {
        return RM_HEAD + `float map(vec3 p) { return length(p) - 1.0; }   // one sphere
void main() {
  ${RM_CAM.replace('CAMDIST', '3.5')}
  float t = 0.0; float d = 1.0;
  for (int i = 0; i < ${steps}; i++) {           // bound MUST be constant
    vec3 p = ro + rd * t;
    d = map(p);
    if (d < 0.002 || t > 12.0) break;
    t += d;                                        // step exactly the safe distance
  }
  vec3 col = vec3(0.03, 0.04, 0.07);
  if (d < 0.01) {
    vec3 p = ro + rd * t;
    vec3 n = normalize(p);
    float diff = clamp(dot(n, normalize(vec3(0.6, 0.8, -0.5))), 0.0, 1.0);
    col = vec3(0.30, 0.55, 0.95) * (0.15 + 0.9 * diff)
        + pow(diff, 32.0) * 0.6
        + vec3(0.0, 0.0, float(${steps}) / 256.0); // tint hints the budget
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(64), { info: info }));
    function set(s, msg) { toy.setFrag(buildFrag(s)); info.textContent = msg; }
    document.getElementById('btnMarch32')?.addEventListener('click', () =>
        set(32, '32 steps — cheap; far/grazing rays may under-march.'));
    document.getElementById('btnMarch64')?.addEventListener('click', () =>
        set(64, '64 steps — the sweet spot for a single sphere.'));
    document.getElementById('btnMarch128')?.addEventListener('click', () =>
        set(128, '128 steps — luxurious; crisp silhouette, costs more.'));
})();

// =============================================================================
// DEMO 2 — sdf3dGL  (§ SDF Primitives & Smooth-Min)
// =============================================================================
(function sdf3dShader() {
    const canvas = document.getElementById('sdf3dGL');
    if (!canvas) return;
    const info = document.getElementById('sdf3dGLInfo');
    const MAP = {
        union:  'return min(min(sph, box), tor);',
        smooth: 'float k = 0.5; float a = smin(sph, box, k); return smin(a, tor, k);',
        subtract: 'return max(max(-sph, box), -tor + 0.1);',
        morph:  'float m = 0.5 + 0.5 * sin(u_time); return mix(min(box, tor), sph, m);'
    };
    function buildFrag(mode) {
        return RM_HEAD + `float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float map(vec3 p) {
  p.xz = rot(u_time * 0.3) * p.xz;
  float sph = length(p - vec3(0.8 * sin(u_time), 0.0, 0.0)) - 0.7;
  float box = sdBox(p, vec3(0.6));
  float tor = sdTorus(p, vec2(1.1, 0.25));
  ${MAP[mode]}
}
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)));
}
void main() {
  ${RM_CAM.replace('CAMDIST', '4.5')}
  float t = 0.0; float d = 1.0;
  for (int i = 0; i < 96; i++) {
    d = map(ro + rd * t);
    if (d < 0.002 || t > 16.0) break;
    t += d;
  }
  vec3 col = vec3(0.03, 0.04, 0.07);
  if (d < 0.01) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float diff = clamp(dot(n, normalize(vec3(0.7, 0.9, -0.6))), 0.0, 1.0);
    vec3 base = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + length(p));
    col = base * (0.18 + 0.9 * diff) + pow(diff, 24.0) * 0.5;
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('smooth'), { info: info }));
    function set(m, msg) { toy.setFrag(buildFrag(m)); info.textContent = msg; }
    document.getElementById('btnSdfUnion')?.addEventListener('click', () =>
        set('union', 'Union — min() of sphere, box, torus (hard joins).'));
    document.getElementById('btnSdfSmooth')?.addEventListener('click', () =>
        set('smooth', 'Smooth-min — the polynomial smin melts them together.'));
    document.getElementById('btnSdfSub')?.addEventListener('click', () =>
        set('subtract', 'Subtract — max(-a, b) carves shapes out.'));
    document.getElementById('btnSdfMorph')?.addEventListener('click', () =>
        set('morph', 'Morph — mix() the SDFs over time.'));
})();

// =============================================================================
// DEMO 3 — lighting3dGL  (§ Normals, Diffuse & Soft Shadows)
// =============================================================================
(function lighting3dShader() {
    const canvas = document.getElementById('lighting3dGL');
    if (!canvas) return;
    const info = document.getElementById('lighting3dGLInfo');
    const SHADOW = {
        hard: `float sh = 1.0;
  for (int i = 0; i < 40; i++) {
    float h = map(sp + sl * st);
    if (h < 0.001) { sh = 0.0; break; }
    st += h; if (st > 6.0) break;
  }`,
        soft: `float sh = 1.0;
  for (int i = 0; i < 40; i++) {
    float h = map(sp + sl * st);
    if (h < 0.001) { sh = 0.0; break; }
    sh = min(sh, 10.0 * h / st);
    st += h; if (st > 6.0) break;
  }`
    };
    function buildFrag(mode) {
        return RM_HEAD + `float map(vec3 p) {
  float g = p.y + 1.0;                       // ground plane
  float s = length(p - vec3(0.0, 0.0, 0.0)) - 0.8;
  float s2 = length(p - vec3(1.3 * sin(u_time), -0.4, 1.0)) - 0.45;
  return min(g, min(s, s2));
}
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
                        map(p + e.yxy) - map(p - e.yxy),
                        map(p + e.yyx) - map(p - e.yyx)));
}
void main() {
  ${RM_CAM.replace('CAMDIST', '4.0')}
  float t = 0.0; float d = 1.0;
  for (int i = 0; i < 96; i++) { d = map(ro + rd * t); if (d < 0.002 || t > 20.0) break; t += d; }
  vec3 col = vec3(0.02, 0.03, 0.06);
  if (d < 0.01) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lp = vec3(2.5 * sin(u_time * 0.7), 3.0, -2.0);
    vec3 ld = normalize(lp - p);
    float diff = clamp(dot(n, ld), 0.0, 1.0);
    vec3 sp = p + n * 0.01; vec3 sl = ld; float st = 0.02;
    ${SHADOW[mode]}
    sh = clamp(sh, 0.0, 1.0);
    vec3 base = (p.y < -0.95) ? vec3(0.35, 0.36, 0.40) : vec3(0.85, 0.45, 0.30);
    col = base * (0.12 + 0.95 * diff * sh) + pow(diff, 30.0) * sh * 0.6;
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('soft'), { info: info }));
    function set(m, msg) { toy.setFrag(buildFrag(m)); info.textContent = msg; }
    document.getElementById('btnLitHard')?.addEventListener('click', () =>
        set('hard', 'Hard shadows — shadow ray is fully blocked or not.'));
    document.getElementById('btnLitSoft')?.addEventListener('click', () =>
        set('soft', 'Soft shadows — track the closest miss → a free penumbra.'));
})();

// =============================================================================
// DEMO 4 — aoGL  (§ Ambient Occlusion & Fog)
// =============================================================================
(function aoShader() {
    const canvas = document.getElementById('aoGL');
    if (!canvas) return;
    const info = document.getElementById('aoGLInfo');
    function buildFrag(useAO, useFog) {
        return RM_HEAD + `float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float map(vec3 p) {
  float g = p.y + 1.0;
  vec3 q = p; q.xz = rot(u_time * 0.2) * q.xz;
  float b = sdBox(q, vec3(0.7));
  float s = length(p - vec3(1.4, -0.4, 0.0)) - 0.55;
  return min(g, min(b, s));
}
vec3 calcNormal(vec3 p){ vec2 e=vec2(0.001,0.0);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
float ao(vec3 p, vec3 n) {
  float o = 0.0, s = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.02 + 0.12 * float(i);
    o += (h - map(p + n * h)) * s;
    s *= 0.7;
  }
  return clamp(1.0 - 1.6 * o, 0.0, 1.0);
}
void main() {
  ${RM_CAM.replace('CAMDIST', '4.5')}
  float t = 0.0; float d = 1.0;
  for (int i = 0; i < 96; i++) { d = map(ro + rd * t); if (d < 0.002 || t > 24.0) break; t += d; }
  vec3 col = vec3(0.5, 0.6, 0.75);            // sky / fog colour
  if (d < 0.01) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float diff = clamp(dot(n, normalize(vec3(0.6, 0.8, -0.5))), 0.0, 1.0);
    float occ = ${useAO ? 'ao(p, n)' : '1.0'};
    vec3 base = (p.y < -0.95) ? vec3(0.30, 0.32, 0.38) : vec3(0.80, 0.55, 0.35);
    col = base * (0.10 + 0.95 * diff) * occ + pow(diff, 28.0) * occ * 0.4;
    col = ${useFog ? 'mix(col, vec3(0.5, 0.6, 0.75), 1.0 - exp(-0.04 * t * t))' : 'col'};
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const state = { ao: false, fog: false };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(false, false), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state.ao, state.fog)); info.textContent = msg; }
    document.getElementById('btnAoNone')?.addEventListener('click', () => {
        state.ao = false; state.fog = false; refresh('No AO — corners look flat & glued together.');
    });
    document.getElementById('btnAoOn')?.addEventListener('click', () => {
        state.ao = true; refresh('AO on — 5 short marches darken creases & contact.');
    });
    document.getElementById('btnAoFog')?.addEventListener('click', () => {
        state.fog = !state.fog; refresh('Fog ' + (state.fog ? 'on — exp falloff adds depth.' : 'off.'));
    });
})();

// =============================================================================
// DEMO 5 — mandelbrotGL  (§ Mandelbrot & Julia) — highp
// =============================================================================
(function mandelbrotShader() {
    const canvas = document.getElementById('mandelbrotGL');
    if (!canvas) return;
    const info = document.getElementById('mandelbrotGLInfo');
    function buildFrag(iter, julia) {
        return RM_HEAD_HP + `void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  float zoom = 1.3 + 0.5 * sin(u_time * 0.15);
  vec2 c = uv * zoom - vec2(0.5, 0.0);
  vec2 jc = (u_mouse / u_resolution * 2.0 - 1.0) * vec2(1.0, 0.8);
  vec2 z = ${julia ? 'uv * zoom' : 'vec2(0.0)'};
  vec2 cc = ${julia ? 'jc' : 'c'};
  float it = 0.0;
  for (int i = 0; i < ${iter}; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + cc;
    if (dot(z, z) > 64.0) break;
    it += 1.0;
  }
  vec3 col = vec3(0.02, 0.02, 0.05);
  if (it < float(${iter}) - 0.5) {
    float sm = it + 1.0 - log2(0.5 * log2(dot(z, z)));   // smooth iteration
    col = 0.5 + 0.5 * cos(0.16 * sm + vec3(0.0, 0.6, 1.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const state = { iter: 128, julia: false };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(128, false), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state.iter, state.julia)); info.textContent = msg; }
    document.getElementById('btnMbSet')?.addEventListener('click', () => {
        state.julia = false; refresh('Mandelbrot — z = z² + c, c = pixel. Slow auto-zoom.');
    });
    document.getElementById('btnMbJulia')?.addEventListener('click', () => {
        state.julia = true; refresh('Julia — c is fixed (move the mouse to change it).');
    });
    document.getElementById('btnMbIter64')?.addEventListener('click', () => {
        state.iter = 64; refresh('64 iterations — coarser boundary, faster.');
    });
    document.getElementById('btnMbIter256')?.addEventListener('click', () => {
        state.iter = 256; refresh('256 iterations — deep filigree (iteration is a constant).');
    });
})();

// =============================================================================
// DEMO 6 — mandelbulbGL  (§ Mandelbulb) — highp
// =============================================================================
(function mandelbulbShader() {
    const canvas = document.getElementById('mandelbulbGL');
    if (!canvas) return;
    const info = document.getElementById('mandelbulbGLInfo');
    function buildFrag(iter, power) {
        return RM_HEAD_HP + `float de(vec3 pos, out float trap) {
  vec3 z = pos;
  float dr = 1.0;
  float r = 0.0;
  trap = 1e9;
  for (int i = 0; i < ${iter}; i++) {
    r = length(z);
    if (r > 2.0) break;
    float theta = acos(z.z / r);
    float phi = atan(z.y, z.x);
    dr = pow(r, ${power}.0 - 1.0) * ${power}.0 * dr + 1.0;
    float zr = pow(r, ${power}.0);
    theta *= ${power}.0;
    phi *= ${power}.0;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + pos;
    trap = min(trap, r);
  }
  return 0.5 * log(r) * r / dr;
}
void main() {
  ${RM_CAM.replace('CAMDIST', '2.6')}
  float t = 0.0; float trap = 0.0; float d = 1.0;
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    d = de(p, trap);
    if (d < 0.0006 || t > 8.0) break;
    t += d;
  }
  vec3 col = vec3(0.02, 0.02, 0.04);
  if (d < 0.002) {
    vec2 e = vec2(0.001, 0.0); float tr;
    vec3 n = normalize(vec3(de(ro + rd * t + e.xyy, tr) - de(ro + rd * t - e.xyy, tr),
                            de(ro + rd * t + e.yxy, tr) - de(ro + rd * t - e.yxy, tr),
                            de(ro + rd * t + e.yyx, tr) - de(ro + rd * t - e.yyx, tr)));
    float diff = clamp(dot(n, normalize(vec3(0.6, 0.8, -0.5))), 0.0, 1.0);
    vec3 orbit = 0.5 + 0.5 * cos(3.0 * trap + vec3(0.0, 0.8, 1.6));
    col = orbit * (0.15 + 0.9 * diff) + pow(diff, 28.0) * 0.5;
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const state = { iter: 8, power: 8 };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(8, 8), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state.iter, state.power)); info.textContent = msg; }
    document.getElementById('btnBulbP8')?.addEventListener('click', () => {
        state.power = 8; refresh('Power 8 — the classic Mandelbulb. Orbit with the mouse.');
    });
    document.getElementById('btnBulbP4')?.addEventListener('click', () => {
        state.power = 4; refresh('Power 4 — chunkier, fewer bulbs.');
    });
    document.getElementById('btnBulbDetail')?.addEventListener('click', () => {
        state.iter = state.iter >= 12 ? 6 : state.iter + 2;
        refresh('DE iterations ' + state.iter + ' — more = finer surface (slower).');
    });
})();

// =============================================================================
// DEMO 7 — domainrepGL  (§ Repeated Worlds — Domain Repetition)
// =============================================================================
(function domainrepShader() {
    const canvas = document.getElementById('domainrepGL');
    if (!canvas) return;
    const info = document.getElementById('domainrepGLInfo');
    const FOLD = {
        repeat: 'vec3 q = mod(p, 2.0) - 1.0;',
        mirror: 'vec3 q = abs(mod(p, 4.0) - 2.0) - 1.0;'
    };
    function buildFrag(mode) {
        return RM_HEAD + `float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float map(vec3 p) {
  p.z += u_time * 1.5 * (0.4 + u_param);   // fly forward
  p.xy = rot(p.z * 0.05) * p.xy;            // gentle corridor twist
  ${FOLD[mode]}
  float s = length(q) - 0.45;
  float b = sdBox(q, vec3(0.18));
  return min(s, b);
}
vec3 calcNormal(vec3 p){ vec2 e=vec2(0.001,0.0);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 ro = vec3(0.0, 0.0, 0.0);
  vec3 rd = normalize(vec3(uv, 1.4));
  float t = 0.0; float d = 1.0;
  for (int i = 0; i < 80; i++) { d = map(ro + rd * t); if (d < 0.002 || t > 14.0) break; t += d; }
  vec3 col = vec3(0.02, 0.03, 0.05);
  if (d < 0.01) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float diff = clamp(dot(n, normalize(vec3(0.5, 0.7, -0.6))), 0.0, 1.0);
    vec3 base = 0.5 + 0.5 * cos(t * 0.4 + vec3(0.0, 2.0, 4.0));
    col = base * (0.12 + 0.9 * diff) * exp(-0.06 * t);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('repeat'), { info: info, param: 0.5 }));
    document.getElementById('btnDrRepeat')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('repeat')); info.textContent = 'mod(p, 2.0) — one object tiles into an infinite lattice.';
    });
    document.getElementById('btnDrMirror')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('mirror')); info.textContent = 'abs(mod) — mirrored cells: a kaleidoscopic tunnel.';
    });
    document.getElementById('btnDrFast')?.addEventListener('click', () => {
        toy.setParam(1.6); info.textContent = 'Faster fly-through — u_param scales the forward speed.';
    });
})();

// =============================================================================
// DEMO 8 — scene3dGL  (§ Mini-Project: Raymarched Scene)
// Composes everything: smin primitives + soft shadow + AO + fog + cosine
// palette. Presets swap the look (structural → rebuild).
// =============================================================================
(function scene3dShader() {
    const canvas = document.getElementById('scene3dGL');
    if (!canvas) return;
    const info = document.getElementById('scene3dGLInfo');
    const PAL = {
        crystal: 'vec3 pal = 0.5 + 0.5 * cos(length(p) * 0.6 + vec3(0.0, 1.0, 2.0) + 3.0);',
        lava:    'vec3 pal = vec3(1.0, 0.45, 0.12) + 0.4 * sin(length(p) * 2.0 + u_time);',
        ice:     'vec3 pal = vec3(0.55, 0.78, 0.95) + 0.2 * cos(p.yzx * 2.0);'
    };
    function buildFrag(pal, fog) {
        return RM_HEAD + `float smin(float a, float b, float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float map(vec3 p) {
  float g = p.y + 1.0;
  vec3 q = p; q.xz = rot(u_time * 0.25) * q.xz;
  float s = length(q - vec3(0.0, 0.1 + 0.2 * sin(u_time), 0.0)) - 0.65;
  float b = sdBox(q - vec3(0.9, -0.3, 0.0), vec3(0.4));
  float blob = smin(s, b, 0.45);
  float pil = length(q.xz - vec2(-1.0, 0.6)) - 0.22;
  return min(g, smin(blob, pil, 0.3));
}
vec3 calcNormal(vec3 p){ vec2 e=vec2(0.001,0.0);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
float softshadow(vec3 ro, vec3 rd) {
  float r = 1.0, t = 0.03;
  for (int i = 0; i < 36; i++) {
    float h = map(ro + rd * t);
    if (h < 0.001) return 0.0;
    r = min(r, 10.0 * h / t);
    t += h; if (t > 7.0) break;
  }
  return clamp(r, 0.0, 1.0);
}
float ao(vec3 p, vec3 n){ float o=0.0,s=1.0;
  for (int i=0;i<5;i++){ float h=0.02+0.13*float(i); o+=(h-map(p+n*h))*s; s*=0.7; }
  return clamp(1.0-1.6*o,0.0,1.0); }
void main() {
  ${RM_CAM.replace('CAMDIST', '4.2')}
  float t = 0.0; float d = 1.0;
  for (int i = 0; i < 110; i++) { d = map(ro + rd * t); if (d < 0.002 || t > 24.0) break; t += d; }
  vec3 col = vec3(0.45, 0.55, 0.72);
  if (d < 0.01) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lp = vec3(2.4 * sin(u_time * 0.6), 3.2, -2.2);
    vec3 ld = normalize(lp - p);
    float diff = clamp(dot(n, ld), 0.0, 1.0);
    float sh = softshadow(p + n * 0.01, ld);
    float occ = ao(p, n);
    ${PAL[pal]}
    vec3 base = (p.y < -0.95) ? vec3(0.28, 0.30, 0.36) : pal;
    col = base * (0.12 + 0.95 * diff * sh) * occ + pow(diff, 32.0) * sh * 0.6;
    col = ${fog ? 'mix(col, vec3(0.45, 0.55, 0.72), 1.0 - exp(-0.018 * t * t))' : 'col'};
  }
  col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));   // gamma
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const state = { pal: 'crystal', fog: true };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('crystal', true), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state.pal, state.fog)); info.textContent = msg; }
    document.getElementById('btnSc3Crystal')?.addEventListener('click', () => {
        state.pal = 'crystal'; refresh('Crystal — cosine-palette body, soft shadow + AO + fog.');
    });
    document.getElementById('btnSc3Lava')?.addEventListener('click', () => {
        state.pal = 'lava'; refresh('Lava cave — hot emissive palette.');
    });
    document.getElementById('btnSc3Ice')?.addEventListener('click', () => {
        state.pal = 'ice'; refresh('Ice — cool palette. Orbit with the mouse.');
    });
    document.getElementById('btnSc3Fog')?.addEventListener('click', () => {
        state.fog = !state.fog; refresh('Fog ' + (state.fog ? 'on.' : 'off.'));
    });
})();
