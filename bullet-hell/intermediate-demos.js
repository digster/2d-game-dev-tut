// =============================================================================
// BULLET HELL — INTERMEDIATE TIER DEMOS ("Patterns Are Polar Equations")
// =============================================================================
// Seven demos, each a canvas-guarded IIFE. Teaching order — each adds one idea:
//
//   1. emitterDemo — the BHEmitter: separate WHAT fires from WHEN it fires
//   2. ringDemo    — rings & n-way fans (θ = i/n · 2π → velocities)
//   3. spiralDemo  — spin the base angle → a spiral; arms → flowers
//   4. aimedDemo   — atan2(player − emitter): a fan that hunts you
//   5. roseDemo    — r = cos(kθ): speed-modulated rings bloom into rose petals
//   6. curveDemo   — bullets that TURN and ACCELERATE (the engine's inert knobs)
//   7. stageDemo   — capstone "Pattern Stage": cycle 3 patterns on a timeline
//
// DEPENDENCIES (loaded BEFORE this file by intermediate.html):
//   ../shared/utils.js   — Vector2D (esp. Vector2D.fromAngle), clamp, clearCanvas
//   engine/loop.js       — bhLoop, bhInstallKeys
//   engine/render.js     — BH, bhMakeStars/bhUpdateStars/bhDrawStars, bhDrawField,
//                          bhDrawPlayer, bhDrawBullet
//   engine/field.js      — BHField, BHBullet
//
// SELF-CONTAINED: this file re-declares the small collision/UI helpers it needs
// (bhDist2/bhHitTest/bhGrazeTest/bhFocusHint) rather than importing them — only
// one tier's demos file loads per page, so there's no collision. BHEmitter + the
// bhFire* pattern helpers are this tier's lesson; they get PROMOTED to
// engine/emitter.js when the Advanced (boss) tier becomes their 2nd consumer.
// =============================================================================

// --- Small shared helpers (re-declared; see header) --------------------------
function bhDist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
function bhHitTest(player, bullet) {
    const r = player.radius + bullet.radius;
    return bhDist2(player.pos, bullet.pos) <= r * r;
}
function bhGrazeTest(player, bullet) {
    const d2 = bhDist2(player.pos, bullet.pos);
    const hit = player.radius + bullet.radius;
    const graze = player.grazeR + bullet.radius;
    return d2 > hit * hit && d2 <= graze * graze;
}
function bhFocusHint(ctx, bounds, focused, msg) {
    if (focused) return;
    ctx.save();
    ctx.fillStyle = 'rgba(7,10,28,0.62)';
    ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 20, bounds.w, 40);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(msg, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.restore();
}

// =============================================================================
// THE TIER'S CORE LESSON — the emitter + the pattern primitives.
// (Inline now; promoted to engine/emitter.js when Advanced reuses them.)
// =============================================================================

// A BHEmitter separates the PATTERN (a `fire` callback) from the CADENCE (an
// `interval`), and carries a base `angle` it can `spin` over time. Every pattern
// in this tier is the same emitter with a different `fire`.
class BHEmitter {
    constructor(x, y, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.interval = opts.interval ?? 0.25;   // seconds between volleys
        this.angle = opts.angle ?? 0;            // base aim, radians
        this.spin = opts.spin ?? 0;              // added to angle each second (rad/s)
        this.fire = opts.fire || (() => {});     // (emitter, field) => void
        this.enabled = opts.enabled ?? true;
        this.timer = 0;                          // counts down to the next volley
        this.volleys = 0;                        // how many volleys fired (for HUDs)
    }
    step(dt, field) {
        this.angle += this.spin * dt;            // rotate the base aim (spirals)
        if (!this.enabled) return;
        const iv = Math.max(0.001, this.interval); // guard against a 0-interval lock
        this.timer -= dt;
        // `while` + carried remainder: fire every bullet we owe this step, and
        // keep the cadence exact regardless of the timestep (the loop's trick).
        while (this.timer <= 0) {
            this.timer += iv;
            this.fire(this, field);
            this.volleys++;
        }
    }
}

// A full RING: n bullets spaced evenly around the circle. The whole pattern
// vocabulary starts here — a velocity is a polar coordinate (angle, speed).
function bhFireRing(field, em, n, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
        const a = em.angle + (i / n) * BH.TAU;   // i/n, NOT i/(n-1): no doubled bullet at 0 & 2π
        const v = Vector2D.fromAngle(a, speed);
        field.spawn(em.pos.x, em.pos.y, v.x, v.y, {
            radius: opts.radius ?? 4, color: opts.color ?? BH.bullet,
            turn: opts.turn ?? 0, accel: opts.accel ?? 0,
        });
    }
}

