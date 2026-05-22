// =============================================================================
// NOITA SUB-TRACK — ADVANCED TIER DEMOS
// ("Performance, Material Library & Sandbox")
// =============================================================================
// The Intermediate tier's engine touched every cell every frame. This tier:
//   1. Partitions the grid into 32×32 CHUNKS; only "awake" chunks step. A chunk
//      wakes when anything in it moves (and wakes its 8 neighbours, so motion
//      crossing borders is caught), then sleeps after N quiet frames.
//   2. Treats materials as a LIBRARY — registerMaterial() / registerReaction()
//      add a row at runtime; the engine reads only properties, never names.
//   3. Exposes a live CONFIG so rule parameters (fire ignite prob, lava
//      viscosity, gas dissipation) can be tuned from sliders.
//
// Self-contained file. Names are deliberately noi*/NOI_* / *Adv* to stay clear
// of shared/utils.js globals (the lerp-collision lesson from the Simulations
// tier still in force).
// =============================================================================

(function noiAdvScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// =============================================================================
// THE LIBRARY — materials and reactions registered at module load
// =============================================================================
// MAT and REACTIONS are mutable; the engine only ever reads .kind / .density /
// .flammable / .fuel / .color, never names. Adding "acid" is one call.

const MAT = [];
const REACTIONS = [];

function registerMaterial(spec) {
    const id = MAT.length;
    MAT.push(Object.assign({ id }, spec));
    return id;
}
function registerReaction(a, b, ra, rb) {
    REACTIONS.push({ a, b, ra, rb });
}

// The standard ten — same identities as the Intermediate tier.
const AIR   = registerMaterial({ name: 'air',   kind: 'air',    color: [13, 17, 30]  });
const STONE = registerMaterial({ name: 'stone', kind: 'solid',  color: [92, 96, 108] });
const SAND  = registerMaterial({ name: 'sand',  kind: 'powder', color: [206, 180, 110] });
const WATER = registerMaterial({ name: 'water', kind: 'liquid', density: 3, color: [60, 120, 210] });
const OIL   = registerMaterial({ name: 'oil',   kind: 'liquid', density: 2, color: [70, 56, 40],
                                 flammable: true, fuel: 60 });
const LAVA  = registerMaterial({ name: 'lava',  kind: 'liquid', density: 7, color: [220, 95, 30] });
const WOOD  = registerMaterial({ name: 'wood',  kind: 'solid',  color: [120, 78, 42],
                                 flammable: true, fuel: 150 });
const FIRE  = registerMaterial({ name: 'fire',  kind: 'fire',   color: [255, 150, 40] });
const SMOKE = registerMaterial({ name: 'smoke', kind: 'gas',    color: [70, 70, 78] });
const STEAM = registerMaterial({ name: 'steam', kind: 'gas',    color: [200, 210, 222] });

registerReaction(WATER, LAVA, STEAM, STONE);
registerReaction(WATER, FIRE, STEAM, AIR);

// Live-tunable rule parameters. Sliders write here; engine reads each frame.
const CONFIG = {
    fireIgnite: 0.26,       // probability a flammable neighbour ignites per frame
    lavaViscosity: 0.45,    // probability lava SKIPS its move (higher = slower)
    gasDissipate: 0.01      // probability a gas cell vanishes per frame
};

// =============================================================================
// HELPERS
// =============================================================================

function noiHash(i) {
    let h = (i * 374761393) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}

function noiMouseCell(canvas, e, W, H) {
    const r = canvas.getBoundingClientRect();
    return {
        x: Math.floor((e.clientX - r.left) / r.width * W),
        y: Math.floor((e.clientY - r.top) / r.height * H)
    };
}

// =============================================================================
// THE CHUNKED ENGINE
// =============================================================================
// A "world" object packages grid + aux + moved + chunkActive + dimensions. The
// step function only iterates chunks whose chunkActive > 0.

const CHUNK = 32;
const WAKE_FRAMES = 8;   // chunks stay alive this many frames after last activity

function noiAdvMakeWorld(W, H) {
    const Wc = Math.ceil(W / CHUNK), Hc = Math.ceil(H / CHUNK);
    return {
        W, H, Wc, Hc,
        grid:        new Uint8Array(W * H),
        aux:         new Uint8Array(W * H),
        moved:       new Uint8Array(W * H),
        chunkActive: new Uint8Array(Wc * Hc).fill(WAKE_FRAMES)  // start fully awake
    };
}

function noiAdvWakeChunk(w, cx, cy) {
    // Wake the 3×3 neighbourhood so cells crossing a chunk border are caught.
    const x0 = Math.max(0, cx - 1), x1 = Math.min(w.Wc - 1, cx + 1);
    const y0 = Math.max(0, cy - 1), y1 = Math.min(w.Hc - 1, cy + 1);
    for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
            w.chunkActive[y * w.Wc + x] = WAKE_FRAMES;
}
function noiAdvWakeAt(w, x, y) {
    noiAdvWakeChunk(w, Math.floor(x / CHUNK), Math.floor(y / CHUNK));
}

// Swap two cells + their aux, mark both moved, wake both chunks.
function noiAdvSwap(w, i, j) {
    const g = w.grid, aux = w.aux, moved = w.moved;
    const tg = g[i]; g[i] = g[j]; g[j] = tg;
    const ta = aux[i]; aux[i] = aux[j]; aux[j] = ta;
    moved[i] = 1; moved[j] = 1;
    const W = w.W;
    noiAdvWakeAt(w, i % W, (i / W) | 0);
    noiAdvWakeAt(w, j % W, (j / W) | 0);
}
function noiAdvTryMove(w, i, tx, ty, canDisplace) {
    if (tx < 0 || tx >= w.W || ty < 0 || ty >= w.H) return false;
    const t = ty * w.W + tx;
    if (w.moved[t]) return false;
    if (!canDisplace(w.grid[t])) return false;
    noiAdvSwap(w, i, t);
    return true;
}
function noiAdvReact(w, i, x, y) {
    const m = w.grid[i];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let r = 0; r < REACTIONS.length; r++) {
        if (REACTIONS[r].a !== m) continue;
        for (let k = 0; k < 4; k++) {
            const nx = x + nb[k][0], ny = y + nb[k][1];
            if (nx < 0 || nx >= w.W || ny < 0 || ny >= w.H) continue;
            const j = ny * w.W + nx;
            if (w.grid[j] === REACTIONS[r].b) {
                w.grid[i] = REACTIONS[r].ra;
                w.grid[j] = REACTIONS[r].rb;
                noiAdvWakeAt(w, x, y);
                noiAdvWakeAt(w, nx, ny);
                return true;
            }
        }
    }
    return false;
}
function noiAdvIgnite(w, x, y, prob) {
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < 4; k++) {
        const nx = x + nb[k][0], ny = y + nb[k][1];
        if (nx < 0 || nx >= w.W || ny < 0 || ny >= w.H) continue;
        const j = ny * w.W + nx;
        const nm = w.grid[j];
        if (MAT[nm] && MAT[nm].flammable && Math.random() < prob) {
            w.grid[j] = FIRE;
            w.aux[j] = MAT[nm].fuel;
            noiAdvWakeAt(w, nx, ny);
        }
    }
}

