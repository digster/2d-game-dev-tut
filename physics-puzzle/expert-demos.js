// =============================================================================
// PHYSICS PUZZLE — EXPERT TIER DEMOS ("Destruction & Debris")
// =============================================================================
// Six demos, each an IIFE that early-returns if its canvas is absent. Teaching
// order — each adds exactly ONE new idea on top of the last:
//
//   1. impactDemo    — destruction starts with "how hard was that hit?" (body.impact)
//   2. fractureDemo  — Voronoi pre-fracture: a shape is latent convex shards
//   3. debrisDemo    — spawn the shards as physics debris, recycled from a pool
//   4. stressDemo    — a structure is a load graph; knock out the keystone, it falls
//   5. juiceDemo     — dust + screen shake + hitstop make the same hit FEEL violent
//   6. demolishDemo  — capstone: bring a tower down below the line on a shot budget
//
// DEPENDENCIES (loaded BEFORE this file by expert.html):
//   ../shared/utils.js   — Vector2D, clearCanvas, clamp (globals)
//   engine/loop.js       — window.pzLoop, pzInstallPointer
//   engine/render.js     — window.PZ
//   engine/rigid.js      — the PROMOTED rigid engine (PZRigidBody, pzStepWorld,
//                          pzPolyVsPoly, pzBoxVerts, pzDrawPoly, pzArenaBodies, …)
//                          — Expert is its 2nd consumer.
//
// This tier adds its destruction-specific algorithms INLINE (single consumer):
// `pzFractureBody` (Voronoi shatter) + the convex-clip helpers it needs, a small
// debris pool, a dust-particle system, and trauma-shake / hitstop juice. All names
// are pz/PZ-prefixed. Reads the engine's new `body.impact` (the total normal
// impulse a body received last step) to drive both breaking and the stress colour.
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
// INLINE DESTRUCTION TOOLKIT (this tier's lesson)
// =============================================================================

// Is (px,py) inside a convex polygon? (consistent cross-product sign on all edges)
function pzPointInPoly(px, py, poly) {
    let sign = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const cr = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
        if (cr !== 0) { const s = cr > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false; }
    }
    return true;
}

// Clip a polygon to a half-plane (keep the side where nx·x + ny·y ≤ o). The one
// operation Voronoi shattering is built from. (Sister to engine/rigid.js's pzClip,
// which clips a single segment.)
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

// Area centroid of a polygon (the centre of mass a fragment should pivot about).
function pzCentroidArea(poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const cr = p.x * q.y - q.x * p.y; a += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
    }
    a *= 0.5;
    if (Math.abs(a) < 1e-6) return { x: poly[0].x, y: poly[0].y, area: 0 };
    return { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) };
}

// Voronoi shatter: split `body`'s polygon into convex cells around random sites,
// returning new PZRigidBody fragments (positioned in the world, inheriting the
// body's velocity + a small outward kick). A cell = the polygon clipped by the
// perpendicular bisector between its site and every other site.
function pzFractureBody(body, nSites, opts = {}) {
    const wv = body.worldVerts();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of wv) { minX = Math.min(minX, v.x); minY = Math.min(minY, v.y); maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y); }
    const sites = []; let tries = 0;
    while (sites.length < nSites && tries < nSites * 40) {
        tries++;
        const sx = minX + Math.random() * (maxX - minX), sy = minY + Math.random() * (maxY - minY);
        if (pzPointInPoly(sx, sy, wv)) sites.push({ x: sx, y: sy });
    }
    const frags = [];
    for (let i = 0; i < sites.length; i++) {
        let cell = wv.map(v => ({ x: v.x, y: v.y }));
        for (let j = 0; j < sites.length && cell.length >= 3; j++) {
            if (i === j) continue;
            const mx = (sites[i].x + sites[j].x) / 2, my = (sites[i].y + sites[j].y) / 2;
            const nx = sites[j].x - sites[i].x, ny = sites[j].y - sites[i].y; // away from site i
            cell = pzClipPolyHalfPlane(cell, nx, ny, nx * mx + ny * my);
        }
        if (cell.length < 3) continue;
        const c = pzCentroidArea(cell);
        if (c.area < 14) continue; // drop slivers
        const local = cell.map(v => ({ x: v.x - c.x, y: v.y - c.y }));
        const frag = new PZRigidBody(c.x, c.y, local, {
            restitution: 0.1, friction: 0.6, density: opts.density ?? 0.005, color: opts.color || body.color, tag: 'debris',
        });
        frag.vel.set(body.vel.x, body.vel.y);
        const kx = c.x - body.pos.x, ky = c.y - body.pos.y, kl = Math.hypot(kx, ky) || 1;
        frag.vel.x += (kx / kl) * (opts.kick ?? 40);
        frag.vel.y += (ky / kl) * (opts.kick ?? 40);
        frag.angularVel = (Math.random() - 0.5) * 5;
        frags.push(frag);
    }
    return frags;
}

