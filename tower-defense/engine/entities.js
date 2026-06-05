// ===================================================================
// tower-defense/engine/entities.js
//
// The track's ENTITY MODEL — the creeps, towers and projectiles every tier from
// Beginner on composes. It was TAUGHT inline in the Beginner tier
// (`beginner-demos.js`); the Intermediate tier is its **2nd consumer**, so it was
// PROMOTED here (a *move*, the roguelike `actors.js` / platformer `PlayerBody`
// rule) — both `beginner.html` and `intermediate.html` load this file, and neither
// demos file re-declares the classes (a 2nd `class TDTower` on one page is a
// redeclaration error).
//
// The classes grew on promotion, but every new capability sits behind a default
// so the Beginner calls keep working unchanged (the "inert knob" pattern):
//   • TDEnemy gained a timed SLOW status (frost towers) + a velocity() (for lead).
//   • TDTower gained data-driven specs, a TARGETING mode, LEAD aiming, SPLASH and
//     SLOW — all optional; a plain tower is the Beginner gun.
//   • TDProjectile gained a BALLISTIC mode (fly to a fixed aim point — needed for
//     lead) and SPLASH/SLOW on hit, alongside the Beginner HOMING mode.
//
// Targeting + lead MATH lives here too (tdPickTarget / tdLeadPoint) — generic and
// console-testable. The specific tower ROSTER (gun/sniper/splash/frost stats) is
// CONTENT and stays in the tier demos, not here.
//
// ⚠️  Vector2D mutates in place — `add`/`multiply`/`normalize`/`set` change `this`;
//   only `subtract`/`copy` return new. Entities own their `pos`, so mutating it is
//   safe; `subtract` is used to get a fresh "toward" vector without corrupting a
//   shared position. Names (TD*) are pre-checked vs shared/utils.js. No ES modules.
// ===================================================================

// --- TDEnemy: a creep that walks the lane ----------------------------
// Path-following is one idea: store a single scalar `dist` (how far along the lane
// the creep has gone) and each step advance it by `effectiveSpeed * dt`. The lane's
// arc-length table maps that scalar back to an (x, y). Reaching `path.length` means
// the creep leaked (cost a life). A timed SLOW status scales the speed below 1×.
class TDEnemy {
    constructor(path, opts = {}) {
        this.path = path;
        this.dist = opts.dist ?? 0;
        this.speed = opts.speed ?? 60;       // base px/s (before slow)
        // maxHp defaults to hp (a full-health creep); pass both to spawn one that's
        // already damaged (the targeting demo uses this to vary HP bars).
        this.maxHp = opts.maxHp ?? opts.hp ?? 5;
        this.hp = opts.hp ?? this.maxHp;
        this.radius = opts.radius ?? 9;
        this.color = opts.color || TD.enemy;
        this.bounty = opts.bounty ?? 5;
        this.alive = true;
        this.leaked = false;
        // Slow status (frost towers): factor < 1 scales speed; ticks back to 1×.
        this.slowFactor = 1;
        this.slowTimer = 0;
        this.slow = false;                   // render flag (tdDrawEnemy frost tint)
        const p = path.pointAt(this.dist);
        this.pos = new Vector2D(p.x, p.y);
    }
    get x() { return this.pos.x; }
    get y() { return this.pos.y; }

    // Effective speed after any active slow.
    get curSpeed() { return this.speed * this.slowFactor; }

    update(dt) {
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) { this.slowFactor = 1; this.slow = false; }
        }
        this.dist += this.curSpeed * dt;
        if (this.dist >= this.path.length) {
            this.dist = this.path.length;
            this.leaked = true;
            this.alive = false;
        }
        const p = this.path.pointAt(this.dist);
        this.pos.set(p.x, p.y);
    }

    damage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    }

    // Apply a slow: keep the STRONGEST factor and the LONGEST remaining duration
    // (so stacking frost hits don't weaken each other).
    applySlow(factor, duration) {
        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowTimer = Math.max(this.slowTimer, duration);
        this.slow = true;
    }

    // The creep's velocity vector right now — heading (lane tangent) × current
    // speed. This is what a tower needs to LEAD the target (predict where it'll be).
    velocity() {
        const t = this.path.tangentAt(this.dist);
        const s = this.curSpeed;
        return new Vector2D(t.x * s, t.y * s);
    }
}

