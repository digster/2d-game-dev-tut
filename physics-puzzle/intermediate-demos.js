// =============================================================================
// PHYSICS PUZZLE — INTERMEDIATE TIER DEMOS ("Ropes & Chains")
// =============================================================================
// Six demos, each an IIFE that early-returns if its canvas is absent. Teaching
// order — each adds exactly ONE new idea on top of the last:
//
//   1. verletDemo     — Verlet vs Euler: store the PREVIOUS position, not velocity
//   2. constraintDemo — one distance constraint = "nudge two points to rest length"
//   3. ropeDemo       — a rope is a row of constraints; iterations = stiffness
//   4. swingDemo      — Verlet conserves swing energy; momentum is timing
//   5. cutDemo        — sever a constraint with a swipe — the genre's core verb
//   6. deliverDemo    — capstone "Deliver": cut to swing a payload into the goal
//
// DEPENDENCIES (loaded BEFORE this file by intermediate.html):
//   ../shared/utils.js   — Vector2D, clearCanvas, clamp, lineIntersection (globals)
//   engine/world.js      — (loaded for parity; this tier is position-based, so it
//                           mostly uses its own Verlet integrator below)
//   engine/loop.js       — window.pzLoop, pzInstallPointer
//   engine/render.js     — window.PZ, pzDrawDots
//
// TWO FAMILIES OF PHYSICS: the Beginner tier was velocity/impulse-based (PZBody:
// store velocity, apply forces). This tier is POSITION-based (Verlet: store the
// previous position; velocity is the implicit gap pos − prev). Position-based is
// the right tool for ropes because a "constraint" becomes a one-line position
// nudge. The two families share one world in the grand capstone later.
//
// COLLISION NOTE: this tier's new top-level names are all pz/PZ-prefixed and do
// not shadow shared/utils.js or engine globals: the classes PZVerletPoint /
// PZConstraint and the helpers pzStepRope, pzDrawRope, pzCutBlade, pzClickCut,
// pzPointToSeg, pzVerletArena, pzVerletBlock. PZVerletPoint/PZConstraint are
// taught INLINE here; they get promoted to engine/constraints.js when the
// Simulations tier (soft bodies / ragdolls) becomes their 2nd consumer.
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
// INLINE VERLET ENGINE (this tier's lesson; promoted to engine/ later)
// =============================================================================

// A Verlet point stores its CURRENT and PREVIOUS position. There is no velocity
// variable — the velocity is implicit: (pos − prev). To integrate, we reflect
// that gap forward and add acceleration·dt². A pinned point ignores integration
// (anchors, or a point the pointer is dragging).
class PZVerletPoint {
    constructor(x, y, radius = 4) {
        this.pos = new Vector2D(x, y);
        this.prev = new Vector2D(x, y);   // equal to pos ⇒ starts at rest
        this.radius = radius;
        this.pinned = false;
    }
    // gx, gy are acceleration in px/s² (passed as numbers so we never mutate a
    // shared gravity vector). `damping` < 1 bleeds a sliver of energy each step.
    integrate(gx, gy, dt, damping) {
        if (this.pinned) return;
        const vx = (this.pos.x - this.prev.x) * damping;   // implicit velocity·dt
        const vy = (this.pos.y - this.prev.y) * damping;
        this.prev.x = this.pos.x; this.prev.y = this.pos.y;
        this.pos.x += vx + gx * dt * dt;                    // x += v·dt + a·dt²
        this.pos.y += vy + gy * dt * dt;
    }
    // implicit velocity in px/s, for HUD readouts
    speed(dt) { return Math.hypot(this.pos.x - this.prev.x, this.pos.y - this.prev.y) / dt; }
}

// A distance constraint keeps two points `rest` apart. "Solving" it is one nudge:
// measure the current distance, and move each point half the error along the line
// between them (a pinned point doesn't move, so its partner takes the full
// correction). Run this several times per step (relaxation) to make it stiff.
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
        // distribute the correction: a pinned endpoint stays put
        const aMove = a.pinned ? 0 : (b.pinned ? 1 : 0.5);
        const bMove = b.pinned ? 0 : (a.pinned ? 1 : 0.5);
        a.pos.x += dx * diff * aMove; a.pos.y += dy * diff * aMove;
        b.pos.x -= dx * diff * bMove; b.pos.y -= dy * diff * bMove;
    }
}

