// =============================================================================
// BULLET HELL — BEGINNER TIER DEMOS ("One Ship, One Bullet")
// =============================================================================
// Six demos, each an IIFE that early-returns if its canvas is absent (so this
// one file is safe to include on any page). Teaching order — each demo adds
// exactly ONE new idea on top of the last:
//
//   1. loopDemo   — the fixed loop + the vertical playfield (move, get clamped in)
//   2. moveDemo   — PRECISE movement: normalized diagonals + focus/slow mode
//   3. shotDemo   — the bullet as a moving point: spawn (polar), integrate, cull
//   4. hitDemo    — the genre's signature: tiny HITBOX vs larger GRAZE-box
//   5. streamDemo — a timed stream of bullets (a cooldown → fire-rate)
//   6. dodgeDemo  — the capstone "First Dodge": survive a stream, graze for score
//
// DEPENDENCIES (loaded BEFORE this file by beginner.html):
//   ../shared/utils.js   — Vector2D, clamp, clearCanvas (globals)
//   engine/loop.js       — window.bhLoop, bhInstallKeys
//   engine/render.js     — window.BH, bhMakeStars/bhUpdateStars/bhDrawStars,
//                          bhDrawField, bhDrawPlayer, bhDrawBullet
//   engine/field.js      — window.BHField, BHBullet
//
// THE TIER'S COLLISION LESSON lives here, inline and top-level (so it's
// console-testable): bhHitTest / bhGrazeTest. The engine's BHField deliberately
// has NO collision — hit/graze IS the Beginner lesson, layered on top.
// =============================================================================

// --- The collision lesson (top-level so you can call it from the console) ----
// Squared distance between two points — no Math.sqrt, because comparing against
// a squared radius gives the same answer for a fraction of the cost. At 10k
// bullets (the Expert tier) that "free" optimization is the whole ballgame.
function bhDist2(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
}

// HIT: did the bullet touch the player's tiny hitbox dot? The visible ship is
// big, but only this ~3px core can kill you — the defining trick of danmaku.
function bhHitTest(player, bullet) {
    const r = player.radius + bullet.radius;
    return bhDist2(player.pos, bullet.pos) <= r * r;
}

// GRAZE: is the bullet inside the (larger) graze ring but NOT touching the
// hitbox? Skimming bullets this close — without dying — is how you score.
function bhGrazeTest(player, bullet) {
    const d2 = bhDist2(player.pos, bullet.pos);
    const hit = player.radius + bullet.radius;     // inner edge (death)
    const graze = player.grazeR + bullet.radius;   // outer edge (graze ring)
    return d2 > hit * hit && d2 <= graze * graze;
}

// --- A tiny shared helper used by every demo with a player --------------------
// Canvas-scoped input means a demo only responds once you CLICK it (give it
// keyboard focus). This paints that instruction over the field until you do.
function bhFocusHint(ctx, bounds, focused, msg) {
    if (focused) return;
    ctx.save();
    ctx.fillStyle = 'rgba(7,10,28,0.62)';
    ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 20, bounds.w, 40);
    ctx.fillStyle = '#c9d1d9';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.restore();
}

// =============================================================================
// 1) loopDemo — the fixed loop + the playfield
// =============================================================================
(function loopDemo() {
    const canvas = document.getElementById('bhLoopCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;

    const stars = bhMakeStars(bounds, 70);
    const keys = bhInstallKeys(canvas);
    const player = {
        pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56),
        radius: 3, grazeR: 16, focused: false, // focus mode not taught here yet
    };
    const SPEED = 230; // px/s
    const hud = document.getElementById('bhLoopHud');

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        // moveDir() is a FRESH normalized vector each call — safe to mutate.
        const move = keys.moveDir().multiply(SPEED * dt);
        player.pos.add(move);
        // Keep the ship inside the playfield walls.
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);
        keys.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · Arrow keys / WASD to move');
        hud.textContent =
            `pos = (${player.pos.x.toFixed(0)}, ${player.pos.y.toFixed(0)}) · `
            + `${keys.focused ? 'focused ✓ — your input drives the loop' : 'click to focus'} · `
            + `sim runs at a fixed 60 Hz`;
    }

    bhLoop(update, render).start();
})();

