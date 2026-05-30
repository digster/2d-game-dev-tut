// ===================================================================
// roguelike/engine/grid.js
//
// The shared spatial core of the whole roguelike track:
//   • Tile        — the integer tile-type enum (WALL, FLOOR, ...).
//   • Level       — a flat-array grid with the handful of queries every
//                   system asks ("is this walkable? does it block sight?").
//   • RL          — the shared colour palette + glyph table (one look
//                   across all five tiers).
//   • drawGlyphGrid — the ASCII renderer: draws a Level (optionally with
//                   entities and a fog-of-war visibility mask) onto a 2D
//                   canvas as monospace glyphs, NetHack/Brogue/DCSS style.
//
// WHY a flat Uint8Array instead of a 2D array of objects:
//   A dungeon is read constantly — FOV scans hundreds of cells per turn,
//   pathfinding thousands. One contiguous typed array is cache-friendly,
//   trivially cloneable (save/replay), and cheap to fill. The (x, y) ->
//   index math (`y * width + x`) is the single most-used line in the track.
//
// Names (Tile / Level / RL / drawGlyphGrid) are pre-checked to NOT collide
// with shared/utils.js (which owns lerp/clamp/map/Vector2D/drawGrid/...).
// ===================================================================

// --- Tile types -----------------------------------------------------
// Integers, not strings: they live in a Uint8Array. Order is arbitrary
// but WALL = 0 matters — a freshly-allocated grid is "solid rock", and
// generators carve FLOOR into it.
const Tile = Object.freeze({
    WALL: 0,
    FLOOR: 1,
    STAIRS_DOWN: 2,
    STAIRS_UP: 3,
    DOOR: 4,
});

// --- Shared palette + glyphs ---------------------------------------
// One object so every tier renders with the same vocabulary. Colours sit
// in the repo's existing dark theme (bg #0d1117, accent cyan #4fc3f7).
const RL = Object.freeze({
    // canvas / structure
    bg:          '#0d1117', // out-of-bounds + unseen void
    grid:        '#161b2c', // faint cell separators (optional)
    // tiles (visible)
    wall:        '#5c6784', // slate
    wallLit:     '#8893b5',
    floor:       '#2b3350',
    floorLit:    '#3a4570',
    stairs:      '#ffd166', // warm gold — you always want to find these
    door:        '#c98a4b', // wood
    // tiles (explored-but-not-visible: the "memory" dim)
    dim:         '#1c2235',
    dimInk:      '#39425f',
    // actors / items
    player:      '#7CF2C8', // bright mint @
    monster:     '#ef5350', // red letters
    monsterCalm: '#9e6b6b', // asleep/idle
    item:        '#fbc02d', // gold
    // ui
    label:       '#e0e0e0',
    labelMuted:  '#9e9e9e',
    accent:      '#4fc3f7',
    good:        '#66bb6a',
    bad:         '#ef5350',
});

// Default glyph + colour for each tile type. Demos can override per-cell,
// but this keeps the baseline consistent.
const TILE_GLYPH = Object.freeze({
    [Tile.WALL]:        { ch: '#', color: RL.wall,   lit: RL.wallLit },
    [Tile.FLOOR]:       { ch: '·', color: RL.floor,  lit: RL.floorLit },
    [Tile.STAIRS_DOWN]: { ch: '>', color: RL.stairs, lit: RL.stairs },
    [Tile.STAIRS_UP]:   { ch: '<', color: RL.stairs, lit: RL.stairs },
    [Tile.DOOR]:        { ch: '+', color: RL.door,   lit: RL.door },
});

// --- The Level grid -------------------------------------------------
class Level {
    /**
     * @param {number} width  in tiles
     * @param {number} height in tiles
     * @param {number} fill   tile to fill with (default WALL = solid rock)
     */
    constructor(width, height, fill = Tile.WALL) {
        this.width = width;
        this.height = height;
        this.tiles = new Uint8Array(width * height);
        if (fill) this.tiles.fill(fill);
    }

    /** (x, y) -> flat index. The track's most-used line. */
    idx(x, y) {
        return y * this.width + x;
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    /** Read a tile. Out-of-bounds reads as WALL so callers never special-case edges. */
    get(x, y) {
        if (!this.inBounds(x, y)) return Tile.WALL;
        return this.tiles[this.idx(x, y)];
    }

    set(x, y, t) {
        if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = t;
    }

    /** Can an actor stand here? Floors, stairs and (open) doors — not walls. */
    isWalkable(x, y) {
        const t = this.get(x, y);
        return t === Tile.FLOOR || t === Tile.STAIRS_DOWN ||
               t === Tile.STAIRS_UP || t === Tile.DOOR;
    }

    /** Does this tile block line-of-sight? Walls do; everything else is clear. */
    isOpaque(x, y) {
        return this.get(x, y) === Tile.WALL;
    }

    /** A deep copy — used by save/replay and by generators that try variants. */
    clone() {
        const c = new Level(this.width, this.height, 0);
        c.tiles.set(this.tiles);
        return c;
    }

    /** Count tiles matching a type — handy for connectivity checks / stats. */
    count(tile) {
        let n = 0;
        for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === tile) n++;
        return n;
    }
}

