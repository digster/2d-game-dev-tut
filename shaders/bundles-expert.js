// =============================================================================
// SHADERS TRACK — EXPERT TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js so the 📋 Export button on each
// `<details data-demo-id="sh_*">` copies a runnable HTML to the clipboard.
//
// IDs are `sh_`-prefixed (distinct from Beginner/Intermediate keys). Tier pages
// never co-load, so this file is self-contained. The compile/link/quad helpers
// are copied verbatim from earlier tiers; `sh_makeShaderToy` here is the
// EXTENDED copy with the additive `opts.sprite` texture branch. Two new leaf
// deps: `sh_drawSprite` (the procedural sprite painter) and `sh_glslKit`
// (shared GLSL_HEAD/GLSL_NOISE consts). No image assets → exports stay
// self-contained.
//
// ── GLSL-as-template-literal convention (unchanged) ──────────────────────────
// Each DEMO_CODE.sh_* is a JS template literal. GLSL inside is a nested
// template literal → only its delimiter backticks are escaped (\`). Demos that
// build a shader from JS state interpolate with \${...} so the OUTER literal
// doesn't evaluate it at load time. JS escapes that must survive into the
// exported source (e.g. 'Shader compile failed:\\n') stay double-escaped.
// Verify exports by running them, never by eye.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// DEPENDENCY BUNDLES
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

DEPENDENCY_BUNDLES.sh_fullscreenQuad = `const SH_VERT_SRC = \`attribute vec2 a_position;
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

DEPENDENCY_BUNDLES.sh_drawSprite = `// The procedural "art": a faceted gem in four luminance bands so palette
// swaps & luminance ramps read cleanly, with a crisp silhouette and
// transparent margins (CLAMP_TO_EDGE-safe neighbour taps).
function drawSprite(ctx, n) {
    ctx.clearRect(0, 0, n, n);
    const cx = n / 2, cy = n / 2, r = n * 0.34;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.5, cy + r);
    ctx.lineTo(cx - r * 0.5, cy + r);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#3a3f55';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.5, cy + r);
    ctx.lineTo(cx, cy + r * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#6b7390';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.5, cy + r);
    ctx.lineTo(cx, cy + r * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#aab3d6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy - r * 0.42, n * 0.028, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
}`;

DEPENDENCY_BUNDLES.sh_glslKit = `// Shared GLSL building blocks reused across the Expert demos.
const GLSL_HEAD = \`precision mediump float;
uniform vec2 u_resolution;
uniform sampler2D u_tex;
uniform vec2 u_texResolution;
uniform float u_time;
uniform float u_param;
vec2 toSpriteUV(vec2 uv) {
  vec2 c = uv - 0.5;
  c.x *= u_resolution.x / u_resolution.y;
  return c / 0.36 * 0.5 + 0.5;
}
vec3 backdrop(vec2 uv) {
  vec2 g = floor(vec2(uv.x * u_resolution.x / u_resolution.y, uv.y) * 16.0);
  float ch = mod(g.x + g.y, 2.0);
  return mix(vec3(0.10, 0.11, 0.15), vec3(0.13, 0.14, 0.19), ch);
}
\`;
const GLSL_NOISE = \`float hash(vec2 p) {
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
\`;`;

DEPENDENCY_BUNDLES.sh_makeShaderToy = `// Runner with an additive, backward-compatible texture branch. opts.sprite
// (ctx2d, size) paints a 256x256 POT offscreen canvas uploaded as u_tex
// (unit 0); u_texResolution carries its size. No opts.sprite → texture path
// skipped (behaviour identical to the earlier tiers).
//
// u_mouse: pixels, Y-flipped to share gl_FragCoord's bottom-left origin.
// Texture: UNPACK_FLIP_Y so a Y-down 2D-canvas sprite samples upright.
function makeShaderToy(canvas, fragSrc, opts) {
    opts = opts || {};
    const info = opts.info || null;
    let timeScale = opts.timeScale != null ? opts.timeScale : 1;
    let paused = !!opts.paused;
    let uParam = opts.param != null ? opts.param : 0;
    const TEX_SIZE = 256;
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
                String(msg).split('\\n').forEach((line, i) =>
                    c2d.fillText(line.slice(0, 92), 12, 24 + i * 18));
            }
        }
    }

    const noop = { stop() {}, setFrag() {}, setParam() {}, setPaused() {}, setTimeScale() {} };
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { fail('WebGL is not available in this browser/context.', null); return noop; }

    let spriteTex = null;
    function ensureTexture() {
        if (!opts.sprite || spriteTex) return;
        const sc = document.createElement('canvas');
        sc.width = TEX_SIZE; sc.height = TEX_SIZE;
        opts.sprite(sc.getContext('2d'), TEX_SIZE);
        spriteTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, spriteTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    let program = null, uTime, uRes, uMouse, uP, uTex, uTexRes;
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
            uTex = gl.getUniformLocation(program, 'u_tex');
            uTexRes = gl.getUniformLocation(program, 'u_texResolution');
            ensureTexture();
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
    canvas.addEventListener('webglcontextrestored', () => { spriteTex = null; build(fragSrc); }, false);

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
        if (spriteTex) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, spriteTex);
            if (uTex) gl.uniform1i(uTex, 0);
            if (uTexRes) gl.uniform2f(uTexRes, TEX_SIZE, TEX_SIZE);
        }
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

DEPENDENCY_BUNDLES_TS.sh_drawSprite = `function drawSprite(ctx: CanvasRenderingContext2D, n: number): void {
    ctx.clearRect(0, 0, n, n);
    const cx = n / 2, cy = n / 2, r = n * 0.34;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.5, cy + r);
    ctx.lineTo(cx - r * 0.5, cy + r);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#3a3f55';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.5, cy + r);
    ctx.lineTo(cx, cy + r * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#6b7390';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.5, cy + r);
    ctx.lineTo(cx, cy + r * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#aab3d6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy - r * 0.42, n * 0.028, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
}`;

DEPENDENCY_BUNDLES_TS.sh_glslKit = `const GLSL_HEAD: string = \`precision mediump float;
uniform vec2 u_resolution;
uniform sampler2D u_tex;
uniform vec2 u_texResolution;
uniform float u_time;
uniform float u_param;
vec2 toSpriteUV(vec2 uv) {
  vec2 c = uv - 0.5;
  c.x *= u_resolution.x / u_resolution.y;
  return c / 0.36 * 0.5 + 0.5;
}
vec3 backdrop(vec2 uv) {
  vec2 g = floor(vec2(uv.x * u_resolution.x / u_resolution.y, uv.y) * 16.0);
  float ch = mod(g.x + g.y, 2.0);
  return mix(vec3(0.10, 0.11, 0.15), vec3(0.13, 0.14, 0.19), ch);
}
\`;
const GLSL_NOISE: string = \`float hash(vec2 p) {
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
\`;`;

DEPENDENCY_BUNDLES_TS.sh_makeShaderToy = `interface ToyOpts {
    info?: HTMLElement | null;
    timeScale?: number;
    paused?: boolean;
    param?: number;
    sprite?: (ctx: CanvasRenderingContext2D, size: number) => void;
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
    const TEX_SIZE = 256;
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

    let spriteTex: WebGLTexture | null = null;
    function ensureTexture(): void {
        if (!opts.sprite || spriteTex) return;
        const sc = document.createElement('canvas');
        sc.width = TEX_SIZE; sc.height = TEX_SIZE;
        opts.sprite(sc.getContext('2d') as CanvasRenderingContext2D, TEX_SIZE);
        spriteTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, spriteTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    let program: WebGLProgram | null = null;
    let uTime: WebGLUniformLocation | null;
    let uRes: WebGLUniformLocation | null;
    let uMouse: WebGLUniformLocation | null;
    let uP: WebGLUniformLocation | null;
    let uTex: WebGLUniformLocation | null;
    let uTexRes: WebGLUniformLocation | null;
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
            uTex = gl.getUniformLocation(program, 'u_tex');
            uTexRes = gl.getUniformLocation(program, 'u_texResolution');
            ensureTexture();
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
    canvas.addEventListener('webglcontextrestored', () => { spriteTex = null; build(fragSrc); }, false);

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
        if (spriteTex) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, spriteTex);
            if (uTex) gl.uniform1i(uTex, 0);
            if (uTexRes) gl.uniform2f(uTexRes, TEX_SIZE, TEX_SIZE);
        }
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
// DEMO 1 — sh_sampleGL  (§ Sampling a Texture)
// =============================================================================
DEMO_HTML.sh_sampleGL = {
    title: 'Shaders — Sampling a Texture',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnSampFit',     text: 'Fitted' },
        { id: 'btnSampStretch', text: 'Stretched' },
        { id: 'btnSampUV',      text: 'Show UV' }
    ],
    info: 'texture2D(u_tex, uv) — map a procedural sprite into the canvas.'
};

DEMO_CODE.sh_sampleGL = `(function sampleShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const FIT = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const STRETCH = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, uv);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const SHOWUV = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  gl_FragColor = vec4(mix(backdrop(uv), vec3(s, 0.0), tex.a), 1.0);
}\`;

    const toy = makeShaderToy(canvas, FIT, { info: info, sprite: drawSprite });

    document.getElementById('btnSampFit')?.addEventListener('click', () => {
        toy.setFrag(FIT); info.textContent = 'Fitted: aspect-correct square sprite space.';
    });
    document.getElementById('btnSampStretch')?.addEventListener('click', () => {
        toy.setFrag(STRETCH); info.textContent = 'Stretched: sampling with raw uv squashes the gem.';
    });
    document.getElementById('btnSampUV')?.addEventListener('click', () => {
        toy.setFrag(SHOWUV); info.textContent = 'Sprite-space uv shown as red=x, green=y.';
    });
})();`;

DEMO_CODE_TS.sh_sampleGL = `(function sampleShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const FIT: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const STRETCH: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, uv);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const SHOWUV: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  gl_FragColor = vec4(mix(backdrop(uv), vec3(s, 0.0), tex.a), 1.0);
}\`;

    const toy = makeShaderToy(canvas, FIT, { info: info, sprite: drawSprite });

    document.getElementById('btnSampFit')?.addEventListener('click', (): void => {
        toy.setFrag(FIT); info.textContent = 'Fitted: aspect-correct square sprite space.';
    });
    document.getElementById('btnSampStretch')?.addEventListener('click', (): void => {
        toy.setFrag(STRETCH); info.textContent = 'Stretched: sampling with raw uv squashes the gem.';
    });
    document.getElementById('btnSampUV')?.addEventListener('click', (): void => {
        toy.setFrag(SHOWUV); info.textContent = 'Sprite-space uv shown as red=x, green=y.';
    });
})();`;

// =============================================================================
// DEMO 2 — sh_tintGL  (§ Tinting & Multiply)
// =============================================================================
DEMO_HTML.sh_tintGL = {
    title: 'Shaders — Tinting & Multiply',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnTintNone',  text: 'None' },
        { id: 'btnTintRed',   text: 'Damage (red)' },
        { id: 'btnTintGreen', text: 'Poison (green)' },
        { id: 'btnTintGold',  text: 'Power-up (gold)' }
    ],
    info: 'texColor.rgb * tint — keeps shading, preserves alpha.'
};

