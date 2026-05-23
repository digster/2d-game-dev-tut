// =============================================================================
// RACING-SIM — ADVANCED TIER DEMOS
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak. Each runs only
// if its target canvas exists — same safety rail as Beginner/Intermediate.
//
// UNITS (same as the previous tiers — never diverge):
//   position         pixels
//   velocity         px/s
//   heading          radians (0 = +X = "right")
//   angular velocity rad/s
//   acceleration     px/s²
//   rollingDrag      1/s
//   gripLimit        px/s²
//
// THE BIG CONCEPTUAL ADD:
//   This tier introduces the **track as data** — a centerline (array of
//   sampled points along the middle of the road) plus an inflation step that
//   produces left/right wall segments. All three tier features (walls, lap
//   checkpoints, AI driving) feed off that one data structure.
//
// REUSES FROM shared/utils.js (do NOT redeclare):
//   `Vector2D`, `Vector2D.reflect(normal)`, `lineIntersection(p1,p2,p3,p4)`,
//   `clamp`, `lerp`.
//
// As in the Intermediate tier, `RACING_COLORS` and `Car` are top-level here
// with the same names as in beginner/intermediate-demos.js. Each tier page
// only loads its own demos file; the redeclaration is safe and keeps the
// source readable as one consistent track.
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
// Palette — Advanced gets two more entries (track tarmac/border) for the
// race demo's surface look. Otherwise identical to Intermediate.
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
    trackSurface: '#2b313c',    // the drivable asphalt strip
    trackBorder:  '#fbc02d',    // yellow track edges
    centerline:   '#90a4ae',    // dashed centerline
    checkpoint:   '#7e57c2',    // inactive checkpoint
    checkpointHit:'#66bb6a',    // checkpoint that's been crossed this lap
    startLine:    '#ffffff',
    aiLook:       '#26c6da',    // AI lookahead target dot
    wall:         '#fbc02d',    // wall segments
    impact:       '#ff7043',    // collision impact marker
    normal:       '#26c6da'     // normal vector at impact
};

// ---------------------------------------------------------------------------
// Car class — strict superset of Intermediate's. Adds `radius` (used by the
// wall-collision and race demos) and a `prevPosition` snapshot used for the
// checkpoint-crossing test (we need where we were last frame, not where
// integrate started this frame, to detect the crossing).
// ---------------------------------------------------------------------------
class Car {
    constructor(x = 0, y = 0, heading = 0, radius = 11) {
        this.position = new Vector2D(x, y);
        this.velocity = new Vector2D(0, 0);
        this.heading  = heading;
        this.radius   = radius;
        this.prevPosition = new Vector2D(x, y);
        this.lastVForward = 0;
        this.lastVLateral = 0;
        this.gripping     = true;
    }
    get speed() { return this.velocity.length(); }
    reset(x, y, heading = 0) {
        this.position.x = x; this.position.y = y;
        this.prevPosition.x = x; this.prevPosition.y = y;
        this.velocity.x = 0; this.velocity.y = 0;
        this.heading = heading;
        this.lastVForward = 0; this.lastVLateral = 0; this.gripping = true;
    }
}

// ---------------------------------------------------------------------------
// Tunables — slightly tuned for the bigger race canvas (more room to breathe).
// ---------------------------------------------------------------------------
const MAX_SPEED      = 340;
const MAX_ACCEL      = 280;
const MAX_STEER_RATE = 2.7;
const MAX_DT         = 0.05;

// Surface for the race track (matches the Intermediate tarmac roughly).
const RACE_SURFACE = { name: 'Race tarmac', rollingDrag: 0.45, gripLimit: 540 };

// ---------------------------------------------------------------------------
// `integrateWithGrip` — copied verbatim from the Intermediate tier. We keep
// every later tier's integrator self-contained inside its own demos file so
// each tier reads as a single source-of-truth.
// ---------------------------------------------------------------------------
function integrateWithGrip(car, throttle, steer, dt, surface) {
    car.prevPosition.x = car.position.x;
    car.prevPosition.y = car.position.y;

    const steerScale = clamp(car.speed / 30, 0, 1);
    car.heading += steer * MAX_STEER_RATE * steerScale * dt;

    const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
    const lx = -fy,                   ly = fx;
    let vForward = car.velocity.x * fx + car.velocity.y * fy;
    let vLateral = car.velocity.x * lx + car.velocity.y * ly;

    vForward += throttle * MAX_ACCEL * dt;
    vForward *= (1 - surface.rollingDrag * dt);

    const maxKill = surface.gripLimit * dt;
    let gripping;
    if (Math.abs(vLateral) <= maxKill) { vLateral = 0; gripping = true; }
    else { vLateral -= Math.sign(vLateral) * maxKill; gripping = false; }

    car.velocity.x = fx * vForward + lx * vLateral;
    car.velocity.y = fy * vForward + ly * vLateral;
    car.position.x += car.velocity.x * dt;
    car.position.y += car.velocity.y * dt;

    const sp = car.velocity.length();
    if (sp > MAX_SPEED) car.velocity.multiply(MAX_SPEED / sp);

    car.lastVForward = vForward;
    car.lastVLateral = vLateral;
    car.gripping = gripping;
}

