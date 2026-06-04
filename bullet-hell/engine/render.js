// ===================================================================
// bullet-hell/engine/render.js
//
// The track's shared look + asset-free Canvas2D drawing helpers. Everything is
// pure shapes — no images — so every demo renders identically and exports clean.
//
//   • BH            — the colour palette + a couple of shared constants
//                     (sibling to the Physics Puzzle's `PZ` / Platformer's `PF`).
//   • bhMakeStars / bhUpdateStars / bhDrawStars — a cheap parallax starfield for
//                     the vertical playfield's background (the genre's scrolling feel).
//   • bhDrawField   — the playfield panel + border the action happens inside.
//   • bhDrawPlayer  — the ship, AND the genre's signature: a tiny hitbox dot vs a
//                     larger graze ring, both revealed in "focus" mode.
//   • bhDrawBullet  — the classic danmaku bullet: a bright white core inside a
//                     coloured rim, so dense patterns stay readable.
//
// Reuses shared/utils.js where it already has the tool (`clearCanvas` for the
// page background). Boss / HP-bar helpers are NOT here yet — they arrive with the
// Advanced tier, their first consumer (promote-on-need, like the rest of the engine).
//
// Names (BH / bhMakeStars / bhUpdateStars / bhDrawStars / bhDrawField /
// bhDrawPlayer / bhDrawBullet) are pre-checked vs shared/utils.js. No ES modules.
// ===================================================================

// --- Shared palette + constants -------------------------------------
// Deep-space dark theme; cyan accents to match the repo. Enemy bullets lean to
// the warm/pink end so they pop against the cool background and the cyan ship.
const BH = Object.freeze({
    TAU:        Math.PI * 2,    // one declaration of 2π for the whole track
    // background / field
    bg:         '#070a1c',      // page-side void behind the panel
    field:      '#0c1024',      // the playfield panel
    fieldEdge:  '#2b3566',      // its border
    star:       '#aab3e0',      // parallax stars
    grid:       '#161c3a',      // faint helper grid (editor / diagrams)
    // the player
    ship:       '#4fc3f7',      // hull — the cyan "hero" colour
    shipDk:     '#2b85b3',      // hull shade / outline
    hitbox:     '#ff4d6d',      // the tiny hard hitbox core (the thing that dies)
    graze:      'rgba(124,242,200,0.85)', // graze-ring stroke (cyan-green)
    grazeFill:  'rgba(124,242,200,0.10)', // graze-ring fill when focused
    // bullets (enemy fire) — a small named set demos pick from
    bullet:     '#ff5d8f',      // default enemy bullet rim (pink)
    bulletCore: '#ffffff',      // every bullet's bright inner core
    bulletBlue: '#62d0ff',
    bulletGold: '#ffd166',
    bulletLime: '#9bf06b',
    // ui / accents
    text:       '#c9d1d9',
    dim:        '#6b7488',
    good:       '#66bb6a',
    warn:       '#ffa726',
    bad:        '#ef5350',
    accent:     '#4fc3f7',
});

// --- Starfield (background eye-candy) -------------------------------
// Three "depths" of stars scroll downward at different speeds (parallax). The
// caller owns the array: make once, bhUpdateStars(dt) each step, bhDrawStars each
// frame. Pure data + draw so it stays export-friendly.
function bhMakeStars(bounds, count = 70) {
    const stars = [];
    for (let i = 0; i < count; i++) {
        const depth = Math.random();                 // 0 = far/slow, 1 = near/fast
        stars.push({
            x: bounds.x + Math.random() * bounds.w,
            y: bounds.y + Math.random() * bounds.h,
            r: 0.5 + depth * 1.4,                    // nearer → bigger
            spd: 20 + depth * 70,                    // nearer → faster (px/s)
            a: 0.25 + depth * 0.5,                   // nearer → brighter
        });
    }
    return stars;
}

// Scroll stars downward and wrap them back to the top of the field.
function bhUpdateStars(stars, bounds, dt) {
    for (const s of stars) {
        s.y += s.spd * dt;
        if (s.y > bounds.y + bounds.h) {
            s.y = bounds.y;
            s.x = bounds.x + Math.random() * bounds.w;
        }
    }
}