// Per-cell dispatch — same behaviour as Intermediate, but every move
// implicitly wakes the affected chunks via noiAdvSwap.
function noiAdvStepCell(w, i, x, y) {
    if (w.moved[i]) return;
    const m = w.grid[i];
    if (m === AIR || m === STONE || m === WOOD) return;
    if (noiAdvReact(w, i, x, y)) { w.moved[i] = 1; return; }

    const kind = MAT[m].kind;
    if (kind === 'powder') {
        const canD = (t) => t === AIR || MAT[t].kind === 'liquid';
        if (noiAdvTryMove(w, i, x, y + 1, canD)) return;
        const d = Math.random() < 0.5 ? -1 : 1;
        if (noiAdvTryMove(w, i, x + d, y + 1, canD)) return;
        noiAdvTryMove(w, i, x - d, y + 1, canD);
    } else if (kind === 'liquid') {
        if (m === LAVA && Math.random() < CONFIG.lavaViscosity) return;
        const dens = MAT[m].density;
        const canDown = (t) => t === AIR || (MAT[t].kind === 'liquid' && MAT[t].density < dens);
        const canSide = (t) => t === AIR;
        if (noiAdvTryMove(w, i, x, y + 1, canDown)) {
            if (m === LAVA) noiAdvIgnite(w, x, y, CONFIG.fireIgnite * 0.8);
            return;
        }
        const d = Math.random() < 0.5 ? -1 : 1;
        if (noiAdvTryMove(w, i, x + d, y + 1, canDown) ||
            noiAdvTryMove(w, i, x - d, y + 1, canDown) ||
            noiAdvTryMove(w, i, x + d, y, canSide) ||
            noiAdvTryMove(w, i, x - d, y, canSide)) {
            if (m === LAVA) noiAdvIgnite(w, x, y, CONFIG.fireIgnite * 0.8);
            return;
        }
        if (m === LAVA) noiAdvIgnite(w, x, y, CONFIG.fireIgnite * 0.8);
    } else if (kind === 'gas') {
        if (Math.random() < CONFIG.gasDissipate) { w.grid[i] = AIR; w.moved[i] = 1; noiAdvWakeAt(w, x, y); return; }
        const canG = (t) => t === AIR;
        const d = Math.random() < 0.5 ? -1 : 1;
        if (noiAdvTryMove(w, i, x, y - 1, canG) ||
            noiAdvTryMove(w, i, x + d, y - 1, canG) ||
            noiAdvTryMove(w, i, x - d, y - 1, canG) ||
            noiAdvTryMove(w, i, x + d, y, canG) ||
            noiAdvTryMove(w, i, x - d, y, canG)) return;
    } else if (kind === 'fire') {
        w.aux[i]--;
        noiAdvIgnite(w, x, y, CONFIG.fireIgnite);
        if (y > 0 && w.grid[i - w.W] === AIR && Math.random() < 0.30) {
            w.grid[i - w.W] = SMOKE; noiAdvWakeAt(w, x, y - 1);
        }
        if (w.aux[i] <= 0) { w.grid[i] = Math.random() < 0.5 ? SMOKE : AIR; }
        w.moved[i] = 1;
        noiAdvWakeAt(w, x, y);
    }
}

