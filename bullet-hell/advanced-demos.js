// =============================================================================
// BULLET HELL — ADVANCED TIER DEMOS ("The Boss Fight")
// =============================================================================
// Six demos, each a canvas-guarded IIFE. We go from "a pattern" to "a fight":
//
//   1. bossDemo   — the boss entity: HP, scripted movement, a health bar
//   2. scriptDemo — an attack SCRIPT as data: a BHSpellCard timeline
//   3. phaseDemo  — phases: HP thresholds swap cards + a screen-clear transition
//   4. subDemo    — sub-emitters: carrier bullets that airburst (+ a turret)
//   5. bombDemo   — the player's bomb: clear the screen, i-frames, a stock cost
//   6. duelDemo   — capstone "Spell Card Duel": a real 2-phase boss + scoring
//
// DEPENDENCIES (loaded BEFORE this file by advanced.html):
//   ../shared/utils.js   — Vector2D, clamp, clearCanvas
//   engine/loop.js       — bhLoop, bhInstallKeys
//   engine/render.js     — BH, bhDraw*, bhDrawBoss, bhDrawHpBar (+ starfield)
//   engine/field.js      — BHField, BHBullet
//   engine/emitter.js    — BHEmitter, bhFireRing, bhFireFan  (promoted here from
//                          the Intermediate tier — this tier is its 2nd consumer)
//
// SELF-CONTAINED: re-declares the small collision/UI helpers. BHBoss + BHSpellCard
// are this tier's lesson; BHSpellCard is earmarked for engine/script.js when the
// Simulations boss-rush becomes its 2nd consumer.
// =============================================================================

// --- Small shared helpers (re-declared; self-contained tier) -----------------
function bhDist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
function bhHitTest(player, bullet) { const r = player.radius + bullet.radius; return bhDist2(player.pos, bullet.pos) <= r * r; }
function bhGrazeTest(player, bullet) {
    const d2 = bhDist2(player.pos, bullet.pos);
    const hit = player.radius + bullet.radius, graze = player.grazeR + bullet.radius;
    return d2 > hit * hit && d2 <= graze * graze;
}
function bhFocusHint(ctx, bounds, focused, msg) {
    if (focused) return;
    ctx.save();
    ctx.fillStyle = 'rgba(7,10,28,0.62)';
    ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 20, bounds.w, 40);
    ctx.fillStyle = '#c9d1d9'; ctx.font = '13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(msg, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.restore();
}
// Move + clamp the player (the shared Beginner movement, in one place).
function bhMovePlayer(player, keys, bounds, dt) {
    const PAD = 12, FULL = 250, FOCUS = 110;
    player.focused = keys.focus;
    player.pos.add(keys.moveDir().multiply((keys.focus ? FOCUS : FULL) * dt));
    player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
    player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);
}
// Player offense (kept deliberately minimal): a twin stream of upward shots on a
// cooldown, and a resolver that damages the boss and consumes the shot.
function bhTickPlayerShots(shots, player, firing, dt, state) {
    state.cd -= dt;
    if (firing && state.cd <= 0) {
        state.cd = 0.075;
        shots.spawn(player.pos.x - 7, player.pos.y - 8, 0, -560, { radius: 3, color: BH.ship });
        shots.spawn(player.pos.x + 7, player.pos.y - 8, 0, -560, { radius: 3, color: BH.ship });
    }
}
function bhResolveShotsVsBoss(shots, boss, dmg) {
    let n = 0;
    for (let i = shots.bullets.length - 1; i >= 0; i--) {
        const s = shots.bullets[i];
        const rr = boss.radius + s.radius;
        if (bhDist2(s.pos, boss.pos) <= rr * rr) {
            if (boss.alive) boss.hp -= dmg;
            shots.bullets.splice(i, 1); n++;
        }
    }
    return n;
}

// =============================================================================
// THE TIER'S CORE LESSON — the boss entity + the spell-card runtime.
// =============================================================================

