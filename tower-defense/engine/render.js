// ===================================================================
// tower-defense/engine/render.js
//
// The track's shared look + asset-free Canvas2D drawing helpers. Everything is
// pure shapes — no images — so every demo renders identically and exports clean
// (sibling to the Bullet Hell `BH` / Physics Puzzle `PZ` / Platformer `PF` kits).
//
//   • TD              — the colour palette + shared constants (TAU).
//   • tdDrawGround    — fill the play area (the "grass" towers stand on).
//   • tdDrawGrid      — faint tile lines, with optional buildable/blocked tinting
//                       and a hover-cell highlight (green = buildable, red = not).
//   • tdDrawPath      — the lane as a thick rounded stroke creeps walk along.
//   • tdDrawRange     — a translucent range ring (tower selection / hover preview).
//   • tdDrawTower     — a rounded base + a turret barrel rotated toward its target.
//   • tdDrawEnemy     — a creep disc with an HP bar and a "slowed" tint.
//   • tdDrawProjectile— a small bright shot with a white core (reads at a glance).
//   • tdDrawHUD       — a top-left lives/gold/wave readout panel.
//
// Reuses shared/utils.js where it already has the tool (`clearCanvas`, `clamp`).
// A*/flow-field overlay drawing arrives with the Advanced tier (its first
// consumer) — promote-on-need, like the rest of the engine.
//
// Names (TD / tdDraw*) are pre-checked vs shared/utils.js. No ES modules.
// ===================================================================

// --- Shared palette + constants -------------------------------------
// Deep-space dark theme to match the repo; a dark-green play area with a sandy
// lane so the TD map reads instantly, cyan accents for the player's towers, warm
// reds/oranges for the creeps so attacker vs defender is obvious.
const TD = Object.freeze({
    TAU:        Math.PI * 2,
    // background / map
    bg:         '#070a1c',      // page-side void behind the map panel
    ground:     '#0f2018',      // the buildable play area ("grass")
    groundEdge: '#1f3b2b',      // its border
    grid:       '#1b3326',      // faint tile lines
    buildable:  'rgba(124,242,200,0.10)', // hover tint: a free tile
    blockedTint:'rgba(239,83,80,0.12)',   // hover tint: can't build here
    // the lane creeps follow
    path:       '#7a6336',      // sandy lane fill
    pathEdge:   '#a9894c',      // lane border
    spawn:      '#66bb6a',      // the spawn end marker
    goal:       '#ef5350',      // the goal/leak end marker
    // towers (the player) — a small named set demos pick from by kind
    tower:      '#4fc3f7',      // default tower (cyan "hero")
    towerDk:    '#2b85b3',
    towerGun:   '#9b8cff',      // a 2nd kind (e.g. splash)
    towerSlow:  '#7CF2C8',      // a 3rd kind (e.g. slow/frost)
    towerGold:  '#ffd166',      // a 4th kind (e.g. sniper)
    // creeps (enemies) — warm so they pop against the cool map
    enemy:      '#ff5d8f',
    enemyDk:    '#b53b39',
    enemyFast:  '#ffa726',
    enemyTank:  '#ab47bc',
    slowTint:   'rgba(124,176,255,0.55)', // overlay on a slowed creep
    // projectiles
    proj:       '#ffe08a',
    projCore:   '#ffffff',
    // ranges / ui
    range:      'rgba(124,242,200,0.55)', // range-ring stroke
    rangeFill:  'rgba(124,242,200,0.08)', // range-ring fill
    text:       '#c9d1d9',
    dim:        '#6b7488',
    good:       '#66bb6a',
    warn:       '#ffa726',
    bad:        '#ef5350',
    accent:     '#4fc3f7',
});

// --- tdDrawGround ---------------------------------------------------
// Fill the map panel and stroke its border. Call FIRST. `rect` is {x,y,w,h};
// pass a TDGrid and it derives the rect from the grid extents.
function tdDrawGround(ctx, area) {
    const r = area.cols !== undefined
        ? { x: area.originX, y: area.originY, w: area.cols * area.tile, h: area.rows * area.tile }
        : area;
    ctx.fillStyle = TD.ground;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = TD.groundEdge;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}

