// =============================================================================
// PHYSICS PUZZLE — SIMULATIONS TIER DEMOS ("Soft Bodies, Ragdolls & Fluids")
// =============================================================================
// The final tier. Six demos: the engineering to run HUNDREDS of bodies, then the
// squishy/wet physics that engineering unlocks, then the grand capstone that
// fires every mechanic in the track.
//
//   1. broadDemo   — a spatial hash turns O(n²) pair tests into ~O(n)
//   2. sleepDemo   — bodies at rest SLEEP (and wake their island on contact)
//   3. softDemo    — a soft body is a closed Verlet mesh + an internal pressure
//   4. ragdollDemo — a ragdoll is jointed rigid bodies (the Advanced toolkit)
//   5. fluidDemo   — water is many particles; submerged things float (buoyancy)
//   6. rubeDemo    — capstone "Rube": slingshot → rope → rigid → fracture → fluid
//
// DEPENDENCIES (loaded BEFORE this file by simulations.html):
//   ../shared/utils.js     — Vector2D, clearCanvas, clamp
//   engine/loop.js         — pzLoop, pzInstallPointer
//   engine/render.js       — PZ
//   engine/rigid.js        — PZRigidBody, PZJoint, pzStepWorld, pzPolyVsPoly,
//                            pzBoxVerts, pzRegularVerts, pzDrawPoly, pzArenaBodies
//   engine/constraints.js  — PZVerletPoint, PZConstraint, pzStepRope, pzVerletArena
//
// This tier is the 2nd consumer of BOTH the Verlet core (soft bodies → already
// promoted to engine/constraints.js) and the rigid engine (ragdoll → already in
// engine/rigid.js). Its own new content is taught inline (single, terminal
// consumer): the spatial hash, sleeping, the pressure soft-body, and the
// particle fluid. All names are pz/PZ-prefixed.
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
// INLINE SIMULATIONS TOOLKIT (this tier's lesson)
// =============================================================================

// A spatial hash: bucket objects into a grid of `cell`-sized squares so we only
// ever test objects against others in the same or neighbouring cells.
class PZSpatialHash {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    _key(cx, cy) { return cx * 73856093 ^ cy * 19349663; } // cheap 2D hash
    clear() { this.map.clear(); }
    insert(o) {
        const cx = Math.floor(o.pos.x / this.cell), cy = Math.floor(o.pos.y / this.cell);
        const k = this._key(cx, cy); let a = this.map.get(k);
        if (!a) { a = []; this.map.set(k, a); } a.push(o);
    }
    nearby(o) {
        const cx = Math.floor(o.pos.x / this.cell), cy = Math.floor(o.pos.y / this.cell);
        const out = [];
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++) {
                const a = this.map.get(this._key(cx + dx, cy + dy));
                if (a) for (const x of a) out.push(x);
            }
        return out;
    }
}

// --- a lightweight circle "ball" sim (broadphase + sleeping demos) ----------
function pzBalls(n, arena, rMin, rMax) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const r = rMin + Math.random() * (rMax - rMin);
        out.push({
            id: i,
            pos: new Vector2D(arena.x + r + Math.random() * (arena.w - 2 * r), arena.y + r + Math.random() * (arena.h * 0.5)),
            vel: new Vector2D((Math.random() - 0.5) * 120, 0),
            r, sleeping: false, sleepT: 0,
        });
    }
    return out;
}
function pzBallWalls(b, arena) {
    if (b.pos.x < arena.x + b.r) { b.pos.x = arena.x + b.r; b.vel.x = Math.abs(b.vel.x) * 0.6; }
    if (b.pos.x > arena.x + arena.w - b.r) { b.pos.x = arena.x + arena.w - b.r; b.vel.x = -Math.abs(b.vel.x) * 0.6; }
    if (b.pos.y < arena.y + b.r) { b.pos.y = arena.y + b.r; b.vel.y = Math.abs(b.vel.y) * 0.6; }
    if (b.pos.y > arena.y + arena.h - b.r) { b.pos.y = arena.y + arena.h - b.r; b.vel.y = -Math.abs(b.vel.y) * 0.5; b.vel.x *= 0.96; }
}
// resolve two circles; returns true if they were touching (so callers can wake them)
function pzBallPair(a, b) {
    const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
    const min = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= min * min || d2 < 1e-6) return false;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, overlap = (min - d) / 2;
    a.pos.x -= nx * overlap; a.pos.y -= ny * overlap;
    b.pos.x += nx * overlap; b.pos.y += ny * overlap;
    const rvn = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
    if (rvn < 0) {
        const j = -rvn * 0.9; // equal mass, mild restitution
        a.vel.x -= nx * j; a.vel.y -= ny * j;
        b.vel.x += nx * j; b.vel.y += ny * j;
    }
    return true;
}

