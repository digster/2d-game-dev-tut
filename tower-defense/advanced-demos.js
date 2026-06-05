// =============================================================================
// TOWER DEFENSE — ADVANCED TIER DEMOS ("Mazing, Flow Fields & Sight")
// =============================================================================
// The flagship tier: the creeps get a BRAIN. Six demos:
//   1. astarDemo  — A* pathfinding on the grid (paint walls, watch it re-route)
//   2. mazeDemo   — towers as obstacles → creeps re-plan; the connectivity guard
//   3. losDemo    — line-of-sight: a wall blocks a tower's shot (raycast)
//   4. flowDemo   — a Dijkstra flow field (cost heatmap + downhill vectors)
//   5. crowdDemo  — one field, a whole crowd (the Bloons-style open field)
//   6. mazeProject— Mini-project "Build Your Maze": a maze-TD with economy
//
// THE NAVIGATION ALGORITHMS (tdWalkable / tdAStar / tdBlocksPath / tdFlowField /
// tdLineOfSight) were taught inline here originally; the Expert "Swarm" tier became
// their 2nd consumer, so they were PROMOTED to engine/nav.js (loaded above) and are
// no longer declared in this file — they're on `window` now (still console-testable).
// The maze glue (tdAStarPath) and the open-field creep model stay here as this
// tier's content.
//
// DEPENDENCIES: ../shared/utils.js, engine/loop.js, engine/render.js,
//   engine/world.js, engine/entities.js, engine/nav.js.
// =============================================================================

// === tier-local helpers ======================================================
function tdRunWhenVisible(canvas, loop) {
    const io = new IntersectionObserver((es) => { for (const e of es) e.isIntersecting ? loop.start() : loop.stop(); }, { threshold: 0.01 });
    io.observe(canvas); return loop;
}
function tdCellEq(a, b) { return a && b && a.col === b.col && a.row === b.row; }
function tdMarker(ctx, grid, cell, color, label) {
    const p = grid.cellCenter(cell.col, cell.row);
    ctx.beginPath(); ctx.arc(p.x, p.y, grid.tile * 0.32, 0, TD.TAU); ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#0c1024'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
// Build a TDPath from an A* cell list; if `fromPos` is given the path starts at the
// creep's exact position (so a re-plan doesn't snap it to a cell centre).
function tdAStarPath(grid, startCell, goalCell, fromPos) {
    const cells = tdAStar(grid, startCell, goalCell);
    if (!cells) return null;
    let pts = fromPos
        ? [{ x: fromPos.x, y: fromPos.y }, ...cells.slice(1).map((c) => grid.cellCenter(c.col, c.row))]
        : cells.map((c) => grid.cellCenter(c.col, c.row));
    if (pts.length < 2) pts = [pts[0] || grid.cellCenter(startCell.col, startCell.row), grid.cellCenter(goalCell.col, goalCell.row)];
    return new TDPath(pts);
}
// Drag-to-paint walls on the grid (skips spawn/goal). Returns true if a cell changed.
function tdPaintWall(grid, pointer, protectCells) {
    if (!pointer.isDown || !pointer.inside) return false;
    const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
    if (!c) return false;
    if (protectCells.some((p) => tdCellEq(p, c))) return false;
    if (grid.isBlocked(c.col, c.row)) return false;
    grid.setBlocked(c.col, c.row, true);
    return true;
}
// Draw the cost heatmap and/or flow arrows of a field.
function tdDrawFlow(ctx, grid, field, opts = {}) {
    const { cols, rows, tile } = grid;
    if (opts.heat) {
        let maxC = 1;
        for (let i = 0; i < field.cost.length; i++) if (field.cost[i] !== Infinity && field.cost[i] > maxC) maxC = field.cost[i];
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
            const c = field.cost[row * cols + col];
            if (c === Infinity) continue;
            const t = c / maxC;                          // 0 at goal → 1 far away
            ctx.fillStyle = `rgba(${Math.round(60 + t * 30)},${Math.round(200 - t * 150)},${Math.round(150 - t * 60)},0.30)`;
            ctx.fillRect(grid.originX + col * tile, grid.originY + row * tile, tile, tile);
        }
    }
    if (opts.arrows) {
        ctx.strokeStyle = 'rgba(201,209,217,0.7)'; ctx.lineWidth = 1.5;
        for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
            const v = field.flow[row * cols + col];
            if (!v || (!v.x && !v.y)) continue;
            const cx = grid.originX + (col + 0.5) * tile, cy = grid.originY + (row + 0.5) * tile;
            const L = tile * 0.3, ex = cx + v.x * L, ey = cy + v.y * L, a = Math.atan2(v.y, v.x);
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
            ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(a - 0.4) * 4, ey - Math.sin(a - 0.4) * 4);
            ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(a + 0.4) * 4, ey - Math.sin(a + 0.4) * 4);
            ctx.stroke();
        }
    }
}
// A flow-field creep: NOT a path-follower — it steers by reading its cell's vector.
// This is the open-field movement model, kept inline as the lesson.
function tdMakeFlowCreep(x, y, opts = {}) {
    return { x, y, speed: opts.speed ?? 55, hp: opts.hp ?? 4, maxHp: opts.hp ?? 4, radius: opts.radius ?? 8, color: opts.color || TD.enemy, alive: true, done: false };
}
function tdStepFlowCreep(c, field, grid, dt) {
    const cell = grid.worldToCell(c.x, c.y);
    if (!cell) { c.alive = false; return; }
    const i = cell.row * grid.cols + cell.col;
    if (field.cost[i] === 0) { c.done = true; c.alive = false; return; }   // reached the goal
    const v = field.flow[i];
    if (v && (v.x || v.y)) { c.x += v.x * c.speed * dt; c.y += v.y * c.speed * dt; }
}