// A FAN: n bullets spread across `arc` radians, centered on `center`. (n/(n-1)
// here, because we DO want a bullet at each end of the arc.)
function bhFireFan(field, em, n, arc, center, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const a = center + (t - 0.5) * arc;
        const v = Vector2D.fromAngle(a, speed);
        field.spawn(em.pos.x, em.pos.y, v.x, v.y, {
            radius: opts.radius ?? 4, color: opts.color ?? BH.bullet,
            turn: opts.turn ?? 0, accel: opts.accel ?? 0,
        });
    }
}

// =============================================================================
// 1) emitterDemo — what vs. when
// =============================================================================
(function emitterDemo() {
    const canvas = document.getElementById('bhEmitCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const field = new BHField(bounds, { margin: 18 });

    const ivEl = document.getElementById('bhEmitInterval');
    const ivVal = document.getElementById('bhEmitIntervalVal');
    const nEl = document.getElementById('bhEmitN');
    const nVal = document.getElementById('bhEmitNVal');
    const toggle = document.getElementById('bhEmitToggle');
    const hud = document.getElementById('bhEmitHud');

    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, {
        interval: 0.4,
        fire: (e, f) => bhFireRing(f, e, +nEl.value, 130),
    });
    toggle.addEventListener('click', () => {
        em.enabled = !em.enabled;
        toggle.textContent = em.enabled ? '⏸ Pause' : '▶ Resume';
    });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        em.interval = +ivEl.value / 1000;     // ms → s, live from the slider
        em.step(dt, field);
        field.step(dt);
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 8, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        if (ivVal) ivVal.textContent = ivEl.value;
        if (nVal) nVal.textContent = nEl.value;
        hud.textContent = `volleys = ${em.volleys} · live = ${field.count} · `
            + `interval = ${ivEl.value} ms · ${em.enabled ? 'firing' : 'paused'}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 2) ringDemo — rings & n-way fans
// =============================================================================
(function ringDemo() {
    const canvas = document.getElementById('bhRingCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const field = new BHField(bounds, { margin: 18 });

    const nEl = document.getElementById('bhRingN');
    const nVal = document.getElementById('bhRingNVal');
    const arcEl = document.getElementById('bhRingArc');
    const arcVal = document.getElementById('bhRingArcVal');
    const spdEl = document.getElementById('bhRingSpeed');
    const hud = document.getElementById('bhRingHud');

    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, {
        interval: 0.55, angle: Math.PI / 2, // fans aim downward by default
        fire: (e, f) => {
            const n = +nEl.value, speed = +spdEl.value;
            const arcDeg = +arcEl.value;
            if (arcDeg >= 360) bhFireRing(f, e, n, speed, { color: BH.bullet });
            else bhFireFan(f, e, n, arcDeg * Math.PI / 180, e.angle, speed, { color: BH.bulletGold });
        },
    });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        em.step(dt, field);
        field.step(dt);
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 8, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        if (nVal) nVal.textContent = nEl.value;
        if (arcVal) arcVal.textContent = +arcEl.value >= 360 ? 'full ring' : arcEl.value + '°';
        hud.textContent = `${+arcEl.value >= 360 ? 'RING' : 'FAN'} of ${nEl.value} · `
            + `each bullet vel = fromAngle(θ) · speed · live = ${field.count}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 3) spiralDemo — spin the base angle
// =============================================================================
(function spiralDemo() {
    const canvas = document.getElementById('bhSpiralCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const field = new BHField(bounds, { margin: 18 });

    const armsEl = document.getElementById('bhSpiralArms');
    const armsVal = document.getElementById('bhSpiralArmsVal');
    const spinEl = document.getElementById('bhSpiralSpin');
    const spinVal = document.getElementById('bhSpiralSpinVal');
    const hud = document.getElementById('bhSpiralHud');

    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, {
        interval: 0.05,
        fire: (e, f) => {
            const arms = +armsEl.value;
            // Fire `arms` bullets evenly around the circle FROM THE CURRENT base
            // angle. Because the base angle has rotated a hair since the last
            // volley, consecutive volleys trace out smooth spiral arms.
            for (let k = 0; k < arms; k++) {
                const a = e.angle + (k / arms) * BH.TAU;
                const v = Vector2D.fromAngle(a, 140);
                f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue });
            }
        },
    });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        em.spin = +spinEl.value * Math.PI / 180; // deg/s → rad/s
        em.step(dt, field);
        field.step(dt);
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 8, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        if (armsVal) armsVal.textContent = armsEl.value;
        if (spinVal) spinVal.textContent = spinEl.value + '°/s';
        hud.textContent = `${armsEl.value} arm(s) · spin ${spinEl.value}°/s · `
            + `a spiral is a ring whose base angle rotates · live = ${field.count}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 4) aimedDemo — atan2(player − emitter): a fan that hunts you
// =============================================================================
(function aimedDemo() {
    const canvas = document.getElementById('bhAimedCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;
    const stars = bhMakeStars(bounds, 50);
    const field = new BHField(bounds, { margin: 18 });
    const keys = bhInstallKeys(canvas);
    const player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
    const FULL = 250, FOCUS = 110;

    const nEl = document.getElementById('bhAimedN');
    const nVal = document.getElementById('bhAimedNVal');
    const arcEl = document.getElementById('bhAimedArc');
    const arcVal = document.getElementById('bhAimedArcVal');
    const hud = document.getElementById('bhAimedHud');
    let grazes = 0;

    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + 34, {
        interval: 0.3,
        fire: (e, f) => {
            // Aim straight at the player: the angle from the emitter to the ship.
            const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
            bhFireFan(f, e, +nEl.value, +arcEl.value * Math.PI / 180, aim, 175);
        },
    });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        player.focused = keys.focus;
        player.pos.add(keys.moveDir().multiply((keys.focus ? FOCUS : FULL) * dt));
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);
        em.step(dt, field);
        field.step(dt);
        for (const b of field.bullets) if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; grazes++; }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 9, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · the fan tracks you');
        if (nVal) nVal.textContent = nEl.value;
        if (arcVal) arcVal.textContent = arcEl.value + '°';
        hud.innerHTML = `aim = atan2(player − emitter) · grazes = <b style="color:#7CF2C8">${grazes}</b> · live = ${field.count}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 5) roseDemo — r = cos(kθ): speed-modulated rings bloom into petals
