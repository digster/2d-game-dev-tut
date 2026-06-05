// ===================================================================
// physics-puzzle/engine/rigid.js
//
// The convex-polygon RIGID-BODY engine — rotation, SAT collision with contact
// manifolds, impulse resolution (with friction), and pivot joints. This is the
// standard 2D impulse solver (Box2D-lite / Randy Gaul style).
//
// PROMOTION HISTORY: this was taught INLINE in the Advanced tier
// (advanced-demos.js) as that tier's lesson. The Expert tier ("Destruction &
// Debris") is its 2nd consumer (debris are rigid fragments; demolition reads the
// impact impulse), so per the repo's "promote on the 2nd consumer" rule it was
// MOVED here (a *move*: advanced.html + expert.html both load this file, and
// advanced-demos.js no longer declares any of it — two `class PZRigidBody` on one
// page would be a redeclaration error). It is NOT part of the day-one scaffold
// because the Beginner/Intermediate tiers don't use it.
//
// Public names are pz/PZ-prefixed and attach to `window` at the bottom (top-level
// `class` is already a shared global across classic scripts; the window assignment
// is for parity with the other engine modules + console inspection). Reuses
// shared/utils.js `clamp`. Pre-checked vs shared/utils.js.
//
// ⚠️ Vector2D mutates in place — but this module mostly does its maths on plain
// numbers (x/y) to keep the hot solver allocation-free, so the mutation footgun
// barely applies here.
// ===================================================================

// --- pure geometry helpers ------------------------------------------
function pzRot(x, y, angle) {                       // rotate (x,y) by angle
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: x * c - y * s, y: x * s + y * c };
}
function pzBoxVerts(w, h) {                          // local box verts, centred
    const hw = w / 2, hh = h / 2;
    return [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
}
function pzRegularVerts(n, r) {                      // regular n-gon, centred
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
    return out;
}
// Area + moment of inertia (about the centroid) for a centred polygon, unit density.
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

// A convex rigid body. Linear (pos, vel) AND angular (angle, angularVel) state.
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
        this.impact = 0;                            // total normal impulse received this step
        const { area, inertia } = pzPolyMassData(localVerts);
        this.area = area;
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
    // Impulse (imx,imy) at world offset (rx,ry): changes linear (÷mass) AND
    // angular (r × J) velocity.
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
        let nx = b.y - a.y, ny = -(b.x - a.x);
        const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
        const mx = (a.x + b.x) / 2 - body.pos.x, my = (a.y + b.y) / 2 - body.pos.y;
        if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }     // force OUTWARD
        normals.push({ x: nx, y: ny });
    }
    return { wv, normals };
}

// SAT: the face of A where B penetrates LEAST. best ≥ 0 ⇒ separated.
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

// Clip segment v1→v2, keeping the part on the negative side of plane (n·p = o).
function pzClip(v1, v2, n, o) {
    const out = [];
    const d1 = n.x * v1.x + n.y * v1.y - o;
    const d2 = n.x * v2.x + n.y * v2.y - o;
    if (d1 <= 0) out.push(v1);
    if (d2 <= 0) out.push(v2);
    if (d1 * d2 < 0) { const t = d1 / (d1 - d2); out.push({ x: v1.x + t * (v2.x - v1.x), y: v1.y + t * (v2.y - v1.y) }); }
    return out;
}

// Full convex-vs-convex manifold: { normal (A→B), contacts:[{x,y,pen}] } or null.
function pzPolyVsPoly(A, B) {
    const pa = pzLeastPenetration(A, B); if (pa.best >= 0) return null;
    const pb = pzLeastPenetration(B, A); if (pb.best >= 0) return null;

    let ref, inc, refIndex, flip;
    if (pb.best > pa.best + 0.0005) { ref = B; inc = A; refIndex = pb.index; flip = true; }
    else { ref = A; inc = B; refIndex = pa.index; flip = false; }

    const rf = pzFaceData(ref);
    const refNormal = rf.normals[refIndex];
    const rv1 = rf.wv[refIndex], rv2 = rf.wv[(refIndex + 1) % rf.wv.length];

    const inf = pzFaceData(inc);
    let incIndex = 0, minDot = Infinity;
    for (let i = 0; i < inf.normals.length; i++) {
        const d = inf.normals[i].x * refNormal.x + inf.normals[i].y * refNormal.y;
        if (d < minDot) { minDot = d; incIndex = i; }
    }
    let i1 = inf.wv[incIndex], i2 = inf.wv[(incIndex + 1) % inf.wv.length];

    let tx = rv2.x - rv1.x, ty = rv2.y - rv1.y;
    const tlen = Math.hypot(tx, ty) || 1; tx /= tlen; ty /= tlen;
    const negSide = -(tx * rv1.x + ty * rv1.y);
    let clipped = pzClip(i1, i2, { x: -tx, y: -ty }, negSide);
    if (clipped.length < 2) return null;
    const posSide = (tx * rv2.x + ty * rv2.y);
    clipped = pzClip(clipped[0], clipped[1], { x: tx, y: ty }, posSide);
    if (clipped.length < 2) return null;

    const refO = refNormal.x * rv1.x + refNormal.y * rv1.y;
    const contacts = [];
    for (const p of clipped) {
        const sep = refNormal.x * p.x + refNormal.y * p.y - refO;
        if (sep <= 0) contacts.push({ x: p.x, y: p.y, pen: -sep });
    }
    if (contacts.length === 0) return null;
    const normal = flip ? { x: -refNormal.x, y: -refNormal.y } : { x: refNormal.x, y: refNormal.y };
    return { normal, contacts };
}

