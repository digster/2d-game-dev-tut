// =============================================================================
// TOWER DEFENSE — INTERMEDIATE TIER DEMOS ("Tower Types & Targeting")
// =============================================================================
// Seven demos, each an IIFE that early-returns if its canvas is absent:
//   1. typesDemo     — "a tower is just data": swap one tower's spec live
//   2. targetingDemo — the strategy slot: first/last/closest/strongest/weakest
//   3. leadDemo      — lead-the-target: solve the intercept quadratic (the trig payoff)
//   4. splashDemo    — splash (AoE) towers: one shot, many creeps
//   5. slowDemo      — frost towers: a timed slow + the slow→DPS synergy
//   6. splineDemo    — smooth spline lanes you can drag into shape (Catmull-Rom)
//   7. chokePoint    — Mini-project: hold a curved lane with a mix of kinds + modes
//
// DEPENDENCIES (loaded BEFORE this file):
//   ../shared/utils.js — Vector2D, clamp, clearCanvas
//   engine/loop.js     — tdLoop, tdInstallPointer
//   engine/render.js   — TD palette + tdDraw* + tdDrawPop
//   engine/world.js    — TDGrid, TDPath
//   engine/entities.js — TDEnemy, TDTower, TDProjectile, tdPickTarget, tdLeadPoint
//
// The ENTITY MODEL is the engine's now (this tier was its 2nd consumer — the move
// that promoted it). What this tier OWNS is the *content* on top: the tower ROSTER
// (below) and the lessons in each demo. The small map helpers are re-declared here
// (the "each tier file is self-contained" rule) — they're separate <script> globals
// from the Beginner copy because only one tier's demos load per page.
// =============================================================================

// The lane (shared by the straight-lane lessons), as [col,row] cells.
const TD_LANE_CELLS = [[-1, 1], [4, 1], [4, 5], [10, 5], [10, 1], [15, 1], [15, 7], [19, 7]];

function tdLaneThrough(grid, cells, opts = {}) {
    const pts = cells.map(([c, r]) => grid.cellCenter(c, r));
    const path = new TDPath(pts, { smooth: opts.smooth ?? false, samplesPerSeg: opts.samplesPerSeg ?? 18 });
    grid.blockAlongPath(path, opts.pad ?? 0);
    return path;
}
function tdRunWhenVisible(canvas, loop) {
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) e.isIntersecting ? loop.start() : loop.stop();
    }, { threshold: 0.01 });
    io.observe(canvas);
    return loop;
}

// --- THE TOWER ROSTER (the tier's content — towers ARE data) -----------------
// Each kind is a plain spec object. A TDTower is built by handing it one — that's
// the whole "data-driven" idea: behaviour is a table, not a subclass.
const TD_TOWER_TYPES = {
    gun:    { kind: 'gun',    label: 'Gun',    color: TD.tower,     range: 115, fireRate: 1.8, damage: 2, projSpeed: 280, cost: 40 },
    sniper: { kind: 'sniper', label: 'Sniper', color: TD.towerGold, range: 205, fireRate: 0.6, damage: 8, projSpeed: 520, cost: 70 },
    rapid:  { kind: 'rapid',  label: 'Rapid',  color: TD.accent,    range: 95,  fireRate: 5.0, damage: 1, projSpeed: 340, cost: 50 },
    splash: { kind: 'splash', label: 'Splash', color: TD.towerGun,  range: 115, fireRate: 1.1, damage: 2, projSpeed: 240, cost: 60, splash: 40 },
    frost:  { kind: 'frost',  label: 'Frost',  color: TD.towerSlow, range: 120, fireRate: 1.2, damage: 1, projSpeed: 300, cost: 55, slow: { factor: 0.45, duration: 1.6 } },
};
function tdMakeTower(x, y, type, extra = {}) { return new TDTower(x, y, Object.assign({}, type, extra)); }

// A crosshair reticle to mark a tower's chosen target / aim point.
function tdDrawReticle(ctx, x, y, r, color) {
    ctx.save();
    ctx.strokeStyle = color || TD.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TD.TAU); ctx.stroke();
    ctx.beginPath();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        ctx.moveTo(x + dx * (r - 4), y + dy * (r - 4));
        ctx.lineTo(x + dx * (r + 5), y + dy * (r + 5));
    }
    ctx.stroke();
    ctx.restore();
}
// Small helper: set a control's value label text.
function tdSetText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }

