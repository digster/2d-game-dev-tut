// =============================================================================
// ISOMETRIC STRATEGY — ADVANCED TIER EXPORT BUNDLES
// =============================================================================
// Same pattern as bundles-beginner/intermediate/expert. Augments the global
// DEMO_CODE / DEMO_HTML / DEPENDENCY_BUNDLES registries.
//
// Distinct bundle keys vs prior tiers: iso_av_* prefix for advanced helpers.
// The AV_COLORS palette + drawGround/drawIsoUnit/drawIsoBuilding/terrainColor/
// isWalkable variants differ enough from expert that distinct keys preserve
// isolation (and avoid signature-order surprises).
//
// Canvas-ID convention: scaffold hardcodes <canvas id="canvas"> + <div id="info">.
// saveLoadDemo + mapEditorDemo additionally need <pre id="saveJsonOut"> /
// <pre id="mapEditorOut"> injected at runtime since the scaffold doesn't have them.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// SHARED ISO HELPERS (re-defined so advanced exports stand alone)
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

// =============================================================================
// ADVANCED-TIER DEPENDENCIES
// =============================================================================

DEPENDENCY_BUNDLES.iso_av_colors = `const AV_COLORS = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    fogHidden:   'rgba(8, 12, 22, 0.92)',
    fogExplored: 'rgba(8, 12, 22, 0.55)',
    player: '#66bb6a',
    enemy:  '#ef5350',
    bldgFill: '#ab47bc',
    accent: '#ffa726',
    selectRing: '#ffeb3b',
    label:  '#e0e0e0',
    muted:  '#9e9e9e',
    hud:    'rgba(13, 17, 23, 0.78)',
    flowArrow: '#ffd180',
    spatialBucket: 'rgba(79, 195, 247, 0.06)',
    spatialBucketEdge: 'rgba(79, 195, 247, 0.25)'
};`;

DEPENDENCY_BUNDLES.iso_av_terrainColor = `function terrainColor(t) {
    switch (t) {
        case 'grass': return AV_COLORS.grass;
        case 'water': return AV_COLORS.water;
        case 'sand':  return AV_COLORS.sand;
        case 'stone': return AV_COLORS.stone;
        default:      return '#1a233a';
    }
}`;

DEPENDENCY_BUNDLES.iso_av_isWalkable = `function isWalkable(map, cx, cy) {
    if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) return false;
    const t = map.tiles[cy][cx];
    return t === 'grass' || t === 'sand';
}`;

DEPENDENCY_BUNDLES.iso_av_buildOpenMap = `function buildOpenMap(w = 16, h = 12) {
    const tiles = Array.from({ length: h }, () => Array(w).fill('grass'));
    return { width: w, height: h, tiles };
}`;

DEPENDENCY_BUNDLES.iso_av_buildRiverMap = `function buildRiverMap(w = 16, h = 12) {
    const tiles = Array.from({ length: h }, () => Array(w).fill('grass'));
    for (let x = 0; x < w; x++) tiles[Math.floor(h / 2)][x] = 'water';
    for (let x = 0; x < w; x++) {
        tiles[Math.floor(h / 2) - 1][x] = 'sand';
        tiles[Math.floor(h / 2) + 1][x] = 'sand';
    }
    tiles[Math.floor(h / 2)][3] = 'sand';
    tiles[Math.floor(h / 2)][w - 4] = 'sand';
    return { width: w, height: h, tiles };
}`;

DEPENDENCY_BUNDLES.iso_av_drawGround = `function drawGround(ctx, map, tW, tH, ox, oy) {
    for (let cy = 0; cy < map.height; cy++) {
        for (let cx = 0; cx < map.width; cx++) {
            const p = cartToIso(cx, cy, tW, tH, ox, oy);
            drawIsoTile(ctx, p.x, p.y, tW, tH, terrainColor(map.tiles[cy][cx]), AV_COLORS.outline);
        }
    }
}`;

DEPENDENCY_BUNDLES.iso_av_drawIsoUnit = `function drawIsoUnit(ctx, cx, cy, tW, tH, ox, oy, color, hp = null, maxHp = null, selected = false) {
    const p = cartToIso(cx + 0.5, cy + 0.5, tW, tH, ox, oy);
    if (selected) {
        ctx.strokeStyle = AV_COLORS.selectRing;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 4, p.y - 11, 8, 12);
    if (hp !== null && maxHp !== null && hp < maxHp) {
        const w = 18;
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x - w / 2, p.y - 25, w, 3);
        ctx.fillStyle = hp / maxHp > 0.4 ? '#66bb6a' : '#ef5350';
        ctx.fillRect(p.x - w / 2, p.y - 25, w * (hp / maxHp), 3);
    }
}`;

DEPENDENCY_BUNDLES.iso_av_drawIsoBuilding = `function drawIsoBuilding(ctx, anchorX, anchorY, fw, fh, tW, tH, ox, oy, color = AV_COLORS.bldgFill) {
    const top    = cartToIso(anchorX,      anchorY,      tW, tH, ox, oy);
    const right  = cartToIso(anchorX + fw, anchorY,      tW, tH, ox, oy);
    const bottom = cartToIso(anchorX + fw, anchorY + fh, tW, tH, ox, oy);
    const left   = cartToIso(anchorX,      anchorY + fh, tW, tH, ox, oy);
    const h = 24;
    ctx.fillStyle = '#7e34a0';
    ctx.beginPath();
    ctx.moveTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(right.x, right.y - h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8e3eb2';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(left.x, left.y - h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - h); ctx.lineTo(right.x, right.y - h);
    ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(left.x, left.y - h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ce93d8';
    ctx.lineWidth = 1;
    ctx.stroke();
}`;

DEPENDENCY_BUNDLES.iso_av_getMouseLocal = `function getMouseLocal(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}`;

DEPENDENCY_BUNDLES.iso_av_minHeap = `class MinHeap {
    constructor() { this.data = []; }
    push(node) {
        this.data.push(node);
        let i = this.data.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[p].f <= this.data[i].f) break;
            [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
            i = p;
        }
    }
    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length) {
            this.data[0] = last;
            let i = 0;
            const n = this.data.length;
            while (true) {
                const l = 2 * i + 1, r = 2 * i + 2;
                let s = i;
                if (l < n && this.data[l].f < this.data[s].f) s = l;
                if (r < n && this.data[r].f < this.data[s].f) s = r;
                if (s === i) break;
                [this.data[i], this.data[s]] = [this.data[s], this.data[i]];
                i = s;
            }
        }
        return top;
    }
    size() { return this.data.length; }
}`;

DEPENDENCY_BUNDLES.iso_av_aStarHeap = `function aStarHeap(map, blocked, start, goal) {
    const W = map.width, H = map.height;
    if (blocked[goal.y * W + goal.x]) return null;
    const key = (x, y) => y * W + x;
    const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = new MinHeap();
    const visited = new Uint8Array(W * H);
    const parent = new Int32Array(W * H).fill(-1);
    const gScore = new Float32Array(W * H).fill(Infinity);
    gScore[key(start.x, start.y)] = 0;
    open.push({ x: start.x, y: start.y, g: 0, f: h(start.x, start.y) });
    while (open.size()) {
        const cur = open.pop();
        const k = key(cur.x, cur.y);
        if (visited[k]) continue;
        visited[k] = 1;
        if (cur.x === goal.x && cur.y === goal.y) {
            const path = [];
            let cx = cur.x, cy = cur.y;
            while (cx !== -1) {
                path.unshift({ x: cx, y: cy });
                const k2 = key(cx, cy);
                const p = parent[k2];
                if (p === -1) break;
                cx = p % W; cy = Math.floor(p / W);
            }
            return path;
        }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const nk = key(nx, ny);
            if (visited[nk] || blocked[nk]) continue;
            const tentative = cur.g + 1;
            if (tentative >= gScore[nk]) continue;
            gScore[nk] = tentative;
            parent[nk] = k;
            open.push({ x: nx, y: ny, g: tentative, f: tentative + h(nx, ny) });
        }
    }
    return null;
}`;

