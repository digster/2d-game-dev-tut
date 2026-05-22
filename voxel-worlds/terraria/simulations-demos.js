// =============================================================================
// TERRARIA SUB-TRACK — SIMULATIONS TIER DEMOS
// =============================================================================
// Deep-dive visualisers. Where the gameplay tiers HIDE an algorithm behind a
// fun result, these demos EXPOSE it — the raw noise field, the BFS frontier
// ring by ring, each water cell's pending decision, an ore-by-depth histogram.
// Self-contained per the convention that each <tier>-demos.js stands alone.
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
// Palette + materials.
// ---------------------------------------------------------------------------
const VOX_COLORS = {
    bg: '#0d1117',
    sky: '#1a2547',
    panel: '#11162a',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    ok: '#66bb6a',
    bad: '#ef5350',
    cyan: '#4fc3f7',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e'
};

const VOX_MATERIALS = [
    { id: 0,  name: 'air',    color: null,      solid: false },
    { id: 1,  name: 'dirt',   color: '#7a4f2b', solid: true  },
    { id: 2,  name: 'grass',  color: '#4a8a3a', solid: true  },
    { id: 3,  name: 'stone',  color: '#6e6e7a', solid: true  },
    { id: 4,  name: 'ore',    color: '#d4a843', solid: true  },
    { id: 5,  name: 'wood',   color: '#8a5a2a', solid: true  },
    { id: 6,  name: 'sand',   color: '#d7c878', solid: true  },
    { id: 7,  name: 'water',  color: '#4288d4', solid: false },
    { id: 8,  name: 'gravel', color: '#888078', solid: true  },
    { id: 9,  name: 'torch',  color: '#ffcc66', solid: false },
    { id: 10, name: 'snow',   color: '#dfe9f0', solid: true  }
];

function hash2D(x, y, seed = 0) {
    let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}
function screenToTile(sx, sy, tile, cameraX = 0, cameraY = 0) {
    return { x: Math.floor((sx + cameraX) / tile), y: Math.floor((sy + cameraY) / tile) };
}
function isSolid(id) { const m = VOX_MATERIALS[id]; return !!(m && m.solid); }
// NOTE: `lerp` is provided globally by shared/utils.js (lerp(start, end, t)).
// We deliberately do NOT re-declare it — a top-level `const lerp` here would
// collide with that global and throw a redeclaration error that kills the
// whole file at instantiation. Only declare names utils.js doesn't already own.
const clamp01 = v => Math.max(0, Math.min(1, v));
function smoothstep(a, b, x) {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
}

class TileWorld {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = new Uint8Array(width * height);
    }
    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.tiles[y * this.width + x];
    }
    set(x, y, v) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.tiles[y * this.width + x] = v;
    }
    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
}

function drawTile(ctx, sx, sy, size, id) {
    const m = VOX_MATERIALS[id];
    if (!m || !m.color) return;
    ctx.fillStyle = m.color;
    ctx.fillRect(sx, sy, size, size);
    if (size >= 7) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(sx, sy + size - 2, size, 2);
        ctx.fillRect(sx + size - 2, sy, 2, size);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(sx, sy, size, 1);
    }
}

// --- Noise -----------------------------------------------------------------

function smoothNoise2D(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const n00 = hash2D(x0, y0, seed),     n10 = hash2D(x0 + 1, y0, seed);
    const n01 = hash2D(x0, y0 + 1, seed), n11 = hash2D(x0 + 1, y0 + 1, seed);
    const nx0 = n00 + (n10 - n00) * sx, nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
}
function fbm2D(x, y, seed, octaves) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
        sum += amp * smoothNoise2D(x * freq, y * freq, seed + o * 1013);
        norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
}
function surfaceHeight(wx, seed, baseY, amp) {
    return Math.floor(baseY + (fbm2D(wx * 0.045, 13.7, seed, 4) - 0.5) * 2 * amp);
}

