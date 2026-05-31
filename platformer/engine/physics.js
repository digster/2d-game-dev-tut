// ===================================================================
// platformer/engine/physics.js
//
// The single most-reused primitive in the whole track: moving an axis-aligned
// box through a tile grid and resolving it against the solid tiles, ONE AXIS AT
// A TIME. Everything a platformer character does — walking, landing, bonking a
// wall, hitting a ceiling — falls out of this one function.
//
//   • AABB           — an axis-aligned bounding box (top-left x,y + w,h) with a
//                      few convenience getters.
//   • moveAndCollide — move an AABB by (vx, vy) through a TileMap and snap it out
//                      of any SOLID tiles it ends up overlapping. Returns which
//                      sides touched something this step.
//
// WHY resolve one axis at a time (move X & resolve, THEN move Y & resolve):
//   If you move both axes at once and then push out along the smallest overlap,
//   a character sliding along a floor catches on the vertical seams between
//   tiles and stutters. Doing X first, then Y, makes "walk into a wall" and
//   "land on a floor" two clean, independent cases — the technique every 2D
//   platformer uses. (Maddy Thorson's "Celeste & TowerFall physics" post is the
//   canonical writeup of why.)
//
// SCOPE: this resolver treats only PFTile.SOLID as solid. One-way platforms and
// slopes are *conditional* collisions — the Advanced tier teaches those as
// extensions on top of this, kept inline there (they're the lesson, not shared
// infrastructure), per the track's "teach tier-specific algorithms inline" rule.
//
// Names (AABB / moveAndCollide) are pre-checked to NOT collide with
// shared/utils.js. Public names attach to `window` at the bottom.
// ===================================================================

// A tiny epsilon so a box whose edge sits exactly on a tile boundary doesn't
// "leak" into the neighbouring tile when we compute the row/column span it
// overlaps. Without it, a box exactly `h` tall standing on a floor would be read
// as also overlapping the tile one row below.
const PF_EPS = 1e-4;

// --- AABB: an axis-aligned bounding box -----------------------------
// (x, y) is the TOP-LEFT corner, matching canvas coordinates (y grows down).
class AABB {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
    get left()   { return this.x; }
    get right()  { return this.x + this.w; }
    get top()    { return this.y; }
    get bottom() { return this.y + this.h; }
    get cx()     { return this.x + this.w / 2; }
    get cy()     { return this.y + this.h / 2; }

    // Standard overlap test (touching edges do NOT count as overlapping).
    intersects(o) {
        return this.x < o.x + o.w && this.x + this.w > o.x &&
               this.y < o.y + o.h && this.y + this.h > o.y;
    }
}

// --- moveAndCollide: the core resolver ------------------------------
// Mutates `box` in place by (vx, vy), resolving against the SOLID tiles of
// `map`. Returns a `hit` record of which sides made contact this step:
//
//   { left, right, up, down }   (booleans)
//
// `hit.down` is what "am I standing on the ground?" reads from — it's the
// foundation of jump logic, coyote time, and every state machine later.
//
// The box may be larger or smaller than a tile; the loops walk the full span of
// rows/columns it overlaps, so a tall character is handled correctly.
//
// CONTRACT — sub-tile steps: this is a PER-STEP resolver. It checks only the
// leading edge at the box's NEW position, so it assumes |vx| and |vy| are each
// smaller than one tile in a single call. That holds for normal per-frame motion
// under a terminal-velocity clamp (which the Beginner tier adds). A single step
// larger than a tile can tunnel straight through a thin wall — the classic
// high-speed collision problem the Simulations tier solves with swept / CCD.
function moveAndCollide(box, vx, vy, map) {
    const ts = map.tileSize;
    const hit = { left: false, right: false, up: false, down: false };

    // ---------- X axis ----------
    box.x += vx;
    if (vx !== 0) {
        // rows the box overlaps after the horizontal move
        const top = map.rowAt(box.top);
        const bottom = map.rowAt(box.bottom - PF_EPS);
        if (vx > 0) {
            // moving right: the leading edge is the box's right side
            const col = map.colAt(box.right - PF_EPS);
            for (let r = top; r <= bottom; r++) {
                if (map.isSolid(col, r)) {
                    box.x = col * ts - box.w;   // snap so right edge kisses the wall
                    hit.right = true;
                    break;
                }
            }
        } else {
            // moving left: the leading edge is the box's left side
            const col = map.colAt(box.left);
            for (let r = top; r <= bottom; r++) {
                if (map.isSolid(col, r)) {
                    box.x = (col + 1) * ts;     // snap so left edge kisses the wall
                    hit.left = true;
                    break;
                }
            }
        }
    }

    // ---------- Y axis ----------
    // Uses the ALREADY-CORRECTED box.x, so the column span is accurate after the
    // horizontal resolution above — this ordering is the whole point.
    box.y += vy;
    if (vy !== 0) {
        const left = map.colAt(box.left);
        const right = map.colAt(box.right - PF_EPS);
        if (vy > 0) {
            // moving down: the leading edge is the box's bottom
            const row = map.rowAt(box.bottom - PF_EPS);
            for (let c = left; c <= right; c++) {
                if (map.isSolid(c, row)) {
                    box.y = row * ts - box.h;   // snap so feet rest on the floor
                    hit.down = true;
                    break;
                }
            }
        } else {
            // moving up: the leading edge is the box's top
            const row = map.rowAt(box.top);
            for (let c = left; c <= right; c++) {
                if (map.isSolid(c, row)) {
                    box.y = (row + 1) * ts;     // snap so head kisses the ceiling
                    hit.up = true;
                    break;
                }
            }
        }
    }

    return hit;
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.PF_EPS = PF_EPS;
    window.AABB = AABB;
    window.moveAndCollide = moveAndCollide;
}
