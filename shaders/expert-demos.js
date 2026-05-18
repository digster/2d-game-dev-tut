// =============================================================================
// SHADERS TRACK — EXPERT TIER — PAGE-SIDE INTERACTIVE DEMOS
// =============================================================================
// Same conventions as the earlier tiers. Tier pages never co-load, so the
// WebGL helpers are self-contained here. The 4 compile/link/quad helpers are
// copied verbatim from intermediate-demos.js; makeShaderToy gains an additive,
// fully backward-compatible texture branch (opts.sprite) used by this tier.
//
// GLSL is written as multi-line template literals (plain JS here → no escaping).
//
// New subsystem: textures. The "sprite" is painted procedurally onto an
// offscreen 2D canvas (drawSprite) and uploaded by makeShaderToy — no image
// assets, so every demo still Exports fully self-contained.
// =============================================================================

// -----------------------------------------------------------------------------
// compile/link/quad helpers — verbatim copy from intermediate-demos.js
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

// -----------------------------------------------------------------------------
// drawSprite — the procedural "art". A faceted gem in four luminance bands
// (dark base / mid / light / white sparkle) so palette-swap & luminance ramps
// read cleanly, with a crisp silhouette for outlining and transparent margins
// for CLAMP_TO_EDGE-safe neighbour taps.
// -----------------------------------------------------------------------------
function drawSprite(ctx, n) {
    ctx.clearRect(0, 0, n, n);
    const cx = n / 2, cy = n / 2, r = n * 0.34;
    // Base silhouette (mid-dark)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.5, cy + r);
    ctx.lineTo(cx - r * 0.5, cy + r);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#3a3f55';
    ctx.fill();
    // Left facet (mid)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx - r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.5, cy + r);
    ctx.lineTo(cx, cy + r * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#6b7390';
    ctx.fill();
    // Right facet (light)
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.8, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.5, cy + r);
    ctx.lineTo(cx, cy + r * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#aab3d6';
    ctx.fill();
    // Sparkle (white)
    ctx.beginPath();
    ctx.arc(cx - r * 0.18, cy - r * 0.42, n * 0.028, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
}

// -----------------------------------------------------------------------------
// makeShaderToy — intermediate's runner + an additive texture branch.
// opts.sprite(ctx2d, size) paints a 256x256 (POT) offscreen canvas which is
// uploaded as u_tex (unit 0); u_texResolution carries its size. When
// opts.sprite is absent the texture path is skipped → behaviour identical to
// every earlier tier (backward compatible).
//
// u_mouse: pixels, Y-flipped to share gl_FragCoord's bottom-left origin.
// Texture: UNPACK_FLIP_Y so a Y-down 2D-canvas sprite samples upright.
// -----------------------------------------------------------------------------
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
            gl.clearColor(0.23, 0.05, 0.07, 1.0);   // unmistakable dark red
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

    let spriteTex = null;
    function ensureTexture() {
        if (!opts.sprite || spriteTex) return;
        const sc = document.createElement('canvas');
        sc.width = TEX_SIZE; sc.height = TEX_SIZE;
        opts.sprite(sc.getContext('2d'), TEX_SIZE);
        spriteTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, spriteTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // 2D canvas is Y-down
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc);
        // NPOT-safe + crisp pixel-art read for palette/outline:
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    let program = null, quadBuf = null, uTime, uRes, uMouse, uP, uTex, uTexRes;
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

    const onMove = (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        mouse.y = canvas.height - (e.clientY - r.top) * (canvas.height / r.height);
    };
    const onLeave = () => { mouse.x = canvas.width / 2; mouse.y = canvas.height / 2; };
    const onLost = (e) => e.preventDefault();
    const onRestored = () => { spriteTex = null; build(fragSrc); };
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
        setTimeScale(s) { timeScale = s; },
        // Full teardown so the lazy wrapper can free the WebGL context when the
        // demo scrolls off-screen (delete GL objects incl. the sprite texture,
        // then lose the context).
        destroy() {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseleave', onLeave);
            canvas.removeEventListener('webglcontextlost', onLost, false);
            canvas.removeEventListener('webglcontextrestored', onRestored, false);
            try {
                if (program) gl.deleteProgram(program);
                if (quadBuf) gl.deleteBuffer(quadBuf);
                if (spriteTex) gl.deleteTexture(spriteTex);
            } catch (e) { /* context may already be lost */ }
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
        }
    };
}