// =============================================================================
// DEMO 1 — voxSimCaves: see the noise field BEHIND the caves; compare carvers
// =============================================================================
(function voxSimCavesDemo() {
    const canvas = document.getElementById('voxSimCaves');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxSimCavesInfo');
    const slAmount = document.getElementById('voxSimCavesAmount');
    const vAmount = document.getElementById('voxSimCavesAmountValue');
    const btnMethod = document.getElementById('btnSimCavesMethod');
    const btnNoise = document.getElementById('btnSimCavesNoise');
    const btnRegen = document.getElementById('btnSimCavesRegen');
    ctx.imageSmoothingEnabled = false;

    const W = 60, H = 33, TILE = 12;
    const world = new TileWorld(W, H);
    let seed = 4, method = 'iso', showNoise = false;

    // Worm-walk: random walkers carve discs along a wandering path — the
    // alternative to noise-iso-band caves.
    function carveWorms(count, length) {
        for (let w = 0; w < count; w++) {
            let x = 4 + Math.random() * (W - 8);
            let y = H * 0.45 + Math.random() * (H * 0.45);
            let angle = Math.random() * Math.PI * 2;
            for (let s = 0; s < length; s++) {
                for (let dy = -2; dy <= 2; dy++)
                    for (let dx = -2; dx <= 2; dx++)
                        if (dx * dx + dy * dy <= 4) {
                            const cx = (x + dx) | 0, cy = (y + dy) | 0;
                            if (world.get(cx, cy) !== 0) world.set(cx, cy, 0);
                        }
                angle += (Math.random() - 0.5) * 0.7;
                x += Math.cos(angle);
                y += Math.sin(angle) * 0.7;
                if (x < 2 || x > W - 2 || y < 4 || y > H - 2) break;
            }
        }
    }
    function regen() {
        const amount = parseInt(slAmount.value, 10) / 1000;
        // Base terrain (no caves yet).
        for (let wx = 0; wx < W; wx++) {
            const surf = surfaceHeight(wx, seed, 10, 5);
            for (let wy = 0; wy < H; wy++) {
                let id = 0;
                if (wy === surf) id = 2;
                else if (wy > surf && wy < surf + 4) id = 1;
                else if (wy >= surf + 4) id = 3;
                world.set(wx, wy, id);
            }
        }
        if (method === 'iso') {
            // Carve where the 2D noise lands in a thin iso-band around 0.5.
            for (let wx = 0; wx < W; wx++) {
                const surf = surfaceHeight(wx, seed, 10, 5);
                for (let wy = surf + 3; wy < H; wy++)
                    if (Math.abs(fbm2D(wx * 0.08, wy * 0.08, seed + 99, 3) - 0.5) < amount)
                        world.set(wx, wy, 0);
            }
        } else {
            carveWorms(4 + (amount * 60) | 0, 90);
        }
        render();
    }

    function render() {
        const amount = parseInt(slAmount.value, 10) / 1000;
        vAmount.textContent = amount.toFixed(3);
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));

        // Optional: the raw fBm field the iso-band reads, as a translucent overlay.
        if (showNoise && method === 'iso') {
            for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                    const n = fbm2D(x * 0.08, y * 0.08, seed + 99, 3);
                    const inBand = Math.abs(n - 0.5) < amount;
                    ctx.fillStyle = inBand
                        ? 'rgba(79,195,247,0.5)'
                        : `rgba(${(n * 255) | 0},${(n * 255) | 0},${(n * 255) | 0},0.55)`;
                    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                }
        }
        info.innerHTML = `method: <strong>${method === 'iso' ? 'noise iso-band' : 'worm-walk'}</strong> · ` +
            (method === 'iso'
                ? `caves = where |fBm − 0.5| &lt; ${amount.toFixed(3)}` +
                  (showNoise ? ' · <strong>cyan = the carved band</strong>' : ' · toggle the noise overlay')
                : `${4 + (amount * 60) | 0} random walkers carving discs`);
    }

    slAmount.addEventListener('input', regen);
    btnMethod.addEventListener('click', () => {
        method = method === 'iso' ? 'worm' : 'iso';
        btnMethod.textContent = method === 'iso' ? 'Method: noise iso-band' : 'Method: worm-walk';
        regen();
    });
    btnNoise.addEventListener('click', () => {
        showNoise = !showNoise;
        btnNoise.classList.toggle('active', showNoise);
        render();
    });
    btnRegen.addEventListener('click', () => { seed = (Math.random() * 1000) | 0; regen(); });

    regen();
})();

