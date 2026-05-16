// =============================================================================
// SHADERS TRACK — INTERMEDIATE TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js so the 📋 Export button on each
// `<details data-demo-id="sh_*">` copies a runnable HTML to the clipboard.
//
// IDs are `sh_`-prefixed (distinct from the Beginner tier's 7 keys). Tier pages
// never co-load, so this file is self-contained: the WebGL helper
// DEPENDENCY_BUNDLES below are copied verbatim from bundles-beginner.js
// (the project-wide per-tier-bundle pattern; identical reassignment is a no-op
// even in the impossible co-load case).
//
// ── Canvas-ID convention ─────────────────────────────────────────────────────
// The generator hardcodes `<canvas id="canvas">` / `<div id="info">`. The
// DEMO_CODE strings retarget the page demos' specific IDs to those. Button IDs
// are kept (the scaffold's `controls` array names them).
//
// ── GLSL-as-template-literal convention ──────────────────────────────────────
// Each DEMO_CODE.sh_* is a JS template literal; the fragment shaders inside are
// nested template literals. GLSL has NO backtick and NO `${`, so the ONLY
// escaping is the inner literal's delimiter backticks (\`). Demos that build a
// shader from JS (tiling/fbm/fire octave counts, distort's injected scene)
// interpolate with \${...} so the OUTER literal doesn't evaluate it at load
// time — same precedent as isometric-strategy/bundles-beginner.js's \${cx} and
// this track's Beginner water demo. JS string escapes that must survive into
// the exported source (fire palette's '\\n') stay double-escaped. Verify
// exports by running them, never by eye.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// DEPENDENCY BUNDLES — verbatim copy of bundles-beginner.js's WebGL helpers.
// =============================================================================

DEPENDENCY_BUNDLES.sh_compileShader = `// Compile one shader stage. On failure we read the driver's info log and
// THROW with it — a GLSL typo otherwise yields a silent blank canvas.
function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('Shader compile failed:\\n' + log);
    }
    return sh;
}`;

DEPENDENCY_BUNDLES.sh_createProgram = `// Compile vertex + fragment, link, and surface link errors loudly.
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
        throw new Error('Program link failed:\\n' + log);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
}`;

DEPENDENCY_BUNDLES.sh_fullscreenQuad = `// The whole screen is two triangles in clip space (-1..1). The vertex
// shader is a pass-through; ALL the interesting work happens per-pixel in
// the fragment shader. Beginners never need to touch this.
const SH_VERT_SRC = \`attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }\`;

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
}`;

DEPENDENCY_BUNDLES.sh_makeShaderToy = `// The runner. You write a fragment shader; this wires up the quad, the
// standard uniforms (u_time seconds, u_resolution px, u_mouse px, u_param
// float), the render loop, and loud error reporting. Returns a small handle.
//
// u_mouse convention: pixels from the canvas TOP-LEFT, then Y-flipped so it
// shares gl_FragCoord's bottom-left origin. (Mismatched mouse Y is the #1
// beginner shader bug — it is fixed here, once, for every demo.)
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
                String(msg).split('\\n').forEach((line, i) =>
                    c2d.fillText(line.slice(0, 92), 12, 24 + i * 18));
            }
        }
    }

    const noop = { stop() {}, setFrag() {}, setParam() {}, setPaused() {}, setTimeScale() {} };
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { fail('WebGL is not available in this browser/context.', null); return noop; }

    let program = null, uTime, uRes, uMouse, uP;
    function build(src) {
        try {
            const next = createShaderProgram(gl, SH_VERT_SRC, src);
            if (program) gl.deleteProgram(program);
            program = next;
            gl.useProgram(program);
            setupFullscreenQuad(gl, program);
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

    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        mouse.y = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mouseleave', () => {
        mouse.x = canvas.width / 2; mouse.y = canvas.height / 2;
    });
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
    canvas.addEventListener('webglcontextrestored', () => build(fragSrc), false);

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
        setTimeScale(s) { timeScale = s; }
    };
}`;

// ── TypeScript variants (verbatim copy of bundles-beginner.js) ───────────────

DEPENDENCY_BUNDLES_TS.sh_compileShader = `function compileShader(
    gl: WebGLRenderingContext,
    type: number,
    src: string
): WebGLShader {
    const sh = gl.createShader(type) as WebGLShader;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('Shader compile failed:\\n' + log);
    }
    return sh;
}`;

