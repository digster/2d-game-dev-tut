// =============================================================================
// PHYSICS PUZZLE — ADVANCED TIER DEMOS ("Rigid Bodies & Joints")
// =============================================================================
// Six demos, each an IIFE that early-returns if its canvas is absent. Teaching
// order — each adds exactly ONE new idea on top of the last:
//
//   1. rotationDemo   — a body has a SECOND integrator: angle, driven by torque
//   2. satDemo        — SAT finds the axis of least overlap = the collision normal
//   3. impulseDemo    — an off-centre impulse (r × J) makes a body spin, not just slide
//   4. stackDemo      — friction + positional correction = boxes that rest and stack
//   5. jointDemo      — a joint pins two bodies at a point; a force threshold breaks it
//   6. contraptionDemo— capstone: a see-saw catapult flings a ball into the goal
//
// DEPENDENCIES (loaded BEFORE this file by advanced.html):
//   ../shared/utils.js   — Vector2D, clearCanvas, clamp (globals)
//   engine/loop.js       — window.pzLoop, pzInstallPointer
//   engine/render.js     — window.PZ
//   engine/rigid.js      — window.PZRigidBody, pzPolyVsPoly, pzSolveManifold,
//                          PZJoint, pzStepWorld, pzBoxVerts, pzRegularVerts,
//                          pzDrawPoly, pzArenaBodies, …
//
// ENGINE PROMOTION: the convex-polygon rigid-body engine was taught INLINE in
// THIS file originally; once the Expert tier ("Destruction & Debris") became its
// 2nd consumer it was MOVED to engine/rigid.js (per the repo's promote-on-2nd-
// consumer rule). This file now just USES it. The Beginner circle solver is a
// different (superseded) collision family and stays inline in beginner-demos.js.
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
// DEMO 1 — rotationDemo
// A body has TWO integrators now: position (from velocity) and angle (from
// angular velocity). Drag from a point on the box and release: the impulse is
// applied AT that point, so an off-centre pull spins it. Zero gravity to isolate.
// =============================================================================
(function rotationDemo() {
    const canvas = document.getElementById('pzRotateCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzRotateHud');

    let box;
    function reset() { box = new PZRigidBody(W / 2, H / 2, pzBoxVerts(120, 80), { restitution: 0, color: PZ.accent }); }
    reset();
    document.getElementById('pzRotateReset').addEventListener('click', reset);

    function update(dt) {
        if (pointer.justReleased && pointer.releaseStart) {
            // impulse = drag vector (release → start), applied at the GRAB point
            const imx = (pointer.releaseStart.x - pointer.releaseEnd.x) * box.mass * 7;
            const imy = (pointer.releaseStart.y - pointer.releaseEnd.y) * box.mass * 7;
            box.applyImpulse(imx, imy, pointer.releaseStart.x - box.pos.x, pointer.releaseStart.y - box.pos.y);
        }
        box.pos.x += box.vel.x * dt; box.pos.y += box.vel.y * dt; box.angle += box.angularVel * dt;
        // wrap around so it never leaves
        if (box.pos.x < -60) box.pos.x = W + 60; if (box.pos.x > W + 60) box.pos.x = -60;
        if (box.pos.y < -60) box.pos.y = H + 60; if (box.pos.y > H + 60) box.pos.y = -60;
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawPoly(ctx, box, PZ.accent, '#1f6f93');
        if (pointer.isDown && pointer.start) {
            ctx.strokeStyle = PZ.aim; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(pointer.start.x, pointer.start.y); ctx.lineTo(pointer.pos.x, pointer.pos.y); ctx.stroke();
            ctx.fillStyle = PZ.bad; ctx.beginPath(); ctx.arc(pointer.start.x, pointer.start.y, 4, 0, Math.PI * 2); ctx.fill();
        }
        hud.textContent = `angle = ${(box.angle * 180 / Math.PI % 360).toFixed(0)}° · spin = ${(box.angularVel).toFixed(2)} rad/s · drag from a CORNER to spin it, the CENTRE to slide it`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — satDemo
// Collision DETECTION only. Drag the cyan box through the gold pentagon; when
// they overlap, SAT finds the axis of least penetration — drawn as the normal
// arrow at the contact point(s). No response yet; just see what SAT computes.
// =============================================================================
(function satDemo() {
    const canvas = document.getElementById('pzSatCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzSatHud');

    const poly = new PZRigidBody(W * 0.62, H / 2, pzRegularVerts(5, 64), { static: true, color: PZ.target, angle: 0.3 });
    const box = new PZRigidBody(W * 0.3, H / 2, pzBoxVerts(110, 90), { static: true, color: PZ.accent, angle: -0.2 });
    let grabbing = null, off = { x: 0, y: 0 };
    document.getElementById('pzSatReset').addEventListener('click', () => { box.pos.set(W * 0.3, H / 2); box.angle = -0.2; });

    function update() {
        if (pointer.justPressed) { grabbing = box; off = { x: box.pos.x - pointer.pos.x, y: box.pos.y - pointer.pos.y }; }
        if (pointer.justReleased) grabbing = null;
        if (grabbing && pointer.isDown) { box.pos.set(pointer.pos.x + off.x, pointer.pos.y + off.y); }
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        const m = pzPolyVsPoly(box, poly);
        pzDrawPoly(ctx, poly, m ? '#caa23a' : PZ.target, '#8a6a1a');
        pzDrawPoly(ctx, box, m ? '#5fb0d6' : PZ.accent, '#1f6f93');
        if (m) {
            for (const c of m.contacts) {
                ctx.fillStyle = PZ.bad; ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.fill();
                const L = 30 + c.pen;
                ctx.strokeStyle = PZ.good; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + m.normal.x * L, c.y + m.normal.y * L); ctx.stroke();
            }
            const maxPen = Math.max(...m.contacts.map(c => c.pen));
            hud.textContent = `OVERLAP · normal (${m.normal.x.toFixed(2)}, ${m.normal.y.toFixed(2)}) · depth ${maxPen.toFixed(1)} px · ${m.contacts.length} contact(s)`;
        } else {
            hud.textContent = `separated — drag the cyan box into the pentagon`;
        }
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — impulseDemo
// Now we RESPOND. Boxes dropped onto a floor collide and — crucially — an
// off-centre hit makes them spin (r × J), then tip and settle. Click to drop a
// box; tune restitution (bounciness).
// =============================================================================
(function impulseDemo() {
    const canvas = document.getElementById('pzImpulseCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const eEl = document.getElementById('pzImpulseE');
    const eVal = document.getElementById('pzImpulseEVal');
    const hud = document.getElementById('pzImpulseHud');

    let bodies;
    function reset() { bodies = pzArenaBodies(W, H); }
    reset();
    document.getElementById('pzImpulseReset').addEventListener('click', reset);

    function drop(x) {
        if (bodies.length > 24) return;
        const w = 40 + Math.random() * 30, h = 30 + Math.random() * 30;
        const b = new PZRigidBody(clamp(x, 60, W - 60), 40, pzBoxVerts(w, h), {
            restitution: +eEl.value, friction: 0.4, angle: (Math.random() - 0.5) * 1.2, color: PZ.ball,
        });
        b.angularVel = (Math.random() - 0.5) * 4;
        bodies.push(b);
    }

    function update(dt) {
        const e = +eEl.value; if (eVal) eVal.textContent = e.toFixed(2);
        for (const b of bodies) if (!b.isStatic) b.restitution = e;
        if (pointer.justPressed) drop(pointer.pos.x);
        pzStepWorld(bodies, [], 0, 1200, dt, { iterations: 10 });
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        for (const b of bodies) pzDrawPoly(ctx, b, b.isStatic ? PZ.wall : PZ.ball, b.isStatic ? '#2b3350' : '#3fae8e');
        const moving = bodies.filter(b => !b.isStatic && (Math.abs(b.angularVel) > 0.1 || b.vel.length() > 8)).length;
        hud.textContent = `${bodies.filter(b => !b.isStatic).length} box(es) · ${moving} still moving · click to drop · restitution ${(+eEl.value).toFixed(2)}`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — stackDemo
// Friction + positional correction = boxes that actually REST and STACK. Drag
// from the left to fling a projectile box at the tower. Low friction → it slides
// apart; high friction → it holds and topples as a unit.
// =============================================================================
(function stackDemo() {
    const canvas = document.getElementById('pzStackCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const fEl = document.getElementById('pzStackFriction');
    const fVal = document.getElementById('pzStackFrictionVal');
    const hud = document.getElementById('pzStackHud');

    let bodies;
    function reset() {
        bodies = pzArenaBodies(W, H);
        const floorTop = H - 26;
        for (let i = 0; i < 5; i++) {
            const bw = 80 - i * 6, bh = 34;
            bodies.push(new PZRigidBody(W * 0.62, floorTop - 17 - i * bh, pzBoxVerts(bw, bh), { friction: +fEl.value, restitution: 0.05, color: PZ.target, tag: 'block' }));
        }
    }
    reset();
    document.getElementById('pzStackReset').addEventListener('click', reset);

    function update(dt) {
        const f = +fEl.value; if (fVal) fVal.textContent = f.toFixed(2);
        for (const b of bodies) if (b.tag === 'block') b.friction = f;
        if (pointer.justReleased && pointer.releaseStart) {
            const dx = pointer.releaseEnd.x - pointer.releaseStart.x;
            const dy = pointer.releaseEnd.y - pointer.releaseStart.y;
            const ball = new PZRigidBody(pointer.releaseStart.x, pointer.releaseStart.y, pzRegularVerts(8, 20), { friction: 0.3, restitution: 0.1, density: 0.012, color: PZ.ball, tag: 'shot' });
            ball.vel.set(dx * 7, dy * 7);
            bodies.push(ball);
        }
        pzStepWorld(bodies, [], 0, 1200, dt, { iterations: 12 });
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        for (const b of bodies) {
            if (b.isStatic) pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
            else if (b.tag === 'shot') pzDrawPoly(ctx, b, PZ.ball, '#3fae8e');
            else pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
        }
        if (pointer.isDown && pointer.start) {
            ctx.strokeStyle = PZ.aim; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(pointer.start.x, pointer.start.y); ctx.lineTo(pointer.pos.x, pointer.pos.y); ctx.stroke();
        }
        hud.textContent = `friction = ${(+fEl.value).toFixed(2)} · drag from the left to fling a ball at the stack`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — jointDemo
// A chain of planks linked by pivot joints, hung from a fixed anchor — a rigid
// rope/bridge. Drag the end to swing it. Lower the "break force" and a hard yank
// SNAPS a joint (the chain falls). Joints are constraints between bodies.
// =============================================================================
(function jointDemo() {
    const canvas = document.getElementById('pzJointCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const bEl = document.getElementById('pzJointBreak');
    const bVal = document.getElementById('pzJointBreakVal');
    const hud = document.getElementById('pzJointHud');

    let bodies, joints;
    function reset() {
        bodies = []; joints = [];
        const N = 6, link = 56, y = 80, x0 = 120;
        const anchorPt = { x: x0 - link / 2, y };
        let prev = null;
        for (let i = 0; i < N; i++) {
            const body = new PZRigidBody(x0 + i * link, y, pzBoxVerts(link - 8, 16), { friction: 0.4, restitution: 0.1, density: 0.006, color: PZ.target });
            bodies.push(body);
            if (i === 0) joints.push(new PZJoint(body, { x: -link / 2, y: 0 }, null, null, { worldPoint: anchorPt, breakImpulse: +bEl.value }));
            else joints.push(new PZJoint(prev, { x: link / 2, y: 0 }, body, { x: -link / 2, y: 0 }, { breakImpulse: +bEl.value }));
            prev = body;
        }
    }
    reset();
    document.getElementById('pzJointReset').addEventListener('click', reset);
    let grab = null, off = { x: 0, y: 0 };

    function update(dt) {
        const bf = +bEl.value; if (bVal) bVal.textContent = bf >= 9000 ? '∞' : bf;
        for (const j of joints) if (!j.broken) j.breakImpulse = bf;
        if (pointer.justPressed) {
            let best = null, bestD = 40;
            for (const b of bodies) { const d = Math.hypot(pointer.pos.x - b.pos.x, pointer.pos.y - b.pos.y); if (d < bestD) { bestD = d; best = b; } }
            if (best) { grab = best; off = { x: best.pos.x - pointer.pos.x, y: best.pos.y - pointer.pos.y }; }
        }
        if (pointer.justReleased) grab = null;
        if (grab && pointer.isDown) {
            const nx = pointer.pos.x + off.x, ny = pointer.pos.y + off.y;
            grab.vel.set((nx - grab.pos.x) / dt, (ny - grab.pos.y) / dt);
            grab.pos.set(nx, ny);
        }
        pzStepWorld(bodies, joints, 0, 1200, dt, { iterations: 12 });
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // anchor peg
        ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(120 - 28, 80, 5, 0, Math.PI * 2); ctx.fill();
        for (const j of joints) if (!j.broken) { const { pa } = j.anchors(); ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(pa.x, pa.y, 3, 0, Math.PI * 2); ctx.fill(); }
        for (const b of bodies) pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
        const broken = joints.filter(j => j.broken).length;
        hud.textContent = `break force = ${(+bEl.value) >= 9000 ? '∞' : (+bEl.value)} · ${broken} joint(s) snapped · drag the chain to swing or yank it`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — contraptionDemo  (CAPSTONE: "Contraption")
// A see-saw catapult: a plank pivots on a fulcrum (a pivot joint to a fixed
// point). A ball rests on the right end. DROP the heavy weight onto the left end
// to fling the ball up and into the gold goal. Rigid bodies + a joint + collision.
// =============================================================================
(function contraptionDemo() {
    const canvas = document.getElementById('pzContraptionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzContraptionHud');
    // The catapult flings the ball UP, but how far depends on how hard you drop
    // the weight — so the goal is a generous BASKET zone near the top, not a tiny
    // ring. Any decent fling lands in it; doing nothing never does.
    const zone = { x0: 262, y0: 24, x1: 418, y1: 104 };

    let bodies, joints, plank, ball, weight, won, grab, off;
    function reset() {
        bodies = pzArenaBodies(W, H);
        const fulcrum = { x: 250, y: 230 };
        // the see-saw plank, pinned at its centre to the fulcrum point. Light, so it
        // whips around fast enough to launch the ball.
        plank = new PZRigidBody(fulcrum.x, fulcrum.y, pzBoxVerts(280, 16), { friction: 0.7, restitution: 0.05, density: 0.003, color: PZ.target, tag: 'plank' });
        bodies.push(plank);
        // a STATIC rest-pillar under the right end holds the plank level until the
        // dropped weight lifts it off — otherwise the lone ball would just tip it.
        bodies.push(new PZRigidBody(fulcrum.x + 120, 286, pzBoxVerts(20, 96), { static: true, tag: 'pillar' }));
        joints = [new PZJoint(plank, { x: 0, y: 0 }, null, null, { worldPoint: fulcrum, beta: 0.3 })];
        // the ball to launch, resting on the right end above the pillar
        ball = new PZRigidBody(fulcrum.x + 130, fulcrum.y - 23, pzRegularVerts(10, 15), { friction: 0.4, restitution: 0.2, density: 0.006, color: PZ.ball, tag: 'ball' });
        bodies.push(ball);
        // the heavy weight the player drops on the LEFT end (starts on the floor)
        weight = new PZRigidBody(120, 322, pzBoxVerts(54, 54), { friction: 0.6, restitution: 0.05, density: 0.06, color: PZ.bad, tag: 'weight' });
        bodies.push(weight);
        won = false; grab = null; off = { x: 0, y: 0 };
    }
    reset();
    document.getElementById('pzContraptionReset').addEventListener('click', reset);

    function update(dt) {
        if (pointer.justPressed && Math.hypot(pointer.pos.x - weight.pos.x, pointer.pos.y - weight.pos.y) < 50) {
            grab = weight; off = { x: weight.pos.x - pointer.pos.x, y: weight.pos.y - pointer.pos.y };
        }
        if (pointer.justReleased) grab = null;
        if (grab && pointer.isDown) {
            const nx = pointer.pos.x + off.x, ny = pointer.pos.y + off.y;
            grab.vel.set((nx - grab.pos.x) / dt, (ny - grab.pos.y) / dt);
            grab.pos.set(nx, ny); grab.angularVel = 0; grab.angle = 0;
        }
        pzStepWorld(bodies, joints, 0, 1200, dt, { iterations: 14 });
        if (ball.pos.x > zone.x0 && ball.pos.x < zone.x1 && ball.pos.y > zone.y0 && ball.pos.y < zone.y1) won = true;
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // fulcrum triangle
        const f = joints[0].worldPoint;
        ctx.fillStyle = PZ.wall; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - 22, f.y + 60); ctx.lineTo(f.x + 22, f.y + 60); ctx.closePath(); ctx.fill();
        // goal — an open-top "basket" zone near the top
        const gcol = won ? PZ.good : PZ.target;
        ctx.fillStyle = won ? 'rgba(102,187,106,0.14)' : 'rgba(255,209,102,0.10)';
        ctx.fillRect(zone.x0, zone.y0, zone.x1 - zone.x0, zone.y1 - zone.y0);
        ctx.strokeStyle = gcol; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(zone.x0, zone.y0); ctx.lineTo(zone.x0, zone.y1);
        ctx.lineTo(zone.x1, zone.y1); ctx.lineTo(zone.x1, zone.y0);
        ctx.stroke();
        ctx.fillStyle = gcol; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('🧺 GOAL', (zone.x0 + zone.x1) / 2, zone.y0 + 16); ctx.textAlign = 'start';
        for (const b of bodies) {
            if (b.isStatic) pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
            else if (b.tag === 'weight') pzDrawPoly(ctx, b, PZ.bad, '#7a2b2a');
            else if (b.tag === 'ball') pzDrawPoly(ctx, b, PZ.ball, '#3fae8e');
            else pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
        }
        if (won) hud.innerHTML = `<span style="color:${PZ.good}">🏆 Launched into the goal!</span> Click "Reset" to play again.`;
        else hud.textContent = `drag the red weight up onto the LEFT end of the see-saw to fling the ball UP into the goal`;
    }
    pzLoop(update, render).start();
})();
