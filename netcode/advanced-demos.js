// =============================================================================
// NETCODE — ADVANCED TIER DEMOS  ("Reconciliation, Lag Comp, Compression")
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak into the global
// scope. Each demo runs only if its target canvas / DOM root exists.
//
// What this tier teaches (in order):
//   1. reconciliationDemo  — replay buffered inputs after a server correction
//                            (fixes the visible snap from Intermediate)
//   2. lagCompDemo         — server rewinds history to validate a hit at the
//                            time the client believed they aimed
//   3. deltaSnapshotDemo   — only encode entities that changed since last ack
//   4. quantizationDemo    — float positions → int16 over a known range
//   5. shooterDemo         — capstone: 2-player shooter with all 4 techniques
//                            independently togglable
//
// CONTINUING DISCIPLINE (from Intermediate): server-state and client-state are
// SEPARATE objects in every demo. Communication ONLY through FakeNetwork.
//
// UNITS unchanged from Intermediate.
//
// DEPENDENCIES (loaded by the tier HTML BEFORE this file):
//   shared/utils.js, net/seeded-rng.js, net/fake-network.js
//
// Top-level names this file introduces (all verified absent from shared/utils.js;
// names that overlap with intermediate-demos.js are intentional, since the two
// files are never loaded on the same page):
//   NET_COLORS, MAX_DT, SIM_HZ, INPUT_TICK_HZ, WORLD_W, WORLD_H, SPEED,
//   Player, applyInput, integrate, cloneSnapshot, lerpV, fmtMs, drawPanel,
//   drawPlayer, drawGhost, attachKeyboardInput, attachButtonInput,
//   quantize, dequantize, estimateBytes, HISTORY_DEPTH
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
// Palette + base constants — same as Intermediate. Each tier page loads only
// its own *-demos.js, so the redeclaration is harmless and keeps source files
// reading uniformly.
// ---------------------------------------------------------------------------
const NET_COLORS = {
    bg:           '#0d1117',
    panel:        '#1a1f3a',
    panelEdge:    '#2d3354',
    laneFill:     '#161b2c',
    laneEdge:     '#2e3548',
    grid:         '#252b4a',
    client:       '#4fc3f7',
    server:       '#ffa726',
    ghost:        '#66bb6a',
    correction:   '#ef5350',
    remote:       '#ba68c8',
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    accent:       '#fbc02d',
    history:      'rgba(255, 167, 38, 0.18)',  // faded server-history trail
    hit:          '#66bb6a',
    miss:         '#ef5350',
    beam:         '#fbc02d',
};

const MAX_DT = 0.05;
const SIM_HZ = 60;
const INPUT_TICK_HZ = 30;
const WORLD_W = 320;
const WORLD_H = 220;
const SPEED = 140;
const HISTORY_DEPTH = 120;  // server keeps ~2 s @ 60 Hz of past states for lag-comp

function lerpV(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
function fmtMs(ms) { return ms < 10 ? ms.toFixed(1) + ' ms' : Math.round(ms) + ' ms'; }

// Estimate the wire byte size of an object. Not a real serializer — just
// `JSON.stringify(...).length` as a proxy. Real games use schemas + bit-packing
// (covered in the quantization demo) which beat JSON dramatically.
function estimateBytes(obj) {
    return JSON.stringify(obj).length;
}

// Quantize a float in [-range, +range] to a `bits`-wide integer; dequantize
// reverses. This is the lossy compression technique most games use for
// positions/velocities: a 16-bit signed int has 65536 levels — over a 1024 px
// world that's ~0.015 px resolution, way finer than anyone notices.
function quantize(value, range, bits) {
    const max = (1 << (bits - 1)) - 1;
    const clamped = clamp(value, -range, range);
    return Math.round(clamped / range * max);
}
function dequantize(q, range, bits) {
    const max = (1 << (bits - 1)) - 1;
    return q / max * range;
}

// ---------------------------------------------------------------------------
// Player + integration — identical contract to Intermediate. Velocity-driven,
// world-edge clamped. The single change vs Intermediate's class: an optional
// `health` field used by the shooter capstone.
// ---------------------------------------------------------------------------
class Player {
    constructor(x = WORLD_W / 2, y = WORLD_H / 2) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.health = 5;
    }
}

function applyInput(player, input) {
    const mag = Math.hypot(input.ax, input.ay) || 1;
    player.vx = input.ax / mag * SPEED;
    player.vy = input.ay / mag * SPEED;
}

function integrate(player, dt) {
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < 12) { player.x = 12; player.vx = 0; }
    if (player.x > WORLD_W - 12) { player.x = WORLD_W - 12; player.vx = 0; }
    if (player.y < 12) { player.y = 12; player.vy = 0; }
    if (player.y > WORLD_H - 12) { player.y = WORLD_H - 12; player.vy = 0; }
}

function cloneSnapshot(player, extra = {}) {
    return { x: player.x, y: player.y, vx: player.vx, vy: player.vy, ...extra };
}

// ---------------------------------------------------------------------------
// Drawing primitives — same shape as Intermediate. drawPanel + drawPlayer +
// drawGhost handle every two-panel layout used in this tier.
// ---------------------------------------------------------------------------
function drawPanel(ctx, ox, oy, label, color) {
    ctx.fillStyle = NET_COLORS.panel;
    ctx.fillRect(ox, oy, WORLD_W, WORLD_H);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(ox + 0.5, oy + 0.5, WORLD_W - 1, WORLD_H - 1);
    ctx.strokeStyle = NET_COLORS.grid; ctx.lineWidth = 1;
    for (let gx = 40; gx < WORLD_W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(ox + gx + 0.5, oy + 1); ctx.lineTo(ox + gx + 0.5, oy + WORLD_H - 1); ctx.stroke();
    }
    for (let gy = 40; gy < WORLD_H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(ox + 1, oy + gy + 0.5); ctx.lineTo(ox + WORLD_W - 1, oy + gy + 0.5); ctx.stroke();
    }
    ctx.fillStyle = color; ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left'; ctx.fillText(label, ox + 8, oy + 18);
}

function drawPlayer(ctx, ox, oy, p, color, radius = 10) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(ox + p.x, oy + p.y, radius, 0, Math.PI * 2); ctx.fill();
    const sp = Math.hypot(p.vx || 0, p.vy || 0);
    if (sp > 1) {
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ox + p.x, oy + p.y);
        ctx.lineTo(ox + p.x + p.vx / sp * 16, oy + p.y + p.vy / sp * 16); ctx.stroke();
    }
}