// =============================================================================
// 2) moveDemo — precise movement: normalized diagonals + focus/slow mode
// =============================================================================
(function moveDemo() {
    const canvas = document.getElementById('bhMoveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;

    const stars = bhMakeStars(bounds, 70);
    const keys = bhInstallKeys(canvas);
    const player = {
        pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56),
        radius: 3, grazeR: 18, focused: false,
    };
    const FULL = 250, FOCUS = 110; // normal vs focus-mode speed (px/s)

    const normCb = document.getElementById('bhMoveNorm');
    const hud = document.getElementById('bhMoveHud');

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);

        // Raw axis is -1/0/1 per direction. The bug: a diagonal raw vector has
        // length √2, so moving NE is 41% FASTER than moving N. Normalizing fixes
        // it — every direction moves at the same speed. Toggle to feel it.
        const a = keys.axis();
        const dir = normCb.checked
            ? keys.moveDir()                  // length 0 or 1
            : new Vector2D(a.x, a.y);         // length 0, 1, or √2 (the bug)
        const dirLen = dir.length();

        player.focused = keys.focus;          // Shift = focus/slow mode
        const speed = keys.focus ? FOCUS : FULL;
        player.pos.add(dir.multiply(speed * dt));
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);

        // The actually-intended speed this frame (before the wall clamp).
        player._spd = dirLen * speed;
        player._diagBug = !normCb.checked && dirLen > 1.01;
        keys.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · move · hold Shift to focus');
        const spd = (player._spd || 0).toFixed(0);
        hud.innerHTML =
            `speed = <b>${spd}</b> px/s · `
            + (player.focused
                ? '<span style="color:#7CF2C8">FOCUS (slow + hitbox shown)</span>'
                : 'normal')
            + (player._diagBug
                ? ' · <span style="color:#ef5350">diagonal is 41% too fast — turn normalize on!</span>'
                : '');
    }

    bhLoop(update, render).start();
})();

// =============================================================================
// 3) shotDemo — the bullet as a moving point: spawn (polar), integrate, cull
// =============================================================================
(function shotDemo() {
    const canvas = document.getElementById('bhShotCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };

    const stars = bhMakeStars(bounds, 60);
    const field = new BHField(bounds, { margin: 16 });
    const keys = bhInstallKeys(canvas);
    const emitter = new Vector2D(bounds.x + bounds.w / 2, bounds.y + 40);

    const angEl = document.getElementById('bhShotAngle');
    const angVal = document.getElementById('bhShotAngleVal');
    const spdEl = document.getElementById('bhShotSpeed');
    const spdVal = document.getElementById('bhShotSpeedVal');
    const hud = document.getElementById('bhShotHud');
    let totalFired = 0;

    function fire() {
        const deg = +angEl.value;
        const speed = +spdEl.value;
        // A bullet's velocity is a POLAR coordinate: angle θ + magnitude. This
        // ONE line is the seed of every pattern in the next tier.
        const v = Vector2D.fromAngle(deg * Math.PI / 180, speed);
        field.spawn(emitter.x, emitter.y, v.x, v.y, { radius: 5, color: BH.bullet });
        totalFired++;
    }
    document.getElementById('bhShotFire').addEventListener('click', fire);

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        if (keys.shootPressed) fire();   // Z fires too (once the canvas is focused)
        field.step(dt);                  // integrate every bullet + cull off-screen
        keys.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);

        // Show the launch direction as an arrow from the emitter.
        const deg = +angEl.value, speed = +spdEl.value;
        if (angVal) angVal.textContent = deg + '°';
        if (spdVal) spdVal.textContent = speed;
        const aim = Vector2D.fromAngle(deg * Math.PI / 180, 34);
        drawVector(ctx, emitter, { x: emitter.x + aim.x, y: emitter.y + aim.y }, BH.accent, 2);

        for (const b of field.bullets) bhDrawBullet(ctx, b);

        // The emitter marker (a little enemy node).
        ctx.beginPath(); ctx.arc(emitter.x, emitter.y, 7, 0, BH.TAU);
        ctx.fillStyle = BH.bad; ctx.fill();

        hud.textContent =
            `live bullets = ${field.count} · fired = ${totalFired} · `
            + `each is pos += vel·dt, culled when it leaves the field`;
    }

    bhLoop(update, render).start();
})();

