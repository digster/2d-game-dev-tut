// =============================================================================
// RACING-SIM — BEGINNER TIER DEMOS
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak into the global
// scope. Each demo runs only if its target canvas exists in the DOM — that way
// this file is safe to include from any page in the track even if a canvas is
// missing.
//
// UNITS used throughout the file (these are *the* convention for the whole
// racing-sim track; later tiers inherit them):
//   position         pixels
//   velocity         px/s     (per second, NOT per frame)
//   heading          radians  (0 = facing +X = "right" on screen)
//   angular velocity rad/s
//   acceleration     px/s²
//
// Beginner tier is intentionally mass-less: acceleration = throttle * MAX_ACCEL
// directly. The Intermediate tier introduces friction; the Expert tier
// introduces mass + tire forces. Keeping the *units* stable across tiers means
// adding mass later is just "divide accelerations by mass", not a rewrite.
//
// CANVASES are fixed-size — no DPR scaling — matching every other track in the
// project. If you need a sharper render, increase the canvas dimensions in the
// HTML, not via a per-track DPR layer.
//
// FRAME-INDEPENDENCE: every demo's per-frame loop clamps dt to MAX_DT (=0.05s)
// so a tab refocus or hot GPU never teleports the car. This is the *only*
// safety rail we add in the Beginner tier.
// =============================================================================

