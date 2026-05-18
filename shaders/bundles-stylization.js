// =============================================================================
// SHADERS TRACK — STYLIZATION / NPR TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js so the 📋 Export button on each
// `<details data-demo-id="sh_*">` copies a runnable HTML to the clipboard.
//
// IDs are `sh_`-prefixed and unique to this tier. The 4 WebGL helpers are
// copied verbatim from bundles-intermediate.js (the project-wide per-tier
// pattern; tier pages never co-load). `sh_nprScene` carries the shared
// NPR_HEAD + NPR_SCENE GLSL consts every stylizer prepends.
//
// GLSL-as-template-literal convention: each DEMO_CODE.sh_* is a JS template
// literal; the fragment shaders inside are nested template literals, so the
// ONLY escaping is the inner backtick (\`) and \${...} for the JS-interpolated
// structural constants (band count, kernel size, cell count …). DEMO_CODE_TS
// aliases DEMO_CODE — the demo bodies are plain enough to be valid TS (the
// simulations-tier precedent). Verify exports by running them, never by eye.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// DEPENDENCY BUNDLES — verbatim copy of bundles-intermediate.js's WebGL helpers
// (the standalone-export form: one always-visible canvas, no lazy teardown).
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
// the fragment shader.
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
// standard uniforms (u_time s, u_resolution px, u_mouse px, u_param), the
// render loop, and loud error reporting. Returns a small handle.
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

// Shared scene every stylizer prepends (NPR_HEAD declares the uniforms,
// NPR_SCENE the lit-balls scene + lum()). GLSL has no backtick / no \${ so
// only the two outer literal delimiters are escaped.
DEPENDENCY_BUNDLES.sh_nprScene = `const NPR_HEAD = \`precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_param;
\`;
const NPR_SCENE = \`vec3 ball(vec3 col, vec2 p, vec2 c, float rr, vec3 base, float shin) {
  vec2 q = (p - c) / rr;
  float k = dot(q, q);
  if (k >= 1.0) return col;
  float z = sqrt(1.0 - k);
  vec3 n = normalize(vec3(q, z));
  vec3 L = normalize(vec3(-0.55, 0.75, 0.65));
  float di = clamp(dot(n, L), 0.0, 1.0);
  float sp = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), shin);
  return base * (0.22 + 0.95 * di) + sp * 0.55;
}
vec3 scene(vec2 uv) {
  float ar = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * ar, uv.y);
  vec3 col = mix(vec3(0.16, 0.20, 0.30), vec3(0.58, 0.66, 0.82), uv.y);
  col = mix(col, vec3(0.26, 0.22, 0.18), smoothstep(0.30, 0.27, uv.y));
  col = ball(col, p, vec2(0.34 * ar + 0.03 * sin(u_time * 0.7), 0.50), 0.15, vec3(0.85, 0.30, 0.28), 32.0);
  col = ball(col, p, vec2(0.52 * ar + 0.03 * cos(u_time * 0.55), 0.44), 0.13, vec3(0.34, 0.78, 0.40), 32.0);
  col = ball(col, p, vec2(0.66 * ar + 0.025 * sin(u_time * 0.9 + 1.0), 0.55), 0.11, vec3(0.32, 0.52, 0.92), 48.0);
  return col;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
\`;`;

// TS variants: the helper/scene bodies are plain enough to be valid TS
// (Sucrase only strips types) — alias, matching the simulations tier.
DEPENDENCY_BUNDLES_TS.sh_compileShader = DEPENDENCY_BUNDLES.sh_compileShader;
DEPENDENCY_BUNDLES_TS.sh_createProgram = DEPENDENCY_BUNDLES.sh_createProgram;
DEPENDENCY_BUNDLES_TS.sh_fullscreenQuad = DEPENDENCY_BUNDLES.sh_fullscreenQuad;
DEPENDENCY_BUNDLES_TS.sh_makeShaderToy = DEPENDENCY_BUNDLES.sh_makeShaderToy;
DEPENDENCY_BUNDLES_TS.sh_nprScene = DEPENDENCY_BUNDLES.sh_nprScene;