// Shared GLSL building blocks (string-concatenated into each shader). Kept as
// JS consts so every demo's shader stays readable.
const GLSL_HEAD = `precision mediump float;
uniform vec2 u_resolution;
uniform sampler2D u_tex;
uniform vec2 u_texResolution;
uniform float u_time;
uniform float u_param;
// Map full-canvas uv → a centred, aspect-correct square sprite space.
vec2 toSpriteUV(vec2 uv) {
  vec2 c = uv - 0.5;
  c.x *= u_resolution.x / u_resolution.y;
  return c / 0.36 * 0.5 + 0.5;
}
// Subtle checkerboard so the silhouette / outline reads.
vec3 backdrop(vec2 uv) {
  vec2 g = floor(vec2(uv.x * u_resolution.x / u_resolution.y, uv.y) * 16.0);
  float ch = mod(g.x + g.y, 2.0);
  return mix(vec3(0.10, 0.11, 0.15), vec3(0.13, 0.14, 0.19), ch);
}
`;
const GLSL_NOISE = `float hash(vec2 p) {
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
`;

// =============================================================================
// DEMO 1 — sampleGL  (§ Sampling a Texture)
// =============================================================================
(function sampleShader() {
    const canvas = document.getElementById('sampleGL');
    if (!canvas) return;
    const info = document.getElementById('sampleGLInfo');

    const FIT = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));     // sample the sprite
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`;
    // Sample with raw uv (no aspect fit) — the gem squashes: shows WHY we fit.
    const STRETCH = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, uv);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`;
    // Visualise the sprite-space uv as colour where the sprite is opaque.
    const SHOWUV = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  vec3 c = mix(backdrop(uv), vec3(s, 0.0), tex.a);
  gl_FragColor = vec4(c, 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, FIT, { info: info, sprite: drawSprite }));

    document.getElementById('btnSampFit')?.addEventListener('click', () => {
        toy.setFrag(FIT); info.textContent = 'Fitted: aspect-correct square sprite space.';
    });
    document.getElementById('btnSampStretch')?.addEventListener('click', () => {
        toy.setFrag(STRETCH); info.textContent = 'Stretched: sampling with raw uv squashes the gem.';
    });
    document.getElementById('btnSampUV')?.addEventListener('click', () => {
        toy.setFrag(SHOWUV); info.textContent = 'Sprite-space uv shown as red=x, green=y.';
    });
})();

// =============================================================================
// DEMO 2 — tintGL  (§ Tinting & Multiply)
// =============================================================================
(function tintShader() {
    const canvas = document.getElementById('tintGL');
    if (!canvas) return;
    const info = document.getElementById('tintGLInfo');

    function buildFrag(tint) {
        return GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  vec3 tinted = tex.rgb * ${tint};                 // multiply keeps shading
  gl_FragColor = vec4(mix(backdrop(uv), tinted, tex.a), 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('vec3(1.0)'), { info: info, sprite: drawSprite }));

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
})();