DEMO_CODE.sh_tintGL = `(function tintShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    function buildFrag(tint) {
        return GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  vec3 tinted = tex.rgb * \${tint};
  gl_FragColor = vec4(mix(backdrop(uv), tinted, tex.a), 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag('vec3(1.0)'), { info: info, sprite: drawSprite });

    document.getElementById('btnTintNone')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('vec3(1.0)')); info.textContent = 'No tint — texColor * vec3(1.0).';
    });
    document.getElementById('btnTintRed')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('vec3(1.0, 0.35, 0.35)')); info.textContent = 'Damage tint — multiply by red.';
    });
    document.getElementById('btnTintGreen')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('vec3(0.4, 1.0, 0.5)')); info.textContent = 'Poison tint — multiply by green.';
    });
    document.getElementById('btnTintGold')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('vec3(1.0, 0.85, 0.3)')); info.textContent = 'Power-up tint — multiply by gold.';
    });
})();`;

DEMO_CODE_TS.sh_tintGL = `(function tintShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function buildFrag(tint: string): string {
        return GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  vec3 tinted = tex.rgb * \${tint};
  gl_FragColor = vec4(mix(backdrop(uv), tinted, tex.a), 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag('vec3(1.0)'), { info: info, sprite: drawSprite });

    document.getElementById('btnTintNone')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('vec3(1.0)')); info.textContent = 'No tint — texColor * vec3(1.0).';
    });
    document.getElementById('btnTintRed')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('vec3(1.0, 0.35, 0.35)')); info.textContent = 'Damage tint — multiply by red.';
    });
    document.getElementById('btnTintGreen')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('vec3(0.4, 1.0, 0.5)')); info.textContent = 'Poison tint — multiply by green.';
    });
    document.getElementById('btnTintGold')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('vec3(1.0, 0.85, 0.3)')); info.textContent = 'Power-up tint — multiply by gold.';
    });
})();`;

