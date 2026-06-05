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
//   ../shared/utils.js   — Vector2D, clamp, clearCanvas (globals)
//   engine/loop.js       — tdLoop, tdInstallPointer (window)
//   engine/render.js     — TD palette + tdDraw* + tdDrawPop (window)
//   engine/world.js      — TDGrid, TDPath (window)
//   engine/entities.js   — TDEnemy, TDTower, TDProjectile, tdPickTarget (window)
//
// THE ENTITY MODEL was taught inline in this tier originally; once the Intermediate
// tier became its 2nd consumer it was PROMOTED to engine/entities.js (the repo's
// "promote on the 2nd consumer" rule), so this file consumes it rather than
// declaring it. The classes still read exactly as this tier needs them — a plain
// tower is the Beginner gun; the later tiers switch on its optional knobs.
//
// ⚠️  Vector2D mutates in place: `add`/`multiply`/`normalize`/`set` change `this`;
//   only `subtract`/`copy` return new.
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

// THE ENTITY MODEL (TDEnemy / TDTower / TDProjectile + tdPickTarget) was taught
// inline here originally; the Intermediate tier became its 2nd consumer, so it was
// PROMOTED to engine/entities.js (loaded above) and is no longer declared in this
// file — a 2nd `class TDTower` on the page would be a redeclaration error. The
// cosmetic tdDrawPop likewise lives in engine/render.js now. The classes work
// exactly as this tier uses them (a plain tower is a Beginner gun); the engine copy
// just *adds* optional capabilities (slow, lead, splash) the later tiers switch on.

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
        if (fired) shots.push(new TDProjectile(tower.x, tower.y, { target: fired, speed: projSpeed, damage: tower.damage }));
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
            for (const t of towers) { const fired = t.update(dt, creeps); if (fired) shots.push(new TDProjectile(t.x, t.y, { target: fired, speed: t.projSpeed, damage: t.damage, color: t.color })); }
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