// =============================================================================
(function roseDemo() {
    const canvas = document.getElementById('bhRoseCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 40);
    const field = new BHField(bounds, { margin: 18 });

    const kEl = document.getElementById('bhRoseK');
    const kVal = document.getElementById('bhRoseKVal');
    const layerCb = document.getElementById('bhRoseLayer');
    const hud = document.getElementById('bhRoseHud');
    const N = 44;

    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, {
        interval: 0.32,
        fire: (e, f) => {
            const k = +kEl.value;
            // Fire a ring of N bullets, but MODULATE each bullet's speed by the
            // rose-curve radius r = |cos(kθ)|. Slow bullets cluster where r→0 and
            // fast ones race out where r→1, so the expanding ring traces petals.
            for (let i = 0; i < N; i++) {
                const a = e.angle + (i / N) * BH.TAU;
                const r = Math.abs(Math.cos(k * a));
                const speed = 50 + 170 * r;
                const v = Vector2D.fromAngle(a, speed);
                f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 3.5, color: BH.bullet });
            }
            if (layerCb.checked) {
                // A second, counter-rotated layer at a different k → interference.
                for (let i = 0; i < N; i++) {
                    const a = -e.angle + (i / N) * BH.TAU;
                    const r = Math.abs(Math.cos((k + 1) * a));
                    const speed = 50 + 170 * r;
                    const v = Vector2D.fromAngle(a, speed);
                    f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 3.5, color: BH.bulletBlue });
                }
            }
        },
    });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        em.spin = 0.5; // slow drift so the petals rotate
        em.step(dt, field);
        field.step(dt);
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 7, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        if (kVal) kVal.textContent = kEl.value;
        const petals = (+kEl.value) % 2 === 0 ? (2 * +kEl.value) : +kEl.value;
        hud.innerHTML = `r = |cos(${kEl.value}·θ)| → <b>${petals}</b> petals`
            + ` · live = ${field.count}${layerCb.checked ? ' · 2 layers (interference)' : ''}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 6) curveDemo — bullets that TURN and ACCELERATE
// =============================================================================
(function curveDemo() {
    const canvas = document.getElementById('bhCurveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;
    const stars = bhMakeStars(bounds, 50);
    const field = new BHField(bounds, { margin: 26 });
    const keys = bhInstallKeys(canvas);
    const player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
    const FULL = 250, FOCUS = 110;

    const turnEl = document.getElementById('bhCurveTurn');
    const turnVal = document.getElementById('bhCurveTurnVal');
    const accelEl = document.getElementById('bhCurveAccel');
    const accelVal = document.getElementById('bhCurveAccelVal');
    const hud = document.getElementById('bhCurveHud');
    let grazes = 0;

    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + 36, {
        interval: 0.07, spin: 1.1, // sweep the aim so the curving reads as a whip
        fire: (e, f) => {
            const turn = +turnEl.value * Math.PI / 180; // deg/s → rad/s on the heading
            const accel = +accelEl.value;               // px/s² along the heading
            const v = Vector2D.fromAngle(e.angle, 150);
            // The engine's inert per-bullet knobs finally switched on: BHField.step
            // rotates vel by `turn·dt` and rescales it by `accel·dt` every step.
            f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletLime, turn, accel });
        },
    });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        player.focused = keys.focus;
        player.pos.add(keys.moveDir().multiply((keys.focus ? FOCUS : FULL) * dt));
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);
        em.step(dt, field);
        field.step(dt);
        for (const b of field.bullets) if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; grazes++; }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 9, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · dodge the whips');
        if (turnVal) turnVal.textContent = turnEl.value + '°/s';
        if (accelVal) accelVal.textContent = accelEl.value;
        hud.innerHTML = `turn = ${turnEl.value}°/s · accel = ${accelEl.value} px/s² · `
            + `grazes = <b style="color:#7CF2C8">${grazes}</b>`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 7) stageDemo — capstone "Pattern Stage": cycle 3 patterns on a timeline
// =============================================================================
(function stageDemo() {
    const canvas = document.getElementById('bhStageCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;
    const stars = bhMakeStars(bounds, 60);
    const field = new BHField(bounds, { margin: 22 });
    const keys = bhInstallKeys(canvas);
    const FULL = 250, FOCUS = 110;

    const hud = document.getElementById('bhStageHud');
    let player, em, phaseIdx, phaseTime, score, hitFlash;

    // A hand-written "timeline": three named patterns, each for `dur` seconds.
    // This is exactly what the Advanced tier formalizes into spell-card DATA.
    const PHASES = [
        {
            name: 'Ring Burst', dur: 4, interval: 0.5, spin: 0,
            fire: (e, f) => bhFireRing(f, e, 20, 115, { color: BH.bullet }),
        },
        {
            name: 'Aimed Fan', dur: 4.5, interval: 0.24, spin: 0,
            fire: (e, f) => {
                const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                bhFireFan(f, e, 7, 0.7, aim, 165, { color: BH.bulletGold });
            },
        },
        {
            name: 'Twin Spiral', dur: 5, interval: 0.05, spin: 2.3,
            fire: (e, f) => {
                for (let k = 0; k < 2; k++) {
                    const a = e.angle + (k / 2) * BH.TAU;
                    const v = Vector2D.fromAngle(a, 140);
                    f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue });
                }
            },
        },
    ];

    function applyPhase(i) {
        const p = PHASES[i];
        em.interval = p.interval; em.spin = p.spin; em.fire = p.fire;
        em.timer = 0; em.angle = -Math.PI / 2; // reset aim to "up" for a clean start
        field.clear();                          // screen-clear between patterns (a preview of phases)
    }

    function reset() {
        player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
        em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + 40, {});
        phaseIdx = 0; phaseTime = 0; score = 0; hitFlash = 0;
        applyPhase(0);
    }
    reset();
    document.getElementById('bhStageReset').addEventListener('click', reset);

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);

        phaseTime += dt;
        if (phaseTime >= PHASES[phaseIdx].dur) {
            phaseTime = 0;
            phaseIdx = (phaseIdx + 1) % PHASES.length;
            applyPhase(phaseIdx);
        }

        player.focused = keys.focus;
        player.pos.add(keys.moveDir().multiply((keys.focus ? FOCUS : FULL) * dt));
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);

        em.step(dt, field);
        field.step(dt);
        hitFlash = Math.max(0, hitFlash - dt);
        for (let i = field.bullets.length - 1; i >= 0; i--) {
            const b = field.bullets[i];
            if (bhHitTest(player, b)) { hitFlash = 0.3; score = Math.max(0, score - 300); field.bullets.splice(i, 1); continue; }
            if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; score += 100; }
        }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 10, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        bhDrawPlayer(ctx, player);
        if (hitFlash > 0) { ctx.fillStyle = `rgba(239,83,80,${(hitFlash * 1.3).toFixed(2)})`; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h); }
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · dodge the rotation of patterns');

        const p = PHASES[phaseIdx];
        const left = Math.max(0, p.dur - phaseTime).toFixed(1);
        hud.innerHTML = `pattern <b style="color:#4fc3f7">${p.name}</b> (${left}s) · `
            + `score <b style="color:#7CF2C8">${score}</b> · graze +100 / hit −300`;
    }
    bhLoop(update, render).start();
})();
