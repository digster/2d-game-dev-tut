// =============================================================================
// NETCODE — EXPERT TIER DEMOS  ("Determinism, Lockstep, Rollback, AoI")
// =============================================================================
// What this tier teaches (in order):
//   1. determinismDemo   — how a 1e-7 perturbation explodes in a chaotic
//                          system (stand-in for cross-platform float drift)
//   2. lockstepDemo      — bandwidth = O(players), not O(units). The RTS trick.
//   3. rollbackDemo      — GGPO-style predict + rewind + re-simulate, using
//                          a top-down car borrowed from racing-sim
//   4. aoiDemo           — area-of-interest filtering via spatial grid
//
// CONTINUING DISCIPLINE (from Intermediate): server-state and client-state
// are SEPARATE objects in every demo. Communication ONLY through FakeNetwork.
//
// DEPENDENCIES (loaded by the tier HTML BEFORE this file):
//   shared/utils.js, net/seeded-rng.js, net/fake-network.js
//
// Top-level names this file introduces (verified absent from shared/utils.js;
// names overlapping with sibling *-demos.js are intentional — each tier page
// loads only its own demos file):
//   NET_COLORS, MAX_DT, SIM_HZ, INPUT_TICK_HZ, WORLD_W, WORLD_H, fmtMs,
//   wrapAngle, drawPanel, drawArrow, Particle, Pendulum, Unit, RollCar,
//   rcApplyInput, rcSnapshot, rcRestore, SpatialGrid, Entity
// =============================================================================

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

// ---------------------------------------------------------------------------
// Palette + constants — same family as previous tiers.
// ---------------------------------------------------------------------------
const NET_COLORS = {
    bg:           '#0d1117',
    panel:        '#1a1f3a',
    panelEdge:    '#2d3354',
    grid:         '#252b4a',
    client:       '#4fc3f7',
    server:       '#ffa726',
    ghost:        '#66bb6a',
    correction:   '#ef5350',
    remote:       '#ba68c8',
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    accent:       '#fbc02d',
    rollback:     '#fff176',   // bright yellow for rollback-flash
    visible:      '#66bb6a',
    invisible:    '#3e4762',
};

const MAX_DT = 0.05;
const SIM_HZ = 60;
const INPUT_TICK_HZ = 30;
const WORLD_W = 360;
const WORLD_H = 240;

function fmtMs(ms) { return ms < 10 ? ms.toFixed(1) + ' ms' : Math.round(ms) + ' ms'; }
function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

