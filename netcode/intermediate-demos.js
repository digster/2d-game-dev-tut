// =============================================================================
// NETCODE — INTERMEDIATE TIER DEMOS  ("Authority & Movement")
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak into the global
// scope. Each demo runs only if its target canvas exists in the DOM — that way
// this file is safe to include from any page in the track even if a canvas is
// missing.
//
// What this tier teaches (in order):
//   1. naiveDemo            — wait for the server: feel the lag
//   2. predictionDemo       — apply input locally, snap on server reply
//   3. interpolationDemo    — render REMOTE players ~1 snapshot in the past
//   4. snapVsSmoothDemo     — soften corrections with a smoothing window
//   5. arenaDemo            — capstone: prediction + interp + smoothing together
//
// CRITICAL DISCIPLINE: server-state and client-state are SEPARATE objects in
// every demo. They communicate ONLY through FakeNetwork messages. Even though
// they're in the same browser tab, never read the server's player from a
// client renderer — that would lie about what the client actually knows.
//
// UNITS (carried over from the Beginner tier):
//   time         ms (for network timing), seconds (for sim dt)
//   position     pixels in a small "world" box (WORLD_W × WORLD_H)
//   velocity     px/s
//   tick rate    Hz
//
// DEPENDENCIES (loaded by the tier HTML BEFORE this file):
//   shared/utils.js        — Vector2D, lerp, clamp
//   net/seeded-rng.js      — window.SeededRng
//   net/fake-network.js    — window.FakeNetwork
//
// Top-level names this file introduces (verified absent from shared/utils.js
// — beginner-demos.js redeclarations are intentional, since the two files are
// never loaded on the same page):
//   NET_COLORS, MAX_DT, SIM_HZ, WORLD_W, WORLD_H, INPUT_TICK_HZ,
//   Player, applyInput, integrate, cloneSnapshot, lerpV, fmtMs
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
// Shared palette — identical to beginner-demos.js so the whole netcode track
// reads as one visual family. Redeclared because each tier page loads only
// its own *-demos.js (never both at once).
// ---------------------------------------------------------------------------
const NET_COLORS = {
    bg:           '#0d1117',
    panel:        '#1a1f3a',
    panelEdge:    '#2d3354',
    laneFill:     '#161b2c',
    laneEdge:     '#2e3548',
    grid:         '#252b4a',
    client:       '#4fc3f7',   // local-player primary
    server:       '#ffa726',   // authoritative position
    ghost:        '#66bb6a',   // predicted / interpolated overlay
    correction:   '#ef5350',
    remote:       '#ba68c8',   // remote-player primary (interpolation demos)
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    accent:       '#fbc02d',
};

const MAX_DT = 0.05;            // seconds — same safety rail as Beginner
const SIM_HZ = 60;              // server-side simulation tick rate
const INPUT_TICK_HZ = 30;       // client sends input at this rate (less than SIM_HZ — typical)
const WORLD_W = 320;            // each "arena" panel is this wide
const WORLD_H = 220;            //                          and this tall
const SPEED = 140;              // player px/s — slow enough to see latency clearly

// Vector lerp for 2D positions. The shared `lerp` operates on scalars.
function lerpV(a, b, t) {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function fmtMs(ms) {
    if (ms < 10) return ms.toFixed(1) + ' ms';
    return Math.round(ms) + ' ms';
}

// ---------------------------------------------------------------------------
// Player — a tiny mutable state container used by every demo in this tier.
// Just position + velocity. Movement is `applyInput` + `integrate`.
// ---------------------------------------------------------------------------
class Player {
    constructor(x = WORLD_W / 2, y = WORLD_H / 2) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
    }
}

// Input is a {ax, ay} pair where each is -1, 0, or +1. Sets the player's
// velocity directly (no acceleration/inertia at this tier — that's the
// Advanced tier's job once we get to bandwidth tradeoffs).
function applyInput(player, input) {
    const mag = Math.hypot(input.ax, input.ay) || 1;
    player.vx = input.ax / mag * SPEED;
    player.vy = input.ay / mag * SPEED;
}

// Step the player forward by dt seconds. Clamps to the arena box.
function integrate(player, dt) {
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    // World boundary clamp — players bounce-stop at walls.
    if (player.x < 12) { player.x = 12; player.vx = 0; }
    if (player.x > WORLD_W - 12) { player.x = WORLD_W - 12; player.vx = 0; }
    if (player.y < 12) { player.y = 12; player.vy = 0; }
    if (player.y > WORLD_H - 12) { player.y = WORLD_H - 12; player.vy = 0; }
}

function cloneSnapshot(player, tick) {
    return { x: player.x, y: player.y, vx: player.vx, vy: player.vy, tick };
}

