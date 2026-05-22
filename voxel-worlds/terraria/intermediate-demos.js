// =============================================================================
// TERRARIA SUB-TRACK — INTERMEDIATE TIER DEMOS
// =============================================================================
// Each demo is an IIFE that early-returns if its canvas is absent, so this file
// is safe to include from any page. Module-level helpers are defined once at
// the top and reused. (This tier's demos file is self-contained — it re-declares
// the core voxel helpers rather than depending on beginner-demos.js, matching
// the project convention that each tier's <tier>-demos.js stands alone.)
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
// Shared palette + materials. The Intermediate table extends the Beginner one
// with `gravel` (id 8) and a `falls` flag on the gravity-affected materials.
// ---------------------------------------------------------------------------
const VOX_COLORS = {
    bg: '#0d1117',
    sky: '#1a2547',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    ok: '#66bb6a',
    bad: '#ef5350',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e'
};

const VOX_MATERIALS = [
    { id: 0, name: 'air',    color: null,      solid: false, falls: false },
    { id: 1, name: 'dirt',   color: '#7a4f2b', solid: true,  falls: false },
    { id: 2, name: 'grass',  color: '#4a8a3a', solid: true,  falls: false },
    { id: 3, name: 'stone',  color: '#6e6e7a', solid: true,  falls: false },
    { id: 4, name: 'ore',    color: '#d4a843', solid: true,  falls: false },
    { id: 5, name: 'wood',   color: '#8a5a2a', solid: true,  falls: false },
    { id: 6, name: 'sand',   color: '#d7c878', solid: true,  falls: true  },
    { id: 7, name: 'water',  color: '#4fc3f7', solid: false, falls: false },
    { id: 8, name: 'gravel', color: '#888078', solid: true,  falls: true  }
];

// Cheap deterministic 2D hash — visual noise only.
function hash2D(x, y, seed = 0) {
    let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}

// Tile coord <-> screen pixel (carried over from the Beginner tier).
function screenToTile(sx, sy, tile, cameraX = 0, cameraY = 0) {
    return {
        x: Math.floor((sx + cameraX) / tile),
        y: Math.floor((sy + cameraY) / tile)
    };
}

// Tile-data container — flat Uint8Array, out-of-bounds reads return 0 ("air").
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

// Material predicates.
function isSolid(id) { const m = VOX_MATERIALS[id]; return !!(m && m.solid); }
function isAir(id)   { return id === 0; }

// Beveled solid-color tile draw — a 2px darker bottom/right edge gives each
// tile definition without needing image assets.
function drawTile(ctx, sx, sy, size, id) {
    const m = VOX_MATERIALS[id];
    if (!m || !m.color) return;
    ctx.fillStyle = m.color;
    ctx.fillRect(sx, sy, size, size);
    if (size >= 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(sx, sy + size - 2, size, 2);
        ctx.fillRect(sx + size - 2, sy, 2, size);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(sx, sy, size, 1);
    }
}

// --- Intermediate-tier helpers ---------------------------------------------

// Chebyshev (square) reach test — a tile is editable only if near the player.
function tileReachOk(px, py, tx, ty, reach) {
    return Math.max(Math.abs(tx - px), Math.abs(ty - py)) <= reach;
}

// A cell a falling tile can move INTO: in-bounds air.
function isOpen(world, x, y) {
    return world.inBounds(x, y) && world.get(x, y) === 0;
}

// Falling-sand cellular automaton — advance every falling tile one cell.
// Bottom-up scan so a tile moves at most one cell per tick.
function stepFalling(world) {
    let moved = 0;
    for (let y = world.height - 2; y >= 0; y--) {
        for (let x = 0; x < world.width; x++) {
            const id = world.get(x, y);
            const m = VOX_MATERIALS[id];
            if (!m || !m.falls) continue;
            if (isOpen(world, x, y + 1)) {
                world.set(x, y, 0);
                world.set(x, y + 1, id);
                moved++;
                continue;
            }
            const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
            for (const dx of dirs) {
                if (isOpen(world, x + dx, y + 1) && isOpen(world, x + dx, y)) {
                    world.set(x, y, 0);
                    world.set(x + dx, y + 1, id);
                    moved++;
                    break;
                }
            }
        }
    }
    return moved;
}

