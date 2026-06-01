// =============================================================================
// PLATFORMER — SIMULATIONS TIER DEMOS ("Performance, Scale & The Whole Game")
// =============================================================================
// The final tier. Everything works on a small level; now make it SCALE — then
// compose the whole thing into a complete game. Four perf systems are the new
// lessons (taught inline, top-level, console-testable); the capstone "Summit"
// pulls every tier together.
//
//   1. cullingDemo    — viewport culling: draw only the tiles on screen
//   2. poolingDemo    — object pooling: reuse particle slots, zero per-frame alloc
//   3. broadphaseDemo — spatial-grid broad phase: O(n²) pair checks → ~O(n)
//   4. chunkDemo      — chunked render caching: blit cached chunks, redraw dirty
//   5. summitDemo     — GRAND CAPSTONE: the complete platformer
//
// DEPENDENCIES (loaded BEFORE this file by simulations.html):
//   ../shared/utils.js  — clearCanvas, clamp, lerp
//   engine/tilemap.js   — PFTile, TileMap, PF, drawTileMap (drawTileMap CULLS)
//   engine/physics.js   — AABB, moveAndCollide, PF_EPS
//   engine/input.js     — pfInstallKeys, pfLoop
//   engine/player.js    — PlayerBody, JUICED_CFG, PF_STATE_COLOR, pfDrawBody
//   engine/camera.js    — Camera  (promoted here; this tier is its 2nd consumer)
//
// SELF-CONTAINED TIER: the capstone composes systems first taught in the Advanced
// (pfResolveWorld / MovingPlatform) and Expert (drawParallax / pfDrawCharacter)
// tiers. Per the repo convention, those tier-demos files DON'T load here, so this
// file RE-DECLARES the compact helpers it needs (verbatim, tested code). Only
// genuinely shared infrastructure (Camera) was promoted to engine/.
// =============================================================================

(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// ---- per-tier UI helpers ----------------------------------------------------
function pfFocusHint(ctx, w, h, focused) {
    if (focused) return;
    ctx.fillStyle = 'rgba(13,17,23,0.6)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9d1d9'; ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶ click here, then use the keyboard', w / 2, h / 2);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function pfBar(ctx, x, y, w, frac, color, label) {
    ctx.fillStyle = PF.dim; ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), 7);
    if (label) { ctx.fillStyle = PF.text; ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(label, x, y - 4); }
}

// =============================================================================
// NEW LESSON 1 — ParticlePool : an object pool (zero per-frame allocation).
// A fixed array of reusable particle objects; `n` are active at the front. spawn
// writes at index n (reusing a dead object's memory); on death we swap-with-last
// and shrink n. After warmup, NOTHING is allocated — so the GC never stalls a frame.
// =============================================================================
class ParticlePool {
    constructor(cap = 800) {
        this.cap = cap; this.n = 0; this.allocs = cap; // preallocated up front
        this.arr = [];
        for (let i = 0; i < cap; i++) this.arr.push({ x: 0, y: 0, vx: 0, vy: 0, g: 0, t: 0, life: 1, size: 3, color: '#fff' });
    }
    spawn(p) {
        if (this.n >= this.cap) return;            // full → drop (never allocate)
        const o = this.arr[this.n++];
        o.x = p.x; o.y = p.y; o.vx = p.vx; o.vy = p.vy; o.g = p.g;
        o.t = 0; o.life = p.life; o.size = p.size; o.color = p.color;
    }
    burst(x, y, count, opts) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, sp = (opts.speed || 80) * (0.4 + Math.random() * 0.6);
            this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
                g: opts.g ?? 240, life: (opts.life || 0.4) * (0.6 + Math.random() * 0.6), size: opts.size || 3, color: opts.color || PF.dim });
        }
    }
    update(dt) {
        for (let i = 0; i < this.n; i++) {
            const o = this.arr[i];
            o.t += dt; o.vy += o.g * dt; o.x += o.vx * dt; o.y += o.vy * dt;
            if (o.t >= o.life) {                    // swap-remove: keep the dead object for reuse
                this.arr[i] = this.arr[this.n - 1]; this.arr[this.n - 1] = o; this.n--; i--;
            }
        }
    }
    draw(ctx, ox = 0, oy = 0) {
        for (let i = 0; i < this.n; i++) {
            const o = this.arr[i];
            ctx.globalAlpha = clamp(1 - o.t / o.life, 0, 1);
            ctx.fillStyle = o.color;
            ctx.fillRect(Math.round(o.x - ox), Math.round(o.y - oy), o.size, o.size);
        }
        ctx.globalAlpha = 1;
    }
    get alive() { return this.n; }
}

