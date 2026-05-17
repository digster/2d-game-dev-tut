// =============================================================================
// SHADERS TRACK — SIMULATIONS TIER — PAGE-SIDE INTERACTIVE DEMOS  (FINAL TIER)
// =============================================================================
// GPU compute-style effects: state PERSISTS in float textures across frames
// (ping-pong feedback — state(t+1) = f(state(t))). WebGL2-only, GLSL ES 3.00,
// RGBA16F render targets (EXT_color_buffer_float). This is deliberately the
// WebGL2/float tier (the Advanced closing note primed it).
//
// compileShader/createShaderProgram are context-agnostic (verbatim). makeSim
// is the new persistent double-buffer runner: seed once → step N×/frame
// (ping-pong) → colourised display (or gl.POINTS for particles). Graceful
// fail() if the browser can't render to float textures.
//
// GLSL is template literals (plain JS here → no escaping). Every shader's
// FIRST line is `#version 300 es` (the #1 WebGL2 footgun).
// =============================================================================

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

// ---- Shared GLSL kit (every shader starts with #version 300 es) -------------
const SIM_VERT = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
// Header for seed/step passes (read+write state).
const SIM_HEAD = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_resolution;
uniform float u_time;
uniform int u_frame;
uniform vec2 u_mouse;
uniform float u_mouseDown;
uniform float u_param;
out vec4 outColor;
`;
// Header for the screen colouriser pass.
const DISP_HEAD = `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
out vec4 outColor;
`;
// Points display for the particle demo: the vertex shader IS the particle
// fetch (gl_VertexID → texel → position). WebGL2/GLSL3 only.
const POINT_VERT = `#version 300 es
uniform sampler2D u_state;
out float v_spd;
void main() {
  int W = textureSize(u_state, 0).x;
  ivec2 t = ivec2(gl_VertexID % W, gl_VertexID / W);
  vec4 s = texelFetch(u_state, t, 0);
  v_spd = length(s.zw);
  gl_Position = vec4(s.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 2.0;
}`;
const POINT_FRAG = `#version 300 es
precision highp float;
in float v_spd;
out vec4 outColor;
void main() {
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  vec3 c = mix(vec3(0.25, 0.5, 1.0), vec3(1.0, 0.85, 0.35), clamp(v_spd * 35.0, 0.0, 1.0));
  outColor = vec4(c * a, a);
}`;
// A common GLSL helper string demos prepend after the header.
const SIM_LIB = `vec4 cell(ivec2 o) {
  ivec2 p = clamp(ivec2(gl_FragCoord.xy) + o, ivec2(0), textureSize(u_state, 0) - 1);
  return texelFetch(u_state, p, 0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

// -----------------------------------------------------------------------------
// makeSim — persistent double-buffered simulation runner (WebGL2 + float).
// spec = { seed, step, display, substeps?, stateW?, stateH?, points? }
//   seed/step/display : fragment-shader source strings
//   points            : { vert, frag, count } → draw gl.POINTS instead of a
//                        quad for the display (the particle case)
// -----------------------------------------------------------------------------
function makeSim(canvas, spec, opts) {
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
            String(m).split('\n').forEach((l, i) => c2d.fillText(l.slice(0, 92), 12, 24 + i * 18));
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
        mouse.y = 1.0 - (e.clientY - r.top) / r.height;   // Y-flip → gl_FragCoord space
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
    function pass(prog, srcTex, dstFB, w, h) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dstFB);
        gl.viewport(0, 0, w, h);
        gl.useProgram(prog); bindQuad(prog);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
        setCommon(prog, w, h);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function seed() {
        // Seed BOTH buffers so the first read is valid regardless of swap parity.
        pass(seedProg, A.t, A.f, SW, SH);
        pass(seedProg, A.t, B.f, SW, SH);
        frameN = 0;
    }
    seed();

    let cur = A, nxt = B, raf = 0, last = performance.now();
    function frame(now) {
        if (!paused) tNow += (now - last) * 0.001;
        last = now;
        for (let k = 0; k < substeps; k++) {
            pass(stepProg, cur.t, nxt.f, SW, SH);
            const tmp = cur; cur = nxt; nxt = tmp;
            frameN++;
        }
        // Display → screen.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (pointProg) {
            gl.clearColor(0.02, 0.03, 0.06, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // additive glow
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
}

// =============================================================================
// 1 — State in a Texture (the sim loop)
// =============================================================================
(function simLoop() {
    const canvas = document.getElementById('simLoopGL');
    if (!canvas) return;
    const info = document.getElementById('simLoopGLInfo');
    makeSim(canvas, {
        seed: SIM_HEAD + `void main() { outColor = vec4(0.0); }`,
        step: SIM_HEAD + SIM_LIB + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float v = cell(ivec2(0)).r * 0.985;            // decay last frame
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.03) v = 1.0;
  outColor = vec4(v, 0.0, 0.0, 1.0);
}`,
        display: DISP_HEAD + `void main() {
  float v = texture(u_state, gl_FragCoord.xy / u_resolution).r;
  vec3 c = mix(vec3(0.03,0.04,0.08), vec3(1.0,0.6,0.15), v);
  outColor = vec4(c, 1.0);
}`
    }, { info: info });
})();

// =============================================================================
// 2 — Conway's Game of Life
// =============================================================================
(function life() {
    const canvas = document.getElementById('lifeGL');
    if (!canvas) return;
    const info = document.getElementById('lifeGLInfo');
    const sim = makeSim(canvas, {
        seed: SIM_HEAD + SIM_LIB + `void main() {
  float r = hash(gl_FragCoord.xy + 0.123);
  outColor = vec4(step(0.7, r), 0.0, 0.0, 1.0);
}`,
        step: SIM_HEAD + SIM_LIB + `void main() {
  float a = cell(ivec2(0)).r;
  float n = cell(ivec2(-1,-1)).r + cell(ivec2(0,-1)).r + cell(ivec2(1,-1)).r
          + cell(ivec2(-1, 0)).r                       + cell(ivec2(1, 0)).r
          + cell(ivec2(-1, 1)).r + cell(ivec2(0, 1)).r + cell(ivec2(1, 1)).r;
  float alive = (n == 3.0 || (a > 0.5 && n == 2.0)) ? 1.0 : 0.0;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  if (u_mouseDown > 0.5 && distance(uv, u_mouse) < 0.02) alive = 1.0;
  outColor = vec4(alive, 0.0, 0.0, 1.0);
}`,
        display: DISP_HEAD + `void main() {
  float a = texture(u_state, gl_FragCoord.xy / u_resolution).r;
  outColor = vec4(mix(vec3(0.04,0.05,0.09), vec3(0.4,1.0,0.55), a), 1.0);
}`
    }, { info: info });
    document.getElementById('btnLifeReseed')?.addEventListener('click', () => {
        sim.reset(); info.textContent = 'Reseeded — random soup. Drag to draw cells.';
    });
})();

// =============================================================================
// 3 — Reaction-Diffusion (Gray-Scott) — the float-precision showcase
// =============================================================================
(function reaction() {
    const canvas = document.getElementById('reactionGL');
    if (!canvas) return;
    const info = document.getElementById('reactionGLInfo');
    const PRESETS = {
        coral:   { f: '0.0545', k: '0.062' },
        mitosis: { f: '0.0367', k: '0.0649' },
        worms:   { f: '0.078',  k: '0.061' }
    };
    function spec(p) {
        return {
            substeps: 12,
            seed: SIM_HEAD + SIM_LIB + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float b = (distance(uv, vec2(0.5)) < 0.03) ? 1.0 : 0.0;
  outColor = vec4(1.0, b, 0.0, 1.0);
}`,
            step: SIM_HEAD + SIM_LIB + `const float Da = 1.0, Db = 0.5, dt = 1.0;
const float feed = ${p.f}, kill = ${p.k};
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
}`,
            display: DISP_HEAD + `void main() {
  float b = texture(u_state, gl_FragCoord.xy / u_resolution).g;
  vec3 c = mix(vec3(0.02,0.05,0.12), vec3(0.2,0.9,0.85), smoothstep(0.0,0.4,b));
  c = mix(c, vec3(1.0,0.95,0.7), smoothstep(0.4,0.6,b));
  outColor = vec4(c, 1.0);
}`
        };
    }
    const sim = makeSim(canvas, spec(PRESETS.coral), { info: info });
    Object.keys(PRESETS).forEach(name => {
        document.getElementById('btnRD' + name)?.addEventListener('click', () => {
            sim.rebuild(spec(PRESETS[name]));
            info.textContent = name + ' (feed=' + PRESETS[name].f + ', kill=' + PRESETS[name].k + ') — drag to seed.';
        });
    });
})();

// =============================================================================
// 4 — GPU Particles (state in a texture, points display)
// =============================================================================
(function particles() {
    const canvas = document.getElementById('particlesGL');
    if (!canvas) return;
    const info = document.getElementById('particlesGLInfo');
    const N = 256;
    makeSim(canvas, {
        stateW: N, stateH: N, points: { vert: POINT_VERT, frag: POINT_FRAG, count: N * N },
        seed: SIM_HEAD + SIM_LIB + `void main() {
  vec2 t = gl_FragCoord.xy;
  outColor = vec4(hash(t), hash(t + 7.0), 0.0, 0.0);
}`,
        step: SIM_HEAD + SIM_LIB + `void main() {
  vec4 s = cell(ivec2(0));
  vec2 p = s.xy, v = s.zw;
  // curl-ish flow + gravity + mouse attractor
  float a = (hash(floor(p * 8.0)) - 0.5) * 6.2831;
  v += vec2(cos(a), sin(a)) * 0.0008;
  v += vec2(0.0, -0.0006);
  if (u_mouseDown > 0.5) v += normalize(u_mouse - p + 1e-4) * 0.0015;
  v *= 0.97;
  p += v;
  if (p.x < 0.0 || p.x > 1.0) { v.x *= -0.6; p.x = clamp(p.x, 0.0, 1.0); }
  if (p.y < 0.0)              { v.y *= -0.4; p.y = 0.0; }
  if (p.y > 1.0)              { v.y *= -0.4; p.y = 1.0; }
  outColor = vec4(p, v);
}`,
        display: DISP_HEAD + `void main() { outColor = vec4(0.0); }`   // unused (points display)
    }, { info: info });
})();

// =============================================================================
// 5 — 2D Fluid / Ink  (Stam-style "lite": advect + force, non-projected)
// =============================================================================
// A believable non-projected "ink" (no pressure solve) — see the key-point in
// simulations.html. State packs velocity in .xy and 2-channel dye in .zw.
const FLUID_SEED = SIM_HEAD + `void main() { outColor = vec4(0.0); }`;
const FLUID_STEP = SIM_HEAD + SIM_LIB + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 s = cell(ivec2(0));
  vec2 vel = s.xy;
  vec2 back = uv - vel * 0.012;
  vec4 a = texture(u_state, back);
  vel = a.xy * 0.998;
  vec2 dye = a.zw * 0.99;
  float md = distance(uv, u_mouse);
  if (u_mouseDown > 0.5 && md < 0.07) {
    vec2 dir = normalize(uv - u_mouse + 1e-4);
    vel += dir * (0.07 - md) * 2.2;
    dye += vec2(0.6, 1.0) * (0.07 - md) * 6.0;
  }
  vel = clamp(vel, -3.0, 3.0);
  dye = clamp(dye, 0.0, 4.0);
  outColor = vec4(vel, dye);
}`;
const FLUID_DISP = DISP_HEAD + `void main() {
  vec2 d = texture(u_state, gl_FragCoord.xy / u_resolution).zw;
  vec3 c = vec3(0.02,0.03,0.06) + vec3(0.2,0.6,1.0)*d.x + vec3(1.0,0.5,0.2)*d.y;
  outColor = vec4(c, 1.0);
}`;
(function fluid() {
    const canvas = document.getElementById('fluidGL');
    if (!canvas) return;
    const info = document.getElementById('fluidGLInfo');
    makeSim(canvas, { substeps: 2, seed: FLUID_SEED, step: FLUID_STEP, display: FLUID_DISP },
        { info: info });
})();

// =============================================================================
// 6 — Mini-Project: Interactive Fluid Playground
// =============================================================================
(function playground() {
    const canvas = document.getElementById('playgroundGL');
    if (!canvas) return;
    const info = document.getElementById('playgroundGLInfo');
    const DYES = { aqua: 'vec2(0.7, 1.0)', fire: 'vec2(1.0, 0.25)', toxic: 'vec2(0.3, 0.9)' };
    function stepFor(dye) {
        return SIM_HEAD + SIM_LIB + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 s = cell(ivec2(0));
  vec2 vel = s.xy;
  vec2 back = uv - vel * 0.012;
  vec4 a = texture(u_state, back);
  vel = a.xy * (0.990 + u_param * 0.009);   // u_param = viscosity/damping
  vec2 d = a.zw * 0.99;
  float md = distance(uv, u_mouse);
  if (u_mouseDown > 0.5 && md < 0.07) {
    vel += normalize(uv - u_mouse + 1e-4) * (0.07 - md) * 2.4;
    d += ${dye} * (0.07 - md) * 6.0;
  }
  outColor = vec4(clamp(vel,-3.0,3.0), clamp(d,0.0,4.0));
}`;
    }
    const state = { dye: 'aqua' };
    const sim = makeSim(canvas, { substeps: 2, seed: FLUID_SEED, step: stepFor(DYES.aqua), display: FLUID_DISP },
        { info: info, param: 0.5 });
    Object.keys(DYES).forEach(name => {
        document.getElementById('btnPg' + name)?.addEventListener('click', () => {
            state.dye = name;
            sim.rebuild({ substeps: 2, seed: FLUID_SEED, step: stepFor(DYES[name]), display: FLUID_DISP });
            info.textContent = name + ' dye — drag to stir.';
        });
    });
    document.getElementById('btnPgThick')?.addEventListener('click', () => {
        sim.setParam(1.0); info.textContent = 'Viscous (slow to settle).';
    });
    document.getElementById('btnPgThin')?.addEventListener('click', () => {
        sim.setParam(0.0); info.textContent = 'Thin (dissipates fast).';
    });
    document.getElementById('btnPgClear')?.addEventListener('click', () => {
        sim.reset(); info.textContent = 'Cleared. Drag to stir the fluid.';
    });
})();
