// =============================================================================
// SHADERS TRACK — INTERMEDIATE TIER — PAGE-SIDE INTERACTIVE DEMOS
// =============================================================================
// Same conventions as beginner-demos.js. Tier pages never co-load, so the
// WebGL helpers below are copied verbatim from beginner-demos.js (each tier's
// file is self-contained — the project-wide pattern). Their stringified twins
// live in bundles-intermediate.js for the 📋 Export feature; keep in sync.
//
// GLSL is written as multi-line template literals (plain JS here → no escaping).
//
// GLSL ES 1.00 note: `for` loop bounds must be constant expressions, so
// "adjustable octaves / tile counts" rebuild the shader with the constant
// interpolated in (toy.setFrag), exactly like beginner's water buildFrag().
// Continuous scalars use the u_param uniform.
// =============================================================================

// -----------------------------------------------------------------------------
// Shared WebGL helpers (verbatim copy of beginner-demos.js — keep identical)
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
// DEMO 1 — tilingGL  (§ Tiling & Repetition)
// fract(uv * n) chops space into n repeating cells. Cell count is a
// compile-time constant, so the buttons rebuild the shader via setFrag.
// =============================================================================
(function tilingShader() {
    const canvas = document.getElementById('tilingGL');
    if (!canvas) return;
    const info = document.getElementById('tilingGLInfo');

    function buildFrag(n) {
        return `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 g = uv * ${n}.0;             // n cells across
  vec2 cell = floor(g);             // which cell
  vec2 f = fract(g);                // 0..1 inside the cell
  float checker = mod(cell.x + cell.y, 2.0);
  float d = distance(f, vec2(0.5));
  float dot = 1.0 - smoothstep(0.30, 0.34 + 0.05 * sin(u_time * 2.0), d);
  vec3 bg = mix(vec3(0.07, 0.10, 0.18), vec3(0.12, 0.16, 0.28), checker);
  vec3 col = mix(bg, vec3(0.31, 0.76, 0.97), dot);
  gl_FragColor = vec4(col, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(6), { info: info }));

    document.getElementById('btnTileFew')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(3)); info.textContent = '3 cells — uv * 3.0, one program tiles the screen.';
    });
    document.getElementById('btnTileDefault')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(6)); info.textContent = '6 cells — fract() gives each cell its own 0..1 space.';
    });
    document.getElementById('btnTileMany')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(12)); info.textContent = '12 cells — same shader, no extra cost per cell.';
    });
})();

// =============================================================================
// DEMO 2 — randomGL  (§ Randomness: the hash)
// GLSL has no rand(). The standard trick: fract(sin(dot(...)) * big).
// =============================================================================
(function randomShader() {
    const canvas = document.getElementById('randomGL');
    if (!canvas) return;
    const info = document.getElementById('randomGLInfo');

    const STATIC = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 cell = floor(uv * 24.0);
  gl_FragColor = vec4(vec3(hash(cell)), 1.0);
}`;

    const ANIMATED = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 cell = floor(uv * 24.0);
  gl_FragColor = vec4(vec3(hash(cell + floor(u_time * 3.0))), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, STATIC, { info: info }));

    document.getElementById('btnRandStatic')?.addEventListener('click', () => {
        toy.setFrag(STATIC); info.textContent = 'Static: one deterministic value per cell.';
    });
    document.getElementById('btnRandAnim')?.addEventListener('click', () => {
        toy.setFrag(ANIMATED); info.textContent = 'Animated: reseed with floor(u_time) → TV static.';
    });
})();

// =============================================================================
// DEMO 3 — valueNoiseGL  (§ Value Noise)
// Interpolate the hash at cell corners with a smooth fade → smooth noise.
// =============================================================================
(function valueNoiseShader() {
    const canvas = document.getElementById('valueNoiseGL');
    if (!canvas) return;
    const info = document.getElementById('valueNoiseGLInfo');

    const BLOCKY = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 p = uv * 6.0 + vec2(u_time * 0.3, 0.0);
  gl_FragColor = vec4(vec3(hash(floor(p))), 1.0);   // no interpolation → blocky
}`;

    const SMOOTH = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);                 // smooth (quintic-ish) fade
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float n = valueNoise(uv * 6.0 + vec2(u_time * 0.3, 0.0));
  gl_FragColor = vec4(vec3(n), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, SMOOTH, { info: info }));

    document.getElementById('btnVNBlocky')?.addEventListener('click', () => {
        toy.setFrag(BLOCKY); info.textContent = 'Raw hash per cell — blocky, no interpolation.';
    });
    document.getElementById('btnVNSmooth')?.addEventListener('click', () => {
        toy.setFrag(SMOOTH); info.textContent = 'Bilinear mix + smooth fade → continuous value noise.';
    });
})();

// =============================================================================
// DEMO 4 — fbmGL  (§ fbm)
// Sum octaves of noise. Octave count is a compile-time constant → setFrag.
// =============================================================================
(function fbmShader() {
    const canvas = document.getElementById('fbmGL');
    if (!canvas) return;
    const info = document.getElementById('fbmGLInfo');

    function buildFrag(octaves) {
        return `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < ${octaves}; i++) {   // bound MUST be a constant
    sum += amp * valueNoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float v = fbm(uv * 4.0 + vec2(u_time * 0.15, 0.0));
  gl_FragColor = vec4(vec3(v), 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(6), { info: info }));

    document.getElementById('btnFbm1')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(1)); info.textContent = '1 octave — just the base value noise.';
    });
    document.getElementById('btnFbm3')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(3)); info.textContent = '3 octaves — detail emerging.';
    });
    document.getElementById('btnFbm6')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(6)); info.textContent = '6 octaves — cloud/marble texture.';
    });
})();

