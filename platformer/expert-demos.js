// =============================================================================
// PLATFORMER — EXPERT TIER DEMOS ("Camera, Parallax & Juice")
// =============================================================================
// The level is finally bigger than the screen, so we need a camera — and once a
// camera exists, "juice" (the feedback layer that sells every action) becomes
// possible. The character controller is engine/player.js; everything NEW here is
// taught INLINE as top-level, console-testable helpers:
//
//   • Camera        — follow (lerp + deadzone + look-ahead) + trauma screen shake
//                     + world-bounds clamp. The flagged promotion candidate for
//                     engine/camera.js once the Simulations capstone reuses it.
//   • ParticleField — a tiny pooled-ish particle system (dust, landing puffs).
//   • pfDrawCharacter — an animation state machine drawn as procedural limbs.
//   • drawParallax  — layered backgrounds scrolling at fractions of camera speed.
//
//   1. cameraDemo    — rigid vs lerp, deadzone, look-ahead (with a world minimap)
//   2. shakeDemo     — trauma-based screen shake
//   3. parallaxDemo  — multi-layer parallax scrolling
//   4. animDemo      — the player FSM driving a procedurally-animated character
//   5. particlesDemo — run dust + landing puffs
//   6. juiceLabDemo  — capstone: a scrolling level with ALL the juice, on a toggle
//
// DEPENDENCIES (loaded BEFORE this file by expert.html):
//   ../shared/utils.js  — clearCanvas, clamp, lerp
//   engine/tilemap.js   — PFTile, TileMap, PF, drawTileMap
//   engine/physics.js   — AABB, moveAndCollide
//   engine/input.js     — pfInstallKeys, pfLoop
//   engine/player.js    — PlayerBody, JUICED_CFG, PF_STATE_COLOR, pfDrawBody
//
// COLLISION NOTE: new top-level names — Camera, ParticleField, pfDrawCharacter,
// drawParallax, pfFocusHint, pfBar — are clear of shared/utils.js & the engine.
// CAMERA-SPACE CONVENTION: clearCanvas → draw parallax (screen space) →
// ctx.translate(-cam.originX, -cam.originY) → draw world (tiles + entities in
// world coords) → restore → draw HUD/overlays (screen space).
// =============================================================================

(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// =============================================================================
// Camera — the heart of this tier. Holds a world-space top-left (x,y); follow()
// eases it toward the target with optional deadzone + look-ahead; addTrauma() +
// updateShake() layer a decaying screen shake on top; originX/originY are the
// final integer offsets the renderer translates by.
// =============================================================================
class Camera {
    constructor(viewW, viewH, worldW, worldH) {
        this.viewW = viewW; this.viewH = viewH;
        this.worldW = worldW; this.worldH = worldH;
        this.x = 0; this.y = 0;
        this.trauma = 0; this.shakeTime = 0; this.shakeX = 0; this.shakeY = 0;
    }
    // ease toward the target. opts: { smoothMs, deadzoneW, deadzoneH, lookAhead, lookDir }
    follow(tx, ty, dt, opts = {}) {
        const la = (opts.lookAhead || 0) * (opts.lookDir || 0);
        const fx = tx + la;
        let goalX, goalY;
        if (opts.deadzoneW) {
            const sx = fx - this.x, half = opts.deadzoneW / 2, mid = this.viewW / 2;
            if (sx < mid - half) goalX = fx - (mid - half);
            else if (sx > mid + half) goalX = fx - (mid + half);
            else goalX = this.x;                          // inside the deadzone → hold
        } else { goalX = fx - this.viewW / 2; }
        if (opts.deadzoneH) {
            const sy = ty - this.y, half = opts.deadzoneH / 2, mid = this.viewH / 2;
            if (sy < mid - half) goalY = ty - (mid - half);
            else if (sy > mid + half) goalY = ty - (mid + half);
            else goalY = this.y;
        } else { goalY = ty - this.viewH / 2; }
        // frame-rate-correct smoothing: 99% of the gap closed in smoothMs
        const a = opts.smoothMs > 0 ? 1 - Math.exp((Math.log(0.01) / (opts.smoothMs / 1000)) * dt) : 1;
        this.x += (goalX - this.x) * a;
        this.y += (goalY - this.y) * a;
        this.x = clamp(this.x, 0, Math.max(0, this.worldW - this.viewW));
        this.y = clamp(this.y, 0, Math.max(0, this.worldH - this.viewH));
    }
    addTrauma(t) { this.trauma = clamp(this.trauma + t, 0, 1); }
    updateShake(dt, maxOffset = 12, decay = 1.5) {
        this.shakeTime += dt;
        const s = this.trauma * this.trauma;              // quadratic: small trauma stays calm
        this.shakeX = maxOffset * s * (Math.sin(this.shakeTime * 47) + 0.5 * Math.sin(this.shakeTime * 111));
        this.shakeY = maxOffset * s * (Math.sin(this.shakeTime * 57 + 1.7) + 0.5 * Math.sin(this.shakeTime * 93));
        this.trauma = Math.max(0, this.trauma - decay * dt);
    }
    get originX() { return Math.round(this.x + this.shakeX); }
    get originY() { return Math.round(this.y + this.shakeY); }
}

// =============================================================================
// ParticleField — a fixed-cap particle system. Cheap rects with velocity, a bit
// of gravity, and a life that fades alpha. (Real pooling is the Simulations tier;
// here the cap + shift is enough.)
// =============================================================================
class ParticleField {
    constructor(cap = 260) { this.ps = []; this.cap = cap; }
    spawn(p) { if (this.ps.length >= this.cap) this.ps.shift(); p.t = 0; this.ps.push(p); }
    burst(x, y, n, opts) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = (opts.speed || 80) * (0.4 + Math.random() * 0.6);
            this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
                g: opts.g ?? 240, life: (opts.life || 0.4) * (0.6 + Math.random() * 0.6),
                size: opts.size || 3, color: opts.color || PF.dim });
        }
    }
    update(dt) {
        for (const p of this.ps) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        this.ps = this.ps.filter(p => p.t < p.life);
    }
    draw(ctx) {
        for (const p of this.ps) {
            ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }
    get count() { return this.ps.length; }
}

