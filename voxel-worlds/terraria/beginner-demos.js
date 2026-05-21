// =============================================================================
// TERRARIA SUB-TRACK — BEGINNER TIER DEMOS
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak into the global
// scope. Each one runs only if its target canvas exists in the DOM — that way
// the file is safe to include from any page in the track even if a canvas is
// missing.
//
// Module-level helpers (VOX_COLORS, VOX_MATERIALS, hash2D, tileToScreen,
// screenToTile, TileWorld, drawTile, drawTileTextured, renderViewport) are
// defined once at the top and reused across demos.
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
// Shared palette so all demos match the project theme.
// ---------------------------------------------------------------------------
const VOX_COLORS = {
    bg: '#0d1117',
    sky: '#1a2547',
    grid: '#2a3550',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    hover: '#ff7043',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e',
    cull: '#ef5350'
};

// Material table — IDs map 1:1 with the indexes here, so VOX_MATERIALS[3] is stone.
// Convention: ID 0 is always "air".
const VOX_MATERIALS = [
    { id: 0, name: 'air',   color: null,      solid: false },
    { id: 1, name: 'dirt',  color: '#7a4f2b', solid: true  },
    { id: 2, name: 'grass', color: '#4a8a3a', solid: true  },
    { id: 3, name: 'stone', color: '#6e6e7a', solid: true  },
    { id: 4, name: 'ore',   color: '#d4a843', solid: true  },
    { id: 5, name: 'wood',  color: '#8a5a2a', solid: true  },
    { id: 6, name: 'sand',  color: '#d7c878', solid: true  },
    { id: 7, name: 'water', color: '#4fc3f7', solid: false }
];

// Cheap deterministic 2D hash — same (x, y, seed) -> same value forever.
function hash2D(x, y, seed = 0) {
    let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}

// Tile coord <-> screen pixel.
function tileToScreen(tx, ty, tile, cameraX = 0, cameraY = 0) {
    return { x: tx * tile - cameraX, y: ty * tile - cameraY };
}
function screenToTile(sx, sy, tile, cameraX = 0, cameraY = 0) {
    return {
        x: Math.floor((sx + cameraX) / tile),
        y: Math.floor((sy + cameraY) / tile)
    };
}

// Tile-data container.
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

// Solid-color draw (used by the early demos).
function drawTile(ctx, sx, sy, size, materialId) {
    const m = VOX_MATERIALS[materialId];
    if (!m || !m.color) return;
    ctx.fillStyle = m.color;
    ctx.fillRect(sx, sy, size, size);
}

// Jitter a hex color deterministically per (x, y) coord.
function jitterColor(hex, x, y, amount = 12, seed = 0) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = (hash2D(x, y, seed)     * 2 - 1) * amount;
    const dg = (hash2D(x, y, seed + 1) * 2 - 1) * amount;
    const db = (hash2D(x, y, seed + 2) * 2 - 1) * amount;
    const c = v => Math.max(0, Math.min(255, v | 0));
    return `rgb(${c(r + dr)}, ${c(g + dg)}, ${c(b + db)})`;
}

// Textured draw — used by the palette/camera/layers demos.
function drawTileTextured(ctx, sx, sy, size, materialId, tx, ty, opts) {
    const m = VOX_MATERIALS[materialId];
    if (!m || !m.color) return;
    const seed = (opts && opts.seed) || 0;
    const jit  = !opts || opts.jitter   !== false;
    const tex  = !opts || opts.texture  !== false;
    ctx.fillStyle = jit ? jitterColor(m.color, tx, ty, 12, seed) : m.color;
    ctx.fillRect(sx, sy, size, size);
    if (!tex || size < 6) return;
    for (let i = 0; i < 3; i++) {
        const hx = hash2D(tx, ty, seed + 10 + i);
        const hy = hash2D(tx, ty, seed + 20 + i);
        ctx.fillStyle = jitterColor(m.color, tx + i, ty + i, 30, seed + 7);
        ctx.fillRect(
            sx + ((hx * (size - 4)) | 0),
            sy + ((hy * (size - 4)) | 0),
            2, 2
        );
    }
}

