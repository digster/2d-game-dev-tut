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

DEMO_HTML.sh_sand = {
    title: 'Shaders — Falling Sand (Margolus CA)',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnSandSand', text: 'Paint sand' }, { id: 'btnSandWall', text: 'Paint wall' },
        { id: 'btnSandClear', text: 'Clear' }, { id: 'btnSandPause', text: 'Pause' }
    ],
    info: 'Drag to pour sand. Conservative Margolus gravity.'
};
DEMO_CODE.sh_sand = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var sim = makeSim(canvas, {
        seed: SIM_HEAD + \`void main() { outColor = vec4(0.0); }\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  float me = cell(ivec2(0)).r;
  int y = int(gl_FragCoord.y);
  bool top = ((y + (u_frame & 1)) & 1) == 1;
  float ot = cell(top ? ivec2(0, -1) : ivec2(0, 1)).r;
  float res = me;
  if (me < 1.5 && ot < 1.5) {
    if (top  && me == 1.0 && ot == 0.0) res = 0.0;
    if (!top && me == 0.0 && ot == 1.0) res = 1.0;
  }
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.03)
    res = (u_param > 1.5) ? 2.0 : 1.0;
  outColor = vec4(res, 0.0, 0.0, 1.0);
}\`,
        display: DISP_HEAD + \`void main() {
  float m = texture(u_state, gl_FragCoord.xy / u_resolution).r;
  vec3 c = vec3(0.03, 0.04, 0.07);
  c = mix(c, vec3(0.85, 0.68, 0.34), step(0.5, m) * step(m, 1.5));
  c = mix(c, vec3(0.45, 0.47, 0.55), step(1.5, m));
  outColor = vec4(c, 1.0);
}\`
    }, { info: info, param: 1.0 });
    var paused = false;
    document.getElementById('btnSandSand') && document.getElementById('btnSandSand').addEventListener('click', function () {
        sim.setParam(1.0); info.textContent = 'Painting SAND — drag on the canvas to pour.';
    });
    document.getElementById('btnSandWall') && document.getElementById('btnSandWall').addEventListener('click', function () {
        sim.setParam(2.0); info.textContent = 'Painting WALL — build ledges for the sand.';
    });
    document.getElementById('btnSandClear') && document.getElementById('btnSandClear').addEventListener('click', function () {
        sim.reset(); info.textContent = 'Cleared. Drag to pour sand again.';
    });
    document.getElementById('btnSandPause') && document.getElementById('btnSandPause').addEventListener('click', function () {
        paused = !paused; sim.setPaused(paused);
        info.textContent = paused ? 'Paused.' : 'Running — conservative Margolus gravity.';
    });
})();`;
DEMO_CODE_TS.sh_sand = DEMO_CODE.sh_sand;

DEMO_HTML.sh_boids = {
    title: 'Shaders — Boids / Flocking',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnBoidLoose', text: 'Loose' }, { id: 'btnBoidTight', text: 'Tight' },
        { id: 'btnBoidScatter', text: 'Scatter' }, { id: 'btnBoidReset', text: 'Reset' }
    ],
    info: '9,216 boids, 16 samples each. Drag to herd them.'
};
DEMO_CODE.sh_boids = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var N = 96;
    var sim = makeSim(canvas, {
        stateW: N, stateH: N,
        points: { vert: POINT_VERT, frag: POINT_FRAG, count: N * N },
        seed: SIM_HEAD + SIM_LIB + \`void main() {
  vec2 t = gl_FragCoord.xy;
  outColor = vec4(hash(t), hash(t + 19.0),
                  (hash(t + 3.0) - 0.5) * 0.01, (hash(t + 7.0) - 0.5) * 0.01);
}\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  vec4 s = cell(ivec2(0));
  vec2 p = s.xy, v = s.zw;
  vec2 sep = vec2(0.0), ali = vec2(0.0), coh = vec2(0.0);
  float cnt = 0.0;
  ivec2 sz = textureSize(u_state, 0);
  for (int i = 0; i < 16; i++) {
    vec2 rnd = vec2(
      hash(gl_FragCoord.xy + float(i) * 1.7 + float(u_frame) * 0.013),
      hash(gl_FragCoord.xy - float(i) * 3.1 + float(u_frame) * 0.017));
    vec4 o = texelFetch(u_state, ivec2(rnd * vec2(sz)), 0);
    vec2 d = o.xy - p;
    float dist = length(d) + 1e-5;
    if (dist < 0.10) {
      coh += o.xy; ali += o.zw; cnt += 1.0;
      if (dist < 0.03) sep -= d / dist * (0.03 - dist);
    }
  }
  if (cnt > 0.0) { coh = coh / cnt - p; ali = ali / cnt; }
  v += sep * 0.6 + ali * 0.05 + coh * 0.02 * u_param;
  if (u_mouseDown > 0.5) v += normalize(u_mouse - p + 1e-4) * 0.0010;
  v += (vec2(hash(p + float(u_frame) * 0.01),
             hash(p + 5.0 + float(u_frame) * 0.01)) - 0.5) * 0.0006;
  float sp = length(v) + 1e-6;
  v = v / sp * clamp(sp, 0.0025, 0.011);
  p = fract(p + v + 1.0);
  outColor = vec4(p, v);
}\`,
        display: DISP_HEAD + \`void main() { outColor = vec4(0.0); }\`
    }, { info: info, param: 1.0 });
    document.getElementById('btnBoidLoose') && document.getElementById('btnBoidLoose').addEventListener('click', function () {
        sim.setParam(1.0); info.textContent = 'Loose flock — light cohesion.';
    });
    document.getElementById('btnBoidTight') && document.getElementById('btnBoidTight').addEventListener('click', function () {
        sim.setParam(2.6); info.textContent = 'Tight flock — strong cohesion, dense swirls.';
    });
    document.getElementById('btnBoidScatter') && document.getElementById('btnBoidScatter').addEventListener('click', function () {
        sim.setParam(-1.5); info.textContent = 'Scatter — negative cohesion pushes them apart.';
    });
    document.getElementById('btnBoidReset') && document.getElementById('btnBoidReset').addEventListener('click', function () {
        sim.reset(); info.textContent = 'Reset — fresh random swarm.';
    });
})();`;
DEMO_CODE_TS.sh_boids = DEMO_CODE.sh_boids;

DEMO_HTML.sh_wave = {
    title: 'Shaders — Wave Propagation',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnWaveSlow', text: 'Slow' }, { id: 'btnWaveFast', text: 'Fast' },
        { id: 'btnWaveReset', text: 'Reset' }, { id: 'btnWavePause', text: 'Pause' }
    ],
    info: 'Click / drag to make waves. Watch them interfere & reflect.'
};
DEMO_CODE.sh_wave = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var sim = makeSim(canvas, {
        substeps: 2,
        seed: SIM_HEAD + \`void main() { outColor = vec4(0.0); }\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  vec2 s = cell(ivec2(0)).rg;
  float lap = cell(ivec2(1, 0)).r + cell(ivec2(-1, 0)).r
            + cell(ivec2(0, 1)).r + cell(ivec2(0, -1)).r - 4.0 * s.r;
  float vel = (s.g + (0.18 + 0.06 * u_param) * lap) * 0.999;
  float h = s.r + vel;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.02) h += 0.6;
  outColor = vec4(h * 0.9995, vel, 0.0, 1.0);
}\`,
        display: DISP_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 px = 1.0 / u_resolution;
  float h  = texture(u_state, uv).r;
  float hx = texture(u_state, uv + vec2(px.x, 0.0)).r - h;
  float hy = texture(u_state, uv + vec2(0.0, px.y)).r - h;
  vec3 n = normalize(vec3(-hx * 6.0, -hy * 6.0, 1.0));
  float light = clamp(dot(n, normalize(vec3(0.4, 0.5, 1.0))), 0.0, 1.0);
  vec3 col = mix(vec3(0.02, 0.06, 0.16), vec3(0.40, 0.78, 1.0), 0.5 + 0.5 * h);
  outColor = vec4(col * (0.35 + 0.85 * light), 1.0);
}\`
    }, { info: info, param: 1.0 });
    var paused = false;
    document.getElementById('btnWaveSlow') && document.getElementById('btnWaveSlow').addEventListener('click', function () {
        sim.setParam(0.0); info.textContent = 'Slow waves — lower propagation speed.';
    });
    document.getElementById('btnWaveFast') && document.getElementById('btnWaveFast').addEventListener('click', function () {
        sim.setParam(2.0); info.textContent = 'Fast waves — higher speed (still CFL-stable).';
    });
    document.getElementById('btnWaveReset') && document.getElementById('btnWaveReset').addEventListener('click', function () {
        sim.reset(); info.textContent = 'Calm surface. Click / drag to make waves.';
    });
    document.getElementById('btnWavePause') && document.getElementById('btnWavePause').addEventListener('click', function () {
        paused = !paused; sim.setPaused(paused);
        info.textContent = paused ? 'Paused — the field is frozen.' : 'Running.';
    });
})();`;
DEMO_CODE_TS.sh_wave = DEMO_CODE.sh_wave;

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
// 5d — sh_smokeGL  (Smoke: semi-Lagrangian advection + buoyancy)
// =============================================================================
DEMO_HTML.sh_smokeGL = {
    title: 'Shaders — Smoke (semi-Lagrangian fluid)',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnSmokeCalm', text: 'Calm' }, { id: 'btnSmokeWild', text: 'Wild' },
        { id: 'btnSmokeClear', text: 'Clear' }, { id: 'btnSmokePause', text: 'Pause' }
    ],
    info: 'A bottom emitter feeds a rising plume. Drag to puff hot smoke.'
};
DEMO_CODE.sh_smokeGL = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var sim = makeSim(canvas, {
        substeps: 2,
        seed: SIM_HEAD + \`void main() { outColor = vec4(0.0); }\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 s = cell(ivec2(0));
  vec2 vel = s.xy;
  vec2 back = uv - vel * 0.010;
  vec4 a = texture(u_state, back);
  vel = a.xy * 0.996;
  float dens = a.z * 0.990;
  float temp = a.w * 0.984;
  vel.y += (temp * 0.85 - dens * 0.04) * 0.013;
  float dL = cell(ivec2(-1, 0)).z, dR = cell(ivec2(1, 0)).z;
  float dD = cell(ivec2(0, -1)).z, dU = cell(ivec2(0, 1)).z;
  vel += vec2(dU - dD, dR - dL) * 0.05 * u_param;
  if (distance(uv, vec2(0.5, 0.07)) < 0.045) { dens += 0.11; temp += 0.13; }
  float md = distance(uv, u_mouse);
  if (u_mouseDown > 0.5 && md < 0.06) {
    dens += (0.06 - md) * 9.0;
    temp += (0.06 - md) * 9.0;
    vel.y += (0.06 - md) * 2.5;
  }
  vel = clamp(vel, -3.0, 3.0);
  outColor = vec4(vel, clamp(dens, 0.0, 4.0), clamp(temp, 0.0, 3.0));
}\`,
        display: DISP_HEAD + \`void main() {
  vec4 s = texture(u_state, gl_FragCoord.xy / u_resolution);
  float d = clamp(s.z, 0.0, 1.0);
  float t = clamp(s.w * 0.30, 0.0, 1.0);
  vec3 smoke = mix(vec3(0.02, 0.03, 0.05), vec3(0.78, 0.80, 0.83), d);
  vec3 col = mix(smoke, vec3(1.0, 0.55, 0.18), t * d);
  outColor = vec4(col, 1.0);
}\`
    }, { info: info, param: 0.8 });
    var paused = false;
    document.getElementById('btnSmokeCalm') && document.getElementById('btnSmokeCalm').addEventListener('click', function () {
        sim.setParam(0.3); info.textContent = 'Calm — a lazy column rises straight up.';
    });
    document.getElementById('btnSmokeWild') && document.getElementById('btnSmokeWild').addEventListener('click', function () {
        sim.setParam(1.7); info.textContent = 'Wild — turbulent billows.';
    });
    document.getElementById('btnSmokeClear') && document.getElementById('btnSmokeClear').addEventListener('click', function () {
        sim.reset(); info.textContent = 'Cleared. The emitter refills it.';
    });
    document.getElementById('btnSmokePause') && document.getElementById('btnSmokePause').addEventListener('click', function () {
        paused = !paused; sim.setPaused(paused);
        info.textContent = paused ? 'Paused.' : 'Running.';
    });
})();`;
DEMO_CODE_TS.sh_smokeGL = DEMO_CODE.sh_smokeGL;

// =============================================================================
// 5e — sh_clothGL  (GPU Cloth: Verlet + Jacobi distance constraints)
// =============================================================================
DEMO_HTML.sh_clothGL = {
    title: 'Shaders — GPU Cloth (Verlet)',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnClothPin', text: 'Pinned' }, { id: 'btnClothDrop', text: 'Drop' },
        { id: 'btnClothWind', text: 'Wind' }, { id: 'btnClothReset', text: 'Reset' }
    ],
    info: 'A pinned sheet of 4,096 Verlet nodes. Drag to grab it.'
};
DEMO_CODE.sh_clothGL = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var N = 64;
    var sim = makeSim(canvas, {
        stateW: N, stateH: N,
        points: { vert: POINT_VERT, frag: POINT_FRAG, count: N * N },
        seed: SIM_HEAD + \`void main() {
  ivec2 sz = textureSize(u_state, 0);
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec2 g = (vec2(ip) + 0.5) / vec2(sz);
  vec2 rest = vec2(0.12 + g.x * 0.76, 0.92 - g.y * 0.80);
  outColor = vec4(rest, rest);
}\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  ivec2 sz = textureSize(u_state, 0);
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec4 s = cell(ivec2(0));
  vec2 pos = s.xy, prev = s.zw;
  bool pinned = (ip.y == sz.y - 1) && (u_param < 0.5);
  vec2 vel = (pos - prev) * 0.990;
  vec2 npos = pos + vel + vec2(0.0, -0.00045);
  if (u_param > 1.5) npos.x += sin(u_time * 2.0 + pos.y * 9.0) * 0.00060;
  if (u_mouseDown > 0.5 && distance(pos, u_mouse) < 0.07) npos = u_mouse;
  float L = 0.78 / float(sz.x);
  vec2 acc = vec2(0.0); float cnt = 0.0;
  for (int k = 0; k < 4; k++) {
    ivec2 o = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0)
            : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
    ivec2 np = ip + o;
    if (np.x < 0 || np.y < 0 || np.x >= sz.x || np.y >= sz.y) continue;
    vec4 nb = texelFetch(u_state, np, 0);
    vec2 diff = npos - nb.xy;
    float dl = length(diff) + 1e-6;
    acc += (diff / dl) * (L - dl);
    cnt += 1.0;
  }
  if (cnt > 0.0) npos += acc / cnt * 0.5;
  if (pinned) { vec2 g = (vec2(ip) + 0.5) / vec2(sz);
                npos = vec2(0.12 + g.x * 0.76, 0.92 - g.y * 0.80); }
  outColor = vec4(npos, pos);
}\`,
        display: DISP_HEAD + \`void main() { outColor = vec4(0.0); }\`
    }, { info: info, param: 0.0 });
    document.getElementById('btnClothPin') && document.getElementById('btnClothPin').addEventListener('click', function () {
        sim.setParam(0.0); info.textContent = 'Pinned — the sheet hangs and sways.';
    });
    document.getElementById('btnClothDrop') && document.getElementById('btnClothDrop').addEventListener('click', function () {
        sim.setParam(1.0); info.textContent = 'Dropped — the cloth falls under gravity.';
    });
    document.getElementById('btnClothWind') && document.getElementById('btnClothWind').addEventListener('click', function () {
        sim.setParam(2.0); info.textContent = 'Wind — a sine gust ripples the flag.';
    });
    document.getElementById('btnClothReset') && document.getElementById('btnClothReset').addEventListener('click', function () {
        sim.reset(); info.textContent = 'Reset to the flat hanging grid.';
    });
})();`;
DEMO_CODE_TS.sh_clothGL = DEMO_CODE.sh_clothGL;

// =============================================================================
// 5f — sh_dlaGL  (DLA / dielectric-breakdown dendritic growth)
// =============================================================================
DEMO_HTML.sh_dlaGL = {
    title: 'Shaders — DLA / Dendritic Growth',
    canvas: { width: 800, height: 450 },
    controls: [
        { id: 'btnDlaSlow', text: 'Slow' }, { id: 'btnDlaFast', text: 'Fast' },
        { id: 'btnDlaReset', text: 'Reset' }, { id: 'btnDlaPause', text: 'Pause' }
    ],
    info: 'A single seed grows a branching crystal. Drag to add nuclei.'
};
DEMO_CODE.sh_dlaGL = `(function () {
    var canvas = document.getElementById('canvas');
    var info = document.getElementById('info');
    var sim = makeSim(canvas, {
        seed: SIM_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  outColor = vec4(step(distance(uv, vec2(0.5)), 0.008), 0.0, 0.0, 1.0);
}\`,
        step: SIM_HEAD + SIM_LIB + \`void main() {
  float me = cell(ivec2(0)).r;
  if (me > 0.5) { outColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
  float nb = cell(ivec2(1, 0)).r + cell(ivec2(-1, 0)).r
           + cell(ivec2(0, 1)).r + cell(ivec2(0, -1)).r
           + cell(ivec2(1, 1)).r + cell(ivec2(-1, -1)).r
           + cell(ivec2(1, -1)).r + cell(ivec2(-1, 1)).r;
  float rnd = hash(gl_FragCoord.xy + float(u_frame) * 0.137);
  float p = 0.012 * (0.3 + u_param);
  float grow = (nb > 0.5 && rnd < p) ? 1.0 : 0.0;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.015) grow = 1.0;
  outColor = vec4(grow, 0.0, 0.0, 1.0);
}\`,
        display: DISP_HEAD + \`void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float m = texture(u_state, uv).r;
  float r = distance(uv, vec2(0.5));
  vec3 dend = 0.5 + 0.5 * cos(6.2831 * (r * 2.2) + vec3(0.0, 2.0, 4.0));
  outColor = vec4(mix(vec3(0.03, 0.04, 0.08), dend, m), 1.0);
}\`
    }, { info: info, param: 1.0 });
    var paused = false;
    document.getElementById('btnDlaSlow') && document.getElementById('btnDlaSlow').addEventListener('click', function () {
        sim.setParam(0.2); info.textContent = 'Slow growth — finely-branched dendrites.';
    });
    document.getElementById('btnDlaFast') && document.getElementById('btnDlaFast').addEventListener('click', function () {
        sim.setParam(2.5); info.textContent = 'Fast growth — bushier aggregate.';
    });
    document.getElementById('btnDlaReset') && document.getElementById('btnDlaReset').addEventListener('click', function () {
        sim.reset(); info.textContent = 'Reset to a single central seed.';
    });
    document.getElementById('btnDlaPause') && document.getElementById('btnDlaPause').addEventListener('click', function () {
        paused = !paused; sim.setPaused(paused);
        info.textContent = paused ? 'Paused — the crystal is frozen.' : 'Running.';
    });
})();`;
DEMO_CODE_TS.sh_dlaGL = DEMO_CODE.sh_dlaGL;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.sh_createProgram = ['sh_compileShader'];
DEPENDENCY_REQUIRES.sh_makeSim = ['sh_compileShader', 'sh_createProgram'];
