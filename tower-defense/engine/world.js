// ===================================================================
// tower-defense/engine/world.js
//
// The MAP SUBSTRATE of the whole Tower Defense track — the two things every tier
// builds on, and nothing more:
//
//   • TDGrid — the tile grid the map lives on. Converts between world pixels and
//              integer cells, tracks which cells are BLOCKED (can never hold a
//              tower — e.g. the lane corridor) and which are OCCUPIED (currently
//              hold one), and answers the one question tower placement asks:
//              `isBuildable(col,row)`. It does NOT know about pathfinding — A* and
//              flow fields are the Advanced tier's *lesson*, layered on top.
//
//   • TDPath — the route creeps follow. Built from waypoints, optionally smoothed
//              into a Catmull-Rom curve, then ARC-LENGTH parameterized: it
//              precomputes a dense polyline + a cumulative-distance table so a
//              creep can follow it by advancing a single scalar `dist += speed*dt`
//              and asking `pointAt(dist)`. This cleanly separates speed (px/s,
//              frame-rate independent) from geometry (the shape of the lane), and
//              makes "reached the goal" a trivial `dist >= length` test.
//
// WHY the substrate stops here (mirrors PZWorld / BHField being pure integrators):
//   The genre's actual lessons — how a tower picks a target, how a projectile
//   leads a moving creep, how enemies re-route around towers (A*) or flow across
//   an open field — are TAUGHT on top of this map in the tier that introduces
//   them, then promoted to the engine only on their genuine 2nd consumer. Keeping
//   the map dumb keeps those lessons honest.
//
// Names (TDGrid / TDPath) are pre-checked vs shared/utils.js. The path geometry
// returns PLAIN {x,y} objects (not Vector2D) on purpose: these are read-only
// queries, and Vector2D mutates in place — handing out a Vector2D invites a demo
// to accidentally mutate the cached polyline. Wrap in `new Vector2D(p.x,p.y)` at
// the call site if you need vector maths. No ES modules — attach to `window`.
// ===================================================================

// --- TDGrid: the tile grid + buildability ---------------------------
class TDGrid {
    // cols × rows tiles of `tile` pixels each, top-left at (originX, originY).
    constructor(cols, rows, tile, originX = 0, originY = 0) {
        this.cols = cols;
        this.rows = rows;
        this.tile = tile;
        this.originX = originX;
        this.originY = originY;
        // Flat Uint8Arrays, row-major (index = row*cols + col), like the voxel /
        // roguelike grids. 1 = set, 0 = clear.
        this.blocked = new Uint8Array(cols * rows);  // permanently un-buildable (the lane)
        this.occupied = new Uint8Array(cols * rows);  // currently holds a tower
    }

    idx(col, row) { return row * this.cols + col; }
    inBounds(col, row) { return col >= 0 && col < this.cols && row >= 0 && row < this.rows; }

    // World pixel → integer cell, or null if outside the grid.
    worldToCell(x, y) {
        const col = Math.floor((x - this.originX) / this.tile);
        const row = Math.floor((y - this.originY) / this.tile);
        return this.inBounds(col, row) ? { col, row } : null;
    }

    // Cell → the world pixel at its CENTRE (where a tower sits / a range ring centres).
    cellCenter(col, row) {
        return {
            x: this.originX + (col + 0.5) * this.tile,
            y: this.originY + (row + 0.5) * this.tile,
        };
    }

    // Cell → its top-left world pixel (for drawing the tile rect).
    cellOrigin(col, row) {
        return { x: this.originX + col * this.tile, y: this.originY + row * this.tile };
    }

    isBlocked(col, row) { return !this.inBounds(col, row) || !!this.blocked[this.idx(col, row)]; }
    setBlocked(col, row, v = true) { if (this.inBounds(col, row)) this.blocked[this.idx(col, row)] = v ? 1 : 0; }

    isOccupied(col, row) { return this.inBounds(col, row) && !!this.occupied[this.idx(col, row)]; }
    occupy(col, row, v = true) { if (this.inBounds(col, row)) this.occupied[this.idx(col, row)] = v ? 1 : 0; }

    // The single question tower placement asks: a free, in-bounds, non-lane tile.
    isBuildable(col, row) {
        return this.inBounds(col, row) && !this.blocked[this.idx(col, row)] && !this.occupied[this.idx(col, row)];
    }