// Culled foreground render. Returns count of tiles drawn for the perf counter.
function renderViewport(ctx, world, tile, cameraX, cameraY, viewportW, viewportH, opts) {
    const tx0 = Math.max(0, Math.floor(cameraX / tile));
    const ty0 = Math.max(0, Math.floor(cameraY / tile));
    const tx1 = Math.min(world.width,  Math.ceil((cameraX + viewportW) / tile));
    const ty1 = Math.min(world.height, Math.ceil((cameraY + viewportH) / tile));
    let drawn = 0;
    for (let y = ty0; y < ty1; y++) {
        for (let x = tx0; x < tx1; x++) {
            const id = world.get(x, y);
            if (id === 0) continue;
            drawTileTextured(ctx, x * tile - cameraX, y * tile - cameraY, tile, id, x, y, opts);
            drawn++;
        }
    }
    return drawn;
}

// Dim variant for background walls.
function dimColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16) * factor;
    const g = parseInt(hex.slice(3, 5), 16) * factor;
    const b = parseInt(hex.slice(5, 7), 16) * factor;
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}
// Background renders ALL cells (including "air") so walls fill behind dug-out tunnels.
function renderBackgroundViewport(ctx, world, tile, cameraX, cameraY, viewportW, viewportH) {
    const tx0 = Math.max(0, Math.floor(cameraX / tile));
    const ty0 = Math.max(0, Math.floor(cameraY / tile));
    const tx1 = Math.min(world.width,  Math.ceil((cameraX + viewportW) / tile));
    const ty1 = Math.min(world.height, Math.ceil((cameraY + viewportH) / tile));
    for (let y = ty0; y < ty1; y++) {
        for (let x = tx0; x < tx1; x++) {
            const id = world.get(x, y);
            if (id === 0) continue;
            const m = VOX_MATERIALS[id];
            if (!m || !m.color) continue;
            ctx.fillStyle = dimColor(m.color, 0.55);
            ctx.fillRect(x * tile - cameraX, y * tile - cameraY, tile, tile);
        }
    }
}

// Build the hand-authored 30×15 world reused by drawGrid and palette demos.
// Cross-section: 3 rows sky, 1 row grass-top, 4 rows dirt, 7 rows stone with ore specks.
function buildSmallWorld() {
    const W = 30, H = 15;
    const w = new TileWorld(W, H);
    for (let x = 0; x < W; x++) {
        // Surface heights vary mildly so it doesn't look like a brick.
        const surfaceY = 4 + Math.round(Math.sin(x * 0.5) * 0.6);
        for (let y = 0; y < H; y++) {
            if (y < surfaceY) {
                w.set(x, y, 0); // sky
            } else if (y === surfaceY) {
                w.set(x, y, 2); // grass top
            } else if (y < surfaceY + 4) {
                w.set(x, y, 1); // dirt band
            } else {
                w.set(x, y, 3); // stone
                // Scatter ore deterministically.
                if (hash2D(x, y, 42) > 0.94) w.set(x, y, 4);
            }
        }
    }
    // Punch a small wood structure into the surface for visual interest.
    w.set(6, 3, 5); w.set(6, 4, 5);
    return w;
}

// Build the larger 80×40 world for camera/layers demos.
function buildLargeWorld() {
    const W = 80, H = 40;
    const fg = new TileWorld(W, H);
    const bg = new TileWorld(W, H);

    for (let x = 0; x < W; x++) {
        const surfaceY = 8 + Math.round(Math.sin(x * 0.18) * 2 + Math.sin(x * 0.07) * 3);
        for (let y = 0; y < H; y++) {
            if (y < surfaceY) {
                fg.set(x, y, 0); // sky
                bg.set(x, y, 0); // no wall behind sky
            } else if (y === surfaceY) {
                fg.set(x, y, 2); // grass top
                bg.set(x, y, 1); // dirt wall behind
            } else if (y < surfaceY + 5) {
                fg.set(x, y, 1); // dirt
                bg.set(x, y, 1); // dirt wall
            } else {
                fg.set(x, y, 3); // stone
                bg.set(x, y, 3); // stone wall
                if (hash2D(x, y, 17) > 0.95) fg.set(x, y, 4); // ore vein
            }
        }
    }

    // Carve a cave so we have something interesting to mine into.
    // Two overlapping circular blobs roughly centered at (35, 22) and (44, 26).
    function carve(cx, cy, r) {
        for (let y = cy - r; y <= cy + r; y++) {
            for (let x = cx - r; x <= cx + r; x++) {
                const d = Math.hypot(x - cx, y - cy);
                // Soft falloff at the edge so it doesn't look like a perfect circle.
                const cutoff = r - (hash2D(x, y, 99) * 1.5);
                if (d < cutoff) fg.set(x, y, 0); // foreground becomes air
            }
        }
    }
    carve(35, 22, 5);
    carve(44, 26, 6);
    carve(40, 24, 4);
    // A narrower tunnel connecting the two blobs.
    for (let x = 30; x < 50; x++) {
        fg.set(x, 24, 0);
        fg.set(x, 25, 0);
    }

    return { fg, bg, W, H };
}

