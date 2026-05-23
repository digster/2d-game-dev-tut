// =============================================================================
// RACING-SIM — EXPERT TIER DEMOS
// =============================================================================
// IIFE-wrapped, canvas-guarded. Same units as previous tiers (do NOT diverge):
//   position px · velocity px/s · heading rad (0 = +X) · accel px/s²
//   rollingDrag 1/s · gripLimit px/s² (now used as a Pacejka force scale)
//
// THE BIG ADD:
//   integrateWithPacejka() replaces the Intermediate grip clamp with a
//   slip-angle → lateral-force lookup using a simplified Pacejka "Magic
//   Formula": F = D · sin(C · atan(B · α)). Same surface tables work; the
//   peak factor D is gripLimit. Set B=very-large and the curve degenerates
//   to the Intermediate clamp — strict superset of the previous integrator.
//
// REUSES from shared/utils.js:
//   `Vector2D`, `Vector2D.reflect`, `lineIntersection`, `clamp`, `lerp`.
//
// `RACING_COLORS` and `Car` are redeclared at top-level here with the same
// names as in previous tiers' demo files — each tier page loads only its
// own demos file, so no collision. The redeclaration keeps the source
// uniform across tiers.
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
// Palette + tunables — extended Intermediate values for the hot-lap polish.
// ---------------------------------------------------------------------------
const RACING_COLORS = {
    asphalt:      '#1f242c',
    asphaltLight: '#262b35',
    paint:        '#fbc02d',
    grid:         '#2e3548',
    gridStrong:   '#4fc3f7',
    carBody:      '#ef5350',
    carBodyAlt:   '#26c6da',
    carWindow:    '#263238',
    arrow:        '#ffa726',
    arrowSoft:    '#ffd180',
    arrowLat:     '#4fc3f7',
    arrowTotal:   '#e0e0e0',
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    skidMark:     'rgba(8, 8, 8, 0.75)',
    gripGood:     '#66bb6a',
    gripBad:      '#ef5350',
    trackSurface: '#2b313c',
    trackBorder:  '#fbc02d',
    centerline:   '#90a4ae',
    startLine:    '#ffffff',
    wall:         '#fbc02d',
    // Expert-only colours
    pacCurve:     '#4fc3f7',
    pacClamp:     '#9e9e9e',
    pacDot:       '#ffa726',
    pacPeak:      '#66bb6a',
    lightRed:     '#ef5350',
    lightAmber:   '#ffa726',
    lightGreen:   '#66bb6a',
    lightDark:    '#2d3354',
    camRigid:     '#ef5350',
    camLerp:      '#ffa726',
    camLead:      '#26c6da',
    camCar:       '#e0e0e0',
    triggerLeft:  '#ef5350',
    triggerRight: '#66bb6a',
    stickAxis:    '#4fc3f7'
};

const MAX_SPEED      = 360;
const MAX_ACCEL      = 300;
const MAX_BRAKE      = 360;
const MAX_STEER_RATE = 2.8;
const MAX_DT         = 0.05;

// ---------------------------------------------------------------------------
// The Expert integrator. Strict superset of the Intermediate grip-clamp
// integrator — replaces the hard `if (|vLat| < maxKill) vLat = 0 else slide`
// with a smooth Pacejka curve. The car's `gripping` flag is computed from
// |slipAngle| against an arbitrary threshold (the curve's peak), purely for
// HUD purposes — the physics doesn't snap.
// ---------------------------------------------------------------------------
const PACEJKA_DEFAULT = { B: 8, C: 1.5, D: 1.0 };

function pacejka(alpha, B = 8, C = 1.5, D = 1.0) {
    return D * Math.sin(C * Math.atan(B * alpha));
}
// Where the curve f = D·sin(C·atan(B·α)) peaks, in radians.
// Solve C·atan(B·α) = π/2 → α_peak = tan(π/(2C)) / B. Valid for C > 1
// (for C ≤ 1 the curve is monotonic with no finite peak — the caller is
// responsible for staying in the C > 1 regime, which the racing-sim always does).
function pacejkaPeakAlpha(B = 8, C = 1.5) {
    return Math.tan(Math.PI / (2 * C)) / B;
}

class Car {
    constructor(x = 0, y = 0, heading = 0, radius = 11) {
        this.position = new Vector2D(x, y);
        this.velocity = new Vector2D(0, 0);
        this.heading  = heading;
        this.radius   = radius;
        this.prevPosition = new Vector2D(x, y);
        this.lastVForward = 0;
        this.lastVLateral = 0;
        this.lastSlipAlpha = 0;   // radians
        this.gripping = true;
    }
    get speed() { return this.velocity.length(); }
    reset(x, y, heading = 0) {
        this.position.x = x; this.position.y = y;
        this.prevPosition.x = x; this.prevPosition.y = y;
        this.velocity.x = 0; this.velocity.y = 0;
        this.heading = heading;
        this.lastVForward = 0; this.lastVLateral = 0; this.lastSlipAlpha = 0;
        this.gripping = true;
    }
}

