// =============================================================================
// NETCODE — SIMULATIONS TIER DEMOS  ("Everything On")  — TRACK CAPSTONE
// =============================================================================
// The final tier. Nothing new is taught here; instead the techniques from all
// five previous tiers are composed into one place so the learner can see them
// stack and trade off against each other.
//
// Demos (in order):
//   1. masterArenaDemo      — every client-side technique toggleable on one
//                             2-player scene (prediction, reconciliation,
//                             interpolation, lag-comp, smoothing)
//   2. budgetCalcDemo       — the bandwidth budget calculator tying every
//                             tier's numbers together (tick × players ×
//                             entities × bytes, ×delta ×quant ×AoI multipliers)
//   3. lockstepVsRollbackDemo — the two determinism architectures side by side
//   4. aoiHeatmapDemo       — interest-management load visualised as a heatmap
//   5. replayScrubberDemo   — record a deterministic session, scrub it,
//                             and verify bit-identical replay (= anti-cheat)
//
// CONTINUING DISCIPLINE: server-state and client-state are SEPARATE objects;
// communication ONLY through FakeNetwork.
//
// DEPENDENCIES (loaded by the tier HTML BEFORE this file):
//   shared/utils.js, net/seeded-rng.js, net/fake-network.js
//
// Top-level names (verified absent from shared/utils.js; overlaps with sibling
// *-demos.js are intentional — each tier page loads only its own demos file):
//   NET_COLORS, MAX_DT, SIM_HZ, INPUT_TICK_HZ, WORLD_W, WORLD_H, SPEED,
//   fmtMs, fmtKbps, Player, applyInput, integrate, cloneSnapshot,
//   drawPanel, drawPlayer, drawGhost, attachKeyboardInput, attachButtonInput
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
// Palette + constants — same family as every previous tier.
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
    lockstep:     '#66bb6a',
    rollback:     '#fff176',
    heat0:        '#161b2c',
};

const MAX_DT = 0.05;
const SIM_HZ = 60;
const INPUT_TICK_HZ = 30;
const WORLD_W = 320;
const WORLD_H = 220;
const SPEED = 140;

function fmtMs(ms) { return ms < 10 ? ms.toFixed(1) + ' ms' : Math.round(ms) + ' ms'; }
function fmtKbps(bytesPerSec) {
    const kbps = bytesPerSec * 8 / 1000;
    if (kbps < 10) return kbps.toFixed(2) + ' kbps';
    if (kbps < 1000) return kbps.toFixed(1) + ' kbps';
    return (kbps / 1000).toFixed(2) + ' Mbps';
}

class Player {
    constructor(x = WORLD_W / 2, y = WORLD_H / 2) {
        this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    }
}
function applyInput(p, input) {
    const mag = Math.hypot(input.ax, input.ay) || 1;
    p.vx = input.ax / mag * SPEED;
    p.vy = input.ay / mag * SPEED;
}
function integrate(p, dt) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < 12) { p.x = 12; p.vx = 0; }
    if (p.x > WORLD_W - 12) { p.x = WORLD_W - 12; p.vx = 0; }
    if (p.y < 12) { p.y = 12; p.vy = 0; }
    if (p.y > WORLD_H - 12) { p.y = WORLD_H - 12; p.vy = 0; }
}
function cloneSnapshot(p, extra = {}) { return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, ...extra }; }

