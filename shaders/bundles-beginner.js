// =============================================================================
// SHADERS TRACK — BEGINNER TIER EXPORT BUNDLES
// =============================================================================
// Feeds the shared export-demo injector (shared/export-demo.js) so the
// 📋 Export button on each `<details data-demo-id="sh_*">` block can copy a
// fully-runnable HTML to the clipboard. The shared injector reads from the
// same globals every other track uses:
//   - DEMO_HTML            : per-demo scaffold metadata (title, canvas size, controls, info)
//   - DEMO_CODE / DEMO_CODE_TS         : runnable IIFE source for each demo
//   - DEPENDENCY_BUNDLES / DEPENDENCY_BUNDLES_TS : reusable helper source strings
//
// IDs are prefixed `sh_` so they cannot collide with the Fundamentals or the
// `iso_` isometric-strategy demos even if two registries co-load on a page.
//
// ── Canvas-ID convention ─────────────────────────────────────────────────────
// The shared standalone-HTML generator hardcodes `<canvas id="canvas">` and
// `<div id="info">`. The page-side demos in beginner-demos.js look up specific
// IDs (e.g. 'firstGL', 'firstGLInfo'). The DEMO_CODE strings below are
// *rewrites* of those IIFEs with the lookups retargeted to the scaffold's fixed
// `canvas` / `info` IDs. Button IDs are kept untouched because the scaffold's
// `controls` array names them.
//
// ── GLSL-as-template-literal convention ──────────────────────────────────────
// Every DEMO_CODE.sh_* below is itself a JS template literal. The fragment
// shaders inside are written as a nested template literal. GLSL contains NO
// backtick and NO `${`, so the ONLY escaping needed is the inner literal's two
// delimiter backticks (\`). The water demo interpolates JS state into its GLSL
// (\${s.amp} etc.) and solid() interpolates colors (\${r}); those `${...}` are
// escaped as \${...} so the OUTER literal does not evaluate them at load time
// — identical to how isometric-strategy/bundles-beginner.js escapes \${cx}.
// JS string escapes that must survive into the exported source (e.g. the scan
// ternary's '\\n', 'Shader compile failed:\\n') stay double-escaped.
// Always verify exports by actually running them, never by eye.
// =============================================================================

// Initialize registries (no-op if a sibling bundle already created them).
window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// DEPENDENCY BUNDLES — reusable WebGL helpers inlined at export time.
// These mirror the real functions in beginner-demos.js. Keep them in sync.
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

// ── TypeScript variants ──────────────────────────────────────────────────────
// Sucrase strips these at export-time in the browser (see shared/export-demo.js).

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
// DEMO 1 — sh_firstGL  (§ Your First Fragment Shader)
// Solid color; buttons swap the whole fragment shader at runtime.
// =============================================================================
DEMO_HTML.sh_firstGL = {
    title: 'Shaders — Your First Fragment Shader',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnColRed',  text: 'Red' },
        { id: 'btnColTeal', text: 'Teal' },
        { id: 'btnColBlue', text: 'Theme Blue' }
    ],
    info: 'Every pixel runs main() in parallel. Click to swap the shader.'
};

DEMO_CODE.sh_firstGL = `(function firstShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    // A fragment shader: one program, run once PER PIXEL, in parallel.
    // gl_FragColor is the output color as vec4(r, g, b, a) in 0..1 (not 0..255).
    function solid(r, g, b) {
        return \`precision mediump float;
void main() {
  gl_FragColor = vec4(\${r}, \${g}, \${b}, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, solid('0.90', '0.25', '0.22'),
        { info: info });

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
})();`;

DEMO_CODE_TS.sh_firstGL = `(function firstShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function solid(r: string, g: string, b: string): string {
        return \`precision mediump float;
void main() {
  gl_FragColor = vec4(\${r}, \${g}, \${b}, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, solid('0.90', '0.25', '0.22'),
        { info: info });

    document.getElementById('btnColRed')?.addEventListener('click', (): void => {
        toy.setFrag(solid('0.90', '0.25', '0.22'));
        info.textContent = 'gl_FragColor = vec4(0.90, 0.25, 0.22, 1.0)';
    });
    document.getElementById('btnColTeal')?.addEventListener('click', (): void => {
        toy.setFrag(solid('0.20', '0.78', '0.70'));
        info.textContent = 'gl_FragColor = vec4(0.20, 0.78, 0.70, 1.0)';
    });
    document.getElementById('btnColBlue')?.addEventListener('click', (): void => {
        toy.setFrag(solid('0.31', '0.76', '0.97'));
        info.textContent = 'gl_FragColor = vec4(0.31, 0.76, 0.97, 1.0)';
    });
})();`;

