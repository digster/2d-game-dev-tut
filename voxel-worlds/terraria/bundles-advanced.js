// =============================================================================
// TERRARIA SUB-TRACK — ADVANCED TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js: the 📋 Export button on each
// `<details data-demo-id="vox_*">` copies a runnable single-file HTML.
//
// Canvas-ID convention: the standalone scaffold hardcodes `<canvas id="canvas">`
// and `<div id="info">`; the DEMO_CODE strings below target those fixed IDs.
//
// Scope: only the two button-only demos are bundled — vox_persist
// (Save/Load/Fresh) and vox_pathfind (New world). voxDayNight (sliders),
// voxPerf and voxCapstone omit `data-demo-id`. Demo-specific algorithms
// (rleEncode/Decode, aStar, the noise + worldgen stack) are inlined into each
// DEMO_CODE; only shared primitives are DEPENDENCY_BUNDLES.
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
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    ok: '#66bb6a',
    bad: '#ef5350',
    path: '#ffd54f',
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

// Shared inline snippet: noise + world generation, used by both DEMO_CODE bodies.
const VOX_GEN_SRC = `    function smoothNoise2D(x, y, seed) {
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
    function generateWorld(world, seed, opts) {
        for (let wx = 0; wx < world.width; wx++) {
            const surf = Math.floor(opts.baseY + (fbm2D(wx * 0.045, 13.7, seed, 4) - 0.5) * 2 * opts.amp);
            for (let wy = 0; wy < world.height; wy++) {
                let id;
                if (wy < surf) id = 0;
                else if (opts.caves && wy > surf + 2 &&
                         Math.abs(fbm2D(wx * 0.08, wy * 0.08, seed + 99, 3) - 0.5) < opts.caveWidth) id = 0;
                else if (wy === surf) id = 2;
                else if (wy < surf + 5) id = 1;
                else {
                    id = 3;
                    const depthFrac = Math.min(1, (wy - surf) / 44);
                    if (opts.ore && fbm2D(wx * 0.3, wy * 0.3, seed + 555, 2) > 0.84 - depthFrac * 0.13) id = 4;
                }
                world.set(wx, wy, id);
            }
        }
    }`;

// =============================================================================
// DEMO — vox_persist: save/load with run-length encoding
// =============================================================================
DEMO_HTML.vox_persist = {
    title: 'Voxel — Save/Load with RLE Compression',
    canvas: { width: 720, height: 360 },
    controls: [
        { id: 'btnPersistSave',  text: '💾 Save' },
        { id: 'btnPersistLoad',  text: '📂 Load' },
        { id: 'btnPersistClear', text: '🌱 Fresh world' }
    ],
    info: 'Edit the world, then Save.'
};

DEMO_CODE.vox_persist = `(function voxPersistDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 48, H = 24, TILE = 15;
    const KEY = 'voxel-worlds-terraria-save';
    const world = new TileWorld(W, H);
    let drag = null, savedBlob = null;

${VOX_GEN_SRC}

    // --- run-length encoding ---
    function rleEncode(tiles) {
        const out = [];
        let i = 0;
        while (i < tiles.length) {
            const v = tiles[i];
            let run = 1;
            while (i + run < tiles.length && tiles[i + run] === v && run < 255) run++;
            out.push(v, run);
            i += run;
        }
        return out;
    }
    function rleDecode(rle, length) {
        const tiles = new Uint8Array(length);
        let pos = 0;
        for (let i = 0; i < rle.length; i += 2) {
            const v = rle[i], run = rle[i + 1];
            for (let k = 0; k < run; k++) tiles[pos++] = v;
        }
        return tiles;
    }

    function freshWorld() {
        generateWorld(world, 5, { baseY: 9, amp: 5, caves: true, caveWidth: 0.1, ore: true });
    }
    function summary(status) {
        const raw = W * H;
        const rleLen = savedBlob ? savedBlob.rle.length : 0;
        const ratio = rleLen ? (raw / rleLen).toFixed(1) : '—';
        info.textContent = status + ' · raw ' + raw + ' bytes -> RLE ' + rleLen +
            ' bytes (' + ratio + 'x smaller). Left-click mines, right-click places stone.';
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
    }
    function save() {
        savedBlob = { w: W, h: H, rle: rleEncode(world.tiles) };
        try { localStorage.setItem(KEY, JSON.stringify(savedBlob)); } catch (e) {}
        summary('Saved'); render();
    }
    function load() {
        let blob = savedBlob;
        if (!blob) { try { blob = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { blob = null; } }
        if (!blob) { summary('Nothing saved yet'); return; }
        world.tiles.set(rleDecode(blob.rle, W * H));
        summary('Loaded'); render();
    }
    function editAt(e) {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left, e.clientY - r.top, TILE);
        if (drag === 'mine')  world.set(t.x, t.y, 0);
        if (drag === 'place') world.set(t.x, t.y, 3);
        render();
    }
    canvas.addEventListener('mousedown', (e) => { drag = e.button === 2 ? 'place' : 'mine'; editAt(e); });
    canvas.addEventListener('mousemove', (e) => { if (drag) editAt(e); });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.getElementById('btnPersistSave').addEventListener('click', save);
    document.getElementById('btnPersistLoad').addEventListener('click', load);
    document.getElementById('btnPersistClear').addEventListener('click', () => { freshWorld(); summary('Fresh world'); render(); });

    let restored = false;
    try {
        const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (stored && stored.rle) { savedBlob = stored; world.tiles.set(rleDecode(stored.rle, W * H)); restored = true; }
    } catch (e) {}
    if (!restored) freshWorld();
    summary(restored ? 'Restored from a previous session' : 'Fresh world');
    render();
})();`;

DEMO_CODE_TS.vox_persist = DEMO_CODE.vox_persist;