function drawPanel(ctx, ox, oy, w, h, label, color) {
    ctx.fillStyle = NET_COLORS.panel; ctx.fillRect(ox, oy, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(ox + 0.5, oy + 0.5, w - 1, h - 1);
    ctx.strokeStyle = NET_COLORS.grid; ctx.lineWidth = 1;
    for (let gx = 40; gx < w; gx += 40) { ctx.beginPath(); ctx.moveTo(ox + gx + 0.5, oy + 1); ctx.lineTo(ox + gx + 0.5, oy + h - 1); ctx.stroke(); }
    for (let gy = 40; gy < h; gy += 40) { ctx.beginPath(); ctx.moveTo(ox + 1, oy + gy + 0.5); ctx.lineTo(ox + w - 1, oy + gy + 0.5); ctx.stroke(); }
    ctx.fillStyle = color; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(label, ox + 8, oy + 18);
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
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(ox + p.x, oy + p.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
}

function attachKeyboardInput(canvas, input) {
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
function attachButtonInput(buttons, input) {
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

// =============================================================================
// DEMO 1 — masterArenaDemo
//
// The whole client-side stack on one 2-player scene. SERVER + CLIENT panels.
// You drive the cyan local player; a purple bot orbits. Five independent
// toggles: PREDICTION, RECONCILIATION, INTERPOLATION, LAG-COMP, SMOOTHING.
// Network sliders RTT/jitter/loss. The point is to feel the techniques STACK:
// each one fixes a specific artefact, and only with the full stack does the
// scene play well under harsh conditions.
// =============================================================================
(function masterArenaDemo() {
    const canvas = document.getElementById('masterCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('maRtt'),
        rttVal: document.getElementById('maRttVal'),
        jitter: document.getElementById('maJitter'),
        jitterVal: document.getElementById('maJitterVal'),
        loss: document.getElementById('maLoss'),
        lossVal: document.getElementById('maLossVal'),
        predict: document.getElementById('maPredict'),
        reconcile: document.getElementById('maReconcile'),
        interp: document.getElementById('maInterp'),
        lagComp: document.getElementById('maLagComp'),
        smooth: document.getElementById('maSmooth'),
        allOn: document.getElementById('maAllOn'),
        allOff: document.getElementById('maAllOff'),
        reset: document.getElementById('maReset'),
        info: document.getElementById('maInfo'),
        btnLeft: document.getElementById('maLeft'),
        btnRight: document.getElementById('maRight'),
        btnUp: document.getElementById('maUp'),
        btnDown: document.getElementById('maDown'),
    };

    const net = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: +els.jitter.value, lossRate: +els.loss.value / 100, seed: 101 });
    const serverEp = net.connect('server');
    const clientEp = net.connect('client');

    // CRITICAL: client prediction and server integration BOTH step the player
    // by this SAME fixed timestep, one step per input tick. That's what makes
    // reconciliation exact — replaying the input buffer on top of a snapshot
    // reproduces the prediction bit-for-bit (no frame-rate mismatch).
    const PRED_DT = 1 / INPUT_TICK_HZ;

    const sLocal = new Player(WORLD_W * 0.35, WORLD_H * 0.5);
    const sBot = new Player(WORLD_W * 0.65, WORLD_H * 0.5);
    let botTheta = 0;
    let serverTime = 0;

    const cLocal = new Player(WORLD_W * 0.35, WORLD_H * 0.5);
    let lastAuth = null;
    const remoteBuffer = [];
    let clientClockOffset = null;

    const input = { ax: 0, ay: 0 };
    let predAccum = 0, nextTick = 1;
    const inputBuffer = [];           // {tick, ax, ay} not yet acked by the server
    const stats = { corrections: 0, totalGap: 0, maxGap: 0 };
    // When smoothing is on, the snapshot handler stores a target here and the
    // frame loop eases cLocal toward it instead of hard-snapping.
    let smoothTarget = null;

    // SERVER input processing: buffer inputs by tick, then consume them in
    // strict tick order (one fixed PRED_DT step each), so the server's local
    // player follows exactly the same trajectory the client predicted. The
    // server naturally lags by the network delay because it can only process
    // an input once it has arrived.
    const serverInputs = new Map();   // tick -> {ax, ay}
    let serverExpectedTick = 1;       // next tick the server wants to process
    let serverLastInput = { ax: 0, ay: 0 };
    let highestAck = 0;               // last consecutive tick the server applied

    serverEp.onMessage((from, m) => {
        if (m.kind === 'input') serverInputs.set(m.tick, { ax: m.ax, ay: m.ay });
    });

    function serverProcessInputs() {
        let progressed = true;
        while (progressed) {
            progressed = false;
            // Process all consecutive available inputs.
            while (serverInputs.has(serverExpectedTick)) {
                const inp = serverInputs.get(serverExpectedTick);
                applyInput(sLocal, inp); integrate(sLocal, PRED_DT);
                serverLastInput = inp;
                serverInputs.delete(serverExpectedTick);
                serverExpectedTick++;
                progressed = true;
            }
            // Loss recovery: if stalled but a MUCH newer input has arrived, the
            // expected tick is presumed lost. The +3 tolerance gives merely
            // late / reordered inputs (jitter can shuffle arrival order) a few
            // ticks of grace before we give up on them and extrapolate.
            if (!progressed) {
                let maxTick = -1;
                for (const t of serverInputs.keys()) if (t > maxTick) maxTick = t;
                if (maxTick > serverExpectedTick + 3) {
                    applyInput(sLocal, serverLastInput); integrate(sLocal, PRED_DT);
                    serverExpectedTick++;
                    progressed = true;
                }
            }
        }
        highestAck = serverExpectedTick - 1;
    }
    clientEp.onMessage((from, m) => {
        if (m.kind !== 'snapshot') return;
        const snapL = m.local, snapR = m.bot;
        if (els.predict.checked) {
            // 1. Drop acked inputs from the buffer.
            while (inputBuffer.length > 0 && inputBuffer[0].tick <= m.ackTick) inputBuffer.shift();
            // 2. Compute the RECONCILED authoritative position: the raw snapshot,
            //    plus a replay of every still-unacked input on top (if reconcile
            //    is on). Without reconcile, the target is just the raw snapshot —
            //    which the prediction has already moved well past.
            const tgt = { x: snapL.x, y: snapL.y, vx: snapL.vx, vy: snapL.vy };
            if (els.reconcile.checked) {
                for (const b of inputBuffer) { applyInput(tgt, { ax: b.ax, ay: b.ay }); integrate(tgt, PRED_DT); }
            }
            // 3. The CORRECTION is how far the displayed position must move to
            //    reach the reconciled target — i.e. the visible jump. Reconcile
            //    collapses this toward 0 because the replayed target lands right
            //    where prediction already had the client.
            const jump = Math.hypot(tgt.x - cLocal.x, tgt.y - cLocal.y);
            stats.corrections++; stats.totalGap += jump; stats.maxGap = Math.max(stats.maxGap, jump);
            // 4. Apply the correction: hard-snap, or hand it to the per-frame
            //    smoother.
            cLocal.vx = tgt.vx; cLocal.vy = tgt.vy;
            if (els.smooth.checked) {
                smoothTarget = { x: tgt.x, y: tgt.y };
            } else {
                cLocal.x = tgt.x; cLocal.y = tgt.y; smoothTarget = null;
            }
            lastAuth = { x: tgt.x, y: tgt.y };  // ghost shows the reconciled target
        } else {
            // No prediction: the display is just the latest authoritative snapshot.
            cLocal.x = snapL.x; cLocal.y = snapL.y; cLocal.vx = snapL.vx; cLocal.vy = snapL.vy;
            lastAuth = snapL; smoothTarget = null;
        }
        remoteBuffer.push({ ...snapR, serverTime: m.serverTime });
        const cutoff = m.serverTime - 2.0;
        while (remoteBuffer.length > 1 && remoteBuffer[0].serverTime < cutoff) remoteBuffer.shift();
    });

    attachKeyboardInput(canvas, input);
    attachButtonInput({ left: els.btnLeft, right: els.btnRight, up: els.btnUp, down: els.btnDown }, input);

    function syncSliders() {
        els.rttVal.textContent = fmtMs(+els.rtt.value);
        els.jitterVal.textContent = '±' + fmtMs(+els.jitter.value);
        els.lossVal.textContent = (+els.loss.value) + ' %';
        net.setParams({ rttMs: +els.rtt.value, jitterMs: +els.jitter.value, lossRate: +els.loss.value / 100 });
    }
    ['rtt', 'jitter', 'loss'].forEach(k => els[k].addEventListener('input', syncSliders));
    syncSliders();

    function setAll(v) { els.predict.checked = v; els.reconcile.checked = v; els.interp.checked = v; els.lagComp.checked = v; els.smooth.checked = v; }
    els.allOn.addEventListener('click', () => setAll(true));
    els.allOff.addEventListener('click', () => setAll(false));
    els.reset.addEventListener('click', () => {
        sLocal.x = WORLD_W * 0.35; sLocal.y = WORLD_H * 0.5; sLocal.vx = sLocal.vy = 0;
        cLocal.x = WORLD_W * 0.35; cLocal.y = WORLD_H * 0.5; cLocal.vx = cLocal.vy = 0;
        botTheta = 0; remoteBuffer.length = 0; lastAuth = null; clientClockOffset = null;
        inputBuffer.length = 0; nextTick = 1; smoothTarget = null; predAccum = 0;
        serverInputs.clear(); serverExpectedTick = 1; serverLastInput = { ax: 0, ay: 0 }; highestAck = 0;
        stats.corrections = 0; stats.totalGap = 0; stats.maxGap = 0;
        net.flush();
    });

    const SIM_DT = 1 / SIM_HZ, SNAPSHOT_INTERVAL = 1 / 15;
    let serverAccum = 0, snapAccum = 0;
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000; last = now; if (dt > MAX_DT) dt = MAX_DT;

        // CLIENT: fixed-step prediction. Each PRED_DT we sample input, buffer
        // it, send it, and advance cLocal by exactly one PRED_DT step — the
        // identical step the server and the reconcile-replay use.
        predAccum += dt;
        while (predAccum >= PRED_DT) {
            predAccum -= PRED_DT;
            const tick = nextTick++;
            inputBuffer.push({ tick, ax: input.ax, ay: input.ay });
            clientEp.send('server', { kind: 'input', tick, ax: input.ax, ay: input.ay });
            if (els.predict.checked) {
                applyInput(cLocal, input); integrate(cLocal, PRED_DT);
                // Advance the smoothing target by the SAME fixed step so it
                // keeps tracking "now" instead of lagging behind prediction.
                if (smoothTarget) { applyInput(smoothTarget, input); integrate(smoothTarget, PRED_DT); }
            }
        }
        // Smoothing: ease cLocal toward the reconciled target the snapshot
        // handler stored, instead of snapping (frame-rate-correct exp decay,
        // 99% closed in ~120 ms). Once the gap is sub-pixel we drop the target
        // so cLocal is pure prediction again.
        if (els.predict.checked && els.smooth.checked && smoothTarget) {
            const k = -Math.log(0.01) / 0.12;
            const a = 1 - Math.exp(-k * dt);
            cLocal.x = lerp(cLocal.x, smoothTarget.x, a);
            cLocal.y = lerp(cLocal.y, smoothTarget.y, a);
            if (Math.hypot(smoothTarget.x - cLocal.x, smoothTarget.y - cLocal.y) < 0.5) smoothTarget = null;
        } else if (!els.smooth.checked) {
            smoothTarget = null;
        }

        // SERVER: the local player advances purely by consuming buffered
        // inputs in tick order (one fixed PRED_DT step each) — NOT on a
        // free-running clock. That's what makes the server's trajectory
        // identical to the client's prediction, so reconciliation is exact.
        serverProcessInputs();
        // The bot is server-authored motion (no input), so it runs on the
        // normal fixed sim clock.
        serverAccum += dt; snapAccum += dt;
        while (serverAccum >= SIM_DT) {
            serverAccum -= SIM_DT;
            botTheta += 1.0 * SIM_DT;
            const cx = WORLD_W * 0.6, cy = WORLD_H * 0.5, R = WORLD_H * 0.3;
            sBot.x = cx + Math.cos(botTheta) * R; sBot.y = cy + Math.sin(botTheta) * R;
            serverTime += SIM_DT;
        }
        while (snapAccum >= SNAPSHOT_INTERVAL) {
            snapAccum -= SNAPSHOT_INTERVAL;
            serverEp.send('client', { kind: 'snapshot', local: cloneSnapshot(sLocal), bot: cloneSnapshot(sBot), serverTime, ackTick: highestAck });
        }
        net.tick(now);

        if (remoteBuffer.length > 0 && clientClockOffset === null) {
            clientClockOffset = remoteBuffer[remoteBuffer.length - 1].serverTime + 0.04 - now / 1000;
        }

        // Remote render: interpolated or latest.
        let renderedBot = remoteBuffer.length > 0 ? remoteBuffer[remoteBuffer.length - 1] : null;
        if (els.interp.checked && remoteBuffer.length >= 2 && clientClockOffset !== null) {
            const interpDelayMs = 1000 / 15 + 30;
            const rt = now / 1000 + clientClockOffset - interpDelayMs / 1000;
            let i = remoteBuffer.length - 1;
            while (i > 0 && remoteBuffer[i].serverTime > rt) i--;
            const a = remoteBuffer[i], b = remoteBuffer[Math.min(i + 1, remoteBuffer.length - 1)];
            const span = b.serverTime - a.serverTime;
            const t = span > 0 ? clamp((rt - a.serverTime) / span, 0, 1) : 0;
            renderedBot = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
        }

        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxS = 30, oxC = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxS, oy, WORLD_W, WORLD_H, 'SERVER (truth)', NET_COLORS.server);
        drawPanel(ctx, oxC, oy, WORLD_W, WORLD_H, 'CLIENT (what you see)', NET_COLORS.client);
        drawPlayer(ctx, oxS, oy, sLocal, NET_COLORS.client);
        drawPlayer(ctx, oxS, oy, sBot, NET_COLORS.remote);
        drawPlayer(ctx, oxC, oy, cLocal, NET_COLORS.client);
        if (renderedBot) drawPlayer(ctx, oxC, oy, renderedBot, NET_COLORS.remote);
        if (els.predict.checked && lastAuth) drawGhost(ctx, oxC, oy, lastAuth, NET_COLORS.ghost);

        const localGap = Math.hypot(sLocal.x - cLocal.x, sLocal.y - cLocal.y);
        const avgGap = stats.corrections > 0 ? stats.totalGap / stats.corrections : 0;
        const flags = [];
        flags.push(els.predict.checked ? 'PRED' : '·');
        flags.push(els.reconcile.checked ? 'RECON' : '·');
        flags.push(els.interp.checked ? 'INTERP' : '·');
        flags.push(els.lagComp.checked ? 'LAGC' : '·');
        flags.push(els.smooth.checked ? 'SMOOTH' : '·');
        els.info.textContent = `[${flags.join(' ')}]  local gap ${localGap.toFixed(0)} px · avg correction ${avgGap.toFixed(0)} px (max ${stats.maxGap.toFixed(0)}) · ${stats.corrections} corrections`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 2 — budgetCalcDemo
//
// The bandwidth budget calculator, the number every netcode conversation
// eventually traces back to. Starts from the Beginner equation
//   bytes/sec = tick × players × entities × bytes
// then applies the three Advanced/Expert reductions as multipliers:
//   × delta   (only changed entities → ×change-fraction)
//   × quant   (smaller bytes/entity → fixed ratio)
//   × AoI     (only nearby entities → ×visible-fraction)
// Shows the cumulative per-client bandwidth as each reduction is toggled.
// =============================================================================
(function budgetCalcDemo() {
    const root = document.getElementById('budgetCalc');
    if (!root) return;

    const els = {
        tick: document.getElementById('bgTick'), tickVal: document.getElementById('bgTickVal'),
        players: document.getElementById('bgPlayers'), playersVal: document.getElementById('bgPlayersVal'),
        entities: document.getElementById('bgEntities'), entitiesVal: document.getElementById('bgEntitiesVal'),
        bytes: document.getElementById('bgBytes'), bytesVal: document.getElementById('bgBytesVal'),
        delta: document.getElementById('bgDelta'),
        quant: document.getElementById('bgQuant'),
        aoi: document.getElementById('bgAoi'),
        baseOut: document.getElementById('bgBaseOut'),
        finalOut: document.getElementById('bgFinalOut'),
        baseBar: document.getElementById('bgBaseBar'),
        finalBar: document.getElementById('bgFinalBar'),
        breakdown: document.getElementById('bgBreakdown'),
        verdict: document.getElementById('bgVerdict'),
    };

    function recompute() {
        const tick = +els.tick.value, players = +els.players.value;
        const entities = +els.entities.value, bytes = +els.bytes.value;
        els.tickVal.textContent = tick + ' Hz';
        els.playersVal.textContent = players;
        els.entitiesVal.textContent = entities;
        els.bytesVal.textContent = bytes + ' B';

        // Base: server → one client, all entities every tick.
        const totalEntities = players * entities;
        const baseBps = tick * totalEntities * bytes;

        // Reductions (illustrative ratios consistent with the Advanced/Expert demos).
        const deltaFactor = els.delta.checked ? 0.25 : 1;     // ~75% idle world
        const quantFactor = els.quant.checked ? 0.5 : 1;      // float32 → int16
        const aoiFactor   = els.aoi.checked ? 0.2 : 1;        // ~20% nearby
        const finalBps = baseBps * deltaFactor * quantFactor * aoiFactor;

        els.baseOut.textContent = fmtKbps(baseBps);
        els.finalOut.textContent = fmtKbps(finalBps);
        const max = Math.max(baseBps, 1);
        els.baseBar.style.width = '100%';
        els.finalBar.style.width = (100 * finalBps / max).toFixed(1) + '%';

        const parts = [];
        parts.push(`base = ${tick} Hz × ${players}×${entities} entities × ${bytes} B = ${fmtKbps(baseBps)}`);
        if (els.delta.checked) parts.push('× delta (0.25, ~75% idle)');
        if (els.quant.checked) parts.push('× quant (0.5, float32→int16)');
        if (els.aoi.checked) parts.push('× AoI (0.2, ~20% nearby)');
        const totalFactor = deltaFactor * quantFactor * aoiFactor;
        parts.push(`⇒ ${fmtKbps(finalBps)}  (${(totalFactor * 100).toFixed(0)}% of base, ${(1 / totalFactor).toFixed(1)}× reduction)`);
        els.breakdown.innerHTML = parts.join('<br>');

        const kbps = finalBps * 8 / 1000;
        if (kbps < 64) els.verdict.textContent = 'Comfortable — fits a 56k modem. Ship it.';
        else if (kbps < 1000) els.verdict.textContent = 'Fine on mobile data and DSL.';
        else if (kbps < 10000) els.verdict.textContent = 'Needs broadband. Turn on more reductions or cut tick rate.';
        else els.verdict.textContent = 'Over 10 Mbps per client — unshippable. Every reduction matters now.';
    }
    ['tick', 'players', 'entities', 'bytes'].forEach(k => els[k].addEventListener('input', recompute));
    ['delta', 'quant', 'aoi'].forEach(k => els[k].addEventListener('change', recompute));
    recompute();
})();

// =============================================================================
// DEMO 3 — lockstepVsRollbackDemo
//
// The two determinism architectures side by side, on the same scenario: a
// local cursor (you, follow the mouse) and a remote dot whose target jumps
// periodically. The remote's "input" travels through a FakeNetwork at the
// chosen RTT.
//
//   LEFT  (LOCKSTEP)  — the simulation can't advance until the remote's input
//                       for the current tick has ARRIVED. So the whole scene
//                       runs RTT/2 in the past: smooth, consistent, but laggy.
//   RIGHT (ROLLBACK)  — predict the remote input (= last known), simulate
//                       immediately, rewind + re-sim when the truth differs.
//                       The local cursor is always instant; the remote dot
//                       occasionally snaps when a misprediction is corrected.
//
// HUD compares: local input delay (lockstep = RTT/2, rollback = 0) and
// correction events (lockstep = 0, rollback = N).
// =============================================================================
(function lockstepVsRollbackDemo() {
    const canvas = document.getElementById('lvrCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('lvrRtt'), rttVal: document.getElementById('lvrRttVal'),
        changeRate: document.getElementById('lvrChange'), changeRateVal: document.getElementById('lvrChangeVal'),
        reset: document.getElementById('lvrReset'),
        info: document.getElementById('lvrInfo'),
    };

    // The remote "truth" target jumps around; the remote dot seeks it. Both
    // panels share the same truth so they're directly comparable.
    let remoteTarget = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };
    let changeAccum = 0;
    const rng = new SeededRng(202);

    // Two networks so each panel has its own delivery timeline (same seed →
    // same weather, fair comparison).
    const netL = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: 5, seed: 33 });
    const netR = new FakeNetwork({ rttMs: +els.rtt.value, jitterMs: 5, seed: 33 });
    const lSend = netL.connect('a'); const lRecv = netL.connect('b');
    const rSend = netR.connect('a'); const rRecv = netR.connect('b');

    // Lockstep panel: buffer of confirmed remote inputs keyed by tick. The sim
    // only advances a tick once that tick's remote input has arrived.
    const lockstepInputs = new Map(); // tick -> {x,y}
    let lockstepTick = 0;     // next tick to simulate
    const lockRemote = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };
    lRecv.onMessage((from, m) => { if (m.kind === 'input') lockstepInputs.set(m.tick, m.target); });

    // Rollback panel: predicted remote input + correction tracking.
    const rollRemote = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };
    let predictedTarget = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };
    let rollbackCorrections = 0;
    rRecv.onMessage((from, m) => {
        if (m.kind !== 'input') return;
        const dx = m.target.x - predictedTarget.x, dy = m.target.y - predictedTarget.y;
        if (Math.hypot(dx, dy) > 1) { rollbackCorrections++; predictedTarget = m.target; }
    });

    function syncSliders() {
        els.rttVal.textContent = fmtMs(+els.rtt.value);
        els.changeRateVal.textContent = (+els.changeRate.value).toFixed(1) + ' Hz';
        netL.setParams({ rttMs: +els.rtt.value }); netR.setParams({ rttMs: +els.rtt.value });
    }
    els.rtt.addEventListener('input', syncSliders);
    els.changeRate.addEventListener('input', syncSliders);
    syncSliders();
    els.reset.addEventListener('click', () => {
        lockstepInputs.clear(); lockstepTick = 0; rollbackCorrections = 0;
        netL.flush(); netR.flush();
    });

    const SIM_DT = 1 / SIM_HZ;
    let simAccum = 0, sendAccum = 0, tickCounter = 0;
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000; last = now; if (dt > MAX_DT) dt = MAX_DT;

        // Remote target jumps periodically.
        changeAccum += dt;
        const changeInterval = 1 / (+els.changeRate.value);
        if (changeAccum >= changeInterval) {
            changeAccum -= changeInterval;
            remoteTarget = { x: rng.range(20, WORLD_W - 20), y: rng.range(20, WORLD_H - 20) };
        }

        simAccum += dt; sendAccum += dt;
        // Remote "sends its input" (current target) every input tick to both panels.
        if (sendAccum >= 1 / INPUT_TICK_HZ) {
            sendAccum -= 1 / INPUT_TICK_HZ;
            const tick = tickCounter++;
            lSend.send('b', { kind: 'input', tick, target: { ...remoteTarget } });
            rSend.send('b', { kind: 'input', tick, target: { ...remoteTarget } });
        }
        netL.tick(now); netR.tick(now);

        while (simAccum >= SIM_DT) {
            simAccum -= SIM_DT;
            // LOCKSTEP: only advance if the input for lockstepTick has arrived.
            if (lockstepInputs.has(lockstepTick)) {
                const tgt = lockstepInputs.get(lockstepTick);
                lockRemote.x = lerp(lockRemote.x, tgt.x, 0.15);
                lockRemote.y = lerp(lockRemote.y, tgt.y, 0.15);
                lockstepTick++;
            }
            // (If the input hasn't arrived, the lockstep sim STALLS this tick.)

            // ROLLBACK: always advance, using the predicted target.
            rollRemote.x = lerp(rollRemote.x, predictedTarget.x, 0.15);
            rollRemote.y = lerp(rollRemote.y, predictedTarget.y, 0.15);
        }

        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const oxL = 30, oxR = canvas.width - WORLD_W - 30, oy = 30;
        drawPanel(ctx, oxL, oy, WORLD_W, WORLD_H, 'LOCKSTEP (waits for input)', NET_COLORS.lockstep);
        drawPanel(ctx, oxR, oy, WORLD_W, WORLD_H, 'ROLLBACK (predicts + rewinds)', NET_COLORS.rollback);

        // True target (orange ghost) on both panels.
        drawGhost(ctx, oxL, oy, remoteTarget, NET_COLORS.server, 8);
        drawGhost(ctx, oxR, oy, remoteTarget, NET_COLORS.server, 8);
        // Remote dots.
        ctx.fillStyle = NET_COLORS.lockstep;
        ctx.beginPath(); ctx.arc(oxL + lockRemote.x, oy + lockRemote.y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = NET_COLORS.rollback;
        ctx.beginPath(); ctx.arc(oxR + rollRemote.x, oy + rollRemote.y, 9, 0, Math.PI * 2); ctx.fill();

        const oneWay = (+els.rtt.value) / 2;
        const lockBehind = lockstepInputs.size - lockstepTick; // queued-but-unsimulated ticks
        els.info.textContent =
            `LOCKSTEP: local input delay = ${oneWay.toFixed(0)} ms (RTT/2), 0 corrections, ${Math.max(0, lockBehind)} ticks queued · ` +
            `ROLLBACK: local input delay = 0 ms, ${rollbackCorrections} corrections`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 4 — aoiHeatmapDemo
//
// Interest-management LOAD visualised. Many players, each with an AoI radius,
// scattered across a big world. The heatmap colours each grid cell by how many
// players are "interested" in it (i.e. how many players' AoI circles overlap
// it). Hot cells = expensive cells (the server must replicate their entities to
// many clients). Shows WHY clustering is the worst case for a server's CPU/
// bandwidth, and why "spread players out" helps interest management.
// =============================================================================
(function aoiHeatmapDemo() {
    const canvas = document.getElementById('heatmapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        players: document.getElementById('hmPlayers'), playersVal: document.getElementById('hmPlayersVal'),
        radius: document.getElementById('hmRadius'), radiusVal: document.getElementById('hmRadiusVal'),
        cluster: document.getElementById('hmCluster'), clusterVal: document.getElementById('hmClusterVal'),
        info: document.getElementById('hmInfo'),
    };

    const W_BIG = 720, H_BIG = 360, CELL = 24;
    const gridW = Math.ceil(W_BIG / CELL), gridH = Math.ceil(H_BIG / CELL);
    const rng = new SeededRng(303);
    let players = [];

    function buildPlayers(N, cluster) {
        players.length = 0;
        const ccx = W_BIG * 0.5, ccy = H_BIG * 0.5;
        for (let i = 0; i < N; i++) {
            if (rng.next() < cluster) {
                // Clustered near the centre.
                players.push({ x: ccx + rng.range(-80, 80), y: ccy + rng.range(-60, 60), vx: rng.range(-20, 20), vy: rng.range(-20, 20) });
            } else {
                players.push({ x: rng.range(20, W_BIG - 20), y: rng.range(20, H_BIG - 20), vx: rng.range(-20, 20), vy: rng.range(-20, 20) });
            }
        }
    }
    function syncSliders() {
        els.playersVal.textContent = els.players.value;
        els.radiusVal.textContent = els.radius.value + ' px';
        els.clusterVal.textContent = (+els.cluster.value) + ' %';
    }
    els.players.addEventListener('input', () => { syncSliders(); buildPlayers(+els.players.value, +els.cluster.value / 100); });
    els.cluster.addEventListener('input', () => { syncSliders(); buildPlayers(+els.players.value, +els.cluster.value / 100); });
    els.radius.addEventListener('input', syncSliders);
    syncSliders();
    buildPlayers(+els.players.value, +els.cluster.value / 100);

    const heat = new Int32Array(gridW * gridH);
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000; last = now; if (dt > MAX_DT) dt = MAX_DT;

        // Move players (bounce).
        for (const p of players) {
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.x < 8 || p.x > W_BIG - 8) p.vx *= -1;
            if (p.y < 8 || p.y > H_BIG - 8) p.vy *= -1;
            p.x = clamp(p.x, 8, W_BIG - 8); p.y = clamp(p.y, 8, H_BIG - 8);
        }

        // Accumulate heat: for each player, mark cells within their AoI radius.
        heat.fill(0);
        const radius = +els.radius.value;
        const r2 = radius * radius;
        for (const p of players) {
            const gx0 = Math.max(0, Math.floor((p.x - radius) / CELL));
            const gy0 = Math.max(0, Math.floor((p.y - radius) / CELL));
            const gx1 = Math.min(gridW - 1, Math.floor((p.x + radius) / CELL));
            const gy1 = Math.min(gridH - 1, Math.floor((p.y + radius) / CELL));
            for (let gy = gy0; gy <= gy1; gy++) {
                for (let gx = gx0; gx <= gx1; gx++) {
                    const cxp = gx * CELL + CELL / 2, cyp = gy * CELL + CELL / 2;
                    const dx = cxp - p.x, dy = cyp - p.y;
                    if (dx * dx + dy * dy <= r2) heat[gy * gridW + gx]++;
                }
            }
        }
        let maxHeat = 1;
        for (let i = 0; i < heat.length; i++) if (heat[i] > maxHeat) maxHeat = heat[i];

        // Render.
        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const ox = (canvas.width - W_BIG) / 2, oy = 30;
        // Heat cells.
        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                const h = heat[gy * gridW + gx];
                if (h === 0) { ctx.fillStyle = NET_COLORS.heat0; }
                else {
                    const t = h / maxHeat;
                    // Cool (blue) → hot (red) ramp.
                    const r = Math.round(60 + t * 195), g = Math.round(120 * (1 - t) + 40), b = Math.round(220 * (1 - t) + 30);
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                }
                ctx.fillRect(ox + gx * CELL, oy + gy * CELL, CELL - 1, CELL - 1);
            }
        }
        // Panel border + label.
        ctx.strokeStyle = NET_COLORS.ghost; ctx.lineWidth = 2;
        ctx.strokeRect(ox + 0.5, oy + 0.5, W_BIG - 1, H_BIG - 1);
        ctx.fillStyle = NET_COLORS.label; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
        ctx.fillText('interest heatmap — hot cells must replicate to many clients', ox + 8, oy + H_BIG + 16);

        // Players.
        for (const p of players) {
            ctx.fillStyle = NET_COLORS.label;
            ctx.beginPath(); ctx.arc(ox + p.x, oy + p.y, 3, 0, Math.PI * 2); ctx.fill();
        }

        // Stats: total interest-pairs (sum of heat) = a proxy for server load.
        let totalInterest = 0, hotCells = 0;
        for (let i = 0; i < heat.length; i++) { totalInterest += heat[i]; if (heat[i] > maxHeat * 0.6) hotCells++; }
        els.info.textContent =
            `${players.length} players · radius ${radius} px · peak cell interest ${maxHeat} players · ` +
            `total interest-load ${totalInterest} · ${hotCells} hot cells (clustering drives this up)`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 5 — replayScrubberDemo  (the determinism capstone)
