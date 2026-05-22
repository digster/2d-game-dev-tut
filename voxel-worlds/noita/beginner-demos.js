// =============================================================================
// NOITA SUB-TRACK — BEGINNER TIER DEMOS ("Falling Sand from Scratch")
// =============================================================================
// Cellular-pixel voxels. Every cell is one PIXEL, the whole grid simulates
// every frame, and rendering goes through an ImageData buffer (fillRect-per-
// cell does not scale to tens of thousands of cells).
//
// IMPORTANT: this file is self-contained. Its top-level declarations live in
// the page's shared global scope, so it must NOT re-declare any name already
// defined by shared/utils.js (lerp, clamp, map, clearCanvas, ...). All names
// here are deliberately Noita-specific (noi*/NOI_*) to stay clear of those.
// =============================================================================

(function noiSetupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
        btn.style.opacity = window.pageYOffset > 300 ? '1' : '0';
    });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// --- Materials --------------------------------------------------------------
// Deliberately tiny — the Noita Beginner tier is just air, sand, wall. Liquids,
// gases and fire arrive in the Intermediate tier.
const NOI_AIR = 0, NOI_SAND = 1, NOI_WALL = 2;

// Cheap per-index hash → 0..1, used to give each sand pixel a grain of jitter.
function noiHash(i) {
    let h = (i * 374761393) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}

// --- The falling-sand rule --------------------------------------------------

// Advance every sand cell one step, IN PLACE.
//   * Bottom-up scan  — a cell is visited before the cell it moves into, so it
//     moves at most one row per frame (a top-down scan would teleport it).
//   * Alternating horizontal scan — sweeping left→right one frame and
//     right→left the next cancels the sideways drift an always-same sweep adds.
// Rule precedence per sand cell: straight down → down-left / down-right.
function stepSand(grid, W, H, frame) {
    const ltr = (frame & 1) === 0;
    for (let y = H - 2; y >= 0; y--) {
        for (let k = 0; k < W; k++) {
            const x = ltr ? k : W - 1 - k;
            const i = y * W + x;
            if (grid[i] !== NOI_SAND) continue;
            const below = i + W;
            if (grid[below] === NOI_AIR) {            // 1. straight down
                grid[i] = NOI_AIR; grid[below] = NOI_SAND;
                continue;
            }
            const canL = x > 0       && grid[below - 1] === NOI_AIR;
            const canR = x < W - 1   && grid[below + 1] === NOI_AIR;
            if (canL || canR) {                       // 2. down-diagonal
                const dir = (canL && canR) ? (Math.random() < 0.5 ? -1 : 1) : (canL ? -1 : 1);
                grid[i] = NOI_AIR; grid[below + dir] = NOI_SAND;
            }
        }
    }
}

// The WRONG way, kept for the update-order demo: a top-down scan. A sand cell
// moves down, then the scan reaches it again lower down and moves it AGAIN —
// so one grain falls the entire column in a single frame ("teleporting").
function stepSandNaive(grid, W, H) {
    for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (grid[i] !== NOI_SAND) continue;
            const below = i + W;
            if (grid[below] === NOI_AIR) { grid[i] = NOI_AIR; grid[below] = NOI_SAND; }
        }
    }
}

// --- Helpers ----------------------------------------------------------------

// Stamp a filled disc of `mat` into the grid.
function noiPaintDisc(grid, W, H, cx, cy, r, mat) {
    for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || x >= W || y < 0 || y >= H) continue;
            grid[y * W + x] = mat;
        }
}