// --- tdDrawGrid -----------------------------------------------------
// Faint tile lines over the ground. opts:
//   tintBlocked — shade permanently un-buildable (lane) cells red
//   hover       — {col,row} to highlight green (buildable) or red (not)
function tdDrawGrid(ctx, grid, opts = {}) {
    const { cols, rows, tile, originX, originY } = grid;
    // optional cell tints first (under the lines)
    if (opts.tintBlocked) {
        ctx.fillStyle = TD.blockedTint;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (grid.isBlocked(col, row)) ctx.fillRect(originX + col * tile, originY + row * tile, tile, tile);
            }
        }
    }
    // grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = TD.grid;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) { ctx.moveTo(originX + c * tile + 0.5, originY); ctx.lineTo(originX + c * tile + 0.5, originY + rows * tile); }
    for (let r = 0; r <= rows; r++) { ctx.moveTo(originX, originY + r * tile + 0.5); ctx.lineTo(originX + cols * tile, originY + r * tile + 0.5); }
    ctx.stroke();
    // hover highlight
    if (opts.hover && grid.inBounds(opts.hover.col, opts.hover.row)) {
        const ok = grid.isBuildable(opts.hover.col, opts.hover.row);
        const o = grid.cellOrigin(opts.hover.col, opts.hover.row);
        ctx.fillStyle = ok ? TD.buildable : TD.blockedTint;
        ctx.fillRect(o.x, o.y, tile, tile);
        ctx.lineWidth = 2;
        ctx.strokeStyle = ok ? TD.range : TD.bad;
        ctx.strokeRect(o.x + 1, o.y + 1, tile - 2, tile - 2);
    }
}

// --- tdDrawPath -----------------------------------------------------
// Draw the lane as a thick rounded stroke, with spawn (green) and goal (red) end
// caps. `width` defaults to ~0.8 of a tile if a grid is passed, else 22px.
function tdDrawPath(ctx, path, opts = {}) {
    const pts = path.points;
    if (pts.length < 2) return;
    const width = opts.width ?? (opts.grid ? opts.grid.tile * 0.8 : 22);

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // sandy fill, with a slightly wider darker edge underneath
    ctx.strokeStyle = TD.pathEdge;
    ctx.lineWidth = width + 4;
    strokePolyline(ctx, pts);
    ctx.strokeStyle = TD.path;
    ctx.lineWidth = width;
    strokePolyline(ctx, pts);
    ctx.restore();

    // end markers
    const a = path.start, b = path.end;
    dot(ctx, a.x, a.y, width * 0.5, TD.spawn);
    dot(ctx, b.x, b.y, width * 0.5, TD.goal);
}

function strokePolyline(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
}
function dot(ctx, x, y, r, color) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TD.TAU); ctx.fillStyle = color; ctx.fill();
}

// --- tdDrawRange ----------------------------------------------------
// A translucent range ring (selected tower / hover preview).
function tdDrawRange(ctx, x, y, range, opts = {}) {
    ctx.beginPath();
    ctx.arc(x, y, range, 0, TD.TAU);
    ctx.fillStyle = opts.fill || TD.rangeFill;
    ctx.fill();
    ctx.lineWidth = opts.lineWidth || 1.5;
    ctx.strokeStyle = opts.stroke || TD.range;
    ctx.stroke();
}

// --- tdDrawTower ----------------------------------------------------
// A rounded base + a turret barrel rotated to `tower.angle` (radians; the heading
// toward its current target). tower: { x, y, angle?, color?, radius?, kind? }.
function tdDrawTower(ctx, tower) {
    const x = tower.x, y = tower.y;
    const r = tower.radius ?? 13;
    const color = tower.color || TD.tower;

    // base — a soft rounded square
    ctx.save();
    ctx.translate(x, y);
    roundRect(ctx, -r, -r, r * 2, r * 2, 5);
    ctx.fillStyle = '#16263a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();

    // turret — a barrel pointing at the target (angle), plus a hub
    ctx.rotate(tower.angle ?? -Math.PI / 2);
    ctx.fillStyle = color;
    roundRect(ctx, -2.5, -2.5, r + 6, 5, 2.5);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, TD.TAU);
    ctx.fillStyle = color;
    ctx.fill();
}

