// =============================================================================
// PLATFORMER — BEGINNER TIER DEMOS ("Ground & Gravity")
// =============================================================================
// Five demos, each an IIFE that early-returns if its canvas is absent (so this
// one file is safe to include on any page). Teaching order — each demo adds
// exactly ONE new idea on top of the last:
//
//   1. gravityDemo     — the platformer loop: gravity + integrating velocity→position
//   2. collisionDemo   — per-axis AABB-vs-tilemap (move X & resolve, then Y)
//   3. jumpDemo        — grounded detection + a simple impulse jump
//   4. runDemo         — horizontal feel: acceleration, max speed, friction
//   5. firstStepsDemo  — the capstone: a complete playable level, "First Steps"
//
// DEPENDENCIES (loaded BEFORE this file by beginner.html):
//   ../shared/utils.js   — clearCanvas, clamp, lerp (globals)
//   engine/tilemap.js    — window.PFTile, TileMap, PF, drawTileMap
//   engine/physics.js    — window.AABB, moveAndCollide
//   engine/input.js      — window.pfInstallKeys, pfLoop
//
// COLLISION NOTE (ARCHITECTURE.md): the only top-level bindings this file adds
// are `pfDrawBox` and `pfFocusHint`; everything else is a named function
// EXPRESSION (wrapped in parens) or scoped inside an IIFE, so nothing shadows a
// shared/utils.js or engine global.
//
// UNITS: velocities are in pixels/second (so gravity reads like a real
// acceleration). moveAndCollide wants the per-STEP displacement, so we always
// pass `velocity * dt` — which, at the fixed 1/60 s step, stays well under a tile
// (honouring the resolver's sub-tile contract).
// =============================================================================

// ---- Scroll-to-top (identical on every tier page) --------------------------
(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
        btn.style.opacity = window.pageYOffset > 300 ? '1' : '0';
    });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// ---- Shared draw helpers (pf-prefixed; no collision with utils/engine) ------

// Draw the player as a filled box with a 3px lit top edge, so "which way is up"
// reads instantly.
function pfDrawBox(ctx, box, fill, topEdge) {
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round(box.x), Math.round(box.y), box.w, box.h);
    if (topEdge) {
        ctx.fillStyle = topEdge;
        ctx.fillRect(Math.round(box.x), Math.round(box.y), box.w, 3);
    }
}

// A dimmed "click to focus" overlay for keyboard demos that aren't focused yet.
function pfFocusHint(ctx, w, h, focused) {
    if (focused) return;
    ctx.fillStyle = 'rgba(13,17,23,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶ click here, then use the keyboard', w / 2, h / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}

