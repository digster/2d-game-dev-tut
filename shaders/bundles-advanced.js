// =============================================================================
// SHADERS TRACK — ADVANCED TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js so each `<details data-demo-id="sh_*">` 📋 Export
// copies a runnable HTML. Multi-pass / post-processing; each effect ships as a
// WebGL1 (`sh_xGL1`) and a WebGL2 (`sh_xGL2`) demo.
//
// ── Self-contained per tier ──────────────────────────────────────────────────
// `sh_compileShader`/`sh_createProgram` are context-agnostic (verbatim copies).
// `sh_fxChainGL1`/`sh_fxChainGL2` each define a self-contained `makeFXChain`
// (own webgl/webgl2 context + vertex dialect + FBO ping-pong). A given demo
// depends on exactly ONE → they never co-load in an export, so both can use the
// name `makeFXChain`. The page twin (advanced-demos.js) instead names them
// `makeFXChainGL1`/`makeFXChainGL2` (both load there) — same page-vs-bundle
// rewrite precedent as the canvas-id retargeting.
// `sh_kitGL1`/`sh_kitGL2` carry the shared per-dialect GLSL (scene + post
// shaders) + `chainFor1`/`chainFor2` builders so each DEMO_CODE stays tiny.
//
// ── GLSL-as-template-literal convention ──────────────────────────────────────
// Each DEMO_CODE.sh_* is a JS template literal. GLSL inside the kit deps is a
// nested template literal → only its delimiter backticks are escaped (\`). The
// grade builder uses string concatenation (no `${`) to avoid interpolation
// escaping. JS escapes that must survive (e.g. vertex '\\n', 'failed:\\n')
// stay double-escaped. Verify exports by running them, never by eye.
//
// ── Canvas-ID convention ─────────────────────────────────────────────────────
// The generator hardcodes `<canvas id="canvas">`/`<div id="info">`; DEMO_CODE
// retargets to those. Standalone exports have one demo, so button ids are the
// clean un-suffixed forms (the page uses GL1/GL2-suffixed ids for uniqueness).
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// DEPENDENCY BUNDLES
// =============================================================================

