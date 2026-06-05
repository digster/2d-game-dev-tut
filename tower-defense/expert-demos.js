// =============================================================================
// TOWER DEFENSE — EXPERT TIER DEMOS ("Ten Thousand Creeps")
// =============================================================================
// Performance at scale. The bottleneck stops being cleverness and becomes
// throughput. Six demos, each isolating one fix, then the swarm that combines them:
//   1. poolDemo      — object pooling: reuse vs allocate (GC churn)
//   2. soaDemo       — Struct-of-Arrays vs Array-of-Structs (memory layout)
//   3. hashDemo      — a spatial hash for range queries (O(T·E) → ~O(T·k))
//   4. batchDemo     — render batching (one path for the whole crowd)
//   5. flowScaleDemo — thousands of SoA creeps on ONE nav.js flow field
//   6. swarmProject  — Mini-project "Swarm": everything, at scale, with a meter
//
// The production STORES (TDPool / TDSwarm / TDSpatialHash) are taught INLINE here
// as the tier's lesson — the *terminal* consumer (exactly how the bullet-hell
// Expert tier keeps its pool/SoA/hash inline rather than rewriting the engine). The
// navigation toolkit it reuses (`tdFlowField`) was PROMOTED to engine/nav.js this
// tier — this is its 2nd consumer.
//
// DEPENDENCIES: ../shared/utils.js, engine/loop.js, engine/render.js,
//   engine/world.js, engine/entities.js, engine/nav.js (tdFlowField).
// =============================================================================

// --- TDPool: a free-list object pool ----------------------------------------
// Spawning thousands of short-lived objects (sparks, shots) churns the garbage
// collector — every dead object is future GC work, and a GC pause is a dropped
// frame. A pool fixes it by RECYCLING: a `free` list holds dead objects; spawn
// pops one (allocating only when the list is empty), and a dead object goes back to
// `free` instead of to the collector. After warm-up, allocations → 0.
class TDPool {
    constructor(factory) { this.factory = factory; this.free = []; this.live = []; this.allocs = 0; }
    spawn(init) {
        let o = this.free.pop();
        if (!o) { o = this.factory(); this.allocs++; }    // allocate ONLY when starved
        init(o);
        o.dead = false;
        this.live.push(o);
        return o;
    }
    // Recycle every object flagged `dead` back to the free list (O(1) swap-remove).
    sweep() {
        for (let i = this.live.length - 1; i >= 0; i--) {
            const o = this.live[i];
            if (o.dead) {
                const last = this.live.pop();
                if (i < this.live.length) this.live[i] = last;
                this.free.push(o);
            }
        }
    }
    get count() { return this.live.length; }
}

// --- TDSwarm: a Struct-of-Arrays creep store --------------------------------
// "Array of Structs" is `[{x,y,…}, …]` — each creep is a heap object the CPU must
// chase a pointer to. "Struct of Arrays" is one flat typed array PER FIELD: all the
// x's contiguous, all the y's contiguous. Iterating is then a linear walk over
// packed memory (cache-friendly, zero per-creep allocation) — and `Float32Array`
// means no boxing and no GC. Death is an O(1) swap-remove: copy the last creep over
// the dead slot and shrink the count.
class TDSwarm {
    constructor(cap) {
        this.cap = cap;
        this.x = new Float32Array(cap);
        this.y = new Float32Array(cap);
        this.spd = new Float32Array(cap);
        this.hp = new Float32Array(cap);
        this.count = 0;
    }
    spawn(x, y, spd, hp) {
        if (this.count >= this.cap) return -1;
        const i = this.count++;
        this.x[i] = x; this.y[i] = y; this.spd[i] = spd; this.hp[i] = hp;
        return i;
    }
    remove(i) {                                            // swap-remove
        const last = --this.count;
        this.x[i] = this.x[last]; this.y[i] = this.y[last];
        this.spd[i] = this.spd[last]; this.hp[i] = this.hp[last];
    }
    // Steer every creep by the flow field; cull the ones that reach the goal or
    // leave the grid. One array lookup per creep — this is why a crowd is cheap.
    stepFlow(field, grid, dt) {
        const cols = grid.cols, rows = grid.rows, tile = grid.tile, ox = grid.originX, oy = grid.originY;
        const flow = field.flow, cost = field.cost;
        let reached = 0;
        for (let i = this.count - 1; i >= 0; i--) {
            const col = Math.floor((this.x[i] - ox) / tile), row = Math.floor((this.y[i] - oy) / tile);
            if (col < 0 || col >= cols || row < 0 || row >= rows) { this.remove(i); continue; }
            const idx = row * cols + col;
            if (cost[idx] === 0) { this.remove(i); reached++; continue; }
            const v = flow[idx];
            if (v) { this.x[i] += v.x * this.spd[i] * dt; this.y[i] += v.y * this.spd[i] * dt; }
        }
        return reached;
    }
}