// --- tdPickTarget: the swappable targeting strategy ------------------
// Of the creeps IN RANGE (squared-distance check, no sqrt), pick one by `mode`:
//   first     — furthest along the lane (closest to the goal) — the classic default
//   last      — least progress (newest threat)
//   closest   — nearest to the tower
//   strongest — most HP
//   weakest   — least HP
// Each mode is just a different SCORE we maximize — the whole "strategy slot" is
// this one switch. (Lead is an AIMING choice, separate from selection — see below.)
function tdPickTarget(tower, enemies, mode = 'first') {
    let best = null, score = -Infinity;
    const r2 = tower.range * tower.range;
    for (const e of enemies) {
        if (!e.alive) continue;
        const d2 = tower.pos.distanceSquared(e.pos);
        if (d2 > r2) continue;                // out of range
        let s;
        switch (mode) {
            case 'last':      s = -e.dist; break;
            case 'closest':   s = -d2; break;
            case 'strongest': s = e.hp; break;
            case 'weakest':   s = -e.hp; break;
            case 'first':
            default:          s = e.dist; break;
        }
        if (s > score) { score = s; best = e; }
    }
    return best;
}

// --- Lead-the-target math (the trig payoff) -------------------------
// Solve for the time `t` at which a projectile of speed `s` fired NOW from the
// tower can meet a target at position P moving with velocity V. With D = P − T
// (tower→target), |D + V·t| = s·t squares to the quadratic
//     (|V|² − s²) t² + 2(D·V) t + |D|² = 0.
// Return the smallest POSITIVE root, or null if the shot can never catch it
// (target outrunning the projectile, away from us).
function tdInterceptTime(D, V, s) {
    const a = V.lengthSquared() - s * s;
    const b = 2 * (D.x * V.x + D.y * V.y);
    const c = D.lengthSquared();
    if (Math.abs(a) < 1e-6) {                 // degenerate (|V| ≈ s): linear in t
        if (Math.abs(b) < 1e-9) return null;
        const t = -c / b;
        return t > 0 ? t : null;
    }
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;                // no real solution → uncatchable
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    const cands = [t1, t2].filter((t) => t > 1e-6).sort((x, y) => x - y);
    return cands.length ? cands[0] : null;
}

// The aim POINT: where the target will be at the intercept time. Falls back to
// null so the caller can default to "aim at where it is now".
function tdLeadPoint(towerPos, target, projSpeed) {
    const D = target.pos.subtract(towerPos);  // returns NEW (towerPos untouched)
    const V = target.velocity();
    const t = tdInterceptTime(D, V, projSpeed);
    if (t == null) return null;
    return new Vector2D(target.pos.x + V.x * t, target.pos.y + V.y * t);
}

// --- TDTower: range + acquisition + fire-rate (+ data-driven specs) --
// A tower is its SPEC: range, fireRate (→ a 1/fireRate cooldown), damage,
// projSpeed, cost, color, plus three optional behaviours — a `targeting` mode, a
// `lead` flag (aim at the predicted intercept), and `splash`/`slow` carried onto
// the shots it fires. update() does the universal work (keep/clear/acquire target,
// aim, fire on cooldown) and RETURNS the creep it fired at (or null) — it does NOT
// decide what a shot looks like, so a demo can render a hitscan beam, a homing
// shot, or a ballistic lead shot from the same tower. It also stashes `this.aim`
// (the point it's aiming at — lead point or current position) for the caller.
class TDTower {
    constructor(x, y, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.kind = opts.kind || 'gun';
        this.range = opts.range ?? 110;
        this.damage = opts.damage ?? 2;
        this.fireRate = opts.fireRate ?? 1.5;
        this.projSpeed = opts.projSpeed ?? 280;
        this.cost = opts.cost ?? 40;
        this.color = opts.color || TD.tower;
        this.targeting = opts.targeting || 'first';
        this.lead = opts.lead || false;
        this.splash = opts.splash ?? 0;       // AoE radius on hit (0 = single target)
        this.slow = opts.slow || null;        // { factor, duration } applied on hit
        this.cooldown = 0;
        this.angle = -Math.PI / 2;
        this.target = null;
        this.aim = null;                      // last aim point (for the demo's shot)
    }
    get x() { return this.pos.x; }
    get y() { return this.pos.y; }

