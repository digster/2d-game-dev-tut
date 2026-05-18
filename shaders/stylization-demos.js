// =============================================================================
// SHADERS TRACK — STYLIZATION / NPR TIER — PAGE-SIDE INTERACTIVE DEMOS
// =============================================================================
// Non-photorealistic rendering: re-draw a shaded scene as ink, dots, hatching,
// paint or text. Every demo renders the SAME shared `scene(uv)` (a few lit
// balls on a gradient) and then post-processes it — so you compare stylizers
// on identical input, exactly the way the Advanced post-FX tier teaches.
//
// Same conventions as the earlier tiers: WebGL1 / GLSL ES 1.00, the 4 WebGL
// helpers are copied verbatim (tier files never co-load), GLSL is a plain
// multi-line template literal. Structural choices (band count, kernel size,
// cell size) rebuild via toy.setFrag; continuous knobs ride u_param.
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
// The shared scene every stylizer post-processes: three lit balls (red/green/
// blue) on a sky→ground gradient. Smooth tone ramps (toon/hatch/halftone),
// distinct colour regions (palette) and crisp silhouettes (edge detection).
// -----------------------------------------------------------------------------
const NPR_HEAD = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_param;
`;
const NPR_SCENE = `vec3 ball(vec3 col, vec2 p, vec2 c, float rr, vec3 base, float shin) {
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
`;

// =============================================================================
// DEMO 1 — toonGL  (§ Toon / Cel Shading)
// Quantise the value channel into hard bands, keep the hue, ink the edges.
// Band count is structural → setFrag; rim toggle too.
// =============================================================================
(function toonShader() {
    const canvas = document.getElementById('toonGL');
    if (!canvas) return;
    const info = document.getElementById('toonGLInfo');

    function buildFrag(bands, rim) {
        return NPR_HEAD + NPR_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 c = scene(uv);
  float L = lum(c);
  float B = ${bands}.0;
  float q = floor(L * B) / (B - 1.0);                  // hard value bands
  vec3 hue = c / max(L, 1e-3);                          // keep colour, drop value
  vec3 outc = clamp(hue * q, 0.0, 1.0);
  vec2 px = 1.0 / u_resolution;
  float gx = lum(scene(uv + vec2(px.x, 0.0))) - lum(scene(uv - vec2(px.x, 0.0)));
  float gy = lum(scene(uv + vec2(0.0, px.y))) - lum(scene(uv - vec2(0.0, px.y)));
  float edge = step(0.085, length(vec2(gx, gy)));
  outc = mix(outc, vec3(0.04, 0.03, 0.05), ${rim}.0 * edge);
  gl_FragColor = vec4(outc, 1.0);
}`;
    }

    const state = { bands: 4, rim: 1 };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state.bands, state.rim), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state.bands, state.rim)); info.textContent = msg; }

    document.getElementById('btnToon2')?.addEventListener('click', () => {
        state.bands = 2; refresh('2 bands — the starkest cel look: light vs shadow.');
    });
    document.getElementById('btnToon4')?.addEventListener('click', () => {
        state.bands = 4; refresh('4 bands — classic anime ramp (key / mid / shadow / core).');
    });
    document.getElementById('btnToon6')?.addEventListener('click', () => {
        state.bands = 6; refresh('6 bands — soft cel: nearly continuous but still posterised.');
    });
    document.getElementById('btnToonRim')?.addEventListener('click', () => {
        state.rim = state.rim > 0.5 ? 0.0 : 1.0;
        refresh('Edge ink ' + (state.rim > 0.5 ? 'ON — luminance-gradient outline.' : 'OFF.'));
    });
})();

