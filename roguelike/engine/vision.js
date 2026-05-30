// ===================================================================
// roguelike/engine/vision.js
//
// The sight + pathing algorithms taught in the Advanced tier, promoted to
// shared engine infrastructure once the Expert capstone (and the
// Simulations grand capstone) became their second/third consumers — the
// same "≥ 2 tier files ⇒ engine/" rule that produced actors.js and
// dungeon.js. The Advanced tier still TEACHES these in its code blocks;
// this is the single running implementation everyone shares.
//
//   losLine       — Bresenham line-of-sight ("can A see B?")
//   computeFOV     — recursive shadowcasting field-of-view
//   aStarPath      — A* shortest path (binary-heap open set)
//   dijkstraFrom   — multi-source distance field ("scent map")
//   stepDownhill   — one step toward the smallest neighbour of a field
//
// Top-level `function`/`const` declarations => global, and unit-testable
// straight from the console. Depends on grid.js (Tile/Level).
// ===================================================================

const VIS_DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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
        for (const [dx, dy] of VIS_DIRS4) {
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
        for (const [dx, dy] of VIS_DIRS4) {
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
    for (const [dx, dy] of VIS_DIRS4) {
        const nx = m.x + dx, ny = m.y + dy;
        if (!level.isWalkable(nx, ny)) continue;
        if (actors && rlActorAt(actors, nx, ny, m)) continue;
        const d = dist[ny * W + nx];
        if (d < bestD) { bestD = d; best = { dx, dy }; }
    }
    return best;
}
