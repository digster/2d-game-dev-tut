// ===================================================================
// platformer/engine/camera.js
//
// Camera — a 2D follow camera with a deadzone, look-ahead, world-bounds clamp,
// and trauma-based screen shake. Promoted here from expert-demos.js the moment
// the Simulations capstone became its 2nd consumer (the actors.js / player.js
// "≥ 2 tier files ⇒ engine/" rule). This is a *move*: expert.html now loads this
// file and its demos file no longer declares the class (two `class Camera` on one
// page is a redeclaration error).
//
// Holds a world-space top-left (x, y). follow() eases it toward a target;
// addTrauma() + updateShake() layer a decaying shake on top; originX/originY are
// the final integer offsets the renderer translates by:
//
//   clearCanvas → parallax (screen space) → ctx.translate(-cam.originX,
//   -cam.originY) → world (tiles + entities) → restore → HUD (screen space)
//
// Depends on shared/utils.js's `clamp` (loaded before this file). Name `Camera`
// is pre-checked vs shared/utils.js and the other engine globals. Attached to
// window at the bottom (no ES modules).
// ===================================================================
class Camera {
    constructor(viewW, viewH, worldW, worldH) {
        this.viewW = viewW; this.viewH = viewH;
        this.worldW = worldW; this.worldH = worldH;
        this.x = 0; this.y = 0;
        this.trauma = 0; this.shakeTime = 0; this.shakeX = 0; this.shakeY = 0;
    }

    // Ease toward the target. opts: { smoothMs, deadzoneW, deadzoneH, lookAhead, lookDir }
    follow(tx, ty, dt, opts = {}) {
        const la = (opts.lookAhead || 0) * (opts.lookDir || 0);
        const fx = tx + la;
        let goalX, goalY;
        if (opts.deadzoneW) {
            const sx = fx - this.x, half = opts.deadzoneW / 2, mid = this.viewW / 2;
            if (sx < mid - half) goalX = fx - (mid - half);
            else if (sx > mid + half) goalX = fx - (mid + half);
            else goalX = this.x;                       // inside the deadzone → hold
        } else { goalX = fx - this.viewW / 2; }
        if (opts.deadzoneH) {
            const sy = ty - this.y, half = opts.deadzoneH / 2, mid = this.viewH / 2;
            if (sy < mid - half) goalY = ty - (mid - half);
            else if (sy > mid + half) goalY = ty - (mid + half);
            else goalY = this.y;
        } else { goalY = ty - this.viewH / 2; }
        // frame-rate-correct easing: 99% of the gap closed in smoothMs (0 = rigid)
        const a = opts.smoothMs > 0 ? 1 - Math.exp((Math.log(0.01) / (opts.smoothMs / 1000)) * dt) : 1;
        this.x += (goalX - this.x) * a;
        this.y += (goalY - this.y) * a;
        this.x = clamp(this.x, 0, Math.max(0, this.worldW - this.viewW));
        this.y = clamp(this.y, 0, Math.max(0, this.worldH - this.viewH));
    }

    addTrauma(t) { this.trauma = clamp(this.trauma + t, 0, 1); }

    updateShake(dt, maxOffset = 12, decay = 1.5) {
        this.shakeTime += dt;
        const s = this.trauma * this.trauma;           // quadratic: small trauma stays calm
        this.shakeX = maxOffset * s * (Math.sin(this.shakeTime * 47) + 0.5 * Math.sin(this.shakeTime * 111));
        this.shakeY = maxOffset * s * (Math.sin(this.shakeTime * 57 + 1.7) + 0.5 * Math.sin(this.shakeTime * 93));
        this.trauma = Math.max(0, this.trauma - decay * dt);
    }

    get originX() { return Math.round(this.x + this.shakeX); }
    get originY() { return Math.round(this.y + this.shakeY); }
}

if (typeof window !== 'undefined') window.Camera = Camera;
