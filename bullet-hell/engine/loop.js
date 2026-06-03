// ===================================================================
// bullet-hell/engine/loop.js
//
// The harness every demo in the Bullet Hell (Danmaku) track leans on:
//
//   • bhLoop          — a FIXED-timestep game loop (the classic accumulator).
//                       Bullet patterns are polar equations animated over time,
//                       and a replay must reproduce a run exactly — both need the
//                       simulation to advance by a constant dt regardless of the
//                       monitor's refresh rate. This is a near-verbatim sibling of
//                       the Physics Puzzle's `pzLoop` and the Platformer's
//                       `pfLoop`; the tracks share the PATTERN, not the file.
//
//   • bhInstallKeys   — keyboard input for a danmaku player, scoped to ONE
//                       <canvas>. A bullet-hell tier page stacks many keyboard
//                       demos on one scroll, so input is CANVAS-focused (click a
//                       demo to drive it) rather than window-global — otherwise
//                       the arrow keys would move every ship at once AND scroll
//                       the page. Exposes held state (move / focus / shoot / bomb)
//                       plus edge flags for one-shot actions.
//
//   • bhInstallPointer— pointer (mouse + touch) input for a <canvas>, used by the
//                       Simulations pattern-editor demos. Same getBoundingClientRect
//                       coordinate-mapping + pointer-capture fixes the Physics
//                       Puzzle track worked out.
//
// Names (bhLoop / bhInstallKeys / bhInstallPointer / BH_MAX_DT) are pre-checked
// vs shared/utils.js. No ES modules — attach to `window` at the bottom.
// ===================================================================

// Largest sim dt we ever accept in one frame. If a tab is backgrounded the next
// rAF can be seconds later; without this clamp the loop would try to catch up
// with a huge burst of steps (the "spiral of death"). Same value family the
// Physics Puzzle / Platformer / netcode tracks use.
const BH_MAX_DT = 0.1; // 100 ms

