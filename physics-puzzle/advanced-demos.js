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
//   engine/world.js      — (loaded for parity; this tier brings its own rigid body)
//   engine/loop.js       — window.pzLoop, pzInstallPointer
//   engine/render.js     — window.PZ
//
// COLLISION FAMILY: the Beginner tier did CIRCLE collision (pzCollideCircles); this
// tier does CONVEX POLYGON collision with ROTATION — a different, more general
// family (a circle is the special case it subsumes). So nothing here reuses the
// Beginner routines; instead this tier introduces the rigid-body engine INLINE
// (PZRigidBody, pzPolyVsPoly + the SAT/clip helpers, pzSolveManifold, PZJoint,
// pzStepWorld). These promote to engine/ when the Expert tier (destruction = rigid
// debris) becomes their 2nd consumer. All names are pz/PZ-prefixed.
//
// THE ALGORITHM is the standard 2D impulse solver (Box2D-lite / Randy Gaul style):
// SAT for the normal + penetration, reference/incident-face clipping for up to two
// contact points, then sequential impulses with rotation (r × J), Coulomb friction,
// and a Baumgarte bias for penetration. Joints are velocity-level point constraints.
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
// INLINE RIGID-BODY ENGINE (this tier's lesson; promoted to engine/ later)
// =============================================================================

// Pure 2D helpers (no Vector2D mutation pitfalls — these return plain numbers/objs).
function pzRot(x, y, angle) {                       // rotate (x,y) by angle
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
}
function pzBoxVerts(w, h) {                          // local box verts, centred, CW in screen-space
    const hw = w / 2, hh = h / 2;
    return [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
}
function pzRegularVerts(n, r) {                      // regular n-gon, centred
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
    return out;
}
// Area + moment of inertia (about the centroid) for a centred polygon at unit density.
function pzPolyMassData(verts) {
    let area = 0, inertia = 0;
    for (let i = 0; i < verts.length; i++) {
        const a = verts[i], b = verts[(i + 1) % verts.length];
        const cross = a.x * b.y - b.x * a.y;
        area += cross;
        inertia += cross * (a.x * a.x + a.x * b.x + b.x * b.x + a.y * a.y + a.y * b.y + b.y * b.y);
    }
    return { area: Math.abs(area) / 2, inertia: Math.abs(inertia) / 12 };
}

// A convex rigid body. Linear state (pos, vel) AND angular state (angle,
// angularVel) — the second integrator is the whole point of this tier.
class PZRigidBody {
    constructor(x, y, localVerts, opts = {}) {
        this.pos = new Vector2D(x, y);              // centre of mass
        this.vel = new Vector2D(0, 0);
        this.angle = opts.angle || 0;
        this.angularVel = 0;
        this.verts = localVerts;
        this.restitution = opts.restitution ?? 0.15;
        this.friction = opts.friction ?? 0.4;
        this.color = opts.color || PZ.wall;
        this.tag = opts.tag || null;
        this.isStatic = !!opts.static;
        const { area, inertia } = pzPolyMassData(localVerts);
        if (this.isStatic) {
            this.mass = Infinity; this.invMass = 0; this.invInertia = 0;
        } else {
            const density = opts.density ?? 0.005;
            this.mass = opts.mass ?? Math.max(0.5, area * density);
            this.invMass = 1 / this.mass;
            const I = inertia * (this.mass / area);  // scale unit-density inertia to actual mass
            this.invInertia = I > 0 ? 1 / I : 0;
        }
    }
    worldVerts() {
        const c = Math.cos(this.angle), s = Math.sin(this.angle);
        return this.verts.map(v => ({ x: this.pos.x + v.x * c - v.y * s, y: this.pos.y + v.x * s + v.y * c }));
    }
    // Apply impulse (imx,imy) at world offset (rx,ry) from the centre: changes
    // BOTH linear velocity (÷mass) and angular velocity (the r × J torque).
    applyImpulse(imx, imy, rx, ry) {
        if (this.isStatic) return;
        this.vel.x += imx * this.invMass;
        this.vel.y += imy * this.invMass;
        this.angularVel += this.invInertia * (rx * imy - ry * imx);
    }
}

// Outward world-space face normals + the world vertices, for SAT.
function pzFaceData(body) {
    const wv = body.worldVerts();
    const normals = [];
    for (let i = 0; i < wv.length; i++) {
        const a = wv[i], b = wv[(i + 1) % wv.length];
        let nx = b.y - a.y, ny = -(b.x - a.x);                  // a perpendicular of edge a→b
        const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
        const mx = (a.x + b.x) / 2 - body.pos.x, my = (a.y + b.y) / 2 - body.pos.y;
        if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }     // force OUTWARD
        normals.push({ x: nx, y: ny });
    }
    return { wv, normals };
}

