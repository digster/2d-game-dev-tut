// =============================================================================
// TERRARIA SUB-TRACK — INTERMEDIATE TIER EXPORT BUNDLES
// =============================================================================
// Feeds the shared export-demo injector (shared/export-demo.js): the 📋 Export
// button on each `<details data-demo-id="vox_*">` copies a runnable single-file
// HTML to the clipboard.
//
// ── Canvas-ID convention ─────────────────────────────────────────────────────
// The standalone scaffold hardcodes `<canvas id="canvas">` and `<div id="info">`.
// The DEMO_CODE strings below are rewrites of the page IIFEs with those fixed
// IDs, and with keyboard listeners moved to `window` (the standalone page is a
// single demo, so it doesn't need the page's click-to-focus dance).
//
// ── Scope (iteration 2) ──────────────────────────────────────────────────────
// Only the two demos with button-only controls are bundled: `vox_falling`
// (Step / Run / Reset) and `vox_player` (Reset). `voxPicking` (slider),
// `voxMinePlace` and `voxDigger` (which depend on a player-relative reach and
// large hand-built worlds) omit `data-demo-id` and show no Export button —
// the scaffold's `controls` only renders <button>s.
//
// ── TypeScript variants ──────────────────────────────────────────────────────
// DEMO_CODE_TS / DEPENDENCY_BUNDLES_TS are aliased to their JS forms. Plain JS
// is valid TypeScript (Sucrase's `typescript` transform only strips type
// annotations — JS with none passes through unchanged), so a TS-tab export
// still runs. This matches the shaders `simulations` tier precedent and keeps
// these large physics IIFEs single-sourced. The *teaching* code blocks in
// intermediate.html still ship hand-written, fully-typed TS panes.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// =============================================================================
// DEPENDENCY BUNDLES — reusable helpers inlined at export time.
// =============================================================================

DEPENDENCY_BUNDLES.vox_colors = `// Shared palette for voxel demos.
const VOX_COLORS = {
    bg: '#0d1117',
    sky: '#1a2547',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    ok: '#66bb6a',
    bad: '#ef5350',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e'
};`;

DEPENDENCY_BUNDLES.vox_materials = `// Material ID -> { name, color, solid, falls }. ID 0 is always "air".
// 'falls' marks the gravity-affected materials (sand, gravel).
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
];`;

