// =============================================================================
// ROGUELIKE — ADVANCED TIER DEMOS ("Sight & Pursuit")
// =============================================================================
// Six demos. The vision + pathing ALGORITHMS are defined as top-level globals
// (not buried in IIFEs) for two reasons: every demo shares one implementation,
// and they can be unit-tested directly from the console against a hand-built
// Level (which is how the FOV shadow-casting was verified before trusting it).
//
//   losLine        — Bresenham line-of-sight ("can A see B?")
//   computeFOV      — recursive shadowcasting field-of-view ("what can I see?")
//   aStarPath       — A* shortest path on the grid (one smart chaser)
//   dijkstraFrom    — multi-source distance field ("scent map", many chasers)
//
// DEPENDENCIES (loaded BEFORE this file by advanced.html):
//   ../shared/utils.js   — clearCanvas
//   engine/seeded-rng.js — RogueRng
//   engine/grid.js       — Tile, Level, RL, drawGlyphGrid
//   engine/actors.js     — rl* toolkit (rlInstallCanvasKeys, rlTryMove, ...)
//   engine/dungeon.js    — generateDungeon (+ dg* helpers)
// =============================================================================

(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// --- Line of sight (Bresenham) ----------------------------------------------
function losLine(level, x0, y0, x1, y1) {
    const cells = [];
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0, clear = true, blockedAt = null;
    while (true) {
        cells.push({ x, y });
        if (x === x1 && y === y1) break;
        if (!(x === x0 && y === y0) && level.isOpaque(x, y)) { clear = false; blockedAt = { x, y }; break; }
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
    }
    return { cells, clear, blockedAt };
}

// --- Recursive shadowcasting FOV (Björn Bergström's 8-octant classic) --------
const FOV_MULT = [
    [1, 0, 0, -1, -1, 0, 0, 1],   // xx
    [0, 1, -1, 0, 0, -1, 1, 0],   // xy
    [0, 1, 1, 0, 0, -1, -1, 0],   // yx
    [1, 0, 0, 1, -1, 0, 0, -1],   // yy
];
function castLight(level, cx, cy, row, start, end, radius, xx, xy, yx, yy, mark) {
    if (start < end) return;
    const r2 = radius * radius;
    let newStart = 0;
    for (let j = row; j <= radius; j++) {
        let dx = -j - 1, dy = -j, blocked = false;
        while (dx <= 0) {
            dx++;
            const X = cx + dx * xx + dy * xy, Y = cy + dx * yx + dy * yy;
            const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
            if (start < rSlope) continue;
            if (end > lSlope) break;
            if (dx * dx + dy * dy < r2) mark(X, Y);
            if (blocked) {
                if (level.isOpaque(X, Y)) { newStart = rSlope; continue; }
                blocked = false; start = newStart;
            } else if (level.isOpaque(X, Y) && j < radius) {
                blocked = true;
                castLight(level, cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy, mark);
                newStart = rSlope;
            }
        }
        if (blocked) break;
    }
}
function computeFOV(level, ox, oy, radius) {
    const vis = new Uint8Array(level.width * level.height);
    const mark = (x, y) => { if (level.inBounds(x, y)) vis[level.idx(x, y)] = 1; };
    mark(ox, oy);
    for (let oct = 0; oct < 8; oct++)
        castLight(level, ox, oy, 1, 1.0, 0.0, radius, FOV_MULT[0][oct], FOV_MULT[1][oct], FOV_MULT[2][oct], FOV_MULT[3][oct], mark);
    return vis;
}

// --- A* (binary-heap open set) ----------------------------------------------
class RLHeap {
    constructor() { this.n = []; this.p = []; }
    get size() { return this.n.length; }
    push(node, prio) { this.n.push(node); this.p.push(prio); this._up(this.n.length - 1); }
    pop() {
        const top = this.n[0], ln = this.n.pop(), lp = this.p.pop();
        if (this.n.length) { this.n[0] = ln; this.p[0] = lp; this._down(0); }
        return top;
    }
    _swap(a, b) { [this.n[a], this.n[b]] = [this.n[b], this.n[a]];[this.p[a], this.p[b]] = [this.p[b], this.p[a]]; }
    _up(i) { while (i > 0) { const par = (i - 1) >> 1; if (this.p[par] <= this.p[i]) break; this._swap(i, par); i = par; } }
    _down(i) { const n = this.n.length; for (; ;) { let s = i, l = 2 * i + 1, r = 2 * i + 2; if (l < n && this.p[l] < this.p[s]) s = l; if (r < n && this.p[r] < this.p[s]) s = r; if (s === i) break; this._swap(i, s); i = s; } }
}
function aStarPath(level, sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    const W = level.width, N = W * level.height;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
    const start = sy * W + sx, goal = ty * W + tx;
    g[start] = 0;
    const open = new RLHeap(); open.push(start, h(sx, sy));
    while (open.size) {
        const cur = open.pop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === goal) {
            const path = []; let c = cur;
            while (c !== start) { path.push({ x: c % W, y: (c / W) | 0 }); c = came[c]; }
            return path.reverse();
        }
        const cx = cur % W, cy = (cur / W) | 0;
        for (const [dx, dy] of DIRS4) {
            const nx = cx + dx, ny = cy + dy;
            if (!level.isWalkable(nx, ny)) continue;
            const ni = ny * W + nx;
            if (closed[ni]) continue;
            const ng = g[cur] + 1;
            if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; open.push(ni, ng + h(nx, ny)); }
        }
    }
    return [];   // unreachable
}

