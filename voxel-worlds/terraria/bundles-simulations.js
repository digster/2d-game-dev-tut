// =============================================================================
// TERRARIA SUB-TRACK — SIMULATIONS TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js: the 📋 Export button on each
// `<details data-demo-id="vox_*">` copies a runnable single-file HTML.
//
// Canvas-ID convention: the standalone scaffold hardcodes `<canvas id="canvas">`
// and `<div id="info">`; the DEMO_CODE strings below target those fixed IDs.
//
// Scope: only the two button-only demos are bundled — vox_simlight
// (Step/Run/Reset) and vox_simflow (Step/Run/Reset). voxSimCaves, voxSimBiome
// and voxSimOre use sliders, which the scaffold's `controls` cannot render, so
// they omit `data-demo-id`. Demo-specific code is inlined into each DEMO_CODE.
//
// TypeScript: DEMO_CODE_TS / DEPENDENCY_BUNDLES_TS alias the JS forms — plain
// JS is valid TS. The page's teaching code panes ship hand-written typed TS.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// =============================================================================
// DEPENDENCY BUNDLES — shared primitives.
// =============================================================================

DEPENDENCY_BUNDLES.vox_colors = `// Shared palette for voxel demos.
const VOX_COLORS = {
    bg: '#0d1117',
    sky: '#1a2547',
    panel: '#11162a',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    ok: '#66bb6a',
    bad: '#ef5350',
    cyan: '#4fc3f7',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e'
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

DEPENDENCY_REQUIRES.vox_drawTile = ['vox_materials'];
DEPENDENCY_REQUIRES.vox_isSolid  = ['vox_materials'];

DEPENDENCY_BUNDLES_TS.vox_colors      = DEPENDENCY_BUNDLES.vox_colors;
DEPENDENCY_BUNDLES_TS.vox_materials   = DEPENDENCY_BUNDLES.vox_materials;
DEPENDENCY_BUNDLES_TS.vox_clearCanvas = DEPENDENCY_BUNDLES.vox_clearCanvas;
DEPENDENCY_BUNDLES_TS.vox_hash2D      = DEPENDENCY_BUNDLES.vox_hash2D;
DEPENDENCY_BUNDLES_TS.vox_drawTile    = DEPENDENCY_BUNDLES.vox_drawTile;
DEPENDENCY_BUNDLES_TS.vox_isSolid     = DEPENDENCY_BUNDLES.vox_isSolid;
DEPENDENCY_BUNDLES_TS.vox_screenToTile = DEPENDENCY_BUNDLES.vox_screenToTile;
DEPENDENCY_BUNDLES_TS.vox_TileWorld   = DEPENDENCY_BUNDLES.vox_TileWorld;

// =============================================================================
// DEMO — vox_simlight: flood-fill light revealed one BFS ring per Step
// =============================================================================
DEMO_HTML.vox_simlight = {
    title: 'Voxel — Light-Propagation Stepper',
    canvas: { width: 714, height: 392 },
    controls: [
        { id: 'btnSimLightStep',  text: 'Step ring' },
        { id: 'btnSimLightRun',   text: 'Run' },
        { id: 'btnSimLightReset', text: 'Reset' }
    ],
    info: 'Step the flood fill one ring at a time.'
};

DEMO_CODE.vox_simlight = `(function voxSimLightDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 51, H = 28, TILE = 14;
    const world = new TileWorld(W, H);
    const light = new Float32Array(W * H);
    const seen = new Uint8Array(W * H);
    let frontier = [], ring = 0, running = false;
    const torch = { x: 25, y: 14 };
    const FALLOFF = 0.055;

    function buildCave() {
        for (let i = 0; i < world.tiles.length; i++) world.tiles[i] = 3;
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                let open = false;
                for (const c of [[25,14,9],[16,10,6],[36,18,7],[30,21,5]])
                    if (Math.hypot(x - c[0], y - c[1]) < c[2] - hash2D(x, y, 3) * 1.6) open = true;
                if (open) world.set(x, y, 0);
            }
        world.set(torch.x, torch.y, 9);
    }
    function resetFlood() {
        light.fill(0); seen.fill(0); ring = 0; running = false;
        document.getElementById('btnSimLightRun').textContent = 'Run';
        light[torch.y * W + torch.x] = 1;
        seen[torch.y * W + torch.x] = 1;
        frontier = [{ x: torch.x, y: torch.y }];
        render();
    }
    function step() {
        if (!frontier.length) return;
        const next = [];
        const lv = Math.max(0, 1 - (ring + 1) * FALLOFF);
        for (const c of frontier) {
            for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = c.x + d[0], ny = c.y + d[1];
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const ni = ny * W + nx;
                if (seen[ni] || isSolid(world.get(nx, ny))) continue;
                seen[ni] = 1; light[ni] = lv; next.push({ x: nx, y: ny });
            }
        }
        frontier = next; ring++; render();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.bg);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const d = 1 - light[y * W + x];
                if (d <= 0.02) continue;
                ctx.fillStyle = 'rgba(4,6,14,' + d.toFixed(3) + ')';
                ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
            }
        ctx.strokeStyle = VOX_COLORS.accent;
        ctx.lineWidth = 2;
        for (const c of frontier) ctx.strokeRect(c.x * TILE + 1, c.y * TILE + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = '#ffcc66';
        ctx.beginPath();
        ctx.arc(torch.x * TILE + TILE / 2, torch.y * TILE + TILE / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        info.innerHTML = 'BFS ring <strong>' + ring + '</strong> · frontier <strong>' +
            frontier.length + '</strong> tiles · ' +
            (frontier.length ? 'each Step relaxes light one tile further out'
                              : 'flood complete — the connected cave is lit');
    }
    function loop() { if (running && frontier.length) step(); requestAnimationFrame(loop); }
    document.getElementById('btnSimLightStep').addEventListener('click', () => { if (!running) step(); });
    document.getElementById('btnSimLightRun').addEventListener('click', () => {
        running = !running;
        document.getElementById('btnSimLightRun').textContent = running ? 'Pause' : 'Run';
    });
    document.getElementById('btnSimLightReset').addEventListener('click', resetFlood);
    buildCave(); resetFlood();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.vox_simlight = DEMO_CODE.vox_simlight;

// =============================================================================
// DEMO — vox_simflow: the water automaton with each cell's pending move shown
// =============================================================================
DEMO_HTML.vox_simflow = {
    title: 'Voxel — Liquid-Flow Stepper',
    canvas: { width: 715, height: 390 },
    controls: [
        { id: 'btnSimFlowStep',  text: 'Step once' },
        { id: 'btnSimFlowRun',   text: 'Run' },
        { id: 'btnSimFlowReset', text: 'Reset' }
    ],
    info: 'Click to pour water, then Step.'
};

DEMO_CODE.vox_simflow = `(function voxSimFlowDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 55, H = 30, TILE = 13;
    let world, running = false, drawing = false, ticks = 0;

    function buildBowl() {
        const w = new TileWorld(W, H);
        for (let x = 0; x < W; x++) { w.set(x, H - 1, 3); w.set(x, H - 2, 3); }
        for (let y = H - 14; y < H - 2; y++) { w.set(6, y, 3); w.set(W - 7, y, 3); }
        for (let x = 18; x < 37; x++) w.set(x, H - 8, 3);
        return w;
    }
    function decision(x, y) {
        if (world.get(x, y + 1) === 0) return 'down';
        const dl = world.get(x - 1, y + 1) === 0 && world.get(x - 1, y) === 0;
        const dr = world.get(x + 1, y + 1) === 0 && world.get(x + 1, y) === 0;
        if (dl || dr) return 'diag';
        const sl = world.get(x - 1, y) === 0, sr = world.get(x + 1, y) === 0;
        if (sl || sr) return 'side';
        return 'settled';
    }
    function stepWater() {
        for (let y = H - 2; y >= 0; y--) {
            for (let x = 0; x < W; x++) {
                if (world.get(x, y) !== 7) continue;
                if (world.get(x, y + 1) === 0) { world.set(x, y, 0); world.set(x, y + 1, 7); continue; }
                const dl = world.get(x - 1, y + 1) === 0 && world.get(x - 1, y) === 0;
                const dr = world.get(x + 1, y + 1) === 0 && world.get(x + 1, y) === 0;
                if (dl || dr) {
                    const dx = (dl && dr) ? (Math.random() < 0.5 ? -1 : 1) : (dl ? -1 : 1);
                    world.set(x, y, 0); world.set(x + dx, y + 1, 7); continue;
                }
                const sl = world.get(x - 1, y) === 0, sr = world.get(x + 1, y) === 0;
                if (sl || sr) {
                    const dx = (sl && sr) ? (Math.random() < 0.5 ? -1 : 1) : (sl ? -1 : 1);
                    world.set(x, y, 0); world.set(x + dx, y, 7);
                }
            }
        }
        ticks++;
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        let down = 0, diag = 0, side = 0, settled = 0;
        ctx.lineWidth = 1.5;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (world.get(x, y) !== 7) continue;
                const d = decision(x, y);
                const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
                if (d === 'settled') {
                    settled++;
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
                    continue;
                }
                ctx.strokeStyle = d === 'down' ? '#ffd54f' : d === 'diag' ? '#ff9800' : '#ef5350';
                if (d === 'down') down++; else if (d === 'diag') diag++; else side++;
                ctx.beginPath();
                ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3);
                ctx.moveTo(cx - 2, cy + 1); ctx.lineTo(cx, cy + 3); ctx.lineTo(cx + 2, cy + 1);
                ctx.stroke();
            }
        }
        info.innerHTML = 'tick <strong>' + ticks + '</strong> · pending moves — ' +
            '<span style="color:#ffd54f">down ' + down + '</span> · ' +
            '<span style="color:#ff9800">diagonal ' + diag + '</span> · ' +
            '<span style="color:#ef5350">sideways ' + side + '</span> · settled ' + settled;
    }
    function loop() { if (running) stepWater(); render(); requestAnimationFrame(loop); }
    function pour(e) {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left, e.clientY - r.top, TILE);
        for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
                if (world.get(t.x + dx, t.y + dy) === 0) world.set(t.x + dx, t.y + dy, 7);
    }
    function reset() {
        world = buildBowl(); ticks = 0; running = false;
        document.getElementById('btnSimFlowRun').textContent = 'Run';
    }
    canvas.addEventListener('mousedown', (e) => { drawing = true; pour(e); });
    canvas.addEventListener('mousemove', (e) => { if (drawing) pour(e); });
    window.addEventListener('mouseup', () => { drawing = false; });
    document.getElementById('btnSimFlowStep').addEventListener('click', () => { if (!running) stepWater(); });
    document.getElementById('btnSimFlowRun').addEventListener('click', () => {
        running = !running;
        document.getElementById('btnSimFlowRun').textContent = running ? 'Pause' : 'Run';
    });
    document.getElementById('btnSimFlowReset').addEventListener('click', reset);
    reset();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.vox_simflow = DEMO_CODE.vox_simflow;