// =============================================================================
// DEMO 1 — voxIntro: sprite world vs voxel world side-by-side (static)
// =============================================================================
(function voxIntroDemo() {
    const canvas = document.getElementById('voxIntro');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);

        const halfW = canvas.width / 2;

        // ── LEFT: sprite-based scene ─────────────────────────────────────────
        // Sky gradient backdrop
        const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
        sky.addColorStop(0, '#1a2547');
        sky.addColorStop(1, '#3a4a6a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, halfW, canvas.height);
        // Ground rectangle (one big sprite)
        ctx.fillStyle = '#4a8a3a';
        ctx.fillRect(0, canvas.height - 80, halfW, 80);
        // Three "sprites" — colored rects
        ctx.fillStyle = '#ab47bc'; ctx.fillRect(60, canvas.height - 140, 50, 60);
        ctx.fillStyle = '#ffa726'; ctx.beginPath();
        ctx.arc(180, canvas.height - 110, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#66bb6a'; ctx.fillRect(280, canvas.height - 115, 40, 35);
        // Caption
        ctx.fillStyle = VOX_COLORS.label;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Sprite-based', 16, 28);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = VOX_COLORS.labelMuted;
        ctx.fillText('A backdrop + a few objects on top.', 16, 50);
        ctx.fillText('You CAN\'T dig the ground — it\'s one image.', 16, canvas.height - 16);

        // ── RIGHT: voxel-grid scene ──────────────────────────────────────────
        const TILE = 20;
        const cols = 20, rows = 16;
        const ox = halfW + 10;
        const oy = 24;
        // Background fill
        ctx.fillStyle = '#1a2547';
        ctx.fillRect(halfW, 0, halfW, canvas.height);
        // Build a tiny world inline so the diagram is self-contained.
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const surfaceY = 6 + Math.round(Math.sin(x * 0.5) * 0.6);
                let id = 0;
                if (y === surfaceY) id = 2;
                else if (y > surfaceY && y < surfaceY + 3) id = 1;
                else if (y >= surfaceY + 3) id = 3;
                if (id !== 0 && hash2D(x, y, 4) > 0.92 && y > surfaceY + 2) id = 4;
                drawTileTextured(ctx, ox + x * TILE, oy + y * TILE, TILE, id, x, y, { seed: 4 });
            }
        }
        // Highlight ONE cell with a callout
        const hx = 10, hy = 10;
        ctx.strokeStyle = VOX_COLORS.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + hx * TILE, oy + hy * TILE, TILE, TILE);
        ctx.beginPath();
        ctx.moveTo(ox + (hx + 1) * TILE, oy + hy * TILE);
        ctx.lineTo(ox + (hx + 4) * TILE, oy + (hy - 2) * TILE);
        ctx.stroke();
        ctx.fillStyle = VOX_COLORS.accent;
        ctx.font = 'bold 11px monospace';
        ctx.fillText('tiles[10,10] = 3 (stone)', ox + (hx + 4) * TILE + 4, oy + (hy - 2) * TILE);

        // Caption
        ctx.fillStyle = VOX_COLORS.label;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Voxel-grid', halfW + 16, 18);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = VOX_COLORS.labelMuted;
        ctx.fillText('Every cell is a number in a 2D array.', halfW + 16, canvas.height - 32);
        ctx.fillText('Mining = setting that number to 0.', halfW + 16, canvas.height - 16);

        // Divider
        ctx.strokeStyle = VOX_COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(halfW, 0); ctx.lineTo(halfW, canvas.height);
        ctx.stroke();
    }
    render();
})();

