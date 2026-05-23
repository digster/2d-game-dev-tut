// =============================================================================
// RACING-SIM — INTERMEDIATE TIER DEMOS
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak into the global
// scope. Each demo runs only if its target canvas exists — same safety rail
// as the Beginner tier.
//
// UNITS — identical to the Beginner tier (do NOT diverge across tiers):
//   position         pixels
//   velocity         px/s
//   heading          radians (0 = facing +X)
//   angular velocity rad/s
//   acceleration     px/s²
//   rollingDrag      1/s    (multiplicative decay rate)
//   gripLimit        px/s²  (lateral velocity killed per second)
//
// THE CENTRAL CHANGE FROM BEGINNER:
//   The integrator now decomposes velocity into (forward, lateral) using the
//   car's heading as the basis. Forward gets rolling drag; lateral gets the
//   grip clamp. Then we recombine and integrate position. Same loop shape,
//   two new lines.
//
// `RACING_COLORS` and `Car` are intentionally redeclared at top-level here
// (same names as in beginner-demos.js) — the Intermediate page only loads
// intermediate-demos.js, never beginner-demos.js, so there is no collision
// between the two scripts. Using the same names keeps the *reading* of the
// codebase uniform across tiers.
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
// Palette — extended slightly from the Beginner tier with surface tints used
// by the drift-pad demo. Otherwise identical so the visual identity holds.
// ---------------------------------------------------------------------------
const RACING_COLORS = {
    asphalt:      '#1f242c',
    asphaltLight: '#262b35',
    paint:        '#fbc02d',
    grid:         '#2e3548',
    gridStrong:   '#4fc3f7',
    carBody:      '#ef5350',   // primary car
    carBodyAlt:   '#26c6da',   // secondary (oversteer/understeer comparison)
    carWindow:    '#263238',
    arrow:        '#ffa726',
    arrowSoft:    '#ffd180',
    arrowLat:     '#4fc3f7',   // cyan — lateral component
    arrowTotal:   '#e0e0e0',   // white — total velocity
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    skidMark:     'rgba(8, 8, 8, 0.75)',  // dark, high-alpha (carried over)
    gripGood:     '#66bb6a',
    gripBad:      '#ef5350',
    surfaceTarmac:'#3a4050',
    surfaceGravel:'#6e5a3a',
    surfaceIce:   '#7fbcd4'
};

// ---------------------------------------------------------------------------
// Surface presets. Each surface is two numbers (plus presentation metadata).
// The whole tier's "feel" tuning lives here.
// ---------------------------------------------------------------------------
const SURFACES = {
    tarmac: { name: 'Tarmac', color: RACING_COLORS.surfaceTarmac, rollingDrag: 0.55, gripLimit: 620 },
    gravel: { name: 'Gravel', color: RACING_COLORS.surfaceGravel, rollingDrag: 1.40, gripLimit: 240 },
    ice:    { name: 'Ice',    color: RACING_COLORS.surfaceIce,    rollingDrag: 0.20, gripLimit: 55  }
};

// ---------------------------------------------------------------------------
// Car — same shape as the Beginner tier with two extra read-only signals
// (`lastVForward`, `lastVLateral`, `gripping`) that the HUD can render
// without re-running the math. They're updated by integrateWithGrip().
// ---------------------------------------------------------------------------
class Car {
    constructor(x = 0, y = 0, heading = 0) {
        this.position = new Vector2D(x, y);
        this.velocity = new Vector2D(0, 0);
        this.heading  = heading;
        // Telemetry — set by the integrator, read by the HUD.
        this.lastVForward = 0;
        this.lastVLateral = 0;
        this.gripping     = true;
    }
    get speed() { return this.velocity.length(); }
    reset(x, y, heading = 0) {
        this.position.x = x; this.position.y = y;
        this.velocity.x = 0; this.velocity.y = 0;
        this.heading = heading;
        this.lastVForward = 0; this.lastVLateral = 0; this.gripping = true;
    }
}

// ---------------------------------------------------------------------------
// Tunables (same names as Beginner where possible).
// ---------------------------------------------------------------------------
const MAX_SPEED      = 320;   // px/s — slightly higher than Beginner; friction now slows us
const MAX_ACCEL      = 260;   // px/s²
const MAX_STEER_RATE = 2.6;   // rad/s
const MAX_DT         = 0.05;  // s — same dt clamp as Beginner