// ---------------------------------------------------------------------------
// Bézier + track helpers used by demo 1 and demo 5.
// ---------------------------------------------------------------------------
function sampleCubic(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = i / n;
        const u = 1 - t;
        out.push({
            x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
            y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y
        });
    }
    return out;
}

function buildCenterline(segments, samplesPerSegment = 64) {
    const points = [];
    for (const s of segments) {
        points.push(...sampleCubic(s.p0, s.p1, s.p2, s.p3, samplesPerSegment));
    }
    return points;
}

function inflateWalls(centerline, halfWidth) {
    const left = [], right = [];
    const n = centerline.length;
    for (let i = 0; i < n; i++) {
        const a = centerline[i];
        const b = centerline[(i + 1) % n];
        const tx = b.x - a.x, ty = b.y - a.y;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;
        left.push({  x: a.x + nx * halfWidth, y: a.y + ny * halfWidth });
        right.push({ x: a.x - nx * halfWidth, y: a.y - ny * halfWidth });
    }
    return { left, right };
}

// Build checkpoint segments — perpendicular line segments across the
// centerline at evenly spaced indices. Each is `{ a, b, index }`.
function buildCheckpoints(centerline, halfWidth, count) {
    const out = [];
    const step = Math.floor(centerline.length / count);
    for (let i = 0; i < count; i++) {
        const idx = i * step;
        const a = centerline[idx];
        const b = centerline[(idx + 1) % centerline.length];
        const tx = b.x - a.x, ty = b.y - a.y;
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;
        out.push({
            a:     { x: a.x + nx * halfWidth, y: a.y + ny * halfWidth },
            b:     { x: a.x - nx * halfWidth, y: a.y - ny * halfWidth },
            center:{ x: a.x,                  y: a.y },
            index: idx
        });
    }
    return out;
}

// ---------------------------------------------------------------------------
// Wall collision helpers — shared by demos 2 and 5.
// ---------------------------------------------------------------------------
function closestPointOnSegment(c, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const denom = dx * dx + dy * dy;
    if (denom === 0) return { x: a.x, y: a.y, t: 0 };
    let t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / denom;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * dx, y: a.y + t * dy, t };
}

