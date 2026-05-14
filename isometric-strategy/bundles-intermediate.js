// =============================================================================
// ISOMETRIC STRATEGY — INTERMEDIATE TIER EXPORT BUNDLES
// =============================================================================
// Same pattern as bundles-beginner.js — augments the global DEMO_CODE /
// DEMO_HTML / DEPENDENCY_BUNDLES registries that shared/export-demo.js reads.
//
// ID prefix: `iso_` (same as beginner) — collision-proof if both bundle files
// were ever loaded on one page.
//
// Note: bundles-beginner.js is NOT loaded on intermediate.html, so the five
// shared iso helpers (clearCanvas, cartToIso, isoToCart, drawIsoTile,
// pickTileFromMouse) are redefined here. They're small and stable; factoring
// into a shared file is deferred until duplication actually bites (iter 3+).
//
// Canvas-ID convention: the standalone-HTML scaffold hardcodes `<canvas id="canvas">`
// and `<div id="info">` (shared/export-demo.js:166-170). Every DEMO_CODE string
// below is a rewrite of the IIFE in intermediate-demos.js with lookups retargeted
// to those fixed IDs. Button IDs stay as-is — they match `controls[].id`.
// =============================================================================

window.DEMO_CODE = window.DEMO_CODE || {};
window.DEMO_CODE_TS = window.DEMO_CODE_TS || {};
window.DEMO_HTML = window.DEMO_HTML || {};
window.DEPENDENCY_BUNDLES = window.DEPENDENCY_BUNDLES || {};
window.DEPENDENCY_BUNDLES_TS = window.DEPENDENCY_BUNDLES_TS || {};

// =============================================================================
// SHARED ISO HELPERS (re-defined here so intermediate exports stand alone)
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

DEPENDENCY_BUNDLES.iso_clamp = `function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}`;

