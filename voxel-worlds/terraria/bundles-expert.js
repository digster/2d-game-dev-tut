// =============================================================================
// TERRARIA SUB-TRACK — EXPERT TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js: the 📋 Export button on each
// `<details data-demo-id="vox_*">` copies a runnable single-file HTML.
//
// Canvas-ID convention: the standalone scaffold hardcodes `<canvas id="canvas">`
// and `<div id="info">`; the DEMO_CODE strings below target those fixed IDs.
//
// Scope: only the two button-only demos are bundled — vox_water (Step/Run/Reset)
// and vox_light (Clear/Reset). voxNoise, voxWorldgen, voxCaves and voxChunks use
// sliders/checkboxes, which the scaffold's `controls` cannot render, so they
// omit `data-demo-id`. Demo-specific algorithms (stepWater, the noise stack,
// computeLight) are inlined into each DEMO_CODE so the export is self-contained;
// only the truly shared primitives are DEPENDENCY_BUNDLES.
//
// TypeScript: DEMO_CODE_TS / DEPENDENCY_BUNDLES_TS alias the JS forms — plain JS
// is valid TS (Sucrase strips nothing). The page's teaching code panes still
// ship hand-written typed TS.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// =============================================================================
// DEPENDENCY BUNDLES — shared primitives inlined at export time.
// =============================================================================

DEPENDENCY_BUNDLES.vox_colors = `// Shared palette for voxel demos.
const VOX_COLORS = {
    bg: '#0d1117',
    sky: '#1a2547',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    ok: '#66bb6a',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e',
    chunk: '#4fc3f7'
};`;

DEPENDENCY_BUNDLES.vox_materials = `// Material ID -> { name, color, solid }. ID 0 is always "air".
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
];`;