// --- bhLoop ---------------------------------------------------------
// update(step) — advance the simulation by exactly `step` seconds. Called 0..N
//                times per animation frame so simulated time tracks real time.
// render(alpha)— draw once per frame. `alpha` ∈ [0,1) is the leftover fraction
//                of a step, for optional interpolation between sim states.
// opts.step    — fixed timestep in seconds (default 1/60).
// opts.maxSteps— cap on catch-up steps per frame (default 5; prevents the spiral
//                of death together with BH_MAX_DT).
// Returns { start, stop, running }. Demos start()/stop() so an off-screen demo
// can pause and the page stays light.
function bhLoop(update, render, opts = {}) {
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
        if (dt > BH_MAX_DT) dt = BH_MAX_DT; // clamp giant gaps (tab refocus, etc.)

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

// --- bhInstallKeys --------------------------------------------------
// Wire keyboard input onto a focusable <canvas>. Returns an object the demo
// polls each step:
//
//   keys.focused        — does this canvas currently have keyboard focus?
//   keys.left/right/up/down — held movement (Arrows OR WASD)
//   keys.focus          — is the "focus / slow" modifier held? (Shift)
//   keys.shoot / keys.bomb  — held fire / bomb (Z / X)
//   keys.shootPressed   — did shoot go down THIS frame? (edge)
//   keys.bombPressed    — did bomb go down THIS frame?  (edge)
//   keys.axis()         — { x, y } movement in -1..1 (right−left, down−up)
//   keys.moveDir()      — a NORMALISED Vector2D of the movement (diagonals are
//                         NOT faster — the genre cares about this), or a zero
//                         vector when no direction is held
//   keys.endFrame()     — clear the edge flags; CALL ONCE at the end of a step
//
// Why canvas-scoped: see the file header. The canvas is made focusable
// (tabIndex 0); we preventDefault the arrow/space keys ONLY while focused so the
// page still scrolls normally when you're not playing a demo, and we clear all
// held keys on blur so a key can't get "stuck" when focus leaves mid-press.
function bhInstallKeys(canvas) {
    const held = Object.create(null); // code -> true while physically down
    const state = {
        focused: false,
        shootPressed: false,
        bombPressed: false,
    };

    // Codes we own. event.code is layout-independent (KeyW is the physical W key
    // regardless of QWERTY/AZERTY), which is what a game wants.
    const MOVE_CODES = new Set([
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'KeyA', 'KeyD', 'KeyW', 'KeyS',
    ]);
    // Keys whose default browser action (scroll / focus-ring jump) we must
    // suppress while the demo is being played.
    const SWALLOW = new Set([...MOVE_CODES, 'Space', 'ShiftLeft', 'ShiftRight']);

    canvas.tabIndex = 0; // make the canvas focusable so it can receive key events
    canvas.style.outline = 'none';

    canvas.addEventListener('focus', () => { state.focused = true; });
    canvas.addEventListener('blur', () => {
        // Drop every held key so nothing stays pressed once focus leaves.
        for (const k in held) delete held[k];
        state.focused = false;
    });

    canvas.addEventListener('keydown', (e) => {
        if (SWALLOW.has(e.code)) e.preventDefault();
        if (!held[e.code]) {
            // rising edge — record one-shot actions
            if (e.code === 'KeyZ') state.shootPressed = true;
            if (e.code === 'KeyX') state.bombPressed = true;
        }
        held[e.code] = true;
    });
    canvas.addEventListener('keyup', (e) => {
        if (SWALLOW.has(e.code)) e.preventDefault();
        held[e.code] = false;
    });

    const isDown = (code) => !!held[code];

    return {
        get focused() { return state.focused; },
        get left()  { return isDown('ArrowLeft')  || isDown('KeyA'); },
        get right() { return isDown('ArrowRight') || isDown('KeyD'); },
        get up()    { return isDown('ArrowUp')    || isDown('KeyW'); },
        get down()  { return isDown('ArrowDown')  || isDown('KeyS'); },
        get focus() { return isDown('ShiftLeft')  || isDown('ShiftRight'); },
        get shoot() { return isDown('KeyZ'); },
        get bomb()  { return isDown('KeyX'); },
        get shootPressed() { return state.shootPressed; },
        get bombPressed()  { return state.bombPressed; },
        axis() {
            return {
                x: (this.right ? 1 : 0) - (this.left ? 1 : 0),
                y: (this.down ? 1 : 0) - (this.up ? 1 : 0),
            };
        },
        // Normalised movement vector (length 1 on diagonals too, so moving NE is
        // not √2 faster than moving N). Returns a zero vector when idle.
        moveDir() {
            const a = this.axis();
            const v = new Vector2D(a.x, a.y);
            return v.lengthSquared() > 0 ? v.normalize() : v;
        },
        endFrame() { state.shootPressed = false; state.bombPressed = false; },
    };
}

// --- bhInstallPointer -----------------------------------------------
// Pointer (mouse + touch) input for a <canvas> — used by the Simulations
// pattern-editor demos (drag a slider handle, point an emitter). Returns an
// object the demo polls; same shape as the Physics Puzzle pointer helper.
//
//   pointer.pos          — current position in CANVAS pixels {x, y}
//   pointer.isDown       — is the pointer currently pressed?
//   pointer.justPressed  — did it go down THIS frame? (edge)
//   pointer.justReleased — did a drag end THIS frame? (edge)
//   pointer.inside       — is the pointer over the canvas right now?
//   pointer.endFrame()   — clear the edge flags; CALL ONCE at the end of a step
function bhInstallPointer(canvas) {
    const state = {
        pos: { x: 0, y: 0 },
        isDown: false,
        inside: false,
        justPressed: false,
        justReleased: false,
    };

    // getBoundingClientRect + width/clientWidth ratio is the ONLY correct mapping
    // once CSS scales the canvas (which responsive layouts always do). offsetX breaks.
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
    function endDrag(e) {
        if (!state.isDown) return;
        if (e && e.preventDefault) e.preventDefault();
        if (e) state.pos = localPos(e);
        state.isDown = false;
        state.justReleased = true;
        if (e) { try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
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

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.BH_MAX_DT = BH_MAX_DT;
    window.bhLoop = bhLoop;
    window.bhInstallKeys = bhInstallKeys;
    window.bhInstallPointer = bhInstallPointer;
}
