// =============================================================================
// PLATFORMER — ADVANCED TIER DEMOS ("Abilities & Moving Geometry")
// =============================================================================
// Six demos. The character controller (PlayerBody) and the feel kit now live in
// engine/player.js (promoted from the Intermediate tier — this tier is its 2nd
// consumer). What's NEW here is taught INLINE, because it's the lesson:
//
//   • pfResolveWorld   — a collision resolver that understands SOLID *plus*
//                        ONE_WAY platforms and SLOPE tiles (top-level + console-
//                        testable, the roguelike-FOV convention).
//   • MovingPlatform / pfRidePlatforms — kinematic platforms & conveyors that
//                        carry a rider (relative-motion physics).
//
//   1. wallDemo     — wall-slide + wall-jump (PlayerBody abilities, on)
//   2. dashDemo     — dash: burst, cooldown, refresh-on-ground, dash-cancel
//   3. oneWayDemo   — one-way platforms: land from above, drop through on ↓+jump
//   4. slopeDemo    — slopes: walk up/down 45° triangle tiles
//   5. movingDemo   — moving platforms + a conveyor belt (you inherit their motion)
//   6. gauntletDemo — capstone: a vertical gauntlet using every ability + geometry
//
// DEPENDENCIES (loaded BEFORE this file by advanced.html):
//   ../shared/utils.js   — clearCanvas, clamp, lerp (globals)
//   engine/tilemap.js    — PFTile, TileMap, PF, drawTileMap
//   engine/physics.js    — AABB, moveAndCollide, PF_EPS
//   engine/input.js      — pfInstallKeys, pfLoop
//   engine/player.js     — PlayerBody, RAW_CFG, JUICED_CFG, PF_STATE_COLOR, pfDrawBody
//
// COLLISION NOTE: new top-level names here — pfResolveWorld, MovingPlatform,
// pfMovePlatform, pfRidePlatforms, pfFocusHint, pfBar — are all clear of
// shared/utils.js and the engine globals.
// =============================================================================