// Build a renderer that draws the pixel grid via an ImageData buffer:
//   write RGBA bytes → putImageData to a sim-resolution offscreen canvas →
//   drawImage it scaled up to the display canvas (nearest-neighbour).
function noiMakeRenderer(canvas, W, H) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const offCtx = off.getContext('2d');
    const img = offCtx.createImageData(W, H);
    const data = img.data;
    return function render(grid) {
        for (let i = 0; i < grid.length; i++) {
            const p = i << 2;                 // i * 4
            const m = grid[i];
            if (m === NOI_SAND) {
                const j = (noiHash(i) * 28 - 14) | 0;   // per-grain jitter
                data[p] = 206 + j; data[p + 1] = 180 + j; data[p + 2] = 110 + j;
            } else if (m === NOI_WALL) {
                data[p] = 92; data[p + 1] = 96; data[p + 2] = 108;
            } else {
                data[p] = 13; data[p + 1] = 17; data[p + 2] = 30;     // air
            }
            data[p + 3] = 255;
        }
        offCtx.putImageData(img, 0, 0);
        ctx.drawImage(off, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
    };
}

// Map a mouse event to integer sim-grid coordinates.
function noiMouseCell(canvas, e, W, H) {
    const r = canvas.getBoundingClientRect();
    return {
        x: Math.floor((e.clientX - r.left) / r.width * W),
        y: Math.floor((e.clientY - r.top) / r.height * H)
    };
}

