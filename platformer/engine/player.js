// ===================================================================
// platformer/engine/player.js
//
// PlayerBody — the platformer character controller and the whole "game feel"
// kit, behind config flags. Promoted here from intermediate-demos.js the moment
// the Advanced tier became its 2nd consumer (the actors.js / vision.js rule in
// ARCHITECTURE.md: a helper used by ≥ 2 tier files graduates to engine/). This
// is a *move*, not a lib copy — intermediate.html now loads this file and its
// demos file no longer declares the class (two `class PlayerBody` on one page is
// a redeclaration error).
//
// WHAT'S HERE:
//   • RAW_CFG / JUICED_CFG — the Beginner-feel and full-feel reference configs.
//   • PlayerBody           — position/velocity + the feel kit (coyote time, jump
//                            buffering, variable height, apex/asymmetric gravity,
//                            fast-fall, corner correction) AND the Advanced
//                            abilities (wall-slide, wall-jump, dash). Every
//                            feature is a zeroable knob: 0 / false ⇒ absent.
//   • PF_STATE_COLOR + pfDrawBody — render a PlayerBody (with squash-and-stretch).
//
// THE resolve HOOK (the Advanced extension seam): PlayerBody never calls
// moveAndCollide for its main moves directly — it calls `this.resolve(box,dx,dy)`,
// which defaults to plain solid-tile collision. The Advanced tier swaps in a
// richer world resolver (one-way platforms + slopes) without touching this file.
// Corner-correction keeps using moveAndCollide against SOLID directly (a head
// bonk is always a solid ceiling; one-way tiles aren't solid, so they can't bonk).
//
// Names (RAW_CFG, JUICED_CFG, PlayerBody, PF_STATE_COLOR, pfDrawBody) are
// pre-checked vs shared/utils.js and the other engine globals. Attached to
// window at the bottom (no ES modules).
// ===================================================================

// Beginner ("raw") feel: no grace windows, no curve tweaks, no abilities.
const RAW_CFG = {
    accel: 1500, friction: 1800, maxSpeed: 215,
    gravJump: 1700, gravFall: 1700, terminal: 1000, jumpSpeed: 560,
    coyoteMs: 0, bufferMs: 0,             // no grace windows
    variable: false, cutFactor: 0.45,     // release-to-cut off
    apexThreshold: 0, apexMult: 0.55,     // no apex hang
    fastFallMult: 1,                      // no fast-fall
    corner: 0,                            // no corner correction
    // --- Advanced abilities (all OFF by default) ---
    wallSlideSpeed: 0,                    // 0 ⇒ wall abilities off; else max fall while sliding (px/s)
    wallJumpX: 300, wallJumpY: 520, wallJumpLockMs: 160,
    dashSpeed: 0,                         // 0 ⇒ dash off; else dash burst speed (px/s)
    dashMs: 130, dashCooldownMs: 250,
};

// Full Intermediate "juiced" feel — every feel feature on, abilities still OFF
// (abilities are the Advanced tier; the Feel Lab must not suddenly wall-jump).
const JUICED_CFG = {
    accel: 1900, friction: 2200, maxSpeed: 220,
    gravJump: 1500, gravFall: 2200, terminal: 1100, jumpSpeed: 560,
    coyoteMs: 90, bufferMs: 110,
    variable: true, cutFactor: 0.45,
    apexThreshold: 120, apexMult: 0.55,
    fastFallMult: 1.8,
    corner: 7,
    wallSlideSpeed: 0, wallJumpX: 300, wallJumpY: 520, wallJumpLockMs: 160,
    dashSpeed: 0, dashMs: 130, dashCooldownMs: 250,
};

class PlayerBody {
    constructor(map, x, y, cfg) {
        this.map = map;
        this.box = new AABB(x, y, 24, 30);
        this.spawn = { x, y };
        this.cfg = Object.assign({}, RAW_CFG, cfg || {});
        this.vx = 0; this.vy = 0;
        this.onGround = false;
        this.coyoteLeft = 0;     // s — remaining coyote-time window
        this.bufferLeft = 0;     // s — remaining buffered-jump window
        this.jumping = false;    // in a held jump (for variable height / cut)
        this.facing = 1;
        this.squash = 1;         // 1 neutral; <1 squashed (land), >1 stretched (takeoff)
        this.state = 'idle';     // idle | run | jump | fall | land | wall | dash
        this.landTimer = 0;

        // --- ability state ---
        this.onWall = 0;         // -1 wall on left, +1 wall on right, 0 none
        this.wallSliding = false;
        this.wallJumpLock = 0;   // s — input-suppression after a wall jump (clears the wall)
        this.dashLeft = 0;       // s — remaining in an active dash
        this.dashCdLeft = 0;     // s — remaining dash cooldown
        this.canDash = true;     // refreshed on ground / wall
        this.dashVX = 0; this.dashVY = 0;

        // per-step telemetry the demos visualise
        this.justJumped = false; this.usedCoyote = false; this.usedBuffer = false;
        this.cornerNudge = 0; this.wallJumped = false; this.justDashed = false;

        // The collision seam. Default = plain solid-tile collision. The Advanced
        // tier swaps this for a one-way/slope-aware resolver.
        this.resolve = (box, dx, dy) => moveAndCollide(box, dx, dy, this.map);
        this.dropThrough = false; // set by a demo's input to drop through one-ways
    }