// Tile range an AABB (px,py,pw,ph in pixels) overlaps.
// The half-open span [pos, pos+size) touches integer cells
// floor(pos) .. ceil(pos+size)-1. Using ceil(end)-1 (rather than
// floor(end-1)) means a sub-pixel overlap is detected the same frame —
// so a player nudged into the floor by gravity is snapped flush
// immediately, with no 1px sink/jitter and a stable onGround flag.
function overlappingTiles(px, py, pw, ph, TILE) {
    return {
        x0: Math.floor(px / TILE),
        x1: Math.ceil((px + pw) / TILE) - 1,
        y0: Math.floor(py / TILE),
        y1: Math.ceil((py + ph) / TILE) - 1
    };
}

// Per-axis AABB-vs-grid resolution. Move X, snap out; move Y, snap out.
function moveX(world, p, TILE) {
    p.x += p.vx;
    const r = overlappingTiles(p.x, p.y, p.w, p.h, TILE);
    let hit = null;
    for (let ty = r.y0; ty <= r.y1; ty++) {
        for (let tx = r.x0; tx <= r.x1; tx++) {
            if (!isSolid(world.get(tx, ty))) continue;
            hit = hit === null ? tx : (p.vx > 0 ? Math.min(hit, tx) : Math.max(hit, tx));
        }
    }
    if (hit !== null) {
        p.x = p.vx > 0 ? hit * TILE - p.w : (hit + 1) * TILE;
        p.vx = 0;
    }
}
function moveY(world, p, TILE) {
    p.y += p.vy;
    p.onGround = false;
    const r = overlappingTiles(p.x, p.y, p.w, p.h, TILE);
    let hit = null;
    for (let ty = r.y0; ty <= r.y1; ty++) {
        for (let tx = r.x0; tx <= r.x1; tx++) {
            if (!isSolid(world.get(tx, ty))) continue;
            hit = hit === null ? ty : (p.vy > 0 ? Math.min(hit, ty) : Math.max(hit, ty));
        }
    }
    if (hit !== null) {
        if (p.vy > 0) { p.y = hit * TILE - p.h; p.onGround = true; }
        else          { p.y = (hit + 1) * TILE; }
        p.vy = 0;
    }
}

// Player physics constants — tuned so a jump clears ~3 tiles.
const VOX_GRAVITY = 0.55;
const VOX_MOVE = 2.3;
const VOX_JUMP = -8.2;
const VOX_MAX_FALL = 11;

function updatePlayer(world, p, keys, TILE) {
    p.vx = 0;
    if (keys.has('a') || keys.has('arrowleft'))  { p.vx = -VOX_MOVE; p.facing = -1; }
    if (keys.has('d') || keys.has('arrowright')) { p.vx =  VOX_MOVE; p.facing =  1; }
    p.vy = Math.min(p.vy + VOX_GRAVITY, VOX_MAX_FALL);
    moveX(world, p, TILE);
    moveY(world, p, TILE);
}

// Draw the player avatar (a little green figure) at a screen position.
function drawPlayer(ctx, sx, sy, w, h, facing) {
    ctx.fillStyle = '#5a9e58';
    ctx.fillRect(sx, sy, w, h);
    ctx.fillStyle = '#7ec97c';
    ctx.fillRect(sx, sy, w, Math.round(h * 0.34));
    ctx.strokeStyle = '#11151f';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#0d1117';
    const eyeX = facing >= 0 ? sx + w - 5 : sx + 2;
    ctx.fillRect(eyeX, sy + 5, 3, 3);
}

// --- World builders ---------------------------------------------------------