// =============================================================================
// pfDrawCharacter — the animation FSM made visible: the SAME state the controller
// computes (idle/run/jump/fall/land/wall/dash) selects a pose; `phase` advances
// limbs over time. Asset-free: head + torso + two legs + two arms as shapes.
// Drawn anchored at the feet (footX, footY) in whatever space the ctx is in.
// =============================================================================
function pfDrawCharacter(ctx, footX, footY, state, phase, facing, squash = 1) {
    const sq = clamp(squash, 0.6, 1.4);
    const H = 30 * sq, w = 16 / sq;
    const hipY = footY - H * 0.45, headR = 6;
    const col = PF_STATE_COLOR[state] || PF.player;
    ctx.save();
    ctx.translate(footX, footY);
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = col;
    // legs
    let lA = 0, lB = 0;
    if (state === 'run') { lA = Math.sin(phase) * 8; lB = -Math.sin(phase) * 8; }
    else if (state === 'jump') { lA = lB = -5; }
    else if (state === 'fall') { lA = 5; lB = -5; }
    else if (state === 'land') { lA = lB = 0; }
    ctx.beginPath(); ctx.moveTo(0, -H * 0.45); ctx.lineTo(lA, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -H * 0.45); ctx.lineTo(lB, 0); ctx.stroke();
    // torso
    ctx.beginPath(); ctx.moveTo(0, -H * 0.45); ctx.lineTo(0, -H + headR); ctx.stroke();
    // arms
    let aSwing = state === 'run' ? Math.sin(phase) * 7 : (state === 'jump' ? -7 : (state === 'wall' ? -4 : 3 + Math.sin(phase * 0.3)));
    const armY = -H * 0.78;
    ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(facing * 6, armY + aSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, armY); ctx.lineTo(-facing * 6, armY - aSwing); ctx.stroke();
    // head
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, -H + headR - 1, headR, 0, Math.PI * 2); ctx.fill();
    // facing eye
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(facing * 2 - 1, -H + headR - 3, 2, 2);
    ctx.restore();
}