// =============================================================================
// DEMO 1 — sh_toonGL  (§ Toon / Cel Shading)
// =============================================================================
DEMO_HTML.sh_toonGL = {
    title: 'Shaders — Toon / Cel Shading',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnToon2', text: '2 bands' }, { id: 'btnToon4', text: '4 bands' },
        { id: 'btnToon6', text: '6 bands' }, { id: 'btnToonRim', text: 'Toggle edge ink' }
    ],
    info: 'Quantise the value into hard bands, keep the hue, ink the silhouette.'
};
DEMO_CODE.sh_toonGL = `(function toonShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    function buildFrag(bands, rim) {
        return NPR_HEAD + NPR_SCENE + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 c = scene(uv);
  float L = lum(c);
  float B = \${bands}.0;
  float q = floor(L * B) / (B - 1.0);
  vec3 hue = c / max(L, 1e-3);
  vec3 outc = clamp(hue * q, 0.0, 1.0);
  vec2 px = 1.0 / u_resolution;
  float gx = lum(scene(uv + vec2(px.x, 0.0))) - lum(scene(uv - vec2(px.x, 0.0)));
  float gy = lum(scene(uv + vec2(0.0, px.y))) - lum(scene(uv - vec2(0.0, px.y)));
  float edge = step(0.085, length(vec2(gx, gy)));
  outc = mix(outc, vec3(0.04, 0.03, 0.05), \${rim}.0 * edge);
  gl_FragColor = vec4(outc, 1.0);
}\`;
    }
    const state = { bands: 4, rim: 1 };
    const toy = makeShaderToy(canvas, buildFrag(state.bands, state.rim), { info: info });
    function refresh(msg) { toy.setFrag(buildFrag(state.bands, state.rim)); info.textContent = msg; }
    document.getElementById('btnToon2')?.addEventListener('click', () => { state.bands = 2; refresh('2 bands — light vs shadow.'); });
    document.getElementById('btnToon4')?.addEventListener('click', () => { state.bands = 4; refresh('4 bands — classic anime ramp.'); });
    document.getElementById('btnToon6')?.addEventListener('click', () => { state.bands = 6; refresh('6 bands — soft cel.'); });
    document.getElementById('btnToonRim')?.addEventListener('click', () => {
        state.rim = state.rim > 0.5 ? 0.0 : 1.0;
        refresh('Edge ink ' + (state.rim > 0.5 ? 'ON.' : 'OFF.'));
    });
})();`;
DEMO_CODE_TS.sh_toonGL = DEMO_CODE.sh_toonGL;

// =============================================================================
// DEMO 2 — sh_edgeGL  (§ Sobel / Roberts Edge Ink)
// =============================================================================
DEMO_HTML.sh_edgeGL = {
    title: 'Shaders — Sobel / Roberts Edge Ink',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnEdgeSobel', text: 'Sobel' }, { id: 'btnEdgeRoberts', text: 'Roberts' },
        { id: 'btnEdgeFill', text: 'Ink over scene' }, { id: 'btnEdgeThick', text: 'Thicker' }
    ],
    info: 'Threshold the luminance-gradient magnitude → clean line art.'
};
DEMO_CODE.sh_edgeGL = `(function edgeShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    const G = {
        sobel: \`float L00=lum(scene(uv+px*vec2(-1,-1))), L10=lum(scene(uv+px*vec2(0,-1))), L20=lum(scene(uv+px*vec2(1,-1)));
  float L01=lum(scene(uv+px*vec2(-1,0))), L21=lum(scene(uv+px*vec2(1,0)));
  float L02=lum(scene(uv+px*vec2(-1,1))), L12=lum(scene(uv+px*vec2(0,1))), L22=lum(scene(uv+px*vec2(1,1)));
  float gx = (L20+2.0*L21+L22) - (L00+2.0*L01+L02);
  float gy = (L02+2.0*L12+L22) - (L00+2.0*L10+L20);
  float g = length(vec2(gx, gy));\`,
        roberts: \`float a=lum(scene(uv)), b=lum(scene(uv+px*vec2(1,0)));
  float c=lum(scene(uv+px*vec2(0,1))), d=lum(scene(uv+px*vec2(1,1)));
  float g = length(vec2(a-d, b-c)) * 2.2;\`
    };
    function buildFrag(op, mode, thick) {
        return NPR_HEAD + NPR_SCENE + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 px = \${thick} / u_resolution;
  \${G[op]}
  float ink = smoothstep(0.10, 0.22, g);
  vec3 fill = \${mode === 'fill' ? 'scene(uv)' : 'vec3(0.97, 0.96, 0.92)'};
  gl_FragColor = vec4(mix(fill, vec3(0.05, 0.04, 0.07), ink), 1.0);
}\`;
    }
    const state = { op: 'sobel', mode: 'paper', thick: '1.0' };
    const toy = makeShaderToy(canvas, buildFrag(state.op, state.mode, state.thick), { info: info });
    function refresh(msg) { toy.setFrag(buildFrag(state.op, state.mode, state.thick)); info.textContent = msg; }
    document.getElementById('btnEdgeSobel')?.addEventListener('click', () => { state.op = 'sobel'; refresh('Sobel — 3x3 gradient.'); });
    document.getElementById('btnEdgeRoberts')?.addEventListener('click', () => { state.op = 'roberts'; refresh('Roberts — 2x2 diagonal.'); });
    document.getElementById('btnEdgeFill')?.addEventListener('click', () => {
        state.mode = state.mode === 'fill' ? 'paper' : 'fill';
        refresh(state.mode === 'fill' ? 'Ink over the colour scene.' : 'Ink on paper.');
    });
    document.getElementById('btnEdgeThick')?.addEventListener('click', () => {
        state.thick = state.thick === '1.0' ? '2.2' : '1.0';
        refresh('Stroke width ' + state.thick + ' px.');
    });
})();`;
DEMO_CODE_TS.sh_edgeGL = DEMO_CODE.sh_edgeGL;

