// ===================================================================
// tower-defense/engine/loop.js
//
// The harness every demo in the Tower Defense track leans on:
//
//   • tdLoop          — a FIXED-timestep game loop (the classic accumulator).
//                       A TD is a simulation: creeps integrate along a path,
//                       towers fire on a cooldown, waves spawn on a schedule —
//                       and the Simulations tier *balances* and *replays* runs,
//                       which only works if the sim advances by a constant dt
//                       regardless of the monitor's refresh rate. This is a
//                       near-verbatim sibling of the Bullet Hell `bhLoop`, the
//                       Physics Puzzle `pzLoop` and the Platformer `pfLoop`; the
//                       tracks share the PATTERN, not the file.
//
//   • tdInstallPointer— pointer (mouse + touch) input for ONE <canvas>: the
//                       primary TD verb is "click a tile to place a tower", plus
//                       hover-to-preview a range ring. Same getBoundingClientRect
//                       coordinate-mapping + pointer-capture the Physics Puzzle /
//                       Bullet Hell tracks worked out.
//
//   • tdInstallKeys   — small canvas-scoped keyboard helper for hotkeys (pause,
//                       fast-forward, 1-9 to pick a tower kind). Canvas-focused so
//                       a page stacking many demos doesn't have them all fight
//                       over one keypress (the bullet-hell/roguelike call).
//
// Names (tdLoop / tdInstallPointer / tdInstallKeys / TD_MAX_DT) are pre-checked
// vs shared/utils.js. No ES modules — attach to `window` at the bottom.
// ===================================================================

// Largest sim dt we ever accept in one frame. If a tab is backgrounded the next
// rAF can be seconds later; without this clamp the loop would try to catch up
// with a huge burst of steps (the "spiral of death"). Same value family the
// Bullet Hell / Physics Puzzle / Platformer / netcode tracks use.
const TD_MAX_DT = 0.1; // 100 ms

// --- tdLoop ---------------------------------------------------------
// update(step) — advance the simulation by exactly `step` seconds. Called 0..N
//                times per animation frame so simulated time tracks real time.
// render(alpha)— draw once per frame. `alpha` ∈ [0,1) is the leftover fraction
//                of a step, for optional interpolation between sim states.
// opts.step    — fixed timestep in seconds (default 1/60).
// opts.maxSteps— cap on catch-up steps per frame (default 5; prevents the spiral
//                of death together with TD_MAX_DT).
// opts.speed   — a multiplier on simulated time (the TD "fast-forward" button):
//                a getter or number. 2 → run two sim steps' worth of time per real
//                second extra. Read fresh each frame so a demo can flip it live.
// Returns { start, stop, running }. Demos start()/stop() so an off-screen demo
// can pause and the page stays light.
function tdLoop(update, render, opts = {}) {
    const step = opts.step ?? (1 / 60);
    const maxSteps = opts.maxSteps ?? 5;
    const speedOf = () => (typeof opts.speed === 'function' ? opts.speed() : (opts.speed ?? 1));
    let acc = 0;
    let last = 0;
    let raf = 0;
    const api = { running: false };

    function frame(now) {
        if (!api.running) return;
        if (!last) last = now;
        let dt = (now - last) / 1000;
        last = now;
        if (dt > TD_MAX_DT) dt = TD_MAX_DT; // clamp giant gaps (tab refocus, etc.)

        acc += dt * speedOf(); // fast-forward scales real time into sim time
        let n = 0;
        while (acc >= step && n < maxSteps) {
            update(step);
            acc -= step;
            n++;
        }
        if (n === maxSteps) acc = 0; // we fell behind; drop the backlog, stay live

        render(acc / step);
        raf = requestAnimationFrame(frame);
    }

    api.start = () => {
        if (api.running) return;
        api.running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
    };
    api.stop = () => {
        api.running = false;
        cancelAnimationFrame(raf);
    };
    return api;
}