// --- Dijkstra distance field ("scent map") ----------------------------------
function dijkstraFrom(level, sources) {
    const W = level.width, dist = new Float32Array(W * level.height).fill(Infinity);
    const queue = [];
    for (const s of sources) { dist[s.y * W + s.x] = 0; queue.push([s.x, s.y]); }
    for (let head = 0; head < queue.length; head++) {
        const [x, y] = queue[head], d = dist[y * W + x];
        for (const [dx, dy] of DIRS4) {
            const nx = x + dx, ny = y + dy;
            if (!level.isWalkable(nx, ny)) continue;
            if (d + 1 < dist[ny * W + nx]) { dist[ny * W + nx] = d + 1; queue.push([nx, ny]); }
        }
    }
    return dist;
}
// Step to the neighbour with the smallest distance that isn't blocked/occupied.
function stepDownhill(level, m, dist, actors) {
    const W = level.width;
    let best = null, bestD = dist[m.y * W + m.x];
    for (const [dx, dy] of DIRS4) {
        const nx = m.x + dx, ny = m.y + dy;
        if (!level.isWalkable(nx, ny)) continue;
        if (actors && rlActorAt(actors, nx, ny, m)) continue;
        const d = dist[ny * W + nx];
        if (d < bestD) { bestD = d; best = { dx, dy }; }
    }
    return best;
}

// =============================================================================
// DEMO 1 — losDemo : Bresenham line of sight (mouse-driven)
// =============================================================================
(function losDemo() {
    const canvas = document.getElementById('rlLosCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlLosSeed');
    const hud = document.getElementById('rlLosHud');
    let level, player, target;

    function gen() {
        const rng = new RogueRng(readSeedA(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 24, minSize: 4, maxSize: 7 });
        level = d.level; player = d.spawn; target = d.stairs;
        draw();
    }
    function tileFromMouse(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX - r.left) * (canvas.width / r.width) / cell),
            y: Math.floor((e.clientY - r.top) * (canvas.height / r.height) / cell),
        };
    }
    canvas.addEventListener('mousemove', (e) => {
        const t = tileFromMouse(e);
        if (level.inBounds(t.x, t.y)) { target = t; draw(); }
    });
    seedEl.addEventListener('change', gen);
    document.getElementById('rlLosGen').addEventListener('click', gen);

    function draw() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        const los = losLine(level, player.x, player.y, target.x, target.y);
        for (const c of los.cells) {                 // tint the line cells
            ctx.fillStyle = los.clear ? 'rgba(102,187,106,0.45)' : 'rgba(239,83,80,0.40)';
            ctx.fillRect(c.x * cell, c.y * cell, cell, cell);
        }
        if (los.blockedAt) {                          // mark the offending wall
            ctx.strokeStyle = RL.bad; ctx.lineWidth = 2;
            const b = los.blockedAt;
            ctx.beginPath();
            ctx.moveTo(b.x * cell + 4, b.y * cell + 4); ctx.lineTo(b.x * cell + cell - 4, b.y * cell + cell - 4);
            ctx.moveTo(b.x * cell + cell - 4, b.y * cell + 4); ctx.lineTo(b.x * cell + 4, b.y * cell + cell - 4);
            ctx.stroke();
        }
        rlDrawEntities(ctx, 0, 0, cell, [
            { x: target.x, y: target.y, ch: '×', color: los.clear ? RL.good : RL.bad },
            { x: player.x, y: player.y, ch: '@', color: RL.player },
        ]);
        hud.textContent = `target (${target.x}, ${target.y}) · line of sight: `
            + (los.clear ? 'CLEAR ✓' : `BLOCKED by wall at (${los.blockedAt.x}, ${los.blockedAt.y})`);
    }
    gen();
})();