// =============================================================================
// DEMO 3 — sh_hatchGL2  (§ Cross-Hatch — scene-wide)
// =============================================================================
DEMO_HTML.sh_hatchGL2 = {
    title: 'Shaders — Cross-Hatch (scene-wide)',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnHatch2Sketch', text: 'Pencil' }, { id: 'btnHatch2Colour', text: 'Tinted' },
        { id: 'btnHatch2Dense', text: 'Denser' }, { id: 'btnHatch2Coarse', text: 'Coarser' }
    ],
    info: 'Darker luminance stacks more rotated line layers — engraving.'
};
DEMO_CODE.sh_hatchGL2 = `(function hatchSceneShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    function buildFrag(colour) {
        return NPR_HEAD + NPR_SCENE + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 c = scene(uv);
  float L = lum(c);
  vec2 g = gl_FragCoord.xy;
  float F = mix(0.07, 0.20, u_param);
  float k = 1.0;
  if (L < 0.85) k = min(k, step(0.5, fract((g.x + g.y) * F)));
  if (L < 0.62) k = min(k, step(0.5, fract((g.x - g.y) * F)));
  if (L < 0.40) k = min(k, step(0.5, fract( g.x        * F * 1.5)));
  if (L < 0.20) k = min(k, step(0.5, fract( g.y        * F * 1.5)));
  vec3 paper = \${colour ? 'mix(vec3(0.97,0.96,0.92), c, 0.45)' : 'vec3(0.97, 0.96, 0.92)'};
  gl_FragColor = vec4(mix(vec3(0.07, 0.06, 0.10), paper, k), 1.0);
}\`;
    }
    const state = { colour: false };
    const toy = makeShaderToy(canvas, buildFrag(false), { info: info, param: 0.4 });
    function refresh(msg) { toy.setFrag(buildFrag(state.colour)); info.textContent = msg; }
    document.getElementById('btnHatch2Sketch')?.addEventListener('click', () => { state.colour = false; refresh('Pencil sketch.'); });
    document.getElementById('btnHatch2Colour')?.addEventListener('click', () => { state.colour = true; refresh('Tinted hatch.'); });
    document.getElementById('btnHatch2Dense')?.addEventListener('click', () => { toy.setParam(0.95); info.textContent = 'Denser nib.'; });
    document.getElementById('btnHatch2Coarse')?.addEventListener('click', () => { toy.setParam(0.15); info.textContent = 'Coarser nib.'; });
})();`;
DEMO_CODE_TS.sh_hatchGL2 = DEMO_CODE.sh_hatchGL2;