// --- dust particles (per-demo list; pass the array in) ----------------------
function pzDustBurst(list, x, y, n, color) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 150;
        list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.35 + Math.random() * 0.45, age: 0, r: 1.5 + Math.random() * 2.5, color });
    }
}
function pzDustStep(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]; p.age += dt;
        if (p.age >= p.life) { list.splice(i, 1); continue; }
        p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
}
function pzDustDraw(ctx, list) {
    for (const p of list) {
        ctx.globalAlpha = (1 - p.age / p.life) * 0.75;
        ctx.fillStyle = p.color || '#c9b27a';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// map a 0..1 load to a green→amber→red colour (the stress visualiser)
function pzLoadColor(t) {
    t = clamp(t, 0, 1);
    const r = Math.round(120 + t * 135), g = Math.round(200 - t * 150), b = Math.round(110 - t * 70);
    return `rgb(${r},${g},${b})`;
}

// =============================================================================
// DEMO 1 — impactDemo
// Destruction begins with a number we ALREADY compute: how hard was the hit?
// The solver sums each body's normal impulse into `body.impact` every step. Fling
// a heavy ball at the wall; any block whose impact passes the threshold breaks.
// =============================================================================
(function impactDemo() {
    const canvas = document.getElementById('pzImpactCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const tEl = document.getElementById('pzImpactThreshold');
    const tVal = document.getElementById('pzImpactThresholdVal');
    const hud = document.getElementById('pzImpactHud');
    const dust = [];

    let bodies, broken, maxImpact;
    function reset() {
        bodies = pzArenaBodies(W, H);
        const ft = H - 6;
        // a STATIC wall of "glass" blocks: static ⇒ zero resting impact, so the
        // only impact a block sees is the BALL hitting it — a clean threshold test
        // (a dynamic stack's bottom rows carry big resting loads that would muddy it).
        for (let r = 0; r < 5; r++)
            for (let c = 0; c < 3; c++)
                bodies.push(new PZRigidBody(W * 0.62 + c * 42, ft - 21 - r * 42, pzBoxVerts(40, 40), { static: true, friction: 0.6, restitution: 0.2, color: PZ.target, tag: 'block' }));
        broken = 0; maxImpact = 0;
    }
    reset();
    document.getElementById('pzImpactReset').addEventListener('click', reset);

    function update(dt) {
        const thr = +tEl.value; if (tVal) tVal.textContent = thr;
        if (pointer.justReleased && pointer.releaseStart) {
            const dx = pointer.releaseEnd.x - pointer.releaseStart.x, dy = pointer.releaseEnd.y - pointer.releaseStart.y;
            const ball = new PZRigidBody(pointer.releaseStart.x, pointer.releaseStart.y, pzRegularVerts(10, 18), { density: 0.02, restitution: 0.2, friction: 0.3, color: PZ.ball, tag: 'ball' });
            ball.vel.set(dx * 8, dy * 8);
            bodies.push(ball);
        }
        pzStepWorld(bodies, [], 0, 1200, dt, { iterations: 10 });
        // break blocks whose impact passed the threshold this step
        maxImpact = 0;
        for (let i = bodies.length - 1; i >= 0; i--) {
            const b = bodies[i];
            if (b.tag === 'block') maxImpact = Math.max(maxImpact, b.impact);
            if (b.tag === 'block' && b.impact > thr) {
                pzDustBurst(dust, b.pos.x, b.pos.y, 14, '#caa23a');
                bodies.splice(i, 1); broken++;
            }
        }
        pzDustStep(dust, dt);
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        for (const b of bodies) {
            // tag first: the breakable wall blocks are static too, but must read as
            // gold "glass", not the dark arena border.
            if (b.tag === 'block') pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
            else if (b.tag === 'ball') pzDrawPoly(ctx, b, PZ.ball, '#3fae8e');
            else pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
        }
        pzDustDraw(ctx, dust);
        if (pointer.isDown && pointer.start) { ctx.strokeStyle = PZ.aim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pointer.start.x, pointer.start.y); ctx.lineTo(pointer.pos.x, pointer.pos.y); ctx.stroke(); }
        hud.textContent = `threshold ${(+tEl.value)} · hardest hit this frame ${maxImpact.toFixed(0)} · ${broken} block(s) shattered · drag to fling a ball`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — fractureDemo
// Pre-fracture: shattering looks expensive but it's just precomputed geometry. We
// compute a Voronoi cell decomposition of the pane and draw it faintly (the latent
// shards). Click to "break" — the cells become real falling debris.
// =============================================================================
(function fractureDemo() {
    const canvas = document.getElementById('pzFractureCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const nEl = document.getElementById('pzFractureN');
    const nVal = document.getElementById('pzFractureNVal');
    const hud = document.getElementById('pzFractureHud');

    let pane, frags, broken, latent;
    function makePane() {
        pane = new PZRigidBody(W / 2, 140, pzBoxVerts(220, 150), { static: true, color: PZ.target });
        // precompute the latent shard outlines for preview (drawn faintly)
        latent = pzFractureBody(pane, +nEl.value, {}).map(f => f.worldVerts());
        frags = []; broken = false;
    }
    makePane();
    document.getElementById('pzFractureReset').addEventListener('click', makePane);

    function update(dt) {
        if (nVal) nVal.textContent = nEl.value;
        if (pointer.justPressed && !broken) {
            frags = pzFractureBody(pane, +nEl.value, { kick: 70 });
            broken = true;
        }
        if (broken) {
            const floor = pzArenaBodies(W, H)[0]; // just the floor for debris to land on
            pzStepWorld([floor, ...frags], [], 0, 1200, dt, { iterations: 8 });
        }
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        if (!broken) {
            pzDrawPoly(ctx, pane, PZ.target, '#8a6a1a');
            // faint latent crack lines
            ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 1;
            for (const poly of latent) {
                ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y);
                for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
                ctx.closePath(); ctx.stroke();
            }
            hud.textContent = `${latent.length} latent shards (precomputed) · click the pane to shatter it`;
        } else {
            for (const f of frags) pzDrawPoly(ctx, f, PZ.target, '#8a6a1a');
            hud.textContent = `shattered into ${frags.length} convex fragments · Reset to rebuild`;
        }
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — debrisDemo
// Shattering spews bodies fast — so debris is RECYCLED from a fixed pool. Click to
// drop-and-shatter a block; the debris list is capped, and the oldest pieces are
// retired to keep the body count (and GC) bounded.
// =============================================================================
(function debrisDemo() {
    const canvas = document.getElementById('pzDebrisCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const capEl = document.getElementById('pzDebrisCap');
    const capVal = document.getElementById('pzDebrisCapVal');
    const hud = document.getElementById('pzDebrisHud');

    const statics = pzArenaBodies(W, H);
    let debris = [], retired = 0;
    document.getElementById('pzDebrisReset').addEventListener('click', () => { debris = []; retired = 0; });

    function update(dt) {
        const CAP = +capEl.value; if (capVal) capVal.textContent = CAP;
        if (pointer.justPressed) {
            const block = new PZRigidBody(clamp(pointer.pos.x, 60, W - 60), Math.max(40, pointer.pos.y - 40), pzBoxVerts(48, 48), { color: PZ.target });
            const frags = pzFractureBody(block, 5, { kick: 90 });
            for (const f of frags) { f.vel.y -= 60; debris.push(f); }
            // retire oldest to honour the pool budget (swap-from-front)
            if (debris.length > CAP) { retired += debris.length - CAP; debris.splice(0, debris.length - CAP); }
        }
        pzStepWorld([...statics, ...debris], [], 0, 1200, dt, { iterations: 7 });
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        for (const b of statics) pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
        for (const f of debris) pzDrawPoly(ctx, f, PZ.target, '#8a6a1a');
        hud.textContent = `debris ${debris.length}/${+capEl.value} active · ${retired} retired to the pool · click to shatter a block`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — stressDemo
// A structure is a load graph. We don't need new maths: a resting block's
// `impact` (the impulse the solver applies to hold up everything above it) IS its
// load — so we colour by it (green → red). Click a load-bearing block (the
// keystone) to remove it and watch the structure above collapse.
// =============================================================================
(function stressDemo() {
    const canvas = document.getElementById('pzStressCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzStressHud');

    let bodies;
    function reset() {
        bodies = pzArenaBodies(W, H);
        // a stable "trilithon": two stacked-block posts + a lintel resting across
        // them. Wide posts so it stands rock-still; the load gradient (bottom of a
        // post reddest, lintel greenest) reads clearly.
        const ft = H - 6, h = 34, lx = W * 0.4, rx = W * 0.4 + 150;
        for (const px of [lx, rx])
            for (let i = 0; i < 3; i++)
                bodies.push(new PZRigidBody(px, ft - h / 2 - i * h, pzBoxVerts(56, h - 1), { friction: 0.95, restitution: 0, tag: 'block' }));
        bodies.push(new PZRigidBody((lx + rx) / 2, ft - 3 * h - 11, pzBoxVerts(rx - lx + 70, 22), { friction: 0.95, restitution: 0, tag: 'block', density: 0.004 }));
    }
    reset();
    document.getElementById('pzStressReset').addEventListener('click', reset);

    function update(dt) {
        if (pointer.justPressed) {
            // remove the topmost block whose body contains the click
            for (let i = bodies.length - 1; i >= 0; i--) {
                const b = bodies[i];
                if (b.tag === 'block' && pzPointInPoly(pointer.pos.x, pointer.pos.y, b.worldVerts())) { bodies.splice(i, 1); break; }
            }
        }
        pzStepWorld(bodies, [], 0, 1200, dt, { iterations: 14 });
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PZ.bg);
        // scale: divide each block's impact by a reference so the busiest reads ~1
        let maxImp = 1; for (const b of bodies) if (b.tag === 'block') maxImp = Math.max(maxImp, b.impact);
        for (const b of bodies) {
            if (b.isStatic) { pzDrawPoly(ctx, b, PZ.wall, '#2b3350'); continue; }
            pzDrawPoly(ctx, b, pzLoadColor(b.impact / maxImp), 'rgba(0,0,0,0.4)');
        }
        hud.textContent = `colour = support load (green→red) · click a red, load-bearing block to knock it out`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — juiceDemo
// The same collision, made to FEEL violent: a burst of dust at the contact, a
// trauma-based screen shake, and a few frames of hitstop (freeze) on a big hit.
// Toggle each and fling a ball at the stack to feel the difference.
// =============================================================================
(function juiceDemo() {
    const canvas = document.getElementById('pzJuiceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const dustCb = document.getElementById('pzJuiceDust');
    const shakeCb = document.getElementById('pzJuiceShake');
    const stopCb = document.getElementById('pzJuiceStop');
    const hud = document.getElementById('pzJuiceHud');
    const dust = [];

    let bodies, trauma, hitstop;
    function reset() {
        bodies = pzArenaBodies(W, H);
        const ft = H - 6;
        for (let i = 0; i < 4; i++) bodies.push(new PZRigidBody(W * 0.62, ft - 20 - i * 40, pzBoxVerts(76, 38), { friction: 0.6, restitution: 0.05, color: PZ.target, tag: 'block' }));
        trauma = 0; hitstop = 0; dust.length = 0;
    }
    reset();
    document.getElementById('pzJuiceReset').addEventListener('click', reset);

    // We watch the thrown BALL's impact, not the blocks': a ball carries no resting
    // load (nothing stacked on it), so its impact is ~0 until it strikes — a clean
    // "this frame's hit" signal that a stacked block's big resting load can't fake.
    const BIG = 500;
    function update(dt) {
        if (pointer.justReleased && pointer.releaseStart) {
            const dx = pointer.releaseEnd.x - pointer.releaseStart.x, dy = pointer.releaseEnd.y - pointer.releaseStart.y;
            const ball = new PZRigidBody(pointer.releaseStart.x, pointer.releaseStart.y, pzRegularVerts(10, 18), { density: 0.02, restitution: 0.2, color: PZ.ball, tag: 'ball' });
            ball.vel.set(dx * 8, dy * 8); bodies.push(ball);
        }
        if (hitstop > 0) { hitstop--; pointer.endFrame(); return; } // FROZEN — the beat that sells the hit
        pzStepWorld(bodies, [], 0, 1200, dt, { iterations: 10 });
        // react to a hard BALL impact: dust + trauma + hitstop
        for (const b of bodies) {
            if (b.tag !== 'ball' || b.impact < BIG) continue;
            if (dustCb.checked) pzDustBurst(dust, b.pos.x, b.pos.y, 8, '#caa23a');
            if (shakeCb.checked) trauma = Math.min(1, trauma + b.impact / 4000);
            if (stopCb.checked && b.impact > BIG * 3) hitstop = Math.max(hitstop, 3);
        }
        trauma = Math.max(0, trauma - dt * 1.6);
        pzDustStep(dust, dt);
        pointer.endFrame();
    }
    function render() {
        ctx.save();
        if (shakeCb.checked && trauma > 0) {
            const s = trauma * trauma * 16;
            ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
        }
        clearCanvas(ctx, W, H, PZ.bg);
        for (const b of bodies) {
            if (b.isStatic) pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
            else if (b.tag === 'ball') pzDrawPoly(ctx, b, PZ.ball, '#3fae8e');
            else pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
        }
        pzDustDraw(ctx, dust);
        if (pointer.isDown && pointer.start) { ctx.strokeStyle = PZ.aim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pointer.start.x, pointer.start.y); ctx.lineTo(pointer.pos.x, pointer.pos.y); ctx.stroke(); }
        ctx.restore();
        hud.textContent = `drag to fling a ball · dust ${dustCb.checked ? 'on' : 'off'} · shake ${shakeCb.checked ? 'on' : 'off'} · hitstop ${stopCb.checked ? 'on' : 'off'}`;
    }
    pzLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — demolishDemo  (CAPSTONE: "Demolition")
// Everything together: a tower of blocks (the brittle ones shatter on a hard hit),
// a wrecking-ball slingshot with a limited budget, dust + shake juice, and a goal:
// bring the WHOLE tower down below the red line. Three shots.
// =============================================================================
(function demolishDemo() {
    const canvas = document.getElementById('pzDemolishCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pointer = pzInstallPointer(canvas);
    const hud = document.getElementById('pzDemolishHud');
    const dust = [];
    const anchor = { x: 80, y: H - 80 };
    const lineY = H - 64;           // bring the structure below this line to win
    const WRECK_SPEED = 200;        // a wrecking ball faster than this shatters brittle blocks it touches
    const MAX_PULL = 150, POWER = 12;

    let bodies, shots, trauma, won;
    function reset() {
        bodies = pzArenaBodies(W, H);
        // a stable 2-wide × 3-tall wall (two columns lean together); the orange
        // blocks are brittle and shatter on a hard hit, the gold ones just topple.
        const ft = H - 6, w = 58, h = 42, cx = W * 0.66;
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < 2; c++) {
                const brittle = (r + c) % 2 === 1;
                bodies.push(new PZRigidBody(cx + (c - 0.5) * w, ft - h / 2 - r * h, pzBoxVerts(w - 2, h - 1), {
                    friction: 0.8, restitution: 0.03, color: brittle ? '#b8743b' : PZ.target, tag: brittle ? 'brittle' : 'block',
                }));
            }
        shots = 3; trauma = 0; won = false; dust.length = 0;
    }
    reset();
    document.getElementById('pzDemolishReset').addEventListener('click', reset);

    function update(dt) {
        if (pointer.justReleased && pointer.releaseStart && shots > 0 && !won) {
            const pull = new Vector2D(pointer.releaseEnd.x - anchor.x, pointer.releaseEnd.y - anchor.y);
            pull.limit(MAX_PULL);
            const ball = new PZRigidBody(anchor.x, anchor.y, pzRegularVerts(12, 21), { density: 0.04, restitution: 0.25, friction: 0.3, color: PZ.ball, tag: 'wreck' });
            ball.vel.set(-pull.x * POWER, -pull.y * POWER);
            bodies.push(ball); shots--;
        }
        pzStepWorld(bodies, [], 0, 1200, dt, { iterations: 11 });
        // shatter a brittle block when a FAST wrecking ball is touching it — a real
        // hit, not resting load (a stacked brittle block's big resting impact would
        // falsely "break" it on an absolute threshold).
        for (let i = bodies.length - 1; i >= 0; i--) {
            const b = bodies[i];
            if (b.tag !== 'brittle') continue;
            let hit = false;
            for (const wb of bodies) { if (wb.tag === 'wreck' && wb.vel.length() > WRECK_SPEED && pzPolyVsPoly(b, wb)) { hit = true; break; } }
            if (hit) {
                const frags = pzFractureBody(b, 5, { kick: 70, color: '#b8743b' });
                bodies.splice(i, 1, ...frags);
                pzDustBurst(dust, b.pos.x, b.pos.y, 16, '#caa');
                trauma = Math.min(1, trauma + 0.6);
            }
        }
        trauma = Math.max(0, trauma - dt * 1.6);
        pzDustStep(dust, dt);
        // win: at most one structural piece left standing above the line
        const standing = bodies.filter(b => (b.tag === 'block' || b.tag === 'brittle' || b.tag === 'debris') && b.pos.y < lineY);
        if (standing.length <= 1) won = true;
        pointer.endFrame();
    }
    function render() {
        ctx.save();
        if (trauma > 0) { const s = trauma * trauma * 14; ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s); }
        clearCanvas(ctx, W, H, PZ.bg);
        // demolish line
        ctx.strokeStyle = won ? PZ.good : PZ.bad; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(W, lineY); ctx.stroke(); ctx.setLineDash([]);
        for (const b of bodies) {
            if (b.isStatic) pzDrawPoly(ctx, b, PZ.wall, '#2b3350');
            else if (b.tag === 'wreck') pzDrawPoly(ctx, b, PZ.ball, '#3fae8e');
            else if (b.tag === 'brittle' || (b.tag === 'debris')) pzDrawPoly(ctx, b, '#b8743b', '#6e4423');
            else pzDrawPoly(ctx, b, PZ.target, '#8a6a1a');
        }
        pzDustDraw(ctx, dust);
        // slingshot aim
        if (pointer.isDown && pointer.start && shots > 0 && !won) {
            const pull = new Vector2D(pointer.pos.x - anchor.x, pointer.pos.y - anchor.y); pull.limit(MAX_PULL);
            ctx.strokeStyle = PZ.aim; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(anchor.x, anchor.y); ctx.lineTo(anchor.x + pull.x, anchor.y + pull.y); ctx.stroke();
        }
        ctx.fillStyle = PZ.anchor; ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        const above = bodies.filter(b => (b.tag === 'block' || b.tag === 'brittle' || b.tag === 'debris') && b.pos.y < lineY).length;
        if (won) hud.innerHTML = `<span style="color:${PZ.good}">🏆 Demolished!</span> Tower cleared below the line. Reset to play again.`;
        else if (shots === 0) hud.innerHTML = `<span style="color:${PZ.bad}">Out of shots</span> — ${above} piece(s) still standing. Reset to retry.`;
        else hud.textContent = `${above} piece(s) above the line · ${shots} wrecking ball(s) left · drag from the peg to launch`;
    }
    pzLoop(update, render).start();
})();