// One Verlet step: integrate every point, then relax every constraint K times.
// More iterations ⇒ stiffer ropes (the corrections converge).
function pzStepRope(points, constraints, gx, gy, dt, iterations, damping) {
    for (const p of points) p.integrate(gx, gy, dt, damping);
    for (let k = 0; k < iterations; k++)
        for (const c of constraints) c.solve();
}

// Draw the live (un-cut) constraints as a rope.
function pzDrawRope(ctx, constraints, color = PZ.rope, width = 4) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    for (const c of constraints) {
        if (c.broken) continue;
        ctx.beginPath();
        ctx.moveTo(c.a.pos.x, c.a.pos.y);
        ctx.lineTo(c.b.pos.x, c.b.pos.y);
        ctx.stroke();
    }
}

// Swipe-cut: if the blade segment (x0,y0)->(x1,y1) crosses a constraint, break it.
// Uses lineIntersection from shared/utils.js. Returns how many were cut.
function pzCutBlade(constraints, x0, y0, x1, y1) {
    let cut = 0;
    const p0 = { x: x0, y: y0 }, p1 = { x: x1, y: y1 };
    for (const c of constraints) {
        if (c.broken) continue;
        if (lineIntersection(p0, p1, c.a.pos, c.b.pos)) { c.broken = true; cut++; }
    }
    return cut;
}

// Distance from point (px,py) to segment a→b — for click-to-cut.
function pzPointToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-6;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
}

// Click-cut: break the nearest constraint within `maxDist` of (px,py).
function pzClickCut(constraints, px, py, maxDist = 12) {
    let best = null, bestD = maxDist;
    for (const c of constraints) {
        if (c.broken) continue;
        const d = pzPointToSeg(px, py, c.a.pos.x, c.a.pos.y, c.b.pos.x, c.b.pos.y);
        if (d < bestD) { bestD = d; best = c; }
    }
    if (best) { best.broken = true; return true; }
    return false;
}

// Verlet collision is just depenetration: push a point's pos out of a wall. We
// DON'T touch a velocity variable — Verlet derives velocity from (pos − prev),
// so moving pos while prev stays put kills the inward motion automatically.
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
        // centre inside → eject through the nearest face
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

// Small shared helper: draw a candy/payload point as a filled circle.
function pzDrawCandy(ctx, p, fill = PZ.target, stroke = '#b58a2a') {
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
}

