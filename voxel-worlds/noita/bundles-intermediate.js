// =============================================================================
// NOITA SUB-TRACK — INTERMEDIATE TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js: the 📋 Export button on each
// `<details data-demo-id="noi_*">` copies a runnable single-file HTML.
//
// Canvas-ID convention: the standalone scaffold hardcodes `<canvas id="canvas">`
// and `<div id="info">`; the DEMO_CODE strings below target those fixed IDs.
//
// Scope: the two button-only demos representative of the tier are bundled —
// noi_fire and noi_sandbox. The multi-material engine is shared between them
// via the NOI_ENGINE_SRC string, spliced into each DEMO_CODE so every export
// is fully self-contained (empty `data-deps`).
//
// TypeScript: DEMO_CODE_TS aliases the JS forms — plain JS is valid TS.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// The full multi-material cellular-automaton engine, as source — spliced into
// both DEMO_CODE bodies so each standalone export carries its own copy.
const NOI_ENGINE_SRC = `    const AIR = 0, STONE = 1, SAND = 2, WATER = 3, OIL = 4,
          LAVA = 5, WOOD = 6, FIRE = 7, SMOKE = 8, STEAM = 9;
    const MAT = [
        { name: 'air',   kind: 'air',    color: [13, 17, 30]  },
        { name: 'stone', kind: 'solid',  color: [92, 96, 108] },
        { name: 'sand',  kind: 'powder', color: [206, 180, 110] },
        { name: 'water', kind: 'liquid', density: 3, color: [60, 120, 210] },
        { name: 'oil',   kind: 'liquid', density: 2, color: [70, 56, 40], flammable: true, fuel: 60 },
        { name: 'lava',  kind: 'liquid', density: 7, color: [220, 95, 30] },
        { name: 'wood',  kind: 'solid',  color: [120, 78, 42], flammable: true, fuel: 150 },
        { name: 'fire',  kind: 'fire',   color: [255, 150, 40] },
        { name: 'smoke', kind: 'gas',    color: [70, 70, 78] },
        { name: 'steam', kind: 'gas',    color: [200, 210, 222] }
    ];
    const REACTIONS = [
        { a: WATER, b: LAVA, ra: STEAM, rb: STONE },
        { a: WATER, b: FIRE, ra: STEAM, rb: AIR   }
    ];
    function noiHash(i) {
        let h = (i * 374761393) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
    }
    function noiSwap(g, aux, moved, i, j) {
        const tg = g[i]; g[i] = g[j]; g[j] = tg;
        const ta = aux[i]; aux[i] = aux[j]; aux[j] = ta;
        moved[i] = 1; moved[j] = 1;
    }
    function noiTryMove(g, aux, moved, W, H, i, tx, ty, canDisplace) {
        if (tx < 0 || tx >= W || ty < 0 || ty >= H) return false;
        const t = ty * W + tx;
        if (moved[t]) return false;
        if (!canDisplace(g[t])) return false;
        noiSwap(g, aux, moved, i, t);
        return true;
    }
    function noiReact(g, W, H, i, x, y) {
        const m = g[i];
        const nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (let r = 0; r < REACTIONS.length; r++) {
            if (REACTIONS[r].a !== m) continue;
            for (let k = 0; k < 4; k++) {
                const nx = x + nb[k][0], ny = y + nb[k][1];
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const j = ny * W + nx;
                if (g[j] === REACTIONS[r].b) { g[i] = REACTIONS[r].ra; g[j] = REACTIONS[r].rb; return true; }
            }
        }
        return false;
    }
    function noiIgnite(g, aux, W, H, x, y, prob) {
        const nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (let k = 0; k < 4; k++) {
            const nx = x + nb[k][0], ny = y + nb[k][1];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const j = ny * W + nx;
            const nm = g[j];
            if (MAT[nm] && MAT[nm].flammable && Math.random() < prob) { g[j] = FIRE; aux[j] = MAT[nm].fuel; }
        }
    }
    function noiStep(g, aux, moved, W, H, frame) {
        moved.fill(0);
        const ltr = (frame & 1) === 0;
        for (let y = H - 1; y >= 0; y--) {
            for (let k = 0; k < W; k++) {
                const x = ltr ? k : W - 1 - k;
                const i = y * W + x;
                if (moved[i]) continue;
                const m = g[i];
                if (m === AIR || m === STONE || m === WOOD) continue;
                if (noiReact(g, W, H, i, x, y)) { moved[i] = 1; continue; }
                const kind = MAT[m].kind;
                if (kind === 'powder') {
                    const canD = (t) => t === AIR || MAT[t].kind === 'liquid';
                    if (noiTryMove(g, aux, moved, W, H, i, x, y + 1, canD)) continue;
                    const d = Math.random() < 0.5 ? -1 : 1;
                    if (noiTryMove(g, aux, moved, W, H, i, x + d, y + 1, canD)) continue;
                    noiTryMove(g, aux, moved, W, H, i, x - d, y + 1, canD);
                } else if (kind === 'liquid') {
                    if (m === LAVA && Math.random() < 0.45) continue;
                    const dens = MAT[m].density;
                    const canDown = (t) => t === AIR || (MAT[t].kind === 'liquid' && MAT[t].density < dens);
                    const canSide = (t) => t === AIR;
                    if (noiTryMove(g, aux, moved, W, H, i, x, y + 1, canDown)) {
                        if (m === LAVA) noiIgnite(g, aux, W, H, x, y, 0.20);
                        continue;
                    }
                    const d = Math.random() < 0.5 ? -1 : 1;
                    if (noiTryMove(g, aux, moved, W, H, i, x + d, y + 1, canDown) ||
                        noiTryMove(g, aux, moved, W, H, i, x - d, y + 1, canDown) ||
                        noiTryMove(g, aux, moved, W, H, i, x + d, y, canSide) ||
                        noiTryMove(g, aux, moved, W, H, i, x - d, y, canSide)) {
                        if (m === LAVA) noiIgnite(g, aux, W, H, x, y, 0.20);
                        continue;
                    }
                    if (m === LAVA) noiIgnite(g, aux, W, H, x, y, 0.20);
                } else if (kind === 'gas') {
                    if (Math.random() < 0.01) { g[i] = AIR; moved[i] = 1; continue; }
                    const canG = (t) => t === AIR;
                    const d = Math.random() < 0.5 ? -1 : 1;
                    if (noiTryMove(g, aux, moved, W, H, i, x, y - 1, canG) ||
                        noiTryMove(g, aux, moved, W, H, i, x + d, y - 1, canG) ||
                        noiTryMove(g, aux, moved, W, H, i, x - d, y - 1, canG) ||
                        noiTryMove(g, aux, moved, W, H, i, x + d, y, canG) ||
                        noiTryMove(g, aux, moved, W, H, i, x - d, y, canG)) continue;
                } else if (kind === 'fire') {
                    aux[i]--;
                    noiIgnite(g, aux, W, H, x, y, 0.26);
                    if (y > 0 && g[i - W] === AIR && Math.random() < 0.30) g[i - W] = SMOKE;
                    if (aux[i] <= 0) g[i] = Math.random() < 0.5 ? SMOKE : AIR;
                    moved[i] = 1;
                }
            }
        }
    }
    function noiMakeRenderer(canvas, W, H) {
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
                if (m === FIRE) {
                    const f = noiHash(i + frame * 7);
                    r = 255; gg = 120 + (f * 110 | 0); b = 20 + (f * 40 | 0);
                } else if (m === SAND || m === WATER || m === OIL || m === LAVA) {
                    const j = (noiHash(i) * 22 - 11) | 0;
                    r += j; gg += j; b += j;
                }
                data[p] = r; data[p + 1] = gg; data[p + 2] = b; data[p + 3] = 255;
            }
            offCtx.putImageData(img, 0, 0);
            ctx.drawImage(off, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
        };
    }
    function noiMouseCell(canvas, e, W, H) {
        const r = canvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX - r.left) / r.width * W),
            y: Math.floor((e.clientY - r.top) / r.height * H)
        };
    }
    function noiPaint(g, aux, W, H, cx, cy, r, mat) {
        for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const x = cx + dx, y = cy + dy;
                if (x < 0 || x >= W || y < 0 || y >= H) continue;
                const i = y * W + x;
                g[i] = mat;
                if (mat === FIRE) aux[i] = 40;
            }
    }
    function noiWirePalette(pairs, onSelect) {
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
// DEMO — noi_fire: fire propagation through a wooden structure
// =============================================================================
DEMO_HTML.noi_fire = {
    title: 'Noita — Fire: Propagation & Fuel',
    canvas: { width: 720, height: 450 },
    controls: [
        { id: 'btnFireIgnite', text: '🔥 Igniter' },
        { id: 'btnFireWood',   text: '🟫 Wood' },
        { id: 'btnFireOil',    text: '🛢️ Oil' },
        { id: 'btnFireErase',  text: '🧽 Erase' },
        { id: 'btnFireReset',  text: 'Reset structure' }
    ],
    info: 'Pick the igniter and click the structure.'
};

DEMO_CODE.noi_fire = `(function noiFireDemo() {
${NOI_ENGINE_SRC}

    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    const W = 240, H = 150;
    const g = new Uint8Array(W * H), aux = new Uint8Array(W * H), moved = new Uint8Array(W * H);
    const render = noiMakeRenderer(canvas, W, H);
    let frame = 0, tool = FIRE, drawing = false, mouse = null;

    function init() {
        for (let x = 0; x < W; x++) { g[(H-1)*W+x] = STONE; g[(H-2)*W+x] = STONE; }
        const dw = (x0, x1, y0, y1) => {
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y*W+x] = WOOD;
        };
        dw(70, 78, 60, H-3); dw(150, 158, 60, H-3); dw(70, 158, 60, 68); dw(105, 123, 68, H-3);
    }
    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    noiWirePalette([['btnFireIgnite', FIRE], ['btnFireWood', WOOD], ['btnFireOil', OIL], ['btnFireErase', AIR]],
                   (m) => { tool = m; });
    document.getElementById('btnFireReset').addEventListener('click', () => {
        g.fill(AIR); aux.fill(0); init();
    });
    function loop() {
        if (drawing && mouse) noiPaint(g, aux, W, H, mouse.x, mouse.y, 4, tool);
        noiStep(g, aux, moved, W, H, frame++);
        render(g, frame);
        let f = 0, s = 0;
        for (let i = 0; i < g.length; i++) { if (g[i] === FIRE) f++; else if (g[i] === SMOKE) s++; }
        info.textContent = 'fire ' + f + ' · smoke ' + s +
            ' — ignite the structure; fire spreads through wood, burns down, rises as smoke';
        requestAnimationFrame(loop);
    }
    init();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.noi_fire = DEMO_CODE.noi_fire;

// =============================================================================
// DEMO — noi_sandbox: every material, every rule, one canvas
// =============================================================================
DEMO_HTML.noi_sandbox = {
    title: 'Noita — Full Material Sandbox',
    canvas: { width: 720, height: 480 },
    controls: [
        { id: 'btnSbSand',  text: '🟡 Sand' },
        { id: 'btnSbWater', text: '💧 Water' },
        { id: 'btnSbOil',   text: '🛢️ Oil' },
        { id: 'btnSbLava',  text: '🌋 Lava' },
        { id: 'btnSbWood',  text: '🟫 Wood' },
        { id: 'btnSbFire',  text: '🔥 Fire' },
        { id: 'btnSbWall',  text: '⬜ Wall' },
        { id: 'btnSbErase', text: '🧽 Erase' },
        { id: 'btnSbClear', text: 'Clear' }
    ],
    info: 'Pick a material and paint.'
};

DEMO_CODE.noi_sandbox = `(function noiSandboxDemo() {
${NOI_ENGINE_SRC}

    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');
    const W = 240, H = 160;
    const g = new Uint8Array(W * H), aux = new Uint8Array(W * H), moved = new Uint8Array(W * H);
    const render = noiMakeRenderer(canvas, W, H);
    let frame = 0, tool = SAND, drawing = false, mouse = null;

    function init() {
        for (let x = 0; x < W; x++) { g[(H-1)*W+x] = STONE; g[(H-2)*W+x] = STONE; }
    }
    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    noiWirePalette([
        ['btnSbSand', SAND], ['btnSbWater', WATER], ['btnSbOil', OIL], ['btnSbLava', LAVA],
        ['btnSbWood', WOOD], ['btnSbFire', FIRE], ['btnSbWall', STONE], ['btnSbErase', AIR]
    ], (m) => { tool = m; });
    document.getElementById('btnSbClear').addEventListener('click', () => {
        g.fill(AIR); aux.fill(0); init();
    });
    function loop() {
        if (drawing && mouse) noiPaint(g, aux, W, H, mouse.x, mouse.y, 5, tool);
        noiStep(g, aux, moved, W, H, frame++);
        render(g, frame);
        info.textContent = 'Paint any material and watch them interact — ' +
            'oil burns, water quenches lava, sand sinks, gases rise.';
        requestAnimationFrame(loop);
    }
    init();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.noi_sandbox = DEMO_CODE.noi_sandbox;