// =============================================================================
// DEMO 3 — sh_paletteGL  (§ Palette Swap)
// =============================================================================
DEMO_HTML.sh_paletteGL = {
    title: 'Shaders — Palette Swap',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnPalOrig',  text: 'Original' },
        { id: 'btnPalFire',  text: 'Fire' },
        { id: 'btnPalIce',   text: 'Ice' },
        { id: 'btnPalToxic', text: 'Toxic' }
    ],
    info: 'luminance → a 3-stop ramp: one sprite, many recolors.'
};

DEMO_CODE.sh_paletteGL = `(function paletteShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    function buildFrag(a, b, c) {
        return GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float l = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  vec3 ramp = l < 0.5
    ? mix(\${a}, \${b}, l * 2.0)
    : mix(\${b}, \${c}, (l - 0.5) * 2.0);
  gl_FragColor = vec4(mix(backdrop(uv), ramp, tex.a), 1.0);
}\`;
    }
    const ORIGINAL = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;

    const toy = makeShaderToy(canvas, ORIGINAL, { info: info, sprite: drawSprite });

    document.getElementById('btnPalOrig')?.addEventListener('click', () => {
        toy.setFrag(ORIGINAL); info.textContent = 'Original sprite colours.';
    });
    document.getElementById('btnPalFire')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('vec3(0.25,0.0,0.0)', 'vec3(0.95,0.35,0.05)', 'vec3(1.0,0.95,0.6)'));
        info.textContent = 'Fire palette — dark → ember → spark by luminance.';
    });
    document.getElementById('btnPalIce')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('vec3(0.03,0.10,0.25)', 'vec3(0.25,0.6,0.95)', 'vec3(0.85,0.97,1.0)'));
        info.textContent = 'Ice palette — same sprite, new ramp.';
    });
    document.getElementById('btnPalToxic')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('vec3(0.05,0.15,0.0)', 'vec3(0.45,0.85,0.1)', 'vec3(0.9,1.0,0.5)'));
        info.textContent = 'Toxic palette — one art asset, many variants.';
    });
})();`;

DEMO_CODE_TS.sh_paletteGL = `(function paletteShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function buildFrag(a: string, b: string, c: string): string {
        return GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float l = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  vec3 ramp = l < 0.5
    ? mix(\${a}, \${b}, l * 2.0)
    : mix(\${b}, \${c}, (l - 0.5) * 2.0);
  gl_FragColor = vec4(mix(backdrop(uv), ramp, tex.a), 1.0);
}\`;
    }
    const ORIGINAL: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;

    const toy = makeShaderToy(canvas, ORIGINAL, { info: info, sprite: drawSprite });

    document.getElementById('btnPalOrig')?.addEventListener('click', (): void => {
        toy.setFrag(ORIGINAL); info.textContent = 'Original sprite colours.';
    });
    document.getElementById('btnPalFire')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('vec3(0.25,0.0,0.0)', 'vec3(0.95,0.35,0.05)', 'vec3(1.0,0.95,0.6)'));
        info.textContent = 'Fire palette — dark → ember → spark by luminance.';
    });
    document.getElementById('btnPalIce')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('vec3(0.03,0.10,0.25)', 'vec3(0.25,0.6,0.95)', 'vec3(0.85,0.97,1.0)'));
        info.textContent = 'Ice palette — same sprite, new ramp.';
    });
    document.getElementById('btnPalToxic')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('vec3(0.05,0.15,0.0)', 'vec3(0.45,0.85,0.1)', 'vec3(0.9,1.0,0.5)'));
        info.textContent = 'Toxic palette — one art asset, many variants.';
    });
})();`;

// =============================================================================
// DEMO 4 — sh_dissolveGL  (§ Dissolve & Burn)
// =============================================================================
DEMO_HTML.sh_dissolveGL = {
    title: 'Shaders — Dissolve & Burn',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnDis0',    text: '0%' },
        { id: 'btnDis50',   text: '50%' },
        { id: 'btnDis95',   text: '95%' },
        { id: 'btnDisAuto', text: 'Auto' }
    ],
    info: 'discard where noise < progress; glowing burn edge.'
};

DEMO_CODE.sh_dissolveGL = `(function dissolveShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    function buildFrag(progressExpr) {
        return GLSL_HEAD + GLSL_NOISE + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  float prog = \${progressExpr};
  float n = valueNoise(s * 14.0);
  vec3 col = backdrop(uv);
  if (tex.a > 0.5) {
    if (n >= prog) {
      col = tex.rgb;
      float edge = smoothstep(prog, prog + 0.08, n);
      col = mix(vec3(1.0, 0.6, 0.1), col, edge);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}\`;
    }
    const MANUAL = buildFrag('u_param');
    const AUTO = buildFrag('fract(u_time * 0.25)');

    const toy = makeShaderToy(canvas, MANUAL, { info: info, sprite: drawSprite, param: 0.0 });

    document.getElementById('btnDis0')?.addEventListener('click', () => {
        toy.setFrag(MANUAL); toy.setParam(0.0); info.textContent = 'Progress 0% — intact.';
    });
    document.getElementById('btnDis50')?.addEventListener('click', () => {
        toy.setFrag(MANUAL); toy.setParam(0.5); info.textContent = 'Progress 50% — burning away.';
    });
    document.getElementById('btnDis95')?.addEventListener('click', () => {
        toy.setFrag(MANUAL); toy.setParam(0.95); info.textContent = 'Progress 95% — almost gone.';
    });
    document.getElementById('btnDisAuto')?.addEventListener('click', () => {
        toy.setFrag(AUTO); info.textContent = 'Auto — progress = fract(u_time): a looping dissolve.';
    });
})();`;

