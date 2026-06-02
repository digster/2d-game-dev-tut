// =============================================================================
// PHYSICS PUZZLE — BEGINNER TIER DEMOS ("Launch & Land")
// =============================================================================
// Six demos, each an IIFE that early-returns if its canvas is absent (so this
// one file is safe to include on any page). Teaching order — each demo adds
// exactly ONE new idea on top of the last:
//
//   1. worldDemo     — the world: gravity + integrating velocity → position
//   2. bounceDemo    — circle-vs-arena collision: reflect-and-attenuate (restitution)
//   3. slingDemo     — drag-to-aim; a release is an impulse (v += J/m)
//   4. predictDemo   — trajectory preview = the same sim, stepped forward
//   5. collideDemo   — circle-vs-circle: separate, then impulse along the normal
//   6. knockDemo     — the capstone "Knock-Down": everything on one world
//
// DEPENDENCIES (loaded BEFORE this file by beginner.html):
//   ../shared/utils.js   — Vector2D, clearCanvas, clamp, drawVector (globals)
//   engine/world.js      — window.PZWorld, PZBody, PZ_GRAVITY
//   engine/loop.js       — window.pzLoop, pzInstallPointer
//   engine/render.js     — window.PZ, pzDrawBody, pzDrawArena, pzDrawDots
//
// COLLISION NOTE (ARCHITECTURE.md): the top-level bindings this file adds are the
// three INLINE collision routines this tier teaches — `pzResolveStatic` (circle
// vs arena), `pzResolveBlock` (circle vs a static AABB) and `pzCollideCircles`
// (circle vs circle) — plus the helpers `pzClampPull`, `pzPredict`, `pzDrawAim`,
// `pzParkBall`. All are pz-prefixed so nothing shadows a shared/utils.js or
// engine global. When the Intermediate tier becomes the 2nd consumer of the
// static resolver it gets PROMOTED into engine/collide.js (a move), per the
// repo's "teach inline, promote on the 2nd consumer" rule.
//
// ⚠️ Vector2D mutates: add/multiply/divide/normalize/limit/lerp change `this`;
// only subtract/copy return a NEW vector. Every maths line below .copy()s a
// shared vector before mutating it.
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

// =============================================================================
// INLINE COLLISION ROUTINES (this tier's lesson; promoted to engine/ later)
// =============================================================================

// circle vs the rectangular arena {x,y,w,h}: clamp the body inside each wall and
// reflect the velocity component along that wall's (axis-aligned) normal, scaled
// by restitution. Returns which sides were touched this step.
function pzResolveStatic(b, arena) {
    const e = b.restitution;
    const hit = { left: false, right: false, top: false, bottom: false };
    if (b.left < arena.x)            { b.pos.x = arena.x + b.radius;            if (b.vel.x < 0) b.vel.x = -b.vel.x * e; hit.left = true; }
    if (b.right > arena.x + arena.w) { b.pos.x = arena.x + arena.w - b.radius;  if (b.vel.x > 0) b.vel.x = -b.vel.x * e; hit.right = true; }
    if (b.top < arena.y)             { b.pos.y = arena.y + b.radius;            if (b.vel.y < 0) b.vel.y = -b.vel.y * e; hit.top = true; }
    if (b.bottom > arena.y + arena.h){ b.pos.y = arena.y + arena.h - b.radius;  if (b.vel.y > 0) b.vel.y = -b.vel.y * e; b.vel.x *= 0.985; hit.bottom = true; }
    return hit;
}

