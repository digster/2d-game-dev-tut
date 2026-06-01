// =============================================================================
// PLATFORMER — INTERMEDIATE TIER DEMOS ("Game Feel")
// =============================================================================
// The Beginner jump WORKS; this tier makes it feel RIGHT. Six demos, each an
// IIFE that early-returns if its canvas is absent. Every demo drives the SAME
// configurable controller (`PlayerBody`) with one feel feature flipped on, so
// you can feel each one in isolation — then the capstone turns them all on.
//
//   1. coyoteDemo     — coyote time: jump for a few ms AFTER leaving a ledge
//   2. bufferDemo     — jump buffering: a jump pressed just BEFORE landing still fires
//   3. variableDemo   — variable jump height: release early to cut the jump short
//   4. gravityDemo    — apex hangtime + asymmetric jump/fall gravity + fast-fall
//   5. cornerDemo     — corner correction: nudge past a head-bonk near a ledge
//   6. feelLabDemo    — capstone "Feel Lab": every assist on a toggle, raw vs juiced,
//                       with a live player state machine + squash-and-stretch
//
// DEPENDENCIES (loaded BEFORE this file by intermediate.html):
//   ../shared/utils.js   — clearCanvas, clamp (globals)
//   engine/tilemap.js    — PFTile, TileMap, PF, drawTileMap
//   engine/physics.js    — AABB, moveAndCollide
//   engine/input.js      — pfInstallKeys, pfLoop
//
// COLLISION NOTE: top-level names added here — PlayerBody, RAW_CFG, JUICED_CFG,
// pfDrawBody, pfFocusHint, pfTimerBar — are all new vs shared/utils.js and the
// engine globals. (pfFocusHint is RE-declared here, not shared from
// beginner-demos.js, because only one tier's demos file loads per page.)
//
// PROMOTION NOTE (ARCHITECTURE.md): PlayerBody is the tier's lesson, so it lives
// inline here. When the Advanced tier becomes its 2nd consumer it graduates to
// engine/player.js — the actors.js/vision.js pattern.
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

// ---- PlayerBody + RAW_CFG/JUICED_CFG + PF_STATE_COLOR + pfDrawBody now live in
// engine/player.js (promoted there once the Advanced tier became their 2nd
// consumer — the actors.js/vision.js "≥2 tier files ⇒ engine/" rule). This page
// loads engine/player.js before this file, so all four names are already global.
// Only the per-tier UI helpers below (pfFocusHint, pfTimerBar) stay local.

function pfFocusHint(ctx, w, h, focused) {
    if (focused) return;
    ctx.fillStyle = 'rgba(13,17,23,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶ click here, then use the keyboard', w / 2, h / 2);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

// A small labelled timer bar (used to visualise the coyote / buffer windows).
function pfTimerBar(ctx, x, y, frac, color, label) {
    const W = 64, H = 6;
    ctx.fillStyle = PF.dim; ctx.fillRect(x, y, W, H);
    ctx.fillStyle = color; ctx.fillRect(x, y, W * clamp(frac, 0, 1), H);
    ctx.fillStyle = PF.text; ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText(label, x, y - 4);
}

