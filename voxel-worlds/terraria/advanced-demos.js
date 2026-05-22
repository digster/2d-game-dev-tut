// =============================================================================
// TERRARIA SUB-TRACK — ADVANCED TIER DEMOS
// =============================================================================
// Persistence, AI, day/night, performance. Each demo is an IIFE that
// early-returns if its canvas is absent. Self-contained (re-declares the core
// voxel helpers) per the convention that each <tier>-demos.js stands alone.
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
// Palette + materials.
// ---------------------------------------------------------------------------
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

// A deliberately expensive textured draw — used by the performance demo so the
// cached-vs-uncached timing gap is visible.
function jitterColor(hex, x, y, amount, seed) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = (hash2D(x, y, seed)     * 2 - 1) * amount;
    const dg = (hash2D(x, y, seed + 1) * 2 - 1) * amount;
    const db = (hash2D(x, y, seed + 2) * 2 - 1) * amount;
    const c = v => Math.max(0, Math.min(255, v | 0));
    return `rgb(${c(r + dr)}, ${c(g + dg)}, ${c(b + db)})`;
}
function drawTileTextured(ctx, sx, sy, size, id, tx, ty) {
    const m = VOX_MATERIALS[id];
    if (!m || !m.color) return;
    ctx.fillStyle = jitterColor(m.color, tx, ty, 12, 0);
    ctx.fillRect(sx, sy, size, size);
    for (let i = 0; i < 3; i++) {
        const hx = hash2D(tx, ty, 10 + i), hy = hash2D(tx, ty, 20 + i);
        ctx.fillStyle = jitterColor(m.color, tx + i, ty + i, 30, 7);
        ctx.fillRect(sx + ((hx * (size - 4)) | 0), sy + ((hy * (size - 4)) | 0), 2, 2);
    }
}

// --- Noise + world generation (carried from the Expert tier) ---------------

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
}

// --- Tile lighting (BFS flood fill) — skylight seed scaled by time-of-day ---

