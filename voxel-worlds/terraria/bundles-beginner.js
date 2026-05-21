// =============================================================================
// TERRARIA SUB-TRACK — BEGINNER TIER EXPORT BUNDLES
// =============================================================================
// Feeds the shared export-demo injector (shared/export-demo.js) so the
// 📋 Export button on each `<details data-demo-id="vox_*">` block can copy a
// fully-runnable HTML to the clipboard.
//
// IDs are prefixed `vox_` so they cannot collide with Fundamentals/iso/shader
// demos even if multiple registries are loaded on the same page later.
//
// ── Canvas-ID convention ─────────────────────────────────────────────────────
// The shared standalone-HTML generator hardcodes `<canvas id="canvas">` and
// `<div id="info">`. The page-side demos in beginner-demos.js look up specific
// IDs (e.g. 'voxDrawGrid', 'voxDrawGridInfo'). The DEMO_CODE strings below are
// *rewrites* of those IIFEs with the lookups retargeted to the scaffold's
// fixed `canvas` / `info` IDs. Button IDs are kept untouched because the
// scaffold's `controls` array names them.
//
// ── Scope of this bundle (iteration 1) ───────────────────────────────────────
// Only `vox_drawGrid` is bundled: its controls are button-only, which matches
// what the scaffold can render. The other Beginner demos use sliders / radios
// / checkboxes, which the scaffold (see shared/export-demo.js:90-92) does not
// render — so they omit `data-demo-id` and don't show an Export button.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};

// =============================================================================
// DEPENDENCY BUNDLES — reusable helper functions inlined at export time.
// =============================================================================

DEPENDENCY_BUNDLES.vox_colors = `// Shared palette so all voxel demos match the project theme.
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
};`;