// =============================================================================
// DEMO 1 — verletDemo
// Verlet vs Euler: both fall identically under gravity, but Verlet stores the
// PREVIOUS position instead of a velocity. A "gust" shoves both — Verlet picks
// up the new velocity straight from its position history. Velocity is implicit.
// =============================================================================
(function verletDemo() {
    const canvas = document.getElementById('pzVerletCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const G = 1200, dt = 1 / 60, DAMP = 1;

    // Euler particle (stores velocity)
    let eX, eY, eVx, eVy;
    // Verlet particle (stores previous position)
    let vX, vY, vPx, vPy;
    function reset() {
        eX = W * 0.34; eY = 50; eVx = 0; eVy = 0;
        vX = W * 0.66; vY = 50; vPx = vX; vPy = vY;
    }
    reset();
    document.getElementById('pzVerletGust').addEventListener('click', () => {
        eVx += 220;            // Euler: add to the velocity variable
        vPx -= 220 * dt;       // Verlet: shift PREV so (pos − prev) grows → same v
    });
    document.getElementById('pzVerletReset').addEventListener('click', reset);
    const hud = document.getElementById('pzVerletHud');

    function update() {
        // Euler: v += g·dt ; pos += v·dt
        eVy += G * dt; eX += eVx * dt; eY += eVy * dt;
        // Verlet: pos += (pos − prev) + g·dt²   (velocity is implicit in pos − prev)
        const dx = (vX - vPx) * DAMP, dy = (vY - vPy) * DAMP;
        vPx = vX; vPy = vY;
        vX += dx;                 // no horizontal acceleration
        vY += dy + G * dt * dt;   // gravity
        if (eY > H + 30 && vY > H + 30) reset();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // dividing line + labels
        ctx.strokeStyle = '#222a3f'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
        ctx.fillStyle = PZ.dim; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('EULER — stores velocity (vx, vy)', W * 0.25, 22);
        ctx.fillText('VERLET — stores previous position', W * 0.75, 22);
        ctx.textAlign = 'start';
        // Euler particle + its velocity arrow
        ctx.fillStyle = PZ.pin;
        ctx.beginPath(); ctx.arc(eX, eY, 11, 0, Math.PI * 2); ctx.fill();
        drawVector(ctx, { x: eX, y: eY }, { x: eX + eVx * 0.08, y: eY + eVy * 0.08 }, PZ.pinDk, 2);
        // Verlet particle + its IMPLICIT velocity arrow (pos − prev), and a prev ghost
        ctx.fillStyle = 'rgba(124,242,200,0.3)';
        ctx.beginPath(); ctx.arc(vPx, vPy, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = PZ.ball;
        ctx.beginPath(); ctx.arc(vX, vY, 11, 0, Math.PI * 2); ctx.fill();
        drawVector(ctx, { x: vX, y: vY }, { x: vX + (vX - vPx) / dt * 0.08, y: vY + (vY - vPy) / dt * 0.08 }, PZ.ballDk, 2);

        hud.textContent =
            `Euler v = (${eVx.toFixed(0)}, ${eVy.toFixed(0)}) px/s · `
            + `Verlet v = (${((vX - vPx) / dt).toFixed(0)}, ${((vY - vPy) / dt).toFixed(0)}) px/s — same motion, no v variable`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — constraintDemo
// One distance constraint. Drag the anchor (the peg); the bob stays a fixed
// distance away — that's all a constraint does: nudge two points to rest length.
// =============================================================================
(function constraintDemo() {
    const canvas = document.getElementById('pzConstraintCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const G = 1400, dt = 1 / 60;

    const anchor = new PZVerletPoint(W / 2, 70, 7); anchor.pinned = true;
    const bob = new PZVerletPoint(W / 2, 70 + 130, 16);
    const link = new PZConstraint(anchor, bob);
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzConstraintHud');
    let grabbing = null;

    function reset() { bob.pos.set(W / 2, 200); bob.prev.set(W / 2, 200); anchor.pos.set(W / 2, 70); anchor.prev.set(W / 2, 70); }
    document.getElementById('pzConstraintReset').addEventListener('click', reset);

    function update() {
        if (pointer.justPressed) {
            // grab whichever point is nearer the press
            const da = Math.hypot(pointer.pos.x - anchor.pos.x, pointer.pos.y - anchor.pos.y);
            const db = Math.hypot(pointer.pos.x - bob.pos.x, pointer.pos.y - bob.pos.y);
            grabbing = (da < db && da < 40) ? anchor : (db < 40 ? bob : null);
            if (grabbing) grabbing.pinned = true;
        }
        if (pointer.justReleased && grabbing) {
            if (grabbing === bob) grabbing.pinned = false; // bob swings free; anchor stays pinned
            grabbing = null;
        }
        if (grabbing && pointer.isDown) {
            grabbing.prev.set(grabbing.pos.x, grabbing.pos.y); // track for release velocity
            grabbing.pos.set(pointer.pos.x, pointer.pos.y);
        }
        pzStepRope([anchor, bob], [link], 0, G, dt, 5, 0.995);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawRope(ctx, [link], PZ.rope, 4);
        // rest-length ring around the anchor
        ctx.strokeStyle = 'rgba(136,147,176,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(anchor.pos.x, anchor.pos.y, link.rest, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(anchor.pos.x, anchor.pos.y, anchor.radius, 0, Math.PI * 2); ctx.fill();
        pzDrawCandy(ctx, bob, PZ.ball, PZ.ballDk);
        const d = Math.hypot(bob.pos.x - anchor.pos.x, bob.pos.y - anchor.pos.y);
        hud.textContent = `length = ${d.toFixed(1)} px · rest = ${link.rest.toFixed(0)} px · drag the peg or the bob`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — ropeDemo
// A rope = a row of distance constraints. Pinned at both ends (a hanging cable).
// The iterations slider IS the stiffness: 1 relaxation = stretchy, 20 = taut.
// Grab any point to yank it.
// =============================================================================
(function ropeDemo() {
    const canvas = document.getElementById('pzRopeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const G = 1400, dt = 1 / 60, N = 16;

    let points, constraints;
    function build() {
        points = []; constraints = [];
        const x0 = 70, x1 = W - 70, y = 70;
        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            points.push(new PZVerletPoint(x0 + (x1 - x0) * t, y, 5));
        }
        points[0].pinned = true; points[N - 1].pinned = true;
        for (let i = 0; i < N - 1; i++) constraints.push(new PZConstraint(points[i], points[i + 1]));
    }
    build();
    const pointer = pzInstallPointer(canvas);
    const itEl = document.getElementById('pzRopeIters');
    const itVal = document.getElementById('pzRopeItersVal');
    const hud = document.getElementById('pzRopeHud');
    document.getElementById('pzRopeReset').addEventListener('click', build);
    let grab = null;

    function update() {
        const iters = +itEl.value;
        if (itVal) itVal.textContent = iters;
        if (pointer.justPressed) {
            let best = null, bestD = 26;
            for (const p of points) { const d = Math.hypot(pointer.pos.x - p.pos.x, pointer.pos.y - p.pos.y); if (d < bestD) { bestD = d; best = p; } }
            if (best) { grab = best; grab._wasPinned = best.pinned; grab.pinned = true; }
        }
        if (pointer.justReleased && grab) { grab.pinned = grab._wasPinned; grab = null; }
        if (grab && pointer.isDown) { grab.prev.set(grab.pos.x, grab.pos.y); grab.pos.set(pointer.pos.x, pointer.pos.y); }
        pzStepRope(points, constraints, 0, G, dt, iters, 0.995);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawRope(ctx, constraints, PZ.rope, 5);
        for (const p of points) {
            const isAnchor = (p === points[0] || p === points[N - 1]);
            ctx.fillStyle = isAnchor ? PZ.anchor : PZ.ball;
            ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, isAnchor ? 6 : p.radius, 0, Math.PI * 2); ctx.fill();
        }
        // measure max stretch
        let maxStretch = 0;
        for (const c of constraints) { const d = Math.hypot(c.b.pos.x - c.a.pos.x, c.b.pos.y - c.a.pos.y); maxStretch = Math.max(maxStretch, d / c.rest); }
        hud.textContent = `${+itEl.value} relaxation iteration(s) · max stretch ${((maxStretch - 1) * 100).toFixed(0)}% · drag a bead; fewer iters = stretchier`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — swingDemo
// A rope pinned at the top with a heavy bob. Drag the bob and release: Verlet
// keeps the swing energy, so the bob carries momentum. Fling it through the gold
// ring — the trick is releasing at the right point in the arc.
// =============================================================================
(function swingDemo() {
    const canvas = document.getElementById('pzSwingCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const G = 1500, dt = 1 / 60, N = 10;

    let points, constraints, hits;
    const ring = { x: W - 110, y: 150, r: 26 };
    function build() {
        points = []; constraints = [];
        const x = 170, y0 = 50, seg = 16;
        for (let i = 0; i < N; i++) points.push(new PZVerletPoint(x, y0 + i * seg, i === N - 1 ? 18 : 4));
        points[0].pinned = true;
        for (let i = 0; i < N - 1; i++) constraints.push(new PZConstraint(points[i], points[i + 1]));
        hits = 0;
    }
    build();
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzSwingHud');
    document.getElementById('pzSwingReset').addEventListener('click', build);
    const bob = () => points[N - 1];
    let grabbing = false;

    function update() {
        if (pointer.justPressed) {
            const b = bob();
            if (Math.hypot(pointer.pos.x - b.pos.x, pointer.pos.y - b.pos.y) < 36) { grabbing = true; b.pinned = true; }
        }
        if (pointer.justReleased && grabbing) { bob().pinned = false; grabbing = false; }
        if (grabbing && pointer.isDown) { const b = bob(); b.prev.set(b.pos.x, b.pos.y); b.pos.set(pointer.pos.x, pointer.pos.y); }
        pzStepRope(points, constraints, 0, G, dt, 8, 0.999);
        // ring detection
        const b = bob();
        if (Math.hypot(b.pos.x - ring.x, b.pos.y - ring.y) < ring.r) hits = Math.min(hits + 1, 999);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // target ring
        const inRing = Math.hypot(bob().pos.x - ring.x, bob().pos.y - ring.y) < ring.r;
        ctx.strokeStyle = inRing ? PZ.good : PZ.target; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2); ctx.stroke();
        pzDrawRope(ctx, constraints, PZ.rope, 4);
        ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(points[0].pos.x, points[0].pos.y, 6, 0, Math.PI * 2); ctx.fill();
        pzDrawCandy(ctx, bob(), PZ.ball, PZ.ballDk);
        hud.textContent = `bob speed = ${bob().speed(dt).toFixed(0)} px/s · ring touches: ${hits} · drag the bob & release to swing`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — cutDemo
// The cut. Three candies hang from ropes. SWIPE across a rope (or click it) to
// sever that constraint — the candy falls. Land them in the bowl below.
// =============================================================================
(function cutDemo() {
    const canvas = document.getElementById('pzCutCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const G = 1500, dt = 1 / 60;
    const arena = { x: 12, y: 10, w: W - 24, h: H - 20 };
    const bowl = { x: W / 2 - 70, y: H - 46, w: 140, h: 30 };

    let points, constraints, candies, landed;
    function build() {
        points = []; constraints = []; candies = [];
        const xs = [W * 0.28, W * 0.5, W * 0.72];
        for (const x of xs) {
            const anchor = new PZVerletPoint(x, 36, 4); anchor.pinned = true; points.push(anchor);
            let prev = anchor;
            const segs = 5, seg = 18;
            for (let i = 1; i <= segs; i++) {
                const p = new PZVerletPoint(x, 36 + i * seg, i === segs ? 15 : 4);
                points.push(p);
                constraints.push(new PZConstraint(prev, p));
                prev = p;
            }
            candies.push(prev);
        }
        landed = 0;
    }
    build();
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzCutHud');
    document.getElementById('pzCutReset').addEventListener('click', build);
    let lastX = null, lastY = null, justCut = 0;

    function update() {
        // swipe blade between last and current pointer; or a tap = short blade
        if (pointer.isDown) {
            if (lastX !== null) justCut += pzCutBlade(constraints, lastX, lastY, pointer.pos.x, pointer.pos.y);
            lastX = pointer.pos.x; lastY = pointer.pos.y;
        }
        if (pointer.justPressed) { if (pzClickCut(constraints, pointer.pos.x, pointer.pos.y, 12)) justCut++; lastX = pointer.pos.x; lastY = pointer.pos.y; }
        if (pointer.justReleased) { lastX = null; lastY = null; }

        pzStepRope(points, constraints, 0, G, dt, 6, 0.999);
        for (const c of candies) { pzVerletArena(c, arena); }
        // count candies resting in the bowl
        landed = candies.filter((c) => c.pos.x > bowl.x && c.pos.x < bowl.x + bowl.w && c.pos.y > bowl.y - 6 && c.pos.y < bowl.y + bowl.h + 10).length;
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // bowl
        ctx.fillStyle = PZ.wall; ctx.fillRect(bowl.x, bowl.y, bowl.w, bowl.h);
        ctx.fillStyle = 'rgba(255,209,102,0.12)'; ctx.fillRect(bowl.x, bowl.y - 18, bowl.w, 18);
        pzDrawRope(ctx, constraints, PZ.rope, 4);
        for (const p of points) if (p.pinned) { ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2); ctx.fill(); }
        for (const c of candies) pzDrawCandy(ctx, c, PZ.target, '#b58a2a');
        hud.textContent = `${landed}/3 candies in the bowl · swipe (or click) a rope to cut it`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — deliverDemo  (CAPSTONE: "Deliver")
// A candy hangs from a rope over an obstacle, with the goal off to the side. Grab
// the candy to build a swing, then CUT the rope at the right moment so it sails
// over the shelf and into the goal. Verlet rope + Verlet payload-vs-wall.
// =============================================================================
(function deliverDemo() {
    const canvas = document.getElementById('pzDeliverCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const G = 1500, dt = 1 / 60;
    const arena = { x: 12, y: 10, w: W - 24, h: H - 20 };
    const shelf = { x: 250, y: 210, w: 150, h: 18 };          // obstacle to clear
    const goal = { x: W - 96, y: H - 70, r: 30 };             // the mouth/bowl

    let points, constraints, candy, won, cut;
    function build() {
        points = []; constraints = [];
        const ax = 150, ay = 40;
        const anchor = new PZVerletPoint(ax, ay, 4); anchor.pinned = true; points.push(anchor);
        let prev = anchor; const segs = 7, seg = 18;
        for (let i = 1; i <= segs; i++) {
            const p = new PZVerletPoint(ax, ay + i * seg, i === segs ? 15 : 4);
            points.push(p); constraints.push(new PZConstraint(prev, p)); prev = p;
        }
        candy = prev; won = false; cut = false;
    }
    build();
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzDeliverHud');
    document.getElementById('pzDeliverReset').addEventListener('click', build);
    let grabbing = false, lastX = null, lastY = null;

    function update() {
        if (pointer.justPressed) {
            // grab the candy if pressed on it, else try to cut a rope
            if (Math.hypot(pointer.pos.x - candy.pos.x, pointer.pos.y - candy.pos.y) < 34 && !cut) {
                grabbing = true; candy.pinned = true;
            } else if (!cut) {
                if (pzClickCut(constraints, pointer.pos.x, pointer.pos.y, 14)) cut = true;
            }
            lastX = pointer.pos.x; lastY = pointer.pos.y;
        }
        if (pointer.isDown && !grabbing && !cut && lastX !== null) {
            if (pzCutBlade(constraints, lastX, lastY, pointer.pos.x, pointer.pos.y)) cut = true;
            lastX = pointer.pos.x; lastY = pointer.pos.y;
        }
        if (pointer.justReleased) { if (grabbing) { candy.pinned = false; grabbing = false; } lastX = null; lastY = null; }
        if (grabbing && pointer.isDown) { candy.prev.set(candy.pos.x, candy.pos.y); candy.pos.set(pointer.pos.x, pointer.pos.y); }

        pzStepRope(points, constraints, 0, G, dt, 8, 0.999);
        pzVerletArena(candy, arena);
        pzVerletBlock(candy, shelf);
        if (Math.hypot(candy.pos.x - goal.x, candy.pos.y - goal.y) < goal.r) won = true;
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // shelf obstacle
        ctx.fillStyle = PZ.wall; ctx.fillRect(shelf.x, shelf.y, shelf.w, shelf.h);
        ctx.fillStyle = PZ.wallLit; ctx.fillRect(shelf.x, shelf.y, shelf.w, 2);
        // goal
        ctx.strokeStyle = won ? PZ.good : PZ.target; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,209,102,0.10)'; ctx.beginPath(); ctx.arc(goal.x, goal.y, goal.r, 0, Math.PI * 2); ctx.fill();

        pzDrawRope(ctx, constraints, PZ.rope, 4);
        ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(points[0].pos.x, points[0].pos.y, 5, 0, Math.PI * 2); ctx.fill();
        pzDrawCandy(ctx, candy, PZ.ball, PZ.ballDk);

        if (won) hud.innerHTML = `<span style="color:${PZ.good}">🏆 Delivered!</span> Click "Reset" to play again.`;
        else if (cut) hud.textContent = `rope cut — did it reach the goal? (Reset to retry)`;
        else hud.textContent = `drag the candy to build a swing, then cut the rope to fling it into the goal`;
    }
    pzLoop(update, render).start();
})();