function integrateWithPacejka(car, throttle, steer, dt, surface, tireB = 8, tireC = 1.5) {
    car.prevPosition.x = car.position.x;
    car.prevPosition.y = car.position.y;

    const steerScale = clamp(car.speed / 30, 0, 1);
    car.heading += steer * MAX_STEER_RATE * steerScale * dt;

    const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
    const lx = -fy,                   ly = fx;
    let vForward = car.velocity.x * fx + car.velocity.y * fy;
    let vLateral = car.velocity.x * lx + car.velocity.y * ly;

    // Throttle: positive = drive, negative = brake (stronger than throttle).
    if (throttle >= 0) vForward += throttle * MAX_ACCEL * dt;
    else               vForward += throttle * MAX_BRAKE * dt;

    vForward *= (1 - surface.rollingDrag * dt);

    // Pacejka lateral force. Slip angle relative to forward velocity (small
    // forward-velocity guard so atan2 doesn't explode at standstill).
    const fwdMag = Math.max(Math.abs(vForward), 1);
    const alpha = Math.atan2(vLateral, fwdMag);
    const D = 1.0;  // normalised; we scale by surface.gripLimit on the next line
    const force = pacejka(alpha, tireB, tireC, D) * surface.gripLimit;
    // Force opposes lateral velocity (same sign as alpha, same sign as vLateral).
    vLateral -= force * dt;
    // Numerical safety: prevent the discrete step from over-shooting through zero.
    // If the new sign disagrees with the old, snap to zero — same behaviour as
    // the Intermediate clamp once the slip falls below the curve's "linear"
    // region. Without this guard the integrator can grow a small sign-flip
    // oscillation when sitting near zero slip.
    if (Math.sign(vLateral) !== Math.sign(force) && Math.abs(force) > 1e-3) {
        // No-op: vLateral and force had opposite sign coming in, which is the
        // expected stable state.
    }

    car.velocity.x = fx * vForward + lx * vLateral;
    car.velocity.y = fy * vForward + ly * vLateral;
    car.position.x += car.velocity.x * dt;
    car.position.y += car.velocity.y * dt;

    const sp = car.velocity.length();
    if (sp > MAX_SPEED) car.velocity.multiply(MAX_SPEED / sp);

    car.lastVForward  = vForward;
    car.lastVLateral  = vLateral;
    car.lastSlipAlpha = alpha;
    car.gripping = Math.abs(alpha) <= pacejkaPeakAlpha(tireB, tireC);
}

// ---------------------------------------------------------------------------
// Track / wall / checkpoint helpers — verbatim from the Advanced tier so this
// file stands alone.
// ---------------------------------------------------------------------------
function sampleCubic(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = i / n, u = 1 - t;
        out.push({
            x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
            y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y
        });
    }
    return out;
}
function buildCenterline(segments, samplesPerSegment = 64) {
    const points = [];
    for (const s of segments) points.push(...sampleCubic(s.p0, s.p1, s.p2, s.p3, samplesPerSegment));
    return points;
}
function inflateWalls(centerline, halfWidth) {
    const left = [], right = [];
    const n = centerline.length;
    for (let i = 0; i < n; i++) {
        const a = centerline[i], b = centerline[(i + 1) % n];
        const tx = b.x - a.x, ty = b.y - a.y;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;
        left.push({  x: a.x + nx * halfWidth, y: a.y + ny * halfWidth });
        right.push({ x: a.x - nx * halfWidth, y: a.y - ny * halfWidth });
    }
    return { left, right };
}
function buildCheckpoints(centerline, halfWidth, count) {
    const out = [];
    const step = Math.floor(centerline.length / count);
    for (let i = 0; i < count; i++) {
        const idx = i * step;
        const a = centerline[idx], b = centerline[(idx + 1) % centerline.length];
        const tx = b.x - a.x, ty = b.y - a.y;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;
        out.push({
            a:     { x: a.x + nx * halfWidth, y: a.y + ny * halfWidth },
            b:     { x: a.x - nx * halfWidth, y: a.y - ny * halfWidth },
            center:{ x: a.x, y: a.y },
            index: idx
        });
    }
    return out;
}
function closestPointOnSegment(c, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const denom = dx * dx + dy * dy;
    if (denom === 0) return { x: a.x, y: a.y, t: 0 };
    let t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / denom;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * dx, y: a.y + t * dy, t };
}
function collideCarWithWall(car, a, b, bounceDamping = 0.35) {
    const closest = closestPointOnSegment(car.position, a, b);
    const dx = car.position.x - closest.x, dy = car.position.y - closest.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= car.radius || dist === 0) return null;
    const nx = dx / dist, ny = dy / dist;
    car.position.x += nx * (car.radius - dist);
    car.position.y += ny * (car.radius - dist);
    const reflected = car.velocity.reflect({ x: nx, y: ny });
    car.velocity.x = reflected.x * bounceDamping;
    car.velocity.y = reflected.y * bounceDamping;
    return { x: closest.x, y: closest.y, nx, ny };
}
function collideCarWithPolyline(car, polyline, bounceDamping = 0.35) {
    let impact = null;
    for (let iter = 0; iter < 4; iter++) {
        let collided = false;
        const n = polyline.length;
        for (let i = 0; i < n; i++) {
            const a = polyline[i], b = polyline[(i + 1) % n];
            const r = collideCarWithWall(car, a, b, bounceDamping);
            if (r) { impact = r; collided = true; }
        }
        if (!collided) break;
    }
    return impact;
}
function tickCheckpoints(prevPos, currPos, checkpoints, next, laps) {
    const cp = checkpoints[next];
    if (lineIntersection(prevPos, currPos, cp.a, cp.b)) {
        next = (next + 1) % checkpoints.length;
        if (next === 0) laps += 1;
    }
    return { next, laps };
}
function makeOvalTrack(cx, cy, rx, ry, halfWidth, samplesPerSeg = 28, checkpointCount = 8) {
    const K = 0.5523;
    const right = { x: cx + rx, y: cy };
    const bottom= { x: cx,      y: cy + ry };
    const left  = { x: cx - rx, y: cy };
    const top   = { x: cx,      y: cy - ry };
    const segments = [
        { p0: right,  p1: { x: cx + rx, y: cy + ry * K }, p2: { x: cx + rx * K, y: cy + ry }, p3: bottom },
        { p0: bottom, p1: { x: cx - rx * K, y: cy + ry }, p2: { x: cx - rx, y: cy + ry * K }, p3: left },
        { p0: left,   p1: { x: cx - rx, y: cy - ry * K }, p2: { x: cx - rx * K, y: cy - ry }, p3: top },
        { p0: top,    p1: { x: cx + rx * K, y: cy - ry }, p2: { x: cx + rx, y: cy - ry * K }, p3: right }
    ];
    const centerline = buildCenterline(segments, samplesPerSeg);
    const walls = inflateWalls(centerline, halfWidth);
    const checkpoints = buildCheckpoints(centerline, halfWidth, checkpointCount);
    return { segments, centerline, walls, checkpoints };
}