// ---------------------------------------------------------------------------
// Reusable arena drawing primitives. All demos draw two side-by-side panels
// labelled SERVER and CLIENT (or just one panel for the interpolation demo).
// Each panel has a faint grid floor so player motion is visually anchored.
// ---------------------------------------------------------------------------
function drawPanel(ctx, ox, oy, label, color) {
    ctx.fillStyle = NET_COLORS.panel;
    ctx.fillRect(ox, oy, WORLD_W, WORLD_H);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 0.5, oy + 0.5, WORLD_W - 1, WORLD_H - 1);
    // Grid floor.
    ctx.strokeStyle = NET_COLORS.grid;
    ctx.lineWidth = 1;
    for (let gx = 40; gx < WORLD_W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(ox + gx + 0.5, oy + 1); ctx.lineTo(ox + gx + 0.5, oy + WORLD_H - 1); ctx.stroke();
    }
    for (let gy = 40; gy < WORLD_H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(ox + 1, oy + gy + 0.5); ctx.lineTo(ox + WORLD_W - 1, oy + gy + 0.5); ctx.stroke();
    }
    // Label badge.
    ctx.fillStyle = color;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, ox + 8, oy + 18);
}

function drawPlayer(ctx, ox, oy, p, color, radius = 10) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox + p.x, oy + p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    // Heading line (velocity direction).
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + p.x, oy + p.y);
        ctx.lineTo(ox + p.x + p.vx / sp * 16, oy + p.y + p.vy / sp * 16);
        ctx.stroke();
    }
}

// "Ghost" outline — used for predicted/interpolated overlays.
function drawGhost(ctx, ox, oy, p, color, radius = 10) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(ox + p.x, oy + p.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------
// Input wiring — every demo wants keyboard arrows + on-screen direction
// buttons. `attachKeyboardInput` wires a focus-aware keyboard listener;
// `attachButtonInput` wires hold-able buttons. Both update the same input
// state object, so the demo's logic doesn't care which the user uses.
// ---------------------------------------------------------------------------
function attachKeyboardInput(canvas, input) {
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    canvas.addEventListener('mousedown', () => canvas.focus());
    const keys = new Set();
    function updateFromKeys() {
        input.ax = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        input.ay = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    }
    canvas.addEventListener('keydown', e => {
        let key = null;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') key = 'left';
        if (e.code === 'ArrowRight' || e.code === 'KeyD') key = 'right';
        if (e.code === 'ArrowUp' || e.code === 'KeyW') key = 'up';
        if (e.code === 'ArrowDown' || e.code === 'KeyS') key = 'down';
        if (key) { keys.add(key); updateFromKeys(); e.preventDefault(); }
    });
    canvas.addEventListener('keyup', e => {
        let key = null;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') key = 'left';
        if (e.code === 'ArrowRight' || e.code === 'KeyD') key = 'right';
        if (e.code === 'ArrowUp' || e.code === 'KeyW') key = 'up';
        if (e.code === 'ArrowDown' || e.code === 'KeyS') key = 'down';
        if (key) { keys.delete(key); updateFromKeys(); e.preventDefault(); }
    });
    canvas.addEventListener('blur', () => { keys.clear(); updateFromKeys(); });
}

function attachButtonInput(buttons, input) {
    // buttons = {left, right, up, down} -> DOM elements
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
    bind(buttons.left,  'ax', -1);
    bind(buttons.right, 'ax', +1);
    bind(buttons.up,    'ay', -1);
    bind(buttons.down,  'ay', +1);
}

// =============================================================================
// DEMO 1 — naiveDemo
//
// The simplest possible network model: the client does NOTHING on input
// except send it to the server. The client's displayed position is whatever
// the server last said. Result: input-to-displayed-action delay = full RTT.
// Drag the RTT slider to feel it.
// =============================================================================
(function naiveDemo() {
    const canvas = document.getElementById('naiveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('naiveRtt'),
        rttVal: document.getElementById('naiveRttVal'),
        reset: document.getElementById('naiveReset'),
        info: document.getElementById('naiveInfo'),
        btnLeft:  document.getElementById('naiveLeft'),
        btnRight: document.getElementById('naiveRight'),
        btnUp:    document.getElementById('naiveUp'),
        btnDown:  document.getElementById('naiveDown'),
    };

    const net = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: 0, lossRate: 0, seed: 7 });
    const serverEp = net.connect('server');
    const clientEp = net.connect('client');

    // Two SEPARATE player states. Server is authoritative; client just displays
    // whatever the latest snapshot says.
    const serverPlayer = new Player();
    const clientDisplay = new Player();   // mirrors the latest received snapshot
    const input = { ax: 0, ay: 0 };
    let lastInputSentAt = 0;

    // Server: applies inputs as they arrive, sends a snapshot every SIM tick.
    serverEp.onMessage((from, msg) => {
        if (msg.kind === 'input') {
            applyInput(serverPlayer, msg.input);
        }
    });

    // Client: receives snapshots, mirrors them.
    clientEp.onMessage((from, msg) => {
        if (msg.kind === 'snapshot') {
            clientDisplay.x  = msg.snap.x;
            clientDisplay.y  = msg.snap.y;
            clientDisplay.vx = msg.snap.vx;
            clientDisplay.vy = msg.snap.vy;
        }
    });

    attachKeyboardInput(canvas, input);
    attachButtonInput({ left: els.btnLeft, right: els.btnRight, up: els.btnUp, down: els.btnDown }, input);

    els.rtt.addEventListener('input', () => {
        const rtt = +els.rtt.value;
        els.rttVal.textContent = fmtMs(rtt);
        net.setParams({ rttMs: rtt });
    });
    els.reset.addEventListener('click', () => {
        serverPlayer.x = WORLD_W / 2; serverPlayer.y = WORLD_H / 2; serverPlayer.vx = 0; serverPlayer.vy = 0;
        clientDisplay.x = serverPlayer.x; clientDisplay.y = serverPlayer.y; clientDisplay.vx = 0; clientDisplay.vy = 0;
        net.flush(); net.resetStats();
    });

    // Server loop — fixed-step simulation + snapshot broadcast.
    let serverAccum = 0;
    let snapshotAccum = 0;
    const SNAPSHOT_INTERVAL = 1 / 20; // 20 Hz snapshot rate
    const SIM_DT = 1 / SIM_HZ;

    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        // Client sends inputs at INPUT_TICK_HZ.
        if (now - lastInputSentAt >= 1000 / INPUT_TICK_HZ) {
            clientEp.send('server', { kind: 'input', input: { ax: input.ax, ay: input.ay } });
            lastInputSentAt = now;
        }

        // Server: run fixed-step sim ticks.
        serverAccum += dt;
        snapshotAccum += dt;
        while (serverAccum >= SIM_DT) {
            serverAccum -= SIM_DT;
            integrate(serverPlayer, SIM_DT);
        }
        while (snapshotAccum >= SNAPSHOT_INTERVAL) {
            snapshotAccum -= SNAPSHOT_INTERVAL;
            serverEp.send('client', { kind: 'snapshot', snap: cloneSnapshot(serverPlayer) });
        }

        net.tick(now);

        // Render.
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxS = 30, oxC = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxS, oy, 'SERVER (truth)', NET_COLORS.server);
        drawPanel(ctx, oxC, oy, 'CLIENT (what you see)', NET_COLORS.client);
        drawPlayer(ctx, oxS, oy, serverPlayer, NET_COLORS.server);
        drawPlayer(ctx, oxC, oy, clientDisplay, NET_COLORS.client);

        // Hint between the panels.
        ctx.fillStyle = NET_COLORS.labelMuted;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('input ——→', canvas.width / 2, oy + 60);
        ctx.fillText('←—— snapshot', canvas.width / 2, oy + 90);

        const dx = serverPlayer.x - clientDisplay.x;
        const dy = serverPlayer.y - clientDisplay.y;
        const gap = Math.hypot(dx, dy);
        els.info.textContent = `RTT ${els.rtt.value} ms · gap server↔client = ${gap.toFixed(0)} px · (focus the canvas + use WASD/arrows, or hold the buttons)`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 2 — predictionDemo
