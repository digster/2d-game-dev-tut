// =============================================================================
// NOITA SUB-TRACK — BEGINNER TIER EXPORT BUNDLES
// =============================================================================
// Feeds shared/export-demo.js: the 📋 Export button on each
// `<details data-demo-id="noi_*">` copies a runnable single-file HTML.
//
// Canvas-ID convention: the standalone scaffold hardcodes `<canvas id="canvas">`
// and `<div id="info">`; the DEMO_CODE strings below target those fixed IDs.
//
// Scope: the two button-only demos are bundled — noi_rule (Step/Run/Reset) and
// noi_bucket (Sand/Wall/Erase/Reset). noiEngine and noiOrder omit `data-demo-id`
// (noiEngine's brush demo and noiOrder's toggle export cleanly too, but two
// representative exports is the bar). Each DEMO_CODE is fully self-contained —
// `data-deps` is empty, no DEPENDENCY_BUNDLES needed.
//
// TypeScript: DEMO_CODE_TS aliases the JS forms — plain JS is valid TS.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// =============================================================================
// DEMO — noi_rule: the falling-sand rule on a coarse, stepped grid
// =============================================================================
DEMO_HTML.noi_rule = {
    title: 'Noita — The Falling-Sand Rule (stepper)',
    canvas: { width: 704, height: 400 },
    controls: [
        { id: 'btnRuleStep',  text: 'Step once' },
        { id: 'btnRuleRun',   text: 'Run' },
        { id: 'btnRuleReset', text: 'Reset' }
    ],
    info: 'Step the rule one tick at a time.'
};

