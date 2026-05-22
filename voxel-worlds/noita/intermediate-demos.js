// =============================================================================
// NOITA SUB-TRACK — INTERMEDIATE TIER DEMOS ("Liquids, Gases, Fire & Reactions")
// =============================================================================
// A multi-material cellular automaton. Each material has a KIND (powder /
// liquid / gas / fire / solid); one shared step function dispatches on kind.
//
// Self-contained file. Top-level names are deliberately Noita-specific so they
// can't shadow a shared/utils.js global (the bug class from the Simulations
// tier — a top-level `const lerp` colliding with utils.js's `function lerp`).
// =============================================================================

(function noiSetupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
        btn.style.opacity = window.pageYOffset > 300 ? '1' : '0';
    });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// --- Materials --------------------------------------------------------------
const AIR = 0, STONE = 1, SAND = 2, WATER = 3, OIL = 4,
      LAVA = 5, WOOD = 6, FIRE = 7, SMOKE = 8, STEAM = 9;

// Each material: kind drives behaviour; density orders liquid swaps;
// flammable + fuel feed the fire rule; color is the base RGB.
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

function noiHash(i) {
    let h = (i * 374761393) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}

// --- Reaction table ---------------------------------------------------------
// When a cell of material `a` is adjacent to material `b`, both transform.
// This is the "instant material swap" flavour of reaction; stateful ones
// (ignition) live in the fire / lava rules.
const REACTIONS = [
    { a: WATER, b: LAVA, ra: STEAM, rb: STONE },   // water quenches lava → steam + stone
    { a: WATER, b: FIRE, ra: STEAM, rb: AIR   }    // water puts out fire → steam
];

// =============================================================================
// THE ENGINE — one step over the whole grid
// =============================================================================

// Swap two cells (material + aux), and mark both processed this frame.
function noiSwap(g, aux, moved, i, j) {
    const tg = g[i]; g[i] = g[j]; g[j] = tg;
    const ta = aux[i]; aux[i] = aux[j]; aux[j] = ta;
    moved[i] = 1; moved[j] = 1;
}

// Try to move cell i into (tx, ty) if the target passes `canDisplace`.
function noiTryMove(g, aux, moved, W, H, i, tx, ty, canDisplace) {
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return false;
    const t = ty * W + tx;
    if (moved[t]) return false;
    if (!canDisplace(g[t])) return false;
    noiSwap(g, aux, moved, i, t);
    return true;
}

// Reactions: if any neighbour matches a rule, transform both cells.
function noiReact(g, W, H, i, x, y) {
    const m = g[i];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let r = 0; r < REACTIONS.length; r++) {
        if (REACTIONS[r].a !== m) continue;
        for (let k = 0; k < 4; k++) {
            const nx = x + nb[k][0], ny = y + nb[k][1];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const j = ny * W + nx;
            if (g[j] === REACTIONS[r].b) {
                g[i] = REACTIONS[r].ra;
                g[j] = REACTIONS[r].rb;
                return true;
            }
        }
    }
    return false;
}

// Ignite flammable neighbours of (x, y) — used by fire and lava.
function noiIgnite(g, aux, W, H, x, y, prob) {
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < 4; k++) {
        const nx = x + nb[k][0], ny = y + nb[k][1];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        const nm = g[j];
        if (MAT[nm] && MAT[nm].flammable && Math.random() < prob) {
            g[j] = FIRE;
            aux[j] = MAT[nm].fuel;          // burn time = the fuel's energy
        }
    }
}

