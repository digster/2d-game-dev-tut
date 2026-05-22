// =============================================================================
// TERRARIA SUB-TRACK — EXPERT TIER DEMOS
// =============================================================================
// World generation & liquids. Each demo is an IIFE that early-returns if its
// canvas is absent. Module-level helpers are defined once and reused. This
// tier's demos file is self-contained (re-declares the core voxel helpers),
// matching the project convention that each <tier>-demos.js stands alone.
// =============================================================================

(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
        btn.style.opacity = window.pageYOffset > 300 ? '1' : '0';
    });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// ---------------------------------------------------------------------------
// Palette + materials. Extends the earlier tiers with torch (9) and snow (10).
// ---------------------------------------------------------------------------
const VOX_COLORS = {
    bg: '#0d1117',
    sky: '#1a2547',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    ok: '#66bb6a',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e',
    chunk: '#4fc3f7'
};

const VOX_MATERIALS = [
    { id: 0,  name: 'air',    color: null,      solid: false },
    { id: 1,  name: 'dirt',   color: '#7a4f2b', solid: true  },
    { id: 2,  name: 'grass',  color: '#4a8a3a', solid: true  },
    { id: 3,  name: 'stone',  color: '#6e6e7a', solid: true  },
    { id: 4,  name: 'ore',    color: '#d4a843', solid: true  },
    { id: 5,  name: 'wood',   color: '#8a5a2a', solid: true  },
    { id: 6,  name: 'sand',   color: '#d7c878', solid: true  },
    { id: 7,  name: 'water',  color: '#4288d4', solid: false },
    { id: 8,  name: 'gravel', color: '#888078', solid: true  },
    { id: 9,  name: 'torch',  color: '#ffcc66', solid: false },
    { id: 10, name: 'snow',   color: '#dfe9f0', solid: true  }
];

// Cheap deterministic 2D hash → 0..1.
function hash2D(x, y, seed = 0) {
    let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}

function screenToTile(sx, sy, tile, cameraX = 0, cameraY = 0) {
    return { x: Math.floor((sx + cameraX) / tile), y: Math.floor((sy + cameraY) / tile) };
}

function isSolid(id) { const m = VOX_MATERIALS[id]; return !!(m && m.solid); }

class TileWorld {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = new Uint8Array(width * height);
    }
    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.tiles[y * this.width + x];
    }
    set(x, y, v) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.tiles[y * this.width + x] = v;
    }
    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
}

function drawTile(ctx, sx, sy, size, id) {
    const m = VOX_MATERIALS[id];
    if (!m || !m.color) return;
    ctx.fillStyle = m.color;
    ctx.fillRect(sx, sy, size, size);
    if (size >= 7) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(sx, sy + size - 2, size, 2);
        ctx.fillRect(sx + size - 2, sy, 2, size);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(sx, sy, size, 1);
    }
}

// --- Noise: value noise + fractal Brownian motion --------------------------

// Smoothly-interpolated value noise. Hashes the 4 lattice corners around
// (x, y) and blends them with a smoothstep curve → a continuous 0..1 field.
function smoothNoise2D(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    // smoothstep weights remove the grid-aligned creasing of linear blending.
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = hash2D(x0,     y0,     seed);
    const n10 = hash2D(x0 + 1, y0,     seed);
    const n01 = hash2D(x0,     y0 + 1, seed);
    const n11 = hash2D(x0 + 1, y0 + 1, seed);
    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
}

// Fractal Brownian motion: sum octaves of value noise, each octave double the
// frequency and half the amplitude. Normalised back to 0..1.
function fbm2D(x, y, seed, octaves) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
        sum += amp * smoothNoise2D(x * freq, y * freq, seed + o * 1013);
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
}

// --- World generation ------------------------------------------------------

// Surface height at world column wx — a 1D slice of fBm.
function surfaceHeight(wx, seed, baseY, amp, octaves = 4) {
    const n = fbm2D(wx * 0.045, 13.7, seed, octaves);
    return Math.floor(baseY + (n - 0.5) * 2 * amp);
}

// Biome at column wx — a very-low-frequency noise carves wide zones.
function biomeAt(wx, seed) {
    const b = smoothNoise2D(wx * 0.012, 4.2, seed + 777);
    return b < 0.36 ? 'desert' : (b > 0.66 ? 'tundra' : 'forest');
}