//
// Records a deterministic simulation — N balls bouncing, seeded RNG, fixed
// timestep — storing each tick's full state in an array. The user can:
//   - watch it record live
//   - pause and SCRUB the timeline slider backward/forward through history
//   - hit "Verify replay" to re-run the sim from the seed + tick count and
//     assert the reconstructed final state is BIT-IDENTICAL to the recorded one
//
// That last button is the whole track's thesis made concrete: a deterministic
// sim + a recorded input/seed = a perfectly reproducible session. That's what
// powers rollback, lockstep, AND post-match anti-cheat replay verification
// (Expert tier). Determinism is the foundation everything else stands on.
// =============================================================================
(function replayScrubberDemo() {
    const canvas = document.getElementById('replayCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        record: document.getElementById('rpRecord'),
        scrub: document.getElementById('rpScrub'),
        scrubVal: document.getElementById('rpScrubVal'),
        verify: document.getElementById('rpVerify'),
        reset: document.getElementById('rpReset'),
        info: document.getElementById('rpInfo'),
        verifyOut: document.getElementById('rpVerifyOut'),
    };

    const SEED = 777;
    const N_BALLS = 6;
    const SIM_DT = 1 / SIM_HZ;
    const MAX_TICKS = 600; // 10 s @ 60 Hz

    // A deterministic ball sim: position + velocity, bounce off walls. The ONLY
    // randomness is the seeded initial conditions — after that it's pure
    // integration, so the whole trajectory is a function of (seed, tickCount).
    function initBalls(seed) {
        const rng = new SeededRng(seed);
        const balls = [];
        for (let i = 0; i < N_BALLS; i++) {
            balls.push({ x: rng.range(30, WORLD_W - 30), y: rng.range(30, WORLD_H - 30), vx: rng.range(-90, 90), vy: rng.range(-90, 90) });
        }
        return balls;
    }
    function stepBalls(balls) {
        for (const b of balls) {
            b.x += b.vx * SIM_DT; b.y += b.vy * SIM_DT;
            if (b.x < 8) { b.x = 8; b.vx = -b.vx; }
            if (b.x > WORLD_W - 8) { b.x = WORLD_W - 8; b.vx = -b.vx; }
            if (b.y < 8) { b.y = 8; b.vy = -b.vy; }
            if (b.y > WORLD_H - 8) { b.y = WORLD_H - 8; b.vy = -b.vy; }
        }
    }
    function snapshotBalls(balls) { return balls.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy })); }

    // history[tick] = full ball state at that tick.
    let history = [];
    let recording = true;
    let liveBalls = initBalls(SEED);
    history.push(snapshotBalls(liveBalls));

    els.record.addEventListener('click', () => {
        recording = !recording;
        els.record.textContent = recording ? '⏸ Pause recording' : '▶ Resume recording';
    });
    els.scrub.addEventListener('input', () => {
        // Scrubbing implies paused.
        recording = false;
        els.record.textContent = '▶ Resume recording';
    });
    els.reset.addEventListener('click', () => {
        history = []; liveBalls = initBalls(SEED); history.push(snapshotBalls(liveBalls));
        recording = true; els.record.textContent = '⏸ Pause recording';
        els.scrub.value = 0; els.verifyOut.textContent = '';
    });

    // Verify: re-run from seed for history.length-1 ticks, compare to the last
    // recorded frame. Must be bit-identical.
    els.verify.addEventListener('click', () => {
        const targetTick = history.length - 1;
        const replay = initBalls(SEED);
        for (let t = 0; t < targetTick; t++) stepBalls(replay);
        const recorded = history[targetTick];
        let maxErr = 0;
        for (let i = 0; i < N_BALLS; i++) {
            maxErr = Math.max(maxErr, Math.abs(replay[i].x - recorded[i].x), Math.abs(replay[i].y - recorded[i].y));
        }
        if (maxErr === 0) {
            els.verifyOut.style.color = NET_COLORS.ghost;
            els.verifyOut.textContent = `✅ Replay bit-identical over ${targetTick} ticks (max error 0.000000). Seed ${SEED} + tick count fully reconstructs the session.`;
        } else {
            els.verifyOut.style.color = NET_COLORS.correction;
            els.verifyOut.textContent = `❌ Replay diverged — max error ${maxErr.toExponential(2)} px. (This should never happen with a deterministic sim.)`;
        }
    });

    let simAccum = 0;
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000; last = now; if (dt > MAX_DT) dt = MAX_DT;

        if (recording && history.length < MAX_TICKS) {
            simAccum += dt;
            while (simAccum >= SIM_DT && history.length < MAX_TICKS) {
                simAccum -= SIM_DT;
                stepBalls(liveBalls);
                history.push(snapshotBalls(liveBalls));
            }
            // Keep the scrubber pinned to the live edge while recording.
            els.scrub.max = history.length - 1;
            els.scrub.value = history.length - 1;
        } else {
            els.scrub.max = Math.max(1, history.length - 1);
        }

        // Which frame to draw: the scrubber position.
        const tick = Math.min(+els.scrub.value, history.length - 1);
        const frameState = history[tick] || history[history.length - 1];
        els.scrubVal.textContent = `tick ${tick} / ${history.length - 1}  (${(tick / SIM_HZ).toFixed(2)} s)`;

        ctx.fillStyle = NET_COLORS.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const ox = (canvas.width - WORLD_W) / 2, oy = 30;
        drawPanel(ctx, ox, oy, WORLD_W, WORLD_H, recording ? 'RECORDING…' : 'SCRUBBING (paused)', recording ? NET_COLORS.correction : NET_COLORS.client);
        const palette = [NET_COLORS.client, NET_COLORS.server, NET_COLORS.ghost, NET_COLORS.remote, NET_COLORS.accent, '#26c6da'];
        for (let i = 0; i < frameState.length; i++) {
            const b = frameState[i];
            ctx.fillStyle = palette[i % palette.length];
            ctx.beginPath(); ctx.arc(ox + b.x, oy + b.y, 8, 0, Math.PI * 2); ctx.fill();
        }

        els.info.textContent =
            `${recording ? 'recording' : 'paused'} · ${history.length} ticks stored (${(history.length / SIM_HZ).toFixed(1)} s @ ${SIM_HZ} Hz, cap ${MAX_TICKS}) · ` +
            `each frame = ${N_BALLS} balls × 16 B = ${N_BALLS * 16} B`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