DEPENDENCY_BUNDLES_TS.sh_createProgram = `function createShaderProgram(
    gl: WebGLRenderingContext,
    vertSrc: string,
    fragSrc: string
): WebGLProgram {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram() as WebGLProgram;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog);
        gl.deleteProgram(prog);
        throw new Error('Program link failed:\\n' + log);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
}`;

DEPENDENCY_BUNDLES_TS.sh_fullscreenQuad = `const SH_VERT_SRC: string = \`attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }\`;

function setupFullscreenQuad(
    gl: WebGLRenderingContext,
    program: WebGLProgram
): WebGLBuffer {
    const buf = gl.createBuffer() as WebGLBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,
        -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return buf;
}`;

DEPENDENCY_BUNDLES_TS.sh_makeShaderToy = `interface ToyOpts {
    info?: HTMLElement | null;
    timeScale?: number;
    paused?: boolean;
    param?: number;
}
interface ToyHandle {
    stop(): void;
    setFrag(src: string): void;
    setParam(v: number): void;
    setPaused(b: boolean): void;
    setTimeScale(s: number): void;
}

function makeShaderToy(canvas: HTMLCanvasElement, fragSrc: string, opts?: ToyOpts): ToyHandle {
    opts = opts || {};
    const info: HTMLElement | null = opts.info || null;
    let timeScale: number = opts.timeScale != null ? opts.timeScale : 1;
    let paused: boolean = !!opts.paused;
    let uParam: number = opts.param != null ? opts.param : 0;
    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    function fail(msg: string, gl: WebGLRenderingContext | null): void {
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
                String(msg).split('\\n').forEach((line: string, i: number) =>
                    c2d.fillText(line.slice(0, 92), 12, 24 + i * 18));
            }
        }
    }

    const noop: ToyHandle = { stop() {}, setFrag() {}, setParam() {}, setPaused() {}, setTimeScale() {} };
    const gl = (canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) { fail('WebGL is not available in this browser/context.', null); return noop; }

    let program: WebGLProgram | null = null;
    let uTime: WebGLUniformLocation | null;
    let uRes: WebGLUniformLocation | null;
    let uMouse: WebGLUniformLocation | null;
    let uP: WebGLUniformLocation | null;
    function build(src: string): boolean {
        try {
            const next = createShaderProgram(gl, SH_VERT_SRC, src);
            if (program) gl.deleteProgram(program);
            program = next;
            gl.useProgram(program);
            setupFullscreenQuad(gl, program);
            uTime = gl.getUniformLocation(program, 'u_time');
            uRes = gl.getUniformLocation(program, 'u_resolution');
            uMouse = gl.getUniformLocation(program, 'u_mouse');
            uP = gl.getUniformLocation(program, 'u_param');
            if (info) info.style.color = '';
            return true;
        } catch (e) {
            fail(e instanceof Error ? e.message : String(e), gl);
            return false;
        }
    }
    if (!build(fragSrc)) {
        return { stop() {}, setFrag: (s: string) => { build(s); },
                 setParam(v: number) { uParam = v; }, setPaused() {}, setTimeScale() {} };
    }

    canvas.addEventListener('mousemove', (e: MouseEvent): void => {
        const r: DOMRect = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        mouse.y = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mouseleave', (): void => {
        mouse.x = canvas.width / 2; mouse.y = canvas.height / 2;
    });
    canvas.addEventListener('webglcontextlost', (e: Event) => e.preventDefault(), false);
    canvas.addEventListener('webglcontextrestored', () => build(fragSrc), false);

    let raf: number = 0, acc: number = 0, last: number = performance.now();
    function frame(now: number): void {
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
        setFrag(src: string) { build(src); },
        setParam(v: number) { uParam = v; },
        setPaused(b: boolean) { paused = b; if (!b) last = performance.now(); },
        setTimeScale(s: number) { timeScale = s; }
    };
}`;

// =============================================================================
// DEMO 1 — sh_tilingGL  (§ Tiling & Repetition)
// =============================================================================
DEMO_HTML.sh_tilingGL = {
    title: 'Shaders — Tiling & Repetition',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnTileFew',     text: 'Fewer (3)' },
        { id: 'btnTileDefault', text: 'Default (6)' },
        { id: 'btnTileMany',    text: 'More (12)' }
    ],
    info: 'fract(uv * n) gives every cell its own 0..1 space.'
};