(function setupScrollToTop() {
    // Reused on every page in the project — same behavior as beginner-demos.js
    // in the project root, just kept local so this file stands alone.
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
// Shared palette so all racing-sim demos read as one visual family.
// Top-level `const` (and `class` below) don't attach to window — they live in
// this script's module scope. Verified absent from shared/utils.js and from
// every other *-demos.js in the project, so no collision risk.
// ---------------------------------------------------------------------------
const RACING_COLORS = {
    asphalt:      '#1f242c',   // background fill — dark, matches project theme
    asphaltLight: '#262b35',   // alt-stripe parking-lot color
    paint:        '#fbc02d',   // yellow parking lines
    grid:         '#2e3548',   // reference grid lines
    gridStrong:   '#4fc3f7',   // accent grid lines (every 5th)
    carBody:      '#ef5350',   // primary car (sandbox)
    carBodyAlt:   '#26c6da',   // second car (dt comparison)
    carWindow:    '#263238',   // windshield
    arrow:        '#ffa726',   // forward / velocity arrow
    arrowSoft:    '#ffd180',   // arrow halo
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    skidMark:     'rgba(8, 8, 8, 0.75)'   // dark, high alpha — clearly visible on the dark asphalt
};

// ---------------------------------------------------------------------------
// Car — the core state container. Three pieces of state, one getter, no
// physics. The integration loop lives in each demo so each demo can tweak
// behaviour (e.g. the dt-compare demo uses TWO subtly different integrators).
// `class Car` is safe at top level — verified absent from shared/utils.js and
// from every existing *-demos.js (grep for `class Car` was empty).
// ---------------------------------------------------------------------------
class Car {
    constructor(x = 0, y = 0, heading = 0) {
        this.position = new Vector2D(x, y);   // px
        this.velocity = new Vector2D(0, 0);   // px/s
        this.heading  = heading;              // rad (0 = facing +X)
    }
    get speed() {                             // |velocity|, in px/s
        return this.velocity.length();
    }
    reset(x, y, heading = 0) {
        this.position.x = x;
        this.position.y = y;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.heading    = heading;
    }
}

// ---------------------------------------------------------------------------
// Tunables shared by the kinematic-drive and parking-lot demos. Picked to
// look right inside an 800x500-ish canvas.
// ---------------------------------------------------------------------------
const MAX_SPEED      = 280;   // px/s — clamps to keep car on-canvas
const MAX_ACCEL      = 220;   // px/s² — throttle authority
const MAX_STEER_RATE = 2.4;   // rad/s at full lock and full speed
const MAX_DT         = 0.05;  // s — clamp dt so tab refocus can't teleport us

// One central integrator. Beginner-tier physics: no friction, no slip; the
// velocity vector aligns with heading whenever throttle is non-zero. This is
// the cleanest possible starting point — later tiers add friction + lateral
// slip without touching the integrator's shape, only its body.
function integrate(car, throttle, steer, dt) {
    // 1. Steering modifies heading, but only when the car is actually moving.
    //    A linear ramp from 0 to full response between 0 and ~30 px/s avoids
    //    "pivot in place" arcade weirdness without making the demo feel stuck.
    const steerScale = clamp(car.speed / 30, 0, 1);
    car.heading += steer * MAX_STEER_RATE * steerScale * dt;

    // 2. Throttle adds acceleration along the car's heading direction.
    //    Brake-wins rule: when throttle and brake are both held, throttle
    //    arrives here as 0 (the input layer resolves it). See keyInputs().
    const ax = Math.cos(car.heading) * throttle * MAX_ACCEL;
    const ay = Math.sin(car.heading) * throttle * MAX_ACCEL;
    car.velocity.x += ax * dt;
    car.velocity.y += ay * dt;

    // 3. Integrate position from velocity.
    car.position.x += car.velocity.x * dt;
    car.position.y += car.velocity.y * dt;

    // 4. Clamp to MAX_SPEED so the demo can't escape the canvas at warp speed.
    const sp = car.velocity.length();
    if (sp > MAX_SPEED) car.velocity.multiply(MAX_SPEED / sp);
}

// ---------------------------------------------------------------------------
// Helpers shared by multiple demos.
// ---------------------------------------------------------------------------

// Draws a top-down car body at the given car's pos+heading. Width = long axis,
// height = short axis. Forward is +X in local space, so the windshield is
// painted near +X to give the player a visible "this is the front" cue.
function drawCarSprite(ctx, car, opts = {}) {
    const w = opts.w || 28;
    const h = opts.h || 14;
    const body = opts.body || RACING_COLORS.carBody;
    const window = opts.window || RACING_COLORS.carWindow;

    ctx.save();
    ctx.translate(car.position.x, car.position.y);
    ctx.rotate(car.heading);

    // Body — roundRect available in modern browsers. Fallback to plain rect
    // if roundRect isn't supported (older Safari) so the demo still renders.
    ctx.fillStyle = body;
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 3);
        ctx.fill();
    } else {
        ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    // Windshield — darker rectangle near +X so forward is unambiguous.
    ctx.fillStyle = window;
    ctx.fillRect(w / 6, -h / 2 + 2, w / 4, h - 4);
    ctx.restore();
}

// Returns the world position of the rear-left and rear-right wheels of a
// 28x14 car at the given pos+heading. Used by the parking-lot skid layer.
function rearWheelWorldPositions(car, w = 28, h = 14) {
    const cos = Math.cos(car.heading);
    const sin = Math.sin(car.heading);
    const points = [];
    for (const side of [-1, +1]) {
        const lx = -w / 2;            // rear axle in local x
        const ly = side * (h / 2);    // left or right wheel
        points.push({
            x: car.position.x + lx * cos - ly * sin,
            y: car.position.y + lx * sin + ly * cos
        });
    }
    return points;
}

// Heading wrapped to [0, 360) for *display* only. The simulation never
// normalizes heading because cos/sin don't care.
function headingDeg(rad) {
    return ((rad * 180 / Math.PI) % 360 + 360) % 360;
}

// Keyboard input state attached to a canvas. Returns a function that, when
// called, returns { throttle, steer } in [-1, +1] with brake-wins logic.
// The canvas must have tabindex set in HTML so it can take focus.
function attachKeyInputs(canvas) {
    const state = { up: false, down: false, left: false, right: false };
    const onKey = (e, pressed) => {
        // Only react when the canvas (or the page during prototyping) has focus.
        if (document.activeElement !== canvas && pressed) {
            // Allow keys to flow through even without focus — easier UX for
            // the embedded preview where clicking the canvas takes a tap.
        }
        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp':    state.up    = pressed; break;
            case 's': case 'S': case 'ArrowDown':  state.down  = pressed; break;
            case 'a': case 'A': case 'ArrowLeft':  state.left  = pressed; break;
            case 'd': case 'D': case 'ArrowRight': state.right = pressed; break;
            default: return;
        }
        // Prevent arrow keys from scrolling the page while we drive.
        if (document.activeElement === canvas) e.preventDefault();
    };
    // Listen on window so the demo still works if focus drifts off the canvas
    // (e.g. immediately after click — focus arrives one tick later). The
    // preventDefault guard above keeps page scroll behaviour intact.
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup',   (e) => onKey(e, false));
    // Make the canvas focusable on click so the keys feel "owned" by it.
    canvas.addEventListener('mousedown', () => canvas.focus());

    return () => {
        // Throttle: forward presses give +1, back presses give -1. Brake-wins
        // when both are held — net throttle is 0 (the car decelerates only
        // through its speed clamp; without friction it just keeps coasting).
        let throttle = 0;
        if (state.up   && !state.down) throttle = +1;
        if (state.down && !state.up)   throttle = -1;
        let steer = 0;
        if (state.left  && !state.right) steer = -1;
        if (state.right && !state.left) steer = +1;
        return { throttle, steer };
    };
}