// Pure function: the material id at world tile (wx, wy). Because it depends
// only on coordinates + seed, two chunks generated independently always agree
// on their shared edge — the property that makes chunked streaming possible.
function generateTile(wx, wy, seed, opts) {
    const surf = surfaceHeight(wx, seed, opts.baseY, opts.amp);
    if (wy < surf) return 0;                       // sky

    // Caves: an iso-band of 2D fBm carves connected, worm-like tunnels.
    if (opts.caves && wy > surf + 2) {
        const c = fbm2D(wx * 0.08, wy * 0.08, seed + 99, 3);
        if (Math.abs(c - 0.5) < opts.caveWidth) return 0;
    }

    const biome = biomeAt(wx, seed);
    if (wy === surf) {
        return biome === 'desert' ? 6 : (biome === 'tundra' ? 10 : 2);
    }
    if (wy < surf + 5) {
        return biome === 'desert' ? 6 : 1;          // sand band / dirt band
    }
    // Stone, with ore where a high-frequency noise spikes — denser deeper.
    if (opts.ore) {
        const depthFrac = Math.min(1, (wy - surf) / 44);
        const oreThresh = 0.84 - depthFrac * 0.13;
        if (fbm2D(wx * 0.3, wy * 0.3, seed + 555, 2) > oreThresh) return 4;
    }
    return 3;
}

function generateWorld(world, seed, opts) {
    for (let wx = 0; wx < world.width; wx++)
        for (let wy = 0; wy < world.height; wy++)
            world.set(wx, wy, generateTile(wx, wy, seed, opts));
}

// --- Cellular-automaton water ----------------------------------------------

// Advance every water tile one cell: down, then down-diagonal, then sideways.
// Bottom-up scan so water moves at most one cell per tick.
function stepWater(world) {
    let moved = 0;
    for (let y = world.height - 2; y >= 0; y--) {
        for (let x = 0; x < world.width; x++) {
            if (world.get(x, y) !== 7) continue;
            // 1. straight down
            if (world.get(x, y + 1) === 0) {
                world.set(x, y, 0); world.set(x, y + 1, 7); moved++; continue;
            }
            // 2. down-diagonal
            const dl = world.get(x - 1, y + 1) === 0 && world.get(x - 1, y) === 0;
            const dr = world.get(x + 1, y + 1) === 0 && world.get(x + 1, y) === 0;
            if (dl || dr) {
                const dx = (dl && dr) ? (Math.random() < 0.5 ? -1 : 1) : (dl ? -1 : 1);
                world.set(x, y, 0); world.set(x + dx, y + 1, 7); moved++; continue;
            }
            // 3. sideways spread — this is what makes water pool, not pile.
            const sl = world.get(x - 1, y) === 0;
            const sr = world.get(x + 1, y) === 0;
            if (sl || sr) {
                const dx = (sl && sr) ? (Math.random() < 0.5 ? -1 : 1) : (sl ? -1 : 1);
                world.set(x, y, 0); world.set(x + dx, y, 7); moved++;
            }
        }
    }
    return moved;
}

// --- Tile lighting (BFS flood fill) ----------------------------------------

// Fill `light` (Float32Array, 0..1) by flooding brightness out from every
// sky-exposed tile and every torch, subtracting a per-tile attenuation each
// step. A flat array used as a queue (head pointer) avoids Array.shift()'s
// O(n) cost — this is a Dijkstra-style relaxation.
function computeLight(world, light) {
    const W = world.width, H = world.height;
    light.fill(0);
    const queue = [];

    // Skylight: each column is lit from the top down until the first solid tile.
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
            if (isSolid(world.get(x, y))) break;
            light[y * W + x] = 1;
            queue.push(x, y);
        }
    }
    // Torches emit full brightness.
    for (let i = 0; i < world.tiles.length; i++) {
        if (world.tiles[i] === 9) {
            light[i] = 1;
            queue.push(i % W, (i / W) | 0);
        }
    }
    // Relaxation: brightness only ever decreases as it spreads, so this halts.
    let head = 0;
    while (head < queue.length) {
        const x = queue[head++], y = queue[head++];
        const lv = light[y * W + x];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 0; k < 4; k++) {
            const nx = x + nb[k][0], ny = y + nb[k][1];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const ni = ny * W + nx;
            const atten = isSolid(world.get(nx, ny)) ? 0.24 : 0.10;
            const nl = lv - atten;
            if (nl > light[ni]) {
                light[ni] = nl;
                queue.push(nx, ny);
            }
        }
    }
}