// SAT: for each face of A, push B as far back along that face's normal as it'll
// go; the face with the LEAST penetration (closest to separating) is the best.
// Returns { best, index } — best ≥ 0 means a separating axis exists (no overlap).
function pzLeastPenetration(A, B) {
    const fa = pzFaceData(A), bwv = B.worldVerts();
    let best = -Infinity, index = 0;
    for (let i = 0; i < fa.wv.length; i++) {
        const n = fa.normals[i], v = fa.wv[i];
        let min = Infinity, sup = bwv[0];
        for (const bv of bwv) { const d = n.x * bv.x + n.y * bv.y; if (d < min) { min = d; sup = bv; } }
        const pen = n.x * (sup.x - v.x) + n.y * (sup.y - v.y);
        if (pen > best) { best = pen; index = i; }
    }
    return { best, index };
}

// Clip a segment v1→v2, keeping the part on the negative side of plane (n·p = o).
function pzClip(v1, v2, n, o) {
    const out = [];
    const d1 = n.x * v1.x + n.y * v1.y - o;
    const d2 = n.x * v2.x + n.y * v2.y - o;
    if (d1 <= 0) out.push(v1);
    if (d2 <= 0) out.push(v2);
    if (d1 * d2 < 0) { const t = d1 / (d1 - d2); out.push({ x: v1.x + t * (v2.x - v1.x), y: v1.y + t * (v2.y - v1.y) }); }
    return out;
}

// Full convex-vs-convex manifold: SAT to pick the reference face, then clip the
// incident face to produce up to two contact points with penetration depths.
// Returns { normal (A→B), contacts:[{x,y,pen}] } or null.
function pzPolyVsPoly(A, B) {
    const pa = pzLeastPenetration(A, B); if (pa.best >= 0) return null;
    const pb = pzLeastPenetration(B, A); if (pb.best >= 0) return null;

    let ref, inc, refIndex, flip;
    if (pb.best > pa.best + 0.0005) { ref = B; inc = A; refIndex = pb.index; flip = true; }
    else { ref = A; inc = B; refIndex = pa.index; flip = false; }

    const rf = pzFaceData(ref);
    const refNormal = rf.normals[refIndex];
    const rv1 = rf.wv[refIndex], rv2 = rf.wv[(refIndex + 1) % rf.wv.length];

    // incident face = the face of `inc` most anti-parallel to the reference normal
    const inf = pzFaceData(inc);
    let incIndex = 0, minDot = Infinity;
    for (let i = 0; i < inf.normals.length; i++) {
        const d = inf.normals[i].x * refNormal.x + inf.normals[i].y * refNormal.y;
        if (d < minDot) { minDot = d; incIndex = i; }
    }
    let i1 = inf.wv[incIndex], i2 = inf.wv[(incIndex + 1) % inf.wv.length];

    // reference-face tangent (its edge direction); clip the incident segment to the
    // two side planes of the reference face.
    let tx = rv2.x - rv1.x, ty = rv2.y - rv1.y;
    const tlen = Math.hypot(tx, ty) || 1; tx /= tlen; ty /= tlen;
    const negSide = -(tx * rv1.x + ty * rv1.y);
    let clipped = pzClip(i1, i2, { x: -tx, y: -ty }, negSide);
    if (clipped.length < 2) return null;
    const posSide = (tx * rv2.x + ty * rv2.y);
    clipped = pzClip(clipped[0], clipped[1], { x: tx, y: ty }, posSide);
    if (clipped.length < 2) return null;

    // keep clipped points that lie BEHIND the reference face (penetrating)
    const refO = refNormal.x * rv1.x + refNormal.y * rv1.y;
    const contacts = [];
    for (const p of clipped) {
        const sep = refNormal.x * p.x + refNormal.y * p.y - refO;
        if (sep <= 0) contacts.push({ x: p.x, y: p.y, pen: -sep });
    }
    if (contacts.length === 0) return null;
    // normal must point from A to B
    const normal = flip ? { x: -refNormal.x, y: -refNormal.y } : { x: refNormal.x, y: refNormal.y };
    return { normal, contacts };
}