// ---------------------------------------------------------------------------
// THE intermediate-tier integrator. Decomposes velocity into car-local
// (forward, lateral), applies rolling drag along forward and the grip clamp
// along lateral, then recombines. Sets the telemetry properties on the car.
//
// `surface` is one of the entries from SURFACES.
// ---------------------------------------------------------------------------
function integrateWithGrip(car, throttle, steer, dt, surface) {
    // 1. Steering modifies heading (same speed-ramp trick as Beginner).
    const steerScale = clamp(car.speed / 30, 0, 1);
    car.heading += steer * MAX_STEER_RATE * steerScale * dt;

    // 2. Build the car-local basis from the (new) heading.
    const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
    const lx = -fy,                   ly = fx;   // perpendicular ("left")

    // 3. Decompose current velocity onto the basis. Pure dot products.
    let vForward = car.velocity.x * fx + car.velocity.y * fy;
    let vLateral = car.velocity.x * lx + car.velocity.y * ly;

    // 4. Apply throttle as longitudinal acceleration.
    vForward += throttle * MAX_ACCEL * dt;

    // 5. Apply rolling drag along forward only (multiplicative decay).
    //    Pure side-slip experiences ONLY the grip clamp (below), never drag.
    vForward *= (1 - surface.rollingDrag * dt);

    // 6. The grip clamp. Tires can cancel at most gripLimit*dt worth of
    //    lateral velocity each frame. Anything beyond survives as slide.
    const maxKill = surface.gripLimit * dt;
    let gripping;
    if (Math.abs(vLateral) <= maxKill) {
        vLateral = 0;
        gripping = true;
    } else {
        vLateral -= Math.sign(vLateral) * maxKill;
        gripping = false;
    }

    // 7. Recombine into world-space velocity.
    car.velocity.x = fx * vForward + lx * vLateral;
    car.velocity.y = fy * vForward + ly * vLateral;

    // 8. Integrate position. Same as Beginner.
    car.position.x += car.velocity.x * dt;
    car.position.y += car.velocity.y * dt;

    // 9. Clamp absolute speed (mostly a safety rail; rolling drag already
    //    caps us in practice).
    const sp = car.velocity.length();
    if (sp > MAX_SPEED) car.velocity.multiply(MAX_SPEED / sp);

    // Telemetry for HUDs.
    car.lastVForward = vForward;
    car.lastVLateral = vLateral;
    car.gripping = gripping;
}

// ---------------------------------------------------------------------------
// Sprite + input helpers. Carried over from Beginner with no real change.
// ---------------------------------------------------------------------------
function drawCarSprite(ctx, car, opts = {}) {
    const w = opts.w || 30;
    const h = opts.h || 15;
    const body = opts.body || RACING_COLORS.carBody;
    const win  = opts.window || RACING_COLORS.carWindow;
    ctx.save();
    ctx.translate(car.position.x, car.position.y);
    ctx.rotate(car.heading);
    ctx.fillStyle = body;
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 3);
        ctx.fill();
    } else {
        ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.fillStyle = win;
    ctx.fillRect(w / 6, -h / 2 + 2, w / 4, h - 4);
    ctx.restore();
}

function rearWheelWorldPositions(car, w = 30, h = 15) {
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    const pts = [];
    for (const side of [-1, +1]) {
        const lx = -w / 2;
        const ly = side * (h / 2);
        pts.push({
            x: car.position.x + lx * cos - ly * sin,
            y: car.position.y + lx * sin + ly * cos
        });
    }
    return pts;
}

function headingDeg(rad) {
    return ((rad * 180 / Math.PI) % 360 + 360) % 360;
}

function attachKeyInputs(canvas) {
    const state = { up: false, down: false, left: false, right: false };
    const onKey = (e, pressed) => {
        switch (e.key) {
            case 'w': case 'W': case 'ArrowUp':    state.up    = pressed; break;
            case 's': case 'S': case 'ArrowDown':  state.down  = pressed; break;
            case 'a': case 'A': case 'ArrowLeft':  state.left  = pressed; break;
            case 'd': case 'D': case 'ArrowRight': state.right = pressed; break;
            default: return;
        }
        if (document.activeElement === canvas) e.preventDefault();
    };
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup',   (e) => onKey(e, false));
    canvas.addEventListener('mousedown', () => canvas.focus());
    return () => {
        let throttle = 0;
        if (state.up   && !state.down) throttle = +1;
        if (state.down && !state.up)   throttle = -1;
        let steer = 0;
        if (state.left  && !state.right) steer = -1;
        if (state.right && !state.left) steer = +1;
        return { throttle, steer };
    };
}

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

