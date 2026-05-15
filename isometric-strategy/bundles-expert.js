// =============================================================================
// ISOMETRIC STRATEGY — EXPERT TIER EXPORT BUNDLES
// =============================================================================
// Same pattern as bundles-beginner.js / bundles-intermediate.js. Augments the
// global DEMO_CODE / DEMO_HTML / DEPENDENCY_BUNDLES registries that
// shared/export-demo.js reads.
//
// Distinct bundle keys vs intermediate (iso_ex_colors, iso_ex_terrainColor,
// iso_ex_isWalkable, iso_drawGround, iso_drawUnitGlyph, iso_drawBuilding)
// because the expert source defines its own variants of these helpers.
//
// Canvas-ID convention: scaffold hardcodes <canvas id="canvas"> and
// <div id="info">; every DEMO_CODE retargets the original IDs.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// SHARED ISO HELPERS (re-defined so expert exports stand alone)
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

DEPENDENCY_BUNDLES.iso_lerp = `function lerp(start, end, t) {
    return start + (end - start) * t;
}`;

// TS variants of shared helpers
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
DEPENDENCY_BUNDLES_TS.iso_lerp = `function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}`;

// =============================================================================
// EXPERT-TIER DEPENDENCIES
// =============================================================================

DEPENDENCY_BUNDLES.iso_ex_colors = `const EX_COLORS = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    tree:   '#2f6b2c',
    treeT:  '#5a3a20',
    bldgFill: '#ab47bc',
    bldgEdge: '#ce93d8',
    bldgGhostOk: 'rgba(102, 187, 106, 0.45)',
    bldgGhostBad: 'rgba(239, 83, 80, 0.45)',
    enemyFill: '#ab47bc',
    player: '#66bb6a',
    enemy:  '#ef5350',
    selectRing: '#ffeb3b',
    selectBox: 'rgba(255, 235, 59, 0.18)',
    selectBoxEdge: '#ffeb3b',
    accent: '#ffa726',
    path:   '#ffa726',
    visited:'rgba(255, 235, 59, 0.18)',
    label:  '#e0e0e0',
    muted:  '#9e9e9e',
    hud:    'rgba(13, 17, 23, 0.72)'
};`;

DEPENDENCY_BUNDLES.iso_ex_terrainColor = `function terrainColor(t) {
    switch (t) {
        case 'grass': return EX_COLORS.grass;
        case 'water': return EX_COLORS.water;
        case 'sand':  return EX_COLORS.sand;
        case 'stone': return EX_COLORS.stone;
        default:      return '#1a233a';
    }
}`;

DEPENDENCY_BUNDLES.iso_buildSkirmishMap = `function buildSkirmishMap(width = 14, height = 10) {
    const map = Array.from({ length: height }, () => Array(width).fill('grass'));
    for (let x = 0; x < width; x++) {
        map[5][x] = 'water';
        map[4][x] = 'sand';
        map[6][x] = 'sand';
    }
    map[5][3] = 'sand';
    map[5][10] = 'sand';
    map[1][12] = 'stone';
    map[2][12] = 'stone';
    return { width, height, tiles: map };
}`;

DEPENDENCY_BUNDLES.iso_ex_isWalkable = `function isWalkable(map, cx, cy) {
    if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) return false;
    const t = map.tiles[cy][cx];
    return t === 'grass' || t === 'sand';
}`;

DEPENDENCY_BUNDLES.iso_drawGround = `function drawGround(ctx, map, tW, tH, ox, oy) {
    for (let cy = 0; cy < map.height; cy++) {
        for (let cx = 0; cx < map.width; cx++) {
            const p = cartToIso(cx, cy, tW, tH, ox, oy);
            drawIsoTile(ctx, p.x, p.y, tW, tH, terrainColor(map.tiles[cy][cx]), EX_COLORS.outline);
        }
    }
}`;

DEPENDENCY_BUNDLES.iso_drawUnitGlyph = `function drawUnitGlyph(ctx, cx, cy, tW, tH, ox, oy, color, selected = false, hp = null, maxHp = null) {
    const p = cartToIso(cx + 0.5, cy + 0.5, tW, tH, ox, oy);
    if (selected) {
        ctx.strokeStyle = EX_COLORS.selectRing;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 5, p.y - 13, 10, 14);
    if (hp !== null && maxHp !== null && hp < maxHp) {
        const w = 20;
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x - w / 2, p.y - 28, w, 4);
        ctx.fillStyle = hp / maxHp > 0.4 ? '#66bb6a' : '#ef5350';
        ctx.fillRect(p.x - w / 2, p.y - 28, w * (hp / maxHp), 4);
    }
}`;

DEPENDENCY_BUNDLES.iso_drawBuilding = `function drawBuilding(ctx, anchorX, anchorY, fw, fh, tW, tH, ox, oy, color = EX_COLORS.bldgFill, ghost = false) {
    const top    = cartToIso(anchorX,      anchorY,      tW, tH, ox, oy);
    const right  = cartToIso(anchorX + fw, anchorY,      tW, tH, ox, oy);
    const bottom = cartToIso(anchorX + fw, anchorY + fh, tW, tH, ox, oy);
    const left   = cartToIso(anchorX,      anchorY + fh, tW, tH, ox, oy);
    const h = 26;
    if (!ghost) {
        ctx.fillStyle = '#7e34a0';
        ctx.beginPath();
        ctx.moveTo(right.x, right.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(bottom.x, bottom.y - h);
        ctx.lineTo(right.x, right.y - h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#8e3eb2';
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(bottom.x, bottom.y - h);
        ctx.lineTo(left.x, left.y - h);
        ctx.closePath();
        ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - (ghost ? 0 : h));
    ctx.lineTo(right.x, right.y - (ghost ? 0 : h));
    ctx.lineTo(bottom.x, bottom.y - (ghost ? 0 : h));
    ctx.lineTo(left.x, left.y - (ghost ? 0 : h));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ghost ? '#fff' : EX_COLORS.bldgEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
}`;

DEPENDENCY_BUNDLES.iso_aStarPath = `function aStarPath(map, start, goal, visitedOut = null) {
    if (!isWalkable(map, goal.x, goal.y)) return null;
    if (start.x === goal.x && start.y === goal.y) return [{ x: start.x, y: start.y }];

    const key = (x, y) => \`\${x},\${y}\`;
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = [{ x: start.x, y: start.y, g: 0, f: h(start.x, start.y), parent: null }];
    const visited = new Map();
    while (open.length) {
        open.sort((a, b) => a.f - b.f);
        const cur = open.shift();
        const k = key(cur.x, cur.y);
        if (visited.has(k)) continue;
        visited.set(k, cur);
        if (visitedOut) visitedOut.add(k);
        if (cur.x === goal.x && cur.y === goal.y) {
            const path = [];
            let n = cur;
            while (n) { path.unshift({ x: n.x, y: n.y }); n = n.parent; }
            return path;
        }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (!isWalkable(map, nx, ny) || visited.has(key(nx, ny))) continue;
            open.push({ x: nx, y: ny, g: cur.g + 1, f: cur.g + 1 + h(nx, ny), parent: cur });
        }
    }
    return null;
}`;