// Advance the whole grid one tick.
function noiStep(g, aux, moved, W, H, frame) {
    moved.fill(0);
    const ltr = (frame & 1) === 0;          // alternate sweep — cancels sideways bias
    for (let y = H - 1; y >= 0; y--) {      // bottom-up; the moved flag protects rising gas
        for (let k = 0; k < W; k++) {
            const x = ltr ? k : W - 1 - k;
            const i = y * W + x;
            if (moved[i]) continue;
            const m = g[i];
            if (m === AIR || m === STONE || m === WOOD) {
                if (m === WOOD) { /* static — only burns when fire touches it */ }
                continue;
            }
            if (noiReact(g, W, H, i, x, y)) { moved[i] = 1; continue; }

            const kind = MAT[m].kind;
            if (kind === 'powder') {
                // Sand: into air OR any liquid (it sinks). Down, then down-diag.
                const canD = (t) => t === AIR || MAT[t].kind === 'liquid';
                if (noiTryMove(g, aux, moved, W, H, i, x, y + 1, canD)) continue;
                const d = Math.random() < 0.5 ? -1 : 1;
                if (noiTryMove(g, aux, moved, W, H, i, x + d, y + 1, canD)) continue;
                noiTryMove(g, aux, moved, W, H, i, x - d, y + 1, canD);

            } else if (kind === 'liquid') {
                if (m === LAVA && Math.random() < 0.45) continue;   // lava is viscous
                const dens = MAT[m].density;
                // Down: into air, or swap with a LIGHTER liquid (denser sinks).
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
                // Dissipate slowly (~1%/frame ≈ 1.6s life) so gas has time to
                // rise the full height and pool before vanishing.
                if (Math.random() < 0.01) { g[i] = AIR; moved[i] = 1; continue; }
                const canG = (t) => t === AIR;
                const d = Math.random() < 0.5 ? -1 : 1;
                if (noiTryMove(g, aux, moved, W, H, i, x, y - 1, canG) ||
                    noiTryMove(g, aux, moved, W, H, i, x + d, y - 1, canG) ||
                    noiTryMove(g, aux, moved, W, H, i, x - d, y - 1, canG) ||
                    noiTryMove(g, aux, moved, W, H, i, x + d, y, canG) ||
                    noiTryMove(g, aux, moved, W, H, i, x - d, y, canG)) continue;

            } else if (kind === 'fire') {
                aux[i]--;                                  // burn down
                noiIgnite(g, aux, W, H, x, y, 0.26);       // spread to fuel
                if (y > 0 && g[i - W] === AIR && Math.random() < 0.30) g[i - W] = SMOKE;
                if (aux[i] <= 0) g[i] = Math.random() < 0.5 ? SMOKE : AIR;
                moved[i] = 1;
            }
        }
    }
}

// --- Rendering --------------------------------------------------------------