// =============================================================================
// DEMO 2 — fovDemo : recursive shadowcasting (move to look around)
// =============================================================================
(function fovDemo() {
    const canvas = document.getElementById('rlFovCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlFovSeed');
    const radEl = document.getElementById('rlFovRadius');
    const radVal = document.getElementById('rlFovRadiusVal');
    const hud = document.getElementById('rlFovHud');
    let level, player, vis;

    function recompute() {
        vis = computeFOV(level, player.x, player.y, +radEl.value);
        let count = 0; for (let i = 0; i < vis.length; i++) count += vis[i];
        hud.textContent = `radius ${radEl.value} · visible tiles ${count} · move to look around (walls cast shadows)`;
    }
    function gen() {
        radVal.textContent = radEl.value;
        const rng = new RogueRng(readSeedA(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 26, minSize: 4, maxSize: 7 });
        level = d.level; player = d.spawn;
        recompute();
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (action.wait) { recompute(); return; }
        if (rlTryMove(level, player, action, [player]) === 'moved') recompute();
    });
    radEl.addEventListener('input', () => { radVal.textContent = radEl.value; recompute(); });
    seedEl.addEventListener('change', gen);
    document.getElementById('rlFovGen').addEventListener('click', () => { gen(); canvas.focus(); });
    gen();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        // explored:()=>true draws the whole map dim, so the lit FOV stands out.
        drawGlyphGrid(ctx, level, { cell, visible: (x, y) => vis[level.idx(x, y)], explored: () => true });
        rlDrawEntities(ctx, 0, 0, cell, [{ x: player.x, y: player.y, ch: '@', color: RL.player }]);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 3 — fogDemo : fog of war + remembered map
// =============================================================================
(function fogDemo() {
    const canvas = document.getElementById('rlFogCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlFogSeed');
    const hud = document.getElementById('rlFogHud');
    const RADIUS = 8;
    let level, player, vis, explored, monsters, totalFloor;

    function recompute() {
        vis = computeFOV(level, player.x, player.y, RADIUS);
        for (let i = 0; i < vis.length; i++) if (vis[i]) explored[i] = 1;
        let seen = 0; for (let i = 0; i < explored.length; i++) seen += explored[i];
        hud.textContent = `explored ${Math.round(100 * seen / totalFloor)}% of the floor · monsters hide outside your view`;
    }
    function gen() {
        const rng = new RogueRng(readSeedA(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 26, minSize: 4, maxSize: 7 });
        level = d.level; player = d.spawn;
        explored = new Uint8Array(level.width * level.height);
        totalFloor = countWalkableA(level);
        monsters = [];
        for (let i = 0; i < 4; i++) { const p = dgRandomFloorTile(level, rng); monsters.push({ x: p.x, y: p.y, ch: 'r', color: RL.monster }); }
        recompute();
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        const r = action.wait ? 'moved' : rlTryMove(level, player, action, [player]);
        if (r !== 'moved' && !action.wait) return;
        for (const m of monsters) {                       // monsters wander each turn
            const s = (new RogueRng((m.x * 73856093) ^ (m.y * 19349663) ^ Date.now())).pick(DIRS4);
            if (level.isWalkable(m.x + s[0], m.y + s[1])) { m.x += s[0]; m.y += s[1]; }
        }
        recompute();
    });
    seedEl.addEventListener('change', gen);
    document.getElementById('rlFogGen').addEventListener('click', () => { gen(); canvas.focus(); });
    gen();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell, visible: (x, y) => vis[level.idx(x, y)], explored: (x, y) => explored[level.idx(x, y)] });
        const shown = monsters.filter(m => vis[level.idx(m.x, m.y)]);
        rlDrawEntities(ctx, 0, 0, cell, shown.concat([{ x: player.x, y: player.y, ch: '@', color: RL.player }]));
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 4 — astarDemo : one chaser, A* path, only while it has line of sight
// =============================================================================
(function astarDemo() {
    const canvas = document.getElementById('rlAstarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlAstarSeed');
    const hud = document.getElementById('rlAstarHud');
    let level, player, mon, path, hasLos;

    function think() {
        const los = losLine(level, mon.x, mon.y, player.x, player.y);
        hasLos = los.clear;
        path = hasLos ? aStarPath(level, mon.x, mon.y, player.x, player.y) : [];
        hud.textContent = `monster line of sight: ${hasLos ? 'YES — chasing' : 'no — waiting'}`
            + ` · path length ${path.length}`;
    }
    function gen() {
        const rng = new RogueRng(readSeedA(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 26, minSize: 4, maxSize: 7 });
        level = d.level; player = d.spawn;
        mon = { x: d.stairs.x, y: d.stairs.y };           // start the chaser at the far end
        think();
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        const r = action.wait ? 'moved' : rlTryMove(level, player, action, [player, mon]);
        if (r === 'blocked') return;
        // Monster turn: recompute LOS + path, step one tile along it.
        think();
        if (hasLos && path.length && !(path[0].x === player.x && path[0].y === player.y)) {
            mon.x = path[0].x; mon.y = path[0].y;
        }
        think();
    });
    seedEl.addEventListener('change', gen);
    document.getElementById('rlAstarGen').addEventListener('click', () => { gen(); canvas.focus(); });
    gen();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (hasLos) {                                     // draw the planned path
            ctx.fillStyle = 'rgba(79,195,247,0.5)';
            for (const c of path) ctx.fillRect(c.x * cell + cell / 2 - 3, c.y * cell + cell / 2 - 3, 6, 6);
        }
        rlDrawEntities(ctx, 0, 0, cell, [
            { x: mon.x, y: mon.y, ch: 'r', color: hasLos ? RL.monster : RL.monsterCalm },
            { x: player.x, y: player.y, ch: '@', color: RL.player },
        ]);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 5 — dijkstraDemo : one scent map drives many chasers
// =============================================================================
(function dijkstraDemo() {
    const canvas = document.getElementById('rlDijkstraCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlDijkstraSeed');
    const arrowsEl = document.getElementById('rlDijkstraArrows');
    const fleeEl = document.getElementById('rlDijkstraFlee');
    const hud = document.getElementById('rlDijkstraHud');
    let level, player, monsters, dist, maxD;

    function recompute() {
        dist = dijkstraFrom(level, [player]);
        maxD = 0; for (let i = 0; i < dist.length; i++) if (dist[i] !== Infinity && dist[i] > maxD) maxD = dist[i];
        hud.textContent = `one flood fill · ${monsters.length} chasers roll downhill · max distance ${maxD}`
            + (fleeEl.checked ? ' · FLEE map (negated)' : '');
    }
    function fieldFor(chase) {
        if (chase) return dist;
        const f = new Float32Array(dist.length);          // flee = negate (Brogue uses ~-1.2)
        for (let i = 0; i < dist.length; i++) f[i] = dist[i] === Infinity ? Infinity : dist[i] * -1.2;
        return f;
    }
    function gen() {
        const rng = new RogueRng(readSeedA(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 26, minSize: 4, maxSize: 7 });
        level = d.level; player = d.spawn;
        monsters = [];
        for (let i = 0; i < 2; i++) { const p = dgRandomFloorTile(level, rng); monsters.push({ x: p.x, y: p.y, ch: 'r', color: RL.monster }); }
        recompute();
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        const r = action.wait ? 'moved' : rlTryMove(level, player, action, [player].concat(monsters));
        if (r === 'blocked') return;
        recompute();
        const field = fieldFor(!fleeEl.checked);
        for (const m of monsters) {
            const step = stepDownhill(level, m, field, [player].concat(monsters));
            if (step) { m.x += step.dx; m.y += step.dy; }
        }
    });
    [arrowsEl, fleeEl].forEach(el => el.addEventListener('change', recompute));
    seedEl.addEventListener('change', gen);
    document.getElementById('rlDijkstraGen').addEventListener('click', () => { gen(); canvas.focus(); });
    gen();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {     // heatmap
            const d = dist[level.idx(x, y)];
            if (d === Infinity || !level.isWalkable(x, y)) continue;
            const t = maxD ? d / maxD : 0;
            ctx.fillStyle = `hsla(${Math.round(240 * t)}, 70%, 50%, 0.32)`;
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
        if (arrowsEl.checked) {                                            // gradient arrows
            ctx.strokeStyle = 'rgba(224,224,224,0.5)'; ctx.lineWidth = 1;
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                if (dist[level.idx(x, y)] === Infinity) continue;
                const step = stepDownhill(level, { x, y }, dist, null);
                if (!step) continue;
                const cxp = x * cell + cell / 2, cyp = y * cell + cell / 2;
                ctx.beginPath();
                ctx.moveTo(cxp, cyp);
                ctx.lineTo(cxp + step.dx * cell * 0.32, cyp + step.dy * cell * 0.32);
                ctx.stroke();
            }
        }
        rlDrawEntities(ctx, 0, 0, cell, monsters.concat([{ x: player.x, y: player.y, ch: '@', color: RL.player }]));
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 6 — huntDemo : CAPSTONE — fog + FOV + LOS aggro + Dijkstra chase + stealth
// =============================================================================
(function huntDemo() {
    const canvas = document.getElementById('rlHuntCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const log = document.getElementById('rlHuntLog');
    const hud = document.getElementById('rlHuntHud');
    const seedEl = document.getElementById('rlHuntSeed');
    const flashes = [];
    const RADIUS = 8, SIGHT = 9, FORGET = 6;
    let rng, level, player, monsters, actors, stairs, vis, explored, scent, turn, state;

    function recompute() {
        vis = computeFOV(level, player.x, player.y, RADIUS);
        for (let i = 0; i < vis.length; i++) if (vis[i]) explored[i] = 1;
        scent = dijkstraFrom(level, [player]);
    }
    function reset() {
        rng = new RogueRng(readSeedA(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 30, minSize: 4, maxSize: 7 });
        level = d.level; player = { x: d.spawn.x, y: d.spawn.y, hp: 26, maxHp: 26, name: 'you' };
        stairs = d.stairs;
        monsters = [];
        for (let i = 0; i < 4; i++) {
            const p = dgRandomFloorTile(level, rng);
            if (p.x === player.x && p.y === player.y) continue;
            monsters.push({ x: p.x, y: p.y, hp: 6, maxHp: 6, name: 'rat', ch: 'r', color: RL.monsterCalm, awake: false, lost: 0 });
        }
        actors = [player, ...monsters];
        explored = new Uint8Array(level.width * level.height);
        turn = 0; state = 'play'; flashes.length = 0;
        log.innerHTML = '';
        rlLog(log, `— You slip into the dungeon. (seed ${readSeedA(seedEl)}) Reach the stairs (>) to escape. —`, 'dim');
        rlLog(log, 'Rats hunt by sight. Break line of sight to shake them.', 'dim');
        recompute();
        updateHud();
    }
    function updateHud() {
        const awake = monsters.filter(m => !m.dead && m.awake).length;
        const tail = state === 'win' ? ' · 🏆 escaped — you win!'
                   : state === 'dead' ? ' · 💀 you died — press New hunt'
                   : (vis[level.idx(stairs.x, stairs.y)] ? ' · stairs in sight!' : '');
        hud.textContent = `turn ${turn} · HP ${Math.max(0, player.hp)}/${player.maxHp}`
            + ` · rats ${monsters.filter(m => !m.dead).length} (${awake} hunting)` + tail;
    }
    function playerHit(_, target) {
        const dmg = rng.dice(1, 6);
        target.hp -= dmg; rlPushFlash(flashes, target.x, target.y);
        rlLog(log, `You hit the ${target.name} for ${dmg}.`, 'you');
        if (target.hp <= 0) { target.dead = true; rlLog(log, `The ${target.name} dies.`, 'good'); }
    }
    function monstersTurn() {
        for (const m of monsters) {
            if (m.dead || player.dead) continue;
            const los = losLine(level, m.x, m.y, player.x, player.y);
            const canSee = los.clear && rlManhattan(m, player) <= SIGHT;
            if (canSee) {
                if (!m.awake) { rlLog(log, 'A rat spots you and gives chase!', 'warn'); }
                m.awake = true; m.color = RL.monster; m.lost = 0;
            } else if (m.awake) {
                m.lost++;
                if (m.lost > FORGET) { m.awake = false; m.color = RL.monsterCalm; rlLog(log, 'A rat loses your trail.', 'dim'); }
            }
            if (!m.awake) continue;
            if (rlManhattan(m, player) === 1) {
                const dmg = rng.dice(1, 3);
                player.hp -= dmg; rlPushFlash(flashes, player.x, player.y);
                rlLog(log, `The rat bites you for ${dmg}.`, 'mob');
                if (player.hp <= 0) { player.dead = true; state = 'dead'; rlLog(log, 'You fall in the dark.', 'warn'); return; }
            } else {
                const step = stepDownhill(level, m, scent, actors);   // roll down the scent map
                if (step) { m.x += step.dx; m.y += step.dy; }
            }
        }
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (state !== 'play') return;
        const acted = action.wait ? true : rlTryMove(level, player, action, actors, playerHit) !== 'blocked';
        if (!acted) return;
        if (level.get(player.x, player.y) === Tile.STAIRS_DOWN) {
            state = 'win'; rlLog(log, 'You reach the stairs and escape into the depths. (You win!)', 'good');
            recompute(); updateHud(); return;
        }
        recompute();
        monstersTurn();
        turn++;
        updateHud();
    });
    document.getElementById('rlHuntRestart').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render(now) {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell, visible: (x, y) => vis[level.idx(x, y)], explored: (x, y) => explored[level.idx(x, y)] });
        rlDrawFlashes(ctx, 0, 0, cell, flashes, now);
        // Only draw monsters you can actually see.
        const shown = monsters.filter(m => !m.dead && vis[level.idx(m.x, m.y)]);
        rlDrawEntities(ctx, 0, 0, cell, shown.concat(player.dead ? [] : [{ x: player.x, y: player.y, ch: '@', color: RL.player }]));
        for (const m of shown) rlHpBar(ctx, 0, 0, cell, m.x, m.y, m.hp / m.maxHp, RL.bad);
        if (!player.dead) rlHpBar(ctx, 0, 0, cell, player.x, player.y, player.hp / player.maxHp, RL.good);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// --- tiny tier-local helpers (avoid colliding with the engine's dg*/rl*) -----
function readSeedA(el) { return Math.max(1, parseInt(el.value, 10) || 1); }
function countWalkableA(level) {
    let n = 0;
    for (let i = 0; i < level.tiles.length; i++) {
        const t = level.tiles[i];
        if (t === Tile.FLOOR || t === Tile.STAIRS_DOWN || t === Tile.STAIRS_UP || t === Tile.DOOR) n++;
    }
    return n;
}