// =============================================================================
// DEMO 2 — voxTileCoords: hover highlights a tile, slider scales TILE
// =============================================================================
(function voxTileCoordsDemo() {
    const canvas = document.getElementById('voxTileCoords');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxTileCoordsInfo');
    const slider = document.getElementById('voxTileSize');
    const sliderValue = document.getElementById('voxTileSizeValue');
    ctx.imageSmoothingEnabled = false;

    let TILE = 24;
    let mouse = { x: -1, y: -1, inside: false };

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        // Draw the grid lines only — empty cells.
        ctx.strokeStyle = VOX_COLORS.gridLine;
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += TILE) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += TILE) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5); ctx.lineTo(canvas.width, y + 0.5);
            ctx.stroke();
        }
        // Highlight the hovered tile.
        if (mouse.inside) {
            const t = screenToTile(mouse.x, mouse.y, TILE);
            const s = tileToScreen(t.x, t.y, TILE);
            ctx.fillStyle = 'rgba(255, 167, 38, 0.35)';
            ctx.fillRect(s.x, s.y, TILE, TILE);
            ctx.strokeStyle = VOX_COLORS.accent;
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x + 1, s.y + 1, TILE - 2, TILE - 2);
            info.innerHTML =
                `Mouse: <strong>(${mouse.x | 0}, ${mouse.y | 0}) px</strong> &nbsp;→&nbsp; ` +
                `Tile: <strong>(${t.x}, ${t.y})</strong> @ TILE=${TILE}`;
        } else {
            info.textContent = `Hover over the grid — coords appear here. TILE=${TILE}`;
        }
    }

    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        mouse.inside = true;
        render();
    });
    canvas.addEventListener('mouseleave', () => {
        mouse.inside = false;
        render();
    });
    slider.addEventListener('input', () => {
        TILE = parseInt(slider.value, 10);
        sliderValue.textContent = TILE;
        render();
    });

    render();
})();

// =============================================================================
// DEMO 3 — voxFlatArray: 16×8 grid + byte strip in lock-step
// =============================================================================
(function voxFlatArrayDemo() {
    const canvas = document.getElementById('voxFlatArray');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxFlatArrayInfo');
    const slider = document.getElementById('voxFlatIndex');
    const sliderValue = document.getElementById('voxFlatIndexValue');
    ctx.imageSmoothingEnabled = false;

    const W = 16, H = 8;
    const world = new TileWorld(W, H);
    // Build a tiny scene: sky / grass / dirt / stone with one ore vein.
    for (let x = 0; x < W; x++) {
        const surf = 2 + (x % 3 === 0 ? 1 : 0);
        for (let y = 0; y < H; y++) {
            if (y < surf) world.set(x, y, 0);
            else if (y === surf) world.set(x, y, 2);
            else if (y < surf + 2) world.set(x, y, 1);
            else world.set(x, y, 3);
        }
    }
    world.set(10, 6, 4); world.set(11, 6, 4); // ore vein

    const TILE = 36;
    const gridOx = (canvas.width - W * TILE) / 2;
    const gridOy = 12;
    const stripOx = 20;
    const stripOy = gridOy + H * TILE + 30;
    const stripCellW = (canvas.width - 40) / (W * H);

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const idx = parseInt(slider.value, 10);
        const sx = idx % W;
        const sy = (idx / W) | 0;

        // Grid
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                drawTileTextured(ctx, gridOx + x * TILE, gridOy + y * TILE, TILE, world.get(x, y), x, y, { seed: 0 });
                // Grid line
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.strokeRect(gridOx + x * TILE + 0.5, gridOy + y * TILE + 0.5, TILE - 1, TILE - 1);
            }
        }
        // Highlight selected cell
        ctx.strokeStyle = VOX_COLORS.accent;
        ctx.lineWidth = 3;
        ctx.strokeRect(gridOx + sx * TILE + 1, gridOy + sy * TILE + 1, TILE - 2, TILE - 2);

        // Byte strip
        ctx.fillStyle = VOX_COLORS.label;
        ctx.font = 'bold 12px monospace';
        ctx.fillText('Uint8Array (one square = one byte):', stripOx, stripOy - 8);
        for (let i = 0; i < W * H; i++) {
            const v = world.tiles[i];
            const m = VOX_MATERIALS[v];
            ctx.fillStyle = m && m.color ? m.color : '#1a2547';
            ctx.fillRect(stripOx + i * stripCellW, stripOy, stripCellW - 1, 20);
            if (i === idx) {
                ctx.strokeStyle = VOX_COLORS.accent;
                ctx.lineWidth = 2;
                ctx.strokeRect(stripOx + i * stripCellW - 1, stripOy - 2, stripCellW + 1, 24);
            }
        }
        // Strip endpoints
        ctx.fillStyle = VOX_COLORS.labelMuted;
        ctx.font = '11px monospace';
        ctx.fillText('index 0', stripOx, stripOy + 38);
        const lastLabel = `index ${W * H - 1}`;
        ctx.fillText(lastLabel, canvas.width - 20 - ctx.measureText(lastLabel).width, stripOy + 38);

        // Info line
        const m = VOX_MATERIALS[world.get(sx, sy)];
        info.innerHTML =
            `index=<strong>${idx}</strong>, x=<strong>${sx}</strong>, y=<strong>${sy}</strong>, ` +
            `value=<strong>${world.get(sx, sy)}</strong> (<em>${m ? m.name : '?'}</em>) &nbsp; ` +
            `[ index = y × W + x = ${sy} × ${W} + ${sx} = ${idx} ]`;
    }

    slider.max = String(W * H - 1);
    slider.addEventListener('input', () => {
        sliderValue.textContent = slider.value;
        render();
    });

    render();
})();

