// =============================================================================
// NETCODE — BEGINNER TIER DEMOS  ("Hello, Network")
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak into the global
// scope. Each demo runs only if its target canvas exists in the DOM — that way
// this file is safe to include from any page in the track even if a canvas is
// missing.
//
// What this tier teaches (in order):
//   1. packetLaneDemo      — see RTT / jitter / loss / reorder visualised
//   2. tickVsFrameDemo     — the gap between simulation ticks and render frames
//   3. bandwidthCalcDemo   — the bandwidth tradeoff equation, made interactive
//   4. pingPongDemo        — capstone: two clients exchanging messages
//
// UNITS used throughout the file (these are *the* convention for the whole
// netcode track; later tiers inherit them):
//   time         milliseconds (ms) for all network timing
//   latency      one-way (ms); RTT = 2 × one-way
//   bandwidth    bytes/sec; we render in kbps where it's friendlier
//   tick rate    hertz (ticks per second)
//
// DEPENDENCIES (loaded by the tier HTML BEFORE this file):
//   shared/utils.js        — Vector2D, lerp, clamp, map, clearCanvas
//   net/seeded-rng.js      — window.SeededRng
//   net/fake-network.js    — window.FakeNetwork
//
// Top-level names this file introduces (all verified absent from shared/utils.js
// and from sibling -demos.js files — no global collision):
//   NET_COLORS, MAX_DT, fmtMs, fmtKbps, fmtBytes, formatNumber
// =============================================================================