// --- Chunked world ---------------------------------------------------------

// An infinite world stored as 16×16 chunks generated on demand. getChunk
// generates+caches a chunk the first time it's touched.
class ChunkedWorld {
    constructor(chunkSize, seed, genOpts) {
        this.cs = chunkSize;
        this.seed = seed;
        this.genOpts = genOpts;
        this.chunks = new Map();
        this.generatedCount = 0;
    }
    getChunk(cx, cy) {
        const key = cx + ',' + cy;
        let c = this.chunks.get(key);
        if (!c) {
            c = new Uint8Array(this.cs * this.cs);
            for (let ly = 0; ly < this.cs; ly++)
                for (let lx = 0; lx < this.cs; lx++)
                    c[ly * this.cs + lx] = generateTile(
                        cx * this.cs + lx, cy * this.cs + ly, this.seed, this.genOpts);
            this.chunks.set(key, c);
            this.generatedCount++;
        }
        return c;
    }
    get(wx, wy) {
        const cx = Math.floor(wx / this.cs), cy = Math.floor(wy / this.cs);
        const c = this.getChunk(cx, cy);
        return c[(wy - cy * this.cs) * this.cs + (wx - cx * this.cs)];
    }
}

// =============================================================================
// DEMO 1 — voxNoise: fBm field + the terrain surface derived from it
// =============================================================================
(function voxNoiseDemo() {
    const canvas = document.getElementById('voxNoise');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxNoiseInfo');
    const slOct = document.getElementById('voxNoiseOctaves');
    const slScale = document.getElementById('voxNoiseScale');
    const slSeed = document.getElementById('voxNoiseSeed');
    const vOct = document.getElementById('voxNoiseOctavesValue');
    const vScale = document.getElementById('voxNoiseScaleValue');
    const vSeed = document.getElementById('voxNoiseSeedValue');
    ctx.imageSmoothingEnabled = false;

    const CELL = 6;
    const GW = Math.floor(canvas.width / CELL);
    const GH = Math.floor(canvas.height / CELL);

    function render() {
        const octaves = parseInt(slOct.value, 10);
        const scale = parseInt(slScale.value, 10) / 1000; // 0.01..0.10
        const seed = parseInt(slSeed.value, 10);
        vOct.textContent = octaves;
        vScale.textContent = scale.toFixed(3);
        vSeed.textContent = seed;

        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.bg);
        // 2D fBm field as a grayscale heatmap.
        for (let gy = 0; gy < GH; gy++) {
            for (let gx = 0; gx < GW; gx++) {
                const n = fbm2D(gx * scale * 6, gy * scale * 6, seed, octaves);
                const v = (n * 255) | 0;
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL);
            }
        }
        // The terrain surface: a 1D slice of fBm, drawn as a curve, with the
        // ground below it tinted green.
        ctx.beginPath();
        for (let gx = 0; gx <= GW; gx++) {
            const n = fbm2D(gx * scale * 6, 99.5, seed, octaves);
            const sy = n * GH * CELL;
            if (gx === 0) ctx.moveTo(gx * CELL, sy);
            else ctx.lineTo(gx * CELL, sy);
        }
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(74, 138, 58, 0.30)';
        ctx.fill();
        ctx.beginPath();
        for (let gx = 0; gx <= GW; gx++) {
            const n = fbm2D(gx * scale * 6, 99.5, seed, octaves);
            const sy = n * GH * CELL;
            if (gx === 0) ctx.moveTo(gx * CELL, sy);
            else ctx.lineTo(gx * CELL, sy);
        }
        ctx.strokeStyle = '#7ec97c';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = VOX_COLORS.label;
        ctx.font = 'bold 12px monospace';
        ctx.fillText('grayscale = 2D fBm field   ·   green curve = 1D surface (a slice of the same noise)', 10, 18);
        info.innerHTML =
            `octaves=<strong>${octaves}</strong> · scale=<strong>${scale.toFixed(3)}</strong> · ` +
            `seed=${seed} — more octaves add finer detail; bigger scale zooms in.`;
    }

    slOct.addEventListener('input', render);
    slScale.addEventListener('input', render);
    slSeed.addEventListener('input', render);
    render();
})();