// =============================================================================
// DEMO 4 — voxDrawGrid: 30×15 world with overlay toggles
// =============================================================================
(function voxDrawGridDemo() {
    const canvas = document.getElementById('voxDrawGrid');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxDrawGridInfo');
    ctx.imageSmoothingEnabled = false;

    const world = buildSmallWorld();
    const TILE = 24;
    const ox = (canvas.width - world.width * TILE) / 2;
    const oy = (canvas.height - world.height * TILE) / 2;

    const state = { fill: true, lines: false, ids: false };

    const btnFill  = document.getElementById('btnDrawGridFill');
    const btnLines = document.getElementById('btnDrawGridLines');
    const btnIds   = document.getElementById('btnDrawGridIds');

    function syncButtons() {
        btnFill.classList.toggle('active', state.fill);
        btnLines.classList.toggle('active', state.lines);
        btnIds.classList.toggle('active', state.ids);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                if (state.fill) {
                    drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
                }
            }
        }
        if (state.lines) {
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= world.width; x++) {
                ctx.beginPath();
                ctx.moveTo(ox + x * TILE + 0.5, oy);
                ctx.lineTo(ox + x * TILE + 0.5, oy + world.height * TILE);
                ctx.stroke();
            }
            for (let y = 0; y <= world.height; y++) {
                ctx.beginPath();
                ctx.moveTo(ox,                       oy + y * TILE + 0.5);
                ctx.lineTo(ox + world.width * TILE,  oy + y * TILE + 0.5);
                ctx.stroke();
            }
        }
        if (state.ids) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let y = 0; y < world.height; y++) {
                for (let x = 0; x < world.width; x++) {
                    const id = world.get(x, y);
                    if (id === 0) continue;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillText(String(id), ox + x * TILE + TILE / 2 + 1, oy + y * TILE + TILE / 2 + 1);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(String(id), ox + x * TILE + TILE / 2, oy + y * TILE + TILE / 2);
                }
            }
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }
        info.textContent =
            `${world.width}×${world.height} world, ${TILE}px tiles · ` +
            `fill ${state.fill ? 'on' : 'off'}, lines ${state.lines ? 'on' : 'off'}, IDs ${state.ids ? 'on' : 'off'}`;
    }

    btnFill .addEventListener('click', () => { state.fill  = !state.fill;  syncButtons(); render(); });
    btnLines.addEventListener('click', () => { state.lines = !state.lines; syncButtons(); render(); });
    btnIds  .addEventListener('click', () => { state.ids   = !state.ids;   syncButtons(); render(); });

    syncButtons();
    render();
})();

