// ===================================================================
// tower-defense/engine/nav.js
//
// The track's NAVIGATION toolkit — A*, the connectivity guard, flow fields, and
// line-of-sight. These were taught INLINE in the Advanced tier ("Mazing, Flow
// Fields & Sight"); the Expert "Swarm" tier became their 2nd consumer (it steers
// thousands of creeps with `tdFlowField`), so they were PROMOTED here (a *move*,
// the roguelike `vision.js` rule) — both `advanced.html` and `expert.html` load
// this file, and `advanced-demos.js` no longer declares them.
//
//   • tdWalkable     — in-bounds AND not a wall AND not a tower (the one predicate
//                      both pathfinding and flow ask).
//   • tdAStar        — shortest 4-connected grid path (Manhattan heuristic). One
//                      optimal route PER agent from where it is.
//   • tdBlocksPath   — the connectivity guard: would building here seal the goal?
//   • tdFlowField    — ONE Dijkstra/BFS sweep from the goal → an integration field
//                      (distance per cell) + a per-cell downhill vector. One field,
//                      any number of creeps, O(1) lookup each — why it scales.
//   • tdLineOfSight  — a sub-cell raycast; a wall on the segment blocks the shot.
//
// Names (tdWalkable / tdAStar / tdBlocksPath / tdFlowField / tdLineOfSight) are
// pre-checked vs shared/utils.js. No ES modules — attach to `window` at the bottom.
// ===================================================================

// A cell is "walkable" if it's in-bounds and neither a wall (blocked) nor a tower
// (occupied). Pathfinding and flow both ask exactly this.
function tdWalkable(grid, col, row) {
    return grid.inBounds(col, row) && !grid.isBlocked(col, row) && !grid.isOccupied(col, row);
}

// --- tdAStar: shortest grid path, start → goal (4-connected) ------------------
// Textbook A*: a priority frontier ordered by f = g (steps so far) + h (Manhattan
// estimate to the goal). Manhattan is admissible on a 4-connected grid (you can
// never beat it), so A* returns a true shortest path. Returns an array of
// {col,row} cells (inclusive of both ends), or null if the goal is unreachable.
// (The open set uses a linear min-scan — fine for these small grids; a binary heap
// is the upgrade for large ones.)
function tdAStar(grid, start, goal) {
    const cols = grid.cols;
    const key = (c, r) => r * cols + c;
    const h = (c, r) => Math.abs(c - goal.col) + Math.abs(r - goal.row);
    const open = [{ col: start.col, row: start.row, g: 0, f: h(start.col, start.row) }];
    const gScore = new Map([[key(start.col, start.row), 0]]);
    const came = new Map();
    const closed = new Set();
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (open.length) {
        let bi = 0;                                       // extract the lowest-f node
        for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
        const cur = open.splice(bi, 1)[0];
        const ck = key(cur.col, cur.row);
        if (cur.col === goal.col && cur.row === goal.row) {
            const path = [{ col: cur.col, row: cur.row }];  // reconstruct backwards
            let k = ck;
            while (came.has(k)) { const p = came.get(k); path.push({ col: p.col, row: p.row }); k = key(p.col, p.row); }
            return path.reverse();
        }
        if (closed.has(ck)) continue;
        closed.add(ck);
        for (const [dc, dr] of N4) {
            const nc = cur.col + dc, nr = cur.row + dr;
            if (!tdWalkable(grid, nc, nr)) continue;
            const nk = key(nc, nr);
            if (closed.has(nk)) continue;
            const tentative = cur.g + 1;
            if (!gScore.has(nk) || tentative < gScore.get(nk)) {
                gScore.set(nk, tentative);
                came.set(nk, { col: cur.col, row: cur.row });
                open.push({ col: nc, row: nr, g: tentative, f: tentative + h(nc, nr) });
            }
        }
    }
    return null;                                          // no route
}

// --- tdBlocksPath: the connectivity guard ------------------------------------
// "If I drop a tower on (col,row), can creeps still reach the goal?" Tentatively
// occupy the cell, run A* spawn→goal, restore, and report whether it sealed the maze.
function tdBlocksPath(grid, col, row, start, goal) {
    if (!tdWalkable(grid, col, row)) return true;
    grid.occupy(col, row, true);
    const ok = tdAStar(grid, start, goal) !== null;
    grid.occupy(col, row, false);
    return !ok;
}

// --- tdFlowField: a Dijkstra integration field + downhill vectors ------------
// ONE sweep from the goal labels every walkable cell with its distance (in steps)
// to the goal — the "integration field". Then each cell stores a unit vector
// toward its lowest-cost 8-neighbour — the "flow field". A creep anywhere reads its
// cell's vector and walks: one field, any number of creeps, O(1) each. (Uniform
// step cost ⇒ a plain BFS computes the exact distances.)
function tdFlowField(grid, goal) {
    const cols = grid.cols, rows = grid.rows;
    const cost = new Float64Array(cols * rows).fill(Infinity);
    const gi = goal.row * cols + goal.col;
    cost[gi] = 0;
    let frontier = [goal];
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (frontier.length) {                             // BFS = Dijkstra at uniform cost
        const next = [];
        for (const cur of frontier) {
            const cc = cost[cur.row * cols + cur.col];
            for (const [dc, dr] of N4) {
                const nc = cur.col + dc, nr = cur.row + dr;
                if (!tdWalkable(grid, nc, nr)) continue;
                const ni = nr * cols + nc;
                if (cost[ni] === Infinity) { cost[ni] = cc + 1; next.push({ col: nc, row: nr }); }
            }
        }
        frontier = next;
    }
    const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const flow = new Array(cols * rows).fill(null);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        if (cost[i] === Infinity) { flow[i] = { x: 0, y: 0 }; continue; }
        let best = cost[i], bx = 0, by = 0;
        for (const [dc, dr] of N8) {
            const nc = col + dc, nr = row + dr;
            if (!tdWalkable(grid, nc, nr)) continue;
            const c = cost[nr * cols + nc];
            if (c < best) { best = c; bx = dc; by = dr; }
        }
        const m = Math.hypot(bx, by) || 1;
        flow[i] = { x: bx / m, y: by / m };
    }
    return { cost, flow, cols, rows };
}

// --- tdLineOfSight: can a tower see a target through the walls? ---------------
// March the segment in sub-cell steps and fail the moment it crosses a WALL cell
// (the endpoints are skipped — the shooter and target tiles don't block the shot).
function tdLineOfSight(grid, ax, ay, bx, by) {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.ceil(dist / (grid.tile * 0.33)));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const c = grid.worldToCell(ax + (bx - ax) * t, ay + (by - ay) * t);
        if (c && grid.isBlocked(c.col, c.row)) return false;
    }
    return true;
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.tdWalkable = tdWalkable;
    window.tdAStar = tdAStar;
    window.tdBlocksPath = tdBlocksPath;
    window.tdFlowField = tdFlowField;
    window.tdLineOfSight = tdLineOfSight;
}