// One full step, honouring the chunkActive map (if `forceAll`, step every cell).
function noiAdvStep(w, frame, forceAll) {
    w.moved.fill(0);
    const ltr = (frame & 1) === 0;
    const W = w.W;
    for (let cy = w.Hc - 1; cy >= 0; cy--) {
        for (let cx = 0; cx < w.Wc; cx++) {
            const ci = cy * w.Wc + cx;
            if (!forceAll && w.chunkActive[ci] === 0) continue;
            const x0 = cx * CHUNK;
            const x1 = Math.min(W, x0 + CHUNK);
            const y0 = cy * CHUNK;
            const y1 = Math.min(w.H, y0 + CHUNK);
            for (let y = y1 - 1; y >= y0; y--) {
                for (let k = 0; k < (x1 - x0); k++) {
                    const x = ltr ? x0 + k : x1 - 1 - k;
                    noiAdvStepCell(w, y * W + x, x, y);
                }
            }
        }
    }
    // Tick down quiet chunks; the swaps during the step have re-woken active ones.
    for (let c = 0; c < w.chunkActive.length; c++) {
        if (w.chunkActive[c] > 0) w.chunkActive[c]--;
    }
}

// Count of currently-awake chunks — for the demo's perf overlay.
function noiAdvAwakeCount(w) {
    let n = 0;
    for (let i = 0; i < w.chunkActive.length; i++) if (w.chunkActive[i] > 0) n++;
    return n;
}

// Stamp a disc of material — wakes the painted chunks.
function noiAdvPaint(w, cx, cy, r, mat) {
    for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || x >= w.W || y < 0 || y >= w.H) continue;
            const i = y * w.W + x;
            w.grid[i] = mat;
            if (mat === FIRE) w.aux[i] = 40;
            noiAdvWakeAt(w, x, y);
        }
}

// =============================================================================
// RENDERING
// =============================================================================