// =============================================================================
// DEMO 5 — voxPalette: same 30×15 world with togglable texture layers + seed
// =============================================================================
(function voxPaletteDemo() {
    const canvas = document.getElementById('voxPalette');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxPaletteInfo');
    const cbJitter  = document.getElementById('voxPaletteJitter');
    const cbTexture = document.getElementById('voxPaletteTexture');
    const slSeed    = document.getElementById('voxPaletteSeed');
    const slSeedVal = document.getElementById('voxPaletteSeedValue');
    ctx.imageSmoothingEnabled = false;

    const world = buildSmallWorld();
    const TILE = 24;
    const ox = (canvas.width - world.width * TILE) / 2;
    const oy = (canvas.height - world.height * TILE) / 2;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        const opts = {
            jitter:  cbJitter.checked,
            texture: cbTexture.checked,
            seed: parseInt(slSeed.value, 10)
        };
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                drawTileTextured(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y), x, y, opts);
            }
        }
        const layers = [];
        if (cbJitter.checked)  layers.push('jitter');
        if (cbTexture.checked) layers.push('speckles');
        info.textContent =
            `Seed: ${opts.seed} · Layers: ${layers.length ? layers.join(' + ') : 'solid color only'}.`;
    }

    cbJitter .addEventListener('change', render);
    cbTexture.addEventListener('change', render);
    slSeed   .addEventListener('input',  () => { slSeedVal.textContent = slSeed.value; render(); });

    render();
})();

// =============================================================================
// DEMO 6 — voxCamera: 80×40 world, WASD panning, viewport culling indicator
// =============================================================================
(function voxCameraDemo() {
    const canvas = document.getElementById('voxCamera');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxCameraInfo');
    const slSpeed = document.getElementById('voxCameraSpeed');
    const slSpeedVal = document.getElementById('voxCameraSpeedValue');
    const cbBounds = document.getElementById('voxCameraBounds');
    ctx.imageSmoothingEnabled = false;

    const { fg, W, H } = buildLargeWorld();
    const TILE = 16;
    const camera = { x: 0, y: 0 };
    let speed = parseInt(slSpeed.value, 10);
    const keys = new Set();
    let focused = false;
    let drawn = 0;

    function render() {
        // Sky fill (camera doesn't extend the world — clamped — so this is the bg under air tiles).
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);

        drawn = renderViewport(ctx, fg, TILE, camera.x, camera.y, canvas.width, canvas.height, { seed: 3 });

        if (cbBounds.checked) {
            // Red "this is what got drawn" rectangle inset slightly so it's visible.
            const tx0 = Math.max(0, Math.floor(camera.x / TILE));
            const ty0 = Math.max(0, Math.floor(camera.y / TILE));
            const tx1 = Math.min(W, Math.ceil((camera.x + canvas.width)  / TILE));
            const ty1 = Math.min(H, Math.ceil((camera.y + canvas.height) / TILE));
            const sx0 = tx0 * TILE - camera.x;
            const sy0 = ty0 * TILE - camera.y;
            const sx1 = tx1 * TILE - camera.x;
            const sy1 = ty1 * TILE - camera.y;
            ctx.strokeStyle = VOX_COLORS.cull;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(sx0 + 1, sy0 + 1, sx1 - sx0 - 2, sy1 - sy0 - 2);
            ctx.setLineDash([]);
            ctx.fillStyle = VOX_COLORS.cull;
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`culled iter: x[${tx0},${tx1}) × y[${ty0},${ty1})`, sx0 + 6, sy0 + 16);
        }

        // Click-to-focus hint
        if (!focused) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click here to focus, then drive with WASD / arrow keys', canvas.width / 2, canvas.height - 14);
            ctx.textAlign = 'start';
        }

        info.innerHTML =
            `Camera: <strong>(${camera.x | 0}, ${camera.y | 0})</strong>px · ` +
            `World: ${W}×${H} tiles (${W * H} cells) · ` +
            `Tiles drawn: <strong>${drawn}</strong>` +
            ` <span style="color:#9e9e9e;">(constant regardless of world size — that's culling)</span>`;
    }

    function step() {
        let moved = false;
        if (keys.has('a') || keys.has('arrowleft'))  { camera.x -= speed; moved = true; }
        if (keys.has('d') || keys.has('arrowright')) { camera.x += speed; moved = true; }
        if (keys.has('w') || keys.has('arrowup'))    { camera.y -= speed; moved = true; }
        if (keys.has('s') || keys.has('arrowdown'))  { camera.y += speed; moved = true; }
        camera.x = Math.max(0, Math.min(W * TILE - canvas.width,  camera.x));
        camera.y = Math.max(0, Math.min(H * TILE - canvas.height, camera.y));
        if (moved) render();
        requestAnimationFrame(step);
    }

    canvas.addEventListener('focus', () => { focused = true; render(); });
    canvas.addEventListener('blur',  () => { focused = false; keys.clear(); render(); });
    canvas.addEventListener('click', () => canvas.focus());
    canvas.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
            e.preventDefault();
            keys.add(k);
        }
    });
    canvas.addEventListener('keyup', (e) => {
        keys.delete(e.key.toLowerCase());
    });

    slSpeed.addEventListener('input', () => {
        speed = parseInt(slSpeed.value, 10);
        slSpeedVal.textContent = slSpeed.value;
    });
    cbBounds.addEventListener('change', render);

    render();
    requestAnimationFrame(step);
})();

