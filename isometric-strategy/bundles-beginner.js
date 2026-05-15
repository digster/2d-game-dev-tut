// =============================================================================
// ISOMETRIC STRATEGY — BEGINNER TIER EXPORT BUNDLES
// =============================================================================
// Feeds the shared export-demo injector (shared/export-demo.js) so the
// 📋 Export button on each `<details data-demo-id="iso_*">` block can copy a
// fully-runnable HTML to the clipboard. The shared injector reads from the
// same globals the Fundamentals pages use:
//   - DEMO_HTML            : per-demo scaffold metadata (title, canvas size, controls, info)
//   - DEMO_CODE / DEMO_CODE_TS         : runnable IIFE source for each demo
//   - DEPENDENCY_BUNDLES / DEPENDENCY_BUNDLES_TS : reusable helper source strings
//
// IDs are prefixed `iso_` so they cannot collide with Fundamentals demos even
// if both registries are loaded on the same page later.
//
// ── Canvas-ID convention ─────────────────────────────────────────────────────
// The shared standalone-HTML generator hardcodes `<canvas id="canvas">` and
// `<div id="info">` (see shared/export-demo.js:166-170). The page-side demos
// in beginner-demos.js look up specific IDs (e.g. 'mathDemo', 'mathDemoInfo').
// The DEMO_CODE strings below are *rewrites* of those IIFEs with the lookups
// retargeted to the scaffold's fixed `canvas` / `info` IDs. Button IDs are
// kept untouched because the scaffold's `controls` array names them.
// =============================================================================

// Initialize registries (no-op if a sibling bundle already created them).
window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// DEPENDENCY BUNDLES — reusable helper functions inlined at export time.
// =============================================================================

DEPENDENCY_BUNDLES.iso_colors = `// Shared palette for iso demos (matches the project theme).
const ISO_COLORS = {
    bg: '#0d1117',
    grid: '#2a3550',
    gridLine: '#4fc3f7',
    accent: '#ffa726',
    accentSoft: '#ffd180',
    hover: '#ff7043',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e',
    player: '#66bb6a',
    tree: '#388e3c',
    building: '#ab47bc'
};`;