DEPENDENCY_BUNDLES.vox_clearCanvas = `function clearCanvas(ctx, width, height, bgColor = '#0d1117') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;

DEPENDENCY_BUNDLES.vox_hash2D = `// Cheap deterministic 2D hash -> 0..1.
function hash2D(x, y, seed = 0) {
    let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}`;

DEPENDENCY_BUNDLES.vox_drawTile = `// Beveled solid-color tile draw. Air (id 0) is skipped.
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
}`;

DEPENDENCY_BUNDLES.vox_isSolid = `function isSolid(id) {
    const m = VOX_MATERIALS[id];
    return !!(m && m.solid);
}`;

DEPENDENCY_BUNDLES.vox_screenToTile = `function screenToTile(sx, sy, tile, cameraX = 0, cameraY = 0) {
    return { x: Math.floor((sx + cameraX) / tile), y: Math.floor((sy + cameraY) / tile) };
}`;

DEPENDENCY_BUNDLES.vox_TileWorld = `// A 2D voxel world stored as a single contiguous Uint8Array.
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
}`;

// drawTile and isSolid both read VOX_MATERIALS — emit the table first.
DEPENDENCY_REQUIRES.vox_drawTile = ['vox_materials'];
DEPENDENCY_REQUIRES.vox_isSolid  = ['vox_materials'];

// TS aliases — plain JS is valid TS.
DEPENDENCY_BUNDLES_TS.vox_colors      = DEPENDENCY_BUNDLES.vox_colors;
DEPENDENCY_BUNDLES_TS.vox_materials   = DEPENDENCY_BUNDLES.vox_materials;
DEPENDENCY_BUNDLES_TS.vox_clearCanvas = DEPENDENCY_BUNDLES.vox_clearCanvas;
DEPENDENCY_BUNDLES_TS.vox_hash2D      = DEPENDENCY_BUNDLES.vox_hash2D;
DEPENDENCY_BUNDLES_TS.vox_drawTile    = DEPENDENCY_BUNDLES.vox_drawTile;
DEPENDENCY_BUNDLES_TS.vox_isSolid     = DEPENDENCY_BUNDLES.vox_isSolid;
DEPENDENCY_BUNDLES_TS.vox_screenToTile = DEPENDENCY_BUNDLES.vox_screenToTile;
DEPENDENCY_BUNDLES_TS.vox_TileWorld   = DEPENDENCY_BUNDLES.vox_TileWorld;

// =============================================================================
// DEMO — vox_water: cellular-automaton water in a two-basin tub
// =============================================================================
DEMO_HTML.vox_water = {
    title: 'Voxel — Cellular-Automaton Water',
    canvas: { width: 720, height: 396 },
    controls: [
        { id: 'btnWaterStep',  text: 'Step once' },
        { id: 'btnWaterRun',   text: 'Run' },
        { id: 'btnWaterReset', text: 'Reset' }
    ],
    info: 'Click to pour water, then Step or Run.'
};

DEMO_CODE.vox_water = `(function voxWaterDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12;
    let world, running = false, drawing = false, ticks = 0;

    // A tub with a short middle divider — water spills over it once one side fills.
    function buildTub() {
        const w = new TileWorld(W, H);
        for (let x = 0; x < W; x++) { w.set(x, H - 1, 3); w.set(x, H - 2, 3); }
        for (let y = H - 18; y < H - 2; y++) { w.set(4, y, 3); w.set(W - 5, y, 3); }
        for (let y = H - 10; y < H - 2; y++) w.set(W >> 1, y, 3);
        return w;
    }
    // Advance every water tile one cell: down, down-diagonal, then sideways.
    function stepWater(world) {
        for (let y = world.height - 2; y >= 0; y--) {
            for (let x = 0; x < world.width; x++) {
                if (world.get(x, y) !== 7) continue;
                if (world.get(x, y + 1) === 0) {
                    world.set(x, y, 0); world.set(x, y + 1, 7); continue;
                }
                const dl = world.get(x - 1, y + 1) === 0 && world.get(x - 1, y) === 0;
                const dr = world.get(x + 1, y + 1) === 0 && world.get(x + 1, y) === 0;
                if (dl || dr) {
                    const dx = (dl && dr) ? (Math.random() < 0.5 ? -1 : 1) : (dl ? -1 : 1);
                    world.set(x, y, 0); world.set(x + dx, y + 1, 7); continue;
                }
                const sl = world.get(x - 1, y) === 0;
                const sr = world.get(x + 1, y) === 0;
                if (sl || sr) {
                    const dx = (sl && sr) ? (Math.random() < 0.5 ? -1 : 1) : (sl ? -1 : 1);
                    world.set(x, y, 0); world.set(x + dx, y, 7);
                }
            }
        }
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
        info.textContent = (running ? 'RUNNING' : 'paused') + ' · tick ' + ticks +
                           ' · water: ' + countWater();
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
        world = buildTub(); ticks = 0; running = false;
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
})();`;

DEMO_CODE_TS.vox_water = DEMO_CODE.vox_water;

// =============================================================================
// DEMO — vox_light: BFS flood-fill tile lighting over a generated world
// =============================================================================
DEMO_HTML.vox_light = {
    title: 'Voxel — Tile Lighting (Flood Fill)',
    canvas: { width: 720, height: 396 },
    controls: [
        { id: 'btnLightClear', text: 'Clear torches' },
        { id: 'btnLightReset', text: 'Reset world' }
    ],
    info: 'Click an empty tile to place a torch.'
};

DEMO_CODE.vox_light = `(function voxLightDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12, SEED = 21;
    const world = new TileWorld(W, H);
    const light = new Float32Array(W * H);

    // --- noise + world generation ---
    function smoothNoise2D(x, y, seed) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const fx = x - x0, fy = y - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const n00 = hash2D(x0, y0, seed),     n10 = hash2D(x0 + 1, y0, seed);
        const n01 = hash2D(x0, y0 + 1, seed), n11 = hash2D(x0 + 1, y0 + 1, seed);
        const nx0 = n00 + (n10 - n00) * sx, nx1 = n01 + (n11 - n01) * sx;
        return nx0 + (nx1 - nx0) * sy;
    }
    function fbm2D(x, y, seed, octaves) {
        let sum = 0, amp = 1, freq = 1, norm = 0;
        for (let o = 0; o < octaves; o++) {
            sum += amp * smoothNoise2D(x * freq, y * freq, seed + o * 1013);
            norm += amp; amp *= 0.5; freq *= 2;
        }
        return sum / norm;
    }
    function surfaceHeight(wx) {
        return Math.floor(10 + (fbm2D(wx * 0.045, 13.7, SEED, 4) - 0.5) * 2 * 5);
    }
    function biomeAt(wx) {
        const b = smoothNoise2D(wx * 0.012, 4.2, SEED + 777);
        return b < 0.36 ? 'desert' : (b > 0.66 ? 'tundra' : 'forest');
    }
    function generateTile(wx, wy) {
        const surf = surfaceHeight(wx);
        if (wy < surf) return 0;
        if (wy > surf + 2 && Math.abs(fbm2D(wx * 0.08, wy * 0.08, SEED + 99, 3) - 0.5) < 0.11) return 0;
        const biome = biomeAt(wx);
        if (wy === surf) return biome === 'desert' ? 6 : (biome === 'tundra' ? 10 : 2);
        if (wy < surf + 5) return biome === 'desert' ? 6 : 1;
        const depthFrac = Math.min(1, (wy - surf) / 44);
        if (fbm2D(wx * 0.3, wy * 0.3, SEED + 555, 2) > 0.84 - depthFrac * 0.13) return 4;
        return 3;
    }
    function generateWorld() {
        for (let wx = 0; wx < W; wx++)
            for (let wy = 0; wy < H; wy++)
                world.set(wx, wy, generateTile(wx, wy));
    }

    // --- BFS flood-fill lighting ---
    function computeLight() {
        light.fill(0);
        const queue = [];
        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                if (isSolid(world.get(x, y))) break;
                light[y * W + x] = 1;
                queue.push(x, y);
            }
        }
        for (let i = 0; i < world.tiles.length; i++) {
            if (world.tiles[i] === 9) { light[i] = 1; queue.push(i % W, (i / W) | 0); }
        }
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
                if (nl > light[ni]) { light[ni] = nl; queue.push(nx, ny); }
            }
        }
    }
    function seedTorches() {
        let placed = 0;
        for (let x = 8; x < W - 6 && placed < 4; x += 6) {
            let edges = 0;
            for (let y = 6; y < H - 2; y++) {
                if (world.get(x, y) === 0 && isSolid(world.get(x, y + 1))) {
                    edges++;
                    if (edges >= 2) { world.set(x, y, 9); placed++; break; }
                }
            }
        }
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const d = 1 - light[y * W + x];
                if (d <= 0.02) continue;
                ctx.fillStyle = 'rgba(4,6,14,' + d.toFixed(3) + ')';
                ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
            }
        }
        for (let i = 0; i < world.tiles.length; i++) {
            if (world.tiles[i] !== 9) continue;
            const tx = (i % W) * TILE + TILE / 2, ty = ((i / W) | 0) * TILE + TILE / 2;
            const g = ctx.createRadialGradient(tx, ty, 1, tx, ty, TILE * 2.6);
            g.addColorStop(0, 'rgba(255,200,110,0.55)');
            g.addColorStop(1, 'rgba(255,200,110,0)');
            ctx.fillStyle = g;
            ctx.fillRect(tx - TILE * 2.6, ty - TILE * 2.6, TILE * 5.2, TILE * 5.2);
        }
        let torches = 0;
        for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === 9) torches++;
        info.textContent = 'torches: ' + torches +
            ' — click an empty tile to place a torch, click a torch to remove it.';
    }
    function reset() { generateWorld(); seedTorches(); computeLight(); render(); }

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left, e.clientY - r.top, TILE);
        const id = world.get(t.x, t.y);
        if (id === 9) world.set(t.x, t.y, 0);
        else if (id === 0) world.set(t.x, t.y, 9);
        else return;
        computeLight(); render();
    });
    document.getElementById('btnLightClear').addEventListener('click', () => {
        for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === 9) world.tiles[i] = 0;
        computeLight(); render();
    });
    document.getElementById('btnLightReset').addEventListener('click', reset);
    reset();
})();`;

DEMO_CODE_TS.vox_light = DEMO_CODE.vox_light;