// A simple hand-authored cross-section for the picking / mine-place demos.
function buildEditWorld(W, H) {
    const w = new TileWorld(W, H);
    for (let x = 0; x < W; x++) {
        const surfaceY = Math.round(H * 0.42) + Math.round(Math.sin(x * 0.45) * 1.2);
        for (let y = 0; y < H; y++) {
            if (y < surfaceY)             w.set(x, y, 0);
            else if (y === surfaceY)      w.set(x, y, 2);
            else if (y < surfaceY + 3)    w.set(x, y, 1);
            else                          w.set(x, y, 3);
        }
    }
    // A scatter of ore + a couple of sand pockets to mine.
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (w.get(x, y) === 3 && hash2D(x, y, 42) > 0.93) w.set(x, y, 4);
        }
    }
    return w;
}

// Sand-cloud + ledges for the falling demo. A loose cloud of sand sits in the
// air so the first "Step" visibly rains it down.
function buildSandWorld(W, H) {
    const w = new TileWorld(W, H);
    // Stone floor.
    for (let x = 0; x < W; x++) {
        w.set(x, H - 1, 3);
        w.set(x, H - 2, 3);
    }
    // Two stone ledges to catch sand at angles.
    for (let x = 6;  x < 19; x++) w.set(x, H - 9,  3);
    for (let x = 28; x < 43; x++) w.set(x, H - 14, 3);
    // A loose scatter of sand floating in the upper area.
    for (let x = 8; x < 40; x++) {
        for (let y = 3; y < 9; y++) {
            if ((x + y * 2) % 3 === 0) w.set(x, y, 6);
        }
    }
    return w;
}

// Flat-topped platforms with gaps + bordering walls for the player demo.
function buildPlatformWorld(W, H) {
    const w = new TileWorld(W, H);
    // Side walls (so the player can't walk off the edge).
    for (let y = 0; y < H; y++) { w.set(0, y, 3); w.set(W - 1, y, 3); }
    // Ground.
    for (let x = 0; x < W; x++) {
        w.set(x, H - 1, 3);
        w.set(x, H - 2, 1);
        w.set(x, H - 3, 2);
    }
    // Floating wood platforms (flat strips) at varied heights.
    const strip = (x0, x1, y) => { for (let x = x0; x <= x1; x++) w.set(x, y, 5); };
    strip(5, 12, H - 7);
    strip(17, 25, H - 11);
    strip(30, 38, H - 8);
    strip(34, 41, H - 14);
    // A couple of solid stone pillars to bump into horizontally.
    for (let y = H - 6; y < H - 3; y++) { w.set(15, y, 3); w.set(28, y, 3); }
    return w;
}

// Larger world for the digger mini-project: noisy surface, caves, sand dunes.
function buildDiggerWorld(W, H) {
    const w = new TileWorld(W, H);
    for (let x = 0; x < W; x++) {
        const surfaceY = 17 + Math.round(Math.sin(x * 0.12) * 3 + Math.sin(x * 0.05) * 2);
        for (let y = 0; y < H; y++) {
            if (y < surfaceY)            w.set(x, y, 0);
            else if (y === surfaceY)     w.set(x, y, 2);
            else if (y < surfaceY + 5)   w.set(x, y, 1);
            else {
                w.set(x, y, 3);
                if (hash2D(x, y, 17) > 0.95) w.set(x, y, 4);
            }
        }
    }
    // Carve two caves.
    const carve = (cx, cy, r) => {
        for (let y = cy - r; y <= cy + r; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
                if (Math.hypot(x - cx, y - cy) < r - hash2D(x, y, 9) * 1.4) w.set(x, y, 0);
            }
        }
    };
    carve(46, 32, 6);
    carve(82, 28, 7);
    // Sand dunes sitting on the surface — mine the dirt under them and they pour.
    const dune = (x0, x1) => {
        for (let x = x0; x <= x1; x++) {
            let sy = 0;
            while (w.get(x, sy) === 0 && sy < H) sy++;     // find surface
            for (let k = 1; k <= 4; k++) w.set(x, sy - k, 6);
        }
    };
    dune(26, 34);
    dune(64, 70);
    return w;
}