// --- TDSpatialHash: a uniform-grid spatial hash -----------------------------
// "Which creeps are near this tower?" answered naively is O(towers × creeps). A
// spatial hash buckets every creep into a grid cell once per frame; a tower then
// reads only the few cells its range overlaps. Choose the cell size ≈ the largest
// query radius, so a query touches a small, constant patch of cells.
class TDSpatialHash {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    _k(x, y) { return Math.floor(x / this.cell) + ',' + Math.floor(y / this.cell); }
    clear() { this.map.clear(); }
    insert(item, x, y) {
        const k = this._k(x, y);
        let a = this.map.get(k);
        if (!a) { a = []; this.map.set(k, a); }
        a.push(item);
    }
    // Append the items in cells overlapping the (x,y,r) box into `out`; returns out.
    queryInto(x, y, r, out) {
        out.length = 0;
        const c = this.cell;
        const minx = Math.floor((x - r) / c), maxx = Math.floor((x + r) / c);
        const miny = Math.floor((y - r) / c), maxy = Math.floor((y + r) / c);
        for (let cx = minx; cx <= maxx; cx++) for (let cy = miny; cy <= maxy; cy++) {
            const a = this.map.get(cx + ',' + cy);
            if (a) for (let j = 0; j < a.length; j++) out.push(a[j]);
        }
        return out;
    }
}

