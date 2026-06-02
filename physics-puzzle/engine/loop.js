// ===================================================================
// physics-puzzle/engine/loop.js
//
// The two harness helpers every demo in the Physics Puzzle track leans on:
//
//   • pzLoop          — a fixed-timestep game loop. Physics steps run at a
//                       FIXED dt (so a launched ball follows the same arc on a
//                       30 Hz laptop and a 240 Hz monitor — the determinism the
//                       trajectory-prediction demo depends on), while rendering
//                       runs once per animation frame. The classic accumulator.
//                       This is a near-verbatim sibling of the Platformer's
//                       `pfLoop`; the two tracks share the pattern, not the file.
//
//   • pzInstallPointer— pointer (mouse + touch) input for a <canvas>, with the
//                       three fixes every canvas pointer demo needs: correct
//                       canvas-local coordinates even when CSS scales the canvas
//                       (getBoundingClientRect, NOT offsetX), pointer CAPTURE so
//                       a slingshot drag that leaves the canvas still releases,
//                       and touch-action:none so a drag doesn't scroll the page.
//                       A platformer needs held KEYS; a physics puzzle needs a
//                       DRAG (where did the pull start, where is it now, where
//                       was it released) — so that's what this exposes.
//
// Names (pzLoop / pzInstallPointer / PZ_MAX_DT) are pre-checked vs
// shared/utils.js. No ES modules — attach to `window` at the bottom.
// ===================================================================

// Largest physics dt we ever accept in one frame. If a tab is backgrounded the
// next rAF can be seconds later; without this clamp the loop would try to catch
// up with a huge burst of steps (the "spiral of death"). Same value family the
// Platformer / racing-sim / netcode tracks use.
const PZ_MAX_DT = 0.1; // 100 ms

// --- pzLoop ---------------------------------------------------------
// update(step) — advance the simulation by exactly `step` seconds. Called 0..N
//                times per animation frame so simulated time tracks real time.
// render(alpha)— draw once per frame. `alpha` ∈ [0,1) is the leftover fraction
//                of a step, for optional interpolation between physics states.
// opts.step    — fixed timestep in seconds (default 1/60).
// opts.maxSteps— cap on catch-up steps per frame (default 5; prevents the
//                spiral of death together with PZ_MAX_DT).
// Returns { start, stop, running }. Demos start()/stop() so an off-screen demo
// can pause and the page stays light.
function pzLoop(update, render, opts = {}) {
    const step = opts.step ?? (1 / 60);
    const maxSteps = opts.maxSteps ?? 5;
    let acc = 0;
    let last = 0;
    let raf = 0;
    const api = { running: false };

    function frame(now) {
        if (!api.running) return;
        if (!last) last = now;
        let dt = (now - last) / 1000;
        last = now;
        if (dt > PZ_MAX_DT) dt = PZ_MAX_DT; // clamp giant gaps (tab refocus, etc.)

        acc += dt;
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

// --- pzInstallPointer -----------------------------------------------
// Wire pointer input onto a <canvas>. Returns an object the demo polls each
// frame:
//
//   pointer.pos            — current pointer position in CANVAS pixels {x, y}
//   pointer.start          — where the current drag began, or null if not down
//   pointer.isDown         — is the pointer currently pressed?
//   pointer.justReleased   — did a drag end THIS frame? (edge)
//   pointer.releaseStart   — drag-start of the just-ended drag (read on release)
//   pointer.releaseEnd     — drag-end   of the just-ended drag (read on release)
//   pointer.inside         — is the pointer over the canvas right now?
//   pointer.endFrame()     — clear the edge flags; CALL ONCE at the end of a step
//
// The `justReleased` edge mirrors the Platformer input's pressed/released sets:
// a fixed-step loop may run update 0..N times per frame, so a one-shot event
// must stay true for the whole frame and be cleared exactly once, at endFrame().
function pzInstallPointer(canvas) {
    const state = {
        pos: { x: 0, y: 0 },
        start: null,
        isDown: false,
        inside: false,
        justPressed: false,
        justReleased: false,
        releaseStart: null,
        releaseEnd: null,
    };

    // Map a pointer event to canvas-internal pixels. getBoundingClientRect +
    // the width/clientWidth ratio is the ONLY correct way: `offsetX` breaks the
    // moment CSS scales the canvas (which responsive layouts always do).
    function localPos(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (canvas.width / r.width),
            y: (e.clientY - r.top) * (canvas.height / r.height),
        };
    }

    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        // Capture so move/up keep firing even if the pointer leaves the canvas
        // mid-drag (pull the slingshot way off to the side and let go — it still
        // launches). Wrapped because synthetic events in tests lack pointerId.
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        state.pos = localPos(e);
        state.start = { x: state.pos.x, y: state.pos.y };
        state.isDown = true;
        state.inside = true;
        state.justPressed = true;
    });

    canvas.addEventListener('pointermove', (e) => {
        state.pos = localPos(e);
        state.inside = true;
    });

    function endDrag(e) {
        if (!state.isDown) return;
        if (e && e.preventDefault) e.preventDefault();
        if (e) state.pos = localPos(e);
        state.releaseStart = state.start;
        state.releaseEnd = { x: state.pos.x, y: state.pos.y };
        state.isDown = false;
        state.start = null;
        state.justReleased = true;
        if (e) { try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => { state.inside = false; });

    // Stop the page from scrolling/zooming when a touch drag starts on the canvas.
    canvas.style.touchAction = 'none';

    return {
        state,
        get pos() { return state.pos; },
        get start() { return state.start; },
        get isDown() { return state.isDown; },
        get inside() { return state.inside; },
        get justPressed() { return state.justPressed; },
        get justReleased() { return state.justReleased; },
        get releaseStart() { return state.releaseStart; },
        get releaseEnd() { return state.releaseEnd; },
        endFrame: () => { state.justPressed = false; state.justReleased = false; },
    };
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.PZ_MAX_DT = PZ_MAX_DT;
    window.pzLoop = pzLoop;
    window.pzInstallPointer = pzInstallPointer;
}