// =============================================================================
// drawParallax — layered backgrounds. Each layer scrolls at `factor` × the
// camera's x (0 = painted on the glass, 1 = moves with the world). Different
// factors = depth. Drawn in SCREEN space (before the world translate).
// =============================================================================
const PF_PARALLAX = [
    { factor: 0.15, color: '#1b2236', top: 0.45, amp: 26, span: 220 },  // far ridge
    { factor: 0.38, color: '#222b45', top: 0.58, amp: 34, span: 170 },  // mid hills
    { factor: 0.66, color: '#2b3550', top: 0.72, amp: 30, span: 120 },  // near hills
];
function drawParallax(ctx, camX, viewW, viewH, on) {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, '#10162a'); g.addColorStop(1, '#0d1117');
    ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
    for (const L of PF_PARALLAX) {
        const factor = on ? L.factor : 1;               // off ⇒ every layer moves with the world (flat)
        const off = -(camX * factor);
        const baseY = viewH * L.top;
        ctx.fillStyle = L.color;
        ctx.beginPath();
        ctx.moveTo(0, viewH);
        // a run of triangular hills, wrapped so it tiles across the view
        const start = Math.floor(-off / L.span) * L.span + off;
        for (let x = start - L.span; x < viewW + L.span; x += L.span) {
            ctx.lineTo(x, baseY);
            ctx.lineTo(x + L.span / 2, baseY - L.amp);
            ctx.lineTo(x + L.span, baseY);
        }
        ctx.lineTo(viewW, viewH); ctx.closePath(); ctx.fill();
    }
}

// ---- per-tier UI helpers ----------------------------------------------------
function pfFocusHint(ctx, w, h, focused) {
    if (focused) return;
    ctx.fillStyle = 'rgba(13,17,23,0.6)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9d1d9'; ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶ click here, then use the keyboard', w / 2, h / 2);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}
function pfBar(ctx, x, y, w, frac, color, label) {
    ctx.fillStyle = PF.dim; ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), 7);
    if (label) { ctx.fillStyle = PF.text; ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(label, x, y - 4); }
}

// Build a wide scrolling test level (used by camera / parallax / juice demos).
function pfWideLevel(cols, rows, TS) {
    const m = new TileMap(cols, rows, TS, PFTile.EMPTY);
    m.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    m.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    m.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    // scattered platforms + a couple of steps so there's something to chase
    m.fillRect(6, rows - 4, 9, rows - 4, PFTile.SOLID);
    m.fillRect(13, rows - 6, 16, rows - 6, PFTile.SOLID);
    m.fillRect(20, rows - 3, 24, rows - 3, PFTile.SOLID);
    m.fillRect(28, rows - 5, 31, rows - 5, PFTile.SOLID);
    m.fillRect(34, rows - 7, 37, rows - 7, PFTile.SOLID);
    m.fillRect(40, rows - 2, cols - 6, rows - 2, PFTile.SOLID);
    return m;
}

