// ===================================================================
// platformer/engine/tilemap.js
//
// The spatial core of the whole Platformer track:
//   • PFTile      — the integer tile-type enum (EMPTY, SOLID, ONE_WAY, ...).
//   • TileMap     — a flat-array grid of tiles + the (x,y)<->(col,row)
//                   conversions and the one query collision asks the most:
//                   "is the tile at this column/row solid?"
//   • PF          — the shared colour palette (one look across all five tiers).
//   • drawTileMap — the renderer: paints a TileMap as coloured blocks onto a
//                   2D canvas (solids as filled cells, one-ways as a thin top
//                   ledge, slopes as triangles), with an optional camera offset.
//
// WHY a flat Uint8Array instead of a 2D array of objects:
//   A platformer reads the map constantly — collision resolves against it every
//   fixed step, the renderer scans it every frame. One contiguous typed array is
//   cache-friendly, trivially cloneable, and cheap to fill. The (col,row) ->
//   index math (`row * cols + col`) is the single most-used line in the track.
//
// Names (PFTile / TileMap / PF / drawTileMap) are pre-checked to NOT collide
// with shared/utils.js (which owns lerp/clamp/map/Vector2D/drawGrid/...). No ES
// modules — every page loads this via <script src>, so the public names are
// attached to `window` at the bottom.
// ===================================================================

// --- Tile types -----------------------------------------------------
// Integers, not strings: they live in a Uint8Array. EMPTY = 0 matters — a
// freshly-allocated map is "open air", and level builders stamp SOLID into it.
// The full vocabulary is declared once here so the enum never has to change as
// later tiers come online; the scaffold's collision only treats SOLID as solid,
// and the Advanced tier teaches ONE_WAY / SLOPE handling on top of that.
const PFTile = Object.freeze({
    EMPTY:    0, // air — you move freely through it
    SOLID:    1, // a full block — collides on all four sides
    ONE_WAY:  2, // a platform you land on from above but pass through otherwise (Advanced)
    SLOPE_NE: 3, // 45° slope, low on the left, high on the right (Advanced)
    SLOPE_NW: 4, // 45° slope, high on the left, low on the right (Advanced)
});

// --- Shared palette -------------------------------------------------
// One object so every tier renders with the same vocabulary. Colours sit in the
// repo's existing dark theme (bg #0d1117, accent cyan #4fc3f7 / player #7CF2C8).
const PF = Object.freeze({
    // canvas / structure
    bg:        '#0d1117', // background / out-of-bounds void
    grid:      '#1b2235', // faint cell separators (optional)
    // tiles
    solid:     '#3a4570', // a full block
    solidLit:  '#4a5788', // block top edge highlight
    oneWay:    '#c98a4b', // wooden one-way platform
    slope:     '#3a4570', // slopes share the solid colour
    // actors
    player:    '#7CF2C8', // cyan-green — matches the repo accent family
    playerDk:  '#3fae8e', // player outline / shaded side
    enemy:     '#ef5350', // red
    item:      '#ffd166', // gold
    // ui / accents
    text:      '#c9d1d9',
    dim:       '#6b7488',
    good:      '#66bb6a',
    warn:      '#ffa726',
    bad:       '#ef5350',
    accent:    '#4fc3f7',
});

// --- TileMap: a flat grid of tiles ----------------------------------
class TileMap {
    // cols × rows tiles, each `tileSize` pixels square. `fill` seeds every cell.
    constructor(cols, rows, tileSize = 16, fill = PFTile.EMPTY) {
        this.cols = cols;
        this.rows = rows;
        this.tileSize = tileSize;
        this.tiles = new Uint8Array(cols * rows).fill(fill);
    }

    // (col, row) -> flat index. The single most-used line in the track.
    idx(c, r) { return r * this.cols + c; }

    inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }

    // Out-of-bounds reads as EMPTY (air): unlike a roguelike, a platformer
    // character can run off the edge of the level and fall — levels add their
    // own border walls where they want to be enclosed.
    get(c, r) {
        if (!this.inBounds(c, r)) return PFTile.EMPTY;
        return this.tiles[this.idx(c, r)];
    }

    set(c, r, t) {
        if (!this.inBounds(c, r)) return;
        this.tiles[this.idx(c, r)] = t;
    }

    // "Does this cell block movement on all sides?" Only full SOLID blocks do.
    // ONE_WAY and slopes are *conditionally* solid — those rules are taught in
    // the Advanced tier, on top of this primitive.
    isSolid(c, r) { return this.get(c, r) === PFTile.SOLID; }

    // Pixel <-> tile conversions. Floor() so a position anywhere inside a tile
    // maps to that tile's column/row.
    colAt(x) { return Math.floor(x / this.tileSize); }
    rowAt(y) { return Math.floor(y / this.tileSize); }

    // Stamp a solid rectangle of tiles (inclusive). Handy for hand-built levels.
    fillRect(c0, r0, c1, r1, t = PFTile.SOLID) {
        for (let r = r0; r <= r1; r++)
            for (let c = c0; c <= c1; c++) this.set(c, r, t);
    }

    clone() {
        const m = new TileMap(this.cols, this.rows, this.tileSize);
        m.tiles.set(this.tiles);
        return m;
    }
}

// --- drawTileMap: the renderer --------------------------------------
// Paints `map` onto a 2D context as coloured blocks. Options:
//   originX / originY : camera offset in pixels (world -> screen). The renderer
//                       subtracts these so a scrolling camera Just Works.
//   showGrid          : faint cell separators (teaching aid).
//   cullToCanvas      : only iterate the tiles visible on the canvas (the
//                       Simulations-tier optimisation — on by default, it's free).
// The renderer is intentionally dumb: it knows only how to paint tiles, never
// game state. Every tier reuses it.
function drawTileMap(ctx, map, opts = {}) {
    const {
        originX = 0,
        originY = 0,
        showGrid = false,
        cullToCanvas = true,
    } = opts;
    const ts = map.tileSize;

    // Viewport culling: clamp the iterated range to the tiles on screen. With a
    // big scrolling map this is the difference between drawing 100 tiles and
    // 100,000. The Simulations tier makes this idea its own demo.
    let c0 = 0, r0 = 0, c1 = map.cols - 1, r1 = map.rows - 1;
    if (cullToCanvas) {
        c0 = Math.max(0, Math.floor(originX / ts));
        r0 = Math.max(0, Math.floor(originY / ts));
        c1 = Math.min(map.cols - 1, Math.floor((originX + ctx.canvas.width) / ts));
        r1 = Math.min(map.rows - 1, Math.floor((originY + ctx.canvas.height) / ts));
    }

    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            const t = map.get(c, r);
            if (t === PFTile.EMPTY) continue;
            const sx = Math.round(c * ts - originX);
            const sy = Math.round(r * ts - originY);

            if (t === PFTile.SOLID) {
                ctx.fillStyle = PF.solid;
                ctx.fillRect(sx, sy, ts, ts);
                // a 2px lit top edge gives blocks a readable "surface"
                ctx.fillStyle = PF.solidLit;
                ctx.fillRect(sx, sy, ts, 2);
            } else if (t === PFTile.ONE_WAY) {
                ctx.fillStyle = PF.oneWay;
                ctx.fillRect(sx, sy, ts, Math.max(3, ts * 0.22));
            } else if (t === PFTile.SLOPE_NE || t === PFTile.SLOPE_NW) {
                ctx.fillStyle = PF.slope;
                ctx.beginPath();
                if (t === PFTile.SLOPE_NE) {
                    // solid in the lower-right triangle (rises to the right)
                    ctx.moveTo(sx, sy + ts);
                    ctx.lineTo(sx + ts, sy);
                    ctx.lineTo(sx + ts, sy + ts);
                } else {
                    // solid in the lower-left triangle (rises to the left)
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(sx + ts, sy + ts);
                    ctx.lineTo(sx, sy + ts);
                }
                ctx.closePath();
                ctx.fill();
            }

            if (showGrid) {
                ctx.strokeStyle = PF.grid;
                ctx.lineWidth = 1;
                ctx.strokeRect(sx + 0.5, sy + 0.5, ts, ts);
            }
        }
    }
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.PFTile = PFTile;
    window.PF = PF;
    window.TileMap = TileMap;
    window.drawTileMap = drawTileMap;
}