DEMO_CODE_TS.sh_dissolveGL = `(function dissolveShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function buildFrag(progressExpr: string): string {
        return GLSL_HEAD + GLSL_NOISE + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  float prog = \${progressExpr};
  float n = valueNoise(s * 14.0);
  vec3 col = backdrop(uv);
  if (tex.a > 0.5) {
    if (n >= prog) {
      col = tex.rgb;
      float edge = smoothstep(prog, prog + 0.08, n);
      col = mix(vec3(1.0, 0.6, 0.1), col, edge);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}\`;
    }
    const MANUAL: string = buildFrag('u_param');
    const AUTO: string = buildFrag('fract(u_time * 0.25)');

    const toy = makeShaderToy(canvas, MANUAL, { info: info, sprite: drawSprite, param: 0.0 });

    document.getElementById('btnDis0')?.addEventListener('click', (): void => {
        toy.setFrag(MANUAL); toy.setParam(0.0); info.textContent = 'Progress 0% — intact.';
    });
    document.getElementById('btnDis50')?.addEventListener('click', (): void => {
        toy.setFrag(MANUAL); toy.setParam(0.5); info.textContent = 'Progress 50% — burning away.';
    });
    document.getElementById('btnDis95')?.addEventListener('click', (): void => {
        toy.setFrag(MANUAL); toy.setParam(0.95); info.textContent = 'Progress 95% — almost gone.';
    });
    document.getElementById('btnDisAuto')?.addEventListener('click', (): void => {
        toy.setFrag(AUTO); info.textContent = 'Auto — progress = fract(u_time): a looping dissolve.';
    });
})();`;

// =============================================================================
// DEMO 5 — sh_outlineGL  (§ Outline / Rim)
// =============================================================================
DEMO_HTML.sh_outlineGL = {
    title: 'Shaders — Outline / Rim',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnOutOff',   text: 'No outline' },
        { id: 'btnOutCyan',  text: 'Outline' },
        { id: 'btnOutThick', text: 'Thicker' },
        { id: 'btnOutGold',  text: 'Gold' }
    ],
    info: '8-tap alpha dilation around the silhouette.'
};

DEMO_CODE.sh_outlineGL = `(function outlineShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    function buildFrag(color) {
        return GLSL_HEAD + \`float silhouette(vec2 s) {
  vec2 px = u_param / u_texResolution;
  float m = 0.0;
  m = max(m, texture2D(u_tex, s + vec2( px.x, 0.0)).a);
  m = max(m, texture2D(u_tex, s + vec2(-px.x, 0.0)).a);
  m = max(m, texture2D(u_tex, s + vec2(0.0,  px.y)).a);
  m = max(m, texture2D(u_tex, s + vec2(0.0, -px.y)).a);
  m = max(m, texture2D(u_tex, s + px).a);
  m = max(m, texture2D(u_tex, s - px).a);
  m = max(m, texture2D(u_tex, s + vec2( px.x, -px.y)).a);
  m = max(m, texture2D(u_tex, s + vec2(-px.x,  px.y)).a);
  return m;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  vec3 col = backdrop(uv);
  float ring = clamp(silhouette(s) - tex.a, 0.0, 1.0);
  col = mix(col, \${color}, ring);
  col = mix(col, tex.rgb, tex.a);
  gl_FragColor = vec4(col, 1.0);
}\`;
    }
    const OFF = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const CYAN = buildFrag('vec3(0.3, 0.9, 1.0)');
    const GOLD = buildFrag('vec3(1.0, 0.82, 0.25)');

    const toy = makeShaderToy(canvas, OFF, { info: info, sprite: drawSprite, param: 3.0 });

    document.getElementById('btnOutOff')?.addEventListener('click', () => {
        toy.setFrag(OFF); info.textContent = 'No outline.';
    });
    document.getElementById('btnOutCyan')?.addEventListener('click', () => {
        toy.setFrag(CYAN); toy.setParam(3.0); info.textContent = 'Selection outline — 8-tap alpha dilation.';
    });
    document.getElementById('btnOutThick')?.addEventListener('click', () => {
        toy.setFrag(CYAN); toy.setParam(7.0); info.textContent = 'Thicker — u_param scales the texel step.';
    });
    document.getElementById('btnOutGold')?.addEventListener('click', () => {
        toy.setFrag(GOLD); toy.setParam(3.0); info.textContent = 'Gold outline — same taps, different colour.';
    });
})();`;

DEMO_CODE_TS.sh_outlineGL = `(function outlineShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function buildFrag(color: string): string {
        return GLSL_HEAD + \`float silhouette(vec2 s) {
  vec2 px = u_param / u_texResolution;
  float m = 0.0;
  m = max(m, texture2D(u_tex, s + vec2( px.x, 0.0)).a);
  m = max(m, texture2D(u_tex, s + vec2(-px.x, 0.0)).a);
  m = max(m, texture2D(u_tex, s + vec2(0.0,  px.y)).a);
  m = max(m, texture2D(u_tex, s + vec2(0.0, -px.y)).a);
  m = max(m, texture2D(u_tex, s + px).a);
  m = max(m, texture2D(u_tex, s - px).a);
  m = max(m, texture2D(u_tex, s + vec2( px.x, -px.y)).a);
  m = max(m, texture2D(u_tex, s + vec2(-px.x,  px.y)).a);
  return m;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  vec3 col = backdrop(uv);
  float ring = clamp(silhouette(s) - tex.a, 0.0, 1.0);
  col = mix(col, \${color}, ring);
  col = mix(col, tex.rgb, tex.a);
  gl_FragColor = vec4(col, 1.0);
}\`;
    }
    const OFF: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const CYAN: string = buildFrag('vec3(0.3, 0.9, 1.0)');
    const GOLD: string = buildFrag('vec3(1.0, 0.82, 0.25)');

    const toy = makeShaderToy(canvas, OFF, { info: info, sprite: drawSprite, param: 3.0 });

    document.getElementById('btnOutOff')?.addEventListener('click', (): void => {
        toy.setFrag(OFF); info.textContent = 'No outline.';
    });
    document.getElementById('btnOutCyan')?.addEventListener('click', (): void => {
        toy.setFrag(CYAN); toy.setParam(3.0); info.textContent = 'Selection outline — 8-tap alpha dilation.';
    });
    document.getElementById('btnOutThick')?.addEventListener('click', (): void => {
        toy.setFrag(CYAN); toy.setParam(7.0); info.textContent = 'Thicker — u_param scales the texel step.';
    });
    document.getElementById('btnOutGold')?.addEventListener('click', (): void => {
        toy.setFrag(GOLD); toy.setParam(3.0); info.textContent = 'Gold outline — same taps, different colour.';
    });
})();`;

// =============================================================================
// DEMO 6 — sh_hitflashGL  (§ Hit-Flash & Invincibility Blink)
// =============================================================================
DEMO_HTML.sh_hitflashGL = {
    title: 'Shaders — Hit-Flash & Invincibility Blink',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnHitFlash',  text: 'Hit flash' },
        { id: 'btnHitBlink',  text: 'Invuln blink' },
        { id: 'btnHitNormal', text: 'Normal' }
    ],
    info: 'mix(sprite, white, pulse) + alpha blink. Click to re-trigger.'
};