// =============================================================================
// 1) typesDemo — "a tower is just data"
// =============================================================================
(function typesDemo() {
    const canvas = document.getElementById('tdTypesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);
    const spot = grid.cellCenter(7, 6);

    let tower = tdMakeTower(spot.x, spot.y, TD_TOWER_TYPES.gun);
    function select(key) {
        tower = tdMakeTower(spot.x, spot.y, TD_TOWER_TYPES[key]);
        const t = TD_TOWER_TYPES[key];
        tdSetText('tdTypesInfo', `${t.label}: range ${t.range} · ${t.fireRate.toFixed(1)} shots/s · ${t.damage} dmg · cost ●${t.cost}`);
    }
    [['tdTypesGun', 'gun'], ['tdTypesSniper', 'sniper'], ['tdTypesRapid', 'rapid']].forEach(([id, key]) => {
        const b = document.getElementById(id); if (b) b.addEventListener('click', () => select(key));
    });
    select('gun');

    const creeps = []; const shots = []; const pops = [];
    let spawnTimer = 0;
    function update(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnTimer = 0.9; creeps.push(new TDEnemy(path, { speed: 72, hp: 6 })); }
        for (const c of creeps) c.update(dt);
        const fired = tower.update(dt, creeps);
        if (fired) shots.push(new TDProjectile(tower.x, tower.y, { target: fired, speed: tower.projSpeed, damage: tower.damage, color: tower.color }));
        for (const s of shots) { const was = s.target && s.target.alive; s.update(dt); if (!s.alive && was && !s.target.alive) pops.push({ x: s.target.x, y: s.target.y, r: 11, life: 0.22, max: 0.22, color: tower.color }); }
        prune(creeps); prune(shots); tickPops(pops, dt);
    }
    function render() {
        base(ctx, canvas, grid, path);
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const p of pops) tdDrawPop(ctx, p);
        tdDrawRange(ctx, tower.x, tower.y, tower.range);
        tdDrawTower(ctx, tower);
        tdDrawHUD(ctx, grid, { msg: 'Same tower object, different spec — behaviour is data, not code' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 2) targetingDemo — the strategy slot (first/last/closest/strongest/weakest)
// =============================================================================
(function targetingDemo() {
    const canvas = document.getElementById('tdTargetCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);
    // A wide-range tower that does NOT shoot — it only SELECTS, so you can watch the
    // reticle jump between creeps as the mode changes (selection is the lesson here).
    const tower = tdMakeTower(...xy(grid.cellCenter(10, 5)), TD_TOWER_TYPES.sniper);
    tower.range = 240;
    let mode = 'first';

    [['tdTargetFirst', 'first'], ['tdTargetLast', 'last'], ['tdTargetClosest', 'closest'], ['tdTargetStrongest', 'strongest'], ['tdTargetWeakest', 'weakest']].forEach(([id, m]) => {
        const b = document.getElementById(id); if (b) b.addEventListener('click', () => { mode = m; tdSetText('tdTargetInfo', 'Mode: ' + m); highlight(id); });
    });
    function highlight(activeId) {
        ['tdTargetFirst', 'tdTargetLast', 'tdTargetClosest', 'tdTargetStrongest', 'tdTargetWeakest'].forEach((id) => {
            const b = document.getElementById(id); if (b) b.style.outline = id === activeId ? '2px solid #4fc3f7' : 'none';
        });
    }
    tdSetText('tdTargetInfo', 'Mode: first');
    highlight('tdTargetFirst');

    const creeps = []; let spawnTimer = 0, hpCycle = 0;
    const hps = [3, 9, 5, 7, 4];
    function update(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnTimer = 1.4; const hp = hps[hpCycle++ % hps.length]; creeps.push(new TDEnemy(path, { speed: 55, hp, maxHp: 9 })); }
        for (const c of creeps) c.update(dt);
        prune(creeps);
    }
    function render() {
        base(ctx, canvas, grid, path);
        for (const c of creeps) tdDrawEnemy(ctx, c);
        tdDrawRange(ctx, tower.x, tower.y, tower.range, { fill: 'rgba(124,242,200,0.05)' });
        tdDrawTower(ctx, tower);
        const picked = tdPickTarget(tower, creeps, mode);
        if (picked) { tdDrawReticle(ctx, picked.x, picked.y, picked.radius + 7, TD.accent); tower.angle = Math.atan2(picked.y - tower.y, picked.x - tower.x); }
        tdDrawHUD(ctx, grid, { msg: 'The reticle = the creep this mode would shoot. HP bars vary so "strongest/weakest" differ.' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 3) leadDemo — lead-the-target (the intercept quadratic)
// =============================================================================
(function leadDemo() {
    const canvas = document.getElementById('tdLeadCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);
    const tower = tdMakeTower(...xy(grid.cellCenter(7, 6)), TD_TOWER_TYPES.gun);
    tower.range = 280; tower.fireRate = 1.6; tower.projSpeed = 210; tower.lead = false;

    // One fast, effectively-immortal creep that loops the lane, so we can watch shots
    // hit or trail behind without the target dying.
    let runner = new TDEnemy(path, { speed: 120, hp: 1e9, color: TD.enemyFast });
    let hits = 0, fires = 0;

    const toggle = document.getElementById('tdLeadToggle');
    if (toggle) toggle.addEventListener('click', () => { tower.lead = !tower.lead; toggle.textContent = tower.lead ? 'Lead: ON' : 'Lead: OFF'; hits = 0; fires = 0; });
    const speedEl = document.getElementById('tdLeadSpeed');
    if (speedEl) speedEl.addEventListener('input', () => { tower.projSpeed = +speedEl.value; tdSetText('tdLeadSpeedVal', tower.projSpeed + ' px/s'); hits = 0; fires = 0; });

    const shots = [];
    function update(dt) {
        if (!runner.alive) runner = new TDEnemy(path, { speed: 120, hp: 1e9, color: TD.enemyFast });
        runner.update(dt);
        const fired = tower.update(dt, [runner]);
        if (fired) {
            fires++;
            // ballistic shot toward the aim point the tower computed (lead point or "now")
            shots.push(new TDProjectile(tower.x, tower.y, { target: runner, speed: tower.projSpeed, homing: false, aim: tower.aim.copy(), damage: 1, color: tower.lead ? TD.good : TD.warn }));
        }
        for (const s of shots) { const pre = s.target.hp; s.update(dt); if (!s.alive && s.target.hp < pre) hits++; }
        prune(shots);
    }
    function render() {
        base(ctx, canvas, grid, path);
        tdDrawEnemy(ctx, runner);
        for (const s of shots) tdDrawProjectile(ctx, s);
        tdDrawRange(ctx, tower.x, tower.y, tower.range, { fill: 'rgba(124,242,200,0.04)' });
        // the aim line + (when leading) the predicted intercept reticle
        if (tower.aim) {
            ctx.save(); ctx.strokeStyle = tower.lead ? TD.good : TD.warn; ctx.globalAlpha = 0.6; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(tower.x, tower.y); ctx.lineTo(tower.aim.x, tower.aim.y); ctx.stroke();
            ctx.restore();
            if (tower.lead) tdDrawReticle(ctx, tower.aim.x, tower.aim.y, 9, TD.good);
        }
        tdDrawTower(ctx, tower);
        const acc = fires ? Math.round(100 * hits / fires) : 0;
        tdDrawHUD(ctx, grid, { msg: (tower.lead ? 'LEADING — aim at the intercept point' : 'NO LEAD — aim at where it is now') + '  ·  hit rate ' + acc + '%  (' + hits + '/' + fires + ')' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 4) splashDemo — splash (AoE) towers
// =============================================================================
(function splashDemo() {
    const canvas = document.getElementById('tdSplashCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);
    const tower = tdMakeTower(...xy(grid.cellCenter(10, 6)), TD_TOWER_TYPES.splash);
    let splashOn = true;

    const toggle = document.getElementById('tdSplashToggle');
    if (toggle) toggle.addEventListener('click', () => { splashOn = !splashOn; toggle.textContent = splashOn ? 'Splash: ON' : 'Splash: OFF'; });
    const radEl = document.getElementById('tdSplashRadius');
    if (radEl) radEl.addEventListener('input', () => { TD_TOWER_TYPES.splash.splash = +radEl.value; tdSetText('tdSplashRadiusVal', radEl.value + ' px'); });

    const creeps = []; const shots = []; const pops = [];
    let burstTimer = 0;
    function update(dt) {
        burstTimer -= dt;
        if (burstTimer <= 0) { burstTimer = 2.0; for (let i = 0; i < 4; i++) creeps.push(new TDEnemy(path, { speed: 60, hp: 3, dist: -i * 16 })); } // a tight cluster
        for (const c of creeps) c.update(dt);
        tower.splash = splashOn ? (+(radEl ? radEl.value : 40)) : 0;
        const fired = tower.update(dt, creeps);
        if (fired) shots.push(new TDProjectile(tower.x, tower.y, { target: fired, speed: tower.projSpeed, damage: tower.damage, color: tower.color, splash: tower.splash }));
        for (const s of shots) { s.update(dt, creeps); if (!s.alive && s.splash > 0) pops.push({ x: s.x, y: s.y, r: s.splash, life: 0.22, max: 0.22, color: TD.towerGun }); }
        prune(creeps); prune(shots); tickPops(pops, dt);
    }
    function render() {
        base(ctx, canvas, grid, path);
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const p of pops) tdDrawPop(ctx, p);
        tdDrawRange(ctx, tower.x, tower.y, tower.range);
        tdDrawTower(ctx, tower);
        tdDrawHUD(ctx, grid, { msg: splashOn ? 'Splash ON — one shot damages every creep in the blast ring' : 'Splash OFF — single target (watch the cluster survive)' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 5) slowDemo — frost towers & the slow → DPS synergy
// =============================================================================
(function slowDemo() {
    const canvas = document.getElementById('tdSlowCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS);
    const frost = tdMakeTower(...xy(grid.cellCenter(5, 5)), TD_TOWER_TYPES.frost);
    const gun = tdMakeTower(...xy(grid.cellCenter(11, 6)), TD_TOWER_TYPES.gun);

    const facEl = document.getElementById('tdSlowFactor');
    if (facEl) facEl.addEventListener('input', () => { TD_TOWER_TYPES.frost.slow.factor = +facEl.value; frost.slow.factor = +facEl.value; tdSetText('tdSlowFactorVal', Math.round(facEl.value * 100) + '% spd'); });
    const durEl = document.getElementById('tdSlowDur');
    if (durEl) durEl.addEventListener('input', () => { TD_TOWER_TYPES.frost.slow.duration = +durEl.value; frost.slow.duration = +durEl.value; tdSetText('tdSlowDurVal', (+durEl.value).toFixed(1) + ' s'); });

    const creeps = []; const shots = []; const pops = [];
    let spawnTimer = 0;
    function update(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnTimer = 1.1; creeps.push(new TDEnemy(path, { speed: 80, hp: 6 })); }
        for (const c of creeps) c.update(dt);
        for (const t of [frost, gun]) { const fired = t.update(dt, creeps); if (fired) shots.push(new TDProjectile(t.x, t.y, { target: fired, speed: t.projSpeed, damage: t.damage, color: t.color, slow: t.slow })); }
        for (const s of shots) { const was = s.target && s.target.alive; s.update(dt, creeps); if (!s.alive && was && !s.target.alive) pops.push({ x: s.x, y: s.y, r: 11, life: 0.22, max: 0.22, color: TD.towerGold }); }
        prune(creeps); prune(shots); tickPops(pops, dt);
    }
    function render() {
        base(ctx, canvas, grid, path);
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const p of pops) tdDrawPop(ctx, p);
        for (const t of [frost, gun]) { tdDrawRange(ctx, t.x, t.y, t.range, { fill: 'rgba(124,242,200,0.04)' }); tdDrawTower(ctx, t); }
        tdDrawHUD(ctx, grid, { msg: 'Frost (teal) chills creeps; the Gun gets more shots on a slowed target — slow IS damage' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 6) splineDemo — drag the lane into shape (Catmull-Rom)
// =============================================================================
(function splineDemo() {
    const canvas = document.getElementById('tdSplineCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pointer = tdInstallPointer(canvas);
    const grid = new TDGrid(19, 9, 40, 0, 0);
    // Control points in canvas pixels; the ends sit just off the edges.
    const defaults = () => [{ x: -10, y: 120 }, { x: 180, y: 60 }, { x: 360, y: 280 }, { x: 560, y: 90 }, { x: 770, y: 230 }];
    let ctrl = defaults();
    let path = new TDPath(ctrl, { smooth: true, samplesPerSeg: 20 });
    const creeps = []; let spawnTimer = 0, drag = -1;

    const resetBtn = document.getElementById('tdSplineReset');
    if (resetBtn) resetBtn.addEventListener('click', () => { ctrl = defaults(); rebuild(); });
    function rebuild() { path = new TDPath(ctrl, { smooth: true, samplesPerSeg: 20 }); for (const c of creeps) c.path = path; }

    function update(dt) {
        // grab the nearest handle on press; drag it; rebuild the lane live
        if (pointer.justPressed) {
            drag = -1; let best = 18 * 18;
            for (let i = 0; i < ctrl.length; i++) { const dx = ctrl[i].x - pointer.pos.x, dy = ctrl[i].y - pointer.pos.y; const d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; drag = i; } }
        }
        if (pointer.isDown && drag >= 0) { ctrl[drag].x = clamp(pointer.pos.x, -20, canvas.width + 20); ctrl[drag].y = clamp(pointer.pos.y, 6, canvas.height - 6); rebuild(); }
        if (pointer.justReleased) drag = -1;

        spawnTimer -= dt;
        if (spawnTimer <= 0 && creeps.length < 8) { spawnTimer = 0.8; creeps.push(new TDEnemy(path, { speed: 90, hp: 5 })); }
        for (const c of creeps) c.update(dt);
        prune(creeps);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawGrid(ctx, grid);
        // faint raw control polyline behind the smooth lane
        ctx.save(); ctx.strokeStyle = TD.dim; ctx.globalAlpha = 0.5; ctx.setLineDash([4, 4]); ctx.beginPath();
        ctx.moveTo(ctrl[0].x, ctrl[0].y); for (let i = 1; i < ctrl.length; i++) ctx.lineTo(ctrl[i].x, ctrl[i].y); ctx.stroke(); ctx.restore();
        tdDrawPath(ctx, path, { width: 22 });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (let i = 0; i < ctrl.length; i++) { ctx.beginPath(); ctx.arc(ctrl[i].x, ctrl[i].y, 7, 0, TD.TAU); ctx.fillStyle = (i === drag) ? TD.accent : TD.towerGold; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0c1024'; ctx.stroke(); }
        tdDrawHUD(ctx, grid, { msg: 'Drag the gold handles — the Catmull-Rom lane re-smooths and creeps follow the new curve' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 7) chokePoint — Mini-project: hold a curved lane with a mix
// =============================================================================
(function chokePoint() {
    const canvas = document.getElementById('tdChokeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pointer = tdInstallPointer(canvas);
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const path = tdLaneThrough(grid, TD_LANE_CELLS, { smooth: true });

    let towers, creeps, shots, pops, gold, lives, spawner, status, selKind, mode;
    function reset() {
        grid.clearOccupancy();
        towers = []; creeps = []; shots = []; pops = [];
        gold = 220; lives = 12; status = 'build'; selKind = 'gun'; mode = 'first';
        spawner = { remaining: 0, queue: [], timer: 0, interval: 0.6 };
        syncShop();
    }
    function buildWave() {
        // a mixed wave: normals, a couple of fast, a couple of tanks
        const q = [];
        for (let i = 0; i < 10; i++) q.push({ speed: 70, hp: 6, color: TD.enemy, bounty: 6 });
        for (let i = 0; i < 4; i++) q.push({ speed: 130, hp: 4, color: TD.enemyFast, bounty: 7, radius: 7 });
        for (let i = 0; i < 3; i++) q.push({ speed: 45, hp: 22, color: TD.enemyTank, bounty: 12, radius: 12 });
        // ordered escalation: normals → fast → tanks (a fixed, reproducible wave)
        return q;
    }

    const shopIds = { gun: 'tdChokeGun', sniper: 'tdChokeSniper', splash: 'tdChokeSplash', frost: 'tdChokeFrost' };
    Object.entries(shopIds).forEach(([k, id]) => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { selKind = k; syncShop(); }); });
    const modeIds = { first: 'tdChokeFirst', strongest: 'tdChokeStrong', closest: 'tdChokeClose' };
    Object.entries(modeIds).forEach(([m, id]) => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { mode = m; for (const t of towers) t.targeting = m; syncShop(); }); });
    function syncShop() {
        Object.entries(shopIds).forEach(([k, id]) => { const b = document.getElementById(id); if (b) b.style.outline = (k === selKind) ? '2px solid #4fc3f7' : 'none'; });
        Object.entries(modeIds).forEach(([m, id]) => { const b = document.getElementById(id); if (b) b.style.outline = (m === mode) ? '2px solid #4fc3f7' : 'none'; });
    }
    const startBtn = document.getElementById('tdChokeStart');
    if (startBtn) startBtn.addEventListener('click', () => { if (status === 'build' || status === 'won' || status === 'lost') { if (status !== 'build') reset(); spawner.queue = buildWave(); spawner.remaining = spawner.queue.length; status = 'wave'; } });
    const resetBtn = document.getElementById('tdChokeReset');
    if (resetBtn) resetBtn.addEventListener('click', reset);
    reset();

    function update(dt) {
        // place the selected tower kind if affordable
        if (pointer.justPressed && pointer.inside && status !== 'lost') {
            const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            const type = TD_TOWER_TYPES[selKind];
            if (c && grid.isBuildable(c.col, c.row) && gold >= type.cost) {
                const p = grid.cellCenter(c.col, c.row);
                towers.push(tdMakeTower(p.x, p.y, type, { targeting: mode }));
                grid.occupy(c.col, c.row, true); gold -= type.cost;
            }
        }
        if (status === 'wave') {
            if (spawner.remaining > 0) {
                spawner.timer -= dt;
                if (spawner.timer <= 0) { spawner.timer = spawner.interval; const spec = spawner.queue[spawner.queue.length - spawner.remaining]; spawner.remaining--; creeps.push(new TDEnemy(path, spec)); }
            }
            for (const c of creeps) c.update(dt);
            for (const t of towers) { const fired = t.update(dt, creeps); if (fired) shots.push(new TDProjectile(t.x, t.y, { target: fired, speed: t.projSpeed, damage: t.damage, color: t.color, splash: t.splash, slow: t.slow })); }
            for (const s of shots) s.update(dt, creeps);
            for (let i = creeps.length - 1; i >= 0; i--) {
                const c = creeps[i];
                if (c.leaked) { lives--; pops.push({ x: c.x, y: c.y, r: 13, life: 0.3, max: 0.3, color: TD.bad }); creeps.splice(i, 1); continue; }
                if (!c.alive) { gold += c.bounty; pops.push({ x: c.x, y: c.y, r: 11, life: 0.22, max: 0.22, color: TD.towerGold }); creeps.splice(i, 1); }
            }
            prune(shots);
            if (lives <= 0) status = 'lost';
            else if (spawner.remaining === 0 && creeps.length === 0) status = 'won';
        }
        tickPops(pops, dt);
        pointer.endFrame();
    }
    function render() {
        const hover = (pointer.inside && status !== 'lost') ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        base(ctx, canvas, grid, path, hover);
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const t of towers) tdDrawTower(ctx, t);
        for (const p of pops) tdDrawPop(ctx, p);
        // hover preview: the selected kind's range + cost feedback
        if (pointer.inside && status !== 'lost') {
            const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            if (c && grid.isBuildable(c.col, c.row)) { const p = grid.cellCenter(c.col, c.row); tdDrawRange(ctx, p.x, p.y, TD_TOWER_TYPES[selKind].range, { fill: 'rgba(124,242,200,0.05)' }); }
        }
        const left = status === 'wave' ? (spawner.remaining + creeps.length) : 0;
        const msg = status === 'build' ? `Buy: ${TD_TOWER_TYPES[selKind].label} (●${TD_TOWER_TYPES[selKind].cost}) · mode: ${mode} · place, then Start`
            : status === 'wave' ? `Hold! ${left} creeps left` : status === 'won' ? '✅ Choke held — wave cleared!' : '💥 Overrun — press Start to retry';
        tdDrawHUD(ctx, grid, { lives: Math.max(0, lives), gold, wave: 1, waves: 1, msg });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// --- tiny shared helpers (tier-local) ---------------------------------------
function xy(p) { return [p.x, p.y]; }
function base(ctx, canvas, grid, path, hover) {
    clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
    tdDrawGround(ctx, grid);
    tdDrawGrid(ctx, grid, hover ? { hover } : {});
    tdDrawPath(ctx, path, { grid });
}
function prune(arr) { for (let i = arr.length - 1; i >= 0; i--) if (!arr[i].alive) arr.splice(i, 1); }
function tickPops(pops, dt) { for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); } }