// =============================================================================
// DEMO 5 — warpGL  (§ Domain Warping)
// Feed noise into the *input* of more noise. u_param = warp amount,
// u_mouse nudges the warp source.
// =============================================================================
(function warpShader() {
    const canvas = document.getElementById('warpGL');
    if (!canvas) return;
    const info = document.getElementById('warpGLInfo');

    const FRAG = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_param;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 5; i++) { s += a * valueNoise(p * f); f *= 2.0; a *= 0.5; }
  return s;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 p = uv * 3.0;
  vec2 mo = (u_mouse / u_resolution - 0.5);
  vec2 q = vec2(fbm(p + u_time * 0.10),
                fbm(p + vec2(5.2, 1.3) - u_time * 0.10));
  float v = fbm(p + u_param * (q + mo));   // <- the domain warp
  vec3 col = mix(vec3(0.04, 0.10, 0.22), vec3(0.45, 0.85, 0.95), v);
  gl_FragColor = vec4(col, 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, FRAG, { info: info, param: 1.0 }));

    document.getElementById('btnWarpOff')?.addEventListener('click', () => {
        toy.setParam(0.0); info.textContent = 'Warp 0 — plain fbm, no distortion.';
    });
    document.getElementById('btnWarpOn')?.addEventListener('click', () => {
        toy.setParam(1.0); info.textContent = 'Warp 1 — fbm of (p + fbm(p)): organic swirls.';
    });
    document.getElementById('btnWarpStrong')?.addEventListener('click', () => {
        toy.setParam(2.0); info.textContent = 'Warp 2 — stronger feedback, move the mouse.';
    });
})();