// Resolve a single car-vs-segment collision. Mutates car.position and
// car.velocity. Returns the impact info (or null if no collision).
function collideCarWithWall(car, a, b, bounceDamping = 0.35) {
    const closest = closestPointOnSegment(car.position, a, b);
    const dx = car.position.x - closest.x;
    const dy = car.position.y - closest.y;
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

// Resolve collisions against *all* wall segments in a polyline. Loops until
// no further collision is found, capped at a few iterations so we never spin.
function collideCarWithPolyline(car, polyline, bounceDamping = 0.35) {
    let impact = null;
    for (let iter = 0; iter < 4; iter++) {
        let collided = false;
        const n = polyline.length;
        for (let i = 0; i < n; i++) {
            const a = polyline[i];
            const b = polyline[(i + 1) % n];
            const r = collideCarWithWall(car, a, b, bounceDamping);
            if (r) { impact = r; collided = true; }
        }
        if (!collided) break;
    }
    return impact;
}

// ---------------------------------------------------------------------------
// Lap counting via ordered checkpoints. Returns updated { next, laps }.
// ---------------------------------------------------------------------------
function tickCheckpoints(prevPos, currPos, checkpoints, next, laps) {
    const cp = checkpoints[next];
    if (lineIntersection(prevPos, currPos, cp.a, cp.b)) {
        next = (next + 1) % checkpoints.length;
        if (next === 0) laps += 1;
    }
    return { next, laps };
}

// ---------------------------------------------------------------------------
// AI driver loop (look-ahead seek along the centerline).
//
// Tuning notes: lookahead is the single most sensitive number. Too short →
// the AI swerves twitchily. Too long → on tight tracks the line-of-sight to
// the look-ahead target leaves the track surface and the AI corner-cuts
// into the outer wall (then bounces, then bounces again, then never
// recovers). For this tier's oval (~110 samples around) a lookahead of 8
// keeps the AI on-line. Throttle floor of 0.45 prevents wall-bounce
// death-spirals where the AI keeps losing velocity faster than it gains.
// ---------------------------------------------------------------------------
function aiDrive(car, centerline, currentIndex, lookahead = 8) {
    const cur = centerline[currentIndex];
    const distCur = Math.hypot(car.position.x - cur.x, car.position.y - cur.y);
    if (distCur < 36) currentIndex = (currentIndex + 1) % centerline.length;

    const targetIdx = (currentIndex + lookahead) % centerline.length;
    const target = centerline[targetIdx];
    const desired = Math.atan2(target.y - car.position.y, target.x - car.position.x);

    let diff = desired - car.heading;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const steer = clamp(diff * 1.7, -1, 1);
    const throttle = clamp(0.9 - Math.abs(steer) * 0.2, 0.45, 1);
    return { throttle, steer, currentIndex, target };
}

// ---------------------------------------------------------------------------
// Sprite + input helpers (same as Intermediate, minor tweaks).
// ---------------------------------------------------------------------------
function drawCarSprite(ctx, car, opts = {}) {
    const w = opts.w || 28;
    const h = opts.h || 14;
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

function rearWheelWorldPositions(car, w = 28, h = 14) {
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

// Helper to build a default-shaped oval track centered on (cx, cy).
// Returns { segments, centerline, walls:{left,right}, checkpoints, startIdx }.
// Used by demo 1 (Bézier showcase) and demo 5 (race).
function makeOvalTrack(cx, cy, rx, ry, halfWidth, samplesPerSeg = 64, checkpointCount = 6) {
    // Cubic Bézier circle approximation constant — 4/3 * tan(π/8) ≈ 0.5523.
    const K = 0.5523;
    // Four cubic quarters going clockwise from the right of the oval.
    const right = { x: cx + rx, y: cy };
    const bottom= { x: cx,      y: cy + ry };
    const left  = { x: cx - rx, y: cy };
    const top   = { x: cx,      y: cy - ry };
    const segments = [
        // right → bottom (control points lift down then right toward bottom)
        { p0: right,  p1: { x: cx + rx, y: cy + ry * K }, p2: { x: cx + rx * K, y: cy + ry }, p3: bottom },
        // bottom → left
        { p0: bottom, p1: { x: cx - rx * K, y: cy + ry }, p2: { x: cx - rx, y: cy + ry * K }, p3: left },
        // left → top
        { p0: left,   p1: { x: cx - rx, y: cy - ry * K }, p2: { x: cx - rx * K, y: cy - ry }, p3: top },
        // top → right
        { p0: top,    p1: { x: cx + rx * K, y: cy - ry }, p2: { x: cx + rx, y: cy - ry * K }, p3: right }
    ];
    const centerline = buildCenterline(segments, samplesPerSeg);
    const walls = inflateWalls(centerline, halfWidth);
    const checkpoints = buildCheckpoints(centerline, halfWidth, checkpointCount);
    return { segments, centerline, walls, checkpoints, startIdx: 0 };
}

// =============================================================================
// DEMO 1 — Bézier track. Four cubic Béziers chained into a closed oval.
// Drag any orange control point to deform. Toggle walls / samples / handles.
// =============================================================================
(function bezierTrackDemo() {
    const canvas = document.getElementById('bezierTrackCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('bezierTrackCanvasInfo');

    // Default oval segments. We'll deform by editing these in place.
    const defaultTrack = () => {
        const t = makeOvalTrack(canvas.width / 2, canvas.height / 2, 280, 160, 38, 24, 6);
        return t.segments;
    };
    let segments = defaultTrack();
    let showWalls   = true;
    let showSamples = false;
    let showHandles = true;
    let dragging    = null;   // { segIdx, pointKey }

    function recompute() {
        const centerline = buildCenterline(segments, 24);
        const walls = inflateWalls(centerline, 38);
        return { centerline, walls };
    }

    function pickHandle(mx, my) {
        // Each segment has 4 control points (p0, p1, p2, p3). To avoid
        // double-dragging shared endpoints we let the *first* segment own
        // its p0 (and not other segments' p0/p3 mirrors).
        const R = 9;
        for (let s = 0; s < segments.length; s++) {
            for (const key of ['p1', 'p2']) {  // only intermediate handles
                const p = segments[s][key];
                if (Math.hypot(mx - p.x, my - p.y) < R + 4) return { segIdx: s, pointKey: key };
            }
            // Anchors (p0) — only treat p0 of seg 0 as primary; the rest are
            // duplicates of the previous seg's p3.
            const p0 = segments[s].p0;
            if (Math.hypot(mx - p0.x, my - p0.y) < R + 4) return { segIdx: s, pointKey: 'p0' };
        }
        return null;
    }

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        dragging = pickHandle(e.clientX - r.left, e.clientY - r.top);
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const r = canvas.getBoundingClientRect();
        const mx = clamp(e.clientX - r.left,  20, canvas.width - 20);
        const my = clamp(e.clientY - r.top,   20, canvas.height - 20);
        const target = segments[dragging.segIdx][dragging.pointKey];
        const dx = mx - target.x, dy = my - target.y;
        target.x = mx; target.y = my;
        // If we dragged an anchor (p0), the previous segment's p3 must match.
        // This keeps the track closed.
        if (dragging.pointKey === 'p0') {
            const prev = (dragging.segIdx - 1 + segments.length) % segments.length;
            segments[prev].p3 = { x: mx, y: my };
        }
        render();
    });
    canvas.addEventListener('mouseup',   () => { dragging = null; });
    canvas.addEventListener('mouseleave',() => { dragging = null; });

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const { centerline, walls } = recompute();

        // Walls
        if (showWalls) {
            ctx.strokeStyle = RACING_COLORS.wall;
            ctx.lineWidth = 2.5;
            for (const poly of [walls.left, walls.right]) {
                ctx.beginPath();
                ctx.moveTo(poly[0].x, poly[0].y);
                for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
                ctx.closePath();
                ctx.stroke();
            }
        }

        // Centerline (dashed)
        ctx.strokeStyle = RACING_COLORS.centerline;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(centerline[0].x, centerline[0].y);
        for (let i = 1; i < centerline.length; i++) ctx.lineTo(centerline[i].x, centerline[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // Sample dots
        if (showSamples) {
            ctx.fillStyle = RACING_COLORS.gridStrong;
            for (const p of centerline) {
                ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
            }
        }

        // Control polygons + handle dots
        if (showHandles) {
            ctx.strokeStyle = RACING_COLORS.arrowSoft;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            for (const s of segments) {
                ctx.beginPath();
                ctx.moveTo(s.p0.x, s.p0.y);
                ctx.lineTo(s.p1.x, s.p1.y);
                ctx.lineTo(s.p2.x, s.p2.y);
                ctx.lineTo(s.p3.x, s.p3.y);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            for (const s of segments) {
                for (const [key, p] of Object.entries(s)) {
                    // Skip drawing p3 — it's identical to the next seg's p0.
                    if (key === 'p3') continue;
                    const isAnchor = (key === 'p0');
                    ctx.fillStyle = isAnchor ? RACING_COLORS.gripGood : RACING_COLORS.arrow;
                    ctx.beginPath(); ctx.arc(p.x, p.y, isAnchor ? 7 : 6, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            }
        }

        // Legend
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`${segments.length} cubic Béziers · ${centerline.length} samples`, 14, 22);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('Drag orange handles (or green anchors) to deform.', 14, canvas.height - 14);
    }

    function toggle(buttonId, set) {
        const btn = document.getElementById(buttonId);
        btn?.classList.toggle('active', set);
    }

    document.getElementById('btnBezToggleWalls')?.addEventListener('click', () => {
        showWalls = !showWalls; toggle('btnBezToggleWalls', showWalls); render();
    });
    document.getElementById('btnBezToggleSamples')?.addEventListener('click', () => {
        showSamples = !showSamples; toggle('btnBezToggleSamples', showSamples); render();
    });
    document.getElementById('btnBezToggleHandles')?.addEventListener('click', () => {
        showHandles = !showHandles; toggle('btnBezToggleHandles', showHandles); render();
    });
    document.getElementById('btnBezReset')?.addEventListener('click', () => {
        segments = defaultTrack(); render();
        info.textContent = 'Default 4-segment oval restored.';
    });

    render();
})();

// =============================================================================
// DEMO 2 — Wall collision & bounce. The user drags the cyan dot to aim
// (start position + launch velocity); release to launch. A "puck" car
// (rendered as a small circle, no heading-relevant sprite) slides and
// bounces off three walls. Trail shows the path; the latest impact shows
// the wall normal and reflected velocity.
// =============================================================================
(function wallCollisionDemo() {
    const canvas = document.getElementById('wallCollisionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('wallCollisionCanvasInfo');

    // Three walls forming a U-shape with a slanted top wall to make bounces
    // visually interesting.
    const walls = [
        { a: { x: 80,  y: 60  }, b: { x: 720, y: 110 } },   // top, slightly slanted
        { a: { x: 720, y: 110 }, b: { x: 720, y: 360 } },   // right
        { a: { x: 80,  y: 360 }, b: { x: 80,  y: 60  } }    // left
    ];

    const start = { x: 400, y: 280 };
    // The "car" here is a simplified actor — only position+velocity+radius
    // matter for collision (heading is unused since we draw a circle).
    const puck = {
        position: new Vector2D(start.x, start.y),
        velocity: new Vector2D(0, 0),
        radius: 14
    };
    // Trail of recent positions for the visual.
    let trail = [];
    const TRAIL_MAX = 600;
    // Latest impact info for the normal/reflected arrows.
    let lastImpact = null;
    let lastReflectedDir = null;
    // Aiming state
    let aiming = false;
    let aimTip = { x: start.x + 160, y: start.y - 90 };
    let launched = false;

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        // Begin aiming if click is near the puck (or anywhere when stopped).
        if (Math.hypot(mx - puck.position.x, my - puck.position.y) < 40 || puck.velocity.length() < 1) {
            aiming = true;
            launched = false;
            aimTip.x = mx; aimTip.y = my;
        }
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!aiming) return;
        const r = canvas.getBoundingClientRect();
        aimTip.x = clamp(e.clientX - r.left, 20, canvas.width - 20);
        aimTip.y = clamp(e.clientY - r.top,  20, canvas.height - 20);
    });
    canvas.addEventListener('mouseup',   () => {
        if (!aiming) return;
        aiming = false;
        // Launch — velocity in the direction from puck to aimTip, magnitude
        // proportional to the drag distance.
        const dx = aimTip.x - puck.position.x;
        const dy = aimTip.y - puck.position.y;
        const len = Math.hypot(dx, dy);
        if (len < 5) return;
        // Scale: 1px of drag = 2 px/s, capped.
        const speed = Math.min(len * 2, 480);
        puck.velocity.x = (dx / len) * speed;
        puck.velocity.y = (dy / len) * speed;
        launched = true;
        lastImpact = null;
        lastReflectedDir = null;
    });
    canvas.addEventListener('mouseleave', () => { aiming = false; });

    function step(dt) {
        if (!launched) return;
        // Mild rolling drag so the puck eventually stops.
        puck.velocity.multiply(1 - 0.6 * dt);
        puck.position.x += puck.velocity.x * dt;
        puck.position.y += puck.velocity.y * dt;
        // Test all walls; resolve any collisions; keep the latest impact for display.
        for (const w of walls) {
            const r = collideCarWithWall(puck, w.a, w.b, 0.75);
            if (r) {
                lastImpact = r;
                // Snapshot the post-bounce velocity direction so we can draw it.
                const sp = puck.velocity.length();
                if (sp > 1) lastReflectedDir = { x: puck.velocity.x / sp, y: puck.velocity.y / sp };
            }
        }
        trail.push({ x: puck.position.x, y: puck.position.y });
        if (trail.length > TRAIL_MAX) trail.shift();
        if (puck.velocity.length() < 4) launched = false;
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

        // Walls
        ctx.strokeStyle = RACING_COLORS.wall;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (const w of walls) {
            ctx.beginPath();
            ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y);
            ctx.stroke();
        }
        ctx.lineCap = 'butt';

        // Trail
        if (trail.length > 1) {
            ctx.strokeStyle = 'rgba(102, 187, 106, 0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
        }

        // Impact + normal + reflected velocity arrows
        if (lastImpact) {
            // Impact dot
            ctx.fillStyle = RACING_COLORS.impact;
            ctx.beginPath(); ctx.arc(lastImpact.x, lastImpact.y, 5, 0, Math.PI * 2); ctx.fill();
            // Normal arrow (cyan)
            drawArrow(ctx,
                lastImpact.x, lastImpact.y,
                lastImpact.x + lastImpact.nx * 60, lastImpact.y + lastImpact.ny * 60,
                RACING_COLORS.normal, 2.5);
            // Reflected velocity arrow (orange) — only if we have post-bounce speed
            if (lastReflectedDir) {
                drawArrow(ctx,
                    lastImpact.x, lastImpact.y,
                    lastImpact.x + lastReflectedDir.x * 80,
                    lastImpact.y + lastReflectedDir.y * 80,
                    RACING_COLORS.arrow, 2.5);
            }
        }

        // Puck
        ctx.fillStyle = RACING_COLORS.carBody;
        ctx.beginPath(); ctx.arc(puck.position.x, puck.position.y, puck.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

        // Aiming line
        if (aiming) {
            ctx.strokeStyle = RACING_COLORS.arrowLat;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(puck.position.x, puck.position.y);
            ctx.lineTo(aimTip.x, aimTip.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = RACING_COLORS.arrowLat;
            ctx.beginPath(); ctx.arc(aimTip.x, aimTip.y, 6, 0, Math.PI * 2); ctx.fill();
        }

        // Legend
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`speed: ${puck.velocity.length().toFixed(0)} px/s`, 14, 22);
        ctx.fillStyle = RACING_COLORS.normal;
        ctx.font = '12px sans-serif';
        ctx.fillText('cyan = wall normal at impact', 14, canvas.height - 32);
        ctx.fillStyle = RACING_COLORS.arrow;
        ctx.fillText('orange = reflected velocity direction', 14, canvas.height - 14);
    }

    startFrameLoop((dt) => { step(dt); render(); });

    document.getElementById('btnWallReset')?.addEventListener('click', () => {
        puck.position.x = start.x; puck.position.y = start.y;
        puck.velocity.x = 0; puck.velocity.y = 0;
        launched = false; lastImpact = null; lastReflectedDir = null;
        aimTip.x = start.x + 160; aimTip.y = start.y - 90;
    });
    document.getElementById('btnWallClearTrail')?.addEventListener('click', () => {
        trail = [];
    });
})();

// =============================================================================
// DEMO 3 — Checkpoints + lap counting. A fixed small oval; a car you step
// around with buttons. Each checkpoint lights up as it's crossed in order.
// Lap counter increments when checkpoint 0 is hit (i.e. we wrapped).
// =============================================================================
(function checkpointsDemo() {
    const canvas = document.getElementById('checkpointsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('checkpointsCanvasInfo');

    const track = makeOvalTrack(canvas.width / 2, canvas.height / 2, 280, 110, 36, 24, 6);
    const car = {
        position: new Vector2D(track.centerline[0].x, track.centerline[0].y),
        prev:     new Vector2D(track.centerline[0].x, track.centerline[0].y),
        index: 0,
        heading: 0
    };
    let next = 1;          // start "next" at 1 — the start line itself is index 0
    let hitFlags = Array(track.checkpoints.length).fill(false);
    let laps = 0;
    let autoRunning = false;

    function stepForward() {
        // Move the car to the next centerline sample, leaving prev behind.
        car.prev.x = car.position.x; car.prev.y = car.position.y;
        car.index = (car.index + 1) % track.centerline.length;
        const p = track.centerline[car.index];
        const pn = track.centerline[(car.index + 1) % track.centerline.length];
        car.position.x = p.x; car.position.y = p.y;
        car.heading = Math.atan2(pn.y - p.y, pn.x - p.x);
        tryCross();
    }
    function stepBackward() {
        car.prev.x = car.position.x; car.prev.y = car.position.y;
        car.index = (car.index - 1 + track.centerline.length) % track.centerline.length;
        const p = track.centerline[car.index];
        const pn = track.centerline[(car.index + 1) % track.centerline.length];
        car.position.x = p.x; car.position.y = p.y;
        car.heading = Math.atan2(pn.y - p.y, pn.x - p.x);
        tryCross();
    }

    function tryCross() {
        const cp = track.checkpoints[next];
        if (lineIntersection(car.prev, car.position, cp.a, cp.b)) {
            hitFlags[next] = true;
            next = (next + 1) % track.checkpoints.length;
            if (next === 1 && hitFlags[0]) {
                // We just wrapped around through the start line — count it.
                laps += 1;
                hitFlags = Array(track.checkpoints.length).fill(false);
                hitFlags[0] = true;  // start is now the "active" hit again
            }
        }
    }

    function reset() {
        car.position.x = track.centerline[0].x; car.position.y = track.centerline[0].y;
        car.prev.x = car.position.x; car.prev.y = car.position.y;
        car.index = 0;
        next = 1;
        hitFlags = Array(track.checkpoints.length).fill(false);
        laps = 0;
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Track surface — paint between the wall polylines as a filled ribbon.
        ctx.fillStyle = RACING_COLORS.trackSurface;
        ctx.beginPath();
        ctx.moveTo(track.walls.left[0].x, track.walls.left[0].y);
        for (const p of track.walls.left)  ctx.lineTo(p.x, p.y);
        for (let i = track.walls.right.length - 1; i >= 0; i--) ctx.lineTo(track.walls.right[i].x, track.walls.right[i].y);
        ctx.closePath();
        ctx.fill();

        // Walls
        ctx.strokeStyle = RACING_COLORS.wall;
        ctx.lineWidth = 2;
        for (const poly of [track.walls.left, track.walls.right]) {
            ctx.beginPath();
            ctx.moveTo(poly[0].x, poly[0].y);
            for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
            ctx.closePath();
            ctx.stroke();
        }

        // Checkpoints
        for (let i = 0; i < track.checkpoints.length; i++) {
            const cp = track.checkpoints[i];
            const isStart = (i === 0);
            const isNext = (i === next);
            ctx.strokeStyle = isStart
                ? RACING_COLORS.startLine
                : (hitFlags[i] ? RACING_COLORS.checkpointHit : RACING_COLORS.checkpoint);
            ctx.lineWidth = isStart ? 4 : (isNext ? 3 : 2);
            ctx.beginPath();
            ctx.moveTo(cp.a.x, cp.a.y);
            ctx.lineTo(cp.b.x, cp.b.y);
            ctx.stroke();
            // Index label
            ctx.fillStyle = isNext ? RACING_COLORS.arrow : RACING_COLORS.labelMuted;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(i), cp.center.x, cp.center.y + 4);
            ctx.textAlign = 'left';
        }

        // Car
        drawCarSprite(ctx, car, { w: 28, h: 14 });

        // HUD
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`lap: ${laps}`, 14, 26);
        ctx.fillText(`next checkpoint: ${next}`, 14, 46);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('White = start line (also checkpoint 0). Purple = pending, green = hit this lap.', 14, canvas.height - 12);
    }

    let lastAutoTick = 0;
    startFrameLoop((dt) => {
        if (autoRunning) {
            lastAutoTick += dt;
            if (lastAutoTick > 0.06) {
                lastAutoTick = 0;
                stepForward();
            }
        }
        render();
        info.innerHTML =
            `lap <strong>${laps}</strong> &nbsp;|&nbsp; next checkpoint <strong>${next}</strong>` +
            ` &nbsp;|&nbsp; hits this lap: <strong>${hitFlags.filter(Boolean).length}</strong> / ${track.checkpoints.length}`;
    });

    document.getElementById('btnCpStep')?.addEventListener('click', () => { autoRunning = false; stepForward(); });
    document.getElementById('btnCpStepBack')?.addEventListener('click', () => { autoRunning = false; stepBackward(); });
    document.getElementById('btnCpAuto')?.addEventListener('click', () => { autoRunning = !autoRunning; });
    document.getElementById('btnCpReset')?.addEventListener('click', () => { autoRunning = false; reset(); });

    render();
})();

// =============================================================================
// DEMO 4 — Steering seek. A draggable cyan target; a red AI car that seeks
// it using the same shortest-angular-difference loop the race AI uses. We
// visualise the current heading (white) and desired heading (orange).
// =============================================================================
(function steeringSeekDemo() {
    const canvas = document.getElementById('steeringSeekCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('steeringSeekCanvasInfo');

    const car = new Car(180, canvas.height / 2, 0);
    let target = { x: 600, y: 220 };
    let draggingTarget = false;

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        if (Math.hypot(mx - target.x, my - target.y) < 24) draggingTarget = true;
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!draggingTarget) return;
        const r = canvas.getBoundingClientRect();
        target.x = clamp(e.clientX - r.left, 20, canvas.width - 20);
        target.y = clamp(e.clientY - r.top,  20, canvas.height - 20);
    });
    canvas.addEventListener('mouseup',   () => { draggingTarget = false; });
    canvas.addEventListener('mouseleave',() => { draggingTarget = false; });

    function step(dt) {
        const desired = Math.atan2(target.y - car.position.y, target.x - car.position.x);
        let diff = desired - car.heading;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        const steer = clamp(diff * 2.2, -1, 1);
        // Throttle: drive at full speed, but ease off when close so the car
        // doesn't orbit the target forever.
        const dist = Math.hypot(target.x - car.position.x, target.y - car.position.y);
        const throttle = clamp(dist / 80, 0, 1);
        integrateWithGrip(car, throttle, steer, dt, { rollingDrag: 0.5, gripLimit: 500 });
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

        // Target
        ctx.fillStyle = RACING_COLORS.aiLook;
        ctx.beginPath(); ctx.arc(target.x, target.y, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

        // Desired-heading arrow (from car to target — clamped to a visual length).
        const dx = target.x - car.position.x, dy = target.y - car.position.y;
        const ang = Math.atan2(dy, dx);
        const visLen = Math.min(140, Math.hypot(dx, dy));
        drawArrow(ctx,
            car.position.x, car.position.y,
            car.position.x + Math.cos(ang) * visLen,
            car.position.y + Math.sin(ang) * visLen,
            RACING_COLORS.arrow, 2.5);

        // Current-heading arrow (white)
        drawArrow(ctx,
            car.position.x, car.position.y,
            car.position.x + Math.cos(car.heading) * 90,
            car.position.y + Math.sin(car.heading) * 90,
            RACING_COLORS.arrowTotal, 2.5);

        // Car
        drawCarSprite(ctx, car, { w: 32, h: 16 });

        // Legend
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('white = current heading · orange = desired (to target)', 14, 22);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText('Drag the cyan target. The red car seeks it using shortest-angle steering.', 14, canvas.height - 14);
    }

    startFrameLoop((dt) => { step(dt); render(); });

    document.getElementById('btnSeekReset')?.addEventListener('click', () => {
        car.reset(180, canvas.height / 2, 0);
    });

    render();
})();

// =============================================================================
// DEMO 5 — Race against one AI. The headline. A 4-Bézier oval; player car
// (red, WASD) vs AI car (cyan, look-ahead seek). Both share `integrateWithGrip`
// and `collideCarWithPolyline` against the same walls; both feed
// `tickCheckpoints` to track laps. First to 3 laps wins.
// =============================================================================
(function raceDemo() {
    const canvas = document.getElementById('raceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('raceCanvasInfo');

    const track = makeOvalTrack(canvas.width / 2, canvas.height / 2, 320, 175, 44, 28, 8);

    // Skid layer
    const skidLayer = document.createElement('canvas');
    skidLayer.width  = canvas.width;
    skidLayer.height = canvas.height;
    const skidCtx = skidLayer.getContext('2d');

    // Player and AI start side by side at the start line.
    const sp0 = track.centerline[0];
    const sp1 = track.centerline[1];
    const startHeading = Math.atan2(sp1.y - sp0.y, sp1.x - sp0.x);
    const startNormal = { x: -Math.sin(startHeading), y: Math.cos(startHeading) };

    const player = new Car(sp0.x + startNormal.x * 14, sp0.y + startNormal.y * 14, startHeading);
    const ai     = new Car(sp0.x - startNormal.x * 14, sp0.y - startNormal.y * 14, startHeading);
    let aiIndex = 0;
    let aiLookTarget = sp0;

    let lapsPlayer = 0;
    let lapsAI = 0;
    let nextCpPlayer = 1;
    let nextCpAI = 1;
    let winner = null;
    let showLook = true;

    const readInput = attachKeyInputs(canvas);

    function resetRace() {
        player.reset(sp0.x + startNormal.x * 14, sp0.y + startNormal.y * 14, startHeading);
        ai.reset(sp0.x - startNormal.x * 14, sp0.y - startNormal.y * 14, startHeading);
        aiIndex = 0;
        lapsPlayer = 0; lapsAI = 0;
        nextCpPlayer = 1; nextCpAI = 1;
        winner = null;
        skidCtx.clearRect(0, 0, skidLayer.width, skidLayer.height);
        document.getElementById('raceLapPlayer').textContent = '0';
        document.getElementById('raceLapAI').textContent = '0';
        document.getElementById('raceStatus').textContent = 'Click the canvas, then WASD to drive.';
    }

    function step(dt) {
        if (winner) return;
        // Player input → integrate → wall-collide → checkpoint progress.
        const { throttle, steer } = readInput();
        integrateWithGrip(player, throttle, steer, dt, RACE_SURFACE);
        collideCarWithPolyline(player, track.walls.left);
        collideCarWithPolyline(player, track.walls.right);
        const pRes = tickCheckpoints(player.prevPosition, player.position, track.checkpoints, nextCpPlayer, lapsPlayer);
        nextCpPlayer = pRes.next; lapsPlayer = pRes.laps;

        // AI loop
        const aiCmd = aiDrive(ai, track.centerline, aiIndex);
        aiIndex = aiCmd.currentIndex;
        aiLookTarget = aiCmd.target;
        integrateWithGrip(ai, aiCmd.throttle, aiCmd.steer, dt, RACE_SURFACE);
        collideCarWithPolyline(ai, track.walls.left);
        collideCarWithPolyline(ai, track.walls.right);
        const aRes = tickCheckpoints(ai.prevPosition, ai.position, track.checkpoints, nextCpAI, lapsAI);
        nextCpAI = aRes.next; lapsAI = aRes.laps;

        // Skid marks for whichever car is sliding (visual flavour).
        for (const c of [player, ai]) {
            if (!c.gripping) {
                const wheels = rearWheelWorldPositions(c);
                skidCtx.fillStyle = RACING_COLORS.skidMark;
                for (const p of wheels) {
                    skidCtx.beginPath(); skidCtx.arc(p.x, p.y, 2.0, 0, Math.PI * 2); skidCtx.fill();
                }
            }
        }

        // Win conditions — first to 3 laps.
        if (lapsPlayer >= 3 && lapsAI >= 3) {
            winner = lapsPlayer > lapsAI ? 'player' : (lapsAI > lapsPlayer ? 'ai' : 'tie');
        } else if (lapsPlayer >= 3) {
            winner = 'player';
        } else if (lapsAI >= 3) {
            winner = 'ai';
        }
    }

    function render() {
        // Background — green infield, asphalt outside.
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Track ribbon (filled between left and right wall polylines).
        ctx.fillStyle = RACING_COLORS.trackSurface;
        ctx.beginPath();
        ctx.moveTo(track.walls.left[0].x, track.walls.left[0].y);
        for (const p of track.walls.left)  ctx.lineTo(p.x, p.y);
        for (let i = track.walls.right.length - 1; i >= 0; i--) ctx.lineTo(track.walls.right[i].x, track.walls.right[i].y);
        ctx.closePath();
        ctx.fill();

        // Skid marks under the cars
        ctx.drawImage(skidLayer, 0, 0);

        // Centerline (dashed, subtle)
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

        // Start/finish line — checkpoint 0, drawn extra-bold.
        const start = track.checkpoints[0];
        ctx.strokeStyle = RACING_COLORS.startLine;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(start.a.x, start.a.y);
        ctx.lineTo(start.b.x, start.b.y);
        ctx.stroke();

        // AI lookahead target
        if (showLook && aiLookTarget) {
            ctx.fillStyle = RACING_COLORS.aiLook;
            ctx.beginPath(); ctx.arc(aiLookTarget.x, aiLookTarget.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = RACING_COLORS.aiLook;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(ai.position.x, ai.position.y); ctx.lineTo(aiLookTarget.x, aiLookTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        drawCarSprite(ctx, ai, { body: RACING_COLORS.carBodyAlt });
        drawCarSprite(ctx, player, { body: RACING_COLORS.carBody });

        // Winner banner
        if (winner) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80);
            ctx.fillStyle = winner === 'player' ? RACING_COLORS.carBody : RACING_COLORS.carBodyAlt;
            ctx.font = 'bold 32px sans-serif';
            ctx.textAlign = 'center';
            const text = winner === 'player' ? '🏆  YOU WIN' : (winner === 'ai' ? 'AI WINS' : 'TIE');
            ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 12);
            ctx.textAlign = 'left';
        }
    }

    startFrameLoop((dt) => {
        step(dt);
        render();
        document.getElementById('raceLapPlayer').textContent = String(lapsPlayer);
        document.getElementById('raceLapAI').textContent     = String(lapsAI);
        const statusEl = document.getElementById('raceStatus');
        if (winner) {
            statusEl.textContent = winner === 'player' ? '🏆 You win!' : (winner === 'ai' ? '🤖 AI wins.' : 'Tie!');
        } else {
            statusEl.textContent = `next CP — You: ${nextCpPlayer}, AI: ${nextCpAI}`;
        }
    });

    document.getElementById('btnRaceReset')?.addEventListener('click', resetRace);
    document.getElementById('btnRaceShowAI')?.addEventListener('click', () => {
        showLook = !showLook;
        document.getElementById('btnRaceShowAI')?.classList.toggle('active', showLook);
    });

    render();
})();
