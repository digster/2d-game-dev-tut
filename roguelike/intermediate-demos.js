// =============================================================================
// ROGUELIKE — INTERMEDIATE TIER DEMOS ("Building the Dungeon")
// =============================================================================
// Six demos. The first five teach a procedural-generation building block each;
// the sixth is a playable, multi-level generated dungeon.
//
//   1. roomsDemo      — scatter rooms, reject overlaps
//   2. corridorsDemo  — L-corridors connect them
//   3. bspDemo        — binary space partitioning (overlap-free by construction)
//   4. drunkDemo      — drunkard's-walk caves (animated)
//   5. populateDemo   — spawn/stairs/monsters/items + flood-fill connectivity
//   6. exploreDungeonDemo — CAPSTONE: walk a generated, multi-level dungeon
//
// DEPENDENCIES (loaded BEFORE this file by intermediate.html):
//   ../shared/utils.js   — clearCanvas
//   engine/seeded-rng.js — RogueRng
//   engine/grid.js       — Tile, Level, RL, drawGlyphGrid
//   engine/actors.js     — the rl* toolkit (used by the capstone)
//
// The GENERATORS below live in this tier file on purpose: they're the lesson,
// not shared infrastructure. (When the Advanced tier needs a dungeon too, the
// reusable core will graduate to engine/ — the ARCHITECTURE.md rule's trigger.)
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
// GENERATION TOOLKIT (tier-local — the subject of this tier)
// =============================================================================
const RL_STEPS4 = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

// Carve a room's interior to floor.
function carveRoom(level, room) {
    for (let y = room.y; y < room.y + room.h; y++)
        for (let x = room.x; x < room.x + room.w; x++)
            level.set(x, y, Tile.FLOOR);
}
// Two rooms overlap if their rectangles touch within `margin` tiles.
function roomsOverlap(a, b, margin) {
    return a.x - margin < b.x + b.w && a.x + a.w + margin > b.x
        && a.y - margin < b.y + b.h && a.y + a.h + margin > b.y;
}
// Make a {x,y,w,h,cx,cy} room record.
function mkRoom(x, y, w, h) { return { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) }; }

// Scatter up to `attempts` random rooms, rejecting overlaps. Returns placed rooms.
function placeRooms(level, rng, { attempts, minSize, maxSize }) {
    const rooms = [];
    for (let i = 0; i < attempts; i++) {
        const w = rng.between(minSize, maxSize), h = rng.between(minSize, maxSize);
        const x = rng.between(1, level.width - w - 1), y = rng.between(1, level.height - h - 1);
        const room = mkRoom(x, y, w, h);
        if (rooms.some(r => roomsOverlap(r, room, 1))) continue;
        carveRoom(level, room);
        rooms.push(room);
    }
    return rooms;
}
function carveH(level, x1, x2, y) { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) level.set(x, y, Tile.FLOOR); }
function carveV(level, y1, y2, x) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) level.set(x, y, Tile.FLOOR); }

// Dig an L-corridor between two room centers.
function connectCenters(level, rng, a, b, randomElbow) {
    if (randomElbow && rng.chance(0.5)) { carveH(level, a.cx, b.cx, a.cy); carveV(level, a.cy, b.cy, b.cx); }
    else { carveV(level, a.cy, b.cy, a.cx); carveH(level, a.cx, b.cx, b.cy); }
}
// Connect rooms in placement order so the whole map is one connected chain.
function connectRooms(level, rng, rooms, randomElbow) {
    for (let i = 1; i < rooms.length; i++) connectCenters(level, rng, rooms[i - 1], rooms[i], randomElbow);
}