// === tier-local helpers ======================================================
function tdRunWhenVisible(canvas, loop) {
    const io = new IntersectionObserver((es) => { for (const e of es) e.isIntersecting ? loop.start() : loop.stop(); }, { threshold: 0.01 });
    io.observe(canvas); return loop;
}
function tdMeter() { return { ms: 0, push(v) { this.ms = this.ms * 0.9 + v * 0.1; } }; }
function tdInfo(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

// =============================================================================
// 1) poolDemo — object pooling vs naive allocation
// =============================================================================
(function poolDemo() {
    const canvas = document.getElementById('tdPoolCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, GRAV = 320;
    let pooled = true, naiveAllocs = 0, spawnAcc = 0;
    const naive = [];
    const pool = new TDPool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, dead: false }));

    const toggle = document.getElementById('tdPoolToggle');
    if (toggle) toggle.addEventListener('click', () => { pooled = !pooled; reset(); toggle.textContent = pooled ? 'Mode: POOLED' : 'Mode: NAIVE (allocates)'; });
    function reset() { naive.length = 0; pool.live.length = 0; pool.free.length = 0; pool.allocs = 0; naiveAllocs = 0; }

    function emitOne() {
        const x = 30 + Math.random() * (W - 60), y = 16;
        const vx = (Math.random() - 0.5) * 140, vy = 30 + Math.random() * 60, life = 0.9 + Math.random() * 0.7;
        if (pooled) pool.spawn((o) => { o.x = x; o.y = y; o.vx = vx; o.vy = vy; o.life = life; });
        else { naive.push({ x, y, vx, vy, life }); naiveAllocs++; }
    }
    function update(dt) {
        spawnAcc += 150 * dt;
        while (spawnAcc >= 1) { spawnAcc -= 1; emitOne(); }
        const arr = pooled ? pool.live : naive;
        for (let i = arr.length - 1; i >= 0; i--) {
            const o = arr[i];
            o.x += o.vx * dt; o.y += o.vy * dt; o.vy += GRAV * dt; o.life -= dt;
            if (o.life <= 0 || o.y > H) { if (pooled) o.dead = true; else arr.splice(i, 1); }
        }
        if (pooled) pool.sweep();
        const allocs = pooled ? pool.allocs : naiveAllocs;
        tdInfo('tdPoolInfo', `live <b>${arr.length}</b> &nbsp;·&nbsp; objects ever allocated <b style="color:${pooled ? '#66bb6a' : '#ef5350'}">${allocs}</b>` + (pooled ? ' &nbsp;(plateaus — recycled)' : ' &nbsp;(climbs forever — GC churn)'));
    }
    function render() {
        clearCanvas(ctx, W, H, TD.bg);
        const arr = pooled ? pool.live : naive;
        ctx.fillStyle = pooled ? TD.good : TD.bad;
        ctx.beginPath();
        for (const o of arr) { ctx.moveTo(o.x + 2.5, o.y); ctx.arc(o.x, o.y, 2.5, 0, TD.TAU); }
        ctx.fill();
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 2) soaDemo — Struct-of-Arrays vs Array-of-Structs
// =============================================================================
(function soaDemo() {
    const canvas = document.getElementById('tdSoaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let N = 3000;
    let aos = [], sx, sy, svx, svy;
    const mAos = tdMeter(), mSoa = tdMeter();

    function build() {
        aos = new Array(N);
        sx = new Float32Array(N); sy = new Float32Array(N); svx = new Float32Array(N); svy = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const x = Math.random() * W, y = Math.random() * H, vx = (Math.random() - 0.5) * 200, vy = (Math.random() - 0.5) * 200;
            aos[i] = { x, y, vx, vy };
            sx[i] = x; sy[i] = y; svx[i] = vx; svy[i] = vy;
        }
    }
    build();
    const countEl = document.getElementById('tdSoaCount');
    if (countEl) countEl.addEventListener('input', () => { N = +countEl.value; tdInfo('tdSoaCountVal', N + ' agents'); build(); });
    tdInfo('tdSoaCountVal', N + ' agents');

    function stepAoS(dt) { for (let i = 0; i < aos.length; i++) { const o = aos[i]; o.x += o.vx * dt; o.y += o.vy * dt; if (o.x < 0 || o.x > W) o.vx = -o.vx; if (o.y < 0 || o.y > H) o.vy = -o.vy; } }
    function stepSoA(dt) { for (let i = 0; i < N; i++) { sx[i] += svx[i] * dt; sy[i] += svy[i] * dt; if (sx[i] < 0 || sx[i] > W) svx[i] = -svx[i]; if (sy[i] < 0 || sy[i] > H) svy[i] = -svy[i]; } }

    function update(dt) {
        let t0 = performance.now(); stepAoS(dt); mAos.push(performance.now() - t0);
        t0 = performance.now(); stepSoA(dt); mSoa.push(performance.now() - t0);
        tdInfo('tdSoaInfo', `update time — Array-of-Structs <b style="color:#ffa726">${mAos.ms.toFixed(3)} ms</b> &nbsp;vs&nbsp; Struct-of-Arrays <b style="color:#66bb6a">${mSoa.ms.toFixed(3)} ms</b>`);
    }
    function render() {
        clearCanvas(ctx, W, H, TD.bg);
        ctx.fillStyle = TD.accent;
        ctx.beginPath();
        for (let i = 0; i < N; i++) { ctx.moveTo(sx[i] + 1.6, sy[i]); ctx.arc(sx[i], sy[i], 1.6, 0, TD.TAU); }
        ctx.fill();
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 3) hashDemo — a spatial hash for range queries
// =============================================================================
(function hashDemo() {
    const canvas = document.getElementById('tdHashCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let N = 1200;
    const RANGE = 90;
    const hash = new TDSpatialHash(RANGE);
    const cand = [];
    let creeps = [];
    const towers = [];
    for (let i = 0; i < 8; i++) towers.push({ x: 90 + (i % 4) * 200, y: 110 + Math.floor(i / 4) * 150 });

    function build() { creeps = []; for (let i = 0; i < N; i++) creeps.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120 }); }
    build();
    const countEl = document.getElementById('tdHashCount');
    if (countEl) countEl.addEventListener('input', () => { N = +countEl.value; tdInfo('tdHashCountVal', N + ' creeps'); build(); });
    tdInfo('tdHashCountVal', N + ' creeps');

    let naiveTests = 0, hashTests = 0;
    function update(dt) {
        for (const c of creeps) { c.x += c.vx * dt; c.y += c.vy * dt; if (c.x < 0 || c.x > W) c.vx = -c.vx; if (c.y < 0 || c.y > H) c.vy = -c.vy; }
        // naive: every tower tests every creep
        naiveTests = towers.length * creeps.length;
        // hashed: bucket once, each tower tests only nearby candidates
        hash.clear();
        for (let i = 0; i < creeps.length; i++) hash.insert(i, creeps[i].x, creeps[i].y);
        hashTests = 0;
        for (const t of towers) { hash.queryInto(t.x, t.y, RANGE, cand); hashTests += cand.length; }
        tdInfo('tdHashInfo', `pair-tests this frame — naive <b style="color:#ef5350">${naiveTests.toLocaleString()}</b> &nbsp;vs&nbsp; hashed <b style="color:#66bb6a">${hashTests.toLocaleString()}</b> &nbsp;(${(naiveTests / Math.max(1, hashTests)).toFixed(1)}× fewer)`);
    }
    function render() {
        clearCanvas(ctx, W, H, TD.bg);
        // highlight the cells the first tower queries
        const t0 = towers[0];
        ctx.fillStyle = 'rgba(124,242,200,0.10)';
        const minx = Math.floor((t0.x - RANGE) / RANGE), maxx = Math.floor((t0.x + RANGE) / RANGE), miny = Math.floor((t0.y - RANGE) / RANGE), maxy = Math.floor((t0.y + RANGE) / RANGE);
        for (let cx = minx; cx <= maxx; cx++) for (let cy = miny; cy <= maxy; cy++) ctx.fillRect(cx * RANGE, cy * RANGE, RANGE, RANGE);
        // creeps (batched)
        ctx.fillStyle = TD.enemy; ctx.beginPath();
        for (const c of creeps) { ctx.moveTo(c.x + 1.6, c.y); ctx.arc(c.x, c.y, 1.6, 0, TD.TAU); }
        ctx.fill();
        // towers + ranges
        for (const t of towers) { tdDrawRange(ctx, t.x, t.y, RANGE, { fill: 'rgba(124,242,200,0.03)' }); tdDrawTower(ctx, { x: t.x, y: t.y, color: TD.tower, angle: -Math.PI / 2 }); }
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 4) batchDemo — render batching
// =============================================================================
(function batchDemo() {
    const canvas = document.getElementById('tdBatchCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let N = 4000, batched = true;
    let xs, ys;
    const meter = tdMeter();
    function build() { xs = new Float32Array(N); ys = new Float32Array(N); for (let i = 0; i < N; i++) { xs[i] = Math.random() * W; ys[i] = Math.random() * H; } }
    build();
    const countEl = document.getElementById('tdBatchCount');
    if (countEl) countEl.addEventListener('input', () => { N = +countEl.value; tdInfo('tdBatchCountVal', N + ' dots'); build(); });
    tdInfo('tdBatchCountVal', N + ' dots');
    const toggle = document.getElementById('tdBatchToggle');
    if (toggle) toggle.addEventListener('click', () => { batched = !batched; toggle.textContent = batched ? 'Render: BATCHED' : 'Render: PER-DOT'; });

    function update(dt) { for (let i = 0; i < N; i++) { xs[i] += Math.sin((i + performance.now() * 0.001)) * 20 * dt; ys[i] += 14 * dt; if (ys[i] > H) ys[i] = 0; } }
    function render() {
        const t0 = performance.now();
        clearCanvas(ctx, W, H, TD.bg);
        if (batched) {                                    // ONE path + ONE fill for the whole crowd
            ctx.fillStyle = TD.accent; ctx.beginPath();
            for (let i = 0; i < N; i++) { ctx.moveTo(xs[i] + 2, ys[i]); ctx.arc(xs[i], ys[i], 2, 0, TD.TAU); }
            ctx.fill();
        } else {                                          // a beginPath + fill PER dot (the slow way)
            for (let i = 0; i < N; i++) { ctx.fillStyle = TD.accent; ctx.beginPath(); ctx.arc(xs[i], ys[i], 2, 0, TD.TAU); ctx.fill(); }
        }
        meter.push(performance.now() - t0);
        tdInfo('tdBatchInfo', `render time — <b style="color:${batched ? '#66bb6a' : '#ef5350'}">${meter.ms.toFixed(2)} ms</b> &nbsp;(${batched ? 'one path for all ' + N : 'one beginPath/fill per dot'})`);
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 5) flowScaleDemo — thousands of SoA creeps on ONE flow field
// =============================================================================
(function flowScaleDemo() {
    const canvas = document.getElementById('tdFlowScaleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const goal = { col: 18, row: 4 };
    // a couple of fixed pillars to split the stream
    for (const [c, r] of [[9, 1], [9, 2], [9, 6], [9, 7], [13, 3], [13, 4], [13, 5]]) grid.setBlocked(c, r, true);
    const field = tdFlowField(grid, goal);
    const swarm = new TDSwarm(8000);
    const mUpd = tdMeter();
    let rate = 250, acc = 0;

    const rateEl = document.getElementById('tdFlowScaleRate');
    if (rateEl) rateEl.addEventListener('input', () => { rate = +rateEl.value; tdInfo('tdFlowScaleRateVal', rate + '/s'); });
    tdInfo('tdFlowScaleRateVal', rate + '/s');

    function update(dt) {
        acc += rate * dt;
        while (acc >= 1) { acc -= 1; const r = Math.floor(Math.random() * grid.rows); const p = grid.cellCenter(0, r); if (tdWalkable(grid, 0, r)) swarm.spawn(p.x, p.y, 45 + Math.random() * 35, 1); }
        const t0 = performance.now(); swarm.stepFlow(field, grid, dt); mUpd.push(performance.now() - t0);
        tdInfo('tdFlowScaleInfo', `<b>${swarm.count.toLocaleString()}</b> creeps &nbsp;·&nbsp; steer cost <b style="color:#66bb6a">${mUpd.ms.toFixed(3)} ms</b> &nbsp;(O(1) per creep — one shared field)`);
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawGrid(ctx, grid, { tintBlocked: true });
        ctx.fillStyle = TD.enemy; ctx.beginPath();
        for (let i = 0; i < swarm.count; i++) { ctx.moveTo(swarm.x[i] + 2.2, swarm.y[i]); ctx.arc(swarm.x[i], swarm.y[i], 2.2, 0, TD.TAU); }
        ctx.fill();
        const g = grid.cellCenter(goal.col, goal.row); ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, TD.TAU); ctx.fillStyle = TD.goal; ctx.fill();
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 6) swarmProject — Mini-project "Swarm": everything, at scale
// =============================================================================
(function swarmProject() {
    const canvas = document.getElementById('tdSwarmCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pointer = tdInstallPointer(canvas);
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const goal = { col: 18, row: 4 };
    const field = tdFlowField(grid, goal);                 // open field, computed once
    const TRANGE = 95;
    const swarm = new TDSwarm(12000);
    const hash = new TDSpatialHash(TRANGE);
    const cand = [];
    const sparks = new TDPool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, dead: false }));
    const mUpd = tdMeter(), mRen = tdMeter();
    let towers, rate, acc, killed;

    function reset() {
        towers = []; acc = 0; killed = 0;
        // a lattice of towers across the field (they shoot but DON'T block the flow)
        for (let col = 3; col <= 15; col += 3) for (let row = 1; row <= 7; row += 2) { const p = grid.cellCenter(col, row); towers.push({ x: p.x, y: p.y, cd: Math.random() * 0.4 }); }
        sparks.live.length = 0; sparks.free.length = 0; sparks.allocs = 0;
        swarm.count = 0;
    }
    reset();
    let rateVal = 220;
    const rateEl = document.getElementById('tdSwarmRate');
    if (rateEl) rateEl.addEventListener('input', () => { rateVal = +rateEl.value; tdInfo('tdSwarmRateVal', rateVal + '/s'); });
    tdInfo('tdSwarmRateVal', rateVal + '/s');
    const resetBtn = document.getElementById('tdSwarmReset');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    const RATE = 1.6, DMG = 1;                              // tower fire-rate & damage
    function update(dt) {
        const t0 = performance.now();
        // click to add a tower
        if (pointer.justPressed && pointer.inside) towers.push({ x: pointer.pos.x, y: pointer.pos.y, cd: 0 });
        // spawn
        acc += rateVal * dt;
        while (acc >= 1) { acc -= 1; const r = Math.floor(Math.random() * grid.rows); const p = grid.cellCenter(0, r); swarm.spawn(p.x, p.y, 42 + Math.random() * 34, 2 + Math.floor(Math.random() * 3)); }
        // steer (and despawn goal-reachers)
        swarm.stepFlow(field, grid, dt);
        // rebuild the hash, then towers hitscan the nearest creep in range
        hash.clear();
        for (let i = 0; i < swarm.count; i++) hash.insert(i, swarm.x[i], swarm.y[i]);
        for (const t of towers) {
            t.cd -= dt;
            if (t.cd > 0) continue;
            hash.queryInto(t.x, t.y, TRANGE, cand);
            let best = -1, bestD = TRANGE * TRANGE;
            for (let j = 0; j < cand.length; j++) { const i = cand[j]; const dx = swarm.x[i] - t.x, dy = swarm.y[i] - t.y, d = dx * dx + dy * dy; if (d <= bestD) { bestD = d; best = i; } }
            if (best >= 0) { t.cd = 1 / RATE; swarm.hp[best] -= DMG; sparks.spawn((o) => { o.x = swarm.x[best]; o.y = swarm.y[best]; o.vx = (Math.random() - 0.5) * 120; o.vy = (Math.random() - 0.5) * 120; o.life = 0.25; }); }
        }
        // cull dead creeps (after the tower loop, so candidate indices stay valid)
        for (let i = swarm.count - 1; i >= 0; i--) if (swarm.hp[i] <= 0) { killed++; swarm.remove(i); }
        // sparks
        for (const s of sparks.live) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (s.life <= 0) s.dead = true; }
        sparks.sweep();
        mUpd.push(performance.now() - t0);
        pointer.endFrame();
    }
    function render() {
        const t0 = performance.now();
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawGrid(ctx, grid);
        // creeps (batched)
        ctx.fillStyle = TD.enemy; ctx.beginPath();
        for (let i = 0; i < swarm.count; i++) { ctx.moveTo(swarm.x[i] + 2.4, swarm.y[i]); ctx.arc(swarm.x[i], swarm.y[i], 2.4, 0, TD.TAU); }
        ctx.fill();
        // sparks (batched)
        ctx.fillStyle = TD.proj; ctx.beginPath();
        for (const s of sparks.live) { ctx.moveTo(s.x + 1.4, s.y); ctx.arc(s.x, s.y, 1.4, 0, TD.TAU); }
        ctx.fill();
        for (const t of towers) tdDrawTower(ctx, { x: t.x, y: t.y, color: TD.tower, angle: -Math.PI / 2, radius: 10 });
        const g = grid.cellCenter(goal.col, goal.row); ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, TD.TAU); ctx.fillStyle = TD.goal; ctx.fill();
        mRen.push(performance.now() - t0);
        const budget = mUpd.ms + mRen.ms;
        tdInfo('tdSwarmInfo', `<b>${swarm.count.toLocaleString()}</b> creeps · ${towers.length} towers · update <b>${mUpd.ms.toFixed(2)}</b> + render <b>${mRen.ms.toFixed(2)}</b> = <b style="color:${budget < 16 ? '#66bb6a' : '#ffa726'}">${budget.toFixed(2)} ms</b>/frame (16.7 = 60fps)`);
        tdDrawHUD(ctx, grid, { msg: 'Click to add towers · pooled sparks · SoA creeps · hash targeting · batched draw' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();
