// =============================================================================
// RACING-SIM — SIMULATIONS TIER DEMOS
// =============================================================================
// Six standalone deep-dive visualisers. No shared state across demos, no
// integration into the previous tiers' gameplay — each toy stands alone so a
// sim purist can play with the concept in isolation.
//
// UNITS — same convention as the previous tiers; some demos use real-world
// units (km/h, m/s, °C, Newtons) because they're visualising physics rather
// than gameplay. Each demo notes its units in its top comment.
//
// REUSES from shared/utils.js: `Vector2D`, `clamp`, `lerp`.
//
// `RACING_COLORS` is the same redeclared palette pattern as earlier tiers.
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

const RACING_COLORS = {
    asphalt:      '#1f242c',
    asphaltLight: '#262b35',
    grid:         '#2e3548',
    gridStrong:   '#4fc3f7',
    label:        '#e0e0e0',
    labelMuted:   '#9e9e9e',
    arrow:        '#ffa726',
    arrowSoft:    '#ffd180',
    arrowLat:     '#4fc3f7',
    arrowLong:    '#66bb6a',
    carBody:      '#ef5350',
    carBodyAlt:   '#26c6da',
    carWindow:    '#263238',
    skidMark:     'rgba(8, 8, 8, 0.75)',
    wall:         '#fbc02d',
    trackSurface: '#2b313c',
    centerline:   '#90a4ae',
    startLine:    '#ffffff',
    gripGood:     '#66bb6a',
    gripBad:      '#ef5350',
    // Sims-tier accents
    circle:       '#7fbcd4',
    inCircle:     '#26c6da',
    outCircle:    '#ef5350',
    tireCold:     '#4fc3f7',
    tireGood:     '#66bb6a',
    tireHot:      '#ef5350',
    aero:         '#ab47bc',
    suspBody:     '#ef5350',
    suspBumps:    '#9e9e9e',
    procDrive:    '#26c6da'
};

const MAX_DT = 0.05;

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

// Mulberry32 — a tiny, well-distributed PRNG keyed by an integer seed.
// Used by the procgen-track demo so identical seeds produce identical tracks.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// =============================================================================
// DEMO 1 — Friction circle. Drag the cyan dot to choose lateral + longitudinal
// force demand; show the two bar projections; mark in/out of the circle.
// Units are normalised (force in [-1, +1] each axis). The dashed circle has
// radius 1 — total grip budget.
// =============================================================================
(function frictionCircleDemo() {
    const canvas = document.getElementById('frictionCircleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('frictionCircleCanvasInfo');

    // Plot region (the circle) on the right; bars on the left.
    const plotR = 150;
    const plotCx = canvas.width - 220;
    const plotCy = canvas.height / 2;
    // Dot starts at "0.5 lat, 0 long" — a sensible default mid-corner.
    let lat = 0.5, longi = 0;
    let dragging = false;

    function dotXY() {
        return { x: plotCx + lat * plotR, y: plotCy - longi * plotR };
    }
    function fromXY(mx, my) {
        return { lat: clamp((mx - plotCx) / plotR, -1.4, 1.4), longi: clamp((plotCy - my) / plotR, -1.4, 1.4) };
    }

    canvas.addEventListener('mousedown', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const d = dotXY();
        if (Math.hypot(mx - d.x, my - d.y) < 18) dragging = true;
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const r = canvas.getBoundingClientRect();
        const { lat: l, longi: lg } = fromXY(e.clientX - r.left, e.clientY - r.top);
        lat = l; longi = lg;
    });
    canvas.addEventListener('mouseup',   () => { dragging = false; });
    canvas.addEventListener('mouseleave',() => { dragging = false; });

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Friction circle
        ctx.strokeStyle = RACING_COLORS.circle;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(plotCx, plotCy, plotR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);

        // Axes
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(plotCx - plotR - 30, plotCy); ctx.lineTo(plotCx + plotR + 30, plotCy);
        ctx.moveTo(plotCx, plotCy - plotR - 30); ctx.lineTo(plotCx, plotCy + plotR + 30);
        ctx.stroke();

        // Axis labels
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('lateral force →', plotCx + plotR + 40, plotCy + 4);
        ctx.save();
        ctx.translate(plotCx - 6, plotCy - plotR - 24);
        ctx.fillText('longitudinal ↑', 0, 0);
        ctx.restore();
        ctx.textAlign = 'left';

        // Quadrant hints
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '11px sans-serif';
        ctx.fillText('throttle + right turn', plotCx + 10, plotCy - plotR + 18);
        ctx.fillText('trail-brake right', plotCx + 10, plotCy + plotR - 6);
        ctx.textAlign = 'right';
        ctx.fillText('throttle + left turn', plotCx - 10, plotCy - plotR + 18);
        ctx.fillText('trail-brake left', plotCx - 10, plotCy + plotR - 6);
        ctx.textAlign = 'left';

        // Dot
        const inside = (lat * lat + longi * longi) <= 1;
        const d = dotXY();
        ctx.fillStyle = inside ? RACING_COLORS.inCircle : RACING_COLORS.outCircle;
        ctx.beginPath(); ctx.arc(d.x, d.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        // Line from origin to dot
        ctx.strokeStyle = inside ? RACING_COLORS.inCircle : RACING_COLORS.outCircle;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(plotCx, plotCy); ctx.lineTo(d.x, d.y); ctx.stroke();
        ctx.setLineDash([]);

        // Bars on the left
        const barX = 60, barW = 28, barH = 180;
        const drawBar = (x, label, value, color) => {
            ctx.strokeStyle = RACING_COLORS.grid;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, plotCy - barH / 2, barW, barH);
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(x, plotCy); ctx.lineTo(x + barW, plotCy); ctx.stroke();
            ctx.setLineDash([]);
            const h = value * (barH / 2);
            ctx.fillStyle = color;
            ctx.fillRect(x + 4, plotCy - h, barW - 8, h);
            ctx.fillStyle = RACING_COLORS.label;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, x + barW / 2, plotCy - barH / 2 - 10);
            ctx.fillText(`${value.toFixed(2)}`, x + barW / 2, plotCy + barH / 2 + 18);
            ctx.textAlign = 'left';
        };
        drawBar(barX,         'F_lateral', lat,   RACING_COLORS.arrowLat);
        drawBar(barX + 70,    'F_long',    longi, RACING_COLORS.arrowLong);

        // Combined magnitude
        const mag = Math.hypot(lat, longi);
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`|F| = √(F_lat² + F_long²) = ${mag.toFixed(2)}`, 14, 28);
        ctx.fillStyle = inside ? RACING_COLORS.gripGood : RACING_COLORS.gripBad;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(inside ? 'INSIDE — gripping' : 'OUTSIDE — sliding', 14, 52);

        info.innerHTML =
            `lateral <strong>${lat.toFixed(2)}</strong> · longitudinal <strong>${longi.toFixed(2)}</strong> · ` +
            `|F| <strong>${mag.toFixed(2)}</strong> ` +
            (inside
                ? `<strong style="color:${RACING_COLORS.gripGood}">GRIP</strong>`
                : `<strong style="color:${RACING_COLORS.gripBad}">SLIDING</strong>`);
    }

    startFrameLoop(() => render());
})();