// --- BSP ---
function bspBuild(x, y, w, h, depth, rng, opts) {
    const node = { x, y, w, h };
    const canV = w >= opts.minLeaf * 2, canH = h >= opts.minLeaf * 2;
    if (depth >= opts.maxDepth || (!canV && !canH)) { node.leaf = true; return node; }
    const splitVert = (canV && canH) ? (w >= h) : canV;   // cut the longer axis
    if (splitVert) {
        const sx = rng.between(x + opts.minLeaf, x + w - opts.minLeaf);
        node.split = { vert: true, at: sx };
        node.left = bspBuild(x, y, sx - x, h, depth + 1, rng, opts);
        node.right = bspBuild(sx, y, x + w - sx, h, depth + 1, rng, opts);
    } else {
        const sy = rng.between(y + opts.minLeaf, y + h - opts.minLeaf);
        node.split = { vert: false, at: sy };
        node.left = bspBuild(x, y, w, sy - y, depth + 1, rng, opts);
        node.right = bspBuild(x, sy, w, y + h - sy, depth + 1, rng, opts);
    }
    return node;
}
function bspLeaves(node, out) { if (node.leaf) out.push(node); else { bspLeaves(node.left, out); bspLeaves(node.right, out); } }
function bspMakeRooms(node, level, rng, rooms) {
    if (node.leaf) {
        const maxW = Math.min(12, node.w - 2), maxH = Math.min(12, node.h - 2);
        if (maxW < 3 || maxH < 3) return;
        const rw = rng.between(3, maxW), rh = rng.between(3, maxH);
        const rx = rng.between(node.x + 1, node.x + node.w - rw - 1);
        const ry = rng.between(node.y + 1, node.y + node.h - rh - 1);
        const room = mkRoom(rx, ry, rw, rh);
        carveRoom(level, room); rooms.push(room); node.room = room;
        return;
    }
    bspMakeRooms(node.left, level, rng, rooms);
    bspMakeRooms(node.right, level, rng, rooms);
}
function bspConnect(node, level, rng) {
    if (node.leaf) return node.room || null;
    const a = bspConnect(node.left, level, rng);
    const b = bspConnect(node.right, level, rng);
    if (a && b) connectCenters(level, rng, a, b, false);
    return a || b;
}

// --- Drunkard's walk (steppable, for animation) ---
function makeDrunkard(level, rng, opts) {
    const st = { walkers: [], carved: 0, target: opts.targetFloor };
    for (let i = 0; i < opts.walkers; i++) {
        st.walkers.push(i === 0
            ? { x: level.width >> 1, y: level.height >> 1 }
            : { x: rng.between(2, level.width - 3), y: rng.between(2, level.height - 3) });
    }
    st.step = function (n) {
        for (let k = 0; k < n && st.carved < st.target; k++) {
            for (const w of st.walkers) {
                if (st.carved >= st.target) break;
                if (level.get(w.x, w.y) !== Tile.FLOOR) { level.set(w.x, w.y, Tile.FLOOR); st.carved++; }
                const s = rng.pick(RL_STEPS4);
                w.x = Math.max(1, Math.min(level.width - 2, w.x + s.dx));
                w.y = Math.max(1, Math.min(level.height - 2, w.y + s.dy));
            }
        }
        return st.carved >= st.target;
    };
    return st;
}
// Run a drunkard cave to completion (used by populate/capstone, no animation).
function caveGen(level, rng, opts) {
    const d = makeDrunkard(level, rng, opts);
    let guard = opts.targetFloor * 60;
    while (!d.step(64) && guard-- > 0) { /* keep stepping */ }
    return d;
}

// --- Connectivity (flood fill) ---
function floodFill(level, sx, sy) {
    const seen = new Uint8Array(level.width * level.height);
    if (!level.isWalkable(sx, sy)) return { seen, count: 0 };
    const queue = [[sx, sy]];
    seen[level.idx(sx, sy)] = 1;
    let count = 0;
    while (queue.length) {
        const [x, y] = queue.pop();
        count++;
        for (const s of RL_STEPS4) {
            const nx = x + s.dx, ny = y + s.dy;
            if (level.isWalkable(nx, ny) && !seen[level.idx(nx, ny)]) {
                seen[level.idx(nx, ny)] = 1; queue.push([nx, ny]);
            }
        }
    }
    return { seen, count };
}
function regionsOf(level) {
    const seen = new Uint8Array(level.width * level.height);
    const regions = [];
    for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
        if (seen[level.idx(x, y)] || !level.isWalkable(x, y)) continue;
        const region = []; const q = [[x, y]]; seen[level.idx(x, y)] = 1;
        while (q.length) {
            const [cx, cy] = q.pop(); region.push(level.idx(cx, cy));
            for (const s of RL_STEPS4) {
                const nx = cx + s.dx, ny = cy + s.dy;
                if (level.isWalkable(nx, ny) && !seen[level.idx(nx, ny)]) { seen[level.idx(nx, ny)] = 1; q.push([nx, ny]); }
            }
        }
        regions.push(region);
    }
    return regions;
}
function keepLargestRegion(level) {
    const regions = regionsOf(level);
    if (regions.length <= 1) return regions.length;
    regions.sort((a, b) => b.length - a.length);
    for (let r = 1; r < regions.length; r++) for (const i of regions[r]) level.tiles[i] = Tile.WALL;
    return regions.length;
}
function countWalkable(level) {
    let n = 0;
    for (let i = 0; i < level.tiles.length; i++) {
        const t = level.tiles[i];
        if (t === Tile.FLOOR || t === Tile.STAIRS_DOWN || t === Tile.STAIRS_UP || t === Tile.DOOR) n++;
    }
    return n;
}
function randomFloorIn(level, rng, room) {
    for (let t = 0; t < 60; t++) {
        const x = rng.between(room.x, room.x + room.w - 1), y = rng.between(room.y, room.y + room.h - 1);
        if (level.isWalkable(x, y)) return { x, y };
    }
    return { x: room.cx, y: room.cy };
}
function randomFloorTile(level, rng) {
    for (let t = 0; t < 800; t++) {
        const x = rng.between(1, level.width - 2), y = rng.between(1, level.height - 2);
        if (level.isWalkable(x, y)) return { x, y };
    }
    for (let i = 0; i < level.tiles.length; i++)
        if (level.isWalkable(i % level.width, (i / level.width) | 0)) return { x: i % level.width, y: (i / level.width) | 0 };
    return { x: 1, y: 1 };
}
function readSeed(el) { return Math.max(1, parseInt(el.value, 10) || 1); }

