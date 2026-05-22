// =============================================================================
// NOITA SUB-TRACK — ADVANCED TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js: 📋 Export on each `<details data-demo-id="noi_*">`
// copies a runnable single-file HTML. The chunked engine + library are spliced
// into both DEMO_CODE bodies via NOI_ADV_ENGINE_SRC.
//
// Scope: noi_advchunks (chunk overlay + force-all toggle) and noi_advsandbox
// (capstone). noiAdvLibrary and noiAdvTune use sliders / its-own-section UI
// and omit `data-demo-id`.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// The full chunked engine + library, as source text spliced into each
// DEMO_CODE. Standalone exports therefore carry their own copy and need no deps.
const NOI_ADV_ENGINE_SRC = `    const MAT = [], REACTIONS = [];
    function registerMaterial(spec) {
        const id = MAT.length;
        MAT.push(Object.assign({ id: id }, spec));
        return id;
    }
    function registerReaction(a, b, ra, rb) { REACTIONS.push({ a: a, b: b, ra: ra, rb: rb }); }
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
    const CONFIG = { fireIgnite: 0.26, lavaViscosity: 0.45, gasDissipate: 0.01 };

    const CHUNK = 32, WAKE_FRAMES = 8;
    function noiHash(i) {
        let h = (i * 374761393) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
    }
    function makeWorld(W, H) {
        const Wc = Math.ceil(W / CHUNK), Hc = Math.ceil(H / CHUNK);
        return {
            W: W, H: H, Wc: Wc, Hc: Hc,
            grid: new Uint8Array(W * H),
            aux:  new Uint8Array(W * H),
            moved: new Uint8Array(W * H),
            chunkActive: new Uint8Array(Wc * Hc).fill(WAKE_FRAMES)
        };
    }
    function wakeChunk(w, cx, cy) {
        const x0 = Math.max(0, cx - 1), x1 = Math.min(w.Wc - 1, cx + 1);
        const y0 = Math.max(0, cy - 1), y1 = Math.min(w.Hc - 1, cy + 1);
        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++)
                w.chunkActive[y * w.Wc + x] = WAKE_FRAMES;
    }
    function wakeAt(w, x, y) { wakeChunk(w, Math.floor(x / CHUNK), Math.floor(y / CHUNK)); }
    function noiSwap(w, i, j) {
        const tg = w.grid[i]; w.grid[i] = w.grid[j]; w.grid[j] = tg;
        const ta = w.aux[i];  w.aux[i]  = w.aux[j];  w.aux[j]  = ta;
        w.moved[i] = 1; w.moved[j] = 1;
        wakeAt(w, i % w.W, (i / w.W) | 0);
        wakeAt(w, j % w.W, (j / w.W) | 0);
    }
    function tryMove(w, i, tx, ty, canDisplace) {
        if (tx < 0 || tx >= w.W || ty < 0 || ty >= w.H) return false;
        const t = ty * w.W + tx;
        if (w.moved[t]) return false;
        if (!canDisplace(w.grid[t])) return false;
        noiSwap(w, i, t);
        return true;
    }
    function tryReact(w, i, x, y) {
        const m = w.grid[i];
        const nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (let r = 0; r < REACTIONS.length; r++) {
            if (REACTIONS[r].a !== m) continue;
            for (let k = 0; k < 4; k++) {
                const nx = x + nb[k][0], ny = y + nb[k][1];
                if (nx < 0 || nx >= w.W || ny < 0 || ny >= w.H) continue;
                const j = ny * w.W + nx;
                if (w.grid[j] === REACTIONS[r].b) {
                    w.grid[i] = REACTIONS[r].ra; w.grid[j] = REACTIONS[r].rb;
                    wakeAt(w, x, y); wakeAt(w, nx, ny);
                    return true;
                }
            }
        }
        return false;
    }
    function ignite(w, x, y, prob) {
        const nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (let k = 0; k < 4; k++) {
            const nx = x + nb[k][0], ny = y + nb[k][1];
            if (nx < 0 || nx >= w.W || ny < 0 || ny >= w.H) continue;
            const j = ny * w.W + nx;
            const nm = w.grid[j];
            if (MAT[nm] && MAT[nm].flammable && Math.random() < prob) {
                w.grid[j] = FIRE; w.aux[j] = MAT[nm].fuel; wakeAt(w, nx, ny);
            }
        }
    }
    function stepCell(w, i, x, y) {
        if (w.moved[i]) return;
        const m = w.grid[i];
        if (m === AIR || m === STONE || m === WOOD) return;
        if (tryReact(w, i, x, y)) { w.moved[i] = 1; return; }
        const kind = MAT[m].kind;
        if (kind === 'powder') {
            const canD = (t) => t === AIR || MAT[t].kind === 'liquid';
            if (tryMove(w, i, x, y + 1, canD)) return;
            const d = Math.random() < 0.5 ? -1 : 1;
            if (tryMove(w, i, x + d, y + 1, canD)) return;
            tryMove(w, i, x - d, y + 1, canD);
        } else if (kind === 'liquid') {
            if (m === LAVA && Math.random() < CONFIG.lavaViscosity) return;
            const dens = MAT[m].density;
            const canDown = (t) => t === AIR || (MAT[t].kind === 'liquid' && MAT[t].density < dens);
            const canSide = (t) => t === AIR;
            if (tryMove(w, i, x, y + 1, canDown)) {
                if (m === LAVA) ignite(w, x, y, CONFIG.fireIgnite * 0.8);
                return;
            }
            const d = Math.random() < 0.5 ? -1 : 1;
            if (tryMove(w, i, x + d, y + 1, canDown) ||
                tryMove(w, i, x - d, y + 1, canDown) ||
                tryMove(w, i, x + d, y, canSide) ||
                tryMove(w, i, x - d, y, canSide)) {
                if (m === LAVA) ignite(w, x, y, CONFIG.fireIgnite * 0.8);
                return;
            }
            if (m === LAVA) ignite(w, x, y, CONFIG.fireIgnite * 0.8);
        } else if (kind === 'gas') {
            if (Math.random() < CONFIG.gasDissipate) { w.grid[i] = AIR; w.moved[i] = 1; wakeAt(w, x, y); return; }
            const canG = (t) => t === AIR;
            const d = Math.random() < 0.5 ? -1 : 1;
            if (tryMove(w, i, x, y - 1, canG) ||
                tryMove(w, i, x + d, y - 1, canG) ||
                tryMove(w, i, x - d, y - 1, canG) ||
                tryMove(w, i, x + d, y, canG) ||
                tryMove(w, i, x - d, y, canG)) return;
        } else if (kind === 'fire') {
            w.aux[i]--;
            ignite(w, x, y, CONFIG.fireIgnite);
            if (y > 0 && w.grid[i - w.W] === AIR && Math.random() < 0.30) {
                w.grid[i - w.W] = SMOKE; wakeAt(w, x, y - 1);
            }
            if (w.aux[i] <= 0) w.grid[i] = Math.random() < 0.5 ? SMOKE : AIR;
            w.moved[i] = 1; wakeAt(w, x, y);
        }
    }
    function step(w, frame, forceAll) {
        w.moved.fill(0);
        const ltr = (frame & 1) === 0;
        for (let cy = w.Hc - 1; cy >= 0; cy--) {
            for (let cx = 0; cx < w.Wc; cx++) {
                if (!forceAll && w.chunkActive[cy * w.Wc + cx] === 0) continue;
                const x0 = cx * CHUNK, x1 = Math.min(w.W, x0 + CHUNK);
                const y0 = cy * CHUNK, y1 = Math.min(w.H, y0 + CHUNK);
                for (let y = y1 - 1; y >= y0; y--)
                    for (let k = 0; k < (x1 - x0); k++) {
                        const x = ltr ? x0 + k : x1 - 1 - k;
                        stepCell(w, y * w.W + x, x, y);
                    }
            }
        }
        for (let c = 0; c < w.chunkActive.length; c++) if (w.chunkActive[c] > 0) w.chunkActive[c]--;
    }
    function awakeCount(w) {
        let n = 0;
        for (let i = 0; i < w.chunkActive.length; i++) if (w.chunkActive[i] > 0) n++;
        return n;
    }
    function paint(w, cx, cy, r, mat) {
        for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const x = cx + dx, y = cy + dy;
                if (x < 0 || x >= w.W || y < 0 || y >= w.H) continue;
                const i = y * w.W + x;
                w.grid[i] = mat;
                if (mat === FIRE) w.aux[i] = 40;
                wakeAt(w, x, y);
            }
    }
    function makeRenderer(canvas, W, H) {
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
    function drawChunkOverlay(ctx, w, canvas) {
        const cellW = canvas.width / w.W * CHUNK;
        const cellH = canvas.height / w.H * CHUNK;
        for (let cy = 0; cy < w.Hc; cy++)
            for (let cx = 0; cx < w.Wc; cx++) {
                const a = w.chunkActive[cy * w.Wc + cx];
                ctx.fillStyle = a > 0 ? 'rgba(102,187,106,0.10)' : 'rgba(239,83,80,0.16)';
                ctx.fillRect(cx * cellW, cy * cellH, cellW, cellH);
                ctx.strokeStyle = a > 0 ? 'rgba(102,187,106,0.55)' : 'rgba(239,83,80,0.30)';
                ctx.lineWidth = 1;
                ctx.strokeRect(cx * cellW + 0.5, cy * cellH + 0.5, cellW, cellH);
            }
    }
    function mouseCell(canvas, e, W, H) {
        const r = canvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX - r.left) / r.width * W),
            y: Math.floor((e.clientY - r.top) / r.height * H)
        };
    }
    function wirePalette(pairs, onSelect) {
        function select(id, mat) {
            pairs.forEach(function (p) {
                const b = document.getElementById(p[0]);
                if (b) b.classList.toggle('active', p[0] === id);
            });
            onSelect(mat);
        }
        pairs.forEach(function (p) {
            const b = document.getElementById(p[0]);
            if (b) b.addEventListener('click', function () { select(p[0], p[1]); });
        });
        if (pairs.length) select(pairs[0][0], pairs[0][1]);
    }`;