// =============================================================================
// DEMO 6 — distortGL  (§ UV Distortion)
// Offset the sampling UV of a visible "scene". heat-haze vs water-refraction.
// u_param = distortion strength.
// =============================================================================
(function distortShader() {
    const canvas = document.getElementById('distortGL');
    if (!canvas) return;
    const info = document.getElementById('distortGLInfo');

    const SCENE = `vec3 scene(vec2 uv) {
  float stripes = step(0.5, fract(uv.x * 10.0));
  vec3 grad = mix(vec3(0.10, 0.20, 0.45), vec3(0.95, 0.65, 0.30), uv.y);
  return mix(grad, grad * 0.45, stripes);
}`;

    const HEAT = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
${SCENE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 off = vec2(sin(uv.y * 40.0 + u_time * 6.0), 0.0) * 0.02;
  gl_FragColor = vec4(scene(uv + off * u_param), 1.0);
}`;

    const WATER = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
${SCENE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 off = vec2(
    valueNoise(uv * 5.0 + u_time * 0.5) - 0.5,
    valueNoise(uv * 5.0 - u_time * 0.4 + 7.0) - 0.5
  ) * 0.08;
  gl_FragColor = vec4(scene(uv + off * u_param), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, HEAT, { info: info, param: 1.0 }));

    document.getElementById('btnDistHeat')?.addEventListener('click', () => {
        toy.setFrag(HEAT); toy.setParam(1.0);
        info.textContent = 'Heat haze: a vertical sine offsets the UV.';
    });
    document.getElementById('btnDistWater')?.addEventListener('click', () => {
        toy.setFrag(WATER); toy.setParam(1.0);
        info.textContent = 'Water refraction: a noise field offsets the UV.';
    });
    document.getElementById('btnDistStronger')?.addEventListener('click', () => {
        toy.setParam(2.2); info.textContent = 'Stronger — u_param scales the offset.';
    });
    document.getElementById('btnDistSubtler')?.addEventListener('click', () => {
        toy.setParam(0.5); info.textContent = 'Subtler — a believable in-game amount.';
    });
})();

// =============================================================================
// DEMO 6b — perlinGL  (§ Gradient (Perlin) Noise)
// Gradient noise = dot(random gradient, corner offset), smooth-interpolated.
// Smoother than value noise. Lib fixed; final value expression injected.
// =============================================================================
(function perlinShader() {
    const canvas = document.getElementById('perlinGL');
    if (!canvas) return;
    const info = document.getElementById('perlinGLInfo');

    const LIB = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}
float perlin(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash2(i),                f);
  float b = dot(hash2(i + vec2(1, 0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0, 1)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1, 1)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * perlin(p); p *= 2.0; a *= 0.5; }
  return s;
}`;

    function buildFrag(expr) {
        return LIB + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float v = ${expr};
  gl_FragColor = vec4(mix(vec3(0.04, 0.06, 0.12), vec3(0.31, 0.76, 0.97), v), 1.0);
}`;
    }

    const EXPR = {
        single: '0.5 + 0.5 * perlin(uv * 6.0 + vec2(u_time * 0.25, 0.0))',
        fbm:    '0.5 + 0.5 * fbm(uv * 4.0 + vec2(0.0, u_time * 0.2))',
        marble: '0.5 + 0.5 * sin((uv.x * 7.0 + fbm(uv * 3.0) * 5.0) * 3.14159)',
        warp:   '0.5 + 0.5 * fbm(uv * 4.0 + vec2(fbm(uv * 4.0 + u_time * 0.15), fbm(uv * 4.0 - u_time * 0.1)))'
    };

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(EXPR.single), { info: info }));
    function set(k, msg) { toy.setFrag(buildFrag(EXPR[k])); info.textContent = msg; }

    document.getElementById('btnPerlinSingle')?.addEventListener('click', () =>
        set('single', 'One octave of gradient noise — smooth, no grid blockiness.'));
    document.getElementById('btnPerlinFbm')?.addEventListener('click', () =>
        set('fbm', 'fbm: 5 octaves of Perlin stacked — cloud / terrain look.'));
    document.getElementById('btnPerlinMarble')?.addEventListener('click', () =>
        set('marble', 'Marble: sin(x + fbm) bends straight bands into veins.'));
    document.getElementById('btnPerlinWarp')?.addEventListener('click', () =>
        set('warp', 'Domain warp: feed fbm into fbm — swirling smoke/marble.'));
})();

// =============================================================================
// DEMO 6c — voronoiGL  (§ Voronoi / Cellular Noise)
// One random point per cell; F1 = nearest, F2 = 2nd-nearest. cells/edges/
// distance/cracked come from displaying those differently. Constant loop.
// =============================================================================
(function voronoiShader() {
    const canvas = document.getElementById('voronoiGL');
    if (!canvas) return;
    const info = document.getElementById('voronoiGLInfo');

    const LIB = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
void vor(vec2 p, out float f1, out float f2, out vec2 cid) {
  vec2 g = floor(p), f = fract(p);
  f1 = 8.0; f2 = 8.0; cid = g;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 pt = o + 0.5 + 0.45 * sin(u_time + 6.2831 * hash2(g + o));
    float d = length(pt - f);
    if (d < f1) { f2 = f1; f1 = d; cid = g + o; }
    else if (d < f2) { f2 = d; }
  }
}`;

    function buildFrag(out) {
        return LIB + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float f1, f2; vec2 cid;
  vor(uv * 6.0, f1, f2, cid);
  vec3 col = ${out};
  gl_FragColor = vec4(col, 1.0);
}`;
    }

    const OUT = {
        distance: 'vec3(f1)',
        cells:    '0.45 + 0.45 * cos(6.2831 * hash2(cid).x + vec3(0.0, 2.0, 4.0))',
        edges:    'vec3(smoothstep(0.0, 0.06, f2 - f1))',
        cracked:  'mix(vec3(0.05, 0.03, 0.02), vec3(0.34, 0.24, 0.15), smoothstep(0.0, 0.10, f2 - f1))'
    };

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(OUT.distance), { info: info }));
    function set(k, msg) { toy.setFrag(buildFrag(OUT[k])); info.textContent = msg; }

    document.getElementById('btnVorDistance')?.addEventListener('click', () =>
        set('distance', 'F1 = distance to nearest point → classic Voronoi blobs.'));
    document.getElementById('btnVorCells')?.addEventListener('click', () =>
        set('cells', 'Color by cell id → flat cells: scales, mosaic, stained glass.'));
    document.getElementById('btnVorEdges')?.addEventListener('click', () =>
        set('edges', 'F2 - F1 near zero on borders → free cell edges.'));
    document.getElementById('btnVorCracked')?.addEventListener('click', () =>
        set('cracked', 'Tint the edge web → a dry cracked-earth texture.'));
})();

// =============================================================================
// DEMO 6d — flowGL  (§ Flow & Scrolling)
// Move the UVs over time: conveyor (scroll), river (advected noise),
// lava (layered scroll), flow field (per-pixel direction). Body injected.
// =============================================================================
(function flowShader() {
    const canvas = document.getElementById('flowGL');
    if (!canvas) return;
    const info = document.getElementById('flowGLInfo');

    const LIB = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
  return s;
}`;

    function buildFrag(body) {
        return LIB + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec3 col;
  ${body}
  gl_FragColor = vec4(col, 1.0);
}`;
    }

    const BODY = {
        conveyor: 'float s = fract(uv.x * 7.0 - u_time * 0.5);\n  col = mix(vec3(0.10,0.20,0.35), vec3(0.31,0.76,0.97), step(0.5, s));',
        river:    'float n = fbm(vec2(uv.x * 4.0 - u_time * 0.6, uv.y * 5.0 + sin(uv.x * 6.0) * 0.4));\n  col = mix(vec3(0.02,0.18,0.30), vec3(0.45,0.85,0.95), n);',
        lava:     'float a = fbm(uv * 4.0 + vec2(u_time * 0.4, 0.0));\n  float b = fbm(uv * 7.0 - vec2(u_time * 0.7, 0.0));\n  float h = a * 0.6 + b * 0.4;\n  col = mix(vec3(0.25,0.02,0.0), vec3(1.0,0.75,0.15), smoothstep(0.35, 0.75, h));',
        field:    'vec2 fl = vec2(0.8, 0.5 * sin(uv.y * 6.2831 + u_time));\n  float n = fbm(uv * 5.0 - fl * u_time * 0.6);\n  col = mix(vec3(0.04,0.10,0.18), vec3(0.30,0.80,0.85), n);'
    };

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(BODY.conveyor), { info: info }));
    function set(k, msg) { toy.setFrag(buildFrag(BODY[k])); info.textContent = msg; }

    document.getElementById('btnFlowConveyor')?.addEventListener('click', () =>
        set('conveyor', 'Conveyor: fract(uv.x - time) slides a hard pattern.'));
    document.getElementById('btnFlowRiver')?.addEventListener('click', () =>
        set('river', 'River: fbm advected along +x with a wavy centerline.'));
    document.getElementById('btnFlowLava')?.addEventListener('click', () =>
        set('lava', 'Lava: two fbm layers scrolling at different speeds.'));
    document.getElementById('btnFlowField')?.addEventListener('click', () =>
        set('field', 'Flow field: a per-row direction curls the sampled noise.'));
})();

// =============================================================================
// DEMO 7 — fireGL  (§ Mini-Project: Animated Fire / Smoke)
// Capstone: fbm + rising flow + vertical falloff + a palette. State-built
// (turbulence changes the octave count → constant loop bound).
// =============================================================================
(function fireShader() {
    const canvas = document.getElementById('fireGL');
    if (!canvas) return;
    const info = document.getElementById('fireGLInfo');

    const state = { smoke: false, turbulent: true };

    function buildFrag(s) {
        const octaves = s.turbulent ? '6' : '3';
        const palette = s.smoke
            ? 'vec3 col = mix(vec3(0.02, 0.02, 0.03), vec3(0.55, 0.55, 0.58), v);'
            : 'vec3 col = mix(vec3(0.40, 0.02, 0.0), vec3(1.0, 0.85, 0.25), v);\n' +
              '  col = mix(col, vec3(1.0, 0.35, 0.05), smoothstep(0.45, 0.05, v));';
        return `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < ${octaves}; i++) {
    sum += amp * valueNoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  // Rising flow: scroll the noise domain downward over time.
  vec2 p = vec2(uv.x * 3.0, uv.y * 4.0 - u_time * 2.0);
  float n = fbm(p);
  float flame = n * (1.0 - uv.y) * 2.2 * u_param;   // taller at the base
  float v = smoothstep(0.0, 0.7, flame);
  ${palette}
  gl_FragColor = vec4(col, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state), { info: info, param: 1.0 }));
    function refresh(msg) { toy.setFrag(buildFrag(state)); info.textContent = msg; }

    document.getElementById('btnFireFire')?.addEventListener('click', () => {
        state.smoke = false; refresh('Fire palette — dark red → orange → yellow.');
    });
    document.getElementById('btnFireSmoke')?.addEventListener('click', () => {
        state.smoke = true; refresh('Smoke palette — same fbm, grayscale ramp.');
    });
    document.getElementById('btnFireTurb')?.addEventListener('click', () => {
        state.turbulent = !state.turbulent;
        refresh('Turbulence ' + (state.turbulent ? 'ON (6 octaves)' : 'OFF (3 octaves)') + ' — rebuilt shader.');
    });
    document.getElementById('btnFireHotter')?.addEventListener('click', () => {
        toy.setParam(1.8); info.textContent = 'Intensity up — u_param scales the flame.';
    });
})();