// =============================================================================
// DEMO 1 — voxPicking: hover-to-tile + tool-reach square
// =============================================================================
(function voxPickingDemo() {
    const canvas = document.getElementById('voxPicking');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxPickingInfo');
    const reachSlider = document.getElementById('voxPickReach');
    const reachValue = document.getElementById('voxPickReachValue');
    ctx.imageSmoothingEnabled = false;

    const W = 30, H = 16, TILE = 22;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;
    const world = buildEditWorld(W, H);
    const playerTile = { x: 15, y: 7 };
    let reach = 5;
    let hover = { x: -1, y: -1, inside: false };

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));

        // Reach square (translucent overlay).
        ctx.fillStyle = 'rgba(255, 167, 38, 0.12)';
        ctx.fillRect(ox + (playerTile.x - reach) * TILE, oy + (playerTile.y - reach) * TILE,
                     (reach * 2 + 1) * TILE, (reach * 2 + 1) * TILE);
        ctx.strokeStyle = 'rgba(255, 167, 38, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox + (playerTile.x - reach) * TILE + 0.5, oy + (playerTile.y - reach) * TILE + 0.5,
                       (reach * 2 + 1) * TILE, (reach * 2 + 1) * TILE);

        // Player marker.
        ctx.fillStyle = VOX_COLORS.accent;
        ctx.fillRect(ox + playerTile.x * TILE + 3, oy + playerTile.y * TILE + 2, TILE - 6, TILE - 4);
        ctx.strokeStyle = '#11151f';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + playerTile.x * TILE + 3.5, oy + playerTile.y * TILE + 2.5, TILE - 7, TILE - 5);

        // Hovered tile highlight.
        if (hover.inside && world.inBounds(hover.x, hover.y)) {
            const ok = tileReachOk(playerTile.x, playerTile.y, hover.x, hover.y, reach);
            ctx.strokeStyle = ok ? VOX_COLORS.ok : VOX_COLORS.bad;
            ctx.lineWidth = 3;
            ctx.strokeRect(ox + hover.x * TILE + 1.5, oy + hover.y * TILE + 1.5, TILE - 3, TILE - 3);
            const dist = Math.max(Math.abs(hover.x - playerTile.x), Math.abs(hover.y - playerTile.y));
            info.innerHTML =
                `Tile <strong>(${hover.x}, ${hover.y})</strong> · ` +
                `Chebyshev distance <strong>${dist}</strong> · ` +
                `reach ${reach} → <strong style="color:${ok ? VOX_COLORS.ok : VOX_COLORS.bad}">` +
                `${ok ? 'IN REACH' : 'OUT OF REACH'}</strong>`;
        } else {
            info.textContent = `Hover over the grid. Reach = ${reach} tiles.`;
        }
    }

    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left - ox, e.clientY - r.top - oy, TILE);
        hover = { x: t.x, y: t.y, inside: true };
        render();
    });
    canvas.addEventListener('mouseleave', () => { hover.inside = false; render(); });
    reachSlider.addEventListener('input', () => {
        reach = parseInt(reachSlider.value, 10);
        reachValue.textContent = reach;
        render();
    });

    render();
})();