// Solver tuning.
const PZ_BETA = 0.2;      // Baumgarte position-correction factor
const PZ_SLOP = 0.5;      // allowed penetration (px) before we push apart
const PZ_REST_THRESH = 60; // below this approach speed, kill restitution (no resting jitter)

// Resolve one manifold: a normal impulse (with restitution + a penetration bias)
// and a Coulomb-clamped friction impulse, at each contact point, accounting for
// rotation via r × J.
function pzSolveManifold(m, dt) {
    const a = m.a, b = m.b, n = m.normal;
    const e = Math.min(a.restitution, b.restitution);
    const mu = Math.sqrt(a.friction * b.friction);
    for (const c of m.contacts) {
        const rax = c.x - a.pos.x, ray = c.y - a.pos.y;
        const rbx = c.x - b.pos.x, rby = c.y - b.pos.y;
        // relative velocity at the contact (v + ω × r)
        let rvx = (b.vel.x - b.angularVel * rby) - (a.vel.x - a.angularVel * ray);
        let rvy = (b.vel.y + b.angularVel * rbx) - (a.vel.y + a.angularVel * rax);
        const velN = rvx * n.x + rvy * n.y;
        const raCrossN = rax * n.y - ray * n.x;
        const rbCrossN = rbx * n.y - rby * n.x;
        const invN = a.invMass + b.invMass + raCrossN * raCrossN * a.invInertia + rbCrossN * rbCrossN * b.invInertia;
        if (invN === 0) continue;
        const bias = (PZ_BETA / dt) * Math.max(c.pen - PZ_SLOP, 0);
        const rest = velN < -PZ_REST_THRESH ? e : 0;
        let jn = (-(1 + rest) * velN + bias) / invN / m.contacts.length;
        jn = Math.max(jn, 0);
        a.applyImpulse(-jn * n.x, -jn * n.y, rax, ray);
        b.applyImpulse(jn * n.x, jn * n.y, rbx, rby);

        // friction along the tangent
        rvx = (b.vel.x - b.angularVel * rby) - (a.vel.x - a.angularVel * ray);
        rvy = (b.vel.y + b.angularVel * rbx) - (a.vel.y + a.angularVel * rax);
        let tx = rvx - (rvx * n.x + rvy * n.y) * n.x;
        let ty = rvy - (rvx * n.x + rvy * n.y) * n.y;
        const tlen = Math.hypot(tx, ty);
        if (tlen > 1e-6) {
            tx /= tlen; ty /= tlen;
            const raCrossT = rax * ty - ray * tx;
            const rbCrossT = rbx * ty - rby * tx;
            const invT = a.invMass + b.invMass + raCrossT * raCrossT * a.invInertia + rbCrossT * rbCrossT * b.invInertia;
            let jt = -(rvx * tx + rvy * ty) / invT / m.contacts.length;
            jt = clamp(jt, -mu * jn, mu * jn);          // Coulomb cone
            a.applyImpulse(-jt * tx, -jt * ty, rax, ray);
            b.applyImpulse(jt * tx, jt * ty, rbx, rby);
        }
    }
}