DEMO_CODE.sh_tilingGL = `(function tilingShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    // Cell count is a constant in the shader, so a button rebuilds it.
    function buildFrag(n) {
        return \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 g = uv * \${n}.0;             // n cells across
  vec2 cell = floor(g);             // which cell
  vec2 f = fract(g);                // 0..1 inside the cell
  float checker = mod(cell.x + cell.y, 2.0);
  float d = distance(f, vec2(0.5));
  float dot = 1.0 - smoothstep(0.30, 0.34 + 0.05 * sin(u_time * 2.0), d);
  vec3 bg = mix(vec3(0.07, 0.10, 0.18), vec3(0.12, 0.16, 0.28), checker);
  vec3 col = mix(bg, vec3(0.31, 0.76, 0.97), dot);
  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(6), { info: info });

    document.getElementById('btnTileFew')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(3)); info.textContent = '3 cells — uv * 3.0, one program tiles the screen.';
    });
    document.getElementById('btnTileDefault')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(6)); info.textContent = '6 cells — fract() gives each cell its own 0..1 space.';
    });
    document.getElementById('btnTileMany')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(12)); info.textContent = '12 cells — same shader, no extra cost per cell.';
    });
})();`;

DEMO_CODE_TS.sh_tilingGL = `(function tilingShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function buildFrag(n: number): string {
        return \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 g = uv * \${n}.0;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float checker = mod(cell.x + cell.y, 2.0);
  float d = distance(f, vec2(0.5));
  float dot = 1.0 - smoothstep(0.30, 0.34 + 0.05 * sin(u_time * 2.0), d);
  vec3 bg = mix(vec3(0.07, 0.10, 0.18), vec3(0.12, 0.16, 0.28), checker);
  vec3 col = mix(bg, vec3(0.31, 0.76, 0.97), dot);
  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(6), { info: info });

    document.getElementById('btnTileFew')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag(3)); info.textContent = '3 cells — uv * 3.0, one program tiles the screen.';
    });
    document.getElementById('btnTileDefault')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag(6)); info.textContent = '6 cells — fract() gives each cell its own 0..1 space.';
    });
    document.getElementById('btnTileMany')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag(12)); info.textContent = '12 cells — same shader, no extra cost per cell.';
    });
})();`;

// =============================================================================
// DEMO 2 — sh_randomGL  (§ Randomness: the hash)
// =============================================================================
DEMO_HTML.sh_randomGL = {
    title: 'Shaders — Randomness: the hash',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnRandStatic', text: 'Static' },
        { id: 'btnRandAnim',   text: 'Animated' }
    ],
    info: 'fract(sin(dot(p, k)) * big) — a deterministic pseudo-random hash.'
};

DEMO_CODE.sh_randomGL = `(function randomShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const STATIC = \`precision mediump float;
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
}\`;

    const ANIMATED = \`precision mediump float;
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
}\`;

    const toy = makeShaderToy(canvas, STATIC, { info: info });

    document.getElementById('btnRandStatic')?.addEventListener('click', () => {
        toy.setFrag(STATIC); info.textContent = 'Static: one deterministic value per cell.';
    });
    document.getElementById('btnRandAnim')?.addEventListener('click', () => {
        toy.setFrag(ANIMATED); info.textContent = 'Animated: reseed with floor(u_time) → TV static.';
    });
})();`;

DEMO_CODE_TS.sh_randomGL = `(function randomShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const STATIC: string = \`precision mediump float;
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
}\`;

    const ANIMATED: string = \`precision mediump float;
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
}\`;

    const toy = makeShaderToy(canvas, STATIC, { info: info });

    document.getElementById('btnRandStatic')?.addEventListener('click', (): void => {
        toy.setFrag(STATIC); info.textContent = 'Static: one deterministic value per cell.';
    });
    document.getElementById('btnRandAnim')?.addEventListener('click', (): void => {
        toy.setFrag(ANIMATED); info.textContent = 'Animated: reseed with floor(u_time) → TV static.';
    });
})();`;

// =============================================================================
// DEMO 3 — sh_valueNoiseGL  (§ Value Noise)
// =============================================================================
DEMO_HTML.sh_valueNoiseGL = {
    title: 'Shaders — Value Noise',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnVNBlocky', text: 'Blocky (raw hash)' },
        { id: 'btnVNSmooth', text: 'Smooth (interp)' }
    ],
    info: 'Interpolate the hash at cell corners → continuous noise.'
};