// --- tdDrawEnemy ----------------------------------------------------
// A creep disc with an HP bar above it and a frost tint when slowed.
// enemy: { x, y, radius?, hp?, maxHp?, color?, slow? }.
function tdDrawEnemy(ctx, e) {
    const x = e.x, y = e.y;
    const r = e.radius ?? 9;
    const color = e.color || TD.enemy;

    ctx.beginPath(); ctx.arc(x, y, r, 0, TD.TAU);
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = TD.enemyDk; ctx.stroke();
    // bright inner core for readability in a swarm
    ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, TD.TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();

    if (e.slow) { // frost overlay
        ctx.beginPath(); ctx.arc(x, y, r, 0, TD.TAU);
        ctx.fillStyle = TD.slowTint; ctx.fill();
    }

    // HP bar — only when damaged, pinned just above the disc
    if (e.maxHp && e.hp != null && e.hp < e.maxHp) {
        const frac = clamp(e.hp / e.maxHp, 0, 1);
        const w = r * 2.2, h = 3, bx = x - w / 2, by = y - r - 7;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
        ctx.fillStyle = frac > 0.5 ? TD.good : frac > 0.25 ? TD.warn : TD.bad;
        ctx.fillRect(bx, by, w * frac, h);
    }
}

// --- tdDrawProjectile -----------------------------------------------
// A small bright shot with a white core. proj: { x, y, radius?, color? }.
function tdDrawProjectile(ctx, p) {
    const r = p.radius ?? 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TD.TAU);
    ctx.fillStyle = p.color || TD.proj; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r * 0.45), 0, TD.TAU);
    ctx.fillStyle = TD.projCore; ctx.fill();
}

// --- tdDrawHUD ------------------------------------------------------
// A compact top-left readout: lives ♥, gold ●, and wave. `info` is any subset of
// { lives, gold, wave, waves, msg }. Wrapped in save/restore so it can't leak.
function tdDrawHUD(ctx, area, info = {}) {
    const x = (area.originX ?? area.x ?? 0) + 10;
    const y = (area.originY ?? area.y ?? 0) + 8;
    ctx.save();
    ctx.font = 'bold 13px monospace';
    ctx.textBaseline = 'top';
    const parts = [];
    if (info.lives != null) parts.push(['♥ ' + info.lives, TD.bad]);
    if (info.gold != null) parts.push(['● ' + info.gold, TD.towerGold]);
    if (info.wave != null) parts.push(['Wave ' + info.wave + (info.waves ? '/' + info.waves : ''), TD.accent]);
    let cx = x;
    for (const [txt, col] of parts) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        const w = ctx.measureText(txt).width;
        ctx.fillRect(cx - 4, y - 3, w + 8, 19);
        ctx.fillStyle = col;
        ctx.fillText(txt, cx, y);
        cx += w + 16;
    }
    if (info.msg) {
        ctx.fillStyle = TD.text;
        ctx.fillText(info.msg, x, y + 22);
    }
    ctx.restore();
}

// --- tdDrawPop ------------------------------------------------------
// A small fading ring for kill / leak / blast feedback (purely cosmetic). The
// Simulations tier teaches a real pooled particle system; this is the cheap stand-in
// every tier reuses. pop: { x, y, r, life, max, color? } — `life` counts down to 0.
function tdDrawPop(ctx, pop) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pop.life / pop.max);
    ctx.beginPath();
    ctx.arc(pop.x, pop.y, pop.r * (1.6 - pop.life / pop.max), 0, TD.TAU);
    ctx.lineWidth = 2;
    ctx.strokeStyle = pop.color || TD.proj;
    ctx.stroke();
    ctx.restore();
}

// rounded-rect path helper (module-local)
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.TD = TD;
    window.tdDrawGround = tdDrawGround;
    window.tdDrawGrid = tdDrawGrid;
    window.tdDrawPath = tdDrawPath;
    window.tdDrawRange = tdDrawRange;
    window.tdDrawTower = tdDrawTower;
    window.tdDrawEnemy = tdDrawEnemy;
    window.tdDrawProjectile = tdDrawProjectile;
    window.tdDrawHUD = tdDrawHUD;
    window.tdDrawPop = tdDrawPop;
}