// --- The ASCII renderer ---------------------------------------------
/**
 * Draw a Level onto a 2D canvas as monospace glyphs.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Level} level
 * @param {Object} [opts]
 * @param {number}  [opts.cell=22]      pixel size of one tile cell
 * @param {number}  [opts.originX=0]    top-left pixel offset
 * @param {number}  [opts.originY=0]
 * @param {Array}   [opts.entities]     [{x,y,ch,color}] drawn on top of tiles
 * @param {Function}[opts.visible]      (x,y)->bool. Omit = everything visible.
 * @param {Function}[opts.explored]     (x,y)->bool. Cells explored but not
 *                                       currently visible render DIMMED.
 *                                       Omit (with visible omitted) = no fog.
 * @param {boolean} [opts.showGrid]     draw faint cell separators
 * @param {Object}  [opts.glyphAt]      optional (x,y)->{ch,color} override
 */
function drawGlyphGrid(ctx, level, opts = {}) {
    const cell = opts.cell || 22;
    const ox = opts.originX || 0;
    const oy = opts.originY || 0;
    const visible = opts.visible || null;     // null => no FOV, draw all lit
    const explored = opts.explored || null;
    const showGrid = !!opts.showGrid;

    // Clear the whole drawable region to the void colour first.
    ctx.fillStyle = RL.bg;
    ctx.fillRect(ox, oy, level.width * cell, level.height * cell);

    ctx.font = `${Math.floor(cell * 0.82)}px "Courier New", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
            // Fog state: 'visible' | 'remembered' | 'unseen'.
            let state = 'visible';
            if (visible) {
                if (visible(x, y)) state = 'visible';
                else if (explored && explored(x, y)) state = 'remembered';
                else state = 'unseen';
            }
            if (state === 'unseen') continue; // leave it as bg void

            const px = ox + x * cell + cell / 2;
            const py = oy + y * cell + cell / 2;

            // Per-cell override wins (used for highlights, debug overlays).
            let ch, color;
            if (opts.glyphAt) {
                const g = opts.glyphAt(x, y);
                if (g) { ch = g.ch; color = g.color; }
            }
            if (ch === undefined) {
                const base = TILE_GLYPH[level.get(x, y)] || TILE_GLYPH[Tile.FLOOR];
                ch = base.ch;
                color = state === 'visible' ? base.lit : RL.dimInk;
                // Give visible floors a faint tinted backing so lit areas
                // read as "you can see here" without drawing every dot bright.
                if (state === 'visible' && level.get(x, y) === Tile.FLOOR) {
                    ctx.fillStyle = RL.floor;
                    ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
                }
            }

            ctx.fillStyle = color;
            ctx.fillText(ch, px, py);
        }
    }

    // Entities (player, monsters, items) — only where currently visible.
    if (opts.entities) {
        for (const e of opts.entities) {
            if (visible && !visible(e.x, e.y)) continue;
            const px = ox + e.x * cell + cell / 2;
            const py = oy + e.y * cell + cell / 2;
            ctx.fillStyle = e.color || RL.label;
            ctx.fillText(e.ch || '?', px, py);
        }
    }

    if (showGrid) {
        ctx.strokeStyle = RL.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= level.width; x++) {
            ctx.moveTo(ox + x * cell + 0.5, oy);
            ctx.lineTo(ox + x * cell + 0.5, oy + level.height * cell);
        }
        for (let y = 0; y <= level.height; y++) {
            ctx.moveTo(ox, oy + y * cell + 0.5);
            ctx.lineTo(ox + level.width * cell, oy + y * cell + 0.5);
        }
        ctx.stroke();
    }
}

// Expose the engine core on window. Tier-demo files use these directly;
// names pre-checked against shared/utils.js to avoid the "already declared"
// load-time collision documented in ARCHITECTURE.md.
window.Tile = Tile;
window.Level = Level;
window.RL = RL;
window.TILE_GLYPH = TILE_GLYPH;
window.drawGlyphGrid = drawGlyphGrid;