// =============================================================================
// DEMO 2 — voxSimBiome: the biome-selection noise, and blending across borders
// =============================================================================
(function voxSimBiomeDemo() {
    const canvas = document.getElementById('voxSimBiome');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxSimBiomeInfo');
    const slBlend = document.getElementById('voxSimBiomeBlend');
    const vBlend = document.getElementById('voxSimBiomeBlendValue');
    const btnRegen = document.getElementById('btnSimBiomeRegen');
    ctx.imageSmoothingEnabled = false;

    const W = 72, TILE = 10;
    const GRAPH_H = 110;
    const worldTop = GRAPH_H + 10;
    const H = Math.floor((canvas.height - worldTop) / TILE);
    let seed = 9;

    const DESERT = [215, 200, 120], FOREST = [74, 138, 58], TUNDRA = [223, 233, 240];
    const T1 = 0.36, T2 = 0.66;                  // biome thresholds

    function biomeNoise(x) { return smoothNoise2D(x * 0.012, 4.2, seed + 777); }
    function lerp3(a, b, k) {
        return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    }
    // With blend = 0 this is a hard step; with blend > 0 the colour ramps
    // smoothly across each threshold.
    function biomeColor(b, blend) {
        if (blend <= 0.0001) {
            return b < T1 ? DESERT : (b > T2 ? TUNDRA : FOREST);
        }
        const k1 = smoothstep(T1 - blend, T1 + blend, b);   // desert -> forest
        const k2 = smoothstep(T2 - blend, T2 + blend, b);   // forest -> tundra
        return lerp3(lerp3(DESERT, FOREST, k1), TUNDRA, k2);
    }

    function render() {
        const blend = parseInt(slBlend.value, 10) / 1000;
        vBlend.textContent = blend.toFixed(3);
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.bg);

        // --- graph panel: biome-selection noise across x ---
        ctx.fillStyle = VOX_COLORS.panel;
        ctx.fillRect(0, 0, canvas.width, GRAPH_H);
        // threshold lines
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        for (const [thr, label] of [[T1, 'desert / forest'], [T2, 'forest / tundra']]) {
            const gy = GRAPH_H - thr * GRAPH_H;
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
            ctx.fillStyle = VOX_COLORS.labelMuted;
            ctx.font = '10px monospace';
            ctx.fillText(label, 6, gy - 3);
        }
        // the noise curve
        ctx.beginPath();
        for (let x = 0; x <= W; x++) {
            const gy = GRAPH_H - biomeNoise(x) * GRAPH_H;
            if (x === 0) ctx.moveTo(x * TILE, gy); else ctx.lineTo(x * TILE, gy);
        }
        ctx.strokeStyle = VOX_COLORS.cyan;
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- world panel: surface coloured by (blended) biome ---
        for (let x = 0; x < W; x++) {
            const surf = 6 + Math.round(Math.sin(x * 0.4) * 1.5 + Math.sin(x * 0.13) * 2);
            const col = biomeColor(biomeNoise(x), blend);
            const colStr = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
            for (let y = 0; y < H; y++) {
                const wy = worldTop + y * TILE;
                if (y < surf) { /* sky */ }
                else if (y < surf + 3) { ctx.fillStyle = colStr; ctx.fillRect(x * TILE, wy, TILE, TILE); }
                else { drawTile(ctx, x * TILE, wy, TILE, y < surf + 6 ? 1 : 3); }
            }
        }
        ctx.fillStyle = VOX_COLORS.label;
        ctx.font = 'bold 11px monospace';
        ctx.fillText('biome-selection noise (cyan) — thresholds split desert / forest / tundra', 8, 16);

        info.innerHTML = blend < 0.001
            ? `blend = <strong>0</strong> — hard biome borders (a sharp colour step at each threshold)`
            : `blend = <strong>${blend.toFixed(3)}</strong> — surface colour ramps smoothly across each threshold`;
    }

    slBlend.addEventListener('input', render);
    btnRegen.addEventListener('click', () => { seed = (Math.random() * 1000) | 0; render(); });
    render();
})();

