// =============================================================================
// BULLET HELL — EXPERT TIER DEMOS ("Ten Thousand Bullets")
// =============================================================================
// Six canvas-guarded IIFEs about MAKING IT SCALE. The engine's object-based
// BHField is the teaching store (Beginner→Advanced read bullets as objects); a
// production danmaku stores bullets differently. We build that here, inline, with
// live before/after metrics:
//
//   1. naiveDemo  — the problem: per-bullet objects + temp allocs + splice
//   2. poolDemo   — the object pool: reuse dead bullets, zero allocations
//   3. soaDemo    — Struct-of-Arrays in flat Float32Arrays + O(1) swap-remove cull
//   4. hashDemo   — a uniform spatial hash: N hit-checks → ~k near the player
//   5. batchDemo  — render batching: one beginPath/fill for thousands of bullets
//   6. stressDemo — capstone "Stress Test": 10k bullets at 60 fps, everything on
//
// DEPENDENCIES (loaded BEFORE this file by expert.html):
//   ../shared/utils.js, engine/loop.js (bhLoop, bhInstallKeys),
//   engine/render.js (BH, bhDrawField, bhDrawPlayer, starfield)
//   (We do NOT use engine/field.js here — these demos define their own stores,
//    which is the whole point of the tier.)
//
// SELF-CONTAINED: re-declares bhFocusHint / bhMovePlayer. BHSoaBullets +
// BHSpatialHash are the lesson; they'd promote to the engine only if a 2nd tier
// (the Simulations capstone) genuinely reuses them.
// =============================================================================

// --- Small shared helpers (re-declared) --------------------------------------
function bhFocusHint(ctx, bounds, focused, msg) {
    if (focused) return;
    ctx.save();
    ctx.fillStyle = 'rgba(7,10,28,0.62)';
    ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 20, bounds.w, 40);
    ctx.fillStyle = '#c9d1d9'; ctx.font = '13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(msg, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.restore();
}
function bhMovePlayer(player, keys, bounds, dt) {
    const PAD = 12, FULL = 250, FOCUS = 110;
    player.focused = keys.focus;
    player.pos.add(keys.moveDir().multiply((keys.focus ? FOCUS : FULL) * dt));
    player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
    player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);
}

// --- A tiny frame-time meter (work-ms vs the 16.6 ms budget) -----------------
function bhMakeMeter() { return { buf: new Float32Array(64), i: 0 }; }
function bhMeterPush(m, ms) { m.buf[m.i] = ms; m.i = (m.i + 1) % m.buf.length; }
function bhDrawMeter(ctx, m, bounds, ms) {
    const w = 96, h = 46, x = bounds.x + bounds.w - w - 8, y = bounds.y + 8, maxMs = 33;
    ctx.save();
    ctx.fillStyle = 'rgba(7,10,28,0.78)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = BH.fieldEdge; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const budgetY = y + h - (16.6 / maxMs) * h;            // the 60 fps line
    ctx.strokeStyle = 'rgba(102,187,106,0.6)';
    ctx.beginPath(); ctx.moveTo(x, budgetY); ctx.lineTo(x + w, budgetY); ctx.stroke();
    const n = m.buf.length, bw = w / n;
    ctx.fillStyle = BH.accent;
    for (let k = 0; k < n; k++) {
        const v = Math.min(maxMs, m.buf[(m.i + k) % n]);
        const bh2 = (v / maxMs) * h;
        ctx.fillRect(x + k * bw, y + h - bh2, bw + 0.5, bh2);
    }
    ctx.fillStyle = BH.text; ctx.font = '10px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(ms.toFixed(1) + ' ms work', x + w - 3, y + 2);
    ctx.restore();
}

// --- Batched draw for a Struct-of-Arrays store -------------------------------
// The whole store in TWO fills: one for the coloured rims, one for the white
// cores — instead of two fills PER bullet. This is the render-batching lesson.
function bhDrawSoa(ctx, S, color, core) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < S.count; i++) { const r = S.r[i], x = S.x[i], y = S.y[i]; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, BH.TAU); }
    ctx.fill();
    ctx.fillStyle = core; ctx.beginPath();
    for (let i = 0; i < S.count; i++) { const r = S.r[i] * 0.45, x = S.x[i], y = S.y[i]; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, BH.TAU); }
    ctx.fill();
}

// =============================================================================
// THE TIER'S CORE LESSONS — a pool, a SoA store, and a spatial hash.
// =============================================================================