// =============================================================================
// DEMO 1 — coyoteDemo : COYOTE TIME
// Run off the ledge, then press jump a moment too late. With coyote time on, a
// short grace window after leaving the ground still lets you jump.
// =============================================================================
(function coyoteDemo() {
    const canvas = document.getElementById('pfCoyoteCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(1, rows - 3, 9, rows - 3, PFTile.SOLID);  // a platform with an edge at col 9
    map.fillRect(14, rows - 6, cols - 2, rows - 6, PFTile.SOLID); // a higher far platform
    map.fillRect(1, rows - 1, cols - 2, rows - 1, PFTile.SOLID);  // safety floor

    const body = new PlayerBody(map, 3 * TS, (rows - 4) * TS, { coyoteMs: 100 });
    const input = pfInstallKeys(canvas);
    const cb = document.getElementById('pfCoyoteOn');
    const sl = document.getElementById('pfCoyoteMs');
    const slVal = document.getElementById('pfCoyoteMsVal');
    const hud = document.getElementById('pfCoyoteHud');
    document.getElementById('pfCoyoteReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    function update(dt) {
        body.cfg.coyoteMs = cb.checked ? +sl.value : 0;
        body.update(dt, input);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        const inCoyote = !body.onGround && body.coyoteLeft > 1e-3 && body.cfg.coyoteMs > 0;
        pfDrawBody(ctx, body, inCoyote ? PF.item : undefined);
        if (inCoyote) pfTimerBar(ctx, body.box.x - 20, body.box.y - 16, body.coyoteLeft / (body.cfg.coyoteMs / 1000), PF.item, 'coyote');
        pfFocusHint(ctx, W, H, input.focused);
        if (slVal) slVal.textContent = sl.value;
        hud.textContent = cb.checked
            ? `coyote ON (${sl.value} ms) — run off the edge, then jump a touch late: it still works`
            : `coyote OFF — leave the edge and the jump is gone. Turn it on and feel the difference`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 2 — bufferDemo : JUMP BUFFERING
// Press jump a few frames BEFORE you land; the press is remembered and fires the
// instant you touch down, so an early press is never "eaten".
// =============================================================================
(function bufferDemo() {
    const canvas = document.getElementById('pfBufferCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(1, rows - 1, cols - 2, rows - 1, PFTile.SOLID);   // ground
    map.fillRect(8, rows - 5, 12, rows - 5, PFTile.SOLID);         // a platform to land on

    const body = new PlayerBody(map, 3 * TS, (rows - 2) * TS, { bufferMs: 120 });
    const input = pfInstallKeys(canvas);
    const cb = document.getElementById('pfBufferOn');
    const sl = document.getElementById('pfBufferMs');
    const slVal = document.getElementById('pfBufferMsVal');
    const hud = document.getElementById('pfBufferHud');
    document.getElementById('pfBufferReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    let flash = 0;
    function update(dt) {
        body.cfg.bufferMs = cb.checked ? +sl.value : 0;
        body.update(dt, input);
        if (body.usedBuffer) flash = 0.25;
        flash = Math.max(0, flash - dt);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        const buffering = !body.onGround && body.bufferLeft > 1e-3 && body.cfg.bufferMs > 0;
        pfDrawBody(ctx, body, flash > 0 ? '#b39ddb' : undefined);
        if (buffering) pfTimerBar(ctx, body.box.x - 20, body.box.y - 16, body.bufferLeft / (body.cfg.bufferMs / 1000), '#b39ddb', 'buffered');
        pfFocusHint(ctx, W, H, input.focused);
        if (slVal) slVal.textContent = sl.value;
        hud.textContent = cb.checked
            ? `buffer ON (${sl.value} ms) — tap jump just BEFORE you land; it fires on touchdown`
            : `buffer OFF — an early press is wasted. Turn it on and mash jump before landing`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 3 — variableDemo : VARIABLE JUMP HEIGHT (release to cut)
// Tap for a short hop, hold for a full jump. Releasing while still rising cuts
// upward velocity. The two dotted guides mark the short-hop and full apexes.
// =============================================================================
(function variableDemo() {
    const canvas = document.getElementById('pfVariableCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(1, rows - 1, cols - 2, rows - 1, PFTile.SOLID);

    const body = new PlayerBody(map, (cols >> 1) * TS, (rows - 2) * TS, { variable: true });
    const input = pfInstallKeys(canvas);
    const cb = document.getElementById('pfVariableOn');
    const hud = document.getElementById('pfVariableHud');
    document.getElementById('pfVariableReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    let peak = 0; // highest point reached this jump (px above ground)
    const groundY = (rows - 1) * TS;
    function update(dt) {
        body.cfg.variable = cb.checked;
        body.update(dt, input);
        const heightNow = groundY - body.box.bottom;
        if (body.onGround) peak = 0; else peak = Math.max(peak, heightNow);
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        // guides: full apex = v²/2g ; short-hop apex = (v·cut)²/2g
        const full = (body.cfg.jumpSpeed ** 2) / (2 * body.cfg.gravJump);
        const hop = ((body.cfg.jumpSpeed * body.cfg.cutFactor) ** 2) / (2 * body.cfg.gravJump);
        ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(102,187,106,0.7)'; ctx.beginPath(); ctx.moveTo(0, groundY - full); ctx.lineTo(W, groundY - full); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,167,38,0.7)'; ctx.beginPath(); ctx.moveTo(0, groundY - hop); ctx.lineTo(W, groundY - hop); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PF.good; ctx.font = '11px system-ui'; ctx.textAlign = 'left';
        ctx.fillText('full jump (hold)', 8, groundY - full - 4);
        ctx.fillStyle = PF.warn; ctx.fillText('short hop (tap)', 8, groundY - hop - 4);
        pfDrawBody(ctx, body);
        pfFocusHint(ctx, W, H, input.focused);
        hud.textContent = cb.checked
            ? `variable ON — TAP ↑/Space for a short hop, HOLD for the full jump · peak this jump: ${peak.toFixed(0)} px`
            : `variable OFF — every jump is full height no matter how briefly you tap · peak: ${peak.toFixed(0)} px`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 4 — gravityDemo : APEX HANGTIME + ASYMMETRIC GRAVITY + FAST-FALL
// Rise gravity < fall gravity makes the descent snappier; near the apex gravity
// is reduced so the top of the arc "hangs"; holding ↓ while falling drops you
// faster. The fading trail shows the arc's shape.
// =============================================================================
(function gravityDemo() {
    const canvas = document.getElementById('pfGravityFeelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(1, rows - 1, cols - 2, rows - 1, PFTile.SOLID);

    const body = new PlayerBody(map, (cols >> 1) * TS, (rows - 2) * TS,
        { variable: true, gravJump: 1400, gravFall: 2200, apexThreshold: 130, fastFallMult: 2.0 });
    const input = pfInstallKeys(canvas);
    const riseEl = document.getElementById('pfGravRise');
    const fallEl = document.getElementById('pfGravFall');
    const apexEl = document.getElementById('pfGravApex');
    const riseVal = document.getElementById('pfGravRiseVal');
    const fallVal = document.getElementById('pfGravFallVal');
    const apexVal = document.getElementById('pfGravApexVal');
    const hud = document.getElementById('pfGravityFeelHud');
    document.getElementById('pfGravityFeelReset').addEventListener('click', () => { body.respawn(); trail.length = 0; canvas.focus(); });

    const trail = [];
    function update(dt) {
        body.cfg.gravJump = +riseEl.value;
        body.cfg.gravFall = +fallEl.value;
        body.cfg.apexThreshold = +apexEl.value;
        body.update(dt, input);
        if (!body.onGround) { trail.push({ x: body.box.cx, y: body.box.cy }); if (trail.length > 60) trail.shift(); }
        else trail.length = 0;
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        for (let i = 0; i < trail.length; i++) {
            const a = ((i + 1) / trail.length) * 0.6;
            ctx.fillStyle = `rgba(79,195,247,${a.toFixed(3)})`;
            ctx.fillRect(trail[i].x - 2, trail[i].y - 2, 4, 4);
        }
        const inApex = !body.onGround && Math.abs(body.vy) < body.cfg.apexThreshold && body.cfg.apexThreshold > 0;
        pfDrawBody(ctx, body, inApex ? PF.item : undefined);
        pfFocusHint(ctx, W, H, input.focused);
        if (riseVal) riseVal.textContent = riseEl.value;
        if (fallVal) fallVal.textContent = fallEl.value;
        if (apexVal) apexVal.textContent = apexEl.value;
        hud.textContent = `${inApex ? 'APEX HANG ✦ ' : ''}vy ${body.vy.toFixed(0)} · jump ↑/Space, hold ↓ to fast-fall · rise/fall gravity asymmetry shapes the arc`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 5 — cornerDemo : CORNER CORRECTION (head-bonk forgiveness)
// Jump up through the narrow gap. If your head clips the corner of a ledge by a
// few pixels, you get nudged sideways to slip through instead of bonking and
// dropping straight back down.
// =============================================================================
(function cornerDemo() {
    const canvas = document.getElementById('pfCornerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    map.fillRect(1, rows - 1, cols - 2, rows - 1, PFTile.SOLID);
    // a ceiling with a 2-tile gap to jump through
    const gapL = 9, gapR = 10;
    for (let x = 1; x < cols - 1; x++) if (x < gapL || x > gapR) map.set(x, rows - 6, PFTile.SOLID);

    const body = new PlayerBody(map, 3 * TS, (rows - 2) * TS, { corner: 8, variable: true, jumpSpeed: 600 });
    const input = pfInstallKeys(canvas);
    const cb = document.getElementById('pfCornerOn');
    const hud = document.getElementById('pfCornerHud');
    document.getElementById('pfCornerReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });

    let flash = 0, lastNudge = 0;
    function update(dt) {
        body.cfg.corner = cb.checked ? 8 : 0;
        body.update(dt, input);
        if (body.cornerNudge !== 0) { flash = 0.3; lastNudge = body.cornerNudge; }
        flash = Math.max(0, flash - dt);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawBody(ctx, body, flash > 0 ? PF.good : undefined);
        pfFocusHint(ctx, W, H, input.focused);
        hud.textContent = cb.checked
            ? `corner correction ON — aim the gap roughly and jump; a clipped corner nudges you through${flash > 0 ? ` (nudged ${lastNudge > 0 ? '→' : '←'} ${Math.abs(lastNudge)}px)` : ''}`
            : `corner correction OFF — clip the ledge by a pixel and you bonk straight back down`;
    }
    pfLoop(update, render).start();
})();

// =============================================================================
// DEMO 6 — feelLabDemo : CAPSTONE "Feel Lab"
// Every assist on a toggle, plus RAW / JUICED presets, a live state-machine
// label, and squash-and-stretch. Flip everything off, run the little course,
// then flip everything on and feel the same level become forgiving.
// =============================================================================
(function feelLabDemo() {
    const canvas = document.getElementById('pfFeelLabCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, TS = 32;
    const cols = Math.floor(W / TS), rows = Math.floor(H / TS);
    const map = new TileMap(cols, rows, TS, PFTile.EMPTY);
    map.fillRect(0, 0, 0, rows - 1, PFTile.SOLID);
    map.fillRect(cols - 1, 0, cols - 1, rows - 1, PFTile.SOLID);
    // a little course: a start ledge, a gap, a step up, a gap under a low ceiling
    map.fillRect(1, rows - 2, 5, rows - 2, PFTile.SOLID);
    map.fillRect(8, rows - 4, 11, rows - 4, PFTile.SOLID);
    map.fillRect(13, rows - 6, 15, rows - 6, PFTile.SOLID);
    map.fillRect(16, rows - 3, cols - 2, rows - 3, PFTile.SOLID);
    for (let x = 16; x < cols - 1; x++) map.set(x, rows - 8, PFTile.SOLID); // low ceiling over the landing
    map.set(cols - 2, rows - 8, PFTile.EMPTY); map.set(cols - 3, rows - 8, PFTile.EMPTY); // a corner gap

    const body = new PlayerBody(map, 2 * TS, (rows - 3) * TS, JUICED_CFG);
    const input = pfInstallKeys(canvas);
    const els = {
        coyote: document.getElementById('pfLabCoyote'),
        buffer: document.getElementById('pfLabBuffer'),
        variable: document.getElementById('pfLabVariable'),
        apex: document.getElementById('pfLabApex'),
        corner: document.getElementById('pfLabCorner'),
    };
    const hud = document.getElementById('pfFeelLabHud');
    function applyToggles() {
        body.cfg.coyoteMs = els.coyote.checked ? JUICED_CFG.coyoteMs : 0;
        body.cfg.bufferMs = els.buffer.checked ? JUICED_CFG.bufferMs : 0;
        body.cfg.variable = els.variable.checked;
        body.cfg.apexThreshold = els.apex.checked ? JUICED_CFG.apexThreshold : 0;
        body.cfg.gravFall = els.apex.checked ? JUICED_CFG.gravFall : JUICED_CFG.gravJump; // apex toggle also governs asymmetry
        body.cfg.corner = els.corner.checked ? JUICED_CFG.corner : 0;
    }
    function setAll(on) { for (const k in els) els[k].checked = on; applyToggles(); canvas.focus(); }
    document.getElementById('pfLabRaw').addEventListener('click', () => setAll(false));
    document.getElementById('pfLabJuiced').addEventListener('click', () => setAll(true));
    document.getElementById('pfFeelLabReset').addEventListener('click', () => { body.respawn(); canvas.focus(); });
    for (const k in els) els[k].addEventListener('change', applyToggles);
    applyToggles();

    function update(dt) {
        body.update(dt, input);
        if (body.box.top > H + 60) body.respawn();
        input.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, PF.bg);
        drawTileMap(ctx, map, {});
        pfDrawBody(ctx, body);
        pfFocusHint(ctx, W, H, input.focused);
        // live state label above the player
        ctx.fillStyle = PF_STATE_COLOR[body.state] || PF.text;
        ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(body.state.toUpperCase(), body.box.cx, body.box.y - 10);
        ctx.textAlign = 'start';
        const on = Object.keys(els).filter((k) => els[k].checked);
        hud.textContent = `state: ${body.state} · assists: ${on.length ? on.join(', ') : 'none (raw)'} · ←/→ run, ↑/Space jump, hold ↓ fast-fall`;
    }
    pfLoop(update, render).start();
})();