DEMO_CODE.sh_valueNoiseGL = `(function valueNoiseShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const BLOCKY = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 p = uv * 6.0 + vec2(u_time * 0.3, 0.0);
  gl_FragColor = vec4(vec3(hash(floor(p))), 1.0);   // no interpolation
}\`;

    const SMOOTH = \`precision mediump float;
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
  vec2 u = f * f * (3.0 - 2.0 * f);                 // smooth fade
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float n = valueNoise(uv * 6.0 + vec2(u_time * 0.3, 0.0));
  gl_FragColor = vec4(vec3(n), 1.0);
}\`;

    const toy = makeShaderToy(canvas, SMOOTH, { info: info });

    document.getElementById('btnVNBlocky')?.addEventListener('click', () => {
        toy.setFrag(BLOCKY); info.textContent = 'Raw hash per cell — blocky, no interpolation.';
    });
    document.getElementById('btnVNSmooth')?.addEventListener('click', () => {
        toy.setFrag(SMOOTH); info.textContent = 'Bilinear mix + smooth fade → continuous value noise.';
    });
})();`;

DEMO_CODE_TS.sh_valueNoiseGL = `(function valueNoiseShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const BLOCKY: string = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  vec2 p = uv * 6.0 + vec2(u_time * 0.3, 0.0);
  gl_FragColor = vec4(vec3(hash(floor(p))), 1.0);
}\`;

    const SMOOTH: string = \`precision mediump float;
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
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float n = valueNoise(uv * 6.0 + vec2(u_time * 0.3, 0.0));
  gl_FragColor = vec4(vec3(n), 1.0);
}\`;

    const toy = makeShaderToy(canvas, SMOOTH, { info: info });

    document.getElementById('btnVNBlocky')?.addEventListener('click', (): void => {
        toy.setFrag(BLOCKY); info.textContent = 'Raw hash per cell — blocky, no interpolation.';
    });
    document.getElementById('btnVNSmooth')?.addEventListener('click', (): void => {
        toy.setFrag(SMOOTH); info.textContent = 'Bilinear mix + smooth fade → continuous value noise.';
    });
})();`;

// =============================================================================
// DEMO 4 — sh_fbmGL  (§ fbm)
// =============================================================================
DEMO_HTML.sh_fbmGL = {
    title: 'Shaders — fbm (Fractal Brownian Motion)',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnFbm1', text: '1 octave' },
        { id: 'btnFbm3', text: '3 octaves' },
        { id: 'btnFbm6', text: '6 octaves' }
    ],
    info: 'Sum octaves of noise (freq x2, amp /2) → cloud texture.'
};

DEMO_CODE.sh_fbmGL = `(function fbmShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    // GLSL ES 1.00 loop bounds must be constant → rebuild per octave count.
    function buildFrag(octaves) {
        return \`precision mediump float;
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
  for (int i = 0; i < \${octaves}; i++) {   // bound MUST be a constant
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
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(6), { info: info });

    document.getElementById('btnFbm1')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(1)); info.textContent = '1 octave — just the base value noise.';
    });
    document.getElementById('btnFbm3')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(3)); info.textContent = '3 octaves — detail emerging.';
    });
    document.getElementById('btnFbm6')?.addEventListener('click', () => {
        toy.setFrag(buildFrag(6)); info.textContent = '6 octaves — cloud/marble texture.';
    });
})();`;

DEMO_CODE_TS.sh_fbmGL = `(function fbmShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function buildFrag(octaves: number): string {
        return \`precision mediump float;
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
  for (int i = 0; i < \${octaves}; i++) {
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
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(6), { info: info });

    document.getElementById('btnFbm1')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag(1)); info.textContent = '1 octave — just the base value noise.';
    });
    document.getElementById('btnFbm3')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag(3)); info.textContent = '3 octaves — detail emerging.';
    });
    document.getElementById('btnFbm6')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag(6)); info.textContent = '6 octaves — cloud/marble texture.';
    });
})();`;

// =============================================================================
// DEMO 5 — sh_warpGL  (§ Domain Warping)
// =============================================================================
DEMO_HTML.sh_warpGL = {
    title: 'Shaders — Domain Warping',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnWarpOff',    text: 'Warp off' },
        { id: 'btnWarpOn',     text: 'Warp on' },
        { id: 'btnWarpStrong', text: 'Strong' }
    ],
    info: 'fbm(p + fbm(p)) — feed noise into noise. Move the mouse.'
};