// =============================================================================
// DEMO 2 — Tire heat & wear. Single tire with a temperature state. Buttons
// drive aggressive (heats up) or smooth (cools toward ambient). Below the
// gauge: the grip-multiplier curve, with the current temp's multiplier
// marked. Reset returns to ambient.
// =============================================================================
(function tireHeatDemo() {
    const canvas = document.getElementById('tireHeatCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('tireHeatCanvasInfo');

    const T_AMBIENT = 25;     // °C
    const T_OPTIMAL = 95;     // °C
    const T_HALFWIDTH = 32;   // °C — width of the "in-window" region

    let temp = T_AMBIENT;
    let mode = 'cool';   // 'aggressive' (slip energy in), 'smooth' (no slip), 'cool' (idle)

    function gripMultiplier(T) {
        // Bell curve centred on T_OPTIMAL with sigma = T_HALFWIDTH. Floor at 0.6
        // so cold/overheated still has some grip — just less.
        const x = (T - T_OPTIMAL) / T_HALFWIDTH;
        const bell = Math.exp(-x * x);
        return 0.6 + 0.4 * bell;
    }

    function step(dt) {
        const K_HEAT = 90;    // °C/s under aggressive driving
        const K_COOL = 0.65;  // 1/s exponential decay toward ambient
        // Heat input
        if (mode === 'aggressive') temp += K_HEAT * dt;
        // Always lose heat to the environment
        temp -= K_COOL * (temp - T_AMBIENT) * dt;
        if (temp < T_AMBIENT) temp = T_AMBIENT;
        if (temp > 250) temp = 250;
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Tire icon — left side. Colour by temp.
        const tireCx = 130, tireCy = canvas.height / 2;
        const t01 = clamp((temp - T_AMBIENT) / (250 - T_AMBIENT), 0, 1);
        let tireColor;
        if (temp < T_OPTIMAL - T_HALFWIDTH) tireColor = RACING_COLORS.tireCold;
        else if (temp > T_OPTIMAL + T_HALFWIDTH) tireColor = RACING_COLORS.tireHot;
        else tireColor = RACING_COLORS.tireGood;
        ctx.fillStyle = tireColor;
        ctx.beginPath(); ctx.arc(tireCx, tireCy, 60, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0d1117';
        ctx.beginPath(); ctx.arc(tireCx, tireCy, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${temp.toFixed(0)}°C`, tireCx, tireCy + 5);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = RACING_COLORS.labelMuted;
        const stateLabel = temp < T_OPTIMAL - T_HALFWIDTH ? 'COLD'
            : temp > T_OPTIMAL + T_HALFWIDTH ? 'OVERHEATED'
            : 'IN WINDOW';
        ctx.fillText(stateLabel, tireCx, tireCy + 86);
        ctx.textAlign = 'left';

        // Grip-multiplier curve on the right
        const padL = 250, padR = 30, padT = 60, padB = 60;
        const plotW = canvas.width - padL - padR;
        const plotH = canvas.height - padT - padB;
        const Tmin = 0, Tmax = 200;
        const toX = (T) => padL + (T - Tmin) / (Tmax - Tmin) * plotW;
        const toY = (g) => padT + (1 - (g - 0.5) / 0.6) * plotH;  // y-range 0.5..1.1

        // Axes
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.beginPath();
        ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH);
        ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();

        // Grip = 1.0 reference line
        ctx.strokeStyle = RACING_COLORS.labelMuted;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(padL, toY(1.0)); ctx.lineTo(padL + plotW, toY(1.0)); ctx.stroke();
        ctx.setLineDash([]);

        // Window highlight
        ctx.fillStyle = 'rgba(102, 187, 106, 0.15)';
        ctx.fillRect(toX(T_OPTIMAL - T_HALFWIDTH), padT, toX(T_OPTIMAL + T_HALFWIDTH) - toX(T_OPTIMAL - T_HALFWIDTH), plotH);

        // Curve
        ctx.strokeStyle = RACING_COLORS.tireGood;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let px = 0; px <= plotW; px++) {
            const T = Tmin + (px / plotW) * (Tmax - Tmin);
            const g = gripMultiplier(T);
            const x = padL + px, y = toY(g);
            if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Current dot
        const curG = gripMultiplier(temp);
        ctx.fillStyle = RACING_COLORS.arrow;
        ctx.beginPath(); ctx.arc(toX(temp), toY(curG), 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

        // Axis labels
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('tire temp (°C)', padL + plotW / 2, padT + plotH + 24);
        ctx.save();
        ctx.translate(padL - 20, padT + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('grip multiplier', 0, 0);
        ctx.restore();
        // Ticks
        for (const T of [0, 50, 100, 150, 200]) {
            ctx.fillText(String(T), toX(T), padT + plotH + 12);
        }
        ctx.textAlign = 'right';
        for (const g of [0.6, 0.8, 1.0]) {
            ctx.fillText(g.toFixed(2), padL - 4, toY(g) + 4);
        }
        ctx.textAlign = 'left';

        // Mode indicator
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`mode: ${mode}`, 14, 26);
        ctx.fillText(`grip × ${curG.toFixed(2)}`, 14, 46);

        info.innerHTML =
            `T=<strong>${temp.toFixed(0)}°C</strong> &nbsp;|&nbsp; ` +
            `state <strong>${stateLabel}</strong> &nbsp;|&nbsp; ` +
            `grip × <strong>${curG.toFixed(2)}</strong>`;
    }

    startFrameLoop((dt) => { step(dt); render(); });

    function setActive(id) {
        ['btnTireAggressive','btnTireSmooth','btnTireColdStart'].forEach(b => {
            document.getElementById(b)?.classList.toggle('active', b === id);
        });
    }
    document.getElementById('btnTireAggressive')?.addEventListener('click', () => { mode = 'aggressive'; setActive('btnTireAggressive'); });
    document.getElementById('btnTireSmooth')    ?.addEventListener('click', () => { mode = 'smooth';     setActive('btnTireSmooth'); });
    document.getElementById('btnTireColdStart') ?.addEventListener('click', () => { temp = T_AMBIENT; mode = 'cool'; setActive('btnTireColdStart'); });
    setActive('btnTireColdStart');
})();

// =============================================================================
// DEMO 3 — Aerodynamic downforce. Speed + C_L·A sliders. Three bars:
// downforce, normal load (weight + downforce), cornering grip (proportional
// to normal load). Real-world units (km/h, kg, kN).
// =============================================================================
(function aeroDemo() {
    const canvas = document.getElementById('aeroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('aeroCanvasInfo');
    const speedS = document.getElementById('aeroSpeed');
    const clS    = document.getElementById('aeroCl');
    const speedVal = document.getElementById('aeroSpeedVal');
    const clVal    = document.getElementById('aeroClVal');

    const RHO = 1.225;       // air density, kg/m³
    const CAR_MASS = 800;    // kg (open-wheeler-ish)
    const G = 9.81;          // m/s²
    const MU = 1.5;          // tyre friction coefficient

    function render() {
        const vKmh = parseFloat(speedS.value);
        const ClA = parseFloat(clS.value);
        speedVal.textContent = vKmh.toFixed(0);
        clVal.textContent = ClA.toFixed(1);
        const v = vKmh / 3.6;                              // m/s
        const downforce = 0.5 * RHO * v * v * ClA;         // Newtons
        const weight    = CAR_MASS * G;                    // Newtons
        const normal    = weight + downforce;              // Newtons (total downward)
        const cornerForce = MU * normal;                   // Newtons of cornering force available

        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Three bars across the canvas. Scale: 30 kN = full bar.
        const SCALE_N = 30000;
        const barW = 60, barH = 220;
        const barY = 60;
        const xs = [180, 360, 540];
        const labels = ['Downforce', 'Normal load', 'Cornering grip'];
        const values = [downforce, normal, cornerForce];
        const colors = [RACING_COLORS.aero, RACING_COLORS.arrowSoft, RACING_COLORS.tireGood];

        for (let i = 0; i < 3; i++) {
            const x = xs[i];
            ctx.strokeStyle = RACING_COLORS.grid;
            ctx.lineWidth = 1;
            ctx.strokeRect(x, barY, barW, barH);
            const h = clamp(values[i] / SCALE_N, 0, 1) * barH;
            ctx.fillStyle = colors[i];
            ctx.fillRect(x + 4, barY + barH - h, barW - 8, h);
            // Labels above bar
            ctx.fillStyle = RACING_COLORS.label;
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], x + barW / 2, barY - 24);
            ctx.font = '11px monospace';
            ctx.fillStyle = RACING_COLORS.labelMuted;
            ctx.fillText(`${(values[i]/1000).toFixed(1)} kN`, x + barW / 2, barY - 8);
            // Bottom value
            ctx.font = '12px monospace';
            ctx.fillStyle = RACING_COLORS.labelMuted;
            ctx.fillText(`${(values[i]/1000).toFixed(1)} kN`, x + barW / 2, barY + barH + 18);
            ctx.textAlign = 'left';
        }

        // Reference: weight (constant). Mark on the normal-load bar as a dashed line.
        const weightY = barY + barH - (weight / SCALE_N) * barH;
        ctx.strokeStyle = RACING_COLORS.labelMuted;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(xs[1] - 6, weightY); ctx.lineTo(xs[1] + barW + 6, weightY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '11px monospace';
        ctx.fillText(`car weight = ${(weight/1000).toFixed(1)} kN`, xs[1] + barW + 12, weightY + 4);

        // Header
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`v = ${vKmh.toFixed(0)} km/h (${v.toFixed(1)} m/s)`, 14, 26);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '12px sans-serif';
        ctx.fillText(`C_L·A = ${ClA.toFixed(1)} m² · ρ = ${RHO} kg/m³ · m = ${CAR_MASS} kg · μ = ${MU}`, 14, 46);

        const dfPct = (downforce / weight * 100);
        info.innerHTML =
            `at <strong>${vKmh.toFixed(0)} km/h</strong>, downforce = <strong>${(downforce/1000).toFixed(1)} kN</strong> ` +
            `(<strong>${dfPct.toFixed(0)}%</strong> of car weight) → cornering grip <strong>${(cornerForce/1000).toFixed(1)} kN</strong>`;
    }
    [speedS, clS].forEach(s => s.addEventListener('input', render));
    render();
})();

// =============================================================================
// DEMO 4 — Suspension as spring + damper. A car body rides over a bump road
// at constant horizontal speed. Sliders for k (spring stiffness) and c
// (damping). Shows the body bobbing; computes and displays ζ live.
// =============================================================================
(function suspensionDemo() {
    const canvas = document.getElementById('suspensionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('suspensionCanvasInfo');
    const kS = document.getElementById('suspK');
    const cS = document.getElementById('suspC');
    const kVal = document.getElementById('suspKVal');
    const cVal = document.getElementById('suspCVal');

    const MASS = 8;          // arbitrary units
    const REST_Y = 220;      // ground line y-coord on canvas
    const HORIZ_SPEED = 80;  // px/s scrolling of the road

    let bodyY = REST_Y - 50; // body sits 50px above the ground at rest
    let bodyV = 0;
    let scroll = 0;          // world-x offset

    // Bump terrain — a deterministic series of bumps at fixed world x. Each
    // bump is a small Gaussian; we look up the road-height under the wheel.
    const bumps = [];
    for (let i = 0; i < 200; i++) {
        bumps.push({ x: i * 90, amp: 8 + (i * 13) % 14, width: 18 });
    }

    function roadHeight(worldX) {
        let h = 0;
        for (const b of bumps) {
            const dx = worldX - b.x;
            h += b.amp * Math.exp(-(dx * dx) / (2 * b.width * b.width));
        }
        return h;
    }

    function step(dt) {
        scroll += HORIZ_SPEED * dt;
        const k = parseFloat(kS.value);
        const c = parseFloat(cS.value);
        kVal.textContent = k.toFixed(0);
        cVal.textContent = c.toFixed(1);

        // Wheel sits under the body at world-x = scroll + (canvas.width/2).
        const wheelWorldX = scroll + canvas.width / 2;
        const wheelGroundY = REST_Y - roadHeight(wheelWorldX);
        // Spring rest length = 50, anchored at wheelGroundY.
        const target = wheelGroundY - 50;
        // F = -k * (bodyY - target) - c * bodyV
        const accel = (-k * (bodyY - target) - c * bodyV) / MASS;
        bodyV += accel * dt;
        bodyY += bodyV * dt;
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Sky/asphalt split
        ctx.fillStyle = RACING_COLORS.asphaltLight;
        ctx.fillRect(0, REST_Y + 8, canvas.width, canvas.height - (REST_Y + 8));

        // Draw the road profile
        ctx.strokeStyle = RACING_COLORS.suspBumps;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += 2) {
            const worldX = scroll + x;
            const h = roadHeight(worldX);
            const y = REST_Y - h;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Wheel
        const wheelX = canvas.width / 2;
        const wheelWorldX = scroll + wheelX;
        const wheelGroundY = REST_Y - roadHeight(wheelWorldX);
        ctx.fillStyle = '#0d1117';
        ctx.beginPath(); ctx.arc(wheelX, wheelGroundY - 14, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5; ctx.stroke();

        // Spring (zigzag between wheel hub and body)
        const hubY = wheelGroundY - 14;
        const bodyAttachY = bodyY + 12;
        const turns = 6;
        ctx.strokeStyle = RACING_COLORS.gridStrong;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wheelX, hubY);
        for (let i = 1; i < turns * 2; i++) {
            const t = i / (turns * 2);
            const y = hubY + (bodyAttachY - hubY) * t;
            const x = wheelX + ((i % 2 === 0) ? -6 : 6);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(wheelX, bodyAttachY);
        ctx.stroke();

        // Body
        const bodyW = 200, bodyH = 36;
        ctx.fillStyle = RACING_COLORS.suspBody;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath(); ctx.roundRect(wheelX - bodyW/2, bodyY, bodyW, bodyH, 6); ctx.fill();
        } else ctx.fillRect(wheelX - bodyW/2, bodyY, bodyW, bodyH);
        ctx.fillStyle = RACING_COLORS.carWindow;
        ctx.fillRect(wheelX - bodyW/2 + 30, bodyY + 6, 80, bodyH - 12);

        // Compute and display damping ratio ζ
        const k = parseFloat(kS.value);
        const c = parseFloat(cS.value);
        const zeta = c / (2 * Math.sqrt(k * MASS));
        const regime = zeta < 0.95 ? 'UNDER-DAMPED' : (zeta > 1.05 ? 'OVER-DAMPED' : 'CRITICAL');
        const regimeColor = zeta < 0.95 ? RACING_COLORS.gripBad : (zeta > 1.05 ? RACING_COLORS.arrow : RACING_COLORS.gripGood);
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`ζ (damping ratio) = ${zeta.toFixed(2)}`, 14, 22);
        ctx.fillStyle = regimeColor;
        ctx.fillText(regime, 14, 42);

        info.innerHTML =
            `k = <strong>${k.toFixed(0)}</strong> · c = <strong>${c.toFixed(1)}</strong> · ` +
            `ζ = <strong>${zeta.toFixed(2)}</strong> → <strong style="color:${regimeColor}">${regime}</strong>`;
    }

    startFrameLoop((dt) => { step(dt); render(); });
})();

// =============================================================================
// DEMO 5 — Live g-g diagram. Drive a car (WASD) on an empty pad; plot a dot
// of (lateral g, longitudinal g) in real time; show a trailing path. The
// friction circle (radius = max g) is dashed. Telemetry traces below: speed,
// lateral g, longitudinal g over the last few seconds.
// =============================================================================
(function ggDiagramDemo() {
    const canvas = document.getElementById('ggCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('ggCanvasInfo');

    // Simple car physics so the demo is self-contained.
    const MAX_SPEED = 320;
    const MAX_ACCEL = 280;
    const MAX_BRAKE = 360;
    const MAX_STEER = 2.8;
    const MAX_G     = 1.4;   // friction circle limit, in arbitrary "g" units

    const car = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: 0, vy: 0,
        heading: 0,
        prevVx: 0, prevVy: 0
    };
    let trail = [];   // {gx, gy, age}
    const TRAIL_MAX = 240;
    let traces = [];  // {t, speed, gLat, gLong}
    const TRACE_MAX = 200;
    let elapsed = 0;

    // Keyboard input
    const keys = { up:false, down:false, left:false, right:false };
    window.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp')   keys.up   = true;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.down = true;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.left = true;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight')keys.right= true;
        if (document.activeElement === canvas) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp')   keys.up   = false;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') keys.down = false;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.left = false;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight')keys.right= false;
    });
    canvas.addEventListener('mousedown', () => canvas.focus());

    function step(dt) {
        elapsed += dt;
        let throttle = 0;
        if (keys.up   && !keys.down) throttle = +1;
        if (keys.down && !keys.up)   throttle = -1;
        let steer = 0;
        if (keys.left  && !keys.right) steer = -1;
        if (keys.right && !keys.left) steer = +1;

        // Steering
        const speed = Math.hypot(car.vx, car.vy);
        const steerScale = clamp(speed / 30, 0, 1);
        car.heading += steer * MAX_STEER * steerScale * dt;

        // Forward / lateral decomposition
        const fx = Math.cos(car.heading), fy = Math.sin(car.heading);
        const lx = -fy, ly = fx;
        let vF = car.vx * fx + car.vy * fy;
        let vL = car.vx * lx + car.vy * ly;
        // Throttle/brake
        if (throttle >= 0) vF += throttle * MAX_ACCEL * dt;
        else               vF += throttle * MAX_BRAKE * dt;
        // Mild drag
        vF *= (1 - 0.5 * dt);
        // Grip clamp on lateral (simple — this demo isn't about Pacejka)
        const maxLat = 700 * dt;
        if (Math.abs(vL) <= maxLat) vL = 0;
        else vL -= Math.sign(vL) * maxLat;
        // Recombine
        car.prevVx = car.vx; car.prevVy = car.vy;
        car.vx = fx * vF + lx * vL;
        car.vy = fy * vF + ly * vL;
        const sp = Math.hypot(car.vx, car.vy);
        if (sp > MAX_SPEED) { car.vx *= MAX_SPEED/sp; car.vy *= MAX_SPEED/sp; }
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        // Wrap inside the pad (left/right + top/bottom of upper canvas region)
        const pad = 22;
        const padTop = 22, padBottom = 320;
        if (car.x < pad) { car.x = pad; car.vx = 0; }
        if (car.x > canvas.width - pad) { car.x = canvas.width - pad; car.vx = 0; }
        if (car.y < padTop) { car.y = padTop; car.vy = 0; }
        if (car.y > padBottom) { car.y = padBottom; car.vy = 0; }

        // Compute acceleration in g (normalised). Lateral g = perpendicular
        // accel; longitudinal g = along-heading accel.
        const ax = (car.vx - car.prevVx) / dt;
        const ay = (car.vy - car.prevVy) / dt;
        const aF = ax * fx + ay * fy;
        const aL = ax * lx + ay * ly;
        const gLong = aF / (MAX_G * 200);  // scale so MAX_G ~= visual edge
        const gLat  = aL / (MAX_G * 200);

        trail.push({ gx: gLat, gy: gLong });
        if (trail.length > TRAIL_MAX) trail.shift();

        traces.push({ t: elapsed, speed: sp / MAX_SPEED, gLat, gLong });
        if (traces.length > TRACE_MAX) traces.shift();
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pad region (top)
        const padBottom = 320;
        // Reference grid
        ctx.strokeStyle = RACING_COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = 40; x < canvas.width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, padBottom); ctx.stroke();
        }
        for (let y = 40; y < padBottom; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Car
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.heading);
        ctx.fillStyle = RACING_COLORS.carBody;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath(); ctx.roundRect(-14, -7, 28, 14, 3); ctx.fill();
        } else ctx.fillRect(-14, -7, 28, 14);
        ctx.fillStyle = RACING_COLORS.carWindow;
        ctx.fillRect(4, -5, 7, 10);
        ctx.restore();

        // g-g diagram on the right side of the upper area
        const ggR = 90;
        const ggCx = canvas.width - 120;
        const ggCy = 160;
        // Background panel
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(ggCx - ggR - 20, ggCy - ggR - 26, (ggR + 20) * 2, (ggR + 26) * 2);
        // Friction circle
        ctx.strokeStyle = RACING_COLORS.circle;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(ggCx, ggCy, ggR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // Axes
        ctx.strokeStyle = RACING_COLORS.labelMuted;
        ctx.beginPath();
        ctx.moveTo(ggCx - ggR - 6, ggCy); ctx.lineTo(ggCx + ggR + 6, ggCy);
        ctx.moveTo(ggCx, ggCy - ggR - 6); ctx.lineTo(ggCx, ggCy + ggR + 6);
        ctx.stroke();
        // Trail
        for (let i = 0; i < trail.length; i++) {
            const p = trail[i];
            const alpha = i / trail.length;
            ctx.fillStyle = `rgba(38, 198, 218, ${alpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(ggCx + p.gx * ggR, ggCy - p.gy * ggR, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Live dot
        if (trail.length) {
            const p = trail[trail.length - 1];
            const mag = Math.hypot(p.gx, p.gy);
            ctx.fillStyle = mag > 1 ? RACING_COLORS.outCircle : RACING_COLORS.inCircle;
            ctx.beginPath();
            ctx.arc(ggCx + p.gx * ggR, ggCy - p.gy * ggR, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        // Labels
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('g-g diagram', ggCx, ggCy - ggR - 12);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.fillText('lat →', ggCx + ggR + 14, ggCy + 3);
        ctx.fillText('long ↑', ggCx, ggCy - ggR - 24);
        ctx.textAlign = 'left';

        // Telemetry traces
        const traceTop = padBottom + 12;
        const traceH = canvas.height - traceTop - 12;
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, traceTop, canvas.width, traceH);

        const trEntries = [
            { label: 'speed',  color: RACING_COLORS.label,    pick: t => t.speed,           offset: 0 },
            { label: 'lat g',  color: RACING_COLORS.inCircle, pick: t => 0.5 + t.gLat * 0.5, offset: traceH / 3 },
            { label: 'long g', color: RACING_COLORS.arrowLong, pick: t => 0.5 + t.gLong * 0.5, offset: 2 * traceH / 3 }
        ];
        const rowH = traceH / 3;
        for (let i = 0; i < trEntries.length; i++) {
            const tr = trEntries[i];
            const y0 = traceTop + tr.offset;
            ctx.strokeStyle = RACING_COLORS.grid;
            ctx.beginPath();
            ctx.moveTo(60, y0 + rowH - 2); ctx.lineTo(canvas.width - 12, y0 + rowH - 2);
            ctx.stroke();
            ctx.fillStyle = tr.color;
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(tr.label, 6, y0 + rowH / 2 + 4);
            // Trace
            ctx.strokeStyle = tr.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let j = 0; j < traces.length; j++) {
                const x = 60 + (j / TRACE_MAX) * (canvas.width - 72);
                const v = clamp(tr.pick(traces[j]), 0, 1);
                const y = y0 + rowH - 4 - v * (rowH - 8);
                if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        info.innerHTML =
            `speed <strong>${(Math.hypot(car.vx, car.vy)).toFixed(0)} px/s</strong> &nbsp;|&nbsp; ` +
            (trail.length
                ? `last gg = (lat <strong>${trail[trail.length-1].gx.toFixed(2)}</strong>, long <strong>${trail[trail.length-1].gy.toFixed(2)}</strong>)`
                : 'no data yet');
    }

    startFrameLoop((dt) => { step(dt); render(); });

    document.getElementById('btnGgReset')?.addEventListener('click', () => {
        car.x = canvas.width / 2; car.y = 160; car.vx = 0; car.vy = 0; car.heading = 0;
        trail = []; traces = [];
    });
    document.getElementById('btnGgClearTrail')?.addEventListener('click', () => {
        trail = []; traces = [];
    });
})();

// =============================================================================
// DEMO 6 — Procedural track generator. Seed + complexity + jitter sliders
// produce a closed cubic-Bézier track. A small cyan auto-driver walks the
// centerline so you can see if the track is "drivable" (no sharp kinks).
// =============================================================================
(function procgenTrackDemo() {
    const canvas = document.getElementById('procgenCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('procgenCanvasInfo');
    const seedS = document.getElementById('pgSeed');
    const complS = document.getElementById('pgComplexity');
    const jitS = document.getElementById('pgJitter');
    const seedVal = document.getElementById('pgSeedVal');
    const complVal = document.getElementById('pgComplexityVal');
    const jitVal = document.getElementById('pgJitterVal');

    function buildTrack(seed, count, jitter) {
        const rng = mulberry32(seed);
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const baseR = Math.min(canvas.width, canvas.height) * 0.35;
        // 1. N anchor points in polar coords, each with a random radial offset.
        const anchors = [];
        for (let i = 0; i < count; i++) {
            const theta = (i / count) * Math.PI * 2;
            const r = baseR * (1 + jitter * (rng() * 2 - 1));
            anchors.push({
                x: cx + Math.cos(theta) * r,
                y: cy + Math.sin(theta) * r,
                theta
            });
        }
        // 2. For each pair of neighbours, pick Bézier handles tangent to the
        //    local circle direction (perpendicular to the radial line). This
        //    keeps the curve smooth around the loop.
        const segments = [];
        for (let i = 0; i < count; i++) {
            const a = anchors[i];
            const b = anchors[(i + 1) % count];
            const ta = { x: -Math.sin(a.theta), y: Math.cos(a.theta) };
            const tb = { x: -Math.sin(b.theta), y: Math.cos(b.theta) };
            // Handle length: a fraction of the arc-chord length.
            const chord = Math.hypot(b.x - a.x, b.y - a.y);
            const handleLen = chord * 0.45;
            segments.push({
                p0: { x: a.x, y: a.y },
                p1: { x: a.x + ta.x * handleLen, y: a.y + ta.y * handleLen },
                p2: { x: b.x - tb.x * handleLen, y: b.y - tb.y * handleLen },
                p3: { x: b.x, y: b.y }
            });
        }
        // 3. Sample
        const centerline = [];
        for (const s of segments) {
            for (let i = 0; i < 16; i++) {
                const t = i / 16, u = 1 - t;
                centerline.push({
                    x: u*u*u*s.p0.x + 3*u*u*t*s.p1.x + 3*u*t*t*s.p2.x + t*t*t*s.p3.x,
                    y: u*u*u*s.p0.y + 3*u*u*t*s.p1.y + 3*u*t*t*s.p2.y + t*t*t*s.p3.y
                });
            }
        }
        // 4. Inflate walls
        const halfWidth = 28;
        const left = [], right = [];
        for (let i = 0; i < centerline.length; i++) {
            const a = centerline[i];
            const b = centerline[(i + 1) % centerline.length];
            const tx = b.x - a.x, ty = b.y - a.y;
            const len = Math.hypot(tx, ty) || 1;
            const nx = -ty / len, ny = tx / len;
            left.push({  x: a.x + nx * halfWidth, y: a.y + ny * halfWidth });
            right.push({ x: a.x - nx * halfWidth, y: a.y - ny * halfWidth });
        }
        return { centerline, walls: { left, right }, anchors };
    }

    let track = buildTrack(42, 10, 0.24);
    let driverIdx = 0;
    let driverPos = { x: track.centerline[0].x, y: track.centerline[0].y };
    let driverHeading = 0;

    function rebuild() {
        const seed = parseInt(seedS.value);
        const count = parseInt(complS.value);
        const jit = parseFloat(jitS.value);
        seedVal.textContent = seed;
        complVal.textContent = count;
        jitVal.textContent = jit.toFixed(2);
        track = buildTrack(seed, count, jit);
        driverIdx = 0;
        driverPos = { x: track.centerline[0].x, y: track.centerline[0].y };
    }
    rebuild();
    [seedS, complS, jitS].forEach(s => s.addEventListener('input', rebuild));

    function step(dt) {
        // Auto-drive: glide along the centerline at constant speed.
        const target = track.centerline[(driverIdx + 1) % track.centerline.length];
        const dx = target.x - driverPos.x, dy = target.y - driverPos.y;
        const dist = Math.hypot(dx, dy);
        const speed = 220;
        const move = speed * dt;
        if (dist <= move) {
            driverPos.x = target.x;
            driverPos.y = target.y;
            driverIdx = (driverIdx + 1) % track.centerline.length;
        } else {
            driverPos.x += (dx / dist) * move;
            driverPos.y += (dy / dist) * move;
        }
        driverHeading = Math.atan2(dy, dx);
    }

    function render() {
        ctx.fillStyle = RACING_COLORS.asphalt;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Track ribbon
        ctx.fillStyle = RACING_COLORS.trackSurface;
        ctx.beginPath();
        ctx.moveTo(track.walls.left[0].x, track.walls.left[0].y);
        for (const p of track.walls.left)  ctx.lineTo(p.x, p.y);
        for (let i = track.walls.right.length - 1; i >= 0; i--) ctx.lineTo(track.walls.right[i].x, track.walls.right[i].y);
        ctx.closePath();
        ctx.fill();

        // Walls
        ctx.strokeStyle = RACING_COLORS.wall;
        ctx.lineWidth = 2.5;
        for (const poly of [track.walls.left, track.walls.right]) {
            ctx.beginPath();
            ctx.moveTo(poly[0].x, poly[0].y);
            for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
            ctx.closePath();
            ctx.stroke();
        }

        // Centerline
        ctx.strokeStyle = RACING_COLORS.centerline;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(track.centerline[0].x, track.centerline[0].y);
        for (let i = 1; i < track.centerline.length; i++) ctx.lineTo(track.centerline[i].x, track.centerline[i].y);
        ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);

        // Anchor dots
        for (const a of track.anchors) {
            ctx.fillStyle = RACING_COLORS.arrow;
            ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, Math.PI * 2); ctx.fill();
        }

        // Auto-driver
        ctx.save();
        ctx.translate(driverPos.x, driverPos.y);
        ctx.rotate(driverHeading);
        ctx.fillStyle = RACING_COLORS.procDrive;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath(); ctx.roundRect(-12, -6, 24, 12, 3); ctx.fill();
        } else ctx.fillRect(-12, -6, 24, 12);
        ctx.restore();

        // Labels
        ctx.fillStyle = RACING_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`seed ${seedS.value} · ${complS.value} anchors · jitter ${parseFloat(jitS.value).toFixed(2)}`, 14, 22);
        ctx.fillStyle = RACING_COLORS.labelMuted;
        ctx.font = '11px sans-serif';
        ctx.fillText('Orange = anchors · grey dashes = centerline · yellow = walls · cyan = auto-driver', 14, canvas.height - 12);

        info.innerHTML =
            `seed <strong>${seedS.value}</strong> · ` +
            `anchors <strong>${complS.value}</strong> · ` +
            `jitter <strong>${parseFloat(jitS.value).toFixed(2)}</strong> · ` +
            `centerline samples <strong>${track.centerline.length}</strong>`;
    }

    startFrameLoop((dt) => { step(dt); render(); });
})();