// Solver tuning.
const PZ_BETA = 0.2;        // Baumgarte position-correction factor
const PZ_SLOP = 0.5;        // allowed penetration (px)
const PZ_REST_THRESH = 60;  // below this approach speed, kill restitution (no resting jitter)

// Resolve one manifold (normal + friction impulses, with r × J). Accumulates the
// applied normal impulse onto both bodies' `.impact` — the Expert tier reads this
// to decide whether a hit was hard enough to break a body.
function pzSolveManifold(m, dt) {
    const a = m.a, b = m.b, n = m.normal;
    const e = Math.min(a.restitution, b.restitution);
    const mu = Math.sqrt(a.friction * b.friction);
    for (const c of m.contacts) {
        const rax = c.x - a.pos.x, ray = c.y - a.pos.y;
        const rbx = c.x - b.pos.x, rby = c.y - b.pos.y;
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
        a.impact += jn; b.impact += jn;
        a.applyImpulse(-jn * n.x, -jn * n.y, rax, ray);
        b.applyImpulse(jn * n.x, jn * n.y, rbx, rby);

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
            jt = clamp(jt, -mu * jn, mu * jn);
            a.applyImpulse(-jt * tx, -jt * ty, rax, ray);
            b.applyImpulse(jt * tx, jt * ty, rbx, rby);
        }
    }
}

// A revolute (pivot) joint — velocity-level point constraint with a break threshold.
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
        const cx = pb.x - pa.x, cy = pb.y - pa.y;
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

// One step: apply gravity, find contacts, solve velocity (joints + contacts) over
// K iterations, then integrate. Resets per-body `.impact` at the start. Returns
// the contact manifolds (so demos can read contact points / impacts).
function pzStepWorld(bodies, joints, gx, gy, dt, opts = {}) {
    const iters = opts.iterations ?? 10;
    for (const bd of bodies) { bd.impact = 0; if (bd.isStatic) continue; bd.vel.x += gx * dt; bd.vel.y += gy * dt; }
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

// Drive a body toward a target point by setting VELOCITY ONLY; the next
// pzStepWorld then integrates `pos += vel*dt` and lands the body exactly there.
// Do NOT also set `pos` directly — that double-applies the move (the world step
// adds it a second time) and makes a dragged body jitter, badly so on frames
// where the fixed-step loop runs two sub-steps and the velocity sign flips.
// Driving via velocity also lets collisions stop the body at walls instead of
// teleporting it through them. `maxSpeed` caps a laggy frame's huge cursor jump
// so the body can't tunnel a thin wall and explode the solver. Used to drag a
// body with the mouse.
function pzDragTo(body, tx, ty, dt, maxSpeed = 2500) {
    let vx = (tx - body.pos.x) / dt, vy = (ty - body.pos.y) / dt;
    const sp = Math.hypot(vx, vy);
    if (sp > maxSpeed) { vx = (vx / sp) * maxSpeed; vy = (vy / sp) * maxSpeed; }
    body.vel.set(vx, vy);
}

// Draw a polygon body: fill, outline, and a tick from centre to the first vertex.
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
        new PZRigidBody(W / 2, H + t / 2 - 6, pzBoxVerts(W + 2 * t, t), { static: true, color: PZ.wall }),
        new PZRigidBody(W / 2, -t / 2 + 6, pzBoxVerts(W + 2 * t, t), { static: true, color: PZ.wall }),
        new PZRigidBody(-t / 2 + 6, H / 2, pzBoxVerts(t, H), { static: true, color: PZ.wall }),
        new PZRigidBody(W + t / 2 - 6, H / 2, pzBoxVerts(t, H), { static: true, color: PZ.wall }),
    ];
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.pzRot = pzRot;
    window.pzBoxVerts = pzBoxVerts;
    window.pzRegularVerts = pzRegularVerts;
    window.pzPolyMassData = pzPolyMassData;
    window.PZRigidBody = PZRigidBody;
    window.pzFaceData = pzFaceData;
    window.pzLeastPenetration = pzLeastPenetration;
    window.pzClip = pzClip;
    window.pzPolyVsPoly = pzPolyVsPoly;
    window.PZ_BETA = PZ_BETA;
    window.PZ_SLOP = PZ_SLOP;
    window.PZ_REST_THRESH = PZ_REST_THRESH;
    window.pzSolveManifold = pzSolveManifold;
    window.PZJoint = PZJoint;
    window.pzStepWorld = pzStepWorld;
    window.pzDragTo = pzDragTo;
    window.pzDrawPoly = pzDrawPoly;
    window.pzArenaBodies = pzArenaBodies;
}