(function setupScrollToTop() {
    // Same scroll-to-top behaviour as every other page in the project.
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
// Shared palette so all netcode demos read as one visual family. The whole
// track uses cyan = "client", orange = "server", red = "lost", green = "ok",
// purple = "reordered". Memorise these — every demo from here on uses them.
// ---------------------------------------------------------------------------
const NET_COLORS = {
    bg:           '#0d1117',
    panel:        '#1a1f3a',
    panelEdge:    '#2d3354',
    laneFill:     '#161b2c',
    laneEdge:     '#2e3548',
    grid:         '#252b4a',
    client:       '#4fc3f7',  // cyan
    server:       '#ffa726',  // orange
    okPacket:     '#66bb6a',  // delivered
    lostPacket:   '#ef5350',  // dropped
    reorderedPacket: '#ba68c8', // delayed-extra (reorder boost)
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    accent:       '#fbc02d',
};

// Global frame-delta safety rail — same value the racing-sim track uses.
// Tab refocus or hot GPU never produces a > 50 ms dt.
const MAX_DT = 0.05; // seconds

// ---------------------------------------------------------------------------
// Tiny formatters used by HUDs and the bandwidth calculator.
// Kept as named top-level helpers so each demo's IIFE doesn't redefine them.
// ---------------------------------------------------------------------------
function fmtMs(ms) {
    if (ms < 10) return ms.toFixed(1) + ' ms';
    return Math.round(ms) + ' ms';
}

function fmtKbps(bytesPerSec) {
    const kbps = (bytesPerSec * 8) / 1000;
    if (kbps < 10) return kbps.toFixed(2) + ' kbps';
    if (kbps < 1000) return kbps.toFixed(1) + ' kbps';
    return (kbps / 1000).toFixed(2) + ' Mbps';
}

function fmtBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// =============================================================================
// DEMO 1 — packetLaneDemo
//
// A single-direction lane from "client" to "server". Auto-sends a packet every
// ~700 ms. Each in-flight packet is drawn as a labelled circle, animated along
// the lane from sent → delivered based on (now - sentAt) / delay. Sliders for
// RTT, jitter, loss, reorder let the learner SEE what each parameter does.
//
// Teaching goals:
//   - "RTT" is the round-trip — one-way is half of that (lane animation runs
//     at one-way speed).
//   - Jitter makes equally-spaced sends arrive bunched up or stretched out.
//   - Loss makes packets simply disappear mid-flight (drawn as a faded X).
//   - Reorder occasionally makes a later number arrive BEFORE an earlier one
//     (purple-tinted; reordered packets get a fat halo so you can see them).
// =============================================================================
(function packetLaneDemo() {
    const canvas = document.getElementById('packetLaneCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // UI bindings — fail loudly in console if any are missing (catches typos
    // between the HTML and this file early).
    const els = {
        rtt: document.getElementById('plRtt'),
        jitter: document.getElementById('plJitter'),
        loss: document.getElementById('plLoss'),
        reorder: document.getElementById('plReorder'),
        rttVal: document.getElementById('plRttVal'),
        jitterVal: document.getElementById('plJitterVal'),
        lossVal: document.getElementById('plLossVal'),
        reorderVal: document.getElementById('plReorderVal'),
        reset: document.getElementById('plReset'),
        pause: document.getElementById('plPause'),
        stats: document.getElementById('plStats'),
    };

    // ENDPOINTS / NETWORK ----------------------------------------------------
    // One FakeNetwork; the visualisation reads `net.inFlight` every frame to
    // draw each packet at its interpolated position along the lane.
    const net = new FakeNetwork({ rttMs: 120, jitterMs: 20, lossRate: 0.05, reorderRate: 0.05, seed: 7 });
    const client = net.connect('client');
    /* server */ net.connect('server');

    // Recently-displayed "lost packet" markers — packets that were dropped
    // never actually appear in `net.inFlight` (we drop them at enqueue time
    // to model UDP), so for visualisation we tap into the loss decision by
    // wrapping `send`. The wrapper records the sequence number's fate.
    const recentEvents = []; // {kind:'lost'|'delivered'|'reordered', seq, t}
    const EVENT_FADE_MS = 800;

    // Tracking — sequence numbers + per-packet metadata for the renderer.
    let nextSeq = 1;
    const inFlightMeta = new Map(); // msgId -> { seq, sentAt, delay, reordered }

    // Override send so we know which packets got picked for loss/reorder.
    // The wrapper sniffs net.stats deltas to figure out what happened to the
    // last call (loss is recorded synchronously inside _enqueue).
    function sendOne() {
        const seq = nextSeq++;
        const msgId = `m${seq}`;
        const beforeSent = net.stats.sent;
        const beforeDropped = net.stats.dropped;
        const beforeReordered = net.stats.reordered;
        client.send('server', { id: msgId, seq });
        // After the call: net.stats reflects the outcome.
        const dropped = net.stats.dropped > beforeDropped;
        const reordered = net.stats.reordered > beforeReordered;
        if (dropped) {
            recentEvents.push({ kind: 'lost', seq, t: performance.now() });
        } else {
            // Find the corresponding queue entry — it's the most recent one
            // matching this msgId (sorted by deliverAt; we look up by id).
            const pkt = net.inFlight.find(p => p.msg.id === msgId);
            if (pkt) {
                inFlightMeta.set(msgId, { seq, sentAt: pkt.sentAt, delay: pkt.delay, reordered });
            }
        }
    }

    // Delivery hook: when a packet arrives, log it.
    document.getElementById && (function () {
        const srv = net.endpoints.get('server').endpoint;
        srv.onMessage((from, msg) => {
            const meta = inFlightMeta.get(msg.id);
            recentEvents.push({
                kind: meta && meta.reordered ? 'reordered' : 'delivered',
                seq: msg.seq,
                t: performance.now(),
            });
            inFlightMeta.delete(msg.id);
        });
    })();

    // CONTROLS ---------------------------------------------------------------
    function syncSliders() {
        const rtt = +els.rtt.value;
        const jitter = +els.jitter.value;
        const loss = +els.loss.value / 100;
        const reorder = +els.reorder.value / 100;
        els.rttVal.textContent = rtt + ' ms';
        els.jitterVal.textContent = '±' + jitter + ' ms';
        els.lossVal.textContent = (loss * 100).toFixed(0) + ' %';
        els.reorderVal.textContent = (reorder * 100).toFixed(0) + ' %';
        net.setParams({ rttMs: rtt, jitterMs: jitter, lossRate: loss, reorderRate: reorder });
    }
    ['rtt', 'jitter', 'loss', 'reorder'].forEach(k => els[k].addEventListener('input', syncSliders));
    syncSliders();

    let paused = false;
    els.pause.addEventListener('click', () => {
        paused = !paused;
        els.pause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    });
    els.reset.addEventListener('click', () => {
        net.flush();
        net.resetStats();
        inFlightMeta.clear();
        recentEvents.length = 0;
        nextSeq = 1;
    });

    // LAYOUT -----------------------------------------------------------------
    const W = canvas.width, H = canvas.height;
    const laneY = H / 2;
    const laneX0 = 110;
    const laneX1 = W - 110;
    const laneLen = laneX1 - laneX0;

    // SEND TIMER -------------------------------------------------------------
    // Auto-send every ~700 ms so packets visibly march down the lane without
    // the user having to mash a button. Seed-driven so timing is deterministic
    // (well, modulo browser raf jitter — fine for teaching).
    let sendAccum = 0;
    const SEND_INTERVAL_MS = 700;

    // RENDER -----------------------------------------------------------------
    function drawLane() {
        // Background panel.
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, W, H);

        // Endpoints.
        drawEndpoint('CLIENT', laneX0, laneY, NET_COLORS.client);
        drawEndpoint('SERVER', laneX1, laneY, NET_COLORS.server);

        // The lane itself — a long thin rounded rect.
        ctx.fillStyle = NET_COLORS.laneFill;
        ctx.fillRect(laneX0, laneY - 18, laneLen, 36);
        ctx.strokeStyle = NET_COLORS.laneEdge;
        ctx.lineWidth = 1;
        ctx.strokeRect(laneX0 + 0.5, laneY - 17.5, laneLen, 35);

        // Direction arrow above the lane.
        ctx.fillStyle = NET_COLORS.labelMuted;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('→  packets travel at one-way latency (rtt/2)  →', W / 2, laneY - 30);
    }

    function drawEndpoint(label, x, y, color) {
        ctx.fillStyle = NET_COLORS.panel;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + 4);
    }

    function drawInFlight(now) {
        for (const pkt of net.inFlight) {
            const meta = inFlightMeta.get(pkt.msg.id);
            if (!meta) continue;
            // Progress from 0 (just sent) → 1 (about to arrive).
            const t = pkt.delay <= 0 ? 1 : clamp((now - pkt.sentAt) / pkt.delay, 0, 1);
            const x = lerp(laneX0 + 38, laneX1 - 38, t);
            const isReordered = meta.reordered;
            const color = isReordered ? NET_COLORS.reorderedPacket : NET_COLORS.okPacket;

            // Reorder halo — fat ring so the eye catches it.
            if (isReordered) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.arc(x, laneY, 16, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, laneY, 11, 0, Math.PI * 2);
            ctx.fill();

            // Sequence number.
            ctx.fillStyle = '#0d1117';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(meta.seq, x, laneY + 4);
        }
    }

    function drawRecentEvents(now) {
        // Fade out + scroll up. Lost packets show an X above the SERVER side
        // of the lane; reordered show a purple "reordered" pill near the SERVER.
        for (let i = recentEvents.length - 1; i >= 0; i--) {
            const ev = recentEvents[i];
            const age = now - ev.t;
            if (age > EVENT_FADE_MS) { recentEvents.splice(i, 1); continue; }
            const alpha = 1 - age / EVENT_FADE_MS;
            const yOff = -32 - age / EVENT_FADE_MS * 18;
            const x = laneX1 - 60;
            const y = laneY + yOff;

            ctx.globalAlpha = alpha;
            if (ev.kind === 'lost') {
                ctx.strokeStyle = NET_COLORS.lostPacket;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6);
                ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6);
                ctx.stroke();
                ctx.fillStyle = NET_COLORS.lostPacket;
                ctx.font = '11px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(`#${ev.seq} dropped`, x + 12, y + 4);
            } else if (ev.kind === 'reordered') {
                ctx.fillStyle = NET_COLORS.reorderedPacket;
                ctx.font = '11px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(`#${ev.seq} arrived (late!)`, x - 8, y + 4);
            } else {
                ctx.fillStyle = NET_COLORS.okPacket;
                ctx.font = '11px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(`#${ev.seq} arrived`, x + 8, y + 4);
            }
            ctx.globalAlpha = 1;
        }
    }

    function updateStats() {
        const s = net.stats;
        const dropPct = s.sent ? (100 * s.dropped / s.sent).toFixed(1) : '0.0';
        const reorderPct = s.sent ? (100 * s.reordered / s.sent).toFixed(1) : '0.0';
        els.stats.innerHTML =
            `sent <strong>${s.sent}</strong> · ` +
            `delivered <strong style="color:${NET_COLORS.okPacket}">${s.delivered}</strong> · ` +
            `dropped <strong style="color:${NET_COLORS.lostPacket}">${s.dropped}</strong> (${dropPct}%) · ` +
            `reordered <strong style="color:${NET_COLORS.reorderedPacket}">${s.reordered}</strong> (${reorderPct}%)`;
    }

    // Per-frame loop ---------------------------------------------------------
    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        if (!paused) {
            sendAccum += dt * 1000;
            while (sendAccum >= SEND_INTERVAL_MS) {
                sendAccum -= SEND_INTERVAL_MS;
                sendOne();
            }
            net.tick(now);
        }

        drawLane();
        drawInFlight(now);
        drawRecentEvents(now);
        updateStats();

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 2 — tickVsFrameDemo
//
// A simulation runs at a chosen tick rate (Hz). The render runs every animation
// frame (browser-driven, ~60 Hz). The point is: ticks and frames are NOT
// aligned, and the "obvious" choice of just drawing the latest simulation
// state produces visible stutter at low tick rates.
//
// What you see:
//   - Top rail: ticks (vertical bars at every 1/tickRate seconds)
//   - Bottom rail: render frames (vertical bars at every ~16 ms)
//   - The orange "true" position advances by tick (snaps).
//   - The cyan "rendered" position uses either snap (= latest tick) OR
//     interpolation between the last two ticks, depending on the toggle.
// =============================================================================
(function tickVsFrameDemo() {
    const canvas = document.getElementById('tickVsFrameCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        tickRate: document.getElementById('tvfTickRate'),
        tickRateVal: document.getElementById('tvfTickRateVal'),
        interp: document.getElementById('tvfInterp'),
        info: document.getElementById('tvfInfo'),
    };

    // SIMULATION STATE -------------------------------------------------------
    // A 1D "bar" position in canvas coords. Moves at constant velocity.
    const W = canvas.width, H = canvas.height;
    const MARGIN = 80;
    const xMin = MARGIN, xMax = W - MARGIN;
    const VEL = 220; // px/s

    // We keep the last two tick states so we can lerp between them on render.
    let prevTickPos = xMin;
    let prevTickTime = performance.now() / 1000;
    let currTickPos = xMin;
    let currTickTime = prevTickTime;
    let direction = 1;

    let tickAccum = 0;       // seconds since last tick
    let renderAccum = 0;     // for FPS measurement
    let renderCount = 0;
    let fps = 60;

    let last = performance.now();

    function stepTick(dt) {
        // Advance true simulation by dt at velocity VEL.
        prevTickPos = currTickPos;
        prevTickTime = currTickTime;
        currTickPos += direction * VEL * dt;
        if (currTickPos > xMax) { currTickPos = xMax; direction = -1; }
        if (currTickPos < xMin) { currTickPos = xMin; direction = 1; }
        currTickTime = performance.now() / 1000;
    }

    // ---- Drawing helpers --------------------------------------------------
    function drawRail(label, y, ticks, color) {
        ctx.strokeStyle = NET_COLORS.laneEdge;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xMin, y); ctx.lineTo(xMax, y); ctx.stroke();
        for (const t of ticks) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(t, y - 8); ctx.lineTo(t, y + 8);
            ctx.stroke();
        }
        ctx.fillStyle = NET_COLORS.labelMuted;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(label, 8, y + 4);
    }

    // Recent tick X positions for the top rail; recent frame times for the
    // bottom rail. Rolling buffer (~last 2 seconds).
    const recentTickXs = [];
    const recentFrameXs = [];
    const HIST_WINDOW = 2.0; // seconds

    function pruneOld(arr) {
        const cutoff = performance.now() / 1000 - HIST_WINDOW;
        while (arr.length && arr[0].t < cutoff) arr.shift();
    }

    function frame(now) {
        let dtSec = (now - last) / 1000;
        last = now;
        if (dtSec > MAX_DT) dtSec = MAX_DT;

        const tickRate = +els.tickRate.value;
        els.tickRateVal.textContent = tickRate + ' Hz';
        const tickPeriod = 1 / tickRate;

        // Step zero or more simulation ticks this frame.
        tickAccum += dtSec;
        while (tickAccum >= tickPeriod) {
            tickAccum -= tickPeriod;
            stepTick(tickPeriod);
            recentTickXs.push({ x: currTickPos, t: now / 1000 });
        }

        // Record this render frame for the visualisation rail.
        recentFrameXs.push({ x: lerp(xMin, xMax, ((now / 1000) % 4) / 4), t: now / 1000 });
        pruneOld(recentTickXs);
        pruneOld(recentFrameXs);

        // Compute the rendered position.
        let renderedX;
        if (els.interp.checked) {
            // Interpolate from prev → curr based on time since last tick.
            const alpha = clamp(tickAccum / tickPeriod, 0, 1);
            renderedX = lerp(prevTickPos, currTickPos, alpha);
        } else {
            renderedX = currTickPos;
        }

        // Naive FPS measure for the info bar.
        renderAccum += dtSec;
        renderCount++;
        if (renderAccum >= 0.5) {
            fps = renderCount / renderAccum;
            renderAccum = 0;
            renderCount = 0;
        }

        // ---- DRAW -----
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, W, H);

        // Two parallel rails — ticks on top, render frames on the bottom.
        // We draw ticks at their actual X positions in the simulation, NOT at
        // their times — the X-positions ARE what the simulation produces, and
        // those are the snapshots we'd send over the network. The frame rail
        // (bottom) is purely for visual contrast: shows that frames march at
        // their own cadence regardless of ticks.
        const tickY = 110;
        const renderY = H - 80;
        drawRail(`sim ticks @ ${tickRate} Hz`, tickY, recentTickXs.map(r => r.x), NET_COLORS.server);
        drawRail(`render @ ${fps.toFixed(0)} fps (browser)`, renderY, recentFrameXs.map(r => r.x), NET_COLORS.client);

        // The "true" simulation position — drawn as an orange ball on the tick rail.
        ctx.fillStyle = NET_COLORS.server;
        ctx.beginPath(); ctx.arc(currTickPos, tickY, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0d1117'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText('SIM', currTickPos, tickY + 4);

        // The rendered position — cyan ball on the render rail.
        ctx.fillStyle = NET_COLORS.client;
        ctx.beginPath(); ctx.arc(renderedX, renderY, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0d1117'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText('REN', renderedX, renderY + 4);

        // Gap arrow showing how far apart SIM and REN are.
        ctx.strokeStyle = NET_COLORS.accent;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(currTickPos, tickY + 10);
        ctx.lineTo(renderedX, renderY - 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Header text.
        ctx.fillStyle = NET_COLORS.label;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SIM advances in tick steps. REN tracks it every frame.', W / 2, 24);
        ctx.fillStyle = NET_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        const note = els.interp.checked
            ? 'Interpolation ON — REN slides smoothly between the previous two SIM positions.'
            : 'Interpolation OFF — REN snaps to the latest SIM position (jittery at low tick rates).';
        ctx.fillText(note, W / 2, 44);

        els.info.textContent = `tickRate ${tickRate} Hz · period ${(tickPeriod * 1000).toFixed(0)} ms · fps ${fps.toFixed(0)} · gap |sim−ren| = ${Math.abs(currTickPos - renderedX).toFixed(1)} px`;

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();

// =============================================================================
// DEMO 3 — bandwidthCalcDemo
//
// The bandwidth tradeoff equation:
//   bytes/sec  =  tickRate × playerCount × entitiesPerPlayer × bytesPerEntity
// We render that for a single client's outbound stream AND for the server's
// outbound stream (which scales by another × playerCount).
//
// Reference bands shown on a horizontal meter:
//   < 64 kbps   modem-era
//   < 1 Mbps    mobile / DSL
//   < 10 Mbps   broadband
//   anything bigger is "you'd better stream only what's needed".
//
// Presets show realistic numbers from shipped games.
// =============================================================================
(function bandwidthCalcDemo() {
    const root = document.getElementById('bandwidthCalc');
    if (!root) return;

    const els = {
        tick:     document.getElementById('bwTick'),
        players:  document.getElementById('bwPlayers'),
        entities: document.getElementById('bwEntities'),
        bytes:    document.getElementById('bwBytes'),
        tickVal:  document.getElementById('bwTickVal'),
        playersVal: document.getElementById('bwPlayersVal'),
        entitiesVal: document.getElementById('bwEntitiesVal'),
        bytesVal:    document.getElementById('bwBytesVal'),
        clientOut:   document.getElementById('bwClientOut'),
        serverOut:   document.getElementById('bwServerOut'),
        meterFill:   document.getElementById('bwMeterFill'),
        meterLabel:  document.getElementById('bwMeterLabel'),
        verdict:     document.getElementById('bwVerdict'),
    };

    const presets = root.querySelectorAll('[data-preset]');
    presets.forEach(btn => {
        btn.addEventListener('click', () => {
            const cfg = JSON.parse(btn.dataset.preset);
            els.tick.value = cfg.tick;
            els.players.value = cfg.players;
            els.entities.value = cfg.entities;
            els.bytes.value = cfg.bytes;
            recompute();
        });
    });

    function recompute() {
        const tick = +els.tick.value;
        const players = +els.players.value;
        const entities = +els.entities.value;
        const bytes = +els.bytes.value;

        els.tickVal.textContent = tick + ' Hz';
        els.playersVal.textContent = players;
        els.entitiesVal.textContent = entities;
        els.bytesVal.textContent = bytes + ' B';

        // Per-client outbound (client → server is small; server → client is the
        // headliner). We model the server → ONE client stream first, then the
        // server's total upstream load (× players).
        const perClientBytesPerSec = tick * players * entities * bytes;
        const serverTotalBytesPerSec = perClientBytesPerSec * players;

        els.clientOut.textContent = fmtKbps(perClientBytesPerSec) + '   (' + fmtBytes(perClientBytesPerSec) + '/s, ' + formatNumber(perClientBytesPerSec) + ' B/s)';
        els.serverOut.textContent = fmtKbps(serverTotalBytesPerSec) + '   (' + fmtBytes(serverTotalBytesPerSec) + '/s, ' + formatNumber(serverTotalBytesPerSec) + ' B/s)';

        // Meter — per-client kbps relative to a log-ish 10 Mbps cap.
        const kbps = perClientBytesPerSec * 8 / 1000;
        const meterPct = clamp(Math.log10(Math.max(1, kbps)) / Math.log10(10000), 0, 1) * 100;
        els.meterFill.style.width = meterPct.toFixed(1) + '%';

        let color, verdict, regimeLabel;
        if (kbps < 64) {
            color = '#66bb6a'; regimeLabel = 'MODEM-FRIENDLY';
            verdict = 'Tiny stream — even a 56k modem could keep up. Common for low-tick MMOs.';
        } else if (kbps < 1000) {
            color = '#4fc3f7'; regimeLabel = 'MOBILE / DSL OK';
            verdict = 'Fine for mobile data and ADSL. Typical for shooters at 30–60 Hz with light state.';
        } else if (kbps < 10000) {
            color = '#ffa726'; regimeLabel = 'BROADBAND ONLY';
            verdict = 'Needs broadband. You\'re bumping into the bandwidth class where delta compression starts paying off.';
        } else {
            color = '#ef5350'; regimeLabel = 'TOO MUCH';
            verdict = 'Over 10 Mbps per client is rarely acceptable. Add area-of-interest (Expert), delta compression and quantization (Advanced).';
        }
        els.meterFill.style.backgroundColor = color;
        els.meterLabel.textContent = regimeLabel;
        els.meterLabel.style.color = color;
        els.verdict.textContent = verdict;
    }

    ['tick', 'players', 'entities', 'bytes'].forEach(k => els[k].addEventListener('input', recompute));
    recompute();
})();

// =============================================================================
// DEMO 4 — pingPongDemo  (capstone mini-project)
//
// Two clients (A and B) exchanging messages through the FakeNetwork. Each
// client occupies a panel on the canvas. The middle is the network lane,
// with packets travelling both directions visible as colored circles labelled
// with their direction (A→B or B→A) and sequence number.
//
// Per-client stats: messages sent, messages received, message log (last 5).
//
// Buttons under each client:
//   "Send ping"       — one packet
//   "Send burst (5)"  — five packets in quick succession (lets the user see
//                       jitter and loss interact in bulk)
//
// Sliders bind to net.setParams(). A seed input + Reset button reset
// the network so the user can prove determinism by hand: same seed +
// same sequence of button presses → same outcome.
// =============================================================================
(function pingPongDemo() {
    const canvas = document.getElementById('pingPongCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const els = {
        rtt: document.getElementById('ppRtt'),
        jitter: document.getElementById('ppJitter'),
        loss: document.getElementById('ppLoss'),
        reorder: document.getElementById('ppReorder'),
        rttVal: document.getElementById('ppRttVal'),
        jitterVal: document.getElementById('ppJitterVal'),
        lossVal: document.getElementById('ppLossVal'),
        reorderVal: document.getElementById('ppReorderVal'),
        seed: document.getElementById('ppSeed'),
        reset: document.getElementById('ppReset'),
        sendA: document.getElementById('ppSendA'),
        burstA: document.getElementById('ppBurstA'),
        sendB: document.getElementById('ppSendB'),
        burstB: document.getElementById('ppBurstB'),
        statsA: document.getElementById('ppStatsA'),
        statsB: document.getElementById('ppStatsB'),
        logA: document.getElementById('ppLogA'),
        logB: document.getElementById('ppLogB'),
        globalStats: document.getElementById('ppGlobalStats'),
    };

    let net, A, B;
    const inFlightMeta = new Map();  // msgId -> {seq, dir, sentAt, delay, reordered}
    const counters = { aSent: 0, aRecv: 0, bSent: 0, bRecv: 0 };
    const logsA = []; // most recent first; up to 5
    const logsB = [];
    const LOG_MAX = 5;
    let seqA = 1, seqB = 1;

    function buildNetwork() {
        net = new FakeNetwork({
            rttMs:        +els.rtt.value,
            jitterMs:     +els.jitter.value,
            lossRate:     +els.loss.value / 100,
            reorderRate:  +els.reorder.value / 100,
            seed:         +els.seed.value || 1,
        });
        A = net.connect('A');
        B = net.connect('B');
        A.onMessage((from, msg) => {
            counters.aRecv++;
            const meta = inFlightMeta.get(msg.id);
            logsA.unshift({ from, seq: msg.seq, reordered: meta?.reordered, t: performance.now() });
            if (logsA.length > LOG_MAX) logsA.length = LOG_MAX;
            inFlightMeta.delete(msg.id);
        });
        B.onMessage((from, msg) => {
            counters.bRecv++;
            const meta = inFlightMeta.get(msg.id);
            logsB.unshift({ from, seq: msg.seq, reordered: meta?.reordered, t: performance.now() });
            if (logsB.length > LOG_MAX) logsB.length = LOG_MAX;
            inFlightMeta.delete(msg.id);
        });
    }

    function fullReset() {
        if (net) net.flush();
        counters.aSent = counters.aRecv = counters.bSent = counters.bRecv = 0;
        logsA.length = 0; logsB.length = 0;
        seqA = 1; seqB = 1;
        inFlightMeta.clear();
        buildNetwork();
    }

    function send(fromId) {
        const isA = fromId === 'A';
        const ep = isA ? A : B;
        const seq = isA ? seqA++ : seqB++;
        const msgId = `${fromId}${seq}`;
        const beforeDropped = net.stats.dropped;
        const beforeReordered = net.stats.reordered;
        ep.send(isA ? 'B' : 'A', { id: msgId, seq });
        if (isA) counters.aSent++; else counters.bSent++;
        if (net.stats.dropped > beforeDropped) return; // dropped at enqueue
        const pkt = net.inFlight.find(p => p.msg.id === msgId);
        if (pkt) {
            inFlightMeta.set(msgId, {
                seq,
                dir: isA ? 'AtoB' : 'BtoA',
                sentAt: pkt.sentAt,
                delay: pkt.delay,
                reordered: net.stats.reordered > beforeReordered,
            });
        }
    }

    function burst(fromId) {
        for (let i = 0; i < 5; i++) send(fromId);
    }

    // Wire controls.
    function syncSliders() {
        const rtt = +els.rtt.value;
        const jitter = +els.jitter.value;
        const loss = +els.loss.value / 100;
        const reorder = +els.reorder.value / 100;
        els.rttVal.textContent = rtt + ' ms';
        els.jitterVal.textContent = '±' + jitter + ' ms';
        els.lossVal.textContent = (loss * 100).toFixed(0) + ' %';
        els.reorderVal.textContent = (reorder * 100).toFixed(0) + ' %';
        if (net) net.setParams({ rttMs: rtt, jitterMs: jitter, lossRate: loss, reorderRate: reorder });
    }
    ['rtt', 'jitter', 'loss', 'reorder'].forEach(k => els[k].addEventListener('input', syncSliders));
    els.sendA.addEventListener('click', () => send('A'));
    els.burstA.addEventListener('click', () => burst('A'));
    els.sendB.addEventListener('click', () => send('B'));
    els.burstB.addEventListener('click', () => burst('B'));
    els.reset.addEventListener('click', fullReset);
    els.seed.addEventListener('change', fullReset);

    fullReset();
    syncSliders();

    // Layout: three columns.
    const W = canvas.width, H = canvas.height;
    const colW = W / 3;
    const cxA = colW / 2;
    const cxB = colW * 2.5;
    const laneX0 = colW + 50;
    const laneX1 = colW * 2 - 50;
    const laneY = H / 2;

    function drawClientPanel(label, cx, color) {
        const cy = H / 2;
        ctx.fillStyle = NET_COLORS.panel;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, cx, cy + 6);
    }

    function drawLaneAndPackets(now) {
        // Lane (slimmer than packetLane — two-way).
        ctx.fillStyle = NET_COLORS.laneFill;
        ctx.fillRect(laneX0, laneY - 30, laneX1 - laneX0, 60);
        ctx.strokeStyle = NET_COLORS.laneEdge;
        ctx.strokeRect(laneX0 + 0.5, laneY - 29.5, laneX1 - laneX0, 59);

        // Direction labels.
        ctx.fillStyle = NET_COLORS.labelMuted;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('→  A → B', (laneX0 + laneX1) / 2, laneY - 38);
        ctx.fillText('B → A  ←', (laneX0 + laneX1) / 2, laneY + 48);

        // In-flight packets: A→B on top half of the lane, B→A on bottom half.
        for (const pkt of net.inFlight) {
            const meta = inFlightMeta.get(pkt.msg.id);
            if (!meta) continue;
            const t = pkt.delay <= 0 ? 1 : clamp((now - pkt.sentAt) / pkt.delay, 0, 1);
            let x, y;
            if (meta.dir === 'AtoB') {
                x = lerp(laneX0 + 10, laneX1 - 10, t);
                y = laneY - 14;
            } else {
                x = lerp(laneX1 - 10, laneX0 + 10, t);
                y = laneY + 14;
            }
            const color = meta.reordered ? NET_COLORS.reorderedPacket : NET_COLORS.okPacket;
            if (meta.reordered) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2; ctx.globalAlpha = 0.4;
                ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 1;
            }
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0d1117';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(meta.seq, x, y + 3);
        }
    }

    function updateHud() {
        els.statsA.innerHTML = `sent <strong>${counters.aSent}</strong> · received <strong>${counters.aRecv}</strong>`;
        els.statsB.innerHTML = `sent <strong>${counters.bSent}</strong> · received <strong>${counters.bRecv}</strong>`;
        const s = net.stats;
        const dropPct = s.sent ? (100 * s.dropped / s.sent).toFixed(0) : '0';
        els.globalStats.innerHTML =
            `network sent <strong>${s.sent}</strong> · delivered <strong>${s.delivered}</strong> · dropped <strong>${s.dropped}</strong> (${dropPct}%) · reordered <strong>${s.reordered}</strong>`;
        renderLog(els.logA, logsA);
        renderLog(els.logB, logsB);
    }
    function renderLog(el, items) {
        if (items.length === 0) { el.textContent = '(nothing yet)'; return; }
        el.innerHTML = items
            .map(it => {
                const tag = it.reordered ? `<span style="color:${NET_COLORS.reorderedPacket}">[late]</span>` : '';
                return `← ${it.from} #${it.seq} ${tag}`;
            })
            .join('<br>');
    }

    let last = performance.now();
    function frame(now) {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > MAX_DT) dt = MAX_DT;

        net.tick(now);

        // Render.
        ctx.fillStyle = NET_COLORS.bg;
        ctx.fillRect(0, 0, W, H);
        drawClientPanel('A', cxA, NET_COLORS.client);
        drawClientPanel('B', cxB, NET_COLORS.server);
        drawLaneAndPackets(now);
        updateHud();

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