DEMO_CODE.sh_warpGL = `(function warpShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const FRAG = \`precision mediump float;
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
}\`;

    const toy = makeShaderToy(canvas, FRAG, { info: info, param: 1.0 });

    document.getElementById('btnWarpOff')?.addEventListener('click', () => {
        toy.setParam(0.0); info.textContent = 'Warp 0 — plain fbm, no distortion.';
    });
    document.getElementById('btnWarpOn')?.addEventListener('click', () => {
        toy.setParam(1.0); info.textContent = 'Warp 1 — fbm of (p + fbm(p)): organic swirls.';
    });
    document.getElementById('btnWarpStrong')?.addEventListener('click', () => {
        toy.setParam(2.0); info.textContent = 'Warp 2 — stronger feedback, move the mouse.';
    });
})();`;

DEMO_CODE_TS.sh_warpGL = `(function warpShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const FRAG: string = \`precision mediump float;
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
  float v = fbm(p + u_param * (q + mo));
  vec3 col = mix(vec3(0.04, 0.10, 0.22), vec3(0.45, 0.85, 0.95), v);
  gl_FragColor = vec4(col, 1.0);
}\`;

    const toy = makeShaderToy(canvas, FRAG, { info: info, param: 1.0 });

    document.getElementById('btnWarpOff')?.addEventListener('click', (): void => {
        toy.setParam(0.0); info.textContent = 'Warp 0 — plain fbm, no distortion.';
    });
    document.getElementById('btnWarpOn')?.addEventListener('click', (): void => {
        toy.setParam(1.0); info.textContent = 'Warp 1 — fbm of (p + fbm(p)): organic swirls.';
    });
    document.getElementById('btnWarpStrong')?.addEventListener('click', (): void => {
        toy.setParam(2.0); info.textContent = 'Warp 2 — stronger feedback, move the mouse.';
    });
})();`;

// =============================================================================
// DEMO 6 — sh_distortGL  (§ UV Distortion)
// =============================================================================
DEMO_HTML.sh_distortGL = {
    title: 'Shaders — UV Distortion',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnDistHeat',     text: 'Heat haze' },
        { id: 'btnDistWater',    text: 'Water refraction' },
        { id: 'btnDistStronger', text: 'Stronger' },
        { id: 'btnDistSubtler',  text: 'Subtler' }
    ],
    info: 'Offset the sampling UV of a scene → heat/water effects.'
};

DEMO_CODE.sh_distortGL = `(function distortShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const SCENE = \`vec3 scene(vec2 uv) {
  float stripes = step(0.5, fract(uv.x * 10.0));
  vec3 grad = mix(vec3(0.10, 0.20, 0.45), vec3(0.95, 0.65, 0.30), uv.y);
  return mix(grad, grad * 0.45, stripes);
}\`;

    const HEAT = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
\${SCENE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 off = vec2(sin(uv.y * 40.0 + u_time * 6.0), 0.0) * 0.02;
  gl_FragColor = vec4(scene(uv + off * u_param), 1.0);
}\`;

    const WATER = \`precision mediump float;
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
\${SCENE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 off = vec2(
    valueNoise(uv * 5.0 + u_time * 0.5) - 0.5,
    valueNoise(uv * 5.0 - u_time * 0.4 + 7.0) - 0.5
  ) * 0.08;
  gl_FragColor = vec4(scene(uv + off * u_param), 1.0);
}\`;

    const toy = makeShaderToy(canvas, HEAT, { info: info, param: 1.0 });

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
})();`;

DEMO_CODE_TS.sh_distortGL = `(function distortShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const SCENE: string = \`vec3 scene(vec2 uv) {
  float stripes = step(0.5, fract(uv.x * 10.0));
  vec3 grad = mix(vec3(0.10, 0.20, 0.45), vec3(0.95, 0.65, 0.30), uv.y);
  return mix(grad, grad * 0.45, stripes);
}\`;

    const HEAT: string = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
\${SCENE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 off = vec2(sin(uv.y * 40.0 + u_time * 6.0), 0.0) * 0.02;
  gl_FragColor = vec4(scene(uv + off * u_param), 1.0);
}\`;

    const WATER: string = \`precision mediump float;
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
\${SCENE}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 off = vec2(
    valueNoise(uv * 5.0 + u_time * 0.5) - 0.5,
    valueNoise(uv * 5.0 - u_time * 0.4 + 7.0) - 0.5
  ) * 0.08;
  gl_FragColor = vec4(scene(uv + off * u_param), 1.0);
}\`;

    const toy = makeShaderToy(canvas, HEAT, { info: info, param: 1.0 });

    document.getElementById('btnDistHeat')?.addEventListener('click', (): void => {
        toy.setFrag(HEAT); toy.setParam(1.0);
        info.textContent = 'Heat haze: a vertical sine offsets the UV.';
    });
    document.getElementById('btnDistWater')?.addEventListener('click', (): void => {
        toy.setFrag(WATER); toy.setParam(1.0);
        info.textContent = 'Water refraction: a noise field offsets the UV.';
    });
    document.getElementById('btnDistStronger')?.addEventListener('click', (): void => {
        toy.setParam(2.2); info.textContent = 'Stronger — u_param scales the offset.';
    });
    document.getElementById('btnDistSubtler')?.addEventListener('click', (): void => {
        toy.setParam(0.5); info.textContent = 'Subtler — a believable in-game amount.';
    });
})();`;