// =============================================================================
// DEMO 1 — gravityDemo
// The platformer loop in miniature: every step, gravity adds to vertical
// velocity, and velocity moves the box. No input — it just falls, lands, and
// re-drops. The fading trail makes ACCELERATION visible (the gaps grow).
// =============================================================================
(function gravityDemo() {
    const canvas = document.getElementById('pfGravityCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);

    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 2, cols - 1, rows - 1, PFTile.SOLID); // a thick floor

    const TERMINAL = 900; // px/s — fall speed never exceeds this
    const startY = TS * 0.4;
    const box = new AABB(W / 2 - 13, startY, 26, 30);
    let vy = 0, restT = 0, grounded = false;
    const trail = [];

    const gEl = document.getElementById('pfGravityG');
    const gVal = document.getElementById('pfGravityGVal');
    const trailCb = document.getElementById('pfGravityTrail');
    const hud = document.getElementById('pfGravityHud');
    function drop() { box.x = W / 2 - 13; box.y = startY; vy = 0; restT = 0; trail.length = 0; }
    document.getElementById('pfGravityDrop').addEventListener('click', drop);

    function update(dt) {
        const G = +gEl.value;
        if (gVal) gVal.textContent = G;
        vy = Math.min(vy + G * dt, TERMINAL);              // accelerate, clamp to terminal
        const hit = moveAndCollide(box, 0, vy * dt, map);  // move by displacement = v·dt
        grounded = hit.down;
        if (hit.down) {
            vy = 0;
            restT += dt;
            if (restT > 0.9) drop();                       // pause on the floor, then re-drop
        } else {
            restT = 0;
            if (trailCb.checked) {
                trail.push({ x: box.x, y: box.y });
                if (trail.length > 36) trail.shift();
            }
        }
    }

    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        for (let i = 0; i < trail.length; i++) {
            const a = ((i + 1) / trail.length) * 0.45;
            ctx.fillStyle = `rgba(124,242,200,${a.toFixed(3)})`;
            ctx.fillRect(Math.round(trail[i].x), Math.round(trail[i].y), box.w, box.h);
        }
        pfDrawBox(ctx, box, PF.player, PF.playerDk);
        hud.textContent =
            `y = ${box.y.toFixed(0)} px · vy = ${vy.toFixed(0)} px/s`
            + `${vy >= TERMINAL ? ' (terminal)' : ''} · ${grounded ? 'grounded ✔' : 'falling…'}`
            + ` · physics runs at a fixed 60 Hz`;
    }

    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — collisionDemo
// Per-axis AABB-vs-tilemap, with gravity OFF so collision is the only thing
// happening. Fly the box around with the keys; it stops flush against any solid
// tile. The HUD reports which sides are touching (the {left,right,up,down} flags
// moveAndCollide returns) — the same flags grounded-detection reads next demo.
// =============================================================================
(function collisionDemo() {
    const canvas = document.getElementById('pfCollisionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);

    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    // border
    map.fillRect(0, 0, cols - 1, 0, PFTile.SOLID);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    // a few interior obstacles to bump and slide along
    map.fillRect(5, 4, 7, 6, PFTile.SOLID);
    map.fillRect(12, 2, 12, 7, PFTile.SOLID);
    map.fillRect(13, 8, 16, 8, PFTile.SOLID);

    const start = { x: 2 * TS + 3, y: 2 * TS + 3 };
    const box = new AABB(start.x, start.y, 26, 26);
    const input = pfInstallKeys(canvas);
    const gridCb = document.getElementById('pfCollisionGrid');
    const hud = document.getElementById('pfCollisionHud');
    document.getElementById('pfCollisionReset').addEventListener('click', () => {
        box.x = start.x; box.y = start.y; canvas.focus();
    });

    const SPEED = 150; // px/s
    let hit = { left: false, right: false, up: false, down: false };

    function update(dt) {
        const vx = ((input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0)) * SPEED;
        const vy = ((input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0)) * SPEED;
        hit = moveAndCollide(box, vx * dt, vy * dt, map);
        input.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, { showGrid: gridCb.checked });
        pfDrawBox(ctx, box, PF.player, PF.playerDk);
        pfFocusHint(ctx, W, H, input.focused);
        const sides = ['up', 'down', 'left', 'right'].filter((k) => hit[k]);
        hud.textContent =
            `touching: ${sides.length ? sides.join(' + ') : 'nothing'}`
            + ` · move with arrows / WASD · the box stops flush — and you can SLIDE along a wall`;
    }

    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — jumpDemo
// Gravity is back, plus the two new ideas: GROUNDED (= last move's hit.down) and
// a JUMP (set vy negative, but only while grounded — so no double-jumps yet).
// Walk with ←/→, jump with ↑ or Space. Sliders for gravity and jump strength,
// with a live "jump height ≈ v²/2g" readout.
// =============================================================================
(function jumpDemo() {
    const canvas = document.getElementById('pfJumpCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);

    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 2, cols - 1, rows - 1, PFTile.SOLID);     // floor
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);                   // left wall
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);     // right wall
    map.fillRect(4, rows - 5, 7, rows - 5, PFTile.SOLID);           // low platform
    map.fillRect(11, rows - 7, 14, rows - 7, PFTile.SOLID);          // higher platform

    const start = { x: 2 * TS, y: (rows - 3) * TS - 2 };
    const box = new AABB(start.x, start.y, 24, 30);
    const input = pfInstallKeys(canvas);
    let vx = 0, vy = 0, onGround = false;

    const gravEl = document.getElementById('pfJumpGrav');
    const strEl = document.getElementById('pfJumpStr');
    const gravVal = document.getElementById('pfJumpGravVal');
    const strVal = document.getElementById('pfJumpStrVal');
    const hud = document.getElementById('pfJumpHud');
    document.getElementById('pfJumpReset').addEventListener('click', () => {
        box.x = start.x; box.y = start.y; vx = 0; vy = 0; canvas.focus();
    });

    const MOVE = 190, TERMINAL = 950;

    function update(dt) {
        const G = +gravEl.value, J = +strEl.value;
        vx = input.axisX() * MOVE;
        // jump only when grounded — the defining "can I jump?" check
        if ((input.pressed('jump') || input.pressed('up')) && onGround) vy = -J;
        vy = Math.min(vy + G * dt, TERMINAL);
        const hit = moveAndCollide(box, vx * dt, vy * dt, map);
        if (hit.down) vy = 0;
        if (hit.up && vy < 0) vy = 0;          // bonked head — kill upward speed
        if (hit.left || hit.right) vx = 0;
        onGround = hit.down;
        input.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawBox(ctx, box, PF.player, PF.playerDk);
        pfFocusHint(ctx, W, H, input.focused);
        if (gravVal) gravVal.textContent = gravEl.value;
        if (strVal) strVal.textContent = strEl.value;
        const G = +gravEl.value, J = +strEl.value;
        const heightPx = (J * J) / (2 * G);
        hud.textContent =
            `${onGround ? 'grounded ✔ — you can jump' : 'in the air — no jump'}`
            + ` · vy = ${vy.toFixed(0)} px/s · jump height ≈ ${heightPx.toFixed(0)} px (${(heightPx / TS).toFixed(1)} tiles)`;
    }

    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — runDemo
// Horizontal "feel": the SAME left/right input drives two boxes side by side.
// TOP snaps instantly to ±max speed; BOTTOM accelerates toward it and decays
// back via friction when you let go. The velocity bars make the difference
// obvious — instant feels robotic, accel+friction feels alive. Sliders tune
// acceleration, friction, and max speed.
// =============================================================================
(function runDemo() {
    const canvas = document.getElementById('pfRunCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);

    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);                 // left wall
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);   // right wall
    const rTop = 5, rBot = rows - 2;
    map.fillRect(1, rTop, cols - 2, rTop, PFTile.SOLID);           // top lane floor
    map.fillRect(1, rBot, cols - 2, rBot, PFTile.SOLID);           // bottom lane floor

    const input = pfInstallKeys(canvas);
    const boxI = new AABB(3 * TS, rTop * TS - 28, 26, 28);   // instant
    const boxA = new AABB(3 * TS, rBot * TS - 28, 26, 28);   // accel + friction
    let vxA = 0;

    const accelEl = document.getElementById('pfRunAccel');
    const fricEl = document.getElementById('pfRunFric');
    const maxEl = document.getElementById('pfRunMax');
    const accelVal = document.getElementById('pfRunAccelVal');
    const fricVal = document.getElementById('pfRunFricVal');
    const maxVal = document.getElementById('pfRunMaxVal');
    const hud = document.getElementById('pfRunHud');
    document.getElementById('pfRunReset').addEventListener('click', () => {
        boxI.x = 3 * TS; boxA.x = 3 * TS; vxA = 0; canvas.focus();
    });

    let vxI = 0;
    function update(dt) {
        const ax = input.axisX();
        const MAX = +maxEl.value, ACCEL = +accelEl.value, FRIC = +fricEl.value;
        // INSTANT: velocity is just input × max — snaps on and off
        vxI = ax * MAX;
        moveAndCollide(boxI, vxI * dt, 0, map);
        // ACCEL + FRICTION: ramp toward max while held, decay toward 0 when released
        if (ax !== 0) {
            vxA += ax * ACCEL * dt;
        } else {
            const drop = FRIC * dt;
            vxA = Math.abs(vxA) <= drop ? 0 : vxA - Math.sign(vxA) * drop;
        }
        vxA = clamp(vxA, -MAX, MAX);
        const hitA = moveAndCollide(boxA, vxA * dt, 0, map);
        if (hitA.left || hitA.right) vxA = 0;
        input.endFrame();
    }

    function bar(y, v, max, label) {
        const cx = W / 2, maxW = W / 2 - 60;
        ctx.fillStyle = PF.dim;
        ctx.fillRect(cx - maxW, y, maxW * 2, 4);
        const w = (v / max) * maxW;
        ctx.fillStyle = PF.accent;
        ctx.fillRect(cx, y - 3, w, 10);
        ctx.fillStyle = PF.text;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, y - 10);
        ctx.textAlign = 'start';
    }

    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawBox(ctx, boxI, PF.warn, '#ffd9a3');     // instant = amber
        pfDrawBox(ctx, boxA, PF.player, PF.playerDk); // accel = cyan
        const MAX = +maxEl.value;
        bar(rTop * TS - 40, vxI, MAX, 'INSTANT velocity (snaps)');
        bar(rBot * TS - 40, vxA, MAX, 'ACCEL + FRICTION (ramps)');
        pfFocusHint(ctx, W, H, input.focused);
        if (accelVal) accelVal.textContent = accelEl.value;
        if (fricVal) fricVal.textContent = fricEl.value;
        if (maxVal) maxVal.textContent = maxEl.value;
        hud.textContent =
            `hold ←/→ · top vx = ${vxI.toFixed(0)} px/s · bottom vx = ${vxA.toFixed(0)} px/s`
            + ` · let go and watch friction bring the cyan box down`;
    }

    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — firstStepsDemo (CAPSTONE — "First Steps")
// Everything composed: run (accel/friction) + jump (grounded) + gravity +
// per-axis tilemap collision, on a hand-built level with platforms, a pit, and
// a gold goal. Reach the goal to win; fall in the pit and you respawn (a free
// lesson in "out-of-bounds is empty air, so you fall off the map").
// =============================================================================
(function firstStepsDemo() {
    const canvas = document.getElementById('pfFirstCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);

    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    // walls + ceiling
    map.fillRect(0, 0, cols - 1, 0, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    // ground with a pit gap (columns 8–10 are open → you fall through)
    map.fillRect(1, rows - 1, 7, rows - 1, PFTile.SOLID);
    map.fillRect(11, rows - 1, cols - 2, rows - 1, PFTile.SOLID);
    // a staircase of platforms up to the goal
    map.fillRect(5, rows - 4, 7, rows - 4, PFTile.SOLID);
    map.fillRect(9, rows - 6, 11, rows - 6, PFTile.SOLID);
    map.fillRect(13, rows - 8, 15, rows - 8, PFTile.SOLID);
    map.fillRect(16, rows - 4, cols - 2, rows - 4, PFTile.SOLID);  // a landing near the goal

    const start = { x: 2 * TS, y: (rows - 3) * TS };
    const box = new AABB(start.x, start.y, 24, 30);
    const goal = new AABB((cols - 3) * TS, (rows - 6) * TS + 2, 22, 30);
    const input = pfInstallKeys(canvas);
    const hud = document.getElementById('pfFirstHud');

    // The full Beginner-tier controller, in one place (also shown in the code block).
    const GRAV = 1700, TERMINAL = 1000, JUMP = 560, ACCEL = 1500, FRIC = 1800, MAX = 215;
    let vx = 0, vy = 0, onGround = false, won = false;

    function respawn() { box.x = start.x; box.y = start.y; vx = 0; vy = 0; }
    document.getElementById('pfFirstReset').addEventListener('click', () => {
        respawn(); won = false; canvas.focus();
    });

    function update(dt) {
        if (won) { input.endFrame(); return; }
        // horizontal: accelerate while held, friction when not
        const ax = input.axisX();
        if (ax !== 0) vx += ax * ACCEL * dt;
        else { const d = FRIC * dt; vx = Math.abs(vx) <= d ? 0 : vx - Math.sign(vx) * d; }
        vx = clamp(vx, -MAX, MAX);
        // jump when grounded
        if ((input.pressed('jump') || input.pressed('up')) && onGround) vy = -JUMP;
        // gravity + integrate + resolve
        vy = Math.min(vy + GRAV * dt, TERMINAL);
        const hit = moveAndCollide(box, vx * dt, vy * dt, map);
        if (hit.down) vy = 0;
        if (hit.up && vy < 0) vy = 0;
        if (hit.left || hit.right) vx = 0;
        onGround = hit.down;
        // fell in the pit? respawn. reached the goal? win.
        if (box.top > H + 60) respawn();
        if (box.intersects(goal)) won = true;
        input.endFrame();
    }

    function drawGoal() {
        // a little gold flag: pole + pennant
        const px = goal.x + goal.w - 4, py = goal.y;
        ctx.fillStyle = PF.item;
        ctx.fillRect(px, py, 3, goal.h);
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(px - 18, py + 8); ctx.lineTo(px, py + 16);
        ctx.closePath(); ctx.fill();
    }

    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        drawGoal();
        pfDrawBox(ctx, box, PF.player, PF.playerDk);
        pfFocusHint(ctx, W, H, input.focused);
        if (won) {
            ctx.fillStyle = 'rgba(13,17,23,0.7)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = PF.good;
            ctx.font = 'bold 30px system-ui, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🏁 You made it!', W / 2, H / 2 - 12);
            ctx.fillStyle = PF.text;
            ctx.font = '15px system-ui, sans-serif';
            ctx.fillText('press Reset to run it again', W / 2, H / 2 + 20);
            ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
        hud.textContent = won
            ? 'reached the goal! 🏁 — that is every Beginner idea working together'
            : `${onGround ? 'grounded' : 'airborne'} · vx ${vx.toFixed(0)} · vy ${vy.toFixed(0)}`
              + ` · ←/→ run, ↑/Space jump, mind the pit, reach the gold flag`;
    }

    pfLoop(update, render).start();
})();