// ---------------------------------------------------------------------------
// Reused drawing primitives. Same shape as previous tiers, slightly trimmed.
// ---------------------------------------------------------------------------
function drawPanel(ctx, ox, oy, w, h, label, color) {
    ctx.fillStyle = NET_COLORS.panel;
    ctx.fillRect(ox, oy, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(ox + 0.5, oy + 0.5, w - 1, h - 1);
    ctx.strokeStyle = NET_COLORS.grid; ctx.lineWidth = 1;
    for (let gx = 40; gx < w; gx += 40) {
        ctx.beginPath(); ctx.moveTo(ox + gx + 0.5, oy + 1); ctx.lineTo(ox + gx + 0.5, oy + h - 1); ctx.stroke();
    }
    for (let gy = 40; gy < h; gy += 40) {
        ctx.beginPath(); ctx.moveTo(ox + 1, oy + gy + 0.5); ctx.lineTo(ox + w - 1, oy + gy + 0.5); ctx.stroke();
    }
    ctx.fillStyle = color; ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left'; ctx.fillText(label, ox + 8, oy + 18);
}

function drawArrow(ctx, x1, y1, x2, y2, color, headLen = 8) {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(ang - 0.4), y2 - headLen * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(ang + 0.4), y2 - headLen * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
}

// =============================================================================
// DEMO 1 — determinismDemo
//
// Two double pendulums side-by-side, started from IDENTICAL initial conditions
// EXCEPT for a tiny perturbation in the second one's starting angle (slider-
// controlled, default 1e-7 rad). After enough time the two trails diverge
// dramatically — that's chaos. The teaching point: a 1-bit float difference
// between two machines (Intel vs ARM, different compiler flags, etc.) behaves
// like a tiny perturbation. In a chaotic enough simulation, the two machines
// will not agree on the world state.
//
// Real lockstep games (Demo 2) work around this by using FIXED-POINT integer
// math, which is bit-exact regardless of platform. We're not implementing
// fixed-point here — the visceral demonstration of "tiny perturbations
// explode" is the point.
// =============================================================================
(function determinismDemo() {
    const canvas = document.getElementById('determinismCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        perturb: document.getElementById('detPerturb'),
        perturbVal: document.getElementById('detPerturbVal'),
        reset: document.getElementById('detReset'),
        info: document.getElementById('detInfo'),
    };

    // Two pendulums share gravity + mass + length but differ in starting θ.
    const L1 = 60, L2 = 60, M1 = 1, M2 = 1, G = 9.81 * 40; // 40 px/m
    function newPend(theta1, theta2) {
        return { theta1, theta2, omega1: 0, omega2: 0, trail: [] };
    }
    // Slider value is the EXPONENT — actual perturbation is 10^value rad.
    // So slider=-7 means Δθ₀=1e-7. Map once here and once on slider change.
    function perturbValue() { return Math.pow(10, +els.perturb.value); }
    let a = newPend(Math.PI / 2, Math.PI / 2);
    let b = newPend(Math.PI / 2, Math.PI / 2 + perturbValue());

    function stepPend(p, dt) {
        // Standard double-pendulum equations of motion (Lagrangian — same
        // shape used in simulation-v2.html's double-pendulum demo).
        const t1 = p.theta1, t2 = p.theta2, w1 = p.omega1, w2 = p.omega2;
        const d = t1 - t2;
        const den1 = (2 * M1 + M2 - M2 * Math.cos(2 * d));
        const a1 = (-G * (2 * M1 + M2) * Math.sin(t1)
                    - M2 * G * Math.sin(t1 - 2 * t2)
                    - 2 * Math.sin(d) * M2 * (w2 * w2 * L2 + w1 * w1 * L1 * Math.cos(d))) / (L1 * den1);
        const a2 = (2 * Math.sin(d) * (w1 * w1 * L1 * (M1 + M2)
                    + G * (M1 + M2) * Math.cos(t1)
                    + w2 * w2 * L2 * M2 * Math.cos(d))) / (L2 * den1);
        p.omega1 += a1 * dt; p.omega2 += a2 * dt;
        p.theta1 += p.omega1 * dt; p.theta2 += p.omega2 * dt;
    }

    function drawPend(p, ox, oy, color) {
        const x1 = ox + Math.sin(p.theta1) * L1;
        const y1 = oy + Math.cos(p.theta1) * L1;
        const x2 = x1 + Math.sin(p.theta2) * L2;
        const y2 = y1 + Math.cos(p.theta2) * L2;
        // Trail
        if (p.trail.length === 0 || Math.hypot(p.trail[p.trail.length - 1].x - x2, p.trail[p.trail.length - 1].y - y2) > 2) {
            p.trail.push({ x: x2, y: y2 });
            if (p.trail.length > 800) p.trail.shift();
        }
        ctx.strokeStyle = color; ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < p.trail.length; i++) {
            const pt = p.trail[i];
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        // Arms
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        // Masses
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x1, y1, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x2, y2, 9, 0, Math.PI * 2); ctx.fill();
        return { x: x2, y: y2 };
    }

    function resetSim() {
        a = newPend(Math.PI / 2, Math.PI / 2);
        b = newPend(Math.PI / 2, Math.PI / 2 + perturbValue());
    }
    function updatePerturbLabel() {
        const exp = +els.perturb.value;
        // Render as "1e-7 rad" rather than the raw slider exponent.
        els.perturbVal.textContent = '1e' + (exp >= 0 ? '+' : '') + exp + ' rad';
    }
    els.reset.addEventListener('click', resetSim);
    els.perturb.addEventListener('input', () => { updatePerturbLabel(); resetSim(); });
    updatePerturbLabel();

    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;
        // Sub-step for numerical stability.
        const sub = 4;
        for (let s = 0; s < sub; s++) { stepPend(a, dt / sub); stepPend(b, dt / sub); }

        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const W = canvas.width, H = canvas.height;
        drawPanel(ctx, 20, 20, W - 40, H - 40, 'Double pendulum — identical-except-by-Δθ start', NET_COLORS.client);

        // Pivots at the top centre.
        const oxC = W / 2, oyC = 70;
        const tipA = drawPend(a, oxC, oyC, NET_COLORS.client);
        const tipB = drawPend(b, oxC, oyC, NET_COLORS.correction);

        // Divergence stat — distance between the two tips right now.
        const drift = Math.hypot(tipA.x - tipB.x, tipA.y - tipB.y);
        els.info.textContent = `Δθ₀ = ${perturbValue().toExponential(0)} rad · current tip-to-tip drift = ${drift.toFixed(1)} px`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 2 — lockstepDemo  (mini-RTS bandwidth comparison)
//
// N units flock around a draggable waypoint. Both "players" send the SAME
// kind of input (a waypoint position) at a fixed tick rate. In a lockstep
// architecture the server (or every peer) broadcasts only THAT — the actual
// unit positions are produced by every machine running the same deterministic
// simulation from the same inputs. Bandwidth = O(players), not O(units).
//
// The naive alternative — broadcast every unit's position every tick — costs
// O(N × players × tick_rate). At 200 units and 20 Hz, that's ~190 kbps per
// client. Lockstep at the same scale: ~1 kbps per client.
//
// We don't actually need a network here — the visual + bandwidth math IS the
// demo. Units flock to a waypoint via a tiny steering behaviour; user drags
// the waypoint; bars compare lockstep vs naive bandwidth in real time.
// =============================================================================
(function lockstepDemo() {
    const canvas = document.getElementById('lockstepCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        units: document.getElementById('lsUnits'),
        unitsVal: document.getElementById('lsUnitsVal'),
        tick: document.getElementById('lsTick'),
        tickVal: document.getElementById('lsTickVal'),
        reset: document.getElementById('lsReset'),
        info: document.getElementById('lsInfo'),
        lockOut: document.getElementById('lsLockOut'),
        naiveOut: document.getElementById('lsNaiveOut'),
        lockBar: document.getElementById('lsLockBar'),
        naiveBar: document.getElementById('lsNaiveBar'),
        savings: document.getElementById('lsSavings'),
    };

    const rng = new SeededRng(53);
    let waypoint = { x: WORLD_W * 0.75, y: WORLD_H * 0.5 };
    let units = [];

    function buildArmy(N) {
        units.length = 0;
        for (let i = 0; i < N; i++) {
            units.push({
                x: rng.range(20, WORLD_W * 0.4),
                y: rng.range(20, WORLD_H - 20),
                vx: 0, vy: 0,
            });
        }
    }
    function syncSliders() {
        els.unitsVal.textContent = els.units.value;
        els.tickVal.textContent = els.tick.value + ' Hz';
    }
    els.units.addEventListener('input', () => { syncSliders(); buildArmy(+els.units.value); });
    els.tick.addEventListener('input', syncSliders);
    els.reset.addEventListener('click', () => buildArmy(+els.units.value));
    syncSliders();
    buildArmy(+els.units.value);

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const ox = (canvas.width - WORLD_W) / 2;
        const oy = 30;
        waypoint.x = clamp(e.clientX - rect.left - ox, 10, WORLD_W - 10);
        waypoint.y = clamp(e.clientY - rect.top - oy, 10, WORLD_H - 10);
    });

    function recomputeBandwidth() {
        const N = +els.units.value, tick = +els.tick.value;
        // Lockstep: each player sends one waypoint per tick = 16 bytes
        // (two float32s + tiny overhead). We round to 24 B for a header.
        const lockBps = 24 * tick;
        // Naive snapshot: each unit's position = 16 bytes (two int16 or
        // quantized floats), N units, every tick.
        const naiveBps = 16 * N * tick;
        const fmt = b => {
            const kbps = b * 8 / 1000;
            if (kbps < 10) return kbps.toFixed(2) + ' kbps';
            if (kbps < 1000) return kbps.toFixed(1) + ' kbps';
            return (kbps / 1000).toFixed(2) + ' Mbps';
        };
        els.lockOut.textContent = fmt(lockBps);
        els.naiveOut.textContent = fmt(naiveBps);
        const max = Math.max(lockBps, naiveBps, 1);
        els.lockBar.style.width = (100 * lockBps / max).toFixed(1) + '%';
        els.naiveBar.style.width = (100 * naiveBps / max).toFixed(1) + '%';
        els.savings.textContent = naiveBps > 0 ? Math.round(100 * (1 - lockBps / naiveBps)) + '× smaller (lockstep)' : '—';
        els.savings.textContent = naiveBps > 0
            ? `lockstep is ${(naiveBps / Math.max(lockBps, 1)).toFixed(0)}× smaller`
            : '—';
    }

    const UNIT_SPEED = 60; const UNIT_RADIUS = 20;
    let last = performance.now();
    let bandwidthAccum = 0;

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;
        bandwidthAccum += dt;
        if (bandwidthAccum >= 0.25) { recomputeBandwidth(); bandwidthAccum = 0; }

        // Steering: each unit moves toward waypoint, but with a tiny push
        // outward from its neighbours so the army doesn't pile up on one point.
        for (const u of units) {
            const dx = waypoint.x - u.x, dy = waypoint.y - u.y;
            const d = Math.hypot(dx, dy) || 1;
            let tx = dx / d, ty = dy / d;
            // Separation
            for (const o of units) {
                if (o === u) continue;
                const ox = u.x - o.x, oy = u.y - o.y;
                const od = Math.hypot(ox, oy);
                if (od > 0 && od < UNIT_RADIUS) {
                    tx += (ox / od) * 0.5 * (UNIT_RADIUS - od) / UNIT_RADIUS;
                    ty += (oy / od) * 0.5 * (UNIT_RADIUS - od) / UNIT_RADIUS;
                }
            }
            const tmag = Math.hypot(tx, ty) || 1;
            u.vx = tx / tmag * UNIT_SPEED;
            u.vy = ty / tmag * UNIT_SPEED;
            u.x += u.vx * dt; u.y += u.vy * dt;
            u.x = clamp(u.x, 4, WORLD_W - 4); u.y = clamp(u.y, 4, WORLD_H - 4);
        }

        // Render — single panel.
        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const ox = (canvas.width - WORLD_W) / 2, oy = 30;
        drawPanel(ctx, ox, oy, WORLD_W, WORLD_H, `${units.length} units — input is one waypoint, state is implied`, NET_COLORS.ghost);

        // Units
        ctx.fillStyle = NET_COLORS.client;
        for (const u of units) {
            ctx.beginPath(); ctx.arc(ox + u.x, oy + u.y, 3, 0, Math.PI * 2); ctx.fill();
        }
        // Waypoint
        ctx.strokeStyle = NET_COLORS.accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox + waypoint.x, oy + waypoint.y, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(ox + waypoint.x, oy + waypoint.y, 2, 0, Math.PI * 2); ctx.fillStyle = NET_COLORS.accent; ctx.fill();

        els.info.textContent = `${units.length} units obeying one waypoint · tick ${els.tick.value} Hz · drag inside the panel to move the waypoint`;

        requestAnimationFrame(frame);
    }
    recomputeBandwidth();
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 3 — rollbackDemo  (GGPO-style predict + rewind + re-simulate)
//
// Two top-down cars on a small arena. Player 1 = LOCAL (WASD or pad buttons).
// Player 2 = BOT (drives via scripted input that changes periodically).
//
// Each tick the simulation needs BOTH players' inputs. The local player's
// input is known immediately. The bot's input is "remote" — it travels through
// the FakeNetwork and arrives ~RTT/2 later. To avoid waiting, the client
// PREDICTS the remote input (= same as last tick) and runs the simulation
// immediately. Each tick's full state is saved in a ring buffer.
//
// When the REAL remote input arrives for tick T, the client compares it to
// the predicted input. If they differ, the client:
//   1. restores world state to tick T
//   2. updates the buffered input for tick T to the real one
//   3. re-applies all inputs from T onward to bring the world back to current
// The user sees a brief yellow flash on the rolled-back car.
//
// HUD shows: rollback events, max rollback depth, avg rollback depth.
// =============================================================================
(function rollbackDemo() {
    const canvas = document.getElementById('rollbackCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('rbRtt'),
        rttVal: document.getElementById('rbRttVal'),
        botChange: document.getElementById('rbBotChange'),
        botChangeVal: document.getElementById('rbBotChangeVal'),
        rollback: document.getElementById('rbToggle'),
        reset: document.getElementById('rbReset'),
        info: document.getElementById('rbInfo'),
        btnLeft: document.getElementById('rbLeft'),
        btnRight: document.getElementById('rbRight'),
        btnUp: document.getElementById('rbUp'),
        btnDown: document.getElementById('rbDown'),
    };

    // Borrowed-from-racing-sim car physics. Heading-based velocity, simple
    // drag, no friction model (we want chaos to be predictable here, not
    // accurate). The cross-track stub the original plan promised lives here.
    function makeCar(x, y, heading) {
        return { x, y, vx: 0, vy: 0, heading };
    }
    const MAX_ACCEL = 320, MAX_STEER_RATE = 3.0, DRAG = 1.6;
    function rcApplyInput(c, input, dt) {
        // Steering only effective if moving (sim convention from racing-sim).
        const sp = Math.hypot(c.vx, c.vy);
        const steerEff = clamp(sp / 40, 0, 1);
        c.heading += input.steer * MAX_STEER_RATE * steerEff * dt;
        c.heading = wrapAngle(c.heading);
        const ax = Math.cos(c.heading) * input.throttle * MAX_ACCEL;
        const ay = Math.sin(c.heading) * input.throttle * MAX_ACCEL;
        c.vx += ax * dt; c.vy += ay * dt;
        // Drag (matches racing-sim Intermediate's exp-decay form).
        const k = 1 - Math.exp(-DRAG * dt);
        c.vx -= c.vx * k; c.vy -= c.vy * k;
        c.x += c.vx * dt; c.y += c.vy * dt;
        // Bounds
        if (c.x < 12) { c.x = 12; c.vx = Math.max(0, c.vx); }
        if (c.x > WORLD_W - 12) { c.x = WORLD_W - 12; c.vx = Math.min(0, c.vx); }
        if (c.y < 12) { c.y = 12; c.vy = Math.max(0, c.vy); }
        if (c.y > WORLD_H - 12) { c.y = WORLD_H - 12; c.vy = Math.min(0, c.vy); }
    }
    function rcSnapshot(c) { return { x: c.x, y: c.y, vx: c.vx, vy: c.vy, heading: c.heading }; }
    function rcRestore(c, s) { c.x = s.x; c.y = s.y; c.vx = s.vx; c.vy = s.vy; c.heading = s.heading; }

    const car1 = makeCar(WORLD_W * 0.3, WORLD_H * 0.5, 0);
    const car2 = makeCar(WORLD_W * 0.7, WORLD_H * 0.5, Math.PI);

    // Rollback infrastructure — single-machine sim, but we still send the
    // bot's inputs through a FakeNetwork to simulate them arriving late.
    const net = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: 10, seed: 71 });
    const botEp = net.connect('bot');
    const localEp = net.connect('local');

    const BUFFER_SIZE = 90; // ~1.5 s at 60 Hz
    // Each entry: { tick, state1, state2, input1, input2_predicted, input2_confirmed }
    const ringBuffer = [];
    let currentTick = 0;
    let lastInput2 = { throttle: 0, steer: 0 };
    const stats = { rollbacks: 0, totalDepth: 0, maxDepth: 0 };
    const flash = { until2: 0 }; // ms timestamp until which to flash car2

    const localInput = { ax: 0, ay: 0 };
    let lastBotInputChangeAt = 0;
    let currentBotInput = { throttle: 0.8, steer: 0.6 };

    // Helper: map ax/ay to throttle/steer.
    function carInput(axay) {
        return { throttle: -axay.ay, steer: axay.ax };
    }

    // The bot SENDS inputs to 'local', so it's the LOCAL endpoint that
    // receives them. (Earlier bug: handler was on botEp — meaning the bot
    // was "receiving" its own messages, which nobody sends.)
    localEp.onMessage((from, msg) => {
        // Real input arrived. Find the buffered tick, check vs predicted.
        if (msg.kind !== 'input') return;
        const entry = ringBuffer.find(e => e.tick === msg.tick);
        if (!entry) return; // too old, drop
        entry.input2_confirmed = msg.input;
        if (msg.input.throttle === entry.input2_predicted.throttle && msg.input.steer === entry.input2_predicted.steer) {
            return; // prediction matched — no rollback needed
        }
        if (!els.rollback.checked) {
            // Without rollback, the simulation just stays diverged. We update
            // the recent prediction so future ticks use the right value, but
            // we don't rewind.
            lastInput2 = msg.input;
            return;
        }
        // Rewind: restore both cars to that tick's pre-step state, fix the
        // input record, then re-apply every input from that tick forward.
        const idx = ringBuffer.indexOf(entry);
        const depth = ringBuffer.length - idx;
        stats.rollbacks++;
        stats.totalDepth += depth;
        stats.maxDepth = Math.max(stats.maxDepth, depth);

        rcRestore(car1, entry.state1);
        rcRestore(car2, entry.state2);
        entry.input2_predicted = msg.input;
        for (let j = idx; j < ringBuffer.length; j++) {
            const e = ringBuffer[j];
            rcApplyInput(car1, e.input1, 1 / SIM_HZ);
            rcApplyInput(car2, e.input2_predicted, 1 / SIM_HZ);
            // Save the corrected state for future rollbacks (the state in
            // entry j+1 is the post-step of j).
            if (j + 1 < ringBuffer.length) {
                ringBuffer[j + 1].state1 = rcSnapshot(car1);
                ringBuffer[j + 1].state2 = rcSnapshot(car2);
            }
        }
        lastInput2 = msg.input;
        flash.until2 = performance.now() + 220;
    });

    function attachKB(canvas, input) {
        canvas.tabIndex = 0; canvas.style.outline = 'none';
        canvas.addEventListener('mousedown', () => canvas.focus());
        const keys = new Set();
        function k(e) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') return 'left';
            if (e.code === 'ArrowRight' || e.code === 'KeyD') return 'right';
            if (e.code === 'ArrowUp' || e.code === 'KeyW') return 'up';
            if (e.code === 'ArrowDown' || e.code === 'KeyS') return 'down';
            return null;
        }
        function up() {
            input.ax = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
            input.ay = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
        }
        canvas.addEventListener('keydown', e => { const x = k(e); if (x) { keys.add(x); up(); e.preventDefault(); } });
        canvas.addEventListener('keyup', e => { const x = k(e); if (x) { keys.delete(x); up(); e.preventDefault(); } });
        canvas.addEventListener('blur', () => { keys.clear(); up(); });
    }
    function attachBtn(buttons, input) {
        function bind(el, axis, delta) {
            if (!el) return;
            const down = () => { input[axis] = delta; };
            const up = () => { if (input[axis] === delta) input[axis] = 0; };
            el.addEventListener('mousedown', down);
            el.addEventListener('mouseup', up);
            el.addEventListener('mouseleave', up);
            el.addEventListener('touchstart', e => { e.preventDefault(); down(); }, { passive: false });
            el.addEventListener('touchend', up);
        }
        bind(buttons.left, 'ax', -1); bind(buttons.right, 'ax', +1);
        bind(buttons.up, 'ay', -1); bind(buttons.down, 'ay', +1);
    }
    attachKB(canvas, localInput);
    attachBtn({ left: els.btnLeft, right: els.btnRight, up: els.btnUp, down: els.btnDown }, localInput);

    function syncSliders() {
        els.rttVal.textContent = fmtMs(+els.rtt.value);
        els.botChangeVal.textContent = (+els.botChange.value).toFixed(1) + ' Hz';
        net.setParams({ rttMs: +els.rtt.value });
    }
    els.rtt.addEventListener('input', syncSliders);
    els.botChange.addEventListener('input', syncSliders);
    syncSliders();

    els.reset.addEventListener('click', () => {
        car1.x = WORLD_W * 0.3; car1.y = WORLD_H * 0.5; car1.vx = car1.vy = 0; car1.heading = 0;
        car2.x = WORLD_W * 0.7; car2.y = WORLD_H * 0.5; car2.vx = car2.vy = 0; car2.heading = Math.PI;
        ringBuffer.length = 0; currentTick = 0;
        stats.rollbacks = 0; stats.totalDepth = 0; stats.maxDepth = 0;
        net.flush();
    });

    const SIM_DT = 1 / SIM_HZ;
    let simAccum = 0;
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;
        simAccum += dt;

        // Bot input: changes randomly at the slider's rate, then is "sent"
        // through the FakeNetwork to arrive ~RTT/2 later.
        const changeIntervalMs = 1000 / (+els.botChange.value);
        if (now - lastBotInputChangeAt >= changeIntervalMs) {
            lastBotInputChangeAt = now;
            // Pick a fresh throttle/steer.
            currentBotInput = { throttle: 0.4 + Math.random() * 0.5, steer: Math.random() * 2 - 1 };
        }

        while (simAccum >= SIM_DT) {
            simAccum -= SIM_DT;
            const tick = currentTick++;

            // Send the bot's ACTUAL current input through the net (arrives
            // later). The local player runs immediately on lastInput2 (the
            // best prediction = last known confirmed).
            localEp.send('bot', { kind: 'unused' }); // touch the network so it ticks
            botEp.send('local', { kind: 'input', tick, input: currentBotInput });

            // Save pre-step state.
            const inp1 = carInput(localInput);
            const entry = {
                tick,
                state1: rcSnapshot(car1),
                state2: rcSnapshot(car2),
                input1: inp1,
                input2_predicted: { ...lastInput2 },
                input2_confirmed: null,
            };
            ringBuffer.push(entry);
            if (ringBuffer.length > BUFFER_SIZE) ringBuffer.shift();

            // Apply both inputs to advance the world by one tick.
            rcApplyInput(car1, inp1, SIM_DT);
            rcApplyInput(car2, entry.input2_predicted, SIM_DT);
        }

        // Drain the network so botEp.onMessage fires + rollbacks happen.
        net.tick(now);

        // Render.
        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Two side-by-side: left is the simulation, right is stats.
        const oxS = 20, oy = 20, simW = 420, statW = canvas.width - simW - 60;
        drawPanel(ctx, oxS, oy, simW, canvas.height - 40, 'arena · WASD = LOCAL car (cyan)  ·  bot drives the purple car', NET_COLORS.client);
        // Cars
        const flash2 = performance.now() < flash.until2;
        drawCarSprite(ctx, oxS + 20 + (car1.x / WORLD_W) * (simW - 40), oy + 20 + (car1.y / WORLD_H) * (canvas.height - 80), car1.heading, NET_COLORS.client, false);
        drawCarSprite(ctx, oxS + 20 + (car2.x / WORLD_W) * (simW - 40), oy + 20 + (car2.y / WORLD_H) * (canvas.height - 80), car2.heading, NET_COLORS.remote, flash2);

        // Stats panel
        const oxR = oxS + simW + 20;
        drawPanel(ctx, oxR, oy, statW, canvas.height - 40, 'rollback stats', NET_COLORS.ghost);
        ctx.fillStyle = NET_COLORS.label;
        ctx.font = '13px monospace'; ctx.textAlign = 'left';
        const avgDepth = stats.rollbacks > 0 ? (stats.totalDepth / stats.rollbacks).toFixed(1) : '—';
        const lines = [
            `tick:            ${currentTick}`,
            `buffer depth:    ${ringBuffer.length} / ${BUFFER_SIZE}`,
            ``,
            `rollbacks:       ${stats.rollbacks}`,
            `avg depth:       ${avgDepth} ticks`,
            `max depth:       ${stats.maxDepth} ticks`,
            ``,
            `rtt:             ${els.rtt.value} ms`,
            `bot change rate: ${(+els.botChange.value).toFixed(1)} Hz`,
            ``,
            `mode: ${els.rollback.checked ? 'ROLLBACK ON' : 'no rollback'}`,
        ];
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], oxR + 14, oy + 44 + i * 18);

        els.info.textContent =
            `${els.rollback.checked ? 'ROLLBACK' : 'no-rollback'} · rollbacks ${stats.rollbacks} (avg depth ${avgDepth} ticks, max ${stats.maxDepth}) · buffer ${ringBuffer.length}`;

        requestAnimationFrame(frame);
    }

    // Small car sprite + flash overlay.
    function drawCarSprite(ctx, cx, cy, heading, color, flashed) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(heading);
        if (flashed) {
            ctx.fillStyle = NET_COLORS.rollback;
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.fillRect(-9, -5, 18, 10);
        // Headlight direction
        ctx.fillStyle = NET_COLORS.accent;
        ctx.fillRect(6, -2, 4, 4);
        ctx.restore();
    }

    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 4 — aoiDemo  (area-of-interest filtering via spatial grid)
