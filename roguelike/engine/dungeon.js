// ===================================================================
// roguelike/engine/dungeon.js
//
// Reusable dungeon generation — the rooms-and-corridors generator taught
// from scratch in the Intermediate tier, now packaged as shared engine
// infrastructure for the Advanced tier and beyond (FOV, fog, pathing, and
// the capstones all need a dungeon to play in).
//
// This is the ARCHITECTURE.md "≥ 2 tier files ⇒ promote to engine/" rule:
// the Intermediate tier *teaches* generation inline (placeRooms, connect,
// BSP, flood-fill — visualised step by step); once a 2nd/3rd tier just
// *needs a dungeon*, the clean version lives here. All names are `dg`-
// prefixed so they don't collide with the Intermediate tier's inline
// teaching copies (which only ever load on intermediate.html anyway).
//
// Depends on grid.js (Tile/Level). Bare `function` declarations => global.
// ===================================================================

const DG_STEPS4 = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

function dgMkRoom(x, y, w, h) { return { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) }; }
function dgCarveRoom(level, r) {
    for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++)
            level.set(x, y, Tile.FLOOR);
}
function dgOverlap(a, b, m) {
    return a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y;
}
function dgCarveH(level, x1, x2, y) { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) level.set(x, y, Tile.FLOOR); }
function dgCarveV(level, y1, y2, x) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) level.set(x, y, Tile.FLOOR); }

function dgPlaceRooms(level, rng, opts) {
    const rooms = [];
    const attempts = opts.attempts || 30, minSize = opts.minSize || 4, maxSize = opts.maxSize || 8;
    for (let i = 0; i < attempts; i++) {
        const w = rng.between(minSize, maxSize), h = rng.between(minSize, maxSize);
        const x = rng.between(1, level.width - w - 1), y = rng.between(1, level.height - h - 1);
        const room = dgMkRoom(x, y, w, h);
        if (rooms.some(r => dgOverlap(r, room, 1))) continue;
        dgCarveRoom(level, room);
        rooms.push(room);
    }
    return rooms;
}
function dgConnect(level, rng, rooms, randomElbow) {
    for (let i = 1; i < rooms.length; i++) {
        const a = rooms[i - 1], b = rooms[i];
        if (randomElbow && rng.chance(0.5)) { dgCarveH(level, a.cx, b.cx, a.cy); dgCarveV(level, a.cy, b.cy, b.cx); }
        else { dgCarveV(level, a.cy, b.cy, a.cx); dgCarveH(level, a.cx, b.cx, b.cy); }
    }
}

// --- connectivity (flood fill / regions) ---
function dgFloodFill(level, sx, sy) {
    const seen = new Uint8Array(level.width * level.height);
    if (!level.isWalkable(sx, sy)) return { seen, count: 0 };
    const q = [[sx, sy]]; seen[level.idx(sx, sy)] = 1; let count = 0;
    while (q.length) {
        const [x, y] = q.pop(); count++;
        for (const s of DG_STEPS4) {
            const nx = x + s.dx, ny = y + s.dy;
            if (level.isWalkable(nx, ny) && !seen[level.idx(nx, ny)]) { seen[level.idx(nx, ny)] = 1; q.push([nx, ny]); }
        }
    }
    return { seen, count };
}
function dgRegions(level) {
    const seen = new Uint8Array(level.width * level.height), regions = [];
    for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
        if (seen[level.idx(x, y)] || !level.isWalkable(x, y)) continue;
        const region = [], q = [[x, y]]; seen[level.idx(x, y)] = 1;
        while (q.length) {
            const [cx, cy] = q.pop(); region.push(level.idx(cx, cy));
            for (const s of DG_STEPS4) {
                const nx = cx + s.dx, ny = cy + s.dy;
                if (level.isWalkable(nx, ny) && !seen[level.idx(nx, ny)]) { seen[level.idx(nx, ny)] = 1; q.push([nx, ny]); }
            }
        }
        regions.push(region);
    }
    return regions;
}
function dgKeepLargest(level) {
    const regions = dgRegions(level);
    if (regions.length <= 1) return;
    regions.sort((a, b) => b.length - a.length);
    for (let r = 1; r < regions.length; r++) for (const i of regions[r]) level.tiles[i] = Tile.WALL;
}

function dgRandomFloorIn(level, rng, room) {
    for (let t = 0; t < 60; t++) {
        const x = rng.between(room.x, room.x + room.w - 1), y = rng.between(room.y, room.y + room.h - 1);
        if (level.isWalkable(x, y)) return { x, y };
    }
    return { x: room.cx, y: room.cy };
}
function dgRandomFloorTile(level, rng) {
    for (let t = 0; t < 800; t++) {
        const x = rng.between(1, level.width - 2), y = rng.between(1, level.height - 2);
        if (level.isWalkable(x, y)) return { x, y };
    }
    for (let i = 0; i < level.tiles.length; i++)
        if (level.isWalkable(i % level.width, (i / level.width) | 0)) return { x: i % level.width, y: (i / level.width) | 0 };
    return { x: 1, y: 1 };
}
function dgFarthestRoom(rooms, from) {
    let far = rooms[0] || null, best = -1;
    for (const r of rooms) {
        const d = Math.abs(r.cx - from.x) + Math.abs(r.cy - from.y);
        if (d > best) { best = d; far = r; }
    }
    return far;
}

// The one call most consumers want: a connected dungeon with a spawn + stairs.
// Returns { level, rooms, spawn, stairs }.
function generateDungeon(width, height, rng, opts = {}) {
    const level = new Level(width, height, Tile.WALL);
    const rooms = dgPlaceRooms(level, rng, opts);
    dgConnect(level, rng, rooms, opts.randomElbow !== false);
    dgKeepLargest(level);
    let spawn = rooms.length ? dgRandomFloorIn(level, rng, rooms[0]) : dgRandomFloorTile(level, rng);
    if (!level.isWalkable(spawn.x, spawn.y)) spawn = dgRandomFloorTile(level, rng);
    const far = dgFarthestRoom(rooms, spawn);
    let stairs = far ? dgRandomFloorIn(level, rng, far) : dgRandomFloorTile(level, rng);
    if (!level.isWalkable(stairs.x, stairs.y)) stairs = dgRandomFloorTile(level, rng);
    level.set(stairs.x, stairs.y, Tile.STAIRS_DOWN);
    return { level, rooms, spawn, stairs };
}