// =============================================================================
// DEMO 2 — sh_uvGL  (§ UV Coordinates)
// gl_FragCoord / u_resolution → the classic red-green gradient.
// =============================================================================
DEMO_HTML.sh_uvGL = {
    title: 'Shaders — UV Coordinates',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnUvRaw',      text: 'Raw uv' },
        { id: 'btnUvCentered', text: 'Centered' },
        { id: 'btnUvAspect',   text: 'Aspect-corrected' }
    ],
    info: 'uv = gl_FragCoord.xy / u_resolution → red = x, green = y.'
};

DEMO_CODE.sh_uvGL = `(function uvShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    // Raw uv: bottom-left (0,0) → top-right (1,1).
    const RAW = \`precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = vec4(uv, 0.0, 1.0);
}\`;

    // Centered: remap to -1..1 so (0,0) is the middle.
    const CENTERED = \`precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution * 2.0 - 1.0;
  gl_FragColor = vec4(uv * 0.5 + 0.5, 0.0, 1.0);
}\`;

    // Aspect-corrected: scale x by the aspect ratio so a circle is round.
    const ASPECT = \`precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;
  float d = step(length(uv), 0.6);
  gl_FragColor = vec4(vec3(d), 1.0);
}\`;

    const toy = makeShaderToy(canvas, RAW, { info: info });

    document.getElementById('btnUvRaw')?.addEventListener('click', () => {
        toy.setFrag(RAW); info.textContent = 'Raw uv 0..1 — red grows right, green grows up.';
    });
    document.getElementById('btnUvCentered')?.addEventListener('click', () => {
        toy.setFrag(CENTERED); info.textContent = 'Remapped to -1..1 — origin is the center.';
    });
    document.getElementById('btnUvAspect')?.addEventListener('click', () => {
        toy.setFrag(ASPECT); info.textContent = 'Aspect-corrected — the circle is actually round.';
    });
})();`;

DEMO_CODE_TS.sh_uvGL = `(function uvShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const RAW: string = \`precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = vec4(uv, 0.0, 1.0);
}\`;

    const CENTERED: string = \`precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution * 2.0 - 1.0;
  gl_FragColor = vec4(uv * 0.5 + 0.5, 0.0, 1.0);
}\`;

    const ASPECT: string = \`precision mediump float;
uniform vec2 u_resolution;
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;
  float d = step(length(uv), 0.6);
  gl_FragColor = vec4(vec3(d), 1.0);
}\`;

    const toy = makeShaderToy(canvas, RAW, { info: info });

    document.getElementById('btnUvRaw')?.addEventListener('click', (): void => {
        toy.setFrag(RAW); info.textContent = 'Raw uv 0..1 — red grows right, green grows up.';
    });
    document.getElementById('btnUvCentered')?.addEventListener('click', (): void => {
        toy.setFrag(CENTERED); info.textContent = 'Remapped to -1..1 — origin is the center.';
    });
    document.getElementById('btnUvAspect')?.addEventListener('click', (): void => {
        toy.setFrag(ASPECT); info.textContent = 'Aspect-corrected — the circle is actually round.';
    });
})();`;

// =============================================================================
// DEMO 3 — sh_shapingGL  (§ Shaping Functions)
// step / smoothstep / distance fields turn uv into masks. u_param = softness.
// =============================================================================
DEMO_HTML.sh_shapingGL = {
    title: 'Shaders — Shaping Functions',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnShapeCircle',  text: 'Soft circle' },
        { id: 'btnShapeStripes', text: 'Stripes' },
        { id: 'btnShapeSofter',  text: 'Softer edge' },
        { id: 'btnShapeSharper', text: 'Sharper edge' }
    ],
    info: 'smoothstep on a distance field = an anti-aliased shape mask.'
};