// =============================================================================
// DEMO 1 — cameraDemo : FOLLOW, DEADZONE, LOOK-AHEAD
// =============================================================================
(function cameraDemo() {
    const canvas = document.getElementById('pfCameraCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = 48, rows = Math.floor(H / TS);
    const map = pfWideLevel(cols, rows, TS);
    const worldW = cols * TS, worldH = rows * TS;
    const body = new PlayerBody(map, 3 * TS, (rows - 3) * TS, JUICED_CFG);
    const cam = new Camera(W, H, worldW, worldH);
    const input = pfInstallKeys(canvas);

    const smoothEl = document.getElementById('pfCamSmooth');
    const smoothVal = document.getElementById('pfCamSmoothVal');
    const dzEl = document.getElementById('pfCamDeadzone');
    const laEl = document.getElementById('pfCamLook');
    const hud = document.getElementById('pfCameraHud');
    document.getElementById('pfCameraReset').addEventListener('click', () => { body.respawn(); cam.x = 0; cam.y = 0; canvas.focus(); });

    function update(dt) {
        body.update(dt, input);
        if (body.box.top > worldH + 60) body.respawn();
        cam.follow(body.box.cx, body.box.cy, dt, {
            smoothMs: +smoothEl.value,
            deadzoneW: dzEl.checked ? 180 : 0,
            deadzoneH: dzEl.checked ? 120 : 0,
            lookAhead: laEl.checked ? 110 : 0,
            lookDir: body.facing,
        });
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        ctx.save();
        ctx.translate(-cam.originX, -cam.originY);
        drawTileMap(ctx, map, { cullToCanvas: false });
        pfDrawBody(ctx, body);
        ctx.restore();
        // deadzone overlay (screen space)
        if (dzEl.checked) {
            ctx.strokeStyle = 'rgba(255,167,38,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
            ctx.strokeRect((W - 180) / 2, (H - 120) / 2, 180, 120); ctx.setLineDash([]);
        }
        // world minimap inset (top-right)
        const mw = 120, mh = mw * worldH / worldW, mx = W - mw - 10, my = 10, sc = mw / worldW;
        ctx.fillStyle = 'rgba(13,17,23,0.8)'; ctx.fillRect(mx, my, mw, mh);
        ctx.strokeStyle = PF.dim; ctx.strokeRect(mx, my, mw, mh);
        ctx.fillStyle = PF.player; ctx.fillRect(mx + body.box.cx * sc - 1, my + body.box.cy * sc - 1, 3, 3);
        ctx.strokeStyle = PF.accent; ctx.strokeRect(mx + cam.x * sc, my + cam.y * sc, W * sc, H * sc);
        pfFocusHint(ctx, W, H, input.focused);
        if (smoothVal) smoothVal.textContent = smoothEl.value;
        hud.textContent = `smoothing ${smoothEl.value}ms ${+smoothEl.value === 0 ? '(rigid)' : ''} · deadzone ${dzEl.checked ? 'on' : 'off'} · look-ahead ${laEl.checked ? 'on' : 'off'} · run to scroll`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — shakeDemo : TRAUMA-BASED SCREEN SHAKE
// =============================================================================
(function shakeDemo() {
    const canvas = document.getElementById('pfShakeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID); map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(7, rows - 4, 12, rows - 4, PFTile.SOLID);
    const body = new PlayerBody(map, 4 * TS, (rows - 2) * TS, JUICED_CFG);
    const cam = new Camera(W, H, W, H);
    const input = pfInstallKeys(canvas);

    const maxEl = document.getElementById('pfShakeMax');
    const maxVal = document.getElementById('pfShakeMaxVal');
    const hud = document.getElementById('pfShakeHud');
    document.getElementById('pfShakeSmall').addEventListener('click', () => { cam.addTrauma(0.35); canvas.focus(); });
    document.getElementById('pfShakeBig').addEventListener('click', () => { cam.addTrauma(0.8); canvas.focus(); });
    document.getElementById('pfShakeReset').addEventListener('click', () => { body.respawn(); cam.trauma = 0; canvas.focus(); });

    let wasGround = true;
    function update(dt) {
        const prevVy = body.vy;
        body.update(dt, input);
        if (body.onGround && !wasGround && prevVy > 520) cam.addTrauma(0.5); // hard landing
        wasGround = body.onGround;
        cam.updateShake(dt, +maxEl.value);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        ctx.save(); ctx.translate(-cam.originX, -cam.originY);
        drawTileMap(ctx, map, { cullToCanvas: false });
        pfDrawBody(ctx, body);
        ctx.restore();
        pfBar(ctx, 12, 16, 140, cam.trauma, cam.trauma > 0.6 ? PF.bad : PF.warn, `trauma ${cam.trauma.toFixed(2)} → shake = trauma² = ${(cam.trauma * cam.trauma).toFixed(2)}`);
        pfFocusHint(ctx, W, H, input.focused);
        if (maxVal) maxVal.textContent = maxEl.value;
        hud.textContent = `add trauma with the buttons (or land hard) · note shake = trauma², so it dies off smoothly`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — parallaxDemo : LAYERED SCROLLING BACKGROUNDS
// =============================================================================
(function parallaxDemo() {
    const canvas = document.getElementById('pfParallaxCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = 48, rows = Math.floor(H / TS);
    const map = pfWideLevel(cols, rows, TS);
    const worldW = cols * TS, worldH = rows * TS;
    const body = new PlayerBody(map, 3 * TS, (rows - 3) * TS, JUICED_CFG);
    const cam = new Camera(W, H, worldW, worldH);
    const input = pfInstallKeys(canvas);
    const onEl = document.getElementById('pfParallaxOn');
    const hud = document.getElementById('pfParallaxHud');
    document.getElementById('pfParallaxReset').addEventListener('click', () => { body.respawn(); cam.x = 0; canvas.focus(); });

    function update(dt) {
        body.update(dt, input);
        if (body.box.top > worldH + 60) body.respawn();
        cam.follow(body.box.cx, body.box.cy, dt, { smoothMs: 120, deadzoneW: 140, lookAhead: 90, lookDir: body.facing });
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawParallax(ctx, cam.x, W, H, onEl.checked);
        ctx.save(); ctx.translate(-cam.originX, -cam.originY);
        drawTileMap(ctx, map, { cullToCanvas: false });
        pfDrawBody(ctx, body);
        ctx.restore();
        pfFocusHint(ctx, W, H, input.focused);
        hud.textContent = onEl.checked
            ? `parallax ON — layer factors ${PF_PARALLAX.map(l => l.factor).join(' / ')} (far→near). Run and watch the layers separate into depth.`
            : `parallax OFF — every layer moves with the world (factor 1), so the background looks flat & painted-on.`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — animDemo : THE STATE MACHINE DRIVES THE ANIMATION
// =============================================================================
(function animDemo() {
    const canvas = document.getElementById('pfAnimCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID); map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(8, rows - 4, 12, rows - 4, PFTile.SOLID);
    const body = new PlayerBody(map, 5 * TS, (rows - 2) * TS, JUICED_CFG);
    const input = pfInstallKeys(canvas);
    const hud = document.getElementById('pfAnimHud');
    document.getElementById('pfAnimReset').addEventListener('click', () => { body.respawn(); phase = 0; canvas.focus(); });

    let phase = 0;
    function update(dt) {
        body.update(dt, input);
        // animation phase advances faster the faster you run; idle ticks slowly
        const speed = body.state === 'run' ? 6 + Math.abs(body.vx) * 0.03 : 3;
        phase += speed * dt;
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawCharacter(ctx, body.box.cx, body.box.bottom, body.state, phase, body.facing, body.squash);
        pfFocusHint(ctx, W, H, input.focused);
        ctx.fillStyle = PF_STATE_COLOR[body.state] || PF.text;
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(body.state.toUpperCase(), body.box.cx, body.box.top - 14); ctx.textAlign = 'start';
        hud.textContent = `state → animation clip: the same FSM the controller computes picks the pose; phase advances with dt (and with speed when running)`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — particlesDemo : RUN DUST + LANDING PUFFS
// =============================================================================
(function particlesDemo() {
    const canvas = document.getElementById('pfParticlesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, rows - 1, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID); map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(9, rows - 5, 14, rows - 5, PFTile.SOLID);
    const body = new PlayerBody(map, 4 * TS, (rows - 2) * TS, JUICED_CFG);
    const input = pfInstallKeys(canvas);
    const pf = new ParticleField();
    const onEl = document.getElementById('pfParticlesOn');
    const hud = document.getElementById('pfParticlesHud');
    document.getElementById('pfParticlesReset').addEventListener('click', () => { body.respawn(); pf.ps.length = 0; canvas.focus(); });

    let wasGround = true, dustTimer = 0;
    function update(dt) {
        const prevVy = body.vy;
        body.update(dt, input);
        if (onEl.checked) {
            // run dust: a few grains kicked up behind the feet while running on the ground
            if (body.onGround && Math.abs(body.vx) > 60) {
                dustTimer -= dt;
                if (dustTimer <= 0) {
                    dustTimer = 0.04;
                    pf.spawn({ x: body.box.cx - body.facing * 8, y: body.box.bottom - 2,
                        vx: -body.facing * (20 + Math.random() * 30), vy: -20 - Math.random() * 30,
                        g: 200, life: 0.35, size: 3, color: PF.dim });
                }
            }
            // landing puff: a ring of grains on touchdown, scaled by impact speed
            if (body.onGround && !wasGround && prevVy > 200) {
                pf.burst(body.box.cx, body.box.bottom - 2, Math.min(18, 6 + prevVy / 60), { speed: 90, up: 30, g: 260, life: 0.45, size: 3, color: PF.wallLit || '#8893b5' });
            }
        }
        wasGround = body.onGround;
        pf.update(dt);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pf.draw(ctx);
        pfDrawBody(ctx, body);
        pfFocusHint(ctx, W, H, input.focused);
        hud.textContent = onEl.checked
            ? `run for dust, land for a puff (bigger drop = bigger puff) · live particles: ${pf.count}`
            : `particles OFF — movement reads flat. Turn them on for the kick-up & impact feedback.`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — juiceLabDemo : CAPSTONE — a scrolling level with ALL the juice
// Toggle the whole feedback layer on/off and feel the SAME level go from
// "functional" to "alive": follow camera + parallax + shake + particles +
// squash-and-stretch + a frame of hitstop on hard landings.
// =============================================================================
(function juiceLabDemo() {
    const canvas = document.getElementById('pfJuiceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = 52, rows = Math.floor(H / TS);
    const map = pfWideLevel(cols, rows, TS);
    const worldW = cols * TS, worldH = rows * TS;
    map.set(cols - 6, rows - 3, PFTile.EMPTY); // (decor) keep goal area open
    const body = new PlayerBody(map, 3 * TS, (rows - 3) * TS, JUICED_CFG);
    const cam = new Camera(W, H, worldW, worldH);
    const pf = new ParticleField();
    const input = pfInstallKeys(canvas);
    const goal = new AABB((cols - 5) * TS, (rows - 4) * TS, 20, TS);

    const els = {
        cam: document.getElementById('pfJuiceCam'),
        parallax: document.getElementById('pfJuiceParallax'),
        shake: document.getElementById('pfJuiceShake'),
        particles: document.getElementById('pfJuiceParticles'),
        hitstop: document.getElementById('pfJuiceHitstop'),
    };
    const hud = document.getElementById('pfJuiceHud');
    const setAll = (on) => { for (const k in els) els[k].checked = on; canvas.focus(); };
    document.getElementById('pfJuiceAllOn').addEventListener('click', () => setAll(true));
    document.getElementById('pfJuiceAllOff').addEventListener('click', () => setAll(false));
    document.getElementById('pfJuiceReset').addEventListener('click', () => { body.respawn(); cam.x = 0; cam.trauma = 0; pf.ps.length = 0; won = false; canvas.focus(); });

    let wasGround = true, dustTimer = 0, hitstop = 0, phase = 0, won = false;
    function update(dt) {
        if (won) { input.endFrame(); return; }
        // hitstop freezes gameplay for a couple of frames; the shake still plays so the hit reads
        if (hitstop > 0) { hitstop -= dt; if (els.shake.checked) cam.updateShake(dt); input.endFrame(); return; }
        const prevVy = body.vy;
        body.update(dt, input);
        phase += (body.state === 'run' ? 6 + Math.abs(body.vx) * 0.03 : 3) * dt;
        const hardLand = body.onGround && !wasGround && prevVy > 430;
        if (hardLand) {
            if (els.shake.checked) cam.addTrauma(clamp(prevVy / 1100, 0.2, 0.7));
            if (els.particles.checked) pf.burst(body.box.cx, body.box.bottom - 2, Math.min(16, 6 + prevVy / 70), { speed: 90, up: 28, g: 260, life: 0.4, size: 3, color: PF.wallLit || '#8893b5' });
            if (els.hitstop.checked) hitstop = 0.055;
        }
        if (els.particles.checked && body.onGround && Math.abs(body.vx) > 70) {
            dustTimer -= dt; if (dustTimer <= 0) { dustTimer = 0.045; pf.spawn({ x: body.box.cx - body.facing * 8, y: body.box.bottom - 2, vx: -body.facing * 30, vy: -25, g: 200, life: 0.32, size: 3, color: PF.dim }); }
        }
        wasGround = body.onGround;
        pf.update(dt);
        if (els.cam.checked) cam.follow(body.box.cx, body.box.cy, dt, { smoothMs: 110, deadzoneW: 150, deadzoneH: 90, lookAhead: 100, lookDir: body.facing });
        else { cam.x = clamp(body.box.cx - W / 2, 0, worldW - W); cam.y = clamp(body.box.cy - H / 2, 0, worldH - H); } // rigid
        if (els.shake.checked) cam.updateShake(dt); else { cam.shakeX = cam.shakeY = 0; }
        if (body.box.top > worldH + 60) body.respawn();
        if (body.box.intersects(goal)) won = true;
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawParallax(ctx, cam.x, W, H, els.parallax.checked);
        ctx.save(); ctx.translate(-cam.originX, -cam.originY);
        drawTileMap(ctx, map, { cullToCanvas: false });
        // goal flag
        ctx.fillStyle = PF.item; ctx.fillRect(goal.x + goal.w - 3, goal.y, 3, goal.h);
        ctx.beginPath(); ctx.moveTo(goal.x + goal.w - 3, goal.y); ctx.lineTo(goal.x + goal.w - 18, goal.y + 7); ctx.lineTo(goal.x + goal.w - 3, goal.y + 14); ctx.closePath(); ctx.fill();
        pf.draw(ctx);
        pfDrawCharacter(ctx, body.box.cx, body.box.bottom, body.state, phase, body.facing, body.squash);
        ctx.restore();
        pfFocusHint(ctx, W, H, input.focused);
        if (won) {
            ctx.fillStyle = 'rgba(13,17,23,0.72)'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = PF.good; ctx.font = 'bold 28px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🏁 Reached the flag!', W / 2, H / 2 - 8);
            ctx.fillStyle = PF.text; ctx.font = '14px system-ui'; ctx.fillText('toggle the juice and run it again', W / 2, H / 2 + 18);
            ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        }
        const on = Object.keys(els).filter(k => els[k].checked);
        hud.textContent = won ? 'cleared! flip the juice off and run it again — same level, totally different feel'
            : `juice: ${on.length ? on.join(', ') : 'none (raw)'} · run right to the flag`;
    }
    pfLoop(update, render).start();
})();