// =============================================================================
// DEMO 2 — voxWorldgen: surface heightmap + biome-zoned material layers
// =============================================================================
(function voxWorldgenDemo() {
    const canvas = document.getElementById('voxWorldgen');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxWorldgenInfo');
    const slSeed = document.getElementById('voxWorldgenSeed');
    const slAmp = document.getElementById('voxWorldgenAmp');
    const vSeed = document.getElementById('voxWorldgenSeedValue');
    const vAmp = document.getElementById('voxWorldgenAmpValue');
    const btnRegen = document.getElementById('btnWorldgenRegen');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12;
    const world = new TileWorld(W, H);

    function render() {
        const seed = parseInt(slSeed.value, 10);
        const amp = parseInt(slAmp.value, 10);
        vSeed.textContent = seed;
        vAmp.textContent = amp;
        const opts = { baseY: 12, amp, caves: false, ore: false };
        generateWorld(world, seed, opts);

        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));

        // Label the biome zones across the top.
        ctx.font = 'bold 12px sans-serif';
        let runStart = 0, runBiome = biomeAt(0, seed);
        const labelZone = (x0, x1, biome) => {
            const cx = (x0 + x1) / 2 * TILE;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            const txt = biome.toUpperCase();
            const tw = ctx.measureText(txt).width;
            ctx.fillRect(cx - tw / 2 - 5, 6, tw + 10, 18);
            ctx.fillStyle = biome === 'desert' ? '#d7c878'
                          : biome === 'tundra' ? '#dfe9f0' : '#7ec97c';
            ctx.textAlign = 'center';
            ctx.fillText(txt, cx, 19);
            ctx.textAlign = 'start';
        };
        for (let x = 1; x <= W; x++) {
            const b = x < W ? biomeAt(x, seed) : null;
            if (b !== runBiome) { labelZone(runStart, x, runBiome); runStart = x; runBiome = b; }
        }
        info.innerHTML =
            `seed=<strong>${seed}</strong> · amplitude=<strong>${amp}</strong> tiles — ` +
            `surface height is a 1D fBm slice; biome zones pick the surface material.`;
    }

    slSeed.addEventListener('input', render);
    slAmp.addEventListener('input', render);
    btnRegen.addEventListener('click', () => {
        slSeed.value = String((Math.random() * 1000) | 0);
        render();
    });
    render();
})();

// =============================================================================
// DEMO 3 — voxCaves: caves carved by a 2D-noise iso-band + ore veins
// =============================================================================
(function voxCavesDemo() {
    const canvas = document.getElementById('voxCaves');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxCavesInfo');
    const slWidth = document.getElementById('voxCavesWidth');
    const vWidth = document.getElementById('voxCavesWidthValue');
    const cbOre = document.getElementById('voxCavesOre');
    const btnRegen = document.getElementById('btnCavesRegen');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12;
    const world = new TileWorld(W, H);
    let seed = 7;

    function render() {
        const caveWidth = parseInt(slWidth.value, 10) / 1000; // 0.02..0.16
        vWidth.textContent = caveWidth.toFixed(3);
        const opts = { baseY: 11, amp: 6, caves: true, caveWidth, ore: cbOre.checked };
        generateWorld(world, seed, opts);

        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));

        let air = 0, ore = 0;
        for (let i = 0; i < world.tiles.length; i++) {
            if (world.tiles[i] === 0) air++;
            if (world.tiles[i] === 4) ore++;
        }
        info.innerHTML =
            `cave width=<strong>${caveWidth.toFixed(3)}</strong> · ore: ${cbOre.checked ? 'on' : 'off'} — ` +
            `caves are where |fBm − 0.5| &lt; width; ${ore} ore tiles placed.`;
    }

    slWidth.addEventListener('input', render);
    cbOre.addEventListener('change', render);
    btnRegen.addEventListener('click', () => { seed = (Math.random() * 1000) | 0; render(); });
    render();
})();