// =============================================================================
// DEMO 3 — paletteGL  (§ Palette Swap)
// =============================================================================
(function paletteShader() {
    const canvas = document.getElementById('paletteGL');
    if (!canvas) return;
    const info = document.getElementById('paletteGLInfo');

    // Map sample luminance through a 3-stop ramp → recolor one sprite.
    function buildFrag(a, b, c) {
        return GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float l = dot(tex.rgb, vec3(0.299, 0.587, 0.114));   // luminance
  vec3 ramp = l < 0.5
    ? mix(${a}, ${b}, l * 2.0)
    : mix(${b}, ${c}, (l - 0.5) * 2.0);
  gl_FragColor = vec4(mix(backdrop(uv), ramp, tex.a), 1.0);
}`;
    }
    const ORIGINAL = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, ORIGINAL, { info: info, sprite: drawSprite }));

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
})();

// =============================================================================
// DEMO 4 — dissolveGL  (§ Dissolve & Burn)
// =============================================================================
(function dissolveShader() {
    const canvas = document.getElementById('dissolveGL');
    if (!canvas) return;
    const info = document.getElementById('dissolveGLInfo');

    // progressExpr: 'u_param' (manual) or a u_time loop (auto).
    function buildFrag(progressExpr) {
        return GLSL_HEAD + GLSL_NOISE + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, s);
  float prog = ${progressExpr};
  float n = valueNoise(s * 14.0);                  // dissolve mask
  vec3 col = backdrop(uv);
  if (tex.a > 0.5) {
    if (n < prog) {
      // dissolved away — leave backdrop
    } else {
      col = tex.rgb;
      float edge = smoothstep(prog, prog + 0.08, n);  // 0 at the burn front
      col = mix(vec3(1.0, 0.6, 0.1), col, edge);       // glowing burn edge
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const MANUAL = buildFrag('u_param');
    const AUTO = buildFrag('fract(u_time * 0.25)');

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, MANUAL, { info: info, sprite: drawSprite, param: 0.0 }));

    document.getElementById('btnDis0')?.addEventListener('click', () => {
        toy.setFrag(MANUAL); toy.setParam(0.0); info.textContent = 'Progress 0% — intact.';
    });
    document.getElementById('btnDis50')?.addEventListener('click', () => {
        toy.setFrag(MANUAL); toy.setParam(0.5); info.textContent = 'Progress 50% — burning away (noise < progress discarded).';
    });
    document.getElementById('btnDis95')?.addEventListener('click', () => {
        toy.setFrag(MANUAL); toy.setParam(0.95); info.textContent = 'Progress 95% — almost gone.';
    });
    document.getElementById('btnDisAuto')?.addEventListener('click', () => {
        toy.setFrag(AUTO); info.textContent = 'Auto — progress = fract(u_time): a looping death/teleport.';
    });
})();

// =============================================================================
// DEMO 5 — outlineGL  (§ Outline / Rim)
// =============================================================================
(function outlineShader() {
    const canvas = document.getElementById('outlineGL');
    if (!canvas) return;
    const info = document.getElementById('outlineGLInfo');

    // 8-tap alpha dilation around the silhouette. u_param = thickness (texels).
    function buildFrag(color) {
        return GLSL_HEAD + `float silhouette(vec2 s) {
  vec2 px = u_param / u_texResolution;             // texel step * thickness
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
  float ring = clamp(silhouette(s) - tex.a, 0.0, 1.0);  // near but outside
  col = mix(col, ${color}, ring);
  col = mix(col, tex.rgb, tex.a);                        // sprite on top
  gl_FragColor = vec4(col, 1.0);
}`;
    }
    const OFF = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`;
    const CYAN = buildFrag('vec3(0.3, 0.9, 1.0)');
    const GOLD = buildFrag('vec3(1.0, 0.82, 0.25)');

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, OFF, { info: info, sprite: drawSprite, param: 3.0 }));

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
})();