DEPENDENCY_BUNDLES.iso_clearCanvas = `// Fill the entire canvas with the dark background.
function clearCanvas(ctx, width, height, bgColor = '#0d1117') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;

DEPENDENCY_BUNDLES.iso_cartToIso = `// Convert tile-grid coordinates to screen pixels (top vertex of the diamond).
function cartToIso(cx, cy, tileW, tileH, originX = 0, originY = 0) {
    return {
        x: originX + (cx - cy) * (tileW / 2),
        y: originY + (cx + cy) * (tileH / 2)
    };
}`;

DEPENDENCY_BUNDLES.iso_isoToCart = `// Inverse of cartToIso — returns fractional tile coords; floor for integer tile.
function isoToCart(sx, sy, tileW, tileH, originX = 0, originY = 0) {
    const dx = sx - originX;
    const dy = sy - originY;
    return {
        x: dx / tileW + dy / tileH,
        y: dy / tileH - dx / tileW
    };
}`;

DEPENDENCY_BUNDLES.iso_drawIsoTile = `// Draws a diamond whose *top* vertex is at (sx, sy).
function drawIsoTile(ctx, sx, sy, tileW, tileH, fillStyle = '#3a4a6a', strokeStyle = '#4fc3f7') {
    const halfW = tileW / 2;
    const halfH = tileH / 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);                  // top
    ctx.lineTo(sx + halfW, sy + halfH);  // right
    ctx.lineTo(sx, sy + tileH);          // bottom
    ctx.lineTo(sx - halfW, sy + halfH);  // left
    ctx.closePath();
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 1; ctx.stroke(); }
}`;

DEPENDENCY_BUNDLES.iso_pickTileFromMouse = `// Full mouse → integer tile-coordinate pipeline.
// Returns null if (mapW, mapH) are provided and the pick is out of bounds.
function pickTileFromMouse(mouseX, mouseY, originX, originY, tileW, tileH, mapW = null, mapH = null) {
    // Offset Y by tileH/2 so we measure from the diamond's CENTER, not its top vertex.
    const cart = isoToCart(mouseX, mouseY - tileH / 2, tileW, tileH, originX, originY);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (mapW !== null && (tx < 0 || tx >= mapW)) return null;
    if (mapH !== null && (ty < 0 || ty >= mapH)) return null;
    return { x: tx, y: ty };
}`;

// ── TypeScript variants ──────────────────────────────────────────────────────
// Sucrase strips these at export-time in the browser (see shared/export-demo.js:59-92).

DEPENDENCY_BUNDLES_TS.iso_colors = `// Shared palette for iso demos.
const ISO_COLORS: Record<string, string> = {
    bg: '#0d1117',
    grid: '#2a3550',
    gridLine: '#4fc3f7',
    accent: '#ffa726',
    accentSoft: '#ffd180',
    hover: '#ff7043',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e',
    player: '#66bb6a',
    tree: '#388e3c',
    building: '#ab47bc'
};`;

DEPENDENCY_BUNDLES_TS.iso_clearCanvas = `function clearCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bgColor: string = '#0d1117'
): void {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;

DEPENDENCY_BUNDLES_TS.iso_cartToIso = `function cartToIso(
    cx: number,
    cy: number,
    tileW: number,
    tileH: number,
    originX: number = 0,
    originY: number = 0
): { x: number; y: number } {
    return {
        x: originX + (cx - cy) * (tileW / 2),
        y: originY + (cx + cy) * (tileH / 2)
    };
}`;

DEPENDENCY_BUNDLES_TS.iso_isoToCart = `function isoToCart(
    sx: number,
    sy: number,
    tileW: number,
    tileH: number,
    originX: number = 0,
    originY: number = 0
): { x: number; y: number } {
    const dx = sx - originX;
    const dy = sy - originY;
    return {
        x: dx / tileW + dy / tileH,
        y: dy / tileH - dx / tileW
    };
}`;

DEPENDENCY_BUNDLES_TS.iso_drawIsoTile = `function drawIsoTile(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    tileW: number,
    tileH: number,
    fillStyle: string | null = '#3a4a6a',
    strokeStyle: string | null = '#4fc3f7'
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
    mouseX: number,
    mouseY: number,
    originX: number,
    originY: number,
    tileW: number,
    tileH: number,
    mapW: number | null = null,
    mapH: number | null = null
): { x: number; y: number } | null {
    const cart = isoToCart(mouseX, mouseY - tileH / 2, tileW, tileH, originX, originY);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (mapW !== null && (tx < 0 || tx >= mapW)) return null;
    if (mapH !== null && (ty < 0 || ty >= mapH)) return null;
    return { x: tx, y: ty };
}`;

// =============================================================================
// DEMO 1 — iso_mathDemo
// Step through cartesian coords with three buttons, watch screen pixels update.
// Backs the cartToIso & isoToCart `<details>` blocks in beginner.html.
// =============================================================================
DEMO_HTML.iso_mathDemo = {
    title: 'Iso — Cartesian ↔ Isometric Coordinate Math',
    canvas: { width: 800, height: 380 },
    controls: [
        { id: 'btnMathStepX', text: 'Step +1 in cartX' },
        { id: 'btnMathStepY', text: 'Step +1 in cartY' },
        { id: 'btnMathReset', text: 'Reset to (0, 0)' }
    ],
    info: 'Step through the grid and watch screen coords update.'
};

DEMO_CODE.iso_mathDemo = `(function mathDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const tileW = 64, tileH = 32;
    const mapW = 6, mapH = 6;
    const originX = canvas.width / 2;
    const originY = 40;

    let cx = 0, cy = 0;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const p = cartToIso(x, y, tileW, tileH, originX, originY);
                const isCurrent = (x === cx && y === cy);
                drawIsoTile(
                    ctx, p.x, p.y, tileW, tileH,
                    isCurrent ? ISO_COLORS.accent : '#2a3550',
                    ISO_COLORS.gridLine
                );
            }
        }
        const p = cartToIso(cx + 0.5, cy + 0.5, tileW, tileH, originX, originY);
        ctx.fillStyle = ISO_COLORS.player;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        const sp = cartToIso(cx, cy, tileW, tileH, originX, originY);
        info.innerHTML =
            \`Cartesian tile: <strong>(\${cx}, \${cy})</strong> &nbsp;→&nbsp; \` +
            \`Screen pixel (top vertex): <strong>(\${sp.x.toFixed(0)}, \${sp.y.toFixed(0)})</strong>\`;
    }

    document.getElementById('btnMathStepX')?.addEventListener('click', () => {
        cx = (cx + 1) % mapW;
        render();
    });
    document.getElementById('btnMathStepY')?.addEventListener('click', () => {
        cy = (cy + 1) % mapH;
        render();
    });
    document.getElementById('btnMathReset')?.addEventListener('click', () => {
        cx = 0; cy = 0;
        render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_mathDemo = `(function mathDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const tileW: number = 64, tileH: number = 32;
    const mapW: number = 6, mapH: number = 6;
    const originX: number = canvas.width / 2;
    const originY: number = 40;

    let cx: number = 0, cy: number = 0;

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const p = cartToIso(x, y, tileW, tileH, originX, originY);
                const isCurrent: boolean = (x === cx && y === cy);
                drawIsoTile(
                    ctx, p.x, p.y, tileW, tileH,
                    isCurrent ? ISO_COLORS.accent : '#2a3550',
                    ISO_COLORS.gridLine
                );
            }
        }
        const p = cartToIso(cx + 0.5, cy + 0.5, tileW, tileH, originX, originY);
        ctx.fillStyle = ISO_COLORS.player;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        const sp = cartToIso(cx, cy, tileW, tileH, originX, originY);
        info.innerHTML =
            \`Cartesian tile: <strong>(\${cx}, \${cy})</strong> &nbsp;→&nbsp; \` +
            \`Screen pixel (top vertex): <strong>(\${sp.x.toFixed(0)}, \${sp.y.toFixed(0)})</strong>\`;
    }

    document.getElementById('btnMathStepX')?.addEventListener('click', (): void => {
        cx = (cx + 1) % mapW;
        render();
    });
    document.getElementById('btnMathStepY')?.addEventListener('click', (): void => {
        cy = (cy + 1) % mapH;
        render();
    });
    document.getElementById('btnMathReset')?.addEventListener('click', (): void => {
        cx = 0; cy = 0;
        render();
    });

    render();
})();`;