// =============================================================================
// DEMO — noi_advchunks: visualise sleeping chunks; FPS + force-all toggle
// =============================================================================
DEMO_HTML.noi_advchunks = {
    title: 'Noita — Sleeping Chunks',
    canvas: { width: 720, height: 420 },
    controls: [
        { id: 'btnAdvChunksForce', text: 'Chunked: ON' },
        { id: 'btnAdvChunksSand',  text: '🟡 Sand' },
        { id: 'btnAdvChunksWater', text: '💧 Water' },
        { id: 'btnAdvChunksWall',  text: '⬜ Wall' },
        { id: 'btnAdvChunksErase', text: '🧽 Erase' },
        { id: 'btnAdvChunksReset', text: 'Reset' }
    ],
    info: 'Pour sand and watch the chunks light up.'
};

DEMO_CODE.noi_advchunks = `(function noiAdvChunksDemo() {
${NOI_ADV_ENGINE_SRC}

    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    const W = 360, H = 210;
    const w = makeWorld(W, H);
    const render = makeRenderer(canvas, W, H);
    let frame = 0, drawing = false, mouse = null, tool = SAND;
    let forceAll = false, avgDt = 16.7, lastT = 0, avgStepMs = 0;

    function build() {
        for (let x = 0; x < W; x++) { w.grid[(H - 1) * W + x] = STONE; w.grid[(H - 2) * W + x] = STONE; }
        for (let y = H - 40; y < H - 2; y++) {
            w.grid[y * W + ((W >> 1) - 40)] = STONE;
            w.grid[y * W + ((W >> 1) + 40)] = STONE;
        }
        w.chunkActive.fill(WAKE_FRAMES);
    }
    build();

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = mouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = mouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });

    wirePalette([
        ['btnAdvChunksSand', SAND], ['btnAdvChunksWater', WATER],
        ['btnAdvChunksWall', STONE], ['btnAdvChunksErase', AIR]
    ], (m) => { tool = m; });
    document.getElementById('btnAdvChunksForce').addEventListener('click', () => {
        forceAll = !forceAll;
        document.getElementById('btnAdvChunksForce').textContent =
            forceAll ? 'Chunked: OFF (force all)' : 'Chunked: ON';
    });
    document.getElementById('btnAdvChunksReset').addEventListener('click', () => {
        w.grid.fill(AIR); w.aux.fill(0); build();
    });

    function loop() {
        const t = performance.now();
        if (lastT) avgDt = avgDt * 0.92 + (t - lastT) * 0.08;
        lastT = t;
        if (drawing && mouse) paint(w, mouse.x, mouse.y, 4, tool);
        const sT0 = performance.now();
        step(w, frame++, forceAll);
        avgStepMs = avgStepMs * 0.92 + (performance.now() - sT0) * 0.08;
        const ctx = render(w.grid, frame);
        drawChunkOverlay(ctx, w, canvas);
        const a = awakeCount(w), total = w.Wc * w.Hc;
        info.textContent = 'step ' + avgStepMs.toFixed(2) + ' ms · FPS ' + (1000 / avgDt).toFixed(0) +
            ' · ' + (forceAll ? ('FORCE-ALL: stepping all ' + total + ' chunks')
                              : ('CHUNKED: ' + a + '/' + total + ' chunks awake (skipping ' + (total - a) + ')')) +
            ' · ' + (W * H).toLocaleString() + ' cells';
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.noi_advchunks = DEMO_CODE.noi_advchunks;

// =============================================================================
// DEMO — noi_advsandbox: the full capstone
// =============================================================================
DEMO_HTML.noi_advsandbox = {
    title: 'Noita — Performant Sandbox',
    canvas: { width: 720, height: 420 },
    controls: [
        { id: 'btnAdvSbSand',  text: '🟡 Sand' },
        { id: 'btnAdvSbWater', text: '💧 Water' },
        { id: 'btnAdvSbOil',   text: '🛢️ Oil' },
        { id: 'btnAdvSbLava',  text: '🌋 Lava' },
        { id: 'btnAdvSbWood',  text: '🟫 Wood' },
        { id: 'btnAdvSbFire',  text: '🔥 Fire' },
        { id: 'btnAdvSbWall',  text: '⬜ Wall' },
        { id: 'btnAdvSbErase', text: '🧽 Erase' },
        { id: 'btnAdvSbClear', text: 'Clear' }
    ],
    info: 'Paint and play.'
};

DEMO_CODE.noi_advsandbox = `(function noiAdvSandboxDemo() {
${NOI_ADV_ENGINE_SRC}

    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    const W = 360, H = 210;
    const w = makeWorld(W, H);
    const render = makeRenderer(canvas, W, H);
    let frame = 0, drawing = false, mouse = null, tool = SAND;
    let avgDt = 16.7, lastT = 0;

    function build() {
        for (let x = 0; x < W; x++) { w.grid[(H - 1) * W + x] = STONE; w.grid[(H - 2) * W + x] = STONE; }
        w.chunkActive.fill(WAKE_FRAMES);
    }
    build();

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = mouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = mouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    wirePalette([
        ['btnAdvSbSand', SAND], ['btnAdvSbWater', WATER], ['btnAdvSbOil', OIL], ['btnAdvSbLava', LAVA],
        ['btnAdvSbWood', WOOD], ['btnAdvSbFire', FIRE], ['btnAdvSbWall', STONE], ['btnAdvSbErase', AIR]
    ], (m) => { tool = m; });
    document.getElementById('btnAdvSbClear').addEventListener('click', () => {
        w.grid.fill(AIR); w.aux.fill(0); build();
    });

    function loop() {
        const t = performance.now();
        if (lastT) avgDt = avgDt * 0.92 + (t - lastT) * 0.08;
        lastT = t;
        if (drawing && mouse) paint(w, mouse.x, mouse.y, 5, tool);
        step(w, frame++);
        render(w.grid, frame);
        const a = awakeCount(w);
        info.textContent = 'FPS ' + (1000 / avgDt).toFixed(0) +
            ' · ' + a + '/' + (w.Wc * w.Hc) + ' chunks awake · ' +
            (W * H).toLocaleString() + ' cells · ' + MAT.length + ' materials';
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.noi_advsandbox = DEMO_CODE.noi_advsandbox;