DEPENDENCY_BUNDLES.iso_walkToward = `function walkToward(unit, target, dt) {
    const dx = target.cx - unit.cx, dy = target.cy - unit.cy;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) { unit.cx = target.cx; unit.cy = target.cy; return true; }
    const step = unit.speed * dt;
    if (step >= d) { unit.cx = target.cx; unit.cy = target.cy; return true; }
    unit.cx += dx / d * step;
    unit.cy += dy / d * step;
    return false;
}`;

DEPENDENCY_BUNDLES.iso_getMouseLocal = `function getMouseLocal(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}`;

// TS variants — same source bodies with type annotations.
DEPENDENCY_BUNDLES_TS.iso_ex_colors = `const EX_COLORS: Record<string, string> = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    tree:   '#2f6b2c',
    treeT:  '#5a3a20',
    bldgFill: '#ab47bc',
    bldgEdge: '#ce93d8',
    bldgGhostOk: 'rgba(102, 187, 106, 0.45)',
    bldgGhostBad: 'rgba(239, 83, 80, 0.45)',
    enemyFill: '#ab47bc',
    player: '#66bb6a',
    enemy:  '#ef5350',
    selectRing: '#ffeb3b',
    selectBox: 'rgba(255, 235, 59, 0.18)',
    selectBoxEdge: '#ffeb3b',
    accent: '#ffa726',
    path:   '#ffa726',
    visited:'rgba(255, 235, 59, 0.18)',
    label:  '#e0e0e0',
    muted:  '#9e9e9e',
    hud:    'rgba(13, 17, 23, 0.72)'
};`;
DEPENDENCY_BUNDLES_TS.iso_ex_terrainColor = `function terrainColor(t: string): string {
    switch (t) {
        case 'grass': return EX_COLORS.grass;
        case 'water': return EX_COLORS.water;
        case 'sand':  return EX_COLORS.sand;
        case 'stone': return EX_COLORS.stone;
        default:      return '#1a233a';
    }
}`;
DEPENDENCY_BUNDLES_TS.iso_buildSkirmishMap = `type IsoMap = { width: number; height: number; tiles: string[][] };
function buildSkirmishMap(width: number = 14, height: number = 10): IsoMap {
    const map: string[][] = Array.from({ length: height }, () => Array(width).fill('grass') as string[]);
    for (let x = 0; x < width; x++) {
        map[5][x] = 'water';
        map[4][x] = 'sand';
        map[6][x] = 'sand';
    }
    map[5][3] = 'sand';
    map[5][10] = 'sand';
    map[1][12] = 'stone';
    map[2][12] = 'stone';
    return { width, height, tiles: map };
}`;
DEPENDENCY_BUNDLES_TS.iso_ex_isWalkable = `function isWalkable(map: IsoMap, cx: number, cy: number): boolean {
    if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) return false;
    const t = map.tiles[cy][cx];
    return t === 'grass' || t === 'sand';
}`;
DEPENDENCY_BUNDLES_TS.iso_drawGround = `function drawGround(
    ctx: CanvasRenderingContext2D, map: IsoMap,
    tW: number, tH: number, ox: number, oy: number
): void {
    for (let cy = 0; cy < map.height; cy++) {
        for (let cx = 0; cx < map.width; cx++) {
            const p = cartToIso(cx, cy, tW, tH, ox, oy);
            drawIsoTile(ctx, p.x, p.y, tW, tH, terrainColor(map.tiles[cy][cx]), EX_COLORS.outline);
        }
    }
}`;
DEPENDENCY_BUNDLES_TS.iso_drawUnitGlyph = `function drawUnitGlyph(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, tW: number, tH: number, ox: number, oy: number,
    color: string, selected: boolean = false,
    hp: number | null = null, maxHp: number | null = null
): void {
    const p = cartToIso(cx + 0.5, cy + 0.5, tW, tH, ox, oy);
    if (selected) {
        ctx.strokeStyle = EX_COLORS.selectRing;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 5, p.y - 13, 10, 14);
    if (hp !== null && maxHp !== null && hp < maxHp) {
        const w = 20;
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x - w / 2, p.y - 28, w, 4);
        ctx.fillStyle = hp / maxHp > 0.4 ? '#66bb6a' : '#ef5350';
        ctx.fillRect(p.x - w / 2, p.y - 28, w * (hp / maxHp), 4);
    }
}`;
DEPENDENCY_BUNDLES_TS.iso_drawBuilding = `function drawBuilding(
    ctx: CanvasRenderingContext2D,
    anchorX: number, anchorY: number, fw: number, fh: number,
    tW: number, tH: number, ox: number, oy: number,
    color: string = EX_COLORS.bldgFill, ghost: boolean = false
): void {
    const top    = cartToIso(anchorX,      anchorY,      tW, tH, ox, oy);
    const right  = cartToIso(anchorX + fw, anchorY,      tW, tH, ox, oy);
    const bottom = cartToIso(anchorX + fw, anchorY + fh, tW, tH, ox, oy);
    const left   = cartToIso(anchorX,      anchorY + fh, tW, tH, ox, oy);
    const h = 26;
    if (!ghost) {
        ctx.fillStyle = '#7e34a0';
        ctx.beginPath();
        ctx.moveTo(right.x, right.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(bottom.x, bottom.y - h);
        ctx.lineTo(right.x, right.y - h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#8e3eb2';
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(bottom.x, bottom.y);
        ctx.lineTo(bottom.x, bottom.y - h);
        ctx.lineTo(left.x, left.y - h);
        ctx.closePath();
        ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - (ghost ? 0 : h));
    ctx.lineTo(right.x, right.y - (ghost ? 0 : h));
    ctx.lineTo(bottom.x, bottom.y - (ghost ? 0 : h));
    ctx.lineTo(left.x, left.y - (ghost ? 0 : h));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ghost ? '#fff' : EX_COLORS.bldgEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
}`;
DEPENDENCY_BUNDLES_TS.iso_aStarPath = `type Tile = { x: number; y: number };
function aStarPath(map: IsoMap, start: Tile, goal: Tile, visitedOut: Set<string> | null = null): Tile[] | null {
    if (!isWalkable(map, goal.x, goal.y)) return null;
    if (start.x === goal.x && start.y === goal.y) return [{ x: start.x, y: start.y }];

    const key = (x: number, y: number) => \`\${x},\${y}\`;
    const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    type Node = { x: number; y: number; g: number; f: number; parent: Node | null };
    const open: Node[] = [{ x: start.x, y: start.y, g: 0, f: h(start.x, start.y), parent: null }];
    const visited = new Map<string, Node>();
    while (open.length) {
        open.sort((a, b) => a.f - b.f);
        const cur = open.shift() as Node;
        const k = key(cur.x, cur.y);
        if (visited.has(k)) continue;
        visited.set(k, cur);
        if (visitedOut) visitedOut.add(k);
        if (cur.x === goal.x && cur.y === goal.y) {
            const path: Tile[] = [];
            let n: Node | null = cur;
            while (n) { path.unshift({ x: n.x, y: n.y }); n = n.parent; }
            return path;
        }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (!isWalkable(map, nx, ny) || visited.has(key(nx, ny))) continue;
            open.push({ x: nx, y: ny, g: cur.g + 1, f: cur.g + 1 + h(nx, ny), parent: cur });
        }
    }
    return null;
}`;
DEPENDENCY_BUNDLES_TS.iso_walkToward = `function walkToward(unit: any, target: { cx: number; cy: number }, dt: number): boolean {
    const dx = target.cx - unit.cx, dy = target.cy - unit.cy;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) { unit.cx = target.cx; unit.cy = target.cy; return true; }
    const step = unit.speed * dt;
    if (step >= d) { unit.cx = target.cx; unit.cy = target.cy; return true; }
    unit.cx += dx / d * step;
    unit.cy += dy / d * step;
    return false;
}`;
DEPENDENCY_BUNDLES_TS.iso_getMouseLocal = `function getMouseLocal(canvas: HTMLCanvasElement, e: MouseEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}`;