// =============================================================================
// DEMO 4 — voxWater: cellular-automaton water flowing into a two-basin tub
// =============================================================================
(function voxWaterDemo() {
    const canvas = document.getElementById('voxWater');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxWaterInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12;
    let world, running = false, drawing = false, ticks = 0;

    // A tub with a shorter middle divider — water poured on one side fills it,
    // then spills over the divider into the other side.
    function buildTub() {
        const w = new TileWorld(W, H);
        for (let x = 0; x < W; x++) { w.set(x, H - 1, 3); w.set(x, H - 2, 3); }
        for (let y = H - 18; y < H - 2; y++) { w.set(4, y, 3); w.set(W - 5, y, 3); }
        for (let y = H - 10; y < H - 2; y++) w.set(W >> 1, y, 3); // short divider
        return w;
    }

    function countWater() {
        let n = 0;
        for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === 7) n++;
        return n;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        info.innerHTML =
            `${running ? '<strong style="color:#66bb6a">RUNNING</strong>' : 'paused'} · ` +
            `tick ${ticks} · water: ${countWater()} · click/drag to pour water`;
    }

    function loop() {
        if (running) { stepWater(world); ticks++; render(); }
        requestAnimationFrame(loop);
    }

    function pour(e) {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left, e.clientY - r.top, TILE);
        for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
                if (world.get(t.x + dx, t.y + dy) === 0) world.set(t.x + dx, t.y + dy, 7);
        render();
    }
    function reset() {
        world = buildTub();
        ticks = 0; running = false;
        document.getElementById('btnWaterRun').textContent = 'Run';
        render();
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; pour(e); });
    canvas.addEventListener('mousemove', (e) => { if (drawing) pour(e); });
    window.addEventListener('mouseup', () => { drawing = false; });
    document.getElementById('btnWaterStep').addEventListener('click', () => {
        if (!running) { stepWater(world); ticks++; render(); }
    });
    document.getElementById('btnWaterRun').addEventListener('click', () => {
        running = !running;
        document.getElementById('btnWaterRun').textContent = running ? 'Pause' : 'Run';
        render();
    });
    document.getElementById('btnWaterReset').addEventListener('click', reset);

    reset();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 5 — voxLight: tile lighting via BFS flood fill, place torches by click
// =============================================================================
(function voxLightDemo() {
    const canvas = document.getElementById('voxLight');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxLightInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12;
    const world = new TileWorld(W, H);
    const light = new Float32Array(W * H);
    const SEED = 21;

    function seedTorches() {
        // Scan candidate columns; drop a torch into the first cave found below
        // the surface in each, up to 4 — robust to whatever the seed carves.
        let placed = 0;
        for (let x = 8; x < W - 6 && placed < 4; x += 6) {
            let airSolidEdges = 0;
            for (let y = 6; y < H - 2; y++) {
                if (world.get(x, y) === 0 && isSolid(world.get(x, y + 1))) {
                    airSolidEdges++;
                    // The 1st air-above-solid edge is the surface; the 2nd is a cave.
                    if (airSolidEdges >= 2) { world.set(x, y, 9); placed++; break; }
                }
            }
        }
    }
    function reset() {
        generateWorld(world, SEED, { baseY: 10, amp: 5, caves: true, caveWidth: 0.11, ore: true });
        seedTorches();
        recompute();
    }
    function recompute() {
        computeLight(world, light);
        render();
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        // Tiles.
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        // Darkness overlay — alpha = 1 − light.
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const d = 1 - light[y * W + x];
                if (d <= 0.02) continue;
                ctx.fillStyle = `rgba(4, 6, 14, ${d.toFixed(3)})`;
                ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
            }
        }
        // Torch glow, drawn on top so torches always read bright.
        for (let i = 0; i < world.tiles.length; i++) {
            if (world.tiles[i] !== 9) continue;
            const tx = (i % W) * TILE + TILE / 2;
            const ty = ((i / W) | 0) * TILE + TILE / 2;
            const g = ctx.createRadialGradient(tx, ty, 1, tx, ty, TILE * 2.6);
            g.addColorStop(0, 'rgba(255,200,110,0.55)');
            g.addColorStop(1, 'rgba(255,200,110,0)');
            ctx.fillStyle = g;
            ctx.fillRect(tx - TILE * 2.6, ty - TILE * 2.6, TILE * 5.2, TILE * 5.2);
        }
        let torches = 0;
        for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === 9) torches++;
        info.innerHTML =
            `torches: <strong>${torches}</strong> — click an empty tile to place a torch, ` +
            `click a torch to remove it. Skylight floods from the top; light attenuates per tile.`;
    }

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left, e.clientY - r.top, TILE);
        const id = world.get(t.x, t.y);
        if (id === 9) world.set(t.x, t.y, 0);          // remove torch
        else if (id === 0) world.set(t.x, t.y, 9);     // place torch in air
        else return;
        recompute();
    });
    document.getElementById('btnLightClear').addEventListener('click', () => {
        for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === 9) world.tiles[i] = 0;
        recompute();
    });
    document.getElementById('btnLightReset').addEventListener('click', reset);

    reset();
})();

