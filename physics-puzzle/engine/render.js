// ===================================================================
// physics-puzzle/engine/render.js
//
// The track's shared look + a few asset-free drawing helpers. Everything here
// is pure Canvas2D shapes — no images — so every demo renders the same way.
//
//   • PZ           — the colour palette (one vocabulary across all five tiers),
//                    sibling to the Platformer's `PF`.
//   • pzDrawBody   — draw a PZBody as a filled circle with a soft highlight and
//                    (when it has one) an orientation tick, so spin reads later.
//   • pzDrawArena  — draw the rectangular container walls a demo bounces inside.
//   • pzDrawDots   — draw a dotted path (the slingshot's trajectory preview).
//
// Reuses shared/utils.js where it already has the tool: demos call `clearCanvas`
// for the background and `drawVector` for the slingshot pull arrow, so this file
// only owns what's specific to drawing physics bodies.
//
// Names (PZ / pzDrawBody / pzDrawArena / pzDrawDots) are pre-checked vs
// shared/utils.js. No ES modules — attach to `window` at the bottom.
// ===================================================================

// --- Shared palette -------------------------------------------------
// Sits in the repo's dark theme (bg #0d1117, accent cyan #4fc3f7, the
// cyan-green #7CF2C8 the repo uses for the "hero" element).
const PZ = Object.freeze({
    bg:        '#0d1117', // background / void
    grid:      '#1b2235', // faint helper grid
    // static geometry
    wall:      '#3a4570', // arena walls / ground
    wallLit:   '#4a5788', // wall top highlight
    anchor:    '#8893b0', // a pinned point / peg
    // dynamic bodies
    ball:      '#7CF2C8', // the player's projectile — the hero colour
    ballDk:    '#3fae8e', // its shaded side / outline
    pin:       '#ef5350', // knock-down pins (red)
    pinDk:     '#b53b39',
    target:    '#ffd166', // goal / scoring zone (gold)
    rope:      '#c98a4b', // ropes & chains (Intermediate)
    // ui / accents
    text:      '#c9d1d9',
    dim:       '#6b7488',
    good:      '#66bb6a',
    warn:      '#ffa726',
    bad:       '#ef5350',
    accent:    '#4fc3f7',
    aim:       'rgba(124,242,200,0.9)',  // slingshot pull band
    trace:     'rgba(79,195,247,0.85)',  // trajectory dots
});

// --- pzDrawBody -----------------------------------------------------
// Draw a circular body: a flat fill, a lighter top-left highlight for a hint of
// volume, and — if the body carries an angle — a short radial tick so rotation
// is visible once the Advanced tier switches it on. `fill`/`stroke` override the
// body's own colour when given.
function pzDrawBody(ctx, body, fill, stroke) {
    const x = body.pos.x, y = body.pos.y, r = body.radius;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill || body.color || PZ.ball;
    ctx.fill();

    // soft highlight (upper-left), drawn as a smaller offset arc
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();

    if (stroke) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }

    // orientation tick (inert until a body actually spins)
    if (body.angle) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(body.angle) * r, y + Math.sin(body.angle) * r);
        ctx.strokeStyle = stroke || PZ.ballDk;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// --- pzDrawArena ----------------------------------------------------
// Draw the rectangular container (left/right/ceiling/floor) a demo's bodies
// bounce inside. `arena` is { x, y, w, h } in canvas pixels; `t` is the visual
// wall thickness (purely cosmetic — collision uses the rect edges).
function pzDrawArena(ctx, arena, t = 10) {
    const { x, y, w, h } = arena;
    ctx.fillStyle = PZ.wall;
    ctx.fillRect(x - t, y - t, w + 2 * t, t);       // ceiling
    ctx.fillRect(x - t, y + h, w + 2 * t, t);        // floor
    ctx.fillRect(x - t, y, t, h);                    // left
    ctx.fillRect(x + w, y, t, h);                    // right
    // a lit edge on the floor so "ground" reads instantly
    ctx.fillStyle = PZ.wallLit;
    ctx.fillRect(x - t, y + h, w + 2 * t, 2);
}

// --- pzDrawDots -----------------------------------------------------
// Draw a path as fading dots — used for the slingshot trajectory preview.
// `points` is an array of {x, y}; alpha fades along the path so the near future
// reads stronger than the far.
function pzDrawDots(ctx, points, color = PZ.trace, radius = 2.5) {
    for (let i = 0; i < points.length; i++) {
        const a = 1 - (i / points.length) * 0.75;
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(/[\d.]+\)$/, a.toFixed(2) + ')');
        ctx.fill();
    }
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.PZ = PZ;
    window.pzDrawBody = pzDrawBody;
    window.pzDrawArena = pzDrawArena;
    window.pzDrawDots = pzDrawDots;
}