// =============================================================================
// DEMO 1 — iso_selectionDemo
// =============================================================================
DEMO_HTML.iso_selectionDemo = {
    title: 'Iso — Selection: Single, Drag-Box, Double-Click Type-Select',
    canvas: { width: 800, height: 420 },
    controls: [
        { id: 'btnSelClear', text: 'Clear selection' },
        { id: 'btnSelReset', text: 'Reset units' }
    ],
    info: 'Drag to box-select · click a unit · shift-click to add.'
};

DEMO_CODE.iso_selectionDemo = `(function selectionDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = { width: 10, height: 8, tiles: Array.from({ length: 8 }, () => Array(10).fill('grass')) };
    const tW = 56, tH = 28;
    const ox = canvas.width / 2, oy = 30;

    let nextId = 1;
    function buildUnits() {
        return [
            { id: nextId++, type: 'soldier', cx: 2, cy: 2 },
            { id: nextId++, type: 'soldier', cx: 3, cy: 3 },
            { id: nextId++, type: 'soldier', cx: 5, cy: 5 },
            { id: nextId++, type: 'archer',  cx: 6, cy: 2 },
            { id: nextId++, type: 'archer',  cx: 7, cy: 3 },
            { id: nextId++, type: 'worker',  cx: 1, cy: 6 },
            { id: nextId++, type: 'worker',  cx: 3, cy: 6 }
        ];
    }
    let units = buildUnits();
    let selected = new Set();
    let drag = null;
    let lastClick = 0;
    let lastClickedId = null;

    function screenOf(u) {
        return cartToIso(u.cx + 0.5, u.cy + 0.5, tW, tH, ox, oy);
    }
    function unitAt(mx, my) {
        const sorted = [...units].sort((a, b) => (b.cy + b.cx) - (a.cy + a.cx));
        for (const u of sorted) {
            const p = screenOf(u);
            if (Math.hypot(mx - p.x, my - (p.y - 8)) < 12) return u;
        }
        return null;
    }
    function colorFor(type) {
        return type === 'soldier' ? EX_COLORS.player
             : type === 'archer'  ? '#4fc3f7'
             : '#ffb74d';
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        const sorted = [...units].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
        for (const u of sorted) {
            drawUnitGlyph(ctx, u.cx, u.cy, tW, tH, ox, oy, colorFor(u.type), selected.has(u.id));
        }
        if (drag) {
            const x1 = Math.min(drag.sx, drag.ex), x2 = Math.max(drag.sx, drag.ex);
            const y1 = Math.min(drag.sy, drag.ey), y2 = Math.max(drag.sy, drag.ey);
            ctx.fillStyle = EX_COLORS.selectBox;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.strokeStyle = EX_COLORS.selectBoxEdge;
            ctx.lineWidth = 1;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        }
        const counts = {};
        for (const id of selected) {
            const u = units.find(x => x.id === id);
            if (u) counts[u.type] = (counts[u.type] || 0) + 1;
        }
        const breakdown = Object.entries(counts).map(([k, v]) => \`\${v} \${k}\${v > 1 ? 's' : ''}\`).join(', ') || 'nothing';
        info.innerHTML = \`Selected: <strong>\${selected.size}</strong> &nbsp;(\${breakdown})\`;
    }

    canvas.addEventListener('mousedown', (e) => {
        const m = getMouseLocal(canvas, e);
        const hit = unitAt(m.x, m.y);
        const now = performance.now();
        const isDbl = (now - lastClick < 300) && hit && hit.id === lastClickedId;
        lastClick = now;
        lastClickedId = hit ? hit.id : null;
        if (isDbl && hit) {
            selected = new Set(units.filter(u => u.type === hit.type).map(u => u.id));
            render();
            return;
        }
        if (hit) {
            if (e.shiftKey) {
                if (selected.has(hit.id)) selected.delete(hit.id);
                else selected.add(hit.id);
            } else {
                selected = new Set([hit.id]);
            }
            render();
            return;
        }
        drag = { sx: m.x, sy: m.y, ex: m.x, ey: m.y };
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!drag) return;
        const m = getMouseLocal(canvas, e);
        drag.ex = m.x; drag.ey = m.y;
        render();
    });
    canvas.addEventListener('mouseup', () => {
        if (!drag) return;
        const x1 = Math.min(drag.sx, drag.ex), x2 = Math.max(drag.sx, drag.ex);
        const y1 = Math.min(drag.sy, drag.ey), y2 = Math.max(drag.sy, drag.ey);
        if (Math.abs(x2 - x1) > 4 || Math.abs(y2 - y1) > 4) {
            selected.clear();
            for (const u of units) {
                const p = screenOf(u);
                if (p.x >= x1 && p.x <= x2 && p.y - 8 >= y1 && p.y - 8 <= y2) selected.add(u.id);
            }
        }
        drag = null;
        render();
    });
    canvas.addEventListener('mouseleave', () => { drag = null; render(); });

    document.getElementById('btnSelClear')?.addEventListener('click', () => { selected.clear(); render(); });
    document.getElementById('btnSelReset')?.addEventListener('click', () => {
        units = buildUnits();
        selected.clear();
        render();
    });

    render();
})();`;