// A BHBoss: a position that sweeps the top of the field (a Lissajous figure),
// plus HP. Its emitter is wired separately so the same boss can run any pattern.
class BHBoss {
    constructor(x, y, opts = {}) {
        this.pos = new Vector2D(x, y);
        this.radius = opts.radius ?? 22;
        this.maxHp = opts.maxHp ?? 800;
        this.hp = this.maxHp;
        this.name = opts.name ?? 'BOSS';
        this.sway = opts.sway ?? 0.30;   // horizontal sweep, as a fraction of width
        this.t = 0;
    }
    move(dt, bounds) {
        this.t += dt;
        const cx = bounds.x + bounds.w / 2;
        this.pos.x = cx + Math.sin(this.t * 0.8) * (bounds.w * this.sway);
        this.pos.y = bounds.y + 74 + Math.sin(this.t * 1.6) * 20;
    }
    get alive() { return this.hp > 0; }
    get hpFrac() { return Math.max(0, this.hp) / this.maxHp; }
}

// A BHSpellCard: an attack as DATA. `steps` is a list of timed instructions —
// each fires once when the card's clock passes its `at`. A step can `set` the
// emitter's knobs (interval / spin / angle / fire) and/or fire a one-shot
// `burst`. This is the seed that becomes the Simulations pattern editor's output.
class BHSpellCard {
    constructor(def) {
        this.name = def.name || 'Spell Card';
        this.duration = def.duration ?? Infinity;
        this.steps = def.steps || [];
        this.label = '';
        this.reset();
    }
    reset() { this.t = 0; this.idx = 0; }
    // Apply every step that is now due; returns true once the duration elapses.
    step(dt, em, field) {
        this.t += dt;
        while (this.idx < this.steps.length && this.t >= this.steps[this.idx].at) {
            const s = this.steps[this.idx++];
            if (s.label !== undefined) this.label = s.label;
            if (s.set) {
                const st = s.set;
                if ('interval' in st) em.interval = st.interval;
                if ('spin' in st) em.spin = st.spin;
                if ('angle' in st) em.angle = st.angle;
                if ('fire' in st) { em.fire = st.fire; em.timer = 0; }
            }
            if (s.burst) s.burst(em, field);
        }
        return this.t >= this.duration;
    }
}

// =============================================================================
// 1) bossDemo — the boss entity (HP, movement, health bar)
// =============================================================================
(function bossDemo() {
    const canvas = document.getElementById('bhBossCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const keys = bhInstallKeys(canvas);
    const enemy = new BHField(bounds, { margin: 20 });
    const shots = new BHField(bounds, { margin: 20 });
    const hud = document.getElementById('bhBossHud');

    let boss, player, em, shotState, grazes, defeated;
    function reset() {
        boss = new BHBoss(bounds.x + bounds.w / 2, bounds.y + 74, { maxHp: 600, name: 'SENTINEL' });
        player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
        em = new BHEmitter(boss.pos.x, boss.pos.y, {
            interval: 0.45,
            fire: (e, f) => {
                const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                bhFireFan(f, e, 5, 0.6, aim, 160, { color: BH.bullet });
            },
        });
        enemy.clear(); shots.clear();
        shotState = { cd: 0 }; grazes = 0; defeated = false;
    }
    reset();
    document.getElementById('bhBossReset').addEventListener('click', reset);

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        boss.move(dt, bounds);
        em.pos.set(boss.pos.x, boss.pos.y);          // emitter rides the boss
        if (boss.alive) em.step(dt, enemy);

        bhMovePlayer(player, keys, bounds, dt);
        bhTickPlayerShots(shots, player, keys.shoot, dt, shotState);
        shots.step(dt);
        bhResolveShotsVsBoss(shots, boss, 10);
        if (!boss.alive) defeated = true;

        enemy.step(dt);
        for (const b of enemy.bullets) if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; grazes++; }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        for (const s of shots.bullets) bhDrawBullet(ctx, s, BH.ship);
        if (boss.alive) bhDrawBoss(ctx, boss);
        bhDrawHpBar(ctx, bounds, boss.hpFrac, boss.name);
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · Z to shoot · Shift to focus');
        if (defeated) {
            ctx.fillStyle = 'rgba(7,10,28,0.7)'; ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 26, bounds.w, 52);
            ctx.fillStyle = BH.good; ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Boss defeated! ↻ Restart', bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
        }
        hud.innerHTML = `boss HP <b style="color:#ff5d8f">${Math.max(0, Math.ceil(boss.hp))}</b>/${boss.maxHp} · `
            + `grazes <b style="color:#7CF2C8">${grazes}</b> · the boss has HP, moves, and fires`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 2) scriptDemo — an attack script as DATA (a BHSpellCard timeline)