// =============================================================================
// DEMO 1 — noiEngine: the pixel-grid falling-sand engine, ImageData-rendered
// =============================================================================
(function noiEngineDemo() {
    const canvas = document.getElementById('noiEngine');
    if (!canvas) return;
    const info = document.getElementById('noiEngineInfo');

    const W = 240, H = 150;                   // 36,000 cells, drawn at 3× zoom
    const grid = new Uint8Array(W * H);
    const render = noiMakeRenderer(canvas, W, H);
    let frame = 0, brush = 5, drawing = false, mouse = null;

    function paint() {
        if (!mouse) return;
        noiPaintDisc(grid, W, H, mouse.x, mouse.y, brush, NOI_SAND);
    }
    function countSand() {
        let n = 0;
        for (let i = 0; i < grid.length; i++) if (grid[i] === NOI_SAND) n++;
        return n;
    }
    function loop() {
        if (drawing) paint();
        stepSand(grid, W, H, frame++);
        render(grid);
        info.innerHTML = `${W}×${H} = <strong>${(W * H).toLocaleString()}</strong> pixels · ` +
            `sand: <strong>${countSand().toLocaleString()}</strong> · ` +
            `click &amp; drag to pour — every pixel runs the rule, every frame`;
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });

    const sizes = [['btnEngineBrushS', 3], ['btnEngineBrushM', 6], ['btnEngineBrushL', 11]];
    function selectBrush(id, r) {
        brush = r;
        sizes.forEach(([bid]) => document.getElementById(bid).classList.toggle('active', bid === id));
    }
    sizes.forEach(([id, r]) => document.getElementById(id).addEventListener('click', () => selectBrush(id, r)));
    document.getElementById('btnEngineClear').addEventListener('click', () => grid.fill(NOI_AIR));
    selectBrush('btnEngineBrushM', 6);

    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 2 — noiRule: the falling-sand rule, zoomed in on a coarse stepped grid
// =============================================================================
(function noiRuleDemo() {
    const canvas = document.getElementById('noiRule');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('noiRuleInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 44, H = 25, CELL = 16;
    let grid, frame = 0, running = false;

    function build() {
        grid = new Uint8Array(W * H);
        for (let x = 0; x < W; x++) grid[(H - 1) * W + x] = NOI_WALL;   // floor
        for (let x = 14; x < 30; x++) grid[(H - 8) * W + x] = NOI_WALL; // a ledge
        // A loose cloud of sand grains so the first Step is immediately visible.
        for (let x = 6; x < 38; x++)
            for (let y = 3; y < 11; y++)
                if ((x * 3 + y * 5) % 7 === 0) grid[y * W + x] = NOI_SAND;
    }
    // The rule a sand cell WOULD apply — pure, for the decision arrow.
    function decide(x, y) {
        if (y >= H - 1) return 'settled';
        const below = (y + 1) * W + x;
        if (grid[below] === NOI_AIR) return 'down';
        const canL = x > 0     && grid[below - 1] === NOI_AIR;
        const canR = x < W - 1 && grid[below + 1] === NOI_AIR;
        if (canL && canR) return 'both';
        if (canL) return 'left';
        if (canR) return 'right';
        return 'settled';
    }
    function arrow(cx, cy, dx, dy) {
        const ex = cx + dx * 5, ey = cy + dy * 5;
        ctx.beginPath();
        ctx.moveTo(cx - dx * 5, cy - dy * 5);
        ctx.lineTo(ex, ey);
        // arrowhead
        const a = Math.atan2(dy, dx);
        ctx.lineTo(ex - 4 * Math.cos(a - 0.5), ey - 4 * Math.sin(a - 0.5));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 4 * Math.cos(a + 0.5), ey - 4 * Math.sin(a + 0.5));
        ctx.stroke();
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, '#0d1117');
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const m = grid[y * W + x];
                if (m === NOI_SAND) ctx.fillStyle = '#cdb46e';
                else if (m === NOI_WALL) ctx.fillStyle = '#5c6070';
                else continue;
                ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
            }
        }
        // grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, H * CELL); ctx.stroke(); }
        for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(W * CELL, y * CELL + 0.5); ctx.stroke(); }
        // decision arrows on each sand cell
        ctx.lineWidth = 1.6;
        let moving = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (grid[y * W + x] !== NOI_SAND) continue;
                const d = decide(x, y);
                const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
                if (d === 'settled') {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
                    continue;
                }
                moving++;
                ctx.strokeStyle = d === 'down' ? '#ffd54f' : (d === 'both' ? '#ff9800' : '#ef5350');
                if (d === 'down')  arrow(cx, cy, 0, 1);
                if (d === 'left')  arrow(cx, cy, -0.7, 0.7);
                if (d === 'right') arrow(cx, cy, 0.7, 0.7);
                if (d === 'both') { arrow(cx, cy, -0.7, 0.7); arrow(cx, cy, 0.7, 0.7); }
            }
        }
        info.innerHTML = `tick <strong>${frame}</strong> · ` +
            `<span style="color:#ffd54f">↓ down</span> takes priority; ` +
            `<span style="color:#ff9800">diagonal</span> only if down is blocked · ` +
            `<strong>${moving}</strong> grains will move next Step`;
    }
    function step() { stepSand(grid, W, H, frame++); render(); }
    function loop() { if (running) step(); requestAnimationFrame(loop); }

    document.getElementById('btnRuleStep').addEventListener('click', () => { if (!running) step(); });
    document.getElementById('btnRuleRun').addEventListener('click', () => {
        running = !running;
        document.getElementById('btnRuleRun').textContent = running ? 'Pause' : 'Run';
    });
    document.getElementById('btnRuleReset').addEventListener('click', () => {
        build(); frame = 0; running = false;
        document.getElementById('btnRuleRun').textContent = 'Run';
        render();
    });

    build();
    render();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 3 — noiOrder: scan order & directional bias (the teleport bug, live)