// ImageData renderer for the W×H pixel grid. Fire flickers per-frame.
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
            if (m === FIRE) {                           // flicker hot
                const f = noiHash(i + frame * 7);
                r = 255; gg = 120 + (f * 110) | 0; b = 20 + (f * 40) | 0;
            } else if (m === SAND || m === WATER || m === OIL || m === LAVA) {
                const j = (noiHash(i) * 22 - 11) | 0;   // grain / surface jitter
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

// Paint a disc of `mat` (FIRE also seeds its burn timer).
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

// Wire a button palette: each [buttonId, material] pair selects a paint tool.
function noiWirePalette(pairs, onSelect) {
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

// Standard demo harness: a paintable, self-stepping pixel world.
function noiRunDemo(opts) {
    const canvas = document.getElementById(opts.canvasId);
    if (!canvas) return;
    const W = opts.W, H = opts.H;
    const g = new Uint8Array(W * H);
    const aux = new Uint8Array(W * H);
    const moved = new Uint8Array(W * H);
    const render = noiMakeRenderer(canvas, W, H);
    let frame = 0, tool = opts.palette[0][1], drawing = false, mouse = null, brush = opts.brush || 5;

    if (opts.init) opts.init(g, aux, W, H);

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    noiWirePalette(opts.palette, (m) => { tool = m; });
    if (opts.resetBtn) {
        document.getElementById(opts.resetBtn).addEventListener('click', () => {
            g.fill(AIR); aux.fill(0);
            if (opts.init) opts.init(g, aux, W, H);
        });
    }

    function loop() {
        if (drawing && mouse) noiPaint(g, aux, W, H, mouse.x, mouse.y, brush, tool);
        const sub = opts.substeps || 1;
        for (let s = 0; s < sub; s++) noiStep(g, aux, moved, W, H, frame++);
        render(g, frame);
        if (opts.onFrame) opts.onFrame(g, W, H);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

// =============================================================================
// DEMO 1 — noiLiquid: water flows & spreads; oil floats on it; sand sinks
// =============================================================================
noiRunDemo({
    canvasId: 'noiLiquid', W: 240, H: 150,
    palette: [
        ['btnLiquidWater', WATER], ['btnLiquidOil', OIL],
        ['btnLiquidSand', SAND], ['btnLiquidWall', STONE], ['btnLiquidErase', AIR]
    ],
    resetBtn: 'btnLiquidClear',
    onFrame(g) {
        let w = 0, o = 0;
        for (let i = 0; i < g.length; i++) { if (g[i] === WATER) w++; else if (g[i] === OIL) o++; }
        const el = document.getElementById('noiLiquidInfo');
        if (el) el.innerHTML = `water ${w.toLocaleString()} · oil ${o.toLocaleString()} — ` +
            `oil (density 2) floats on water (density 3); sand sinks through both`;
    }
});

// =============================================================================
// DEMO 2 — noiGas: gases rise — the falling-sand rule, flipped vertically
// =============================================================================
noiRunDemo({
    canvasId: 'noiGas', W: 240, H: 150,
    palette: [
        ['btnGasSmoke', SMOKE], ['btnGasSteam', STEAM],
        ['btnGasWall', STONE], ['btnGasErase', AIR]
    ],
    resetBtn: 'btnGasClear',
    init(g, aux, W, H) {
        // A ceiling so gas visibly pools against it.
        for (let x = 0; x < W; x++) for (let t = 0; t < 4; t++) g[t * W + x] = STONE;
    },
    onFrame(g) {
        let n = 0;
        for (let i = 0; i < g.length; i++) if (g[i] === SMOKE || g[i] === STEAM) n++;
        const el = document.getElementById('noiGasInfo');
        if (el) el.innerHTML = `gas cells ${n.toLocaleString()} — gases rise and pool against the ceiling, ` +
            `then slowly dissipate`;
    }
});

// =============================================================================
// DEMO 3 — noiFire: fire spreads through fuel, burns down, makes smoke
// =============================================================================
noiRunDemo({
    canvasId: 'noiFire', W: 240, H: 150, brush: 4,
    palette: [
        ['btnFireIgnite', FIRE], ['btnFireWood', WOOD],
        ['btnFireOil', OIL], ['btnFireErase', AIR]
    ],
    resetBtn: 'btnFireReset',
    init(g, aux, W, H) {
        // Floor + a little wooden structure to set alight.
        for (let x = 0; x < W; x++) { g[(H - 1) * W + x] = STONE; g[(H - 2) * W + x] = STONE; }
        const drawWood = (x0, x1, y0, y1) => {
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * W + x] = WOOD;
        };
        drawWood(70, 78, 60, H - 3);          // left post
        drawWood(150, 158, 60, H - 3);        // right post
        drawWood(70, 158, 60, 68);            // roof beam
        drawWood(105, 123, 68, H - 3);        // centre pillar — touches the beam,
                                              // so fire spreads through the whole frame
    },
    onFrame(g) {
        let f = 0, s = 0;
        for (let i = 0; i < g.length; i++) { if (g[i] === FIRE) f++; else if (g[i] === SMOKE) s++; }
        const el = document.getElementById('noiFireInfo');
        if (el) el.innerHTML = `🔥 fire ${f} · 💨 smoke ${s} — click the structure with the igniter; ` +
            `fire spreads through wood, burns down, and rises as smoke`;
    }
});

// =============================================================================
// DEMO 4 — noiReact: material reactions — water + lava → steam + stone
// =============================================================================
noiRunDemo({
    canvasId: 'noiReact', W: 240, H: 150,
    palette: [
        ['btnReactWater', WATER], ['btnReactLava', LAVA],
        ['btnReactWall', STONE], ['btnReactErase', AIR]
    ],
    resetBtn: 'btnReactReset',
    init(g, aux, W, H) {
        // A stone basin holding a pool of lava — pour water in.
        for (let x = 0; x < W; x++) { g[(H - 1) * W + x] = STONE; g[(H - 2) * W + x] = STONE; }
        for (let y = H - 14; y < H - 2; y++) for (let t = 0; t < 4; t++) {
            g[y * W + (60 + t)] = STONE; g[y * W + (180 - t)] = STONE;
        }
        for (let y = H - 9; y < H - 2; y++) for (let x = 64; x < 177; x++) g[y * W + x] = LAVA;
    },
    onFrame(g) {
        let st = 0, sn = 0;
        for (let i = 0; i < g.length; i++) { if (g[i] === STEAM) st++; else if (g[i] === STONE) sn++; }
        const el = document.getElementById('noiReactInfo');
        if (el) el.innerHTML = `💨 steam ${st} — pour water onto the lava: the reaction table turns ` +
            `<strong>water + lava → steam + stone</strong>`;
    }
});

// =============================================================================
// DEMO 5 — noiSandbox: every material, every rule, one canvas
// =============================================================================
noiRunDemo({
    canvasId: 'noiSandbox', W: 240, H: 160, substeps: 1,
    palette: [
        ['btnSbSand', SAND], ['btnSbWater', WATER], ['btnSbOil', OIL], ['btnSbLava', LAVA],
        ['btnSbWood', WOOD], ['btnSbFire', FIRE], ['btnSbWall', STONE], ['btnSbErase', AIR]
    ],
    resetBtn: 'btnSbClear',
    init(g, aux, W, H) {
        for (let x = 0; x < W; x++) { g[(H - 1) * W + x] = STONE; g[(H - 2) * W + x] = STONE; }
    },
    onFrame(g) {
        const el = document.getElementById('noiSandboxInfo');
        if (el) el.textContent = 'Paint any material and watch them interact — ' +
            'oil burns, water quenches lava, sand sinks, gases rise.';
    }
});