// For brevity, the TS variants of demos use the same body with type casts on getElementById + IIFE annotation.
DEMO_CODE_TS.iso_selectionDemo = `(function selectionDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_selectionDemo.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 2 — iso_commandsDemo
// =============================================================================
DEMO_HTML.iso_commandsDemo = {
    title: 'Iso — Commands & Order Queue',
    canvas: { width: 800, height: 420 },
    controls: [],
    info: 'Left-click a unit, right-click to queue moves · shift-right-click to append.'
};

DEMO_CODE.iso_commandsDemo = `(function commandsDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = { width: 10, height: 8, tiles: Array.from({ length: 8 }, () => Array(10).fill('grass')) };
    const tW = 56, tH = 28;
    const ox = canvas.width / 2, oy = 30;

    const unit = { id: 1, cx: 2, cy: 2, speed: 3, orders: [] };
    let selected = false;

    function screenOf(u) {
        return cartToIso(u.cx + 0.5, u.cy + 0.5, tW, tH, ox, oy);
    }
    function unitAt(mx, my) {
        const p = screenOf(unit);
        return Math.hypot(mx - p.x, my - (p.y - 8)) < 14 ? unit : null;
    }
    function pickTile(mx, my) {
        return pickTileFromMouse(mx, my, ox, oy, tW, tH, map.width, map.height);
    }

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const o = unit.orders[0];
        if (o) {
            if (walkToward(unit, { cx: o.cx, cy: o.cy }, dt)) unit.orders.shift();
        }
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        if (unit.orders.length) {
            ctx.strokeStyle = EX_COLORS.accent;
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            const start = screenOf(unit);
            ctx.moveTo(start.x, start.y - 8);
            for (const o of unit.orders) {
                const p = cartToIso(o.cx + 0.5, o.cy + 0.5, tW, tH, ox, oy);
                ctx.lineTo(p.x, p.y - 8);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            for (let i = 0; i < unit.orders.length; i++) {
                const o = unit.orders[i];
                const p = cartToIso(o.cx + 0.5, o.cy + 0.5, tW, tH, ox, oy);
                ctx.fillStyle = EX_COLORS.accent;
                ctx.beginPath();
                ctx.arc(p.x, p.y - 8, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(String(i + 1), p.x, p.y - 5);
                ctx.textAlign = 'start';
            }
        }
        drawUnitGlyph(ctx, unit.cx, unit.cy, tW, tH, ox, oy, EX_COLORS.player, selected);
        const queuedInfo = unit.orders.length > 0
            ? \`Order queue: \${unit.orders.length} (shift+right-click to add)\`
            : 'Idle';
        info.innerHTML = (selected ? '<strong>Unit selected</strong> — ' : 'Click the unit to select. ') + queuedInfo;
    }

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const m = getMouseLocal(canvas, e);
        const hit = unitAt(m.x, m.y);
        selected = !!hit;
    });
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!selected) return;
        const m = getMouseLocal(canvas, e);
        const t = pickTile(m.x, m.y);
        if (!t) return;
        const order = { type: 'move', cx: t.x, cy: t.y };
        if (e.shiftKey) unit.orders.push(order);
        else unit.orders = [order];
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_commandsDemo = `(function commandsDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_commandsDemo.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 3 — iso_pathfindingDemo
// =============================================================================
DEMO_HTML.iso_pathfindingDemo = {
    title: 'Iso — A* Pathfinding on the Grid',
    canvas: { width: 800, height: 440 },
    controls: [
        { id: 'btnPathClear',          text: 'Clear path' },
        { id: 'btnPathToggleHeatmap',  text: 'Show visited cells' }
    ],
    info: 'Click a tile to send the unit through a path that avoids water.'
};

DEMO_CODE.iso_pathfindingDemo = `(function pathfindingDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = (() => {
        const W = 14, H = 9;
        const tiles = Array.from({ length: H }, () => Array(W).fill('grass'));
        for (let x = 2; x < 12; x++) tiles[4][x] = 'water';
        tiles[4][6] = 'sand';
        for (let y = 0; y < 4; y++) tiles[y][9] = 'stone';
        return { width: W, height: H, tiles };
    })();

    const tW = 52, tH = 26;
    const ox = canvas.width / 2, oy = 30;

    const unit = { cx: 1, cy: 1, speed: 3 };
    let path = null;
    let visited = new Set();
    let pathIndex = 0;
    let showHeatmap = true;

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (path && pathIndex < path.length) {
            const wp = path[pathIndex];
            if (walkToward(unit, { cx: wp.x, cy: wp.y }, dt)) pathIndex++;
        }
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        for (let cy = 0; cy < map.height; cy++) {
            for (let cx = 0; cx < map.width; cx++) {
                const p = cartToIso(cx, cy, tW, tH, ox, oy);
                drawIsoTile(ctx, p.x, p.y, tW, tH, terrainColor(map.tiles[cy][cx]), EX_COLORS.outline);
            }
        }
        if (showHeatmap) {
            for (const k of visited) {
                const [cx, cy] = k.split(',').map(Number);
                const p = cartToIso(cx, cy, tW, tH, ox, oy);
                drawIsoTile(ctx, p.x, p.y, tW, tH, EX_COLORS.visited, null);
            }
        }
        if (path) {
            for (let i = pathIndex; i < path.length; i++) {
                const wp = path[i];
                const p = cartToIso(wp.x, wp.y, tW, tH, ox, oy);
                drawIsoTile(ctx, p.x, p.y, tW, tH, null, EX_COLORS.path);
            }
        }
        drawUnitGlyph(ctx, unit.cx, unit.cy, tW, tH, ox, oy, EX_COLORS.player);
        if (path) {
            ctx.fillStyle = EX_COLORS.label;
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(\`Path length: \${path.length} tiles · Visited: \${visited.size} cells\`, 14, canvas.height - 14);
        }
    }

    canvas.addEventListener('click', (e) => {
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (!t) return;
        if (!isWalkable(map, t.x, t.y)) {
            info.innerHTML = \`Tile (\${t.x}, \${t.y}) is not walkable.\`;
            return;
        }
        const start = { x: Math.round(unit.cx), y: Math.round(unit.cy) };
        visited = new Set();
        path = aStarPath(map, start, t, visited);
        pathIndex = 0;
        info.innerHTML = path
            ? \`Path of <strong>\${path.length}</strong> tiles to (\${t.x}, \${t.y}), explored \${visited.size} cells.\`
            : \`No path to (\${t.x}, \${t.y}).\`;
    });

    document.getElementById('btnPathClear')?.addEventListener('click', () => {
        path = null;
        visited.clear();
        pathIndex = 0;
        unit.cx = 1; unit.cy = 1;
        info.textContent = 'Click a tile to send the unit through a path that avoids water.';
    });
    document.getElementById('btnPathToggleHeatmap')?.addEventListener('click', (e) => {
        showHeatmap = !showHeatmap;
        e.target.classList.toggle('active', showHeatmap);
        e.target.textContent = showHeatmap ? 'Show visited cells' : 'Hide visited cells';
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_pathfindingDemo = `(function pathfindingDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_pathfindingDemo.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 4 — iso_buildingDemo
// =============================================================================
DEMO_HTML.iso_buildingDemo = {
    title: 'Iso — Building Placement (Multi-Tile Footprints)',
    canvas: { width: 800, height: 440 },
    controls: [
        { id: 'btnBuild2x2',  text: 'Place 2×2' },
        { id: 'btnBuild3x3',  text: 'Place 3×3' },
        { id: 'btnBuild1x2',  text: 'Place 1×2' },
        { id: 'btnBuildClear', text: 'Clear all' }
    ],
    info: 'Pick a footprint, then click a valid tile to place.'
};

DEMO_CODE.iso_buildingDemo = `(function buildingDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildSkirmishMap(14, 10);
    const tW = 52, tH = 26;
    const ox = canvas.width / 2, oy = 50;

    const placed = [];
    let footprint = { w: 2, h: 2 };
    let activeButton = 'btnBuild2x2';
    let hover = null;

    function isBlocked(cx, cy) {
        for (const b of placed) {
            if (cx >= b.anchorX && cx < b.anchorX + b.w && cy >= b.anchorY && cy < b.anchorY + b.h) return true;
        }
        return false;
    }
    function canPlace(anchorX, anchorY) {
        for (let dy = 0; dy < footprint.h; dy++) {
            for (let dx = 0; dx < footprint.w; dx++) {
                const cx = anchorX + dx, cy = anchorY + dy;
                if (!isWalkable(map, cx, cy)) return false;
                if (isBlocked(cx, cy)) return false;
            }
        }
        return true;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        const list = [...placed].sort((a, b) => (a.anchorY + a.anchorX) - (b.anchorY + b.anchorX));
        for (const b of list) {
            drawBuilding(ctx, b.anchorX, b.anchorY, b.w, b.h, tW, tH, ox, oy);
        }
        if (hover) {
            const ok = canPlace(hover.x, hover.y);
            drawBuilding(ctx, hover.x, hover.y, footprint.w, footprint.h, tW, tH, ox, oy,
                ok ? EX_COLORS.bldgGhostOk : EX_COLORS.bldgGhostBad, true);
            info.innerHTML = ok
                ? \`Place \${footprint.w}×\${footprint.h} at <strong>(\${hover.x}, \${hover.y})</strong> — valid.\`
                : \`Cannot place at <strong>(\${hover.x}, \${hover.y})</strong> — terrain or overlap.\`;
        }
    }

    canvas.addEventListener('mousemove', (e) => {
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width - footprint.w + 1, map.height - footprint.h + 1);
        hover = t;
        render();
    });
    canvas.addEventListener('mouseleave', () => { hover = null; render(); });
    canvas.addEventListener('click', (e) => {
        if (!hover) return;
        if (!canPlace(hover.x, hover.y)) return;
        placed.push({ anchorX: hover.x, anchorY: hover.y, w: footprint.w, h: footprint.h });
        render();
    });

    function setFootprint(w, h, btnId) {
        footprint = { w, h };
        activeButton = btnId;
        ['btnBuild2x2','btnBuild3x3','btnBuild1x2'].forEach(id => {
            document.getElementById(id)?.classList.toggle('active', id === btnId);
        });
    }
    document.getElementById('btnBuild2x2')?.addEventListener('click', () => setFootprint(2, 2, 'btnBuild2x2'));
    document.getElementById('btnBuild3x3')?.addEventListener('click', () => setFootprint(3, 3, 'btnBuild3x3'));
    document.getElementById('btnBuild1x2')?.addEventListener('click', () => setFootprint(1, 2, 'btnBuild1x2'));
    document.getElementById('btnBuildClear')?.addEventListener('click', () => {
        placed.length = 0;
        render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_buildingDemo = `(function buildingDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_buildingDemo.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 5 — iso_gatheringDemo
// =============================================================================
DEMO_HTML.iso_gatheringDemo = {
    title: 'Iso — Resource Gathering Loop (Worker State Machine)',
    canvas: { width: 800, height: 420 },
    controls: [
        { id: 'btnGatherFaster', text: 'Speed × 1.5' },
        { id: 'btnGatherSlower', text: 'Speed / 1.5' },
        { id: 'btnGatherReset',  text: 'Reset' }
    ],
    info: 'Watch the worker cycle: walk → harvest → return → deposit.'
};

DEMO_CODE.iso_gatheringDemo = `(function gatheringDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = { width: 10, height: 8, tiles: Array.from({ length: 8 }, () => Array(10).fill('grass')) };
    const tW = 56, tH = 28;
    const ox = canvas.width / 2, oy = 40;

    const resource = { cx: 7, cy: 2 };
    const dropoff  = { cx: 2, cy: 6 };
    const world = { wood: 0 };
    let speedMul = 1;

    function makeWorker(cx, cy) {
        return { cx, cy, speed: 2, state: 'walking_to_resource', resource, dropoff, gatherTimer: 0, carrying: 0 };
    }
    const workers = [makeWorker(2, 6), makeWorker(3, 6)];

    function tickWorker(w, dt) {
        switch (w.state) {
            case 'walking_to_resource':
                if (walkToward(w, w.resource, dt)) { w.state = 'gathering'; w.gatherTimer = 1.5; }
                break;
            case 'gathering':
                w.gatherTimer -= dt;
                if (w.gatherTimer <= 0) { w.carrying = 10; w.state = 'walking_to_dropoff'; }
                break;
            case 'walking_to_dropoff':
                if (walkToward(w, w.dropoff, dt)) {
                    world.wood += w.carrying;
                    w.carrying = 0;
                    w.state = 'walking_to_resource';
                }
                break;
        }
    }

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05) * speedMul;
        last = now;
        for (const w of workers) tickWorker(w, dt);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        const tp = cartToIso(resource.cx + 0.5, resource.cy + 0.5, tW, tH, ox, oy);
        ctx.fillStyle = EX_COLORS.treeT;
        ctx.fillRect(tp.x - 3, tp.y - 26, 6, 26);
        ctx.fillStyle = EX_COLORS.tree;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y - 32, 14, 0, Math.PI * 2);
        ctx.fill();
        drawBuilding(ctx, dropoff.cx, dropoff.cy, 1, 1, tW, tH, ox, oy, '#a17b2f');
        for (const w of workers) {
            const color = w.state === 'gathering' ? '#ffd180' : (w.carrying > 0 ? '#ffe082' : '#ffb74d');
            drawUnitGlyph(ctx, w.cx, w.cy, tW, tH, ox, oy, color);
        }
        info.innerHTML = \`Wood collected: <strong>\${world.wood}</strong>  ·  speed×\${speedMul.toFixed(1)}\`;
    }

    document.getElementById('btnGatherFaster')?.addEventListener('click', () => { speedMul = Math.min(speedMul + 0.5, 4); });
    document.getElementById('btnGatherSlower')?.addEventListener('click', () => { speedMul = Math.max(speedMul - 0.5, 0.5); });
    document.getElementById('btnGatherReset')?.addEventListener('click', () => {
        world.wood = 0;
        for (let i = 0; i < workers.length; i++) Object.assign(workers[i], makeWorker(2 + i, 6));
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_gatheringDemo = `(function gatheringDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_gatheringDemo.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 6 — iso_productionDemo
// =============================================================================
DEMO_HTML.iso_productionDemo = {
    title: 'Iso — Production Buildings with a Queue',
    canvas: { width: 800, height: 420 },
    controls: [
        { id: 'btnTrainSoldier', text: 'Train Soldier (2s)' },
        { id: 'btnTrainArcher',  text: 'Train Archer (3s)' },
        { id: 'btnCancelJob',    text: 'Cancel head' },
        { id: 'btnSetRally',     text: 'Set rally (click on grid)' }
    ],
    info: 'Queue trains. Click "Set rally", then a tile, to redirect spawns.'
};

DEMO_CODE.iso_productionDemo = `(function productionDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = { width: 10, height: 8, tiles: Array.from({ length: 8 }, () => Array(10).fill('grass')) };
    const tW = 56, tH = 28;
    const ox = canvas.width / 2, oy = 40;

    const building = {
        anchorX: 1, anchorY: 1, w: 2, h: 2,
        queue: [],
        progress: 0,
        rally: { cx: 6, cy: 5 }
    };
    let nextId = 1;
    const units = [];
    let settingRally = false;

    function tickBuilding(dt) {
        const job = building.queue[0];
        if (!job) return;
        building.progress += dt;
        if (building.progress >= job.buildTime) {
            const spawnX = building.anchorX + building.w;
            const spawnY = building.anchorY + building.h - 1;
            units.push({
                id: nextId++,
                type: job.unitType,
                cx: spawnX, cy: spawnY,
                target: { cx: building.rally.cx, cy: building.rally.cy },
                speed: 3
            });
            building.queue.shift();
            building.progress = 0;
        }
    }

    function tickUnit(u, dt) { walkToward(u, u.target, dt); }

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        tickBuilding(dt);
        for (const u of units) tickUnit(u, dt);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        drawBuilding(ctx, building.anchorX, building.anchorY, building.w, building.h, tW, tH, ox, oy);
        const rp = cartToIso(building.rally.cx + 0.5, building.rally.cy + 0.5, tW, tH, ox, oy);
        ctx.fillStyle = EX_COLORS.accent;
        ctx.beginPath();
        ctx.moveTo(rp.x, rp.y - 30);
        ctx.lineTo(rp.x + 12, rp.y - 24);
        ctx.lineTo(rp.x, rp.y - 18);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#7d4f00';
        ctx.beginPath();
        ctx.moveTo(rp.x, rp.y - 30);
        ctx.lineTo(rp.x, rp.y - 4);
        ctx.stroke();
        for (const u of [...units].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx))) {
            const color = u.type === 'archer' ? '#4fc3f7' : EX_COLORS.player;
            drawUnitGlyph(ctx, u.cx, u.cy, tW, tH, ox, oy, color);
        }
        const job = building.queue[0];
        const queueLine = job
            ? \`Building <strong>\${job.unitType}</strong> (\${building.progress.toFixed(1)} / \${job.buildTime}s)\`
            : 'Queue empty';
        const rest = building.queue.slice(1).map(j => j.unitType).join(', ');
        info.innerHTML = \`\${queueLine}\${rest ? ' &nbsp;· up next: ' + rest : ''} &nbsp;· spawned \${units.length}\`;
    }

    canvas.addEventListener('click', (e) => {
        if (!settingRally) return;
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (t) {
            building.rally.cx = t.x; building.rally.cy = t.y;
            settingRally = false;
            document.getElementById('btnSetRally').textContent = 'Set rally (click on grid)';
        }
    });

    document.getElementById('btnTrainSoldier')?.addEventListener('click', () => {
        building.queue.push({ unitType: 'soldier', buildTime: 2 });
    });
    document.getElementById('btnTrainArcher')?.addEventListener('click', () => {
        building.queue.push({ unitType: 'archer', buildTime: 3 });
    });
    document.getElementById('btnCancelJob')?.addEventListener('click', () => {
        building.queue.shift();
        building.progress = 0;
    });
    document.getElementById('btnSetRally')?.addEventListener('click', (e) => {
        settingRally = !settingRally;
        e.target.textContent = settingRally ? 'Now click a tile…' : 'Set rally (click on grid)';
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_productionDemo = `(function productionDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_productionDemo.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 7 — iso_combatDemo
// =============================================================================
DEMO_HTML.iso_combatDemo = {
    title: 'Iso — Basic Combat (HP, Range, Damage)',
    canvas: { width: 800, height: 380 },
    controls: [
        { id: 'btnCombatStart', text: 'Start fight' },
        { id: 'btnCombatReset', text: 'Reset' },
        { id: 'btnCombatSwap',  text: 'Swap melee ↔ ranged' }
    ],
    info: 'Two units shoot/melee until one drops.'
};

DEMO_CODE.iso_combatDemo = `(function combatDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = { width: 8, height: 6, tiles: Array.from({ length: 6 }, () => Array(8).fill('grass')) };
    const tW = 60, tH = 30;
    const ox = canvas.width / 2, oy = 50;

    function makeUnits() {
        return {
            player: { cx: 1, cy: 3, hp: 80, maxHp: 80, attackDamage: 8, attackRange: 3.0, attackCooldown: 0, attackCooldownMax: 1.0, speed: 1.5, color: '#4fc3f7', label: 'Ranged' },
            enemy:  { cx: 6, cy: 3, hp: 100, maxHp: 100, attackDamage: 5, attackRange: 1.0, attackCooldown: 0, attackCooldownMax: 0.7, speed: 1.8, color: '#ef5350', label: 'Melee' }
        };
    }
    let { player, enemy } = makeUnits();
    let running = false;
    let projectiles = [];

    function fire(from, to) {
        projectiles.push({
            fromX: from.cx, fromY: from.cy,
            toX: to.cx, toY: to.cy,
            t: 0
        });
    }

    function tickPair(dt) {
        for (const [me, foe] of [[player, enemy], [enemy, player]]) {
            if (me.hp <= 0 || foe.hp <= 0) continue;
            me.attackCooldown = Math.max(0, me.attackCooldown - dt);
            const d = Math.hypot(foe.cx - me.cx, foe.cy - me.cy);
            if (d <= me.attackRange) {
                if (me.attackCooldown === 0) {
                    foe.hp -= me.attackDamage;
                    me.attackCooldown = me.attackCooldownMax;
                    if (me.attackRange > 1.5) fire(me, foe);
                }
            } else {
                const dx = foe.cx - me.cx, dy = foe.cy - me.cy;
                const step = me.speed * dt;
                me.cx += dx / d * step;
                me.cy += dy / d * step;
            }
        }
        for (const p of projectiles) p.t += dt * 4;
        projectiles = projectiles.filter(p => p.t < 1);
    }

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (running) tickPair(dt);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        for (const u of [player, enemy].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx))) {
            if (u.hp > 0) drawUnitGlyph(ctx, u.cx, u.cy, tW, tH, ox, oy, u.color, false, u.hp, u.maxHp);
            else {
                const p = cartToIso(u.cx + 0.5, u.cy + 0.5, tW, tH, ox, oy);
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 14); ctx.lineTo(p.x + 6, p.y - 6); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(p.x + 6, p.y - 14); ctx.lineTo(p.x - 6, p.y - 6); ctx.stroke();
            }
        }
        for (const proj of projectiles) {
            const from = cartToIso(proj.fromX + 0.5, proj.fromY + 0.5, tW, tH, ox, oy);
            const to   = cartToIso(proj.toX + 0.5, proj.toY + 0.5, tW, tH, ox, oy);
            const x = lerp(from.x, to.x, proj.t);
            const y = lerp(from.y - 12, to.y - 12, proj.t);
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = EX_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(\`\${player.label}: \${Math.max(0, Math.ceil(player.hp))}/\${player.maxHp}HP   vs   \${enemy.label}: \${Math.max(0, Math.ceil(enemy.hp))}/\${enemy.maxHp}HP\`, 14, canvas.height - 14);
        if (player.hp <= 0 || enemy.hp <= 0) {
            const winner = player.hp > 0 ? player.label : enemy.label;
            info.innerHTML = \`Winner: <strong>\${winner}</strong>\`;
        } else if (running) {
            info.textContent = 'Fight in progress…';
        }
    }

    document.getElementById('btnCombatStart')?.addEventListener('click', () => { running = true; });
    document.getElementById('btnCombatReset')?.addEventListener('click', () => {
        const reset = makeUnits();
        player = reset.player; enemy = reset.enemy;
        projectiles = [];
        running = false;
        info.textContent = 'Reset. Press Start.';
    });
    document.getElementById('btnCombatSwap')?.addEventListener('click', () => {
        const reset = makeUnits();
        player = { ...reset.player, attackRange: 1.0, attackCooldownMax: 0.7, attackDamage: 5, speed: 1.8, label: 'Melee' };
        enemy  = { ...reset.enemy,  attackRange: 3.0, attackCooldownMax: 1.0, attackDamage: 8, speed: 1.5, label: 'Ranged' };
        projectiles = [];
        running = false;
        info.textContent = 'Roles swapped. Press Start.';
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_combatDemo = `(function combatDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_combatDemo.split('\n').slice(4, -1).join('\n')}
})();`;

// =============================================================================
// DEMO 8 — iso_skirmishDemo (tabindex injected at startup; full integration)
// =============================================================================
DEMO_HTML.iso_skirmishDemo = {
    title: 'Iso — Mini-Project: Tiny Skirmish',
    canvas: { width: 800, height: 500 },
    controls: [
        { id: 'btnSkirmishStart', text: 'Start' },
        { id: 'btnSkirmishPause', text: 'Pause' },
        { id: 'btnSkirmishTrain', text: 'Train at HQ' },
        { id: 'btnSkirmishReset', text: 'Reset' }
    ],
    info: 'Drag-select your units, right-click to move/attack. Train more at the HQ.'
};

DEMO_CODE.iso_skirmishDemo = `(function skirmishDemo() {
    const canvas = document.getElementById('canvas');
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildSkirmishMap(14, 10);
    const tW = 52, tH = 26;
    const ox = canvas.width / 2, oy = 50;

    const world = {
        nextId: 1,
        units: [],
        buildings: [
            { team: 'player', anchorX: 0, anchorY: 0, w: 2, h: 2, kind: 'town', queue: [], progress: 0, rally: { cx: 3, cy: 2 } },
            { team: 'enemy',  anchorX: 12, anchorY: 0, w: 2, h: 2, kind: 'barracks', queue: [], progress: 0, rally: { cx: 12, cy: 7 } }
        ],
        resources: 0,
        enemySpawnTimer: 3.0
    };

    function addUnit(team, cx, cy, type) {
        const isWorker = type === 'worker';
        const isArcher = type === 'archer';
        world.units.push({
            id: world.nextId++,
            team, type,
            cx, cy,
            speed: isWorker ? 2.5 : 3,
            orders: [],
            currentPath: null,
            pathIndex: 0,
            hp: isWorker ? 30 : 60,
            maxHp: isWorker ? 30 : 60,
            attackDamage: isWorker ? 0 : (isArcher ? 8 : 6),
            attackRange: isWorker ? 0 : (isArcher ? 3 : 1.2),
            attackCooldown: 0,
            attackCooldownMax: isWorker ? 0 : (isArcher ? 1.2 : 0.8),
            workerState: isWorker ? 'walking_to_resource' : null,
            gatherTimer: 0,
            carrying: 0,
            resource: isWorker ? { cx: 2, cy: 2 } : null,
            dropoff:  isWorker ? { cx: 1, cy: 1 } : null
        });
    }
    function reset() {
        world.units = [];
        world.buildings.forEach(b => { b.queue = []; b.progress = 0; });
        world.resources = 0;
        world.enemySpawnTimer = 3.0;
        addUnit('player', 3, 2, 'worker');
        addUnit('player', 2, 3, 'soldier');
        addUnit('enemy',  12, 7, 'soldier');
    }
    reset();

    const tree = { cx: 2, cy: 2 };
    let selected = new Set();
    let drag = null;
    let running = true;
    let lastClick = 0;
    let lastClickedId = null;

    function screenOf(u) {
        return cartToIso(u.cx + 0.5, u.cy + 0.5, tW, tH, ox, oy);
    }
    function unitAt(mx, my) {
        const sorted = [...world.units].filter(u => u.hp > 0 && u.team === 'player')
            .sort((a, b) => (b.cy + b.cx) - (a.cy + a.cx));
        for (const u of sorted) {
            const p = screenOf(u);
            if (Math.hypot(mx - p.x, my - (p.y - 8)) < 12) return u;
        }
        return null;
    }

    function tickUnit(u, dt) {
        if (u.hp <= 0) return;
        u.attackCooldown = Math.max(0, u.attackCooldown - dt);

        if (u.type === 'worker' && u.team === 'player' && u.orders.length === 0) {
            switch (u.workerState) {
                case 'walking_to_resource':
                    if (walkToward(u, u.resource, dt)) { u.workerState = 'gathering'; u.gatherTimer = 1.5; }
                    break;
                case 'gathering':
                    u.gatherTimer -= dt;
                    if (u.gatherTimer <= 0) { u.carrying = 10; u.workerState = 'walking_to_dropoff'; }
                    break;
                case 'walking_to_dropoff':
                    if (walkToward(u, u.dropoff, dt)) {
                        world.resources += u.carrying;
                        u.carrying = 0;
                        u.workerState = 'walking_to_resource';
                    }
                    break;
            }
            return;
        }

        if (u.attackDamage > 0) {
            let target = null, bestD = Infinity;
            for (const other of world.units) {
                if (other.team === u.team || other.hp <= 0) continue;
                const d = Math.hypot(other.cx - u.cx, other.cy - u.cy);
                if (d <= u.attackRange && d < bestD) { bestD = d; target = other; }
            }
            if (target && u.attackCooldown === 0) {
                target.hp -= u.attackDamage;
                u.attackCooldown = u.attackCooldownMax;
                return;
            }
        }

        if (u.currentPath && u.pathIndex < u.currentPath.length) {
            const wp = u.currentPath[u.pathIndex];
            if (walkToward(u, { cx: wp.x, cy: wp.y }, dt)) u.pathIndex++;
            if (u.pathIndex >= u.currentPath.length) {
                u.currentPath = null;
                u.orders.shift();
                if (u.orders[0]) startPath(u, u.orders[0]);
            }
            return;
        }
        if (u.orders[0] && !u.currentPath) startPath(u, u.orders[0]);
    }

    function startPath(u, order) {
        const start = { x: Math.round(u.cx), y: Math.round(u.cy) };
        const goal = { x: order.cx, y: order.cy };
        const p = aStarPath(map, start, goal);
        u.currentPath = p;
        u.pathIndex = 0;
    }

    function tickEnemyAI(dt) {
        const enemyBarracks = world.buildings.find(b => b.team === 'enemy');
        if (enemyBarracks.queue.length === 0) {
            const enemyCount = world.units.filter(u => u.team === 'enemy' && u.hp > 0).length;
            if (enemyCount < 3) enemyBarracks.queue.push({ unitType: 'soldier', buildTime: 4 });
        }
        world.enemySpawnTimer -= dt;

        for (const u of world.units) {
            if (u.team === 'enemy' && u.type === 'soldier' && u.hp > 0 && !u.currentPath && u.orders.length === 0) {
                u.orders.push({ type: 'attack-move', cx: 3, cy: 5 });
            }
        }
    }

    function tickBuilding(b, dt) {
        const job = b.queue[0];
        if (!job) return;
        b.progress += dt;
        if (b.progress >= job.buildTime) {
            const spawnX = b.anchorX + (b.team === 'player' ? b.w : -1);
            const spawnY = b.anchorY + b.h - 1;
            addUnit(b.team, spawnX, spawnY, job.unitType);
            const last = world.units[world.units.length - 1];
            last.orders.push({ type: 'move', cx: b.rally.cx, cy: b.rally.cy });
            b.queue.shift();
            b.progress = 0;
        }
    }

    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        if (running) {
            tickEnemyAI(dt);
            for (const b of world.buildings) tickBuilding(b, dt);
            for (const u of world.units) tickUnit(u, dt);
        }
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        const tp = cartToIso(tree.cx + 0.5, tree.cy + 0.5, tW, tH, ox, oy);
        ctx.fillStyle = EX_COLORS.treeT;
        ctx.fillRect(tp.x - 3, tp.y - 24, 6, 24);
        ctx.fillStyle = EX_COLORS.tree;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y - 30, 12, 0, Math.PI * 2);
        ctx.fill();
        const drawList = [];
        for (const b of world.buildings) {
            drawList.push({ kind: 'building', cx: b.anchorX + b.w * 0.5, cy: b.anchorY + b.h * 0.5, ref: b });
        }
        for (const u of world.units) {
            drawList.push({ kind: 'unit', cx: u.cx, cy: u.cy, ref: u });
        }
        drawList.sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
        for (const item of drawList) {
            if (item.kind === 'building') {
                const b = item.ref;
                drawBuilding(ctx, b.anchorX, b.anchorY, b.w, b.h, tW, tH, ox, oy,
                    b.team === 'player' ? '#4caf50' : '#e57373');
            } else {
                const u = item.ref;
                if (u.hp <= 0) continue;
                const color = u.team === 'player'
                    ? (u.type === 'worker' ? '#ffb74d' : EX_COLORS.player)
                    : EX_COLORS.enemy;
                drawUnitGlyph(ctx, u.cx, u.cy, tW, tH, ox, oy, color, selected.has(u.id), u.hp, u.maxHp);
            }
        }
        if (drag) {
            const x1 = Math.min(drag.sx, drag.ex), x2 = Math.max(drag.sx, drag.ex);
            const y1 = Math.min(drag.sy, drag.ey), y2 = Math.max(drag.sy, drag.ey);
            ctx.fillStyle = EX_COLORS.selectBox;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            ctx.strokeStyle = EX_COLORS.selectBoxEdge;
            ctx.lineWidth = 1;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        }
        ctx.fillStyle = EX_COLORS.hud;
        ctx.fillRect(8, 8, 280, 56);
        ctx.fillStyle = EX_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        const alivePlayer = world.units.filter(u => u.team === 'player' && u.hp > 0).length;
        const aliveEnemy  = world.units.filter(u => u.team === 'enemy' && u.hp > 0).length;
        ctx.fillText(\`Wood: \${world.resources}    Player units: \${alivePlayer}    Enemy units: \${aliveEnemy}\`, 16, 28);
        ctx.fillText(\`Selected: \${selected.size}    \${running ? '▶ Running' : '⏸ Paused'}\`, 16, 48);
    }

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const m = getMouseLocal(canvas, e);
        const hit = unitAt(m.x, m.y);
        const now = performance.now();
        const isDbl = (now - lastClick < 300) && hit && hit.id === lastClickedId;
        lastClick = now;
        lastClickedId = hit ? hit.id : null;
        if (isDbl && hit) {
            selected = new Set(world.units.filter(u => u.hp > 0 && u.team === 'player' && u.type === hit.type).map(u => u.id));
            return;
        }
        if (hit) {
            if (e.shiftKey) {
                if (selected.has(hit.id)) selected.delete(hit.id);
                else selected.add(hit.id);
            } else {
                selected = new Set([hit.id]);
            }
            return;
        }
        drag = { sx: m.x, sy: m.y, ex: m.x, ey: m.y };
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!drag) return;
        const m = getMouseLocal(canvas, e);
        drag.ex = m.x; drag.ey = m.y;
    });
    canvas.addEventListener('mouseup', () => {
        if (!drag) return;
        const x1 = Math.min(drag.sx, drag.ex), x2 = Math.max(drag.sx, drag.ex);
        const y1 = Math.min(drag.sy, drag.ey), y2 = Math.max(drag.sy, drag.ey);
        if (Math.abs(x2 - x1) > 4 || Math.abs(y2 - y1) > 4) {
            selected.clear();
            for (const u of world.units) {
                if (u.team !== 'player' || u.hp <= 0) continue;
                const p = screenOf(u);
                if (p.x >= x1 && p.x <= x2 && p.y - 8 >= y1 && p.y - 8 <= y2) selected.add(u.id);
            }
        }
        drag = null;
    });
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (selected.size === 0) return;
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (!t) return;
        for (const id of selected) {
            const u = world.units.find(x => x.id === id);
            if (!u || u.hp <= 0) continue;
            u.currentPath = null;
            u.pathIndex = 0;
            if (e.shiftKey) u.orders.push({ type: 'move', cx: t.x, cy: t.y });
            else u.orders = [{ type: 'move', cx: t.x, cy: t.y }];
        }
    });

    document.getElementById('btnSkirmishStart')?.addEventListener('click', () => { running = true; });
    document.getElementById('btnSkirmishPause')?.addEventListener('click', () => { running = false; });
    document.getElementById('btnSkirmishTrain')?.addEventListener('click', () => {
        const town = world.buildings.find(b => b.team === 'player');
        town.queue.push({ unitType: 'soldier', buildTime: 3 });
    });
    document.getElementById('btnSkirmishReset')?.addEventListener('click', () => {
        reset(); selected.clear(); running = true;
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_skirmishDemo = `(function skirmishDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_skirmishDemo.split('\n').slice(6, -1).join('\n')}
})();`;

// =============================================================================
// TRANSITIVE-DEP DECLARATIONS (retrofit — consumed by shared/export-demo.js
// resolveDepClosure). Additive safety net: expert.html data-deps already list
// the full closure, so resolution is idempotent.
// =============================================================================
window.DEPENDENCY_REQUIRES = window.DEPENDENCY_REQUIRES || {};
DEPENDENCY_REQUIRES.iso_pickTileFromMouse = ['iso_isoToCart'];
DEPENDENCY_REQUIRES.iso_ex_terrainColor   = ['iso_ex_colors'];
DEPENDENCY_REQUIRES.iso_drawGround        = ['iso_cartToIso', 'iso_drawIsoTile', 'iso_ex_terrainColor', 'iso_ex_colors'];
DEPENDENCY_REQUIRES.iso_drawUnitGlyph     = ['iso_cartToIso', 'iso_ex_colors'];
DEPENDENCY_REQUIRES.iso_drawBuilding      = ['iso_cartToIso', 'iso_ex_colors'];
DEPENDENCY_REQUIRES.iso_aStarPath         = ['iso_ex_isWalkable'];
