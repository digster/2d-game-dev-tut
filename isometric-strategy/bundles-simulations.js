// =============================================================================
// ISOMETRIC STRATEGY — SIMULATIONS TIER EXPORT BUNDLES (final tier)
// =============================================================================
// Same pattern as bundles-advanced.js. The simulations tier is structurally
// unique: its demo code lives in an INLINE <script> in simulations.html
// (no simulations-demos.js). The IIFEs below are transcribed verbatim from
// that inline block with the canvas/info ID rewrite (scaffold hardcodes
// id="canvas" / id="info") and runtime DOM injection for slider / matrix
// controls the scaffold doesn't render.
//
// TS variants use the slice trick CORRECTLY: `.slice(4, -1)` with a uniform
// K=4 leading-line count (function decl + canvas/ctx/info). `-1` drops only
// the trailing `})();` (re-added by the TS template) and preserves the demo's
// final bootstrap call. (Iters 3-4 used `-2` here, which silently dropped that
// line in TS exports — flagged separately as a follow-up.)
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS (consumed by shared/export-demo.js
// resolveDepClosure). Belt-and-suspenders: data-deps below also list the full
// closure manually, so this is a safety net, not the sole mechanism.
// =============================================================================
DEPENDENCY_REQUIRES.iso_pickTileFromMouse = ['iso_isoToCart'];

// =============================================================================
// SHARED ISO HELPERS (re-defined so simulations exports stand alone)
// =============================================================================

DEPENDENCY_BUNDLES.iso_clearCanvas = `function clearCanvas(ctx, width, height, bgColor = '#0d1117') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;

DEPENDENCY_BUNDLES.iso_cartToIso = `function cartToIso(cx, cy, tileW, tileH, originX = 0, originY = 0) {
    return {
        x: originX + (cx - cy) * (tileW / 2),
        y: originY + (cx + cy) * (tileH / 2)
    };
}`;

DEPENDENCY_BUNDLES.iso_isoToCart = `function isoToCart(sx, sy, tileW, tileH, originX = 0, originY = 0) {
    const dx = sx - originX;
    const dy = sy - originY;
    return {
        x: dx / tileW + dy / tileH,
        y: dy / tileH - dx / tileW
    };
}`;

DEPENDENCY_BUNDLES.iso_drawIsoTile = `function drawIsoTile(ctx, sx, sy, tileW, tileH, fillStyle = '#3a4a6a', strokeStyle = '#4fc3f7') {
    const halfW = tileW / 2;
    const halfH = tileH / 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + halfW, sy + halfH);
    ctx.lineTo(sx, sy + tileH);
    ctx.lineTo(sx - halfW, sy + halfH);
    ctx.closePath();
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 1; ctx.stroke(); }
}`;

DEPENDENCY_BUNDLES.iso_pickTileFromMouse = `function pickTileFromMouse(mouseX, mouseY, originX, originY, tileW, tileH, mapW = null, mapH = null) {
    const cart = isoToCart(mouseX, mouseY - tileH / 2, tileW, tileH, originX, originY);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (mapW !== null && (tx < 0 || tx >= mapW)) return null;
    if (mapH !== null && (ty < 0 || ty >= mapH)) return null;
    return { x: tx, y: ty };
}`;

DEPENDENCY_BUNDLES_TS.iso_clearCanvas = `function clearCanvas(
    ctx: CanvasRenderingContext2D, width: number, height: number, bgColor: string = '#0d1117'
): void {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;
DEPENDENCY_BUNDLES_TS.iso_cartToIso = `function cartToIso(
    cx: number, cy: number, tileW: number, tileH: number,
    originX: number = 0, originY: number = 0
): { x: number; y: number } {
    return {
        x: originX + (cx - cy) * (tileW / 2),
        y: originY + (cx + cy) * (tileH / 2)
    };
}`;
DEPENDENCY_BUNDLES_TS.iso_isoToCart = `function isoToCart(
    sx: number, sy: number, tileW: number, tileH: number,
    originX: number = 0, originY: number = 0
): { x: number; y: number } {
    const dx = sx - originX;
    const dy = sy - originY;
    return {
        x: dx / tileW + dy / tileH,
        y: dy / tileH - dx / tileW
    };
}`;
DEPENDENCY_BUNDLES_TS.iso_drawIsoTile = `function drawIsoTile(
    ctx: CanvasRenderingContext2D, sx: number, sy: number,
    tileW: number, tileH: number,
    fillStyle: string | null = '#3a4a6a', strokeStyle: string | null = '#4fc3f7'
): void {
    const halfW = tileW / 2;
    const halfH = tileH / 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + halfW, sy + halfH);
    ctx.lineTo(sx, sy + tileH);
    ctx.lineTo(sx - halfW, sy + halfH);
    ctx.closePath();
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 1; ctx.stroke(); }
}`;
DEPENDENCY_BUNDLES_TS.iso_pickTileFromMouse = `function pickTileFromMouse(
    mouseX: number, mouseY: number, originX: number, originY: number,
    tileW: number, tileH: number, mapW: number | null = null, mapH: number | null = null
): { x: number; y: number } | null {
    const cart = isoToCart(mouseX, mouseY - tileH / 2, tileW, tileH, originX, originY);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (mapW !== null && (tx < 0 || tx >= mapW)) return null;
    if (mapH !== null && (ty < 0 || ty >= mapH)) return null;
    return { x: tx, y: ty };
}`;

// =============================================================================
// SIMULATIONS PALETTE
// =============================================================================
DEPENDENCY_BUNDLES.iso_sim_colors = `const SIM_COLORS = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    friend: '#66bb6a',
    enemy:  '#ef5350',
    accent: '#ffa726',
    flow:   '#ffd180',
    label:  '#e0e0e0',
    muted:  '#9e9e9e',
    front:  '#ffeb3b',
    hud:    'rgba(13, 17, 23, 0.78)'
};`;
DEPENDENCY_BUNDLES_TS.iso_sim_colors = `const SIM_COLORS: Record<string, string> = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    friend: '#66bb6a',
    enemy:  '#ef5350',
    accent: '#ffa726',
    flow:   '#ffd180',
    label:  '#e0e0e0',
    muted:  '#9e9e9e',
    front:  '#ffeb3b',
    hud:    'rgba(13, 17, 23, 0.78)'
};`;

// =============================================================================
// DEMO 1 — iso_ffViz (flow-field BFS visualizer, isometric, RAF on "Run")
// =============================================================================
DEMO_HTML.iso_ffViz = {
    title: 'Iso — Flow-Field Pathfinding Visualizer',
    canvas: { width: 800, height: 440 },
    controls: [
        { id: 'btnFFStep',     text: 'Step BFS' },
        { id: 'btnFFRun',      text: '▶ Run' },
        { id: 'btnFFReset',    text: 'Reset' },
        { id: 'btnFFArrows',   text: 'Toggle arrows' },
        { id: 'btnFFPickGoal', text: 'Set goal (click grid)' }
    ],
    info: 'Step the BFS one frontier at a time, or run it to completion.'
};

DEMO_CODE.iso_ffViz = `(function ffViz() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const W = 18, H = 12;
    const tW = 38, tH = 19;
    const ox = canvas.width / 2, oy = 30;

    const blocked = new Uint8Array(W * H);
    for (let x = 4; x < 8; x++) blocked[5 * W + x] = 1;
    for (let y = 2; y < 6; y++) blocked[y * W + 12] = 1;
    for (let x = 9; x < 12; x++) blocked[8 * W + x] = 1;

    let goal = { x: W - 2, y: H - 2 };
    let cost = new Float32Array(W * H).fill(Infinity);
    let queue = [];
    let showArrows = true;
    let running = false;
    let pickingGoal = false;

    function reset() {
        cost = new Float32Array(W * H).fill(Infinity);
        queue = [];
        if (!blocked[goal.y * W + goal.x]) {
            cost[goal.y * W + goal.x] = 0;
            queue.push({ x: goal.x, y: goal.y });
        }
        running = false;
        render();
    }

    function step() {
        if (queue.length === 0) return false;
        const c = queue.shift();
        const here = cost[c.y * W + c.x];
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = c.x + dx, ny = c.y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            if (blocked[ny * W + nx]) continue;
            if (cost[ny * W + nx] <= here + 1) continue;
            cost[ny * W + nx] = here + 1;
            queue.push({ x: nx, y: ny });
        }
        return queue.length > 0;
    }

    function flowFor(cx, cy) {
        let best = null, bestC = cost[cy * W + cx];
        if (bestC === Infinity) return null;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const c = cost[ny * W + nx];
            if (c < bestC) { bestC = c; best = { dx, dy }; }
        }
        return best;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        let maxC = 0;
        for (let i = 0; i < cost.length; i++) if (cost[i] !== Infinity && cost[i] > maxC) maxC = cost[i];
        for (let cy = 0; cy < H; cy++) {
            for (let cx = 0; cx < W; cx++) {
                const p = cartToIso(cx, cy, tW, tH, ox, oy);
                let fill = '#1a233a';
                if (blocked[cy * W + cx]) fill = SIM_COLORS.stone;
                else if (cost[cy * W + cx] !== Infinity && maxC > 0) {
                    const t = 1 - cost[cy * W + cx] / maxC;
                    fill = \`rgba(255, 235, 59, \${0.10 + 0.55 * t})\`;
                }
                drawIsoTile(ctx, p.x, p.y, tW, tH, fill, SIM_COLORS.outline);
            }
        }
        for (const c of queue) {
            const p = cartToIso(c.x, c.y, tW, tH, ox, oy);
            drawIsoTile(ctx, p.x, p.y, tW, tH, null, SIM_COLORS.accent);
        }
        if (showArrows) {
            ctx.strokeStyle = SIM_COLORS.flow;
            ctx.lineWidth = 1.5;
            for (let cy = 0; cy < H; cy++) {
                for (let cx = 0; cx < W; cx++) {
                    const f = flowFor(cx, cy);
                    if (!f) continue;
                    const p = cartToIso(cx + 0.5, cy + 0.5, tW, tH, ox, oy);
                    const ex = p.x + f.dx * 9;
                    const ey = p.y + f.dy * 9 * 0.6;
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
                    ctx.fillStyle = SIM_COLORS.flow;
                    ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
        const gp = cartToIso(goal.x, goal.y, tW, tH, ox, oy);
        drawIsoTile(ctx, gp.x, gp.y, tW, tH, 'rgba(255, 167, 38, 0.65)', SIM_COLORS.accent);

        const filled = cost.filter(c => c !== Infinity).length;
        info.innerHTML = \`Goal: <strong>(\${goal.x}, \${goal.y})</strong> · \` +
            \`Filled <strong>\${filled}/\${W * H}</strong> cells · \` +
            \`Frontier size <strong>\${queue.length}</strong>\`;
    }

    document.getElementById('btnFFStep')?.addEventListener('click', () => { step(); render(); });
    document.getElementById('btnFFRun')?.addEventListener('click', () => {
        running = !running;
        if (running) loop();
    });
    document.getElementById('btnFFReset')?.addEventListener('click', () => { reset(); });
    document.getElementById('btnFFArrows')?.addEventListener('click', (e) => {
        showArrows = !showArrows;
        e.target.classList.toggle('active', showArrows);
        render();
    });
    document.getElementById('btnFFPickGoal')?.addEventListener('click', (e) => {
        pickingGoal = !pickingGoal;
        e.target.classList.toggle('active', pickingGoal);
    });
    canvas.addEventListener('click', (e) => {
        if (!pickingGoal) return;
        const r = canvas.getBoundingClientRect();
        const t = pickTileFromMouse(e.clientX - r.left, e.clientY - r.top, ox, oy, tW, tH, W, H);
        if (t && !blocked[t.y * W + t.x]) {
            goal = t;
            reset();
            pickingGoal = false;
            document.getElementById('btnFFPickGoal').classList.remove('active');
        }
    });

    function loop() {
        if (!running) return;
        if (!step()) running = false;
        render();
        if (running) requestAnimationFrame(loop);
    }

    reset();
})();`;

DEMO_CODE_TS.iso_ffViz = `(function ffViz(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_ffViz.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 2 — iso_influenceMaps (Gaussian heatmap, isometric, σ slider injected)
// =============================================================================
DEMO_HTML.iso_influenceMaps = {
    title: 'Iso — Influence Maps for AI Strategy',
    canvas: { width: 800, height: 440 },
    controls: [
        { id: 'btnInfFriend', text: 'Place friendly' },
        { id: 'btnInfEnemy',  text: 'Place enemy' },
        { id: 'btnInfClear',  text: 'Clear all' },
        { id: 'btnInfFront',  text: 'Highlight frontline' }
    ],
    info: 'Click to place units. The σ slider controls influence spread.'
};

DEMO_CODE.iso_influenceMaps = `(function influenceMaps() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    // The scaffold has no slider; inject the σ control the IIFE expects.
    document.body.insertAdjacentHTML('beforeend',
        '<div style="max-width:800px;margin:10px auto;color:#e0e0e0;font-family:system-ui;font-size:14px">' +
        '<label for="influenceSigma" style="display:inline-block;width:160px">Spread (σ)</label>' +
        '<input type="range" id="influenceSigma" min="1" max="8" step="0.5" value="3" style="vertical-align:middle">' +
        '<span id="influenceSigmaVal" style="margin-left:8px;font-family:monospace;color:#4fc3f7">3.0</span>' +
        '</div>');

    const W = 24, H = 14;
    const tW = 30, tH = 15;
    const ox = canvas.width / 2, oy = 30;

    const units = [
        { team: 'friend', x: 5, y: 4 }, { team: 'friend', x: 7, y: 6 },
        { team: 'enemy',  x: 18, y: 5 }, { team: 'enemy',  x: 16, y: 9 }
    ];
    let placeTeam = 'friend';
    let sigma = 3;
    let showFront = true;

    const sigmaEl = document.getElementById('influenceSigma');
    const sigmaVal = document.getElementById('influenceSigmaVal');
    sigmaEl?.addEventListener('input', () => {
        sigma = parseFloat(sigmaEl.value);
        sigmaVal.textContent = sigma.toFixed(1);
        render();
    });

    function compute() {
        const map = new Float32Array(W * H);
        const s2 = sigma * sigma;
        for (const u of units) {
            const sign = u.team === 'friend' ? 1 : -1;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const dx = x - u.x, dy = y - u.y;
                    map[y * W + x] += sign * Math.exp(-(dx * dx + dy * dy) / (2 * s2));
                }
            }
        }
        return map;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const map = compute();
        let maxAbs = 0.001;
        for (let i = 0; i < map.length; i++) if (Math.abs(map[i]) > maxAbs) maxAbs = Math.abs(map[i]);
        for (let cy = 0; cy < H; cy++) {
            for (let cx = 0; cx < W; cx++) {
                const v = map[cy * W + cx];
                const p = cartToIso(cx, cy, tW, tH, ox, oy);
                let fill;
                if (showFront && Math.abs(v) / maxAbs < 0.08) fill = 'rgba(255, 235, 59, 0.35)';
                else {
                    const t = Math.abs(v) / maxAbs;
                    fill = v >= 0
                        ? \`rgba(102, 187, 106, \${0.1 + 0.7 * t})\`
                        : \`rgba(239,  83,  80, \${0.1 + 0.7 * t})\`;
                }
                drawIsoTile(ctx, p.x, p.y, tW, tH, fill, SIM_COLORS.outline);
            }
        }
        for (const u of units) {
            const p = cartToIso(u.x + 0.5, u.y + 0.5, tW, tH, ox, oy);
            ctx.fillStyle = u.team === 'friend' ? SIM_COLORS.friend : SIM_COLORS.enemy;
            ctx.beginPath();
            ctx.arc(p.x, p.y - 8, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        const friends = units.filter(u => u.team === 'friend').length;
        const enemies = units.filter(u => u.team === 'enemy').length;
        info.innerHTML = \`Friends: <strong>\${friends}</strong> · Enemies: <strong>\${enemies}</strong> · σ = \${sigma.toFixed(1)}. \` +
            (showFront ? 'Yellow band = frontline.' : '');
    }

    canvas.addEventListener('click', (e) => {
        const r = canvas.getBoundingClientRect();
        const t = pickTileFromMouse(e.clientX - r.left, e.clientY - r.top, ox, oy, tW, tH, W, H);
        if (!t) return;
        units.push({ team: placeTeam, x: t.x, y: t.y });
        render();
    });

    document.getElementById('btnInfFriend')?.addEventListener('click', () => {
        placeTeam = 'friend';
        document.getElementById('btnInfFriend').classList.add('active');
        document.getElementById('btnInfEnemy').classList.remove('active');
    });
    document.getElementById('btnInfEnemy')?.addEventListener('click', () => {
        placeTeam = 'enemy';
        document.getElementById('btnInfEnemy').classList.add('active');
        document.getElementById('btnInfFriend').classList.remove('active');
    });
    document.getElementById('btnInfClear')?.addEventListener('click', () => {
        units.length = 0;
        render();
    });
    document.getElementById('btnInfFront')?.addEventListener('click', (e) => {
        showFront = !showFront;
        e.target.classList.toggle('active', showFront);
        render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_influenceMaps = `(function influenceMaps(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_influenceMaps.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 3 — iso_crowdsSim (Boids vs Continuum, flat pixel space, RAF)
// =============================================================================
DEMO_HTML.iso_crowdsSim = {
    title: 'Iso — Boids vs Continuum Crowds',
    canvas: { width: 800, height: 440 },
    controls: [
        { id: 'btnCrowdsReset',      text: 'Reset' },
        { id: 'btnCrowdsGoalRandom', text: 'Random goal' }
    ],
    info: 'Left: Reynolds boids. Right: continuum-crowd flow field. Click to set goals.'
};

DEMO_CODE.iso_crowdsSim = `(function crowdsSim() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const PANEL_W = canvas.width / 2;
    const PANEL_H = canvas.height;
    const N = 80;

    const boids = [];
    const ccAgents = [];
    function reset() {
        boids.length = 0; ccAgents.length = 0;
        for (let i = 0; i < N; i++) {
            boids.push({
                x: Math.random() * (PANEL_W - 40) + 20,
                y: Math.random() * (PANEL_H - 40) + 20,
                vx: 0, vy: 0
            });
            ccAgents.push({
                x: Math.random() * (PANEL_W - 40) + 20,
                y: Math.random() * (PANEL_H - 40) + 20,
                vx: 0, vy: 0
            });
        }
    }
    reset();

    let boidGoal = { x: PANEL_W - 30, y: PANEL_H - 30 };
    let ccGoal   = { x: PANEL_W - 30, y: PANEL_H - 30 };

    const CC_GRID = 16;
    const CC_W = Math.ceil(PANEL_W / CC_GRID);
    const CC_H = Math.ceil(PANEL_H / CC_GRID);
    let ccFlow = new Array(CC_W * CC_H).fill(null);
    function rebuildContinuumFlow() {
        const cost = new Float32Array(CC_W * CC_H).fill(Infinity);
        const gx = Math.floor(ccGoal.x / CC_GRID);
        const gy = Math.floor(ccGoal.y / CC_GRID);
        cost[gy * CC_W + gx] = 0;
        const q = [{ x: gx, y: gy }];
        let head = 0;
        while (head < q.length) {
            const c = q[head++];
            const here = cost[c.y * CC_W + c.x];
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = c.x + dx, ny = c.y + dy;
                if (nx < 0 || nx >= CC_W || ny < 0 || ny >= CC_H) continue;
                if (cost[ny * CC_W + nx] <= here + 1) continue;
                cost[ny * CC_W + nx] = here + 1;
                q.push({ x: nx, y: ny });
            }
        }
        ccFlow = new Array(CC_W * CC_H).fill(null);
        for (let y = 0; y < CC_H; y++) {
            for (let x = 0; x < CC_W; x++) {
                if (cost[y * CC_W + x] === Infinity) continue;
                let best = null, bestC = cost[y * CC_W + x];
                for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= CC_W || ny < 0 || ny >= CC_H) continue;
                    const c = cost[ny * CC_W + nx];
                    if (c < bestC) { bestC = c; best = { dx, dy }; }
                }
                ccFlow[y * CC_W + x] = best;
            }
        }
    }
    rebuildContinuumFlow();

    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;

        for (const a of boids) {
            let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
            for (const o of boids) {
                if (o === a) continue;
                const dx = a.x - o.x, dy = a.y - o.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > 800 || d2 === 0) continue;
                const w = 1 / Math.sqrt(d2);
                sx += dx * w; sy += dy * w;
                ax += o.vx; ay += o.vy;
                cx += o.x;  cy += o.y;
                n++;
            }
            let dvx = 0, dvy = 0;
            if (n > 0) {
                dvx += sx * 8;
                dvy += sy * 8;
                dvx += (ax / n - a.vx) * 0.6;
                dvy += (ay / n - a.vy) * 0.6;
                dvx += (cx / n - a.x) * 0.15;
                dvy += (cy / n - a.y) * 0.15;
            }
            const gx = boidGoal.x - a.x, gy = boidGoal.y - a.y;
            const gd = Math.hypot(gx, gy) || 1;
            dvx += (gx / gd) * 60;
            dvy += (gy / gd) * 60;
            a.vx += dvx * dt;
            a.vy += dvy * dt;
            const vm = Math.hypot(a.vx, a.vy);
            if (vm > 60) { a.vx *= 60 / vm; a.vy *= 60 / vm; }
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            if (a.x < 5) { a.x = 5; a.vx *= -0.5; }
            if (a.x > PANEL_W - 5) { a.x = PANEL_W - 5; a.vx *= -0.5; }
            if (a.y < 5) { a.y = 5; a.vy *= -0.5; }
            if (a.y > PANEL_H - 5) { a.y = PANEL_H - 5; a.vy *= -0.5; }
        }

        const density = new Int16Array(CC_W * CC_H);
        for (const a of ccAgents) {
            const gx = Math.floor(a.x / CC_GRID);
            const gy = Math.floor(a.y / CC_GRID);
            if (gx >= 0 && gx < CC_W && gy >= 0 && gy < CC_H) density[gy * CC_W + gx]++;
        }
        for (const a of ccAgents) {
            const gx = Math.floor(a.x / CC_GRID);
            const gy = Math.floor(a.y / CC_GRID);
            if (gx < 0 || gx >= CC_W || gy < 0 || gy >= CC_H) continue;
            const f = ccFlow[gy * CC_W + gx];
            if (!f) continue;
            const d = density[gy * CC_W + gx];
            const slow = Math.max(0.35, 1 - d * 0.04);
            const speed = 60 * slow;
            const targetVx = f.dx * speed;
            const targetVy = f.dy * speed;
            a.vx += (targetVx - a.vx) * 6 * dt;
            a.vy += (targetVy - a.vy) * 6 * dt;
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            if (a.x < 5) { a.x = 5; a.vx = 0; }
            if (a.x > PANEL_W - 5) { a.x = PANEL_W - 5; a.vx = 0; }
            if (a.y < 5) { a.y = 5; a.vy = 0; }
            if (a.y > PANEL_H - 5) { a.y = PANEL_H - 5; a.vy = 0; }
        }

        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1f3a';
        ctx.fillRect(0, 0, PANEL_W, PANEL_H);
        ctx.fillRect(PANEL_W, 0, PANEL_W, PANEL_H);
        ctx.strokeStyle = SIM_COLORS.outline;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(PANEL_W, 0); ctx.lineTo(PANEL_W, PANEL_H); ctx.stroke();
        ctx.fillStyle = SIM_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Boids (Reynolds)',           14, 22);
        ctx.fillText('Continuum (flow + density)', PANEL_W + 14, 22);
        ctx.fillStyle = '#4fc3f7';
        for (const a of boids) {
            ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#66bb6a';
        for (const a of ccAgents) {
            ctx.beginPath(); ctx.arc(a.x + PANEL_W, a.y, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = SIM_COLORS.accent;
        ctx.beginPath(); ctx.arc(boidGoal.x, boidGoal.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ccGoal.x + PANEL_W, ccGoal.y, 7, 0, Math.PI * 2); ctx.fill();
    }

    canvas.addEventListener('click', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        if (mx < PANEL_W) {
            boidGoal = { x: mx, y: my };
        } else {
            ccGoal = { x: mx - PANEL_W, y: my };
            rebuildContinuumFlow();
        }
        info.innerHTML = \`Boid goal: (\${boidGoal.x.toFixed(0)}, \${boidGoal.y.toFixed(0)}) · Continuum goal: (\${ccGoal.x.toFixed(0)}, \${ccGoal.y.toFixed(0)})\`;
    });

    document.getElementById('btnCrowdsReset')?.addEventListener('click', reset);
    document.getElementById('btnCrowdsGoalRandom')?.addEventListener('click', () => {
        boidGoal = { x: 20 + Math.random() * (PANEL_W - 40), y: 20 + Math.random() * (PANEL_H - 40) };
        ccGoal   = { x: 20 + Math.random() * (PANEL_W - 40), y: 20 + Math.random() * (PANEL_H - 40) };
        rebuildContinuumFlow();
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_crowdsSim = `(function crowdsSim(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_crowdsSim.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 4 — iso_economySim (RTS economy chart, 4 sliders injected, RAF)
// =============================================================================
DEMO_HTML.iso_economySim = {
    title: 'Iso — RTS Economy Feedback Loop',
    canvas: { width: 800, height: 320 },
    controls: [],
    info: 'Tune the sliders; watch the wood-stock curve respond over 30 s.'
};

DEMO_CODE.iso_economySim = `(function economySim() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    // The scaffold has no sliders; inject the 4 economy controls the IIFE reads.
    document.body.insertAdjacentHTML('beforeend',
        '<div style="max-width:800px;margin:10px auto;color:#e0e0e0;font-family:system-ui;font-size:14px">' +
        '<div style="margin:6px 0"><label style="display:inline-block;width:200px">Workers</label>' +
        '<input type="range" id="ecoWorkers" min="0" max="20" step="1" value="3" style="vertical-align:middle">' +
        '<span id="ecoWorkersVal" style="margin-left:8px;font-family:monospace;color:#4fc3f7">3</span></div>' +
        '<div style="margin:6px 0"><label style="display:inline-block;width:200px">Soldier cost</label>' +
        '<input type="range" id="ecoSoldierCost" min="5" max="60" step="5" value="30" style="vertical-align:middle">' +
        '<span id="ecoSoldierCostVal" style="margin-left:8px;font-family:monospace;color:#4fc3f7">30</span></div>' +
        '<div style="margin:6px 0"><label style="display:inline-block;width:200px">Soldier build time (s)</label>' +
        '<input type="range" id="ecoSoldierTime" min="0.5" max="5" step="0.5" value="2" style="vertical-align:middle">' +
        '<span id="ecoSoldierTimeVal" style="margin-left:8px;font-family:monospace;color:#4fc3f7">2.0</span></div>' +
        '<div style="margin:6px 0"><label style="display:inline-block;width:200px">Training enabled</label>' +
        '<input type="range" id="ecoTraining" min="0" max="1" step="1" value="1" style="vertical-align:middle">' +
        '<span id="ecoTrainingVal" style="margin-left:8px;font-family:monospace;color:#4fc3f7">on</span></div>' +
        '</div>');

    const state = {
        wood: 50,
        workers: 3,
        soldiers: 0,
        soldierCost: 30,
        soldierBuildTime: 2,
        training: true,
        buildProgress: 0
    };

    function bind(id, valId, key, fmt = (v) => v.toFixed(0)) {
        const el = document.getElementById(id);
        const vEl = document.getElementById(valId);
        const apply = () => {
            let v = parseFloat(el.value);
            if (key === 'training') { state.training = v === 1; vEl.textContent = v === 1 ? 'on' : 'off'; }
            else { state[key] = v; vEl.textContent = fmt(v); }
        };
        el?.addEventListener('input', apply);
        apply();
    }
    bind('ecoWorkers', 'ecoWorkersVal', 'workers');
    bind('ecoSoldierCost', 'ecoSoldierCostVal', 'soldierCost');
    bind('ecoSoldierTime', 'ecoSoldierTimeVal', 'soldierBuildTime', v => v.toFixed(1));
    bind('ecoTraining', 'ecoTrainingVal', 'training');

    const HISTORY = 30;
    const samples = [];

    let lastT = performance.now();
    let elapsed = 0;
    function step(dt) {
        state.wood += state.workers * 3 * dt;
        if (state.training && state.wood >= state.soldierCost) {
            state.buildProgress += dt;
            if (state.buildProgress >= state.soldierBuildTime) {
                state.buildProgress = 0;
                state.wood -= state.soldierCost;
                state.soldiers++;
            }
        } else if (!state.training) {
            state.buildProgress = 0;
        }
        elapsed += dt;
        samples.push({ t: elapsed, wood: state.wood, soldiers: state.soldiers });
        while (samples.length > 1 && samples[0].t < elapsed - HISTORY) samples.shift();
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const left = 60, right = canvas.width - 20, top = 30, bottom = canvas.height - 40;
        ctx.strokeStyle = SIM_COLORS.outline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
        let maxWood = 100, maxSoldiers = 1;
        for (const s of samples) {
            if (s.wood > maxWood) maxWood = s.wood;
            if (s.soldiers > maxSoldiers) maxSoldiers = s.soldiers;
        }
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const x = left + ((s.t - (elapsed - HISTORY)) / HISTORY) * (right - left);
            const y = bottom - (s.wood / maxWood) * (bottom - top);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = SIM_COLORS.enemy;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const x = left + ((s.t - (elapsed - HISTORY)) / HISTORY) * (right - left);
            const y = bottom - (s.soldiers / maxSoldiers) * (bottom - top);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = SIM_COLORS.label;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(\`Wood: \${state.wood.toFixed(0)}\`, left + 8, top + 16);
        ctx.fillStyle = SIM_COLORS.enemy;
        ctx.fillText(\`Soldiers: \${state.soldiers}\`, left + 8, top + 32);
        ctx.fillStyle = SIM_COLORS.muted;
        ctx.fillText(\`max wood ≈ \${maxWood.toFixed(0)}, max soldiers = \${maxSoldiers}\`, left + 8, bottom + 24);
        ctx.fillStyle = SIM_COLORS.label;
        ctx.fillText('0', left - 24, bottom + 4);
        ctx.fillText(\`\${HISTORY}s ago\`, left - 24, top + 4);
        info.innerHTML = \`Wood: <strong>\${state.wood.toFixed(0)}</strong> · Soldiers: <strong>\${state.soldiers}</strong> · \` +
            \`Production rate: <strong>\${(state.workers * 3).toFixed(0)} wood/s</strong> · \` +
            \`Soldier DPS-equivalent (1 soldier/\${state.soldierBuildTime}s when affordable): cost \${state.soldierCost}\`;
    }

    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        step(dt);
        render();
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_economySim = `(function economySim(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_economySim.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 5 — iso_procgen (value-noise biome map, 2 sliders injected, isometric)
// =============================================================================
DEMO_HTML.iso_procgen = {
    title: 'Iso — Procedural Map Generation',
    canvas: { width: 800, height: 460 },
    controls: [
        { id: 'btnProcRegen', text: 'Regenerate (new seed)' }
    ],
    info: 'Adjust frequency + sea level; the biome map regenerates live.'
};

DEMO_CODE.iso_procgen = `(function procgen() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    // The scaffold has no sliders; inject the 2 procgen controls the IIFE reads.
    document.body.insertAdjacentHTML('beforeend',
        '<div style="max-width:800px;margin:10px auto;color:#e0e0e0;font-family:system-ui;font-size:14px">' +
        '<div style="margin:6px 0"><label style="display:inline-block;width:200px">Noise frequency</label>' +
        '<input type="range" id="procFreq" min="0.05" max="0.4" step="0.01" value="0.15" style="vertical-align:middle">' +
        '<span id="procFreqVal" style="margin-left:8px;font-family:monospace;color:#4fc3f7">0.15</span></div>' +
        '<div style="margin:6px 0"><label style="display:inline-block;width:200px">Sea level</label>' +
        '<input type="range" id="procSeaLevel" min="0.1" max="0.5" step="0.02" value="0.30" style="vertical-align:middle">' +
        '<span id="procSeaLevelVal" style="margin-left:8px;font-family:monospace;color:#4fc3f7">0.30</span></div>' +
        '</div>');

    const W = 32, H = 24;
    const tW = 22, tH = 11;
    const ox = canvas.width / 2, oy = 30;
    let seed = 1;
    let freq = 0.15;
    let seaLevel = 0.30;

    function makeNoise(seed) {
        function hash(x, y) {
            let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
            h = (h ^ (h >> 13)) * 1274126177;
            return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
        }
        function smooth(t) { return t * t * (3 - 2 * t); }
        return function (x, y) {
            const ix = Math.floor(x), iy = Math.floor(y);
            const fx = x - ix, fy = y - iy;
            const a = hash(ix, iy),     b = hash(ix + 1, iy);
            const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
            const sx = smooth(fx), sy = smooth(fy);
            return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
        };
    }

    function biomeFor(h) {
        if (h < seaLevel)        return 'water';
        if (h < seaLevel + 0.06) return 'sand';
        if (h < 0.75)            return 'grass';
        return 'stone';
    }

    function generate() {
        const noise = makeNoise(seed);
        const tiles = [];
        const hist = { water: 0, sand: 0, grass: 0, stone: 0 };
        for (let y = 0; y < H; y++) {
            const row = [];
            for (let x = 0; x < W; x++) {
                const n = 0.7 * noise(x * freq, y * freq) +
                          0.3 * noise(x * freq * 2.7, y * freq * 2.7);
                const b = biomeFor(n);
                hist[b]++;
                row.push(b);
            }
            tiles.push(row);
        }
        return { tiles, hist };
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const { tiles, hist } = generate();
        for (let cy = 0; cy < H; cy++) {
            for (let cx = 0; cx < W; cx++) {
                const p = cartToIso(cx, cy, tW, tH, ox, oy);
                const c = tiles[cy][cx];
                const fill = c === 'water' ? SIM_COLORS.water :
                             c === 'sand'  ? SIM_COLORS.sand  :
                             c === 'grass' ? SIM_COLORS.grass : SIM_COLORS.stone;
                drawIsoTile(ctx, p.x, p.y, tW, tH, fill, SIM_COLORS.outline);
            }
        }
        const total = W * H;
        info.innerHTML = \`seed=\${seed} · freq=\${freq.toFixed(2)} · sea=\${seaLevel.toFixed(2)} — \` +
            Object.entries(hist).map(([k, v]) => \`\${k}: \${(v * 100 / total).toFixed(0)}%\`).join('  ');
    }

    document.getElementById('btnProcRegen')?.addEventListener('click', () => {
        seed = Math.floor(Math.random() * 0xffffff);
        render();
    });
    const freqEl = document.getElementById('procFreq');
    const freqVal = document.getElementById('procFreqVal');
    freqEl?.addEventListener('input', () => {
        freq = parseFloat(freqEl.value);
        freqVal.textContent = freq.toFixed(2);
        render();
    });
    const slEl = document.getElementById('procSeaLevel');
    const slVal = document.getElementById('procSeaLevelVal');
    slEl?.addEventListener('input', () => {
        seaLevel = parseFloat(slEl.value);
        slVal.textContent = seaLevel.toFixed(2);
        render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_procgen = `(function procgen(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_procgen.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 6 — iso_damageModel (combat matrix, dynamic slider grid injected)
// =============================================================================
DEMO_HTML.iso_damageModel = {
    title: 'Iso — Combat Damage Matrix Playground',
    canvas: { width: 800, height: 420 },
    controls: [],
    info: 'Tune the 3×3 attack-vs-armour matrix; DPS bars update live.'
};

DEMO_CODE.iso_damageModel = `(function damageModel() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    // The scaffold has no matrix container; inject the div buildSliders() fills.
    document.body.insertAdjacentHTML('beforeend',
        '<div id="damageMatrix" style="max-width:800px;margin:10px auto;color:#e0e0e0;font-family:system-ui"></div>');
    const matrixDiv = document.getElementById('damageMatrix');

    const attacks = ['pierce', 'blunt', 'magic'];
    const armors  = ['light',  'medium', 'heavy'];
    const matrix = [
        [1.2, 1.0, 0.6],
        [0.8, 1.2, 0.7],
        [1.0, 0.9, 1.3]
    ];
    const baseDamage = 10;
    const attacksPerSec = 1.0;

    function buildSliders() {
        matrixDiv.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.style.display = 'grid';
        wrap.style.gridTemplateColumns = '110px repeat(3, 1fr)';
        wrap.style.gap = '8px';
        wrap.style.alignItems = 'center';
        wrap.style.margin = '14px 0';

        const empty = document.createElement('div'); wrap.appendChild(empty);
        for (const arm of armors) {
            const hdr = document.createElement('div');
            hdr.textContent = \`vs \${arm}\`;
            hdr.style.color = SIM_COLORS.muted;
            hdr.style.fontWeight = 'bold';
            hdr.style.textAlign = 'center';
            wrap.appendChild(hdr);
        }
        for (let ai = 0; ai < attacks.length; ai++) {
            const rowHdr = document.createElement('div');
            rowHdr.textContent = attacks[ai];
            rowHdr.style.color = '#4fc3f7';
            rowHdr.style.fontWeight = 'bold';
            wrap.appendChild(rowHdr);
            for (let di = 0; di < armors.length; di++) {
                const cell = document.createElement('div');
                cell.style.display = 'flex';
                cell.style.flexDirection = 'column';
                cell.style.alignItems = 'center';
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = '0'; slider.max = '2'; slider.step = '0.05';
                slider.value = matrix[ai][di].toString();
                slider.style.width = '100%';
                slider.style.accentColor = '#4fc3f7';
                const lbl = document.createElement('span');
                lbl.textContent = parseFloat(slider.value).toFixed(2) + '×';
                lbl.style.color = '#4fc3f7';
                lbl.style.fontFamily = 'monospace';
                lbl.style.fontSize = '0.9em';
                slider.addEventListener('input', () => {
                    matrix[ai][di] = parseFloat(slider.value);
                    lbl.textContent = matrix[ai][di].toFixed(2) + '×';
                    render();
                });
                cell.appendChild(slider);
                cell.appendChild(lbl);
                wrap.appendChild(cell);
            }
        }
        matrixDiv.appendChild(wrap);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const top = 30, bottom = canvas.height - 40;
        const groupWidth = (canvas.width - 40) / attacks.length;
        const barWidth = groupWidth / (armors.length + 1);
        let maxDPS = 1;
        for (let ai = 0; ai < attacks.length; ai++)
            for (let di = 0; di < armors.length; di++)
                maxDPS = Math.max(maxDPS, baseDamage * matrix[ai][di] * attacksPerSec);

        for (let ai = 0; ai < attacks.length; ai++) {
            const groupX = 20 + ai * groupWidth;
            ctx.fillStyle = SIM_COLORS.label;
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(attacks[ai], groupX + groupWidth / 2, bottom + 22);
            for (let di = 0; di < armors.length; di++) {
                const dps = baseDamage * matrix[ai][di] * attacksPerSec;
                const h = (dps / maxDPS) * (bottom - top - 20);
                const x = groupX + (di + 0.5) * barWidth;
                const y = bottom - h;
                const colors = ['#4fc3f7', '#ffa726', '#ef5350'];
                ctx.fillStyle = colors[di];
                ctx.fillRect(x, y, barWidth * 0.8, h);
                ctx.fillStyle = SIM_COLORS.label;
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(dps.toFixed(1), x + barWidth * 0.4, y - 4);
                ctx.fillStyle = SIM_COLORS.muted;
                ctx.font = '11px sans-serif';
                ctx.fillText(armors[di], x + barWidth * 0.4, bottom + 38);
            }
        }
        ctx.textAlign = 'start';
        ctx.fillStyle = SIM_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(\`Effective DPS (base \${baseDamage} × multiplier × \${attacksPerSec.toFixed(1)} attacks/s)\`, 16, 20);
        info.innerHTML = \`Max DPS in this matchup grid: <strong>\${maxDPS.toFixed(1)}</strong>\`;
    }

    buildSliders();
    render();
})();`;

DEMO_CODE_TS.iso_damageModel = `(function damageModel(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_damageModel.split('\n').slice(4, -1).join('\n')}
})();`;