function drawGhost(ctx, ox, oy, p, color, radius = 10) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(ox + p.x, oy + p.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------
// Input wiring — same as Intermediate.
// ---------------------------------------------------------------------------
function attachKeyboardInput(canvas, input) {
    canvas.tabIndex = 0; canvas.style.outline = 'none';
    canvas.addEventListener('mousedown', () => canvas.focus());
    const keys = new Set();
    function update() {
        input.ax = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        input.ay = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    }
    function keyOf(e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') return 'left';
        if (e.code === 'ArrowRight' || e.code === 'KeyD') return 'right';
        if (e.code === 'ArrowUp' || e.code === 'KeyW') return 'up';
        if (e.code === 'ArrowDown' || e.code === 'KeyS') return 'down';
        return null;
    }
    canvas.addEventListener('keydown', e => { const k = keyOf(e); if (k) { keys.add(k); update(); e.preventDefault(); } });
    canvas.addEventListener('keyup', e => { const k = keyOf(e); if (k) { keys.delete(k); update(); e.preventDefault(); } });
    canvas.addEventListener('blur', () => { keys.clear(); update(); });
}

function attachButtonInput(buttons, input) {
    function bind(el, axis, delta) {
        if (!el) return;
        const down = () => { input[axis] = delta; };
        const up   = () => { if (input[axis] === delta) input[axis] = 0; };
        el.addEventListener('mousedown', down);
        el.addEventListener('mouseup', up);
        el.addEventListener('mouseleave', up);
        el.addEventListener('touchstart', e => { e.preventDefault(); down(); }, { passive: false });
        el.addEventListener('touchend', up);
    }
    bind(buttons.left,  'ax', -1); bind(buttons.right, 'ax', +1);
    bind(buttons.up,    'ay', -1); bind(buttons.down,  'ay', +1);
}

// =============================================================================
// DEMO 1 — reconciliationDemo
//
// Builds on Intermediate's predictionDemo. The change: each input message is
// tagged with a monotonically-incrementing client tick. The client KEEPS a
// buffer of (tick, input, dt) tuples for every input it sent. Each server
// snapshot carries the highest input tick the server has processed (the "ack").
// On snapshot arrival the client:
//   1. drops buffered inputs whose tick ≤ ack
//   2. snaps to the authoritative state
//   3. (if reconciliation ON) replays every remaining buffered input on top
//
// Result: the client realigns with the server's view of the PAST plus its own
// predicted-but-not-yet-acked motion. Because the predicted past matched
// truth, the replay leaves the present unchanged — no visible snap.
// =============================================================================
(function reconciliationDemo() {
    const canvas = document.getElementById('reconCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('reconRtt'),
        rttVal: document.getElementById('reconRttVal'),
        jitter: document.getElementById('reconJitter'),
        jitterVal: document.getElementById('reconJitterVal'),
        reconcile: document.getElementById('reconToggle'),
        reset: document.getElementById('reconReset'),
        info: document.getElementById('reconInfo'),
        btnLeft:  document.getElementById('reconLeft'),
        btnRight: document.getElementById('reconRight'),
        btnUp:    document.getElementById('reconUp'),
        btnDown:  document.getElementById('reconDown'),
    };

    const net = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: +els.jitter.value, seed: 23 });
    const serverEp = net.connect('server');
    const clientEp = net.connect('client');

    const serverPlayer = new Player();
    const clientPlayer = new Player();
    const input = { ax: 0, ay: 0 };
    let lastInputSentAt = 0;
    let nextInputTick = 1;
    const inputBuffer = []; // {tick, ax, ay, dt}

    let highestServerProcessedTick = 0;
    let lastAuthoritative = null;
    let avgSnapDistance = 0;
    let snapSamples = 0;
    let lastSnapDistance = 0;

    serverEp.onMessage((from, msg) => {
        if (msg.kind === 'input') {
            applyInput(serverPlayer, { ax: msg.ax, ay: msg.ay });
            if (msg.tick > highestServerProcessedTick) highestServerProcessedTick = msg.tick;
        }
    });

    clientEp.onMessage((from, msg) => {
        if (msg.kind !== 'snapshot') return;
        const snap = msg.snap;
        const ack = msg.ackTick;
        // 1) Drop acked inputs.
        while (inputBuffer.length > 0 && inputBuffer[0].tick <= ack) inputBuffer.shift();

        // 2) Measure snap distance BEFORE we apply the snap — this is the
        //    "visible snap" that reconciliation aims to hide. Pre-snap, the
        //    client is where prediction had it; post-snap-only, it would jump
        //    to the authoritative position; post-reconcile, it would jump to
        //    authoritative + replay.
        const preSnapX = clientPlayer.x, preSnapY = clientPlayer.y;

        // 3) Snap to authoritative.
        clientPlayer.x = snap.x; clientPlayer.y = snap.y;
        clientPlayer.vx = snap.vx; clientPlayer.vy = snap.vy;

        // 4) Replay buffered inputs (if reconciliation is enabled).
        if (els.reconcile.checked) {
            for (const b of inputBuffer) {
                applyInput(clientPlayer, { ax: b.ax, ay: b.ay });
                integrate(clientPlayer, b.dt);
            }
        }

        // The metric we display: how far did the displayed position visibly
        // jump as a result of this snapshot?
        lastSnapDistance = Math.hypot(clientPlayer.x - preSnapX, clientPlayer.y - preSnapY);
        avgSnapDistance = (avgSnapDistance * snapSamples + lastSnapDistance) / (snapSamples + 1);
        snapSamples++;
        lastAuthoritative = snap;
    });

    attachKeyboardInput(canvas, input);
    attachButtonInput({ left: els.btnLeft, right: els.btnRight, up: els.btnUp, down: els.btnDown }, input);

    function syncSliders() {
        els.rttVal.textContent = fmtMs(+els.rtt.value);
        els.jitterVal.textContent = '±' + fmtMs(+els.jitter.value);
        net.setParams({ rttMs: +els.rtt.value, jitterMs: +els.jitter.value });
    }
    els.rtt.addEventListener('input', syncSliders);
    els.jitter.addEventListener('input', syncSliders);
    syncSliders();

    els.reset.addEventListener('click', () => {
        serverPlayer.x = WORLD_W/2; serverPlayer.y = WORLD_H/2; serverPlayer.vx = serverPlayer.vy = 0;
        clientPlayer.x = WORLD_W/2; clientPlayer.y = WORLD_H/2; clientPlayer.vx = clientPlayer.vy = 0;
        inputBuffer.length = 0; nextInputTick = 1; highestServerProcessedTick = 0;
        lastAuthoritative = null; avgSnapDistance = 0; snapSamples = 0; lastSnapDistance = 0;
        net.flush();
    });

    const SIM_DT = 1 / SIM_HZ;
    const SNAPSHOT_INTERVAL = 1 / 15;
    let serverAccum = 0, snapshotAccum = 0;
    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        // Client always predicts (that part isn't toggleable — without
        // prediction the demo would just be Intermediate naive).
        applyInput(clientPlayer, input);
        integrate(clientPlayer, dt);

        // Send input at INPUT_TICK_HZ, tagged with the current client tick.
        if (now - lastInputSentAt >= 1000 / INPUT_TICK_HZ) {
            const tick = nextInputTick++;
            inputBuffer.push({ tick, ax: input.ax, ay: input.ay, dt: 1 / INPUT_TICK_HZ });
            clientEp.send('server', { kind: 'input', tick, ax: input.ax, ay: input.ay });
            lastInputSentAt = now;
        }

        // Server sim + snapshot.
        serverAccum += dt; snapshotAccum += dt;
        while (serverAccum >= SIM_DT) { serverAccum -= SIM_DT; integrate(serverPlayer, SIM_DT); }
        while (snapshotAccum >= SNAPSHOT_INTERVAL) {
            snapshotAccum -= SNAPSHOT_INTERVAL;
            serverEp.send('client', { kind: 'snapshot', snap: cloneSnapshot(serverPlayer), ackTick: highestServerProcessedTick });
        }
        net.tick(now);

        // DRAW
        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxS = 30, oxC = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxS, oy, 'SERVER (truth)', NET_COLORS.server);
        drawPanel(ctx, oxC, oy, els.reconcile.checked ? 'CLIENT (predict + reconcile)' : 'CLIENT (predict + naive snap)', NET_COLORS.client);
        drawPlayer(ctx, oxS, oy, serverPlayer, NET_COLORS.server);
        drawPlayer(ctx, oxC, oy, clientPlayer, NET_COLORS.client);
        if (lastAuthoritative) drawGhost(ctx, oxC, oy, lastAuthoritative, NET_COLORS.ghost);

        els.info.textContent =
            `reconcile ${els.reconcile.checked ? 'ON' : 'OFF'} · ` +
            `buffered inputs: ${inputBuffer.length} · ` +
            `last snap distance ${lastSnapDistance.toFixed(1)} px · ` +
            `avg ${avgSnapDistance.toFixed(1)} px over ${snapSamples} snaps`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 2 — lagCompDemo  (server-side hit rewind)
