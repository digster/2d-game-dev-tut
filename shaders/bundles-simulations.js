// =============================================================================
// SHADERS TRACK — SIMULATIONS TIER EXPORT BUNDLES  (FINAL TIER)
// =============================================================================
// Feeds shared/export-demo.js. WebGL2-only GPU sims (persistent float-texture
// ping-pong). 6 demos, single API (no GL1/GL2 pairing).
//
// ── Self-contained per tier ──────────────────────────────────────────────────
// `sh_compileShader`/`sh_createProgram` verbatim, context-agnostic.
// `sh_simKit` = shared GLSL consts (every shader starts with `#version 300 es`
// as its literal first line). `sh_makeSim` = the persistent double-buffer
// runner (own webgl2 ctx + RGBA16F FBOs + EXT_color_buffer_float guard +
// seed/step(N substeps)/display + optional gl.POINTS particle display). The
// page twin (simulations-demos.js) also defines `makeSim`; only one loads per
// export — same page-vs-bundle precedent as earlier tiers.
//
// ── GLSL-as-template-literal convention ──────────────────────────────────────
// DEMO_CODE.sh_* is a JS template literal; GLSL inside is a nested template
// literal → only its delimiter backticks are escaped (\`). Reaction-diffusion
// & the playground interpolate JS constants into the step shader, escaped as
// \${...} (iso precedent). JS escapes that must survive (split('\\n'),
// 'failed:\\n') stay double-escaped. Verify exports by running them.
//
// ── Canvas-ID convention ─────────────────────────────────────────────────────
// Generator hardcodes `<canvas id="canvas">`/`<div id="info">`; DEMO_CODE
// retargets to those. Button ids are the clean page ids (one demo per export).
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

DEPENDENCY_BUNDLES.sh_simKit = `const SIM_VERT = \`#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }\`;
const SIM_HEAD = \`#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_resolution;
uniform float u_time;
uniform int u_frame;
uniform vec2 u_mouse;
uniform float u_mouseDown;
uniform float u_param;
out vec4 outColor;
\`;
const DISP_HEAD = \`#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
out vec4 outColor;
\`;
const POINT_VERT = \`#version 300 es
uniform sampler2D u_state;
out float v_spd;
void main() {
  int W = textureSize(u_state, 0).x;
  ivec2 t = ivec2(gl_VertexID % W, gl_VertexID / W);
  vec4 s = texelFetch(u_state, t, 0);
  v_spd = length(s.zw);
  gl_Position = vec4(s.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 2.0;
}\`;
const POINT_FRAG = \`#version 300 es
precision highp float;
in float v_spd;
out vec4 outColor;
void main() {
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  vec3 c = mix(vec3(0.25, 0.5, 1.0), vec3(1.0, 0.85, 0.35), clamp(v_spd * 35.0, 0.0, 1.0));
  outColor = vec4(c * a, a);
}\`;
const SIM_LIB = \`vec4 cell(ivec2 o) {
  ivec2 p = clamp(ivec2(gl_FragCoord.xy) + o, ivec2(0), textureSize(u_state, 0) - 1);
  return texelFetch(u_state, p, 0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
\`;`;