// --- particle fluid (simplified SPH: neighbour repulsion + viscosity) -------
// Density/pressure are implicit: when two particles get closer than the smoothing
// radius h, push them apart (∝ overlap) and average their velocities (viscosity).
// Over the spatial hash this is near-linear and settles into a real pool.
function pzFluidStep(parts, hash, arena, h, dt, gy, stiffness, visc) {
    const target = h * 0.62;                    // rest spacing between particles
    // predict: remember prev, apply gravity, move
    for (const p of parts) {
        if (!p.prev) p.prev = { x: p.pos.x, y: p.pos.y }; else { p.prev.x = p.pos.x; p.prev.y = p.pos.y; }
        p.vel.y += gy * dt; p.pos.x += p.vel.x * dt; p.pos.y += p.vel.y * dt;
    }
    // position relaxation = incompressibility (a HARD push to rest spacing, not a
    // weak force; this is what makes the pool stack instead of collapsing).
    for (let it = 0; it < 2; it++) {
        hash.clear(); for (const p of parts) hash.insert(p);
        for (const p of parts) for (const q of hash.nearby(p)) {
            if (q === p) continue;
            const dx = q.pos.x - p.pos.x, dy = q.pos.y - p.pos.y, d2 = dx * dx + dy * dy;
            if (d2 >= h * h || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            if (d < target) { const c = (target - d) * stiffness * 0.5, nx = dx / d, ny = dy / d; p.pos.x -= nx * c; p.pos.y -= ny * c; q.pos.x += nx * c; q.pos.y += ny * c; }
        }
        for (const p of parts) {
            if (p.pos.x < arena.x) p.pos.x = arena.x; if (p.pos.x > arena.x + arena.w) p.pos.x = arena.x + arena.w;
            if (p.pos.y < arena.y) p.pos.y = arena.y; if (p.pos.y > arena.y + arena.h) p.pos.y = arena.y + arena.h;
        }
    }
    // derive velocity from the actual movement (Verlet-style)
    for (const p of parts) { p.vel.x = (p.pos.x - p.prev.x) / dt; p.vel.y = (p.pos.y - p.prev.y) / dt; }
    // viscosity: nudge each particle toward its neighbours' velocity
    hash.clear(); for (const p of parts) hash.insert(p);
    for (const p of parts) for (const q of hash.nearby(p)) {
        if (q === p) continue;
        const dx = q.pos.x - p.pos.x, dy = q.pos.y - p.pos.y, d2 = dx * dx + dy * dy;
        if (d2 >= h * h || d2 < 1e-6) continue;
        const w = visc * (1 - Math.sqrt(d2) / h);
        p.vel.x += (q.vel.x - p.vel.x) * w; p.vel.y += (q.vel.y - p.vel.y) * w;
    }
}
// Buoyancy/coupling: shove fluid particles out of the object (it displaces water,
// raising the level) and push the object UP in proportion to how many particles
// surround it (submerged ⇒ more neighbours ⇒ more lift). Scaled by inv mass.
function pzFluidFloat(obj, parts, dt) {
    let submerged = 0;
    for (const p of parts) {
        const dx = p.pos.x - obj.pos.x, dy = p.pos.y - obj.pos.y, min = obj.r + 6, d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, overlap = min - d;
        p.pos.x += nx * overlap * 0.6; p.pos.y += ny * overlap * 0.6;   // displace fluid
        submerged++;
    }
    obj.vel.y -= submerged * 130 * dt * obj.invMass;   // buoyancy ∝ submerged neighbours
}

// --- pressure soft body (closed Verlet mesh) --------------------------------
// Shoelace area of a ring of points.
function pzPolyAreaPts(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.pos.x * q.pos.y - q.pos.x * p.pos.y; }
    return Math.abs(a) / 2;
}
function pzMakeBlob(cx, cy, r, n, radius) {
    const pts = [], edges = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(new PZVerletPoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r, radius)); }
    for (let i = 0; i < n; i++) edges.push(new PZConstraint(pts[i], pts[(i + 1) % n], { stiffness: 1 }));
    // a few cross-links keep it from folding inside-out
    for (let i = 0; i < n; i++) edges.push(new PZConstraint(pts[i], pts[(i + Math.floor(n / 2)) % n], { stiffness: 0.04 }));
    return { pts, edges, restArea: pzPolyAreaPts(pts) };
}
// one soft-body step: integrate, relax the membrane, then push outward by pressure
function pzSoftStep(blob, dt, gy, arena, iters, pressureK) {
    const { pts, edges, restArea } = blob;
    for (const p of pts) p.integrate(0, gy, dt, 0.99);
    for (let k = 0; k < iters; k++) { for (const c of edges) c.solve(); for (const p of pts) pzVerletArena(p, arena); }
    const area = pzPolyAreaPts(pts);
    let cx = 0, cy = 0; for (const p of pts) { cx += p.pos.x; cy += p.pos.y; } cx /= pts.length; cy /= pts.length;
    const pressure = (restArea / Math.max(area, 1) - 1) * pressureK;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        let nx = b.pos.y - a.pos.y, ny = -(b.pos.x - a.pos.x);          // edge normal
        const len = Math.hypot(nx, ny) || 1e-6; nx /= len; ny /= len;
        const mx = (a.pos.x + b.pos.x) / 2 - cx, my = (a.pos.y + b.pos.y) / 2 - cy;
        if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }              // force outward
        const f = pressure * len;
        a.pos.x += nx * f * 0.5; a.pos.y += ny * f * 0.5;
        b.pos.x += nx * f * 0.5; b.pos.y += ny * f * 0.5;
    }
    for (const p of pts) pzVerletArena(p, arena);
}
function pzDrawBlob(ctx, blob, fill, stroke) {
    const pts = blob.pts;
    ctx.beginPath(); ctx.moveTo(pts[0].pos.x, pts[0].pos.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].pos.x, pts[i].pos.y);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke();
}