// Draw an arrow from (x1,y1) to (x2,y2) with given color and thickness.
// Used by the velocity-decomposition demo.
function drawArrow(ctx, x1, y1, x2, y2, color, width = 2.5, headSize = 9) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headSize * Math.cos(ang - 0.4), y2 - headSize * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - headSize * Math.cos(ang + 0.4), y2 - headSize * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
}

// =============================================================================
// DEMO 1 — Coast-down on three surfaces. Three cars release at the same
// speed; each lives on a surface with a different rollingDrag. Proves the
// "1 - rate*dt" decay model — and shows ice taking forever to stop.
// =============================================================================
(function coastdownDemo() {
    const canvas = document.getElementById('coastdownCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('coastdownCanvasInfo');

    const lanes = [
        { y:  80, name: 'Tarmac', surface: SURFACES.tarmac, car: null, traveled: 0 },
        { y: 160, name: 'Gravel', surface: SURFACES.gravel, car: null, traveled: 0 },
        { y: 240, name: 'Ice',    surface: SURFACES.ice,    car: null, traveled: 0 }
    ];

    function reset() {
        for (const lane of lanes) {
            lane.car = new Car(60, lane.y, 0);
            lane.car.velocity.x = MAX_SPEED;   // start moving at max speed forward
            lane.traveled = 0;
        }
    }
    reset();

    let running = false;
    let elapsed = 0;

    function step(dt) {
        if (!running) return;
        elapsed += dt;
        for (const lane of lanes) {
            const before = lane.car.position.x;
            // Throttle = 0 — pure coast-down.
            integrateWithGrip(lane.car, 0, 0, dt, lane.surface);
            lane.traveled += Math.abs(lane.car.position.x - before);
            // Wrap around so the demo loops visually (also clamps Y).
            if (lane.car.position.x > canvas.width - 20) lane.car.position.x = canvas.width - 20;
        }
    }

    function render() {
        // Background + lane stripes
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const lane of lanes) {
            ctx.fillStyle = lane.surface.color;
            ctx.globalAlpha = 0.4;
            ctx.fillRect(0, lane.y - 25, canvas.width, 50);
            ctx.globalAlpha = 1;
            // Lane label
            ctx.fillStyle = RACING_COLORS.label;
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`${lane.surface.name}`, 12, lane.y - 30);
            ctx.fillStyle = RACING_COLORS.labelMuted;
            ctx.font = '11px sans-serif';
            ctx.fillText(
                `rollingDrag = ${lane.surface.rollingDrag.toFixed(2)}   |   speed: ${lane.car.speed.toFixed(0)} px/s`,
                12, lane.y + 30
            );
            drawCarSprite(ctx, lane.car, { w: 36, h: 18, body: RACING_COLORS.carBody });
        }
        // Elapsed timer
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`elapsed: ${elapsed.toFixed(2)} s`, canvas.width - 140, 22);
    }

    startFrameLoop((dt) => { step(dt); render(); });

    document.getElementById('btnCoastStart')?.addEventListener('click', () => {
        // Restart if everyone has stopped, else just resume.
        if (lanes.every(l => l.car.speed < 1)) reset();
        running = true;
        elapsed = 0;
    });
    document.getElementById('btnCoastReset')?.addEventListener('click', () => {
        reset();
        running = false;
        elapsed = 0;
        info.textContent = 'Three cars, same start speed, three rolling-drag values.';
    });

    render();
})();