DEPENDENCY_BUNDLES.iso_av_computeFlowField = `function computeFlowField(map, blocked, goal) {
    const W = map.width, H = map.height;
    const cost = new Float32Array(W * H).fill(Infinity);
    const flow = new Array(W * H).fill(null);
    if (goal.x < 0 || goal.x >= W || goal.y < 0 || goal.y >= H) return { cost, flow };
    if (blocked[goal.y * W + goal.x]) return { cost, flow };
    cost[goal.y * W + goal.x] = 0;
    const queue = [{ x: goal.x, y: goal.y }];
    let head = 0;
    while (head < queue.length) {
        const c = queue[head++];
        const here = cost[c.y * W + c.x];
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = c.x + dx, ny = c.y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            if (blocked[ny * W + nx]) continue;
            if (cost[ny * W + nx] <= here + 1) continue;
            cost[ny * W + nx] = here + 1;
            queue.push({ x: nx, y: ny });
        }
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (cost[y * W + x] === Infinity) continue;
            let best = null, bestC = cost[y * W + x];
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const c = cost[ny * W + nx];
                if (c < bestC) { bestC = c; best = { dx, dy }; }
            }
            flow[y * W + x] = best;
        }
    }
    return { cost, flow };
}`;

// ---- TS variants of advanced-tier dependencies ------------------------------
DEPENDENCY_BUNDLES_TS.iso_av_colors = `const AV_COLORS: Record<string, string> = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    fogHidden:   'rgba(8, 12, 22, 0.92)',
    fogExplored: 'rgba(8, 12, 22, 0.55)',
    player: '#66bb6a',
    enemy:  '#ef5350',
    bldgFill: '#ab47bc',
    accent: '#ffa726',
    selectRing: '#ffeb3b',
    label:  '#e0e0e0',
    muted:  '#9e9e9e',
    hud:    'rgba(13, 17, 23, 0.78)',
    flowArrow: '#ffd180',
    spatialBucket: 'rgba(79, 195, 247, 0.06)',
    spatialBucketEdge: 'rgba(79, 195, 247, 0.25)'
};`;
DEPENDENCY_BUNDLES_TS.iso_av_terrainColor = `function terrainColor(t: string): string {
    switch (t) {
        case 'grass': return AV_COLORS.grass;
        case 'water': return AV_COLORS.water;
        case 'sand':  return AV_COLORS.sand;
        case 'stone': return AV_COLORS.stone;
        default:      return '#1a233a';
    }
}`;
DEPENDENCY_BUNDLES_TS.iso_av_isWalkable = `type IsoMap = { width: number; height: number; tiles: string[][] };
function isWalkable(map: IsoMap, cx: number, cy: number): boolean {
    if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) return false;
    const t = map.tiles[cy][cx];
    return t === 'grass' || t === 'sand';
}`;
DEPENDENCY_BUNDLES_TS.iso_av_buildOpenMap = `function buildOpenMap(w: number = 16, h: number = 12): IsoMap {
    const tiles: string[][] = Array.from({ length: h }, () => Array(w).fill('grass') as string[]);
    return { width: w, height: h, tiles };
}`;
DEPENDENCY_BUNDLES_TS.iso_av_buildRiverMap = `function buildRiverMap(w: number = 16, h: number = 12): IsoMap {
    const tiles: string[][] = Array.from({ length: h }, () => Array(w).fill('grass') as string[]);
    for (let x = 0; x < w; x++) tiles[Math.floor(h / 2)][x] = 'water';
    for (let x = 0; x < w; x++) {
        tiles[Math.floor(h / 2) - 1][x] = 'sand';
        tiles[Math.floor(h / 2) + 1][x] = 'sand';
    }
    tiles[Math.floor(h / 2)][3] = 'sand';
    tiles[Math.floor(h / 2)][w - 4] = 'sand';
    return { width: w, height: h, tiles };
}`;
DEPENDENCY_BUNDLES_TS.iso_av_drawGround = `function drawGround(
    ctx: CanvasRenderingContext2D, map: IsoMap, tW: number, tH: number, ox: number, oy: number
): void {
    for (let cy = 0; cy < map.height; cy++) {
        for (let cx = 0; cx < map.width; cx++) {
            const p = cartToIso(cx, cy, tW, tH, ox, oy);
            drawIsoTile(ctx, p.x, p.y, tW, tH, terrainColor(map.tiles[cy][cx]), AV_COLORS.outline);
        }
    }
}`;
DEPENDENCY_BUNDLES_TS.iso_av_drawIsoUnit = `function drawIsoUnit(
    ctx: CanvasRenderingContext2D, cx: number, cy: number,
    tW: number, tH: number, ox: number, oy: number,
    color: string, hp: number | null = null, maxHp: number | null = null, selected: boolean = false
): void {
    const p = cartToIso(cx + 0.5, cy + 0.5, tW, tH, ox, oy);
    if (selected) {
        ctx.strokeStyle = AV_COLORS.selectRing;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 4, p.y - 11, 8, 12);
    if (hp !== null && maxHp !== null && hp < maxHp) {
        const w = 18;
        ctx.fillStyle = '#222';
        ctx.fillRect(p.x - w / 2, p.y - 25, w, 3);
        ctx.fillStyle = hp / maxHp > 0.4 ? '#66bb6a' : '#ef5350';
        ctx.fillRect(p.x - w / 2, p.y - 25, w * (hp / maxHp), 3);
    }
}`;
DEPENDENCY_BUNDLES_TS.iso_av_drawIsoBuilding = `function drawIsoBuilding(
    ctx: CanvasRenderingContext2D, anchorX: number, anchorY: number, fw: number, fh: number,
    tW: number, tH: number, ox: number, oy: number, color: string = AV_COLORS.bldgFill
): void {
    const top    = cartToIso(anchorX,      anchorY,      tW, tH, ox, oy);
    const right  = cartToIso(anchorX + fw, anchorY,      tW, tH, ox, oy);
    const bottom = cartToIso(anchorX + fw, anchorY + fh, tW, tH, ox, oy);
    const left   = cartToIso(anchorX,      anchorY + fh, tW, tH, ox, oy);
    const h = 24;
    ctx.fillStyle = '#7e34a0';
    ctx.beginPath();
    ctx.moveTo(right.x, right.y); ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(right.x, right.y - h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8e3eb2';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y); ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(left.x, left.y - h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - h); ctx.lineTo(right.x, right.y - h);
    ctx.lineTo(bottom.x, bottom.y - h); ctx.lineTo(left.x, left.y - h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ce93d8';
    ctx.lineWidth = 1;
    ctx.stroke();
}`;
DEPENDENCY_BUNDLES_TS.iso_av_getMouseLocal = `function getMouseLocal(canvas: HTMLCanvasElement, e: MouseEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}`;
DEPENDENCY_BUNDLES_TS.iso_av_minHeap = `type HeapNode = { x: number; y: number; g: number; f: number };
class MinHeap {
    data: HeapNode[] = [];
    push(node: HeapNode): void {
        this.data.push(node);
        let i = this.data.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[p].f <= this.data[i].f) break;
            [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
            i = p;
        }
    }
    pop(): HeapNode {
        const top = this.data[0];
        const last = this.data.pop() as HeapNode;
        if (this.data.length) {
            this.data[0] = last;
            let i = 0;
            const n = this.data.length;
            while (true) {
                const l = 2 * i + 1, r = 2 * i + 2;
                let s = i;
                if (l < n && this.data[l].f < this.data[s].f) s = l;
                if (r < n && this.data[r].f < this.data[s].f) s = r;
                if (s === i) break;
                [this.data[i], this.data[s]] = [this.data[s], this.data[i]];
                i = s;
            }
        }
        return top;
    }
    size(): number { return this.data.length; }
}`;
DEPENDENCY_BUNDLES_TS.iso_av_aStarHeap = `type Tile = { x: number; y: number };
function aStarHeap(map: IsoMap, blocked: Uint8Array, start: Tile, goal: Tile): Tile[] | null {
    const W = map.width, H = map.height;
    if (blocked[goal.y * W + goal.x]) return null;
    const key = (x: number, y: number) => y * W + x;
    const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = new MinHeap();
    const visited = new Uint8Array(W * H);
    const parent = new Int32Array(W * H).fill(-1);
    const gScore = new Float32Array(W * H).fill(Infinity);
    gScore[key(start.x, start.y)] = 0;
    open.push({ x: start.x, y: start.y, g: 0, f: h(start.x, start.y) });
    while (open.size()) {
        const cur = open.pop();
        const k = key(cur.x, cur.y);
        if (visited[k]) continue;
        visited[k] = 1;
        if (cur.x === goal.x && cur.y === goal.y) {
            const path: Tile[] = [];
            let cx = cur.x, cy = cur.y;
            while (cx !== -1) {
                path.unshift({ x: cx, y: cy });
                const k2 = key(cx, cy);
                const p = parent[k2];
                if (p === -1) break;
                cx = p % W; cy = Math.floor(p / W);
            }
            return path;
        }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cur.x + dx, ny = cur.y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const nk = key(nx, ny);
            if (visited[nk] || blocked[nk]) continue;
            const tentative = cur.g + 1;
            if (tentative >= gScore[nk]) continue;
            gScore[nk] = tentative;
            parent[nk] = k;
            open.push({ x: nx, y: ny, g: tentative, f: tentative + h(nx, ny) });
        }
    }
    return null;
}`;
DEPENDENCY_BUNDLES_TS.iso_av_computeFlowField = `type FlowDir = { dx: number; dy: number } | null;
type FlowField = { cost: Float32Array; flow: FlowDir[] };
function computeFlowField(map: IsoMap, blocked: Uint8Array, goal: Tile): FlowField {
    const W = map.width, H = map.height;
    const cost = new Float32Array(W * H).fill(Infinity);
    const flow: FlowDir[] = new Array(W * H).fill(null);
    if (goal.x < 0 || goal.x >= W || goal.y < 0 || goal.y >= H) return { cost, flow };
    if (blocked[goal.y * W + goal.x]) return { cost, flow };
    cost[goal.y * W + goal.x] = 0;
    const queue: Tile[] = [{ x: goal.x, y: goal.y }];
    let head = 0;
    while (head < queue.length) {
        const c = queue[head++];
        const here = cost[c.y * W + c.x];
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = c.x + dx, ny = c.y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            if (blocked[ny * W + nx]) continue;
            if (cost[ny * W + nx] <= here + 1) continue;
            cost[ny * W + nx] = here + 1;
            queue.push({ x: nx, y: ny });
        }
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (cost[y * W + x] === Infinity) continue;
            let best: FlowDir = null, bestC = cost[y * W + x];
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                const c = cost[ny * W + nx];
                if (c < bestC) { bestC = c; best = { dx, dy }; }
            }
            flow[y * W + x] = best;
        }
    }
    return { cost, flow };
}`;