DEMO_CODE.sh_shapingGL = `(function shapingShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    // length(uv - center) is a distance field; smoothstep makes a soft edge.
    // u_param (fed from JS) widens/narrows the smoothstep band.
    const CIRCLE = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_param;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float c = u_resolution.x / u_resolution.y * 0.5;
  float d = distance(uv, vec2(c, 0.5));
  float m = 1.0 - smoothstep(0.28, 0.28 + u_param, d);
  gl_FragColor = vec4(vec3(m) * vec3(0.31, 0.76, 0.97), 1.0);
}\`;

    // fract() tiles space; step() turns the sawtooth into hard bars.
    const STRIPES = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_param;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float bars = step(0.5, fract(uv.x * 10.0));
  float m = mix(0.12, 1.0, bars);
  gl_FragColor = vec4(vec3(m) * vec3(0.40, 0.85, 0.55), 1.0);
}\`;

    let softness = 0.03;
    const toy = makeShaderToy(canvas, CIRCLE, { info: info, param: softness });

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
})();`;

DEMO_CODE_TS.sh_shapingGL = `(function shapingShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const CIRCLE: string = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_param;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float c = u_resolution.x / u_resolution.y * 0.5;
  float d = distance(uv, vec2(c, 0.5));
  float m = 1.0 - smoothstep(0.28, 0.28 + u_param, d);
  gl_FragColor = vec4(vec3(m) * vec3(0.31, 0.76, 0.97), 1.0);
}\`;

    const STRIPES: string = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_param;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float bars = step(0.5, fract(uv.x * 10.0));
  float m = mix(0.12, 1.0, bars);
  gl_FragColor = vec4(vec3(m) * vec3(0.40, 0.85, 0.55), 1.0);
}\`;

    let softness: number = 0.03;
    const toy = makeShaderToy(canvas, CIRCLE, { info: info, param: softness });

    document.getElementById('btnShapeCircle')?.addEventListener('click', (): void => {
        toy.setFrag(CIRCLE); info.textContent = 'Distance field + smoothstep → a soft circle.';
    });
    document.getElementById('btnShapeStripes')?.addEventListener('click', (): void => {
        toy.setFrag(STRIPES); info.textContent = 'fract() + step() → hard repeating bars.';
    });
    document.getElementById('btnShapeSofter')?.addEventListener('click', (): void => {
        softness = Math.min(softness + 0.03, 0.4);
        toy.setParam(softness);
        info.textContent = 'Edge softness u_param = ' + softness.toFixed(2);
    });
    document.getElementById('btnShapeSharper')?.addEventListener('click', (): void => {
        softness = Math.max(softness - 0.03, 0.001);
        toy.setParam(softness);
        info.textContent = 'Edge softness u_param = ' + softness.toFixed(2);
    });
})();`;

// =============================================================================
// DEMO 4 — sh_colorGL  (§ Color & Gradients)
// mix() blends colors; floor() quantizes a gradient into bands.
// =============================================================================
DEMO_HTML.sh_colorGL = {
    title: 'Shaders — Color & Gradients',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnGradLinear', text: 'Linear' },
        { id: 'btnGradRadial', text: 'Radial' },
        { id: 'btnGradBanded', text: 'Banded' }
    ],
    info: 'mix(a, b, t) is a per-pixel lerp between two colors.'
};

