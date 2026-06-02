// ===================================================================
// physics-puzzle/engine/world.js
//
// The simulation core of the whole Physics Puzzle track:
//   • PZBody  — one physics body. For now a CIRCLE (the projectile, a pin, a
//               target): position, velocity, radius, mass and restitution.
//               Rotation fields exist but stay inert until the Advanced tier
//               turns them on for convex polygons.
//   • PZWorld — a bag of bodies + a gravity vector + a little linear damping.
//               Its ONE job is to INTEGRATE: every fixed step it advances each
//               dynamic body's velocity (gravity) and position (velocity).
//
// WHY the World only integrates (and does NOT collide):
//   Collision is the *lesson* of this track, not hidden plumbing. The Beginner
//   tier adds circle-vs-wall and circle-vs-circle on top of this integrator,
//   inline, so you can read exactly how a bounce works; later tiers layer SAT,
//   constraints and joints on the same World. Keeping the World as a pure
//   integrator is the equivalent of the Platformer track keeping `moveAndCollide`
//   as its one shared primitive and teaching slopes/dashes on top.
//
// ⚠️  THE #1 FOOTGUN — Vector2D mutates in place. In shared/utils.js, `add`,
//   `multiply`, `divide`, `normalize`, `lerp` and `rotate` MUTATE `this` and
//   return it; only `subtract` / `copy` return a NEW vector. So
//       body.vel.add(world.gravity.multiply(dt))   // ❌ scales the SHARED gravity!
//   permanently corrupts gravity for every body forever. The house rule, used
//   everywhere below: **.copy() a shared vector before any mutating op.**
//       body.vel.add(world.gravity.copy().multiply(dt))   // ✅
//
// Names (PZBody / PZWorld / PZ_GRAVITY) are pre-checked to NOT collide with
// shared/utils.js (Vector2D, Matrix2D, lerp, clamp, map, ...). No ES modules —
// every page loads this via <script src>, so the public names attach to
// `window` at the bottom.
// ===================================================================

// Default downward acceleration, in px/s². Tuned so a ~640×400 arena feels
// snappy rather than moon-like; demos override it with a slider.
const PZ_GRAVITY = 1400;

// --- PZBody: one circular physics body ------------------------------
class PZBody {
    // (x, y) is the CENTER (circles are centre-based, unlike the Platformer's
    // top-left AABB). `opts`: { vx, vy, mass, restitution, static, color }.
    constructor(x, y, radius, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.vel = new Vector2D(opts.vx || 0, opts.vy || 0);
        this.radius = radius;

        // A static body never moves and absorbs impulses (a wall, a peg). We
        // model "immovable" as infinite mass → inverse mass 0, which makes the
        // impulse math (which divides by mass) fall out cleanly: 1/∞ = 0.
        this.isStatic = !!opts.static;
        // Mass ∝ area (r²) so a big ball shoves a small one, not vice-versa.
        // Only the RATIO of masses matters to the impulse solver, so the 0.01
        // scale is cosmetic.
        this.mass = this.isStatic ? Infinity : (opts.mass ?? Math.max(0.4, radius * radius * 0.01));
        this.invMass = this.isStatic ? 0 : 1 / this.mass;

        // Bounciness, 0 (dead clay) … 1 (perfect superball). 0.4 reads as a
        // firm rubber ball.
        this.restitution = opts.restitution ?? 0.4;

        // Rotation — present so the body shape is stable across tiers, but the
        // integrator below leaves them untouched. The Advanced tier (rigid
        // bodies) is where angle/torque come alive.
        this.angle = 0;
        this.angularVel = 0;

        this.color = opts.color || null;
        this.tag = opts.tag || null; // free-form label demos use ('pin', 'goal', …)
    }

    // Convenience for collision code that thinks in AABBs.
    get left()   { return this.pos.x - this.radius; }
    get right()  { return this.pos.x + this.radius; }
    get top()    { return this.pos.y - this.radius; }
    get bottom() { return this.pos.y + this.radius; }
}

// --- PZWorld: the integrator + body container -----------------------
class PZWorld {
    // opts: { gravity (px/s²), damping (per-step velocity retention) }
    constructor(opts = {}) {
        this.bodies = [];
        // Stored as a vector so later tiers can point gravity sideways (wind) or
        // zero it (space puzzles) without touching the integrator.
        this.gravity = new Vector2D(0, opts.gravity ?? PZ_GRAVITY);
        // A touch of linear damping — a cheap STAND-IN for air drag + rolling
        // resistance so balls eventually settle. Real Coulomb friction (a
        // tangential impulse clamped by μ) arrives in the Advanced tier; this is
        // honestly just "lose 0.1% of speed per step".
        this.damping = opts.damping ?? 0.999;
    }

    add(body) { this.bodies.push(body); return body; }
    remove(body) { const i = this.bodies.indexOf(body); if (i >= 0) this.bodies.splice(i, 1); }
    clear() { this.bodies.length = 0; }

    // Advance every DYNAMIC body by one fixed step `dt` using semi-implicit
    // (a.k.a. symplectic) Euler: update velocity FIRST, then move by the new
    // velocity. That ordering is more stable for gravity than plain Euler and is
    // what almost every 2D game uses.
    step(dt) {
        const g = this.gravity; // read-only here; we .copy() before mutating
        for (const b of this.bodies) {
            if (b.isStatic) continue;
            // 1) velocity += gravity · dt   (copy g so the shared vector is safe)
            b.vel.add(g.copy().multiply(dt));
            // 2) bleed a sliver of speed (the damping stand-in)
            b.vel.multiply(this.damping);
            // 3) position += velocity · dt  (copy vel so we don't scale it)
            b.pos.add(b.vel.copy().multiply(dt));
        }
    }
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.PZ_GRAVITY = PZ_GRAVITY;
    window.PZBody = PZBody;
    window.PZWorld = PZWorld;
}