DEPENDENCY_BUNDLES.vox_clearCanvas = `// Fill the entire canvas with a solid color.
function clearCanvas(ctx, width, height, bgColor = '#0d1117') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;

DEPENDENCY_BUNDLES.vox_materials = `// Material ID -> { name, color, solid }
// Convention: ID 0 is always "air" (the empty cell).
const VOX_MATERIALS = [
    { id: 0, name: 'air',   color: null,      solid: false },
    { id: 1, name: 'dirt',  color: '#7a4f2b', solid: true  },
    { id: 2, name: 'grass', color: '#4a8a3a', solid: true  },
    { id: 3, name: 'stone', color: '#6e6e7a', solid: true  },
    { id: 4, name: 'ore',   color: '#d4a843', solid: true  },
    { id: 5, name: 'wood',  color: '#8a5a2a', solid: true  },
    { id: 6, name: 'sand',  color: '#d7c878', solid: true  },
    { id: 7, name: 'water', color: '#4fc3f7', solid: false }
];`;

DEPENDENCY_BUNDLES.vox_drawTile = `// Solid-color tile draw — air is skipped so the background shows through.
function drawTile(ctx, sx, sy, size, materialId) {
    const m = VOX_MATERIALS[materialId];
    if (!m || !m.color) return;
    ctx.fillStyle = m.color;
    ctx.fillRect(sx, sy, size, size);
}`;

DEPENDENCY_BUNDLES.vox_hash2D = `// Cheap deterministic 2D hash — same (x, y, seed) -> same value.
// Use for visual noise only, never for crypto.
function hash2D(x, y, seed = 0) {
    let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}`;

DEPENDENCY_BUNDLES.vox_TileWorld = `// A 2D voxel world stored as a single contiguous Uint8Array.
// One byte per cell = 256 possible material IDs. Out-of-bounds reads
// return 0 ("air") so callers don't have to guard their iteration.
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
}`;

// vox_drawTile draws materials via VOX_MATERIALS, so the closure resolver
// pulls VOX_MATERIALS in automatically when only vox_drawTile is requested.
DEPENDENCY_REQUIRES.vox_drawTile = ['vox_materials'];

// =============================================================================
// TypeScript variants — Sucrase strips these at export time in the browser.
// =============================================================================

DEPENDENCY_BUNDLES_TS.vox_colors = `// Shared palette so all voxel demos match the project theme.
const VOX_COLORS: Record<string, string> = {
    bg: '#0d1117',
    sky: '#1a2547',
    grid: '#2a3550',
    gridLine: '#3a4a6a',
    accent: '#ffa726',
    hover: '#ff7043',
    label: '#e0e0e0',
    labelMuted: '#9e9e9e',
    cull: '#ef5350'
};`;

DEPENDENCY_BUNDLES_TS.vox_clearCanvas = `function clearCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    bgColor: string = '#0d1117'
): void {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
}`;

DEPENDENCY_BUNDLES_TS.vox_materials = `type Material = { id: number; name: string; color: string | null; solid: boolean };
const VOX_MATERIALS: Material[] = [
    { id: 0, name: 'air',   color: null,      solid: false },
    { id: 1, name: 'dirt',  color: '#7a4f2b', solid: true  },
    { id: 2, name: 'grass', color: '#4a8a3a', solid: true  },
    { id: 3, name: 'stone', color: '#6e6e7a', solid: true  },
    { id: 4, name: 'ore',   color: '#d4a843', solid: true  },
    { id: 5, name: 'wood',  color: '#8a5a2a', solid: true  },
    { id: 6, name: 'sand',  color: '#d7c878', solid: true  },
    { id: 7, name: 'water', color: '#4fc3f7', solid: false }
];`;

DEPENDENCY_BUNDLES_TS.vox_drawTile = `function drawTile(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    size: number,
    materialId: number
): void {
    const m = VOX_MATERIALS[materialId];
    if (!m || !m.color) return;
    ctx.fillStyle = m.color;
    ctx.fillRect(sx, sy, size, size);
}`;

DEPENDENCY_BUNDLES_TS.vox_hash2D = `function hash2D(x: number, y: number, seed: number = 0): number {
    let h: number = (x * 374761393) ^ (y * 668265263) ^ (seed * 2147483647);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
}`;

DEPENDENCY_BUNDLES_TS.vox_TileWorld = `class TileWorld {
    width: number;
    height: number;
    tiles: Uint8Array;
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.tiles = new Uint8Array(width * height);
    }
    get(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.tiles[y * this.width + x];
    }
    set(x: number, y: number, v: number): void {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.tiles[y * this.width + x] = v;
    }
    inBounds(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
}`;

// =============================================================================
// DEMO — vox_drawGrid
// 30×15 hand-authored cross-section with overlay toggles (button-only controls
// so the scaffold renders them correctly).
// =============================================================================
DEMO_HTML.vox_drawGrid = {
    title: 'Voxel — Drawing a Tile Grid',
    canvas: { width: 720, height: 360 },
    controls: [
        { id: 'btnDrawGridFill',  text: 'Show fill' },
        { id: 'btnDrawGridLines', text: 'Show grid lines' },
        { id: 'btnDrawGridIds',   text: 'Show material IDs' }
    ],
    info: 'A 30×15 hand-authored world.'
};

DEMO_CODE.vox_drawGrid = `(function voxDrawGridDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    ctx.imageSmoothingEnabled = false;

    // Build the world inline so this export is self-contained.
    const W = 30, H = 15;
    const world = new TileWorld(W, H);
    for (let x = 0; x < W; x++) {
        const surfaceY = 4 + Math.round(Math.sin(x * 0.5) * 0.6);
        for (let y = 0; y < H; y++) {
            if (y < surfaceY)            world.set(x, y, 0); // sky
            else if (y === surfaceY)     world.set(x, y, 2); // grass
            else if (y < surfaceY + 4)   world.set(x, y, 1); // dirt
            else                         world.set(x, y, 3); // stone
        }
    }
    // Scatter ore in the stone band.
    for (let y = 5; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (world.get(x, y) === 3 && (((x * 13) ^ (y * 7)) % 17) === 0) world.set(x, y, 4);
        }
    }
    // A tiny wood feature on the surface.
    world.set(6, 3, 5); world.set(6, 4, 5);

    const TILE = 24;
    const ox = (canvas.width - W * TILE) / 2;
    const oy = (canvas.height - H * TILE) / 2;
    const state = { fill: true, lines: false, ids: false };

    function syncButtons() {
        document.getElementById('btnDrawGridFill') ?.classList.toggle('active', state.fill);
        document.getElementById('btnDrawGridLines')?.classList.toggle('active', state.lines);
        document.getElementById('btnDrawGridIds')  ?.classList.toggle('active', state.ids);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        if (state.fill) {
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
                }
            }
        }
        if (state.lines) {
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= W; x++) {
                ctx.beginPath();
                ctx.moveTo(ox + x * TILE + 0.5, oy);
                ctx.lineTo(ox + x * TILE + 0.5, oy + H * TILE);
                ctx.stroke();
            }
            for (let y = 0; y <= H; y++) {
                ctx.beginPath();
                ctx.moveTo(ox,             oy + y * TILE + 0.5);
                ctx.lineTo(ox + W * TILE,  oy + y * TILE + 0.5);
                ctx.stroke();
            }
        }
        if (state.ids) {
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
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
            \`\${W}×\${H} world, \${TILE}px tiles · fill \${state.fill ? 'on' : 'off'}, \` +
            \`lines \${state.lines ? 'on' : 'off'}, IDs \${state.ids ? 'on' : 'off'}\`;
    }

    document.getElementById('btnDrawGridFill') ?.addEventListener('click', () => { state.fill  = !state.fill;  syncButtons(); render(); });
    document.getElementById('btnDrawGridLines')?.addEventListener('click', () => { state.lines = !state.lines; syncButtons(); render(); });
    document.getElementById('btnDrawGridIds')  ?.addEventListener('click', () => { state.ids   = !state.ids;   syncButtons(); render(); });

    syncButtons();
    render();
})();`;

// TypeScript variant — same logic, typed.
DEMO_CODE_TS.vox_drawGrid = `(function voxDrawGridDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
    ctx.imageSmoothingEnabled = false;

    const W: number = 30, H: number = 15;
    const world = new TileWorld(W, H);
    for (let x = 0; x < W; x++) {
        const surfaceY: number = 4 + Math.round(Math.sin(x * 0.5) * 0.6);
        for (let y = 0; y < H; y++) {
            if (y < surfaceY)            world.set(x, y, 0);
            else if (y === surfaceY)     world.set(x, y, 2);
            else if (y < surfaceY + 4)   world.set(x, y, 1);
            else                         world.set(x, y, 3);
        }
    }
    for (let y = 5; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (world.get(x, y) === 3 && (((x * 13) ^ (y * 7)) % 17) === 0) world.set(x, y, 4);
        }
    }
    world.set(6, 3, 5); world.set(6, 4, 5);

    const TILE: number = 24;
    const ox: number = (canvas.width - W * TILE) / 2;
    const oy: number = (canvas.height - H * TILE) / 2;
    const state = { fill: true, lines: false, ids: false };

    function syncButtons(): void {
        (document.getElementById('btnDrawGridFill')  as HTMLButtonElement | null)?.classList.toggle('active', state.fill);
        (document.getElementById('btnDrawGridLines') as HTMLButtonElement | null)?.classList.toggle('active', state.lines);
        (document.getElementById('btnDrawGridIds')   as HTMLButtonElement | null)?.classList.toggle('active', state.ids);
    }

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height, VOX_COLORS.sky);
        if (state.fill) {
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    drawTile(ctx, ox + x * TILE, oy + y * TILE, TILE, world.get(x, y));
                }
            }
        }
        if (state.lines) {
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= W; x++) {
                ctx.beginPath();
                ctx.moveTo(ox + x * TILE + 0.5, oy);
                ctx.lineTo(ox + x * TILE + 0.5, oy + H * TILE);
                ctx.stroke();
            }
            for (let y = 0; y <= H; y++) {
                ctx.beginPath();
                ctx.moveTo(ox,            oy + y * TILE + 0.5);
                ctx.lineTo(ox + W * TILE, oy + y * TILE + 0.5);
                ctx.stroke();
            }
        }
        if (state.ids) {
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const id: number = world.get(x, y);
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
            \`\${W}×\${H} world, \${TILE}px tiles · fill \${state.fill ? 'on' : 'off'}, \` +
            \`lines \${state.lines ? 'on' : 'off'}, IDs \${state.ids ? 'on' : 'off'}\`;
    }

    (document.getElementById('btnDrawGridFill')  as HTMLButtonElement | null)?.addEventListener('click', (): void => { state.fill  = !state.fill;  syncButtons(); render(); });
    (document.getElementById('btnDrawGridLines') as HTMLButtonElement | null)?.addEventListener('click', (): void => { state.lines = !state.lines; syncButtons(); render(); });
    (document.getElementById('btnDrawGridIds')   as HTMLButtonElement | null)?.addEventListener('click', (): void => { state.ids   = !state.ids;   syncButtons(); render(); });

    syncButtons();
    render();
})();`;