// =============================================================================
// DEMO 2 — voxMinePlace: left-click mines, right-click places, hotbar palette
// =============================================================================
(function voxMinePlaceDemo() {
    const canvas = document.getElementById('voxMinePlace');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxMinePlaceInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 32, H = 17, TILE = 22, REACH = 5;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;
    let world = buildEditWorld(W, H);
    const playerTile = { x: 16, y: 7 };
    let selected = 1; // dirt
    let drag = null;  // 'mine' | 'place' | null
    let lastAction = '';

    // Hotbar wiring — material id keyed by button id + number key.
    const HOTBAR = [
        { btn: 'btnMatDirt',  key: '1', id: 1 },
        { btn: 'btnMatStone', key: '2', id: 3 },
        { btn: 'btnMatWood',  key: '3', id: 5 },
        { btn: 'btnMatSand',  key: '4', id: 6 }
    ];
    function selectMaterial(id) {
        selected = id;
        HOTBAR.forEach(h => {
            document.getElementById(h.btn).classList.toggle('active', h.id === id);
        });
        render();
    }

    function mineAt(tx, ty) {
        if (!tileReachOk(playerTile.x, playerTile.y, tx, ty, REACH)) return false;
        const id = world.get(tx, ty);
        if (id === 0 || !isSolid(id)) return false;
        world.set(tx, ty, 0);
        return true;
    }
    function placeAt(tx, ty) {
        if (!tileReachOk(playerTile.x, playerTile.y, tx, ty, REACH)) return false;
        if (world.get(tx, ty) !== 0) return false;
        world.set(tx, ty, selected);
        return true;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));

        ctx.strokeStyle = 'rgba(255, 167, 38, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox + (playerTile.x - REACH) * TILE + 0.5, oy + (playerTile.y - REACH) * TILE + 0.5,
                       (REACH * 2 + 1) * TILE, (REACH * 2 + 1) * TILE);

        ctx.fillStyle = VOX_COLORS.accent;
        ctx.fillRect(ox + playerTile.x * TILE + 3, oy + playerTile.y * TILE + 2, TILE - 6, TILE - 4);
        ctx.strokeStyle = '#11151f';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + playerTile.x * TILE + 3.5, oy + playerTile.y * TILE + 2.5, TILE - 7, TILE - 5);

        const m = VOX_MATERIALS[selected];
        info.innerHTML =
            `Selected: <strong style="color:${m.color}">${m.name}</strong> · ` +
            `Left-click mines · right-click places` +
            (lastAction ? ` · <em>${lastAction}</em>` : '');
    }

    function tileAt(e) {
        const r = canvas.getBoundingClientRect();
        return screenToTile(e.clientX - r.left - ox, e.clientY - r.top - oy, TILE);
    }
    function actAt(e) {
        const t = tileAt(e);
        if (drag === 'mine') {
            lastAction = mineAt(t.x, t.y) ? `mined (${t.x}, ${t.y})` : 'out of reach / nothing to mine';
        } else if (drag === 'place') {
            lastAction = placeAt(t.x, t.y) ? `placed at (${t.x}, ${t.y})` : 'out of reach / occupied';
        }
        render();
    }

    canvas.addEventListener('mousedown', (e) => {
        drag = e.button === 2 ? 'place' : 'mine';
        actAt(e);
    });
    canvas.addEventListener('mousemove', (e) => { if (drag) actAt(e); });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    HOTBAR.forEach(h => {
        document.getElementById(h.btn).addEventListener('click', () => selectMaterial(h.id));
    });
    window.addEventListener('keydown', (e) => {
        const h = HOTBAR.find(x => x.key === e.key);
        if (h) selectMaterial(h.id);
    });
    document.getElementById('btnMinePlaceReset').addEventListener('click', () => {
        world = buildEditWorld(W, H);
        lastAction = 'world reset';
        render();
    });

    selectMaterial(1);
})();

// =============================================================================
// DEMO 3 — voxFalling: falling-sand cellular automaton with Step / Run / Reset
// =============================================================================
(function voxFallingDemo() {
    const canvas = document.getElementById('voxFalling');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxFallingInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 48, H = 26, TILE = 14;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;
    let world = buildSandWorld(W, H);
    let running = false;
    let drawing = false;
    let ticks = 0;

    const btnStep  = document.getElementById('btnFallingStep');
    const btnRun   = document.getElementById('btnFallingRun');
    const btnReset = document.getElementById('btnFallingReset');

    function countSand() {
        let n = 0;
        for (let i = 0; i < world.tiles.length; i++) if (world.tiles[i] === 6) n++;
        return n;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
        info.innerHTML =
            `${running ? '<strong style="color:#66bb6a">RUNNING</strong>' : 'paused'} · ` +
            `tick ${ticks} · sand: ${countSand()} · click/drag to drop sand`;
    }

    function step() {
        stepFalling(world);
        ticks++;
        render();
    }

    function loop() {
        if (running) { stepFalling(world); ticks++; render(); }
        requestAnimationFrame(loop);
    }

    function dropAt(e) {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left - ox, e.clientY - r.top - oy, TILE);
        // 2×2 brush of sand into air cells only.
        for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
                if (world.get(t.x + dx, t.y + dy) === 0) world.set(t.x + dx, t.y + dy, 6);
        render();
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; dropAt(e); });
    canvas.addEventListener('mousemove', (e) => { if (drawing) dropAt(e); });
    window.addEventListener('mouseup', () => { drawing = false; });

    btnStep.addEventListener('click', () => { if (!running) step(); });
    btnRun.addEventListener('click', () => {
        running = !running;
        btnRun.textContent = running ? 'Pause' : 'Run';
        btnRun.classList.toggle('active', running);
        render();
    });
    btnReset.addEventListener('click', () => {
        world = buildSandWorld(W, H);
        ticks = 0;
        running = false;
        btnRun.textContent = 'Run';
        btnRun.classList.remove('active');
        render();
    });

    render();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 4 — voxPlayer: a player avatar with per-axis AABB collision