function noiAdvMakeRenderer(canvas, W, H) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const offCtx = off.getContext('2d');
    const img = offCtx.createImageData(W, H);
    const data = img.data;
    return function render(grid, frame) {
        for (let i = 0; i < grid.length; i++) {
            const p = i << 2;
            const m = grid[i];
            const base = MAT[m].color;
            let r = base[0], gg = base[1], b = base[2];
            if (MAT[m].kind === 'fire') {
                const f = noiHash(i + frame * 7);
                r = 255; gg = 120 + (f * 110 | 0); b = 20 + (f * 40 | 0);
            } else if (MAT[m].kind === 'powder' || MAT[m].kind === 'liquid') {
                const j = (noiHash(i) * 22 - 11) | 0;
                r += j; gg += j; b += j;
            }
            data[p] = r; data[p + 1] = gg; data[p + 2] = b; data[p + 3] = 255;
        }
        offCtx.putImageData(img, 0, 0);
        ctx.drawImage(off, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
        return ctx;
    };
}

// Overlay the chunk grid + colour each cell by its awake-ness.
function noiAdvDrawChunkOverlay(ctx, w, canvas) {
    const cellW = canvas.width / w.W * CHUNK;
    const cellH = canvas.height / w.H * CHUNK;
    for (let cy = 0; cy < w.Hc; cy++) {
        for (let cx = 0; cx < w.Wc; cx++) {
            const a = w.chunkActive[cy * w.Wc + cx];
            ctx.fillStyle = a > 0 ? 'rgba(102,187,106,0.10)' : 'rgba(239,83,80,0.16)';
            ctx.fillRect(cx * cellW, cy * cellH, cellW, cellH);
            ctx.strokeStyle = a > 0 ? 'rgba(102,187,106,0.55)' : 'rgba(239,83,80,0.30)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx * cellW + 0.5, cy * cellH + 0.5, cellW, cellH);
        }
    }
}

// Wire up a palette — same pattern as the Intermediate tier.
function noiAdvWirePalette(pairs, onSelect) {
    function select(id, mat) {
        pairs.forEach(([bid]) => {
            const b = document.getElementById(bid);
            if (b) b.classList.toggle('active', bid === id);
        });
        onSelect(mat);
    }
    pairs.forEach(([id, mat]) => {
        const b = document.getElementById(id);
        if (b) b.addEventListener('click', () => select(id, mat));
    });
    if (pairs.length) select(pairs[0][0], pairs[0][1]);
}