DEMO_CODE.sh_hitflashGL = `(function hitflashShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const NORMAL = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const FLASH = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float f = 0.5 + 0.5 * sin(u_time * 18.0);
  vec3 hit = mix(tex.rgb, vec3(1.0), f);
  gl_FragColor = vec4(mix(backdrop(uv), hit, tex.a), 1.0);
}\`;
    const BLINK = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float on = step(0.5, fract(u_time * 6.0));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a * on), 1.0);
}\`;

    const toy = makeShaderToy(canvas, FLASH, { info: info, sprite: drawSprite });

    document.getElementById('btnHitFlash')?.addEventListener('click', () => {
        toy.setFrag(FLASH); info.textContent = 'Hit flash — mix to white on a fast sine.';
    });
    document.getElementById('btnHitBlink')?.addEventListener('click', () => {
        toy.setFrag(BLINK); info.textContent = 'Invincibility blink — toggle alpha with step(fract(u_time)).';
    });
    document.getElementById('btnHitNormal')?.addEventListener('click', () => {
        toy.setFrag(NORMAL); info.textContent = 'Normal — no damage feedback.';
    });
    canvas.addEventListener('click', () => {
        toy.setFrag(FLASH); info.textContent = 'Hit! (click again to re-trigger)';
    });
})();`;

DEMO_CODE_TS.sh_hitflashGL = `(function hitflashShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const NORMAL: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    const FLASH: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float f = 0.5 + 0.5 * sin(u_time * 18.0);
  vec3 hit = mix(tex.rgb, vec3(1.0), f);
  gl_FragColor = vec4(mix(backdrop(uv), hit, tex.a), 1.0);
}\`;
    const BLINK: string = GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float on = step(0.5, fract(u_time * 6.0));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a * on), 1.0);
}\`;

    const toy = makeShaderToy(canvas, FLASH, { info: info, sprite: drawSprite });

    document.getElementById('btnHitFlash')?.addEventListener('click', (): void => {
        toy.setFrag(FLASH); info.textContent = 'Hit flash — mix to white on a fast sine.';
    });
    document.getElementById('btnHitBlink')?.addEventListener('click', (): void => {
        toy.setFrag(BLINK); info.textContent = 'Invincibility blink — toggle alpha with step(fract(u_time)).';
    });
    document.getElementById('btnHitNormal')?.addEventListener('click', (): void => {
        toy.setFrag(NORMAL); info.textContent = 'Normal — no damage feedback.';
    });
    canvas.addEventListener('click', (): void => {
        toy.setFrag(FLASH); info.textContent = 'Hit! (click again to re-trigger)';
    });
})();`;

// =============================================================================
// DEMO 6b — sh_normalmapGL  (§ 2D Normal-Map Lighting)
// =============================================================================
DEMO_HTML.sh_normalmapGL = {
    title: 'Shaders — 2D Normal-Map Lighting',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnNmLit',     text: 'Lit' },
        { id: 'btnNmNormals', text: 'Show normals' },
        { id: 'btnNmDiffuse', text: 'Diffuse only' },
        { id: 'btnNmFlat',    text: 'Flat (no light)' }
    ],
    info: "Move the mouse — it's the light. No painted normal map needed."
};

DEMO_CODE.sh_normalmapGL = `(function normalmapShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    function buildFrag(out) {
        return GLSL_HEAD + \`
uniform vec2 u_mouse;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float H(vec2 uv) { vec4 t = texture2D(u_tex, uv); return lum(t.rgb) * t.a; }
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  vec2 px = 1.5 / u_texResolution;
  vec3 N = normalize(vec3(H(s - vec2(px.x, 0.0)) - H(s + vec2(px.x, 0.0)),
                          H(s - vec2(0.0, px.y)) - H(s + vec2(0.0, px.y)), 0.6));
  vec2 lp = u_mouse / u_resolution;
  vec3 L = normalize(vec3((lp - uv) * vec2(u_resolution.x / u_resolution.y, 1.0), 0.35));
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  vec3 c = \${out};
  gl_FragColor = vec4(mix(backdrop(uv), c, tex.a), 1.0);
}\`;
    }

    const OUT = {
        lit:     'tex.rgb * (0.15 + diff) + spec * 0.6',
        normals: 'N * 0.5 + 0.5',
        diffuse: 'vec3(0.15 + diff)',
        flat:    'tex.rgb'
    };

    const toy = makeShaderToy(canvas, buildFrag(OUT.lit), { info: info, sprite: drawSprite });
    function set(k, msg) { toy.setFrag(buildFrag(OUT[k])); info.textContent = msg; }

    document.getElementById('btnNmLit')?.addEventListener('click', () =>
        set('lit', 'Lit: albedo × (ambient + N·L) + a specular glint. Move the mouse.'));
    document.getElementById('btnNmNormals')?.addEventListener('click', () =>
        set('normals', 'The derived normal as RGB — bright = facing you.'));
    document.getElementById('btnNmDiffuse')?.addEventListener('click', () =>
        set('diffuse', 'Just the N·L term — the raw lighting that wraps the sprite.'));
    document.getElementById('btnNmFlat')?.addEventListener('click', () =>
        set('flat', 'No lighting — flat albedo, for comparison.'));
})();`;

DEMO_CODE_TS.sh_normalmapGL = `(function normalmapShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function buildFrag(out: string): string {
        return GLSL_HEAD + \`
uniform vec2 u_mouse;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float H(vec2 uv) { vec4 t = texture2D(u_tex, uv); return lum(t.rgb) * t.a; }
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  vec2 px = 1.5 / u_texResolution;
  vec3 N = normalize(vec3(H(s - vec2(px.x, 0.0)) - H(s + vec2(px.x, 0.0)),
                          H(s - vec2(0.0, px.y)) - H(s + vec2(0.0, px.y)), 0.6));
  vec2 lp = u_mouse / u_resolution;
  vec3 L = normalize(vec3((lp - uv) * vec2(u_resolution.x / u_resolution.y, 1.0), 0.35));
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  vec3 c = \${out};
  gl_FragColor = vec4(mix(backdrop(uv), c, tex.a), 1.0);
}\`;
    }

    const OUT: Record<string, string> = {
        lit:     'tex.rgb * (0.15 + diff) + spec * 0.6',
        normals: 'N * 0.5 + 0.5',
        diffuse: 'vec3(0.15 + diff)',
        flat:    'tex.rgb'
    };

    const toy = makeShaderToy(canvas, buildFrag(OUT.lit), { info: info, sprite: drawSprite });
    function set(k: string, msg: string): void { toy.setFrag(buildFrag(OUT[k])); info.textContent = msg; }

    document.getElementById('btnNmLit')?.addEventListener('click', (): void =>
        set('lit', 'Lit: albedo × (ambient + N·L) + a specular glint. Move the mouse.'));
    document.getElementById('btnNmNormals')?.addEventListener('click', (): void =>
        set('normals', 'The derived normal as RGB — bright = facing you.'));
    document.getElementById('btnNmDiffuse')?.addEventListener('click', (): void =>
        set('diffuse', 'Just the N·L term — the raw lighting that wraps the sprite.'));
    document.getElementById('btnNmFlat')?.addEventListener('click', (): void =>
        set('flat', 'No lighting — flat albedo, for comparison.'));
})();`;