// =============================================================================
// DEMO 1 — roomsDemo : scatter rooms, reject overlaps
// =============================================================================
(function roomsDemo() {
    const canvas = document.getElementById('rlRoomsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 14, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlRoomsSeed');
    const attemptsEl = document.getElementById('rlRoomsAttempts');
    const attemptsVal = document.getElementById('rlRoomsAttemptsVal');
    const outlineEl = document.getElementById('rlRoomsOutline');
    const hud = document.getElementById('rlRoomsHud');
    let level, rooms;

    function gen() {
        attemptsVal.textContent = attemptsEl.value;
        const rng = new RogueRng(readSeed(seedEl));
        level = new Level(cols, rows, Tile.WALL);
        rooms = placeRooms(level, rng, { attempts: +attemptsEl.value, minSize: 4, maxSize: 9 });
        hud.textContent = `attempts ${attemptsEl.value} · rooms placed ${rooms.length}`
            + ` · floor ${level.count(Tile.FLOOR)} tiles · (sealed islands — no corridors yet)`;
        draw();
    }
    function draw() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (outlineEl.checked) {
            ctx.strokeStyle = RL.accent; ctx.lineWidth = 1;
            for (const r of rooms) ctx.strokeRect(r.x * cell + 0.5, r.y * cell + 0.5, r.w * cell - 1, r.h * cell - 1);
        }
    }
    attemptsEl.addEventListener('input', gen);
    outlineEl.addEventListener('change', draw);
    seedEl.addEventListener('change', gen);
    document.getElementById('rlRoomsGen').addEventListener('click', gen);
    gen();
})();

// =============================================================================
// DEMO 2 — corridorsDemo : connect rooms with L-corridors
// =============================================================================
(function corridorsDemo() {
    const canvas = document.getElementById('rlCorrCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 14, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlCorrSeed');
    const graphEl = document.getElementById('rlCorrGraph');
    const elbowEl = document.getElementById('rlCorrElbow');
    const hud = document.getElementById('rlCorrHud');
    let level, rooms;

    function gen() {
        const rng = new RogueRng(readSeed(seedEl));
        level = new Level(cols, rows, Tile.WALL);
        rooms = placeRooms(level, rng, { attempts: 36, minSize: 4, maxSize: 8 });
        connectRooms(level, rng, rooms, elbowEl.checked);
        const total = countWalkable(level);
        const ff = rooms.length ? floodFill(level, rooms[0].cx, rooms[0].cy) : { count: 0 };
        hud.textContent = `rooms ${rooms.length} · corridors ${Math.max(0, rooms.length - 1)}`
            + ` · reachable ${ff.count}/${total} ${ff.count === total ? '(all connected ✓)' : ''}`;
        draw();
    }
    function draw() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (graphEl.checked) {
            ctx.strokeStyle = 'rgba(79,195,247,0.7)'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 1; i < rooms.length; i++) {
                const a = rooms[i - 1], b = rooms[i];
                ctx.moveTo(a.cx * cell + cell / 2, a.cy * cell + cell / 2);
                ctx.lineTo(b.cx * cell + cell / 2, b.cy * cell + cell / 2);
            }
            ctx.stroke();
            ctx.fillStyle = RL.accent;
            for (const r of rooms) { ctx.beginPath(); ctx.arc(r.cx * cell + cell / 2, r.cy * cell + cell / 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
        }
    }
    graphEl.addEventListener('change', draw);
    elbowEl.addEventListener('change', gen);
    seedEl.addEventListener('change', gen);
    document.getElementById('rlCorrGen').addEventListener('click', gen);
    gen();
})();