// Per-frame loop helper. Wraps requestAnimationFrame with a clamped dt and a
// running-flag so callers can stop a demo cleanly if they ever need to.
function startFrameLoop(stepFn) {
    let last = performance.now();
    let running = true;
    function frame(now) {
        if (!running) return;
        const rawDt = (now - last) / 1000;
        const dt = Math.min(rawDt, MAX_DT);
        last = now;
        stepFn(dt);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return { stop: () => { running = false; } };
}

// =============================================================================
// DEMO 1 — Car state diagram (position + heading + velocity from sliders)
// Proves: the four numbers (pos.x, pos.y, heading, speed) FULLY determine
// the car's drawn appearance. No animation — pure slider-driven render.
// =============================================================================
(function carStateDemo() {
    const canvas = document.getElementById('carStateCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('carStateCanvasInfo');

    const sliderX     = document.getElementById('carStatePosX');
    const sliderY     = document.getElementById('carStatePosY');
    const sliderHead  = document.getElementById('carStateHeading');
    const sliderSpeed = document.getElementById('carStateSpeed');

    function drawReferenceGrid() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    function render() {
        drawReferenceGrid();

        const px = parseFloat(sliderX.value);
        const py = parseFloat(sliderY.value);
        const headingDegVal = parseFloat(sliderHead.value);
        const speed = parseFloat(sliderSpeed.value);
        const headingRad = headingDegVal * Math.PI / 180;

        // Build a stand-in car. We don't animate — this demo is purely about
        // showing that state -> picture is a deterministic function.
        const car = new Car(px, py, headingRad);
        car.velocity.x = Math.cos(headingRad) * speed;
        car.velocity.y = Math.sin(headingRad) * speed;

        // Velocity arrow — length scales with speed. Cap visual length so
        // the arrow doesn't run off-canvas at MAX speed slider.
        const visLen = Math.min(speed * 0.5, 180);
        const headX = car.position.x + Math.cos(headingRad) * visLen;
        const headY = car.position.y + Math.sin(headingRad) * visLen;
        ctx.strokeStyle = RACING_COLORS.arrow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(car.position.x, car.position.y);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        // Arrowhead
        const ah = 10;
        ctx.fillStyle = RACING_COLORS.arrow;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - ah * Math.cos(headingRad - 0.4), headY - ah * Math.sin(headingRad - 0.4));
        ctx.lineTo(headX - ah * Math.cos(headingRad + 0.4), headY - ah * Math.sin(headingRad + 0.4));
        ctx.closePath();
        ctx.fill();

        // The car body itself.
        drawCarSprite(ctx, car);

        // Labels
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`pos = (${px.toFixed(0)}, ${py.toFixed(0)}) px`, 14, 22);
        ctx.fillText(`heading = ${headingDegVal.toFixed(0)}°  (${headingRad.toFixed(2)} rad)`, 14, 42);
        ctx.fillText(`speed = ${speed.toFixed(0)} px/s`, 14, 62);

        info.innerHTML =
            `Position <strong>(${px.toFixed(0)}, ${py.toFixed(0)})</strong>, ` +
            `heading <strong>${headingDegVal.toFixed(0)}°</strong>, ` +
            `speed <strong>${speed.toFixed(0)} px/s</strong> — that's the entire state of the car.`;
    }

    [sliderX, sliderY, sliderHead, sliderSpeed].forEach(s => {
        s.addEventListener('input', render);
    });
    render();
})();