// circle vs a static AABB block {x,y,w,h} (the capstone's ledge). Find the
// closest point on the box to the circle centre; if it's within the radius, push
// out along that normal and reflect the normal velocity. This is the "AABB half"
// of static collision — same idea as pzResolveStatic, arbitrary box.
function pzResolveBlock(b, block) {
    const cx = clamp(b.pos.x, block.x, block.x + block.w);
    const cy = clamp(b.pos.y, block.y, block.y + block.h);
    let dx = b.pos.x - cx, dy = b.pos.y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 > b.radius * b.radius) return false;          // not overlapping
    let nx, ny, pen;
    if (d2 > 1e-6) {
        // common case: centre is OUTSIDE the box, the closest point is on a face
        // or corner. Push out along that direction by the overlap.
        const d = Math.sqrt(d2);
        nx = dx / d; ny = dy / d; pen = b.radius - d;
    } else {
        // centre is INSIDE the box (deep penetration, e.g. a tunnelled shot):
        // eject through the NEAREST face by (depth-to-face + radius) so the
        // circle ends up fully clear of it.
        const dl = b.pos.x - block.x, dr = block.x + block.w - b.pos.x;
        const dtp = b.pos.y - block.y, dbt = block.y + block.h - b.pos.y;
        const m = Math.min(dl, dr, dtp, dbt);
        if (m === dtp)      { nx = 0; ny = -1; pen = dtp + b.radius; }
        else if (m === dbt) { nx = 0; ny = 1;  pen = dbt + b.radius; }
        else if (m === dl)  { nx = -1; ny = 0; pen = dl + b.radius; }
        else                { nx = 1; ny = 0;  pen = dr + b.radius; }
    }
    b.pos.x += nx * pen; b.pos.y += ny * pen;            // depenetrate
    const vn = b.vel.x * nx + b.vel.y * ny;              // velocity along normal
    if (vn < 0) {                                        // only if approaching
        b.vel.x -= (1 + b.restitution) * vn * nx;
        b.vel.y -= (1 + b.restitution) * vn * ny;
    }
    if (Math.abs(ny) > 0.7) b.vel.x *= 0.99;             // a little top friction
    return true;
}

// circle vs circle: separate the overlap (split by inverse mass) then apply an
// impulse along the centre-line so they trade momentum. Static bodies (invMass
// 0) never move — the same code handles ball-vs-ball and ball-vs-peg.
function pzCollideCircles(a, b) {
    const delta = b.pos.subtract(a.pos);                 // NEW vector, a → b
    const dist = delta.length();
    const minDist = a.radius + b.radius;
    if (dist === 0 || dist >= minDist) return false;
    const invSum = a.invMass + b.invMass;
    if (invSum === 0) return false;                      // two static bodies
    const n = delta.copy().divide(dist);                 // unit normal (copy → safe)

    // 1) positional correction — push apart along the normal, by inverse mass
    const overlap = minDist - dist;
    a.pos.add(n.copy().multiply(-overlap * a.invMass / invSum));
    b.pos.add(n.copy().multiply(overlap * b.invMass / invSum));

    // 2) impulse — only if the bodies are approaching
    const vn = b.vel.subtract(a.vel).dot(n);
    if (vn > 0) return true;
    const e = Math.min(a.restitution, b.restitution);
    const j = -(1 + e) * vn / invSum;
    const imp = n.copy().multiply(j);
    a.vel.add(imp.copy().multiply(-a.invMass));
    b.vel.add(imp.copy().multiply(b.invMass));
    return true;
}

// =============================================================================
// SLINGSHOT HELPERS (shared by demos 3, 4, 6)
// =============================================================================

// Clamp a pull so the ball can't be dragged more than `maxPull` from the anchor.
// Returns the on-screen pulled position plus `drag` (anchor → pulled vector).
function pzClampPull(anchor, p, maxPull) {
    const drag = new Vector2D(p.x - anchor.x, p.y - anchor.y);
    drag.limit(maxPull);                                  // mutates the fresh vector
    return { x: anchor.x + drag.x, y: anchor.y + drag.y, drag };
}