// --- ragdoll: joint two rigid bodies at a WORLD point ------------------------
function pzWorldToLocal(body, wx, wy) {
    const dx = wx - body.pos.x, dy = wy - body.pos.y, c = Math.cos(-body.angle), s = Math.sin(-body.angle);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
}
function pzJointAt(a, b, wx, wy, opts = {}) {
    return new PZJoint(a, pzWorldToLocal(a, wx, wy), b, pzWorldToLocal(b, wx, wy), opts);
}
// build a humanoid ragdoll centred at (cx, cy): returns { bodies, joints }
function pzMakeRagdoll(cx, cy) {
    const opt = { friction: 0.5, restitution: 0.05, density: 0.005 };
    const torso = new PZRigidBody(cx, cy, pzBoxVerts(26, 60), { ...opt, tag: 'torso' });
    const head = new PZRigidBody(cx, cy - 46, pzRegularVerts(8, 16), { ...opt, tag: 'head' });
    const uArmL = new PZRigidBody(cx - 26, cy - 22, pzBoxVerts(34, 12), opt);
    const lArmL = new PZRigidBody(cx - 56, cy - 22, pzBoxVerts(34, 11), opt);
    const uArmR = new PZRigidBody(cx + 26, cy - 22, pzBoxVerts(34, 12), opt);
    const lArmR = new PZRigidBody(cx + 56, cy - 22, pzBoxVerts(34, 11), opt);
    const thighL = new PZRigidBody(cx - 9, cy + 50, pzBoxVerts(13, 40), opt);
    const shinL = new PZRigidBody(cx - 9, cy + 86, pzBoxVerts(12, 40), opt);
    const thighR = new PZRigidBody(cx + 9, cy + 50, pzBoxVerts(13, 40), opt);
    const shinR = new PZRigidBody(cx + 9, cy + 86, pzBoxVerts(12, 40), opt);
    const bodies = [torso, head, uArmL, lArmL, uArmR, lArmR, thighL, shinL, thighR, shinR];
    const joints = [
        pzJointAt(torso, head, cx, cy - 30),       // neck
        pzJointAt(torso, uArmL, cx - 12, cy - 24),  // L shoulder
        pzJointAt(uArmL, lArmL, cx - 42, cy - 22),  // L elbow
        pzJointAt(torso, uArmR, cx + 12, cy - 24),  // R shoulder
        pzJointAt(uArmR, lArmR, cx + 42, cy - 22),  // R elbow
        pzJointAt(torso, thighL, cx - 9, cy + 30),  // L hip
        pzJointAt(thighL, shinL, cx - 9, cy + 68),  // L knee
        pzJointAt(torso, thighR, cx + 9, cy + 30),  // R hip
        pzJointAt(thighR, shinR, cx + 9, cy + 68),  // R knee
    ];
    return { bodies, joints };
}