// =============================================================================
// DEMO 2 — Kinematic drive. The headline interactive — WASD/arrows drive a
// car around a scrolling reference grid. No friction, no walls, no clamps
// other than MAX_SPEED. Proves the integration loop is enough to feel like
// a car already.
// =============================================================================
(function kinematicDriveDemo() {
    const canvas = document.getElementById('kinematicCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('kinematicCanvasInfo');

    const car = new Car(canvas.width / 2, canvas.height / 2, 0);
    const readInput = attachKeyInputs(canvas);

    // Camera follows the car so the grid scrolls beneath. The car always
    // renders at canvas center; only the grid moves. Cheap and effective.
    function drawScrollingGrid() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const spacing = 40;
        // Offset the grid by the *negative* of the car's world position
        // modulo the grid spacing — gives an infinite-scrolling tile feel.
        const offX = (-car.position.x) % spacing;
        const offY = (-car.position.y) % spacing;

        for (let x = offX; x <= canvas.width; x += spacing) {
            // Every 5th line gets the accent color — a visual ruler.
            const worldX = Math.round((x - offX) / spacing) - Math.round(car.position.x / spacing);
            const accent = (worldX % 5) === 0;
            ctx.strokeStyle = accent ? RACING_COLORS.gridStrong : RACING_COLORS.grid;
            ctx.lineWidth = accent ? 1.2 : 0.8;
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = offY; y <= canvas.height; y += spacing) {
            const worldY = Math.round((y - offY) / spacing) - Math.round(car.position.y / spacing);
            const accent = (worldY % 5) === 0;
            ctx.strokeStyle = accent ? RACING_COLORS.gridStrong : RACING_COLORS.grid;
            ctx.lineWidth = accent ? 1.2 : 0.8;
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    // We render the car at a *fixed* screen position (canvas center) and let
    // the world scroll around it. That means the integrator updates a virtual
    // world-position, but drawCarSprite needs a render-position. We don't
    // mutate car.position — we just draw with a temporary center.
    function drawCenteredCar() {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(car.heading);
        ctx.fillStyle = RACING_COLORS.carBody;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(-14, -7, 28, 14, 3);
            ctx.fill();
        } else {
            ctx.fillRect(-14, -7, 28, 14);
        }
        ctx.fillStyle = RACING_COLORS.carWindow;
        ctx.fillRect(4, -5, 7, 10);
        ctx.restore();
    }

    function render() {
        drawScrollingGrid();
        drawCenteredCar();

        // HUD
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`speed: ${car.speed.toFixed(0)} px/s`, 14, 22);
        ctx.fillText(`heading: ${headingDeg(car.heading).toFixed(0)}°`, 14, 42);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('WASD / arrows to drive. No friction — release throttle and you coast.', 14, canvas.height - 14);
    }

    startFrameLoop((dt) => {
        const { throttle, steer } = readInput();
        integrate(car, throttle, steer, dt);
        render();
        info.innerHTML =
            `speed <strong>${car.speed.toFixed(0)} px/s</strong> &nbsp;|&nbsp; ` +
            `heading <strong>${headingDeg(car.heading).toFixed(0)}°</strong>`;
    });

    document.getElementById('btnKinematicReset')?.addEventListener('click', () => {
        car.reset(canvas.width / 2, canvas.height / 2, 0);
    });

    render();
})();