// =============================================================================
// DEMO 6 — voxChunks: an infinite world streamed as 16×16 chunks
// =============================================================================
(function voxChunksDemo() {
    const canvas = document.getElementById('voxChunks');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxChunksInfo');
    const cbGrid = document.getElementById('voxChunksGrid');
    ctx.imageSmoothingEnabled = false;

    const CS = 16, TILE = 14;
    const WORLD_H = 48;                    // bounded vertically, infinite in x
    const world = new ChunkedWorld(CS, 31, { baseY: 14, amp: 8, caves: true, caveWidth: 0.1, ore: true });
    const camera = { x: 6 * TILE, y: 0 };
    const keys = new Set();
    let focused = false;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        const tx0 = Math.floor(camera.x / TILE);
        const ty0 = Math.max(0, Math.floor(camera.y / TILE));
        const tx1 = Math.ceil((camera.x + canvas.width) / TILE);
        const ty1 = Math.min(WORLD_H, Math.ceil((camera.y + canvas.height) / TILE));
        for (let y = ty0; y < ty1; y++)
            for (let x = tx0; x < tx1; x++) {
                const id = world.get(x, y);          // lazily generates chunks
                if (id !== 0) drawTile(ctx, x * TILE - camera.x, y * TILE - camera.y, TILE, id);
            }

        // Chunk-boundary overlay.
        if (cbGrid.checked) {
            const cx0 = Math.floor(tx0 / CS), cx1 = Math.ceil(tx1 / CS);
            const cy0 = Math.floor(ty0 / CS), cy1 = Math.ceil(ty1 / CS);
            ctx.strokeStyle = 'rgba(79,195,247,0.5)';
            ctx.lineWidth = 1;
            ctx.font = '10px monospace';
            ctx.fillStyle = 'rgba(79,195,247,0.85)';
            for (let cy = cy0; cy < cy1; cy++) {
                for (let cx = cx0; cx < cx1; cx++) {
                    const sx = cx * CS * TILE - camera.x;
                    const sy = cy * CS * TILE - camera.y;
                    ctx.strokeRect(sx + 0.5, sy + 0.5, CS * TILE, CS * TILE);
                    ctx.fillText(`${cx},${cy}`, sx + 4, sy + 13);
                }
            }
        }

        if (!focused) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to focus — pan with WASD / arrow keys', canvas.width / 2, canvas.height - 13);
            ctx.textAlign = 'start';
        }
        info.innerHTML =
            `chunks generated: <strong>${world.generatedCount}</strong> · ` +
            `camera (${camera.x | 0}, ${camera.y | 0}) — chunks generate lazily as they scroll into view.`;
    }

    function loop() {
        let moved = false;
        const sp = 7;
        if (keys.has('a') || keys.has('arrowleft'))  { camera.x -= sp; moved = true; }
        if (keys.has('d') || keys.has('arrowright')) { camera.x += sp; moved = true; }
        if (keys.has('w') || keys.has('arrowup'))    { camera.y -= sp; moved = true; }
        if (keys.has('s') || keys.has('arrowdown'))  { camera.y += sp; moved = true; }
        camera.x = Math.max(0, camera.x);
        camera.y = Math.max(0, Math.min(WORLD_H * TILE - canvas.height, camera.y));
        if (moved) render();
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('focus', () => { focused = true; render(); });
    canvas.addEventListener('blur',  () => { focused = false; keys.clear(); render(); });
    canvas.addEventListener('click', () => canvas.focus());
    canvas.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
            e.preventDefault();
            keys.add(k);
        }
    });
    canvas.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    cbGrid.addEventListener('change', render);

    render();
    requestAnimationFrame(loop);
})();