// =============================================================================
// DEMO 1 — iso_fogDemo (drag-driven, non-RAF)
// =============================================================================
DEMO_HTML.iso_fogDemo = {
    title: 'Iso — Fog of War & Line of Sight',
    canvas: { width: 800, height: 440 },
    controls: [
        { id: 'btnFogResetExplore', text: 'Reset exploration' },
        { id: 'btnFogToggle',       text: 'Fog ON' }
    ],
    info: 'Drag the blue unit to reveal the map. Red enemies appear only when in line of sight.'
};

DEMO_CODE.iso_fogDemo = `(function fogDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(14, 9);
    const tW = 52, tH = 26;
    const ox = canvas.width / 2, oy = 30;

    const player = { cx: 2, cy: 2, visionRadius: 4 };
    const enemies = [
        { cx: 11, cy: 2 }, { cx: 12, cy: 6 }, { cx: 6, cy: 7 }
    ];
    const fog = new Uint8Array(map.width * map.height);
    let dragging = false;
    let showFog = true;

    function updateFog() {
        for (let i = 0; i < fog.length; i++) if (fog[i] === 2) fog[i] = 1;
        const r = player.visionRadius;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const cx = Math.round(player.cx) + dx;
                const cy = Math.round(player.cy) + dy;
                if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) continue;
                fog[cy * map.width + cx] = 2;
            }
        }
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);

        for (const e of enemies) {
            const cell = fog[Math.round(e.cy) * map.width + Math.round(e.cx)];
            if (!showFog || cell === 2) drawIsoUnit(ctx, e.cx, e.cy, tW, tH, ox, oy, AV_COLORS.enemy);
        }
        drawIsoUnit(ctx, player.cx, player.cy, tW, tH, ox, oy, AV_COLORS.player);

        if (showFog) {
            for (let cy = 0; cy < map.height; cy++) {
                for (let cx = 0; cx < map.width; cx++) {
                    const state = fog[cy * map.width + cx];
                    if (state === 2) continue;
                    const p = cartToIso(cx, cy, tW, tH, ox, oy);
                    drawIsoTile(ctx, p.x, p.y, tW, tH,
                        state === 0 ? AV_COLORS.fogHidden : AV_COLORS.fogExplored,
                        null);
                }
            }
        }

        let visibleEnemies = 0, exploredCells = 0;
        for (let i = 0; i < fog.length; i++) {
            if (fog[i] >= 1) exploredCells++;
        }
        for (const e of enemies) {
            if (fog[Math.round(e.cy) * map.width + Math.round(e.cx)] === 2) visibleEnemies++;
        }
        info.innerHTML =
            \`Visible enemies: <strong>\${visibleEnemies}/\${enemies.length}</strong>\` +
            \` · Tiles explored: <strong>\${exploredCells}/\${fog.length}</strong>\`;
    }

    canvas.addEventListener('mousedown', () => { dragging = true; });
    canvas.addEventListener('mouseup',   () => { dragging = false; });
    canvas.addEventListener('mouseleave', () => { dragging = false; });
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (t && isWalkable(map, t.x, t.y)) {
            player.cx = t.x;
            player.cy = t.y;
            updateFog();
            render();
        }
    });

    document.getElementById('btnFogResetExplore')?.addEventListener('click', () => {
        fog.fill(0);
        player.cx = 2; player.cy = 2;
        updateFog();
        render();
    });
    document.getElementById('btnFogToggle')?.addEventListener('click', (e) => {
        showFog = !showFog;
        e.target.classList.toggle('active', showFog);
        e.target.textContent = showFog ? 'Fog ON' : 'Fog OFF';
        render();
    });

    updateFog();
    render();
})();`;