DEPENDENCY_BUNDLES.sh_makeSim = `function makeSim(canvas, spec, opts) {
    opts = opts || {};
    const info = opts.info || null;
    let uParam = opts.param != null ? opts.param : 0;
    let paused = !!opts.paused;
    function fail(m) {
        console.error(m);
        if (info) { info.textContent = m; info.style.color = '#ff7b72'; }
        const c2d = canvas.getContext('2d');
        if (c2d) {
            c2d.fillStyle = '#3a0d12'; c2d.fillRect(0, 0, canvas.width, canvas.height);
            c2d.fillStyle = '#ff7b72'; c2d.font = '13px monospace';
            String(m).split('\\n').forEach((l, i) => c2d.fillText(l.slice(0, 92), 12, 24 + i * 18));
        }
    }
    const noop = { stop() {}, reset() {}, setParam() {}, setPaused() {}, rebuild() {} };
    const gl = canvas.getContext('webgl2');
    if (!gl) { fail('WebGL2 is not available in this browser/context.'); return noop; }
    if (!gl.getExtension('EXT_color_buffer_float')) {
        fail("This browser can't render to float textures (EXT_color_buffer_float missing).");
        return noop;
    }
    const SW = spec.stateW || canvas.width;
    const SH = spec.stateH || canvas.height;
    const substeps = spec.substeps || 1;
    const ptCount = spec.points ? spec.points.count : 0;
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    function rt() {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SW, SH, 0, gl.RGBA, gl.HALF_FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { f, t, ok };
    }
    let A, B, seedProg, stepProg, dispProg, pointProg = null;
    function buildAll(s) {
        try {
            const sp = createShaderProgram(gl, SIM_VERT, s.seed);
            const tp = createShaderProgram(gl, SIM_VERT, s.step);
            const dp = createShaderProgram(gl, SIM_VERT, s.display);
            const pp = s.points ? createShaderProgram(gl, s.points.vert, s.points.frag) : null;
            if (seedProg) { gl.deleteProgram(seedProg); gl.deleteProgram(stepProg); gl.deleteProgram(dispProg); if (pointProg) gl.deleteProgram(pointProg); }
            seedProg = sp; stepProg = tp; dispProg = dp; pointProg = pp;
            if (!A) { A = rt(); B = rt(); }
            if (!(A.ok && B.ok)) throw new Error('Float framebuffer incomplete');
            if (info) info.style.color = '';
            return true;
        } catch (e) { fail(e && e.message ? e.message : String(e)); return false; }
    }
    if (!buildAll(spec)) return noop;
    const mouse = { x: 0.5, y: 0.5, down: 0 };
    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / r.width;
        mouse.y = 1.0 - (e.clientY - r.top) / r.height;
    });
    canvas.addEventListener('mousedown', () => { mouse.down = 1; });
    window.addEventListener('mouseup', () => { mouse.down = 0; });
    canvas.addEventListener('mouseleave', () => { mouse.down = 0; });
    let frameN = 0, tNow = 0;
    function bindQuad(prog) {
        const l = gl.getAttribLocation(prog, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    }
    function setCommon(prog, w, h) {
        const ur = gl.getUniformLocation(prog, 'u_resolution'); if (ur) gl.uniform2f(ur, w, h);
        const ut = gl.getUniformLocation(prog, 'u_time'); if (ut) gl.uniform1f(ut, tNow);
        const uf = gl.getUniformLocation(prog, 'u_frame'); if (uf) gl.uniform1i(uf, frameN);
        const um = gl.getUniformLocation(prog, 'u_mouse'); if (um) gl.uniform2f(um, mouse.x, mouse.y);
        const ud = gl.getUniformLocation(prog, 'u_mouseDown'); if (ud) gl.uniform1f(ud, mouse.down);
        const up = gl.getUniformLocation(prog, 'u_param'); if (up) gl.uniform1f(up, uParam);
        const us = gl.getUniformLocation(prog, 'u_state'); if (us) gl.uniform1i(us, 0);
    }
    function passQ(prog, srcTex, dstFB, w, h) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dstFB);
        gl.viewport(0, 0, w, h);
        gl.useProgram(prog); bindQuad(prog);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
        setCommon(prog, w, h);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function seed() {
        passQ(seedProg, A.t, A.f, SW, SH);
        passQ(seedProg, A.t, B.f, SW, SH);
        frameN = 0;
    }
    seed();
    let cur = A, nxt = B, raf = 0, last = performance.now();
    function frame(now) {
        if (!paused) tNow += (now - last) * 0.001;
        last = now;
        for (let k = 0; k < substeps; k++) {
            passQ(stepProg, cur.t, nxt.f, SW, SH);
            const tmp = cur; cur = nxt; nxt = tmp;
            frameN++;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (pointProg) {
            gl.clearColor(0.02, 0.03, 0.06, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            gl.useProgram(pointProg);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.t);
            const us = gl.getUniformLocation(pointProg, 'u_state'); if (us) gl.uniform1i(us, 0);
            gl.drawArrays(gl.POINTS, 0, ptCount);
            gl.disable(gl.BLEND);
        } else {
            gl.useProgram(dispProg); bindQuad(dispProg);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cur.t);
            setCommon(dispProg, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        raf = requestAnimationFrame(frame);
    }
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
    raf = requestAnimationFrame(frame);
    return {
        stop() { cancelAnimationFrame(raf); },
        reset() { cur = A; nxt = B; seed(); },
        setParam(v) { uParam = v; },
        setPaused(b) { paused = b; if (!b) last = performance.now(); },
        rebuild(s) { spec = s; if (buildAll(s)) { cur = A; nxt = B; seed(); } }
    };
}`;