DEMO_CODE.sh_colorGL = `(function colorShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const LINEAR = \`precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  float t = gl_FragCoord.x / u_resolution.x;
  gl_FragColor = vec4(mix(A, B, t), 1.0);
}\`;

    const RADIAL = \`precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float c = u_resolution.x / u_resolution.y * 0.5;
  float t = clamp(distance(uv, vec2(c, 0.5)) * 1.6, 0.0, 1.0);
  gl_FragColor = vec4(mix(B, A, t), 1.0);
}\`;

    const BANDED = \`precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  float t = gl_FragCoord.x / u_resolution.x;
  t = floor(t * 6.0) / 6.0;
  gl_FragColor = vec4(mix(A, B, t), 1.0);
}\`;

    const toy = makeShaderToy(canvas, LINEAR, { info: info });

    document.getElementById('btnGradLinear')?.addEventListener('click', () => {
        toy.setFrag(LINEAR); info.textContent = 'Linear: t = x / width, mix(A, B, t).';
    });
    document.getElementById('btnGradRadial')?.addEventListener('click', () => {
        toy.setFrag(RADIAL); info.textContent = 'Radial: t = distance from center.';
    });
    document.getElementById('btnGradBanded')?.addEventListener('click', () => {
        toy.setFrag(BANDED); info.textContent = 'Banded: floor(t * 6) / 6 → posterized.';
    });
})();`;

DEMO_CODE_TS.sh_colorGL = `(function colorShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const LINEAR: string = \`precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  float t = gl_FragCoord.x / u_resolution.x;
  gl_FragColor = vec4(mix(A, B, t), 1.0);
}\`;

    const RADIAL: string = \`precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float c = u_resolution.x / u_resolution.y * 0.5;
  float t = clamp(distance(uv, vec2(c, 0.5)) * 1.6, 0.0, 1.0);
  gl_FragColor = vec4(mix(B, A, t), 1.0);
}\`;

    const BANDED: string = \`precision mediump float;
uniform vec2 u_resolution;
vec3 A = vec3(0.05, 0.16, 0.40);
vec3 B = vec3(1.00, 0.65, 0.30);
void main() {
  float t = gl_FragCoord.x / u_resolution.x;
  t = floor(t * 6.0) / 6.0;
  gl_FragColor = vec4(mix(A, B, t), 1.0);
}\`;

    const toy = makeShaderToy(canvas, LINEAR, { info: info });

    document.getElementById('btnGradLinear')?.addEventListener('click', (): void => {
        toy.setFrag(LINEAR); info.textContent = 'Linear: t = x / width, mix(A, B, t).';
    });
    document.getElementById('btnGradRadial')?.addEventListener('click', (): void => {
        toy.setFrag(RADIAL); info.textContent = 'Radial: t = distance from center.';
    });
    document.getElementById('btnGradBanded')?.addEventListener('click', (): void => {
        toy.setFrag(BANDED); info.textContent = 'Banded: floor(t * 6) / 6 → posterized.';
    });
})();`;

// =============================================================================
// DEMO 5 — sh_timeGL  (§ Animation with u_time)
// u_time (seconds) drives sin/cos. Pause + speed via the toy handle.
// =============================================================================
DEMO_HTML.sh_timeGL = {
    title: 'Shaders — Animation with u_time',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnTimePause', text: 'Pause / Resume' },
        { id: 'btnTimeSlow',  text: 'Slow (0.3×)' },
        { id: 'btnTimeFast',  text: 'Fast (2.5×)' }
    ],
    info: 'A pulsing circle + a colour wave, both driven by u_time.'
};

DEMO_CODE.sh_timeGL = `(function timeShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const FRAG = \`precision mediump float;
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
}\`;

    let paused = false;
    const toy = makeShaderToy(canvas, FRAG, { info: info });

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
})();`;

DEMO_CODE_TS.sh_timeGL = `(function timeShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const FRAG: string = \`precision mediump float;
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
}\`;

    let paused: boolean = false;
    const toy = makeShaderToy(canvas, FRAG, { info: info });

    document.getElementById('btnTimePause')?.addEventListener('click', (): void => {
        paused = !paused;
        toy.setPaused(paused);
        info.textContent = paused ? 'Paused — u_time is frozen.' : 'Running — u_time advances in seconds.';
    });
    document.getElementById('btnTimeSlow')?.addEventListener('click', (): void => {
        toy.setTimeScale(0.3); info.textContent = 'Time scale 0.3× — same shader, slower clock.';
    });
    document.getElementById('btnTimeFast')?.addEventListener('click', (): void => {
        toy.setTimeScale(2.5); info.textContent = 'Time scale 2.5× — frame-rate independent.';
    });
})();`;