//
// Client-side prediction: apply input LOCALLY immediately (so the screen
// responds to your finger), and ALSO send it to the server. When the server's
// snapshot arrives, naively snap the client to the authoritative position.
// This is the simplest possible "predict and reconcile" — no input buffer,
// no replay. Snaps are visible when the prediction has drifted (server's slow
// SIM_HZ + your INPUT_TICK_HZ rounding + jitter add up to small disagreements
// every snapshot).
// =============================================================================
(function predictionDemo() {
    const canvas = document.getElementById('predictionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('predRtt'),
        rttVal: document.getElementById('predRttVal'),
        jitter: document.getElementById('predJitter'),
        jitterVal: document.getElementById('predJitterVal'),
        predict: document.getElementById('predToggle'),
        reset: document.getElementById('predReset'),
        info: document.getElementById('predInfo'),
        btnLeft:  document.getElementById('predLeft'),
        btnRight: document.getElementById('predRight'),
        btnUp:    document.getElementById('predUp'),
        btnDown:  document.getElementById('predDown'),
    };

    const net = new FakeNetwork({
        rttMs: +els.rtt.value, jitterMs: +els.jitter.value, lossRate: 0, seed: 11,
    });
    const serverEp = net.connect('server');
    const clientEp = net.connect('client');

    const serverPlayer = new Player();
    const clientPlayer = new Player();    // the LOCAL predicted player
    let lastAuthoritative = null;          // last snapshot received (for the ghost)
    const input = { ax: 0, ay: 0 };
    let lastInputSentAt = 0;
    let lastSnapCounted = 0;
    let snapsThisSec = 0;
    let snapsLastReport = 0;
    let lastReportT = performance.now();

    serverEp.onMessage((from, msg) => {
        if (msg.kind === 'input') applyInput(serverPlayer, msg.input);
    });
    clientEp.onMessage((from, msg) => {
        if (msg.kind === 'snapshot') {
            lastAuthoritative = msg.snap;
            snapsThisSec++;
            if (els.predict.checked) {
                // Predicted + snap: keep client predicting, but on snapshot
                // arrival, snap to authoritative. The visible "jitter" of the
                // predicted ball comes from this — it's the teaching point.
                clientPlayer.x = msg.snap.x;
                clientPlayer.y = msg.snap.y;
                clientPlayer.vx = msg.snap.vx;
                clientPlayer.vy = msg.snap.vy;
            }
            // If prediction OFF, we'll snap every render — handled in frame().
        }
    });

    attachKeyboardInput(canvas, input);
    attachButtonInput({ left: els.btnLeft, right: els.btnRight, up: els.btnUp, down: els.btnDown }, input);

    function syncSliders() {
        const rtt = +els.rtt.value;
        const jitter = +els.jitter.value;
        els.rttVal.textContent = fmtMs(rtt);
        els.jitterVal.textContent = '±' + fmtMs(jitter);
        net.setParams({ rttMs: rtt, jitterMs: jitter });
    }
    els.rtt.addEventListener('input', syncSliders);
    els.jitter.addEventListener('input', syncSliders);
    syncSliders();

    els.reset.addEventListener('click', () => {
        serverPlayer.x = WORLD_W/2; serverPlayer.y = WORLD_H/2; serverPlayer.vx = 0; serverPlayer.vy = 0;
        clientPlayer.x = WORLD_W/2; clientPlayer.y = WORLD_H/2; clientPlayer.vx = 0; clientPlayer.vy = 0;
        lastAuthoritative = null;
        net.flush();
    });

    let serverAccum = 0, snapshotAccum = 0;
    const SNAPSHOT_INTERVAL = 1 / 15; // 15 Hz snapshots — low enough that the snap is visible
    const SIM_DT = 1 / SIM_HZ;

    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        // Client behaviour split on the prediction toggle:
        if (els.predict.checked) {
            // Predict locally: apply input + integrate every frame.
            applyInput(clientPlayer, input);
            integrate(clientPlayer, dt);
        }
        // Always send input to the server.
        if (now - lastInputSentAt >= 1000 / INPUT_TICK_HZ) {
            clientEp.send('server', { kind: 'input', input: { ax: input.ax, ay: input.ay } });
            lastInputSentAt = now;
        }

        // Server: fixed-step simulation + snapshot.
        serverAccum += dt;
        snapshotAccum += dt;
        while (serverAccum >= SIM_DT) {
            serverAccum -= SIM_DT;
            integrate(serverPlayer, SIM_DT);
        }
        while (snapshotAccum >= SNAPSHOT_INTERVAL) {
            snapshotAccum -= SNAPSHOT_INTERVAL;
            serverEp.send('client', { kind: 'snapshot', snap: cloneSnapshot(serverPlayer) });
        }

        net.tick(now);

        // Snapshot-rate measurement for the HUD.
        if (now - lastReportT > 1000) {
            snapsLastReport = snapsThisSec; snapsThisSec = 0; lastReportT = now;
        }

        // If prediction is OFF, the client display is just the last snapshot.
        if (!els.predict.checked && lastAuthoritative) {
            clientPlayer.x = lastAuthoritative.x; clientPlayer.y = lastAuthoritative.y;
            clientPlayer.vx = lastAuthoritative.vx; clientPlayer.vy = lastAuthoritative.vy;
        }

        // Render.
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxS = 30, oxC = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxS, oy, 'SERVER (truth)', NET_COLORS.server);
        drawPanel(ctx, oxC, oy, els.predict.checked ? 'CLIENT (predicted + snap)' : 'CLIENT (naive — no prediction)', NET_COLORS.client);
        drawPlayer(ctx, oxS, oy, serverPlayer, NET_COLORS.server);
        drawPlayer(ctx, oxC, oy, clientPlayer, NET_COLORS.client);
        // Ghost overlay on client showing the latest authoritative position
        // (so the user can SEE the snap distance when prediction is on).
        if (els.predict.checked && lastAuthoritative) {
            drawGhost(ctx, oxC, oy, lastAuthoritative, NET_COLORS.ghost);
        }

        const dx = serverPlayer.x - clientPlayer.x;
        const dy = serverPlayer.y - clientPlayer.y;
        const gap = Math.hypot(dx, dy);
        els.info.textContent =
            `prediction ${els.predict.checked ? 'ON' : 'OFF'} · RTT ${els.rtt.value} ms · ` +
            `snapshot rate ${snapsLastReport} Hz · gap server↔client = ${gap.toFixed(0)} px`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 3 — interpolationDemo
//
// Focus: REMOTE entities. There's no input — a "remote" entity moves in a
// circle on the server. The server sends snapshots at a slider-controlled
// rate. The client renders that entity in two parallel panels:
//
//   LEFT  ("Snap to latest")        Render the most recently received snapshot.
//                                   At low snapshot rates this LOOKS LIKE
//                                   the entity teleports between snapshots.
//
//   RIGHT ("Interpolation buffer")  Keep the last few snapshots in a buffer.
//                                   Render at time `now - interpDelay`, lerping
//                                   between the two snapshots straddling that
//                                   render-time. Smooth motion, at the cost
//                                   of rendering one interpDelay in the past.
//
// A faint "actual server position right now" outline overlay is drawn on the
// right panel so the user can SEE the cost of the buffer (the interp ball is
// behind reality by ~interpDelay).
// =============================================================================
(function interpolationDemo() {
    const canvas = document.getElementById('interpolationCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        snapRate: document.getElementById('interpSnapRate'),
        snapRateVal: document.getElementById('interpSnapRateVal'),
        delay: document.getElementById('interpDelay'),
        delayVal: document.getElementById('interpDelayVal'),
        showTruth: document.getElementById('interpShowTruth'),
        info: document.getElementById('interpInfo'),
    };

    const net = new FakeNetwork({ rttMs: 80, jitterMs: 10, lossRate: 0, seed: 13 });
    const serverEp = net.connect('server');
    const clientEp = net.connect('client');

    // The remote entity: moves in a circle around the panel centre.
    const cx = WORLD_W / 2, cy = WORLD_H / 2, R = Math.min(WORLD_W, WORLD_H) * 0.35;
    let theta = 0;
    const ANGULAR_VEL = 1.2; // rad/s
    const remote = new Player(cx + R, cy);

    // What the client knows
    const snapshotBuffer = []; // {x, y, vx, vy, serverTime} sorted ascending by serverTime
    let latestSnap = null;     // for the "snap to latest" panel

    // Server time = monotonic seconds. We tag every outgoing snapshot with it.
    let serverTime = 0;

    serverEp.onMessage(() => {}); // server doesn't accept input in this demo
    clientEp.onMessage((from, msg) => {
        if (msg.kind === 'snapshot') {
            latestSnap = msg.snap;
            snapshotBuffer.push({ ...msg.snap, serverTime: msg.serverTime });
            // Drop snapshots older than 2 s — keeps memory bounded.
            const cutoff = msg.serverTime - 2.0;
            while (snapshotBuffer.length > 1 && snapshotBuffer[0].serverTime < cutoff) snapshotBuffer.shift();
        }
    });

    let serverAccum = 0, snapshotAccum = 0;
    const SIM_DT = 1 / SIM_HZ;

    let clientClockOffset = null; // serverTime - clientTime, established on first snapshot
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        // Server simulation: move the remote in a circle.
        serverAccum += dt;
        snapshotAccum += dt;
        while (serverAccum >= SIM_DT) {
            serverAccum -= SIM_DT;
            theta += ANGULAR_VEL * SIM_DT;
            remote.x = cx + Math.cos(theta) * R;
            remote.y = cy + Math.sin(theta) * R;
            serverTime += SIM_DT;
        }

        const snapInterval = 1 / (+els.snapRate.value);
        els.snapRateVal.textContent = (+els.snapRate.value) + ' Hz';
        while (snapshotAccum >= snapInterval) {
            snapshotAccum -= snapInterval;
            serverEp.send('client', {
                kind: 'snapshot',
                snap: cloneSnapshot(remote),
                serverTime,
            });
        }

        net.tick(now);

        // Estimate client's notion of server time. Naïvely: latest received
        // serverTime + half RTT. Robust to jitter only with a smoothed
        // estimator, but at this tier we just use the latest.
        if (latestSnap && clientClockOffset === null) {
            // First arrival: anchor clientClockOffset so that "now" maps to
            // the server time of the latest snapshot + half RTT.
            clientClockOffset = (snapshotBuffer[snapshotBuffer.length - 1].serverTime) + 0.04 - (now / 1000);
        }
        const interpDelayMs = +els.delay.value;
        els.delayVal.textContent = interpDelayMs + ' ms';

        // ---- DRAW -----
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxL = 30, oxR = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxL, oy, 'Snap to latest snapshot', NET_COLORS.remote);
        drawPanel(ctx, oxR, oy, 'Interpolation buffer', NET_COLORS.ghost);

        // Light circle path for visual reference.
        ctx.strokeStyle = NET_COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(oxL + cx, oy + cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(oxR + cx, oy + cy, R, 0, Math.PI * 2); ctx.stroke();

        // LEFT: latest snapshot only.
        if (latestSnap) {
            drawPlayer(ctx, oxL, oy, latestSnap, NET_COLORS.remote);
        }

        // RIGHT: render at time (clientServerNow - interpDelay), lerp between
        // the two surrounding snapshots in the buffer.
        let interpPos = null;
        if (snapshotBuffer.length >= 2 && clientClockOffset !== null) {
            const renderServerTime = (now / 1000) + clientClockOffset - interpDelayMs / 1000;
            // Find the two snapshots straddling renderServerTime.
            let i = snapshotBuffer.length - 1;
            while (i > 0 && snapshotBuffer[i].serverTime > renderServerTime) i--;
            const a = snapshotBuffer[i];
            const b = snapshotBuffer[Math.min(i + 1, snapshotBuffer.length - 1)];
            const span = b.serverTime - a.serverTime;
            const t = span > 0 ? clamp((renderServerTime - a.serverTime) / span, 0, 1) : 0;
            interpPos = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), vx: 0, vy: 0 };
            drawPlayer(ctx, oxR, oy, interpPos, NET_COLORS.ghost);
        }

        // Show the "real right-now" position as a dashed outline overlay on the right.
        if (els.showTruth.checked) {
            drawGhost(ctx, oxR, oy, remote, NET_COLORS.server, 12);
        }

        // Status text on the right panel: how far behind the interp ball is.
        if (interpPos) {
            const drift = Math.hypot(remote.x - interpPos.x, remote.y - interpPos.y);
            ctx.fillStyle = NET_COLORS.labelMuted;
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`behind reality by ${drift.toFixed(0)} px`, oxR + 8, oy + WORLD_H - 10);
        }

        els.info.textContent =
            `snapshots in buffer: ${snapshotBuffer.length} · ` +
            `snapshot rate: ${els.snapRate.value} Hz (one every ${(1000/+els.snapRate.value).toFixed(0)} ms) · ` +
            `interp delay: ${interpDelayMs} ms`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 4 — snapVsSmoothDemo