// =============================================================================
// DEMO 2 — Velocity decomposition. The user drags the velocity arrow's tip;
// we project onto (cos h, sin h) and (-sin h, cos h) and draw the two
// components in orange (forward) and cyan (lateral).
// =============================================================================
(function velocityDecomposeDemo() {
    const canvas = document.getElementById('velocityDecomposeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('velocityDecomposeCanvasInfo');
    const slider = document.getElementById('velDecomposeHeading');
    const sliderVal = document.getElementById('velDecomposeHeadingVal');

    // Car always renders at the canvas center.
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    // User-controlled velocity vector tip — start pointing up-right at a
    // moderate magnitude so the demo isn't blank on load.
    let tipX = cx + 160;
    let tipY = cy - 60;
    let dragging = false;
    let headingRad = 0;

    function syncHeadingLabel() {
        sliderVal.textContent = `${slider.value}°`;
        headingRad = parseFloat(slider.value) * Math.PI / 180;
    }
    syncHeadingLabel();

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        // Begin drag if the click is within 18px of the current tip.
        if (Math.hypot(mx - tipX, my - tipY) < 24) dragging = true;
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const r = canvas.getBoundingClientRect();
        tipX = clamp(e.clientX - r.left,  20, canvas.width - 20);
        tipY = clamp(e.clientY - r.top,   20, canvas.height - 20);
        render();
    });
    canvas.addEventListener('mouseup',   () => { dragging = false; });
    canvas.addEventListener('mouseleave',() => { dragging = false; });

    slider.addEventListener('input', () => { syncHeadingLabel(); render(); });

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Crosshair grid through the canvas centre for visual reference.
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height);
        ctx.stroke();

        // The velocity vector from car center to the dragged tip.
        const vx = tipX - cx;
        const vy = tipY - cy;

        // Basis vectors.
        const fx = Math.cos(headingRad), fy = Math.sin(headingRad);
        const lx = -fy,                  ly = fx;
        // Scalar projections.
        const vForward = vx * fx + vy * fy;
        const vLateral = vx * lx + vy * ly;
        // Component vectors (in screen pixels — same units as v).
        const fwdEndX = cx + fx * vForward;
        const fwdEndY = cy + fy * vForward;
        const latEndX = fwdEndX + lx * vLateral;  // tail-to-tail: forward then lateral
        const latEndY = fwdEndY + ly * vLateral;

        // Draw the lateral component starting from the forward tip — visually
        // shows "forward + lateral = total".
        drawArrow(ctx, fwdEndX, fwdEndY, latEndX, latEndY, RACING_COLORS.arrowLat, 2.5);
        // Draw the forward component.
        drawArrow(ctx, cx, cy, fwdEndX, fwdEndY, RACING_COLORS.arrow, 2.5);
        // Draw the total velocity arrow on top (white) — this is what the user drags.
        drawArrow(ctx, cx, cy, tipX, tipY, RACING_COLORS.arrowTotal, 3.2, 12);

        // Car sprite at the centre, rotated to the chosen heading.
        const fake = new Car(cx, cy, headingRad);
        drawCarSprite(ctx, fake, { w: 56, h: 28 });

        // Labels
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`heading: ${slider.value}°`, 14, 22);
        ctx.fillStyle = RACING_COLORS.arrowTotal;
        ctx.fillText(`total v = (${vx.toFixed(0)}, ${vy.toFixed(0)})  |v| = ${Math.hypot(vx, vy).toFixed(0)}`, 14, 42);
        ctx.fillStyle = RACING_COLORS.arrow;
        ctx.fillText(`forward (along heading) = ${vForward.toFixed(0)}`, 14, 62);
        ctx.fillStyle = RACING_COLORS.arrowLat;
        ctx.fillText(`lateral (90° to heading) = ${vLateral.toFixed(0)}`, 14, 82);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('Drag the white arrow tip. Rotate heading to change the basis.', 14, canvas.height - 14);

        info.innerHTML =
            `forward <strong style="color:${RACING_COLORS.arrow}">${vForward.toFixed(0)}</strong> ` +
            `&nbsp;|&nbsp; lateral <strong style="color:${RACING_COLORS.arrowLat}">${vLateral.toFixed(0)}</strong> ` +
            `&nbsp;|&nbsp; total ${Math.hypot(vx, vy).toFixed(0)} px/s`;
    }

    render();
})();