// =============================================================================
// DEMO 2 — iso_gridDemo
// Adjust tile size and grid count; redraws the diamond grid each time.
// Backs the drawIsoTile & drawGridIso `<details>` blocks in beginner.html.
// =============================================================================
DEMO_HTML.iso_gridDemo = {
    title: 'Iso — Drawing Tiles & Grids',
    canvas: { width: 800, height: 420 },
    controls: [
        { id: 'btnGridShrink',  text: 'Smaller tiles (32×16)' },
        { id: 'btnGridDefault', text: 'Default (64×32)' },
        { id: 'btnGridGrow',    text: 'Bigger tiles (96×48)' },
        { id: 'btnGridMore',    text: 'More tiles (12×12)' },
        { id: 'btnGridFewer',   text: 'Fewer tiles (6×6)' }
    ],
    info: 'Default 10×10 grid at 64×32 tiles.'
};

DEMO_CODE.iso_gridDemo = `(function gridDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    let tileW = 64, tileH = 32;
    let mapW = 10, mapH = 10;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const originX = canvas.width / 2;
        const originY = 30;
        for (let cy = 0; cy < mapH; cy++) {
            for (let cx = 0; cx < mapW; cx++) {
                const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
                const tint = ((cx + cy) % 2 === 0) ? '#243049' : '#2a3550';
                drawIsoTile(ctx, p.x, p.y, tileW, tileH, tint, ISO_COLORS.gridLine);
            }
        }
        info.textContent = \`Grid: \${mapW}×\${mapH} tiles, each \${tileW}×\${tileH} px (diamond 2:1).\`;
    }

    document.getElementById('btnGridShrink')?.addEventListener('click', () => {
        tileW = 32; tileH = 16; render();
    });
    document.getElementById('btnGridDefault')?.addEventListener('click', () => {
        tileW = 64; tileH = 32; mapW = 10; mapH = 10; render();
    });
    document.getElementById('btnGridGrow')?.addEventListener('click', () => {
        tileW = 96; tileH = 48; render();
    });
    document.getElementById('btnGridMore')?.addEventListener('click', () => {
        mapW = 12; mapH = 12; render();
    });
    document.getElementById('btnGridFewer')?.addEventListener('click', () => {
        mapW = 6; mapH = 6; render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_gridDemo = `(function gridDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    let tileW: number = 64, tileH: number = 32;
    let mapW: number = 10, mapH: number = 10;

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        const originX: number = canvas.width / 2;
        const originY: number = 30;
        for (let cy = 0; cy < mapH; cy++) {
            for (let cx = 0; cx < mapW; cx++) {
                const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
                const tint: string = ((cx + cy) % 2 === 0) ? '#243049' : '#2a3550';
                drawIsoTile(ctx, p.x, p.y, tileW, tileH, tint, ISO_COLORS.gridLine);
            }
        }
        info.textContent = \`Grid: \${mapW}×\${mapH} tiles, each \${tileW}×\${tileH} px (diamond 2:1).\`;
    }

    document.getElementById('btnGridShrink')?.addEventListener('click', (): void => {
        tileW = 32; tileH = 16; render();
    });
    document.getElementById('btnGridDefault')?.addEventListener('click', (): void => {
        tileW = 64; tileH = 32; mapW = 10; mapH = 10; render();
    });
    document.getElementById('btnGridGrow')?.addEventListener('click', (): void => {
        tileW = 96; tileH = 48; render();
    });
    document.getElementById('btnGridMore')?.addEventListener('click', (): void => {
        mapW = 12; mapH = 12; render();
    });
    document.getElementById('btnGridFewer')?.addEventListener('click', (): void => {
        mapW = 6; mapH = 6; render();
    });

    render();
})();`;

// =============================================================================
// DEMO 3 — iso_pickDemo
// Hover the grid; the tile under the cursor lights up and the info display
// reports its (cx, cy). Backs the pickTileFromMouse `<details>` block.
// =============================================================================
DEMO_HTML.iso_pickDemo = {
    title: 'Iso — Picking a Tile From a Mouse Click',
    canvas: { width: 800, height: 420 },
    controls: [],
    info: 'Move the mouse onto the grid to pick a tile.'
};

DEMO_CODE.iso_pickDemo = `(function pickDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const tileW = 64, tileH = 32;
    const mapW = 10, mapH = 8;
    const originX = canvas.width / 2;
    const originY = 50;

    let hover = null;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        for (let cy = 0; cy < mapH; cy++) {
            for (let cx = 0; cx < mapW; cx++) {
                const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
                const isHover = hover && hover.x === cx && hover.y === cy;
                drawIsoTile(ctx, p.x, p.y, tileW, tileH,
                    isHover ? ISO_COLORS.hover : '#2a3550',
                    ISO_COLORS.gridLine);
            }
        }
    }

    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const t = pickTileFromMouse(mx, my, originX, originY, tileW, tileH, mapW, mapH);
        if (t) {
            hover = t;
            info.innerHTML = \`Hovering tile <strong>(\${t.x}, \${t.y})</strong> &nbsp;|&nbsp; mouse at (\${mx.toFixed(0)}, \${my.toFixed(0)})\`;
        } else {
            hover = null;
            info.textContent = 'Move the mouse onto the grid to pick a tile.';
        }
        render();
    });
    canvas.addEventListener('mouseleave', () => {
        hover = null;
        info.textContent = 'Move the mouse onto the grid to pick a tile.';
        render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_pickDemo = `type TileCoord = { x: number; y: number };

(function pickDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const tileW: number = 64, tileH: number = 32;
    const mapW: number = 10, mapH: number = 8;
    const originX: number = canvas.width / 2;
    const originY: number = 50;

    let hover: TileCoord | null = null;

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        for (let cy = 0; cy < mapH; cy++) {
            for (let cx = 0; cx < mapW; cx++) {
                const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
                const isHover: boolean = !!(hover && hover.x === cx && hover.y === cy);
                drawIsoTile(ctx, p.x, p.y, tileW, tileH,
                    isHover ? ISO_COLORS.hover : '#2a3550',
                    ISO_COLORS.gridLine);
            }
        }
    }

    canvas.addEventListener('mousemove', (e: MouseEvent): void => {
        const r: DOMRect = canvas.getBoundingClientRect();
        const mx: number = e.clientX - r.left;
        const my: number = e.clientY - r.top;
        const t = pickTileFromMouse(mx, my, originX, originY, tileW, tileH, mapW, mapH);
        if (t) {
            hover = t;
            info.innerHTML = \`Hovering tile <strong>(\${t.x}, \${t.y})</strong> &nbsp;|&nbsp; mouse at (\${mx.toFixed(0)}, \${my.toFixed(0)})\`;
        } else {
            hover = null;
            info.textContent = 'Move the mouse onto the grid to pick a tile.';
        }
        render();
    });
    canvas.addEventListener('mouseleave', (): void => {
        hover = null;
        info.textContent = 'Move the mouse onto the grid to pick a tile.';
        render();
    });

    render();
})();`;

// =============================================================================
// DEMO 4 — iso_paintGrid
// The mini-project paint-the-grid editor. Click a color, then click/drag the
// grid to paint tiles. Backs the paint-the-grid `<details>` block.
// =============================================================================
DEMO_HTML.iso_paintGrid = {
    title: 'Iso — Mini-Project: Paint-the-Grid Editor',
    canvas: { width: 800, height: 460 },
    controls: [
        { id: 'btnPaintGrass', text: '🌿 Grass' },
        { id: 'btnPaintWater', text: '💧 Water' },
        { id: 'btnPaintSand',  text: '🏖️ Sand' },
        { id: 'btnPaintStone', text: '🪨 Stone' },
        { id: 'btnPaintErase', text: '🧽 Erase' },
        { id: 'btnPaintClear', text: 'Clear all' }
    ],
    info: 'Click and drag to paint. Pick a color above.'
};

DEMO_CODE.iso_paintGrid = `(function paintGridDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const MAP_W = 10, MAP_H = 10;
    const TILE_W = 64, TILE_H = 32;
    const ORIGIN_X = canvas.width / 2;
    const ORIGIN_Y = 40;

    const tiles = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
    let currentColor = '#66bb6a';
    let currentLabel = 'Grass';
    let isPainting = false;

    function paintAt(mouseX, mouseY) {
        const t = pickTileFromMouse(mouseX, mouseY, ORIGIN_X, ORIGIN_Y, TILE_W, TILE_H, MAP_W, MAP_H);
        if (t) {
            tiles[t.y][t.x] = currentColor;
            info.innerHTML = \`Painting <strong>\${currentLabel}</strong> at tile (\${t.x}, \${t.y}).\`;
        }
    }

    function getMouseLocal(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    canvas.addEventListener('mousedown', (e) => {
        isPainting = true;
        const m = getMouseLocal(e);
        paintAt(m.x, m.y);
        render();
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!isPainting) return;
        const m = getMouseLocal(e);
        paintAt(m.x, m.y);
        render();
    });
    canvas.addEventListener('mouseup',    () => { isPainting = false; });
    canvas.addEventListener('mouseleave', () => { isPainting = false; });

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        for (let cy = 0; cy < MAP_H; cy++) {
            for (let cx = 0; cx < MAP_W; cx++) {
                const p = cartToIso(cx, cy, TILE_W, TILE_H, ORIGIN_X, ORIGIN_Y);
                const fill = tiles[cy][cx] || '#1a233a';
                drawIsoTile(ctx, p.x, p.y, TILE_W, TILE_H, fill, '#4fc3f7');
            }
        }
    }

    const colorButtons = [
        { id: 'btnPaintGrass', color: '#66bb6a', label: 'Grass' },
        { id: 'btnPaintWater', color: '#4fc3f7', label: 'Water' },
        { id: 'btnPaintSand',  color: '#d7c878', label: 'Sand' },
        { id: 'btnPaintStone', color: '#8a8a8a', label: 'Stone' },
        { id: 'btnPaintErase', color: null,     label: 'Erase' }
    ];

    colorButtons.forEach(({ id, color, label }) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            currentColor = color;
            currentLabel = label;
            info.innerHTML = \`Active brush: <strong>\${label}</strong>. Click and drag to paint.\`;
        });
    });

    document.getElementById('btnPaintClear')?.addEventListener('click', () => {
        for (let cy = 0; cy < MAP_H; cy++) {
            for (let cx = 0; cx < MAP_W; cx++) {
                tiles[cy][cx] = null;
            }
        }
        info.textContent = 'Cleared all tiles.';
        render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_paintGrid = `type PaintTile = string | null;
type MouseLocal = { x: number; y: number };

(function paintGridDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const MAP_W: number = 10, MAP_H: number = 10;
    const TILE_W: number = 64, TILE_H: number = 32;
    const ORIGIN_X: number = canvas.width / 2;
    const ORIGIN_Y: number = 40;

    const tiles: PaintTile[][] = Array.from(
        { length: MAP_H },
        () => Array(MAP_W).fill(null) as PaintTile[]
    );
    let currentColor: PaintTile = '#66bb6a';
    let currentLabel: string = 'Grass';
    let isPainting: boolean = false;

    function paintAt(mouseX: number, mouseY: number): void {
        const t = pickTileFromMouse(mouseX, mouseY, ORIGIN_X, ORIGIN_Y, TILE_W, TILE_H, MAP_W, MAP_H);
        if (t) {
            tiles[t.y][t.x] = currentColor;
            info.innerHTML = \`Painting <strong>\${currentLabel}</strong> at tile (\${t.x}, \${t.y}).\`;
        }
    }

    function getMouseLocal(e: MouseEvent): MouseLocal {
        const r: DOMRect = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    canvas.addEventListener('mousedown', (e: MouseEvent): void => {
        isPainting = true;
        const m = getMouseLocal(e);
        paintAt(m.x, m.y);
        render();
    });
    canvas.addEventListener('mousemove', (e: MouseEvent): void => {
        if (!isPainting) return;
        const m = getMouseLocal(e);
        paintAt(m.x, m.y);
        render();
    });
    canvas.addEventListener('mouseup',    (): void => { isPainting = false; });
    canvas.addEventListener('mouseleave', (): void => { isPainting = false; });

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        for (let cy = 0; cy < MAP_H; cy++) {
            for (let cx = 0; cx < MAP_W; cx++) {
                const p = cartToIso(cx, cy, TILE_W, TILE_H, ORIGIN_X, ORIGIN_Y);
                const fill: string = tiles[cy][cx] || '#1a233a';
                drawIsoTile(ctx, p.x, p.y, TILE_W, TILE_H, fill, '#4fc3f7');
            }
        }
    }

    type ColorButton = { id: string; color: PaintTile; label: string };
    const colorButtons: ColorButton[] = [
        { id: 'btnPaintGrass', color: '#66bb6a', label: 'Grass' },
        { id: 'btnPaintWater', color: '#4fc3f7', label: 'Water' },
        { id: 'btnPaintSand',  color: '#d7c878', label: 'Sand' },
        { id: 'btnPaintStone', color: '#8a8a8a', label: 'Stone' },
        { id: 'btnPaintErase', color: null,     label: 'Erase' }
    ];

    colorButtons.forEach(({ id, color, label }: ColorButton): void => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', (): void => {
            currentColor = color;
            currentLabel = label;
            info.innerHTML = \`Active brush: <strong>\${label}</strong>. Click and drag to paint.\`;
        });
    });

    document.getElementById('btnPaintClear')?.addEventListener('click', (): void => {
        for (let cy = 0; cy < MAP_H; cy++) {
            for (let cx = 0; cx < MAP_W; cx++) {
                tiles[cy][cx] = null;
            }
        }
        info.textContent = 'Cleared all tiles.';
        render();
    });

    render();
})();`;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS (retrofit — consumed by shared/export-demo.js
// resolveDepClosure). Additive safety net: the data-deps strings in
// beginner.html already list the full closure, so this is idempotent.
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.iso_pickTileFromMouse = ['iso_isoToCart'];