// =============================================================================
// DEMO 3 — voxSimLight: flood-fill light revealed one BFS ring at a time
// =============================================================================
(function voxSimLightDemo() {
    const canvas = document.getElementById('voxSimLight');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxSimLightInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 51, H = 28, TILE = 14;
    const world = new TileWorld(W, H);
    const light = new Float32Array(W * H);
    const seen = new Uint8Array(W * H);
    let frontier = [], ring = 0, running = false, torch = { x: 25, y: 14 };
    const FALLOFF = 0.055;

    function buildCave() {
        // Solid rock with a blobby cave carved around the torch.
        for (let i = 0; i < world.tiles.length; i++) world.tiles[i] = 3;
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                let open = false;
                for (const c of [[25, 14, 9], [16, 10, 6], [36, 18, 7], [30, 21, 5]])
                    if (Math.hypot(x - c[0], y - c[1]) < c[2] - hash2D(x, y, 3) * 1.6) open = true;
                if (open) world.set(x, y, 0);
            }
        world.set(torch.x, torch.y, 9);
    }
    function resetFlood() {
        light.fill(0);
        seen.fill(0);
        ring = 0;
        running = false;
        document.getElementById('btnSimLightRun').textContent = 'Run';
        light[torch.y * W + torch.x] = 1;
        seen[torch.y * W + torch.x] = 1;
        frontier = [{ x: torch.x, y: torch.y }];
        render();
    }
    // One BFS ring: relax light into every unseen, non-solid neighbour.
    function step() {
        if (!frontier.length) return;
        const next = [];
        const lv = Math.max(0, 1 - (ring + 1) * FALLOFF);
        for (const c of frontier) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = c.x + dx, ny = c.y + dy;
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const ni = ny * W + nx;
                if (seen[ni] || isSolid(world.get(nx, ny))) continue;  // walls block
                seen[ni] = 1;
                light[ni] = lv;
                next.push({ x: nx, y: ny });
            }
        }
        frontier = next;
        ring++;
        render();
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.bg);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        // Darkness overlay from the light computed so far.
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const d = 1 - light[y * W + x];
                if (d <= 0.02) continue;
                ctx.fillStyle = `rgba(4,6,14,${d.toFixed(3)})`;
                ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
            }
        // The current BFS frontier — the ring about to be processed.
        ctx.strokeStyle = VOX_COLORS.accent;
        ctx.lineWidth = 2;
        for (const c of frontier)
            ctx.strokeRect(c.x * TILE + 1, c.y * TILE + 1, TILE - 2, TILE - 2);
        // Torch marker.
        ctx.fillStyle = '#ffcc66';
        ctx.beginPath();
        ctx.arc(torch.x * TILE + TILE / 2, torch.y * TILE + TILE / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        info.innerHTML = `BFS ring <strong>${ring}</strong> · frontier <strong>${frontier.length}</strong> tiles · ` +
            (frontier.length
                ? `each Step relaxes light one tile further out — brightness = 1 − ring × ${FALLOFF}`
                : `<strong style="color:${VOX_COLORS.ok}">flood complete</strong> — the whole connected cave is lit`);
    }

    function loop() {
        if (running && frontier.length) step();
        requestAnimationFrame(loop);
    }

    document.getElementById('btnSimLightStep').addEventListener('click', () => { if (!running) step(); });
    document.getElementById('btnSimLightRun').addEventListener('click', () => {
        running = !running;
        document.getElementById('btnSimLightRun').textContent = running ? 'Pause' : 'Run';
    });
    document.getElementById('btnSimLightReset').addEventListener('click', resetFlood);

    buildCave();
    resetFlood();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 4 — voxSimFlow: the water automaton with each cell's pending move shown
