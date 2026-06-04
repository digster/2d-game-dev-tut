// ===================================================================
// bullet-hell/engine/emitter.js
//
// The pattern engine for the Bullet Hell track. PROMOTED here from the
// Intermediate tier's demos once the Advanced (boss) tier became its second
// consumer — the repo's "promote on the 2nd consumer" rule. The Intermediate
// page still TEACHES this code in its collapsible blocks; this is just the one
// canonical runtime copy both tiers now load (a "move", not a duplicate — so
// intermediate-demos.js no longer declares these, or the page would have two
// top-level `class BHEmitter` declarations = an "already declared" crash).
//
//   • BHEmitter  — separates the PATTERN (a `fire(emitter, field)` callback)
//                  from the CADENCE (an `interval`), plus a base `angle` it can
//                  `spin` over time. Every danmaku pattern is this one machine
//                  with a different `fire`.
//   • bhFireRing — n bullets spaced evenly around the full circle (i/n).
//   • bhFireFan  — n bullets across an arc, centered on an aim angle (i/(n-1)).
//
// Reuses shared/utils.js's Vector2D (esp. Vector2D.fromAngle) and engine/field.js
// (BHField.spawn). Names pre-checked vs shared/utils.js. No ES modules.
// ===================================================================

class BHEmitter {
    constructor(x, y, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.interval = opts.interval ?? 0.25;   // seconds between volleys
        this.angle = opts.angle ?? 0;            // base aim, radians
        this.spin = opts.spin ?? 0;              // added to angle each second (rad/s)
        this.fire = opts.fire || (() => {});     // (emitter, field) => void
        this.enabled = opts.enabled ?? true;
        this.timer = 0;                          // counts down to the next volley
        this.volleys = 0;                        // how many volleys fired (for HUDs)
    }
    step(dt, field) {
        this.angle += this.spin * dt;            // rotate the base aim (spirals)
        if (!this.enabled) return;
        const iv = Math.max(0.001, this.interval); // guard against a 0-interval lock
        this.timer -= dt;
        // `while` + carried remainder: fire every volley we owe this step, and
        // keep the cadence exact regardless of the timestep (the loop's trick).
        while (this.timer <= 0) {
            this.timer += iv;
            this.fire(this, field);
            this.volleys++;
        }
    }
}

// A full RING: n bullets spaced evenly around the circle. i/n (NOT i/(n-1)) so
// the bullets at θ=0 and θ=2π don't land on top of each other.
function bhFireRing(field, em, n, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
        const a = em.angle + (i / n) * BH.TAU;
        const v = Vector2D.fromAngle(a, speed);
        field.spawn(em.pos.x, em.pos.y, v.x, v.y, {
            radius: opts.radius ?? 4, color: opts.color ?? BH.bullet,
            turn: opts.turn ?? 0, accel: opts.accel ?? 0, tag: opts.tag ?? null,
        });
    }
}

// A FAN: n bullets spread across `arc` radians, centered on `center`. i/(n-1)
// so a bullet sits at BOTH ends of the arc.
function bhFireFan(field, em, n, arc, center, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const a = center + (t - 0.5) * arc;
        const v = Vector2D.fromAngle(a, speed);
        field.spawn(em.pos.x, em.pos.y, v.x, v.y, {
            radius: opts.radius ?? 4, color: opts.color ?? BH.bullet,
            turn: opts.turn ?? 0, accel: opts.accel ?? 0, tag: opts.tag ?? null,
        });
    }
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.BHEmitter = BHEmitter;
    window.bhFireRing = bhFireRing;
    window.bhFireFan = bhFireFan;
}