// =============================================================================
// DEMO 2 — edgeGL  (§ Sobel / Roberts Edge Ink)
// A 3x3 Sobel (or 2x2 Roberts) on luminance → ink lines over a flat fill.
// =============================================================================
(function edgeShader() {
    const canvas = document.getElementById('edgeGL');
    if (!canvas) return;
    const info = document.getElementById('edgeGLInfo');

    const G = {
        sobel: `float L00=lum(scene(uv+px*vec2(-1,-1))), L10=lum(scene(uv+px*vec2(0,-1))), L20=lum(scene(uv+px*vec2(1,-1)));
  float L01=lum(scene(uv+px*vec2(-1,0))),                                           L21=lum(scene(uv+px*vec2(1,0)));
  float L02=lum(scene(uv+px*vec2(-1,1))),  L12=lum(scene(uv+px*vec2(0,1))),  L22=lum(scene(uv+px*vec2(1,1)));
  float gx = (L20+2.0*L21+L22) - (L00+2.0*L01+L02);
  float gy = (L02+2.0*L12+L22) - (L00+2.0*L10+L20);
  float g = length(vec2(gx, gy));`,
        roberts: `float a=lum(scene(uv)), b=lum(scene(uv+px*vec2(1,0)));
  float c=lum(scene(uv+px*vec2(0,1))), d=lum(scene(uv+px*vec2(1,1)));
  float g = length(vec2(a-d, b-c)) * 2.2;`
    };

    function buildFrag(op, mode, thick) {
        return NPR_HEAD + NPR_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 px = ${thick} / u_resolution;
  ${G[op]}
  float ink = smoothstep(0.10, 0.22, g);
  vec3 fill = ${mode === 'fill' ? 'scene(uv)' : 'vec3(0.97, 0.96, 0.92)'};
  gl_FragColor = vec4(mix(fill, vec3(0.05, 0.04, 0.07), ink), 1.0);
}`;
    }

    const state = { op: 'sobel', mode: 'paper', thick: '1.0' };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state.op, state.mode, state.thick), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state.op, state.mode, state.thick)); info.textContent = msg; }

    document.getElementById('btnEdgeSobel')?.addEventListener('click', () => {
        state.op = 'sobel'; refresh('Sobel: a 3×3 gradient — the standard edge operator.');
    });
    document.getElementById('btnEdgeRoberts')?.addEventListener('click', () => {
        state.op = 'roberts'; refresh('Roberts cross: a cheap 2×2 diagonal gradient.');
    });
    document.getElementById('btnEdgeFill')?.addEventListener('click', () => {
        state.mode = state.mode === 'fill' ? 'paper' : 'fill';
        refresh(state.mode === 'fill' ? 'Ink over the colour scene.' : 'Ink on paper (pure line art).');
    });
    document.getElementById('btnEdgeThick')?.addEventListener('click', () => {
        state.thick = state.thick === '1.0' ? '2.2' : '1.0';
        refresh('Stroke width ' + state.thick + ' px (the sample spacing).');
    });
})();

// =============================================================================
// DEMO 3 — hatchGL2  (§ Cross-Hatch — scene-wide)
// Screen-space rotated line layers; darker luminance unlocks more layers.
// =============================================================================
(function hatchSceneShader() {
    const canvas = document.getElementById('hatchGL2');
    if (!canvas) return;
    const info = document.getElementById('hatchGL2Info');

    function buildFrag(colour) {
        return NPR_HEAD + NPR_SCENE + `void main() {
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
  vec3 paper = ${colour ? 'mix(vec3(0.97,0.96,0.92), c, 0.45)' : 'vec3(0.97, 0.96, 0.92)'};
  gl_FragColor = vec4(mix(vec3(0.07, 0.06, 0.10), paper, k), 1.0);
}`;
    }

    const state = { colour: false };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(false), { info: info, param: 0.4 }));
    function refresh(msg) { toy.setFrag(buildFrag(state.colour)); info.textContent = msg; }

    document.getElementById('btnHatch2Sketch')?.addEventListener('click', () => {
        state.colour = false; refresh('Pencil sketch — pure tonal hatching on paper.');
    });
    document.getElementById('btnHatch2Colour')?.addEventListener('click', () => {
        state.colour = true; refresh('Tinted — the hatch keeps a wash of the scene colour.');
    });
    document.getElementById('btnHatch2Dense')?.addEventListener('click', () => {
        toy.setParam(0.95); info.textContent = 'Denser nib — u_param scales the line frequency.';
    });
    document.getElementById('btnHatch2Coarse')?.addEventListener('click', () => {
        toy.setParam(0.15); info.textContent = 'Coarser nib — fewer, fatter strokes.';
    });
})();

// =============================================================================
// DEMO 4 — halftoneGL  (§ Halftone / Ben-Day Dots)
// Rotated dot screens; mono uses one screen, CMYK rotates a screen per channel.
// =============================================================================
(function halftoneShader() {
    const canvas = document.getElementById('halftoneGL');
    if (!canvas) return;
    const info = document.getElementById('halftoneGLInfo');

    function buildFrag(mode) {
        const body = mode === 'cmyk'
            ? `float r = dotScreen(g, 0.26, scene(uv).r);
  float gr = dotScreen(g, 1.30, scene(uv).g);
  float b = dotScreen(g, 2.30, scene(uv).b);
  vec3 outc = 1.0 - vec3(1.0 - r, 1.0 - gr, 1.0 - b) * 0.0;
  outc = vec3(r, gr, b);`
            : `float v = dotScreen(g, 0.40, lum(scene(uv)));
  vec3 outc = mix(vec3(0.06, 0.05, 0.08), vec3(0.97, 0.96, 0.92), v);`;
        return NPR_HEAD + NPR_SCENE + `vec2 rot2(vec2 v, float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c)*v; }
float dotScreen(vec2 g, float ang, float tone){
  float F = mix(0.10, 0.32, u_param);
  vec2 cell = fract(rot2(g, ang) * F) - 0.5;
  float r = sqrt(clamp(tone, 0.0, 1.0)) * 0.62;
  return smoothstep(r - 0.05, r + 0.05, length(cell));
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 g = gl_FragCoord.xy;
  ${body}
  gl_FragColor = vec4(outc, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('mono'), { info: info, param: 0.45 }));
    function set(m, msg) { toy.setFrag(buildFrag(m)); info.textContent = msg; }

    document.getElementById('btnHtMono')?.addEventListener('click', () =>
        set('mono', 'Mono screen — one rotated dot grid, bigger dots in shadow.'));
    document.getElementById('btnHtCmyk')?.addEventListener('click', () =>
        set('cmyk', 'CMYK-style — a screen per channel at its own angle (Ben-Day).'));
    document.getElementById('btnHtCoarse')?.addEventListener('click', () => {
        toy.setParam(0.95); info.textContent = 'Coarser screen — newsprint dots.';
    });
    document.getElementById('btnHtFine')?.addEventListener('click', () => {
        toy.setParam(0.15); info.textContent = 'Fine screen — magazine print.';
    });
})();

