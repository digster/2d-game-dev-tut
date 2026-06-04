// =============================================================================
// TOWER DEFENSE — BEGINNER TIER DEMOS ("The Path & The Tower")
// =============================================================================
// Six demos, each an IIFE that early-returns if its canvas is absent (one demos
// file is safely shared by the whole tier page):
//   1. mapDemo        — the grid, the lane, and which tiles you can build on
//   2. creepDemo      — a creep FOLLOWS the lane by advancing one scalar (dist)
//   3. spawnDemo      — the spawner: a wave = N creeps emitted on a cadence
//   4. towerDemo      — the tower: range + target acquisition + fire-rate (hitscan)
//   5. projectileDemo — the shot travels, hits, deals damage; creeps die
//   6. miniProject    — "First Line of Defense": place towers, survive a wave
//
// DEPENDENCIES (loaded BEFORE this file):
//   ../shared/utils.js — Vector2D, clamp, clearCanvas (globals)
//   engine/loop.js     — tdLoop, tdInstallPointer (window)
//   engine/render.js   — TD palette + tdDraw* (window)
//   engine/world.js    — TDGrid, TDPath (window)
//
// THE ENTITY MODEL (TDEnemy / TDTower / TDProjectile + tdPickTarget) is declared
// TOP-LEVEL here, on purpose: these are the tier's *lesson*, and being top-level
// means you can build & poke them straight from the DevTools console
// (`new TDEnemy(...)`). They are NOT attached to `window` — that's reserved for
// the moment the Intermediate tier becomes their 2nd consumer and they're
// promoted to `engine/entities.js` (the repo's "promote on the 2nd consumer"
// rule). Until then they live here.
//
// ⚠️  Vector2D mutates in place: `add`/`multiply`/`normalize`/`set` change `this`;
//   only `subtract`/`copy` return new. An entity OWNS its `pos`, so mutating that
//   is fine — but `subtract` is used to get a fresh "toward target" vector without
//   corrupting anyone's position.
// =============================================================================

// The standard Beginner lane, as [col,row] cells (the ends sit off-grid so creeps
// walk in from the left edge and out past the right). Shared by every demo so the
// map is familiar as the lessons stack up.
const TD_LANE_CELLS = [[-1, 1], [4, 1], [4, 4], [9, 4], [9, 1], [14, 1], [14, 7], [19, 7]];

// --- Map helpers (top-level) -------------------------------------------------
// Build a TDPath through the centres of [col,row] cells, then stamp it onto the
// grid as un-buildable lane. `smooth` rounds the corners (a preview of the
// Intermediate tier's spline lanes); `pad` widens the no-build corridor.
function tdLaneThrough(grid, cells, opts = {}) {
    const pts = cells.map(([c, r]) => grid.cellCenter(c, r));
    const path = new TDPath(pts, { smooth: opts.smooth ?? false, samplesPerSeg: opts.samplesPerSeg ?? 18 });
    grid.blockAlongPath(path, opts.pad ?? 0);
    return path;
}

// Pause a demo's loop while it's scrolled off-screen (the page stacks six rAF
// loops — only the visible ones should run). Returns the loop for chaining.
function tdRunWhenVisible(canvas, loop) {
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) e.isIntersecting ? loop.start() : loop.stop();
    }, { threshold: 0.01 });
    io.observe(canvas);
    return loop;
}

// =============================================================================
// THE ENTITY MODEL
// =============================================================================