// =============================================================================
// DEMO 6 — hitflashGL  (§ Hit-Flash & Invincibility Blink)
// =============================================================================
(function hitflashShader() {
    const canvas = document.getElementById('hitflashGL');
    if (!canvas) return;
    const info = document.getElementById('hitflashGLInfo');

    const NORMAL = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`;
    // White-out pulse: mix sprite toward white on a fast sine.
    const FLASH = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float f = 0.5 + 0.5 * sin(u_time * 18.0);
  vec3 hit = mix(tex.rgb, vec3(1.0), f);
  gl_FragColor = vec4(mix(backdrop(uv), hit, tex.a), 1.0);
}`;
    // I-frames: blink the sprite's alpha on/off.
    const BLINK = GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float on = step(0.5, fract(u_time * 6.0));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a * on), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, FLASH, { info: info, sprite: drawSprite }));

    document.getElementById('btnHitFlash')?.addEventListener('click', () => {
        toy.setFrag(FLASH); info.textContent = 'Hit flash — mix to white on a fast sine.';
    });
    document.getElementById('btnHitBlink')?.addEventListener('click', () => {
        toy.setFrag(BLINK); info.textContent = 'Invincibility blink — toggle alpha with step(fract(u_time)).';
    });
    document.getElementById('btnHitNormal')?.addEventListener('click', () => {
        toy.setFrag(NORMAL); info.textContent = 'Normal — no damage feedback.';
    });
    // Clicking the canvas re-triggers the flash (the in-game trigger).
    canvas.addEventListener('click', () => {
        toy.setFrag(FLASH); info.textContent = 'Hit! (click the sprite again to re-trigger)';
    });
})();

// =============================================================================
// DEMO 6b — normalmapGL  (§ 2D Normal-Map Lighting)
// Luminance → heightmap → finite-difference normal → Lambert from u_mouse.
// No painted normal map needed for a single sprite. Output mode injected.
// =============================================================================
(function normalmapShader() {
    const canvas = document.getElementById('normalmapGL');
    if (!canvas) return;
    const info = document.getElementById('normalmapGLInfo');

    function buildFrag(out) {
        return GLSL_HEAD + `
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
  vec3 c = ${out};
  gl_FragColor = vec4(mix(backdrop(uv), c, tex.a), 1.0);
}`;
    }

    const OUT = {
        lit:     'tex.rgb * (0.15 + diff) + spec * 0.6',
        normals: 'N * 0.5 + 0.5',
        diffuse: 'vec3(0.15 + diff)',
        flat:    'tex.rgb'
    };

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(OUT.lit), { info: info, sprite: drawSprite }));
    function set(k, msg) { toy.setFrag(buildFrag(OUT[k])); info.textContent = msg; }

    document.getElementById('btnNmLit')?.addEventListener('click', () =>
        set('lit', 'Lit: albedo × (ambient + N·L) + a specular glint. Move the mouse.'));
    document.getElementById('btnNmNormals')?.addEventListener('click', () =>
        set('normals', 'The derived normal as RGB — bright = facing you.'));
    document.getElementById('btnNmDiffuse')?.addEventListener('click', () =>
        set('diffuse', 'Just the N·L term — the raw lighting that wraps the sprite.'));
    document.getElementById('btnNmFlat')?.addEventListener('click', () =>
        set('flat', 'No lighting — flat albedo, for comparison.'));
})();

// =============================================================================
// DEMO 6c — spritesheetGL  (§ Sprite-Sheet Animation)
// Custom 4x4 sheet painter + a time-driven frame-picker that remaps uv into
// the current cell. UNPACK_FLIP_Y → row 0 is the TOP of the sheet.
// =============================================================================
(function spritesheetShader() {
    const canvas = document.getElementById('spritesheetGL');
    if (!canvas) return;
    const info = document.getElementById('spritesheetGLInfo');

    // Paint a 4x4 grid of frames: a gem rotating one notch per cell.
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
        return GLSL_HEAD + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = clamp(toSpriteUV(uv), 0.0, 1.0);
  float frame = mod(floor(u_time * ${fps}), 16.0);
  vec2 cell = vec2(mod(frame, 4.0), floor(frame / 4.0));
  vec2 fuv = (s + vec2(cell.x, 3.0 - cell.y)) / 4.0;
  vec4 tex = texture2D(u_tex, fuv);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`;
    }

    // "Show full sheet" samples the whole atlas (no cell remap).
    const ATLAS = GLSL_HEAD + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s  = clamp(toSpriteUV(uv), 0.0, 1.0);
  vec4 tex = texture2D(u_tex, s);
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`;

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag('8.0'), { info: info, sprite: drawSheet }));

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
})();