// =============================================================================
// DEMO 6c — sh_spritesheetGL  (§ Sprite-Sheet Animation)
// =============================================================================
DEMO_HTML.sh_spritesheetGL = {
    title: 'Shaders — Sprite-Sheet Animation',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnSheetSlow',   text: 'Slow (4 fps)' },
        { id: 'btnSheetNormal', text: 'Normal (8 fps)' },
        { id: 'btnSheetFast',   text: 'Fast (16 fps)' },
        { id: 'btnSheetAtlas',  text: 'Show full sheet' }
    ],
    info: 'One image, sampled one cell per frame — that is 2D animation.'
};

DEMO_CODE.sh_spritesheetGL = `(function spritesheetShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    function drawSheet(ctx, n) {
        ctx.clearRect(0, 0, n, n);
        const cs = n / 4;
        for (let f = 0; f < 16; f++) {
            const cx = (f % 4) * cs + cs / 2;
            const cy = Math.floor(f / 4) * cs + cs / 2;
            const ang = f / 16 * Math.PI * 2, R = cs * 0.32;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(0, -R); ctx.lineTo(R * 0.7, 0);
            ctx.lineTo(0, R);  ctx.lineTo(-R * 0.7, 0);
            ctx.closePath(); ctx.fillStyle = '#4fc3f7'; ctx.fill();
            ctx.beginPath();
            ctx.arc(R * 0.3 * Math.cos(ang * 3.0), R * 0.3 * Math.sin(ang * 3.0),
                    cs * 0.06, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.restore();
        }
    }

    function buildFrag(fps) {
        return GLSL_HEAD + \`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = clamp(toSpriteUV(uv), 0.0, 1.0);
  float frame = mod(floor(u_time * \${fps}), 16.0);
  vec2 cell = vec2(mod(frame, 4.0), floor(frame / 4.0));
  vec2 fuv = (s + vec2(cell.x, 3.0 - cell.y)) / 4.0;
  vec4 tex = texture2D(u_tex, fuv);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    }

    const ATLAS = GLSL_HEAD + \`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = clamp(toSpriteUV(uv), 0.0, 1.0);
  vec4 tex = texture2D(u_tex, s);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;

    const toy = makeShaderToy(canvas, buildFrag('8.0'), { info: info, sprite: drawSheet });

    document.getElementById('btnSheetSlow')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('4.0')); info.textContent = '4 fps — you can see each of the 16 frames.';
    });
    document.getElementById('btnSheetNormal')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('8.0')); info.textContent = '8 fps — a typical 2D animation rate.';
    });
    document.getElementById('btnSheetFast')?.addEventListener('click', () => {
        toy.setFrag(buildFrag('16.0')); info.textContent = '16 fps — smooth spin, same 16-cell sheet.';
    });
    document.getElementById('btnSheetAtlas')?.addEventListener('click', () => {
        toy.setFrag(ATLAS); info.textContent = 'The raw 4×4 atlas — animation just samples one cell.';
    });
})();`;

DEMO_CODE_TS.sh_spritesheetGL = `(function spritesheetShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    function drawSheet(ctx: CanvasRenderingContext2D, n: number): void {
        ctx.clearRect(0, 0, n, n);
        const cs = n / 4;
        for (let f = 0; f < 16; f++) {
            const cx = (f % 4) * cs + cs / 2;
            const cy = Math.floor(f / 4) * cs + cs / 2;
            const ang = f / 16 * Math.PI * 2, R = cs * 0.32;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(0, -R); ctx.lineTo(R * 0.7, 0);
            ctx.lineTo(0, R);  ctx.lineTo(-R * 0.7, 0);
            ctx.closePath(); ctx.fillStyle = '#4fc3f7'; ctx.fill();
            ctx.beginPath();
            ctx.arc(R * 0.3 * Math.cos(ang * 3.0), R * 0.3 * Math.sin(ang * 3.0),
                    cs * 0.06, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.restore();
        }
    }

    function buildFrag(fps: string): string {
        return GLSL_HEAD + \`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = clamp(toSpriteUV(uv), 0.0, 1.0);
  float frame = mod(floor(u_time * \${fps}), 16.0);
  vec2 cell = vec2(mod(frame, 4.0), floor(frame / 4.0));
  vec2 fuv = (s + vec2(cell.x, 3.0 - cell.y)) / 4.0;
  vec4 tex = texture2D(u_tex, fuv);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;
    }

    const ATLAS: string = GLSL_HEAD + \`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = clamp(toSpriteUV(uv), 0.0, 1.0);
  vec4 tex = texture2D(u_tex, s);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}\`;

    const toy = makeShaderToy(canvas, buildFrag('8.0'), { info: info, sprite: drawSheet });

    document.getElementById('btnSheetSlow')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('4.0')); info.textContent = '4 fps — you can see each of the 16 frames.';
    });
    document.getElementById('btnSheetNormal')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('8.0')); info.textContent = '8 fps — a typical 2D animation rate.';
    });
    document.getElementById('btnSheetFast')?.addEventListener('click', (): void => {
        toy.setFrag(buildFrag('16.0')); info.textContent = '16 fps — smooth spin, same 16-cell sheet.';
    });
    document.getElementById('btnSheetAtlas')?.addEventListener('click', (): void => {
        toy.setFrag(ATLAS); info.textContent = 'The raw 4×4 atlas — animation just samples one cell.';
    });
})();`;