    respawn() {
        this.box.x = this.spawn.x; this.box.y = this.spawn.y;
        this.vx = 0; this.vy = 0; this.coyoteLeft = 0; this.bufferLeft = 0;
        this.jumping = false; this.state = 'idle'; this.squash = 1;
        this.dashLeft = 0; this.dashCdLeft = 0; this.canDash = true;
        this.wallJumpLock = 0; this.onWall = 0; this.wallSliding = false;
    }

    // Probe the tile column just outside the box's left/right edge for a SOLID
    // wall spanning the box's height. Only SOLID counts — you can't cling to a
    // one-way platform's edge. Returns +1 (right), -1 (left), or 0 (none).
    _wallDir() {
        const m = this.map, b = this.box;
        const top = m.rowAt(b.top + 3), bot = m.rowAt(b.bottom - 3);
        let right = false, left = false;
        const cr = m.colAt(b.right + 1), cl = m.colAt(b.left - 1);
        for (let r = top; r <= bot; r++) {
            if (m.isSolid(cr, r)) right = true;
            if (m.isSolid(cl, r)) left = true;
        }
        if (right) return 1;
        if (left) return -1;
        return 0;
    }

    update(dt, input) {
        const c = this.cfg;
        this.justJumped = false; this.usedCoyote = false; this.usedBuffer = false;
        this.cornerNudge = 0; this.wallJumped = false; this.justDashed = false;
        const wasGround = this.onGround;

        // tick ability timers
        this.dashCdLeft = Math.max(0, this.dashCdLeft - dt);
        this.wallJumpLock = Math.max(0, this.wallJumpLock - dt);

        // ---- DASH trigger (8-way, aimed by the held direction; else facing) ----
        if (c.dashSpeed > 0 && input.pressed('dash') && this.canDash && this.dashCdLeft <= 0 && this.dashLeft <= 0) {
            let ax = input.axisX();
            let ay = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
            if (ax === 0 && ay === 0) ax = this.facing;       // no direction held ⇒ dash where you face
            const len = Math.hypot(ax, ay) || 1;
            this.dashVX = (ax / len) * c.dashSpeed;
            this.dashVY = (ay / len) * c.dashSpeed;
            this.dashLeft = c.dashMs / 1000;
            this.dashCdLeft = c.dashCooldownMs / 1000;
            this.canDash = false;
            this.justDashed = true;
            if (ax !== 0) this.facing = Math.sign(ax);
        }
        const dashing = this.dashLeft > 0;

        // ---- horizontal velocity ----
        if (dashing) {
            this.vx = this.dashVX;
            this.dashLeft -= dt;
        } else if (this.wallJumpLock > 0) {
            // during the lock we DON'T apply input accel/friction, so the
            // wall-jump impulse actually carries the player off the wall.
        } else {
            const ax = input.axisX();
            if (ax !== 0) { this.vx += ax * c.accel * dt; this.facing = ax; }
            else { const d = c.friction * dt; this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d; }
            this.vx = clamp(this.vx, -c.maxSpeed, c.maxSpeed);
        }

        // ---- wall detection (airborne, abilities on) ----
        this.onWall = (c.wallSlideSpeed > 0 && !this.onGround && !dashing) ? this._wallDir() : 0;
        this.wallSliding = this.onWall !== 0 && input.axisX() === this.onWall && this.vy >= 0 && !dashing;

        // ---- jump intent: buffer the press, tick the coyote window ----
        const pressedJump = input.pressed('jump') || input.pressed('up');
        if (pressedJump) this.bufferLeft = c.bufferMs > 0 ? c.bufferMs / 1000 : 1e-4;
        else this.bufferLeft = Math.max(0, this.bufferLeft - dt);
        if (this.onGround) this.coyoteLeft = c.coyoteMs > 0 ? c.coyoteMs / 1000 : 1e-4;
        else this.coyoteLeft = Math.max(0, this.coyoteLeft - dt);

        // ---- decide the jump: ground/coyote jump, or wall jump ----
        const canGroundJump = this.onGround || this.coyoteLeft > 0;
        const canWallJump = c.wallSlideSpeed > 0 && !this.onGround && this.onWall !== 0 && !dashing;
        if (this.bufferLeft > 0 && (canGroundJump || canWallJump) && !dashing) {
            if (canGroundJump) {
                this.usedCoyote = !this.onGround;
                this.vy = -c.jumpSpeed;
            } else {
                // wall jump: up + away from the wall, then lock input briefly
                this.vy = -c.wallJumpY;
                this.vx = -this.onWall * c.wallJumpX;
                this.facing = -this.onWall;
                this.wallJumpLock = c.wallJumpLockMs / 1000;
                this.wallJumped = true;
            }
            this.jumping = true; this.justJumped = true; this.squash = 1.35;
            this.bufferLeft = 0; this.coyoteLeft = 0;
        }

        // ---- variable height: release while rising cuts the jump short ----
        const holdingJump = input.isDown('jump') || input.isDown('up');
        if (c.variable && this.jumping && !holdingJump && this.vy < 0) { this.vy *= c.cutFactor; this.jumping = false; }
        if (this.vy >= 0) this.jumping = false;

        // ---- gravity (skipped during a dash) ----
        if (!dashing) {
            let g = this.vy < 0 ? c.gravJump : c.gravFall;
            if (c.apexThreshold > 0 && Math.abs(this.vy) < c.apexThreshold) g *= c.apexMult;
            if (c.fastFallMult > 1 && this.vy > 0 && input.isDown('down')) g *= c.fastFallMult;
            this.vy = Math.min(this.vy + g * dt, c.terminal);
            // wall slide clamps the fall speed
            if (this.wallSliding && this.vy > c.wallSlideSpeed) this.vy = c.wallSlideSpeed;
        } else {
            this.vy = this.dashVY;
        }

        // ---- move & resolve, one axis at a time (via the swappable hook) ----
        const hx = this.resolve(this.box, this.vx * dt, 0);
        if (hx.left || hx.right) this.vx = 0;

        const beforeY = this.box.y;
        const hy = this.resolve(this.box, 0, this.vy * dt);

        // corner correction — against SOLID only (one-ways/slopes never bonk a head)
        if (hy.up && this.vy < 0 && c.corner > 0) {
            let fixed = false;
            for (let mag = 1; mag <= c.corner && !fixed; mag++) {
                for (const dir of [this.facing, -this.facing]) {
                    const test = new AABB(this.box.x + dir * mag, beforeY, this.box.w, this.box.h);
                    if (!moveAndCollide(test, 0, this.vy * dt, this.map).up) {
                        this.box.x = test.x; this.box.y = test.y; this.cornerNudge = dir * mag; fixed = true; break;
                    }
                }
            }
            if (!fixed) this.vy = 0;
        } else if (hy.up && this.vy < 0) {
            this.vy = 0;
        }
        if (hy.down) this.vy = 0;
        this.onGround = hy.down;
        if (dashing && (hx.left || hx.right || hy.up || hy.down)) this.dashLeft = 0; // a wall ends the dash

        // ---- dash refresh: regained on ground or while wall-sliding ----
        if (this.onGround || this.wallSliding) this.canDash = true;

        // ---- squash & stretch + landing ----
        const justLanded = this.onGround && !wasGround;
        if (justLanded) { this.squash = 0.62; this.landTimer = 0.12; }
        this.squash += (1 - this.squash) * Math.min(1, dt * 14);

        // ---- finite state machine ----
        if (dashing) this.state = 'dash';
        else if (this.landTimer > 0) { this.landTimer -= dt; this.state = 'land'; }
        else if (this.wallSliding) this.state = 'wall';
        else if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
        else this.state = Math.abs(this.vx) > 12 ? 'run' : 'idle';
    }
}