// =============================================================================
// DEMO 4 — sh_halftoneGL  (§ Halftone / Ben-Day Dots)
// =============================================================================
DEMO_HTML.sh_halftoneGL = {
    title: 'Shaders — Halftone / Ben-Day Dots',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnHtMono', text: 'Mono' }, { id: 'btnHtCmyk', text: 'CMYK' },
        { id: 'btnHtCoarse', text: 'Coarser' }, { id: 'btnHtFine', text: 'Fine' }
    ],
    info: 'Tone becomes dot size; rotate a screen per channel for Ben-Day.'
};
DEMO_CODE.sh_halftoneGL = `(function halftoneShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    function buildFrag(mode) {
        const body = mode === 'cmyk'
            ? 'float r = dotScreen(g, 0.26, scene(uv).r);\\n  float gr = dotScreen(g, 1.30, scene(uv).g);\\n  float b = dotScreen(g, 2.30, scene(uv).b);\\n  vec3 outc = vec3(r, gr, b);'
            : 'float v = dotScreen(g, 0.40, lum(scene(uv)));\\n  vec3 outc = mix(vec3(0.06, 0.05, 0.08), vec3(0.97, 0.96, 0.92), v);';
        return NPR_HEAD + NPR_SCENE + \`vec2 rot2(vec2 v, float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c)*v; }
float dotScreen(vec2 g, float ang, float tone){
  float F = mix(0.10, 0.32, u_param);
  vec2 cell = fract(rot2(g, ang) * F) - 0.5;
  float r = sqrt(clamp(tone, 0.0, 1.0)) * 0.62;
  return smoothstep(r - 0.05, r + 0.05, length(cell));
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 g = gl_FragCoord.xy;
  \` + body + \`
  gl_FragColor = vec4(outc, 1.0);
}\`;
    }
    const toy = makeShaderToy(canvas, buildFrag('mono'), { info: info, param: 0.45 });
    function set(m, msg) { toy.setFrag(buildFrag(m)); info.textContent = msg; }
    document.getElementById('btnHtMono')?.addEventListener('click', () => set('mono', 'Mono screen.'));
    document.getElementById('btnHtCmyk')?.addEventListener('click', () => set('cmyk', 'CMYK Ben-Day.'));
    document.getElementById('btnHtCoarse')?.addEventListener('click', () => { toy.setParam(0.95); info.textContent = 'Coarser (newsprint).'; });
    document.getElementById('btnHtFine')?.addEventListener('click', () => { toy.setParam(0.15); info.textContent = 'Fine (magazine).'; });
})();`;
DEMO_CODE_TS.sh_halftoneGL = DEMO_CODE.sh_halftoneGL;

// =============================================================================
// DEMO 5 — sh_kuwaharaGL  (§ Kuwahara Oil Paint)
// =============================================================================
DEMO_HTML.sh_kuwaharaGL = {
    title: 'Shaders — Kuwahara Oil Paint',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnKuwOff', text: 'Off' }, { id: 'btnKuwSmall', text: 'K = 2' },
        { id: 'btnKuwBig', text: 'K = 4' }
    ],
    info: 'Keep the flattest of four quadrants → painterly, edges intact.'
};
DEMO_CODE.sh_kuwaharaGL = `(function kuwaharaShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    function buildFrag(k) {
        return NPR_HEAD + NPR_SCENE + \`const int K = \${k};
void region(vec2 uv, vec2 px, vec2 d, out vec3 mean, out float varr){
  vec3 sum = vec3(0.0), sum2 = vec3(0.0); float n = 0.0;
  for (int j = 0; j <= K; j++)
  for (int i = 0; i <= K; i++) {
    vec3 c = scene(uv + d * vec2(float(i), float(j)) * px);
    sum += c; sum2 += c * c; n += 1.0;
  }
  mean = sum / n;
  vec3 v = sum2 / n - mean * mean;
  varr = v.r + v.g + v.b;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 px = 1.5 / u_resolution;
  vec3 mA,mB,mC,mD; float vA,vB,vC,vD;
  region(uv, px, vec2( 1.0,  1.0), mA, vA);
  region(uv, px, vec2(-1.0,  1.0), mB, vB);
  region(uv, px, vec2( 1.0, -1.0), mC, vC);
  region(uv, px, vec2(-1.0, -1.0), mD, vD);
  vec3 col = mA; float best = vA;
  if (vB < best) { best = vB; col = mB; }
  if (vC < best) { best = vC; col = mC; }
  if (vD < best) { best = vD; col = mD; }
  gl_FragColor = vec4(col, 1.0);
}\`;
    }
    const toy = makeShaderToy(canvas, buildFrag(3), { info: info });
    function set(k, msg) { toy.setFrag(buildFrag(k)); info.textContent = msg; }
    document.getElementById('btnKuwOff')?.addEventListener('click', () => set(0, 'Off (raw scene).'));
    document.getElementById('btnKuwSmall')?.addEventListener('click', () => set(2, 'K=2 — subtle.'));
    document.getElementById('btnKuwBig')?.addEventListener('click', () => set(4, 'K=4 — heavy oil.'));
})();`;
DEMO_CODE_TS.sh_kuwaharaGL = DEMO_CODE.sh_kuwaharaGL;

