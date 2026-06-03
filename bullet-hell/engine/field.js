// ===================================================================
// bullet-hell/engine/field.js
//
// The bullet substrate of the whole Bullet Hell track:
//   • BHBullet — one bullet. A moving point with a radius and a colour. It can
//                optionally TURN (angular velocity on its heading) and
//                ACCELERATE (change speed along its heading); both knobs are
//                ZERO by default, so a plain bullet flies dead straight. The
//                Intermediate tier's "curved paths" lesson is just switching
//                those knobs on — the mechanism lives here, the artistry there.
//   • BHField  — a bag of bullets + the playfield rectangle. Its ONE job is to
//                ADVANCE bullets each fixed step and CULL the ones that leave the
//                field (+ a margin). It does NOT do collision.
//
// WHY the field only moves + culls (and does NOT collide with the player):
//   Hit/graze detection is the *lesson* of the Beginner tier ("hitbox vs
//   graze-box" is the genre's whole identity), so it's taught inline there as
//   `bhHitTest` / `bhGrazeTest` on top of this substrate — exactly the way the
//   Physics Puzzle track keeps `PZWorld` a pure integrator and teaches collision
//   on top. Later tiers layer emitters, boss scripts and a spatial hash on the
//   same field. (The Expert tier re-implements BHField's internals as a pooled,
//   Struct-of-Arrays store for 10k bullets — the public surface below is the
//   contract that upgrade must preserve.)
//
// ⚠️  Vector2D mutates in place — `add`/`multiply`/`rotate`/`normalize` change
//   `this`; only `subtract`/`copy` return new. A bullet OWNS its own `pos`/`vel`,
//   so mutating those is fine; but we still `.copy()` `vel` before scaling it for
//   the position update so we never accidentally rescale the velocity itself.
//
// Names (BHBullet / BHField) are pre-checked vs shared/utils.js. No ES modules —
// attach to `window` at the bottom.
// ===================================================================

// --- BHBullet: one bullet -------------------------------------------
class BHBullet {
    // (x, y) is the bullet CENTRE; (vx, vy) its velocity in px/s.
    // opts: { radius, color, turn (rad/s), accel (px/s²), tag }
    constructor(x, y, vx, vy, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.vel = new Vector2D(vx, vy);
        this.radius = opts.radius ?? 4;
        this.color = opts.color || null;     // null → renderer picks the default
        // Curved-path knobs — INERT (0) until the Intermediate tier sets them.
        this.turn = opts.turn ?? 0;          // spin the heading: rad/s
        this.accel = opts.accel ?? 0;        // change speed along heading: px/s²
        this.tag = opts.tag || null;         // free-form label ('aimed', 'spiral', …)
        this.age = 0;                        // seconds alive (handy for fade-in / timed behaviour)
    }
}

// --- BHField: the bullet container + integrator ---------------------
class BHField {
    // bounds: { x, y, w, h } — the playfield rect, in canvas pixels.
    // opts.margin — how far past the edge a bullet travels before it's culled
    //               (so bullets don't pop the instant they touch the border).
    constructor(bounds, opts = {}) {
        this.bounds = bounds;
        this.margin = opts.margin ?? 24;
        this.bullets = []; // live bullets — a plain array (Expert upgrades this)
    }

    // Spawn a bullet and return it (so the caller can keep a handle if needed).
    spawn(x, y, vx, vy, opts = {}) {
        const b = new BHBullet(x, y, vx, vy, opts);
        this.bullets.push(b);
        return b;
    }

    // Advance every bullet by one fixed step `dt`, then drop any that have left
    // the playfield. Iterate BACKWARDS so in-place removal doesn't skip a bullet.
    step(dt) {
        const { x, y, w, h } = this.bounds;
        const m = this.margin;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];

            // 1) optional curving — both no-ops while turn/accel are 0.
            if (b.turn) b.vel.rotate(b.turn * dt);          // spin the heading
            if (b.accel) {                                  // change speed along it
                const s = b.vel.length();
                if (s > 1e-6) {
                    const ns = Math.max(0, s + b.accel * dt);
                    b.vel.multiply(ns / s);
                }
            }

            // 2) integrate position (copy vel so we scale a throwaway, not vel).
            b.pos.add(b.vel.copy().multiply(dt));
            b.age += dt;

            // 3) cull once fully past the field + margin.
            if (b.pos.x < x - m || b.pos.x > x + w + m ||
                b.pos.y < y - m || b.pos.y > y + h + m) {
                // swap-remove would reorder; danmaku patterns read better in
                // spawn order, so splice (cheap enough until the Expert tier,
                // which replaces this whole store with a pool).
                this.bullets.splice(i, 1);
            }
        }
    }

    clear() { this.bullets.length = 0; }
    get count() { return this.bullets.length; }

    // Is a point inside the playfield rect? (Used by demos for spawn/aim logic.)
    contains(px, py) {
        const { x, y, w, h } = this.bounds;
        return px >= x && px <= x + w && py >= y && py <= y + h;
    }
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.BHBullet = BHBullet;
    window.BHField = BHField;
}