// --- TDEnemy: a creep that walks the lane -----------------------------------
// The whole of "path following" is one idea: a creep stores a single scalar
// `dist` — how far along the lane it has travelled — and each step advances it by
// `speed * dt`. The lane's arc-length table turns that scalar back into an (x,y).
// Speed is px/s (frame-rate independent); when `dist` reaches the lane's length
// the creep has reached the goal and "leaks".
class TDEnemy {
    constructor(path, opts = {}) {
        this.path = path;
        this.dist = opts.dist ?? 0;            // arc-length progress along the lane
        this.speed = opts.speed ?? 60;         // px/s
        this.maxHp = opts.hp ?? 5;
        this.hp = this.maxHp;
        this.radius = opts.radius ?? 9;
        this.color = opts.color || TD.enemy;
        this.bounty = opts.bounty ?? 5;        // gold awarded when killed
        this.alive = true;
        this.leaked = false;                   // reached the goal (cost a life)
        const p = path.pointAt(this.dist);
        this.pos = new Vector2D(p.x, p.y);     // a creep's position IS a 2D vector
    }
    // x/y getters so a TDEnemy can be handed straight to tdDrawEnemy.
    get x() { return this.pos.x; }
    get y() { return this.pos.y; }

    update(dt) {
        this.dist += this.speed * dt;          // advance along the lane
        if (this.dist >= this.path.length) {   // reached the goal
            this.dist = this.path.length;
            this.leaked = true;
            this.alive = false;
        }
        const p = this.path.pointAt(this.dist);
        this.pos.set(p.x, p.y);                 // set() mutates in place (this.pos is ours)
    }
    damage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    }
}

// --- tdPickTarget: the "first" targeting mode (top-level, console-testable) ---
// The classic TD default: of the creeps in range, shoot the one FURTHEST along
// the lane (closest to the goal) — it's the most urgent threat. The Intermediate
// tier generalizes this into swappable modes (last / closest / strongest / lead);
// here it's a single clear rule. Range uses SQUARED distance (no Math.sqrt).
function tdPickTarget(tower, enemies) {
    let best = null, bestProgress = -Infinity;
    const r2 = tower.range * tower.range;
    for (const e of enemies) {
        if (!e.alive) continue;
        if (tower.pos.distanceSquared(e.pos) > r2) continue;  // out of range
        if (e.dist > bestProgress) { bestProgress = e.dist; best = e; }
    }
    return best;
}

// --- TDTower: range + acquisition + fire-rate -------------------------------
// A tower is a fixed point with a `range`, a `fireRate` (shots/second → a cooldown
// of 1/fireRate seconds between shots), and a `damage` per shot. Its update does
// three things: keep/clear its target, aim its barrel at it, and — when the
// cooldown expires — FIRE. It returns the creep it fired at this step (or null).
// Crucially it does NOT decide what a "shot" looks like: the hitscan demo turns
// the return into an instant beam, the projectile demo into a traveling shot. One
// tower, two lessons.
class TDTower {
    constructor(x, y, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.range = opts.range ?? 110;
        this.damage = opts.damage ?? 2;
        this.fireRate = opts.fireRate ?? 1.5;  // shots per second
        this.projSpeed = opts.projSpeed ?? 280;
        this.cost = opts.cost ?? 40;
        this.color = opts.color || TD.tower;
        this.cooldown = 0;                      // seconds until the next shot is ready
        this.angle = -Math.PI / 2;              // barrel heading (starts pointing up)
        this.target = null;
    }
    get x() { return this.pos.x; }
    get y() { return this.pos.y; }

    inRange(enemy) { return this.pos.distanceSquared(enemy.pos) <= this.range * this.range; }

    update(dt, enemies) {
        if (this.cooldown > 0) this.cooldown -= dt;
        // Drop a target that died or walked out of range, then re-acquire.
        if (this.target && (!this.target.alive || !this.inRange(this.target))) this.target = null;
        if (!this.target) this.target = tdPickTarget(this, enemies);
        if (!this.target) return null;
        // Aim the barrel at the target's CURRENT position (Beginner aims at "now";
        // the Intermediate tier leads the target to where it WILL be).
        this.angle = Math.atan2(this.target.pos.y - this.pos.y, this.target.pos.x - this.pos.x);
        if (this.cooldown <= 0) {
            this.cooldown = 1 / this.fireRate;  // reset the cooldown
            return this.target;                 // "I fired at this creep this step"
        }
        return null;
    }
}