// =============================================================================
// DEMO 1 — noiAdvChunks: visualise sleeping chunks; toggle "force all awake"
// =============================================================================
(function noiAdvChunksDemo() {
    const canvas = document.getElementById('noiAdvChunks');
    if (!canvas) return;
    const info = document.getElementById('noiAdvChunksInfo');

    const W = 360, H = 210;
    const w = noiAdvMakeWorld(W, H);
    const render = noiAdvMakeRenderer(canvas, W, H);
    let frame = 0, drawing = false, mouse = null, tool = SAND;
    let forceAll = false;
    let avgDt = 16.7, lastT = 0, avgStepMs = 0;

    // A pre-built scene with a sand source so there's always some active region.
    function build() {
        for (let x = 0; x < W; x++) { w.grid[(H - 1) * W + x] = STONE; w.grid[(H - 2) * W + x] = STONE; }
        // A stone funnel near the centre.
        for (let y = H - 40; y < H - 2; y++) {
            w.grid[y * W + (W / 2 - 40 | 0)] = STONE;
            w.grid[y * W + (W / 2 + 40 | 0)] = STONE;
        }
        w.chunkActive.fill(WAKE_FRAMES);  // start awake; settles into sleep
    }
    build();

    function loop() {
        const t = performance.now();
        if (lastT) avgDt = avgDt * 0.92 + (t - lastT) * 0.08;
        lastT = t;
        if (drawing && mouse) noiAdvPaint(w, mouse.x, mouse.y, 4, tool);
        // Measure step() in isolation — render time is the same in both modes,
        // so the chunking win shows up here, not in FPS once both clear the budget.
        const sT0 = performance.now();
        noiAdvStep(w, frame++, forceAll);
        avgStepMs = avgStepMs * 0.92 + (performance.now() - sT0) * 0.08;
        const ctx = render(w.grid, frame);
        noiAdvDrawChunkOverlay(ctx, w, canvas);
        const awake = noiAdvAwakeCount(w);
        const total = w.Wc * w.Hc;
        info.innerHTML =
            `<strong>step ${avgStepMs.toFixed(2)} ms</strong> · FPS ${(1000 / avgDt).toFixed(0)} · ` +
            (forceAll ? `<span style="color:#ef5350">FORCE-ALL: stepping all ${total} chunks</span>` :
                        `<span style="color:#66bb6a">CHUNKED: ${awake}/${total} chunks awake</span> ` +
                        `(skipping ${total - awake})`) +
            ` · ${(W * H).toLocaleString()} cells`;
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });

    noiAdvWirePalette([
        ['btnAdvChunksSand', SAND], ['btnAdvChunksWater', WATER],
        ['btnAdvChunksWall', STONE], ['btnAdvChunksErase', AIR]
    ], (m) => { tool = m; });
    document.getElementById('btnAdvChunksForce').addEventListener('click', () => {
        forceAll = !forceAll;
        document.getElementById('btnAdvChunksForce').textContent =
            forceAll ? 'Chunked: OFF (force all)' : 'Chunked: ON';
        document.getElementById('btnAdvChunksForce').classList.toggle('active', !forceAll);
    });
    document.getElementById('btnAdvChunksReset').addEventListener('click', () => {
        w.grid.fill(AIR); w.aux.fill(0); build();
    });
    document.getElementById('btnAdvChunksForce').classList.add('active');

    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 2 — noiAdvLibrary: add a new material at runtime via registerMaterial
// =============================================================================
(function noiAdvLibraryDemo() {
    const canvas = document.getElementById('noiAdvLibrary');
    if (!canvas) return;
    const info = document.getElementById('noiAdvLibraryInfo');

    // The library demo's headline: register ACID + a reaction, no engine edit.
    const ACID = registerMaterial({
        name: 'acid', kind: 'liquid', density: 4, color: [120, 200, 80]
    });
    registerReaction(ACID, STONE, SMOKE, AIR);   // acid dissolves stone into smoke

    const W = 240, H = 150;
    const w = noiAdvMakeWorld(W, H);
    const render = noiAdvMakeRenderer(canvas, W, H);
    let frame = 0, drawing = false, mouse = null, tool = ACID;

    function build() {
        for (let x = 0; x < W; x++) { w.grid[(H - 1) * W + x] = STONE; w.grid[(H - 2) * W + x] = STONE; }
        // A stone block to dissolve.
        for (let y = 70; y < H - 2; y++)
            for (let x = 80; x < 160; x++) w.grid[y * W + x] = STONE;
        w.chunkActive.fill(WAKE_FRAMES);
    }
    build();

    function loop() {
        if (drawing && mouse) noiAdvPaint(w, mouse.x, mouse.y, 4, tool);
        noiAdvStep(w, frame++);
        render(w.grid, frame);
        info.innerHTML = `materials registered: <strong>${MAT.length}</strong> · ` +
            `reactions: <strong>${REACTIONS.length}</strong> · ` +
            `🟢 pour <strong>acid</strong> on the stone — added via <code>registerMaterial()</code>, ` +
            `it dissolves into smoke through one new reaction row`;
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });

    noiAdvWirePalette([
        ['btnAdvLibAcid', ACID], ['btnAdvLibWater', WATER],
        ['btnAdvLibStone', STONE], ['btnAdvLibErase', AIR]
    ], (m) => { tool = m; });
    document.getElementById('btnAdvLibReset').addEventListener('click', () => {
        w.grid.fill(AIR); w.aux.fill(0); build();
    });

    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 3 — noiAdvTune: sliders that adjust CONFIG live
// =============================================================================
(function noiAdvTuneDemo() {
    const canvas = document.getElementById('noiAdvTune');
    if (!canvas) return;
    const info = document.getElementById('noiAdvTuneInfo');

    const W = 240, H = 150;
    const w = noiAdvMakeWorld(W, H);
    const render = noiAdvMakeRenderer(canvas, W, H);
    let frame = 0;

    function build() {
        for (let x = 0; x < W; x++) { w.grid[(H - 1) * W + x] = STONE; w.grid[(H - 2) * W + x] = STONE; }
        // Wooden cluster on the left, lava pool on the right — both react to CONFIG.
        for (let y = 60; y < H - 2; y++)
            for (let x = 30; x < 90; x++) w.grid[y * W + x] = (x + y) % 3 ? WOOD : AIR;
        for (let y = H - 18; y < H - 2; y++)
            for (let x = 130; x < 220; x++) w.grid[y * W + x] = LAVA;
        // A starter spark on the wood.
        for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
            const i = (62 + dy) * W + (60 + dx);
            w.grid[i] = FIRE; w.aux[i] = 40;
        }
        w.chunkActive.fill(WAKE_FRAMES);
    }
    build();

    const slIgnite = document.getElementById('voxAdvIgnite');
    const slVisc   = document.getElementById('voxAdvVisc');
    const slDiss   = document.getElementById('voxAdvDiss');
    const vIgnite  = document.getElementById('voxAdvIgniteValue');
    const vVisc    = document.getElementById('voxAdvViscValue');
    const vDiss    = document.getElementById('voxAdvDissValue');
    function readSliders() {
        CONFIG.fireIgnite = parseInt(slIgnite.value, 10) / 100;
        CONFIG.lavaViscosity = parseInt(slVisc.value, 10) / 100;
        CONFIG.gasDissipate = parseInt(slDiss.value, 10) / 1000;
        vIgnite.textContent = CONFIG.fireIgnite.toFixed(2);
        vVisc.textContent   = CONFIG.lavaViscosity.toFixed(2);
        vDiss.textContent   = CONFIG.gasDissipate.toFixed(3);
    }
    [slIgnite, slVisc, slDiss].forEach(s => s.addEventListener('input', readSliders));
    document.getElementById('btnAdvTuneReset').addEventListener('click', () => {
        w.grid.fill(AIR); w.aux.fill(0); build();
    });
    readSliders();

    function loop() {
        noiAdvStep(w, frame++);
        render(w.grid, frame);
        info.innerHTML = `ignite <strong>${CONFIG.fireIgnite.toFixed(2)}</strong> · ` +
            `lava viscosity <strong>${CONFIG.lavaViscosity.toFixed(2)}</strong> · ` +
            `gas dissipate <strong>${CONFIG.gasDissipate.toFixed(3)}</strong> — ` +
            `live parameters; rules read CONFIG each frame`;
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 4 — noiAdvSandbox: capstone — chunked engine + every material
// =============================================================================
(function noiAdvSandboxDemo() {
    const canvas = document.getElementById('noiAdvSandbox');
    if (!canvas) return;
    const info = document.getElementById('noiAdvSandboxInfo');

    const W = 360, H = 210;
    const w = noiAdvMakeWorld(W, H);
    const render = noiAdvMakeRenderer(canvas, W, H);
    let frame = 0, drawing = false, mouse = null, tool = SAND;
    let avgDt = 16.7, lastT = 0;

    function build() {
        for (let x = 0; x < W; x++) { w.grid[(H - 1) * W + x] = STONE; w.grid[(H - 2) * W + x] = STONE; }
        w.chunkActive.fill(WAKE_FRAMES);
    }
    build();

    function loop() {
        const t = performance.now();
        if (lastT) avgDt = avgDt * 0.92 + (t - lastT) * 0.08;
        lastT = t;
        if (drawing && mouse) noiAdvPaint(w, mouse.x, mouse.y, 5, tool);
        noiAdvStep(w, frame++);
        render(w.grid, frame);
        const awake = noiAdvAwakeCount(w);
        info.innerHTML =
            `<strong>FPS ${(1000 / avgDt).toFixed(0)}</strong> · ` +
            `${awake}/${w.Wc * w.Hc} chunks awake · ` +
            `${(W * H).toLocaleString()} cells · ` +
            `${MAT.length} materials registered (including the library demo's Acid)`;
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    noiAdvWirePalette([
        ['btnAdvSbSand', SAND], ['btnAdvSbWater', WATER], ['btnAdvSbOil', OIL], ['btnAdvSbLava', LAVA],
        ['btnAdvSbWood', WOOD], ['btnAdvSbFire', FIRE], ['btnAdvSbWall', STONE], ['btnAdvSbErase', AIR]
    ], (m) => { tool = m; });
    document.getElementById('btnAdvSbClear').addEventListener('click', () => {
        w.grid.fill(AIR); w.aux.fill(0); build();
    });

    requestAnimationFrame(loop);
})();