// =============================================================================
// NEW LESSON 2 — SpatialGrid : broad-phase collision. Bucket entities into cells
// (cell ≈ entity size); an entity can only collide with others in its own cell or
// the 8 neighbours, so we never test the far-apart pairs that dominate O(n²).
// =============================================================================
class SpatialGrid {
    constructor(cell) { this.cell = cell; this.buckets = new Map(); }
    clear() { this.buckets.clear(); }
    insert(e) {
        const k = Math.floor(e.x / this.cell) + ',' + Math.floor(e.y / this.cell);
        let b = this.buckets.get(k); if (!b) { b = []; this.buckets.set(k, b); } b.push(e);
    }
    // Visit each near pair once. Returns the number of pair checks done.
    eachPair(entities, visit) {
        this.clear();
        for (const e of entities) this.insert(e);
        let checks = 0;
        for (const e of entities) {
            const cx = Math.floor(e.x / this.cell), cy = Math.floor(e.y / this.cell);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const b = this.buckets.get((cx + dx) + ',' + (cy + dy));
                if (!b) continue;
                for (const o of b) { if (o.id <= e.id) continue; checks++; visit(e, o); } // id ordering dedups
            }
        }
        return checks;
    }
}

// =============================================================================
// NEW LESSON 3 — ChunkCache : render the static tile layer once per chunk into an
// offscreen canvas, then just blit those images every frame. Only chunks marked
// dirty (a tile changed) get re-rendered. Turns "redraw N tiles/frame" into
// "blit a few images/frame".
// =============================================================================
class ChunkCache {
    constructor(map, chunkTiles = 8) {
        this.map = map; this.ct = chunkTiles; this.px = chunkTiles * map.tileSize;
        this.cols = Math.ceil(map.cols / chunkTiles); this.rows = Math.ceil(map.rows / chunkTiles);
        this.cv = new Map(); this.dirty = new Set();
        for (let i = 0; i < this.cols * this.rows; i++) this.dirty.add(i);
        this.lastRenders = 0;
    }
    markDirtyTile(col, row) { this.dirty.add(Math.floor(row / this.ct) * this.cols + Math.floor(col / this.ct)); }
    _canvas(k) {
        let c = this.cv.get(k);
        if (!c) { c = document.createElement('canvas'); c.width = this.px; c.height = this.px; this.cv.set(k, c); }
        return c;
    }
    draw(ctx, originX, originY, viewW, viewH) {
        this.lastRenders = 0;
        const c0 = Math.max(0, Math.floor(originX / this.px)), c1 = Math.min(this.cols - 1, Math.floor((originX + viewW) / this.px));
        const r0 = Math.max(0, Math.floor(originY / this.px)), r1 = Math.min(this.rows - 1, Math.floor((originY + viewH) / this.px));
        for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
            const k = cy * this.cols + cx, cv = this._canvas(k);
            if (this.dirty.has(k)) {                          // (re)render only when dirty
                const cc = cv.getContext('2d');
                cc.clearRect(0, 0, this.px, this.px);
                drawTileMap(cc, this.map, { originX: cx * this.px, originY: cy * this.px }); // cull = this chunk only
                this.dirty.delete(k); this.lastRenders++;
            }
            ctx.drawImage(cv, Math.round(cx * this.px - originX), Math.round(cy * this.px - originY));
        }
    }
}