    // Stamp the lane onto `blocked` so towers can't be built on the path. We must
    // mark EVERY cell the lane crosses, not just the polyline vertices — a raw
    // waypoint path only has points at its corners, so a straight segment between
    // two corners would leave the cells along it un-blocked. So we march each
    // segment in sub-tile steps (< 1 tile apart, so no cell can be skipped — the
    // same idea as a Bresenham line walk). `pad` widens the corridor by N tiles.
    blockAlongPath(path, pad = 0) {
        const pts = path.points;
        const step = Math.max(1, this.tile * 0.4);
        const stamp = (x, y) => {
            const c = this.worldToCell(x, y);
            if (!c) return;
            for (let dr = -pad; dr <= pad; dr++) {
                for (let dc = -pad; dc <= pad; dc++) {
                    this.setBlocked(c.col + dc, c.row + dr, true);
                }
            }
        };
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
            for (let k = 0; k <= n; k++) {
                const t = k / n;
                stamp(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
            }
        }
    }

    clearOccupancy() { this.occupied.fill(0); }
}

// --- Catmull-Rom sampling (module-local helper) ---------------------
// A Catmull-Rom spline passes THROUGH its control points (unlike a Bézier whose
// handles only pull toward them), which is exactly what you want for a hand-drawn
// lane: drop waypoints, get a smooth curve through them. For segment Pi→Pi+1 it
// uses the four points Pi-1,Pi,Pi+1,Pi+2; the ends duplicate the endpoints so the
// curve starts/stops cleanly. Returns a dense polyline of {x,y}.
function tdSampleCatmullRom(pts, samplesPerSeg) {
    if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
        const p0 = pts[i === 0 ? 0 : i - 1];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2 < n ? i + 2 : n - 1];
        for (let s = 0; s < samplesPerSeg; s++) {
            const t = s / samplesPerSeg;
            const t2 = t * t, t3 = t2 * t;
            // Standard Catmull-Rom basis (tension 0.5).
            out.push({
                x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
            });
        }
    }
    out.push({ x: pts[n - 1].x, y: pts[n - 1].y }); // include the final endpoint
    return out;
}

// --- TDPath: an arc-length-parameterized route ----------------------
class TDPath {
    // waypoints: [{x,y}, ...] in world pixels (≥2). opts:
    //   smooth        — round the corners with Catmull-Rom (curved lane) vs raw segments
    //   samplesPerSeg — spline resolution when smooth (default 16)
    constructor(waypoints, opts = {}) {
        const smooth = opts.smooth ?? false;
        this.points = smooth
            ? tdSampleCatmullRom(waypoints, opts.samplesPerSeg ?? 16)
            : waypoints.map((p) => ({ x: p.x, y: p.y }));

        // Cumulative arc length at each polyline vertex: cum[i] = distance from the
        // start to points[i]. cum[last] is the total length. This table is what
        // turns a scalar distance into an (x,y) in O(log n).
        this.cum = [0];
        for (let i = 1; i < this.points.length; i++) {
            const a = this.points[i - 1], b = this.points[i];
            this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
        }
        this.length = this.cum[this.cum.length - 1] || 0;
    }

    get start() { return this.points[0]; }
    get end() { return this.points[this.points.length - 1]; }

    // Position at arc-length `dist` (clamped to [0,length]). Binary-search the
    // cumulative table for the straddling segment, then lerp within it.
    pointAt(dist) {
        const d = Math.max(0, Math.min(dist, this.length));
        const cum = this.cum;
        let lo = 0, hi = cum.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] < d) lo = mid + 1; else hi = mid;
        }
        const i = Math.max(1, lo);
        const segLen = cum[i] - cum[i - 1];
        const t = segLen > 1e-9 ? (d - cum[i - 1]) / segLen : 0;
        const a = this.points[i - 1], b = this.points[i];
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    // Unit heading at arc-length `dist` (the direction a creep faces there).
    tangentAt(dist) {
        const a = this.pointAt(Math.max(0, dist - 1));
        const b = this.pointAt(Math.min(this.length, dist + 1));
        const dx = b.x - a.x, dy = b.y - a.y;
        const m = Math.hypot(dx, dy) || 1;
        return { x: dx / m, y: dy / m };
    }
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.TDGrid = TDGrid;
    window.TDPath = TDPath;
    window.tdSampleCatmullRom = tdSampleCatmullRom;
}