// =============================================================================
// DEMO 3 — Grip threshold. Two bars: lateral velocity in, lateral velocity
// out (after one frame of grip at the chosen gripLimit). Green band shows
// "within grip"; outside the band the bar fades red on the output side to
// indicate slide.
// =============================================================================
(function gripThresholdDemo() {
    const canvas = document.getElementById('gripThresholdCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('gripThresholdCanvasInfo');

    const inputSlider  = document.getElementById('gripInputLat');
    const inputVal     = document.getElementById('gripInputLatVal');
    const limitSlider  = document.getElementById('gripLimitSlider');
    const limitVal     = document.getElementById('gripLimitSliderVal');

    // Use a representative dt the actual integrator runs at (one 60Hz frame).
    const DT = 1 / 60;

    function render() {
        const vIn    = parseFloat(inputSlider.value);
        const limit  = parseFloat(limitSlider.value);
        const maxKill = limit * DT;
        let vOut;
        let gripping;
        if (Math.abs(vIn) <= maxKill) { vOut = 0; gripping = true; }
        else { vOut = vIn - Math.sign(vIn) * maxKill; gripping = false; }

        inputVal.textContent = vIn.toFixed(0);
        limitVal.textContent = limit.toFixed(0);

        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Bar geometry — two bars side by side, each with a midline showing zero.
        const barH   = 200;
        const barW   = 90;
        const inX    = canvas.width / 2 - 160;
        const outX   = canvas.width / 2 + 70;
        const baseY  = canvas.height / 2 + barH / 2;
        const midY   = baseY - barH / 2;

        // Scale: ±400 px/s maps to half the bar height.
        const SCALE_MAX = 400;
        const pxPerUnit = (barH / 2) / SCALE_MAX;

        function drawBar(x, label, value, isOutput) {
            // Bar frame
            ctx.strokeStyle = RACING_COLORS.grid;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, midY - barH / 2, barW, barH);
            // Zero midline
            ctx.strokeStyle = RACING_COLORS.labelMuted;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(x, midY); ctx.lineTo(x + barW, midY);
            ctx.stroke();
            ctx.setLineDash([]);
            // Grip-band shading (only visible on the input bar, where it matters).
            if (!isOutput) {
                const halfBand = maxKill * pxPerUnit;
                ctx.fillStyle = 'rgba(102, 187, 106, 0.18)';
                ctx.fillRect(x, midY - halfBand, barW, halfBand * 2);
                ctx.strokeStyle = RACING_COLORS.gripGood;
                ctx.setLineDash([2, 4]);
                ctx.strokeRect(x, midY - halfBand, barW, halfBand * 2);
                ctx.setLineDash([]);
            }
            // The value bar itself.
            const h = value * pxPerUnit;
            const fill = isOutput
                ? (gripping ? RACING_COLORS.gripGood : RACING_COLORS.gripBad)
                : RACING_COLORS.arrowTotal;
            ctx.fillStyle = fill;
            ctx.fillRect(x + 6, midY - h, barW - 12, h);
            // Label
            ctx.fillStyle = RACING_COLORS.label;
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, x + barW / 2, midY - barH / 2 - 12);
            ctx.font = '12px sans-serif';
            ctx.fillStyle = RACING_COLORS.labelMuted;
            ctx.fillText(`${value.toFixed(0)} px/s`, x + barW / 2, baseY + 18);
            ctx.textAlign = 'left';
        }

        drawBar(inX,  'IN — v_lateral', vIn, false);
        drawBar(outX, 'OUT — after grip', vOut, true);

        // Arrow connecting the two bars
        ctx.strokeStyle = RACING_COLORS.labelMuted;
        ctx.lineWidth = 1.5;
        const arrowY = midY;
        ctx.beginPath();
        ctx.moveTo(inX + barW + 8, arrowY);
        ctx.lineTo(outX - 8, arrowY);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.beginPath();
        ctx.moveTo(outX - 8, arrowY);
        ctx.lineTo(outX - 16, arrowY - 5);
        ctx.lineTo(outX - 16, arrowY + 5);
        ctx.closePath();
        ctx.fill();

        // Caption for the arrow
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('one frame of grip', (inX + barW + outX) / 2, arrowY - 8);
        ctx.fillText(`(dt = ${(DT*1000).toFixed(1)}ms)`, (inX + barW + outX) / 2, arrowY + 16);
        ctx.fillText(`gripLimit × dt = ${maxKill.toFixed(1)} px/s`, (inX + barW + outX) / 2, arrowY + 32);
        ctx.textAlign = 'left';

        // State badge
        ctx.fillStyle = gripping ? RACING_COLORS.gripGood : RACING_COLORS.gripBad;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(gripping ? 'GRIP' : 'SLIDE', 14, 28);

        info.innerHTML =
            `Input lateral velocity <strong>${vIn.toFixed(0)} px/s</strong>, grip limit ` +
            `<strong>${limit.toFixed(0)} px/s²</strong> → ` +
            (gripping
                ? `output <strong style="color:${RACING_COLORS.gripGood}">0 px/s</strong> (within grip)`
                : `output <strong style="color:${RACING_COLORS.gripBad}">${vOut.toFixed(0)} px/s</strong> (slide)`);
    }

    inputSlider.addEventListener('input', render);
    limitSlider.addEventListener('input', render);
    render();
})();