DEMO_CODE_TS.iso_fogDemo = `(function fogDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_fogDemo.split('\n').slice(4, -2).join('\n')}
})();`;

// =============================================================================
// DEMO 2 — iso_flowDemo (RAF, flow-field follow)
// =============================================================================
DEMO_HTML.iso_flowDemo = {
    title: 'Iso — Flow Field Pathing (One Plan, Many Units)',
    canvas: { width: 800, height: 460 },
    controls: [
        { id: 'btnFlowToggleArrows', text: 'Show flow arrows' },
        { id: 'btnFlowToggleCost',   text: 'Show cost heatmap' },
        { id: 'btnFlowReset',        text: 'Reset units' }
    ],
    info: 'Click a tile — every unit walks toward it using the precomputed flow field.'
};

DEMO_CODE.iso_flowDemo = `(function flowDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(16, 11);
    const tW = 44, tH = 22;
    const ox = canvas.width / 2, oy = 30;
    const blocked = (() => {
        const b = new Uint8Array(map.width * map.height);
        for (let y = 0; y < map.height; y++)
            for (let x = 0; x < map.width; x++)
                if (!isWalkable(map, x, y)) b[y * map.width + x] = 1;
        return b;
    })();

    let goal = { x: map.width - 2, y: map.height - 2 };
    let field = computeFlowField(map, blocked, goal);
    let showArrows = true, showCost = true;

    const UNITS = [];
    for (let i = 0; i < 60; i++) {
        let cx, cy;
        do { cx = Math.floor(Math.random() * map.width); cy = Math.floor(Math.random() * map.height); } while (!isWalkable(map, cx, cy));
        UNITS.push({ cx: cx + 0.2 + Math.random() * 0.6, cy: cy + 0.2 + Math.random() * 0.6, speed: 1.5 });
    }
    function resetUnits() {
        for (let i = 0; i < UNITS.length; i++) {
            let cx, cy;
            do { cx = Math.floor(Math.random() * map.width); cy = Math.floor(Math.random() * map.height); } while (!isWalkable(map, cx, cy));
            UNITS[i].cx = cx + 0.2 + Math.random() * 0.6;
            UNITS[i].cy = cy + 0.2 + Math.random() * 0.6;
        }
    }

    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        for (const u of UNITS) {
            const cx = Math.floor(u.cx);
            const cy = Math.floor(u.cy);
            if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) continue;
            const f = field.flow[cy * map.width + cx];
            if (!f) continue;
            u.cx += f.dx * u.speed * dt;
            u.cy += f.dy * u.speed * dt;
        }
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        if (showCost) {
            let maxCost = 0;
            for (let i = 0; i < field.cost.length; i++) if (field.cost[i] !== Infinity && field.cost[i] > maxCost) maxCost = field.cost[i];
            for (let cy = 0; cy < map.height; cy++) {
                for (let cx = 0; cx < map.width; cx++) {
                    const c = field.cost[cy * map.width + cx];
                    if (c === Infinity || maxCost === 0) continue;
                    const t = 1 - c / maxCost;
                    const p = cartToIso(cx, cy, tW, tH, ox, oy);
                    drawIsoTile(ctx, p.x, p.y, tW, tH,
                        \`rgba(255, 235, 59, \${0.18 * t})\`, null);
                }
            }
        }
        if (showArrows) {
            ctx.strokeStyle = AV_COLORS.flowArrow;
            ctx.lineWidth = 1.5;
            for (let cy = 0; cy < map.height; cy++) {
                for (let cx = 0; cx < map.width; cx++) {
                    const f = field.flow[cy * map.width + cx];
                    if (!f) continue;
                    const p = cartToIso(cx + 0.5, cy + 0.5, tW, tH, ox, oy);
                    const len = 9;
                    const ex = p.x + f.dx * len;
                    const ey = p.y + f.dy * len * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(ex, ey, 2, 0, Math.PI * 2);
                    ctx.fillStyle = AV_COLORS.flowArrow;
                    ctx.fill();
                }
            }
        }
        const gp = cartToIso(goal.x, goal.y, tW, tH, ox, oy);
        drawIsoTile(ctx, gp.x, gp.y, tW, tH, 'rgba(255, 167, 38, 0.5)', AV_COLORS.accent);
        for (const u of [...UNITS].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx))) {
            drawIsoUnit(ctx, u.cx, u.cy, tW, tH, ox, oy, AV_COLORS.player);
        }
    }

    canvas.addEventListener('click', (e) => {
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (!t) return;
        if (!isWalkable(map, t.x, t.y)) { info.innerHTML = \`(\${t.x}, \${t.y}) is not walkable.\`; return; }
        goal = t;
        const t0 = performance.now();
        field = computeFlowField(map, blocked, goal);
        const dt = (performance.now() - t0).toFixed(1);
        info.innerHTML = \`New goal: <strong>(\${goal.x}, \${goal.y})</strong>. Flow field rebuilt in <strong>\${dt}ms</strong> for \${map.width * map.height} cells.\`;
    });
    document.getElementById('btnFlowToggleArrows')?.addEventListener('click', (e) => {
        showArrows = !showArrows;
        e.target.classList.toggle('active', showArrows);
    });
    document.getElementById('btnFlowToggleCost')?.addEventListener('click', (e) => {
        showCost = !showCost;
        e.target.classList.toggle('active', showCost);
    });
    document.getElementById('btnFlowReset')?.addEventListener('click', resetUnits);

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_flowDemo = `(function flowDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_flowDemo.split('\n').slice(4, -2).join('\n')}
})();`;

// =============================================================================
// DEMO 3 — iso_multiTileDemo (A* around 2x2 buildings)
// =============================================================================
DEMO_HTML.iso_multiTileDemo = {
    title: 'Iso — A* Around Multi-Tile Buildings',
    canvas: { width: 800, height: 440 },
    controls: [],
    info: 'Click a tile — A* routes around the 2×2 building footprints.'
};

DEMO_CODE.iso_multiTileDemo = `(function multiTileDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildOpenMap(14, 10);
    const tW = 52, tH = 26;
    const ox = canvas.width / 2, oy = 30;
    const buildings = [
        { anchorX: 4, anchorY: 2, w: 2, h: 2 },
        { anchorX: 8, anchorY: 5, w: 2, h: 2 },
        { anchorX: 4, anchorY: 7, w: 2, h: 2 },
        { anchorX: 11, anchorY: 1, w: 2, h: 2 }
    ];
    function rebuildBlocked() {
        const b = new Uint8Array(map.width * map.height);
        for (let y = 0; y < map.height; y++)
            for (let x = 0; x < map.width; x++)
                if (!isWalkable(map, x, y)) b[y * map.width + x] = 1;
        for (const bb of buildings) {
            for (let dy = 0; dy < bb.h; dy++)
                for (let dx = 0; dx < bb.w; dx++) {
                    const cx = bb.anchorX + dx, cy = bb.anchorY + dy;
                    if (cx >= 0 && cx < map.width && cy >= 0 && cy < map.height)
                        b[cy * map.width + cx] = 1;
                }
        }
        return b;
    }
    let blocked = rebuildBlocked();

    const unit = { cx: 1, cy: 1, speed: 3 };
    let path = null;
    let pathIndex = 0;

    function walkOneStep(dt) {
        if (!path || pathIndex >= path.length) return;
        const wp = path[pathIndex];
        const dx = wp.x - unit.cx, dy = wp.y - unit.cy;
        const d = Math.hypot(dx, dy);
        if (d < 0.05) { unit.cx = wp.x; unit.cy = wp.y; pathIndex++; return; }
        const step = unit.speed * dt;
        if (step >= d) { unit.cx = wp.x; unit.cy = wp.y; pathIndex++; }
        else { unit.cx += dx / d * step; unit.cy += dy / d * step; }
    }

    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        walkOneStep(dt);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        if (path) {
            for (let i = pathIndex; i < path.length; i++) {
                const p = cartToIso(path[i].x, path[i].y, tW, tH, ox, oy);
                drawIsoTile(ctx, p.x, p.y, tW, tH, null, AV_COLORS.accent);
            }
        }
        const items = buildings.map(b => ({ kind: 'b', cx: b.anchorX + b.w * 0.5, cy: b.anchorY + b.h * 0.5, ref: b }));
        items.push({ kind: 'u', cx: unit.cx, cy: unit.cy });
        items.sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
        for (const it of items) {
            if (it.kind === 'b') drawIsoBuilding(ctx, it.ref.anchorX, it.ref.anchorY, it.ref.w, it.ref.h, tW, tH, ox, oy);
            else drawIsoUnit(ctx, unit.cx, unit.cy, tW, tH, ox, oy, AV_COLORS.player);
        }
    }

    canvas.addEventListener('click', (e) => {
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (!t) return;
        if (blocked[t.y * map.width + t.x]) {
            info.innerHTML = \`(\${t.x}, \${t.y}) is blocked (terrain or building).\`;
            return;
        }
        const start = { x: Math.round(unit.cx), y: Math.round(unit.cy) };
        const t0 = performance.now();
        path = aStarHeap(map, blocked, start, t);
        pathIndex = 0;
        const dt = (performance.now() - t0).toFixed(2);
        info.innerHTML = path
            ? \`Path of <strong>\${path.length}</strong> tiles to (\${t.x}, \${t.y}), found in \${dt}ms (heap-backed A*).\`
            : \`No path to (\${t.x}, \${t.y}).\`;
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_multiTileDemo = `(function multiTileDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_multiTileDemo.split('\n').slice(4, -2).join('\n')}
})();`;

// =============================================================================
// DEMO 4 — iso_spatialHashDemo (RAF, SpatialHash defined inline)
// =============================================================================
DEMO_HTML.iso_spatialHashDemo = {
    title: 'Iso — Spatial Hash for Radius Queries',
    canvas: { width: 800, height: 440 },
    controls: [],
    info: 'Hover the canvas — buckets near the cursor light up. Naïve check would scan all units.'
};

DEMO_CODE.iso_spatialHashDemo = `(function spatialHashDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildOpenMap(20, 15);
    const tW = 38, tH = 19;
    const ox = canvas.width / 2, oy = 30;
    const N = 300;
    const UNITS = [];
    for (let i = 0; i < N; i++) {
        UNITS.push({
            cx: Math.random() * (map.width - 1),
            cy: Math.random() * (map.height - 1),
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5
        });
    }
    class SpatialHash {
        constructor(cellSize) { this.cellSize = cellSize; this.buckets = new Map(); }
        rebuild(units) {
            this.buckets.clear();
            for (const u of units) {
                const k = \`\${Math.floor(u.cx / this.cellSize)},\${Math.floor(u.cy / this.cellSize)}\`;
                let b = this.buckets.get(k);
                if (!b) { b = []; this.buckets.set(k, b); }
                b.push(u);
            }
        }
        queryRadius(cx, cy, r) {
            const r2 = r * r;
            const minX = Math.floor((cx - r) / this.cellSize);
            const maxX = Math.floor((cx + r) / this.cellSize);
            const minY = Math.floor((cy - r) / this.cellSize);
            const maxY = Math.floor((cy + r) / this.cellSize);
            const out = [];
            for (let by = minY; by <= maxY; by++) {
                for (let bx = minX; bx <= maxX; bx++) {
                    const b = this.buckets.get(\`\${bx},\${by}\`);
                    if (!b) continue;
                    for (const u of b) {
                        const dx = u.cx - cx, dy = u.cy - cy;
                        if (dx * dx + dy * dy <= r2) out.push(u);
                    }
                }
            }
            return out;
        }
    }
    const hash = new SpatialHash(4);
    const RADIUS = 3;
    let queryAt = null;
    let foundSet = new Set();

    function naiveQuery(cx, cy, r) {
        const r2 = r * r;
        const out = [];
        for (const u of UNITS) {
            const dx = u.cx - cx, dy = u.cy - cy;
            if (dx * dx + dy * dy <= r2) out.push(u);
        }
        return out;
    }

    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        for (const u of UNITS) {
            u.cx += u.vx * dt;
            u.cy += u.vy * dt;
            if (u.cx < 0 || u.cx > map.width - 1)  u.vx *= -1;
            if (u.cy < 0 || u.cy > map.height - 1) u.vy *= -1;
        }
        hash.rebuild(UNITS);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        const cellSize = hash.cellSize;
        ctx.strokeStyle = AV_COLORS.spatialBucketEdge;
        ctx.lineWidth = 1;
        for (let by = 0; by * cellSize < map.height; by++) {
            for (let bx = 0; bx * cellSize < map.width; bx++) {
                const tl = cartToIso(bx * cellSize, by * cellSize, tW, tH, ox, oy);
                const tr = cartToIso(Math.min((bx+1) * cellSize, map.width), by * cellSize, tW, tH, ox, oy);
                const br = cartToIso(Math.min((bx+1) * cellSize, map.width), Math.min((by+1) * cellSize, map.height), tW, tH, ox, oy);
                const bl = cartToIso(bx * cellSize, Math.min((by+1) * cellSize, map.height), tW, tH, ox, oy);
                ctx.beginPath();
                ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
                ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y);
                ctx.closePath();
                ctx.stroke();
            }
        }
        for (const u of UNITS) {
            const p = cartToIso(u.cx + 0.5, u.cy + 0.5, tW, tH, ox, oy);
            ctx.fillStyle = foundSet.has(u) ? AV_COLORS.accent : '#4fc3f7';
            ctx.beginPath();
            ctx.arc(p.x, p.y - 3, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        if (queryAt) {
            const p = cartToIso(queryAt.cx + 0.5, queryAt.cy + 0.5, tW, tH, ox, oy);
            ctx.strokeStyle = AV_COLORS.accent;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, RADIUS * tW * 0.5, RADIUS * tH * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    canvas.addEventListener('mousemove', (e) => {
        const m = getMouseLocal(canvas, e);
        const cart = isoToCart(m.x, m.y - tH / 2, tW, tH, ox, oy);
        if (cart.x < 0 || cart.x > map.width || cart.y < 0 || cart.y > map.height) return;
        queryAt = { cx: cart.x, cy: cart.y };
        const t0 = performance.now();
        const fast = hash.queryRadius(queryAt.cx, queryAt.cy, RADIUS);
        const t1 = performance.now();
        const naive = naiveQuery(queryAt.cx, queryAt.cy, RADIUS);
        const t2 = performance.now();
        foundSet = new Set(fast);
        info.innerHTML = \`Found <strong>\${fast.length}</strong> units within r=\${RADIUS}. \` +
            \`Spatial: <strong>\${(t1 - t0).toFixed(2)}ms</strong> · \` +
            \`Naive: <strong>\${(t2 - t1).toFixed(2)}ms</strong> (N=\${N})\`;
    });
    canvas.addEventListener('mouseleave', () => { queryAt = null; foundSet.clear(); });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_spatialHashDemo = `(function spatialHashDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_spatialHashDemo.split('\n').slice(4, -2).join('\n')}
})();`;

// =============================================================================
// DEMO 5 — iso_saveLoadDemo (injects <pre id="saveJsonOut">)
// =============================================================================
DEMO_HTML.iso_saveLoadDemo = {
    title: 'Iso — Save / Load World as JSON',
    canvas: { width: 800, height: 380 },
    controls: [
        { id: 'btnSave',         text: '💾 Save' },
        { id: 'btnLoad',         text: '📂 Load' },
        { id: 'btnSaveClear',    text: '🗑 Clear world' },
        { id: 'btnSaveAddUnit',  text: '➕ Add unit (random)' }
    ],
    info: 'Drag units around, press Save, then Clear, then Load to restore.'
};

DEMO_CODE.iso_saveLoadDemo = `(function saveLoadDemo() {
    // Inject the JSON-output <pre> since the scaffold doesn't render one.
    document.body.insertAdjacentHTML('beforeend',
        '<pre id="saveJsonOut" style="max-width:800px;margin:12px auto;padding:8px;background:#0d1117;color:#9e9e9e;border:1px solid #3a4a6a;border-radius:4px;max-height:200px;overflow:auto;font-size:12px"><code>(empty)</code></pre>');

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    const out = document.getElementById('saveJsonOut');

    const map = buildOpenMap(10, 7);
    const tW = 56, tH = 28;
    const ox = canvas.width / 2, oy = 30;

    let world = {
        version: 1,
        nextId: 1,
        units: [
            { id: 1, team: 'player', type: 'soldier', cx: 2, cy: 2 },
            { id: 2, team: 'player', type: 'soldier', cx: 3, cy: 2 },
            { id: 3, team: 'enemy',  type: 'soldier', cx: 7, cy: 4 }
        ],
        resources: 0
    };
    let dragId = null;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        for (const u of [...world.units].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx))) {
            drawIsoUnit(ctx, u.cx, u.cy, tW, tH, ox, oy,
                u.team === 'player' ? AV_COLORS.player : AV_COLORS.enemy);
        }
        info.innerHTML = \`World: \${world.units.length} units, resources: \${world.resources}\`;
    }

    canvas.addEventListener('mousedown', (e) => {
        const m = getMouseLocal(canvas, e);
        for (const u of world.units) {
            const p = cartToIso(u.cx + 0.5, u.cy + 0.5, tW, tH, ox, oy);
            if (Math.hypot(m.x - p.x, m.y - (p.y - 8)) < 12) { dragId = u.id; return; }
        }
    });
    canvas.addEventListener('mousemove', (e) => {
        if (dragId === null) return;
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (!t) return;
        const u = world.units.find(x => x.id === dragId);
        if (u) { u.cx = t.x; u.cy = t.y; render(); }
    });
    canvas.addEventListener('mouseup',   () => { dragId = null; });
    canvas.addEventListener('mouseleave', () => { dragId = null; });

    let savedJson = null;
    function save() {
        savedJson = JSON.stringify({
            version: world.version,
            nextId: world.nextId,
            units: world.units.map(u => ({ id: u.id, team: u.team, type: u.type, cx: u.cx, cy: u.cy })),
            resources: world.resources
        });
        out.innerHTML = \`<code>\${savedJson.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>\`;
        info.innerHTML = \`Saved \${savedJson.length} bytes. Click "Clear" then "Load" to round-trip.\`;
    }
    function clearWorld() {
        world.units = [];
        info.innerHTML = \`World cleared. Click "Load" to restore.\`;
        render();
    }
    function load() {
        if (!savedJson) { info.innerHTML = \`Nothing saved yet.\`; return; }
        const data = JSON.parse(savedJson);
        if (data.version !== 1) { info.innerHTML = \`Unsupported save version.\`; return; }
        world.units = data.units;
        world.nextId = data.nextId;
        world.resources = data.resources;
        info.innerHTML = \`Restored \${world.units.length} units from JSON.\`;
        render();
    }

    document.getElementById('btnSave')?.addEventListener('click', save);
    document.getElementById('btnLoad')?.addEventListener('click', load);
    document.getElementById('btnSaveClear')?.addEventListener('click', clearWorld);
    document.getElementById('btnSaveAddUnit')?.addEventListener('click', () => {
        world.units.push({
            id: world.nextId++,
            team: Math.random() < 0.5 ? 'player' : 'enemy',
            type: 'soldier',
            cx: Math.floor(Math.random() * map.width),
            cy: Math.floor(Math.random() * map.height)
        });
        render();
    });

    render();
})();`;

DEMO_CODE_TS.iso_saveLoadDemo = `(function saveLoadDemo(): void {
    document.body.insertAdjacentHTML('beforeend',
        '<pre id="saveJsonOut" style="max-width:800px;margin:12px auto;padding:8px;background:#0d1117;color:#9e9e9e;border:1px solid #3a4a6a;border-radius:4px;max-height:200px;overflow:auto;font-size:12px"><code>(empty)</code></pre>');

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
    const out = document.getElementById('saveJsonOut') as HTMLPreElement;
${DEMO_CODE.iso_saveLoadDemo.split('\n').slice(8, -2).join('\n')}
})();`;

// =============================================================================
// DEMO 6 — iso_mapEditorDemo (injects <pre id="mapEditorOut">)
// =============================================================================
DEMO_HTML.iso_mapEditorDemo = {
    title: 'Iso — Tile Map Editor with JSON Export',
    canvas: { width: 800, height: 460 },
    controls: [
        { id: 'btnEdGrass',  text: '🌿 Grass' },
        { id: 'btnEdWater',  text: '💧 Water' },
        { id: 'btnEdSand',   text: '🏖️ Sand' },
        { id: 'btnEdStone',  text: '🪨 Stone' },
        { id: 'btnEdHouse',  text: '🏠 House (2×2)' },
        { id: 'btnEdErase',  text: '🧽 Erase' },
        { id: 'btnEdClear',  text: 'Clear map' },
        { id: 'btnEdExport', text: '📤 Export JSON' }
    ],
    info: 'Pick a brush, paint the grid. Export dumps the current map as JSON.'
};

DEMO_CODE.iso_mapEditorDemo = `(function mapEditorDemo() {
    document.body.insertAdjacentHTML('beforeend',
        '<pre id="mapEditorOut" style="max-width:800px;margin:12px auto;padding:8px;background:#0d1117;color:#9e9e9e;border:1px solid #3a4a6a;border-radius:4px;max-height:200px;overflow:auto;font-size:12px"><code>(empty)</code></pre>');

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');
    const out = document.getElementById('mapEditorOut');

    const map = buildOpenMap(12, 9);
    const tW = 52, tH = 26;
    const ox = canvas.width / 2, oy = 40;
    const buildings = [];
    let brush = 'grass';
    let painting = false;

    const BRUSHES = [
        { id: 'btnEdGrass', key: 'grass', label: 'Grass' },
        { id: 'btnEdWater', key: 'water', label: 'Water' },
        { id: 'btnEdSand',  key: 'sand',  label: 'Sand' },
        { id: 'btnEdStone', key: 'stone', label: 'Stone' },
        { id: 'btnEdHouse', key: 'house', label: 'House' },
        { id: 'btnEdErase', key: 'erase', label: 'Erase' }
    ];

    function paintAt(mx, my) {
        const t = pickTileFromMouse(mx, my, ox, oy, tW, tH, map.width, map.height);
        if (!t) return;
        if (brush === 'house') {
            if (t.x + 1 >= map.width || t.y + 1 >= map.height) return;
            for (let dy = 0; dy < 2; dy++)
                for (let dx = 0; dx < 2; dx++) {
                    const tt = map.tiles[t.y + dy][t.x + dx];
                    if (tt !== 'grass' && tt !== 'sand') return;
                }
            for (const b of buildings) {
                if (t.x < b.anchorX + b.w && t.x + 2 > b.anchorX &&
                    t.y < b.anchorY + b.h && t.y + 2 > b.anchorY) return;
            }
            buildings.push({ anchorX: t.x, anchorY: t.y, w: 2, h: 2, kind: 'house' });
            return;
        }
        if (brush === 'erase') {
            const idx = buildings.findIndex(b => b.anchorX === t.x && b.anchorY === t.y);
            if (idx >= 0) buildings.splice(idx, 1);
            else map.tiles[t.y][t.x] = 'grass';
            return;
        }
        map.tiles[t.y][t.x] = brush;
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        for (const b of [...buildings].sort((a, b) => (a.anchorY + a.anchorX) - (b.anchorY + b.anchorX))) {
            drawIsoBuilding(ctx, b.anchorX, b.anchorY, b.w, b.h, tW, tH, ox, oy);
        }
    }

    canvas.addEventListener('mousedown', (e) => {
        painting = true;
        const m = getMouseLocal(canvas, e);
        paintAt(m.x, m.y);
        render();
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!painting) return;
        const m = getMouseLocal(canvas, e);
        paintAt(m.x, m.y);
        render();
    });
    canvas.addEventListener('mouseup',    () => { painting = false; });
    canvas.addEventListener('mouseleave', () => { painting = false; });

    BRUSHES.forEach(({ id, key, label }) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            brush = key;
            BRUSHES.forEach(({ id: bid }) => document.getElementById(bid)?.classList.toggle('active', bid === id));
            info.innerHTML = \`Brush: <strong>\${label}</strong>\`;
        });
    });
    document.getElementById('btnEdClear')?.addEventListener('click', () => {
        for (let y = 0; y < map.height; y++)
            for (let x = 0; x < map.width; x++) map.tiles[y][x] = 'grass';
        buildings.length = 0;
        render();
    });
    document.getElementById('btnEdExport')?.addEventListener('click', () => {
        const data = { version: 1, map, buildings };
        const json = JSON.stringify(data);
        out.innerHTML = \`<code>\${json.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code>\`;
        info.innerHTML = \`Exported \${json.length} bytes of JSON.\`;
    });

    render();
})();`;

DEMO_CODE_TS.iso_mapEditorDemo = `(function mapEditorDemo(): void {
    document.body.insertAdjacentHTML('beforeend',
        '<pre id="mapEditorOut" style="max-width:800px;margin:12px auto;padding:8px;background:#0d1117;color:#9e9e9e;border:1px solid #3a4a6a;border-radius:4px;max-height:200px;overflow:auto;font-size:12px"><code>(empty)</code></pre>');

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
    const out = document.getElementById('mapEditorOut') as HTMLPreElement;
${DEMO_CODE.iso_mapEditorDemo.split('\n').slice(8, -2).join('\n')}
})();`;

// =============================================================================
// DEMO 7 — iso_aiDemo (two AI players fight)
// =============================================================================
DEMO_HTML.iso_aiDemo = {
    title: 'Iso — Two AI Players Skirmishing',
    canvas: { width: 800, height: 460 },
    controls: [
        { id: 'btnAiStart', text: '▶ Start / Resume' },
        { id: 'btnAiPause', text: '⏸ Pause' },
        { id: 'btnAiReset', text: 'Reset' },
        { id: 'btnAiSpeed', text: '⏩ Speed × 1' }
    ],
    info: 'Hands-off simulation: each AI follows an expand → attack state machine.'
};

DEMO_CODE.iso_aiDemo = `(function aiDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(14, 9);
    const tW = 48, tH = 24;
    const ox = canvas.width / 2, oy = 40;

    function makeState() {
        return {
            running: true,
            speed: 1,
            nextId: 1,
            units: [],
            buildings: [
                { team: 'A', anchorX: 0,  anchorY: 0, w: 2, h: 2, queue: [], progress: 0, rally: { cx: 3, cy: 3 } },
                { team: 'B', anchorX: 12, anchorY: 0, w: 2, h: 2, queue: [], progress: 0, rally: { cx: 11, cy: 3 } }
            ],
            ais: {
                A: { state: 'expand', timer: 0, attackThreshold: 4, resources: 30 },
                B: { state: 'expand', timer: 0, attackThreshold: 4, resources: 30 }
            }
        };
    }
    let state = makeState();

    function addUnit(team, cx, cy, type) {
        state.units.push({
            id: state.nextId++,
            team, type, cx, cy,
            speed: type === 'worker' ? 2.5 : 3,
            target: null,
            hp: type === 'worker' ? 30 : 60,
            maxHp: type === 'worker' ? 30 : 60,
            attackDamage: type === 'worker' ? 0 : 6,
            attackRange: type === 'worker' ? 0 : 1.2,
            cooldown: 0
        });
    }
    function seed() {
        addUnit('A', 2, 2, 'worker');
        addUnit('B', 11, 2, 'worker');
    }
    seed();

    function tickAI(ai, team, dt) {
        ai.timer -= dt;
        if (ai.timer > 0) return;
        ai.timer = 1.0;
        ai.resources += 5;
        const team_units = state.units.filter(u => u.team === team && u.hp > 0);
        const workers = team_units.filter(u => u.type === 'worker').length;
        ai.resources += workers * 3;
        const army = team_units.filter(u => u.type === 'soldier').length;
        const b = state.buildings.find(x => x.team === team);
        switch (ai.state) {
            case 'expand':
                if (workers < 3 && ai.resources >= 20 && b.queue.length < 2) {
                    b.queue.push({ unitType: 'worker', buildTime: 2 });
                    ai.resources -= 20;
                } else if (army < ai.attackThreshold && ai.resources >= 30 && b.queue.length < 2) {
                    b.queue.push({ unitType: 'soldier', buildTime: 3 });
                    ai.resources -= 30;
                }
                if (army >= ai.attackThreshold) ai.state = 'attack';
                break;
            case 'attack': {
                const enemyBase = state.buildings.find(x => x.team !== team);
                for (const u of team_units) {
                    if (u.type === 'soldier' && !u.target) {
                        u.target = { cx: enemyBase.anchorX + 1, cy: enemyBase.anchorY + 1 };
                    }
                }
                if (army < 2) ai.state = 'expand';
                break;
            }
        }
    }

    function tickBuilding(b, dt) {
        const job = b.queue[0];
        if (!job) return;
        b.progress += dt;
        if (b.progress >= job.buildTime) {
            const spawnX = b.team === 'A' ? b.anchorX + b.w : b.anchorX - 1;
            const spawnY = b.anchorY + b.h - 1;
            addUnit(b.team, spawnX, spawnY, job.unitType);
            const last = state.units[state.units.length - 1];
            last.target = { cx: b.rally.cx, cy: b.rally.cy };
            b.queue.shift();
            b.progress = 0;
        }
    }

    function tickUnit(u, dt) {
        if (u.hp <= 0) return;
        u.cooldown = Math.max(0, u.cooldown - dt);
        if (u.attackDamage > 0) {
            let target = null, best = Infinity;
            for (const other of state.units) {
                if (other.team === u.team || other.hp <= 0) continue;
                const d = Math.hypot(other.cx - u.cx, other.cy - u.cy);
                if (d <= u.attackRange && d < best) { best = d; target = other; }
            }
            if (target && u.cooldown === 0) {
                target.hp -= u.attackDamage;
                u.cooldown = 0.8;
                return;
            }
        }
        if (!u.target) return;
        const dx = u.target.cx - u.cx, dy = u.target.cy - u.cy;
        const d = Math.hypot(dx, dy);
        if (d < 0.1) { u.target = null; return; }
        const step = u.speed * dt;
        if (step >= d) { u.cx = u.target.cx; u.cy = u.target.cy; u.target = null; }
        else { u.cx += dx / d * step; u.cy += dy / d * step; }
    }

    let lastT = performance.now();
    function frame(now) {
        const realDt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        if (state.running) {
            const dt = realDt * state.speed;
            tickAI(state.ais.A, 'A', dt);
            tickAI(state.ais.B, 'B', dt);
            for (const b of state.buildings) tickBuilding(b, dt);
            for (const u of state.units) tickUnit(u, dt);
            state.units = state.units.filter(u => u.hp > 0);
        }
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        const drawList = [];
        for (const b of state.buildings)
            drawList.push({ kind: 'b', cx: b.anchorX + b.w * 0.5, cy: b.anchorY + b.h * 0.5, ref: b });
        for (const u of state.units)
            drawList.push({ kind: 'u', cx: u.cx, cy: u.cy, ref: u });
        drawList.sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
        for (const it of drawList) {
            if (it.kind === 'b') {
                drawIsoBuilding(ctx, it.ref.anchorX, it.ref.anchorY, it.ref.w, it.ref.h, tW, tH, ox, oy,
                    it.ref.team === 'A' ? '#4caf50' : '#e57373');
            } else {
                const u = it.ref;
                const color = u.team === 'A'
                    ? (u.type === 'worker' ? '#aed581' : AV_COLORS.player)
                    : (u.type === 'worker' ? '#ffab91' : AV_COLORS.enemy);
                drawIsoUnit(ctx, u.cx, u.cy, tW, tH, ox, oy, color, u.hp, u.maxHp);
            }
        }
        ctx.fillStyle = AV_COLORS.hud;
        ctx.fillRect(8, 8, 360, 70);
        ctx.fillStyle = AV_COLORS.label;
        ctx.font = 'bold 12px sans-serif';
        const sumA = state.units.filter(u => u.team === 'A').length;
        const sumB = state.units.filter(u => u.team === 'B').length;
        ctx.fillText(\`Team A — state: \${state.ais.A.state}, units: \${sumA}, wood: \${Math.floor(state.ais.A.resources)}\`, 16, 28);
        ctx.fillText(\`Team B — state: \${state.ais.B.state}, units: \${sumB}, wood: \${Math.floor(state.ais.B.resources)}\`, 16, 48);
        ctx.fillText(\`\${state.running ? '▶' : '⏸'}  speed ×\${state.speed}\`, 16, 68);
    }

    document.getElementById('btnAiStart')?.addEventListener('click', () => { state.running = true; });
    document.getElementById('btnAiPause')?.addEventListener('click', () => { state.running = false; });
    document.getElementById('btnAiReset')?.addEventListener('click', () => { state = makeState(); seed(); });
    document.getElementById('btnAiSpeed')?.addEventListener('click', (e) => {
        const opts = [1, 2, 4];
        const i = opts.indexOf(state.speed);
        state.speed = opts[(i + 1) % opts.length];
        e.target.textContent = \`⏩ Speed × \${state.speed}\`;
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_aiDemo = `(function aiDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_aiDemo.split('\n').slice(4, -2).join('\n')}
})();`;

// =============================================================================
// DEMO 8 — iso_stressDemo (500 units, flow field, FPS)
// =============================================================================
DEMO_HTML.iso_stressDemo = {
    title: 'Iso — Stress Test: Flow-Field Swarm',
    canvas: { width: 800, height: 500 },
    controls: [
        { id: 'btnStressMore',  text: '+100 units' },
        { id: 'btnStressFewer', text: '−100 units' },
        { id: 'btnStressReset', text: 'Reset to 500' }
    ],
    info: 'One flow field; many units. Click to retarget the swarm.'
};

DEMO_CODE.iso_stressDemo = `(function stressDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(28, 18);
    const tW = 28, tH = 14;
    const ox = canvas.width / 2, oy = 30;
    const blocked = (() => {
        const b = new Uint8Array(map.width * map.height);
        for (let y = 0; y < map.height; y++)
            for (let x = 0; x < map.width; x++)
                if (!isWalkable(map, x, y)) b[y * map.width + x] = 1;
        return b;
    })();
    let goal = { x: map.width - 3, y: map.height - 3 };
    let field = computeFlowField(map, blocked, goal);

    let UNITS = [];
    function makeUnits(n) {
        UNITS = [];
        for (let i = 0; i < n; i++) {
            let cx, cy;
            do { cx = Math.floor(Math.random() * map.width); cy = Math.floor(Math.random() * map.height); }
            while (!isWalkable(map, cx, cy));
            UNITS.push({
                cx: cx + 0.2 + Math.random() * 0.6,
                cy: cy + 0.2 + Math.random() * 0.6,
                speed: 1.2 + Math.random() * 0.6
            });
        }
    }
    makeUnits(500);

    let lastT = performance.now();
    let smoothedFps = 60;
    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        if (dt > 0) smoothedFps = smoothedFps * 0.92 + (1 / dt) * 0.08;

        for (const u of UNITS) {
            const cx = Math.floor(u.cx);
            const cy = Math.floor(u.cy);
            if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) continue;
            const f = field.flow[cy * map.width + cx];
            if (!f) continue;
            u.cx += f.dx * u.speed * dt;
            u.cy += f.dy * u.speed * dt;
        }
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGround(ctx, map, tW, tH, ox, oy);
        const gp = cartToIso(goal.x, goal.y, tW, tH, ox, oy);
        drawIsoTile(ctx, gp.x, gp.y, tW, tH, 'rgba(255, 167, 38, 0.5)', AV_COLORS.accent);
        ctx.fillStyle = '#4fc3f7';
        for (const u of UNITS) {
            const p = cartToIso(u.cx + 0.5, u.cy + 0.5, tW, tH, ox, oy);
            ctx.fillRect(p.x - 1, p.y - 4, 3, 3);
        }
        ctx.fillStyle = AV_COLORS.hud;
        ctx.fillRect(8, 8, 280, 50);
        ctx.fillStyle = AV_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(\`Units: \${UNITS.length}  ·  FPS: \${smoothedFps.toFixed(0)}\`, 16, 28);
        ctx.fillText(\`Goal: (\${goal.x}, \${goal.y})\`, 16, 48);
    }

    canvas.addEventListener('click', (e) => {
        const m = getMouseLocal(canvas, e);
        const t = pickTileFromMouse(m.x, m.y, ox, oy, tW, tH, map.width, map.height);
        if (!t || !isWalkable(map, t.x, t.y)) return;
        goal = t;
        const t0 = performance.now();
        field = computeFlowField(map, blocked, goal);
        info.innerHTML = \`Flow field rebuilt in \${(performance.now() - t0).toFixed(1)}ms · \${UNITS.length} units following.\`;
    });
    document.getElementById('btnStressMore')?.addEventListener('click', () => { makeUnits(UNITS.length + 100); });
    document.getElementById('btnStressFewer')?.addEventListener('click', () => { makeUnits(Math.max(50, UNITS.length - 100)); });
    document.getElementById('btnStressReset')?.addEventListener('click', () => { makeUnits(500); });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_stressDemo = `(function stressDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;
${DEMO_CODE.iso_stressDemo.split('\n').slice(4, -2).join('\n')}
})();`;