// =============================================================================
// 4) hitDemo — hitbox vs graze-box (the genre's whole identity)
// =============================================================================
(function hitDemo() {
    const canvas = document.getElementById('bhHitCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;

    const stars = bhMakeStars(bounds, 60);
    const field = new BHField(bounds, { margin: 16 });
    const keys = bhInstallKeys(canvas);
    const player = {
        pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 60),
        radius: 3, grazeR: 22, focused: false,
    };
    const FULL = 240, FOCUS = 105;

    const hud = document.getElementById('bhHitHud');
    let grazes = 0, hits = 0, grazeFlash = 0, hitFlash = 0, spawnTimer = 0;

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);

        // Drift in a slow, sparse rain of big bullets you can thread.
        spawnTimer -= dt;
        if (spawnTimer <= 0 && field.count < 26) {
            spawnTimer = 0.32;
            const x = bounds.x + 16 + Math.random() * (bounds.w - 32);
            const vx = (Math.random() - 0.5) * 40;
            field.spawn(x, bounds.y + 4, vx, 95 + Math.random() * 35,
                { radius: 7, color: BH.bulletBlue });
        }

        player.focused = keys.focus;
        const speed = keys.focus ? FOCUS : FULL;
        player.pos.add(keys.moveDir().multiply(speed * dt));
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);

        field.step(dt);

        // The lesson in action — test every bullet against the twin boxes.
        for (let i = field.bullets.length - 1; i >= 0; i--) {
            const b = field.bullets[i];
            if (bhHitTest(player, b)) {       // touched the dot → you'd die
                hits++; hitFlash = 0.35;
                field.bullets.splice(i, 1);   // pop it so we don't re-count
                continue;
            }
            if (!b.grazed && bhGrazeTest(player, b)) { // skimmed it → score
                b.grazed = true; grazes++; grazeFlash = 0.25;
            }
        }
        grazeFlash = Math.max(0, grazeFlash - dt);
        hitFlash = Math.max(0, hitFlash - dt);
        keys.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) {
            // tint a bullet gold the instant it's been grazed
            bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        }
        bhDrawPlayer(ctx, player);

        if (hitFlash > 0) {
            ctx.fillStyle = `rgba(239,83,80,${(hitFlash * 1.4).toFixed(2)})`;
            ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        }
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · hold Shift to reveal hitbox');

        hud.innerHTML =
            `grazes = <b style="color:#7CF2C8">${grazes}</b>`
            + (grazeFlash > 0 ? ' <span style="color:#ffd166">GRAZE! ✦</span>' : '')
            + ` · hits = <b style="color:#ef5350">${hits}</b>`
            + (hitFlash > 0 ? ' <span style="color:#ef5350">— that pixel is all that matters</span>' : '')
            + ` · hold <b>Shift</b> to see the boxes`;
    }

    bhLoop(update, render).start();
})();

// =============================================================================
// 5) streamDemo — a timed stream of bullets (a cooldown → a fire-rate)
// =============================================================================
(function streamDemo() {
    const canvas = document.getElementById('bhStreamCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;

    const stars = bhMakeStars(bounds, 60);
    const field = new BHField(bounds, { margin: 16 });
    const keys = bhInstallKeys(canvas);
    const enemy = new Vector2D(bounds.x + bounds.w / 2, bounds.y + 34);
    const player = {
        pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56),
        radius: 3, grazeR: 22, focused: false,
    };
    const FULL = 250, FOCUS = 110;

    const rateEl = document.getElementById('bhStreamRate');
    const rateVal = document.getElementById('bhStreamRateVal');
    const hud = document.getElementById('bhStreamHud');
    let t = 0, fireTimer = 0, grazes = 0;

    function update(dt) {
        t += dt;
        bhUpdateStars(stars, bounds, dt);

        // A "stream" is just: spawn one bullet every `interval` seconds. The
        // interval IS the fire-rate. We sweep the aim with a sine so it paints a
        // readable ribbon rather than a single column.
        const interval = +rateEl.value / 1000; // ms → s
        fireTimer -= dt;
        while (fireTimer <= 0) {
            fireTimer += interval;
            const sweep = Math.sin(t * 2.2) * 0.5;          // ±0.5 rad off straight-down
            const v = Vector2D.fromAngle(Math.PI / 2 + sweep, 210);
            field.spawn(enemy.x, enemy.y, v.x, v.y, { radius: 5, color: BH.bullet });
        }

        player.focused = keys.focus;
        const speed = keys.focus ? FOCUS : FULL;
        player.pos.add(keys.moveDir().multiply(speed * dt));
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);

        field.step(dt);
        for (const b of field.bullets) {
            if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; grazes++; }
        }
        keys.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        bhDrawPlayer(ctx, player);
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 9, 0, BH.TAU);
        ctx.fillStyle = BH.bad; ctx.fill();
        if (rateVal) rateVal.textContent = rateEl.value;
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · weave through the stream');
        hud.innerHTML = `fire every <b>${rateEl.value} ms</b> · live = ${field.count} · `
            + `grazes = <b style="color:#7CF2C8">${grazes}</b>`;
    }

    bhLoop(update, render).start();
})();