// =============================================================================
// DEMO 3 — Delta-time comparison. Two cars share input. The BLUE car uses a
// per-frame integrator (no *dt anywhere); the RED car uses a dt-correct
// integrator. Throttle the rAF rate to 30 or 60 fps and watch them diverge
// — the dt car covers the same on-screen distance regardless of fps.
// =============================================================================
(function dtCompareDemo() {
    const canvas = document.getElementById('dtCompareCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('dtCompareCanvasInfo');

    // Each car gets its own lane so they don't visually overlap.
    const laneY = canvas.height / 2;
    const carCorrect = new Car(80, laneY - 60, 0);  // RED, dt-correct
    const carBroken  = new Car(80, laneY + 60, 0);  // BLUE, per-frame

    // Both cars share input — they drive a hardcoded "throttle 1, gentle
    // sinusoidal steering" so the demo is hands-free.
    let elapsed = 0;

    // Frame-rate cap. We approximate it by skipping frames until the next
    // wall-clock tick. 30 fps cap = call step at most every 33.3ms.
    let capFps = 60; // 0 means uncapped
    let lastStepTime = performance.now();

    function step(dt) {
        elapsed += dt;
        const throttle = 1;
        const steer = Math.sin(elapsed * 0.6) * 0.6;

        // Correct integrator — same as integrate() but inlined for clarity.
        const steerScale = clamp(carCorrect.speed / 30, 0, 1);
        carCorrect.heading += steer * MAX_STEER_RATE * steerScale * dt;
        const axC = Math.cos(carCorrect.heading) * throttle * MAX_ACCEL;
        const ayC = Math.sin(carCorrect.heading) * throttle * MAX_ACCEL;
        carCorrect.velocity.x += axC * dt;
        carCorrect.velocity.y += ayC * dt;
        carCorrect.position.x += carCorrect.velocity.x * dt;
        carCorrect.position.y += carCorrect.velocity.y * dt;
        const sC = carCorrect.velocity.length();
        if (sC > MAX_SPEED) carCorrect.velocity.multiply(MAX_SPEED / sC);

        // BROKEN integrator — assumes dt = 1 (i.e. updates "per frame").
        // The faster we tick, the faster this car flies. We use the same
        // tunables as the correct car so the numbers are comparable.
        // Step is divided by an arbitrary 60 so 60fps yields similar visual
        // speed to the dt car at 60fps — exposes that at *other* rates the
        // gap is the whole point.
        const PER_FRAME = 1 / 60;
        const speedB = carBroken.velocity.length();
        const steerScaleB = clamp(speedB / 30, 0, 1);
        carBroken.heading += steer * MAX_STEER_RATE * steerScaleB * PER_FRAME;
        const axB = Math.cos(carBroken.heading) * throttle * MAX_ACCEL;
        const ayB = Math.sin(carBroken.heading) * throttle * MAX_ACCEL;
        carBroken.velocity.x += axB * PER_FRAME;
        carBroken.velocity.y += ayB * PER_FRAME;
        carBroken.position.x += carBroken.velocity.x * PER_FRAME;
        carBroken.position.y += carBroken.velocity.y * PER_FRAME;
        const sB = carBroken.velocity.length();
        if (sB > MAX_SPEED) carBroken.velocity.multiply(MAX_SPEED / sB);

        // Wrap both cars horizontally so the demo loops cleanly.
        if (carCorrect.position.x > canvas.width + 30) carCorrect.position.x = -30;
        if (carBroken.position.x  > canvas.width + 30) carBroken.position.x  = -30;
        // Clamp Y so the sin steer doesn't wander them off the canvas.
        carCorrect.position.y = clamp(carCorrect.position.y, 40, canvas.height - 40);
        carBroken.position.y  = clamp(carBroken.position.y,  40, canvas.height - 40);
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Lane separators
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(0, laneY); ctx.lineTo(canvas.width, laneY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('🟥  position += velocity * dt   (correct)', 14, 22);
        ctx.fillStyle = RACING_COLORS.carBodyAlt;
        ctx.fillText('🟦  position += velocity        (per-frame, breaks under fps changes)', 14, canvas.height - 14);

        drawCarSprite(ctx, carCorrect, { body: RACING_COLORS.carBody });
        drawCarSprite(ctx, carBroken,  { body: RACING_COLORS.carBodyAlt });
    }

    startFrameLoop((dt) => {
        const now = performance.now();
        if (capFps > 0) {
            const minStep = 1000 / capFps;
            if (now - lastStepTime < minStep) {
                // Skip this physics step — still render so the canvas refreshes.
                render();
                return;
            }
        }
        // Use the wall-clock interval since *last accepted* step as our dt,
        // capped by MAX_DT. This way 30fps cap really delivers dt ≈ 0.033s.
        const realDt = Math.min((now - lastStepTime) / 1000, MAX_DT);
        lastStepTime = now;
        step(realDt);
        render();

        const fpsLabel = capFps === 0 ? 'unthrottled' : `${capFps} fps`;
        info.innerHTML =
            `Frame cap: <strong>${fpsLabel}</strong>. ` +
            `Watch the BLUE car's speed change with the cap — the RED car holds steady because it multiplies by dt.`;
    });

    function setActive(id) {
        ['btnDtCap30', 'btnDtCap60', 'btnDtUncap'].forEach(b => {
            document.getElementById(b)?.classList.toggle('active', b === id);
        });
    }
    document.getElementById('btnDtCap30')?.addEventListener('click', () => { capFps = 30; setActive('btnDtCap30'); });
    document.getElementById('btnDtCap60')?.addEventListener('click', () => { capFps = 60; setActive('btnDtCap60'); });
    document.getElementById('btnDtUncap')?.addEventListener('click', () => { capFps = 0;  setActive('btnDtUncap');  });
    document.getElementById('btnDtReset')?.addEventListener('click', () => {
        carCorrect.reset(80, laneY - 60, 0);
        carBroken.reset(80, laneY + 60, 0);
        elapsed = 0;
    });
})();

// =============================================================================
// DEMO 4 — Rotating car sprite. Heading slider rotates the sprite about its
// center; an orange arrow shows the forward (cos, sin) direction. Pure
// rendering demo — no integration loop.
// =============================================================================
(function rotatedCarDemo() {
    const canvas = document.getElementById('rotatedCarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('rotatedCarCanvasInfo');
    const slider = document.getElementById('rotatedCarHeading');

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Crosshair grid centered on the canvas — visual reference.
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
        ctx.stroke();

        const deg = parseFloat(slider.value);
        const rad = deg * Math.PI / 180;
        const car = new Car(cx, cy, rad);

        // Halo behind the forward arrow so it pops on dark asphalt.
        const arrowLen = 110;
        const hx = cx + Math.cos(rad) * arrowLen;
        const hy = cy + Math.sin(rad) * arrowLen;
        ctx.strokeStyle = RACING_COLORS.arrowSoft;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(hx, hy);
        ctx.stroke();
        ctx.strokeStyle = RACING_COLORS.arrow;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(hx, hy);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = RACING_COLORS.arrow;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - 10 * Math.cos(rad - 0.4), hy - 10 * Math.sin(rad - 0.4));
        ctx.lineTo(hx - 10 * Math.cos(rad + 0.4), hy - 10 * Math.sin(rad + 0.4));
        ctx.closePath();
        ctx.fill();

        drawCarSprite(ctx, car, { w: 56, h: 28 });

        // Forward vector readout
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`heading: ${deg.toFixed(0)}°`, 14, 22);
        ctx.fillText(`forward = (cos h, sin h) = (${Math.cos(rad).toFixed(2)}, ${Math.sin(rad).toFixed(2)})`, 14, 42);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('Two canvas calls — translate, then rotate. That\'s the whole rotation trick.', 14, canvas.height - 14);

        info.innerHTML =
            `heading <strong>${deg.toFixed(0)}°</strong>, forward vector ` +
            `<strong>(${Math.cos(rad).toFixed(2)}, ${Math.sin(rad).toFixed(2)})</strong>`;
    }

    slider.addEventListener('input', render);
    render();
})();