// ---- TS variants of the shared helpers --------------------------------------

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
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, tileW: number, tileH: number,
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
    mouseX: number, mouseY: number, originX: number, originY: number,
    tileW: number, tileH: number,
    mapW: number | null = null, mapH: number | null = null
): { x: number; y: number } | null {
    const cart = isoToCart(mouseX, mouseY - tileH / 2, tileW, tileH, originX, originY);
    const tx = Math.floor(cart.x);
    const ty = Math.floor(cart.y);
    if (mapW !== null && (tx < 0 || tx >= mapW)) return null;
    if (mapH !== null && (ty < 0 || ty >= mapH)) return null;
    return { x: tx, y: ty };
}`;

DEPENDENCY_BUNDLES_TS.iso_clamp = `function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}`;

// =============================================================================
// NEW INTERMEDIATE-TIER DEPENDENCIES
// =============================================================================

DEPENDENCY_BUNDLES.iso_im_colors = `const IM_COLORS = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    tree:   '#2f6b2c',
    treeT:  '#5a3a20',
    bldg:   '#ab47bc',
    bldgT:  '#7e34a0',
    player: '#66bb6a',
    enemy:  '#ef5350',
    accent: '#ffa726',
    hover:  '#ff7043',
    label:  '#e0e0e0',
    muted:  '#9e9e9e'
};`;

DEPENDENCY_BUNDLES.iso_terrainColor = `function terrainColor(t) {
    switch (t) {
        case 'grass': return IM_COLORS.grass;
        case 'water': return IM_COLORS.water;
        case 'sand':  return IM_COLORS.sand;
        case 'stone': return IM_COLORS.stone;
        default:      return '#1a233a';
    }
}`;

DEPENDENCY_BUNDLES.iso_buildRiverMap = `function buildRiverMap(width = 12, height = 10) {
    const map = Array.from({ length: height }, () => Array(width).fill('grass'));
    for (let x = 0; x < width; x++) {
        map[5][x] = 'water';
        map[4][x] = 'sand';
        map[6][x] = 'sand';
    }
    map[2][2] = 'stone';
    map[2][3] = 'stone';
    map[3][2] = 'stone';
    return { width, height, tiles: map };
}`;

DEPENDENCY_BUNDLES.iso_isWalkable = `function isWalkable(map, cx, cy) {
    if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) return false;
    const t = map.tiles[cy][cx];
    return t === 'grass' || t === 'sand';
}`;

DEPENDENCY_BUNDLES.iso_drawGroundLayer = `function drawGroundLayer(ctx, map, tileW, tileH, originX, originY) {
    for (let cy = 0; cy < map.height; cy++) {
        for (let cx = 0; cx < map.width; cx++) {
            const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
            drawIsoTile(ctx, p.x, p.y, tileW, tileH, terrainColor(map.tiles[cy][cx]), IM_COLORS.outline);
        }
    }
}`;

DEPENDENCY_BUNDLES.iso_drawTree = `function drawTree(ctx, cx, cy, tileW, tileH, originX, originY) {
    const p = cartToIso(cx + 0.5, cy + 0.5, tileW, tileH, originX, originY);
    ctx.fillStyle = IM_COLORS.treeT;
    ctx.fillRect(p.x - 2, p.y - 22, 4, 22);
    ctx.fillStyle = IM_COLORS.tree;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 28, 12, 0, Math.PI * 2);
    ctx.fill();
}`;

DEPENDENCY_BUNDLES.iso_drawUnit = `function drawUnit(ctx, cx, cy, tileW, tileH, originX, originY, color, facing = null) {
    const p = cartToIso(cx + 0.5, cy + 0.5, tileW, tileH, originX, originY);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 6, p.y - 13, 12, 16);
    if (facing) {
        ctx.fillStyle = IM_COLORS.accent;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(facing, p.x, p.y - 34);
        ctx.textAlign = 'start';
    }
}`;

DEPENDENCY_BUNDLES.iso_facingFromVelocity = `const DIRECTIONS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
function facingFromVelocity(vx, vy) {
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) return null;
    const angle = Math.atan2(vy, vx) + Math.PI / 8;
    const idx = Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4));
    return DIRECTIONS[idx % 8];
}`;

// Animation primitives (Phase 7 of intermediate tier)
DEPENDENCY_BUNDLES.iso_walkFrames = `const WALK_FRAMES = [
    { lLeg:  0.6, rLeg: -0.6, lArm: -0.5, rArm:  0.5 },
    { lLeg:  0.3, rLeg: -0.3, lArm: -0.25, rArm:  0.25 },
    { lLeg:  0.0, rLeg:  0.0, lArm:  0.0,  rArm:  0.0  },
    { lLeg: -0.6, rLeg:  0.6, lArm:  0.5,  rArm: -0.5  },
    { lLeg: -0.3, rLeg:  0.3, lArm:  0.25, rArm: -0.25 },
    { lLeg:  0.0, rLeg:  0.0, lArm:  0.0,  rArm:  0.0  }
];`;

DEPENDENCY_BUNDLES.iso_idleFrames = `const IDLE_FRAMES = [
    { lLeg: 0, rLeg: 0, lArm: -0.05, rArm: 0.05, bob: 0 },
    { lLeg: 0, rLeg: 0, lArm:  0.05, rArm: -0.05, bob: 2 }
];`;

DEPENDENCY_BUNDLES.iso_attackFrames = `const ATTACK_FRAMES = [
    { lLeg: 0, rLeg: 0, lArm: -1.2, rArm:  0.0, sword: -1.2, phase: 'wind' },
    { lLeg: 0, rLeg: 0, lArm:  0.3, rArm: -0.4, sword:  1.0, phase: 'strike' },
    { lLeg: 0, rLeg: 0, lArm:  0.6, rArm: -0.2, sword:  1.4, phase: 'recover' }
];`;

DEPENDENCY_BUNDLES.iso_deathFrames = `const DEATH_FRAMES = [
    { lLeg:  0.4, rLeg: -0.4, lArm: -0.3, rArm: 0.3, tilt: 0.2 },
    { lLeg:  0.6, rLeg: -0.6, lArm: -0.6, rArm: 0.6, tilt: 0.6 },
    { lLeg:  0.8, rLeg: -0.8, lArm: -1.0, rArm: 1.0, tilt: 1.0 },
    { lLeg:  0.9, rLeg: -0.9, lArm: -1.3, rArm: 1.3, tilt: 1.45 }
];`;

DEPENDENCY_BUNDLES.iso_makeClip = `function makeClip(frames, fps = 8, loop = true) {
    return { frames, fps, loop, time: 0, done: false };
}`;

DEPENDENCY_BUNDLES.iso_clipUpdate = `function clipUpdate(clip, dt) {
    if (clip.done) return;
    clip.time += dt;
    const total = clip.frames.length / clip.fps;
    if (clip.time >= total) {
        if (clip.loop) clip.time %= total;
        else { clip.time = total - 0.0001; clip.done = true; }
    }
}`;

DEPENDENCY_BUNDLES.iso_clipFrame = `function clipFrame(clip) {
    const idx = Math.floor(clip.time * clip.fps);
    return { idx, data: clip.frames[Math.min(idx, clip.frames.length - 1)] };
}`;

DEPENDENCY_BUNDLES.iso_clipReset = `function clipReset(clip) { clip.time = 0; clip.done = false; }`;

DEPENDENCY_BUNDLES.iso_drawWalker = `function drawWalker(ctx, sx, sy, frame, color = IM_COLORS.player, extras = {}) {
    const f = frame || { lLeg: 0, rLeg: 0, lArm: 0, rArm: 0 };
    const tilt = (f.tilt || 0) + (extras.tilt || 0);
    const bob  = (f.bob  || 0);
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.rotate(tilt);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -42, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -34); ctx.lineTo(0, -10);
    ctx.stroke();
    const lLegX = Math.sin(f.lLeg) * 16, lLegY = Math.cos(f.lLeg) * 18;
    const rLegX = Math.sin(f.rLeg) * 16, rLegY = Math.cos(f.rLeg) * 18;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(lLegX, -10 + lLegY);
    ctx.moveTo(0, -10); ctx.lineTo(rLegX, -10 + rLegY);
    ctx.stroke();
    const lArmX = Math.sin(f.lArm) * 14, lArmY = Math.cos(f.lArm) * 14;
    const rArmX = Math.sin(f.rArm) * 14, rArmY = Math.cos(f.rArm) * 14;
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(lArmX, -30 + lArmY);
    ctx.moveTo(0, -30); ctx.lineTo(rArmX, -30 + rArmY);
    ctx.stroke();
    if (f.sword !== undefined) {
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 4;
        const swordX = Math.sin(f.sword) * 28;
        const swordY = Math.cos(f.sword) * 28;
        ctx.beginPath();
        ctx.moveTo(rArmX, -30 + rArmY);
        ctx.lineTo(rArmX + swordX, -30 + rArmY - Math.abs(swordY) - 10);
        ctx.stroke();
    }
    ctx.restore();
}`;

// ---- TS variants of intermediate-tier dependencies --------------------------

DEPENDENCY_BUNDLES_TS.iso_im_colors = `const IM_COLORS: Record<string, string> = {
    bg: '#0d1117',
    grass:  '#4a7c3a',
    water:  '#3ba0d8',
    sand:   '#d7c878',
    stone:  '#6a6a6a',
    outline:'#3a4a6a',
    tree:   '#2f6b2c',
    treeT:  '#5a3a20',
    bldg:   '#ab47bc',
    bldgT:  '#7e34a0',
    player: '#66bb6a',
    enemy:  '#ef5350',
    accent: '#ffa726',
    hover:  '#ff7043',
    label:  '#e0e0e0',
    muted:  '#9e9e9e'
};`;

DEPENDENCY_BUNDLES_TS.iso_terrainColor = `function terrainColor(t: string): string {
    switch (t) {
        case 'grass': return IM_COLORS.grass;
        case 'water': return IM_COLORS.water;
        case 'sand':  return IM_COLORS.sand;
        case 'stone': return IM_COLORS.stone;
        default:      return '#1a233a';
    }
}`;

DEPENDENCY_BUNDLES_TS.iso_buildRiverMap = `type IsoMap = { width: number; height: number; tiles: string[][] };
function buildRiverMap(width: number = 12, height: number = 10): IsoMap {
    const map: string[][] = Array.from({ length: height }, () => Array(width).fill('grass') as string[]);
    for (let x = 0; x < width; x++) {
        map[5][x] = 'water';
        map[4][x] = 'sand';
        map[6][x] = 'sand';
    }
    map[2][2] = 'stone';
    map[2][3] = 'stone';
    map[3][2] = 'stone';
    return { width, height, tiles: map };
}`;

DEPENDENCY_BUNDLES_TS.iso_isWalkable = `function isWalkable(map: IsoMap, cx: number, cy: number): boolean {
    if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) return false;
    const t = map.tiles[cy][cx];
    return t === 'grass' || t === 'sand';
}`;

DEPENDENCY_BUNDLES_TS.iso_drawGroundLayer = `function drawGroundLayer(
    ctx: CanvasRenderingContext2D, map: IsoMap,
    tileW: number, tileH: number, originX: number, originY: number
): void {
    for (let cy = 0; cy < map.height; cy++) {
        for (let cx = 0; cx < map.width; cx++) {
            const p = cartToIso(cx, cy, tileW, tileH, originX, originY);
            drawIsoTile(ctx, p.x, p.y, tileW, tileH, terrainColor(map.tiles[cy][cx]), IM_COLORS.outline);
        }
    }
}`;

DEPENDENCY_BUNDLES_TS.iso_drawTree = `function drawTree(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, tileW: number, tileH: number,
    originX: number, originY: number
): void {
    const p = cartToIso(cx + 0.5, cy + 0.5, tileW, tileH, originX, originY);
    ctx.fillStyle = IM_COLORS.treeT;
    ctx.fillRect(p.x - 2, p.y - 22, 4, 22);
    ctx.fillStyle = IM_COLORS.tree;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 28, 12, 0, Math.PI * 2);
    ctx.fill();
}`;

DEPENDENCY_BUNDLES_TS.iso_drawUnit = `function drawUnit(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, tileW: number, tileH: number,
    originX: number, originY: number,
    color: string, facing: string | null = null
): void {
    const p = cartToIso(cx + 0.5, cy + 0.5, tileW, tileH, originX, originY);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 6, p.y - 13, 12, 16);
    if (facing) {
        ctx.fillStyle = IM_COLORS.accent;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(facing, p.x, p.y - 34);
        ctx.textAlign = 'start';
    }
}`;

DEPENDENCY_BUNDLES_TS.iso_facingFromVelocity = `const DIRECTIONS: string[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
function facingFromVelocity(vx: number, vy: number): string | null {
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) return null;
    const angle = Math.atan2(vy, vx) + Math.PI / 8;
    const idx = Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4));
    return DIRECTIONS[idx % 8];
}`;

// Animation TS variants — frames stay JS-shaped (objects), only the helpers gain types.
DEPENDENCY_BUNDLES_TS.iso_walkFrames = DEPENDENCY_BUNDLES.iso_walkFrames;
DEPENDENCY_BUNDLES_TS.iso_idleFrames = DEPENDENCY_BUNDLES.iso_idleFrames;
DEPENDENCY_BUNDLES_TS.iso_attackFrames = DEPENDENCY_BUNDLES.iso_attackFrames;
DEPENDENCY_BUNDLES_TS.iso_deathFrames = DEPENDENCY_BUNDLES.iso_deathFrames;

DEPENDENCY_BUNDLES_TS.iso_makeClip = `type AnimClip = { frames: any[]; fps: number; loop: boolean; time: number; done: boolean };
function makeClip(frames: any[], fps: number = 8, loop: boolean = true): AnimClip {
    return { frames, fps, loop, time: 0, done: false };
}`;

DEPENDENCY_BUNDLES_TS.iso_clipUpdate = `function clipUpdate(clip: AnimClip, dt: number): void {
    if (clip.done) return;
    clip.time += dt;
    const total = clip.frames.length / clip.fps;
    if (clip.time >= total) {
        if (clip.loop) clip.time %= total;
        else { clip.time = total - 0.0001; clip.done = true; }
    }
}`;

DEPENDENCY_BUNDLES_TS.iso_clipFrame = `function clipFrame(clip: AnimClip): { idx: number; data: any } {
    const idx = Math.floor(clip.time * clip.fps);
    return { idx, data: clip.frames[Math.min(idx, clip.frames.length - 1)] };
}`;

DEPENDENCY_BUNDLES_TS.iso_clipReset = `function clipReset(clip: AnimClip): void { clip.time = 0; clip.done = false; }`;

DEPENDENCY_BUNDLES_TS.iso_drawWalker = `function drawWalker(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number,
    frame: any,
    color: string = IM_COLORS.player,
    extras: any = {}
): void {
    const f = frame || { lLeg: 0, rLeg: 0, lArm: 0, rArm: 0 };
    const tilt = (f.tilt || 0) + (extras.tilt || 0);
    const bob  = (f.bob  || 0);
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.rotate(tilt);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -42, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -34); ctx.lineTo(0, -10);
    ctx.stroke();
    const lLegX = Math.sin(f.lLeg) * 16, lLegY = Math.cos(f.lLeg) * 18;
    const rLegX = Math.sin(f.rLeg) * 16, rLegY = Math.cos(f.rLeg) * 18;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(lLegX, -10 + lLegY);
    ctx.moveTo(0, -10); ctx.lineTo(rLegX, -10 + rLegY);
    ctx.stroke();
    const lArmX = Math.sin(f.lArm) * 14, lArmY = Math.cos(f.lArm) * 14;
    const rArmX = Math.sin(f.rArm) * 14, rArmY = Math.cos(f.rArm) * 14;
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(lArmX, -30 + lArmY);
    ctx.moveTo(0, -30); ctx.lineTo(rArmX, -30 + rArmY);
    ctx.stroke();
    if (f.sword !== undefined) {
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 4;
        const swordX = Math.sin(f.sword) * 28;
        const swordY = Math.cos(f.sword) * 28;
        ctx.beginPath();
        ctx.moveTo(rArmX, -30 + rArmY);
        ctx.lineTo(rArmX + swordX, -30 + rArmY - Math.abs(swordY) - 10);
        ctx.stroke();
    }
    ctx.restore();
}`;

// =============================================================================
// DEMO 1 — iso_tileMapDemo
// =============================================================================
DEMO_HTML.iso_tileMapDemo = {
    title: 'Iso — Tile Map Data Structure',
    canvas: { width: 800, height: 380 },
    controls: [],
    info: 'Static tile-map render.'
};

DEMO_CODE.iso_tileMapDemo = `(function tileMapDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(12, 10);
    const tileW = 56, tileH = 28;
    const originX = canvas.width / 2;
    const originY = 30;

    clearCanvas(ctx, canvas.width, canvas.height);
    drawGroundLayer(ctx, map, tileW, tileH, originX, originY);
    info.textContent = \`12×10 tile map — water row, sand banks, stone outcrop at (2,2),(3,2),(2,3).\`;
})();`;

DEMO_CODE_TS.iso_tileMapDemo = `(function tileMapDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const map = buildRiverMap(12, 10);
    const tileW: number = 56, tileH: number = 28;
    const originX: number = canvas.width / 2;
    const originY: number = 30;

    clearCanvas(ctx, canvas.width, canvas.height);
    drawGroundLayer(ctx, map, tileW, tileH, originX, originY);
    info.textContent = \`12×10 tile map — water row, sand banks, stone outcrop at (2,2),(3,2),(2,3).\`;
})();`;

// =============================================================================
// DEMO 2 — iso_layersDemo
// =============================================================================
DEMO_HTML.iso_layersDemo = {
    title: 'Iso — Three-Pass Rendering (Ground / Decoration / Entity)',
    canvas: { width: 800, height: 420 },
    controls: [
        { id: 'btnLayerGround', text: 'Ground' },
        { id: 'btnLayerDeco',   text: 'Decoration' },
        { id: 'btnLayerEntity', text: 'Entity' }
    ],
    info: 'Toggle the three rendering passes.'
};

DEMO_CODE.iso_layersDemo = `(function layersDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(10, 8);
    const decorations = [
        { cx: 1, cy: 1 }, { cx: 6, cy: 1 }, { cx: 8, cy: 2 },
        { cx: 0, cy: 7 }, { cx: 4, cy: 8 }, { cx: 9, cy: 7 }
    ].filter(d => d.cy < map.height && d.cx < map.width);
    const entities = [
        { cx: 3.5, cy: 7.2, color: IM_COLORS.player },
        { cx: 5.2, cy: 8.0, color: IM_COLORS.enemy }
    ];
    const tileW = 56, tileH = 28;
    const originX = canvas.width / 2;
    const originY = 30;
    const state = { ground: true, deco: true, entity: true };

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        if (state.ground) drawGroundLayer(ctx, map, tileW, tileH, originX, originY);
        if (state.deco) {
            const sorted = [...decorations].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
            sorted.forEach(d => drawTree(ctx, d.cx, d.cy, tileW, tileH, originX, originY));
        }
        if (state.entity) {
            const sortedE = [...entities].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
            sortedE.forEach(e => drawUnit(ctx, e.cx, e.cy, tileW, tileH, originX, originY, e.color));
        }
        const active = [
            state.ground ? 'ground' : null,
            state.deco ? 'decoration' : null,
            state.entity ? 'entities' : null
        ].filter(Boolean).join(' + ') || 'nothing';
        info.textContent = \`Showing: \${active}.\`;
    }

    function bindToggle(btnId, key) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            state[key] = !state[key];
            btn.classList.toggle('active', state[key]);
            render();
        });
    }
    bindToggle('btnLayerGround', 'ground');
    bindToggle('btnLayerDeco', 'deco');
    bindToggle('btnLayerEntity', 'entity');

    render();
})();`;

DEMO_CODE_TS.iso_layersDemo = `type LayerKey = 'ground' | 'deco' | 'entity';
(function layersDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const map = buildRiverMap(10, 8);
    const decorations: Array<{ cx: number; cy: number }> = [
        { cx: 1, cy: 1 }, { cx: 6, cy: 1 }, { cx: 8, cy: 2 },
        { cx: 0, cy: 7 }, { cx: 4, cy: 8 }, { cx: 9, cy: 7 }
    ].filter(d => d.cy < map.height && d.cx < map.width);
    const entities: Array<{ cx: number; cy: number; color: string }> = [
        { cx: 3.5, cy: 7.2, color: IM_COLORS.player },
        { cx: 5.2, cy: 8.0, color: IM_COLORS.enemy }
    ];
    const tileW: number = 56, tileH: number = 28;
    const originX: number = canvas.width / 2;
    const originY: number = 30;
    const state: Record<LayerKey, boolean> = { ground: true, deco: true, entity: true };

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        if (state.ground) drawGroundLayer(ctx, map, tileW, tileH, originX, originY);
        if (state.deco) {
            const sorted = [...decorations].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
            sorted.forEach(d => drawTree(ctx, d.cx, d.cy, tileW, tileH, originX, originY));
        }
        if (state.entity) {
            const sortedE = [...entities].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
            sortedE.forEach(e => drawUnit(ctx, e.cx, e.cy, tileW, tileH, originX, originY, e.color));
        }
        const active: string = [
            state.ground ? 'ground' : null,
            state.deco ? 'decoration' : null,
            state.entity ? 'entities' : null
        ].filter(Boolean).join(' + ') || 'nothing';
        info.textContent = \`Showing: \${active}.\`;
    }

    function bindToggle(btnId: string, key: LayerKey): void {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            state[key] = !state[key];
            btn.classList.toggle('active', state[key]);
            render();
        });
    }
    bindToggle('btnLayerGround', 'ground');
    bindToggle('btnLayerDeco', 'deco');
    bindToggle('btnLayerEntity', 'entity');

    render();
})();`;

// =============================================================================
// DEMO 3 — iso_depthSortDemo
// =============================================================================
DEMO_HTML.iso_depthSortDemo = {
    title: 'Iso — Depth Sort: Sorted vs Unsorted',
    canvas: { width: 800, height: 420 },
    controls: [
        { id: 'btnSortOn',      text: 'Depth sort ON' },
        { id: 'btnSortOff',     text: 'Depth sort OFF (broken)' },
        { id: 'btnSortAnimate', text: '▶ Walk player through scene' }
    ],
    info: 'Watch the player walk behind/in-front-of the tree as their (cx+cy) crosses it.'
};

DEMO_CODE.iso_depthSortDemo = `(function depthSortDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(8, 7);
    const tree = { cx: 4, cy: 3 };
    const player = { cx: 0, cy: 3, dir: 1 };
    const tileW = 56, tileH = 28;
    const originX = canvas.width / 2;
    const originY = 30;

    let sortMode = 'on';
    let walking = false;
    let lastTime = performance.now();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGroundLayer(ctx, map, tileW, tileH, originX, originY);

        const items = [
            { kind: 'tree', cx: tree.cx, cy: tree.cy },
            { kind: 'player', cx: player.cx, cy: player.cy }
        ];
        const ordered = (sortMode === 'on')
            ? [...items].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx))
            : items;

        for (const it of ordered) {
            if (it.kind === 'tree') drawTree(ctx, it.cx, it.cy, tileW, tileH, originX, originY);
            else drawUnit(ctx, it.cx, it.cy, tileW, tileH, originX, originY, IM_COLORS.player);
        }

        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(\`Depth sort: \${sortMode === 'on' ? 'ON ✓' : 'OFF ✗ (broken)'}\`, 14, canvas.height - 14);
    }

    function tick(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        if (walking) {
            player.cx += player.dir * 1.6 * dt;
            if (player.cx > map.width - 1) { player.cx = map.width - 1; player.dir = -1; }
            if (player.cx < 0)              { player.cx = 0;              player.dir = 1;  }
        }
        render();
        if (walking) requestAnimationFrame(tick);
    }

    function setSortMode(mode) {
        sortMode = mode;
        document.getElementById('btnSortOn').classList.toggle('active', mode === 'on');
        document.getElementById('btnSortOff').classList.toggle('active', mode === 'off');
        render();
        info.innerHTML = mode === 'on'
            ? 'Depth sort ON — player hides behind the tree when their (cx+cy) is lower.'
            : 'Depth sort OFF — tree always drawn first, so player is always on top. <strong>Broken.</strong>';
    }

    document.getElementById('btnSortOn')?.addEventListener('click', () => setSortMode('on'));
    document.getElementById('btnSortOff')?.addEventListener('click', () => setSortMode('off'));
    document.getElementById('btnSortAnimate')?.addEventListener('click', () => {
        walking = !walking;
        document.getElementById('btnSortAnimate').textContent = walking ? '⏸ Pause walk' : '▶ Walk player through scene';
        if (walking) {
            lastTime = performance.now();
            requestAnimationFrame(tick);
        }
    });

    render();
})();`;

DEMO_CODE_TS.iso_depthSortDemo = `type SortMode = 'on' | 'off';
type Drawable = { kind: 'tree' | 'player'; cx: number; cy: number };
(function depthSortDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const map = buildRiverMap(8, 7);
    const tree = { cx: 4, cy: 3 };
    const player = { cx: 0, cy: 3, dir: 1 };
    const tileW: number = 56, tileH: number = 28;
    const originX: number = canvas.width / 2;
    const originY: number = 30;

    let sortMode: SortMode = 'on';
    let walking: boolean = false;
    let lastTime: number = performance.now();

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGroundLayer(ctx, map, tileW, tileH, originX, originY);

        const items: Drawable[] = [
            { kind: 'tree', cx: tree.cx, cy: tree.cy },
            { kind: 'player', cx: player.cx, cy: player.cy }
        ];
        const ordered: Drawable[] = (sortMode === 'on')
            ? [...items].sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx))
            : items;

        for (const it of ordered) {
            if (it.kind === 'tree') drawTree(ctx, it.cx, it.cy, tileW, tileH, originX, originY);
            else drawUnit(ctx, it.cx, it.cy, tileW, tileH, originX, originY, IM_COLORS.player);
        }

        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(\`Depth sort: \${sortMode === 'on' ? 'ON ✓' : 'OFF ✗ (broken)'}\`, 14, canvas.height - 14);
    }

    function tick(now: number): void {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        if (walking) {
            player.cx += player.dir * 1.6 * dt;
            if (player.cx > map.width - 1) { player.cx = map.width - 1; player.dir = -1; }
            if (player.cx < 0)              { player.cx = 0;              player.dir = 1;  }
        }
        render();
        if (walking) requestAnimationFrame(tick);
    }

    function setSortMode(mode: SortMode): void {
        sortMode = mode;
        (document.getElementById('btnSortOn') as HTMLButtonElement).classList.toggle('active', mode === 'on');
        (document.getElementById('btnSortOff') as HTMLButtonElement).classList.toggle('active', mode === 'off');
        render();
        info.innerHTML = mode === 'on'
            ? 'Depth sort ON — player hides behind the tree when their (cx+cy) is lower.'
            : 'Depth sort OFF — tree always drawn first, so player is always on top. <strong>Broken.</strong>';
    }

    document.getElementById('btnSortOn')?.addEventListener('click', () => setSortMode('on'));
    document.getElementById('btnSortOff')?.addEventListener('click', () => setSortMode('off'));
    document.getElementById('btnSortAnimate')?.addEventListener('click', () => {
        walking = !walking;
        (document.getElementById('btnSortAnimate') as HTMLButtonElement).textContent = walking ? '⏸ Pause walk' : '▶ Walk player through scene';
        if (walking) {
            lastTime = performance.now();
            requestAnimationFrame(tick);
        }
    });

    render();
})();`;

// =============================================================================
// DEMO 4 — iso_cameraDemo (tabindex injected at startup)
// =============================================================================
DEMO_HTML.iso_cameraDemo = {
    title: 'Iso — Camera (Drag-Pan / Wheel-Zoom / Arrow Nudge)',
    canvas: { width: 800, height: 440 },
    controls: [
        { id: 'btnCamReset',   text: 'Reset' },
        { id: 'btnCamZoomIn',  text: 'Zoom in' },
        { id: 'btnCamZoomOut', text: 'Zoom out' }
    ],
    info: 'Drag to pan · wheel to zoom · arrows nudge.'
};

DEMO_CODE.iso_cameraDemo = `(function cameraDemo() {
    const canvas = document.getElementById('canvas');
    // Scaffold doesn't set tabindex; do it at runtime so arrow-key handlers fire.
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(14, 12);
    const BASE_W = 48, BASE_H = 24;
    const camera = { originX: canvas.width / 2, originY: 40, zoom: 1 };
    let hover = null;
    let drag = null;

    function effW() { return BASE_W * camera.zoom; }
    function effH() { return BASE_H * camera.zoom; }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const tW = effW(), tH = effH();
        for (let cy = 0; cy < map.height; cy++) {
            for (let cx = 0; cx < map.width; cx++) {
                const p = cartToIso(cx, cy, tW, tH, camera.originX, camera.originY);
                const isHover = hover && hover.x === cx && hover.y === cy;
                drawIsoTile(ctx, p.x, p.y, tW, tH,
                    isHover ? IM_COLORS.hover : terrainColor(map.tiles[cy][cx]),
                    IM_COLORS.outline);
            }
        }
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(\`zoom=\${camera.zoom.toFixed(2)}  origin=(\${camera.originX.toFixed(0)}, \${camera.originY.toFixed(0)})\`,
            14, canvas.height - 14);
    }

    function updateHoverFromEvent(e) {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const t = pickTileFromMouse(mx, my, camera.originX, camera.originY, effW(), effH(), map.width, map.height);
        hover = t;
        info.innerHTML = t
            ? \`Hovering tile <strong>(\${t.x}, \${t.y})</strong> — picking works through pan & zoom.\`
            : 'Drag to pan, scroll to zoom, arrow keys to nudge.';
    }

    canvas.addEventListener('mousedown', (e) => {
        drag = { x: e.clientX, y: e.clientY, ox: camera.originX, oy: camera.originY };
        canvas.style.cursor = 'grabbing';
        canvas.focus();
    });
    canvas.addEventListener('mousemove', (e) => {
        if (drag) {
            camera.originX = drag.ox + (e.clientX - drag.x);
            camera.originY = drag.oy + (e.clientY - drag.y);
        }
        updateHoverFromEvent(e);
        render();
    });
    canvas.addEventListener('mouseup', () => {
        drag = null;
        canvas.style.cursor = 'crosshair';
    });
    canvas.addEventListener('mouseleave', () => {
        drag = null;
        hover = null;
        info.textContent = 'Drag to pan, scroll to zoom, arrow keys to nudge.';
        render();
    });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const prevZoom = camera.zoom;
        const next = clamp(prevZoom * (e.deltaY < 0 ? 1.1 : 1/1.1), 0.5, 2.5);
        const k = next / prevZoom;
        camera.originX = mx - (mx - camera.originX) * k;
        camera.originY = my - (my - camera.originY) * k;
        camera.zoom = next;
        updateHoverFromEvent(e);
        render();
    }, { passive: false });
    canvas.addEventListener('keydown', (e) => {
        const step = 20;
        if (e.key === 'ArrowLeft')  { camera.originX += step; e.preventDefault(); }
        if (e.key === 'ArrowRight') { camera.originX -= step; e.preventDefault(); }
        if (e.key === 'ArrowUp')    { camera.originY += step; e.preventDefault(); }
        if (e.key === 'ArrowDown')  { camera.originY -= step; e.preventDefault(); }
        render();
    });

    document.getElementById('btnCamReset')?.addEventListener('click', () => {
        camera.originX = canvas.width / 2; camera.originY = 40; camera.zoom = 1;
        render();
    });
    document.getElementById('btnCamZoomIn')?.addEventListener('click', () => {
        camera.zoom = clamp(camera.zoom * 1.2, 0.5, 2.5);
        render();
    });
    document.getElementById('btnCamZoomOut')?.addEventListener('click', () => {
        camera.zoom = clamp(camera.zoom / 1.2, 0.5, 2.5);
        render();
    });

    canvas.style.cursor = 'crosshair';
    render();
})();`;

DEMO_CODE_TS.iso_cameraDemo = `type Camera = { originX: number; originY: number; zoom: number };
type Drag = { x: number; y: number; ox: number; oy: number } | null;
(function cameraDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const map = buildRiverMap(14, 12);
    const BASE_W: number = 48, BASE_H: number = 24;
    const camera: Camera = { originX: canvas.width / 2, originY: 40, zoom: 1 };
    let hover: { x: number; y: number } | null = null;
    let drag: Drag = null;

    function effW(): number { return BASE_W * camera.zoom; }
    function effH(): number { return BASE_H * camera.zoom; }

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        const tW = effW(), tH = effH();
        for (let cy = 0; cy < map.height; cy++) {
            for (let cx = 0; cx < map.width; cx++) {
                const p = cartToIso(cx, cy, tW, tH, camera.originX, camera.originY);
                const isHover: boolean = !!(hover && hover.x === cx && hover.y === cy);
                drawIsoTile(ctx, p.x, p.y, tW, tH,
                    isHover ? IM_COLORS.hover : terrainColor(map.tiles[cy][cx]),
                    IM_COLORS.outline);
            }
        }
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(\`zoom=\${camera.zoom.toFixed(2)}  origin=(\${camera.originX.toFixed(0)}, \${camera.originY.toFixed(0)})\`,
            14, canvas.height - 14);
    }

    function updateHoverFromEvent(e: MouseEvent): void {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const t = pickTileFromMouse(mx, my, camera.originX, camera.originY, effW(), effH(), map.width, map.height);
        hover = t;
        info.innerHTML = t
            ? \`Hovering tile <strong>(\${t.x}, \${t.y})</strong> — picking works through pan & zoom.\`
            : 'Drag to pan, scroll to zoom, arrow keys to nudge.';
    }

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
        drag = { x: e.clientX, y: e.clientY, ox: camera.originX, oy: camera.originY };
        canvas.style.cursor = 'grabbing';
        canvas.focus();
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
        if (drag) {
            camera.originX = drag.ox + (e.clientX - drag.x);
            camera.originY = drag.oy + (e.clientY - drag.y);
        }
        updateHoverFromEvent(e);
        render();
    });
    canvas.addEventListener('mouseup', () => {
        drag = null;
        canvas.style.cursor = 'crosshair';
    });
    canvas.addEventListener('mouseleave', () => {
        drag = null;
        hover = null;
        info.textContent = 'Drag to pan, scroll to zoom, arrow keys to nudge.';
        render();
    });
    canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const prevZoom = camera.zoom;
        const next = clamp(prevZoom * (e.deltaY < 0 ? 1.1 : 1/1.1), 0.5, 2.5);
        const k = next / prevZoom;
        camera.originX = mx - (mx - camera.originX) * k;
        camera.originY = my - (my - camera.originY) * k;
        camera.zoom = next;
        updateHoverFromEvent(e);
        render();
    }, { passive: false });
    canvas.addEventListener('keydown', (e: KeyboardEvent) => {
        const step = 20;
        if (e.key === 'ArrowLeft')  { camera.originX += step; e.preventDefault(); }
        if (e.key === 'ArrowRight') { camera.originX -= step; e.preventDefault(); }
        if (e.key === 'ArrowUp')    { camera.originY += step; e.preventDefault(); }
        if (e.key === 'ArrowDown')  { camera.originY -= step; e.preventDefault(); }
        render();
    });

    document.getElementById('btnCamReset')?.addEventListener('click', () => {
        camera.originX = canvas.width / 2; camera.originY = 40; camera.zoom = 1;
        render();
    });
    document.getElementById('btnCamZoomIn')?.addEventListener('click', () => {
        camera.zoom = clamp(camera.zoom * 1.2, 0.5, 2.5);
        render();
    });
    document.getElementById('btnCamZoomOut')?.addEventListener('click', () => {
        camera.zoom = clamp(camera.zoom / 1.2, 0.5, 2.5);
        render();
    });

    canvas.style.cursor = 'crosshair';
    render();
})();`;

// =============================================================================
// DEMO 5 — iso_unitDemo
// =============================================================================
DEMO_HTML.iso_unitDemo = {
    title: 'Iso — Click-to-Walk Unit (Smooth Fractional Movement)',
    canvas: { width: 800, height: 420 },
    controls: [],
    info: 'Click a tile to send the unit there.'
};

DEMO_CODE.iso_unitDemo = `(function unitDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(10, 8);
    const tileW = 56, tileH = 28;
    const originX = canvas.width / 2;
    const originY = 30;

    const unit = {
        cx: 1, cy: 1,
        targetX: 1, targetY: 1,
        speed: 3
    };

    function step(dt) {
        const dx = unit.targetX - unit.cx;
        const dy = unit.targetY - unit.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.01) { unit.cx = unit.targetX; unit.cy = unit.targetY; return; }
        const s = unit.speed * dt;
        if (s >= d) { unit.cx = unit.targetX; unit.cy = unit.targetY; }
        else {
            unit.cx += (dx / d) * s;
            unit.cy += (dy / d) * s;
        }
    }

    let lastTime = performance.now();
    function render(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        step(dt);
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGroundLayer(ctx, map, tileW, tileH, originX, originY);
        drawUnit(ctx, unit.cx, unit.cy, tileW, tileH, originX, originY, IM_COLORS.player);
        if (unit.targetX !== unit.cx || unit.targetY !== unit.cy) {
            const p = cartToIso(unit.targetX, unit.targetY, tileW, tileH, originX, originY);
            drawIsoTile(ctx, p.x, p.y, tileW, tileH, null, IM_COLORS.accent);
        }
        info.innerHTML = \`Unit at <strong>(\${unit.cx.toFixed(2)}, \${unit.cy.toFixed(2)})</strong>\` +
            \` → target (\${unit.targetX}, \${unit.targetY})\`;
        requestAnimationFrame(render);
    }

    canvas.addEventListener('click', (e) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const t = pickTileFromMouse(mx, my, originX, originY, tileW, tileH, map.width, map.height);
        if (t) {
            unit.targetX = t.x;
            unit.targetY = t.y;
        }
    });

    requestAnimationFrame(render);
})();`;

DEMO_CODE_TS.iso_unitDemo = `type Unit = { cx: number; cy: number; targetX: number; targetY: number; speed: number };
(function unitDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const map = buildRiverMap(10, 8);
    const tileW: number = 56, tileH: number = 28;
    const originX: number = canvas.width / 2;
    const originY: number = 30;

    const unit: Unit = { cx: 1, cy: 1, targetX: 1, targetY: 1, speed: 3 };

    function step(dt: number): void {
        const dx = unit.targetX - unit.cx;
        const dy = unit.targetY - unit.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.01) { unit.cx = unit.targetX; unit.cy = unit.targetY; return; }
        const s = unit.speed * dt;
        if (s >= d) { unit.cx = unit.targetX; unit.cy = unit.targetY; }
        else {
            unit.cx += (dx / d) * s;
            unit.cy += (dy / d) * s;
        }
    }

    let lastTime: number = performance.now();
    function render(now: number): void {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        step(dt);
        clearCanvas(ctx, canvas.width, canvas.height);
        drawGroundLayer(ctx, map, tileW, tileH, originX, originY);
        drawUnit(ctx, unit.cx, unit.cy, tileW, tileH, originX, originY, IM_COLORS.player);
        if (unit.targetX !== unit.cx || unit.targetY !== unit.cy) {
            const p = cartToIso(unit.targetX, unit.targetY, tileW, tileH, originX, originY);
            drawIsoTile(ctx, p.x, p.y, tileW, tileH, null, IM_COLORS.accent);
        }
        info.innerHTML = \`Unit at <strong>(\${unit.cx.toFixed(2)}, \${unit.cy.toFixed(2)})</strong>\` +
            \` → target (\${unit.targetX}, \${unit.targetY})\`;
        requestAnimationFrame(render);
    }

    canvas.addEventListener('click', (e: MouseEvent) => {
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const t = pickTileFromMouse(mx, my, originX, originY, tileW, tileH, map.width, map.height);
        if (t) {
            unit.targetX = t.x;
            unit.targetY = t.y;
        }
    });

    requestAnimationFrame(render);
})();`;

// =============================================================================
// DEMO 6 — iso_eightDirDemo
// =============================================================================
DEMO_HTML.iso_eightDirDemo = {
    title: 'Iso — 8-Direction Facing From Velocity',
    canvas: { width: 800, height: 400 },
    controls: [],
    info: 'Drag the arrow head — the wheel shows the chosen facing.'
};

DEMO_CODE.iso_eightDirDemo = `(function eightDirDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    let head = { x: center.x + 120, y: center.y - 60 };
    let dragging = false;

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        ctx.strokeStyle = '#2a3550';
        ctx.lineWidth = 1;
        const RADIUS = 160;
        ctx.beginPath();
        ctx.arc(center.x, center.y, RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x + Math.cos(a) * RADIUS, center.y + Math.sin(a) * RADIUS);
            ctx.stroke();
        }
        const labels = [
            { dir: 'E',  a: 0 },
            { dir: 'SE', a: Math.PI / 4 },
            { dir: 'S',  a: Math.PI / 2 },
            { dir: 'SW', a: 3 * Math.PI / 4 },
            { dir: 'W',  a: Math.PI },
            { dir: 'NW', a: -3 * Math.PI / 4 },
            { dir: 'N',  a: -Math.PI / 2 },
            { dir: 'NE', a: -Math.PI / 4 }
        ];
        const dir = facingFromVelocity(head.x - center.x, head.y - center.y);
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        labels.forEach(({ dir: d, a }) => {
            const lx = center.x + Math.cos(a) * (RADIUS + 22);
            const ly = center.y + Math.sin(a) * (RADIUS + 22) + 6;
            ctx.fillStyle = (d === dir) ? IM_COLORS.accent : IM_COLORS.muted;
            ctx.fillText(d, lx, ly);
        });
        ctx.textAlign = 'start';
        ctx.strokeStyle = IM_COLORS.player;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();
        const ang = Math.atan2(head.y - center.y, head.x - center.x);
        ctx.fillStyle = IM_COLORS.player;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(head.x - 12 * Math.cos(ang - Math.PI / 6), head.y - 12 * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(head.x - 12 * Math.cos(ang + Math.PI / 6), head.y - 12 * Math.sin(ang + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = IM_COLORS.accent;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
        ctx.fill();

        info.innerHTML = \`Velocity (\${(head.x - center.x).toFixed(0)}, \${(head.y - center.y).toFixed(0)}) → facing <strong>\${dir || '(zero vector)'}</strong>\`;
    }

    function getMouseLocal(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('mousedown', (e) => {
        const m = getMouseLocal(e);
        const d = Math.hypot(m.x - head.x, m.y - head.y);
        if (d < 20) dragging = true;
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        head = getMouseLocal(e);
        render();
    });
    canvas.addEventListener('mouseup',   () => { dragging = false; });
    canvas.addEventListener('mouseleave', () => { dragging = false; });

    render();
})();`;

DEMO_CODE_TS.iso_eightDirDemo = `type Pt = { x: number; y: number };
(function eightDirDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const center: Pt = { x: canvas.width / 2, y: canvas.height / 2 };
    let head: Pt = { x: center.x + 120, y: center.y - 60 };
    let dragging: boolean = false;

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        ctx.strokeStyle = '#2a3550';
        ctx.lineWidth = 1;
        const RADIUS = 160;
        ctx.beginPath();
        ctx.arc(center.x, center.y, RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x + Math.cos(a) * RADIUS, center.y + Math.sin(a) * RADIUS);
            ctx.stroke();
        }
        const labels: Array<{ dir: string; a: number }> = [
            { dir: 'E',  a: 0 },
            { dir: 'SE', a: Math.PI / 4 },
            { dir: 'S',  a: Math.PI / 2 },
            { dir: 'SW', a: 3 * Math.PI / 4 },
            { dir: 'W',  a: Math.PI },
            { dir: 'NW', a: -3 * Math.PI / 4 },
            { dir: 'N',  a: -Math.PI / 2 },
            { dir: 'NE', a: -Math.PI / 4 }
        ];
        const dir = facingFromVelocity(head.x - center.x, head.y - center.y);
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        labels.forEach(({ dir: d, a }) => {
            const lx = center.x + Math.cos(a) * (RADIUS + 22);
            const ly = center.y + Math.sin(a) * (RADIUS + 22) + 6;
            ctx.fillStyle = (d === dir) ? IM_COLORS.accent : IM_COLORS.muted;
            ctx.fillText(d, lx, ly);
        });
        ctx.textAlign = 'start';
        ctx.strokeStyle = IM_COLORS.player;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();
        const ang = Math.atan2(head.y - center.y, head.x - center.x);
        ctx.fillStyle = IM_COLORS.player;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(head.x - 12 * Math.cos(ang - Math.PI / 6), head.y - 12 * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(head.x - 12 * Math.cos(ang + Math.PI / 6), head.y - 12 * Math.sin(ang + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = IM_COLORS.accent;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
        ctx.fill();

        info.innerHTML = \`Velocity (\${(head.x - center.x).toFixed(0)}, \${(head.y - center.y).toFixed(0)}) → facing <strong>\${dir || '(zero vector)'}</strong>\`;
    }

    function getMouseLocal(e: MouseEvent): Pt {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
        const m = getMouseLocal(e);
        const d = Math.hypot(m.x - head.x, m.y - head.y);
        if (d < 20) dragging = true;
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragging) return;
        head = getMouseLocal(e);
        render();
    });
    canvas.addEventListener('mouseup',   () => { dragging = false; });
    canvas.addEventListener('mouseleave', () => { dragging = false; });

    render();
})();`;

// =============================================================================
// DEMO 7 — iso_walkerDemo (injects slider DOM since scaffold only renders buttons)
// =============================================================================
DEMO_HTML.iso_walkerDemo = {
    title: 'Iso — AnimationClip Playback (Sprite-Frame Cycling)',
    canvas: { width: 800, height: 320 },
    controls: [
        { id: 'btnWalkerPlay',  text: '⏸ Pause' },
        { id: 'btnWalkerStep',  text: 'Step frame' },
        { id: 'btnWalkerReset', text: 'Reset' }
    ],
    info: 'Sliders for FPS + scrub are added by the demo body.'
};

DEMO_CODE.iso_walkerDemo = `(function walkerDemo() {
    // Inject FPS + scrub sliders into the existing .controls bar so the rest
    // of the IIFE can look them up by id like the original page does.
    const controlsBar = document.querySelector('.controls');
    if (controlsBar) {
        controlsBar.insertAdjacentHTML('beforeend',
            '<label style="color:#e0e0e0;margin-left:8px">fps ' +
            '<input id="walkerFps" type="range" min="1" max="24" value="8" style="vertical-align:middle"> ' +
            '<span id="walkerFpsVal">8</span></label>' +
            '<label style="color:#e0e0e0;margin-left:8px">scrub ' +
            '<input id="walkerScrub" type="range" min="0" max="5" value="0" style="vertical-align:middle"> ' +
            '<span id="walkerScrubVal">0</span></label>'
        );
    }

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const clip = makeClip(WALK_FRAMES, 8, true);
    let playing = true;
    let lastT = performance.now();

    const fpsEl = document.getElementById('walkerFps');
    const fpsVal = document.getElementById('walkerFpsVal');
    const scrubEl = document.getElementById('walkerScrub');
    const scrubVal = document.getElementById('walkerScrubVal');

    fpsEl?.addEventListener('input', () => {
        clip.fps = parseInt(fpsEl.value, 10);
        fpsVal.textContent = String(clip.fps);
    });
    scrubEl?.addEventListener('input', () => {
        const idx = parseInt(scrubEl.value, 10);
        scrubVal.textContent = String(idx);
        clip.time = idx / clip.fps;
        if (playing) {
            playing = false;
            document.getElementById('btnWalkerPlay').textContent = '▶ Play';
            document.getElementById('btnWalkerPlay').classList.remove('active');
        }
    });

    document.getElementById('btnWalkerPlay')?.addEventListener('click', (e) => {
        playing = !playing;
        e.target.textContent = playing ? '⏸ Pause' : '▶ Play';
        e.target.classList.toggle('active', playing);
    });
    document.getElementById('btnWalkerStep')?.addEventListener('click', () => {
        clip.time = ((Math.floor(clip.time * clip.fps) + 1) % clip.frames.length) / clip.fps;
        if (playing) {
            playing = false;
            document.getElementById('btnWalkerPlay').textContent = '▶ Play';
            document.getElementById('btnWalkerPlay').classList.remove('active');
        }
    });
    document.getElementById('btnWalkerReset')?.addEventListener('click', () => {
        clipReset(clip);
        if (scrubEl) scrubEl.value = '0';
        if (scrubVal) scrubVal.textContent = '0';
    });

    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        if (playing) clipUpdate(clip, dt);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        ctx.strokeStyle = IM_COLORS.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(40, 240); ctx.lineTo(canvas.width - 40, 240);
        ctx.stroke();
        ctx.setLineDash([]);

        const cf = clipFrame(clip);
        drawWalker(ctx, canvas.width / 2, 240, cf.data, IM_COLORS.player);

        const stripY = 280;
        const stripPadX = 60;
        const stripGap = (canvas.width - stripPadX * 2) / (WALK_FRAMES.length - 1);
        for (let i = 0; i < WALK_FRAMES.length; i++) {
            const fx = stripPadX + i * stripGap;
            if (i === cf.idx) {
                ctx.fillStyle = 'rgba(255, 167, 38, 0.18)';
                ctx.fillRect(fx - 28, stripY - 30, 56, 38);
                ctx.strokeStyle = '#ffa726';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(fx - 28, stripY - 30, 56, 38);
            }
            ctx.save();
            ctx.translate(fx, stripY + 4);
            ctx.scale(0.4, 0.4);
            drawWalker(ctx, 0, 0, WALK_FRAMES[i], i === cf.idx ? IM_COLORS.accent : IM_COLORS.muted);
            ctx.restore();
            ctx.fillStyle = i === cf.idx ? '#ffa726' : IM_COLORS.muted;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(i), fx, stripY + 30);
            ctx.textAlign = 'start';
        }
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(\`time \${clip.time.toFixed(2)}s · frame \${cf.idx} / \${WALK_FRAMES.length - 1} · fps \${clip.fps}\`, 14, 20);
        info.innerHTML = \`Frame <strong>\${cf.idx}</strong> of \${WALK_FRAMES.length}. \` +
            (playing ? 'Playing.' : 'Paused — use Step or the scrubber.');
    }

    requestAnimationFrame(frame);
})();`;

// TS variant: same body, with the relevant casts/types added.
DEMO_CODE_TS.iso_walkerDemo = `(function walkerDemo(): void {
    const controlsBar = document.querySelector('.controls') as HTMLDivElement | null;
    if (controlsBar) {
        controlsBar.insertAdjacentHTML('beforeend',
            '<label style="color:#e0e0e0;margin-left:8px">fps ' +
            '<input id="walkerFps" type="range" min="1" max="24" value="8" style="vertical-align:middle"> ' +
            '<span id="walkerFpsVal">8</span></label>' +
            '<label style="color:#e0e0e0;margin-left:8px">scrub ' +
            '<input id="walkerScrub" type="range" min="0" max="5" value="0" style="vertical-align:middle"> ' +
            '<span id="walkerScrubVal">0</span></label>'
        );
    }

    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const clip = makeClip(WALK_FRAMES, 8, true);
    let playing: boolean = true;
    let lastT: number = performance.now();

    const fpsEl = document.getElementById('walkerFps') as HTMLInputElement | null;
    const fpsVal = document.getElementById('walkerFpsVal') as HTMLSpanElement | null;
    const scrubEl = document.getElementById('walkerScrub') as HTMLInputElement | null;
    const scrubVal = document.getElementById('walkerScrubVal') as HTMLSpanElement | null;

    fpsEl?.addEventListener('input', () => {
        clip.fps = parseInt(fpsEl!.value, 10);
        if (fpsVal) fpsVal.textContent = String(clip.fps);
    });
    scrubEl?.addEventListener('input', () => {
        const idx = parseInt(scrubEl!.value, 10);
        if (scrubVal) scrubVal.textContent = String(idx);
        clip.time = idx / clip.fps;
        if (playing) {
            playing = false;
            (document.getElementById('btnWalkerPlay') as HTMLButtonElement).textContent = '▶ Play';
            (document.getElementById('btnWalkerPlay') as HTMLButtonElement).classList.remove('active');
        }
    });

    document.getElementById('btnWalkerPlay')?.addEventListener('click', (e: Event) => {
        playing = !playing;
        (e.target as HTMLButtonElement).textContent = playing ? '⏸ Pause' : '▶ Play';
        (e.target as HTMLButtonElement).classList.toggle('active', playing);
    });
    document.getElementById('btnWalkerStep')?.addEventListener('click', () => {
        clip.time = ((Math.floor(clip.time * clip.fps) + 1) % clip.frames.length) / clip.fps;
        if (playing) {
            playing = false;
            (document.getElementById('btnWalkerPlay') as HTMLButtonElement).textContent = '▶ Play';
            (document.getElementById('btnWalkerPlay') as HTMLButtonElement).classList.remove('active');
        }
    });
    document.getElementById('btnWalkerReset')?.addEventListener('click', () => {
        clipReset(clip);
        if (scrubEl) scrubEl.value = '0';
        if (scrubVal) scrubVal.textContent = '0';
    });

    function frame(now: number): void {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        if (playing) clipUpdate(clip, dt);
        render();
        requestAnimationFrame(frame);
    }

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        ctx.strokeStyle = IM_COLORS.muted;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(40, 240); ctx.lineTo(canvas.width - 40, 240);
        ctx.stroke();
        ctx.setLineDash([]);

        const cf = clipFrame(clip);
        drawWalker(ctx, canvas.width / 2, 240, cf.data, IM_COLORS.player);

        const stripY = 280;
        const stripPadX = 60;
        const stripGap = (canvas.width - stripPadX * 2) / (WALK_FRAMES.length - 1);
        for (let i = 0; i < WALK_FRAMES.length; i++) {
            const fx = stripPadX + i * stripGap;
            if (i === cf.idx) {
                ctx.fillStyle = 'rgba(255, 167, 38, 0.18)';
                ctx.fillRect(fx - 28, stripY - 30, 56, 38);
                ctx.strokeStyle = '#ffa726';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(fx - 28, stripY - 30, 56, 38);
            }
            ctx.save();
            ctx.translate(fx, stripY + 4);
            ctx.scale(0.4, 0.4);
            drawWalker(ctx, 0, 0, WALK_FRAMES[i], i === cf.idx ? IM_COLORS.accent : IM_COLORS.muted);
            ctx.restore();
            ctx.fillStyle = i === cf.idx ? '#ffa726' : IM_COLORS.muted;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(i), fx, stripY + 30);
            ctx.textAlign = 'start';
        }
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(\`time \${clip.time.toFixed(2)}s · frame \${cf.idx} / \${WALK_FRAMES.length - 1} · fps \${clip.fps}\`, 14, 20);
        info.innerHTML = \`Frame <strong>\${cf.idx}</strong> of \${WALK_FRAMES.length}. \` +
            (playing ? 'Playing.' : 'Paused — use Step or the scrubber.');
    }

    requestAnimationFrame(frame);
})();`;

// =============================================================================
// DEMO 8 — iso_stateMachineDemo
// =============================================================================
DEMO_HTML.iso_stateMachineDemo = {
    title: 'Iso — Animation State Machine With Frame Events',
    canvas: { width: 800, height: 340 },
    controls: [
        { id: 'btnSMIdle',   text: 'Idle' },
        { id: 'btnSMWalk',   text: 'Walk' },
        { id: 'btnSMAttack', text: 'Attack' },
        { id: 'btnSMDeath',  text: 'Death' },
        { id: 'btnSMReset',  text: 'Reset' }
    ],
    info: 'Frame events fire on the attack swing.'
};

DEMO_CODE.iso_stateMachineDemo = `(function stateMachineDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const sm = {
        clips: {
            idle:   makeClip(IDLE_FRAMES,   3, true),
            walk:   makeClip(WALK_FRAMES,   8, true),
            attack: makeClip(ATTACK_FRAMES, 6, false),
            death:  makeClip(DEATH_FRAMES,  4, false)
        },
        events: {
            attack: [{ frame: 1, kind: 'damage' }]
        },
        state: 'idle',
        lastFrameIdx: -1
    };
    let damageEventCount = 0;
    let lastDamagePulse = 0;

    function transition(newState) {
        if (sm.state === newState) return;
        sm.state = newState;
        clipReset(sm.clips[newState]);
        sm.lastFrameIdx = -1;
        ['btnSMIdle', 'btnSMWalk', 'btnSMAttack', 'btnSMDeath'].forEach((id, i) => {
            const states = ['idle', 'walk', 'attack', 'death'];
            document.getElementById(id)?.classList.toggle('active', states[i] === newState);
        });
    }

    function update(dt) {
        const clip = sm.clips[sm.state];
        clipUpdate(clip, dt);
        const idx = Math.floor(clip.time * clip.fps);
        if (idx !== sm.lastFrameIdx) {
            const evs = sm.events[sm.state] || [];
            for (const e of evs) {
                if (e.frame === idx) {
                    if (e.kind === 'damage') {
                        damageEventCount++;
                        lastDamagePulse = performance.now();
                    }
                }
            }
            sm.lastFrameIdx = idx;
        }
        if (clip.done && sm.state === 'attack') transition('idle');
    }

    let lastT = performance.now();
    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        update(dt);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        ctx.strokeStyle = IM_COLORS.muted;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(40, 240); ctx.lineTo(canvas.width - 40, 240);
        ctx.stroke();
        ctx.setLineDash([]);

        const cf = clipFrame(sm.clips[sm.state]);
        const color = sm.state === 'death' ? '#9e9e9e' : IM_COLORS.player;
        drawWalker(ctx, canvas.width / 2, 240, cf.data, color);

        const elapsedSincePulse = (performance.now() - lastDamagePulse) / 1000;
        if (elapsedSincePulse < 0.5) {
            const a = 1 - elapsedSincePulse / 0.5;
            ctx.fillStyle = \`rgba(239, 83, 80, \${a})\`;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💥 DAMAGE', canvas.width / 2 + 90, 100);
            ctx.textAlign = 'start';
        }

        ctx.fillStyle = 'rgba(13, 17, 23, 0.78)';
        ctx.fillRect(8, 8, 300, 86);
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(\`state: \${sm.state}\`, 18, 28);
        const clip = sm.clips[sm.state];
        ctx.fillText(\`frame \${cf.idx} / \${clip.frames.length - 1} · fps \${clip.fps}\`, 18, 48);
        ctx.fillText(\`damage events fired: \${damageEventCount}\`, 18, 68);
        ctx.fillStyle = IM_COLORS.muted;
        ctx.font = '11px sans-serif';
        ctx.fillText(sm.state === 'attack'
            ? 'Damage fires on frame 1 (the swing-down). Edge-detected → exactly once.'
            : (sm.state === 'death' ? 'Death does not loop. Reset to revive.' : 'Click a state above.'),
            18, 88);

        info.innerHTML = \`State: <strong>\${sm.state}</strong> · frame \${cf.idx} · damage events fired so far: <strong>\${damageEventCount}</strong>\`;
    }

    document.getElementById('btnSMIdle')?.addEventListener('click',   () => transition('idle'));
    document.getElementById('btnSMWalk')?.addEventListener('click',   () => transition('walk'));
    document.getElementById('btnSMAttack')?.addEventListener('click', () => transition('attack'));
    document.getElementById('btnSMDeath')?.addEventListener('click',  () => transition('death'));
    document.getElementById('btnSMReset')?.addEventListener('click',  () => {
        damageEventCount = 0;
        for (const k in sm.clips) clipReset(sm.clips[k]);
        transition('idle');
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_stateMachineDemo = `type SMState = 'idle' | 'walk' | 'attack' | 'death';
(function stateMachineDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const sm: {
        clips: Record<SMState, AnimClip>;
        events: Partial<Record<SMState, Array<{ frame: number; kind: string }>>>;
        state: SMState;
        lastFrameIdx: number;
    } = {
        clips: {
            idle:   makeClip(IDLE_FRAMES,   3, true),
            walk:   makeClip(WALK_FRAMES,   8, true),
            attack: makeClip(ATTACK_FRAMES, 6, false),
            death:  makeClip(DEATH_FRAMES,  4, false)
        },
        events: {
            attack: [{ frame: 1, kind: 'damage' }]
        },
        state: 'idle',
        lastFrameIdx: -1
    };
    let damageEventCount: number = 0;
    let lastDamagePulse: number = 0;

    function transition(newState: SMState): void {
        if (sm.state === newState) return;
        sm.state = newState;
        clipReset(sm.clips[newState]);
        sm.lastFrameIdx = -1;
        ['btnSMIdle', 'btnSMWalk', 'btnSMAttack', 'btnSMDeath'].forEach((id, i) => {
            const states: SMState[] = ['idle', 'walk', 'attack', 'death'];
            document.getElementById(id)?.classList.toggle('active', states[i] === newState);
        });
    }

    function update(dt: number): void {
        const clip = sm.clips[sm.state];
        clipUpdate(clip, dt);
        const idx = Math.floor(clip.time * clip.fps);
        if (idx !== sm.lastFrameIdx) {
            const evs = sm.events[sm.state] || [];
            for (const e of evs) {
                if (e.frame === idx) {
                    if (e.kind === 'damage') {
                        damageEventCount++;
                        lastDamagePulse = performance.now();
                    }
                }
            }
            sm.lastFrameIdx = idx;
        }
        if (clip.done && sm.state === 'attack') transition('idle');
    }

    let lastT: number = performance.now();
    function frame(now: number): void {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        update(dt);
        render();
        requestAnimationFrame(frame);
    }

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        ctx.strokeStyle = IM_COLORS.muted;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(40, 240); ctx.lineTo(canvas.width - 40, 240);
        ctx.stroke();
        ctx.setLineDash([]);

        const cf = clipFrame(sm.clips[sm.state]);
        const color: string = sm.state === 'death' ? '#9e9e9e' : IM_COLORS.player;
        drawWalker(ctx, canvas.width / 2, 240, cf.data, color);

        const elapsedSincePulse = (performance.now() - lastDamagePulse) / 1000;
        if (elapsedSincePulse < 0.5) {
            const a = 1 - elapsedSincePulse / 0.5;
            ctx.fillStyle = \`rgba(239, 83, 80, \${a})\`;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💥 DAMAGE', canvas.width / 2 + 90, 100);
            ctx.textAlign = 'start';
        }

        ctx.fillStyle = 'rgba(13, 17, 23, 0.78)';
        ctx.fillRect(8, 8, 300, 86);
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(\`state: \${sm.state}\`, 18, 28);
        const clip = sm.clips[sm.state];
        ctx.fillText(\`frame \${cf.idx} / \${clip.frames.length - 1} · fps \${clip.fps}\`, 18, 48);
        ctx.fillText(\`damage events fired: \${damageEventCount}\`, 18, 68);
        ctx.fillStyle = IM_COLORS.muted;
        ctx.font = '11px sans-serif';
        ctx.fillText(sm.state === 'attack'
            ? 'Damage fires on frame 1 (the swing-down). Edge-detected → exactly once.'
            : (sm.state === 'death' ? 'Death does not loop. Reset to revive.' : 'Click a state above.'),
            18, 88);

        info.innerHTML = \`State: <strong>\${sm.state}</strong> · frame \${cf.idx} · damage events fired so far: <strong>\${damageEventCount}</strong>\`;
    }

    document.getElementById('btnSMIdle')?.addEventListener('click',   () => transition('idle'));
    document.getElementById('btnSMWalk')?.addEventListener('click',   () => transition('walk'));
    document.getElementById('btnSMAttack')?.addEventListener('click', () => transition('attack'));
    document.getElementById('btnSMDeath')?.addEventListener('click',  () => transition('death'));
    document.getElementById('btnSMReset')?.addEventListener('click',  () => {
        damageEventCount = 0;
        for (const k in sm.clips) clipReset(sm.clips[k as SMState]);
        transition('idle');
    });

    requestAnimationFrame(frame);
})();`;

// =============================================================================
// DEMO 9 — iso_easingDemo
// =============================================================================
DEMO_HTML.iso_easingDemo = {
    title: 'Iso — Easing Curves',
    canvas: { width: 800, height: 320 },
    controls: [
        { id: 'btnEasingRestart', text: 'Restart' },
        { id: 'btnEasingSlower',  text: 'Slower' },
        { id: 'btnEasingFaster',  text: 'Faster' }
    ],
    info: 'Four easing curves side-by-side.'
};

DEMO_CODE.iso_easingDemo = `(function easingDemo() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const ease = {
        linear:        (t) => t,
        easeInCubic:   (t) => t * t * t,
        easeOutCubic:  (t) => 1 - Math.pow(1 - t, 3),
        easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    };
    const easingNames = ['linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic'];

    let duration = 1.5;
    let elapsed = 0;
    let lastT = performance.now();

    function frame(now) {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        elapsed += dt;
        if (elapsed >= duration + 0.5) elapsed = 0;
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const panelW = canvas.width / 4;
        const panelH = canvas.height;
        const trackY = 110;
        const trackPad = 30;
        const trackLen = panelW - trackPad * 2;
        const t = Math.min(1, elapsed / duration);

        for (let i = 0; i < 4; i++) {
            const px = i * panelW;
            const name = easingNames[i];
            if (i > 0) {
                ctx.strokeStyle = IM_COLORS.outline;
                ctx.beginPath();
                ctx.moveTo(px, 16); ctx.lineTo(px, panelH - 16); ctx.stroke();
            }
            ctx.fillStyle = IM_COLORS.label;
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(name, px + panelW / 2, 28);
            ctx.textAlign = 'start';

            ctx.strokeStyle = IM_COLORS.muted;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + trackPad, trackY); ctx.lineTo(px + trackPad + trackLen, trackY); ctx.stroke();
            ctx.fillStyle = IM_COLORS.muted;
            ctx.beginPath(); ctx.arc(px + trackPad, trackY, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + trackPad + trackLen, trackY, 4, 0, Math.PI * 2); ctx.fill();

            const easedT = ease[name](t);
            const dotX = px + trackPad + trackLen * easedT;
            ctx.fillStyle = IM_COLORS.accent;
            ctx.beginPath(); ctx.arc(dotX, trackY, 8, 0, Math.PI * 2); ctx.fill();

            const plotX = px + trackPad;
            const plotY = trackY + 30;
            const plotW = trackLen;
            const plotH = 90;
            ctx.strokeStyle = IM_COLORS.outline;
            ctx.strokeRect(plotX, plotY, plotW, plotH);
            ctx.strokeStyle = 'rgba(158, 158, 158, 0.3)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(plotX, plotY + plotH); ctx.lineTo(plotX + plotW, plotY); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = IM_COLORS.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let xs = 0; xs <= plotW; xs += 2) {
                const tt = xs / plotW;
                const ee = ease[name](tt);
                const y = plotY + plotH - ee * plotH;
                if (xs === 0) ctx.moveTo(plotX + xs, y); else ctx.lineTo(plotX + xs, y);
            }
            ctx.stroke();
            const phX = plotX + t * plotW;
            const phY = plotY + plotH - easedT * plotH;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(phX, phY, 3, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = IM_COLORS.muted;
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(\`t=\${t.toFixed(2)}  →  \${easedT.toFixed(2)}\`, px + panelW / 2, plotY + plotH + 16);
            ctx.textAlign = 'start';
        }
        info.innerHTML = \`t = <strong>\${t.toFixed(2)}</strong> · duration <strong>\${duration.toFixed(1)}s</strong>. \` +
            \`Linear holds constant speed; the cubics accelerate/decelerate at the edges.\`;
    }

    document.getElementById('btnEasingRestart')?.addEventListener('click', () => { elapsed = 0; });
    document.getElementById('btnEasingSlower')?.addEventListener('click',  () => { duration = Math.min(4, duration + 0.5); elapsed = 0; });
    document.getElementById('btnEasingFaster')?.addEventListener('click',  () => { duration = Math.max(0.5, duration - 0.5); elapsed = 0; });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_easingDemo = `type EaseFn = (t: number) => number;
type EaseName = 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic';
(function easingDemo(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const ease: Record<EaseName, EaseFn> = {
        linear:         (t) => t,
        easeInCubic:    (t) => t * t * t,
        easeOutCubic:   (t) => 1 - Math.pow(1 - t, 3),
        easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    };
    const easingNames: EaseName[] = ['linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic'];

    let duration: number = 1.5;
    let elapsed: number = 0;
    let lastT: number = performance.now();

    function frame(now: number): void {
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        elapsed += dt;
        if (elapsed >= duration + 0.5) elapsed = 0;
        render();
        requestAnimationFrame(frame);
    }

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        const panelW = canvas.width / 4;
        const panelH = canvas.height;
        const trackY = 110;
        const trackPad = 30;
        const trackLen = panelW - trackPad * 2;
        const t = Math.min(1, elapsed / duration);

        for (let i = 0; i < 4; i++) {
            const px = i * panelW;
            const name = easingNames[i];
            if (i > 0) {
                ctx.strokeStyle = IM_COLORS.outline;
                ctx.beginPath();
                ctx.moveTo(px, 16); ctx.lineTo(px, panelH - 16); ctx.stroke();
            }
            ctx.fillStyle = IM_COLORS.label;
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(name, px + panelW / 2, 28);
            ctx.textAlign = 'start';

            ctx.strokeStyle = IM_COLORS.muted;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + trackPad, trackY); ctx.lineTo(px + trackPad + trackLen, trackY); ctx.stroke();
            ctx.fillStyle = IM_COLORS.muted;
            ctx.beginPath(); ctx.arc(px + trackPad, trackY, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(px + trackPad + trackLen, trackY, 4, 0, Math.PI * 2); ctx.fill();

            const easedT = ease[name](t);
            const dotX = px + trackPad + trackLen * easedT;
            ctx.fillStyle = IM_COLORS.accent;
            ctx.beginPath(); ctx.arc(dotX, trackY, 8, 0, Math.PI * 2); ctx.fill();

            const plotX = px + trackPad;
            const plotY = trackY + 30;
            const plotW = trackLen;
            const plotH = 90;
            ctx.strokeStyle = IM_COLORS.outline;
            ctx.strokeRect(plotX, plotY, plotW, plotH);
            ctx.strokeStyle = 'rgba(158, 158, 158, 0.3)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(plotX, plotY + plotH); ctx.lineTo(plotX + plotW, plotY); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = IM_COLORS.accent;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let xs = 0; xs <= plotW; xs += 2) {
                const tt = xs / plotW;
                const ee = ease[name](tt);
                const y = plotY + plotH - ee * plotH;
                if (xs === 0) ctx.moveTo(plotX + xs, y); else ctx.lineTo(plotX + xs, y);
            }
            ctx.stroke();
            const phX = plotX + t * plotW;
            const phY = plotY + plotH - easedT * plotH;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(phX, phY, 3, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = IM_COLORS.muted;
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(\`t=\${t.toFixed(2)}  →  \${easedT.toFixed(2)}\`, px + panelW / 2, plotY + plotH + 16);
            ctx.textAlign = 'start';
        }
        info.innerHTML = \`t = <strong>\${t.toFixed(2)}</strong> · duration <strong>\${duration.toFixed(1)}s</strong>. \` +
            \`Linear holds constant speed; the cubics accelerate/decelerate at the edges.\`;
    }

    document.getElementById('btnEasingRestart')?.addEventListener('click', () => { elapsed = 0; });
    document.getElementById('btnEasingSlower')?.addEventListener('click',  () => { duration = Math.min(4, duration + 0.5); elapsed = 0; });
    document.getElementById('btnEasingFaster')?.addEventListener('click',  () => { duration = Math.max(0.5, duration - 0.5); elapsed = 0; });

    requestAnimationFrame(frame);
})();`;

// =============================================================================
// DEMO 10 — iso_miniProject (tabindex injected at startup; integrates everything)
// =============================================================================
DEMO_HTML.iso_miniProject = {
    title: 'Iso — Mini-Project: Click-to-Walk (Full Integration)',
    canvas: { width: 800, height: 500 },
    controls: [
        { id: 'btnMiniReset',    text: 'Reset' },
        { id: 'btnMiniHidePath', text: 'Hide debug path' }
    ],
    info: 'Click a tile to walk there. Drag to pan, scroll to zoom.'
};

DEMO_CODE.iso_miniProject = `(function miniProject() {
    const canvas = document.getElementById('canvas');
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
    const ctx = canvas.getContext('2d');
    const info = document.getElementById('info');

    const map = buildRiverMap(12, 10);
    const decos = [
        { cx: 0, cy: 0 }, { cx: 8, cy: 1 }, { cx: 3, cy: 2 },
        { cx: 10, cy: 3 }, { cx: 1, cy: 8 }, { cx: 9, cy: 9 },
        { cx: 7, cy: 8 }
    ].filter(d => map.tiles[d.cy][d.cx] === 'grass');

    const BASE_W = 56, BASE_H = 28;
    const camera = { originX: canvas.width / 2, originY: 50, zoom: 1 };
    const unit = { cx: 1, cy: 1, targetX: 1, targetY: 1, lastTX: 1, lastTY: 1, speed: 3, facing: null };
    let drag = null;
    let showDebugPath = true;

    function effW() { return BASE_W * camera.zoom; }
    function effH() { return BASE_H * camera.zoom; }

    function step(dt) {
        const dx = unit.targetX - unit.cx;
        const dy = unit.targetY - unit.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.01) {
            unit.cx = unit.targetX;
            unit.cy = unit.targetY;
            unit.facing = null;
            return;
        }
        const s = unit.speed * dt;
        let vx, vy;
        if (s >= d) {
            vx = dx; vy = dy;
            unit.cx = unit.targetX;
            unit.cy = unit.targetY;
        } else {
            vx = (dx / d) * s;
            vy = (dy / d) * s;
            unit.cx += vx;
            unit.cy += vy;
        }
        unit.facing = facingFromVelocity(vx, vy);
    }

    let lastTime = performance.now();
    function frame(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        step(dt);
        render();
        requestAnimationFrame(frame);
    }

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height);
        const tW = effW(), tH = effH();
        drawGroundLayer(ctx, map, tW, tH, camera.originX, camera.originY);
        const drawList = decos.map(d => ({ kind: 'tree', cx: d.cx, cy: d.cy }));
        drawList.push({ kind: 'unit', cx: unit.cx, cy: unit.cy });
        drawList.sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
        for (const it of drawList) {
            if (it.kind === 'tree') drawTree(ctx, it.cx, it.cy, tW, tH, camera.originX, camera.originY);
            else drawUnit(ctx, it.cx, it.cy, tW, tH, camera.originX, camera.originY, IM_COLORS.player, unit.facing);
        }
        if (showDebugPath && (unit.cx !== unit.targetX || unit.cy !== unit.targetY)) {
            const p = cartToIso(unit.targetX, unit.targetY, tW, tH, camera.originX, camera.originY);
            drawIsoTile(ctx, p.x, p.y, tW, tH, null, IM_COLORS.accent);
        }
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(
            \`unit (\${unit.cx.toFixed(2)}, \${unit.cy.toFixed(2)})  →  target (\${unit.targetX}, \${unit.targetY})  zoom \${camera.zoom.toFixed(2)}\`,
            10, canvas.height - 12
        );
    }

    function getMouseLocal(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    canvas.addEventListener('mousedown', (e) => {
        drag = { x: e.clientX, y: e.clientY, ox: camera.originX, oy: camera.originY, moved: false };
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!drag) return;
        const ddx = e.clientX - drag.x;
        const ddy = e.clientY - drag.y;
        if (Math.abs(ddx) > 2 || Math.abs(ddy) > 2) drag.moved = true;
        camera.originX = drag.ox + ddx;
        camera.originY = drag.oy + ddy;
    });
    canvas.addEventListener('mouseup', (e) => {
        if (drag && !drag.moved) {
            const m = getMouseLocal(e);
            const t = pickTileFromMouse(m.x, m.y, camera.originX, camera.originY, effW(), effH(), map.width, map.height);
            if (t) {
                unit.targetX = t.x;
                unit.targetY = t.y;
                info.innerHTML = \`Walking to tile <strong>(\${t.x}, \${t.y})</strong>\` +
                    (!isWalkable(map, t.x, t.y) ? ' — (no pathfinding yet, will walk through water).' : '.');
            }
        }
        drag = null;
    });
    canvas.addEventListener('mouseleave', () => { drag = null; });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const m = getMouseLocal(e);
        const prevZoom = camera.zoom;
        const next = clamp(prevZoom * (e.deltaY < 0 ? 1.1 : 1/1.1), 0.5, 2.5);
        const k = next / prevZoom;
        camera.originX = m.x - (m.x - camera.originX) * k;
        camera.originY = m.y - (m.y - camera.originY) * k;
        camera.zoom = next;
    }, { passive: false });

    document.getElementById('btnMiniReset')?.addEventListener('click', () => {
        camera.originX = canvas.width / 2;
        camera.originY = 50;
        camera.zoom = 1;
        unit.cx = 1; unit.cy = 1; unit.targetX = 1; unit.targetY = 1;
        info.textContent = 'Reset. Click a tile to walk there.';
    });
    document.getElementById('btnMiniHidePath')?.addEventListener('click', (e) => {
        showDebugPath = !showDebugPath;
        e.target.textContent = showDebugPath ? 'Hide debug path' : 'Show debug path';
    });

    requestAnimationFrame(frame);
})();`;

DEMO_CODE_TS.iso_miniProject = `type Drawable2 = { kind: 'tree' | 'unit'; cx: number; cy: number };
(function miniProject(): void {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    canvas.setAttribute('tabindex', '0');
    canvas.focus();
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const info = document.getElementById('info') as HTMLDivElement;

    const map = buildRiverMap(12, 10);
    const decos: Array<{ cx: number; cy: number }> = [
        { cx: 0, cy: 0 }, { cx: 8, cy: 1 }, { cx: 3, cy: 2 },
        { cx: 10, cy: 3 }, { cx: 1, cy: 8 }, { cx: 9, cy: 9 },
        { cx: 7, cy: 8 }
    ].filter(d => map.tiles[d.cy][d.cx] === 'grass');

    const BASE_W: number = 56, BASE_H: number = 28;
    const camera = { originX: canvas.width / 2, originY: 50, zoom: 1 };
    const unit: { cx: number; cy: number; targetX: number; targetY: number; lastTX: number; lastTY: number; speed: number; facing: string | null } = {
        cx: 1, cy: 1, targetX: 1, targetY: 1, lastTX: 1, lastTY: 1, speed: 3, facing: null
    };
    let drag: { x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;
    let showDebugPath: boolean = true;

    function effW(): number { return BASE_W * camera.zoom; }
    function effH(): number { return BASE_H * camera.zoom; }

    function step(dt: number): void {
        const dx = unit.targetX - unit.cx;
        const dy = unit.targetY - unit.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.01) {
            unit.cx = unit.targetX;
            unit.cy = unit.targetY;
            unit.facing = null;
            return;
        }
        const s = unit.speed * dt;
        let vx: number, vy: number;
        if (s >= d) {
            vx = dx; vy = dy;
            unit.cx = unit.targetX;
            unit.cy = unit.targetY;
        } else {
            vx = (dx / d) * s;
            vy = (dy / d) * s;
            unit.cx += vx;
            unit.cy += vy;
        }
        unit.facing = facingFromVelocity(vx, vy);
    }

    let lastTime: number = performance.now();
    function frame(now: number): void {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        step(dt);
        render();
        requestAnimationFrame(frame);
    }

    function render(): void {
        clearCanvas(ctx, canvas.width, canvas.height);
        const tW = effW(), tH = effH();
        drawGroundLayer(ctx, map, tW, tH, camera.originX, camera.originY);
        const drawList: Drawable2[] = decos.map(d => ({ kind: 'tree' as const, cx: d.cx, cy: d.cy }));
        drawList.push({ kind: 'unit', cx: unit.cx, cy: unit.cy });
        drawList.sort((a, b) => (a.cy + a.cx) - (b.cy + b.cx));
        for (const it of drawList) {
            if (it.kind === 'tree') drawTree(ctx, it.cx, it.cy, tW, tH, camera.originX, camera.originY);
            else drawUnit(ctx, it.cx, it.cy, tW, tH, camera.originX, camera.originY, IM_COLORS.player, unit.facing);
        }
        if (showDebugPath && (unit.cx !== unit.targetX || unit.cy !== unit.targetY)) {
            const p = cartToIso(unit.targetX, unit.targetY, tW, tH, camera.originX, camera.originY);
            drawIsoTile(ctx, p.x, p.y, tW, tH, null, IM_COLORS.accent);
        }
        ctx.fillStyle = IM_COLORS.label;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(
            \`unit (\${unit.cx.toFixed(2)}, \${unit.cy.toFixed(2)})  →  target (\${unit.targetX}, \${unit.targetY})  zoom \${camera.zoom.toFixed(2)}\`,
            10, canvas.height - 12
        );
    }

    function getMouseLocal(e: MouseEvent): { x: number; y: number } {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
        drag = { x: e.clientX, y: e.clientY, ox: camera.originX, oy: camera.originY, moved: false };
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
        if (!drag) return;
        const ddx = e.clientX - drag.x;
        const ddy = e.clientY - drag.y;
        if (Math.abs(ddx) > 2 || Math.abs(ddy) > 2) drag.moved = true;
        camera.originX = drag.ox + ddx;
        camera.originY = drag.oy + ddy;
    });
    canvas.addEventListener('mouseup', (e: MouseEvent) => {
        if (drag && !drag.moved) {
            const m = getMouseLocal(e);
            const t = pickTileFromMouse(m.x, m.y, camera.originX, camera.originY, effW(), effH(), map.width, map.height);
            if (t) {
                unit.targetX = t.x;
                unit.targetY = t.y;
                info.innerHTML = \`Walking to tile <strong>(\${t.x}, \${t.y})</strong>\` +
                    (!isWalkable(map, t.x, t.y) ? ' — (no pathfinding yet, will walk through water).' : '.');
            }
        }
        drag = null;
    });
    canvas.addEventListener('mouseleave', () => { drag = null; });
    canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const m = getMouseLocal(e);
        const prevZoom = camera.zoom;
        const next = clamp(prevZoom * (e.deltaY < 0 ? 1.1 : 1/1.1), 0.5, 2.5);
        const k = next / prevZoom;
        camera.originX = m.x - (m.x - camera.originX) * k;
        camera.originY = m.y - (m.y - camera.originY) * k;
        camera.zoom = next;
    }, { passive: false });

    document.getElementById('btnMiniReset')?.addEventListener('click', () => {
        camera.originX = canvas.width / 2;
        camera.originY = 50;
        camera.zoom = 1;
        unit.cx = 1; unit.cy = 1; unit.targetX = 1; unit.targetY = 1;
        info.textContent = 'Reset. Click a tile to walk there.';
    });
    document.getElementById('btnMiniHidePath')?.addEventListener('click', (e: Event) => {
        showDebugPath = !showDebugPath;
        (e.target as HTMLButtonElement).textContent = showDebugPath ? 'Hide debug path' : 'Show debug path';
    });

    requestAnimationFrame(frame);
})();`;