// =============================================================================
// 6) dodgeDemo — capstone "First Dodge": survive a stream, graze for score
// =============================================================================
(function dodgeDemo() {
    const canvas = document.getElementById('bhDodgeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const PAD = 12;

    const stars = bhMakeStars(bounds, 70);
    const field = new BHField(bounds, { margin: 16 });
    const keys = bhInstallKeys(canvas);
    const enemy = new Vector2D(bounds.x + bounds.w / 2, bounds.y + 34);
    const FULL = 250, FOCUS = 110;
    const SURVIVE = 20; // seconds to win

    const hud = document.getElementById('bhDodgeHud');
    let player, t, fireTimer, lives, score, invuln, state; // state: 'play' | 'win' | 'lose'

    function reset() {
        player = {
            pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56),
            radius: 3, grazeR: 22, focused: false,
        };
        field.clear();
        t = 0; fireTimer = 0; lives = 3; score = 0; invuln = 0; state = 'play';
    }
    reset();
    document.getElementById('bhDodgeReset').addEventListener('click', reset);

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        if (state !== 'play') return;

        t += dt;
        if (t >= SURVIVE) { state = 'win'; return; }

        // The barrage tightens as time passes — interval shrinks 140 → 70 ms,
        // and we fire a little 3-shot fan so there's something to thread.
        const interval = lerp(0.14, 0.07, t / SURVIVE);
        fireTimer -= dt;
        while (fireTimer <= 0) {
            fireTimer += interval;
            const base = Math.PI / 2 + Math.sin(t * 1.7) * 0.7;
            for (let k = -1; k <= 1; k++) {
                const v = Vector2D.fromAngle(base + k * 0.18, 200);
                field.spawn(enemy.x, enemy.y, v.x, v.y, { radius: 5, color: BH.bullet });
            }
        }

        player.focused = keys.focus;
        const speed = keys.focus ? FOCUS : FULL;
        player.pos.add(keys.moveDir().multiply(speed * dt));
        player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
        player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);

        field.step(dt);
        invuln = Math.max(0, invuln - dt);

        for (let i = field.bullets.length - 1; i >= 0; i--) {
            const b = field.bullets[i];
            if (invuln <= 0 && bhHitTest(player, b)) {
                lives--;
                invuln = 1.2;          // brief mercy i-frames
                field.clear();         // death-clear gives breathing room
                if (lives <= 0) state = 'lose';
                break;
            }
            if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; score += 100; }
        }
        keys.endFrame();
    }

    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of field.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);

        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 10, 0, BH.TAU);
        ctx.fillStyle = BH.bad; ctx.fill();

        // Blink the ship while invulnerable.
        if (!(invuln > 0 && Math.floor(invuln * 12) % 2 === 0)) bhDrawPlayer(ctx, player);

        bhFocusHint(ctx, bounds, keys.focused, 'Click here · survive 20s · Shift = focus');

        // Banner on win / lose.
        if (state !== 'play') {
            ctx.fillStyle = 'rgba(7,10,28,0.72)';
            ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 34, bounds.w, 68);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = state === 'win' ? BH.good : BH.bad;
            ctx.fillText(state === 'win' ? '🏆 Survived!' : '💥 Out of lives',
                bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 - 6);
            ctx.font = '13px monospace'; ctx.fillStyle = BH.text;
            ctx.fillText(`score ${score} — click "New run" to play again`,
                bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 18);
        }

        const left = Math.max(0, SURVIVE - t).toFixed(1);
        hud.innerHTML =
            `time left <b>${left}s</b> · lives <b style="color:#ff4d6d">${'♥'.repeat(Math.max(0, lives))}</b>`
            + ` · score <b style="color:#7CF2C8">${score}</b> (graze = +100)`;
    }

    bhLoop(update, render).start();
})();