// =============================================================================
// DEMO 6d — sh_ditherGL  (§ Dither / Posterize / 1-bit)
// =============================================================================
DEMO_HTML.sh_ditherGL = {
    title: 'Shaders — Dither / Posterize / 1-bit',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnDitPosterize', text: 'Posterize' },
        { id: 'btnDitDither',    text: 'Bayer dither' },
        { id: 'btnDitOneBit',    text: '1-bit' },
        { id: 'btnDitPalette',   text: 'Game Boy palette' }
    ],
    info: 'Quantize colors; dither so the eye sees more shades than exist.'
};

DEMO_CODE.sh_ditherGL = `(function ditherShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const LIB = GLSL_HEAD + \`
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float B2(vec2 c) { return mix(mix(0.0, 2.0, c.x), mix(3.0, 1.0, c.x), c.y); }
float bayer4(vec2 P) {
  vec2 hi = mod(floor(P * 0.5), 2.0);
  vec2 lo = mod(P, 2.0);
  return (4.0 * B2(hi) + B2(lo)) / 16.0;
}\`;

    function buildFrag(mode) {
        return LIB + \`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tx = texture2D(u_tex, toSpriteUV(uv));
  vec3 col = mix(backdrop(uv), tx.rgb, tx.a);
  vec2 P = floor(gl_FragCoord.xy);
  vec3 outc;
  \${mode}
  gl_FragColor = vec4(outc, 1.0);
}\`;
    }

    const MODE = {
        posterize: 'outc = floor(col * 4.0) / 4.0;',
        dither:    'outc = floor(col * 4.0 + bayer4(P)) / 4.0;',
        onebit:    'float L = step(bayer4(P), lum(col));\\n  outc = mix(vec3(0.06,0.10,0.06), vec3(0.55,0.80,0.30), L);',
        palette:   'float g = lum(col);\\n  g = floor(g * 4.0 + bayer4(P)) / 4.0;\\n  outc = mix(vec3(0.06,0.22,0.06), vec3(0.61,0.74,0.06), g);'
    };

    const toy = makeShaderToy(canvas, buildFrag(MODE.dither), { info: info, sprite: drawSprite });
    function set(k, msg) { toy.setFrag(buildFrag(MODE[k])); info.textContent = msg; }

    document.getElementById('btnDitPosterize')?.addEventListener('click', () =>
        set('posterize', 'Posterize: floor(col * 4) / 4 — hard color bands.'));
    document.getElementById('btnDitDither')?.addEventListener('click', () =>
        set('dither', 'Bayer dither: add the 4×4 threshold first — bands dissolve.'));
    document.getElementById('btnDitOneBit')?.addEventListener('click', () =>
        set('onebit', '1-bit: luminance vs Bayer → two-tone, ordered dither.'));
    document.getElementById('btnDitPalette')?.addEventListener('click', () =>
        set('palette', 'Game Boy: 4 luminance steps mapped to the DMG green ramp.'));
})();`;

DEMO_CODE_TS.sh_ditherGL = `(function ditherShader(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const LIB: string = GLSL_HEAD + \`
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float B2(vec2 c) { return mix(mix(0.0, 2.0, c.x), mix(3.0, 1.0, c.x), c.y); }
float bayer4(vec2 P) {
  vec2 hi = mod(floor(P * 0.5), 2.0);
  vec2 lo = mod(P, 2.0);
  return (4.0 * B2(hi) + B2(lo)) / 16.0;
}\`;

    function buildFrag(mode: string): string {
        return LIB + \`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tx = texture2D(u_tex, toSpriteUV(uv));
  vec3 col = mix(backdrop(uv), tx.rgb, tx.a);
  vec2 P = floor(gl_FragCoord.xy);
  vec3 outc;
  \${mode}
  gl_FragColor = vec4(outc, 1.0);
}\`;
    }

    const MODE: Record<string, string> = {
        posterize: 'outc = floor(col * 4.0) / 4.0;',
        dither:    'outc = floor(col * 4.0 + bayer4(P)) / 4.0;',
        onebit:    'float L = step(bayer4(P), lum(col));\\n  outc = mix(vec3(0.06,0.10,0.06), vec3(0.55,0.80,0.30), L);',
        palette:   'float g = lum(col);\\n  g = floor(g * 4.0 + bayer4(P)) / 4.0;\\n  outc = mix(vec3(0.06,0.22,0.06), vec3(0.61,0.74,0.06), g);'
    };

    const toy = makeShaderToy(canvas, buildFrag(MODE.dither), { info: info, sprite: drawSprite });
    function set(k: string, msg: string): void { toy.setFrag(buildFrag(MODE[k])); info.textContent = msg; }

    document.getElementById('btnDitPosterize')?.addEventListener('click', (): void =>
        set('posterize', 'Posterize: floor(col * 4) / 4 — hard color bands.'));
    document.getElementById('btnDitDither')?.addEventListener('click', (): void =>
        set('dither', 'Bayer dither: add the 4×4 threshold first — bands dissolve.'));
    document.getElementById('btnDitOneBit')?.addEventListener('click', (): void =>
        set('onebit', '1-bit: luminance vs Bayer → two-tone, ordered dither.'));
    document.getElementById('btnDitPalette')?.addEventListener('click', (): void =>
        set('palette', 'Game Boy: 4 luminance steps mapped to the DMG green ramp.'));
})();`;

// =============================================================================
// DEMO 7 — sh_spriteGL  (§ Mini-Project: Fully Shaded Sprite)
// =============================================================================
DEMO_HTML.sh_spriteGL = {
    title: 'Shaders — Mini-Project: Fully Shaded Sprite',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnSprPalette', text: 'Palette' },
        { id: 'btnSprOutline', text: 'Toggle outline' },
        { id: 'btnSprHit',     text: 'Hit!' },
        { id: 'btnSprReset',   text: 'Reset' }
    ],
    info: 'Composed: palette-swap + outline + hit-flash. Click the sprite.'
};