// =============================================================================
(function scriptDemo() {
    const canvas = document.getElementById('bhScriptCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const keys = bhInstallKeys(canvas);
    const enemy = new BHField(bounds, { margin: 20 });
    const hud = document.getElementById('bhScriptHud');

    const player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + 92, {});
    let grazes = 0;

    // The whole attack, written as DATA: a sequence of timed reconfigurations.
    const card = new BHSpellCard({
        name: 'Three-Act Opener', duration: 8,
        steps: [
            { at: 0, label: '① ring burst', set: { spin: 0, interval: 0.5, fire: (e, f) => bhFireRing(f, e, 22, 110) } },
            { at: 2.6, label: '② spiral', set: { spin: 2.2, interval: 0.05, fire: (e, f) => {
                for (let k = 0; k < 3; k++) { const a = e.angle + (k / 3) * BH.TAU; const v = Vector2D.fromAngle(a, 135); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue }); }
            } } },
            { at: 5.2, label: '③ aimed fan', set: { spin: 0, interval: 0.22, fire: (e, f) => {
                const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                bhFireFan(f, e, 7, 0.7, aim, 165, { color: BH.bulletGold });
            } } },
        ],
    });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        bhMovePlayer(player, keys, bounds, dt);
        if (card.step(dt, em, enemy)) { card.reset(); enemy.clear(); } // loop the card
        em.step(dt, enemy);
        enemy.step(dt);
        for (const b of enemy.bullets) if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; grazes++; }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 10, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · the card plays itself');
        hud.innerHTML = `card <b style="color:#4fc3f7">${card.name}</b> · now: <b>${card.label}</b> · `
            + `t = ${card.t.toFixed(1)}s / ${card.duration}s (loops) · grazes ${grazes}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 3) phaseDemo — phases: HP thresholds swap cards + a screen-clear
// =============================================================================
(function phaseDemo() {
    const canvas = document.getElementById('bhPhaseCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const keys = bhInstallKeys(canvas);
    const enemy = new BHField(bounds, { margin: 20 });
    const shots = new BHField(bounds, { margin: 20 });
    const hud = document.getElementById('bhPhaseHud');

    let boss, player, em, cards, phase, shotState, flash, defeated;

    function makeCards() {
        return [
            new BHSpellCard({ name: 'Phase 1 — Sweep', duration: Infinity, steps: [
                { at: 0, label: 'aimed fan', set: { spin: 0, interval: 0.4, fire: (e, f) => {
                    const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                    bhFireFan(f, e, 5, 0.6, aim, 150);
                } } },
            ] }),
            new BHSpellCard({ name: 'Phase 2 — Spiral', duration: Infinity, steps: [
                { at: 0, label: 'twin spiral', set: { spin: 2.6, interval: 0.045, fire: (e, f) => {
                    for (let k = 0; k < 2; k++) { const a = e.angle + (k / 2) * BH.TAU; const v = Vector2D.fromAngle(a, 145); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue }); }
                } } },
            ] }),
        ];
    }
    function reset() {
        boss = new BHBoss(bounds.x + bounds.w / 2, bounds.y + 74, { maxHp: 600, name: 'WARDEN' });
        player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
        em = new BHEmitter(boss.pos.x, boss.pos.y, {});
        cards = makeCards(); phase = 0; shotState = { cd: 0 }; flash = 0; defeated = false;
        enemy.clear(); shots.clear();
    }
    reset();
    document.getElementById('bhPhaseReset').addEventListener('click', reset);

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        boss.move(dt, bounds);
        em.pos.set(boss.pos.x, boss.pos.y);

        // Phase transition: when HP crosses 50%, swap to phase 2 + screen-clear.
        if (phase === 0 && boss.hp <= boss.maxHp * 0.5) {
            phase = 1; enemy.clear(); flash = 0.4;
        }
        if (boss.alive) { cards[phase].step(dt, em, enemy); em.step(dt, enemy); }

        bhMovePlayer(player, keys, bounds, dt);
        bhTickPlayerShots(shots, player, keys.shoot, dt, shotState);
        shots.step(dt);
        bhResolveShotsVsBoss(shots, boss, 10);
        if (!boss.alive) defeated = true;

        enemy.step(dt);
        flash = Math.max(0, flash - dt);
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b);
        for (const s of shots.bullets) bhDrawBullet(ctx, s, BH.ship);
        if (boss.alive) bhDrawBoss(ctx, boss);
        bhDrawHpBar(ctx, bounds, boss.hpFrac, boss.name, { color: phase === 0 ? BH.bad : BH.warn });
        bhDrawPlayer(ctx, player);
        if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${(flash * 0.7).toFixed(2)})`; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h); }
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · Z to shoot down the HP bar');
        if (defeated) {
            ctx.fillStyle = 'rgba(7,10,28,0.7)'; ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 26, bounds.w, 52);
            ctx.fillStyle = BH.good; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Both phases cleared! ↻', bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
        }
        hud.innerHTML = `<b style="color:#4fc3f7">Phase ${phase + 1}/2</b> — ${cards[phase].name} · `
            + `HP ${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp} · crossing 50% swaps the card + clears the screen`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 4) subDemo — sub-emitters: carrier bullets that airburst (+ a turret)