function bhDrawStars(ctx, stars) {
    for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = BH.star;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, BH.TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// --- bhDrawField ----------------------------------------------------
// Fill the playfield panel and stroke its border. Call FIRST (it paints the
// panel background the stars/bullets sit on). `bounds` is { x, y, w, h }.
function bhDrawField(ctx, bounds) {
    const { x, y, w, h } = bounds;
    ctx.fillStyle = BH.field;
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = BH.fieldEdge;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// --- bhDrawPlayer ---------------------------------------------------
// Draw the ship as a small upward-pointing arrow, plus the genre's signature
// twin boxes:
//   • the HITBOX — a tiny (~2–3px) bright dot at the exact centre. THIS is what
//     a bullet has to touch to kill you; the big hull is just decoration.
//   • the GRAZE ring — a larger circle. Skimming a bullet through it (without
//     touching the hitbox) scores "graze". Both are revealed in focus mode, the
//     same affordance Touhou/Cave use so you can thread dense patterns precisely.
//
// player: { pos:Vector2D, radius (hitbox r), grazeR, focused }
function bhDrawPlayer(ctx, player) {
    const x = player.pos.x, y = player.pos.y;
    const hull = Math.max(10, (player.grazeR ?? 14) * 0.9);

    // graze ring — only while focused, so normal flight stays uncluttered.
    if (player.focused && player.grazeR) {
        ctx.beginPath();
        ctx.arc(x, y, player.grazeR, 0, BH.TAU);
        ctx.fillStyle = BH.grazeFill;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = BH.graze;
        ctx.stroke();
    }

    // hull — an arrowhead pointing up the screen (toward the enemies).
    ctx.beginPath();
    ctx.moveTo(x, y - hull);
    ctx.lineTo(x + hull * 0.7, y + hull * 0.7);
    ctx.lineTo(x, y + hull * 0.35);
    ctx.lineTo(x - hull * 0.7, y + hull * 0.7);
    ctx.closePath();
    ctx.fillStyle = BH.ship;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = BH.shipDk;
    ctx.stroke();

    // the hitbox dot — always drawn, brighter + haloed in focus mode so you can
    // see exactly the pixels that matter.
    const r = player.radius ?? 3;
    if (player.focused) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, BH.TAU);
        ctx.fillStyle = 'rgba(255,77,109,0.30)';
        ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, BH.TAU);
    ctx.fillStyle = BH.hitbox;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r - 1.5), 0, BH.TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
}

// --- bhDrawBullet ---------------------------------------------------
// The classic danmaku bullet: a soft coloured rim with a bright white core. The
// white core is what keeps a screen of 2000 bullets legible — your eye tracks
// the cores. `fill` overrides the bullet's own colour when given.
function bhDrawBullet(ctx, b, fill) {
    const c = fill || b.color || BH.bullet;
    const x = b.pos.x, y = b.pos.y, r = b.radius;

    // outer coloured rim (slightly translucent so overlaps glow)
    ctx.beginPath();
    ctx.arc(x, y, r, 0, BH.TAU);
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;

    // bright white core
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r * 0.45), 0, BH.TAU);
    ctx.fillStyle = BH.bulletCore;
    ctx.fill();
}

// --- bhDrawBoss -----------------------------------------------------
// Draw a boss as a menacing, slowly-rotating polygon with a pulsing core. Reads
// `boss.t` (its age in seconds) for the animation, so a still frame still looks
// alive. Added with the Advanced tier (its first consumer); reused by Expert and
// the Simulations boss-rush. boss: { pos:Vector2D, radius, t }.
function bhDrawBoss(ctx, boss) {
    const x = boss.pos.x, y = boss.pos.y, r = boss.radius;
    const t = boss.t || 0;
    // outer glow
    ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, BH.TAU);
    ctx.fillStyle = 'rgba(239,83,80,0.12)'; ctx.fill();
    // rotating hexagonal hull
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = t * 0.8 + (i / 6) * BH.TAU;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = BH.bad; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#b53b39'; ctx.stroke();
    // pulsing bright core
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    ctx.beginPath(); ctx.arc(x, y, r * 0.45 * pulse, 0, BH.TAU);
    ctx.fillStyle = '#ffd1d1'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, BH.TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
}

// --- bhDrawHpBar ----------------------------------------------------
// A boss health bar pinned to the top of the playfield, with a name label.
// `frac` is 0..1; clamp() comes from shared/utils.js. Wrapped in save/restore so
// it can't leak text/align state onto the rest of the scene.
function bhDrawHpBar(ctx, bounds, frac, name, opts = {}) {
    ctx.save();
    frac = clamp(frac, 0, 1);
    const m = 10, x = bounds.x + m, y = bounds.y + 14, w = bounds.w - 2 * m, h = 8;
    ctx.fillStyle = BH.text; ctx.font = '12px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(name || 'BOSS', x, y - 3);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = opts.color || BH.bad; ctx.fillRect(x, y, w * frac, h);
    ctx.lineWidth = 1; ctx.strokeStyle = BH.fieldEdge; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
}

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.BH = BH;
    window.bhMakeStars = bhMakeStars;
    window.bhUpdateStars = bhUpdateStars;
    window.bhDrawStars = bhDrawStars;
    window.bhDrawField = bhDrawField;
    window.bhDrawPlayer = bhDrawPlayer;
    window.bhDrawBullet = bhDrawBullet;
    window.bhDrawBoss = bhDrawBoss;
    window.bhDrawHpBar = bhDrawHpBar;
}