// =============================================================================
// DEMO 5 — kuwaharaGL  (§ Kuwahara Oil Paint)
// Four overlapping quadrants; keep the mean of the lowest-variance one →
// edge-preserving painterly flattening. Window K is structural → setFrag.
// =============================================================================
(function kuwaharaShader() {
    const canvas = document.getElementById('kuwaharaGL');
    if (!canvas) return;
    const info = document.getElementById('kuwaharaGLInfo');

    function buildFrag(k) {
        return NPR_HEAD + NPR_SCENE + `const int K = ${k};
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
}`;
    }

    const state = { k: 3 };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state.k), { info: info }));
    function set(k, msg) { state.k = k; toy.setFrag(buildFrag(k)); info.textContent = msg; }

    document.getElementById('btnKuwOff')?.addEventListener('click', () =>
        set(0, 'Off — K=0 is a 1×1 window: the raw scene.'));
    document.getElementById('btnKuwSmall')?.addEventListener('click', () =>
        set(2, 'K=2 — subtle palette-knife smoothing, edges intact.'));
    document.getElementById('btnKuwBig')?.addEventListener('click', () =>
        set(4, 'K=4 — heavy oil-paint flattening (more taps → slower).'));
})();

// =============================================================================
// DEMO 6 — asciiGL  (§ ASCII / Dither Art)
// Downsample to a cell grid; ASCII draws brightness-keyed strokes, dither
// applies an interleaved-gradient 1-bit threshold. Cell size is structural.
// =============================================================================
(function asciiShader() {
    const canvas = document.getElementById('asciiGL');
    if (!canvas) return;
    const info = document.getElementById('asciiGLInfo');

    function buildFrag(mode, cells) {
        const body = mode === 'dither'
            ? `float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float bw = step(ign, lum(scene(uv)));
  vec3 outc = mix(vec3(0.05,0.06,0.09), vec3(0.93,0.94,0.90), bw);`
            : `vec2 g = uv * vec2(${cells}.0);
  vec2 id = floor(g), f = fract(g);
  vec3 cc = scene((id + 0.5) / vec2(${cells}.0));
  float L = lum(cc);
  float lvl = floor(L * 5.0);
  float bars = (lvl < 0.5) ? 0.0
    : step(0.5, fract(f.y * lvl + 0.25)) * step(0.12, f.x) * step(f.x, 0.88);
  vec3 outc = mix(vec3(0.03, 0.05, 0.07), vec3(0.40, 0.95, 0.55), bars);`;
        return NPR_HEAD + NPR_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  ${body}
  gl_FragColor = vec4(outc, 1.0);
}`;
    }

    const state = { mode: 'ascii', cells: 70 };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('ascii', 70), { info: info }));
    function refresh(msg) { toy.setFrag(buildFrag(state.mode, state.cells)); info.textContent = msg; }

    document.getElementById('btnAsciiAscii')?.addEventListener('click', () => {
        state.mode = 'ascii'; refresh('ASCII — one luminance sample per cell → terminal glyphs.');
    });
    document.getElementById('btnAsciiDither')?.addEventListener('click', () => {
        state.mode = 'dither'; refresh('Dither — interleaved-gradient-noise 1-bit threshold.');
    });
    document.getElementById('btnAsciiCell')?.addEventListener('click', () => {
        state.cells = state.cells >= 110 ? 44 : state.cells + 22;
        refresh('Cell grid ' + state.cells + ' across — a shader constant, so we rebuild.');
    });
})();

// =============================================================================
// DEMO 7 — nprStackGL  (§ Mini-Project: Stylization Stack)
// One scene, switchable NPR pipeline — the capstone. State-built (the chosen
// stylizer is structural, so every switch rebuilds the shader).
// =============================================================================
(function nprStack() {
    const canvas = document.getElementById('nprStackGL');
    if (!canvas) return;
    const info = document.getElementById('nprStackGLInfo');

    const STYLE = {
        toonink: `float L=lum(scene(uv)); float q=floor(L*4.0)/3.0;
  vec3 outc=clamp((scene(uv)/max(L,1e-3))*q,0.0,1.0);
  vec2 pp=1.0/u_resolution;
  float gx=lum(scene(uv+vec2(pp.x,0.)))-lum(scene(uv-vec2(pp.x,0.)));
  float gy=lum(scene(uv+vec2(0.,pp.y)))-lum(scene(uv-vec2(0.,pp.y)));
  outc=mix(outc,vec3(0.04),step(0.085,length(vec2(gx,gy))));`,
        hatch: `float L=lum(scene(uv)); vec2 g=gl_FragCoord.xy; float F=0.12; float k=1.0;
  if(L<0.85)k=min(k,step(0.5,fract((g.x+g.y)*F)));
  if(L<0.55)k=min(k,step(0.5,fract((g.x-g.y)*F)));
  if(L<0.30)k=min(k,step(0.5,fract(g.x*F*1.5)));
  vec3 outc=mix(vec3(0.07,0.06,0.10),vec3(0.97,0.96,0.92),k);`,
        halftone: `vec2 g=gl_FragCoord.xy; float a=0.4;
  mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
  vec2 cell=fract(R*g*0.22)-0.5;
  float r=sqrt(clamp(lum(scene(uv)),0.0,1.0))*0.62;
  float v=smoothstep(r-0.05,r+0.05,length(cell));
  vec3 outc=mix(vec3(0.06,0.05,0.08),vec3(0.97,0.96,0.92),v);`,
        oil: `vec2 px=1.5/u_resolution; vec3 bm=scene(uv); float bv=1e9;
  for(int q=0;q<4;q++){
    vec2 d=q==0?vec2(1,1):q==1?vec2(-1,1):q==2?vec2(1,-1):vec2(-1,-1);
    vec3 s=vec3(0.0),s2=vec3(0.0);
    for(int j=0;j<=3;j++)for(int i=0;i<=3;i++){
      vec3 c=scene(uv+d*vec2(float(i),float(j))*px); s+=c; s2+=c*c; }
    vec3 m=s/16.0; vec3 vv=s2/16.0-m*m; float vr=vv.r+vv.g+vv.b;
    if(vr<bv){bv=vr; bm=m;} }
  vec3 outc=bm;`,
        ascii: `vec2 g=uv*vec2(80.0); vec2 id=floor(g),f=fract(g);
  float L=lum(scene((id+0.5)/vec2(80.0))); float lvl=floor(L*5.0);
  float bars=(lvl<0.5)?0.0:step(0.5,fract(f.y*lvl+0.25))*step(0.12,f.x)*step(f.x,0.88);
  vec3 outc=mix(vec3(0.03,0.05,0.07),vec3(0.40,0.95,0.55),bars);`
    };

    function buildFrag(style) {
        return NPR_HEAD + NPR_SCENE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  ${STYLE[style]}
  gl_FragColor = vec4(outc, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('toonink'), { info: info }));
    function set(s, msg) { toy.setFrag(buildFrag(s)); info.textContent = msg; }

    document.getElementById('btnNprToon')?.addEventListener('click', () =>
        set('toonink', 'Toon + ink — the cartoon pipeline.'));
    document.getElementById('btnNprHatch')?.addEventListener('click', () =>
        set('hatch', 'Hatch — the pencil-sketch pipeline.'));
    document.getElementById('btnNprHalf')?.addEventListener('click', () =>
        set('halftone', 'Halftone — the comic-print pipeline.'));
    document.getElementById('btnNprOil')?.addEventListener('click', () =>
        set('oil', 'Oil — the painterly Kuwahara pipeline.'));
    document.getElementById('btnNprAscii')?.addEventListener('click', () =>
        set('ascii', 'ASCII — the terminal-art pipeline.'));
})();