// A revolute (pivot) joint: keep anchorA (local to a) coincident with anchorB
// (local to b), or with a fixed world point when b is null. Velocity-level point
// constraint with a Baumgarte bias; breaks when its impulse exceeds a threshold.
class PZJoint {
    constructor(a, anchorA, b, anchorB, opts = {}) {
        this.a = a; this.b = b;
        this.localA = anchorA; this.localB = anchorB || { x: 0, y: 0 };
        this.worldPoint = opts.worldPoint || null;
        this.breakImpulse = opts.breakImpulse ?? Infinity;
        this.beta = opts.beta ?? 0.2;
        this.broken = false;
        this.lastImpulse = 0;
    }
    anchors() {
        const ra = pzRot(this.localA.x, this.localA.y, this.a.angle);
        const pa = { x: this.a.pos.x + ra.x, y: this.a.pos.y + ra.y };
        let rb, pb;
        if (this.b) { rb = pzRot(this.localB.x, this.localB.y, this.b.angle); pb = { x: this.b.pos.x + rb.x, y: this.b.pos.y + rb.y }; }
        else { rb = { x: 0, y: 0 }; pb = this.worldPoint; }
        return { ra, pa, rb, pb };
    }
    solve(dt) {
        if (this.broken) return;
        const a = this.a, b = this.b;
        const { ra, pa, rb, pb } = this.anchors();
        const bInv = b ? b.invMass : 0, bIInv = b ? b.invInertia : 0;
        const cx = pb.x - pa.x, cy = pb.y - pa.y;        // position error (want 0)
        const vax = a.vel.x - a.angularVel * ra.y, vay = a.vel.y + a.angularVel * ra.x;
        let vbx = 0, vby = 0;
        if (b) { vbx = b.vel.x - b.angularVel * rb.y; vby = b.vel.y + b.angularVel * rb.x; }
        const rvx = vbx - vax, rvy = vby - vay;
        const ma = a.invMass, ia = a.invInertia;
        const k11 = ma + bInv + ia * ra.y * ra.y + bIInv * rb.y * rb.y;
        const k12 = -ia * ra.x * ra.y - bIInv * rb.x * rb.y;
        const k22 = ma + bInv + ia * ra.x * ra.x + bIInv * rb.x * rb.x;
        const det = k11 * k22 - k12 * k12;
        if (Math.abs(det) < 1e-9) return;
        const inv = 1 / det;
        const rhsx = -(rvx + (this.beta / dt) * cx);
        const rhsy = -(rvy + (this.beta / dt) * cy);
        const Px = inv * (k22 * rhsx - k12 * rhsy);
        const Py = inv * (k11 * rhsy - k12 * rhsx);
        a.applyImpulse(-Px, -Py, ra.x, ra.y);
        if (b) b.applyImpulse(Px, Py, rb.x, rb.y);
        this.lastImpulse = Math.hypot(Px, Py);
        if (this.lastImpulse > this.breakImpulse) this.broken = true;
    }
}

// One step of the rigid world: apply gravity, find contacts, solve velocity
// (joints + contacts) over K iterations, then integrate.
function pzStepWorld(bodies, joints, gx, gy, dt, opts = {}) {
    const iters = opts.iterations ?? 10;
    for (const bd of bodies) { if (bd.isStatic) continue; bd.vel.x += gx * dt; bd.vel.y += gy * dt; }
    const manifolds = [];
    for (let i = 0; i < bodies.length; i++)
        for (let j = i + 1; j < bodies.length; j++) {
            const A = bodies[i], B = bodies[j];
            if (A.invMass === 0 && B.invMass === 0) continue;
            const man = pzPolyVsPoly(A, B);
            if (man) { man.a = A; man.b = B; manifolds.push(man); }
        }
    for (let k = 0; k < iters; k++) {
        for (const jt of joints) jt.solve(dt);
        for (const man of manifolds) pzSolveManifold(man, dt);
    }
    const linDamp = opts.linDamp ?? 0.999, angDamp = opts.angDamp ?? 0.999;
    for (const bd of bodies) {
        if (bd.isStatic) continue;
        bd.pos.x += bd.vel.x * dt; bd.pos.y += bd.vel.y * dt; bd.angle += bd.angularVel * dt;
        bd.vel.x *= linDamp; bd.vel.y *= linDamp; bd.angularVel *= angDamp;
    }
    return manifolds;
}

// Draw a polygon body: fill, outline, and a tick from centre to the first vertex
// so its rotation is unmistakable.
function pzDrawPoly(ctx, body, fill, stroke) {
    const wv = body.worldVerts();
    ctx.beginPath(); ctx.moveTo(wv[0].x, wv[0].y);
    for (let i = 1; i < wv.length; i++) ctx.lineTo(wv[i].x, wv[i].y);
    ctx.closePath();
    ctx.fillStyle = fill || body.color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = stroke || 'rgba(0,0,0,0.35)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(body.pos.x, body.pos.y); ctx.lineTo(wv[0].x, wv[0].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
}

// A static arena (floor + two walls + ceiling) as four static boxes.
function pzArenaBodies(W, H, t = 40) {
    return [
        new PZRigidBody(W / 2, H + t / 2 - 6, pzBoxVerts(W + 2 * t, t), { static: true, color: PZ.wall }), // floor
        new PZRigidBody(W / 2, -t / 2 + 6, pzBoxVerts(W + 2 * t, t), { static: true, color: PZ.wall }),     // ceiling
        new PZRigidBody(-t / 2 + 6, H / 2, pzBoxVerts(t, H), { static: true, color: PZ.wall }),             // left
        new PZRigidBody(W + t / 2 - 6, H / 2, pzBoxVerts(t, H), { static: true, color: PZ.wall }),          // right
    ];
}

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