// =============================================================================
// DEMO 6 — sh_mouseGL  (§ Interactivity with u_mouse)
// Distance-to-mouse field: a cursor spotlight, or a repelling ripple.
// =============================================================================
DEMO_HTML.sh_mouseGL = {
    title: 'Shaders — Interactivity with u_mouse',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnMouseSpot',   text: 'Spotlight' },
        { id: 'btnMouseRipple', text: 'Ripple' }
    ],
    info: 'Move the mouse over the canvas — u_mouse is in pixels (Y-flipped).'
};

DEMO_CODE.sh_mouseGL = `(function mouseShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    // u_mouse shares gl_FragCoord space (px, bottom-left origin).
    const SPOT = \`precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  float d = distance(gl_FragCoord.xy, u_mouse) / u_resolution.y;
  float light = 1.0 - smoothstep(0.0, 0.45, d);
  vec3 col = mix(vec3(0.04, 0.05, 0.10), vec3(0.31, 0.76, 0.97), light);
  gl_FragColor = vec4(col, 1.0);
}\`;

    const RIPPLE = \`precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float d = distance(gl_FragCoord.xy, u_mouse) / u_resolution.y;
  float r = sin(d * 40.0 - u_time * 6.0) * exp(-d * 4.0);
  vec3 col = vec3(0.10, 0.20, 0.35) + r * 0.5;
  gl_FragColor = vec4(col, 1.0);
}\`;

    const toy = makeShaderToy(canvas, SPOT, { info: info });

    document.getElementById('btnMouseSpot')?.addEventListener('click', () => {
        toy.setFrag(SPOT); info.textContent = 'Spotlight: 1 - smoothstep(distance to cursor).';
    });
    document.getElementById('btnMouseRipple')?.addEventListener('click', () => {
        toy.setFrag(RIPPLE); info.textContent = 'Ripple: sin(distance * f - time) decaying outward.';
    });
})();`;

DEMO_CODE_TS.sh_mouseGL = `(function mouseShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const SPOT: string = \`precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  float d = distance(gl_FragCoord.xy, u_mouse) / u_resolution.y;
  float light = 1.0 - smoothstep(0.0, 0.45, d);
  vec3 col = mix(vec3(0.04, 0.05, 0.10), vec3(0.31, 0.76, 0.97), light);
  gl_FragColor = vec4(col, 1.0);
}\`;

    const RIPPLE: string = \`precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float d = distance(gl_FragCoord.xy, u_mouse) / u_resolution.y;
  float r = sin(d * 40.0 - u_time * 6.0) * exp(-d * 4.0);
  vec3 col = vec3(0.10, 0.20, 0.35) + r * 0.5;
  gl_FragColor = vec4(col, 1.0);
}\`;

    const toy = makeShaderToy(canvas, SPOT, { info: info });

    document.getElementById('btnMouseSpot')?.addEventListener('click', (): void => {
        toy.setFrag(SPOT); info.textContent = 'Spotlight: 1 - smoothstep(distance to cursor).';
    });
    document.getElementById('btnMouseRipple')?.addEventListener('click', (): void => {
        toy.setFrag(RIPPLE); info.textContent = 'Ripple: sin(distance * f - time) decaying outward.';
    });
})();`;

// =============================================================================
// DEMO 7 — sh_waterGL  (§ Mini-Project: Animated Water Tint)
// Capstone: scrolling sine "water" + depth tint + mouse ripple + optional
// scanline overlay. The kind of full-screen effect a 2D game layers on a scene.
// =============================================================================
DEMO_HTML.sh_waterGL = {
    title: 'Shaders — Mini-Project: Animated Water Tint',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnWaterCalm',     text: 'Calm' },
        { id: 'btnWaterChoppy',   text: 'Choppy' },
        { id: 'btnWaterScanline', text: 'Toggle scanline' },
        { id: 'btnWaterMurky',    text: 'Toggle murky' }
    ],
    info: 'Compose everything: uv, shaping, mix, u_time, u_mouse.'
};