DEPENDENCY_BUNDLES.sh_compileShader = `function compileShader(gl, type, src) {
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

DEPENDENCY_BUNDLES.sh_createProgram = `function createShaderProgram(gl, vertSrc, fragSrc) {
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

// The chain runner. Self-contained: own context + vertex dialect + FBO
// ping-pong. (\\n in VERT survives as a JS string escape in the exported file.)
function fxChainSrc(ctxExpr, vertSrc) {
    return `function makeFXChain(canvas, sceneFrag, postFrags, opts) {
    opts = opts || {};
    const info = opts.info || null;
    let uParam = opts.param != null ? opts.param : 0;
    let paused = !!opts.paused;
    let tNow = 0;
    const VERT = '${vertSrc}';
    function fail(m) {
        console.error(m);
        if (info) { info.textContent = m; info.style.color = '#ff7b72'; }
        if (gl) { gl.clearColor(0.23, 0.05, 0.07, 1.0); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
    const noop = { stop() {}, setParam() {}, setPaused() {}, rebuild() {} };
    const gl = ${ctxExpr};
    if (!gl) {
        const c2d = canvas.getContext('2d');
        if (c2d) {
            c2d.fillStyle = '#3a0d12'; c2d.fillRect(0, 0, canvas.width, canvas.height);
            c2d.fillStyle = '#ff7b72'; c2d.font = '13px monospace';
            c2d.fillText('WebGL(2) not available in this browser/context.', 12, 24);
        }
        if (info) { info.textContent = 'WebGL(2) not available in this browser/context.'; info.style.color = '#ff7b72'; }
        return noop;
    }
    const W = canvas.width, H = canvas.height;
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    function fbo() {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { f: f, t: t, ok: ok };
    }
    const sceneFB = fbo(), pingA = fbo(), pingB = fbo();
    let sceneProg = null, postProgs = [];
    function compileAll(sF, pF) {
        try {
            const sp = createShaderProgram(gl, VERT, sF);
            const pp = pF.map(function (f) { return createShaderProgram(gl, VERT, f); });
            if (sceneProg) gl.deleteProgram(sceneProg);
            postProgs.forEach(function (p) { gl.deleteProgram(p); });
            sceneProg = sp; postProgs = pp;
            if (!(sceneFB.ok && pingA.ok && pingB.ok)) throw new Error('Framebuffer incomplete');
            if (info) info.style.color = '';
            return true;
        } catch (e) { fail(e && e.message ? e.message : String(e)); return false; }
    }
    if (!compileAll(sceneFrag, postFrags)) return noop;
    function setU(prog) {
        gl.useProgram(prog);
        const l = gl.getAttribLocation(prog, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
        const ur = gl.getUniformLocation(prog, 'u_resolution'); if (ur) gl.uniform2f(ur, W, H);
        const ut = gl.getUniformLocation(prog, 'u_time'); if (ut) gl.uniform1f(ut, tNow);
        const up = gl.getUniformLocation(prog, 'u_param'); if (up) gl.uniform1f(up, uParam);
    }
    function bindInputs(prog, prevTex) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prevTex);
        const lp = gl.getUniformLocation(prog, 'u_prev'); if (lp) gl.uniform1i(lp, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sceneFB.t);
        const ls = gl.getUniformLocation(prog, 'u_scene'); if (ls) gl.uniform1i(ls, 1);
    }
    let raf = 0, last = performance.now();
    function frame(now) {
        if (!paused) tNow += (now - last) * 0.001;
        last = now;
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFB.f);
        gl.viewport(0, 0, W, H);
        setU(sceneProg);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        const pings = [pingA, pingB];
        let src = sceneFB.t, pIdx = 0;
        for (let i = 0; i < postProgs.length; i++) {
            const isLast = i === postProgs.length - 1;
            gl.bindFramebuffer(gl.FRAMEBUFFER, isLast ? null : pings[pIdx].f);
            gl.viewport(0, 0, W, H);
            setU(postProgs[i]);
            bindInputs(postProgs[i], src);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            if (!isLast) { src = pings[pIdx].t; pIdx ^= 1; }
        }
        raf = requestAnimationFrame(frame);
    }
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); }, false);
    raf = requestAnimationFrame(frame);
    return {
        stop() { cancelAnimationFrame(raf); },
        setParam(v) { uParam = v; },
        setPaused(b) { paused = b; if (!b) last = performance.now(); },
        rebuild(sF, pF) { compileAll(sF, pF); }
    };
}`;
}
DEPENDENCY_BUNDLES.sh_fxChainGL1 = fxChainSrc(
    "canvas.getContext('webgl') || canvas.getContext('experimental-webgl')",
    'attribute vec2 a_position;\\nvoid main(){ gl_Position = vec4(a_position, 0.0, 1.0); }');
DEPENDENCY_BUNDLES.sh_fxChainGL2 = fxChainSrc(
    "canvas.getContext('webgl2')",
    '#version 300 es\\nin vec2 a_position;\\nvoid main(){ gl_Position = vec4(a_position, 0.0, 1.0); }');

// Per-dialect kit: scene + post shaders + chain builder. Written ONCE as a
// neutral template with placeholders, then `.split().join()` resolves the four
// dialect differences — the proven g1/g2 pattern (Expert tier), so the only
// escaping is the GLSL literal backticks (\`) + grade's runtime \${pp.*}.
//   __VER__   → '' (GL1) | '#version 300 es\n' (GL2, literal first line)
//   __SDECL__ → '' (GL1) | 'out vec4 fragColor;\n' (GL2)
//   OUT       → gl_FragColor (GL1) | fragColor (GL2)
//   TEX       → texture2D (GL1) | texture (GL2)
function kitSrc(api) {
    const gl2 = api === 'gl2';
    const src = `var SHEAD = \`__VER__precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
__SDECL__\`;
var PHEAD = \`__VER__precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
uniform sampler2D u_prev;
uniform sampler2D u_scene;
__SDECL__\`;
var SCENE = SHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = uv; p.x *= u_resolution.x / u_resolution.y;
  vec3 col = vec3(0.02, 0.03, 0.06);
  vec2 c1 = vec2(0.89 + 0.34 * sin(u_time * 0.7),       0.5 + 0.22 * cos(u_time * 0.9));
  vec2 c2 = vec2(0.89 + 0.40 * sin(u_time * 1.1 + 2.0), 0.5 + 0.25 * cos(u_time * 0.6 + 1.0));
  vec2 c3 = vec2(0.89 + 0.30 * sin(u_time * 0.5 + 4.0), 0.5 + 0.20 * cos(u_time * 1.3 + 3.0));
  col += vec3(1.0, 0.5, 0.2) * exp(-distance(p, c1) * 9.0);
  col += vec3(0.3, 0.8, 1.0) * exp(-distance(p, c2) * 11.0);
  col += vec3(0.7, 1.0, 0.4) * exp(-distance(p, c3) * 10.0);
  OUT = vec4(col, 1.0);
}\`;
var IDENT = PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  OUT = TEX(u_prev, uv);
}\`;
var BOX = PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 px = vec2(2.0) / u_resolution;
  vec4 s = TEX(u_prev, uv) * 0.4;
  s += TEX(u_prev, uv + vec2(px.x, 0.0)) * 0.15;
  s += TEX(u_prev, uv - vec2(px.x, 0.0)) * 0.15;
  s += TEX(u_prev, uv + vec2(0.0, px.y)) * 0.15;
  s += TEX(u_prev, uv - vec2(0.0, px.y)) * 0.15;
  OUT = s;
}\`;
function gauss(axis, rad) {
  return PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 dd = \` + axis + \` * \` + rad + \` / u_resolution;
  vec4 s = TEX(u_prev, uv) * 0.227;
  s += (TEX(u_prev, uv + dd) + TEX(u_prev, uv - dd)) * 0.194;
  s += (TEX(u_prev, uv + 2.0*dd) + TEX(u_prev, uv - 2.0*dd)) * 0.121;
  s += (TEX(u_prev, uv + 3.0*dd) + TEX(u_prev, uv - 3.0*dd)) * 0.054;
  s += (TEX(u_prev, uv + 4.0*dd) + TEX(u_prev, uv - 4.0*dd)) * 0.016;
  OUT = s;
}\`;
}
var BLURH = gauss('vec2(1.0,0.0)', 'u_param');
var BLURV = gauss('vec2(0.0,1.0)', 'u_param');
var BBH = gauss('vec2(1.0,0.0)', '3.0');
var BBV = gauss('vec2(0.0,1.0)', '3.0');
var BRIGHT = PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 c = TEX(u_prev, uv).rgb;
  float b = max(c.r, max(c.g, c.b));
  OUT = vec4(c * smoothstep(0.55, 0.95, b), 1.0);
}\`;
var COMP = PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 base = TEX(u_scene, uv).rgb;
  vec3 bloom = TEX(u_prev, uv).rgb;
  OUT = vec4(base + bloom * u_param, 1.0);
}\`;
function grade(pp) {
  return PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 ca = \${pp.chroma} / u_resolution;
  vec3 c;
  c.r = TEX(u_prev, uv + ca).r;
  c.g = TEX(u_prev, uv).g;
  c.b = TEX(u_prev, uv - ca).b;
  c *= \${pp.exposure};
  c = (c - 0.5) * \${pp.contrast} + 0.5;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, \${pp.sat}) * \${pp.tint};
  c *= 0.85 + 0.15 * sin(gl_FragCoord.y * \${pp.scan});
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * \${pp.vignette};
  OUT = vec4(c, 1.0);
}\`;
}
var PRESETS = {
  neutral: { exposure:'1.0', contrast:'1.0', sat:'1.0', tint:'vec3(1.0)', scan:'0.0', vignette:'0.0', chroma:'vec2(0.0)' },
  warm:    { exposure:'1.15', contrast:'1.1', sat:'1.2', tint:'vec3(1.08,1.0,0.9)', scan:'0.0', vignette:'0.7', chroma:'vec2(0.0)' },
  crt:     { exposure:'1.05', contrast:'1.15', sat:'1.1', tint:'vec3(1.0)', scan:'3.14159', vignette:'1.2', chroma:'vec2(2.0,0.0)' },
  noir:    { exposure:'1.0', contrast:'1.3', sat:'0.0', tint:'vec3(1.0)', scan:'0.0', vignette:'1.0', chroma:'vec2(0.0)' }
};
function transition(mode) {
  var mask = mode === 'iris'
    ? 'vec2 q = uv - 0.5; q.x *= u_resolution.x / u_resolution.y; float m = 1.0 - smoothstep(t, t + 0.03, length(q) * 1.7);'
    : mode === 'dissolve'
    ? 'float n = fract(sin(dot(floor(uv * u_resolution / 4.0), vec2(127.1, 311.7))) * 43758.5453); float m = step(n, t);'
    : mode === 'bars'
    ? 'float m = step(fract(uv.y * 9.0), t);'
    : 'float m = 1.0 - smoothstep(t, t + 0.05, uv.x);';
  return PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = 0.5 - 0.5 * cos(u_time * 0.8);
  \` + mask + \`
  OUT = vec4(TEX(u_prev, uv).rgb * m, 1.0);
}\`;
}
function radial(mode) {
  var rays = mode === 'rays';
  var acc = rays
    ? 'w *= 0.92; s += TEX(u_prev, uv + dir * (float(i) / 15.0) * u_param * 0.5) * w;'
    : 's += TEX(u_prev, uv + dir * (float(i) / 15.0) * u_param * 0.5);';
  var fin = rays
    ? 'OUT = vec4(s.rgb * (2.4 / 16.0) + TEX(u_prev, uv).rgb * 0.15, 1.0);'
    : 'OUT = s / 16.0;';
  return PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 dir = vec2(0.5) - uv;
  vec4 s = vec4(0.0);
  float w = 1.0;
  for (int i = 0; i < 16; i++) {
    \` + acc + \`
  }
  \` + fin + \`
}\`;
}
function pixel(mode) {
  if (mode === 'mosaic') return PHEAD + \`void main() {
  float n = u_param;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 q = (floor(uv * n) + 0.5) / n;
  vec3 c = TEX(u_prev, q).rgb;
  vec2 f = fract(uv * n);
  c *= 0.6 + 6.0 * (f.x * f.y * (1.0 - f.x) * (1.0 - f.y));
  OUT = vec4(c, 1.0);
}\`;
  if (mode === 'crt') return PHEAD + \`void main() {
  float n = u_param;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 q = (floor(uv * n) + 0.5) / n;
  vec3 c = TEX(u_prev, q).rgb;
  c *= 0.72 + 0.28 * sin(uv.y * n * 3.14159);
  OUT = vec4(c, 1.0);
}\`;
  return PHEAD + \`void main() {
  float n = u_param;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 q = (floor(uv * n) + 0.5) / n;
  OUT = TEX(u_prev, q);
}\`;
}
function chroma(mode) {
  if (mode === 'shift') return PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float jit = 0.004 * sin(u_time * 24.0 + uv.y * 60.0);
  float k = u_param * 0.012 + jit;
  vec3 c;
  c.r = TEX(u_prev, uv + vec2(k, 0.0)).r;
  c.g = TEX(u_prev, uv).g;
  c.b = TEX(u_prev, uv - vec2(k, 0.0)).b;
  OUT = vec4(c, 1.0);
}\`;
  return PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 d = (uv - 0.5) * (u_param * 0.05);
  vec3 c;
  c.r = TEX(u_prev, uv + d).r;
  c.g = TEX(u_prev, uv).g;
  c.b = TEX(u_prev, uv - d).b;
  OUT = vec4(c, 1.0);
}\`;
}
function glitch(mode) {
  var heavy = mode === 'heavy';
  var thr = heavy ? '0.55' : '0.82';
  var amp = heavy ? '0.22' : '0.12';
  return PHEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float seg = floor(u_time * 2.0);
  vec2 block = floor(uv * vec2(18.0, 10.0));
  float h = fract(sin(dot(block + seg, vec2(127.1, 311.7))) * 43758.5453);
  float g = step(\` + thr + \`, fract(h * 7.0 + u_time));
  vec2 off = (vec2(h, fract(h * 13.0)) - 0.5) * \` + amp + \` * u_param * g;
  vec3 c = TEX(u_prev, uv + off).rgb;
  if (g > 0.5) {
    c.r = TEX(u_prev, uv + off + vec2(0.012, 0.0)).r;
    c.b = TEX(u_prev, uv + off - vec2(0.012, 0.0)).b;
  }
  OUT = vec4(c, 1.0);
}\`;
}
function chainFor(effect, st) {
  if (effect === 'rtt') return [IDENT];
  if (effect === 'ping') { var a = []; for (var i = 0; i < st.iters; i++) a.push(BOX); return a; }
  if (effect === 'blur') return [BLURH, BLURV];
  if (effect === 'bloom') return [BRIGHT, BBH, BBV, COMP];
  if (effect === 'grade') return [grade(PRESETS[st.preset])];
  if (effect === 'transition') return [transition(st.mode)];
  if (effect === 'radial') return [radial(st.mode)];
  if (effect === 'pixel') return [pixel(st.mode)];
  if (effect === 'chroma') return [chroma(st.mode)];
  if (effect === 'glitch') return [glitch(st.mode)];
  if (effect === 'stack') { var a = []; if (st.bloom) { a.push(BRIGHT, BBH, BBV, COMP); } a.push(grade(PRESETS[st.preset])); return a; }
  return [IDENT];
}`;
    const VER = gl2 ? '#version 300 es\n' : '';
    const SDECL = gl2 ? 'out vec4 fragColor;\n' : '';
    const OUT = gl2 ? 'fragColor' : 'gl_FragColor';
    const TEX = gl2 ? 'texture' : 'texture2D';
    return src.split('__VER__').join(VER).split('__SDECL__').join(SDECL)
              .split('OUT').join(OUT).split('TEX').join(TEX);
}
DEPENDENCY_BUNDLES.sh_kitGL1 = kitSrc('gl1');
DEPENDENCY_BUNDLES.sh_kitGL2 = kitSrc('gl2');

// TS variants: structurally identical (Sucrase only strips types; these helper
// bodies are plain enough that the JS form is valid TS — provide explicit
// copies so the TS export never per-entry-falls-back mid-file).
DEPENDENCY_BUNDLES_TS.sh_compileShader = DEPENDENCY_BUNDLES.sh_compileShader;
DEPENDENCY_BUNDLES_TS.sh_createProgram = DEPENDENCY_BUNDLES.sh_createProgram;
DEPENDENCY_BUNDLES_TS.sh_fxChainGL1 = DEPENDENCY_BUNDLES.sh_fxChainGL1;
DEPENDENCY_BUNDLES_TS.sh_fxChainGL2 = DEPENDENCY_BUNDLES.sh_fxChainGL2;
DEPENDENCY_BUNDLES_TS.sh_kitGL1 = DEPENDENCY_BUNDLES.sh_kitGL1;
DEPENDENCY_BUNDLES_TS.sh_kitGL2 = DEPENDENCY_BUNDLES.sh_kitGL2;

// =============================================================================
// DEMOS — 6 effects × {GL1, GL2}. DEMO_CODE is tiny: the kit + chain deps do
// the work. Buttons use clean (un-suffixed) ids — one demo per export.
// =============================================================================
const DEFS = [
    { fx: 'rtt',   title: 'Render-to-Texture',
      controls: [{ id: 'btnRttShow', text: 'What happened?' }],
      info: 'Scene → an FBO → that texture drawn to the screen.',
      init: '{}',
      wire: `document.getElementById('btnRttShow') && document.getElementById('btnRttShow').addEventListener('click', function () { info.textContent = 'The scene is rendered into an FBO, then that texture is drawn to the screen (identity pass).'; });` },
    { fx: 'ping',  title: 'Ping-Pong Buffers',
      controls: [{ id: 'btnPing1', text: '1 pass' }, { id: 'btnPing4', text: '4 passes' }, { id: 'btnPing16', text: '16 passes' }],
      info: 'Two FBOs swapped each pass — you cannot read+write one target.',
      init: '{ iters: 4 }',
      wire: `[['btnPing1',1],['btnPing4',4],['btnPing16',16]].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.iters = e[1]; toy.rebuild(SCENE, chainFor('ping', st)); info.textContent = e[1] + ' ping-pong blur passes — two FBOs swapped each pass.'; }); });` },
    { fx: 'blur',  title: 'Separable Blur',
      controls: [{ id: 'btnBlurSoft', text: 'Soft' }, { id: 'btnBlurStrong', text: 'Strong' }, { id: 'btnBlurHeavy', text: 'Heavy' }],
      info: 'Separable Gaussian — a horizontal then a vertical pass.',
      init: '{}',
      wire: `[['btnBlurSoft',2.0],['btnBlurStrong',5.0],['btnBlurHeavy',9.0]].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { toy.setParam(e[1]); info.textContent = 'Separable Gaussian, radius ' + e[1] + '.'; }); });` },
    { fx: 'bloom', title: 'Bloom',
      controls: [{ id: 'btnBloomOff', text: 'Off' }, { id: 'btnBloomSubtle', text: 'Subtle' }, { id: 'btnBloomGlow', text: 'Glow' }, { id: 'btnBloomIntense', text: 'Intense' }],
      info: 'Bright-pass → blur → additive composite. (8-bit, no true HDR.)',
      init: '{}',
      wire: `[['btnBloomOff',0.0],['btnBloomSubtle',0.8],['btnBloomGlow',1.4],['btnBloomIntense',2.5]].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { toy.setParam(e[1]); info.textContent = 'Bloom strength ' + e[1] + '.'; }); });` },
    { fx: 'grade', title: 'Colour Grade + CRT',
      controls: [{ id: 'btnGradeNeutral', text: 'Neutral' }, { id: 'btnGradeWarm', text: 'Warm' }, { id: 'btnGradeCrt', text: 'CRT' }, { id: 'btnGradeNoir', text: 'Noir' }],
      info: 'A final pass: exposure/contrast/sat/tint + scanline/vignette/chroma.',
      init: "{ preset: 'neutral' }",
      wire: `[['btnGradeNeutral','neutral'],['btnGradeWarm','warm'],['btnGradeCrt','crt'],['btnGradeNoir','noir']].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.preset = e[1]; toy.rebuild(SCENE, chainFor('grade', st)); info.textContent = e[1] + ' grade.'; }); });` },
    { fx: 'stack', title: 'Mini-Project: Post-Process Stack',
      controls: [{ id: 'btnStackBloom', text: 'Toggle bloom' }, { id: 'btnStackWarm', text: 'Warm' }, { id: 'btnStackCrt', text: 'CRT' }, { id: 'btnStackNoir', text: 'Noir' }],
      info: 'scene → [bloom] → grade, composed.',
      init: "{ bloom: true, preset: 'crt' }",
      wire: `var bb = document.getElementById('btnStackBloom'); if (bb) bb.addEventListener('click', function () { st.bloom = !st.bloom; toy.rebuild(SCENE, chainFor('stack', st)); info.textContent = 'Bloom stage ' + (st.bloom ? 'ON' : 'OFF') + '.'; });
[['btnStackWarm','warm'],['btnStackCrt','crt'],['btnStackNoir','noir']].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.preset = e[1]; toy.rebuild(SCENE, chainFor('stack', st)); info.textContent = 'Stack: scene → ' + (st.bloom ? 'bloom → ' : '') + e[1] + ' grade.'; }); });` },
    { fx: 'transition', title: 'Scene Transitions',
      controls: [{ id: 'btnTransWipe', text: 'Wipe' }, { id: 'btnTransIris', text: 'Iris' }, { id: 'btnTransDissolve', text: 'Dissolve' }, { id: 'btnTransBars', text: 'Bars' }],
      info: 'A scene-change wipe as one post pass, progress driven by u_time.',
      init: "{ mode: 'wipe' }",
      wire: `[['btnTransWipe','wipe'],['btnTransIris','iris'],['btnTransDissolve','dissolve'],['btnTransBars','bars']].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.mode = e[1]; toy.rebuild(SCENE, chainFor('transition', st)); info.textContent = e[1] + ' transition — animated by u_time.'; }); });` },
    { fx: 'radial', title: 'Radial Blur & God Rays', param: '0.0',
      controls: [{ id: 'btnRadOff', text: 'Off' }, { id: 'btnRadBlur', text: 'Blur' }, { id: 'btnRadRays', text: 'God rays' }, { id: 'btnRadStrong', text: 'Strong' }],
      info: 'Sample toward the centre — zoom blur / light shafts.',
      init: "{ mode: 'blur' }",
      wire: `[['btnRadOff','blur',0.0],['btnRadBlur','blur',1.0],['btnRadRays','rays',1.0],['btnRadStrong','rays',1.8]].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.mode = e[1]; toy.rebuild(SCENE, chainFor('radial', st)); toy.setParam(e[2]); info.textContent = (e[1] === 'rays' ? 'God rays' : 'Radial blur') + (e[2] > 0.0 ? ' strength ' + e[2] : ' off') + '.'; }); });` },
    { fx: 'pixel', title: 'Pixelation / Mosaic', param: '120.0',
      controls: [{ id: 'btnPixFine', text: 'Fine' }, { id: 'btnPixChunky', text: 'Chunky' }, { id: 'btnPixMosaic', text: 'Mosaic' }, { id: 'btnPixCrt', text: 'CRT' }],
      info: 'Snap uv to a coarse grid — pixel-art / mosaic downscale.',
      init: "{ mode: 'pixel' }",
      wire: `[['btnPixFine','pixel',160.0],['btnPixChunky','pixel',56.0],['btnPixMosaic','mosaic',56.0],['btnPixCrt','crt',90.0]].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.mode = e[1]; toy.rebuild(SCENE, chainFor('pixel', st)); toy.setParam(e[2]); info.textContent = e[1] + ' — ' + e[2] + ' cells across.'; }); });` },
    { fx: 'chroma', title: 'Chromatic Aberration & RGB-Shift', param: '1.0',
      controls: [{ id: 'btnChrCA', text: 'CA' }, { id: 'btnChrShift', text: 'RGB-shift' }, { id: 'btnChrStrong', text: 'Strong' }],
      info: 'Split R/B off green — radial lens CA or a lateral digital shift.',
      init: "{ mode: 'ca' }",
      wire: `[['btnChrCA','ca',1.0],['btnChrShift','shift',1.0],['btnChrStrong','ca',2.4]].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.mode = e[1]; toy.rebuild(SCENE, chainFor('chroma', st)); toy.setParam(e[2]); info.textContent = (e[1] === 'ca' ? 'Radial chromatic aberration' : 'Lateral RGB-shift') + ' — strength ' + e[2] + '.'; }); });` },
    { fx: 'glitch', title: 'Datamosh / Block Glitch', param: '1.0',
      controls: [{ id: 'btnGltCalm', text: 'Calm' }, { id: 'btnGltGlitch', text: 'Glitch' }, { id: 'btnGltHeavy', text: 'Heavy' }],
      info: 'Time-quantised block displacement + channel tear — single pass.',
      init: "{ mode: 'mosh' }",
      wire: `[['btnGltCalm','mosh',0.4],['btnGltGlitch','mosh',1.0],['btnGltHeavy','heavy',1.6]].forEach(function (e) { var b = document.getElementById(e[0]); if (b) b.addEventListener('click', function () { st.mode = e[1]; toy.rebuild(SCENE, chainFor('glitch', st)); toy.setParam(e[2]); info.textContent = 'Datamosh ' + e[0].replace('btnGlt','').toLowerCase() + ' — block displacement + channel tear.'; }); });` }
];

DEFS.forEach(function (d) {
    ['GL1', 'GL2'].forEach(function (api) {
        const key = 'sh_' + d.fx + api;
        DEMO_HTML[key] = {
            title: 'Shaders — ' + d.title + ' (' + (api === 'GL1' ? 'WebGL1' : 'WebGL2') + ')',
            canvas: { width: 800, height: 450 },
            controls: d.controls,
            info: d.info
        };
        const body = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var st = ${d.init};
    var toy = makeFXChain(canvas, SCENE, chainFor('${d.fx}', st), { info: info, param: ${d.param == null ? '1.4' : d.param} });
    ${d.wire}
})();`;
        DEMO_CODE[key] = body;
        DEMO_CODE_TS[key] = body;   // plain enough that JS form is valid TS
    });
});

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.sh_createProgram = ['sh_compileShader'];
DEPENDENCY_REQUIRES.sh_fxChainGL1 = ['sh_compileShader', 'sh_createProgram'];
DEPENDENCY_REQUIRES.sh_fxChainGL2 = ['sh_compileShader', 'sh_createProgram'];