// =============================================================================
// DEMO 6 — sh_asciiGL  (§ ASCII / Dither Art)
// =============================================================================
DEMO_HTML.sh_asciiGL = {
    title: 'Shaders — ASCII / Dither Art',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnAsciiAscii', text: 'ASCII' }, { id: 'btnAsciiDither', text: 'Dither' },
        { id: 'btnAsciiCell', text: 'Cell +' }
    ],
    info: 'Collapse cells to glyphs, or 1-bit dither — structure, not just tone.'
};
DEMO_CODE.sh_asciiGL = `(function asciiShader() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    function buildFrag(mode, cells) {
        const body = mode === 'dither'
            ? 'float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\\n  float bw = step(ign, lum(scene(uv)));\\n  vec3 outc = mix(vec3(0.05,0.06,0.09), vec3(0.93,0.94,0.90), bw);'
            : \`vec2 g = uv * vec2(\${cells}.0);
  vec2 id = floor(g), f = fract(g);
  vec3 cc = scene((id + 0.5) / vec2(\${cells}.0));
  float L = lum(cc);
  float lvl = floor(L * 5.0);
  float bars = (lvl < 0.5) ? 0.0
    : step(0.5, fract(f.y * lvl + 0.25)) * step(0.12, f.x) * step(f.x, 0.88);
  vec3 outc = mix(vec3(0.03, 0.05, 0.07), vec3(0.40, 0.95, 0.55), bars);\`;
        return NPR_HEAD + NPR_SCENE + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  \` + body + \`
  gl_FragColor = vec4(outc, 1.0);
}\`;
    }
    const state = { mode: 'ascii', cells: 70 };
    const toy = makeShaderToy(canvas, buildFrag('ascii', 70), { info: info });
    function refresh(msg) { toy.setFrag(buildFrag(state.mode, state.cells)); info.textContent = msg; }
    document.getElementById('btnAsciiAscii')?.addEventListener('click', () => { state.mode = 'ascii'; refresh('ASCII glyphs.'); });
    document.getElementById('btnAsciiDither')?.addEventListener('click', () => { state.mode = 'dither'; refresh('1-bit dither.'); });
    document.getElementById('btnAsciiCell')?.addEventListener('click', () => {
        state.cells = state.cells >= 110 ? 44 : state.cells + 22;
        refresh('Cell grid ' + state.cells + ' across.');
    });
})();`;
DEMO_CODE_TS.sh_asciiGL = DEMO_CODE.sh_asciiGL;

