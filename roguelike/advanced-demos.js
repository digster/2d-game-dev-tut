// =============================================================================
// ROGUELIKE — ADVANCED TIER DEMOS ("Sight & Pursuit")
// =============================================================================
// Six demos. The vision + pathing ALGORITHMS this tier teaches now live in
// engine/vision.js (promoted there once the Expert capstone became a second
// consumer): losLine, computeFOV, aStarPath, dijkstraFrom, stepDownhill. They
// are top-level globals, so they're shared by every demo AND unit-testable
// from the console (which is how the FOV shadow-casting was verified).
//
// DEPENDENCIES (loaded BEFORE this file by advanced.html):
//   ../shared/utils.js   — clearCanvas
//   engine/seeded-rng.js — RogueRng
//   engine/grid.js       — Tile, Level, RL, drawGlyphGrid
//   engine/actors.js     — rl* toolkit (rlInstallCanvasKeys, rlTryMove, ...)
//   engine/dungeon.js    — generateDungeon (+ dg* helpers)
//   engine/vision.js     — losLine, computeFOV, aStarPath, dijkstraFrom,
//                          stepDownhill, VIS_DIRS4
// =============================================================================

(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

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
        for (const c of los.cells) {
            ctx.fillStyle = los.clear ? 'rgba(102,187,106,0.45)' : 'rgba(239,83,80,0.40)';
            ctx.fillRect(c.x * cell, c.y * cell, cell, cell);
        }
        if (los.blockedAt) {
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
            const s = (new RogueRng((m.x * 73856093) ^ (m.y * 19349663) ^ Date.now())).pick(VIS_DIRS4);
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
        mon = { x: d.stairs.x, y: d.stairs.y };
        think();
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        const r = action.wait ? 'moved' : rlTryMove(level, player, action, [player, mon]);
        if (r === 'blocked') return;
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
        if (hasLos) {
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
        const f = new Float32Array(dist.length);
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
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            const d = dist[level.idx(x, y)];
            if (d === Infinity || !level.isWalkable(x, y)) continue;
            const t = maxD ? d / maxD : 0;
            ctx.fillStyle = `hsla(${Math.round(240 * t)}, 70%, 50%, 0.32)`;
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
        if (arrowsEl.checked) {
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
                const step = stepDownhill(level, m, scent, actors);
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
        const shown = monsters.filter(m => !m.dead && vis[level.idx(m.x, m.y)]);
        rlDrawEntities(ctx, 0, 0, cell, shown.concat(player.dead ? [] : [{ x: player.x, y: player.y, ch: '@', color: RL.player }]));
        for (const m of shown) rlHpBar(ctx, 0, 0, cell, m.x, m.y, m.hp / m.maxHp, RL.bad);
        if (!player.dead) rlHpBar(ctx, 0, 0, cell, player.x, player.y, player.hp / player.maxHp, RL.good);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// --- tiny tier-local helpers ------------------------------------------------
function readSeedA(el) { return Math.max(1, parseInt(el.value, 10) || 1); }
function countWalkableA(level) {
    let n = 0;
    for (let i = 0; i < level.tiles.length; i++) {
        const t = level.tiles[i];
        if (t === Tile.FLOOR || t === Tile.STAIRS_DOWN || t === Tile.STAIRS_UP || t === Tile.DOOR) n++;
    }
    return n;
}
