// ===================================================================
// platformer/engine/input.js
//
// Two tiny helpers every interactive demo in the track leans on:
//
//   • pfInstallKeys — held-key keyboard input for a <canvas>, with the two
//                     fixes every canvas keyboard demo needs: click-to-focus
//                     (a canvas only gets key events when focused) and
//                     preventDefault on the movement keys (or the page scrolls).
//                     Unlike the roguelike's one-key-per-turn input, a platformer
//                     needs to know what is HELD *right now* (is "right" down?)
//                     and also catch the *edges* (was "jump" pressed THIS frame?),
//                     so it tracks both.
//
//   • pfLoop        — a fixed-timestep game loop. Physics runs in fixed steps
//                     (so the same inputs produce the same motion at any frame
//                     rate — the determinism the Beginner tier explains and the
//                     Simulations tier proves), while rendering runs once per
//                     animation frame. The classic accumulator pattern.
//
// Names (pfInstallKeys / pfLoop / PF_MAX_DT) are pre-checked vs shared/utils.js.
// No ES modules — attach to `window` at the bottom.
// ===================================================================

// Largest physics dt we ever accept in one frame. If a tab is backgrounded the
// next rAF can be seconds later; without this clamp the loop would try to catch
// up with a huge burst of steps (the "spiral of death"). Same value family the
// racing-sim / netcode tracks use.
const PF_MAX_DT = 0.1; // 100 ms

// Which physical keys map to which semantic action. Several keys per action so
// arrows, WASD, and the common jump/dash keys all work. Everything here is
// preventDefault-ed on keydown/keyup so the page never scrolls under the demo.
const PF_KEYMAP = Object.freeze({
    ArrowLeft: 'left',  a: 'left',  A: 'left',
    ArrowRight:'right', d: 'right', D: 'right',
    ArrowUp:   'up',    w: 'up',    W: 'up',
    ArrowDown: 'down',  s: 'down',  S: 'down',
    ' ': 'jump', z: 'jump', Z: 'jump', j: 'jump', J: 'jump',
    x: 'dash', X: 'dash', k: 'dash', K: 'dash', l: 'dash', L: 'dash',
});

// --- pfInstallKeys --------------------------------------------------
// Wire keyboard input onto a focusable <canvas tabindex="0">. Returns an input
// object the demo polls each frame:
//
//   input.isDown(action)    — is this action held right now?  (e.g. 'left')
//   input.pressed(action)   — did it go down THIS frame? (edge; for jump/dash)
//   input.released(action)  — did it come up THIS frame? (edge; for variable jump)
//   input.axisX()           — convenience: (+1 right) + (-1 left) -> -1 / 0 / +1
//   input.focused           — is the canvas focused? (for a "click to focus" hint)
//   input.endFrame()        — clear the edge sets; CALL ONCE at the end of a frame
//
// The edge sets (pressed/released) are the key detail: a fixed-step loop may run
// the update zero or several times per animation frame, so "pressed" must stay
// true for the whole frame and be cleared exactly once, at the end — that's what
// endFrame() is for.
function pfInstallKeys(canvas) {
    const held = new Set();      // actions currently down
    const pressed = new Set();   // actions that went down since last endFrame()
    const released = new Set();  // actions that came up since last endFrame()
    const state = { focused: false };

    canvas.addEventListener('click', () => canvas.focus());
    canvas.addEventListener('focus', () => { state.focused = true; });
    canvas.addEventListener('blur', () => {
        state.focused = false;
        held.clear(); // dropping focus releases everything (no "stuck key" bug)
    });

    canvas.addEventListener('keydown', (e) => {
        const a = PF_KEYMAP[e.key];
        if (!a) return;
        e.preventDefault();
        if (!held.has(a)) pressed.add(a); // edge only on the transition to down
        held.add(a);
    });
    canvas.addEventListener('keyup', (e) => {
        const a = PF_KEYMAP[e.key];
        if (!a) return;
        e.preventDefault();
        held.delete(a);
        released.add(a);
    });

    return {
        state,
        get focused() { return state.focused; },
        isDown:   (a) => held.has(a),
        pressed:  (a) => pressed.has(a),
        released: (a) => released.has(a),
        axisX:    () => (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
        endFrame: () => { pressed.clear(); released.clear(); },
    };
}

// --- pfLoop ---------------------------------------------------------
// A fixed-timestep loop. Pass:
//   update(step) — advance the simulation by exactly `step` seconds. Called 0..N
//                  times per animation frame so total simulated time tracks real
//                  time regardless of frame rate.
//   render(alpha)— draw once per frame. `alpha` ∈ [0,1) is the leftover fraction
//                  of a step, for optional interpolation between physics states.
//   opts.step    — fixed timestep in seconds (default 1/60).
//   opts.maxSteps— cap on catch-up steps per frame (default 5; prevents the
//                  spiral of death together with PF_MAX_DT).
//
// Returns { start, stop, running }. Demos call start() and stop() so an
// off-screen demo can be paused (and the page stays light).
function pfLoop(update, render, opts = {}) {
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
        if (dt > PF_MAX_DT) dt = PF_MAX_DT; // clamp giant gaps (tab refocus, etc.)

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

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.PF_MAX_DT = PF_MAX_DT;
    window.PF_KEYMAP = PF_KEYMAP;
    window.pfInstallKeys = pfInstallKeys;
    window.pfLoop = pfLoop;
}