// =============================================================================
(function voxPlayerDemo() {
    const canvas = document.getElementById('voxPlayer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxPlayerInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 44, H = 22, TILE = 16;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;
    const world = buildPlatformWorld(W, H);
    const keys = new Set();
    let focused = false;

    const spawn = () => ({ x: 3 * TILE, y: 2 * TILE, w: 11, h: 26, vx: 0, vy: 0, onGround: false, facing: 1 });
    let player = spawn();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
        drawPlayer(ctx, ox + player.x, oy + player.y, player.w, player.h, player.facing);

        if (!focused) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to focus — then A/D move, W / Space jump', canvas.width / 2, canvas.height - 13);
            ctx.textAlign = 'start';
        }
        info.innerHTML =
            `pos (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) · ` +
            `vel (${player.vx.toFixed(1)}, ${player.vy.toFixed(1)}) · ` +
            `onGround: <strong>${player.onGround}</strong>`;
    }

    function loop() {
        updatePlayer(world, player, keys, TILE);
        // If the player falls out of the world, respawn.
        if (player.y > H * TILE + 80) player = spawn();
        render();
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('focus', () => { focused = true; });
    canvas.addEventListener('blur',  () => { focused = false; keys.clear(); });
    canvas.addEventListener('click', () => canvas.focus());
    canvas.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
            e.preventDefault();
            keys.add(k);
            // Edge-triggered jump: only when standing on a solid tile.
            if ((k === 'w' || k === 'arrowup' || k === ' ') && player.onGround) {
                player.vy = VOX_JUMP;
            }
        }
    });
    canvas.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    document.getElementById('btnPlayerReset').addEventListener('click', () => { player = spawn(); });

    render();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 5 — voxDigger: the mini-project — player + camera + mining + falling sand