// An object pool: a free-list of reusable bullet objects with PLAIN NUMBER
// fields (x/y/vx/vy — no Vector2D, so integration allocates nothing). spawn()
// hands back a dead object; the step recycles culled ones. After warmup: zero
// allocations, which means the GC never pauses your bullet hell.
class BHBulletPool {
    constructor(bounds, margin = 24) {
        this.bounds = bounds; this.margin = margin;
        this.live = []; this.free = []; this.allocs = 0;
    }
    spawn(x, y, vx, vy, r) {
        let b = this.free.pop();
        if (!b) { b = { x: 0, y: 0, vx: 0, vy: 0, r: 0 }; this.allocs++; } // only when the pool is empty
        b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r;
        this.live.push(b);
        return b;
    }
    step(dt) {
        const { x, y, w, h } = this.bounds, m = this.margin;
        for (let i = this.live.length - 1; i >= 0; i--) {
            const b = this.live[i];
            b.x += b.vx * dt; b.y += b.vy * dt;        // in-place: no temp Vector2D
            if (b.x < x - m || b.x > x + w + m || b.y < y - m || b.y > y + h + m) {
                this.live[i] = this.live[this.live.length - 1]; this.live.pop(); // swap-remove
                this.free.push(b);                      // recycle, don't garbage
            }
        }
    }
    get count() { return this.live.length; }
}

// Struct-of-Arrays: every field is a flat typed array indexed by bullet. Tight,
// cache-friendly, and culling is an O(1) swap-remove (copy the last live bullet
// into the dead slot, shrink count) — never a splice.
class BHSoaBullets {
    constructor(cap, bounds, margin = 24) {
        this.cap = cap; this.bounds = bounds; this.margin = margin;
        this.x = new Float32Array(cap); this.y = new Float32Array(cap);
        this.vx = new Float32Array(cap); this.vy = new Float32Array(cap);
        this.r = new Float32Array(cap);
        this.count = 0;
    }
    spawn(x, y, vx, vy, r) {
        if (this.count >= this.cap) return false;       // at capacity: drop the shot
        const i = this.count++;
        this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.r[i] = r;
        return true;
    }
    step(dt) {
        const { x, y, w, h } = this.bounds, m = this.margin;
        const minX = x - m, maxX = x + w + m, minY = y - m, maxY = y + h + m;
        let n = this.count;
        for (let i = 0; i < n; i++) {
            this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
            if (this.x[i] < minX || this.x[i] > maxX || this.y[i] < minY || this.y[i] > maxY) {
                n--;                                     // swap the last live bullet into slot i
                this.x[i] = this.x[n]; this.y[i] = this.y[n];
                this.vx[i] = this.vx[n]; this.vy[i] = this.vy[n]; this.r[i] = this.r[n];
                i--;                                     // re-test the one we just moved in
            }
        }
        this.count = n;
    }
    clear() { this.count = 0; }
}

// A uniform-grid spatial hash: bucket items by which cell they fall in, so a
// "what's near me?" query only looks at the 3x3 cells around a point instead of
// every item. Rebuilt each frame (clear + insert).
class BHSpatialHash {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    clear() { this.map.clear(); }
    _key(cx, cy) { return cx + ',' + cy; }
    insert(i, x, y) {
        const k = this._key(Math.floor(x / this.cell), Math.floor(y / this.cell));
        let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); }
        a.push(i);
    }
    // Push indices from the 3x3 neighbourhood of (x,y) into `out`; returns it.
    queryNear(x, y, out) {
        out.length = 0;
        const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
        for (let gx = cx - 1; gx <= cx + 1; gx++)
            for (let gy = cy - 1; gy <= cy + 1; gy++) {
                const a = this.map.get(this._key(gx, gy));
                if (a) for (let j = 0; j < a.length; j++) out.push(a[j]);
            }
        return out;
    }
}