// =============================================================================
// DEMO 7 — sh_fireGL  (§ Mini-Project: Animated Fire / Smoke)
// =============================================================================
DEMO_HTML.sh_fireGL = {
    title: 'Shaders — Mini-Project: Animated Fire / Smoke',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnFireFire',   text: 'Fire' },
        { id: 'btnFireSmoke',  text: 'Smoke' },
        { id: 'btnFireTurb',   text: 'Toggle turbulence' },
        { id: 'btnFireHotter', text: 'Hotter' }
    ],
    info: 'fbm + rising flow + falloff + palette = fire/smoke.'
};

DEMO_CODE.sh_fireGL = `(function fireShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const state = { smoke: false, turbulent: true };

    function buildFrag(s) {
        const octaves = s.turbulent ? '6' : '3';
        const palette = s.smoke
            ? 'vec3 col = mix(vec3(0.02, 0.02, 0.03), vec3(0.55, 0.55, 0.58), v);'
            : 'vec3 col = mix(vec3(0.40, 0.02, 0.0), vec3(1.0, 0.85, 0.25), v);\\n' +
              '  col = mix(col, vec3(1.0, 0.35, 0.05), smoothstep(0.45, 0.05, v));';
        return \`precision mediump float;
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
  for (int i = 0; i < \${octaves}; i++) {
    sum += amp * valueNoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x * 3.0, uv.y * 4.0 - u_time * 2.0);
  float n = fbm(p);
  float flame = n * (1.0 - uv.y) * 2.2 * u_param;
  float v = smoothstep(0.0, 0.7, flame);
  \${palette}
  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(state), { info: info, param: 1.0 });
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
})();`;

DEMO_CODE_TS.sh_fireGL = `interface FireState { smoke: boolean; turbulent: boolean; }

(function fireShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const state: FireState = { smoke: false, turbulent: true };

    function buildFrag(s: FireState): string {
        const octaves: string = s.turbulent ? '6' : '3';
        const palette: string = s.smoke
            ? 'vec3 col = mix(vec3(0.02, 0.02, 0.03), vec3(0.55, 0.55, 0.58), v);'
            : 'vec3 col = mix(vec3(0.40, 0.02, 0.0), vec3(1.0, 0.85, 0.25), v);\\n' +
              '  col = mix(col, vec3(1.0, 0.35, 0.05), smoothstep(0.45, 0.05, v));';
        return \`precision mediump float;
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
  for (int i = 0; i < \${octaves}; i++) {
    sum += amp * valueNoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x * 3.0, uv.y * 4.0 - u_time * 2.0);
  float n = fbm(p);
  float flame = n * (1.0 - uv.y) * 2.2 * u_param;
  float v = smoothstep(0.0, 0.7, flame);
  \${palette}
  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(state), { info: info, param: 1.0 });
    function refresh(msg: string): void { toy.setFrag(buildFrag(state)); info.textContent = msg; }

    document.getElementById('btnFireFire')?.addEventListener('click', (): void => {
        state.smoke = false; refresh('Fire palette — dark red → orange → yellow.');
    });
    document.getElementById('btnFireSmoke')?.addEventListener('click', (): void => {
        state.smoke = true; refresh('Smoke palette — same fbm, grayscale ramp.');
    });
    document.getElementById('btnFireTurb')?.addEventListener('click', (): void => {
        state.turbulent = !state.turbulent;
        refresh('Turbulence ' + (state.turbulent ? 'ON (6 octaves)' : 'OFF (3 octaves)') + ' — rebuilt shader.');
    });
    document.getElementById('btnFireHotter')?.addEventListener('click', (): void => {
        toy.setParam(1.8); info.textContent = 'Intensity up — u_param scales the flame.';
    });
})();`;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS (verbatim from bundles-beginner.js).
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.sh_createProgram = ['sh_compileShader'];
DEPENDENCY_REQUIRES.sh_makeShaderToy = ['sh_fullscreenQuad', 'sh_createProgram'];