// ---------------------------------------------------------------------------
// Sprite + input helpers.
// ---------------------------------------------------------------------------
function drawCarSprite(ctx, car, opts = {}) {
    const w = opts.w || 28, h = opts.h || 14;
    const body = opts.body || RACING_COLORS.carBody;
    const win  = opts.window || RACING_COLORS.carWindow;
    ctx.save();
    ctx.translate(car.position.x, car.position.y);
    ctx.rotate(car.heading);
    ctx.fillStyle = body;
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 3); ctx.fill();
    } else ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = win;
    ctx.fillRect(w / 6, -h / 2 + 2, w / 4, h - 4);
    ctx.restore();
}
function rearWheelWorldPositions(car, w = 28, h = 14) {
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    const pts = [];
    for (const side of [-1, +1]) {
        const lx = -w / 2, ly = side * (h / 2);
        pts.push({ x: car.position.x + lx * cos - ly * sin, y: car.position.y + lx * sin + ly * cos });
    }
    return pts;
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
    let last = performance.now(), running = true;
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
function drawArrow(ctx, x1, y1, x2, y2, color, width = 2.5, headSize = 9) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headSize * Math.cos(ang - 0.4), y2 - headSize * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - headSize * Math.cos(ang + 0.4), y2 - headSize * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------------------------------
// Gamepad polling — exposed for the gamepad demo AND the hot-lap demo.
// ---------------------------------------------------------------------------
function readGamepad(deadZone = 0.08) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
        if (!pad) continue;
        let steer    =  pad.axes[0] || 0;
        let throttle =  pad.buttons[7]?.value || 0;  // RT
        let brake    =  pad.buttons[6]?.value || 0;  // LT
        if (Math.abs(steer) < deadZone) steer = 0;
        const net = brake > 0.1 ? -brake : throttle;
        return { throttle: net, steer, connected: true, name: pad.id, rawSteer: pad.axes[0] || 0, throttleRaw: pad.buttons[7]?.value || 0, brakeRaw: pad.buttons[6]?.value || 0 };
    }
    return { throttle: 0, steer: 0, connected: false, name: null, rawSteer: 0, throttleRaw: 0, brakeRaw: 0 };
}