// ---- Scroll-to-top (identical on every tier page) --------------------------
(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// =============================================================================
// pfResolveWorld — the extended collision resolver.
// Same per-axis shape as engine/physics.js's moveAndCollide, but it also handles
// ONE_WAY platforms (solid only to a box falling onto them from above) and SLOPE
// tiles (45° triangles whose surface height depends on x). Returns the usual
// {left,right,up,down} plus `slope:true` when standing on a ramp.
//
// opts.dropThrough : ignore one-way platforms this step (the ↓+jump drop).
// opts.wasGround   : was the body grounded last step? (lets it "stick" downhill).
//
// Top-level + pure so it can be unit-tested from the console.
// =============================================================================
function pfResolveWorld(box, dx, dy, map, opts = {}) {
    const ts = map.tileSize;
    const hit = { left: false, right: false, up: false, down: false, slope: false };
    const prevBottom = box.bottom;

    // ---- X axis vs SOLID (slopes & one-ways never block horizontal motion) ----
    box.x += dx;
    if (dx !== 0) {
        const top = map.rowAt(box.top), bot = map.rowAt(box.bottom - PF_EPS);
        if (dx > 0) {
            const col = map.colAt(box.right - PF_EPS);
            for (let r = top; r <= bot; r++) if (map.isSolid(col, r)) { box.x = col * ts - box.w; hit.right = true; break; }
        } else {
            const col = map.colAt(box.left);
            for (let r = top; r <= bot; r++) if (map.isSolid(col, r)) { box.x = (col + 1) * ts; hit.left = true; break; }
        }
    }

    // ---- Y axis vs SOLID ----
    box.y += dy;
    if (dy !== 0) {
        const left = map.colAt(box.left), right = map.colAt(box.right - PF_EPS);
        if (dy > 0) {
            const row = map.rowAt(box.bottom - PF_EPS);
            for (let c = left; c <= right; c++) if (map.isSolid(c, row)) { box.y = row * ts - box.h; hit.down = true; break; }
        } else {
            const row = map.rowAt(box.top);
            for (let c = left; c <= right; c++) if (map.isSolid(c, row)) { box.y = (row + 1) * ts; hit.up = true; break; }
        }
    }

    // ---- ONE-WAY platforms: solid ONLY to a box descending onto the top edge ----
    // The test that makes it "one-way": the box's bottom last step must have been
    // at or above the platform's top edge. If you're already below it (jumping up
    // through it, or dropping through), it isn't solid.
    if (dy >= 0 && !opts.dropThrough && !hit.down) {
        const left = map.colAt(box.left), right = map.colAt(box.right - PF_EPS);
        const row = map.rowAt(box.bottom - PF_EPS);
        for (let c = left; c <= right; c++) {
            if (map.get(c, row) === PFTile.ONE_WAY) {
                const topEdge = row * ts;
                if (prevBottom <= topEdge + 1) { box.y = topEdge - box.h; hit.down = true; break; }
            }
        }
    }

    // ---- SLOPE tiles: sample the ramp surface under the box centre ----
    // SLOPE_NE rises to the right → surfaceY = rowTop + (ts - localX).
    // SLOPE_NW rises to the left  → surfaceY = rowTop + localX.
    if (dy >= 0) {
        const cx = box.x + box.w / 2;
        const col = map.colAt(cx);
        const localX = clamp(cx - col * ts, 0, ts);
        const feetRow = map.rowAt(box.bottom - PF_EPS);
        let surfaceY = null;
        for (let r = feetRow; r <= feetRow + 1; r++) {
            const t = map.get(col, r);
            if (t === PFTile.SLOPE_NE) { surfaceY = r * ts + (ts - localX); break; }
            if (t === PFTile.SLOPE_NW) { surfaceY = r * ts + localX; break; }
        }
        if (surfaceY !== null) {
            const climbing = box.bottom >= surfaceY - 1;                       // feet at/under the ramp
            const sticking = opts.wasGround && box.bottom < surfaceY && (surfaceY - box.bottom) <= ts * 0.6; // glue downhill
            if (climbing || sticking) { box.y = surfaceY - box.h; hit.down = true; hit.slope = true; }
        }
    }

    return hit;
}

// ---- per-tier UI helpers (re-declared; pf-prefixed) -------------------------
function pfFocusHint(ctx, w, h, focused) {
    if (focused) return;
    ctx.fillStyle = 'rgba(13,17,23,0.6)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9d1d9'; ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶ click here, then use the keyboard', w / 2, h / 2);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function pfBar(ctx, x, y, w, frac, color, label) {
    const H = 7;
    ctx.fillStyle = PF.dim; ctx.fillRect(x, y, w, H);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), H);
    if (label) { ctx.fillStyle = PF.text; ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(label, x, y - 4); }
}

// =============================================================================
// MovingPlatform — a kinematic solid box that either oscillates between two
// points (lerp along a path) or sits still as a conveyor (a surface velocity).
// =============================================================================
class MovingPlatform {
    constructor(opts) {
        this.box = new AABB(opts.x, opts.y, opts.w, opts.h);
        this.kind = opts.kind || 'move';        // 'move' | 'conveyor'
        this.ax = opts.x; this.ay = opts.y;
        this.bx = opts.bx ?? opts.x; this.by = opts.by ?? opts.y;
        this.period = opts.period || 2.2;        // seconds end-to-end
        this.conveyor = opts.conveyor || 0;      // px/s surface speed (conveyor)
        this.t = 0; this.dir = 1;
        this.color = opts.color || PF.oneWay;
    }
}
function pfMovePlatform(p, dt) {
    if (p.kind === 'conveyor') return;           // static surface, no path motion
    p.t += (dt / p.period) * p.dir;
    if (p.t >= 1) { p.t = 1; p.dir = -1; }
    if (p.t <= 0) { p.t = 0; p.dir = 1; }
    p.box.x = lerp(p.ax, p.bx, p.t);
    p.box.y = lerp(p.ay, p.by, p.t);
}
// Move every platform, carry whoever is standing on one, and resolve the player
// out of any platform it overlaps. Carrying BEFORE resolving is the whole point:
// the rider inherits the platform's per-step delta, so it doesn't slide off.
function pfRidePlatforms(player, platforms, dt) {
    const b = player.box;
    for (const p of platforms) {
        // "riding" = feet on the platform top this step, horizontally overlapping
        const wasOn = b.bottom <= p.box.top + 4 && b.bottom >= p.box.top - 6 &&
                      b.right > p.box.left + 2 && b.left < p.box.right - 2 && player.vy >= -1;
        const bx0 = p.box.x, by0 = p.box.y;
        pfMovePlatform(p, dt);
        const ddx = p.box.x - bx0, ddy = p.box.y - by0;
        if (wasOn) {
            b.x += ddx; b.y += ddy;                 // carry: inherit the platform's motion
            if (p.conveyor) b.x += p.conveyor * dt; // conveyor surface drags you along
            player.onGround = true; player.canDash = true;
            if (player.vy > 0) player.vy = 0;
        }
        // solid resolution vs the (possibly moved) platform box
        if (b.intersects(p.box)) {
            const oL = b.right - p.box.left, oR = p.box.right - b.left;
            const oT = b.bottom - p.box.top, oB = p.box.bottom - b.top;
            const minH = Math.min(oL, oR), minV = Math.min(oT, oB);
            if (minV <= minH) {
                if (oT < oB) { b.y = p.box.top - b.h; if (player.vy > 0) player.vy = 0; player.onGround = true; player.canDash = true; }
                else { b.y = p.box.bottom; if (player.vy < 0) player.vy = 0; }
            } else {
                if (oL < oR) { b.x = p.box.left - b.w; if (player.vx > 0) player.vx = 0; }
                else { b.x = p.box.right; if (player.vx < 0) player.vx = 0; }
            }
        }
    }
}