// =============================================================================
// DEMO 6d — ditherGL  (§ Dither / Posterize / 1-bit)
// Color quantization + a recursively-built 4x4 Bayer matrix. Mode injected.
// =============================================================================
(function ditherShader() {
    const canvas = document.getElementById('ditherGL');
    if (!canvas) return;
    const info = document.getElementById('ditherGLInfo');

    const LIB = GLSL_HEAD + `
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float B2(vec2 c) { return mix(mix(0.0, 2.0, c.x), mix(3.0, 1.0, c.x), c.y); }
float bayer4(vec2 P) {
  vec2 hi = mod(floor(P * 0.5), 2.0);
  vec2 lo = mod(P, 2.0);
  return (4.0 * B2(hi) + B2(lo)) / 16.0;
}`;

    function buildFrag(mode) {
        return LIB + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tx = texture2D(u_tex, toSpriteUV(uv));
  vec3 col = mix(backdrop(uv), tx.rgb, tx.a);
  vec2 P = floor(gl_FragCoord.xy);
  vec3 outc;
  ${mode}
  gl_FragColor = vec4(outc, 1.0);
}`;
    }

    const MODE = {
        posterize: 'outc = floor(col * 4.0) / 4.0;',
        dither:    'outc = floor(col * 4.0 + bayer4(P)) / 4.0;',
        onebit:    'float L = step(bayer4(P), lum(col));\n  outc = mix(vec3(0.06,0.10,0.06), vec3(0.55,0.80,0.30), L);',
        palette:   'float g = lum(col);\n  g = floor(g * 4.0 + bayer4(P)) / 4.0;\n  outc = mix(vec3(0.06,0.22,0.06), vec3(0.61,0.74,0.06), g);'
    };

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(MODE.dither), { info: info, sprite: drawSprite }));
    function set(k, msg) { toy.setFrag(buildFrag(MODE[k])); info.textContent = msg; }

    document.getElementById('btnDitPosterize')?.addEventListener('click', () =>
        set('posterize', 'Posterize: floor(col * 4) / 4 — hard color bands.'));
    document.getElementById('btnDitDither')?.addEventListener('click', () =>
        set('dither', 'Bayer dither: add the 4×4 threshold first — bands dissolve.'));
    document.getElementById('btnDitOneBit')?.addEventListener('click', () =>
        set('onebit', '1-bit: luminance vs Bayer → two-tone, ordered dither.'));
    document.getElementById('btnDitPalette')?.addEventListener('click', () =>
        set('palette', 'Game Boy: 4 luminance steps mapped to the DMG green ramp.'));
})();

// =============================================================================
// DEMO 7 — hatchGL  (§ Cross-Hatch & Halftone Shading)
// Map sprite luminance → an ink screen: stacked rotated line layers (hatch),
// a rotated dot grid (halftone), or per-pixel ordered dither. Mode is
// structural → setFrag; the screen frequency rides u_param.
// =============================================================================
(function hatchShader() {
    const canvas = document.getElementById('hatchGL');
    if (!canvas) return;
    const info = document.getElementById('hatchGLInfo');

    // Each mode returns `float ink(vec2 px, float L)` — 0 = ink, 1 = paper.
    const INK = {
        hatch: `float ink(vec2 px, float L){
  float F = mix(0.06, 0.16, u_param);
  float k = 1.0;                                  // 1 = paper
  if (L < 0.85) k = min(k, step(0.5, fract((px.x + px.y) * F)));
  if (L < 0.62) k = min(k, step(0.5, fract((px.x - px.y) * F)));
  if (L < 0.40) k = min(k, step(0.5, fract( px.x        * F * 1.4)));
  if (L < 0.20) k = min(k, step(0.5, fract( px.y        * F * 1.4)));
  return k;
}`,
        halftone: `vec2 rot2(vec2 v, float a){ float s=sin(a), c=cos(a); return mat2(c,-s,s,c)*v; }
float ink(vec2 px, float L){
  float F = mix(0.10, 0.30, u_param);
  vec2 cell = fract(rot2(px, 0.46) * F) - 0.5;
  float r = sqrt(1.0 - clamp(L, 0.0, 1.0)) * 0.62; // darker → fatter dot
  return smoothstep(r - 0.06, r + 0.06, length(cell));
}`,
        dither: `float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float ink(vec2 px, float L){ return step(ign(px), L); }` // interleaved-gradient 1-bit
    };

    function buildFrag(mode) {
        return GLSL_HEAD + `${INK[mode]}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  float L = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  float k = ink(gl_FragCoord.xy, L);
  vec3 styl = mix(vec3(0.07, 0.06, 0.10), vec3(0.96, 0.95, 0.90), k);
  gl_FragColor = vec4(mix(backdrop(uv), styl, tex.a), 1.0);
}`;
    }

    const state = { mode: 'hatch' };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state.mode), { info: info, sprite: drawSprite, param: 0.4 }));
    function setMode(m, msg) { state.mode = m; toy.setFrag(buildFrag(m)); info.textContent = msg; }

    document.getElementById('btnHatchHatch')?.addEventListener('click', () =>
        setMode('hatch', 'Cross-hatch: darker luminance unlocks more rotated line layers.'));
    document.getElementById('btnHatchHalf')?.addEventListener('click', () =>
        setMode('halftone', 'Halftone: a rotated dot grid; dot radius grows as it darkens.'));
    document.getElementById('btnHatchDither')?.addEventListener('click', () =>
        setMode('dither', 'Dither: interleaved-gradient-noise threshold → 1-bit ink.'));
    document.getElementById('btnHatchCoarse')?.addEventListener('click', () => {
        toy.setParam(0.95); info.textContent = 'Coarser screen — u_param scales the line/dot frequency.';
    });
})();

// =============================================================================
// DEMO 8 — stylizeGL  (§ Stylized Sprite: ASCII & Oil Paint)
// ASCII: average each grid cell's luminance, draw brightness-keyed strokes
// (a terminal look). Oil: a compact Kuwahara — pick the lowest-variance of
// four quadrant means → painterly flattening. Cell/kernel are structural.
// =============================================================================
(function stylizeShader() {
    const canvas = document.getElementById('stylizeGL');
    if (!canvas) return;
    const info = document.getElementById('stylizeGLInfo');

    function buildFrag(mode, cs, k) {
        const BODY = {
            normal: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 tex = texture2D(u_tex, toSpriteUV(uv));
  gl_FragColor = vec4(mix(backdrop(uv), tex.rgb, tex.a), 1.0);
}`,
            ascii: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  float CS = ${cs}.0;
  vec2 g = s * CS;
  vec2 id = floor(g), f = fract(g);
  vec4 cellTex = texture2D(u_tex, (id + 0.5) / CS);   // one sample per cell
  float L = dot(cellTex.rgb, vec3(0.299, 0.587, 0.114)) * cellTex.a;
  float lvl = floor(L * 5.0);                          // 0..5 "glyph weight"
  float bars = (lvl < 0.5) ? 0.0
    : step(0.5, fract(f.y * lvl + 0.25)) * step(0.12, f.x) * step(f.x, 0.88);
  vec3 styl = mix(vec3(0.04, 0.06, 0.08), vec3(0.40, 0.95, 0.55), bars);
  gl_FragColor = vec4(mix(backdrop(uv), styl, step(0.02, cellTex.a)), 1.0);
}`,
            oil: `const int K = ${k};