//
// 100 wandering entities in a world too big to broadcast to everyone. The
// "observer" position follows the mouse. An AoI radius slider determines
// what's "visible" — entities within the radius are highlighted green and
// included in the snapshot; entities outside are dim and omitted.
//
// A spatial grid (cells = AoI radius) limits the query cost from O(N) to
// O(cells × avg_per_cell). We highlight the queried cells in the panel.
//
// Stats: visible entity count, query cost (cells inspected vs naive O(N)),
// bandwidth (full vs filtered).
// =============================================================================
(function aoiDemo() {
    const canvas = document.getElementById('aoiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        radius: document.getElementById('aoiRadius'),
        radiusVal: document.getElementById('aoiRadiusVal'),
        count: document.getElementById('aoiCount'),
        countVal: document.getElementById('aoiCountVal'),
        info: document.getElementById('aoiInfo'),
        bandwidth: document.getElementById('aoiBandwidth'),
    };

    const rng = new SeededRng(89);
    const W_BIG = 720, H_BIG = 360;
    let entities = [];
    function buildWorld(N) {
        entities.length = 0;
        for (let i = 0; i < N; i++) {
            entities.push({
                x: rng.range(20, W_BIG - 20),
                y: rng.range(20, H_BIG - 20),
                vx: rng.range(-30, 30),
                vy: rng.range(-30, 30),
            });
        }
    }
    function syncSliders() {
        els.radiusVal.textContent = els.radius.value + ' px';
        els.countVal.textContent = els.count.value;
    }
    els.count.addEventListener('input', () => { syncSliders(); buildWorld(+els.count.value); });
    els.radius.addEventListener('input', syncSliders);
    syncSliders();
    buildWorld(+els.count.value);

    let observerX = W_BIG / 2, observerY = H_BIG / 2;
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const ox = (canvas.width - W_BIG) / 2, oy = 20;
        observerX = clamp(e.clientX - rect.left - ox, 0, W_BIG);
        observerY = clamp(e.clientY - rect.top - oy, 0, H_BIG);
    });

    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        // Wander
        for (const e of entities) {
            e.vx += (Math.random() - 0.5) * 20 * dt;
            e.vy += (Math.random() - 0.5) * 20 * dt;
            const sp = Math.hypot(e.vx, e.vy);
            if (sp > 40) { e.vx *= 40 / sp; e.vy *= 40 / sp; }
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (e.x < 4 || e.x > W_BIG - 4) e.vx *= -1;
            if (e.y < 4 || e.y > H_BIG - 4) e.vy *= -1;
            e.x = clamp(e.x, 4, W_BIG - 4); e.y = clamp(e.y, 4, H_BIG - 4);
        }

        // Build spatial grid: cell size = AoI radius (so a radius query
        // touches at most 4 cells).
        const radius = +els.radius.value;
        const cell = radius;
        const gridW = Math.ceil(W_BIG / cell), gridH = Math.ceil(H_BIG / cell);
        const grid = Array.from({ length: gridW * gridH }, () => []);
        for (const e of entities) {
            const gx = Math.floor(e.x / cell), gy = Math.floor(e.y / cell);
            grid[gy * gridW + gx].push(e);
        }

        // Query
        const gx0 = Math.floor((observerX - radius) / cell);
        const gy0 = Math.floor((observerY - radius) / cell);
        const gx1 = Math.floor((observerX + radius) / cell);
        const gy1 = Math.floor((observerY + radius) / cell);
        const visited = new Set();
        const visible = [];
        let cellsScanned = 0;
        for (let gy = Math.max(0, gy0); gy <= Math.min(gridH - 1, gy1); gy++) {
            for (let gx = Math.max(0, gx0); gx <= Math.min(gridW - 1, gx1); gx++) {
                visited.add(gy * gridW + gx);
                cellsScanned++;
                for (const e of grid[gy * gridW + gx]) {
                    const d = Math.hypot(e.x - observerX, e.y - observerY);
                    if (d <= radius) visible.push(e);
                }
            }
        }

        // Render
        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const ox = (canvas.width - W_BIG) / 2, oy = 20;
        drawPanel(ctx, ox, oy, W_BIG, H_BIG, `${entities.length} entities · radius ${radius} px · grid cell = radius (so 1–4 cells per query)`, NET_COLORS.ghost);

        // Cells visited
        ctx.fillStyle = 'rgba(102, 187, 106, 0.10)';
        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                if (visited.has(gy * gridW + gx)) {
                    ctx.fillRect(ox + gx * cell, oy + gy * cell, cell, cell);
                }
            }
        }
        // Cell grid lines
        ctx.strokeStyle = NET_COLORS.grid;
        for (let gx = 1; gx < gridW; gx++) { ctx.beginPath(); ctx.moveTo(ox + gx * cell + 0.5, oy); ctx.lineTo(ox + gx * cell + 0.5, oy + H_BIG); ctx.stroke(); }
        for (let gy = 1; gy < gridH; gy++) { ctx.beginPath(); ctx.moveTo(ox, oy + gy * cell + 0.5); ctx.lineTo(ox + W_BIG, oy + gy * cell + 0.5); ctx.stroke(); }

        // Entities
        const visSet = new Set(visible);
        for (const e of entities) {
            ctx.fillStyle = visSet.has(e) ? NET_COLORS.visible : NET_COLORS.invisible;
            ctx.beginPath(); ctx.arc(ox + e.x, oy + e.y, visSet.has(e) ? 4 : 3, 0, Math.PI * 2); ctx.fill();
        }

        // Observer
        ctx.strokeStyle = NET_COLORS.client; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox + observerX, oy + observerY, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = NET_COLORS.client;
        ctx.beginPath(); ctx.arc(ox + observerX, oy + observerY, 5, 0, Math.PI * 2); ctx.fill();

        const fullBytes = entities.length * 16;
        const aoiBytes = visible.length * 16;
        const savings = entities.length > 0 ? (100 * (1 - visible.length / entities.length)).toFixed(0) : 0;
        els.info.textContent =
            `visible ${visible.length} / ${entities.length} (${100 - savings}% sent · ${savings}% omitted) · ` +
            `cells scanned ${cellsScanned} / ${gridW * gridH} (vs naive O(${entities.length}))`;
        els.bandwidth.textContent = `bytes / snapshot · full ${fullBytes} B · AoI-filtered ${aoiBytes} B (${savings}% saved)`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