// An input wrapper that turns "↓ held + jump" into a drop-through request instead
// of a jump (used by the one-way and capstone demos). Keeps PlayerBody itself
// blissfully unaware of one-way platforms.
function pfDropInput(input) {
    return {
        isDown: (a) => input.isDown(a),
        pressed: (a) => ((a === 'jump' || a === 'up') && input.isDown('down')) ? false : input.pressed(a),
        released: (a) => input.released(a),
        axisX: () => input.axisX(),
        endFrame: () => input.endFrame(),
        get focused() { return input.focused; },
    };
}

// =============================================================================
// DEMO 1 — wallDemo : WALL-SLIDE + WALL-JUMP
// Two facing walls form a shaft. Press TOWARD a wall in the air to cling and
// slide (capped fall speed); jump to leap up and away. Chain them to climb.
// =============================================================================
(function wallDemo() {
    const canvas = document.getElementById('pfWallCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    // a shaft: two tall walls with a gap between
    const lx = 7, rx = 12;
    map.fillRect(lx, 1, lx, rows - 2, PFTile.SOLID);
    map.fillRect(rx, 1, rx, rows - 2, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(rx + 1, 3, cols - 2, 3, PFTile.SOLID); // a ledge to reach at the top-right

    const body = new PlayerBody(map, 9 * TS, (rows - 2) * TS,
        Object.assign({}, JUICED_CFG, { wallSlideSpeed: 90, wallJumpX: 300, wallJumpY: 540 }));
    const input = pfInstallKeys(canvas);
    const cb = document.getElementById('pfWallOn');
    const slideEl = document.getElementById('pfWallSlide');
    const slideVal = document.getElementById('pfWallSlideVal');
    const hud = document.getElementById('pfWallHud');
    document.getElementById('pfWallReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    function update(dt) {
        body.cfg.wallSlideSpeed = cb.checked ? +slideEl.value : 0;
        body.update(dt, input);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawBody(ctx, body);
        pfFocusHint(ctx, W, H, input.focused);
        if (slideVal) slideVal.textContent = slideEl.value;
        hud.textContent = cb.checked
            ? `${body.wallSliding ? 'WALL-SLIDING ' : ''}${body.wallJumped ? '· WALL-JUMP! ' : ''}— press into a wall to cling, jump to leap away. Climb to the top-right ledge.`
            : `wall abilities OFF — you just slide down. Turn them on and climb the shaft.`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — dashDemo : DASH (burst, cooldown, refresh-on-ground, dash-cancel)
// Tap dash (X / K / L) to fling in the aimed direction (or facing). The dash
// ignores gravity for its duration, then hands control back. You get ONE dash
// per ground/wall touch; a cooldown bar shows when it's ready again.
// =============================================================================
(function dashDemo() {
    const canvas = document.getElementById('pfDashCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, cols - 1, 0, PFTile.SOLID);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(8, rows - 5, 10, rows - 5, PFTile.SOLID);   // a couple of perches
    map.fillRect(15, rows - 7, 17, rows - 7, PFTile.SOLID);

    const body = new PlayerBody(map, 3 * TS, (rows - 2) * TS,
        Object.assign({}, JUICED_CFG, { dashSpeed: 560, dashMs: 130, dashCooldownMs: 250 }));
    const input = pfInstallKeys(canvas);
    const cb = document.getElementById('pfDashOn');
    const spEl = document.getElementById('pfDashSpeed');
    const spVal = document.getElementById('pfDashSpeedVal');
    const hud = document.getElementById('pfDashHud');
    document.getElementById('pfDashReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    const ghosts = [];
    function update(dt) {
        body.cfg.dashSpeed = cb.checked ? +spEl.value : 0;
        body.update(dt, input);
        if (body.dashLeft > 0) { ghosts.push({ x: body.box.x, y: body.box.y, w: body.box.w, h: body.box.h, a: 0.5 }); }
        for (const g of ghosts) g.a -= dt * 2.2;
        while (ghosts.length && ghosts[0].a <= 0) ghosts.shift();
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        for (const g of ghosts) { ctx.fillStyle = `rgba(255,209,102,${Math.max(0, g.a).toFixed(3)})`; ctx.fillRect(g.x, g.y, g.w, g.h); }
        pfDrawBody(ctx, body);
        // cooldown / readiness bar
        const frac = body.dashCdLeft > 0 ? 1 - body.dashCdLeft / (body.cfg.dashCooldownMs / 1000) : 1;
        pfBar(ctx, 12, 16, 120, body.canDash && body.dashCdLeft <= 0 ? 1 : frac,
            body.canDash && body.dashCdLeft <= 0 ? PF.good : PF.warn, body.canDash && body.dashCdLeft <= 0 ? 'DASH READY' : 'recharging…');
        pfFocusHint(ctx, W, H, input.focused);
        if (spVal) spVal.textContent = spEl.value;
        hud.textContent = cb.checked
            ? `${body.dashLeft > 0 ? 'DASHING ' : ''}— tap X/K/L to dash (aim with arrows). One dash per ground/wall touch.`
            : `dash OFF — turn it on and fling across the gaps.`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — oneWayDemo : ONE-WAY PLATFORMS
// Jump up THROUGH the wooden platforms from below; land ON them from above. Hold
// ↓ and press jump to drop down through the one you're standing on.
// =============================================================================
(function oneWayDemo() {
    const canvas = document.getElementById('pfOneWayCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    // a ladder of one-way platforms
    for (let c = 4; c <= 9; c++) map.set(c, rows - 4, PFTile.ONE_WAY);
    for (let c = 10; c <= 15; c++) map.set(c, rows - 7, PFTile.ONE_WAY);
    for (let c = 4; c <= 9; c++) map.set(c, rows - 10, PFTile.ONE_WAY);

    const body = new PlayerBody(map, 6 * TS, (rows - 2) * TS, JUICED_CFG);
    const input = pfInstallKeys(canvas);
    let dropTimer = 0;
    const cb = document.getElementById('pfOneWayOn');
    const hud = document.getElementById('pfOneWayHud');
    document.getElementById('pfOneWayReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    const di = pfDropInput(input);
    body.resolve = (box, dx, dy) => pfResolveWorld(box, dx, dy, map, { dropThrough: body.dropThrough, wasGround: body.onGround });

    function update(dt) {
        // ↓ + jump starts a brief drop-through window
        if (cb.checked && input.isDown('down') && (input.pressed('jump') || input.pressed('up'))) dropTimer = 0.18;
        dropTimer = Math.max(0, dropTimer - dt);
        body.dropThrough = dropTimer > 0;
        // when one-ways are OFF we still resolve, just treat them as non-solid always
        if (!cb.checked) body.dropThrough = true;
        body.update(dt, di);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawBody(ctx, body, body.dropThrough && cb.checked ? PF.warn : undefined);
        pfFocusHint(ctx, W, H, input.focused);
        hud.textContent = cb.checked
            ? `${body.dropThrough ? 'DROPPING THROUGH ' : ''}— jump up through the platforms, land on top, hold ↓ + jump to drop down.`
            : `one-way OFF — the platforms aren't solid at all. Turn it on to land on them.`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — slopeDemo : SLOPES
// Walk up and down 45° ramps built from triangle tiles. The resolver samples the
// ramp's surface height under your centre and keeps your feet glued to it.
// =============================================================================
(function slopeDemo() {
    const canvas = document.getElementById('pfSlopeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    // a hill: up-ramp (SLOPE_NE), a flat top, then a down-ramp (SLOPE_NW)
    const base = rows - 2;
    // up ramp rising to the right: each tile one row higher, solid beneath
    map.set(4, base, PFTile.SLOPE_NE);
    map.set(5, base - 1, PFTile.SLOPE_NE); map.set(5, base, PFTile.SOLID);
    map.set(6, base - 2, PFTile.SLOPE_NE); map.fillRect(6, base - 1, 6, base, PFTile.SOLID);
    // flat top
    map.fillRect(7, base - 3, 11, base - 3, PFTile.SOLID);
    map.fillRect(7, base - 2, 11, base, PFTile.SOLID);
    // down ramp falling to the right (SLOPE_NW rises to the left)
    map.set(12, base - 2, PFTile.SLOPE_NW); map.fillRect(12, base - 1, 12, base, PFTile.SOLID);
    map.set(13, base - 1, PFTile.SLOPE_NW); map.set(13, base, PFTile.SOLID);
    map.set(14, base, PFTile.SLOPE_NW);

    const body = new PlayerBody(map, 2 * TS, (base - 1) * TS, JUICED_CFG);
    const input = pfInstallKeys(canvas);
    const hud = document.getElementById('pfSlopeHud');
    document.getElementById('pfSlopeReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    body.resolve = (box, dx, dy) => pfResolveWorld(box, dx, dy, map, { wasGround: body.onGround });

    function update(dt) {
        body.update(dt, input);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawBody(ctx, body);
        pfFocusHint(ctx, W, H, input.focused);
        hud.textContent = `walk ←/→ over the hill · ${body.onGround ? 'grounded' : 'airborne'} · jump works off the ramp too`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — movingDemo : MOVING PLATFORMS + CONVEYOR
// A horizontal platform, a vertical lift, and a conveyor belt. Stand on one and
// you inherit its motion — the platform carries you, the belt drags you along.
// =============================================================================
(function movingDemo() {
    const canvas = document.getElementById('pfMovingCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(1, rows - 2, 3, rows - 2, PFTile.SOLID);     // start ledge
    map.fillRect(cols - 4, rows - 6, cols - 2, rows - 6, PFTile.SOLID); // goal ledge

    const platforms = [
        new MovingPlatform({ x: 4 * TS, y: (rows - 3) * TS, w: 84, h: 14, bx: 9 * TS, by: (rows - 3) * TS, period: 2.4, color: PF.oneWay }),
        new MovingPlatform({ x: 12 * TS, y: (rows - 3) * TS, w: 70, h: 14, bx: 12 * TS, by: (rows - 6) * TS, period: 2.0, color: '#9c6' }),
        new MovingPlatform({ x: 14 * TS, y: (rows - 6) * TS, w: 96, h: 14, kind: 'conveyor', conveyor: 120, color: '#4fc3f7' }),
    ];

    const body = new PlayerBody(map, 2 * TS, (rows - 3) * TS, JUICED_CFG);
    const input = pfInstallKeys(canvas);
    const hud = document.getElementById('pfMovingHud');
    document.getElementById('pfMovingReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    function update(dt) {
        body.update(dt, input);
        pfRidePlatforms(body, platforms, dt);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function drawPlatform(p) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.box.x, p.box.y, p.box.w, p.box.h);
        if (p.kind === 'conveyor') {                 // chevrons showing belt direction
            ctx.fillStyle = 'rgba(13,17,23,0.5)';
            const t = (performance.now() / 1000 * p.conveyor) % 16;
            for (let x = p.box.x - 16 + t; x < p.box.x + p.box.w; x += 16)
                ctx.fillRect(x, p.box.y + 4, 8, 4);
        }
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        for (const p of platforms) drawPlatform(p);
        pfDrawBody(ctx, body);
        pfFocusHint(ctx, W, H, input.focused);
        hud.textContent = `ride the orange platform across, the green lift up, the blue belt drags you — reach the right ledge. ${body.onGround ? '' : '(airborne)'}`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — gauntletDemo : CAPSTONE — a vertical ability gauntlet
// Everything in one climb: a one-way ladder, a wall-jump shaft, a dash gap over
// spikes, a moving lift, and a slope to the goal flag at the top.
// =============================================================================
(function gauntletDemo() {
    const canvas = document.getElementById('pfGauntletCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 28;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    // frame
    map.fillRect(0, 0, cols - 1, 0, PFTile.SOLID);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    // 1) one-way ladder bottom-left
    for (let c = 1; c <= 4; c++) map.set(c, rows - 4, PFTile.ONE_WAY);
    for (let c = 1; c <= 4; c++) map.set(c, rows - 7, PFTile.ONE_WAY);
    // 2) wall-jump shaft (two walls) middle-left
    map.fillRect(5, 2, 5, rows - 8, PFTile.SOLID);
    map.fillRect(8, 4, 8, rows - 5, PFTile.SOLID);
    map.fillRect(6, rows - 8, 7, rows - 8, PFTile.SOLID); // floor of the shaft entry
    // 3) a perch above the shaft, then a dash gap over spikes
    map.fillRect(6, 3, 9, 3, PFTile.SOLID);
    map.fillRect(11, 5, 13, 5, PFTile.SOLID);   // landing after the dash
    map.fillRect(10, rows - 2, 14, rows - 2, PFTile.SOLID); // low ground (the "pit" floor) under the gap
    // 4) slope up to the goal on the right
    const base = 5;
    map.set(14, base, PFTile.SLOPE_NE); map.fillRect(14, base + 1, 14, rows - 2, PFTile.SOLID);
    map.set(15, base - 1, PFTile.SLOPE_NE); map.fillRect(15, base, 15, rows - 2, PFTile.SOLID);
    map.fillRect(16, base - 2, cols - 2, base - 2, PFTile.SOLID); // goal platform

    const cfg = Object.assign({}, JUICED_CFG, { wallSlideSpeed: 95, wallJumpX: 300, wallJumpY: 520, dashSpeed: 560, dashMs: 130, dashCooldownMs: 220 });
    const body = new PlayerBody(map, 2 * TS, (rows - 3) * TS, cfg);
    const input = pfInstallKeys(canvas);
    const di = pfDropInput(input);
    body.resolve = (box, dx, dy) => pfResolveWorld(box, dx, dy, map, { dropThrough: body.dropThrough, wasGround: body.onGround });

    const goal = new AABB((cols - 3) * TS, (base - 3) * TS + 2, 20, TS - 4);
    const hud = document.getElementById('pfGauntletHud');
    let won = false, dropTimer = 0, bestState = 'idle';
    function reset() { body.respawn(); won = false; canvas.focus(); }
    document.getElementById('pfGauntletReset').addEventListener('click', reset);

    function update(dt) {
        if (won) { input.endFrame(); return; }
        if (input.isDown('down') && (input.pressed('jump') || input.pressed('up'))) dropTimer = 0.18;
        dropTimer = Math.max(0, dropTimer - dt);
        body.dropThrough = dropTimer > 0;
        body.update(dt, di);
        bestState = body.state;
        if (body.box.top > H + 60) body.respawn();
        if (body.box.intersects(goal)) won = true;
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        // goal flag
        ctx.fillStyle = PF.item;
        ctx.fillRect(goal.x + goal.w - 3, goal.y, 3, goal.h);
        ctx.beginPath(); ctx.moveTo(goal.x + goal.w - 3, goal.y); ctx.lineTo(goal.x + goal.w - 18, goal.y + 7); ctx.lineTo(goal.x + goal.w - 3, goal.y + 14); ctx.closePath(); ctx.fill();
        pfDrawBody(ctx, body);
        pfFocusHint(ctx, W, H, input.focused);
        if (won) {
            ctx.fillStyle = 'rgba(13,17,23,0.72)'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = PF.good; ctx.font = 'bold 30px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🏁 Gauntlet cleared!', W / 2, H / 2 - 10);
            ctx.fillStyle = PF.text; ctx.font = '15px system-ui'; ctx.fillText('one-way · wall-jump · dash · lift · slope', W / 2, H / 2 + 18);
            ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
        hud.textContent = won ? 'cleared! every ability + geometry type in one climb 🏁'
            : `state: ${body.state} · ↑/Space jump (into walls to wall-jump), X dash, ↓+jump drop, ride the slope to the flag`;
    }
    pfLoop(update, render).start();
})();