//
// Single player aiming at a moving target. The player sees the target where
// it WAS one one-way-latency-plus-interp-delay ago (entity interpolation from
// Intermediate). When they fire, the shot reaches the server some RTT/2
// later. If the server checks against the target's CURRENT position, the
// target has moved away and the shot misses.
//
// Lag compensation: the client tags the fire message with the client's
// believed render time. The server rewinds the world to that time, runs the
// hit check there, and tells the client what they would have hit.
//
// We render two panels side-by-side, both showing the same target trajectory:
//   LEFT  — NO lag-comp: server checks current state. Most shots miss.
//   RIGHT — WITH lag-comp: server rewinds. Same shots now hit. A faint
//           orange trail shows the target's recent history (= the server's
//           rewind buffer).
//
// Auto-fire every second so the user doesn't have to do anything except watch
// the hit-counter diverge. Slider for target speed and RTT.
// =============================================================================
(function lagCompDemo() {
    const canvas = document.getElementById('lagCompCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        speed: document.getElementById('lcSpeed'),
        speedVal: document.getElementById('lcSpeedVal'),
        rtt: document.getElementById('lcRtt'),
        rttVal: document.getElementById('lcRttVal'),
        autoFire: document.getElementById('lcAutoFire'),
        reset: document.getElementById('lcReset'),
        info: document.getElementById('lcInfo'),
    };

    // Two independent networks (one per panel) so we can give each its own
    // "lag-comp" behaviour without one bleeding into the other.
    const netA = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: 5, seed: 31 });
    const netB = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: 5, seed: 31 });
    const ca = netA.connect('client'); netA.connect('server');
    const cb = netB.connect('client'); netB.connect('server');
    const sa = netA.endpoints.get('server').endpoint;
    const sb = netB.endpoints.get('server').endpoint;

    // Shared simulation: target moves in a circle. We sample the same path
    // on both panels so identical fire events get checked against identical
    // motion. Differences come only from the lag-comp logic.
    let theta = 0;
    const cx = WORLD_W * 0.5, cy = WORLD_H * 0.5, R = Math.min(WORLD_W, WORLD_H) * 0.32;
    let serverTimeA = 0, serverTimeB = 0;
    // History for lag-comp: list of {serverTime, x, y}
    const historyA = []; // not actually rewound (no lag-comp panel)
    const historyB = []; // used for rewind
    const HIT_RADIUS = 14;
    const SHOT_TRAVEL_MS = 80; // visual delay so the user sees the beam
    const counters = { aShots: 0, aHits: 0, bShots: 0, bHits: 0 };

    // What the client sees: the latest snapshot of the target. Each panel
    // has its own snapshot history; interp delay = 120 ms.
    let latestSnapA = null, latestSnapB = null;
    const INTERP_DELAY_MS = 120;
    const snapsA = [], snapsB = []; // for interpolation rendering

    ca.onMessage((from, m) => { if (m.kind === 'snapshot') { latestSnapA = m.snap; snapsA.push({ ...m.snap, serverTime: m.serverTime }); pruneOld(snapsA, m.serverTime); } });
    cb.onMessage((from, m) => { if (m.kind === 'snapshot') { latestSnapB = m.snap; snapsB.push({ ...m.snap, serverTime: m.serverTime }); pruneOld(snapsB, m.serverTime); } });
    function pruneOld(arr, latest) {
        const cutoff = latest - 2.0;
        while (arr.length > 1 && arr[0].serverTime < cutoff) arr.shift();
    }

    // Server-side hit logic for panel A (no lag comp): compare aim to CURRENT
    // server target position. Server tells client {hit: bool}.
    sa.onMessage((from, m) => {
        if (m.kind !== 'fire') return;
        const tx = cx + Math.cos(theta) * R;
        const ty = cy + Math.sin(theta) * R;
        const d = Math.hypot(m.aim.x - tx, m.aim.y - ty);
        sa.send('client', { kind: 'fireResult', shotId: m.shotId, hit: d < HIT_RADIUS });
    });

    // Server-side hit logic for panel B (with lag comp): server rewinds
    // history to (current_server_time - estimated client render lag).
    sb.onMessage((from, m) => {
        if (m.kind !== 'fire') return;
        // Find the historical target position at the client's stated render
        // time. Linearly interpolate between the two history entries
        // straddling renderTime.
        const renderTime = m.clientRenderTime;
        let i = historyB.length - 1;
        while (i > 0 && historyB[i].serverTime > renderTime) i--;
        const a = historyB[i];
        const b = historyB[Math.min(i + 1, historyB.length - 1)];
        const span = b.serverTime - a.serverTime;
        const t = span > 0 ? clamp((renderTime - a.serverTime) / span, 0, 1) : 0;
        const tx = lerp(a.x, b.x, t), ty = lerp(a.y, b.y, t);
        const d = Math.hypot(m.aim.x - tx, m.aim.y - ty);
        sb.send('client', { kind: 'fireResult', shotId: m.shotId, hit: d < HIT_RADIUS });
    });

    // In-flight shot animations (per panel). { aim, startedAt, hit?: bool }
    const shotsA = []; const shotsB = [];
    ca.onMessage((from, m) => { if (m.kind === 'fireResult') { const s = shotsA.find(x => x.shotId === m.shotId); if (s) { s.hit = m.hit; counters.aShots++; if (m.hit) counters.aHits++; } } });
    cb.onMessage((from, m) => { if (m.kind === 'fireResult') { const s = shotsB.find(x => x.shotId === m.shotId); if (s) { s.hit = m.hit; counters.bShots++; if (m.hit) counters.bHits++; } } });

    function syncSliders() {
        els.speedVal.textContent = (+els.speed.value).toFixed(1) + ' rad/s';
        els.rttVal.textContent = fmtMs(+els.rtt.value);
        netA.setParams({ rttMs: +els.rtt.value });
        netB.setParams({ rttMs: +els.rtt.value });
    }
    els.speed.addEventListener('input', syncSliders);
    els.rtt.addEventListener('input', syncSliders);
    syncSliders();

    els.reset.addEventListener('click', () => {
        counters.aShots = counters.aHits = counters.bShots = counters.bHits = 0;
        shotsA.length = shotsB.length = 0;
        historyA.length = historyB.length = 0;
        snapsA.length = snapsB.length = 0;
        netA.flush(); netB.flush();
    });

    const SIM_DT = 1 / SIM_HZ;
    const SNAPSHOT_INTERVAL = 1 / 20;
    let serverAccum = 0, snapAccum = 0, fireAccum = 0;
    let shotIdNext = 1;
    let last = performance.now();

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        // Single shared theta for the target's motion. Both panels see the
        // same path so they're directly comparable.
        const omega = +els.speed.value;
        serverAccum += dt; snapAccum += dt; fireAccum += dt;
        while (serverAccum >= SIM_DT) {
            serverAccum -= SIM_DT;
            theta += omega * SIM_DT;
            serverTimeA += SIM_DT; serverTimeB += SIM_DT;
            const tx = cx + Math.cos(theta) * R, ty = cy + Math.sin(theta) * R;
            historyA.push({ serverTime: serverTimeA, x: tx, y: ty });
            historyB.push({ serverTime: serverTimeB, x: tx, y: ty });
            while (historyA.length > HISTORY_DEPTH) historyA.shift();
            while (historyB.length > HISTORY_DEPTH) historyB.shift();
        }
        while (snapAccum >= SNAPSHOT_INTERVAL) {
            snapAccum -= SNAPSHOT_INTERVAL;
            const tx = cx + Math.cos(theta) * R, ty = cy + Math.sin(theta) * R;
            sa.send('client', { kind: 'snapshot', snap: { x: tx, y: ty }, serverTime: serverTimeA });
            sb.send('client', { kind: 'snapshot', snap: { x: tx, y: ty }, serverTime: serverTimeB });
        }
        netA.tick(now); netB.tick(now);

        // Auto-fire: aim at the interpolated remote position the client sees.
        if (els.autoFire.checked && fireAccum >= 1.0) {
            fireAccum -= 1.0;
            const aimA = renderedTarget(snapsA, serverTimeA);
            const aimB = renderedTarget(snapsB, serverTimeB);
            if (aimA) {
                const id = shotIdNext++;
                shotsA.push({ shotId: id, aim: aimA, startedAt: now });
                ca.send('server', { kind: 'fire', shotId: id, aim: aimA });
            }
            if (aimB) {
                const id = shotIdNext++;
                // Client's believed render time = serverTime - INTERP_DELAY.
                shotsB.push({ shotId: id, aim: aimB, startedAt: now });
                cb.send('server', { kind: 'fire', shotId: id, aim: aimB, clientRenderTime: serverTimeB - INTERP_DELAY_MS / 1000 });
            }
        }

        // DRAW
        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxL = 30, oxR = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxL, oy, 'NO lag-comp', NET_COLORS.correction);
        drawPanel(ctx, oxR, oy, 'WITH lag-comp', NET_COLORS.ghost);

        // RIGHT-panel server-history trail (showing what the server can rewind to).
        for (const h of historyB) {
            ctx.fillStyle = NET_COLORS.history;
            ctx.beginPath(); ctx.arc(oxR + h.x, oy + h.y, 5, 0, Math.PI * 2); ctx.fill();
        }

        // Target current position on both panels (orange "truth" outline) +
        // interpolated client view (purple — what the player aims at).
        const curX = cx + Math.cos(theta) * R, curY = cy + Math.sin(theta) * R;
        drawGhost(ctx, oxL, oy, { x: curX, y: curY }, NET_COLORS.server, 12);
        drawGhost(ctx, oxR, oy, { x: curX, y: curY }, NET_COLORS.server, 12);
        const interpA = renderedTarget(snapsA, serverTimeA);
        const interpB = renderedTarget(snapsB, serverTimeB);
        if (interpA) { ctx.fillStyle = NET_COLORS.remote; ctx.beginPath(); ctx.arc(oxL + interpA.x, oy + interpA.y, 10, 0, Math.PI * 2); ctx.fill(); }
        if (interpB) { ctx.fillStyle = NET_COLORS.remote; ctx.beginPath(); ctx.arc(oxR + interpB.x, oy + interpB.y, 10, 0, Math.PI * 2); ctx.fill(); }

        // Animated shots — beam from a "player" dot at the bottom-centre of
        // each panel to the aim point. Colour reflects hit/miss/pending.
        drawShots(ctx, oxL, oy, shotsA, now);
        drawShots(ctx, oxR, oy, shotsB, now);

        const acc = (h, s) => s > 0 ? Math.round(100 * h / s) + '%' : '—';
        els.info.textContent =
            `NO lag-comp: hits ${counters.aHits} / ${counters.aShots} (${acc(counters.aHits, counters.aShots)}) · ` +
            `WITH lag-comp: hits ${counters.bHits} / ${counters.bShots} (${acc(counters.bHits, counters.bShots)})`;

        // Drop completed shots after 0.5 s.
        for (let i = shotsA.length - 1; i >= 0; i--) if (now - shotsA[i].startedAt > 500) shotsA.splice(i, 1);
        for (let i = shotsB.length - 1; i >= 0; i--) if (now - shotsB[i].startedAt > 500) shotsB.splice(i, 1);

        requestAnimationFrame(frame);
    }

    function renderedTarget(snaps, serverTime) {
        if (snaps.length < 2) return null;
        const renderTime = serverTime - INTERP_DELAY_MS / 1000;
        let i = snaps.length - 1;
        while (i > 0 && snaps[i].serverTime > renderTime) i--;
        const a = snaps[i], b = snaps[Math.min(i + 1, snaps.length - 1)];
        const span = b.serverTime - a.serverTime;
        const t = span > 0 ? clamp((renderTime - a.serverTime) / span, 0, 1) : 0;
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
    }
    function drawShots(ctx, ox, oy, shots, now) {
        const px = WORLD_W / 2, py = WORLD_H - 18;
        // Player dot at the bottom.
        ctx.fillStyle = NET_COLORS.client;
        ctx.beginPath(); ctx.arc(ox + px, oy + py, 8, 0, Math.PI * 2); ctx.fill();
        // Beams.
        for (const s of shots) {
            const t = clamp((now - s.startedAt) / SHOT_TRAVEL_MS, 0, 1);
            const ex = lerp(px, s.aim.x, t), ey = lerp(py, s.aim.y, t);
            const color = s.hit === undefined ? NET_COLORS.beam : (s.hit ? NET_COLORS.hit : NET_COLORS.miss);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(ox + px, oy + py); ctx.lineTo(ox + ex, oy + ey); ctx.stroke();
            if (t >= 1 && s.hit !== undefined) {
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(ox + s.aim.x, oy + s.aim.y, s.hit ? 12 : 6, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 3 — deltaSnapshotDemo
//
// Pure bandwidth math demo (no canvas). N entities, each changing on some
// fraction of ticks. Compute bytes/sec for two encoding schemes:
//
//   FULL:  every snapshot encodes every entity ({id, x, y, vx, vy})
//   DELTA: each snapshot encodes only entities whose state differs from the
//          last acked snapshot ({id, x, y, vx, vy})
//
// Delta wins when entities are mostly idle. Catastrophically loses if the
// delta encoding itself is more expensive than the field it replaced — not a
// concern here, but worth a callout for learners moving to real schemas.
// =============================================================================
(function deltaSnapshotDemo() {
    const root = document.getElementById('deltaCalc');
    if (!root) return;

    const els = {
        entities:   document.getElementById('dsEntities'),
        entitiesVal:document.getElementById('dsEntitiesVal'),
        tick:       document.getElementById('dsTick'),
        tickVal:    document.getElementById('dsTickVal'),
        changeRate: document.getElementById('dsChangeRate'),
        changeRateVal: document.getElementById('dsChangeRateVal'),
        fullOut:    document.getElementById('dsFullOut'),
        deltaOut:   document.getElementById('dsDeltaOut'),
        savings:    document.getElementById('dsSavings'),
        fullBar:    document.getElementById('dsFullBar'),
        deltaBar:   document.getElementById('dsDeltaBar'),
        verdict:    document.getElementById('dsVerdict'),
    };

    function recompute() {
        const N = +els.entities.value;
        const tick = +els.tick.value;
        const change = +els.changeRate.value / 100;

        els.entitiesVal.textContent = N;
        els.tickVal.textContent = tick + ' Hz';
        els.changeRateVal.textContent = (change * 100).toFixed(0) + ' %';

        // A typical entity in JSON: {"id":12,"x":123.45,"y":67.89,"vx":12.3,"vy":4.5} ≈ 48 bytes.
        const bytesPerEntity = 48;
        const fullBps = N * bytesPerEntity * tick;
        const deltaBps = Math.round(N * change) * bytesPerEntity * tick;

        els.fullOut.textContent = fmtRate(fullBps);
        els.deltaOut.textContent = fmtRate(deltaBps);

        const max = Math.max(fullBps, deltaBps, 1);
        els.fullBar.style.width = (100 * fullBps / max).toFixed(0) + '%';
        els.deltaBar.style.width = (100 * deltaBps / max).toFixed(0) + '%';

        const saved = fullBps > 0 ? Math.round(100 * (1 - deltaBps / fullBps)) : 0;
        els.savings.textContent = saved + '% saved';

        if (change < 0.1) els.verdict.textContent = 'Most entities idle — delta encoding is a huge win.';
        else if (change < 0.5) els.verdict.textContent = 'Mixed activity — delta still pays for itself.';
        else if (change < 0.9) els.verdict.textContent = 'High churn — savings shrink; delta overhead becomes significant.';
        else els.verdict.textContent = 'Nearly every entity changes — delta is barely an improvement over full snapshots.';
    }
    function fmtRate(bps) {
        const kbps = bps * 8 / 1000;
        if (kbps < 10) return kbps.toFixed(2) + ' kbps';
        if (kbps < 1000) return kbps.toFixed(1) + ' kbps';
        return (kbps / 1000).toFixed(2) + ' Mbps';
    }
    ['entities', 'tick', 'changeRate'].forEach(k => els[k].addEventListener('input', recompute));
    recompute();
})();

// =============================================================================
// DEMO 4 — quantizationDemo
//
// One position rendered two ways: float (32-bit per component) vs quantized
// (k-bit per component, mapped over a known world range). At low k the
// quantized ball visibly snaps to a grid. The byte readout shows the bytes
// per snapshot for each encoding.
//
// Slider for k. A small canvas shows the float position (cyan) and the
// quantized position (green). The drift is the worst-case quantization error.
// =============================================================================
(function quantizationDemo() {
    const canvas = document.getElementById('quantCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        bits: document.getElementById('qzBits'),
        bitsVal: document.getElementById('qzBitsVal'),
        range: document.getElementById('qzRange'),
        rangeVal: document.getElementById('qzRangeVal'),
        info: document.getElementById('qzInfo'),
        bytesPerFloat: document.getElementById('qzBytesFloat'),
        bytesPerQuant: document.getElementById('qzBytesQuant'),
        savings: document.getElementById('qzSavings'),
        maxErr: document.getElementById('qzMaxErr'),
    };

    let t = 0;
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;
        t += dt;

        const bits = +els.bits.value;
        const range = +els.range.value;
        els.bitsVal.textContent = bits + ' bits';
        els.rangeVal.textContent = '±' + range + ' world units';

        // True position — a Lissajous figure so x and y both vary.
        const cx = WORLD_W * 0.5, cy = WORLD_H * 0.5, R = 90;
        const xTrue = Math.cos(t * 0.8) * R;
        const yTrue = Math.sin(t * 1.3) * R;

        // Quantize → wire → dequantize.
        const xQ = quantize(xTrue, range, bits);
        const yQ = quantize(yTrue, range, bits);
        const xRec = dequantize(xQ, range, bits);
        const yRec = dequantize(yQ, range, bits);

        const err = Math.hypot(xTrue - xRec, yTrue - yRec);
        const maxErr = range / ((1 << (bits - 1)) - 1) * Math.SQRT2; // worst-case 2D error

        // Bytes — float32 = 4 each component; quantized = ceil(bits/8).
        const floatBytes = 8;
        const quantBytes = Math.ceil(bits / 8) * 2;
        els.bytesPerFloat.textContent = floatBytes + ' B';
        els.bytesPerQuant.textContent = quantBytes + ' B';
        els.savings.textContent = (100 * (1 - quantBytes / floatBytes)).toFixed(0) + '% smaller';
        els.maxErr.textContent = maxErr.toFixed(3) + ' world units (worst case)';

        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Single panel, centered.
        const ox = (canvas.width - WORLD_W) / 2, oy = 30;
        drawPanel(ctx, ox, oy, `float vs quant (${bits}-bit)`, NET_COLORS.client);

        // Draw the quantization grid lightly.
        if (bits <= 10) {
            const step = range / ((1 << (bits - 1)) - 1);
            const stepPx = step / range * R;
            ctx.strokeStyle = NET_COLORS.grid; ctx.lineWidth = 1;
            for (let gx = cx - R; gx <= cx + R; gx += stepPx) {
                ctx.beginPath(); ctx.moveTo(ox + gx, oy + cy - R); ctx.lineTo(ox + gx, oy + cy + R); ctx.stroke();
            }
            for (let gy = cy - R; gy <= cy + R; gy += stepPx) {
                ctx.beginPath(); ctx.moveTo(ox + cx - R, oy + gy); ctx.lineTo(ox + cx + R, oy + gy); ctx.stroke();
            }
        }

        // True position (cyan).
        ctx.fillStyle = NET_COLORS.client;
        ctx.beginPath(); ctx.arc(ox + cx + xTrue, oy + cy + yTrue, 9, 0, Math.PI * 2); ctx.fill();
        // Quantized position (green ghost).
        ctx.fillStyle = NET_COLORS.ghost;
        ctx.beginPath(); ctx.arc(ox + cx + xRec, oy + cy + yRec, 6, 0, Math.PI * 2); ctx.fill();
        // Error line between them.
        ctx.strokeStyle = NET_COLORS.correction; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ox + cx + xTrue, oy + cy + yTrue); ctx.lineTo(ox + cx + xRec, oy + cy + yRec); ctx.stroke();

        els.info.textContent = `current error: ${err.toFixed(3)} world units · ${err < 1 ? 'imperceptible' : err < 5 ? 'visible' : 'obvious chunking'}`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 5 — shooterDemo  (capstone mini-project)
//
// 2-player top-down shooter. LOCAL player (WASD/buttons + click-to-fire) and
// one BOT player that orbits and fires periodically. Toggles independently:
//
//   RECONCILE     — apply Demo 1's input buffer + replay
//   LAG-COMP      — server rewinds for hit checks (Demo 2)
//   DELTA         — snapshots encode only entities that changed (Demo 3)
//   QUANTIZE      — positions sent as int16 over a known range (Demo 4)
//
// HUD: hits dealt, hits taken, kbps used (recomputed every second from
// `net.stats.sent` deltas), buffer depth. The 4 toggles compose: turn them
// all on and the game plays well under harsh network conditions; turn them
// all off and you can feel each problem the tier solved.
// =============================================================================
(function shooterDemo() {
    const canvas = document.getElementById('shooterCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('shRtt'),
        rttVal: document.getElementById('shRttVal'),
        jitter: document.getElementById('shJitter'),
        jitterVal: document.getElementById('shJitterVal'),
        loss: document.getElementById('shLoss'),
        lossVal: document.getElementById('shLossVal'),
        reconcile: document.getElementById('shReconcile'),
        lagComp: document.getElementById('shLagComp'),
        delta: document.getElementById('shDelta'),
        quant: document.getElementById('shQuant'),
        reset: document.getElementById('shReset'),
        info: document.getElementById('shInfo'),
        bandwidth: document.getElementById('shBandwidth'),
        btnLeft: document.getElementById('shLeft'),
        btnRight: document.getElementById('shRight'),
        btnUp: document.getElementById('shUp'),
        btnDown: document.getElementById('shDown'),
        fire: document.getElementById('shFire'),
    };

    const net = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: +els.jitter.value, lossRate: +els.loss.value / 100, seed: 41 });
    const serverEp = net.connect('server');
    const clientEp = net.connect('client');

    // SERVER state
    const sLocal = new Player(WORLD_W * 0.3, WORLD_H * 0.5);
    const sBot = new Player(WORLD_W * 0.7, WORLD_H * 0.5);
    let botTheta = 0;
    let highestAck = 0;
    let serverTime = 0;
    const sHistory = []; // {serverTime, local:{x,y}, bot:{x,y}}
    let lastSentSnap = null; // for delta: what we last actually sent

    // CLIENT state
    const cLocal = new Player(WORLD_W * 0.3, WORLD_H * 0.5);
    let lastAuth = null;
    const remoteSnaps = []; // {x,y,serverTime}
    const input = { ax: 0, ay: 0 };
    let lastInputSentAt = 0;
    let nextInputTick = 1;
    const inputBuffer = [];
    const counters = { dealt: 0, taken: 0, shots: 0, sentLastSec: 0, kbps: 0 };
    let bytesLastWindow = 0;
    let windowStart = performance.now();

    const INTERP_DELAY_MS = 100;
    const HIT_RADIUS = 13;
    const SHOT_TRAVEL_MS = 120;
    const shots = []; // {dir, startedAt, hit?: bool, owner:'local'|'bot'}

    serverEp.onMessage((from, m) => {
        if (m.kind === 'input') {
            applyInput(sLocal, { ax: m.ax, ay: m.ay });
            if (m.tick > highestAck) highestAck = m.tick;
        } else if (m.kind === 'fire') {
            // Hit check vs bot. With lag-comp, rewind to clientRenderTime.
            let bx = sBot.x, by = sBot.y;
            if (els.lagComp.checked && m.clientRenderTime !== undefined && sHistory.length >= 2) {
                let i = sHistory.length - 1;
                while (i > 0 && sHistory[i].serverTime > m.clientRenderTime) i--;
                const a = sHistory[i], b = sHistory[Math.min(i + 1, sHistory.length - 1)];
                const span = b.serverTime - a.serverTime;
                const t = span > 0 ? clamp((m.clientRenderTime - a.serverTime) / span, 0, 1) : 0;
                bx = lerp(a.bot.x, b.bot.x, t); by = lerp(a.bot.y, b.bot.y, t);
            }
            const dx = bx - m.from.x, dy = by - m.from.y;
            const ax = m.aim.x - m.from.x, ay = m.aim.y - m.from.y;
            const len = Math.hypot(ax, ay) || 1;
            // Distance from bot to the shot ray (closest-point-on-ray).
            const tProj = clamp((dx * ax + dy * ay) / (len * len), 0, 1);
            const px = m.from.x + ax * tProj, py = m.from.y + ay * tProj;
            const d = Math.hypot(bx - px, by - py);
            const hit = d < HIT_RADIUS;
            if (hit) {
                sBot.health--;
                // Bot respawn: when killed, reset to full HP and pick a new
                // orbit phase so it doesn't reappear next to its corpse.
                if (sBot.health <= 0) {
                    sBot.health = 5;
                    botTheta += Math.PI; // jump to the opposite side of the circle
                }
            }
            serverEp.send('client', { kind: 'fireResult', shotId: m.shotId, hit });
        }
    });

    clientEp.onMessage((from, m) => {
        if (m.kind === 'snapshot') {
            // Local: snap + reconcile.
            const snapL = m.local;
            if (snapL) {
                while (inputBuffer.length > 0 && inputBuffer[0].tick <= m.ackTick) inputBuffer.shift();
                cLocal.x = snapL.x; cLocal.y = snapL.y;
                cLocal.vx = snapL.vx; cLocal.vy = snapL.vy;
                if (els.reconcile.checked) {
                    for (const b of inputBuffer) {
                        applyInput(cLocal, { ax: b.ax, ay: b.ay });
                        integrate(cLocal, b.dt);
                    }
                }
                lastAuth = snapL;
            }
            const snapR = m.bot;
            if (snapR) {
                remoteSnaps.push({ ...snapR, serverTime: m.serverTime });
                const cutoff = m.serverTime - 2.0;
                while (remoteSnaps.length > 1 && remoteSnaps[0].serverTime < cutoff) remoteSnaps.shift();
            }
            // Bandwidth bookkeeping.
            bytesLastWindow += estimateBytes(m);
        } else if (m.kind === 'fireResult') {
            const s = shots.find(x => x.shotId === m.shotId && x.owner === 'local');
            if (s) { s.hit = m.hit; if (m.hit) counters.dealt++; }
        } else if (m.kind === 'botFire') {
            shots.push({ shotId: m.shotId, owner: 'bot', from: m.from, aim: m.aim, startedAt: performance.now() });
            // Bot's "hit" judgement is authoritative — server told us we got hit.
            if (m.hit) counters.taken++;
        }
    });

    attachKeyboardInput(canvas, input);
    attachButtonInput({ left: els.btnLeft, right: els.btnRight, up: els.btnUp, down: els.btnDown }, input);

    // Mouse aim + click-to-fire.
    let mouseX = WORLD_W / 2, mouseY = WORLD_H / 2;
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left - oxC;
        mouseY = e.clientY - rect.top - oy;
    });
    canvas.addEventListener('click', () => fireLocal());
    els.fire.addEventListener('click', () => fireLocal());

    function fireLocal() {
        const shotId = nextShotId++;
        const aim = { x: clamp(mouseX, 0, WORLD_W), y: clamp(mouseY, 0, WORLD_H) };
        const from = { x: cLocal.x, y: cLocal.y };
        shots.push({ shotId, owner: 'local', from, aim, startedAt: performance.now() });
        counters.shots++;
        const renderTime = serverTime - INTERP_DELAY_MS / 1000;
        clientEp.send('server', { kind: 'fire', shotId, from, aim, clientRenderTime: renderTime });
    }
    let nextShotId = 1;

    function syncSliders() {
        els.rttVal.textContent = fmtMs(+els.rtt.value);
        els.jitterVal.textContent = '±' + fmtMs(+els.jitter.value);
        els.lossVal.textContent = (+els.loss.value) + ' %';
        net.setParams({ rttMs: +els.rtt.value, jitterMs: +els.jitter.value, lossRate: +els.loss.value / 100 });
    }
    ['rtt','jitter','loss'].forEach(k => els[k].addEventListener('input', syncSliders));
    syncSliders();

    els.reset.addEventListener('click', () => {
        sLocal.x = WORLD_W*0.3; sLocal.y = WORLD_H*0.5; sLocal.vx = sLocal.vy = 0; sLocal.health = 5;
        sBot.x = WORLD_W*0.7; sBot.y = WORLD_H*0.5; sBot.health = 5;
        cLocal.x = WORLD_W*0.3; cLocal.y = WORLD_H*0.5; cLocal.vx = cLocal.vy = 0;
        botTheta = 0; serverTime = 0; highestAck = 0;
        sHistory.length = 0; remoteSnaps.length = 0;
        inputBuffer.length = 0; nextInputTick = 1;
        counters.dealt = counters.taken = counters.shots = 0;
        shots.length = 0; lastAuth = null; lastSentSnap = null;
        bytesLastWindow = 0; windowStart = performance.now();
        net.flush();
    });

    const SIM_DT = 1 / SIM_HZ;
    const SNAPSHOT_INTERVAL = 1 / 15;
    let serverAccum = 0, snapAccum = 0, botFireAccum = 0;
    let last = performance.now();
    // Layout
    const oxS = 30, oxC = canvas.width - WORLD_W - 30, oy = 30;

    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        // Client: predict + send input.
        applyInput(cLocal, input);
        integrate(cLocal, dt);
        if (now - lastInputSentAt >= 1000 / INPUT_TICK_HZ) {
            const tick = nextInputTick++;
            inputBuffer.push({ tick, ax: input.ax, ay: input.ay, dt: 1 / INPUT_TICK_HZ });
            clientEp.send('server', { kind: 'input', tick, ax: input.ax, ay: input.ay });
            lastInputSentAt = now;
        }

        // Server sim.
        serverAccum += dt; snapAccum += dt; botFireAccum += dt;
        while (serverAccum >= SIM_DT) {
            serverAccum -= SIM_DT;
            integrate(sLocal, SIM_DT);
            // Bot orbits + occasionally lunges.
            botTheta += 1.0 * SIM_DT;
            const cx = WORLD_W * 0.6, cy = WORLD_H * 0.5, R = WORLD_H * 0.32;
            sBot.x = cx + Math.cos(botTheta) * R;
            sBot.y = cy + Math.sin(botTheta) * R;
            serverTime += SIM_DT;
            sHistory.push({ serverTime, local: { x: sLocal.x, y: sLocal.y }, bot: { x: sBot.x, y: sBot.y } });
            while (sHistory.length > HISTORY_DEPTH) sHistory.shift();
        }
        // Bot fires every 2 s at the local player's last-known position.
        if (botFireAccum >= 2.0) {
            botFireAccum -= 2.0;
            const aim = { x: sLocal.x, y: sLocal.y };
            const from = { x: sBot.x, y: sBot.y };
            // Bot's shot — server-authoritative resolution.
            const dx = sLocal.x - from.x, dy = sLocal.y - from.y;
            const ax = aim.x - from.x, ay = aim.y - from.y;
            const len = Math.hypot(ax, ay) || 1;
            const tProj = clamp((dx * ax + dy * ay) / (len * len), 0, 1);
            const px = from.x + ax * tProj, py = from.y + ay * tProj;
            const hit = Math.hypot(sLocal.x - px, sLocal.y - py) < HIT_RADIUS;
            if (hit) {
                sLocal.health--;
                // Respawn rather than death-spiral into negative HP. Teleport
                // to a fresh spot so the next bot shot doesn't immediately
                // hit the corpse. Five-of-five HP again so the teaching
                // counter stays readable.
                if (sLocal.health <= 0) {
                    sLocal.health = 5;
                    sLocal.x = WORLD_W * 0.25 + Math.random() * WORLD_W * 0.5;
                    sLocal.y = WORLD_H * 0.25 + Math.random() * WORLD_H * 0.5;
                    sLocal.vx = sLocal.vy = 0;
                }
            }
            const shotId = -nextShotId++;
            serverEp.send('client', { kind: 'botFire', shotId, from, aim, hit });
        }

        while (snapAccum >= SNAPSHOT_INTERVAL) {
            snapAccum -= SNAPSHOT_INTERVAL;
            // Build the snapshot. Apply delta + quantization based on toggles.
            let snapLocal = cloneSnapshot(sLocal);
            let snapBot   = cloneSnapshot(sBot);

            // Quantize: round positions to int16 over ±512.
            if (els.quant.checked) {
                snapLocal.x = dequantize(quantize(snapLocal.x, 512, 16), 512, 16);
                snapLocal.y = dequantize(quantize(snapLocal.y, 512, 16), 512, 16);
                snapBot.x   = dequantize(quantize(snapBot.x,   512, 16), 512, 16);
                snapBot.y   = dequantize(quantize(snapBot.y,   512, 16), 512, 16);
            }

            // Delta: if a sub-state hasn't changed since our last sent snap,
            // omit it. (We still always send `local` because it acks input;
            // an omitted bot field means "unchanged — use the last value".)
            let outLocal = snapLocal, outBot = snapBot;
            if (els.delta.checked && lastSentSnap) {
                if (lastSentSnap.bot && Math.hypot(lastSentSnap.bot.x - snapBot.x, lastSentSnap.bot.y - snapBot.y) < 0.5) {
                    outBot = null;
                }
            }
            const msg = { kind: 'snapshot', local: outLocal, bot: outBot, serverTime, ackTick: highestAck };
            serverEp.send('client', msg);
            lastSentSnap = { local: snapLocal, bot: snapBot };
        }
        net.tick(now);

        // Bandwidth window.
        if (now - windowStart >= 1000) {
            counters.kbps = (bytesLastWindow * 8 / 1000) / ((now - windowStart) / 1000);
            bytesLastWindow = 0; windowStart = now;
        }

        // Render — single canvas with SERVER + CLIENT panels.
        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawPanel(ctx, oxS, oy, `SERVER (truth) · HP local ${sLocal.health}/5  bot ${sBot.health}/5`, NET_COLORS.server);
        drawPanel(ctx, oxC, oy, 'CLIENT (you)', NET_COLORS.client);

        // Server panel — authoritative positions.
        drawPlayer(ctx, oxS, oy, sLocal, NET_COLORS.client);
        drawPlayer(ctx, oxS, oy, sBot, NET_COLORS.remote);

        // Client panel — predicted local + interpolated bot.
        drawPlayer(ctx, oxC, oy, cLocal, NET_COLORS.client);
        if (remoteSnaps.length >= 2) {
            const renderTime = serverTime - INTERP_DELAY_MS / 1000;
            let i = remoteSnaps.length - 1;
            while (i > 0 && remoteSnaps[i].serverTime > renderTime) i--;
            const a = remoteSnaps[i], b = remoteSnaps[Math.min(i + 1, remoteSnaps.length - 1)];
            const span = b.serverTime - a.serverTime;
            const t = span > 0 ? clamp((renderTime - a.serverTime) / span, 0, 1) : 0;
            const ix = lerp(a.x, b.x, t), iy = lerp(a.y, b.y, t);
            ctx.fillStyle = NET_COLORS.remote;
            ctx.beginPath(); ctx.arc(oxC + ix, oy + iy, 10, 0, Math.PI * 2); ctx.fill();
        }
        if (lastAuth) drawGhost(ctx, oxC, oy, lastAuth, NET_COLORS.ghost);

        // Aim line on the client panel.
        ctx.strokeStyle = NET_COLORS.beam; ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(oxC + cLocal.x, oy + cLocal.y);
        ctx.lineTo(oxC + clamp(mouseX, 0, WORLD_W), oy + clamp(mouseY, 0, WORLD_H));
        ctx.stroke();
        ctx.setLineDash([]);

        // Shot beams.
        for (const s of shots) {
            const t = clamp((now - s.startedAt) / SHOT_TRAVEL_MS, 0, 1);
            const ex = lerp(s.from.x, s.aim.x, t), ey = lerp(s.from.y, s.aim.y, t);
            const color = s.hit === undefined ? NET_COLORS.beam : (s.hit ? NET_COLORS.hit : NET_COLORS.miss);
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            const ox = s.owner === 'local' ? oxC : oxS; // local shot rendered on client view; bot shot on server view
            ctx.beginPath(); ctx.moveTo(ox + s.from.x, oy + s.from.y); ctx.lineTo(ox + ex, oy + ey); ctx.stroke();
        }
        for (let i = shots.length - 1; i >= 0; i--) if (now - shots[i].startedAt > 600) shots.splice(i, 1);

        const flags = [];
        flags.push(els.reconcile.checked ? 'RECON' : 'no-recon');
        flags.push(els.lagComp.checked ? 'LAG-COMP' : 'no-lag-comp');
        flags.push(els.delta.checked ? 'DELTA' : 'full');
        flags.push(els.quant.checked ? 'QUANT' : 'no-quant');
        els.info.textContent = `[${flags.join(' · ')}]   hits dealt ${counters.dealt} / shots ${counters.shots} · hits taken ${counters.taken} · buffered ${inputBuffer.length}`;
        els.bandwidth.textContent = `bandwidth: ${counters.kbps.toFixed(1)} kbps  ·  network: sent ${net.stats.sent} · delivered ${net.stats.delivered} · dropped ${net.stats.dropped}`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