DEPENDENCY_BUNDLES.vox_clearCanvas = `// Fill the entire canvas with a solid color.
function clearCanvas(ctx, width, height, bgColor = '#0d1117') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;

DEPENDENCY_BUNDLES.vox_drawTile = `// Beveled solid-color tile draw — a 2px darker bottom/right edge gives each
// tile definition without image assets. Air (id 0) is skipped.
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
}`;

DEPENDENCY_BUNDLES.vox_isSolid = `// Does this material block movement?
function isSolid(id) {
    const m = VOX_MATERIALS[id];
    return !!(m && m.solid);
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

// drawTile and isSolid both read VOX_MATERIALS — declare the requirement so the
// closure resolver always emits the materials table first.
DEPENDENCY_REQUIRES.vox_drawTile = ['vox_materials'];
DEPENDENCY_REQUIRES.vox_isSolid  = ['vox_materials'];

// TS aliases — plain JS is valid TS (see file header).
DEPENDENCY_BUNDLES_TS.vox_colors      = DEPENDENCY_BUNDLES.vox_colors;
DEPENDENCY_BUNDLES_TS.vox_materials   = DEPENDENCY_BUNDLES.vox_materials;
DEPENDENCY_BUNDLES_TS.vox_clearCanvas = DEPENDENCY_BUNDLES.vox_clearCanvas;
DEPENDENCY_BUNDLES_TS.vox_drawTile    = DEPENDENCY_BUNDLES.vox_drawTile;
DEPENDENCY_BUNDLES_TS.vox_isSolid     = DEPENDENCY_BUNDLES.vox_isSolid;
DEPENDENCY_BUNDLES_TS.vox_TileWorld   = DEPENDENCY_BUNDLES.vox_TileWorld;

// =============================================================================
// DEMO — vox_falling: the falling-sand cellular automaton
// =============================================================================
DEMO_HTML.vox_falling = {
    title: 'Voxel — Falling Sand Cellular Automaton',
    canvas: { width: 720, height: 400 },
    controls: [
        { id: 'btnFallingStep',  text: 'Step once' },
        { id: 'btnFallingRun',   text: 'Run' },
        { id: 'btnFallingReset', text: 'Reset' }
    ],
    info: 'Click to drop sand, then Step or Run.'
};

DEMO_CODE.vox_falling = `(function voxFallingDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 48, H = 26, TILE = 14;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;

    // A cell a falling tile can move INTO: in-bounds air.
    function isOpen(world, x, y) {
        return world.inBounds(x, y) && world.get(x, y) === 0;
    }
    // Advance every falling tile one cell. Bottom-up scan = no teleporting.
    function stepFalling(world) {
        for (let y = world.height - 2; y >= 0; y--) {
            for (let x = 0; x < world.width; x++) {
                const id = world.get(x, y);
                const m = VOX_MATERIALS[id];
                if (!m || !m.falls) continue;
                if (isOpen(world, x, y + 1)) {
                    world.set(x, y, 0); world.set(x, y + 1, id); continue;
                }
                const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
                for (const dx of dirs) {
                    if (isOpen(world, x + dx, y + 1) && isOpen(world, x + dx, y)) {
                        world.set(x, y, 0); world.set(x + dx, y + 1, id); break;
                    }
                }
            }
        }
    }
    function buildSandWorld() {
        const w = new TileWorld(W, H);
        for (let x = 0; x < W; x++) { w.set(x, H - 1, 3); w.set(x, H - 2, 3); }
        for (let x = 6;  x < 19; x++) w.set(x, H - 9,  3);
        for (let x = 28; x < 43; x++) w.set(x, H - 14, 3);
        for (let x = 8; x < 40; x++)
            for (let y = 3; y < 9; y++)
                if ((x + y * 2) % 3 === 0) w.set(x, y, 6);
        return w;
    }

    let world = buildSandWorld();
    let running = false, drawing = false, ticks = 0;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
        info.textContent = (running ? 'RUNNING' : 'paused') + ' · tick ' + ticks +
                           ' · click/drag to drop sand';
    }
    function loop() {
        if (running) { stepFalling(world); ticks++; render(); }
        requestAnimationFrame(loop);
    }
    function dropAt(e) {
        const r = canvas.getBoundingClientRect();
        const tx = Math.floor((e.clientX - r.left - ox) / TILE);
        const ty = Math.floor((e.clientY - r.top - oy) / TILE);
        for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
                if (world.get(tx + dx, ty + dy) === 0) world.set(tx + dx, ty + dy, 6);
        render();
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; dropAt(e); });
    canvas.addEventListener('mousemove', (e) => { if (drawing) dropAt(e); });
    window.addEventListener('mouseup', () => { drawing = false; });

    document.getElementById('btnFallingStep').addEventListener('click', () => {
        if (!running) { stepFalling(world); ticks++; render(); }
    });
    document.getElementById('btnFallingRun').addEventListener('click', () => {
        running = !running;
        document.getElementById('btnFallingRun').textContent = running ? 'Pause' : 'Run';
        render();
    });
    document.getElementById('btnFallingReset').addEventListener('click', () => {
        world = buildSandWorld(); ticks = 0; running = false;
        document.getElementById('btnFallingRun').textContent = 'Run';
        render();
    });

    render();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.vox_falling = DEMO_CODE.vox_falling;

// =============================================================================
// DEMO — vox_player: a player avatar with per-axis AABB collision
// =============================================================================
DEMO_HTML.vox_player = {
    title: 'Voxel — Player AABB Collision',
    canvas: { width: 720, height: 384 },
    controls: [
        { id: 'btnPlayerReset', text: 'Reset player' }
    ],
    info: 'A/D move · W / Space jump.'
};

DEMO_CODE.vox_player = `(function voxPlayerDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const W = 44, H = 22, TILE = 16;
    const ox = (canvas.width - W * TILE) >> 1;
    const oy = (canvas.height - H * TILE) >> 1;
    const GRAVITY = 0.55, MOVE = 2.3, JUMP = -8.2, MAX_FALL = 11;

    function buildPlatformWorld() {
        const w = new TileWorld(W, H);
        for (let y = 0; y < H; y++) { w.set(0, y, 3); w.set(W - 1, y, 3); }
        for (let x = 0; x < W; x++) { w.set(x, H - 1, 3); w.set(x, H - 2, 1); w.set(x, H - 3, 2); }
        const strip = (x0, x1, y) => { for (let x = x0; x <= x1; x++) w.set(x, y, 5); };
        strip(5, 12, H - 7); strip(17, 25, H - 11); strip(30, 38, H - 8); strip(34, 41, H - 14);
        for (let y = H - 6; y < H - 3; y++) { w.set(15, y, 3); w.set(28, y, 3); }
        return w;
    }
    function overlappingTiles(px, py, pw, ph) {
        // Half-open span [pos,pos+size) covers cells floor(pos)..ceil(pos+size)-1.
        return {
            x0: Math.floor(px / TILE), x1: Math.ceil((px + pw) / TILE) - 1,
            y0: Math.floor(py / TILE), y1: Math.ceil((py + ph) / TILE) - 1
        };
    }
    function moveX(world, p) {
        p.x += p.vx;
        const r = overlappingTiles(p.x, p.y, p.w, p.h);
        let hit = null;
        for (let ty = r.y0; ty <= r.y1; ty++)
            for (let tx = r.x0; tx <= r.x1; tx++) {
                if (!isSolid(world.get(tx, ty))) continue;
                hit = hit === null ? tx : (p.vx > 0 ? Math.min(hit, tx) : Math.max(hit, tx));
            }
        if (hit !== null) { p.x = p.vx > 0 ? hit * TILE - p.w : (hit + 1) * TILE; p.vx = 0; }
    }
    function moveY(world, p) {
        p.y += p.vy;
        p.onGround = false;
        const r = overlappingTiles(p.x, p.y, p.w, p.h);
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
    function drawPlayer(sx, sy, w, h, facing) {
        ctx.fillStyle = '#5a9e58'; ctx.fillRect(sx, sy, w, h);
        ctx.fillStyle = '#7ec97c'; ctx.fillRect(sx, sy, w, Math.round(h * 0.34));
        ctx.strokeStyle = '#11151f'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(facing >= 0 ? sx + w - 5 : sx + 2, sy + 5, 3, 3);
    }

    const world = buildPlatformWorld();
    const keys = new Set();
    const spawn = () => ({ x: 3 * TILE, y: 2 * TILE, w: 11, h: 26,
                           vx: 0, vy: 0, onGround: false, facing: 1 });
    let player = spawn();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
        drawPlayer(ox + player.x, oy + player.y, player.w, player.h, player.facing);
        info.textContent = 'pos (' + player.x.toFixed(0) + ', ' + player.y.toFixed(0) +
                           ') · onGround: ' + player.onGround;
    }
    function loop() {
        player.vx = 0;
        if (keys.has('a') || keys.has('arrowleft'))  { player.vx = -MOVE; player.facing = -1; }
        if (keys.has('d') || keys.has('arrowright')) { player.vx =  MOVE; player.facing =  1; }
        player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
        moveX(world, player);
        moveY(world, player);
        if (player.y > H * TILE + 80) player = spawn();
        render();
        requestAnimationFrame(loop);
    }

    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) {
            e.preventDefault();
            keys.add(k);
            if ((k === 'w' || k === 'arrowup' || k === ' ') && player.onGround) player.vy = JUMP;
        }
    });
    window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    document.getElementById('btnPlayerReset').addEventListener('click', () => { player = spawn(); });

    render();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.vox_player = DEMO_CODE.vox_player;