// --- tdInstallPointer -----------------------------------------------
// Pointer (mouse + touch) input for a <canvas>. The TD primary verb is placing a
// tower on a tile and previewing its range while hovering. Returns an object the
// demo polls each step:
//
//   pointer.pos          — current position in CANVAS pixels {x, y}
//   pointer.isDown       — is the pointer currently pressed?
//   pointer.inside       — is the pointer over the canvas right now?
//   pointer.justPressed  — did it go down THIS frame? (edge — "place here")
//   pointer.justReleased — did a press end THIS frame? (edge)
//   pointer.endFrame()   — clear the edge flags; CALL ONCE at the end of a step
//
// getBoundingClientRect + width/clientWidth ratio is the ONLY correct mapping
// once CSS scales the canvas (which responsive layouts always do). offsetX breaks.
function tdInstallPointer(canvas) {
    const state = {
        pos: { x: 0, y: 0 },
        isDown: false,
        inside: false,
        justPressed: false,
        justReleased: false,
    };

    function localPos(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (canvas.width / r.width),
            y: (e.clientY - r.top) * (canvas.height / r.height),
        };
    }

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        state.pos = localPos(e);
        state.isDown = true;
        state.inside = true;
        state.justPressed = true;
    });
    canvas.addEventListener('pointermove', (e) => {
        state.pos = localPos(e);
        state.inside = true;
    });
    function endPress(e) {
        if (!state.isDown) return;
        if (e && e.preventDefault) e.preventDefault();
        if (e) state.pos = localPos(e);
        state.isDown = false;
        state.justReleased = true;
        if (e) { try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
    }
    canvas.addEventListener('pointerup', endPress);
    canvas.addEventListener('pointercancel', endPress);
    canvas.addEventListener('pointerleave', () => { state.inside = false; });
    canvas.style.touchAction = 'none';

    return {
        state,
        get pos() { return state.pos; },
        get isDown() { return state.isDown; },
        get inside() { return state.inside; },
        get justPressed() { return state.justPressed; },
        get justReleased() { return state.justReleased; },
        endFrame: () => { state.justPressed = false; state.justReleased = false; },
    };
}

// --- tdInstallKeys --------------------------------------------------
// Small canvas-scoped keyboard helper for TD hotkeys. A TD doesn't drive a player
// with the arrow keys, so this is intentionally lighter than the bullet-hell input:
// it exposes edge-triggered "pressed this frame" flags plus a current digit (1-9)
// for picking a tower kind. Canvas-focused (click a demo to drive it) so stacked
// demos on one page don't all react to one keypress, and so digit/space keys don't
// scroll the page while you're playing.
//
//   keys.focused        — does this canvas currently have keyboard focus?
//   keys.pressed(code)  — was `event.code` pressed (rising edge) THIS frame?
//   keys.digit          — last 1-9 pressed this frame, or 0 (for tower selection)
//   keys.endFrame()     — clear the edge flags; CALL ONCE at the end of a step
function tdInstallKeys(canvas, opts = {}) {
    // Codes whose default action (scroll / focus jump) we suppress while focused.
    const swallow = new Set(opts.swallow || ['Space']);
    const state = { focused: false, pressed: new Set(), digit: 0 };

    canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    canvas.addEventListener('focus', () => { state.focused = true; });
    canvas.addEventListener('blur', () => { state.focused = false; state.pressed.clear(); });

    canvas.addEventListener('keydown', (e) => {
        if (swallow.has(e.code)) e.preventDefault();
        if (e.repeat) return; // edge only — ignore auto-repeat
        state.pressed.add(e.code);
        if (e.code.startsWith('Digit')) {
            const d = +e.code.slice(5);
            if (d >= 1 && d <= 9) state.digit = d;
        }
    });

    return {
        get focused() { return state.focused; },
        pressed(code) { return state.pressed.has(code); },
        get digit() { return state.digit; },
        endFrame() { state.pressed.clear(); state.digit = 0; },
    };
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.TD_MAX_DT = TD_MAX_DT;
    window.tdLoop = tdLoop;
    window.tdInstallPointer = tdInstallPointer;
    window.tdInstallKeys = tdInstallKeys;
}