// --- TDProjectile: a shot that travels to its target ------------------------
// Unlike a hitscan beam (instant), a projectile is a moving point that chases the
// target's CURRENT position at `speed` px/s. Two honest consequences the demo
// surfaces: a slow shot can be outrun by a fast creep (→ the Intermediate "lead
// the target" lesson), and if the target dies mid-flight the shot fizzles
// (overkill is real). It "hits" when it gets within the target's radius this step
// — checked with the sub-step reach so a fast shot can't tunnel past a creep.
class TDProjectile {
    constructor(x, y, target, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.target = target;
        this.speed = opts.speed ?? 280;
        this.damage = opts.damage ?? 2;
        this.radius = opts.radius ?? 4;
        this.color = opts.color || TD.proj;
        this.alive = true;
    }
    get x() { return this.pos.x; }
    get y() { return this.pos.y; }

    update(dt) {
        if (!this.target || !this.target.alive) { this.alive = false; return; } // fizzle
        // Fresh vector from us toward the target (subtract returns NEW — target.pos
        // is untouched), normalized to a one-step move.
        const toward = this.target.pos.subtract(this.pos);
        const step = this.speed * dt;
        const reach = step + this.target.radius;            // sub-step hit window
        if (toward.lengthSquared() <= reach * reach) {      // arrived this step
            this.target.damage(this.damage);
            this.alive = false;
            return;
        }
        this.pos.add(toward.normalize().multiply(step));    // mutate our own pos
    }
}

// A tiny fading "pop" ring for kill/leak feedback (purely cosmetic). Kept trivial;
// the Simulations tier teaches a real particle pool.
function tdDrawPop(ctx, pop) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pop.life / pop.max);
    ctx.beginPath();
    ctx.arc(pop.x, pop.y, pop.r * (1.6 - pop.life / pop.max), 0, TD.TAU);
    ctx.lineWidth = 2;
    ctx.strokeStyle = pop.color || TD.proj;
    ctx.stroke();
    ctx.restore();
}