// =============================================================================
(function noiOrderDemo() {
    const canvas = document.getElementById('noiOrder');
    if (!canvas) return;
    const info = document.getElementById('noiOrderInfo');

    const W = 240, H = 150;
    const grid = new Uint8Array(W * H);
    const render = noiMakeRenderer(canvas, W, H);
    let frame = 0, naive = false;
    const emitX = W >> 1;

    function emit() {
        // A steady source of sand at the top-centre.
        for (let x = emitX - 9; x <= emitX + 9; x++)
            if (grid[2 * W + x] === NOI_AIR) grid[2 * W + x] = NOI_SAND;
    }
    function loop() {
        if (frame % 5 === 0) emit();
        if (naive) stepSandNaive(grid, W, H);
        else       stepSand(grid, W, H, frame);
        frame++;
        render(grid);
        info.innerHTML = naive
            ? `<strong style="color:#ef5350">NAIVE top-down scan</strong> — ` +
              `sand <em>teleports</em> straight to the floor: each grain is re-visited ` +
              `lower down the same frame and moved again. No falling is ever drawn.`
            : `<strong style="color:#66bb6a">CORRECT bottom-up scan</strong> — ` +
              `each grain is visited before the cell below it, so it moves exactly ` +
              `one row per frame. You can see the stream fall.`;
        requestAnimationFrame(loop);
    }

    document.getElementById('btnOrderToggle').addEventListener('click', () => {
        naive = !naive;
        grid.fill(NOI_AIR);
        document.getElementById('btnOrderToggle').textContent =
            naive ? 'Scan: NAIVE (top-down)' : 'Scan: CORRECT (bottom-up)';
    });
    document.getElementById('btnOrderReset').addEventListener('click', () => grid.fill(NOI_AIR));

    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 4 — noiBucket: mini-project — paint walls, pour sand, watch it fill
// =============================================================================
(function noiBucketDemo() {
    const canvas = document.getElementById('noiBucket');
    if (!canvas) return;
    const info = document.getElementById('noiBucketInfo');

    const W = 240, H = 160;
    const grid = new Uint8Array(W * H);
    const render = noiMakeRenderer(canvas, W, H);
    let frame = 0, tool = NOI_SAND, drawing = false, mouse = null;

    function buildBucket() {
        grid.fill(NOI_AIR);
        // A pre-made wall bucket so there's a container to pour into on load.
        const L = 70, R = 170, top = 60, bot = 132;
        for (let y = top; y <= bot; y++) {
            for (let t = 0; t < 4; t++) { grid[y * W + (L + t)] = NOI_WALL; grid[y * W + (R - t)] = NOI_WALL; }
        }
        for (let x = L; x <= R; x++)
            for (let t = 0; t < 4; t++) grid[(bot + t) * W + x] = NOI_WALL;
    }
    function paint() {
        if (!mouse) return;
        const r = tool === NOI_WALL ? 4 : 6;
        // Sand only drops into air; wall/erase overwrite anything.
        if (tool === NOI_SAND) {
            for (let dy = -r; dy <= r; dy++)
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy > r * r) continue;
                    const x = mouse.x + dx, y = mouse.y + dy;
                    if (x < 0 || x >= W || y < 0 || y >= H) continue;
                    if (grid[y * W + x] === NOI_AIR) grid[y * W + x] = NOI_SAND;
                }
        } else {
            noiPaintDisc(grid, W, H, mouse.x, mouse.y, r, tool);
        }
    }
    function loop() {
        if (drawing) paint();
        // Two sub-steps per frame so the bucket fills at a lively pace.
        stepSand(grid, W, H, frame++);
        stepSand(grid, W, H, frame++);
        render(grid);
        requestAnimationFrame(loop);
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = noiMouseCell(canvas, e, W, H); });
    canvas.addEventListener('mousemove', (e) => { mouse = noiMouseCell(canvas, e, W, H); });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const tools = [['btnBucketSand', NOI_SAND], ['btnBucketWall', NOI_WALL], ['btnBucketErase', NOI_AIR]];
    function selectTool(id, mat) {
        tool = mat;
        tools.forEach(([tid]) => document.getElementById(tid).classList.toggle('active', tid === id));
        info.textContent = mat === NOI_SAND ? 'Pour sand into the bucket — drag to fill it.'
                         : mat === NOI_WALL ? 'Draw walls — build or extend the container.'
                                            : 'Erase — clear sand or walls.';
    }
    tools.forEach(([id, mat]) => document.getElementById(id).addEventListener('click', () => selectTool(id, mat)));
    document.getElementById('btnBucketClear').addEventListener('click', buildBucket);
    selectTool('btnBucketSand', NOI_SAND);

    buildBucket();
    requestAnimationFrame(loop);
})();