// =============================================================================
// DEMO 7 — voxLayers: same 80×40 world + background wall grid, fg/bg/both
// =============================================================================
(function voxLayersDemo() {
    const canvas = document.getElementById('voxLayers');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('voxLayersInfo');
    ctx.imageSmoothingEnabled = false;

    const { fg, bg, W, H } = buildLargeWorld();
    const TILE = 16;
    // Default camera centered on the cave so users immediately see the wall effect.
    const camera = { x: Math.max(0, 38 * TILE - canvas.width / 2),
                     y: Math.max(0, 24 * TILE - canvas.height / 2) };
    const keys = new Set();
    const speed = 6;
    let focused = false;
    let mode = 'both';

    const rbFg   = document.getElementById('voxLayersFg');
    const rbBg   = document.getElementById('voxLayersBg');
    const rbBoth = document.getElementById('voxLayersBoth');

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        if (mode === 'bg' || mode === 'both') {
            renderBackgroundViewport(ctx, bg, TILE, camera.x, camera.y, canvas.width, canvas.height);
        }
        if (mode === 'fg' || mode === 'both') {
            renderViewport(ctx, fg, TILE, camera.x, camera.y, canvas.width, canvas.height, { seed: 3 });
        }

        if (!focused) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click to focus, then WASD / arrow keys', canvas.width / 2, canvas.height - 14);
            ctx.textAlign = 'start';
        }

        const desc = mode === 'fg'   ? 'Foreground only — cave is empty sky.'
                   : mode === 'bg'   ? 'Background only — dim wall everywhere.'
                                     : 'Both — cave reads as a tunnel because walls fill behind it.';
        info.innerHTML =
            `Mode: <strong>${mode}</strong>. ${desc} · Camera: (${camera.x | 0}, ${camera.y | 0})`;
    }

    function step() {
        let moved = false;
        if (keys.has('a') || keys.has('arrowleft'))  { camera.x -= speed; moved = true; }
        if (keys.has('d') || keys.has('arrowright')) { camera.x += speed; moved = true; }
        if (keys.has('w') || keys.has('arrowup'))    { camera.y -= speed; moved = true; }
        if (keys.has('s') || keys.has('arrowdown'))  { camera.y += speed; moved = true; }
        camera.x = Math.max(0, Math.min(W * TILE - canvas.width,  camera.x));
        camera.y = Math.max(0, Math.min(H * TILE - canvas.height, camera.y));
        if (moved) render();
        requestAnimationFrame(step);
    }

    canvas.addEventListener('focus', () => { focused = true; render(); });
    canvas.addEventListener('blur',  () => { focused = false; keys.clear(); render(); });
    canvas.addEventListener('click', () => canvas.focus());
    canvas.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
            e.preventDefault();
            keys.add(k);
        }
    });
    canvas.addEventListener('keyup', (e) => {
        keys.delete(e.key.toLowerCase());
    });

    rbFg  .addEventListener('change', () => { if (rbFg.checked)   { mode = 'fg';   render(); } });
    rbBg  .addEventListener('change', () => { if (rbBg.checked)   { mode = 'bg';   render(); } });
    rbBoth.addEventListener('change', () => { if (rbBoth.checked) { mode = 'both'; render(); } });

    render();
    requestAnimationFrame(step);
})();