// =============================================================================
(function voxSimFlowDemo() {
    const canvas = document.getElementById('voxSimFlow');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxSimFlowInfo');
    ctx.imageSmoothingEnabled = false;

    const W = 55, H = 30, TILE = 13;
    let world, running = false, drawing = false, ticks = 0;

    function buildBowl() {
        const w = new TileWorld(W, H);
        for (let x = 0; x < W; x++) { w.set(x, H - 1, 3); w.set(x, H - 2, 3); }
        for (let y = H - 14; y < H - 2; y++) { w.set(6, y, 3); w.set(W - 7, y, 3); }
        for (let x = 18; x < 37; x++) w.set(x, H - 8, 3);   // a shelf to pool on
        return w;
    }
    // The rule a water tile WOULD apply this tick — pure, no mutation.
    function decision(x, y) {
        if (world.get(x, y + 1) === 0) return 'down';
        const dl = world.get(x - 1, y + 1) === 0 && world.get(x - 1, y) === 0;
        const dr = world.get(x + 1, y + 1) === 0 && world.get(x + 1, y) === 0;
        if (dl || dr) return 'diag';
        const sl = world.get(x - 1, y) === 0, sr = world.get(x + 1, y) === 0;
        if (sl || sr) return 'side';
        return 'settled';
    }
    function stepWater() {
        for (let y = H - 2; y >= 0; y--) {
            for (let x = 0; x < W; x++) {
                if (world.get(x, y) !== 7) continue;
                if (world.get(x, y + 1) === 0) { world.set(x, y, 0); world.set(x, y + 1, 7); continue; }
                const dl = world.get(x - 1, y + 1) === 0 && world.get(x - 1, y) === 0;
                const dr = world.get(x + 1, y + 1) === 0 && world.get(x + 1, y) === 0;
                if (dl || dr) {
                    const dx = (dl && dr) ? (Math.random() < 0.5 ? -1 : 1) : (dl ? -1 : 1);
                    world.set(x, y, 0); world.set(x + dx, y + 1, 7); continue;
                }
                const sl = world.get(x - 1, y) === 0, sr = world.get(x + 1, y) === 0;
                if (sl || sr) {
                    const dx = (sl && sr) ? (Math.random() < 0.5 ? -1 : 1) : (sl ? -1 : 1);
                    world.set(x, y, 0); world.set(x + dx, y, 7);
                }
            }
        }
        ticks++;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                drawTile(ctx, x * TILE, y * TILE, TILE, world.get(x, y));
        // Decision overlay — the move each water tile is about to make.
        let down = 0, diag = 0, side = 0, settled = 0;
        ctx.lineWidth = 1.5;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (world.get(x, y) !== 7) continue;
                const d = decision(x, y);
                const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
                if (d === 'settled') {
                    settled++;
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
                    continue;
                }
                ctx.strokeStyle = d === 'down' ? '#ffd54f' : d === 'diag' ? '#ff9800' : '#ef5350';
                if (d === 'down') down++; else if (d === 'diag') diag++; else side++;
                ctx.beginPath();
                ctx.moveTo(cx, cy - 3);
                ctx.lineTo(cx, cy + 3);
                ctx.moveTo(cx - 2, cy + 1);
                ctx.lineTo(cx, cy + 3);
                ctx.lineTo(cx + 2, cy + 1);
                ctx.stroke();
            }
        }
        info.innerHTML = `tick <strong>${ticks}</strong> · pending moves — ` +
            `<span style="color:#ffd54f">down ${down}</span> · ` +
            `<span style="color:#ff9800">diagonal ${diag}</span> · ` +
            `<span style="color:#ef5350">sideways ${side}</span> · settled ${settled}`;
    }

    function loop() {
        if (running) { stepWater(); }
        render();
        requestAnimationFrame(loop);
    }
    function pour(e) {
        const r = canvas.getBoundingClientRect();
        const t = screenToTile(e.clientX - r.left, e.clientY - r.top, TILE);
        for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++)
                if (world.get(t.x + dx, t.y + dy) === 0) world.set(t.x + dx, t.y + dy, 7);
    }
    function reset() {
        world = buildBowl(); ticks = 0; running = false;
        document.getElementById('btnSimFlowRun').textContent = 'Run';
    }

    canvas.addEventListener('mousedown', (e) => { drawing = true; pour(e); });
    canvas.addEventListener('mousemove', (e) => { if (drawing) pour(e); });
    window.addEventListener('mouseup', () => { drawing = false; });
    document.getElementById('btnSimFlowStep').addEventListener('click', () => { if (!running) stepWater(); });
    document.getElementById('btnSimFlowRun').addEventListener('click', () => {
        running = !running;
        document.getElementById('btnSimFlowRun').textContent = running ? 'Pause' : 'Run';
    });
    document.getElementById('btnSimFlowReset').addEventListener('click', reset);

    reset();
    requestAnimationFrame(loop);
})();