// =============================================================================
// DEMO 1 — broadDemo
// O(n²) dies at scale: 200 balls = ~20,000 pair tests. A spatial hash only tests
// balls sharing a cell — near-linear. Toggle the grid and watch the pair count.
// =============================================================================
(function broadDemo() {
    const canvas = document.getElementById('pzBroadCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 8, y: 8, w: W - 16, h: H - 16 };
    const nEl = document.getElementById('pzBroadN');
    const nVal = document.getElementById('pzBroadNVal');
    const gridCb = document.getElementById('pzBroadGrid');
    const hud = document.getElementById('pzBroadHud');
    const cell = 34;
    const hash = new PZSpatialHash(cell);
    let balls, pairTests;
    function reset() { balls = pzBalls(+nEl.value, arena, 7, 11); }
    reset();
    document.getElementById('pzBroadReset').addEventListener('click', reset);
    let lastN = +nEl.value;

    function update(dt) {
        const n = +nEl.value; if (nVal) nVal.textContent = n;
        if (n !== lastN) { reset(); lastN = n; }
        for (const b of balls) { b.vel.y += 1000 * dt; b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt; }
        pairTests = 0;
        if (gridCb.checked) {
            hash.clear(); for (const b of balls) hash.insert(b);
            for (const b of balls) for (const o of hash.nearby(b)) { if (o.id <= b.id) continue; pairTests++; pzBallPair(b, o); }
        } else {
            for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) { pairTests++; pzBallPair(balls[i], balls[j]); }
        }
        for (const b of balls) pzBallWalls(b, arena);
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        if (gridCb.checked) {
            ctx.strokeStyle = 'rgba(79,195,247,0.10)'; ctx.lineWidth = 1;
            for (let x = arena.x; x < arena.x + arena.w; x += cell) { ctx.beginPath(); ctx.moveTo(x, arena.y); ctx.lineTo(x, arena.y + arena.h); ctx.stroke(); }
            for (let y = arena.y; y < arena.y + arena.h; y += cell) { ctx.beginPath(); ctx.moveTo(arena.x, y); ctx.lineTo(arena.x + arena.w, y); ctx.stroke(); }
        }
        for (const b of balls) { ctx.fillStyle = PZ.ball; ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.r, 0, Math.PI * 2); ctx.fill(); }
        const naive = balls.length * (balls.length - 1) / 2;
        hud.textContent = `${balls.length} balls · pair tests this frame: ${pairTests} · O(n²) would be ${naive} · grid ${gridCb.checked ? 'ON' : 'OFF'}`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — sleepDemo
// Don't simulate what isn't moving. A ball below an energy threshold for a moment
// SLEEPS (skips integration, dims). A moving ball that touches it wakes it — and
// its neighbours — so a settled pile costs almost nothing until disturbed.
// =============================================================================
(function sleepDemo() {
    const canvas = document.getElementById('pzSleepCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 8, y: 8, w: W - 16, h: H - 16 };
    const hud = document.getElementById('pzSleepHud');
    const pointer = pzInstallPointer(canvas);
    const cell = 30, hash = new PZSpatialHash(cell);
    let balls;
    function reset() { balls = pzBalls(70, arena, 9, 13); }
    reset();
    document.getElementById('pzSleepReset').addEventListener('click', reset);

    const SLEEP_SPEED = 14, SLEEP_TIME = 0.7;
    function update(dt) {
        if (pointer.justPressed && balls.length < 160) {
            balls.push({ id: balls.length, pos: new Vector2D(pointer.pos.x, arena.y + 14), vel: new Vector2D((Math.random() - 0.5) * 60, 0), r: 11, sleeping: false, sleepT: 0 });
        }
        for (const b of balls) {
            if (b.sleeping) continue;
            b.vel.y += 1000 * dt; b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt;
        }
        hash.clear(); for (const b of balls) hash.insert(b);
        for (const b of balls) for (const o of hash.nearby(b)) {
            if (o.id <= b.id) continue;
            const touched = pzBallPair(b, o);
            if (touched) { // a moving body wakes a sleeping neighbour (island wake)
                if (!b.sleeping && o.sleeping && (Math.abs(b.vel.x) + Math.abs(b.vel.y)) > SLEEP_SPEED) { o.sleeping = false; o.sleepT = 0; }
                if (!o.sleeping && b.sleeping && (Math.abs(o.vel.x) + Math.abs(o.vel.y)) > SLEEP_SPEED) { b.sleeping = false; b.sleepT = 0; }
            }
        }
        for (const b of balls) {
            if (b.sleeping) continue;
            pzBallWalls(b, arena);
            const sp = Math.hypot(b.vel.x, b.vel.y);
            if (sp < SLEEP_SPEED) { b.sleepT += dt; if (b.sleepT > SLEEP_TIME) { b.sleeping = true; b.vel.set(0, 0); } }
            else b.sleepT = 0;
        }
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        let awake = 0;
        for (const b of balls) {
            if (b.sleeping) { ctx.fillStyle = 'rgba(96,107,140,0.5)'; }
            else { ctx.fillStyle = PZ.ball; awake++; }
            ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.r, 0, Math.PI * 2); ctx.fill();
        }
        hud.textContent = `${balls.length} balls · ${awake} awake, ${balls.length - awake} asleep (dim) · click to drop one & wake the pile`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — softDemo
// A soft body is a closed Verlet mesh (a ring of points + perimeter constraints)
// with one extra force: PRESSURE. Measure the enclosed area; if it's below the
// rest area, push every edge outward — so the blob holds its shape, squishes on
// impact and springs back. Drag it; drop the pressure and it deflates.
// =============================================================================
(function softDemo() {
    const canvas = document.getElementById('pzSoftCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const arena = { x: 10, y: 10, w: W - 20, h: H - 20 };
    const pEl = document.getElementById('pzSoftPressure');
    const pVal = document.getElementById('pzSoftPressureVal');
    const hud = document.getElementById('pzSoftHud');
    const pointer = pzInstallPointer(canvas);
    let blob, grab;
    function reset() { blob = pzMakeBlob(W / 2, 90, 60, 18, 5); grab = null; }
    reset();
    document.getElementById('pzSoftReset').addEventListener('click', reset);

    function update(dt) {
        const pressureK = +pEl.value; if (pVal) pVal.textContent = pressureK.toFixed(2);
        if (pointer.justPressed) {
            let best = null, bestD = 40;
            for (const p of blob.pts) { const d = Math.hypot(pointer.pos.x - p.pos.x, pointer.pos.y - p.pos.y); if (d < bestD) { bestD = d; best = p; } }
            grab = best;
        }
        if (pointer.justReleased) grab = null;
        if (grab && pointer.isDown) { grab.prev.set(grab.pos.x, grab.pos.y); grab.pos.set(pointer.pos.x, pointer.pos.y); }
        pzSoftStep(blob, dt, 1300, arena, 6, pressureK);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        pzDrawBlob(ctx, blob, 'rgba(124,242,200,0.30)', PZ.ball);
        for (const p of blob.pts) { ctx.fillStyle = PZ.ballDk; ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 3, 0, Math.PI * 2); ctx.fill(); }
        const area = pzPolyAreaPts(blob.pts);
        hud.textContent = `pressure ${(+pEl.value).toFixed(2)} · area ${(area / blob.restArea * 100).toFixed(0)}% of rest · drag the blob; drop pressure to deflate it`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — ragdollDemo
// A ragdoll is nothing new: it's the Advanced tier's rigid bodies + pivot joints,
// assembled into a skeleton (torso, head, jointed arms & legs). Drag a limb to
// puppet it; it flops because every joint just keeps two bodies pinned together.
// =============================================================================
(function ragdollDemo() {
    const canvas = document.getElementById('pzRagdollCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzRagdollHud');
    let bodies, joints, grab, off;
    function reset() {
        const arena = pzArenaBodies(W, H);
        const doll = pzMakeRagdoll(W / 2, 120);
        bodies = [...arena, ...doll.bodies];
        joints = doll.joints; grab = null; off = { x: 0, y: 0 };
    }
    reset();
    document.getElementById('pzRagdollReset').addEventListener('click', reset);

    function update(dt) {
        if (pointer.justPressed) {
            for (const b of bodies) {
                if (b.isStatic) continue;
                if (pzPointInPoly(pointer.pos.x, pointer.pos.y, b.worldVerts())) {
                    grab = b; off = { x: b.pos.x - pointer.pos.x, y: b.pos.y - pointer.pos.y }; break;
                }
            }
        }
        if (pointer.justReleased) grab = null;
        // drag via velocity only — the world step integrates it to the cursor
        // (setting pos too would double-apply the move and make the body jitter).
        if (grab && pointer.isDown) pzDragTo(grab, pointer.pos.x + off.x, pointer.pos.y + off.y, dt);
        pzStepWorld(bodies, joints, 0, 1100, dt, { iterations: 16 });
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        for (const b of bodies) {
            if (b.isStatic) pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
            else if (b.tag === 'head') pzDrawPoly(ctx, b, PZ.ball, '#3fae8e');
            else if (b.tag === 'torso') pzDrawPoly(ctx, b, PZ.accent, '#1f6f93');
            else pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
        }
        hud.textContent = `a ragdoll = 10 rigid bodies + 9 pivot joints · drag a limb to puppet it`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — fluidDemo
// Water is just thousands of tiny bodies. Each pushes its crowded neighbours away
// (pressure) and matches their velocity (viscosity); over the spatial hash that's
// near-linear. A light object dropped in FLOATS — the dense fluid beneath nets an
// upward shove (buoyancy). Drag the duck under and let go.
// =============================================================================
(function fluidDemo() {
    const canvas = document.getElementById('pzFluidCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    // a narrow, DEEP basin — a few hundred particles only pool if they're confined
    // (spread across the whole canvas they'd be a 1-particle-deep puddle).
    const basin = { x: W / 2 - 155, y: 26, w: 310, h: H - 36 };
    const nEl = document.getElementById('pzFluidN');
    const nVal = document.getElementById('pzFluidNVal');
    const hud = document.getElementById('pzFluidHud');
    const pointer = pzInstallPointer(canvas);
    const h = 16, hash = new PZSpatialHash(h);
    let parts, duck, grab;
    function reset() {
        const n = +nEl.value;
        parts = [];
        const cols = Math.floor(basin.w / 12);
        for (let i = 0; i < n; i++) parts.push({ pos: new Vector2D(basin.x + 8 + (i % cols) * 11 + Math.random() * 3, basin.y + 16 + Math.floor(i / cols) * 11), vel: new Vector2D(0, 0) });
        duck = { pos: new Vector2D(basin.x + basin.w / 2, basin.y + 30), vel: new Vector2D(0, 0), r: 20, invMass: 1 / 4 };
        grab = false;
    }
    reset();
    let lastN = +nEl.value;
    document.getElementById('pzFluidReset').addEventListener('click', reset);

    function update(dt) {
        const n = +nEl.value; if (nVal) nVal.textContent = n;
        if (n !== lastN) { reset(); lastN = n; }
        if (pointer.justPressed && Math.hypot(pointer.pos.x - duck.pos.x, pointer.pos.y - duck.pos.y) < duck.r + 12) grab = true;
        if (pointer.justReleased) grab = false;
        pzFluidStep(parts, hash, basin, h, dt, 1100, 0.3, 0.2);
        // the duck is integrated MANUALLY here (not by pzStepWorld), and the grab branch skips
        // the else integration — so set pos directly (pzDragTo would leave it stationary). vel is
        // kept so a release throws it. No double-step here, so no jitter to fix.
        if (grab && pointer.isDown) { duck.vel.set((pointer.pos.x - duck.pos.x) / dt, (pointer.pos.y - duck.pos.y) / dt); duck.pos.set(pointer.pos.x, pointer.pos.y); }
        else { duck.vel.y += 1100 * dt * 0.5; duck.pos.x += duck.vel.x * dt; duck.pos.y += duck.vel.y * dt; duck.vel.x *= 0.98; duck.vel.y *= 0.98; }
        pzFluidFloat(duck, parts, dt);
        duck.pos.x = clamp(duck.pos.x, basin.x + duck.r, basin.x + basin.w - duck.r);
        duck.pos.y = clamp(duck.pos.y, basin.y + duck.r, basin.y + basin.h - duck.r);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // basin walls (open-top U)
        ctx.strokeStyle = PZ.wall; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(basin.x - 3, basin.y); ctx.lineTo(basin.x - 3, basin.y + basin.h + 3); ctx.lineTo(basin.x + basin.w + 3, basin.y + basin.h + 3); ctx.lineTo(basin.x + basin.w + 3, basin.y); ctx.stroke();
        ctx.fillStyle = '#3aa6e0';
        for (const p of parts) { ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = PZ.warn; ctx.beginPath(); ctx.arc(duck.pos.x, duck.pos.y, duck.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a8701a'; ctx.lineWidth = 2; ctx.stroke();
        hud.textContent = `${parts.length} fluid particles in the tank · drag the duck under and release — buoyancy floats it back up`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — rubeDemo  (GRAND CAPSTONE: "Rube")
// Every system in one world. SLINGSHOT a ball to topple a RIGID stack — the
// BRITTLE block SHATTERS (Voronoi) — and knock the green GOAL ball over the wall
// into the FLUID pool (where a duck bobs on the BUOYANCY). The impulse-rigid
// family delivers the ball; the position-based fluid family receives it.
// (Heavy bodies are kept out of the water by the wall, and anything that does
//  splash in is removed — so the two families coexist without destabilising.)
// =============================================================================
(function rubeDemo() {
    const canvas = document.getElementById('pzRubeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzRubeHud');
    // anchor sits up the left side (not jammed in the corner) so there's room to
    // pull DOWN-LEFT for an up-right launch into the tank. POWER is gentle enough
    // that a normal pull arcs into the tank instead of rocketing off the ceiling.
    const anchor = { x: 100, y: 250 };
    const MAX_PULL = 150, POWER = 8, GRAV = 1200;
    const hh = 15, hash = new PZSpatialHash(hh);
    const pool = { x: 440, y: 236, w: W - 18 - 440, h: H - 6 - 236 }; // tank on the right
    const wallTop = 292;

    let bodies, parts, duck, shots, won, trauma;
    const dust = [];
    function reset() {
        bodies = pzArenaBodies(W, H);
        // the pool's LEFT wall keeps toppled rigid bodies OUT of the water — only the
        // light goal ball is launched over it — so the fluid stays calm & stable.
        bodies.push(new PZRigidBody(pool.x - 7, (wallTop + (H - 6)) / 2, pzBoxVerts(12, (H - 6) - wallTop), { static: true, tag: 'wall' }));
        // a brittle tower in front of the tank — an obstacle to smash through, and
        // the tier's fracture on show. Land a slingshot ball in the tank to win.
        const sx = 372, by = H - 6;
        bodies.push(new PZRigidBody(sx, by - 17, pzBoxVerts(34, 34), { friction: 0.7, restitution: 0.04, color: PZ.target, tag: 'block' }));
        bodies.push(new PZRigidBody(sx, by - 51, pzBoxVerts(34, 34), { friction: 0.7, restitution: 0.04, color: '#b8743b', tag: 'brittle' }));
        bodies.push(new PZRigidBody(sx, by - 85, pzBoxVerts(34, 34), { friction: 0.7, restitution: 0.04, color: '#b8743b', tag: 'brittle' }));
        // fluid + a floating duck (the ONLY thing in the water → stable)
        parts = [];
        const cols = Math.floor(pool.w / 12);
        for (let i = 0; i < 130; i++) parts.push({ pos: new Vector2D(pool.x + 8 + (i % cols) * 11, pool.y + 16 + Math.floor(i / cols) * 11), vel: new Vector2D(0, 0) });
        duck = { pos: new Vector2D(pool.x + pool.w / 2, pool.y + 50), vel: new Vector2D(0, 0), r: 15, invMass: 1 / 4 };
        shots = 6; won = false; trauma = 0; dust.length = 0;
    }
    reset();
    document.getElementById('pzRubeReset').addEventListener('click', reset);

    function update(dt) {
        if (pointer.justReleased && pointer.releaseStart && shots > 0 && !won) {
            const pull = new Vector2D(pointer.releaseEnd.x - anchor.x, pointer.releaseEnd.y - anchor.y); pull.limit(MAX_PULL);
            const ball = new PZRigidBody(anchor.x, anchor.y, pzRegularVerts(10, 15), { density: 0.03, restitution: 0.3, friction: 0.3, color: PZ.ball, tag: 'shot' });
            ball.vel.set(-pull.x * POWER, -pull.y * POWER); bodies.push(ball); shots--;
        }
        pzStepWorld(bodies, [], 0, 1200, dt, { iterations: 10 });
        // brittle block shatters on a fast hit
        for (let i = bodies.length - 1; i >= 0; i--) {
            const b = bodies[i]; if (b.tag !== 'brittle') continue;
            let hit = false;
            for (const o of bodies) { if (o !== b && !o.isStatic && o.vel.length() > 220 && pzPolyVsPoly(b, o)) { hit = true; break; } }
            if (hit) { const fr = pzFractureBody(b, 4, { kick: 60, color: '#b8743b' }); bodies.splice(i, 1, ...fr); pzDustBurst(dust, b.pos.x, b.pos.y, 12, '#caa'); trauma = Math.min(1, trauma + 0.5); }
        }
        // a body that actually REACHES THE WATER (touches a fluid particle) splashes
        // (dust + a surface kick) and is removed — keeps the water stable. A shot
        // doing so wins. We test against the WATER, not the tank's top edge, so the
        // win fires on splashdown, not in mid-air above the tank.
        for (let i = bodies.length - 1; i >= 0; i--) {
            const b = bodies[i];
            if (b.isStatic || b.pos.x < pool.x || b.pos.x > pool.x + pool.w) continue;
            // a PZRigidBody has no .radius (it's a polygon) — its bounding radius is the
            // farthest vertex from the centre. (The earlier b.radius read NaN → never won.)
            let br = 0; for (const v of b.verts) { const d2 = v.x * v.x + v.y * v.y; if (d2 > br) br = d2; } br = Math.sqrt(br);
            let touches = false; const reach = (br + 8) * (br + 8);
            for (const p of parts) { const dx = p.pos.x - b.pos.x, dy = p.pos.y - b.pos.y; if (dx * dx + dy * dy < reach) { touches = true; break; } }
            if (!touches) continue;
            pzDustBurst(dust, b.pos.x, b.pos.y, 16, '#9fd0f0'); trauma = Math.min(1, trauma + 0.35);
            for (const p of parts) if (Math.abs(p.pos.x - b.pos.x) < 46 && p.pos.y < b.pos.y + 30) p.vel.y -= 150;
            if (b.tag === 'shot') won = true;
            bodies.splice(i, 1);
        }
        // fluid + the floating duck (the only body in the water)
        pzFluidStep(parts, hash, pool, hh, dt, 1100, 0.3, 0.2);
        duck.vel.y += 1100 * dt * 0.5; duck.pos.x += duck.vel.x * dt; duck.pos.y += duck.vel.y * dt; duck.vel.x *= 0.97; duck.vel.y *= 0.92;
        pzFluidFloat(duck, parts, dt);
        duck.pos.x = clamp(duck.pos.x, pool.x + duck.r, pool.x + pool.w - duck.r);
        duck.pos.y = clamp(duck.pos.y, pool.y - 26, pool.y + pool.h - duck.r);
        trauma = Math.max(0, trauma - dt * 1.5);
        pzDustStep(dust, dt);
        pointer.endFrame();
    }
    function render() {
        ctx.save();
        if (trauma > 0) { const s = trauma * trauma * 10; ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s); }
        clearCanvas(ctx, W, H, PZ.bg);
        // pool tint + goal label
        ctx.fillStyle = won ? 'rgba(102,187,106,0.10)' : 'rgba(58,166,224,0.08)';
        ctx.fillRect(pool.x, pool.y - 18, pool.w, pool.h + 18);
        ctx.fillStyle = won ? PZ.good : PZ.accent; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('🎯 land a ball in the water', pool.x + pool.w / 2, pool.y - 24); ctx.textAlign = 'start';
        // fluid
        ctx.fillStyle = '#3aa6e0'; for (const p of parts) { ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2); ctx.fill(); }
        // duck
        ctx.fillStyle = PZ.warn; ctx.beginPath(); ctx.arc(duck.pos.x, duck.pos.y, duck.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#a8701a'; ctx.lineWidth = 2; ctx.stroke();
        // bodies
        for (const b of bodies) {
            if (b.isStatic) pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
            else if (b.tag === 'shot') pzDrawPoly(ctx, b, PZ.ball, '#3fae8e');
            else if (b.tag === 'goal') pzDrawPoly(ctx, b, PZ.accent, '#1f6f93');
            else if (b.tag === 'brittle' || b.tag === 'debris') pzDrawPoly(ctx, b, '#b8743b', '#6e4423');
            else pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
        }
        pzDustDraw(ctx, dust);
        if (pointer.isDown && pointer.start && shots > 0 && !won) {
            const pull = new Vector2D(pointer.pos.x - anchor.x, pointer.pos.y - anchor.y); pull.limit(MAX_PULL);
            // dotted trajectory preview — the projectile maths sampled forward
            const vx = -pull.x * POWER, vy = -pull.y * POWER;
            ctx.fillStyle = PZ.trace;
            for (let t = 0.04; t < 1.2; t += 0.05) {
                const px = anchor.x + vx * t, py = anchor.y + vy * t + 0.5 * GRAV * t * t;
                if (px > W - 6 || py > H - 6 || px < 6) break;
                ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = PZ.aim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(anchor.x + pull.x, anchor.y + pull.y); ctx.stroke();
        }
        ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (won) hud.innerHTML = `<span style="color:${PZ.good}">🏆 Splashdown! Slingshot, rigid bodies, fracture & fluid — every system fired.</span> Reset to replay.`;
        else if (shots === 0) hud.innerHTML = `<span style="color:${PZ.bad}">Out of shots.</span> Reset to retry.`;
        else hud.textContent = `${shots} shot(s) · slingshot a ball into the water tank — smash the brittle tower on the way`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// pzDustBurst / pzDustStep / pzDustDraw — the Expert tier's dust, re-declared here
// (lib-copy) so the capstone has its juice without loading expert-demos.js.
// =============================================================================
function pzDustBurst(list, x, y, n, color) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 150; list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.35 + Math.random() * 0.45, age: 0, r: 1.5 + Math.random() * 2.5, color }); }
}
function pzDustStep(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.age += dt; if (p.age >= p.life) { list.splice(i, 1); continue; } p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
}
function pzDustDraw(ctx, list) {
    for (const p of list) { ctx.globalAlpha = (1 - p.age / p.life) * 0.75; ctx.fillStyle = p.color || '#c9b27a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
}

// =============================================================================
// pzPointInPoly + pzFractureBody (+ its clip/centroid helpers) — the Expert
// tier's Voronoi shatter, lib-copied so the capstone can fracture a brittle block
// without loading expert-demos.js. (Same code; a 2nd page can't share a top-level
// declaration, so it's re-declared rather than moved.)
// =============================================================================
function pzPointInPoly(px, py, poly) {
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const cr = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
        if (cr !== 0) { const s = cr > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false; }
    }
    return true;
}
function pzClipPolyHalfPlane(poly, nx, ny, o) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const da = nx * a.x + ny * a.y - o, db = nx * b.x + ny * b.y - o;
        if (da <= 0) out.push(a);
        if (da * db < 0) { const t = da / (da - db); out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }); }
    }
    return out;
}
function pzCentroidArea(poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; const cr = p.x * q.y - q.x * p.y; a += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr; }
    a *= 0.5;
    if (Math.abs(a) < 1e-6) return { x: poly[0].x, y: poly[0].y, area: 0 };
    return { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) };
}
function pzFractureBody(body, nSites, opts = {}) {
    const wv = body.worldVerts();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of wv) { minX = Math.min(minX, v.x); minY = Math.min(minY, v.y); maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y); }
    const sites = []; let tries = 0;
    while (sites.length < nSites && tries < nSites * 40) { tries++; const sx = minX + Math.random() * (maxX - minX), sy = minY + Math.random() * (maxY - minY); if (pzPointInPoly(sx, sy, wv)) sites.push({ x: sx, y: sy }); }
    const frags = [];
    for (let i = 0; i < sites.length; i++) {
        let cell = wv.map(v => ({ x: v.x, y: v.y }));
        for (let j = 0; j < sites.length && cell.length >= 3; j++) {
            if (i === j) continue;
            const mx = (sites[i].x + sites[j].x) / 2, my = (sites[i].y + sites[j].y) / 2;
            const nx = sites[j].x - sites[i].x, ny = sites[j].y - sites[i].y;
            cell = pzClipPolyHalfPlane(cell, nx, ny, nx * mx + ny * my);
        }
        if (cell.length < 3) continue;
        const c = pzCentroidArea(cell);
        if (c.area < 14) continue;
        const local = cell.map(v => ({ x: v.x - c.x, y: v.y - c.y }));
        const frag = new PZRigidBody(c.x, c.y, local, { restitution: 0.1, friction: 0.6, density: opts.density ?? 0.005, color: opts.color || body.color, tag: 'debris' });
        frag.vel.set(body.vel.x, body.vel.y);
        const kx = c.x - body.pos.x, ky = c.y - body.pos.y, kl = Math.hypot(kx, ky) || 1;
        frag.vel.x += (kx / kl) * (opts.kick ?? 40); frag.vel.y += (ky / kl) * (opts.kick ?? 40);
        frag.angularVel = (Math.random() - 0.5) * 5;
        frags.push(frag);
    }
    return frags;
}