// =============================================================================
// 1) mapDemo — the grid, the lane, and what you can build on
// =============================================================================
(function mapDemo() {
    const canvas = document.getElementById('tdMapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    let path = tdLaneThrough(grid, TD_LANE_CELLS);
    const pointer = tdInstallPointer(canvas);

    let smooth = false;
    const smoothBtn = document.getElementById('tdMapSmooth');
    if (smoothBtn) smoothBtn.addEventListener('click', () => {
        smooth = !smooth;
        grid.blocked.fill(0);                       // re-stamp the lane for the new shape
        path = tdLaneThrough(grid, TD_LANE_CELLS, { smooth });
        smoothBtn.textContent = smooth ? 'Lane: Smooth (spline)' : 'Lane: Straight (waypoints)';
    });

    function update() { pointer.endFrame(); }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = pointer.inside ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { tintBlocked: true, hover });
        tdDrawPath(ctx, path, { grid });
        tdDrawHUD(ctx, grid, { msg: 'Green = buildable · Red = lane (no build)' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 2) creepDemo — a creep follows the lane (dist += speed·dt)
// =============================================================================
(function creepDemo() {
    const canvas = document.getElementById('tdCreepCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);

    let speed = 70;
    const speedEl = document.getElementById('tdCreepSpeed');
    const speedVal = document.getElementById('tdCreepSpeedVal');
    if (speedEl) speedEl.addEventListener('input', () => {
        speed = +speedEl.value;
        if (speedVal) speedVal.textContent = speed + ' px/s';
    });

    const creeps = [];
    let spawnTimer = 0;
    function update(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0 && creeps.length < 6) {     // a gentle trickle
            spawnTimer = 1.3;
            creeps.push(new TDEnemy(path, { speed }));
        }
        for (const c of creeps) { c.speed = speed; c.update(dt); }
        for (let i = creeps.length - 1; i >= 0; i--) if (!creeps[i].alive) creeps.splice(i, 1);
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawGrid(ctx, grid);
        tdDrawPath(ctx, path, { grid });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        tdDrawHUD(ctx, grid, { msg: creeps.length + ' creep(s) · dist += speed × dt' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 3) spawnDemo — the spawner: a wave is N creeps on a cadence
// =============================================================================
(function spawnDemo() {
    const canvas = document.getElementById('tdSpawnCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);

    // A SPAWNER is just a countdown: while `remaining > 0`, every `interval`
    // seconds emit one creep and decrement. That's the whole "wave" mechanic.
    const spawner = { remaining: 0, interval: 0.7, timer: 0, count: 10, speed: 70 };
    const creeps = [];
    let leaked = 0;

    const countEl = document.getElementById('tdSpawnCount');
    const intervalEl = document.getElementById('tdSpawnInterval');
    const startBtn = document.getElementById('tdSpawnStart');
    if (countEl) countEl.addEventListener('input', () => { spawner.count = +countEl.value; sync(); });
    if (intervalEl) intervalEl.addEventListener('input', () => { spawner.interval = +intervalEl.value; sync(); });
    if (startBtn) startBtn.addEventListener('click', () => { spawner.remaining = spawner.count; spawner.timer = 0; });
    function sync() {
        const cv = document.getElementById('tdSpawnCountVal'); if (cv) cv.textContent = spawner.count;
        const iv = document.getElementById('tdSpawnIntervalVal'); if (iv) iv.textContent = spawner.interval.toFixed(2) + ' s';
    }
    sync();

    function update(dt) {
        if (spawner.remaining > 0) {
            spawner.timer -= dt;
            if (spawner.timer <= 0) {
                spawner.timer = spawner.interval;
                spawner.remaining--;
                creeps.push(new TDEnemy(path, { speed: spawner.speed }));
            }
        }
        for (const c of creeps) c.update(dt);
        for (let i = creeps.length - 1; i >= 0; i--) {
            if (creeps[i].leaked) leaked++;
            if (!creeps[i].alive) creeps.splice(i, 1);
        }
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawGrid(ctx, grid);
        tdDrawPath(ctx, path, { grid });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        const msg = spawner.remaining > 0
            ? 'Spawning… ' + (spawner.count - spawner.remaining) + '/' + spawner.count
            : (leaked ? leaked + ' reached the goal — press Start Wave' : 'Press Start Wave');
        tdDrawHUD(ctx, grid, { wave: 1, msg });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 4) towerDemo — range + target acquisition + fire-rate (hitscan)
// =============================================================================
(function towerDemo() {
    const canvas = document.getElementById('tdTowerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);
    const pointer = tdInstallPointer(canvas);

    // One tower, placed on a buildable tile near the lane. Click another buildable
    // tile to relocate it — so you can feel how RANGE and the FIRST-target rule
    // interact with the lane's shape.
    let tower = new TDTower(...centerOf(7, 5), { range: 120, fireRate: 2, damage: 1 });
    function centerOf(col, row) { const p = grid.cellCenter(col, row); return [p.x, p.y]; }

    const rangeEl = document.getElementById('tdTowerRange');
    const rateEl = document.getElementById('tdTowerRate');
    if (rangeEl) rangeEl.addEventListener('input', () => { tower.range = +rangeEl.value; setVal('tdTowerRangeVal', tower.range + ' px'); });
    if (rateEl) rateEl.addEventListener('input', () => { tower.fireRate = +rateEl.value; setVal('tdTowerRateVal', tower.fireRate.toFixed(1) + '/s'); });
    function setVal(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

    const creeps = [];
    const beams = [];          // brief hitscan flashes: { from, to, life }
    let spawnTimer = 0;
    function update(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnTimer = 1.0; creeps.push(new TDEnemy(path, { speed: 75, hp: 4 })); }

        // place: click a buildable tile to move the tower there
        if (pointer.justPressed && pointer.inside) {
            const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            if (c && grid.isBuildable(c.col, c.row)) {
                const p = grid.cellCenter(c.col, c.row);
                tower = new TDTower(p.x, p.y, { range: tower.range, fireRate: tower.fireRate, damage: tower.damage });
            }
        }

        for (const c of creeps) c.update(dt);
        const fired = tower.update(dt, creeps);     // returns the target if it fired
        if (fired) { fired.damage(tower.damage); beams.push({ fx: tower.x, fy: tower.y, tx: fired.x, ty: fired.y, life: 0.09, max: 0.09 }); }

        for (let i = beams.length - 1; i >= 0; i--) { beams[i].life -= dt; if (beams[i].life <= 0) beams.splice(i, 1); }
        for (let i = creeps.length - 1; i >= 0; i--) if (!creeps[i].alive) creeps.splice(i, 1);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = pointer.inside ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { hover });
        tdDrawPath(ctx, path, { grid });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        // hitscan beams
        for (const b of beams) {
            ctx.save(); ctx.globalAlpha = b.life / b.max;
            ctx.strokeStyle = TD.proj; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(b.fx, b.fy); ctx.lineTo(b.tx, b.ty); ctx.stroke();
            ctx.restore();
        }
        tdDrawRange(ctx, tower.x, tower.y, tower.range);
        tdDrawTower(ctx, tower);
        tdDrawHUD(ctx, grid, { msg: 'Click a green tile to move the tower · it shoots the FIRST creep in range' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 5) projectileDemo — the shot travels, hits, deals damage
// =============================================================================
(function projectileDemo() {
    const canvas = document.getElementById('tdProjectileCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);

    const tower = new TDTower(...(() => { const p = grid.cellCenter(7, 5); return [p.x, p.y]; })(), { range: 130, fireRate: 1.6, damage: 2, projSpeed: 220 });
    let projSpeed = 220;
    const speedEl = document.getElementById('tdProjSpeed');
    if (speedEl) speedEl.addEventListener('input', () => { projSpeed = +speedEl.value; const v = document.getElementById('tdProjSpeedVal'); if (v) v.textContent = projSpeed + ' px/s'; });

    const creeps = [];
    const shots = [];
    const pops = [];
    let spawnTimer = 0;
    function update(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnTimer = 1.1;
            // alternate a normal creep and a FAST one, so a slow shot visibly struggles
            const fast = creeps.length % 2 === 1;
            creeps.push(new TDEnemy(path, { speed: fast ? 150 : 70, hp: 5, color: fast ? TD.enemyFast : TD.enemy }));
        }
        for (const c of creeps) c.update(dt);
        const fired = tower.update(dt, creeps);
        if (fired) shots.push(new TDProjectile(tower.x, tower.y, fired, { speed: projSpeed, damage: tower.damage }));
        for (const s of shots) {
            const targetWasAlive = s.target && s.target.alive;
            s.update(dt);
            // shot just landed AND its target is now dead → it scored the kill: pop.
            if (!s.alive && targetWasAlive && !s.target.alive) {
                pops.push({ x: s.target.x, y: s.target.y, r: 12, life: 0.25, max: 0.25, color: TD.proj });
            }
        }
        for (let i = shots.length - 1; i >= 0; i--) if (!shots[i].alive) shots.splice(i, 1);
        for (let i = creeps.length - 1; i >= 0; i--) if (!creeps[i].alive) creeps.splice(i, 1);
        for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawGrid(ctx, grid);
        tdDrawPath(ctx, path, { grid });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const p of pops) tdDrawPop(ctx, p);
        tdDrawRange(ctx, tower.x, tower.y, tower.range);
        tdDrawTower(ctx, tower);
        tdDrawHUD(ctx, grid, { msg: 'Slow shots can miss the orange (fast) creeps — that’s why the next tier LEADS the target' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 6) miniProject — "First Line of Defense": place towers, survive a wave
// =============================================================================
(function miniProject() {
    const canvas = document.getElementById('tdMiniCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pointer = tdInstallPointer(canvas);
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);
    const TOWER_COST = 40;

    let towers, creeps, shots, pops, gold, lives, spawner, status;
    function reset() {
        grid.clearOccupancy();
        towers = []; creeps = []; shots = []; pops = [];
        gold = 120; lives = 10; status = 'build';
        spawner = { remaining: 0, interval: 0.65, timer: 0, count: 14, speed: 78 };
    }
    reset();

    const startBtn = document.getElementById('tdMiniStart');
    const resetBtn = document.getElementById('tdMiniReset');
    if (startBtn) startBtn.addEventListener('click', () => {
        if (status === 'build' || status === 'won' || status === 'lost') {
            if (status !== 'build') reset();
            spawner.remaining = spawner.count; status = 'wave';
        }
    });
    if (resetBtn) resetBtn.addEventListener('click', reset);

    function update(dt) {
        // PLACE a tower on click (any time): a buildable tile + enough gold.
        if (pointer.justPressed && pointer.inside) {
            const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            if (c && grid.isBuildable(c.col, c.row) && gold >= TOWER_COST) {
                const p = grid.cellCenter(c.col, c.row);
                towers.push(new TDTower(p.x, p.y, { range: 115, fireRate: 1.8, damage: 2, projSpeed: 260, cost: TOWER_COST }));
                grid.occupy(c.col, c.row, true);
                gold -= TOWER_COST;
            }
        }

        if (status === 'wave') {
            if (spawner.remaining > 0) {
                spawner.timer -= dt;
                if (spawner.timer <= 0) { spawner.timer = spawner.interval; spawner.remaining--; creeps.push(new TDEnemy(path, { speed: spawner.speed, hp: 6, bounty: 6 })); }
            }
            for (const c of creeps) c.update(dt);
            for (const t of towers) { const fired = t.update(dt, creeps); if (fired) shots.push(new TDProjectile(t.x, t.y, fired, { speed: t.projSpeed, damage: t.damage, color: t.color })); }
            for (const s of shots) s.update(dt);

            // resolve deaths & leaks → gold & lives
            for (let i = creeps.length - 1; i >= 0; i--) {
                const c = creeps[i];
                if (c.leaked) { lives--; pops.push({ x: c.x, y: c.y, r: 13, life: 0.3, max: 0.3, color: TD.bad }); creeps.splice(i, 1); continue; }
                if (!c.alive) { gold += c.bounty; pops.push({ x: c.x, y: c.y, r: 12, life: 0.25, max: 0.25, color: TD.towerGold }); creeps.splice(i, 1); }
            }
            for (let i = shots.length - 1; i >= 0; i--) if (!shots[i].alive) shots.splice(i, 1);

            // win / lose
            if (lives <= 0) { status = 'lost'; }
            else if (spawner.remaining === 0 && creeps.length === 0) { status = 'won'; }
        }
        for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
        pointer.endFrame();
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = (status !== 'lost' && pointer.inside) ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { hover });
        tdDrawPath(ctx, path, { grid });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const t of towers) tdDrawTower(ctx, t);
        for (const p of pops) tdDrawPop(ctx, p);
        // show range on hover over an existing tower
        if (pointer.inside) {
            const hc = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            if (hc) { const t = towers.find((t) => grid.worldToCell(t.x, t.y).col === hc.col && grid.worldToCell(t.x, t.y).row === hc.row); if (t) tdDrawRange(ctx, t.x, t.y, t.range); }
        }
        const msg = status === 'build' ? 'Place towers (● ' + TOWER_COST + ' each), then Start Wave'
            : status === 'wave' ? 'Hold the line!'
            : status === 'won' ? '✅ Wave cleared — you held the line!'
            : '💥 The base fell — press Start to try again';
        tdDrawHUD(ctx, grid, { lives: Math.max(0, lives), gold, wave: 1, waves: 1, msg });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();