// =============================================================================
(function voxDiggerDemo() {
    const canvas = document.getElementById('voxDigger');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxDiggerInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 120, H = 48, TILE = 16, REACH = 5;
    let world = buildDiggerWorld(W, H);
    const keys = new Set();
    const camera = { x: 0, y: 0 };
    let focused = false;
    let selected = 1;
    let drag = null;          // 'mine' | 'place'
    let mouse = { x: 0, y: 0, inside: false };
    let frame = 0;

    const spawnPlayer = () => {
        // Drop the player onto the surface near column 12.
        let sy = 0;
        while (world.get(12, sy) === 0 && sy < H) sy++;
        return { x: 12 * TILE, y: (sy - 3) * TILE, w: 11, h: 26, vx: 0, vy: 0, onGround: false, facing: 1 };
    };
    let player = spawnPlayer();

    const HOTBAR = [
        { btn: 'btnDigDirt',  key: '1', id: 1 },
        { btn: 'btnDigStone', key: '2', id: 3 },
        { btn: 'btnDigWood',  key: '3', id: 5 },
        { btn: 'btnDigSand',  key: '4', id: 6 }
    ];
    function selectMaterial(id) {
        selected = id;
        HOTBAR.forEach(h => document.getElementById(h.btn).classList.toggle('active', h.id === id));
    }

    function playerTile() {
        return {
            x: Math.floor((player.x + player.w / 2) / TILE),
            y: Math.floor((player.y + player.h / 2) / TILE)
        };
    }

    function editAt() {
        const pt = playerTile();
        const t = screenToTile(mouse.x, mouse.y, TILE, camera.x, camera.y);
        if (!tileReachOk(pt.x, pt.y, t.x, t.y, REACH)) return;
        if (drag === 'mine') {
            const id = world.get(t.x, t.y);
            if (id !== 0 && isSolid(id)) world.set(t.x, t.y, 0);
        } else if (drag === 'place') {
            if (world.get(t.x, t.y) === 0) {
                // Don't place a tile inside the player's own body.
                const px0 = Math.floor(player.x / TILE), px1 = Math.floor((player.x + player.w - 1) / TILE);
                const py0 = Math.floor(player.y / TILE), py1 = Math.floor((player.y + player.h - 1) / TILE);
                const insidePlayer = t.x >= px0 && t.x <= px1 && t.y >= py0 && t.y <= py1;
                if (!insidePlayer) world.set(t.x, t.y, selected);
            }
        }
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);

        // Viewport-culled tile render.
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

        // Reach square + cursor highlight.
        const pt = playerTile();
        ctx.strokeStyle = 'rgba(255,167,38,0.4)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect((pt.x - REACH) * TILE - camera.x + 0.5, (pt.y - REACH) * TILE - camera.y + 0.5,
                       (REACH * 2 + 1) * TILE, (REACH * 2 + 1) * TILE);
        // Cursor-tile highlight — only while the mouse is actually over the canvas.
        if (mouse.inside) {
            const ct = screenToTile(mouse.x, mouse.y, TILE, camera.x, camera.y);
            const ok = tileReachOk(pt.x, pt.y, ct.x, ct.y, REACH);
            ctx.strokeStyle = ok ? VOX_COLORS.ok : VOX_COLORS.bad;
            ctx.lineWidth = 2;
            ctx.strokeRect(ct.x * TILE - camera.x + 1, ct.y * TILE - camera.y + 1, TILE - 2, TILE - 2);
        }

        if (!focused) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to focus — A/D move · W jump · click mines · right-click places',
                         canvas.width / 2, canvas.height - 13);
            ctx.textAlign = 'start';
        }
        const m = VOX_MATERIALS[selected];
        info.innerHTML =
            `Selected: <strong style="color:${m.color}">${m.name}</strong> · ` +
            `player tile (${pt.x}, ${pt.y}) · onGround ${player.onGround}`;
    }

    function loop() {
        updatePlayer(world, player, keys, TILE);
        if (player.y > H * TILE + 100) player = spawnPlayer();

        // Camera follows the player, clamped to world bounds.
        camera.x = Math.max(0, Math.min(W * TILE - canvas.width,
                            player.x + player.w / 2 - canvas.width / 2));
        camera.y = Math.max(0, Math.min(H * TILE - canvas.height,
                            player.y + player.h / 2 - canvas.height / 2));

        // Continuous edit while the mouse button is held.
        if (drag) editAt();

        // Step falling sand every 4th frame (≈15 Hz) — Terraria-ish pacing.
        frame++;
        if (frame % 4 === 0) stepFalling(world);

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
        const h = HOTBAR.find(x => x.key === e.key);
        if (h) selectMaterial(h.id);
    });
    canvas.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.inside = true;
    });
    canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
    canvas.addEventListener('mousedown', (e) => {
        canvas.focus();
        drag = e.button === 2 ? 'place' : 'mine';
        editAt();
    });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    HOTBAR.forEach(h => {
        document.getElementById(h.btn).addEventListener('click', () => selectMaterial(h.id));
    });
    document.getElementById('btnDigReset').addEventListener('click', () => {
        world = buildDiggerWorld(W, H);
        player = spawnPlayer();
    });

    selectMaterial(1);
    requestAnimationFrame(loop);
})();