// Trajectory preview: step a throwaway copy of the ball forward and record the
// path. Uses the SAME integrator + the same collision, so the dots match flight
// to the pixel. opts: { gravityY, damping, radius, restitution, arena, block, steps }.
function pzPredict(start, vel, opts) {
    const w = new PZWorld({ gravity: opts.gravityY, damping: opts.damping });
    const ghost = new PZBody(start.x, start.y, opts.radius, {
        vx: vel.x, vy: vel.y, restitution: opts.restitution,
    });
    w.add(ghost);
    const pts = [];
    for (let i = 0; i < opts.steps; i++) {
        w.step(1 / 60);
        if (opts.arena) pzResolveStatic(ghost, opts.arena);
        if (opts.block) pzResolveBlock(ghost, opts.block);
        pts.push({ x: ghost.pos.x, y: ghost.pos.y });
    }
    return pts;
}

// Draw the elastic band from anchor to the pulled position.
function pzDrawAim(ctx, anchor, pulled) {
    ctx.strokeStyle = PZ.aim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(pulled.x, pulled.y);
    ctx.stroke();
    // a small peg at the anchor
    ctx.fillStyle = PZ.anchor;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
    ctx.fill();
}

// Park a ball at the anchor as a static body (gravity ignored) so it waits there
// between shots. Launching flips it dynamic again by restoring its inverse mass.
function pzParkBall(ball, anchor) {
    ball.pos.set(anchor.x, anchor.y);
    ball.vel.set(0, 0);
    ball.isStatic = true;
    ball.invMass = 0;
}
function pzLaunchBall(ball, vel) {
    ball.isStatic = false;
    ball.invMass = 1 / ball.mass;
    ball.vel.set(vel.x, vel.y);
}