// =============================================================================
// DEMO — vox_pathfind: A* on a destructible grid
// =============================================================================
DEMO_HTML.vox_pathfind = {
    title: 'Voxel — A* on a Destructible Grid',
    canvas: { width: 720, height: 400 },
    controls: [
        { id: 'btnPathfindReset', text: '🎲 New world' }
    ],
    info: 'Click to mine or place — the path re-routes.'
};

DEMO_CODE.vox_pathfind = `(function voxPathfindDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 51, H = 28, TILE = 14;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;
    const world = new TileWorld(W, H);
    let enemy, goal, path, visited, drag = null, frame = 0;

${VOX_GEN_SRC}

    // --- A* over the tile grid ---
    function aStar(world, start, goal) {
        const W2 = world.width;
        const key = (x, y) => y * W2 + x;
        const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
        const open = [{ x: start.x, y: start.y }];
        const gScore = new Map([[key(start.x, start.y), 0]]);
        const fScore = new Map([[key(start.x, start.y), h(start.x, start.y)]]);
        const cameFrom = new Map();
        const closed = new Set();
        const visited = [];
        while (open.length) {
            let bi = 0;
            for (let i = 1; i < open.length; i++)
                if (fScore.get(key(open[i].x, open[i].y)) < fScore.get(key(open[bi].x, open[bi].y))) bi = i;
            const cur = open.splice(bi, 1)[0];
            const ck = key(cur.x, cur.y);
            if (cur.x === goal.x && cur.y === goal.y) {
                const p = [cur];
                let k = ck;
                while (cameFrom.has(k)) { const pr = cameFrom.get(k); p.unshift(pr); k = key(pr.x, pr.y); }
                return { path: p, visited };
            }
            closed.add(ck);
            visited.push(cur);
            const nb = [[1,0],[-1,0],[0,1],[0,-1]];
            for (let n = 0; n < 4; n++) {
                const nx = cur.x + nb[n][0], ny = cur.y + nb[n][1];
                if (nx < 0 || nx >= W2 || ny < 0 || ny >= world.height) continue;
                if (isSolid(world.get(nx, ny))) continue;
                const nk = key(nx, ny);
                if (closed.has(nk)) continue;
                const tentative = gScore.get(ck) + 1;
                if (!gScore.has(nk) || tentative < gScore.get(nk)) {
                    cameFrom.set(nk, cur);
                    gScore.set(nk, tentative);
                    fScore.set(nk, tentative + h(nx, ny));
                    if (!open.some(o => o.x === nx && o.y === ny)) open.push({ x: nx, y: ny });
                }
            }
        }
        return { path: null, visited };
    }

    function randAir() {
        for (let tries = 0; tries < 400; tries++) {
            const x = 2 + ((Math.random() * (W - 4)) | 0);
            const y = 2 + ((Math.random() * (H - 4)) | 0);
            if (!isSolid(world.get(x, y))) return { x, y };
        }
        return { x: 2, y: 2 };
    }
    function replan() { const r = aStar(world, enemy, goal); path = r.path; visited = r.visited; }
    // Pick a goal A* can actually reach from the enemy's current tile.
    function newGoal() {
        for (let g = 0; g < 30; g++) {
            const cand = randAir();
            const r = aStar(world, enemy, cand);
            if (r.path && r.path.length > 6) return cand;
        }
        return randAir();
    }
    function reset() {
        for (let attempt = 0; attempt < 12; attempt++) {
            generateWorld(world, (Math.random() * 1000) | 0,
                          { baseY: 8, amp: 4, caves: true, caveWidth: 0.12, ore: false });
            enemy = randAir();
            goal = newGoal();
            const r = aStar(world, enemy, goal);
            if (r.path && r.path.length > 6) { path = r.path; visited = r.visited; return; }
        }
        replan();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
        ctx.fillStyle = 'rgba(79,195,247,0.16)';
        for (const v of visited) ctx.fillRect(ox + v.x * TILE, oy + v.y * TILE, TILE, TILE);
        if (path) {
            ctx.fillStyle = 'rgba(255,213,79,0.55)';
            for (const p of path) ctx.fillRect(ox + p.x * TILE + 2, oy + p.y * TILE + 2, TILE - 4, TILE - 4);
        }
        ctx.fillStyle = VOX_COLORS.ok;
        ctx.fillRect(ox + goal.x * TILE + 2, oy + goal.y * TILE + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = VOX_COLORS.bad;
        ctx.beginPath();
        ctx.arc(ox + enemy.x * TILE + TILE / 2, oy + enemy.y * TILE + TILE / 2, TILE / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        info.textContent = path
            ? 'path: ' + path.length + ' tiles · A* examined ' + visited.length +
              ' · left-click mines, right-click places'
            : 'no path — the goal is walled off. Mine a tunnel to it.';
    }
    function loop() {
        frame++;
        if (frame % 8 === 0 && path && path.length > 1) {
            enemy = path[1];
            if (enemy.x === goal.x && enemy.y === goal.y) goal = newGoal();
            replan();
        }
        render();
        requestAnimationFrame(loop);
    }
    function editAt(e) {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left - ox, e.clientY - r.top - oy, TILE);
        if (!world.inBounds(t.x, t.y)) return;
        if (drag === 'mine')  world.set(t.x, t.y, 0);
        if (drag === 'place') world.set(t.x, t.y, 3);
        replan();
    }
    canvas.addEventListener('mousedown', (e) => { drag = e.button === 2 ? 'place' : 'mine'; editAt(e); });
    canvas.addEventListener('mousemove', (e) => { if (drag) editAt(e); });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.getElementById('btnPathfindReset').addEventListener('click', reset);
    reset();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.vox_pathfind = DEMO_CODE.vox_pathfind;