DEMO_CODE.noi_rule = `(function noiRuleDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    const AIR = 0, SAND = 1, WALL = 2;
    const W = 44, H = 25, CELL = 16;
    let grid, frame = 0, running = false;

    function build() {
        grid = new Uint8Array(W * H);
        for (let x = 0; x < W; x++) grid[(H - 1) * W + x] = WALL;
        for (let x = 14; x < 30; x++) grid[(H - 8) * W + x] = WALL;
        for (let x = 6; x < 38; x++)
            for (let y = 3; y < 11; y++)
                if ((x * 3 + y * 5) % 7 === 0) grid[y * W + x] = SAND;
    }
    function stepSand() {
        const ltr = (frame & 1) === 0;
        for (let y = H - 2; y >= 0; y--) {
            for (let k = 0; k < W; k++) {
                const x = ltr ? k : W - 1 - k;
                const i = y * W + x;
                if (grid[i] !== SAND) continue;
                const below = i + W;
                if (grid[below] === AIR) { grid[i] = AIR; grid[below] = SAND; continue; }
                const canL = x > 0     && grid[below - 1] === AIR;
                const canR = x < W - 1 && grid[below + 1] === AIR;
                if (canL || canR) {
                    const dir = (canL && canR) ? (Math.random() < 0.5 ? -1 : 1) : (canL ? -1 : 1);
                    grid[i] = AIR; grid[below + dir] = SAND;
                }
            }
        }
        frame++;
    }
    function decide(x, y) {
        if (y >= H - 1) return 'settled';
        const below = (y + 1) * W + x;
        if (grid[below] === AIR) return 'down';
        const canL = x > 0     && grid[below - 1] === AIR;
        const canR = x < W - 1 && grid[below + 1] === AIR;
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
        const a = Math.atan2(dy, dx);
        ctx.lineTo(ex - 4 * Math.cos(a - 0.5), ey - 4 * Math.sin(a - 0.5));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 4 * Math.cos(a + 0.5), ey - 4 * Math.sin(a + 0.5));
        ctx.stroke();
    }
    function render() {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const m = grid[y * W + x];
                if (m === SAND) ctx.fillStyle = '#cdb46e';
                else if (m === WALL) ctx.fillStyle = '#5c6070';
                else continue;
                ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
            }
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(x*CELL+0.5,0); ctx.lineTo(x*CELL+0.5,H*CELL); ctx.stroke(); }
        for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(0,y*CELL+0.5); ctx.lineTo(W*CELL,y*CELL+0.5); ctx.stroke(); }
        ctx.lineWidth = 1.6;
        let moving = 0;
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                if (grid[y * W + x] !== SAND) continue;
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
        info.textContent = 'tick ' + frame + ' · down takes priority, diagonal only if blocked · ' +
            moving + ' grains will move next Step';
    }
    function step() { stepSand(); render(); }
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
    build(); render();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.noi_rule = DEMO_CODE.noi_rule;

// =============================================================================
// DEMO — noi_bucket: the falling-sand sandbox (sand + walls), ImageData-rendered
// =============================================================================
DEMO_HTML.noi_bucket = {
    title: 'Noita — Bucket of Sand (sandbox)',
    canvas: { width: 720, height: 480 },
    controls: [
        { id: 'btnBucketSand',  text: '🟡 Sand' },
        { id: 'btnBucketWall',  text: '⬜ Wall' },
        { id: 'btnBucketErase', text: '🧽 Erase' },
        { id: 'btnBucketClear', text: 'Reset bucket' }
    ],
    info: 'Pick a tool and drag on the canvas.'
};

DEMO_CODE.noi_bucket = `(function noiBucketDemo() {
    const canvas = document.getElementById('canvas');
    const info = document.getElementById('info');

    const AIR = 0, SAND = 1, WALL = 2;
    const W = 240, H = 160;
    const grid = new Uint8Array(W * H);
    let frame = 0, tool = SAND, drawing = false, mouse = null;

    function noiHash(i) {
        let h = (i * 374761393) | 0;
        h = (h ^ (h >>> 13)) * 1274126177;
        h = h ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
    }
    function stepSand() {
        const ltr = (frame & 1) === 0;
        for (let y = H - 2; y >= 0; y--) {
            for (let k = 0; k < W; k++) {
                const x = ltr ? k : W - 1 - k;
                const i = y * W + x;
                if (grid[i] !== SAND) continue;
                const below = i + W;
                if (grid[below] === AIR) { grid[i] = AIR; grid[below] = SAND; continue; }
                const canL = x > 0     && grid[below - 1] === AIR;
                const canR = x < W - 1 && grid[below + 1] === AIR;
                if (canL || canR) {
                    const dir = (canL && canR) ? (Math.random() < 0.5 ? -1 : 1) : (canL ? -1 : 1);
                    grid[i] = AIR; grid[below + dir] = SAND;
                }
            }
        }
        frame++;
    }
    // ImageData renderer: write RGBA bytes, putImageData, drawImage scaled up.
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const offCtx = off.getContext('2d');
    const img = offCtx.createImageData(W, H);
    const data = img.data;
    function render() {
        for (let i = 0; i < grid.length; i++) {
            const p = i << 2, m = grid[i];
            if (m === SAND) {
                const j = (noiHash(i) * 28 - 14) | 0;
                data[p] = 206 + j; data[p+1] = 180 + j; data[p+2] = 110 + j;
            } else if (m === WALL) {
                data[p] = 92; data[p+1] = 96; data[p+2] = 108;
            } else {
                data[p] = 13; data[p+1] = 17; data[p+2] = 30;
            }
            data[p+3] = 255;
        }
        offCtx.putImageData(img, 0, 0);
        ctx.drawImage(off, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
    }
    function buildBucket() {
        grid.fill(AIR);
        const L = 70, R = 170, top = 60, bot = 132;
        for (let y = top; y <= bot; y++)
            for (let t = 0; t < 4; t++) { grid[y*W+(L+t)] = WALL; grid[y*W+(R-t)] = WALL; }
        for (let x = L; x <= R; x++)
            for (let t = 0; t < 4; t++) grid[(bot+t)*W+x] = WALL;
    }
    function mouseCell(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: Math.floor((e.clientX - r.left) / r.width * W),
            y: Math.floor((e.clientY - r.top) / r.height * H)
        };
    }
    function paint() {
        if (!mouse) return;
        const rad = tool === WALL ? 4 : 6;
        for (let dy = -rad; dy <= rad; dy++)
            for (let dx = -rad; dx <= rad; dx++) {
                if (dx*dx + dy*dy > rad*rad) continue;
                const x = mouse.x + dx, y = mouse.y + dy;
                if (x < 0 || x >= W || y < 0 || y >= H) continue;
                if (tool === SAND) { if (grid[y*W+x] === AIR) grid[y*W+x] = SAND; }
                else grid[y*W+x] = tool;
            }
    }
    function loop() {
        if (drawing) paint();
        stepSand(); stepSand();
        render();
        requestAnimationFrame(loop);
    }
    canvas.addEventListener('mousedown', (e) => { drawing = true; mouse = mouseCell(e); });
    canvas.addEventListener('mousemove', (e) => { mouse = mouseCell(e); });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const tools = [['btnBucketSand', SAND], ['btnBucketWall', WALL], ['btnBucketErase', AIR]];
    function selectTool(id, mat) {
        tool = mat;
        tools.forEach(function (t) {
            document.getElementById(t[0]).classList.toggle('active', t[0] === id);
        });
    }
    tools.forEach(function (t) {
        document.getElementById(t[0]).addEventListener('click', () => selectTool(t[0], t[1]));
    });
    document.getElementById('btnBucketClear').addEventListener('click', buildBucket);
    selectTool('btnBucketSand', SAND);

    buildBucket();
    requestAnimationFrame(loop);
})();`;

DEMO_CODE_TS.noi_bucket = DEMO_CODE.noi_bucket;