// =============================================================================
// DEMO 5 — Parking-lot mini-project. The capstone of the Beginner tier.
// Drive a car on a parking-lot floor; the rear wheels stamp dark dots onto an
// offscreen "skid layer" canvas every frame, then we composite that layer
// under the car each render. Cheap, persistent, and zero-array.
// =============================================================================
(function parkingLotDemo() {
    const canvas = document.getElementById('parkingLotCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('parkingLotCanvasInfo');

    // Skid layer — same dimensions as the visible canvas. Never resized.
    const skidLayer = document.createElement('canvas');
    skidLayer.width  = canvas.width;
    skidLayer.height = canvas.height;
    const skidCtx = skidLayer.getContext('2d');

    const startX = canvas.width / 2;
    const startY = canvas.height / 2;
    const car = new Car(startX, startY, 0);
    const readInput = attachKeyInputs(canvas);

    // Frame counter — used to fade old skid marks subtly every N frames.
    // FADE_EVERY is intentionally large so marks linger long enough to read
    // as a clear trail; the per-call alpha is also tiny (see fadeSkidLayer).
    let frameCount = 0;
    const FADE_EVERY = 180;  // ~3 seconds at 60fps between fade passes

    function drawParkingLot() {
        // Two-tone striped floor — gives a sense of motion and parking bays.
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = RACING_COLORS.asphaltLight;
        const stripeW = 80;
        for (let x = 0; x < canvas.width; x += stripeW * 2) {
            ctx.fillRect(x, 0, stripeW, canvas.height);
        }
        // Yellow parking-bay lines down the middle of each light stripe.
        ctx.strokeStyle = RACING_COLORS.paint;
        ctx.lineWidth = 2;
        for (let x = stripeW / 2; x < canvas.width; x += stripeW * 2) {
            ctx.beginPath();
            ctx.moveTo(x, 30); ctx.lineTo(x, canvas.height - 30);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + stripeW, 30); ctx.lineTo(x + stripeW, canvas.height - 30);
            ctx.stroke();
        }
        // Outer rectangle so the playable area reads as bounded — purely visual,
        // we don't enforce a wall here (walls arrive in the Advanced tier).
        ctx.strokeStyle = RACING_COLORS.paint;
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    }

    function stampSkidMarks() {
        const wheels = rearWheelWorldPositions(car);
        skidCtx.fillStyle = RACING_COLORS.skidMark;
        for (const p of wheels) {
            skidCtx.beginPath();
            skidCtx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);  // slightly larger for visibility
            skidCtx.fill();
        }
    }

    function fadeSkidLayer() {
        // Periodically dab a barely-visible black layer on top so very old
        // marks gently dissolve. The "destination-out" composite would also
        // work; this approach is simpler and visually identical here.
        skidCtx.fillStyle = 'rgba(31, 36, 44, 0.04)';
        skidCtx.fillRect(0, 0, skidLayer.width, skidLayer.height);
    }

    function clampToBounds() {
        // Soft clamp: when the car nudges past the painted rectangle we
        // simply stop it dead in that axis. Beginner-tier substitute for
        // proper wall collision (that lands in Advanced).
        const margin = 20;
        if (car.position.x < margin) { car.position.x = margin; car.velocity.x = 0; }
        if (car.position.x > canvas.width  - margin) { car.position.x = canvas.width  - margin; car.velocity.x = 0; }
        if (car.position.y < margin) { car.position.y = margin; car.velocity.y = 0; }
        if (car.position.y > canvas.height - margin) { car.position.y = canvas.height - margin; car.velocity.y = 0; }
    }

    function render() {
        drawParkingLot();
        ctx.drawImage(skidLayer, 0, 0);
        drawCarSprite(ctx, car);

        // Speed/heading HUD in the top-left corner.
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`speed: ${car.speed.toFixed(0)} px/s`, 28, 38);
        ctx.fillText(`heading: ${headingDeg(car.heading).toFixed(0)}°`, 28, 58);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('WASD / arrows to drive. Skid marks persist until you Clear them.', 28, canvas.height - 28);
    }

    startFrameLoop((dt) => {
        const { throttle, steer } = readInput();
        integrate(car, throttle, steer, dt);
        clampToBounds();
        stampSkidMarks();
        frameCount++;
        if (frameCount % FADE_EVERY === 0) fadeSkidLayer();
        render();
        info.innerHTML =
            `speed <strong>${car.speed.toFixed(0)} px/s</strong> &nbsp;|&nbsp; ` +
            `heading <strong>${headingDeg(car.heading).toFixed(0)}°</strong>`;
    });

    document.getElementById('btnParkingReset')?.addEventListener('click', () => {
        car.reset(startX, startY, 0);
    });
    document.getElementById('btnParkingClearSkid')?.addEventListener('click', () => {
        skidCtx.clearRect(0, 0, skidLayer.width, skidLayer.height);
    });

    render();
})();
