// =============================================================================
// SHADERS TRACK — ADVANCED TIER — PAGE-SIDE INTERACTIVE DEMOS
// =============================================================================
// Multi-pass / post-processing. First tier with render-to-texture (FBOs).
// Each effect ships as a PAIR of demos — a WebGL1 (GLSL ES 1.00) and a WebGL2
// (GLSL ES 3.00) implementation — toggled per section by a page-local
// .api-tab strip in advanced.html (distinct from the JS/TS .code-tab system).
//
// compileShader/createShaderProgram are context-agnostic and copied verbatim.
// makeFXChain is the new multi-pass runner; makeFXChainGL1/GL2 are thin
// wrappers that pick the context + vertex dialect. (Bundle twins each define a
// self-contained `makeFXChain` — see bundles-advanced.js header.)
//
// GLSL is written as template literals (plain JS here → no escaping).
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

// Vertex shaders — the only place the dialect's attribute keyword differs.
const VERT_GL1 = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
const VERT_GL2 = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

// Fragment headers. GL2's MUST begin with `#version 300 es` as the literal
// first line (the #1 WebGL2 footgun) and declares an explicit `out`.
const SHEAD_GL1 = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
`;
const PHEAD_GL1 = SHEAD_GL1 + `uniform sampler2D u_prev;
uniform sampler2D u_scene;
`;
const SHEAD_GL2 = `#version 300 es
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
out vec4 fragColor;
`;
const PHEAD_GL2 = `#version 300 es
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_param;
uniform sampler2D u_prev;
uniform sampler2D u_scene;
out vec4 fragColor;
`;

// The procedural "scene" rendered into the first FBO: roaming additive glow
// orbs on a dark field — bright cores give bloom/blur something to chew on.
const SCENE_BODY = `void main() {
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
}`;
const SCENE_GL1 = SHEAD_GL1 + SCENE_BODY.replace('OUT', 'gl_FragColor');
const SCENE_GL2 = SHEAD_GL2 + SCENE_BODY.replace('OUT', 'fragColor');

// -----------------------------------------------------------------------------
// makeFXChain — render sceneFrag → FBO, then run postFrags FBO→FBO (ping-pong
// between two scratch FBOs so a pass never samples the target it writes), last
// pass → screen. Every post pass gets u_prev (previous result) + u_scene
// (the original scene). FBOs are canvas-sized RGBA8.
// -----------------------------------------------------------------------------
function makeFXChain(canvas, gl, VERT, sceneFrag, postFrags, opts) {
    opts = opts || {};
    const info = opts.info || null;
    let uParam = opts.param != null ? opts.param : 0;
    let paused = !!opts.paused;
    let tNow = 0;

    function fail(m) {
        console.error(m);
        if (info) { info.textContent = m; info.style.color = '#ff7b72'; }
        if (gl) { gl.clearColor(0.23, 0.05, 0.07, 1.0); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
    const noop = { stop() {}, setParam() {}, setPaused() {}, rebuild() {} };
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,  -1, 1,  1, -1,  1, 1
    ]), gl.STATIC_DRAW);

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
        return { f, t, ok };
    }
    const sceneFB = fbo(), pingA = fbo(), pingB = fbo();

    let sceneProg = null, postProgs = [];
    function compileAll(sF, pF) {
        try {
            const sp = createShaderProgram(gl, VERT, sF);
            const pp = pF.map(f => createShaderProgram(gl, VERT, f));
            if (sceneProg) gl.deleteProgram(sceneProg);
            postProgs.forEach(p => gl.deleteProgram(p));
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
        // Pass 0: the scene, into its own FBO.
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFB.f);
        gl.viewport(0, 0, W, H);
        setU(sceneProg);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // Post chain, ping-ponging the two scratch FBOs.
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
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault(), false);
    raf = requestAnimationFrame(frame);

    return {
        stop() { cancelAnimationFrame(raf); },
        setParam(v) { uParam = v; },
        setPaused(b) { paused = b; if (!b) last = performance.now(); },
        rebuild(sF, pF) { compileAll(sF, pF); }
    };
}
function makeFXChainGL1(canvas, scene, post, opts) {
    return makeFXChain(canvas, canvas.getContext('webgl') || canvas.getContext('experimental-webgl'),
        VERT_GL1, scene, post, opts);
}
function makeFXChainGL2(canvas, scene, post, opts) {
    return makeFXChain(canvas, canvas.getContext('webgl2'), VERT_GL2, scene, post, opts);
}

// -----------------------------------------------------------------------------
// Post-pass shader bodies. Written once with OUT / TEX placeholders, then
// emitted in each dialect. (The bundle ships the resolved GL1/GL2 text so the
// learner sees real `texture2D`+`gl_FragColor` vs `texture`+`fragColor`.)
// -----------------------------------------------------------------------------
const B = {
    identity: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  OUT = TEX(u_prev, uv);
}`,
    boxblur: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 px = vec2(2.0) / u_resolution;
  vec4 s = TEX(u_prev, uv) * 0.4;
  s += TEX(u_prev, uv + vec2(px.x, 0.0)) * 0.15;
  s += TEX(u_prev, uv - vec2(px.x, 0.0)) * 0.15;
  s += TEX(u_prev, uv + vec2(0.0, px.y)) * 0.15;
  s += TEX(u_prev, uv - vec2(0.0, px.y)) * 0.15;
  OUT = s;
}`,
    blurH: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 d = vec2(u_param, 0.0) / u_resolution;
  vec4 s = TEX(u_prev, uv) * 0.227;
  s += (TEX(u_prev, uv + d) + TEX(u_prev, uv - d)) * 0.194;
  s += (TEX(u_prev, uv + 2.0*d) + TEX(u_prev, uv - 2.0*d)) * 0.121;
  s += (TEX(u_prev, uv + 3.0*d) + TEX(u_prev, uv - 3.0*d)) * 0.054;
  s += (TEX(u_prev, uv + 4.0*d) + TEX(u_prev, uv - 4.0*d)) * 0.016;
  OUT = s;
}`,
    blurV: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 d = vec2(0.0, u_param) / u_resolution;
  vec4 s = TEX(u_prev, uv) * 0.227;
  s += (TEX(u_prev, uv + d) + TEX(u_prev, uv - d)) * 0.194;
  s += (TEX(u_prev, uv + 2.0*d) + TEX(u_prev, uv - 2.0*d)) * 0.121;
  s += (TEX(u_prev, uv + 3.0*d) + TEX(u_prev, uv - 3.0*d)) * 0.054;
  s += (TEX(u_prev, uv + 4.0*d) + TEX(u_prev, uv - 4.0*d)) * 0.016;
  OUT = s;
}`,
    // Fixed-radius blur for bloom/stack so u_param stays free for bloom STRENGTH
    // (the standalone Blur effect's blurH/blurV use u_param as the radius).
    bbH: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 d = vec2(3.0, 0.0) / u_resolution;
  vec4 s = TEX(u_prev, uv) * 0.227;
  s += (TEX(u_prev, uv + d) + TEX(u_prev, uv - d)) * 0.194;
  s += (TEX(u_prev, uv + 2.0*d) + TEX(u_prev, uv - 2.0*d)) * 0.121;
  s += (TEX(u_prev, uv + 3.0*d) + TEX(u_prev, uv - 3.0*d)) * 0.054;
  s += (TEX(u_prev, uv + 4.0*d) + TEX(u_prev, uv - 4.0*d)) * 0.016;
  OUT = s;
}`,
    bbV: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 d = vec2(0.0, 3.0) / u_resolution;
  vec4 s = TEX(u_prev, uv) * 0.227;
  s += (TEX(u_prev, uv + d) + TEX(u_prev, uv - d)) * 0.194;
  s += (TEX(u_prev, uv + 2.0*d) + TEX(u_prev, uv - 2.0*d)) * 0.121;
  s += (TEX(u_prev, uv + 3.0*d) + TEX(u_prev, uv - 3.0*d)) * 0.054;
  s += (TEX(u_prev, uv + 4.0*d) + TEX(u_prev, uv - 4.0*d)) * 0.016;
  OUT = s;
}`,
    bright: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 c = TEX(u_prev, uv).rgb;
  float b = max(c.r, max(c.g, c.b));
  OUT = vec4(c * smoothstep(0.55, 0.95, b), 1.0);
}`,
    composite: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 base = TEX(u_scene, uv).rgb;
  vec3 bloom = TEX(u_prev, uv).rgb;
  OUT = vec4(base + bloom * u_param, 1.0);
}`
};
function g1(body) { return PHEAD_GL1 + body.split('TEX').join('texture2D').split('OUT').join('gl_FragColor'); }
function g2(body) { return PHEAD_GL2 + body.split('TEX').join('texture').split('OUT').join('fragColor'); }

// Colour-grade + CRT as a final pass, built from a small state object.
function gradeBody(s) {
    return `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 ca = ${s.chroma} / u_resolution;
  vec3 c;
  c.r = TEX(u_prev, uv + ca).r;
  c.g = TEX(u_prev, uv).g;
  c.b = TEX(u_prev, uv - ca).b;
  c *= ${s.exposure};
  c = (c - 0.5) * ${s.contrast} + 0.5;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, ${s.sat}) * ${s.tint};
  c *= 0.85 + 0.15 * sin(gl_FragCoord.y * ${s.scan});
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * ${s.vignette};
  OUT = vec4(c, 1.0);
}`;
}
const GRADE_PRESETS = {
    neutral: { exposure: '1.0', contrast: '1.0', sat: '1.0', tint: 'vec3(1.0)', scan: '0.0', vignette: '0.0', chroma: 'vec2(0.0)' },
    warm:    { exposure: '1.15', contrast: '1.1', sat: '1.2', tint: 'vec3(1.08,1.0,0.9)', scan: '0.0', vignette: '0.7', chroma: 'vec2(0.0)' },
    crt:     { exposure: '1.05', contrast: '1.15', sat: '1.1', tint: 'vec3(1.0)', scan: '3.14159', vignette: '1.2', chroma: 'vec2(2.0,0.0)' },
    noir:    { exposure: '1.0', contrast: '1.3', sat: '0.0', tint: 'vec3(1.0)', scan: '0.0', vignette: '1.0', chroma: 'vec2(0.0)' }
};

// =============================================================================
// Effect → post-chain definitions (shared by the GL1 and GL2 demo pairs).
// =============================================================================
function chainFor(effect, state) {
    if (effect === 'rtt') return [B.identity];
    if (effect === 'ping') return Array.from({ length: state.iters }, () => B.boxblur);
    if (effect === 'blur') return [B.blurH, B.blurV];
    if (effect === 'bloom') return [B.bright, B.bbH, B.bbV, B.composite];
    if (effect === 'grade') return [gradeBody(GRADE_PRESETS[state.preset])];
    if (effect === 'stack') {
        const post = [];
        if (state.bloom) post.push(B.bright, B.bbH, B.bbV, B.composite);
        post.push(gradeBody(GRADE_PRESETS[state.preset]));
        return post;
    }
    return [B.identity];
}

// Wire one effect into a {GL1,GL2} pair. `api` picks the maker + dialect.
function mountFX(canvasId, infoId, api, effect, initState, wireButtons) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const info = document.getElementById(infoId);
    const g = api === 'gl2' ? g2 : g1;
    const SCENE = api === 'gl2' ? SCENE_GL2 : SCENE_GL1;
    const make = api === 'gl2' ? makeFXChainGL2 : makeFXChainGL1;
    const state = Object.assign({}, initState);
    function build() { return chainFor(effect, state).map(g); }
    const toy = make(canvas, SCENE, build(), { info: info, param: initState._param != null ? initState._param : 1.0 });
    toy.rebuildChain = () => toy.rebuild(SCENE, build());
    if (wireButtons) wireButtons(toy, state, info);
    return toy;
}

// =============================================================================
// 12 demos: 6 effects × {GL1, GL2}. Each pair shares logic; only the API
// wrapper + GLSL dialect differ (that contrast is the whole point of the tier).
// =============================================================================

// 1 — Render-to-Texture
['gl1', 'gl2'].forEach(api => {
    mountFX('rtt' + api.toUpperCase(), 'rtt' + api.toUpperCase() + 'Info', api, 'rtt', {}, (toy, st, info) => {
        document.getElementById('btnRtt' + api.toUpperCase() + 'Show')?.addEventListener('click', () => {
            info.textContent = 'Scene rendered to an FBO, then that texture drawn to the screen.';
        });
    });
});

// 2 — Ping-Pong Buffers
['gl1', 'gl2'].forEach(api => {
    const A = api.toUpperCase();
    mountFX('ping' + A, 'ping' + A + 'Info', api, 'ping', { iters: 4 }, (toy, st, info) => {
        [['1', 1], ['4', 4], ['16', 16]].forEach(([label, n]) => {
            document.getElementById('btnPing' + A + label)?.addEventListener('click', () => {
                st.iters = n; toy.rebuildChain();
                info.textContent = n + ' ping-pong blur passes — two FBOs swapped each pass.';
            });
        });
    });
});

// 3 — Separable Blur
['gl1', 'gl2'].forEach(api => {
    const A = api.toUpperCase();
    mountFX('blur' + A, 'blur' + A + 'Info', api, 'blur', { _param: 2.0 }, (toy, st, info) => {
        [['Soft', 2.0], ['Strong', 5.0], ['Heavy', 9.0]].forEach(([label, r]) => {
            document.getElementById('btnBlur' + A + label)?.addEventListener('click', () => {
                toy.setParam(r);
                info.textContent = 'Separable Gaussian — H then V pass, radius ' + r + '.';
            });
        });
    });
});

// 4 — Bloom
['gl1', 'gl2'].forEach(api => {
    const A = api.toUpperCase();
    mountFX('bloom' + A, 'bloom' + A + 'Info', api, 'bloom', { _param: 1.4 }, (toy, st, info) => {
        [['Off', 0.0], ['Subtle', 0.8], ['Glow', 1.4], ['Intense', 2.5]].forEach(([label, v]) => {
            document.getElementById('btnBloom' + A + label)?.addEventListener('click', () => {
                toy.setParam(v);
                info.textContent = 'Bright-pass → blur → additive composite, strength ' + v + '.';
            });
        });
    });
});

// 5 — Colour Grade + CRT
['gl1', 'gl2'].forEach(api => {
    const A = api.toUpperCase();
    mountFX('grade' + A, 'grade' + A + 'Info', api, 'grade', { preset: 'neutral' }, (toy, st, info) => {
        [['Neutral', 'neutral'], ['Warm', 'warm'], ['CRT', 'crt'], ['Noir', 'noir']].forEach(([label, p]) => {
            document.getElementById('btnGrade' + A + label)?.addEventListener('click', () => {
                st.preset = p; toy.rebuildChain();
                info.textContent = p + ' grade — exposure/contrast/sat/tint + scanline/vignette/chroma.';
            });
        });
    });
});

// 6 — Mini-Project: Post-Process Stack
['gl1', 'gl2'].forEach(api => {
    const A = api.toUpperCase();
    mountFX('stack' + A, 'stack' + A + 'Info', api, 'stack', { bloom: true, preset: 'crt', _param: 1.4 }, (toy, st, info) => {
        document.getElementById('btnStack' + A + 'Bloom')?.addEventListener('click', () => {
            st.bloom = !st.bloom; toy.rebuildChain();
            info.textContent = 'Bloom stage ' + (st.bloom ? 'ON' : 'OFF') + ' in the chain.';
        });
        [['Warm', 'warm'], ['CRT', 'crt'], ['Noir', 'noir']].forEach(([label, p]) => {
            document.getElementById('btnStack' + A + label)?.addEventListener('click', () => {
                st.preset = p; toy.rebuildChain();
                info.textContent = 'Stack: scene → ' + (st.bloom ? 'bloom → ' : '') + p + ' grade.';
            });
        });
    });
});
