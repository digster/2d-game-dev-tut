// =============================================================================
// ISOMETRIC STRATEGY — BEGINNER TIER DEMOS
// =============================================================================
// Every demo is wrapped in an IIFE so its locals don't leak into the global
// scope. Each one runs only if its target canvas exists in the DOM — that way
// the file is safe to include from any page in the track even if a canvas is
// missing.
// =============================================================================

(function setupScrollToTop() {
    // Reused on every page in the project — same behavior as beginner-demos.js
    // in the project root, just kept local so this file stands alone.
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
// Shared palette so all demos look cohesive with the existing project theme.
// ---------------------------------------------------------------------------
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
};

// =============================================================================
// DEMO 1 — Camera comparison (top-down vs side vs iso)
// Same logical scene rendered three ways, switched by buttons.
// =============================================================================
(function cameraCompareDemo() {
    const canvas = document.getElementById('cameraCompare');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('cameraCompareInfo');

    // Logical world (in arbitrary units): a player, a tree, a building.
    // We render them three different ways. No real physics — just visual layout.
    const world = {
        ground: { w: 6, h: 6 },
        player:   { x: 2, y: 3, z: 0 },
        tree:     { x: 4, y: 1, z: 0 },
        building: { x: 1, y: 4, z: 0, w: 2, h: 2 }
    };

    function renderTopDown() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const cellSize = 50;
        const ox = (canvas.width - world.ground.w * cellSize) / 2;
        const oy = 50;

        // Ground
        ctx.fillStyle = '#1e3a2f';
        ctx.fillRect(ox, oy, world.ground.w * cellSize, world.ground.h * cellSize);
        ctx.strokeStyle = ISO_COLORS.gridLine;
        for (let i = 0; i <= world.ground.w; i++) {
            ctx.beginPath();
            ctx.moveTo(ox + i * cellSize, oy);
            ctx.lineTo(ox + i * cellSize, oy + world.ground.h * cellSize);
            ctx.stroke();
        }
        for (let i = 0; i <= world.ground.h; i++) {
            ctx.beginPath();
            ctx.moveTo(ox, oy + i * cellSize);
            ctx.lineTo(ox + world.ground.w * cellSize, oy + i * cellSize);
            ctx.stroke();
        }
        // Building (overhead rectangle)
        ctx.fillStyle = ISO_COLORS.building;
        ctx.fillRect(ox + world.building.x * cellSize, oy + world.building.y * cellSize,
                     world.building.w * cellSize, world.building.h * cellSize);
        // Tree (top-down circle)
        ctx.fillStyle = ISO_COLORS.tree;
        ctx.beginPath();
        ctx.arc(ox + (world.tree.x + 0.5) * cellSize, oy + (world.tree.y + 0.5) * cellSize, 14, 0, Math.PI * 2);
        ctx.fill();
        // Player (dot)
        ctx.fillStyle = ISO_COLORS.player;
        ctx.beginPath();
        ctx.arc(ox + (world.player.x + 0.5) * cellSize, oy + (world.player.y + 0.5) * cellSize, 10, 0, Math.PI * 2);
        ctx.fill();
        // Labels
        ctx.fillStyle = ISO_COLORS.label;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Top-down — flat overhead view', 20, 25);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = ISO_COLORS.labelMuted;
        ctx.fillText('You only see roofs / tops. No vertical info.', 20, canvas.height - 15);
    }

    function renderSide() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const groundY = 280;
        // Ground line
        ctx.strokeStyle = '#66bb6a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, groundY);
        ctx.lineTo(canvas.width - 40, groundY);
        ctx.stroke();
        // Sky tint
        ctx.fillStyle = 'rgba(79, 195, 247, 0.05)';
        ctx.fillRect(40, 40, canvas.width - 80, groundY - 40);
        // Building (rectangle standing on ground)
        ctx.fillStyle = ISO_COLORS.building;
        ctx.fillRect(180, groundY - 100, 110, 100);
        // Tree (trunk + canopy)
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(400, groundY - 60, 12, 60);
        ctx.fillStyle = ISO_COLORS.tree;
        ctx.beginPath();
        ctx.arc(406, groundY - 75, 30, 0, Math.PI * 2);
        ctx.fill();
        // Player (capsule)
        ctx.fillStyle = ISO_COLORS.player;
        ctx.beginPath();
        ctx.arc(550, groundY - 25, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(540, groundY - 24, 20, 24);
        // Labels
        ctx.fillStyle = ISO_COLORS.label;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Side view — platformer style', 20, 25);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = ISO_COLORS.labelMuted;
        ctx.fillText('Vertical info is rich, but you only see one side of the world.', 20, canvas.height - 15);
    }

    function renderIso() {
        clearCanvas(ctx, canvas.width, canvas.height);
        // Diamond grid
        const tileW = 64, tileH = 32;
        const originX = canvas.width / 2;
        const originY = 50;
        for (let cy = 0; cy < world.ground.h; cy++) {
            for (let cx = 0; cx < world.ground.w; cx++) {
                const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
                drawIsoTile(ctx, p.x, p.y, tileW, tileH, '#1e3a2f', ISO_COLORS.gridLine);
            }
        }
        // Building — a stacked diamond with sides for height
        const bp = cartToIso(world.building.x, world.building.y, tileW, tileH, originX, originY);
        // Building footprint covers w x h tiles, lift it 60px to fake height
        const bH = 60;
        const fw = world.building.w, fh = world.building.h;
        const farCorner = cartToIso(world.building.x + fw, world.building.y, tileW, tileH, originX, originY);
        const nearCorner = cartToIso(world.building.x, world.building.y + fh, tileW, tileH, originX, originY);
        const oppositeCorner = cartToIso(world.building.x + fw, world.building.y + fh, tileW, tileH, originX, originY);
        // Right side
        ctx.fillStyle = '#7e34a0';
        ctx.beginPath();
        ctx.moveTo(farCorner.x, farCorner.y);
        ctx.lineTo(oppositeCorner.x, oppositeCorner.y);
        ctx.lineTo(oppositeCorner.x, oppositeCorner.y - bH);
        ctx.lineTo(farCorner.x, farCorner.y - bH);
        ctx.closePath();
        ctx.fill();
        // Left side
        ctx.fillStyle = '#8e3eb2';
        ctx.beginPath();
        ctx.moveTo(nearCorner.x, nearCorner.y);
        ctx.lineTo(oppositeCorner.x, oppositeCorner.y);
        ctx.lineTo(oppositeCorner.x, oppositeCorner.y - bH);
        ctx.lineTo(nearCorner.x, nearCorner.y - bH);
        ctx.closePath();
        ctx.fill();
        // Roof — a single diamond raised by bH
        ctx.fillStyle = ISO_COLORS.building;
        ctx.beginPath();
        ctx.moveTo(bp.x, bp.y - bH);
        ctx.lineTo(farCorner.x, farCorner.y - bH);
        ctx.lineTo(oppositeCorner.x, oppositeCorner.y - bH);
        ctx.lineTo(nearCorner.x, nearCorner.y - bH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Tree
        const tp = cartToIso(world.tree.x + 0.5, world.tree.y + 0.5, tileW, tileH, originX, originY);
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(tp.x - 3, tp.y - 30, 6, 30);
        ctx.fillStyle = ISO_COLORS.tree;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y - 38, 16, 0, Math.PI * 2);
        ctx.fill();
        // Player
        const pp = cartToIso(world.player.x + 0.5, world.player.y + 0.5, tileW, tileH, originX, originY);
        ctx.fillStyle = ISO_COLORS.player;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(pp.x - 7, pp.y - 13, 14, 18);
        // Labels
        ctx.fillStyle = ISO_COLORS.label;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Isometric — best of both', 20, 25);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = ISO_COLORS.labelMuted;
        ctx.fillText('See tops AND fronts at once. No real 3D math.', 20, canvas.height - 15);
    }

    function setActive(activeId) {
        ['btnCamTopDown', 'btnCamSide', 'btnCamIso'].forEach(id => {
            document.getElementById(id)?.classList.toggle('active', id === activeId);
        });
    }

    document.getElementById('btnCamTopDown')?.addEventListener('click', () => {
        renderTopDown();
        info.textContent = 'Top-down view: you can plan tactically but lose all height info.';
        setActive('btnCamTopDown');
    });
    document.getElementById('btnCamSide')?.addEventListener('click', () => {
        renderSide();
        info.textContent = 'Side view: jumping platforms feel great but you cannot see behind objects.';
        setActive('btnCamSide');
    });
    document.getElementById('btnCamIso')?.addEventListener('click', () => {
        renderIso();
        info.textContent = 'Isometric: the building has a roof AND visible side walls, no 3D engine needed.';
        setActive('btnCamIso');
    });

    // Default: iso (the whole point of this track)
    renderIso();
    info.textContent = 'Showing isometric. Try the other two for comparison.';
    setActive('btnCamIso');
})();