// ---- rendering: one colour per state + a squash-and-stretch body ------------
const PF_STATE_COLOR = {
    idle: '#7CF2C8', run: '#7CF2C8', jump: '#66bb6a',
    fall: '#ffa726', land: '#4fc3f7', wall: '#ce93d8', dash: '#ffd166',
};

function pfDrawBody(ctx, b, colorOverride) {
    const sq = clamp(b.squash, 0.5, 1.5);
    const w = b.box.w / sq;            // squashed = wider, stretched = narrower
    const h = b.box.h * sq;            // squashed = shorter, stretched = taller
    const cx = b.box.x + b.box.w / 2;
    const bottom = b.box.y + b.box.h;
    const x = Math.round(cx - w / 2), y = Math.round(bottom - h);
    ctx.fillStyle = colorOverride || PF_STATE_COLOR[b.state] || PF.player;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PF.playerDk;
    ctx.fillRect(x, y, w, 3);
    // a little eye so facing reads
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(Math.round(cx + b.facing * (w / 2 - 7) - 2), y + 8, 4, 4);
}

if (typeof window !== 'undefined') {
    window.RAW_CFG = RAW_CFG;
    window.JUICED_CFG = JUICED_CFG;
    window.PlayerBody = PlayerBody;
    window.PF_STATE_COLOR = PF_STATE_COLOR;
    window.pfDrawBody = pfDrawBody;
}