// =============================================================================
// DEMO 3 — bspDemo : binary space partitioning
// =============================================================================
(function bspDemo() {
    const canvas = document.getElementById('rlBspCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 14, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlBspSeed');
    const depthEl = document.getElementById('rlBspDepth');
    const depthVal = document.getElementById('rlBspDepthVal');
    const showEl = document.getElementById('rlBspShow');
    const hud = document.getElementById('rlBspHud');
    let level, root, rooms, leaves;

    function gen() {
        depthVal.textContent = depthEl.value;
        const rng = new RogueRng(readSeed(seedEl));
        level = new Level(cols, rows, Tile.WALL);
        root = bspBuild(1, 1, cols - 2, rows - 2, 0, rng, { maxDepth: +depthEl.value, minLeaf: 6 });
        rooms = []; bspMakeRooms(root, level, rng, rooms);
        bspConnect(root, level, rng);
        leaves = []; bspLeaves(root, leaves);
        const total = countWalkable(level);
        const ff = rooms.length ? floodFill(level, rooms[0].cx, rooms[0].cy) : { count: 0 };
        hud.textContent = `leaves ${leaves.length} · rooms ${rooms.length} · max depth ${depthEl.value}`
            + ` · reachable ${ff.count}/${total} ${ff.count === total ? '(all connected ✓)' : ''}`;
        draw();
    }
    function draw() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (showEl.checked) {
            ctx.strokeStyle = 'rgba(120,130,170,0.5)'; ctx.lineWidth = 1;
            for (const lf of leaves) ctx.strokeRect(lf.x * cell + 0.5, lf.y * cell + 0.5, lf.w * cell - 1, lf.h * cell - 1);
            ctx.strokeStyle = 'rgba(79,195,247,0.85)';
            for (const r of rooms) ctx.strokeRect(r.x * cell + 0.5, r.y * cell + 0.5, r.w * cell - 1, r.h * cell - 1);
        }
    }
    depthEl.addEventListener('input', gen);
    showEl.addEventListener('change', draw);
    seedEl.addEventListener('change', gen);
    document.getElementById('rlBspGen').addEventListener('click', gen);
    gen();
})();