void region(vec2 s, vec2 px, vec2 d, out vec3 mean, out float varr){
  vec3 sum = vec3(0.0), sum2 = vec3(0.0); float n = 0.0;
  for (int j = 0; j <= K; j++)
  for (int i = 0; i <= K; i++) {
    vec3 c = texture2D(u_tex, s + d * vec2(float(i), float(j)) * px).rgb;
    sum += c; sum2 += c * c; n += 1.0;
  }
  mean = sum / n;
  vec3 v = sum2 / n - mean * mean;
  varr = v.r + v.g + v.b;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 s = toSpriteUV(uv);
  vec2 px = 1.0 / u_texResolution;
  vec3 mA, mB, mC, mD; float vA, vB, vC, vD;
  region(s, px, vec2( 1.0,  1.0), mA, vA);
  region(s, px, vec2(-1.0,  1.0), mB, vB);
  region(s, px, vec2( 1.0, -1.0), mC, vC);
  region(s, px, vec2(-1.0, -1.0), mD, vD);
  vec3 col = mA; float best = vA;
  if (vB < best) { best = vB; col = mB; }
  if (vC < best) { best = vC; col = mC; }
  if (vD < best) { best = vD; col = mD; }
  float a = texture2D(u_tex, s).a;
  gl_FragColor = vec4(mix(backdrop(uv), col, a), 1.0);
}`
        };
        return GLSL_HEAD + BODY[mode];
    }

    const state = { mode: 'ascii', cs: 30, k: 2 };
    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state.mode, state.cs, state.k), { info: info, sprite: drawSprite }));
    function refresh(msg) { toy.setFrag(buildFrag(state.mode, state.cs, state.k)); info.textContent = msg; }

    document.getElementById('btnStyNormal')?.addEventListener('click', () => {
        state.mode = 'normal'; refresh('Baseline — the raw faceted sprite, no stylization.');
    });
    document.getElementById('btnStyAscii')?.addEventListener('click', () => {
        state.mode = 'ascii'; refresh('ASCII: one luminance sample per cell → brightness-keyed strokes.');
    });
    document.getElementById('btnStyOil')?.addEventListener('click', () => {
        state.mode = 'oil'; refresh('Oil: Kuwahara — the lowest-variance quadrant mean flattens detail.');
    });
    document.getElementById('btnStyCell')?.addEventListener('click', () => {
        state.cs = state.cs >= 44 ? 18 : state.cs + 8;
        state.k = state.k >= 3 ? 1 : state.k + 1;
        refresh('Detail ' + state.cs + ' / kernel ' + state.k + ' — both are shader constants → rebuild.');
    });
})();

// =============================================================================
// DEMO 9 — spriteGL  (§ Mini-Project: Fully Shaded Sprite)
// =============================================================================
(function spriteCapstone() {
    const canvas = document.getElementById('spriteGL');
    if (!canvas) return;
    const info = document.getElementById('spriteGLInfo');

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
            ? `(l < 0.5 ? mix(${pal[0]}, ${pal[1]}, l*2.0) : mix(${pal[1]}, ${pal[2]}, (l-0.5)*2.0))`
            : `tex.rgb`;
        const outlineBlock = s.outline ? `
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
  col = mix(col, vec3(0.3,0.9,1.0), clamp(m - tex.a, 0.0, 1.0));` : '';
        const flashBlock = s.flash
            ? `  spr = mix(spr, vec3(1.0), 0.5 + 0.5 * sin(u_time * 18.0));` : '';
        return GLSL_HEAD + `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 sUV = toSpriteUV(uv);
  vec4 tex = texture2D(u_tex, sUV);
  float l = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  vec3 spr = ${colorExpr};
${flashBlock}
  vec3 col = backdrop(uv);
${outlineBlock}
  col = mix(col, spr, tex.a);
  gl_FragColor = vec4(col, 1.0);
}`;
    }

    const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, buildFrag(state), { info: info, sprite: drawSprite }));
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
})();