// =============================================================================
(function subDemo() {
    const canvas = document.getElementById('bhSubCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const keys = bhInstallKeys(canvas);
    const enemy = new BHField(bounds, { margin: 20 });
    const hud = document.getElementById('bhSubHud');
    const FUSE = 0.85;

    const player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
    const center = new Vector2D(bounds.x + bounds.w / 2, bounds.y + 92);

    // Main emitter: lobs slow "carrier" bullets in a wide fan.
    const carrierEm = new BHEmitter(center.x, center.y, {
        interval: 0.5, angle: Math.PI / 2,
        fire: (e, f) => bhFireFan(f, e, 4, 1.4, Math.PI / 2, 130, { radius: 7, color: BH.bulletGold, tag: 'carrier' }),
    });
    // A turret that orbits the center and fires aimed singles — a 2nd emitter.
    const turretEm = new BHEmitter(center.x, center.y, {
        interval: 0.22,
        fire: (e, f) => {
            const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
            const v = Vector2D.fromAngle(aim, 200); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bullet });
        },
    });
    let grazes = 0, bursts = 0, orbitA = 0;

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        bhMovePlayer(player, keys, bounds, dt);

        carrierEm.step(dt, enemy);
        // Orbit the turret around the center, then fire from its orbital position.
        orbitA += dt * 1.6;
        const orbit = 48;
        turretEm.pos.set(center.x + Math.cos(orbitA) * orbit, center.y + Math.sin(orbitA) * orbit);
        turretEm.step(dt, enemy);

        enemy.step(dt);

        // SUB-EMITTERS: every carrier that reaches its fuse bursts into a ring,
        // then is removed. A bullet that spawns bullets — the core composite idea.
        for (let i = enemy.bullets.length - 1; i >= 0; i--) {
            const b = enemy.bullets[i];
            if (b.tag === 'carrier' && b.age >= FUSE) {
                bhFireRing(enemy, { pos: b.pos, angle: Math.random() * BH.TAU }, 10, 130, { radius: 3.5, color: BH.bullet });
                enemy.bullets.splice(i, 1); bursts++;
            }
        }
        for (const b of enemy.bullets) if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; grazes++; }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletLime : undefined);
        ctx.beginPath(); ctx.arc(center.x, center.y, 11, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        ctx.beginPath(); ctx.arc(turretEm.pos.x, turretEm.pos.y, 6, 0, BH.TAU); ctx.fillStyle = BH.warn; ctx.fill();
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · gold carriers burst into rings');
        hud.innerHTML = `carrier airbursts: <b style="color:#ffd166">${bursts}</b> · live ${enemy.count} · `
            + `bullets that spawn bullets + an orbiting turret · grazes ${grazes}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 5) bombDemo — the player's bomb: clear the screen, i-frames, a stock cost
// =============================================================================
(function bombDemo() {
    const canvas = document.getElementById('bhBombCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 50);
    const keys = bhInstallKeys(canvas);
    const enemy = new BHField(bounds, { margin: 20 });
    const hud = document.getElementById('bhBombHud');

    let player, em, bombs, invuln, fx, hitFlash;
    function reset() {
        player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
        em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + 80, { interval: 0.04, spin: 2.4, fire: (e, f) => {
            for (let k = 0; k < 4; k++) { const a = e.angle + (k / 4) * BH.TAU; const v = Vector2D.fromAngle(a, 135); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bullet }); }
        } });
        enemy.clear(); bombs = 3; invuln = 0; fx = null; hitFlash = 0;
    }
    reset();
    document.getElementById('bhBombReset').addEventListener('click', reset);

    function bomb() {
        if (bombs <= 0) return;
        bombs--; invuln = 1.6;
        enemy.clear();                                  // the screen-clear: a field op
        fx = { x: player.pos.x, y: player.pos.y, r: 0 }; // expanding shockwave visual
    }

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        em.step(dt, enemy);
        bhMovePlayer(player, keys, bounds, dt);
        if (keys.bombPressed) bomb();
        enemy.step(dt);
        invuln = Math.max(0, invuln - dt);
        hitFlash = Math.max(0, hitFlash - dt);
        if (fx) { fx.r += 900 * dt; if (fx.r > bounds.w) fx = null; }
        if (invuln <= 0) {
            for (let i = enemy.bullets.length - 1; i >= 0; i--) {
                if (bhHitTest(player, enemy.bullets[i])) { hitFlash = 0.3; enemy.bullets.splice(i, 1); }
            }
        }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b);
        ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 10, 0, BH.TAU); ctx.fillStyle = BH.bad; ctx.fill();
        if (fx) { ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, BH.TAU); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(124,242,200,${Math.max(0, 1 - fx.r / bounds.w).toFixed(2)})`; ctx.stroke(); }
        if (!(invuln > 0 && Math.floor(invuln * 12) % 2 === 0)) bhDrawPlayer(ctx, player);
        if (hitFlash > 0) { ctx.fillStyle = `rgba(239,83,80,${(hitFlash * 1.3).toFixed(2)})`; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h); }
        bhFocusHint(ctx, bounds, keys.focused, 'Click here · press X to bomb');
        hud.innerHTML = `bombs <b style="color:#7CF2C8">${'✸'.repeat(bombs) || '—'}</b> · `
            + (invuln > 0 ? '<span style="color:#7CF2C8">INVULNERABLE</span> · ' : '')
            + `press <b>X</b> to clear the screen (i-frames + 1 stock)`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 6) duelDemo — capstone "Spell Card Duel": a real 2-phase boss + scoring