// =============================================================================
// 1) astarDemo — A* pathfinding (paint walls, watch it re-route)
// =============================================================================
(function astarDemo() {
    const canvas = document.getElementById('tdAstarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const pointer = tdInstallPointer(canvas);
    const spawn = { col: 0, row: 4 }, goal = { col: 18, row: 4 };
    let path = tdAStar(grid, spawn, goal);

    const clearBtn = document.getElementById('tdAstarClear');
    if (clearBtn) clearBtn.addEventListener('click', () => { grid.blocked.fill(0); path = tdAStar(grid, spawn, goal); });

    function update() {
        if (tdPaintWall(grid, pointer, [spawn, goal])) path = tdAStar(grid, spawn, goal);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = pointer.inside ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { tintBlocked: true, hover });
        if (path) {
            ctx.strokeStyle = TD.accent; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.beginPath();
            path.forEach((c, i) => { const p = grid.cellCenter(c.col, c.row); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
            ctx.stroke();
        }
        tdMarker(ctx, grid, spawn, TD.spawn, 'S');
        tdMarker(ctx, grid, goal, TD.goal, 'G');
        tdDrawHUD(ctx, grid, { msg: path ? 'Drag to paint walls — A* finds the shortest route (' + (path.length - 1) + ' steps)' : '⚠ No route! A* returned null' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 2) mazeDemo — towers as obstacles + the connectivity guard
// =============================================================================
(function mazeDemo() {
    const canvas = document.getElementById('tdMazeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const pointer = tdInstallPointer(canvas);
    const spawn = { col: 0, row: 4 }, goal = { col: 18, row: 4 };
    const creeps = [];
    let spawnTimer = 0, denyFlash = 0;

    const clearBtn = document.getElementById('tdMazeClear');
    if (clearBtn) clearBtn.addEventListener('click', () => { grid.clearOccupancy(); replanAll(); });

    function replanAll() { for (const c of creeps) { const cell = grid.worldToCell(c.x, c.y); if (cell) { const np = tdAStarPath(grid, cell, goal, c.pos); if (np) { c.path = np; c.dist = 0; } } } }

    function update(dt) {
        // place a "tower" (obstacle) on click — but the connectivity guard refuses
        // any placement that would seal the goal off.
        if (pointer.justPressed && pointer.inside) {
            const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            if (c && grid.isBuildable(c.col, c.row) && !tdCellEq(c, spawn) && !tdCellEq(c, goal)) {
                if (tdBlocksPath(grid, c.col, c.row, spawn, goal)) denyFlash = 0.6;
                else { grid.occupy(c.col, c.row, true); replanAll(); }
            }
        }
        spawnTimer -= dt;
        if (spawnTimer <= 0 && creeps.length < 10) {
            spawnTimer = 1.0;
            const path = tdAStarPath(grid, spawn, goal);
            if (path) creeps.push(new TDEnemy(path, { speed: 70, hp: 5 }));
        }
        for (const c of creeps) c.update(dt);
        for (let i = creeps.length - 1; i >= 0; i--) if (!creeps[i].alive) creeps.splice(i, 1);
        if (denyFlash > 0) denyFlash -= dt;
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = pointer.inside ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { hover });
        // draw towers (occupied cells) as blocks
        for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) if (grid.isOccupied(col, row)) tdDrawTower(ctx, { x: grid.cellCenter(col, row).x, y: grid.cellCenter(col, row).y, color: TD.tower, angle: -Math.PI / 2 });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        tdMarker(ctx, grid, spawn, TD.spawn, 'S');
        tdMarker(ctx, grid, goal, TD.goal, 'G');
        tdDrawHUD(ctx, grid, { msg: denyFlash > 0 ? '⛔ Can’t build there — it would seal the goal off!' : 'Click to place towers — creeps A*-re-route around them' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 3) losDemo — line-of-sight: a wall blocks the shot
// =============================================================================
(function losDemo() {
    const canvas = document.getElementById('tdLosCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const pointer = tdInstallPointer(canvas);
    const path = (function () { const pts = [[-1, 1], [4, 1], [4, 7], [14, 7], [14, 1], [19, 1]].map(([c, r]) => grid.cellCenter(c, r)); return new TDPath(pts); })();
    const tower = new TDTower(...(() => { const p = grid.cellCenter(9, 4); return [p.x, p.y]; })(), { range: 320, fireRate: 2, damage: 2 });
    const creeps = []; const shots = []; let spawnTimer = 0;

    const clearBtn = document.getElementById('tdLosClear');
    if (clearBtn) clearBtn.addEventListener('click', () => grid.blocked.fill(0));

    function update(dt) {
        const towerCell = grid.worldToCell(tower.x, tower.y);
        if (tdPaintWall(grid, pointer, [towerCell])) { /* walls only */ }
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnTimer = 1.4; creeps.push(new TDEnemy(path, { speed: 70, hp: 6 })); }
        for (const c of creeps) c.update(dt);
        // acquire a target, but only FIRE if the line of sight is clear
        const target = tdPickTarget(tower, creeps, 'first');
        tower.target = target;
        if (tower.cooldown > 0) tower.cooldown -= dt;
        if (target) {
            tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
            const clear = tdLineOfSight(grid, tower.x, tower.y, target.x, target.y);
            if (clear && tower.cooldown <= 0) { tower.cooldown = 1 / tower.fireRate; shots.push(new TDProjectile(tower.x, tower.y, { target, speed: 360, damage: tower.damage })); }
            tower._losClear = clear;
        } else tower._losClear = null;
        for (const s of shots) s.update(dt);
        for (let i = creeps.length - 1; i >= 0; i--) if (!creeps[i].alive) creeps.splice(i, 1);
        for (let i = shots.length - 1; i >= 0; i--) if (!shots[i].alive) shots.splice(i, 1);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = pointer.inside ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { tintBlocked: true, hover });
        tdDrawPath(ctx, path, { grid });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        // the sight line, coloured by whether a wall blocks it
        if (tower.target && tower._losClear !== null) {
            ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
            ctx.strokeStyle = tower._losClear ? TD.good : TD.bad;
            ctx.beginPath(); ctx.moveTo(tower.x, tower.y); ctx.lineTo(tower.target.x, tower.target.y); ctx.stroke();
            ctx.restore();
        }
        tdDrawRange(ctx, tower.x, tower.y, tower.range, { fill: 'rgba(124,242,200,0.04)' });
        tdDrawTower(ctx, tower);
        tdDrawHUD(ctx, grid, { msg: 'Drag to build a wall between the tower and the lane — it can’t shoot through it' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 4) flowDemo — a Dijkstra flow field (heatmap + downhill vectors)
// =============================================================================
(function flowDemo() {
    const canvas = document.getElementById('tdFlowCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const pointer = tdInstallPointer(canvas);
    const goal = { col: 18, row: 4 };
    let field = tdFlowField(grid, goal);
    let show = { heat: true, arrows: true };

    const clearBtn = document.getElementById('tdFlowClear');
    if (clearBtn) clearBtn.addEventListener('click', () => { grid.blocked.fill(0); field = tdFlowField(grid, goal); });
    const toggleBtn = document.getElementById('tdFlowToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', () => { show.heat = !show.heat; toggleBtn.textContent = show.heat ? 'Showing: Heatmap + Arrows' : 'Showing: Arrows only'; });

    const creeps = []; let spawnTimer = 0;
    function update(dt) {
        if (tdPaintWall(grid, pointer, [goal])) field = tdFlowField(grid, goal);
        spawnTimer -= dt;
        if (spawnTimer <= 0 && creeps.length < 6) { spawnTimer = 1.0; creeps.push(tdMakeFlowCreep(grid.cellCenter(0, Math.floor(Math.random() * grid.rows)).x, grid.cellCenter(0, Math.floor(Math.random() * grid.rows)).y, { speed: 60 })); }
        for (const c of creeps) tdStepFlowCreep(c, field, grid, dt);
        for (let i = creeps.length - 1; i >= 0; i--) if (!creeps[i].alive) creeps.splice(i, 1);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawFlow(ctx, grid, field, { heat: show.heat, arrows: true });
        const hover = pointer.inside ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { tintBlocked: true, hover });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        tdMarker(ctx, grid, goal, TD.goal, 'G');
        tdDrawHUD(ctx, grid, { msg: 'One sweep from the goal → every cell knows the way. Paint walls; the field re-flows.' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 5) crowdDemo — one field, a whole crowd (the open field)
// =============================================================================
(function crowdDemo() {
    const canvas = document.getElementById('tdCrowdCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const pointer = tdInstallPointer(canvas);
    const goal = { col: 18, row: 4 };
    let field = tdFlowField(grid, goal);
    let rate = 14;                                        // creeps per second

    const clearBtn = document.getElementById('tdCrowdClear');
    if (clearBtn) clearBtn.addEventListener('click', () => { grid.blocked.fill(0); field = tdFlowField(grid, goal); });
    const rateEl = document.getElementById('tdCrowdRate');
    if (rateEl) rateEl.addEventListener('input', () => { rate = +rateEl.value; const v = document.getElementById('tdCrowdRateVal'); if (v) v.textContent = rate + '/s'; });

    const creeps = []; let acc = 0;
    function update(dt) {
        if (tdPaintWall(grid, pointer, [goal])) field = tdFlowField(grid, goal);
        acc += rate * dt;
        while (acc >= 1 && creeps.length < 600) { acc -= 1; const r = Math.floor(Math.random() * grid.rows); const p = grid.cellCenter(0, r); creeps.push(tdMakeFlowCreep(p.x, p.y, { speed: 50 + Math.random() * 30, radius: 5 })); }
        for (const c of creeps) tdStepFlowCreep(c, field, grid, dt);
        for (let i = creeps.length - 1; i >= 0; i--) if (!creeps[i].alive) creeps.splice(i, 1);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        tdDrawFlow(ctx, grid, field, { heat: true, arrows: false });
        const hover = pointer.inside ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { tintBlocked: true, hover });
        for (const c of creeps) { ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, TD.TAU); ctx.fillStyle = c.color; ctx.fill(); }
        tdMarker(ctx, grid, goal, TD.goal, 'G');
        tdDrawHUD(ctx, grid, { msg: creeps.length + ' creeps · ONE field · paint walls to split the stream (each creep is an O(1) lookup)' });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 6) mazeProject — Mini-project: "Build Your Maze" (maze-TD + economy)
// =============================================================================
(function mazeProject() {
    const canvas = document.getElementById('tdMazeProjectCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pointer = tdInstallPointer(canvas);
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const spawn = { col: 0, row: 4 }, goal = { col: 18, row: 4 };
    const TOWER_COST = 30;

    let towers, creeps, shots, pops, gold, lives, spawner, status, denyFlash;
    function reset() {
        grid.clearOccupancy();
        towers = []; creeps = []; shots = []; pops = [];
        gold = 150; lives = 12; status = 'build'; denyFlash = 0;
        spawner = { remaining: 0, count: 16, timer: 0, interval: 0.7, speed: 72 };
    }
    reset();
    function replanAll() { for (const c of creeps) { const cell = grid.worldToCell(c.x, c.y); if (cell) { const np = tdAStarPath(grid, cell, goal, c.pos); if (np) { c.path = np; c.dist = 0; } } } }

    const startBtn = document.getElementById('tdMazeStart');
    if (startBtn) startBtn.addEventListener('click', () => { if (status === 'build' || status === 'won' || status === 'lost') { if (status !== 'build') reset(); spawner.remaining = spawner.count; status = 'wave'; } });
    const resetBtn = document.getElementById('tdMazeReset');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    function update(dt) {
        // place a tower: buildable, affordable, not on spawn/goal/a creep, and it
        // must NOT seal the goal (the connectivity guard).
        if (pointer.justPressed && pointer.inside && status !== 'lost') {
            const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            const onCreep = c && creeps.some((cr) => { const cc = grid.worldToCell(cr.x, cr.y); return tdCellEq(cc, c); });
            if (c && grid.isBuildable(c.col, c.row) && gold >= TOWER_COST && !tdCellEq(c, spawn) && !tdCellEq(c, goal) && !onCreep) {
                if (tdBlocksPath(grid, c.col, c.row, spawn, goal)) denyFlash = 0.6;
                else { const p = grid.cellCenter(c.col, c.row); towers.push(new TDTower(p.x, p.y, { range: 100, fireRate: 1.7, damage: 2, projSpeed: 280, targeting: 'closest' })); grid.occupy(c.col, c.row, true); gold -= TOWER_COST; replanAll(); }
            }
        }
        if (status === 'wave') {
            if (spawner.remaining > 0) {
                spawner.timer -= dt;
                if (spawner.timer <= 0) { spawner.timer = spawner.interval; spawner.remaining--; const path = tdAStarPath(grid, spawn, goal); if (path) creeps.push(new TDEnemy(path, { speed: spawner.speed, hp: 7, bounty: 5 })); }
            }
            for (const c of creeps) c.update(dt);
            for (const t of towers) { const fired = t.update(dt, creeps); if (fired) shots.push(new TDProjectile(t.x, t.y, { target: fired, speed: t.projSpeed, damage: t.damage, color: t.color })); }
            for (const s of shots) s.update(dt);
            for (let i = creeps.length - 1; i >= 0; i--) {
                const c = creeps[i];
                if (c.leaked) { lives--; pops.push({ x: c.x, y: c.y, r: 13, life: 0.3, max: 0.3, color: TD.bad }); creeps.splice(i, 1); continue; }
                if (!c.alive) { gold += c.bounty; pops.push({ x: c.x, y: c.y, r: 11, life: 0.22, max: 0.22, color: TD.towerGold }); creeps.splice(i, 1); }
            }
            for (let i = shots.length - 1; i >= 0; i--) if (!shots[i].alive) shots.splice(i, 1);
            if (lives <= 0) status = 'lost';
            else if (spawner.remaining === 0 && creeps.length === 0) status = 'won';
        }
        for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
        if (denyFlash > 0) denyFlash -= dt;
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = (pointer.inside && status !== 'lost') ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { hover });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const t of towers) tdDrawTower(ctx, t);
        for (const p of pops) tdDrawPop(ctx, p);
        tdMarker(ctx, grid, spawn, TD.spawn, 'S');
        tdMarker(ctx, grid, goal, TD.goal, 'G');
        const msg = denyFlash > 0 ? '⛔ That would seal the goal — pick another tile'
            : status === 'build' ? 'Place towers (●' + TOWER_COST + ') to build a maze — longer route = more shots. Then Start.'
            : status === 'wave' ? 'Hold! ' + (spawner.remaining + creeps.length) + ' creeps left'
            : status === 'won' ? '✅ Maze held — wave cleared!' : '💥 Overrun — press Start to retry';
        tdDrawHUD(ctx, grid, { lives: Math.max(0, lives), gold, wave: 1, waves: 1, msg });
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();