// =============================================================================
// DEMO 1 — worldDemo
// The world in miniature: gravity adds to velocity, velocity moves the body.
// No collision yet — the ball falls off the bottom and re-drops. The fading
// trail makes ACCELERATION visible (the gaps grow each step).
// =============================================================================
(function worldDemo() {
    const canvas = document.getElementById('pzWorldCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const world = new PZWorld({ gravity: 1400, damping: 1 }); // no air drag → clean fall
    const startX = W / 2, startY = 30;
    const ball = world.add(new PZBody(startX, startY, 14, { restitution: 0 }));
    const trail = [];

    const gEl = document.getElementById('pzWorldG');
    const gVal = document.getElementById('pzWorldGVal');
    const trailCb = document.getElementById('pzWorldTrail');
    const hud = document.getElementById('pzWorldHud');
    function drop() { ball.pos.set(startX, startY); ball.vel.set(0, 0); trail.length = 0; }
    document.getElementById('pzWorldDrop').addEventListener('click', drop);

    function update() {
        const G = +gEl.value;
        if (gVal) gVal.textContent = G;
        world.gravity.y = G;                 // re-aim gravity from the slider
        world.step(1 / 60);
        if (trailCb.checked) {
            trail.push({ x: ball.pos.x, y: ball.pos.y });
            if (trail.length > 40) trail.shift();
        } else {
            trail.length = 0;
        }
        if (ball.top > H + 40) drop();       // fell off the bottom → re-drop
    }

    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        for (let i = 0; i < trail.length; i++) {
            const a = ((i + 1) / trail.length) * 0.4;
            ctx.fillStyle = `rgba(124,242,200,${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(trail[i].x, trail[i].y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        pzDrawBody(ctx, ball, PZ.ball, PZ.ballDk);
        hud.textContent =
            `y = ${ball.pos.y.toFixed(0)} px · vy = ${ball.vel.y.toFixed(0)} px/s`
            + ` · ${ball.vel.y > 5 ? 'accelerating ↓' : 'released'} · fixed 60 Hz`;
    }

    pzLoop(update, render, { step: 1 / 60 }).start();
})();

// =============================================================================
// DEMO 2 — bounceDemo
// Add the arena. Crossing a wall reflects the velocity along the wall normal,
// scaled by restitution. Click to toss a ball; tune restitution and gravity.
// =============================================================================
(function bounceDemo() {
    const canvas = document.getElementById('pzBounceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 16, y: 12, w: W - 32, h: H - 28 };

    const world = new PZWorld({ gravity: 1400 });
    const pointer = pzInstallPointer(canvas);

    const eEl = document.getElementById('pzBounceE');
    const eVal = document.getElementById('pzBounceEVal');
    const gEl = document.getElementById('pzBounceG');
    const gVal = document.getElementById('pzBounceGVal');
    const hud = document.getElementById('pzBounceHud');
    document.getElementById('pzBounceClear').addEventListener('click', () => world.clear());

    function spawn(x, y) {
        if (world.bodies.length >= 16) world.bodies.shift(); // cap the clutter
        const r = 9 + Math.random() * 8;
        world.add(new PZBody(x, y, r, {
            vx: (Math.random() - 0.5) * 240,
            vy: (Math.random() - 0.5) * 120,
            restitution: +eEl.value,
            color: PZ.ball,
        }));
    }

    function update() {
        const e = +eEl.value, G = +gEl.value;
        if (eVal) eVal.textContent = e.toFixed(2);
        if (gVal) gVal.textContent = G;
        world.gravity.y = G;
        if (pointer.justPressed) spawn(pointer.pos.x, pointer.pos.y);
        for (const b of world.bodies) b.restitution = e;
        world.step(1 / 60);
        for (const b of world.bodies) pzResolveStatic(b, arena);
        pointer.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawArena(ctx, arena);
        for (const b of world.bodies) pzDrawBody(ctx, b, PZ.ball, PZ.ballDk);
        hud.textContent = world.bodies.length === 0
            ? 'click to toss a ball…'
            : `${world.bodies.length} ball(s) · restitution e = ${(+eEl.value).toFixed(2)} (1 = forever, 0 = dead)`;
    }

    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — slingDemo
// Drag the ball back and release: the release is an IMPULSE (sets velocity all
// at once), pointed from the pull back through the anchor. Clamped so it can't
// tunnel. Parks back at the anchor when it settles.
// =============================================================================
(function slingDemo() {
    const canvas = document.getElementById('pzSlingCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 16, y: 12, w: W - 32, h: H - 28 };
    const anchor = new Vector2D(110, H - 90);
    const MAX_PULL = 130, MAX_SPEED = 1700;

    const world = new PZWorld({ gravity: 1400 });
    const ball = world.add(new PZBody(anchor.x, anchor.y, 14, { restitution: 0.45 }));
    pzParkBall(ball, anchor);
    const pointer = pzInstallPointer(canvas);

    const powerEl = document.getElementById('pzSlingPower');
    const powerVal = document.getElementById('pzSlingPowerVal');
    const hud = document.getElementById('pzSlingHud');
    let aiming = false, restT = 0, lastSpeed = 0;
    function reset() { pzParkBall(ball, anchor); aiming = false; restT = 0; }
    document.getElementById('pzSlingReset').addEventListener('click', reset);

    function update(dt) {
        const POWER = +powerEl.value;
        if (powerVal) powerVal.textContent = POWER.toFixed(1);

        if (pointer.justPressed && ball.isStatic) aiming = true;
        if (pointer.justReleased && aiming) {
            const pulled = pzClampPull(anchor, pointer.releaseEnd, MAX_PULL);
            const launch = pulled.drag.copy().multiply(-POWER).limit(MAX_SPEED);
            pzLaunchBall(ball, launch);
            lastSpeed = launch.length();
            aiming = false;
        }

        if (!ball.isStatic) {
            world.step(dt);
            pzResolveStatic(ball, arena);
            // settle → park for the next shot
            if (ball.vel.length() < 40 && ball.bottom >= arena.y + arena.h - 1) {
                restT += dt;
                if (restT > 0.5) reset();
            } else restT = 0;
        }
        pointer.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawArena(ctx, arena);
        if (aiming && pointer.isDown) {
            const pulled = pzClampPull(anchor, pointer.pos, MAX_PULL);
            pzDrawAim(ctx, anchor, pulled);
            // would-be launch arrow
            const launch = pulled.drag.copy().multiply(-1);
            drawVector(ctx, anchor, { x: anchor.x + launch.x, y: anchor.y + launch.y }, PZ.accent, 2);
            ctx.beginPath();
            ctx.arc(pulled.x, pulled.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = PZ.ball; ctx.fill();
            ctx.strokeStyle = PZ.ballDk; ctx.lineWidth = 2; ctx.stroke();
            hud.textContent = `pull = ${pulled.drag.length().toFixed(0)} px (max ${MAX_PULL}) · release to launch`;
        } else {
            pzDrawBody(ctx, ball, PZ.ball, PZ.ballDk);
            if (!ball.isStatic) hud.textContent = `flying · speed = ${ball.vel.length().toFixed(0)} px/s`;
            else hud.textContent = `launched at ${lastSpeed.toFixed(0)} px/s · drag the ball back & release…`;
        }
        // peg always visible
        ctx.fillStyle = PZ.anchor;
        ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — predictDemo
// The slingshot, plus a dotted preview. The preview steps a CLONE of the ball
// forward with the same integrator + collision, so it matches flight exactly.
// =============================================================================
(function predictDemo() {
    const canvas = document.getElementById('pzPredictCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 16, y: 12, w: W - 32, h: H - 28 };
    const anchor = new Vector2D(110, H - 90);
    const MAX_PULL = 130, MAX_SPEED = 1700, POWER = 9;

    const world = new PZWorld({ gravity: 1400 });
    const ball = world.add(new PZBody(anchor.x, anchor.y, 13, { restitution: 0.45 }));
    pzParkBall(ball, anchor);
    const pointer = pzInstallPointer(canvas);

    const stepsEl = document.getElementById('pzPredictSteps');
    const stepsVal = document.getElementById('pzPredictStepsVal');
    const showCb = document.getElementById('pzPredictShow');
    const hud = document.getElementById('pzPredictHud');
    let aiming = false, restT = 0;
    function reset() { pzParkBall(ball, anchor); aiming = false; restT = 0; }
    document.getElementById('pzPredictReset').addEventListener('click', reset);

    function launchVelFrom(point) {
        const pulled = pzClampPull(anchor, point, MAX_PULL);
        return { pulled, vel: pulled.drag.copy().multiply(-POWER).limit(MAX_SPEED) };
    }

    function update(dt) {
        if (pointer.justPressed && ball.isStatic) aiming = true;
        if (pointer.justReleased && aiming) {
            pzLaunchBall(ball, launchVelFrom(pointer.releaseEnd).vel);
            aiming = false;
        }
        if (!ball.isStatic) {
            world.step(dt);
            pzResolveStatic(ball, arena);
            if (ball.vel.length() < 40 && ball.bottom >= arena.y + arena.h - 1) {
                restT += dt; if (restT > 0.5) reset();
            } else restT = 0;
        }
        pointer.endFrame();
    }

    function render() {
        const steps = +stepsEl.value;
        if (stepsVal) stepsVal.textContent = steps;
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawArena(ctx, arena);

        if (aiming && pointer.isDown) {
            const { pulled, vel } = launchVelFrom(pointer.pos);
            if (showCb.checked) {
                const pts = pzPredict(anchor, vel, {
                    gravityY: world.gravity.y, damping: world.damping,
                    radius: ball.radius, restitution: ball.restitution,
                    arena, steps,
                });
                pzDrawDots(ctx, pts, PZ.trace, 2.5);
            }
            pzDrawAim(ctx, anchor, pulled);
            ctx.beginPath(); ctx.arc(pulled.x, pulled.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = PZ.ball; ctx.fill();
            ctx.strokeStyle = PZ.ballDk; ctx.lineWidth = 2; ctx.stroke();
            hud.textContent = `aiming · launch speed ≈ ${vel.length().toFixed(0)} px/s · ${steps}-step preview`;
        } else {
            pzDrawBody(ctx, ball, PZ.ball, PZ.ballDk);
            hud.textContent = ball.isStatic ? 'drag to aim — watch the dots match the flight…'
                                            : `flying · ${ball.vel.length().toFixed(0)} px/s`;
        }
        ctx.fillStyle = PZ.anchor;
        ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2); ctx.fill();
    }

    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — collideDemo
// Circle-vs-circle momentum exchange. Gravity OFF so the trade is pure (a
// top-down "space pool" break). The cue is heavier than the rack, so it plows
// through — inverse mass in action. Drag the cyan cue to break.
// =============================================================================
(function collideDemo() {
    const canvas = document.getElementById('pzCollideCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 16, y: 12, w: W - 32, h: H - 28 };
    const MAX_PULL = 140, MAX_SPEED = 1500, POWER = 9;

    const world = new PZWorld({ gravity: 0, damping: 0.992 }); // no gravity → pure exchange
    const pointer = pzInstallPointer(canvas);
    const eEl = document.getElementById('pzCollideE');
    const eVal = document.getElementById('pzCollideEVal');
    const hud = document.getElementById('pzCollideHud');

    let cue;
    function rack() {
        world.clear();
        // a heavier cue ball on the left
        cue = world.add(new PZBody(120, H / 2, 16, { restitution: +eEl.value, mass: 5, color: PZ.ball }));
        // a triangular rack of lighter balls on the right
        const r = 13, baseX = 430, baseY = H / 2;
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row <= col; row++) {
                const x = baseX + col * (r * 1.8);
                const y = baseY + (row - col / 2) * (r * 2.05);
                world.add(new PZBody(x, y, r, { restitution: +eEl.value, mass: 1.4, color: PZ.target }));
            }
        }
    }
    rack();
    document.getElementById('pzCollideReset').addEventListener('click', rack);

    let aiming = false, aimAnchor = null;
    function update(dt) {
        const e = +eEl.value;
        if (eVal) eVal.textContent = e.toFixed(2);
        for (const b of world.bodies) b.restitution = e;

        // aim from the cue's current position
        if (pointer.justPressed) { aiming = true; aimAnchor = cue.pos.copy(); }
        if (pointer.justReleased && aiming && aimAnchor) {
            const pulled = pzClampPull(aimAnchor, pointer.releaseEnd, MAX_PULL);
            const v = pulled.drag.copy().multiply(-POWER).limit(MAX_SPEED);
            cue.vel.set(v.x, v.y);
            aiming = false;
        }

        world.step(dt);
        for (const b of world.bodies) pzResolveStatic(b, arena);
        for (let i = 0; i < world.bodies.length; i++)
            for (let j = i + 1; j < world.bodies.length; j++)
                pzCollideCircles(world.bodies[i], world.bodies[j]);
        pointer.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawArena(ctx, arena);
        for (const b of world.bodies) pzDrawBody(ctx, b, b.color, PZ.ballDk);
        if (aiming && pointer.isDown && aimAnchor) {
            const pulled = pzClampPull(aimAnchor, pointer.pos, MAX_PULL);
            pzDrawAim(ctx, aimAnchor, pulled);
        }
        let moving = 0, ke = 0;
        for (const b of world.bodies) { const s = b.vel.length(); if (s > 8) moving++; ke += 0.5 * b.mass * s * s; }
        hud.textContent = `${moving} ball(s) moving · total KE ≈ ${(ke / 1000).toFixed(1)}k · drag the cyan cue to break`;
    }

    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — knockDemo  (CAPSTONE: "Knock-Down")
// Everything on one world: a slingshot with a live preview, an arena, a static
// ledge holding a row of red pins. Knock every pin off the ledge in 3 shots.
// =============================================================================
(function knockDemo() {
    const canvas = document.getElementById('pzKnockCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 16, y: 12, w: W - 32, h: H - 28 };
    const anchor = new Vector2D(72, H - 96);
    const ledge = { x: 372, y: 150, w: 212, h: 16 };
    const fallY = ledge.y + 70;                  // a pin is "off" once it drops past here
    const MAX_PULL = 150, MAX_SPEED = 1800, POWER = 11;

    const world = new PZWorld({ gravity: 1500 });
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzKnockHud');

    let ball, pins, shots, won, aiming, restT;
    function rack() {
        world.clear();
        ball = world.add(new PZBody(anchor.x, anchor.y, 14, { restitution: 0.5, mass: 4, color: PZ.ball }));
        pzParkBall(ball, anchor);
        pins = [];
        for (let i = 0; i < 5; i++) {
            const p = world.add(new PZBody(ledge.x + 26 + i * 40, ledge.y - 12, 11, {
                restitution: 0.25, mass: 1, color: PZ.pin, tag: 'pin',
            }));
            pins.push(p);
        }
        shots = 3; won = false; aiming = false; restT = 0;
    }
    rack();
    document.getElementById('pzKnockReset').addEventListener('click', rack);

    function update(dt) {
        if (!won) {
            if (pointer.justPressed && ball.isStatic && shots > 0) aiming = true;
            if (pointer.justReleased && aiming) {
                const pulled = pzClampPull(anchor, pointer.releaseEnd, MAX_PULL);
                const v = pulled.drag.copy().multiply(-POWER).limit(MAX_SPEED);
                pzLaunchBall(ball, v);
                shots--;
                aiming = false;
            }
        }

        world.step(dt);
        for (const b of world.bodies) { pzResolveStatic(b, arena); pzResolveBlock(b, ledge); }
        for (let i = 0; i < world.bodies.length; i++)
            for (let j = i + 1; j < world.bodies.length; j++)
                pzCollideCircles(world.bodies[i], world.bodies[j]);

        // park the ball for the next shot once it settles
        if (!ball.isStatic) {
            if (ball.vel.length() < 45 && ball.bottom >= arena.y + arena.h - 1) {
                restT += dt; if (restT > 0.5) pzParkBall(ball, anchor);
            } else restT = 0;
        }

        won = pins.every((p) => p.pos.y > fallY);
        pointer.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawArena(ctx, arena);

        // the ledge + a gold "off the ledge" zone hint below it
        ctx.fillStyle = PZ.wall;
        ctx.fillRect(ledge.x, ledge.y, ledge.w, ledge.h);
        ctx.fillStyle = PZ.wallLit;
        ctx.fillRect(ledge.x, ledge.y, ledge.w, 2);
        ctx.fillStyle = 'rgba(255,209,102,0.10)';
        ctx.fillRect(ledge.x, ledge.y + ledge.h, ledge.w, fallY - (ledge.y + ledge.h));

        for (const b of world.bodies) pzDrawBody(ctx, b, b.color, b.tag === 'pin' ? PZ.pinDk : PZ.ballDk);

        // aiming overlay with live preview
        if (aiming && pointer.isDown && !won) {
            const pulled = pzClampPull(anchor, pointer.pos, MAX_PULL);
            const v = pulled.drag.copy().multiply(-POWER).limit(MAX_SPEED);
            const pts = pzPredict(anchor, v, {
                gravityY: world.gravity.y, damping: world.damping,
                radius: ball.radius, restitution: ball.restitution,
                arena, block: ledge, steps: 110,
            });
            pzDrawDots(ctx, pts, PZ.trace, 2.5);
            pzDrawAim(ctx, anchor, pulled);
            ctx.beginPath(); ctx.arc(pulled.x, pulled.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = PZ.ball; ctx.fill();
            ctx.strokeStyle = PZ.ballDk; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.fillStyle = PZ.anchor;
        ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2); ctx.fill();

        const down = pins.filter((p) => p.pos.y > fallY).length;
        if (won) hud.innerHTML = `<span style="color:${PZ.good}">🏆 Cleared! All ${pins.length} pins knocked off.</span> Click "New rack" to play again.`;
        else if (shots === 0 && ball.isStatic) hud.innerHTML = `<span style="color:${PZ.bad}">Out of shots</span> — ${down}/${pins.length} down. Click "New rack".`;
        else hud.textContent = `${down}/${pins.length} pins down · ${shots} shot(s) left · drag the ball to aim`;
    }

    pzLoop(update, render).start();
})();