// =============================================================================
// DEMO 4 — drunkDemo : drunkard's-walk caves (animated)
// =============================================================================
(function drunkDemo() {
    const canvas = document.getElementById('rlDrunkCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 14, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlDrunkSeed');
    const fillEl = document.getElementById('rlDrunkFill');
    const fillVal = document.getElementById('rlDrunkFillVal');
    const walkersEl = document.getElementById('rlDrunkWalkers');
    const walkersVal = document.getElementById('rlDrunkWalkersVal');
    const hud = document.getElementById('rlDrunkHud');
    let level, drunk, done;

    function gen() {
        fillVal.textContent = fillEl.value + '%';
        walkersVal.textContent = walkersEl.value;
        const rng = new RogueRng(readSeed(seedEl));
        level = new Level(cols, rows, Tile.WALL);
        const interior = (cols - 2) * (rows - 2);
        const targetFloor = Math.floor(interior * (+fillEl.value) / 100);
        drunk = makeDrunkard(level, rng, { walkers: +walkersEl.value, targetFloor });
        done = false;
    }
    function updateHud() {
        hud.textContent = `carved ${drunk.carved}/${drunk.target} floor · ${walkersEl.value} walker(s)`
            + (done ? ' · done' : ' · carving…');
    }
    [fillEl, walkersEl].forEach(el => el.addEventListener('input', gen));
    seedEl.addEventListener('change', gen);
    document.getElementById('rlDrunkGen').addEventListener('click', gen);
    gen();

    function render() {
        if (!done) { done = drunk.step(40); }
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (!done) {                       // show the live walker heads
            ctx.fillStyle = RL.player;
            for (const w of drunk.walkers) ctx.fillRect(w.x * cell + 2, w.y * cell + 2, cell - 4, cell - 4);
        }
        updateHud();
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 5 — populateDemo : placement + flood-fill connectivity
// =============================================================================
(function populateDemo() {
    const canvas = document.getElementById('rlPopCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 14, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlPopSeed');
    const typeEl = document.getElementById('rlPopGenType');
    const reachEl = document.getElementById('rlPopReach');
    const fixEl = document.getElementById('rlPopFix');
    const hud = document.getElementById('rlPopHud');
    let level, spawn, ff, monsters, items;

    const MOBS = [['r', RL.monster], ['g', RL.monster], ['k', RL.monster]];
    const ITEMS = [['!', RL.item], ['?', RL.item], ['/', RL.item]];

    function gen() {
        const rng = new RogueRng(readSeed(seedEl));
        level = new Level(cols, rows, Tile.WALL);
        let stairs;
        if (typeEl.value === 'rooms') {
            const rooms = placeRooms(level, rng, { attempts: 36, minSize: 4, maxSize: 8 });
            connectRooms(level, rng, rooms, false);
            spawn = randomFloorIn(level, rng, rooms[0]);
            stairs = randomFloorIn(level, rng, rooms[rooms.length - 1]);
        } else {
            const interior = (cols - 2) * (rows - 2);
            caveGen(level, rng, { walkers: 3, targetFloor: Math.floor(interior * 0.30) });
            spawn = randomFloorTile(level, rng);
            stairs = randomFloorTile(level, rng);
        }
        if (fixEl.checked) keepLargestRegion(level);
        if (!level.isWalkable(spawn.x, spawn.y)) spawn = randomFloorTile(level, rng);
        if (!level.isWalkable(stairs.x, stairs.y)) stairs = randomFloorTile(level, rng);
        level.set(stairs.x, stairs.y, Tile.STAIRS_DOWN);

        monsters = []; items = [];
        for (let i = 0; i < 8; i++) { const p = randomFloorTile(level, rng); const g = rng.pick(MOBS); monsters.push({ x: p.x, y: p.y, ch: g[0], color: g[1] }); }
        for (let i = 0; i < 6; i++) { const p = randomFloorTile(level, rng); const g = rng.pick(ITEMS); items.push({ x: p.x, y: p.y, ch: g[0], color: g[1] }); }

        ff = floodFill(level, spawn.x, spawn.y);
        const total = countWalkable(level);
        const isolated = total - ff.count;
        hud.textContent = `generator: ${typeEl.value} · reachable ${ff.count}/${total}`
            + (isolated === 0 ? ' (all reachable ✓)' : ` (⚠ ${isolated} isolated tiles)`)
            + ` · monsters ${monsters.length} · items ${items.length}`;
        draw();
    }
    function draw() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (reachEl.checked) {                 // tint walkable cells by reachability
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                if (!level.isWalkable(x, y)) continue;
                ctx.fillStyle = ff.seen[level.idx(x, y)] ? 'rgba(63,174,106,0.30)' : 'rgba(239,83,80,0.40)';
                ctx.fillRect(x * cell, y * cell, cell, cell);
            }
        }
        rlDrawEntities(ctx, 0, 0, cell, items.concat(monsters, [{ x: spawn.x, y: spawn.y, ch: '@', color: RL.player }]));
    }
    typeEl.addEventListener('change', gen);
    fixEl.addEventListener('change', gen);
    reachEl.addEventListener('change', draw);
    seedEl.addEventListener('change', gen);
    document.getElementById('rlPopGen').addEventListener('click', gen);
    gen();
})();

// =============================================================================
// DEMO 6 — exploreDungeonDemo : CAPSTONE — a playable, multi-level dungeon
// =============================================================================
(function exploreDungeonDemo() {
    const canvas = document.getElementById('rlExpCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const log = document.getElementById('rlExpLog');
    const hud = document.getElementById('rlExpHud');
    const seedEl = document.getElementById('rlExpSeed');
    const flashes = [];
    const DEPTH_GOAL = 5;
    let baseSeed, rng, level, player, monsters, actors, stairs, depth, turn, state;

    function genLevel() {
        // Deterministic per (seed, depth): the same seed always yields the same descent.
        rng = new RogueRng(baseSeed * 1000 + depth);
        level = new Level(cols, rows, Tile.WALL);
        const rooms = placeRooms(level, rng, { attempts: 30, minSize: 4, maxSize: 7 });
        connectRooms(level, rng, rooms, true);
        keepLargestRegion(level);               // safety: guarantee one connected space
        const spawn = randomFloorIn(level, rng, rooms[0]);
        // Stairs in the room whose center is farthest from spawn.
        let far = rooms[0], best = -1;
        for (const r of rooms) { const d = Math.abs(r.cx - spawn.x) + Math.abs(r.cy - spawn.y); if (d > best) { best = d; far = r; } }
        stairs = randomFloorIn(level, rng, far);
        level.set(stairs.x, stairs.y, Tile.STAIRS_DOWN);

        if (!player) player = { x: spawn.x, y: spawn.y, hp: 30, maxHp: 30, name: 'you' };
        else { player.x = spawn.x; player.y = spawn.y; }

        monsters = [];
        const nMon = 2 + Math.min(3, depth);
        for (let i = 0; i < nMon; i++) {
            const p = randomFloorTile(level, rng);
            if (p.x === spawn.x && p.y === spawn.y) continue;
            monsters.push({ x: p.x, y: p.y, hp: 6, maxHp: 6, name: 'rat', ch: 'r', color: RL.monster });
        }
        actors = [player, ...monsters];
    }
    function reset() {
        baseSeed = readSeed(seedEl);
        depth = 1; turn = 0; state = 'play'; player = null; flashes.length = 0;
        log.innerHTML = '';
        genLevel();
        rlLog(log, `— You enter the dungeon. (seed ${baseSeed}) Reach depth ${DEPTH_GOAL} to escape. —`, 'dim');
        rlLog(log, 'Move with the keys; bump rats to fight; press > on the stairs to descend.', 'dim');
        updateHud();
    }
    function updateHud() {
        const onStairs = level.get(player.x, player.y) === Tile.STAIRS_DOWN;
        const tail = state === 'win' ? ' · 🏆 you escaped — you win!'
                   : state === 'dead' ? ' · 💀 you died — press New game'
                   : onStairs ? ' · press > to descend' : '';
        hud.textContent = `depth ${depth}/${DEPTH_GOAL} · turn ${turn} · HP ${Math.max(0, player.hp)}/${player.maxHp}`
            + ` · rats ${monsters.filter(m => !m.dead).length}` + tail;
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
            const d = rlManhattan(m, player);
            if (d === 1) {
                const dmg = rng.dice(1, 3);
                player.hp -= dmg; rlPushFlash(flashes, player.x, player.y);
                rlLog(log, `The rat bites you for ${dmg}.`, 'mob');
                if (player.hp <= 0) { player.dead = true; state = 'dead'; rlLog(log, 'You die in the dark.', 'warn'); return; }
            } else if (d <= 8) {
                rlTryMove(level, m, rlStepToward(level, m, player, actors), actors);   // chase
            } else if (rng.chance(0.6)) {
                rlTryMove(level, m, rng.pick(RL_STEPS4), actors);                       // wander
            }
        }
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (state !== 'play') return;
        let acted = action.wait ? true : rlTryMove(level, player, action, actors, playerHit) !== 'blocked';
        if (!acted) return;
        monstersTurn();
        turn++;
        updateHud();
    });
    // Dedicated '>' handler to descend (not a movement key).
    canvas.addEventListener('keydown', (e) => {
        if (e.key !== '>') return;
        e.preventDefault();
        if (state !== 'play') return;
        if (level.get(player.x, player.y) !== Tile.STAIRS_DOWN) { rlLog(log, 'There are no stairs here.', 'dim'); return; }
        if (depth >= DEPTH_GOAL) { state = 'win'; rlLog(log, 'You climb the final stair into daylight. You escaped! (You win!)', 'good'); }
        else { depth++; rlLog(log, `You descend to depth ${depth}.`, 'warn'); genLevel(); }
        updateHud();
    });
    document.getElementById('rlExpRestart').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render(now) {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        rlDrawFlashes(ctx, 0, 0, cell, flashes, now);
        rlDrawEntities(ctx, 0, 0, cell, rlEntityList(actors, player));
        for (const m of monsters) if (!m.dead) rlHpBar(ctx, 0, 0, cell, m.x, m.y, m.hp / m.maxHp, RL.bad);
        if (!player.dead) rlHpBar(ctx, 0, 0, cell, player.x, player.y, player.hp / player.maxHp, RL.good);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();