// =============================================================================
// DEMO 4 — Oversteer vs Understeer. Two cars on the same scripted input
// (forward + sin steering). Red car is tuned with low rear grip; cyan with
// low front grip. We approximate with two `gripLimit` values: the red car
// uses a lower one (slides more), the cyan car uses a higher one but its
// effective steer-rate is reduced (steers less). Different lines, same input.
// =============================================================================
(function oversteerUndersteerDemo() {
    const canvas = document.getElementById('oversteerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('oversteerCanvasInfo');

    const start = { x: canvas.width / 2, y: canvas.height / 2 + 80 };
    const carOver  = new Car(start.x, start.y, -Math.PI / 2);   // RED — oversteer
    const carUnder = new Car(start.x, start.y, -Math.PI / 2);   // CYAN — understeer

    // Trails — explicit point arrays here (lighter than the offscreen-canvas
    // approach used in the mini-project; we don't need to persist forever).
    const trailOver  = [];
    const trailUnder = [];
    const TRAIL_MAX  = 600;

    // Tunings — drive the visible feel difference.
    // Oversteer: same gripLimit but a *lower* one; the rear ends up sliding,
    // and we add a small heading kick proportional to lateral velocity to
    // simulate the back swinging out.
    const tuneOver = { surface: { rollingDrag: 0.55, gripLimit: 180 }, yawKick: 0.018, steerEff: 1.0 };
    // Understeer: high grip but the steering input is partially absorbed —
    // the car turns less than asked. Feel: plows wide.
    const tuneUnder = { surface: { rollingDrag: 0.55, gripLimit: 520 }, yawKick: 0,     steerEff: 0.55 };

    let elapsed = 0;
    let paused = false;

    function reset() {
        carOver.reset(start.x, start.y, -Math.PI / 2);
        carUnder.reset(start.x, start.y, -Math.PI / 2);
        trailOver.length = 0;
        trailUnder.length = 0;
        elapsed = 0;
    }

    // Custom integrator wrapper that respects the per-car steer efficiency
    // and yaw-kick. Falls through to integrateWithGrip for the core math.
    function tickCar(car, tune, throttle, steerInput, dt) {
        const steerScale = clamp(car.speed / 30, 0, 1);
        // Steer modification before calling the core integrator.
        const effSteer = steerInput * tune.steerEff;
        // We integrate manually to inject the yaw kick *after* grip.
        // 1. heading update
        car.heading += effSteer * MAX_STEER_RATE * steerScale * dt;
        // 2. decompose
        const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
        const lx = -fy, ly = fx;
        let vF = car.velocity.x * fx + car.velocity.y * fy;
        let vL = car.velocity.x * lx + car.velocity.y * ly;
        // 3. throttle + drag
        vF += throttle * MAX_ACCEL * dt;
        vF *= (1 - tune.surface.rollingDrag * dt);
        // 4. grip clamp
        const maxKill = tune.surface.gripLimit * dt;
        let gripping;
        if (Math.abs(vL) <= maxKill) { vL = 0; gripping = true; }
        else { vL -= Math.sign(vL) * maxKill; gripping = false; }
        // 5. yaw kick — oversteer signature. Heading turns extra in the
        //    direction the rear is sliding.
        car.heading += vL * tune.yawKick * dt;
        // 6. recombine + integrate
        car.velocity.x = fx * vF + lx * vL;
        car.velocity.y = fy * vF + ly * vL;
        car.position.x += car.velocity.x * dt;
        car.position.y += car.velocity.y * dt;
        const sp = car.velocity.length();
        if (sp > MAX_SPEED) car.velocity.multiply(MAX_SPEED / sp);
        car.gripping = gripping;
    }

    function step(dt) {
        if (paused) return;
        elapsed += dt;
        // Scripted figure-eight: constant throttle, sinusoidal steer.
        const throttle = 0.9;
        const steer = Math.sin(elapsed * 0.95) * 0.95;
        tickCar(carOver,  tuneOver,  throttle, steer, dt);
        tickCar(carUnder, tuneUnder, throttle, steer, dt);
        trailOver.push({ x: carOver.position.x,  y: carOver.position.y });
        trailUnder.push({ x: carUnder.position.x, y: carUnder.position.y });
        if (trailOver.length  > TRAIL_MAX) trailOver.shift();
        if (trailUnder.length > TRAIL_MAX) trailUnder.shift();
        // Wrap-around so the cars don't escape during long runs.
        const margin = 30;
        for (const c of [carOver, carUnder]) {
            if (c.position.x < margin) { c.position.x = margin; c.velocity.x *= -0.4; }
            if (c.position.x > canvas.width - margin) { c.position.x = canvas.width - margin; c.velocity.x *= -0.4; }
            if (c.position.y < margin) { c.position.y = margin; c.velocity.y *= -0.4; }
            if (c.position.y > canvas.height - margin) { c.position.y = canvas.height - margin; c.velocity.y *= -0.4; }
        }
    }

    function drawTrail(points, color) {
        if (points.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Reference grid
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = 40; x < canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 40; y < canvas.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        drawTrail(trailUnder, RACING_COLORS.carBodyAlt);
        drawTrail(trailOver,  RACING_COLORS.carBody);
        drawCarSprite(ctx, carUnder, { body: RACING_COLORS.carBodyAlt });
        drawCarSprite(ctx, carOver,  { body: RACING_COLORS.carBody });

        // Legend
        ctx.fillStyle = RACING_COLORS.carBody;
        ctx.fillRect(14, 14, 16, 10);
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('Oversteer (low rear grip, yaw kicks out)', 36, 24);
        ctx.fillStyle = RACING_COLORS.carBodyAlt;
        ctx.fillRect(14, 32, 16, 10);
        ctx.fillStyle = RACING_COLORS.label;
        ctx.fillText('Understeer (high grip, steering input damped — plows wide)', 36, 42);
    }

    startFrameLoop((dt) => { step(dt); render(); });

    document.getElementById('btnOversteerReset')?.addEventListener('click', reset);
    document.getElementById('btnOversteerPause')?.addEventListener('click', () => {
        paused = !paused;
        info.textContent = paused
            ? 'Paused. Same scripted input would diverge into two very different lines.'
            : 'Red = oversteer (rear slips first). Cyan = understeer (front slips first).';
    });

    render();
})();

// =============================================================================
// DEMO 5 — Drift pad mini-project. The headline interactive of the
// Intermediate tier. WASD drives a car on a wide pad; the surface picker
// swaps `currentSurface`, which feeds `integrateWithGrip`. Skid layer is the
// same offscreen-canvas trick from the Beginner mini-project. HUD shows live
// speed, heading, lateral velocity, and grip state.
// =============================================================================
(function driftPadDemo() {
    const canvas = document.getElementById('driftPadCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('driftPadCanvasInfo');

    const skidLayer = document.createElement('canvas');
    skidLayer.width  = canvas.width;
    skidLayer.height = canvas.height;
    const skidCtx = skidLayer.getContext('2d');

    const startX = canvas.width / 2;
    const startY = canvas.height / 2;
    const car = new Car(startX, startY, 0);
    const readInput = attachKeyInputs(canvas);

    let currentSurface = SURFACES.tarmac;
    let frameCount = 0;
    const FADE_EVERY = 200;  // ~3.3s at 60fps

    function drawPad() {
        // Solid surface fill — tinted by the active surface so the player
        // sees what they're driving on at a glance.
        ctx.fillStyle = currentSurface.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Concentric reference rings — gives a sense of where the centre is
        // and how big your drift radius is.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        for (let r = 60; r < 360; r += 60) {
            ctx.beginPath();
            ctx.arc(startX, startY, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Centre cross
        ctx.beginPath();
        ctx.moveTo(startX - 12, startY); ctx.lineTo(startX + 12, startY);
        ctx.moveTo(startX, startY - 12); ctx.lineTo(startX, startY + 12);
        ctx.stroke();

        // Pad boundary
        ctx.strokeStyle = RACING_COLORS.paint;
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    }

    function stampSkidMarks() {
        // Only stamp visible marks when the car is actually sliding — that's
        // how real tyres make a mark. While gripped you just leave dust.
        if (car.gripping) return;
        const wheels = rearWheelWorldPositions(car);
        skidCtx.fillStyle = RACING_COLORS.skidMark;
        for (const p of wheels) {
            skidCtx.beginPath();
            skidCtx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
            skidCtx.fill();
        }
    }

    function fadeSkidLayer() {
        // Match the current surface so the fade reads naturally over it.
        // Hex -> faint rgba.
        const hex = currentSurface.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        skidCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.05)`;
        skidCtx.fillRect(0, 0, skidLayer.width, skidLayer.height);
    }

    function clampToBounds() {
        const margin = 20;
        if (car.position.x < margin) { car.position.x = margin; car.velocity.x = 0; }
        if (car.position.x > canvas.width  - margin) { car.position.x = canvas.width  - margin; car.velocity.x = 0; }
        if (car.position.y < margin) { car.position.y = margin; car.velocity.y = 0; }
        if (car.position.y > canvas.height - margin) { car.position.y = canvas.height - margin; car.velocity.y = 0; }
    }

    function render() {
        drawPad();
        ctx.drawImage(skidLayer, 0, 0);
        drawCarSprite(ctx, car);

        // HUD — top-left.
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`surface: ${currentSurface.name}`, 28, 36);
        ctx.fillText(`speed: ${car.speed.toFixed(0)} px/s`, 28, 56);
        ctx.fillText(`heading: ${headingDeg(car.heading).toFixed(0)}°`, 28, 76);
        ctx.fillText(`v_forward: ${car.lastVForward.toFixed(0)}`, 28, 96);
        ctx.fillText(`v_lateral: ${car.lastVLateral.toFixed(0)}`, 28, 116);
        // GRIP / SLIDE badge
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = car.gripping ? RACING_COLORS.gripGood : RACING_COLORS.gripBad;
        ctx.fillText(car.gripping ? 'GRIP' : 'SLIDE', 28, 142);

        // Hint
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('WASD / arrows to drive. Pick a surface. Marks only stamp while sliding.', 28, canvas.height - 28);
    }

    startFrameLoop((dt) => {
        const { throttle, steer } = readInput();
        integrateWithGrip(car, throttle, steer, dt, currentSurface);
        clampToBounds();
        stampSkidMarks();
        frameCount++;
        if (frameCount % FADE_EVERY === 0) fadeSkidLayer();
        render();
        info.innerHTML =
            `<strong>${currentSurface.name}</strong> &nbsp;|&nbsp; ` +
            `speed <strong>${car.speed.toFixed(0)} px/s</strong> &nbsp;|&nbsp; ` +
            `lateral <strong>${car.lastVLateral.toFixed(0)} px/s</strong> &nbsp;|&nbsp; ` +
            `<strong style="color:${car.gripping ? RACING_COLORS.gripGood : RACING_COLORS.gripBad}">` +
            `${car.gripping ? 'GRIP' : 'SLIDE'}</strong>`;
    });

    function setActiveSurface(buttonId, surface) {
        currentSurface = surface;
        ['btnSurfaceTarmac', 'btnSurfaceGravel', 'btnSurfaceIce'].forEach(id => {
            document.getElementById(id)?.classList.toggle('active', id === buttonId);
        });
    }
    document.getElementById('btnSurfaceTarmac')?.addEventListener('click', () => setActiveSurface('btnSurfaceTarmac', SURFACES.tarmac));
    document.getElementById('btnSurfaceGravel')?.addEventListener('click', () => setActiveSurface('btnSurfaceGravel', SURFACES.gravel));
    document.getElementById('btnSurfaceIce')   ?.addEventListener('click', () => setActiveSurface('btnSurfaceIce',    SURFACES.ice));

    document.getElementById('btnDriftReset')?.addEventListener('click', () => {
        car.reset(startX, startY, 0);
    });
    document.getElementById('btnDriftClearSkid')?.addEventListener('click', () => {
        skidCtx.clearRect(0, 0, skidLayer.width, skidLayer.height);
    });

    render();
})();