// =============================================================================
// DEMO 5 — voxSimOre: ore distribution + a depth histogram of what was placed
// =============================================================================
(function voxSimOreDemo() {
    const canvas = document.getElementById('voxSimOre');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxSimOreInfo');
    const slRich = document.getElementById('voxSimOreRich');
    const vRich = document.getElementById('voxSimOreRichValue');
    const btnRegen = document.getElementById('btnSimOreRegen');
    ctx.imageSmoothingEnabled = false;

    const W = 40, H = 33, TILE = 12;
    const worldW = W * TILE;                       // left panel
    const histX = worldW + 16;
    const histW = canvas.width - histX - 12;
    const world = new TileWorld(W, H);
    const surf = [];
    let seed = 12;

    // Ore threshold falls with depth — deeper rock is richer.
    function oreThreshold(depthFrac, richness) {
        return 0.84 - depthFrac * 0.13 - richness;
    }
    function regen() {
        const richness = parseInt(slRich.value, 10) / 100;
        vRich.textContent = richness.toFixed(2);
        for (let x = 0; x < W; x++) {
            surf[x] = surfaceHeight(x, seed, 8, 3);
            for (let y = 0; y < H; y++) {
                let id = 0;
                if (y === surf[x]) id = 2;
                else if (y > surf[x] && y < surf[x] + 4) id = 1;
                else if (y >= surf[x] + 4) {
                    id = 3;
                    const depthFrac = Math.min(1, (y - surf[x]) / 28);
                    if (fbm2D(x * 0.3, y * 0.3, seed + 555, 2) > oreThreshold(depthFrac, richness)) id = 4;
                }
                world.set(x, y, id);
            }
        }
        render();
    }

    function render() {
        const richness = parseInt(slRich.value, 10) / 100;
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.bg);

        // --- left: world cross-section, ore highlighted ---
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const id = world.get(x, y);
                if (id === 4) {
                    ctx.fillStyle = '#ffd54f';
                    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                } else if (id !== 0) {
                    drawTile(ctx, x * TILE, y * TILE, TILE, id);
                    ctx.fillStyle = 'rgba(13,17,23,0.45)';   // dim non-ore so ore pops
                    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                }
            }

        // --- right: histogram of ore count per depth band ---
        const BINS = 14;
        const counts = new Array(BINS).fill(0);
        let totalOre = 0;
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                if (world.get(x, y) === 4) {
                    const depthFrac = Math.min(0.999, (y - surf[x]) / 28);
                    counts[(depthFrac * BINS) | 0]++;
                    totalOre++;
                }
        const maxCount = Math.max(1, ...counts);
        ctx.fillStyle = VOX_COLORS.panel;
        ctx.fillRect(histX - 6, 0, canvas.width - histX + 6, canvas.height);
        ctx.fillStyle = VOX_COLORS.label;
        ctx.font = 'bold 11px monospace';
        ctx.fillText('ore per depth →', histX, 16);
        const binH = (canvas.height - 40) / BINS;
        for (let b = 0; b < BINS; b++) {
            const bw = (counts[b] / maxCount) * histW;
            const by = 26 + b * binH;
            ctx.fillStyle = '#ffd54f';
            ctx.fillRect(histX, by, bw, binH - 2);
            // the threshold curve sample for this depth band
            const thr = oreThreshold(b / BINS, richness);
            ctx.fillStyle = VOX_COLORS.cyan;
            const tx = histX + clamp01(1 - thr) * histW;
            ctx.fillRect(tx - 1, by, 2, binH - 2);
        }
        ctx.fillStyle = VOX_COLORS.labelMuted;
        ctx.font = '9px monospace';
        ctx.fillText('shallow', histX, 24);
        ctx.fillText('deep', histX, canvas.height - 6);
        ctx.fillStyle = VOX_COLORS.cyan;
        ctx.fillText('cyan = ore threshold', histX, canvas.height - 18);

        info.innerHTML = `richness <strong>${richness.toFixed(2)}</strong> · ` +
            `<strong>${totalOre}</strong> ore tiles — the histogram skews deep because the ` +
            `threshold drops with depth (cyan line moves right = easier to spawn ore)`;
    }

    slRich.addEventListener('input', regen);
    btnRegen.addEventListener('click', () => { seed = (Math.random() * 1000) | 0; regen(); });
    regen();
})();