//
// Visualises what happens at the MOMENT of a server correction. Two players
// move in identical straight lines; every ~1.5 seconds a "correction" event
// teleports them sideways by a random amount. The LEFT player snaps instantly;
// the RIGHT player smooths the correction over `smoothMs` milliseconds via
// frame-rate-correct exponential interpolation (1 - exp(-k·dt)).
// =============================================================================
(function snapVsSmoothDemo() {
    const canvas = document.getElementById('snapVsSmoothCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        smoothMs: document.getElementById('svsSmoothMs'),
        smoothMsVal: document.getElementById('svsSmoothMsVal'),
        corrInterval: document.getElementById('svsCorrInterval'),
        corrIntervalVal: document.getElementById('svsCorrIntervalVal'),
        info: document.getElementById('svsInfo'),
    };

    // Two players sharing a path along y. They differ only in HOW they apply
    // corrections.
    const rng = new SeededRng(17);
    let snapPlayer = new Player(40, WORLD_H / 2);
    let smoothPlayer = new Player(40, WORLD_H / 2);
    let targetY = WORLD_H / 2;        // where corrections aim
    let corrTimer = 0;
    let lastCorrMag = 0;
    let maxJump = 0;

    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        const smoothMs = +els.smoothMs.value;
        const corrIntervalMs = +els.corrInterval.value;
        els.smoothMsVal.textContent = smoothMs + ' ms';
        els.corrIntervalVal.textContent = (corrIntervalMs / 1000).toFixed(1) + ' s';

        // Both players move right at SPEED, bounce off the right edge.
        snapPlayer.x += SPEED * dt;
        smoothPlayer.x += SPEED * dt;
        if (snapPlayer.x > WORLD_W - 12) snapPlayer.x = 40;
        if (smoothPlayer.x > WORLD_W - 12) smoothPlayer.x = 40;

        // Periodic correction event.
        corrTimer += dt * 1000;
        if (corrTimer >= corrIntervalMs) {
            corrTimer = 0;
            const newY = rng.range(40, WORLD_H - 40);
            lastCorrMag = newY - targetY;
            maxJump = Math.max(maxJump, Math.abs(lastCorrMag));
            targetY = newY;
            // Snap player: jumps instantly.
            const prevSnapY = snapPlayer.y;
            snapPlayer.y = targetY;
            // (smooth player keeps lerping toward targetY each frame)
            // We only track the snap delta this frame — useful HUD number.
            void prevSnapY;
        }

        // Smooth update via frame-rate-correct exponential decay.
        // Equivalent to lerp(current, target, 1 - exp(-k·dt)) where k is set
        // so that ~99% of the gap closes in smoothMs.
        if (smoothMs <= 0) {
            smoothPlayer.y = targetY;
        } else {
            const k = -Math.log(0.01) / (smoothMs / 1000); // 1/s; "99% in smoothMs"
            const alpha = 1 - Math.exp(-k * dt);
            smoothPlayer.y = lerp(smoothPlayer.y, targetY, alpha);
        }

        // ---- DRAW -----
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxL = 30, oxR = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxL, oy, 'SNAP (instant)', NET_COLORS.correction);
        drawPanel(ctx, oxR, oy, 'SMOOTH (lerp over time)', NET_COLORS.ghost);

        // Show the current targetY as a thin horizontal line on both panels.
        ctx.strokeStyle = NET_COLORS.labelMuted;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(oxL + 1, oy + targetY + 0.5); ctx.lineTo(oxL + WORLD_W - 1, oy + targetY + 0.5);
        ctx.moveTo(oxR + 1, oy + targetY + 0.5); ctx.lineTo(oxR + WORLD_W - 1, oy + targetY + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        drawPlayer(ctx, oxL, oy, snapPlayer, NET_COLORS.correction);
        drawPlayer(ctx, oxR, oy, smoothPlayer, NET_COLORS.ghost);

        els.info.textContent =
            `last correction: ${lastCorrMag.toFixed(0)} px Δy · max ever: ${maxJump.toFixed(0)} px · smoothing ${smoothMs === 0 ? 'OFF (snap)' : `(99% in ${smoothMs} ms)`}`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 5 — arenaDemo  (capstone mini-project)
//
// The whole tier in one canvas: SERVER + CLIENT panels. The user controls a
// LOCAL player (WASD or buttons); a REMOTE bot moves in a circle. Toggles for
// PREDICTION (covers local), INTERPOLATION (covers remote), SMOOTHING (softens
// the predicted-player corrections). Network sliders for RTT/jitter/loss.
// HUD shows which techniques are on and per-feature stats.
// =============================================================================
(function arenaDemo() {
    const canvas = document.getElementById('arenaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('arenaRtt'),
        rttVal: document.getElementById('arenaRttVal'),
        jitter: document.getElementById('arenaJitter'),
        jitterVal: document.getElementById('arenaJitterVal'),
        loss: document.getElementById('arenaLoss'),
        lossVal: document.getElementById('arenaLossVal'),
        predict: document.getElementById('arenaPredict'),
        interp: document.getElementById('arenaInterp'),
        smooth: document.getElementById('arenaSmooth'),
        smoothMs: document.getElementById('arenaSmoothMs'),
        smoothMsVal: document.getElementById('arenaSmoothMsVal'),
        reset: document.getElementById('arenaReset'),
        info: document.getElementById('arenaInfo'),
        btnLeft:  document.getElementById('arenaLeft'),
        btnRight: document.getElementById('arenaRight'),
        btnUp:    document.getElementById('arenaUp'),
        btnDown:  document.getElementById('arenaDown'),
    };

    const net = new FakeNetwork({
        rttMs: +els.rtt.value, jitterMs: +els.jitter.value, lossRate: +els.loss.value / 100, seed: 19,
    });
    const serverEp = net.connect('server');
    const clientEp = net.connect('client');

    // SERVER STATE
    const serverLocal = new Player();                  // the player you control
    const serverRemote = new Player(WORLD_W * 0.7, WORLD_H * 0.5);   // bot
    let botTheta = 0;

    // CLIENT STATE
    const clientLocal = new Player();                  // predicted
    let lastAuthoritativeLocal = null;                 // most recent server snapshot of the local player
    const remoteBuffer = [];                            // snapshots of the remote
    let latestRemote = null;
    let clientClockOffset = null;

    const input = { ax: 0, ay: 0 };
    let lastInputSentAt = 0;
    let serverTime = 0;
    const corrections = { count: 0, totalGap: 0, maxGap: 0 };

    serverEp.onMessage((from, msg) => {
        if (msg.kind === 'input') applyInput(serverLocal, msg.input);
    });

    clientEp.onMessage((from, msg) => {
        if (msg.kind === 'snapshot') {
            // Two streams in one message: local + remote.
            const snapL = msg.local;
            const snapR = msg.remote;
            // ---- LOCAL handling ----
            lastAuthoritativeLocal = snapL;
            if (els.predict.checked) {
                // With prediction: compare and possibly snap/smooth.
                const dx = snapL.x - clientLocal.x;
                const dy = snapL.y - clientLocal.y;
                const gap = Math.hypot(dx, dy);
                corrections.count++;
                corrections.totalGap += gap;
                corrections.maxGap = Math.max(corrections.maxGap, gap);
                if (!els.smooth.checked) {
                    // Snap.
                    clientLocal.x = snapL.x; clientLocal.y = snapL.y;
                    clientLocal.vx = snapL.vx; clientLocal.vy = snapL.vy;
                } // else: smoothing is applied per-frame below
            } else {
                // No prediction: client just mirrors server.
                clientLocal.x = snapL.x; clientLocal.y = snapL.y;
                clientLocal.vx = snapL.vx; clientLocal.vy = snapL.vy;
            }
            // ---- REMOTE handling ----
            latestRemote = snapR;
            remoteBuffer.push({ ...snapR, serverTime: msg.serverTime });
            const cutoff = msg.serverTime - 2.0;
            while (remoteBuffer.length > 1 && remoteBuffer[0].serverTime < cutoff) remoteBuffer.shift();
        }
    });

    attachKeyboardInput(canvas, input);
    attachButtonInput({ left: els.btnLeft, right: els.btnRight, up: els.btnUp, down: els.btnDown }, input);

    function syncSliders() {
        const rtt = +els.rtt.value;
        const jitter = +els.jitter.value;
        const loss = +els.loss.value / 100;
        const smoothMs = +els.smoothMs.value;
        els.rttVal.textContent = fmtMs(rtt);
        els.jitterVal.textContent = '±' + fmtMs(jitter);
        els.lossVal.textContent = (loss * 100).toFixed(0) + ' %';
        els.smoothMsVal.textContent = smoothMs + ' ms';
        net.setParams({ rttMs: rtt, jitterMs: jitter, lossRate: loss });
    }
    ['rtt','jitter','loss','smoothMs'].forEach(k => els[k].addEventListener('input', syncSliders));
    syncSliders();

    els.reset.addEventListener('click', () => {
        serverLocal.x = serverLocal.y = serverLocal.vx = serverLocal.vy = 0;
        serverLocal.x = WORLD_W/2; serverLocal.y = WORLD_H/2;
        clientLocal.x = WORLD_W/2; clientLocal.y = WORLD_H/2; clientLocal.vx = 0; clientLocal.vy = 0;
        botTheta = 0;
        remoteBuffer.length = 0; latestRemote = null; lastAuthoritativeLocal = null;
        clientClockOffset = null;
        corrections.count = 0; corrections.totalGap = 0; corrections.maxGap = 0;
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

        // --- CLIENT: PREDICTION ---
        if (els.predict.checked) {
            applyInput(clientLocal, input);
            integrate(clientLocal, dt);
        }
        // Input send.
        if (now - lastInputSentAt >= 1000 / INPUT_TICK_HZ) {
            clientEp.send('server', { kind: 'input', input: { ax: input.ax, ay: input.ay } });
            lastInputSentAt = now;
        }

        // --- CLIENT: SMOOTHING toward last authoritative local snapshot ---
        if (els.predict.checked && els.smooth.checked && lastAuthoritativeLocal) {
            const smoothMs = +els.smoothMs.value;
            if (smoothMs > 0) {
                const k = -Math.log(0.01) / (smoothMs / 1000);
                const alpha = 1 - Math.exp(-k * dt);
                clientLocal.x = lerp(clientLocal.x, lastAuthoritativeLocal.x, alpha);
                clientLocal.y = lerp(clientLocal.y, lastAuthoritativeLocal.y, alpha);
            }
        }

        // --- SERVER simulation ---
        serverAccum += dt;
        snapshotAccum += dt;
        while (serverAccum >= SIM_DT) {
            serverAccum -= SIM_DT;
            integrate(serverLocal, SIM_DT);
            botTheta += 1.0 * SIM_DT;
            const cx = WORLD_W / 2, cy = WORLD_H / 2;
            const R = Math.min(WORLD_W, WORLD_H) * 0.32;
            serverRemote.x = cx + Math.cos(botTheta) * R + R * 0.25;
            serverRemote.y = cy + Math.sin(botTheta) * R;
            serverTime += SIM_DT;
        }
        while (snapshotAccum >= SNAPSHOT_INTERVAL) {
            snapshotAccum -= SNAPSHOT_INTERVAL;
            serverEp.send('client', {
                kind: 'snapshot',
                local: cloneSnapshot(serverLocal),
                remote: cloneSnapshot(serverRemote),
                serverTime,
            });
        }

        net.tick(now);

        // --- CLIENT: anchor clock offset on first snapshot of the remote ---
        if (latestRemote && clientClockOffset === null && remoteBuffer.length > 0) {
            clientClockOffset = remoteBuffer[remoteBuffer.length - 1].serverTime + 0.04 - now / 1000;
        }

        // --- CLIENT: compute remote render position ---
        let renderedRemote = latestRemote;
        if (els.interp.checked && remoteBuffer.length >= 2 && clientClockOffset !== null) {
            const interpDelayMs = 1000 / 15 + 30; // ~one snapshot interval + a 30 ms buffer cushion
            const renderServerTime = (now / 1000) + clientClockOffset - interpDelayMs / 1000;
            let i = remoteBuffer.length - 1;
            while (i > 0 && remoteBuffer[i].serverTime > renderServerTime) i--;
            const a = remoteBuffer[i];
            const b = remoteBuffer[Math.min(i + 1, remoteBuffer.length - 1)];
            const span = b.serverTime - a.serverTime;
            const t = span > 0 ? clamp((renderServerTime - a.serverTime) / span, 0, 1) : 0;
            renderedRemote = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), vx: 0, vy: 0 };
        }

        // ---- DRAW -----
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxS = 30, oxC = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxS, oy, 'SERVER (truth)', NET_COLORS.server);
        drawPanel(ctx, oxC, oy, 'CLIENT (what the player sees)', NET_COLORS.client);
        // Server: draw both players authoritatively.
        drawPlayer(ctx, oxS, oy, serverLocal, NET_COLORS.client);
        drawPlayer(ctx, oxS, oy, serverRemote, NET_COLORS.remote);
        // Client: draw the predicted-or-mirrored local + the (interpolated|latest) remote.
        drawPlayer(ctx, oxC, oy, clientLocal, NET_COLORS.client);
        if (renderedRemote) drawPlayer(ctx, oxC, oy, renderedRemote, NET_COLORS.remote);
        // Ghost of authoritative local on client when predicting (so user sees the correction gap).
        if (els.predict.checked && lastAuthoritativeLocal) {
            drawGhost(ctx, oxC, oy, lastAuthoritativeLocal, NET_COLORS.ghost);
        }

        const dxL = serverLocal.x - clientLocal.x, dyL = serverLocal.y - clientLocal.y;
        const localGap = Math.hypot(dxL, dyL);
        const avgGap = corrections.count > 0 ? corrections.totalGap / corrections.count : 0;
        const flags = [];
        flags.push(els.predict.checked ? 'PREDICT' : 'no-predict');
        flags.push(els.interp.checked ? 'INTERP' : 'no-interp');
        flags.push(els.smooth.checked ? `SMOOTH(${els.smoothMs.value}ms)` : 'no-smooth');
        els.info.textContent =
            `[${flags.join(' · ')}]   local gap = ${localGap.toFixed(0)} px · ` +
            `avg correction gap = ${avgGap.toFixed(0)} px (max ${corrections.maxGap.toFixed(0)}) · ` +
            `${corrections.count} corrections seen`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
