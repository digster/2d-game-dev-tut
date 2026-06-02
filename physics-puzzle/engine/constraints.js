// ===================================================================
// physics-puzzle/engine/constraints.js
//
// The position-based (Verlet) physics core: a point that stores its previous
// position (velocity implicit), a distance constraint between two points, the
// integrate-then-relax step, and point-vs-wall depenetration.
//
// PROMOTION HISTORY: taught INLINE in the Intermediate tier (ropes & chains).
// The Simulations tier is its 2nd consumer — a pressure soft-body is a closed
// Verlet mesh, and the same constraints drive it — so per the repo's "promote on
// the 2nd consumer" rule it was MOVED here (a *move*: intermediate.html +
// simulations.html both load it; intermediate-demos.js no longer declares it).
// The rope-specific *verbs* (the cut, rope drawing) stay inline in the
// Intermediate tier — they're interaction, not physics.
//
// This is a DIFFERENT family from engine/rigid.js: position-based (Verlet) vs
// velocity/impulse-based (rigid). The grand capstone runs both in one world.
//
// Names are pz/PZ-prefixed, pre-checked vs shared/utils.js (reuses its `clamp`).
// Public names attach to `window` at the bottom.
// ===================================================================

// A Verlet point stores its CURRENT and PREVIOUS position. There is no velocity
// variable — the velocity is implicit: (pos − prev). To integrate, reflect that
// gap forward and add acceleration·dt². A pinned point ignores integration.
class PZVerletPoint {
    constructor(x, y, radius = 4) {
        this.pos = new Vector2D(x, y);
        this.prev = new Vector2D(x, y);   // equal to pos ⇒ starts at rest
        this.radius = radius;
        this.pinned = false;
    }
    // gx, gy are acceleration in px/s² (numbers, so we never mutate a shared
    // gravity vector). `damping` < 1 bleeds a sliver of energy each step.
    integrate(gx, gy, dt, damping) {
        if (this.pinned) return;
        const vx = (this.pos.x - this.prev.x) * damping;   // implicit velocity·dt
        const vy = (this.pos.y - this.prev.y) * damping;
        this.prev.x = this.pos.x; this.prev.y = this.pos.y;
        this.pos.x += vx + gx * dt * dt;                    // x += v·dt + a·dt²
        this.pos.y += vy + gy * dt * dt;
    }
    speed(dt) { return Math.hypot(this.pos.x - this.prev.x, this.pos.y - this.prev.y) / dt; }
}

// A distance constraint keeps two points `rest` apart: one nudge of each point
// (half the error each, unless one is pinned), relaxed K times per step.
class PZConstraint {
    constructor(a, b, opts = {}) {
        this.a = a; this.b = b;
        this.rest = opts.rest ?? Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
        this.stiffness = opts.stiffness ?? 1;
        this.broken = false;
    }
    solve() {
        if (this.broken) return;
        const a = this.a, b = this.b;
        const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const diff = ((d - this.rest) / d) * this.stiffness;
        const aMove = a.pinned ? 0 : (b.pinned ? 1 : 0.5);
        const bMove = b.pinned ? 0 : (a.pinned ? 1 : 0.5);
        a.pos.x += dx * diff * aMove; a.pos.y += dy * diff * aMove;
        b.pos.x -= dx * diff * bMove; b.pos.y -= dy * diff * bMove;
    }
}

// One Verlet step: integrate every point, then relax every constraint K times.
function pzStepRope(points, constraints, gx, gy, dt, iterations, damping) {
    for (const p of points) p.integrate(gx, gy, dt, damping);
    for (let k = 0; k < iterations; k++)
        for (const c of constraints) c.solve();
}

// Verlet collision = depenetration: push a point's pos out of a wall. No velocity
// to touch — Verlet derives it from (pos − prev), so moving pos kills the inward
// motion automatically.
function pzVerletArena(p, arena) {
    if (p.pos.x < arena.x + p.radius) p.pos.x = arena.x + p.radius;
    if (p.pos.x > arena.x + arena.w - p.radius) p.pos.x = arena.x + arena.w - p.radius;
    if (p.pos.y < arena.y + p.radius) p.pos.y = arena.y + p.radius;
    if (p.pos.y > arena.y + arena.h - p.radius) p.pos.y = arena.y + arena.h - p.radius;
}
function pzVerletBlock(p, block) {
    const cx = clamp(p.pos.x, block.x, block.x + block.w);
    const cy = clamp(p.pos.y, block.y, block.y + block.h);
    let dx = p.pos.x - cx, dy = p.pos.y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 > p.radius * p.radius) return false;
    if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.pos.x += (dx / d) * (p.radius - d);
        p.pos.y += (dy / d) * (p.radius - d);
    } else {
        const dl = p.pos.x - block.x, dr = block.x + block.w - p.pos.x;
        const dtp = p.pos.y - block.y, dbt = block.y + block.h - p.pos.y;
        const m = Math.min(dl, dr, dtp, dbt);
        if (m === dtp) p.pos.y = block.y - p.radius;
        else if (m === dbt) p.pos.y = block.y + block.h + p.radius;
        else if (m === dl) p.pos.x = block.x - p.radius;
        else p.pos.x = block.x + block.w + p.radius;
    }
    return true;
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.PZVerletPoint = PZVerletPoint;
    window.PZConstraint = PZConstraint;
    window.pzStepRope = pzStepRope;
    window.pzVerletArena = pzVerletArena;
    window.pzVerletBlock = pzVerletBlock;
}