// ---- RE-DECLARED helpers (Advanced + Expert; verbatim, tested) --------------
// world resolver: SOLID + ONE_WAY + SLOPE (see advanced-demos.js for the lesson)
function pfResolveWorld(box, dx, dy, map, opts = {}) {
    const ts = map.tileSize, hit = { left: false, right: false, up: false, down: false, slope: false };
    const prevBottom = box.bottom;
    box.x += dx;
    if (dx !== 0) {
        const top = map.rowAt(box.top), bot = map.rowAt(box.bottom - PF_EPS);
        if (dx > 0) { const col = map.colAt(box.right - PF_EPS); for (let r = top; r <= bot; r++) if (map.isSolid(col, r)) { box.x = col * ts - box.w; hit.right = true; break; } }
        else { const col = map.colAt(box.left); for (let r = top; r <= bot; r++) if (map.isSolid(col, r)) { box.x = (col + 1) * ts; hit.left = true; break; } }
    }
    box.y += dy;
    if (dy !== 0) {
        const left = map.colAt(box.left), right = map.colAt(box.right - PF_EPS);
        if (dy > 0) { const row = map.rowAt(box.bottom - PF_EPS); for (let c = left; c <= right; c++) if (map.isSolid(c, row)) { box.y = row * ts - box.h; hit.down = true; break; } }
        else { const row = map.rowAt(box.top); for (let c = left; c <= right; c++) if (map.isSolid(c, row)) { box.y = (row + 1) * ts; hit.up = true; break; } }
    }
    if (dy >= 0 && !opts.dropThrough && !hit.down) {
        const left = map.colAt(box.left), right = map.colAt(box.right - PF_EPS), row = map.rowAt(box.bottom - PF_EPS);
        for (let c = left; c <= right; c++) if (map.get(c, row) === PFTile.ONE_WAY) { const te = row * ts; if (prevBottom <= te + 1) { box.y = te - box.h; hit.down = true; break; } }
    }
    if (dy >= 0) {
        const cx = box.x + box.w / 2, col = map.colAt(cx), localX = clamp(cx - col * ts, 0, ts), feetRow = map.rowAt(box.bottom - PF_EPS);
        let surfaceY = null;
        for (let r = feetRow; r <= feetRow + 1; r++) { const t = map.get(col, r); if (t === PFTile.SLOPE_NE) { surfaceY = r * ts + (ts - localX); break; } if (t === PFTile.SLOPE_NW) { surfaceY = r * ts + localX; break; } }
        if (surfaceY !== null) {
            const climbing = box.bottom >= surfaceY - 1, sticking = opts.wasGround && box.bottom < surfaceY && (surfaceY - box.bottom) <= ts * 0.6;
            if (climbing || sticking) { box.y = surfaceY - box.h; hit.down = true; hit.slope = true; }
        }
    }
    return hit;
}
class MovingPlatform {
    constructor(o) {
        this.box = new AABB(o.x, o.y, o.w, o.h); this.kind = o.kind || 'move';
        this.ax = o.x; this.ay = o.y; this.bx = o.bx ?? o.x; this.by = o.by ?? o.y;
        this.period = o.period || 2.2; this.conveyor = o.conveyor || 0; this.t = 0; this.dir = 1; this.color = o.color || PF.oneWay;
    }
}
function pfMovePlatform(p, dt) {
    if (p.kind === 'conveyor') return;
    p.t += (dt / p.period) * p.dir; if (p.t >= 1) { p.t = 1; p.dir = -1; } if (p.t <= 0) { p.t = 0; p.dir = 1; }
    p.box.x = lerp(p.ax, p.bx, p.t); p.box.y = lerp(p.ay, p.by, p.t);
}
function pfRidePlatforms(player, platforms, dt) {
    const b = player.box;
    for (const p of platforms) {
        const wasOn = b.bottom <= p.box.top + 4 && b.bottom >= p.box.top - 6 && b.right > p.box.left + 2 && b.left < p.box.right - 2 && player.vy >= -1;
        const bx0 = p.box.x, by0 = p.box.y; pfMovePlatform(p, dt);
        const ddx = p.box.x - bx0, ddy = p.box.y - by0;
        if (wasOn) { b.x += ddx; b.y += ddy; if (p.conveyor) b.x += p.conveyor * dt; player.onGround = true; player.canDash = true; if (player.vy > 0) player.vy = 0; }
        if (b.intersects(p.box)) {
            const oL = b.right - p.box.left, oR = p.box.right - b.left, oT = b.bottom - p.box.top, oB = p.box.bottom - b.top;
            if (Math.min(oT, oB) <= Math.min(oL, oR)) {
                if (oT < oB) { b.y = p.box.top - b.h; if (player.vy > 0) player.vy = 0; player.onGround = true; player.canDash = true; }
                else { b.y = p.box.bottom; if (player.vy < 0) player.vy = 0; }
            } else { if (oL < oR) { b.x = p.box.left - b.w; if (player.vx > 0) player.vx = 0; } else { b.x = p.box.right; if (player.vx < 0) player.vx = 0; } }
        }
    }
}
function pfDropInput(input) {
    return { isDown: (a) => input.isDown(a), pressed: (a) => ((a === 'jump' || a === 'up') && input.isDown('down')) ? false : input.pressed(a),
        released: (a) => input.released(a), axisX: () => input.axisX(), endFrame: () => input.endFrame(), get focused() { return input.focused; } };
}
const PF_PARALLAX = [
    { factor: 0.15, color: '#1b2236', top: 0.45, amp: 26, span: 220 },
    { factor: 0.38, color: '#222b45', top: 0.58, amp: 34, span: 170 },
    { factor: 0.66, color: '#2b3550', top: 0.72, amp: 30, span: 120 },
];
function drawParallax(ctx, camX, viewW, viewH) {
    const g = ctx.createLinearGradient(0, 0, 0, viewH); g.addColorStop(0, '#10162a'); g.addColorStop(1, '#0d1117');
    ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
    for (const L of PF_PARALLAX) {
        const off = -(camX * L.factor), baseY = viewH * L.top;
        ctx.fillStyle = L.color; ctx.beginPath(); ctx.moveTo(0, viewH);
        const start = Math.floor(-off / L.span) * L.span + off;
        for (let x = start - L.span; x < viewW + L.span; x += L.span) { ctx.lineTo(x, baseY); ctx.lineTo(x + L.span / 2, baseY - L.amp); ctx.lineTo(x + L.span, baseY); }
        ctx.lineTo(viewW, viewH); ctx.closePath(); ctx.fill();
    }
}
function pfDrawCharacter(ctx, footX, footY, state, phase, facing, squash = 1) {
    const sq = clamp(squash, 0.6, 1.4), H = 30 * sq, headR = 6, col = PF_STATE_COLOR[state] || PF.player;
    ctx.save(); ctx.translate(footX, footY); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = col;
    let lA = 0, lB = 0;
    if (state === 'run') { lA = Math.sin(phase) * 8; lB = -Math.sin(phase) * 8; }
    else if (state === 'jump') { lA = lB = -5; } else if (state === 'fall') { lA = 5; lB = -5; }
    ctx.beginPath(); ctx.moveTo(0, -H * 0.45); ctx.lineTo(lA, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -H * 0.45); ctx.lineTo(lB, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -H * 0.45); ctx.lineTo(0, -H + headR); ctx.stroke();
    const aSwing = state === 'run' ? Math.sin(phase) * 7 : (state === 'jump' ? -7 : (state === 'wall' ? -4 : 3));
    const armY = -H * 0.78;
    ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(facing * 6, armY + aSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(-facing * 6, armY - aSwing); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -H + headR - 1, headR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d1117'; ctx.fillRect(facing * 2 - 1, -H + headR - 3, 2, 2);
    ctx.restore();
}

// A smoothed FPS / step-time meter for the perf demos.
function pfPerfMeter() {
    let ema = 16.7;
    return { sample(ms) { ema += (ms - ema) * 0.1; return ema; }, get ms() { return ema; }, get fps() { return 1000 / ema; } };
}

// =============================================================================
// DEMO 1 — cullingDemo : DRAW ONLY WHAT'S ON SCREEN
// A huge map auto-pans past the view. Toggle culling: ON draws ~the visible tiles,
// OFF draws every tile in the map. The drawn-count and frame-time tell the story.
// =============================================================================
(function cullingDemo() {
    const canvas = document.getElementById('pfCullingCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 20;
    const cols = 200, rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    // fill with a busy pattern so "all tiles" is genuinely expensive
    for (let c = 0; c < cols; c++) {
        map.set(c, rows - 1, PFTile.SOLID);
        for (let r = 0; r < rows - 1; r++) if (((c * 7 + r * 13) % 9) === 0) map.set(c, r, PFTile.SOLID);
    }
    const total = map.tiles.reduce((n, t) => n + (t !== PFTile.EMPTY ? 1 : 0), 0);
    const worldW = cols * TS;
    const cullEl = document.getElementById('pfCullingOn');
    const hud = document.getElementById('pfCullingHud');
    const meter = pfPerfMeter();
    let camX = 0, dir = 1;
    function update(dt) { camX += dir * 220 * dt; if (camX > worldW - W) dir = -1; if (camX < 0) dir = 1; camX = clamp(camX, 0, worldW - W); }
    function render() {
        const t0 = performance.now();
        clearCanvas(ctx, W, H, PF.bg);
        const ox = Math.round(camX);
        if (cullEl.checked) {
            drawTileMap(ctx, map, { originX: ox, originY: 0, cullToCanvas: true });
        } else {
            drawTileMap(ctx, map, { originX: ox, originY: 0, cullToCanvas: false });
        }
        const drawn = cullEl.checked ? Math.ceil(W / TS + 1) * rows : total; // rough visible-column estimate
        const ms = meter.sample(performance.now() - t0);
        hud.textContent = `culling ${cullEl.checked ? 'ON' : 'OFF'} · tiles considered ≈ ${cullEl.checked ? (Math.ceil(W / TS) + 1) * rows : cols * rows} / ${cols * rows} · solid in map ${total} · draw ${ms.toFixed(2)} ms/frame`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — poolingDemo : REUSE, DON'T ALLOCATE
// A fountain emits particles forever. POOLED reuses a fixed array (allocations
// flat after warmup). NAIVE news up an object per spawn and filters the dead each
// frame (allocations climb forever → GC pressure). Same visuals, very different
// memory behaviour — watch the "objects allocated" counters.
// =============================================================================
(function poolingDemo() {
    const canvas = document.getElementById('pfPoolingCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pool = new ParticlePool(900);
    let naive = [], naiveAllocs = 0;
    const pooledEl = document.getElementById('pfPoolingPooled');
    const hud = document.getElementById('pfPoolingHud');
    document.getElementById('pfPoolingReset').addEventListener('click', () => { pool.n = 0; naive = []; naiveAllocs = 0; });

    function emit() {
        const x = W / 2 + (Math.random() * 80 - 40), y = H - 30;
        const vx = Math.random() * 160 - 80, vy = -180 - Math.random() * 120;
        const p = { x, y, vx, vy, g: 360, t: 0, life: 1.2 + Math.random() * 0.6, size: 3, color: ['#7CF2C8', '#4fc3f7', '#ffd166'][Math.floor(Math.random() * 3)] };
        if (pooledEl.checked) pool.spawn(p);
        else { naive.push(p); naiveAllocs++; }    // ← the allocation the pool avoids
    }
    function update(dt) {
        for (let i = 0; i < 12; i++) emit();
        if (pooledEl.checked) pool.update(dt);
        else { for (const p of naive) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } naive = naive.filter(p => p.t < p.life); }
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        if (pooledEl.checked) pool.draw(ctx);
        else { for (const p of naive) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size); } ctx.globalAlpha = 1; }
        const live = pooledEl.checked ? pool.alive : naive.length;
        pfBar(ctx, 12, 18, 150, live / 900, PF.accent, `live particles: ${live}`);
        hud.textContent = pooledEl.checked
            ? `POOLED · objects allocated: ${pool.allocs} (flat — preallocated once) · no per-frame garbage`
            : `NAIVE · objects allocated: ${naiveAllocs} and counting · every spawn + filter feeds the GC`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — broadphaseDemo : SPATIAL-GRID BROAD PHASE
// N balls bounce in the box. NAIVE checks every pair, O(n²). GRID buckets them by
// cell and checks only same/adjacent cells. The pair-check counter shows the
// collapse from n(n-1)/2 to roughly linear.
// =============================================================================
(function broadphaseDemo() {
    const canvas = document.getElementById('pfBroadphaseCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, R = 9;
    const grid = new SpatialGrid(R * 3);
    let balls = [];
    const countEl = document.getElementById('pfBroadphaseCount');
    const countVal = document.getElementById('pfBroadphaseCountVal');
    const gridEl = document.getElementById('pfBroadphaseGrid');
    const hud = document.getElementById('pfBroadphaseHud');
    function rebuild(n) {
        balls = [];
        for (let i = 0; i < n; i++) balls.push({ id: i, x: Math.random() * (W - 40) + 20, y: Math.random() * (H - 40) + 20, vx: Math.random() * 120 - 60, vy: Math.random() * 120 - 60, r: R });
    }
    rebuild(+countEl.value);
    countEl.addEventListener('input', () => rebuild(+countEl.value));

    let lastChecks = 0;
    function collide(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, min = a.r + b.r;
        if (d2 > 0 && d2 < min * min) { const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (min - d) / 2;
            a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
            const tmpx = a.vx, tmpy = a.vy; a.vx = b.vx; a.vy = b.vy; b.vx = tmpx; b.vy = tmpy; }
    }
    function update(dt) {
        for (const e of balls) {
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx); } if (e.x > W - e.r) { e.x = W - e.r; e.vx = -Math.abs(e.vx); }
            if (e.y < e.r) { e.y = e.r; e.vy = Math.abs(e.vy); } if (e.y > H - e.r) { e.y = H - e.r; e.vy = -Math.abs(e.vy); }
        }
        if (gridEl.checked) lastChecks = grid.eachPair(balls, collide);
        else { lastChecks = 0; for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) { lastChecks++; collide(balls[i], balls[j]); } }
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        if (gridEl.checked) { ctx.strokeStyle = '#161b2c'; ctx.lineWidth = 1; for (let x = 0; x < W; x += grid.cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += grid.cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
        ctx.fillStyle = PF.player; for (const e of balls) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); }
        if (countVal) countVal.textContent = countEl.value;
        const naivePairs = balls.length * (balls.length - 1) / 2;
        hud.textContent = `${gridEl.checked ? 'GRID' : 'NAIVE'} · ${balls.length} balls · pair checks this frame: ${lastChecks} (naive would be ${naivePairs})`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — chunkDemo : CHUNKED RENDER CACHING
// A static tile layer drawn two ways. CACHED renders each chunk to an offscreen
// canvas once, then blits — re-rendering only chunks whose tiles changed. NAIVE
// redraws every tile every frame. Click to toggle a tile and watch only its chunk
// re-render. The "re-renders this frame" counter is the lesson.
// =============================================================================
(function chunkDemo() {
    const canvas = document.getElementById('pfChunkCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 16;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) if (((c * 5 + r * 11) % 7) === 0 || r === rows - 1) map.set(c, r, PFTile.SOLID);
    const cache = new ChunkCache(map, 8);
    const cachedEl = document.getElementById('pfChunkCached');
    const gridEl = document.getElementById('pfChunkGrid');
    const hud = document.getElementById('pfChunkHud');
    let totalRenders = 0;

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width), y = (e.clientY - rect.top) * (H / rect.height);
        const c = map.colAt(x), r = map.rowAt(y);
        map.set(c, r, map.isSolid(c, r) ? PFTile.EMPTY : PFTile.SOLID);
        cache.markDirtyTile(c, r);                 // only this chunk is now dirty
    });

    function update() {}
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        if (cachedEl.checked) { cache.draw(ctx, 0, 0, W, H); totalRenders += cache.lastRenders; }
        else { drawTileMap(ctx, map, { cullToCanvas: false }); }
        if (gridEl.checked) {
            ctx.strokeStyle = 'rgba(79,195,247,0.4)'; ctx.lineWidth = 1;
            for (let x = 0; x <= W; x += cache.px) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
            for (let y = 0; y <= H; y += cache.px) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        }
        hud.textContent = cachedEl.checked
            ? `CACHED · chunks re-rendered THIS frame: ${cache.lastRenders} (0 once warm) · click a tile → only its chunk re-renders · total chunk renders: ${totalRenders}`
            : `NAIVE · every one of ${cols * rows} tiles redrawn every frame · click to toggle tiles`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — summitDemo : GRAND CAPSTONE — "Summit"
// The complete platformer. Tilemap collision + one-ways + slopes + a moving
// platform + the full feel kit + wall-jump + dash + a follow camera + parallax +
// pooled particles + screen shake + hitstop + FSM animation + a goal & a timer —
// with viewport culling doing the drawing. Climb to the flag; beat your time.
// =============================================================================
(function summitDemo() {
    const canvas = document.getElementById('pfSummitCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = 80, rows = Math.floor(H / TS);
    const worldW = cols * TS, worldH = rows * TS;
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    // run of platforms + a one-way ladder
    map.fillRect(5, rows - 4, 8, rows - 4, PFTile.SOLID);
    for (let c = 10; c <= 13; c++) map.set(c, rows - 4, PFTile.ONE_WAY);
    for (let c = 10; c <= 13; c++) map.set(c, rows - 7, PFTile.ONE_WAY);
    // a slope hill
    const base = rows - 2;
    map.set(17, base, PFTile.SLOPE_NE); map.set(18, base - 1, PFTile.SLOPE_NE); map.set(18, base, PFTile.SOLID);
    map.fillRect(19, base - 2, 22, base, PFTile.SOLID);
    map.set(23, base - 2, PFTile.SLOPE_NW); map.set(23, base - 1, PFTile.SOLID); map.set(23, base, PFTile.SOLID);
    // a dash gap (pit) then a wall-jump shaft
    map.fillRect(26, rows - 2, 28, rows - 2, PFTile.SOLID);
    map.fillRect(33, 3, 33, rows - 2, PFTile.SOLID); map.fillRect(36, 6, 36, rows - 2, PFTile.SOLID);
    map.fillRect(34, rows - 2, 35, rows - 2, PFTile.SOLID);
    map.fillRect(37, 5, 40, 5, PFTile.SOLID);
    // a long ground run to the goal, with a couple of steps
    map.fillRect(41, rows - 3, 60, rows - 3, PFTile.SOLID);
    map.fillRect(62, rows - 5, 78, rows - 5, PFTile.SOLID);

    const cfg = Object.assign({}, JUICED_CFG, { wallSlideSpeed: 95, wallJumpX: 300, wallJumpY: 520, dashSpeed: 560, dashMs: 130, dashCooldownMs: 220 });
    const body = new PlayerBody(map, 2 * TS, (rows - 3) * TS, cfg);
    const cam = new Camera(W, H, worldW, worldH);
    const pool = new ParticlePool(500);
    const input = pfInstallKeys(canvas);
    const di = pfDropInput(input);
    body.resolve = (b, dx, dy) => pfResolveWorld(b, dx, dy, map, { dropThrough: body.dropThrough, wasGround: body.onGround });
    const platforms = [new MovingPlatform({ x: 44 * TS, y: (rows - 6) * TS, w: 80, h: 14, bx: 56 * TS, by: (rows - 6) * TS, period: 3.0, color: PF.oneWay })];
    const goal = new AABB((cols - 4) * TS, (rows - 7) * TS + 2, 20, TS - 4);

    const hud = document.getElementById('pfSummitHud');
    let phase = 0, wasGround = true, dustTimer = 0, hitstop = 0, dropTimer = 0;
    let time = 0, won = false, best = null;
    function reset() { body.respawn(); cam.x = 0; cam.trauma = 0; pool.n = 0; time = 0; won = false; phase = 0; canvas.focus(); }
    document.getElementById('pfSummitReset').addEventListener('click', reset);

    function update(dt) {
        if (won) { input.endFrame(); return; }
        if (hitstop > 0) { hitstop -= dt; cam.updateShake(dt); input.endFrame(); return; }
        time += dt;
        if (input.isDown('down') && (input.pressed('jump') || input.pressed('up'))) dropTimer = 0.18;
        dropTimer = Math.max(0, dropTimer - dt); body.dropThrough = dropTimer > 0;
        const prevVy = body.vy;
        body.update(dt, di);
        phase += (body.state === 'run' ? 6 + Math.abs(body.vx) * 0.03 : 3) * dt;
        pfRidePlatforms(body, platforms, dt);
        const hardLand = body.onGround && !wasGround && prevVy > 430;
        if (hardLand) { cam.addTrauma(clamp(prevVy / 1100, 0.2, 0.6)); pool.burst(body.box.cx, body.box.bottom - 2, Math.min(16, 6 + prevVy / 70), { speed: 90, up: 28, g: 260, life: 0.4, size: 3, color: '#8893b5' }); hitstop = 0.05; }
        if (body.onGround && Math.abs(body.vx) > 70) { dustTimer -= dt; if (dustTimer <= 0) { dustTimer = 0.045; pool.spawn({ x: body.box.cx - body.facing * 8, y: body.box.bottom - 2, vx: -body.facing * 30, vy: -25, g: 200, t: 0, life: 0.32, size: 3, color: PF.dim }); } }
        wasGround = body.onGround;
        pool.update(dt);
        cam.follow(body.box.cx, body.box.cy, dt, { smoothMs: 110, deadzoneW: 150, deadzoneH: 90, lookAhead: 100, lookDir: body.facing });
        cam.updateShake(dt);
        if (body.box.top > worldH + 80) body.respawn();
        if (body.box.intersects(goal)) { won = true; if (best === null || time < best) best = time; }
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawParallax(ctx, cam.x, W, H);
        const ox = cam.originX, oy = cam.originY;
        drawTileMap(ctx, map, { originX: ox, originY: oy, cullToCanvas: true }); // culling does the drawing
        for (const p of platforms) { ctx.fillStyle = p.color; ctx.fillRect(p.box.x - ox, p.box.y - oy, p.box.w, p.box.h); }
        ctx.fillStyle = PF.item; ctx.fillRect(goal.x + goal.w - 3 - ox, goal.y - oy, 3, goal.h);
        ctx.beginPath(); ctx.moveTo(goal.x + goal.w - 3 - ox, goal.y - oy); ctx.lineTo(goal.x + goal.w - 18 - ox, goal.y - oy + 7); ctx.lineTo(goal.x + goal.w - 3 - ox, goal.y - oy + 14); ctx.closePath(); ctx.fill();
        pool.draw(ctx, ox, oy);
        pfDrawCharacter(ctx, body.box.cx - ox, body.box.bottom - oy, body.state, phase, body.facing, body.squash);
        pfFocusHint(ctx, W, H, input.focused);
        // HUD
        ctx.fillStyle = PF.text; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left';
        ctx.fillText(`⏱ ${time.toFixed(2)}s`, 12, 26);
        if (best !== null) ctx.fillText(`best ${best.toFixed(2)}s`, 120, 26);
        if (won) {
            ctx.fillStyle = 'rgba(13,17,23,0.75)'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = PF.good; ctx.font = 'bold 30px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🏔️ Summit reached!', W / 2, H / 2 - 14);
            ctx.fillStyle = PF.text; ctx.font = '16px system-ui'; ctx.fillText(`time ${time.toFixed(2)}s` + (best !== null ? ` · best ${best.toFixed(2)}s` : ''), W / 2, H / 2 + 14);
            ctx.font = '13px system-ui'; ctx.fillText('Reset to run it again', W / 2, H / 2 + 38);
            ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
        hud.textContent = won ? `Summit reached in ${time.toFixed(2)}s 🏔️ — that is the whole track in one level`
            : `←/→ run · ↑/Space jump (into walls = wall-jump) · X dash · ↓+jump drop · climb to the flag`;
    }
    pfLoop(update, render).start();
})();