DEMO_CODE.sh_waterGL = `(function waterShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const state = { amp: '0.018', scanline: false, murky: false };

    // Build the fragment shader from the current state. Everything the tier
    // taught shows up here: uv, distance fields, mix(), u_time, u_mouse.
    function buildFrag(s) {
        const shallow = s.murky ? 'vec3(0.18, 0.38, 0.30)' : 'vec3(0.35, 0.78, 0.92)';
        const deep    = s.murky ? 'vec3(0.02, 0.10, 0.09)' : 'vec3(0.03, 0.18, 0.38)';
        const scan = s.scanline
            ? '  col *= 0.86 + 0.14 * sin(gl_FragCoord.y * 3.14159);\\n'
            : '';
        return \`precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 m = u_mouse / u_resolution;
  float md = distance(uv, m);
  float ripple = sin(md * 38.0 - u_time * 4.0) * exp(-md * 6.0) * 0.025;
  float wave = sin(uv.x * 11.0 + u_time * 1.4) * \${s.amp}
             + sin(uv.y * 17.0 - u_time * 2.0) * \${s.amp} * 0.6
             + ripple;
  float depth = clamp(uv.y + wave, 0.0, 1.0);
  vec3 col = mix(\${deep}, \${shallow}, depth);
  float caustic = smoothstep(0.55, 1.0,
      sin(uv.x * 26.0 + u_time * 2.0 + wave * 22.0)
    * sin(uv.y * 20.0 - u_time * 1.6));
  col += caustic * 0.10;
\${scan}  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(state), { info: info });
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
})();`;

DEMO_CODE_TS.sh_waterGL = `interface WaterState { amp: string; scanline: boolean; murky: boolean; }

(function waterShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const state: WaterState = { amp: '0.018', scanline: false, murky: false };

    function buildFrag(s: WaterState): string {
        const shallow: string = s.murky ? 'vec3(0.18, 0.38, 0.30)' : 'vec3(0.35, 0.78, 0.92)';
        const deep: string    = s.murky ? 'vec3(0.02, 0.10, 0.09)' : 'vec3(0.03, 0.18, 0.38)';
        const scan: string = s.scanline
            ? '  col *= 0.86 + 0.14 * sin(gl_FragCoord.y * 3.14159);\\n'
            : '';
        return \`precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 m = u_mouse / u_resolution;
  float md = distance(uv, m);
  float ripple = sin(md * 38.0 - u_time * 4.0) * exp(-md * 6.0) * 0.025;
  float wave = sin(uv.x * 11.0 + u_time * 1.4) * \${s.amp}
             + sin(uv.y * 17.0 - u_time * 2.0) * \${s.amp} * 0.6
             + ripple;
  float depth = clamp(uv.y + wave, 0.0, 1.0);
  vec3 col = mix(\${deep}, \${shallow}, depth);
  float caustic = smoothstep(0.55, 1.0,
      sin(uv.x * 26.0 + u_time * 2.0 + wave * 22.0)
    * sin(uv.y * 20.0 - u_time * 1.6));
  col += caustic * 0.10;
\${scan}  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(state), { info: info });
    function refresh(msg: string): void { toy.setFrag(buildFrag(state)); info.textContent = msg; }

    document.getElementById('btnWaterCalm')?.addEventListener('click', (): void => {
        state.amp = '0.018'; refresh('Calm water — small wave amplitude.');
    });
    document.getElementById('btnWaterChoppy')?.addEventListener('click', (): void => {
        state.amp = '0.055'; refresh('Choppy water — larger wave amplitude.');
    });
    document.getElementById('btnWaterScanline')?.addEventListener('click', (): void => {
        state.scanline = !state.scanline;
        refresh('Scanline overlay ' + (state.scanline ? 'ON' : 'OFF') + ' — a retro CRT-style post FX.');
    });
    document.getElementById('btnWaterMurky')?.addEventListener('click', (): void => {
        state.murky = !state.murky;
        refresh('Tint: ' + (state.murky ? 'murky swamp' : 'clear ocean') + ' — just different mix() colors.');
    });
})();`;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS (consumed by shared/export-demo.js
// resolveDepClosure). The data-deps strings in beginner.html already list the
// full ordered closure, so this is an idempotent safety net.
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.sh_createProgram = ['sh_compileShader'];
DEPENDENCY_REQUIRES.sh_makeShaderToy = ['sh_fullscreenQuad', 'sh_createProgram'];