// TS variants — plain enough that the JS form is valid TS (Sucrase only strips
// types). Provide explicit copies so the TS export never per-entry-falls-back.
DEPENDENCY_BUNDLES_TS.sh_compileShader = DEPENDENCY_BUNDLES.sh_compileShader;
DEPENDENCY_BUNDLES_TS.sh_createProgram = DEPENDENCY_BUNDLES.sh_createProgram;
DEPENDENCY_BUNDLES_TS.sh_simKit = DEPENDENCY_BUNDLES.sh_simKit;
DEPENDENCY_BUNDLES_TS.sh_makeSim = DEPENDENCY_BUNDLES.sh_makeSim;

const SDEPS = 'sh_compileShader,sh_createProgram,sh_simKit,sh_makeSim';

// =============================================================================
// DEMOS — 6, WebGL2-only. (data-deps for each, in advanced... simulations.html:
//   sh_compileShader,sh_createProgram,sh_simKit,sh_makeSim )
// =============================================================================

DEMO_HTML.sh_simLoop = {
    title: 'Shaders — State in a Texture (the sim loop)',
    canvas: { width: 800, height: 450 }, controls: [],
    info: 'A buffer that reads itself each frame. Drag to splat.'
};
DEMO_CODE.sh_simLoop = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    makeSim(canvas, {
        seed: SIM_HEAD + \`void main() { outColor = vec4(0.0); }\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float v = cell(ivec2(0)).r * 0.985;
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.03) v = 1.0;
  outColor = vec4(v, 0.0, 0.0, 1.0);
}\`,
        display: DISP_HEAD + \`void main() {
  float v = texture(u_state, gl_FragCoord.xy / u_resolution).r;
  outColor = vec4(mix(vec3(0.03,0.04,0.08), vec3(1.0,0.6,0.15), v), 1.0);
}\`
    }, { info: info });
})();`;
DEMO_CODE_TS.sh_simLoop = DEMO_CODE.sh_simLoop;

DEMO_HTML.sh_life = {
    title: "Shaders — Conway's Game of Life",
    canvas: { width: 800, height: 450 },
    controls: [{ id: 'btnLifeReseed', text: 'Reseed' }],
    info: 'Cellular automata on the GPU. Drag to draw cells.'
};
DEMO_CODE.sh_life = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var sim = makeSim(canvas, {
        seed: SIM_HEAD + SIM_LIB + \`void main() {
  outColor = vec4(step(0.7, hash(gl_FragCoord.xy + 0.123)), 0.0, 0.0, 1.0);
}\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  float a = cell(ivec2(0)).r;
  float n = cell(ivec2(-1,-1)).r + cell(ivec2(0,-1)).r + cell(ivec2(1,-1)).r
          + cell(ivec2(-1, 0)).r                       + cell(ivec2(1, 0)).r
          + cell(ivec2(-1, 1)).r + cell(ivec2(0, 1)).r + cell(ivec2(1, 1)).r;
  float alive = (n == 3.0 || (a > 0.5 && n == 2.0)) ? 1.0 : 0.0;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.02) alive = 1.0;
  outColor = vec4(alive, 0.0, 0.0, 1.0);
}\`,
        display: DISP_HEAD + \`void main() {
  float a = texture(u_state, gl_FragCoord.xy / u_resolution).r;
  outColor = vec4(mix(vec3(0.04,0.05,0.09), vec3(0.4,1.0,0.55), a), 1.0);
}\`
    }, { info: info });
    document.getElementById('btnLifeReseed') && document.getElementById('btnLifeReseed').addEventListener('click', function () {
        sim.reset(); info.textContent = 'Reseeded — random soup. Drag to draw cells.';
    });
})();`;
DEMO_CODE_TS.sh_life = DEMO_CODE.sh_life;

DEMO_HTML.sh_reaction = {
    title: 'Shaders — Reaction-Diffusion (Gray-Scott)',
    canvas: { width: 800, height: 450 },
    controls: [{ id: 'btnRDcoral', text: 'Coral' }, { id: 'btnRDmitosis', text: 'Mitosis' }, { id: 'btnRDworms', text: 'Worms' }],
    info: 'Two chemicals, a Laplacian, feed/kill. Why float matters.'
};
DEMO_CODE.sh_reaction = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var P = { coral:{f:'0.0545',k:'0.062'}, mitosis:{f:'0.0367',k:'0.0649'}, worms:{f:'0.078',k:'0.061'} };
    function spec(p) {
        return {
            substeps: 12,
            seed: SIM_HEAD + SIM_LIB + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float b = (distance(uv, vec2(0.5)) < 0.03) ? 1.0 : 0.0;
  outColor = vec4(1.0, b, 0.0, 1.0);
}\`,
            step: SIM_HEAD + SIM_LIB + \`const float Da = 1.0, Db = 0.5, dt = 1.0;
const float feed = \${p.f}, kill = \${p.k};
void main() {
  vec2 s = cell(ivec2(0)).rg;
  vec2 lap = cell(ivec2(1,0)).rg + cell(ivec2(-1,0)).rg
           + cell(ivec2(0,1)).rg + cell(ivec2(0,-1)).rg
           + 0.5*(cell(ivec2(1,1)).rg + cell(ivec2(-1,1)).rg
                + cell(ivec2(1,-1)).rg + cell(ivec2(-1,-1)).rg)
           - 6.0 * s;
  float A = s.r, Bc = s.g, r = A*Bc*Bc;
  float nA = A + (Da*lap.r - r + feed*(1.0-A)) * dt;
  float nB = Bc + (Db*lap.g + r - (feed+kill)*Bc) * dt;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.02) nB = 1.0;
  outColor = vec4(clamp(nA,0.0,1.0), clamp(nB,0.0,1.0), 0.0, 1.0);
}\`,
            display: DISP_HEAD + \`void main() {
  float b = texture(u_state, gl_FragCoord.xy / u_resolution).g;
  vec3 c = mix(vec3(0.02,0.05,0.12), vec3(0.2,0.9,0.85), smoothstep(0.0,0.4,b));
  c = mix(c, vec3(1.0,0.95,0.7), smoothstep(0.4,0.6,b));
  outColor = vec4(c, 1.0);
}\`
        };
    }
    var sim = makeSim(canvas, spec(P.coral), { info: info });
    ['coral','mitosis','worms'].forEach(function (n) {
        var b = document.getElementById('btnRD' + n);
        if (b) b.addEventListener('click', function () {
            sim.rebuild(spec(P[n]));
            info.textContent = n + ' (feed=' + P[n].f + ', kill=' + P[n].k + ') — drag to seed.';
        });
    });
})();`;
DEMO_CODE_TS.sh_reaction = DEMO_CODE.sh_reaction;

DEMO_HTML.sh_particles = {
    title: 'Shaders — GPU Particles (state in a texture)',
    canvas: { width: 800, height: 450 }, controls: [],
    info: '65k particles; the texture IS the particle buffer. Drag to attract.'
};
DEMO_CODE.sh_particles = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var N = 256;
    makeSim(canvas, {
        stateW: N, stateH: N, points: { vert: POINT_VERT, frag: POINT_FRAG, count: N * N },
        seed: SIM_HEAD + SIM_LIB + \`void main() {
  vec2 t = gl_FragCoord.xy;
  outColor = vec4(hash(t), hash(t + 7.0), 0.0, 0.0);
}\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  vec4 s = cell(ivec2(0));
  vec2 p = s.xy, v = s.zw;
  float a = (hash(floor(p * 8.0)) - 0.5) * 6.2831;
  v += vec2(cos(a), sin(a)) * 0.0008;
  v += vec2(0.0, -0.0006);
  if (u_mouseDown > 0.5) v += normalize(u_mouse - p + 1e-4) * 0.0015;
  v *= 0.97;
  p += v;
  if (p.x < 0.0 || p.x > 1.0) { v.x *= -0.6; p.x = clamp(p.x, 0.0, 1.0); }
  if (p.y < 0.0) { v.y *= -0.4; p.y = 0.0; }
  if (p.y > 1.0) { v.y *= -0.4; p.y = 1.0; }
  outColor = vec4(p, v);
}\`,
        display: DISP_HEAD + \`void main() { outColor = vec4(0.0); }\`
    }, { info: info });
})();`;
DEMO_CODE_TS.sh_particles = DEMO_CODE.sh_particles;

DEMO_HTML.sh_fluid = {
    title: 'Shaders — 2D Fluid / Ink',
    canvas: { width: 800, height: 450 }, controls: [],
    info: 'Advect velocity + dye, mouse adds force. Drag to stir.'
};
DEMO_CODE.sh_fluid = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    makeSim(canvas, {
        substeps: 2,
        seed: SIM_HEAD + \`void main() { outColor = vec4(0.0); }\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 s = cell(ivec2(0));
  vec2 vel = s.xy;
  vec2 back = uv - vel * 0.012;
  vec4 a = texture(u_state, back);
  vel = a.xy * 0.998;
  vec2 dye = a.zw * 0.99;
  float md = distance(uv, u_mouse);
  if (u_mouseDown > 0.5 && md < 0.07) {
    vel += normalize(uv - u_mouse + 1e-4) * (0.07 - md) * 2.2;
    dye += vec2(0.6, 1.0) * (0.07 - md) * 6.0;
  }
  outColor = vec4(clamp(vel, -3.0, 3.0), clamp(dye, 0.0, 4.0));
}\`,
        display: DISP_HEAD + \`void main() {
  vec2 d = texture(u_state, gl_FragCoord.xy / u_resolution).zw;
  vec3 c = vec3(0.02,0.03,0.06) + vec3(0.2,0.6,1.0)*d.x + vec3(1.0,0.5,0.2)*d.y;
  outColor = vec4(c, 1.0);
}\`
    }, { info: info });
})();`;
DEMO_CODE_TS.sh_fluid = DEMO_CODE.sh_fluid;

DEMO_HTML.sh_playground = {
    title: 'Shaders — Mini-Project: Interactive Fluid Playground',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnPgaqua', text: 'Aqua' }, { id: 'btnPgfire', text: 'Fire' }, { id: 'btnPgtoxic', text: 'Toxic' },
        { id: 'btnPgThick', text: 'Viscous' }, { id: 'btnPgThin', text: 'Thin' }, { id: 'btnPgClear', text: 'Clear' }
    ],
    info: 'Fluid + controls. Drag to stir.'
};
DEMO_CODE.sh_playground = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var DYES = { aqua:'vec2(0.7, 1.0)', fire:'vec2(1.0, 0.25)', toxic:'vec2(0.3, 0.9)' };
    var seed = SIM_HEAD + \`void main() { outColor = vec4(0.0); }\`;
    var disp = DISP_HEAD + \`void main() {
  vec2 d = texture(u_state, gl_FragCoord.xy / u_resolution).zw;
  vec3 c = vec3(0.02,0.03,0.06) + vec3(0.2,0.6,1.0)*d.x + vec3(1.0,0.5,0.2)*d.y;
  outColor = vec4(c, 1.0);
}\`;
    function stepFor(dye) {
        return SIM_HEAD + SIM_LIB + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 s = cell(ivec2(0));
  vec2 vel = s.xy;
  vec2 back = uv - vel * 0.012;
  vec4 a = texture(u_state, back);
  vel = a.xy * (0.990 + u_param * 0.009);
  vec2 d = a.zw * 0.99;
  float md = distance(uv, u_mouse);
  if (u_mouseDown > 0.5 && md < 0.07) {
    vel += normalize(uv - u_mouse + 1e-4) * (0.07 - md) * 2.4;
    d += \${dye} * (0.07 - md) * 6.0;
  }
  outColor = vec4(clamp(vel,-3.0,3.0), clamp(d,0.0,4.0));
}\`;
    }
    var sim = makeSim(canvas, { substeps: 2, seed: seed, step: stepFor(DYES.aqua), display: disp }, { info: info, param: 0.5 });
    ['aqua','fire','toxic'].forEach(function (n) {
        var b = document.getElementById('btnPg' + n);
        if (b) b.addEventListener('click', function () {
            sim.rebuild({ substeps: 2, seed: seed, step: stepFor(DYES[n]), display: disp });
            info.textContent = n + ' dye — drag to stir.';
        });
    });
    document.getElementById('btnPgThick') && document.getElementById('btnPgThick').addEventListener('click', function () { sim.setParam(1.0); info.textContent = 'Viscous (slow to settle).'; });
    document.getElementById('btnPgThin') && document.getElementById('btnPgThin').addEventListener('click', function () { sim.setParam(0.0); info.textContent = 'Thin (dissipates fast).'; });
    document.getElementById('btnPgClear') && document.getElementById('btnPgClear').addEventListener('click', function () { sim.reset(); info.textContent = 'Cleared. Drag to stir.'; });
})();`;
DEMO_CODE_TS.sh_playground = DEMO_CODE.sh_playground;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.sh_createProgram = ['sh_compileShader'];
DEPENDENCY_REQUIRES.sh_makeSim = ['sh_compileShader', 'sh_createProgram'];