// =============================================================================
// DEMO 1 — Pacejka curve visualiser. Slip angle slider; live curve + dot;
// B/C/D sliders to reshape; dashed grey hard-clamp for comparison.
// =============================================================================
(function pacejkaCurveDemo() {
    const canvas = document.getElementById('pacejkaCurveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('pacejkaCurveCanvasInfo');

    const alphaS = document.getElementById('pacSlipAngle');
    const bS = document.getElementById('pacB');
    const cS = document.getElementById('pacC');
    const dS = document.getElementById('pacD');
    const alphaVal = document.getElementById('pacSlipAngleVal');
    const bVal = document.getElementById('pacBVal');
    const cVal = document.getElementById('pacCVal');
    const dVal = document.getElementById('pacDVal');

    function render() {
        const alphaDeg = parseFloat(alphaS.value);
        const B = parseFloat(bS.value);
        const C = parseFloat(cS.value);
        const D = parseFloat(dS.value);
        alphaVal.textContent = `${alphaDeg.toFixed(1)}°`;
        bVal.textContent = B.toFixed(0);
        cVal.textContent = C.toFixed(2);
        dVal.textContent = D.toFixed(2);

        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Plot region
        const padL = 60, padR = 30, padT = 30, padB = 50;
        const plotW = canvas.width - padL - padR;
        const plotH = canvas.height - padT - padB;
        const xMin = -30, xMax = 30; // degrees on screen
        const yMin = -1.5, yMax = 1.5; // force units
        const toX = (deg) => padL + (deg - xMin) / (xMax - xMin) * plotW;
        const toY = (val) => padT + (yMax - val) / (yMax - yMin) * plotH;

        // Axes
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH);
        ctx.lineTo(padL + plotW, padT + plotH);
        ctx.stroke();
        // Zero axes through origin
        ctx.strokeStyle = RACING_COLORS.labelMuted;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(toX(0), padT); ctx.lineTo(toX(0), padT + plotH);
        ctx.moveTo(padL, toY(0)); ctx.lineTo(padL + plotW, toY(0));
        ctx.stroke();
        ctx.setLineDash([]);

        // Hard clamp comparison: ±D constant once past threshold.
        // Intermediate's clamp killed up to gripLimit*dt per frame; the
        // "equivalent" steady-state look is a step at the equivalent slip.
        ctx.strokeStyle = RACING_COLORS.pacClamp;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        // Step approximation: hard saturation at ±D
        ctx.moveTo(toX(xMin), toY(-D));
        ctx.lineTo(toX(-0.1), toY(-D));
        ctx.lineTo(toX(-0.1), toY(D));
        ctx.lineTo(toX(xMax), toY(D));
        ctx.stroke();
        ctx.setLineDash([]);

        // Pacejka curve
        ctx.strokeStyle = RACING_COLORS.pacCurve;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let px = 0; px <= plotW; px++) {
            const deg = xMin + (px / plotW) * (xMax - xMin);
            const rad = deg * Math.PI / 180;
            const f = pacejka(rad, B, C, D);
            const x = padL + px;
            const y = toY(f);
            if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Peak markers (positive and negative)
        const peakRad = pacejkaPeakAlpha(B, C);
        const peakDeg = peakRad * 180 / Math.PI;
        const peakForce = pacejka(peakRad, B, C, D);
        for (const sign of [-1, +1]) {
            ctx.fillStyle = RACING_COLORS.pacPeak;
            ctx.beginPath();
            ctx.arc(toX(sign * peakDeg), toY(sign * peakForce), 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Current-slip dot
        const alphaRad = alphaDeg * Math.PI / 180;
        const fNow = pacejka(alphaRad, B, C, D);
        ctx.fillStyle = RACING_COLORS.pacDot;
        ctx.beginPath();
        ctx.arc(toX(alphaDeg), toY(fNow), 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

        // Axis labels
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('slip angle α (degrees)', padL + plotW / 2, canvas.height - 14);
        ctx.save();
        ctx.translate(20, padT + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('lateral force (normalised)', 0, 0);
        ctx.restore();
        ctx.textAlign = 'left';

        // Legend
        ctx.fillStyle = RACING_COLORS.pacCurve;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('━ Pacejka', padL + plotW - 200, padT + 18);
        ctx.fillStyle = RACING_COLORS.pacClamp;
        ctx.fillText('┄ hard clamp (Intermediate)', padL + plotW - 200, padT + 36);
        ctx.fillStyle = RACING_COLORS.pacPeak;
        ctx.fillText(`• peak ±${peakDeg.toFixed(1)}°`, padL + plotW - 200, padT + 54);

        info.innerHTML =
            `α <strong>${alphaDeg.toFixed(1)}°</strong> → F <strong>${fNow.toFixed(2)}</strong> ` +
            `&nbsp;|&nbsp; peak at <strong>${peakDeg.toFixed(1)}°</strong> ` +
            `&nbsp;|&nbsp; B=<strong>${B}</strong>, C=<strong>${C.toFixed(2)}</strong>, D=<strong>${D.toFixed(2)}</strong>`;
    }

    [alphaS, bS, cS, dS].forEach(s => s.addEventListener('input', render));
    render();
})();

// =============================================================================
// DEMO 2 — Weight transfer visualisation. Top-down car with four wheel-load
// circles. Button-driven (Throttle/Brake/Coast + Left/Right/Straight). Each
// wheel's circle area is proportional to the load on that wheel.
// =============================================================================
(function weightTransferDemo() {
    const canvas = document.getElementById('weightTransferCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('weightTransferCanvasInfo');

    let longi = 0;  // -1 = brake, +1 = throttle, 0 = coast
    let later = 0;  // -1 = turn left, +1 = turn right, 0 = straight
    // k_long and k_lat are the weight-shift coefficients from the section.
    const K_LONG = 0.30;
    const K_LAT  = 0.25;

    function setLongiButtons(id) {
        ['btnWtThrottle','btnWtBrake','btnWtCoast'].forEach(b => {
            document.getElementById(b)?.classList.toggle('active', b === id);
        });
    }
    function setLaterButtons(id) {
        ['btnWtSteerNone','btnWtSteerLeft','btnWtSteerRight'].forEach(b => {
            document.getElementById(b)?.classList.toggle('active', b === id);
        });
    }

    document.getElementById('btnWtThrottle')?.addEventListener('click', () => { longi = +1; setLongiButtons('btnWtThrottle'); });
    document.getElementById('btnWtBrake')   ?.addEventListener('click', () => { longi = -1; setLongiButtons('btnWtBrake'); });
    document.getElementById('btnWtCoast')   ?.addEventListener('click', () => { longi =  0; setLongiButtons('btnWtCoast'); });
    document.getElementById('btnWtSteerLeft') ?.addEventListener('click', () => { later = -1; setLaterButtons('btnWtSteerLeft'); });
    document.getElementById('btnWtSteerRight')?.addEventListener('click', () => { later = +1; setLaterButtons('btnWtSteerRight'); });
    document.getElementById('btnWtSteerNone') ?.addEventListener('click', () => { later =  0; setLaterButtons('btnWtSteerNone'); });

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Top-down car silhouette in the centre
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const carW = 110, carH = 70;
        ctx.fillStyle = RACING_COLORS.carBody;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath(); ctx.roundRect(cx - carW/2, cy - carH/2, carW, carH, 8); ctx.fill();
        } else ctx.fillRect(cx - carW/2, cy - carH/2, carW, carH);
        ctx.fillStyle = RACING_COLORS.carWindow;
        ctx.fillRect(cx + carW/2 - 35, cy - carH/2 + 8, 22, carH - 16);

        // Compute loads. Base 0.25 per wheel; transfer adjusts.
        //   longi:  +1 (throttle) shifts weight back; -1 (brake) shifts forward.
        //   later:  +1 (right)    shifts weight LEFT; -1 (left) shifts weight RIGHT.
        // (Centripetal acceleration points toward the corner's centre; the
        // car's inertia pushes the body outward, loading the outside tyres.)
        const front = 0.5 - K_LONG * longi;     // [0.2, 0.8]
        const rear  = 1 - front;
        const rightSide = 0.5 - K_LAT * later;  // when turning right, weight goes left → rightSide < 0.5
        const leftSide  = 1 - rightSide;
        const fl = front * leftSide;
        const fr = front * rightSide;
        const rl = rear  * leftSide;
        const rr = rear  * rightSide;

        // Wheel positions in screen space (car's local axes: +X = forward = right of screen)
        const wheelOffX = carW / 2 - 10;
        const wheelOffY = carH / 2 + 6;
        const wheels = {
            fl: { x: cx + wheelOffX, y: cy - wheelOffY, load: fl, label: 'FL' },
            fr: { x: cx + wheelOffX, y: cy + wheelOffY, load: fr, label: 'FR' },
            rl: { x: cx - wheelOffX, y: cy - wheelOffY, load: rl, label: 'RL' },
            rr: { x: cx - wheelOffX, y: cy + wheelOffY, load: rr, label: 'RR' }
        };

        // Wait — top-down + the windshield on the +X side means "front" is on the RIGHT of the
        // screen. So FL = "front left" = up-right corner; FR = "front right" = down-right corner;
        // RL = up-left, RR = down-left. The current mapping above puts FL/FR on the +X side and
        // RL/RR on the -X side — good. But "left/right" in vehicle terms is from the driver's
        // POV, looking forward (so left = +Y on a top-down sprite that points +X). Re-check:
        // car points +X. Driver looks +X. Driver's LEFT is +Y? No — driver's LEFT is -Y in
        // standard right-handed screen coords where +Y is *down*. So FL (driver's left front)
        // = up-and-right = (-Y, +X). In my mapping FL is `cy - wheelOffY` (above centre, so -Y)
        // and `cx + wheelOffX` (+X). Correct.

        for (const w of Object.values(wheels)) {
            const r = 8 + w.load * 50;   // base radius + load-proportional growth
            ctx.fillStyle = w.load > 0.30 ? RACING_COLORS.gripBad : (w.load > 0.20 ? RACING_COLORS.arrow : RACING_COLORS.gripGood);
            ctx.globalAlpha = 0.7;
            ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            // Label inside
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(w.label, w.x, w.y - r - 6);
            ctx.fillText(`${(w.load * 100).toFixed(0)}%`, w.x, w.y + 5);
        }
        ctx.textAlign = 'left';

        // Labels
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        const longiLabel = longi > 0 ? 'THROTTLE' : (longi < 0 ? 'BRAKE' : 'COAST');
        const laterLabel = later > 0 ? 'TURN RIGHT' : (later < 0 ? 'TURN LEFT' : 'STRAIGHT');
        ctx.fillText(`State: ${longiLabel} + ${laterLabel}`, 14, 26);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText(`Front car nose →`, cx + carW / 2 + 14, cy + 4);
        ctx.fillText('Larger circle = more weight on that wheel.', 14, canvas.height - 14);

        info.innerHTML = `${longiLabel} · ${laterLabel} &nbsp;|&nbsp; ` +
            `front <strong>${(front * 100).toFixed(0)}%</strong> / rear <strong>${(rear * 100).toFixed(0)}%</strong>, ` +
            `left <strong>${(leftSide * 100).toFixed(0)}%</strong> / right <strong>${(rightSide * 100).toFixed(0)}%</strong>`;
    }
    render();
    // Re-render on every state change (already triggered by button handlers — but
    // also wire a small frame loop so visual feedback feels live).
    startFrameLoop((dt) => render());
})();

// =============================================================================
// DEMO 3 — Race state machine + lights animation. Click "Start race" → lights
// sequence (3 red lights one per second, then all green), then auto-transition
// through RACING (5s) → FINISHED, then back to PRE_RACE on Reset.
// =============================================================================
(function raceStateMachineDemo() {
    const canvas = document.getElementById('raceStateMachineCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const STATES = ['PRE_RACE', 'COUNTDOWN', 'RACING', 'FINISHED'];
    let state = 'PRE_RACE';
    let stateEntered = performance.now();

    function setState(s) {
        state = s;
        stateEntered = performance.now();
        for (const [id, st] of [
            ['stateNodePre', 'PRE_RACE'],
            ['stateNodeCount', 'COUNTDOWN'],
            ['stateNodeRace', 'RACING'],
            ['stateNodeFinish', 'FINISHED']
        ]) {
            document.getElementById(id)?.classList.toggle('active', st === s);
        }
    }

    function render() {
        const tInState = (performance.now() - stateEntered) / 1000;

        // Auto-advance state machine.
        if (state === 'COUNTDOWN' && tInState >= 4) setState('RACING');
        else if (state === 'RACING' && tInState >= 5) setState('FINISHED');

        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Three light pods at the top.
        const lightY = 60;
        const lightRadius = 28;
        const podSpacing = 90;
        const podStartX = canvas.width / 2 - podSpacing;

        // Determine which lights are lit. Lights phase:
        //   0–1s: light 1 red
        //   1–2s: lights 1+2 red
        //   2–3s: all three red
        //   3–4s: all three green
        let redLit = 0, allGreen = false;
        if (state === 'COUNTDOWN') {
            if (tInState < 1)      redLit = 1;
            else if (tInState < 2) redLit = 2;
            else if (tInState < 3) redLit = 3;
            else                   allGreen = true;
        } else if (state === 'RACING' || state === 'FINISHED') {
            allGreen = true;
        }

        for (let i = 0; i < 3; i++) {
            const x = podStartX + i * podSpacing;
            // Pod background
            ctx.fillStyle = '#0d1117';
            ctx.beginPath(); ctx.arc(x, lightY, lightRadius + 4, 0, Math.PI * 2); ctx.fill();
            // Light
            let color = RACING_COLORS.lightDark;
            if (allGreen) color = RACING_COLORS.lightGreen;
            else if (i < redLit) color = RACING_COLORS.lightRed;
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(x, lightY, lightRadius, 0, Math.PI * 2); ctx.fill();
            // Glow when lit
            if (color !== RACING_COLORS.lightDark) {
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.35;
                ctx.lineWidth = 6;
                ctx.beginPath(); ctx.arc(x, lightY, lightRadius + 6, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // State label
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        const stateText = state === 'COUNTDOWN'
            ? (allGreen ? 'GO!' : `COUNTDOWN  (${redLit} red lights lit)`)
            : state;
        ctx.fillText(stateText, canvas.width / 2, 130);

        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText(`time in state: ${tInState.toFixed(2)}s`, canvas.width / 2, 158);
        ctx.textAlign = 'left';
    }

    startFrameLoop(() => render());

    document.getElementById('btnStateStart')?.addEventListener('click', () => {
        if (state === 'PRE_RACE' || state === 'FINISHED') setState('COUNTDOWN');
    });
    document.getElementById('btnStateReset')?.addEventListener('click', () => setState('PRE_RACE'));
})();

// =============================================================================
// DEMO 4 — Follow camera comparison. Drag the white "car". Three camera dots
// chase it: rigid (red), lerp (orange), lerp + lead (cyan). Smoothness and
// lead-time sliders.
// =============================================================================
(function followCameraDemo() {
    const canvas = document.getElementById('followCameraCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('followCameraCanvasInfo');
    const smoothS = document.getElementById('camSmooth');
    const leadS = document.getElementById('camLead');
    const smoothVal = document.getElementById('camSmoothVal');
    const leadVal = document.getElementById('camLeadVal');

    let car = { x: 200, y: 200, vx: 0, vy: 0 };
    let camRigid = { x: 200, y: 200 };
    let camLerp  = { x: 200, y: 200 };
    let camLead  = { x: 200, y: 200 };
    let dragging = false;
    let lastMouse = null;
    let lastMouseTime = performance.now();

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        if (Math.hypot(mx - car.x, my - car.y) < 30) { dragging = true; lastMouse = { x: mx, y: my }; lastMouseTime = performance.now(); }
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const r = canvas.getBoundingClientRect();
        const mx = clamp(e.clientX - r.left, 20, canvas.width - 20);
        const my = clamp(e.clientY - r.top,  20, canvas.height - 20);
        const now = performance.now();
        const dt = Math.max((now - lastMouseTime) / 1000, 1/240);
        car.vx = (mx - car.x) / dt;
        car.vy = (my - car.y) / dt;
        car.x = mx; car.y = my;
        lastMouseTime = now;
    });
    canvas.addEventListener('mouseup',   () => { dragging = false; car.vx = 0; car.vy = 0; });
    canvas.addEventListener('mouseleave',() => { dragging = false; car.vx = 0; car.vy = 0; });

    function step(dt) {
        const smoothness = parseFloat(smoothS.value);
        const leadTime   = parseFloat(leadS.value);
        smoothVal.textContent = smoothness.toFixed(1);
        leadVal.textContent   = leadTime.toFixed(2);

        // Rigid: snap.
        camRigid.x = car.x; camRigid.y = car.y;
        // Lerp: framerate-correct exponential smoothing.
        const k = 1 - Math.exp(-smoothness * dt);
        camLerp.x += (car.x - camLerp.x) * k;
        camLerp.y += (car.y - camLerp.y) * k;
        // Lerp + lead: target is car + velocity * leadTime.
        const targetX = car.x + car.vx * leadTime;
        const targetY = car.y + car.vy * leadTime;
        camLead.x += (targetX - camLead.x) * k;
        camLead.y += (targetY - camLead.y) * k;
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Grid
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = 40; x < canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 40; y < canvas.height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Each camera as a labelled circle.
        const drawCam = (c, color, label, dy) => {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = color;
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(label, c.x + 14, c.y + dy);
        };
        drawCam(camRigid, RACING_COLORS.camRigid, 'rigid', -4);
        drawCam(camLerp,  RACING_COLORS.camLerp,  'lerp', 10);
        drawCam(camLead,  RACING_COLORS.camLead,  'lerp+lead', 24);

        // Car (white)
        ctx.fillStyle = RACING_COLORS.camCar;
        ctx.beginPath(); ctx.arc(car.x, car.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();

        // Legend
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('Drag the white car. Watch the three camera flavours follow it.', 14, 22);
    }

    startFrameLoop((dt) => { step(dt); render(); });
})();

// =============================================================================
// DEMO 5 — Gamepad probe. Renders left-stick X, RT (throttle), LT (brake)
// as bars; status line shows pad name when connected.
// =============================================================================
(function gamepadProbeDemo() {
    const canvas = document.getElementById('gamepadProbeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('gamepadProbeCanvasInfo');

    function render() {
        const pad = readGamepad();
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Three horizontal bars: steer (centred), throttle (RT, right side), brake (LT, left side).
        const cx = canvas.width / 2;
        const barWidth = 360, barHeight = 30, gap = 40;
        const labelOffset = 18;

        // Steer bar (centred, swing both ways)
        const steerY = 60;
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - barWidth / 2, steerY, barWidth, barHeight);
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(cx, steerY); ctx.lineTo(cx, steerY + barHeight); ctx.stroke();
        ctx.setLineDash([]);
        const steerFill = pad.rawSteer * (barWidth / 2);
        ctx.fillStyle = RACING_COLORS.stickAxis;
        ctx.fillRect(cx, steerY + 4, steerFill, barHeight - 8);
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`Left stick X: ${pad.rawSteer.toFixed(2)}`, cx - barWidth / 2, steerY - 10);

        // Throttle bar (RT, fills right)
        const throttleY = steerY + barHeight + gap;
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.strokeRect(cx - barWidth / 2, throttleY, barWidth, barHeight);
        ctx.fillStyle = RACING_COLORS.triggerRight;
        ctx.fillRect(cx - barWidth / 2 + 2, throttleY + 4, (barWidth - 4) * pad.throttleRaw, barHeight - 8);
        ctx.fillStyle = RACING_COLORS.label;
        ctx.fillText(`Right trigger (throttle): ${pad.throttleRaw.toFixed(2)}`, cx - barWidth / 2, throttleY - 10);

        // Brake bar (LT)
        const brakeY = throttleY + barHeight + gap;
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.strokeRect(cx - barWidth / 2, brakeY, barWidth, barHeight);
        ctx.fillStyle = RACING_COLORS.triggerLeft;
        ctx.fillRect(cx - barWidth / 2 + 2, brakeY + 4, (barWidth - 4) * pad.brakeRaw, barHeight - 8);
        ctx.fillStyle = RACING_COLORS.label;
        ctx.fillText(`Left trigger (brake): ${pad.brakeRaw.toFixed(2)}`, cx - barWidth / 2, brakeY - 10);

        info.innerHTML = pad.connected
            ? `🎮 Connected: <strong>${pad.name}</strong>`
            : 'No gamepad detected yet. Plug one in and press a button.';
    }
    startFrameLoop(() => render());
})();

// =============================================================================
// DEMO 6 — Hot-lap with telemetry. The capstone of the Expert tier.
// Race state machine + follow camera (lerp+lead) + Pacejka integrator +
// gamepad-or-keyboard input + telemetry HUD (current/last/best lap times,
// slip-angle, brake/throttle bars). 3-lap race.
// =============================================================================
(function hotLapDemo() {
    const canvas = document.getElementById('hotLapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('hotLapCanvasInfo');

    // World — bigger than the canvas; the camera scrolls. We render in world
    // coordinates with a translate.
    const WORLD_W = 1500, WORLD_H = 950;
    const track = makeOvalTrack(WORLD_W / 2, WORLD_H / 2, 580, 320, 60, 28, 8);
    const SURFACE = { name: 'Race tarmac', rollingDrag: 0.42, gripLimit: 1400 };

    // Skid layer in world coords (same size as world, not canvas).
    const skid = document.createElement('canvas');
    skid.width = WORLD_W; skid.height = WORLD_H;
    const skidCtx = skid.getContext('2d');

    // Car
    const sp0 = track.centerline[0];
    const sp1 = track.centerline[1];
    const startHeading = Math.atan2(sp1.y - sp0.y, sp1.x - sp0.x);
    const car = new Car(sp0.x, sp0.y, startHeading);

    // Camera (world coordinates of what the canvas centre is showing)
    const cam = { x: car.position.x, y: car.position.y };

    // State machine
    let state = 'PRE_RACE';
    let stateEntered = performance.now();
    function setState(s) { state = s; stateEntered = performance.now(); }
    function tInState() { return (performance.now() - stateEntered) / 1000; }

    // Race state
    const TOTAL_LAPS = 3;
    let lap = 0;          // completed laps
    let nextCp = 1;
    let lapStartTime = 0;
    let lastLapTime = null;
    let bestLapTime = null;
    let currentLapTime = 0;

    const readInput = attachKeyInputs(canvas);

    function reset() {
        car.reset(sp0.x, sp0.y, startHeading);
        skidCtx.clearRect(0, 0, skid.width, skid.height);
        lap = 0; nextCp = 1;
        lapStartTime = 0; lastLapTime = null; bestLapTime = null; currentLapTime = 0;
        cam.x = car.position.x; cam.y = car.position.y;
        setState('PRE_RACE');
    }

    function startRace() {
        if (state === 'PRE_RACE' || state === 'FINISHED') {
            reset();
            setState('COUNTDOWN');
        }
    }

    function step(dt) {
        // Read input always (so the HUD can show steering even during countdown).
        const pad = readGamepad();
        const key = readInput();
        const usingPad = pad.connected && (Math.abs(pad.rawSteer) > 0.05 || pad.throttleRaw > 0.05 || pad.brakeRaw > 0.05);
        document.getElementById('hotInputMode').textContent = usingPad ? `gamepad (${pad.name?.slice(0, 24)}…)` : 'keyboard';
        let throttle = usingPad ? pad.throttle : key.throttle;
        let steer    = usingPad ? pad.steer    : key.steer;

        // Lock input until RACING begins. After FINISHED, also lock.
        if (state !== 'RACING') { throttle = 0; steer = 0; }

        // State transitions
        if (state === 'COUNTDOWN' && tInState() >= 4) {
            setState('RACING');
            lapStartTime = performance.now();
        }
        if (state === 'RACING') {
            currentLapTime = (performance.now() - lapStartTime) / 1000;
        }

        // Integrate, collide, lap-count
        integrateWithPacejka(car, throttle, steer, dt, SURFACE);
        collideCarWithPolyline(car, track.walls.left);
        collideCarWithPolyline(car, track.walls.right);
        if (state === 'RACING') {
            const prevNext = nextCp;
            const r = tickCheckpoints(car.prevPosition, car.position, track.checkpoints, nextCp, lap);
            nextCp = r.next;
            // Detect a lap completion as next wrapping back to 0.
            if (r.laps !== lap) {
                lap = r.laps;
                lastLapTime = currentLapTime;
                if (bestLapTime === null || lastLapTime < bestLapTime) bestLapTime = lastLapTime;
                lapStartTime = performance.now();
                currentLapTime = 0;
                if (lap >= TOTAL_LAPS) setState('FINISHED');
            }
        }

        // Camera target: car position + velocity * leadTime, smoothed.
        const leadTime = 0.28;
        const targetX = car.position.x + car.velocity.x * leadTime;
        const targetY = car.position.y + car.velocity.y * leadTime;
        const k = 1 - Math.exp(-4 * dt);
        cam.x += (targetX - cam.x) * k;
        cam.y += (targetY - cam.y) * k;

        // Skid marks while sliding
        if (!car.gripping && state === 'RACING') {
            const wheels = rearWheelWorldPositions(car);
            skidCtx.fillStyle = RACING_COLORS.skidMark;
            for (const p of wheels) {
                skidCtx.beginPath(); skidCtx.arc(p.x, p.y, 2.1, 0, Math.PI * 2); skidCtx.fill();
            }
        }
    }

    function renderWorld() {
        // Background
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // World-to-canvas translate so cam is at canvas centre.
        ctx.save();
        ctx.translate(canvas.width / 2 - cam.x, canvas.height / 2 - cam.y);

        // Track ribbon
        ctx.fillStyle = RACING_COLORS.trackSurface;
        ctx.beginPath();
        ctx.moveTo(track.walls.left[0].x, track.walls.left[0].y);
        for (const p of track.walls.left)  ctx.lineTo(p.x, p.y);
        for (let i = track.walls.right.length - 1; i >= 0; i--) ctx.lineTo(track.walls.right[i].x, track.walls.right[i].y);
        ctx.closePath();
        ctx.fill();

        // Skid layer composited at world (0,0).
        ctx.drawImage(skid, 0, 0);

        // Centerline (dashed)
        ctx.strokeStyle = RACING_COLORS.centerline;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(track.centerline[0].x, track.centerline[0].y);
        for (let i = 1; i < track.centerline.length; i++) ctx.lineTo(track.centerline[i].x, track.centerline[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // Walls
        ctx.strokeStyle = RACING_COLORS.wall;
        ctx.lineWidth = 3;
        for (const poly of [track.walls.left, track.walls.right]) {
            ctx.beginPath();
            ctx.moveTo(poly[0].x, poly[0].y);
            for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
            ctx.closePath();
            ctx.stroke();
        }

        // Start line
        const start = track.checkpoints[0];
        ctx.strokeStyle = RACING_COLORS.startLine;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(start.a.x, start.a.y); ctx.lineTo(start.b.x, start.b.y);
        ctx.stroke();

        // Car
        drawCarSprite(ctx, car, { w: 32, h: 16 });

        ctx.restore();
    }

    function renderHud() {
        // Overlay HUD on the canvas (screen-space, not world).
        // Brake / throttle bars on the right side.
        const pad = readGamepad();
        const key = readInput();
        const usingPad = pad.connected && (Math.abs(pad.rawSteer) > 0.05 || pad.throttleRaw > 0.05 || pad.brakeRaw > 0.05);
        const throttle = usingPad ? pad.throttle : key.throttle;

        const barX = canvas.width - 36;
        const barY = 60, barH = 200, barW = 16;
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(barX, barY, barW, barH);
        // Throttle (top half, green up); brake (bottom half, red down)
        if (throttle >= 0) {
            const h = throttle * (barH / 2);
            ctx.fillStyle = RACING_COLORS.gripGood;
            ctx.fillRect(barX, barY + barH / 2 - h, barW, h);
        } else {
            const h = -throttle * (barH / 2);
            ctx.fillStyle = RACING_COLORS.gripBad;
            ctx.fillRect(barX, barY + barH / 2, barW, h);
        }
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.beginPath();
        ctx.moveTo(barX, barY + barH / 2); ctx.lineTo(barX + barW, barY + barH / 2);
        ctx.stroke();
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('THR', barX - 4, barY + 12);
        ctx.fillText('BRK', barX - 4, barY + barH);
        ctx.textAlign = 'left';

        // Speed + lap indicator top-left
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`SPEED ${car.speed.toFixed(0)} px/s`, 14, 28);
        ctx.fillText(`LAP   ${lap} / ${TOTAL_LAPS}`, 14, 50);

        // State overlay (countdown lights or finished banner)
        if (state === 'COUNTDOWN' || state === 'PRE_RACE') {
            const t = tInState();
            const allGreen = state === 'COUNTDOWN' && t >= 3 && t < 4;
            let redLit = 0;
            if (state === 'COUNTDOWN') {
                if (t < 1) redLit = 1;
                else if (t < 2) redLit = 2;
                else if (t < 3) redLit = 3;
            }
            const lightY = canvas.height / 2 - 80;
            const podSpacing = 70;
            const podStartX = canvas.width / 2 - podSpacing;
            const lightRadius = 22;
            for (let i = 0; i < 3; i++) {
                const x = podStartX + i * podSpacing;
                ctx.fillStyle = '#0d1117';
                ctx.beginPath(); ctx.arc(x, lightY, lightRadius + 4, 0, Math.PI * 2); ctx.fill();
                let color = RACING_COLORS.lightDark;
                if (allGreen) color = RACING_COLORS.lightGreen;
                else if (i < redLit) color = RACING_COLORS.lightRed;
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(x, lightY, lightRadius, 0, Math.PI * 2); ctx.fill();
            }
            // Big state text
            ctx.fillStyle = RACING_COLORS.label;
            ctx.font = 'bold 26px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(allGreen ? 'GO!' : (state === 'COUNTDOWN' ? 'GET READY' : 'PRESS ▶ START RACE'), canvas.width / 2, lightY + 70);
            ctx.textAlign = 'left';
        } else if (state === 'FINISHED') {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);
            ctx.fillStyle = RACING_COLORS.lightGreen;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🏁 RACE COMPLETE', canvas.width / 2, canvas.height / 2 - 8);
            ctx.fillStyle = RACING_COLORS.label;
            ctx.font = 'bold 18px monospace';
            ctx.fillText(`best lap: ${formatLap(bestLapTime)}`, canvas.width / 2, canvas.height / 2 + 30);
            ctx.textAlign = 'left';
        }
    }

    function formatLap(seconds) {
        if (seconds === null || seconds === undefined) return '--:--.---';
        const m = Math.floor(seconds / 60);
        const s = (seconds - m * 60).toFixed(3);
        return `${m}:${s.padStart(6, '0')}`;
    }

    function updateHudEls() {
        document.getElementById('hotState').textContent =
            state === 'COUNTDOWN' ? 'COUNTDOWN' :
            state === 'RACING'    ? 'RACING'    :
            state === 'FINISHED'  ? 'FINISHED'  : 'PRE-RACE';
        document.getElementById('hotCurrent').textContent = formatLap(currentLapTime);
        document.getElementById('hotLast').textContent    = formatLap(lastLapTime);
        const bestEl = document.getElementById('hotBest');
        bestEl.textContent = formatLap(bestLapTime);
        bestEl.parentElement.classList.toggle('best', bestLapTime !== null);
        document.getElementById('hotSlip').textContent =
            `${(car.lastSlipAlpha * 180 / Math.PI).toFixed(1)}°`;
    }

    startFrameLoop((dt) => {
        step(dt);
        renderWorld();
        renderHud();
        updateHudEls();
    });

    document.getElementById('btnHotStart')?.addEventListener('click', startRace);
    document.getElementById('btnHotReset')?.addEventListener('click', reset);
})();