    inRange(enemy) { return this.pos.distanceSquared(enemy.pos) <= this.range * this.range; }

    update(dt, enemies) {
        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.target && (!this.target.alive || !this.inRange(this.target))) this.target = null;
        if (!this.target) this.target = tdPickTarget(this, enemies, this.targeting);
        if (!this.target) return null;

        // Aim: at the lead point if leading (fall back to current pos if no
        // intercept solution), else straight at where the target is now.
        const aim = this.lead ? (tdLeadPoint(this.pos, this.target, this.projSpeed) || this.target.pos) : this.target.pos;
        this.aim = aim;
        this.angle = Math.atan2(aim.y - this.pos.y, aim.x - this.pos.x);

        if (this.cooldown <= 0) {
            this.cooldown = 1 / this.fireRate;
            return this.target;               // "I fired at this creep this step"
        }
        return null;
    }
}

// --- TDProjectile: a shot that travels and deals damage -------------
// Two flight modes:
//   HOMING (default)   — chase the target's CURRENT position (Beginner). Always
//                        connects eventually; fizzles if the target dies first.
//   BALLISTIC (opts.homing === false) — fly in a straight line toward a fixed
//                        `aim` point at constant velocity (needed for LEAD: aim at
//                        the predicted intercept). Misses a target if the aim was
//                        wrong; expires after `life` seconds.
// On hit it deals `damage` (and, if set, SPLASH to every creep within `splash`,
// and a SLOW). The hit test uses the sub-step reach (speed·dt + target.radius) so a
// fast shot can't tunnel through a creep between frames. Signature is
// (x, y, opts) with the target in opts (extensible — Beginner passes opts.target).
class TDProjectile {
    constructor(x, y, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.target = opts.target || null;
        this.speed = opts.speed ?? 280;
        this.damage = opts.damage ?? 2;
        this.radius = opts.radius ?? 4;
        this.color = opts.color || TD.proj;
        this.splash = opts.splash ?? 0;
        this.slow = opts.slow || null;
        this.alive = true;
        this.homing = opts.homing !== false;  // default true
        if (!this.homing) {
            const aim = opts.aim || (this.target ? this.target.pos.copy() : this.pos.copy());
            const dir = aim.subtract(this.pos);
            this.vel = dir.lengthSquared() > 1e-9 ? dir.normalize().multiply(this.speed) : new Vector2D(0, 0);
            this.life = opts.life ?? 2.5;      // seconds before a miss expires
        }
    }
    get x() { return this.pos.x; }
    get y() { return this.pos.y; }

    update(dt, enemies) {
        if (this.homing) {
            if (!this.target || !this.target.alive) { this.alive = false; return; } // fizzle
            const toward = this.target.pos.subtract(this.pos);
            const step = this.speed * dt;
            const reach = step + this.target.radius;
            if (toward.lengthSquared() <= reach * reach) { this._hit(this.target, enemies); return; }
            this.pos.add(toward.normalize().multiply(step));
        } else {                               // ballistic
            this.life -= dt;
            if (this.life <= 0) { this.alive = false; return; }
            this.pos.add(this.vel.copy().multiply(dt));
            if (this.target && this.target.alive) {
                const reach = this.speed * dt + this.target.radius;
                if (this.pos.distanceSquared(this.target.pos) <= reach * reach) { this._hit(this.target, enemies); return; }
            }
        }
    }

    _hit(primary, enemies) {
        if (this.splash > 0 && enemies) {      // area damage: everyone in the blast
            const r2 = this.splash * this.splash;
            for (const e of enemies) {
                if (!e.alive) continue;
                if (this.pos.distanceSquared(e.pos) <= r2) {
                    e.damage(this.damage);
                    if (this.slow) e.applySlow(this.slow.factor, this.slow.duration);
                }
            }
        } else if (primary) {                  // single target
            primary.damage(this.damage);
            if (this.slow) primary.applySlow(this.slow.factor, this.slow.duration);
        }
        this.alive = false;
    }
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.TDEnemy = TDEnemy;
    window.TDTower = TDTower;
    window.TDProjectile = TDProjectile;
    window.tdPickTarget = tdPickTarget;
    window.tdInterceptTime = tdInterceptTime;
    window.tdLeadPoint = tdLeadPoint;
}