// =============================================================================
// DEMO 2 — Projection variants (true iso, diamond 2:1, staggered)
// Draws the same 4x4 grid using three different projection math.
// =============================================================================
(function projectionCompareDemo() {
    const canvas = document.getElementById('projectionCompare');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('projectionCompareInfo');

    const MAP = 4;

    function drawTrueIso() {
        clearCanvas(ctx, canvas.width, canvas.height);
        // True iso: each axis at 30° from horizontal. Tile is a rhombus with
        // width/height ratio cos(30):sin(30) ~ 1.732:1. We pick tileW=70 so the
        // grid is comparable size to the diamond demo.
        const tileSize = 50; // edge length
        const ax = Math.cos(Math.PI / 6); // cos 30
        const ay = Math.sin(Math.PI / 6); // sin 30
        const originX = canvas.width / 2;
        const originY = 50;
        for (let cy = 0; cy < MAP; cy++) {
            for (let cx = 0; cx < MAP; cx++) {
                // Four corners of the rhombus tile
                const x0 = originX + (cx - cy) * tileSize * ax;
                const y0 = originY + (cx + cy) * tileSize * ay;
                const x1 = x0 + tileSize * ax;
                const y1 = y0 + tileSize * ay;
                const x2 = x0;
                const y2 = y0 + 2 * tileSize * ay;
                const x3 = x0 - tileSize * ax;
                const y3 = y0 + tileSize * ay;
                ctx.fillStyle = '#2a3550';
                ctx.strokeStyle = ISO_COLORS.gridLine;
                ctx.beginPath();
                ctx.moveTo(x0, y0);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x3, y3);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
        labelPanel('True isometric (30° / 30°)', 'Slope = 1/√3 ≈ 0.577 — fractional, blurry in pixel art.');
    }

    function drawDiamond() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const tileW = 80, tileH = 40;
        const originX = canvas.width / 2;
        const originY = 50;
        for (let cy = 0; cy < MAP; cy++) {
            for (let cx = 0; cx < MAP; cx++) {
                const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
                drawIsoTile(ctx, p.x, p.y, tileW, tileH, '#2a3550', ISO_COLORS.gridLine);
            }
        }
        labelPanel('Diamond 2:1', 'Slope = exactly 0.5 — crisp pixel-art lines. This is what we build with.');
    }

    function drawStaggered() {
        clearCanvas(ctx, canvas.width, canvas.height);
        // Staggered: regular rectangular tiles, but odd rows offset by half-width.
        const tileW = 70, tileH = 40;
        const originX = canvas.width / 2 - (MAP * tileW) / 2;
        const originY = 50;
        for (let cy = 0; cy < MAP; cy++) {
            const rowOffset = (cy % 2) * (tileW / 2);
            for (let cx = 0; cx < MAP; cx++) {
                const sx = originX + cx * tileW + rowOffset;
                const sy = originY + cy * (tileH / 2);  // overlap rows by half a tile
                drawIsoTile(ctx, sx + tileW / 2, sy, tileW, tileH, '#2a3550', ISO_COLORS.gridLine);
            }
        }
        labelPanel('Staggered', 'Tiles stored in a rectangular array but visually offset every other row.');
    }

    function labelPanel(title, subtitle) {
        ctx.fillStyle = ISO_COLORS.label;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(title, 20, 25);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = ISO_COLORS.labelMuted;
        ctx.fillText(subtitle, 20, canvas.height - 15);
    }

    function setActive(id) {
        ['btnProjTrue', 'btnProjDiamond', 'btnProjStaggered'].forEach(b => {
            document.getElementById(b)?.classList.toggle('active', b === id);
        });
    }

    document.getElementById('btnProjTrue')?.addEventListener('click', () => {
        drawTrueIso();
        info.textContent = 'True iso has equal axis lengths but fractional pixel slopes.';
        setActive('btnProjTrue');
    });
    document.getElementById('btnProjDiamond')?.addEventListener('click', () => {
        drawDiamond();
        info.textContent = 'Diamond 2:1 gives crisp integer slopes — pixel-art friendly.';
        setActive('btnProjDiamond');
    });
    document.getElementById('btnProjStaggered')?.addEventListener('click', () => {
        drawStaggered();
        info.textContent = 'Staggered looks similar but stores tiles in a plain rectangular array.';
        setActive('btnProjStaggered');
    });

    drawDiamond();
    info.textContent = 'Showing Diamond 2:1 — the projection we commit to in this track.';
    setActive('btnProjDiamond');
})();