// =============================================================================
(function duelDemo() {
    const canvas = document.getElementById('bhDuelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 14, y: 12, w: W - 28, h: H - 24 };
    const stars = bhMakeStars(bounds, 60);
    const keys = bhInstallKeys(canvas);
    const enemy = new BHField(bounds, { margin: 20 });
    const shots = new BHField(bounds, { margin: 20 });
    const hud = document.getElementById('bhDuelHud');
    const CAPTURE = 10000;

    let boss, player, em, cards, phase, lives, bombs, score, invuln, fx, flash, faulted, captures, state, shotState;

    function makeCards() {
        return [
            new BHSpellCard({ name: 'Opening — Aimed Rings', duration: Infinity, steps: [
                { at: 0, label: 'rings + aim', set: { spin: 0.7, interval: 0.5, fire: (e, f) => {
                    bhFireRing(f, e, 16, 105);
                    const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
                    bhFireFan(f, e, 3, 0.4, aim, 175, { color: BH.bulletGold });
                } } },
            ] }),
            new BHSpellCard({ name: 'Finale — Twin Spiral Storm', duration: Infinity, steps: [
                { at: 0, label: 'twin spiral', set: { spin: 3.0, interval: 0.04, fire: (e, f) => {
                    for (let k = 0; k < 2; k++) { const a = e.angle + (k / 2) * BH.TAU; const v = Vector2D.fromAngle(a, 150); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue }); }
                } } },
                { at: 2.5, label: 'spiral + aimed', set: { interval: 0.035, fire: (e, f) => {
                    for (let k = 0; k < 2; k++) { const a = e.angle + (k / 2) * BH.TAU; const v = Vector2D.fromAngle(a, 150); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue }); }
                    if (Math.random() < 0.5) { const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x); bhFireFan(f, e, 3, 0.3, aim, 200, { color: BH.bulletGold }); }
                } } },
            ] }),
        ];
    }
    function reset() {
        boss = new BHBoss(bounds.x + bounds.w / 2, bounds.y + 74, { maxHp: 1000, name: 'TWIN STAR' });
        player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 22, focused: false };
        em = new BHEmitter(boss.pos.x, boss.pos.y, {});
        cards = makeCards(); phase = 0; lives = 3; bombs = 3; score = 0;
        invuln = 0; fx = null; flash = 0; faulted = false; captures = 0; state = 'play';
        shotState = { cd: 0 }; enemy.clear(); shots.clear();
    }
    reset();
    document.getElementById('bhDuelReset').addEventListener('click', reset);

    function bomb() {
        if (bombs <= 0 || state !== 'play') return;
        bombs--; invuln = 1.6; faulted = true;       // bombing forfeits this phase's capture
        enemy.clear(); fx = { x: player.pos.x, y: player.pos.y, r: 0 };
    }
    function clearPhase() {                            // award capture, advance
        if (!faulted) { score += CAPTURE; captures++; }
    }

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        if (state !== 'play') return;

        boss.move(dt, bounds);
        em.pos.set(boss.pos.x, boss.pos.y);

        // Phase 1 → 2 at 50% HP: capture check, clear, flash, fresh faulted flag.
        if (phase === 0 && boss.hp <= boss.maxHp * 0.5) {
            clearPhase(); phase = 1; cards[1].reset(); enemy.clear(); flash = 0.4; faulted = false;
        }
        cards[phase].step(dt, em, enemy);
        em.step(dt, enemy);

        bhMovePlayer(player, keys, bounds, dt);
        if (keys.bombPressed) bomb();
        bhTickPlayerShots(shots, player, keys.shoot, dt, shotState);
        shots.step(dt);
        bhResolveShotsVsBoss(shots, boss, 9);

        // Boss dead → capture phase 2, win.
        if (boss.hp <= 0) { clearPhase(); state = 'win'; }

        enemy.step(dt);
        invuln = Math.max(0, invuln - dt);
        flash = Math.max(0, flash - dt);
        if (fx) { fx.r += 900 * dt; if (fx.r > bounds.w) fx = null; }

        for (let i = enemy.bullets.length - 1; i >= 0; i--) {
            const b = enemy.bullets[i];
            if (invuln <= 0 && bhHitTest(player, b)) {
                lives--; faulted = true; invuln = 1.5; enemy.clear();
                fx = { x: player.pos.x, y: player.pos.y, r: 0 };
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
        for (const b of enemy.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        for (const s of shots.bullets) bhDrawBullet(ctx, s, BH.ship);
        if (boss.alive) bhDrawBoss(ctx, boss);
        bhDrawHpBar(ctx, bounds, boss.hpFrac, boss.name + '  ·  ' + cards[phase].name, { color: phase === 0 ? BH.bad : BH.warn });
        if (fx) { ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, BH.TAU); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(124,242,200,${Math.max(0, 1 - fx.r / bounds.w).toFixed(2)})`; ctx.stroke(); }
        if (!(invuln > 0 && Math.floor(invuln * 12) % 2 === 0)) bhDrawPlayer(ctx, player);
        if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${(flash * 0.7).toFixed(2)})`; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h); }
        bhFocusHint(ctx, bounds, keys.focused, 'Click · move/Shift · Z shoot · X bomb');

        if (state !== 'play') {
            ctx.fillStyle = 'rgba(7,10,28,0.74)'; ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 40, bounds.w, 80);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = state === 'win' ? BH.good : BH.bad;
            ctx.fillText(state === 'win' ? '🏆 Boss defeated!' : '💥 Game over', bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 - 10);
            ctx.font = '13px monospace'; ctx.fillStyle = BH.text;
            ctx.fillText(`score ${score} · captures ${captures}/2 · ↻ Rematch`, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 16);
        }
        hud.innerHTML = `lives <b style="color:#ff4d6d">${'♥'.repeat(Math.max(0, lives)) || '—'}</b> · `
            + `bombs <b style="color:#7CF2C8">${'✸'.repeat(bombs) || '—'}</b> · `
            + `score <b style="color:#7CF2C8">${score}</b> · `
            + `captures ${captures}/2 ${faulted ? '<span style="color:#ef5350">(this card faulted)</span>' : '<span style="color:#66bb6a">(clean so far)</span>'}`;
    }
    bhLoop(update, render).start();
})();