DEMO_CODE.sh_spriteGL = `(function spriteCapstone() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const PALETTES = [
        null,
        ['vec3(0.25,0.0,0.0)', 'vec3(0.95,0.35,0.05)', 'vec3(1.0,0.95,0.6)'],
        ['vec3(0.03,0.10,0.25)', 'vec3(0.25,0.6,0.95)', 'vec3(0.85,0.97,1.0)']
    ];
    const PAL_NAMES = ['original', 'fire', 'ice'];
    const state = { pal: 0, outline: true, flash: false };

    function buildFrag(s) {
        const pal = PALETTES[s.pal];
        const colorExpr = pal
            ? '(l < 0.5 ? mix(' + pal[0] + ', ' + pal[1] + ', l*2.0) : mix(' + pal[1] + ', ' + pal[2] + ', (l-0.5)*2.0))'
            : 'tex.rgb';
        const outlineBlock = s.outline ? \`
  vec2 px = 3.0 / u_texResolution;
  float m = 0.0;
  m = max(m, texture2D(u_tex, sUV + vec2(px.x,0.0)).a);
  m = max(m, texture2D(u_tex, sUV - vec2(px.x,0.0)).a);
  m = max(m, texture2D(u_tex, sUV + vec2(0.0,px.y)).a);
  m = max(m, texture2D(u_tex, sUV - vec2(0.0,px.y)).a);
  m = max(m, texture2D(u_tex, sUV + px).a);
  m = max(m, texture2D(u_tex, sUV - px).a);
  m = max(m, texture2D(u_tex, sUV + vec2(px.x,-px.y)).a);
  m = max(m, texture2D(u_tex, sUV - vec2(px.x,-px.y)).a);
  col = mix(col, vec3(0.3,0.9,1.0), clamp(m - tex.a, 0.0, 1.0));\` : '';
        const flashBlock = s.flash
            ? '  spr = mix(spr, vec3(1.0), 0.5 + 0.5 * sin(u_time * 18.0));' : '';
        return GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 sUV = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, sUV);
  float l = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  vec3 spr = \${colorExpr};
\${flashBlock}
  vec3 col = backdrop(uv);
\${outlineBlock}
  col = mix(col, spr, tex.a);
  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(state), { info: info, sprite: drawSprite });
    function refresh(msg) { toy.setFrag(buildFrag(state)); info.textContent = msg; }

    document.getElementById('btnSprPalette')?.addEventListener('click', () => {
        state.pal = (state.pal + 1) % 3;
        refresh('Palette: ' + PAL_NAMES[state.pal] + '.');
    });
    document.getElementById('btnSprOutline')?.addEventListener('click', () => {
        state.outline = !state.outline;
        refresh('Outline ' + (state.outline ? 'ON' : 'OFF') + '.');
    });
    document.getElementById('btnSprHit')?.addEventListener('click', () => {
        state.flash = !state.flash;
        refresh('Hit flash ' + (state.flash ? 'ON' : 'OFF') + ' — also click the sprite.');
    });
    document.getElementById('btnSprReset')?.addEventListener('click', () => {
        state.pal = 0; state.outline = true; state.flash = false;
        refresh('Reset — original + outline.');
    });
    canvas.addEventListener('click', () => {
        state.flash = true; refresh('Hit! Composed: palette + outline + flash.');
    });
})();`;

DEMO_CODE_TS.sh_spriteGL = `interface SpriteState { pal: number; outline: boolean; flash: boolean; }

(function spriteCapstone(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const info = document.getElementById('info') as HTMLDivElement;

    const PALETTES: (string[] | null)[] = [
        null,
        ['vec3(0.25,0.0,0.0)', 'vec3(0.95,0.35,0.05)', 'vec3(1.0,0.95,0.6)'],
        ['vec3(0.03,0.10,0.25)', 'vec3(0.25,0.6,0.95)', 'vec3(0.85,0.97,1.0)']
    ];
    const PAL_NAMES: string[] = ['original', 'fire', 'ice'];
    const state: SpriteState = { pal: 0, outline: true, flash: false };

    function buildFrag(s: SpriteState): string {
        const pal = PALETTES[s.pal];
        const colorExpr = pal
            ? '(l < 0.5 ? mix(' + pal[0] + ', ' + pal[1] + ', l*2.0) : mix(' + pal[1] + ', ' + pal[2] + ', (l-0.5)*2.0))'
            : 'tex.rgb';
        const outlineBlock = s.outline ? \`
  vec2 px = 3.0 / u_texResolution;
  float m = 0.0;
  m = max(m, texture2D(u_tex, sUV + vec2(px.x,0.0)).a);
  m = max(m, texture2D(u_tex, sUV - vec2(px.x,0.0)).a);
  m = max(m, texture2D(u_tex, sUV + vec2(0.0,px.y)).a);
  m = max(m, texture2D(u_tex, sUV - vec2(0.0,px.y)).a);
  m = max(m, texture2D(u_tex, sUV + px).a);
  m = max(m, texture2D(u_tex, sUV - px).a);
  m = max(m, texture2D(u_tex, sUV + vec2(px.x,-px.y)).a);
  m = max(m, texture2D(u_tex, sUV - vec2(px.x,-px.y)).a);
  col = mix(col, vec3(0.3,0.9,1.0), clamp(m - tex.a, 0.0, 1.0));\` : '';
        const flashBlock = s.flash
            ? '  spr = mix(spr, vec3(1.0), 0.5 + 0.5 * sin(u_time * 18.0));' : '';
        return GLSL_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 sUV = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, sUV);
  float l = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  vec3 spr = \${colorExpr};
\${flashBlock}
  vec3 col = backdrop(uv);
\${outlineBlock}
  col = mix(col, spr, tex.a);
  gl_FragColor = vec4(col, 1.0);
}\`;
    }

    const toy = makeShaderToy(canvas, buildFrag(state), { info: info, sprite: drawSprite });
    function refresh(msg: string): void { toy.setFrag(buildFrag(state)); info.textContent = msg; }

    document.getElementById('btnSprPalette')?.addEventListener('click', (): void => {
        state.pal = (state.pal + 1) % 3;
        refresh('Palette: ' + PAL_NAMES[state.pal] + '.');
    });
    document.getElementById('btnSprOutline')?.addEventListener('click', (): void => {
        state.outline = !state.outline;
        refresh('Outline ' + (state.outline ? 'ON' : 'OFF') + '.');
    });
    document.getElementById('btnSprHit')?.addEventListener('click', (): void => {
        state.flash = !state.flash;
        refresh('Hit flash ' + (state.flash ? 'ON' : 'OFF') + ' — also click the sprite.');
    });
    document.getElementById('btnSprReset')?.addEventListener('click', (): void => {
        state.pal = 0; state.outline = true; state.flash = false;
        refresh('Reset — original + outline.');
    });
    canvas.addEventListener('click', (): void => {
        state.flash = true; refresh('Hit! Composed: palette + outline + flash.');
    });
})();`;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.sh_createProgram = ['sh_compileShader'];
DEPENDENCY_REQUIRES.sh_makeShaderToy = ['sh_fullscreenQuad', 'sh_createProgram'];