// =============================================================================
// DEMO 3 — Tile anatomy diagram
// A static labeled drawing of one 64x32 diamond.
// =============================================================================
(function tileAnatomyDemo() {
    const canvas = document.getElementById('tileAnatomy');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    clearCanvas(ctx, canvas.width, canvas.height);
    const tileW = 160, tileH = 80; // enlarged for readability
    const sx = canvas.width / 2;
    const sy = 40;

    // Tile
    drawIsoTile(ctx, sx, sy, tileW, tileH, '#2a3550', ISO_COLORS.gridLine);

    // Vertex markers
    const top    = { x: sx,            y: sy };
    const right  = { x: sx + tileW / 2, y: sy + tileH / 2 };
    const bottom = { x: sx,            y: sy + tileH };
    const left   = { x: sx - tileW / 2, y: sy + tileH / 2 };
    [top, right, bottom, left].forEach(v => {
        ctx.fillStyle = ISO_COLORS.accent;
        ctx.beginPath();
        ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Labels
    ctx.fillStyle = ISO_COLORS.label;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('top  (sx, sy)', top.x, top.y - 10);
    ctx.textAlign = 'left';
    ctx.fillText('right  (sx + tileW/2, sy + tileH/2)', right.x + 10, right.y + 5);
    ctx.textAlign = 'center';
    ctx.fillText('bottom  (sx, sy + tileH)', bottom.x, bottom.y + 20);
    ctx.textAlign = 'right';
    ctx.fillText('left  (sx − tileW/2, sy + tileH/2)', left.x - 10, left.y + 5);

    // tileW / tileH dimension arrows
    ctx.strokeStyle = ISO_COLORS.accentSoft;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    // horizontal tileW arrow at bottom
    ctx.beginPath();
    ctx.moveTo(left.x, bottom.y + 35);
    ctx.lineTo(right.x, bottom.y + 35);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ISO_COLORS.accentSoft;
    ctx.textAlign = 'center';
    ctx.font = 'italic 13px sans-serif';
    ctx.fillText('tileW (64 in our case)', sx, bottom.y + 50);

    ctx.textAlign = 'left';
    ctx.fillStyle = ISO_COLORS.labelMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText('Diamond 2:1 — tileW is twice tileH.', 12, canvas.height - 12);
})();

// =============================================================================
// DEMO 4 — Math demo (step through cart coords, watch screen coords)
// =============================================================================
(function mathDemo() {
    const canvas = document.getElementById('mathDemo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('mathDemoInfo');

    const tileW = 64, tileH = 32;
    const mapW = 6, mapH = 6;
    const originX = canvas.width / 2;
    const originY = 40;

    let cx = 0, cy = 0;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        // Draw grid
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
        // Marker dot at current tile center
        const p = cartToIso(cx + 0.5, cy + 0.5, tileW, tileH, originX, originY);
        ctx.fillStyle = ISO_COLORS.player;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Coords readout
        const sp = cartToIso(cx, cy, tileW, tileH, originX, originY);
        info.innerHTML =
            `Cartesian tile: <strong>(${cx}, ${cy})</strong> &nbsp;→&nbsp; ` +
            `Screen pixel (top vertex): <strong>(${sp.x.toFixed(0)}, ${sp.y.toFixed(0)})</strong>`;
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
})();

// =============================================================================
// DEMO 5 — Grid demo (adjust tile size and grid count)
// =============================================================================
(function gridDemo() {
    const canvas = document.getElementById('gridDemo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('gridDemoInfo');

    let tileW = 64, tileH = 32;
    let mapW = 10, mapH = 10;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        // Center the grid horizontally. Vertically, push down a bit so the top tile isn't clipped.
        const originX = canvas.width / 2;
        const originY = 30;
        for (let cy = 0; cy < mapH; cy++) {
            for (let cx = 0; cx < mapW; cx++) {
                const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
                // Alternate a slight tint for visual rhythm.
                const tint = ((cx + cy) % 2 === 0) ? '#243049' : '#2a3550';
                drawIsoTile(ctx, p.x, p.y, tileW, tileH, tint, ISO_COLORS.gridLine);
            }
        }
        info.textContent = `Grid: ${mapW}×${mapH} tiles, each ${tileW}×${tileH} px (diamond 2:1).`;
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
})();

// =============================================================================
// DEMO 6 — Mouse picking
// Hover over a tile and it lights up. Shows the tile coords in the info display.
// =============================================================================
(function pickDemo() {
    const canvas = document.getElementById('pickDemo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('pickDemoInfo');

    const tileW = 64, tileH = 32;
    const mapW = 10, mapH = 8;
    const originX = canvas.width / 2;
    const originY = 50;

    let hover = null; // {x, y} or null

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
            info.innerHTML = `Hovering tile <strong>(${t.x}, ${t.y})</strong> &nbsp;|&nbsp; mouse at (${mx.toFixed(0)}, ${my.toFixed(0)})`;
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
})();

// =============================================================================
// DEMO 7 — Paint-the-grid mini-project
// =============================================================================
(function paintGridDemo() {
    const canvas = document.getElementById('paintGrid');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('paintGridInfo');

    const MAP_W = 10, MAP_H = 10;
    const TILE_W = 64, TILE_H = 32;
    const ORIGIN_X = canvas.width / 2;
    const ORIGIN_Y = 40;

    const tiles = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
    let currentColor = '#66bb6a'; // Grass — matches the default-active button
    let currentLabel = 'Grass';
    let isPainting = false;

    function paintAt(mouseX, mouseY) {
        const t = pickTileFromMouse(mouseX, mouseY, ORIGIN_X, ORIGIN_Y, TILE_W, TILE_H, MAP_W, MAP_H);
        if (t) {
            tiles[t.y][t.x] = currentColor;
            info.innerHTML = `Painting <strong>${currentLabel}</strong> at tile (${t.x}, ${t.y}).`;
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
    canvas.addEventListener('mouseup',   () => { isPainting = false; });
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

    // Color picker buttons
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
            // Note: erase paints null (background shows through)
            colorButtons.forEach(({ id: otherId }) => {
                document.getElementById(otherId)?.classList.toggle('active', otherId === id);
            });
            info.innerHTML = `Active brush: <strong>${label}</strong>. Click and drag to paint.`;
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
})();