// =============================================================================
// 1) naiveDemo — the problem
// =============================================================================
(function naiveDemo() {
    const canvas = document.getElementById('bhNaiveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const nEl = document.getElementById('bhNaiveN');
    const nVal = document.getElementById('bhNaiveNVal');
    const hud = document.getElementById('bhNaiveHud');
    const meter = bhMakeMeter();
    let naive = [];           // array of {pos:Vector2D, vel:Vector2D, radius}
    let stepMs = 0, drawMs = 0;

    function update(dt) {
        const t0 = performance.now();
        const target = +nEl.value;
        // maintain ~target bullets, spawning OBJECTS with Vector2D fields
        for (let k = 0; k < 240 && naive.length < target; k++) {
            const a = Math.random() * BH.TAU, sp = 70 + Math.random() * 110;
            naive.push({ pos: new Vector2D(center.x, center.y), vel: Vector2D.fromAngle(a, sp), radius: 3.5 });
        }
        const { x, y, w, h } = bounds, m = 20;
        for (let i = naive.length - 1; i >= 0; i--) {
            const b = naive[i];
            b.pos.add(b.vel.copy().multiply(dt));      // ALLOC: a temp Vector2D every bullet, every step
            if (b.pos.x < x - m || b.pos.x > x + w + m || b.pos.y < y - m || b.pos.y > y + h + m)
                naive.splice(i, 1);                     // splice: O(n) shift
        }
        stepMs = performance.now() - t0;
    }
    function render() {
        const t0 = performance.now();
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        for (const b of naive) bhDrawBullet(ctx, b, BH.bullet); // per-bullet draw calls
        drawMs = performance.now() - t0;
        bhMeterPush(meter, stepMs + drawMs);
        bhDrawMeter(ctx, meter, bounds, stepMs + drawMs);
        if (nVal) nVal.textContent = nEl.value;
        hud.innerHTML = `<b>${naive.length}</b> bullets · step ${stepMs.toFixed(1)}ms + draw ${drawMs.toFixed(1)}ms · `
            + `~<b style="color:#ef5350">${naive.length}</b> temp allocs/frame (one Vector2D each) + splice`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 2) poolDemo — the object pool (zero allocations after warmup)
// =============================================================================
(function poolDemo() {
    const canvas = document.getElementById('bhPoolCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const nEl = document.getElementById('bhPoolN');
    const nVal = document.getElementById('bhPoolNVal');
    const hud = document.getElementById('bhPoolHud');
    const meter = bhMakeMeter();
    const pool = new BHBulletPool(bounds, 20);
    let stepMs = 0, drawMs = 0, allocsLastSec = 0, allocAccum = 0, secT = 0;

    function update(dt) {
        const t0 = performance.now();
        const target = +nEl.value;
        const before = pool.allocs;
        for (let k = 0; k < 240 && pool.count < target; k++) {
            const a = Math.random() * BH.TAU, sp = 70 + Math.random() * 110;
            pool.spawn(center.x, center.y, Math.cos(a) * sp, Math.sin(a) * sp, 3.5);
        }
        pool.step(dt);
        allocAccum += pool.allocs - before;
        secT += dt; if (secT >= 1) { allocsLastSec = allocAccum; allocAccum = 0; secT = 0; }
        stepMs = performance.now() - t0;
    }
    function render() {
        const t0 = performance.now();
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        // batched draw straight from the pool's live objects
        ctx.fillStyle = BH.bulletBlue; ctx.beginPath();
        for (const b of pool.live) { ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, BH.TAU); }
        ctx.fill();
        drawMs = performance.now() - t0;
        bhMeterPush(meter, stepMs + drawMs);
        bhDrawMeter(ctx, meter, bounds, stepMs + drawMs);
        if (nVal) nVal.textContent = nEl.value;
        hud.innerHTML = `<b>${pool.count}</b> live · pooled spare ${pool.free.length} · `
            + `step ${stepMs.toFixed(1)}ms · new allocations last second: `
            + `<b style="color:${allocsLastSec === 0 ? '#66bb6a' : '#ffa726'}">${allocsLastSec}</b>`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 3) soaDemo — Struct-of-Arrays (10k bullets, swap-remove cull)
// =============================================================================
(function soaDemo() {
    const canvas = document.getElementById('bhSoaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const nEl = document.getElementById('bhSoaN');
    const nVal = document.getElementById('bhSoaNVal');
    const hud = document.getElementById('bhSoaHud');
    const meter = bhMakeMeter();
    const S = new BHSoaBullets(11000, bounds, 20);
    let stepMs = 0, drawMs = 0;

    function update(dt) {
        const t0 = performance.now();
        const target = Math.min(+nEl.value, S.cap);
        for (let k = 0; k < 600 && S.count < target; k++) {
            const a = Math.random() * BH.TAU, sp = 60 + Math.random() * 130;
            S.spawn(center.x, center.y, Math.cos(a) * sp, Math.sin(a) * sp, 3);
        }
        S.step(dt);
        stepMs = performance.now() - t0;
    }
    function render() {
        const t0 = performance.now();
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawSoa(ctx, S, BH.bullet, BH.bulletCore);
        drawMs = performance.now() - t0;
        bhMeterPush(meter, stepMs + drawMs);
        bhDrawMeter(ctx, meter, bounds, stepMs + drawMs);
        if (nVal) nVal.textContent = nEl.value;
        hud.innerHTML = `<b>${S.count}</b> bullets in flat Float32Arrays · `
            + `step <b style="color:#66bb6a">${stepMs.toFixed(1)}ms</b> + draw ${drawMs.toFixed(1)}ms · O(1) swap-remove cull`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 4) hashDemo — a spatial hash for hit detection (checks: N → ~k)
// =============================================================================
(function hashDemo() {
    const canvas = document.getElementById('bhHashCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + 80 };
    const keys = bhInstallKeys(canvas);
    const useHashCb = document.getElementById('bhHashOn');
    const hud = document.getElementById('bhHashHud');

    const CELL = 40;
    const S = new BHSoaBullets(7000, bounds, 20);
    const hash = new BHSpatialHash(CELL);
    const player = { pos: new Vector2D(center.x, bounds.y + bounds.h - 60), radius: 3, grazeR: 22, focused: false };
    const cand = [];
    let grazes = 0, checks = 0, baseAngle = 0;

    function update(dt) {
        // a steady spiral keeps a few thousand bullets in play
        baseAngle += dt * 1.3;
        for (let arm = 0; arm < 3; arm++) {
            for (let s = 0; s < 4; s++) {
                const a = baseAngle + arm / 3 * BH.TAU + s * 0.02, sp = 70 + s * 18;
                S.spawn(center.x, center.y, Math.cos(a) * sp, Math.sin(a) * sp, 4);
            }
        }
        S.step(dt);
        bhMovePlayer(player, keys, bounds, dt);

        const useHash = useHashCb.checked;
        const gr = (player.grazeR + 4) * (player.grazeR + 4);
        checks = 0;
        if (useHash) {
            hash.clear();
            for (let i = 0; i < S.count; i++) hash.insert(i, S.x[i], S.y[i]);
            hash.queryNear(player.pos.x, player.pos.y, cand);
            for (let j = 0; j < cand.length; j++) {
                const i = cand[j]; checks++;
                const dx = S.x[i] - player.pos.x, dy = S.y[i] - player.pos.y;
                if (dx * dx + dy * dy <= gr) grazes++;
            }
        } else {
            for (let i = 0; i < S.count; i++) {
                checks++;
                const dx = S.x[i] - player.pos.x, dy = S.y[i] - player.pos.y;
                if (dx * dx + dy * dy <= gr) grazes++;
            }
        }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        // draw the 3x3 queried cells when the hash is on
        if (useHashCb.checked) {
            const cx = Math.floor(player.pos.x / CELL), cy = Math.floor(player.pos.y / CELL);
            ctx.fillStyle = 'rgba(79,195,247,0.10)'; ctx.strokeStyle = 'rgba(79,195,247,0.35)'; ctx.lineWidth = 1;
            for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
                ctx.fillRect(gx * CELL, gy * CELL, CELL, CELL); ctx.strokeRect(gx * CELL, gy * CELL, CELL, CELL);
            }
        }
        bhDrawSoa(ctx, S, BH.bullet, BH.bulletCore);
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · toggle the hash, watch "checks"');
        hud.innerHTML = `${S.count} bullets · hit-checks this frame: `
            + `<b style="color:${useHashCb.checked ? '#66bb6a' : '#ef5350'}">${checks}</b> `
            + `(${useHashCb.checked ? 'spatial hash — only the 3×3 around you' : 'naive — every bullet'})`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 5) batchDemo — render batching (one fill vs thousands)
// =============================================================================
(function batchDemo() {
    const canvas = document.getElementById('bhBatchCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const nEl = document.getElementById('bhBatchN');
    const nVal = document.getElementById('bhBatchNVal');
    const batchCb = document.getElementById('bhBatchOn');
    const hud = document.getElementById('bhBatchHud');
    const meter = bhMakeMeter();
    const S = new BHSoaBullets(6000, bounds, 20);
    let drawMs = 0;

    function update(dt) {
        const target = Math.min(+nEl.value, S.cap);
        for (let k = 0; k < 400 && S.count < target; k++) {
            const a = Math.random() * BH.TAU, sp = 55 + Math.random() * 120;
            S.spawn(center.x, center.y, Math.cos(a) * sp, Math.sin(a) * sp, 4);
        }
        S.step(dt);
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        const t0 = performance.now();
        if (batchCb.checked) {
            bhDrawSoa(ctx, S, BH.bulletGold, BH.bulletCore);   // 2 fills total
        } else {
            // the slow way: set state + fill PER bullet (two arcs each)
            for (let i = 0; i < S.count; i++) {
                ctx.beginPath(); ctx.arc(S.x[i], S.y[i], S.r[i], 0, BH.TAU); ctx.fillStyle = BH.bulletGold; ctx.fill();
                ctx.beginPath(); ctx.arc(S.x[i], S.y[i], S.r[i] * 0.45, 0, BH.TAU); ctx.fillStyle = BH.bulletCore; ctx.fill();
            }
        }
        drawMs = performance.now() - t0;
        bhMeterPush(meter, drawMs);
        bhDrawMeter(ctx, meter, bounds, drawMs);
        if (nVal) nVal.textContent = nEl.value;
        hud.innerHTML = `<b>${S.count}</b> bullets · draw <b style="color:${batchCb.checked ? '#66bb6a' : '#ef5350'}">${drawMs.toFixed(1)}ms</b> · `
            + (batchCb.checked ? '2 fills total (batched)' : `${S.count * 2} fill calls (one per bullet)`);
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 6) stressDemo — capstone "Stress Test": everything on, 10k at 60 fps
// =============================================================================
(function stressDemo() {
    const canvas = document.getElementById('bhStressCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + 90 };
    const keys = bhInstallKeys(canvas);
    const rateEl = document.getElementById('bhStressRate');
    const rateVal = document.getElementById('bhStressRateVal');
    const hud = document.getElementById('bhStressHud');
    const meter = bhMakeMeter();

    const CELL = 36;
    const S = new BHSoaBullets(12000, bounds, 20);     // pooled-capacity SoA store
    const hash = new BHSpatialHash(CELL);
    const player = { pos: new Vector2D(center.x, bounds.y + bounds.h - 60), radius: 3, grazeR: 20, focused: false };
    const cand = [];
    let baseAngle = 0, stepMs = 0, drawMs = 0, grazes = 0, hits = 0, checks = 0, fps = 0, fpsT = 0, frames = 0;

    function update(dt) {
        const t0 = performance.now();
        // a spinning multi-arm spiral at production scale (the Advanced boss, cranked)
        baseAngle += dt * 1.6;
        const perArm = +rateEl.value;                   // bullets per arm per frame
        for (let arm = 0; arm < 5; arm++) {
            for (let s = 0; s < perArm; s++) {
                const a = baseAngle + arm / 5 * BH.TAU + s * 0.03, sp = 60 + s * 12;
                S.spawn(center.x, center.y, Math.cos(a) * sp, Math.sin(a) * sp, 3.5);
            }
        }
        S.step(dt);
        bhMovePlayer(player, keys, bounds, dt);

        // spatial-hash hit/graze: rebuild, query only the player's neighbourhood
        hash.clear();
        for (let i = 0; i < S.count; i++) hash.insert(i, S.x[i], S.y[i]);
        hash.queryNear(player.pos.x, player.pos.y, cand);
        checks = cand.length;
        const hr = (player.radius + 3.5) * (player.radius + 3.5);
        const gr = (player.grazeR + 3.5) * (player.grazeR + 3.5);
        for (let j = 0; j < cand.length; j++) {
            const i = cand[j];
            const dx = S.x[i] - player.pos.x, dy = S.y[i] - player.pos.y, d2 = dx * dx + dy * dy;
            if (d2 <= hr) hits++; else if (d2 <= gr) grazes++;
        }
        stepMs = performance.now() - t0;

        frames++; fpsT += dt; if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
        keys.endFrame();
    }
    function render() {
        const t0 = performance.now();
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawSoa(ctx, S, BH.bullet, BH.bulletCore);     // batched
        // emitter + player
        ctx.beginPath(); ctx.arc(center.x, center.y, 11, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        bhDrawPlayer(ctx, player);
        drawMs = performance.now() - t0;
        bhMeterPush(meter, stepMs + drawMs);
        bhDrawMeter(ctx, meter, bounds, stepMs + drawMs);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · crank the slider · dodge 10k bullets');
        if (rateVal) rateVal.textContent = rateEl.value;
        hud.innerHTML = `<b style="color:#4fc3f7">${S.count}</b> bullets @ <b>${fps}</b> fps · `
            + `step ${stepMs.toFixed(1)} + draw ${drawMs.toFixed(1)} ms · `
            + `hit-checks ${checks} (hashed) · grazes ${grazes}`;
    }
    bhLoop(update, render).start();
})();