// =============================================================================
// DEMO 7 — sh_nprStackGL  (§ Mini-Project: Stylization Stack)
// =============================================================================
DEMO_HTML.sh_nprStackGL = {
    title: 'Shaders — Stylization Stack',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnNprToon', text: 'Toon + ink' }, { id: 'btnNprHatch', text: 'Hatch' },
        { id: 'btnNprHalf', text: 'Halftone' }, { id: 'btnNprOil', text: 'Oil' },
        { id: 'btnNprAscii', text: 'ASCII' }
    ],
    info: 'One scene, five non-photorealistic pipelines — pick the art direction.'
};
DEMO_CODE.sh_nprStackGL = `(function nprStack() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    const STYLE = {
        toonink: \`float L=lum(scene(uv)); float q=floor(L*4.0)/3.0;
  vec3 outc=clamp((scene(uv)/max(L,1e-3))*q,0.0,1.0);
  vec2 pp=1.0/u_resolution;
  float gx=lum(scene(uv+vec2(pp.x,0.)))-lum(scene(uv-vec2(pp.x,0.)));
  float gy=lum(scene(uv+vec2(0.,pp.y)))-lum(scene(uv-vec2(0.,pp.y)));
  outc=mix(outc,vec3(0.04),step(0.085,length(vec2(gx,gy))));\`,
        hatch: \`float L=lum(scene(uv)); vec2 g=gl_FragCoord.xy; float F=0.12; float k=1.0;
  if(L<0.85)k=min(k,step(0.5,fract((g.x+g.y)*F)));
  if(L<0.55)k=min(k,step(0.5,fract((g.x-g.y)*F)));
  if(L<0.30)k=min(k,step(0.5,fract(g.x*F*1.5)));
  vec3 outc=mix(vec3(0.07,0.06,0.10),vec3(0.97,0.96,0.92),k);\`,
        halftone: \`vec2 g=gl_FragCoord.xy; float a=0.4;
  mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
  vec2 cell=fract(R*g*0.22)-0.5;
  float r=sqrt(clamp(lum(scene(uv)),0.0,1.0))*0.62;
  float v=smoothstep(r-0.05,r+0.05,length(cell));
  vec3 outc=mix(vec3(0.06,0.05,0.08),vec3(0.97,0.96,0.92),v);\`,
        oil: \`vec2 px=1.5/u_resolution; vec3 bm=scene(uv); float bv=1e9;
  for(int q=0;q<4;q++){
    vec2 d=q==0?vec2(1,1):q==1?vec2(-1,1):q==2?vec2(1,-1):vec2(-1,-1);
    vec3 s=vec3(0.0),s2=vec3(0.0);
    for(int j=0;j<=3;j++)for(int i=0;i<=3;i++){
      vec3 c=scene(uv+d*vec2(float(i),float(j))*px); s+=c; s2+=c*c; }
    vec3 m=s/16.0; vec3 vv=s2/16.0-m*m; float vr=vv.r+vv.g+vv.b;
    if(vr<bv){bv=vr; bm=m;} }
  vec3 outc=bm;\`,
        ascii: \`vec2 g=uv*vec2(80.0); vec2 id=floor(g),f=fract(g);
  float L=lum(scene((id+0.5)/vec2(80.0))); float lvl=floor(L*5.0);
  float bars=(lvl<0.5)?0.0:step(0.5,fract(f.y*lvl+0.25))*step(0.12,f.x)*step(f.x,0.88);
  vec3 outc=mix(vec3(0.03,0.05,0.07),vec3(0.40,0.95,0.55),bars);\`
    };
    function buildFrag(style) {
        return NPR_HEAD + NPR_SCENE + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  \` + STYLE[style] + \`
  gl_FragColor = vec4(outc, 1.0);
}\`;
    }
    const toy = makeShaderToy(canvas, buildFrag('toonink'), { info: info });
    function set(s, msg) { toy.setFrag(buildFrag(s)); info.textContent = msg; }
    document.getElementById('btnNprToon')?.addEventListener('click', () => set('toonink', 'Toon + ink.'));
    document.getElementById('btnNprHatch')?.addEventListener('click', () => set('hatch', 'Hatch.'));
    document.getElementById('btnNprHalf')?.addEventListener('click', () => set('halftone', 'Halftone.'));
    document.getElementById('btnNprOil')?.addEventListener('click', () => set('oil', 'Oil.'));
    document.getElementById('btnNprAscii')?.addEventListener('click', () => set('ascii', 'ASCII.'));
})();`;
DEMO_CODE_TS.sh_nprStackGL = DEMO_CODE.sh_nprStackGL;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.sh_createProgram = ['sh_compileShader'];
DEPENDENCY_REQUIRES.sh_makeShaderToy = ['sh_fullscreenQuad', 'sh_createProgram'];