function computeLight(world, light, skyIntensity = 1) {
    const W = world.width, H = world.height;
    light.fill(0);
    const queue = [];
    for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
            if (isSolid(world.get(x, y))) break;
            light[y * W + x] = skyIntensity;
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

// --- A* pathfinding over the tile grid -------------------------------------

// Finds a shortest path of non-solid tiles from start to goal (4-neighbour).
// Returns { path, visited }; path is null when no route exists. The open set
// is a plain array scanned for its lowest f — simple and fine at demo scale;
// a real game uses a binary-heap priority queue.
function aStar(world, start, goal) {
    const W = world.width;
    const key = (x, y) => y * W + x;
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = [{ x: start.x, y: start.y }];
    const gScore = new Map([[key(start.x, start.y), 0]]);
    const fScore = new Map([[key(start.x, start.y), h(start.x, start.y)]]);
    const cameFrom = new Map();
    const closed = new Set();
    const visited = [];

    while (open.length) {
        // Pop the open node with the lowest f-score.
        let bi = 0;
        for (let i = 1; i < open.length; i++) {
            if (fScore.get(key(open[i].x, open[i].y)) < fScore.get(key(open[bi].x, open[bi].y))) bi = i;
        }
        const cur = open.splice(bi, 1)[0];
        const ck = key(cur.x, cur.y);
        if (cur.x === goal.x && cur.y === goal.y) {
            const path = [cur];
            let k = ck;
            while (cameFrom.has(k)) { const p = cameFrom.get(k); path.unshift(p); k = key(p.x, p.y); }
            return { path, visited };
        }
        closed.add(ck);
        visited.push(cur);
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let n = 0; n < 4; n++) {
            const nx = cur.x + nb[n][0], ny = cur.y + nb[n][1];
            if (nx < 0 || nx >= W || ny < 0 || ny >= world.height) continue;
            if (isSolid(world.get(nx, ny))) continue;       // can't path through solid
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

// --- Run-length encoding for save/load -------------------------------------

// Encode a tile array as [value, runLength, value, runLength, ...]. Runs are
// capped at 255 so each count fits a byte. Voxel worlds are mostly long runs
// of sky and stone, so this shrinks them dramatically.
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

// --- Player physics (carried from the Intermediate tier) -------------------

const VOX_GRAVITY = 0.55, VOX_MOVE = 2.3, VOX_JUMP = -8.2, VOX_MAX_FALL = 11;

function overlappingTiles(px, py, pw, ph, TILE) {
    // Half-open span [pos, pos+size) covers cells floor(pos)..ceil(pos+size)-1.
    return {
        x0: Math.floor(px / TILE),
        x1: Math.ceil((px + pw) / TILE) - 1,
        y0: Math.floor(py / TILE),
        y1: Math.ceil((py + ph) / TILE) - 1
    };
}
function moveX(world, p, TILE) {
    p.x += p.vx;
    const r = overlappingTiles(p.x, p.y, p.w, p.h, TILE);
    let hit = null;
    for (let ty = r.y0; ty <= r.y1; ty++)
        for (let tx = r.x0; tx <= r.x1; tx++) {
            if (!isSolid(world.get(tx, ty))) continue;
            hit = hit === null ? tx : (p.vx > 0 ? Math.min(hit, tx) : Math.max(hit, tx));
        }
    if (hit !== null) { p.x = p.vx > 0 ? hit * TILE - p.w : (hit + 1) * TILE; p.vx = 0; }
}
function moveY(world, p, TILE) {
    p.y += p.vy;
    p.onGround = false;
    const r = overlappingTiles(p.x, p.y, p.w, p.h, TILE);
    let hit = null;
    for (let ty = r.y0; ty <= r.y1; ty++)
        for (let tx = r.x0; tx <= r.x1; tx++) {
            if (!isSolid(world.get(tx, ty))) continue;
            hit = hit === null ? ty : (p.vy > 0 ? Math.min(hit, ty) : Math.max(hit, ty));
        }
    if (hit !== null) {
        if (p.vy > 0) { p.y = hit * TILE - p.h; p.onGround = true; }
        else          { p.y = (hit + 1) * TILE; }
        p.vy = 0;
    }
}
function updatePlayer(world, p, keys, TILE) {
    p.vx = 0;
    if (keys.has('a') || keys.has('arrowleft'))  { p.vx = -VOX_MOVE; p.facing = -1; }
    if (keys.has('d') || keys.has('arrowright')) { p.vx =  VOX_MOVE; p.facing =  1; }
    p.vy = Math.min(p.vy + VOX_GRAVITY, VOX_MAX_FALL);
    moveX(world, p, TILE);
    moveY(world, p, TILE);
}
function drawPlayer(ctx, sx, sy, w, h, facing) {
    ctx.fillStyle = '#5a9e58'; ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#7ec97c'; ctx.fillRect(sx, sy, w, Math.round(h * 0.34));
    ctx.strokeStyle = '#11151f'; ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(facing >= 0 ? sx + w - 5 : sx + 2, sy + 5, 3, 3);
}

// =============================================================================
// DEMO 1 — voxPersist: save/load a world with run-length encoding
// =============================================================================
(function voxPersistDemo() {
    const canvas = document.getElementById('voxPersist');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxPersistInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 48, H = 24, TILE = 15;
    const KEY = 'voxel-worlds-terraria-save';
    const world = new TileWorld(W, H);
    let drag = null;
    let savedBlob = null;   // in-memory copy — robust even if localStorage is blocked

    function freshWorld() {
        generateWorld(world, 5, { baseY: 9, amp: 5, caves: true, caveWidth: 0.1, ore: true });
    }
    function persistSummary(status) {
        const raw = W * H;
        const rleLen = savedBlob ? savedBlob.rle.length : 0;
        const ratio = rleLen ? (raw / rleLen).toFixed(1) : '—';
        info.innerHTML = `${status} · raw <strong>${raw}</strong> bytes → ` +
            `RLE <strong>${rleLen}</strong> bytes (<strong>${ratio}×</strong> smaller). ` +
            `Left-click mines · right-click places stone.`;
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
    }
    function save() {
        savedBlob = { w: W, h: H, rle: rleEncode(world.tiles) };
        try { localStorage.setItem(KEY, JSON.stringify(savedBlob)); } catch (e) { /* blocked — in-memory still works */ }
        persistSummary('💾 Saved');
        render();
    }
    function load() {
        let blob = savedBlob;
        if (!blob) {
            try { blob = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { blob = null; }
        }
        if (!blob) { persistSummary('⚠ Nothing saved yet'); return; }
        world.tiles.set(rleDecode(blob.rle, W * H));
        persistSummary('📂 Loaded');
        render();
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
    document.getElementById('btnPersistClear').addEventListener('click', () => {
        freshWorld(); persistSummary('🌱 Fresh world'); render();
    });

    // On load, restore a previous save if one exists — persistence across reloads.
    let restored = false;
    try {
        const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (stored && stored.rle) {
            savedBlob = stored;
            world.tiles.set(rleDecode(stored.rle, W * H));
            restored = true;
        }
    } catch (e) { /* ignore */ }
    if (!restored) freshWorld();
    persistSummary(restored ? '📂 Restored from a previous session' : '🌱 Fresh world');
    render();
})();

// =============================================================================
// DEMO 2 — voxPathfind: A* on a destructible grid, re-planned on every edit
// =============================================================================
(function voxPathfindDemo() {
    const canvas = document.getElementById('voxPathfind');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxPathfindInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 51, H = 28, TILE = 14;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;
    const world = new TileWorld(W, H);
    let enemy, goal, path, visited, drag = null, frame = 0;

    function randAir() {
        for (let tries = 0; tries < 400; tries++) {
            const x = 2 + ((Math.random() * (W - 4)) | 0);
            const y = 2 + ((Math.random() * (H - 4)) | 0);
            if (!isSolid(world.get(x, y))) return { x, y };
        }
        return { x: 2, y: 2 };
    }
    function replan() {
        const r = aStar(world, enemy, goal);
        path = r.path;
        visited = r.visited;
    }
    // Pick a goal A* can actually reach from the enemy — random air cells in a
    // cave-riddled world are often stranded in separate pockets.
    function newGoal() {
        for (let g = 0; g < 30; g++) {
            const cand = randAir();
            const r = aStar(world, enemy, cand);
            if (r.path && r.path.length > 6) return cand;
        }
        return randAir();   // fallback
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
        replan();   // fallback — practically never reached
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));

        // Faint overlay of every tile A* examined.
        ctx.fillStyle = 'rgba(79,195,247,0.16)';
        for (const v of visited) ctx.fillRect(ox + v.x * TILE, oy + v.y * TILE, TILE, TILE);

        // The path itself.
        if (path) {
            ctx.fillStyle = 'rgba(255,213,79,0.55)';
            for (const p of path)
                ctx.fillRect(ox + p.x * TILE + 2, oy + p.y * TILE + 2, TILE - 4, TILE - 4);
        }
        // Goal + enemy markers.
        ctx.fillStyle = VOX_COLORS.ok;
        ctx.fillRect(ox + goal.x * TILE + 2, oy + goal.y * TILE + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = VOX_COLORS.bad;
        ctx.beginPath();
        ctx.arc(ox + enemy.x * TILE + TILE / 2, oy + enemy.y * TILE + TILE / 2, TILE / 2 - 1, 0, Math.PI * 2);
        ctx.fill();

        info.innerHTML = path
            ? `path: <strong>${path.length}</strong> tiles · A* examined <strong>${visited.length}</strong> · ` +
              `left-click mines, right-click places — the path re-plans instantly`
            : `<strong style="color:${VOX_COLORS.bad}">no path</strong> — the goal is walled off. Mine a tunnel to it.`;
    }

    function loop() {
        frame++;
        // Step the enemy along the path a few times a second.
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
})();

// =============================================================================
// DEMO 3 — voxDayNight: day/night cycle modulating the skylight + rain
// =============================================================================
(function voxDayNightDemo() {
    const canvas = document.getElementById('voxDayNight');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxDayNightInfo');
    const slTime = document.getElementById('voxDayNightTime');
    const cbAuto = document.getElementById('voxDayNightAuto');
    const cbRain = document.getElementById('voxDayNightRain');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12;
    const world = new TileWorld(W, H);
    const light = new Float32Array(W * H);
    const rain = [];
    let t = 0.35;

    generateWorld(world, 14, { baseY: 9, amp: 5, caves: true, caveWidth: 0.1, ore: true });
    // A couple of torches so night isn't pitch black.
    world.set(12, 16, 9); world.set(44, 20, 9);
    for (let i = 0; i < 90; i++)
        rain.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: 3 + Math.random() * 3 });

    const lerp = (a, b, k) => a + (b - a) * k;
    // Skylight strength: 0.06 at midnight, 1 at noon — a smooth cosine curve.
    function skyIntensity(time) {
        const day = 0.5 - 0.5 * Math.cos(time * Math.PI * 2);
        return 0.06 + 0.94 * day;
    }
    function skyColor(time) {
        const day = 0.5 - 0.5 * Math.cos(time * Math.PI * 2);
        const warmth = day * (1 - day) * 4;        // peaks at dawn/dusk transitions
        let r = lerp(10, 74, day), g = lerp(14, 122, day), b = lerp(30, 176, day);
        r = lerp(r, 210, warmth * 0.5); g = lerp(g, 120, warmth * 0.5); b = lerp(b, 66, warmth * 0.5);
        return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
    }
    function phase(time) {
        if (time < 0.22 || time > 0.80) return 'night';
        if (time < 0.32) return 'dawn';
        if (time > 0.68) return 'dusk';
        return 'day';
    }

    function render() {
        let sky = skyIntensity(t);
        if (cbRain.checked) sky *= 0.7;             // overcast skies are dimmer
        computeLight(world, light, sky);

        clearCanvas(ctx, canvas.width, canvas.height, skyColor(t));
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const d = 1 - light[y * W + x];
                if (d <= 0.02) continue;
                ctx.fillStyle = `rgba(4,6,14,${d.toFixed(3)})`;
                ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
            }
        }
        if (cbRain.checked) {
            ctx.strokeStyle = 'rgba(150,180,220,0.5)';
            ctx.lineWidth = 1;
            for (const drop of rain) {
                ctx.beginPath();
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x - 2, drop.y + 9);
                ctx.stroke();
            }
        }
        info.innerHTML = `time <strong>${(t * 24).toFixed(1)}:00</strong> · ` +
            `phase <strong>${phase(t)}</strong> · skylight <strong>${skyIntensity(t).toFixed(2)}</strong>` +
            (cbRain.checked ? ' · 🌧 raining (skies dimmed)' : '');
    }

    function loop() {
        if (cbAuto.checked) {
            t = (t + 0.0016) % 1;
            slTime.value = String((t * 1000) | 0);
        }
        if (cbRain.checked) {
            for (const drop of rain) {
                drop.y += drop.s;
                drop.x -= 1;
                if (drop.y > canvas.height) { drop.y = -10; drop.x = Math.random() * canvas.width; }
            }
        }
        render();
        requestAnimationFrame(loop);
    }

    slTime.addEventListener('input', () => { t = parseInt(slTime.value, 10) / 1000; });
    render();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 4 — voxPerf: offscreen-canvas tile caching vs per-frame redraw
// =============================================================================
(function voxPerfDemo() {
    const canvas = document.getElementById('voxPerf');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxPerfInfo');
    const btn = document.getElementById('btnPerfToggle');
    ctx.imageSmoothingEnabled = false;

    const W = 160, H = 60, TILE = 11;
    const world = new TileWorld(W, H);
    generateWorld(world, 8, { baseY: 18, amp: 9, caves: true, caveWidth: 0.1, ore: true });

    // Build the cache ONCE: the whole world rendered to an offscreen canvas.
    const cache = document.createElement('canvas');
    cache.width = W * TILE;
    cache.height = H * TILE;
    const cctx = cache.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const id = world.get(x, y);
            if (id !== 0) drawTileTextured(cctx, x * TILE, y * TILE, TILE, id, x, y);
        }

    const camera = { x: 0 };
    let dir = 1, cached = true;
    let avg = 0;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        const t0 = performance.now();

        if (cached) {
            // One blit of the pre-rendered region.
            ctx.drawImage(cache, camera.x, 0, canvas.width, canvas.height,
                                 0, 0, canvas.width, canvas.height);
        } else {
            // Re-run the expensive textured draw for every visible tile.
            const tx0 = Math.max(0, Math.floor(camera.x / TILE));
            const tx1 = Math.min(W, Math.ceil((camera.x + canvas.width) / TILE));
            const ty1 = Math.min(H, Math.ceil(canvas.height / TILE));
            for (let y = 0; y < ty1; y++)
                for (let x = tx0; x < tx1; x++) {
                    const id = world.get(x, y);
                    if (id !== 0) drawTileTextured(ctx, x * TILE - camera.x, y * TILE, TILE, id, x, y);
                }
        }
        const dt = performance.now() - t0;
        avg = avg * 0.9 + dt * 0.1;                 // exponential rolling average

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(8, 8, 250, 26);
        ctx.fillStyle = cached ? VOX_COLORS.ok : VOX_COLORS.bad;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`${cached ? 'CACHED (blit)' : 'UNCACHED (redraw)'}: ${avg.toFixed(2)} ms`, 16, 26);

        info.innerHTML = `mode: <strong>${cached ? 'cached offscreen blit' : 'per-frame textured redraw'}</strong> · ` +
            `draw time <strong>${avg.toFixed(2)} ms</strong>/frame — toggle to compare. ` +
            `The cache trades ${(W * TILE)}×${(H * TILE)}px of memory for one drawImage per frame.`;
    }

    function loop() {
        camera.x += dir * 4;
        if (camera.x <= 0 || camera.x >= W * TILE - canvas.width) dir = -dir;
        render();
        requestAnimationFrame(loop);
    }

    btn.addEventListener('click', () => {
        cached = !cached;
        avg = 0;
        btn.textContent = cached ? 'Caching: ON' : 'Caching: OFF';
        btn.classList.toggle('active', cached);
    });
    btn.classList.add('active');

    render();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 5 — voxCapstone: a living world — player, roaming A* enemy, day/night
// =============================================================================
(function voxCapstoneDemo() {
    const canvas = document.getElementById('voxCapstone');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxCapstoneInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 80, H = 44, TILE = 12;
    const world = new TileWorld(W, H);
    const light = new Float32Array(W * H);
    const keys = new Set();
    const camera = { x: 0, y: 0 };
    let focused = false, drag = null, mouse = { x: 0, y: 0, inside: false };
    let t = 0.3, frame = 0;
    let player, enemy;

    function spawnPlayer() {
        let sy = 0;
        while (world.get(8, sy) === 0 && sy < H) sy++;
        return { x: 8 * TILE, y: (sy - 3) * TILE, w: 11, h: 26,
                 vx: 0, vy: 0, onGround: false, facing: 1 };
    }
    function reset() {
        generateWorld(world, 26, { baseY: 14, amp: 7, caves: true, caveWidth: 0.11, ore: true });
        player = spawnPlayer();
        // The enemy is a "ghost" — it flies along an A* path through open tiles.
        enemy = { x: (W - 10) * TILE, y: 6 * TILE, path: null, idx: 0 };
    }

    function playerTile() {
        return { x: Math.floor((player.x + player.w / 2) / TILE),
                 y: Math.floor((player.y + player.h / 2) / TILE) };
    }
    function enemyTile() {
        return { x: Math.floor(enemy.x / TILE), y: Math.floor(enemy.y / TILE) };
    }

    function render() {
        // Sky colour + skylight both follow the time of day.
        const day = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
        const sky = 0.06 + 0.94 * day;
        const cr = (10 + (74 - 10) * day) | 0;
        const cg = (14 + (122 - 14) * day) | 0;
        const cb = (30 + (176 - 30) * day) | 0;
        computeLight(world, light, sky);

        clearCanvas(ctx, canvas.width, canvas.height, `rgb(${cr},${cg},${cb})`);

        const tx0 = Math.max(0, Math.floor(camera.x / TILE));
        const ty0 = Math.max(0, Math.floor(camera.y / TILE));
        const tx1 = Math.min(W, Math.ceil((camera.x + canvas.width) / TILE));
        const ty1 = Math.min(H, Math.ceil((camera.y + canvas.height) / TILE));
        for (let y = ty0; y < ty1; y++)
            for (let x = tx0; x < tx1; x++) {
                const id = world.get(x, y);
                if (id !== 0) drawTile(ctx, x * TILE - camera.x, y * TILE - camera.y, TILE, id);
            }

        drawPlayer(ctx, player.x - camera.x, player.y - camera.y, player.w, player.h, player.facing);

        // Enemy — a translucent red ghost.
        ctx.fillStyle = 'rgba(239,83,80,0.85)';
        ctx.beginPath();
        ctx.arc(enemy.x - camera.x + TILE / 2, enemy.y - camera.y + TILE / 2, TILE * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#11151f';
        ctx.stroke();

        // Darkness overlay (only over visible tiles).
        for (let y = ty0; y < ty1; y++)
            for (let x = tx0; x < tx1; x++) {
                const d = 1 - light[y * W + x];
                if (d <= 0.02) continue;
                ctx.fillStyle = `rgba(4,6,14,${d.toFixed(3)})`;
                ctx.fillRect(x * TILE - camera.x, y * TILE - camera.y, TILE, TILE);
            }

        // Mining cursor.
        if (mouse.inside) {
            const ct = screenToTile(mouse.x, mouse.y, TILE, camera.x, camera.y);
            ctx.strokeStyle = VOX_COLORS.accent;
            ctx.lineWidth = 2;
            ctx.strokeRect(ct.x * TILE - camera.x + 1, ct.y * TILE - camera.y + 1, TILE - 2, TILE - 2);
        }

        if (!focused) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to focus — A/D move · W jump · click mines · the ghost A*-hunts you',
                         canvas.width / 2, canvas.height - 13);
            ctx.textAlign = 'start';
        }
        const hh = (t * 24) | 0;
        info.innerHTML = `time <strong>${hh}:00</strong> · ` +
            `enemy path: <strong>${enemy.path ? enemy.path.length : 0}</strong> tiles — ` +
            `mine walls to reshape its route.`;
    }

    function loop() {
        frame++;
        t = (t + 0.0009) % 1;

        updatePlayer(world, player, keys, TILE);
        if (player.y > H * TILE + 120) player = spawnPlayer();

        // Re-plan the enemy's route toward the player a few times a second.
        if (frame % 36 === 0) {
            const r = aStar(world, enemyTile(), playerTile());
            enemy.path = r.path;
            enemy.idx = 0;
        }
        // Glide the enemy along its path.
        if (enemy.path && enemy.idx < enemy.path.length) {
            const node = enemy.path[enemy.idx];
            const tx = node.x * TILE, ty = node.y * TILE;
            const dx = tx - enemy.x, dy = ty - enemy.y;
            const dist = Math.hypot(dx, dy);
            const sp = 1.7;
            if (dist < sp) { enemy.x = tx; enemy.y = ty; enemy.idx++; }
            else { enemy.x += dx / dist * sp; enemy.y += dy / dist * sp; }
        }

        camera.x = Math.max(0, Math.min(W * TILE - canvas.width,
                            player.x + player.w / 2 - canvas.width / 2));
        camera.y = Math.max(0, Math.min(H * TILE - canvas.height,
                            player.y + player.h / 2 - canvas.height / 2));

        if (drag === 'mine') {
            const ct = screenToTile(mouse.x, mouse.y, TILE, camera.x, camera.y);
            if (isSolid(world.get(ct.x, ct.y))) world.set(ct.x, ct.y, 0);
        }
        render();
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('focus', () => { focused = true; });
    canvas.addEventListener('blur',  () => { focused = false; keys.clear(); drag = null; });
    canvas.addEventListener('click', () => canvas.focus());
    canvas.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
            e.preventDefault();
            keys.add(k);
            if ((k === 'w' || k === 'arrowup' || k === ' ') && player.onGround) player.vy = VOX_JUMP;
        }
    });
    canvas.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.inside = true;
    });
    canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
    canvas.addEventListener('mousedown', () => { canvas.focus(); drag = 'mine'; });
    window.addEventListener('mouseup', () => { drag = null; });
    document.getElementById('btnCapstoneReset').addEventListener('click', reset);

    reset();
    requestAnimationFrame(loop);
})();
