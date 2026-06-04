// =============================================================================
// BULLET HELL — SIMULATIONS TIER DEMOS ("The Whole Game") — the FINALE
// =============================================================================
// Six canvas-guarded IIFEs: the tooling that makes a real danmaku, then the
// grand capstone that switches everything on.
//
//   1. determinismDemo — seeded BHRng: same seed → bit-identical fields
//   2. replayDemo      — record per-tick inputs + seed → reconstruct a run exactly
//   3. editorDemo      — a visual pattern editor that emits spell-card DATA (JSON)
//   4. juiceDemo       — hitstop, screen shake, particles, audio cue (the "feel")
//   5. cancelDemo      — bullet-cancel: clear a card → bullets become score items
//   6. capstoneDemo    — "Danmaku": a complete multi-phase boss rush + replay
//
// DEPENDENCIES (loaded BEFORE this file by simulations.html):
//   ../shared/utils.js, engine/loop.js, engine/render.js, engine/field.js,
//   engine/emitter.js (BHEmitter, bhFireRing, bhFireFan),
//   engine/boss.js   (BHBoss, BHSpellCard — promoted here as the 2nd consumer)
//
// SELF-CONTAINED: re-declares the small collision/UI/player helpers. BHRng +
// BHParticles are this tier's lessons (terminal consumer — they stay inline).
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
// Movement from an explicit axis (so replay can feed recorded inputs, not keys).
function bhApplyMove(player, ax, ay, focus, bounds, dt) {
    const PAD = 12, FULL = 250, FOCUS = 110;
    player.focused = focus;
    const v = new Vector2D(ax, ay);
    if (v.lengthSquared() > 0) v.normalize();
    player.pos.add(v.multiply((focus ? FOCUS : FULL) * dt));
    player.pos.x = clamp(player.pos.x, bounds.x + PAD, bounds.x + bounds.w - PAD);
    player.pos.y = clamp(player.pos.y, bounds.y + PAD, bounds.y + bounds.h - PAD);
}
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
        const s = shots.bullets[i], rr = boss.radius + s.radius;
        if (bhDist2(s.pos, boss.pos) <= rr * rr) { if (boss.alive) boss.hp -= dmg; shots.bullets.splice(i, 1); n++; }
    }
    return n;
}

// =============================================================================
// THE TIER'S LESSONS — a seeded RNG and a particle system.
// =============================================================================

// BHRng — a tiny deterministic PRNG (mulberry32). The SAME seed always produces
// the SAME stream, which is what makes a fixed-timestep sim reproducible. Use it
// for everything the SIMULATION depends on; use Math.random only for cosmetics.
class BHRng {
    constructor(seed = 0x9e3779b9) { this.s = seed >>> 0; }
    reseed(seed) { this.s = seed >>> 0; }
    next() {
        this.s = (this.s + 0x6D2B79F5) >>> 0;
        let t = this.s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.next() * (b - a); }
}

// BHParticles — a small pooled burst system for juice. Purely cosmetic, so it's
// allowed to use Math.random (it never feeds the deterministic sim).
class BHParticles {
    constructor(cap = 500) { this.cap = cap; this.p = []; }
    clear() { this.p.length = 0; }
    burst(x, y, n, color) {
        for (let i = 0; i < n && this.p.length < this.cap; i++) {
            const a = Math.random() * BH.TAU, sp = 40 + Math.random() * 180;
            this.p.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.4 + Math.random() * 0.5, color });
        }
    }
    step(dt) {
        for (let i = this.p.length - 1; i >= 0; i--) {
            const q = this.p[i];
            q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.9; q.vy *= 0.9; q.age += dt;
            if (q.age >= q.life) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); }
        }
    }
    draw(ctx) {
        for (const q of this.p) {
            ctx.globalAlpha = Math.max(0, 1 - q.age / q.life);
            ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, 2.3, 0, BH.TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

// Build a pattern `fire` callback from a plain DATA spec (used by the editor and,
// in principle, by any spell card loaded from JSON).
function bhPatternFromSpec(spec) {
    const n = spec.n, speed = spec.speed, arc = (spec.arc || 0) * Math.PI / 180, k = spec.k || 3;
    switch (spec.type) {
        case 'ring': return (e, f) => bhFireRing(f, e, n, speed);
        case 'fan': return (e, f) => bhFireFan(f, e, n, arc, e.angle, speed, { color: BH.bulletGold });
        case 'aimed': return (e, f) => bhFireFan(f, e, n, arc, Math.PI / 2, speed, { color: BH.bulletGold });
        case 'spiral': return (e, f) => {
            for (let i = 0; i < n; i++) { const a = e.angle + (i / n) * BH.TAU; const v = Vector2D.fromAngle(a, speed); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue }); }
        };
        case 'rose': return (e, f) => {
            const N = 44;
            for (let i = 0; i < N; i++) { const a = e.angle + (i / N) * BH.TAU; const r = Math.abs(Math.cos(k * a)); const v = Vector2D.fromAngle(a, speed * (0.3 + 0.7 * r)); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 3.5, color: BH.bullet }); }
        };
        default: return () => {};
    }
}

// =============================================================================
// 1) determinismDemo — same seed → bit-identical fields
// =============================================================================
(function determinismDemo() {
    const canvas = document.getElementById('bhDetCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const SEED = 1337;
    const Wf = 196, Hf = H - 28, topY = 14;
    const leftX = 14, rightX = W - Wf - 14;
    const desyncCb = document.getElementById('bhDetDesync');
    const hud = document.getElementById('bhDetHud');

    function makeSub(seed) {
        const bounds = { x: 0, y: 0, w: Wf, h: Hf };
        return { bounds, field: new BHField(bounds, { margin: 8 }), rng: new BHRng(seed), t: 0, timer: 0 };
    }
    let A = makeSub(SEED), B = makeSub(SEED);
    document.getElementById('bhDetReseed').addEventListener('click', () => { A = makeSub(SEED); B = makeSub(SEED); });

    function stepSub(sub, useSeeded, dt) {
        sub.t += dt; sub.timer -= dt;
        while (sub.timer <= 0) {
            sub.timer += 0.32;
            // fire a ring whose per-bullet angle + speed are JITTERED by the RNG
            const cx = Wf / 2, cy = 34;
            for (let i = 0; i < 11; i++) {
                const rand = useSeeded ? sub.rng.next() : Math.random();
                const rand2 = useSeeded ? sub.rng.next() : Math.random();
                const a = (i / 11) * BH.TAU + (rand - 0.5) * 0.4;
                const sp = 90 + rand2 * 50;
                const v = Vector2D.fromAngle(a, sp);
                sub.field.spawn(cx, cy, v.x, v.y, { radius: 4, color: BH.bullet });
            }
        }
        sub.field.step(dt);
    }

    function update(dt) {
        stepSub(A, true, dt);
        stepSub(B, !desyncCb.checked, dt);
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        // draw both sub-fields side by side
        for (const [sub, ox] of [[A, leftX], [B, rightX]]) {
            ctx.save(); ctx.translate(ox, topY);
            bhDrawField(ctx, sub.bounds);
            for (const b of sub.field.bullets) bhDrawBullet(ctx, b);
            ctx.fillStyle = BH.bad; ctx.beginPath(); ctx.arc(Wf / 2, 34, 7, 0, BH.TAU); ctx.fill();
            ctx.restore();
        }
        // labels
        ctx.fillStyle = BH.text; ctx.font = '12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('seed ' + SEED, leftX + Wf / 2, topY + Hf + 4);
        ctx.fillText(desyncCb.checked ? 'Math.random()' : 'seed ' + SEED, rightX + Wf / 2, topY + Hf + 4);

        // compare the two fields bullet-for-bullet
        let maxDiff = 0; const m = Math.min(A.field.count, B.field.count);
        for (let i = 0; i < m; i++) maxDiff = Math.max(maxDiff, Math.abs(A.field.bullets[i].pos.x - B.field.bullets[i].pos.x), Math.abs(A.field.bullets[i].pos.y - B.field.bullets[i].pos.y));
        const synced = !desyncCb.checked && A.field.count === B.field.count && maxDiff === 0;
        hud.innerHTML = `count A/B = ${A.field.count}/${B.field.count} · max position diff = `
            + `<b style="color:${synced ? '#66bb6a' : '#ef5350'}">${maxDiff.toFixed(3)}</b> `
            + (synced ? '— bit-identical ✓' : '— diverged (right side is non-deterministic)');
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 2) replayDemo — record inputs + seed → reconstruct the run exactly
// =============================================================================
(function replayDemo() {
    const canvas = document.getElementById('bhReplayCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const SEED = 24601, MAX_TICKS = 360;
    const keys = bhInstallKeys(canvas);
    const hud = document.getElementById('bhReplayHud');

    let rng, field, em, player, mode, tick, inputs, recPath, playPath, fidelity;

    function resetSim() {
        rng = new BHRng(SEED);
        field = new BHField(bounds, { margin: 16 });
        em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + 64, {
            interval: 0.22,
            fire: (e, f) => {                      // RNG-jittered fan → needs the seed to reproduce
                const base = Math.PI / 2 + (rng.next() - 0.5) * 1.2;
                for (let i = 0; i < 5; i++) { const a = base + (i - 2) * 0.16; const v = Vector2D.fromAngle(a, 150 + rng.next() * 40); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bullet }); }
            },
        });
        player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 60), radius: 3, grazeR: 20, focused: false };
        tick = 0;
    }
    function startRecord() { resetSim(); inputs = []; recPath = []; mode = 'record'; fidelity = null; }
    function startReplay() { if (!inputs || !inputs.length) return; resetSim(); playPath = []; mode = 'replay'; }
    resetSim(); inputs = []; mode = 'idle'; fidelity = null;
    document.getElementById('bhReplayRec').addEventListener('click', startRecord);
    document.getElementById('bhReplayPlay').addEventListener('click', startReplay);

    function update(dt) {
        let inp;
        if (mode === 'record') {
            inp = { ax: keys.axis().x, ay: keys.axis().y, focus: keys.focus };
            inputs.push(inp); recPath.push({ x: player.pos.x, y: player.pos.y });
        } else if (mode === 'replay') {
            if (tick >= inputs.length) {                 // replay finished → measure fidelity
                fidelity = 0;
                for (let i = 0; i < playPath.length; i++) fidelity = Math.max(fidelity, Math.abs(playPath[i].x - recPath[i].x), Math.abs(playPath[i].y - recPath[i].y));
                mode = 'idle'; keys.endFrame(); return;
            }
            inp = inputs[tick];
            playPath.push({ x: player.pos.x, y: player.pos.y });
        } else { keys.endFrame(); return; }              // idle: sim paused

        em.step(dt, field);
        field.step(dt);
        bhApplyMove(player, inp.ax, inp.ay, inp.focus, bounds, dt);
        tick++;
        if (mode === 'record' && tick >= MAX_TICKS) mode = 'idle';
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        for (const b of field.bullets) bhDrawBullet(ctx, b);
        ctx.fillStyle = BH.bad; ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 9, 0, BH.TAU); ctx.fill();
        // tint the ship in replay so "ghost" reads
        bhDrawPlayer(ctx, mode === 'replay' ? { pos: player.pos, radius: player.radius, grazeR: player.grazeR, focused: true } : player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click · ● Record, move ~6s, then ▶ Replay');

        const bar = mode === 'idle' ? '' : ` · tick ${tick}/${inputs ? inputs.length || MAX_TICKS : 0}`;
        let tail = '';
        if (mode === 'record') tail = '<span style="color:#ef5350">● RECORDING</span>';
        else if (mode === 'replay') tail = '<span style="color:#4fc3f7">▶ REPLAYING</span>';
        else if (fidelity !== null) tail = `replay matched the recording — max diff <b style="color:#66bb6a">${fidelity.toFixed(3)}</b> ✓`;
        else tail = 'press ● Record';
        hud.innerHTML = `seed ${SEED}${bar} · ${tail}`;
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 3) editorDemo — a visual pattern editor that emits spell-card DATA
// =============================================================================
(function editorDemo() {
    const canvas = document.getElementById('bhEditorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const field = new BHField(bounds, { margin: 16 });
    const typeEl = document.getElementById('bhEditorType');
    const nEl = document.getElementById('bhEditorN');
    const spdEl = document.getElementById('bhEditorSpeed');
    const arcEl = document.getElementById('bhEditorArc');
    const spinEl = document.getElementById('bhEditorSpin');
    const kEl = document.getElementById('bhEditorK');
    const jsonEl = document.getElementById('bhEditorJson');
    const hud = document.getElementById('bhEditorHud');

    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, { interval: 0.3 });

    function spec() {
        return { type: typeEl.value, interval: 0.3, n: +nEl.value, speed: +spdEl.value, arc: +arcEl.value, spin: +spinEl.value, k: +kEl.value };
    }
    function apply() {
        const s = spec();
        em.fire = bhPatternFromSpec(s);
        em.spin = (s.type === 'spiral' || s.type === 'rose') ? s.spin * Math.PI / 180 : 0;
        em.timer = 0; field.clear();
        // the DATA a spell card would store (only the params the type uses)
        const out = { type: s.type, interval: s.interval };
        if (s.type !== 'rose') out.n = s.n;
        out.speed = s.speed;
        if (s.type === 'fan' || s.type === 'aimed') out.arc = s.arc;
        if (s.type === 'spiral' || s.type === 'rose') out.spin = s.spin;
        if (s.type === 'rose') out.k = s.k;
        jsonEl.value = JSON.stringify(out, null, 2);
    }
    [typeEl, nEl, spdEl, arcEl, spinEl, kEl].forEach(el => el.addEventListener('input', apply));
    apply();
    document.getElementById('bhEditorCopy').addEventListener('click', () => {
        jsonEl.select();
        try { navigator.clipboard && navigator.clipboard.writeText(jsonEl.value); } catch (e) { /* ignore */ }
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        hud.textContent = 'copied the pattern JSON to the clipboard ✓';
    });

    function update(dt) { em.step(dt, field); field.step(dt); }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        for (const b of field.bullets) bhDrawBullet(ctx, b);
        ctx.fillStyle = BH.bad; ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 8, 0, BH.TAU); ctx.fill();
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 4) juiceDemo — hitstop, screen shake, particles, audio cue
// =============================================================================
(function juiceDemo() {
    const canvas = document.getElementById('bhJuiceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const keys = bhInstallKeys(canvas);
    const stars = bhMakeStars(bounds, 50);
    const particles = new BHParticles(500);
    const hitstopCb = document.getElementById('bhJuiceHitstop');
    const shakeCb = document.getElementById('bhJuiceShake');
    const partCb = document.getElementById('bhJuiceParticles');
    const audioCb = document.getElementById('bhJuiceAudio');
    const hud = document.getElementById('bhJuiceHud');

    let boss, em, shots, shotState, freeze, trauma, audioFlash, kills;
    function reset() {
        boss = new BHBoss(bounds.x + bounds.w / 2, bounds.y + 70, { maxHp: 120, name: 'DUMMY' });
        em = new BHEmitter(boss.pos.x, boss.pos.y, { interval: 0.5, fire: (e, f) => bhFireRing(f, e, 10, 90) });
        shots = new BHField(bounds, { margin: 16 }); shotState = { cd: 0 };
        freeze = 0; trauma = 0; audioFlash = 0; kills = 0;
    }
    reset();
    const player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 20, focused: false };
    const enemy = new BHField(bounds, { margin: 16 });

    function bigJuice(x, y) {                               // a "kill" feels weighty
        if (hitstopCb.checked) freeze = 0.12;
        if (shakeCb.checked) trauma = Math.min(1, trauma + 0.8);
        if (partCb.checked) particles.burst(x, y, 36, BH.warn);
        if (audioCb.checked) audioFlash = 0.25;
    }

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        particles.step(dt);                                 // cosmetics run even during hitstop
        trauma = Math.max(0, trauma - dt * 1.6);
        audioFlash = Math.max(0, audioFlash - dt);
        if (freeze > 0) { freeze -= dt; keys.endFrame(); return; }  // HITSTOP: pause the sim

        boss.move(dt, bounds); em.pos.set(boss.pos.x, boss.pos.y);
        if (boss.alive) em.step(dt, enemy);
        enemy.step(dt);
        bhApplyMove(player, keys.axis().x, keys.axis().y, keys.focus, bounds, dt);
        bhTickPlayerShots(shots, player, keys.shoot, dt, shotState);
        shots.step(dt);
        const hit = bhResolveShotsVsBoss(shots, boss, 6);
        if (hit && partCb.checked) particles.burst(boss.pos.x, boss.pos.y, 2, BH.bulletGold);
        if (!boss.alive) { kills++; bigJuice(boss.pos.x, boss.pos.y); boss.hp = boss.maxHp; }  // respawn
        keys.endFrame();
    }
    function render() {
        const sx = shakeCb.checked ? (Math.random() - 0.5) * trauma * trauma * 22 : 0;
        const sy = shakeCb.checked ? (Math.random() - 0.5) * trauma * trauma * 22 : 0;
        clearCanvas(ctx, W, H, BH.bg);
        ctx.save(); ctx.translate(sx, sy);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b);
        for (const s of shots.bullets) bhDrawBullet(ctx, s, BH.ship);
        if (boss.alive) bhDrawBoss(ctx, boss);
        bhDrawHpBar(ctx, bounds, boss.hpFrac, boss.name);
        particles.draw(ctx);
        bhDrawPlayer(ctx, player);
        ctx.restore();
        if (audioFlash > 0) { ctx.fillStyle = BH.accent; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.globalAlpha = audioFlash / 0.25; ctx.fillText('♪', bounds.x + 12, bounds.y + 34); ctx.globalAlpha = 1; }
        bhFocusHint(ctx, bounds, keys.focused, 'Click · Z to shoot the dummy down · toggle the juice');
        hud.innerHTML = `kills ${kills} · toggle <b>hitstop / shake / particles / ♪</b> and feel the difference` + (freeze > 0 ? ' · <span style="color:#ffd166">FREEZE</span>' : '');
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 5) cancelDemo — bullet-cancel: clear a card → bullets become score items
// =============================================================================
(function cancelDemo() {
    const canvas = document.getElementById('bhCancelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const keys = bhInstallKeys(canvas);
    const hud = document.getElementById('bhCancelHud');
    const enemy = new BHField(bounds, { margin: 16 });
    const player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 56), radius: 3, grazeR: 20, focused: false };
    const em = new BHEmitter(bounds.x + bounds.w / 2, bounds.y + 70, { interval: 0.05, spin: 2.2, fire: (e, f) => { for (let k = 0; k < 3; k++) { const a = e.angle + (k / 3) * BH.TAU; const v = Vector2D.fromAngle(a, 130); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bullet }); } } });
    let items = [], score = 0, lastCancel = 0;

    function cancel() {
        lastCancel = enemy.count;
        for (const b of enemy.bullets) items.push({ x: b.pos.x, y: b.pos.y, vy: -120 - Math.random() * 90, age: 0, life: 0.9 });
        score += enemy.count * 50;                          // bullets → points
        enemy.clear();
    }
    document.getElementById('bhCancelBtn').addEventListener('click', cancel);

    function update(dt) {
        em.step(dt, enemy); enemy.step(dt);
        bhApplyMove(player, keys.axis().x, keys.axis().y, keys.focus, bounds, dt);
        for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; it.y += it.vy * dt; it.vy *= 0.96; it.age += dt; if (it.age >= it.life) items.splice(i, 1); }
        keys.endFrame();
    }
    function render() {
        clearCanvas(ctx, W, H, BH.bg);
        bhDrawField(ctx, bounds);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b);
        ctx.fillStyle = BH.target; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const it of items) { ctx.globalAlpha = Math.max(0, 1 - it.age / it.life); ctx.fillText('✦', it.x, it.y); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = BH.bad; ctx.beginPath(); ctx.arc(em.pos.x, em.pos.y, 9, 0, BH.TAU); ctx.fill();
        bhDrawPlayer(ctx, player);
        bhFocusHint(ctx, bounds, keys.focused, 'Click to move · press "Cancel" to cash the screen in');
        hud.innerHTML = `live bullets ${enemy.count} · score <b style="color:#7CF2C8">${score}</b>`
            + (lastCancel ? ` · last cancel: <b style="color:#ffd166">${lastCancel}</b> bullets → +${lastCancel * 50}` : '');
    }
    bhLoop(update, render).start();
})();

// =============================================================================
// 6) capstoneDemo — "Danmaku": a complete multi-phase boss rush + replay
// =============================================================================
(function capstoneDemo() {
    const canvas = document.getElementById('bhDanmakuCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const bounds = { x: 12, y: 12, w: W - 24, h: H - 24 };
    const SEED = 777;
    const keys = bhInstallKeys(canvas);
    const stars = bhMakeStars(bounds, 70);
    const particles = new BHParticles(600);
    const hud = document.getElementById('bhDanmakuHud');

    let rng, boss, player, em, cards, phase, lives, bombs, score, captures, faulted;
    let invuln, freeze, trauma, fx, flash, state, enemy, shots, items, shotState;
    let inputs, ip, recording, mode;

    // Two phases, written as spell-card DATA. Jitter uses the SEEDED rng so the
    // whole fight is reproducible from (seed + recorded inputs).
    function makeCards() {
        return [
            new BHSpellCard({ name: 'Opening — Spiral & Aim', steps: [
                { at: 0, label: 'spiral+aim', set: { spin: 1.6, interval: 0.09, fire: (e, f) => {
                    for (let k = 0; k < 3; k++) { const a = e.angle + (k / 3) * BH.TAU; const v = Vector2D.fromAngle(a, 120); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bulletBlue }); }
                    if (rng.next() < 0.35) { const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x); bhFireFan(f, e, 3, 0.4, aim, 185, { color: BH.bulletGold }); }
                } } },
            ] }),
            new BHSpellCard({ name: 'Finale — Ring Storm', steps: [
                { at: 0, label: 'jittered rings', set: { spin: 0.8, interval: 0.34, fire: (e, f) => {
                    const jitter = (rng.next() - 0.5) * 0.3;
                    for (let i = 0; i < 18; i++) { const a = e.angle + jitter + (i / 18) * BH.TAU; const v = Vector2D.fromAngle(a, 110 + rng.next() * 30); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bullet }); }
                } } },
                { at: 3, label: 'rings + aimed', set: { interval: 0.3, fire: (e, f) => {
                    for (let i = 0; i < 18; i++) { const a = e.angle + (i / 18) * BH.TAU; const v = Vector2D.fromAngle(a, 120); f.spawn(e.pos.x, e.pos.y, v.x, v.y, { radius: 4, color: BH.bullet }); }
                    const aim = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x); bhFireFan(f, e, 5, 0.5, aim, 200, { color: BH.bulletGold });
                } } },
            ] }),
        ];
    }
    function applyPhase(i) { const c = cards[i]; c.reset(); /* emitter knobs set by the card's at:0 step */ enemy.clear(); }
    function cancelToItems() { for (const b of enemy.bullets) items.push({ x: b.pos.x, y: b.pos.y, vy: -110 - Math.random() * 90, age: 0, life: 0.9 }); score += enemy.count * 40; enemy.clear(); }
    function clearPhaseBonus() { if (!faulted) { score += 20000; captures++; } }

    function reset(forReplay) {
        rng = new BHRng(SEED);
        boss = new BHBoss(bounds.x + bounds.w / 2, bounds.y + 76, { maxHp: 1200, name: 'TWIN STAR', sway: 0.26 });
        player = { pos: new Vector2D(bounds.x + bounds.w / 2, bounds.y + bounds.h - 60), radius: 3, grazeR: 20, focused: false };
        em = new BHEmitter(boss.pos.x, boss.pos.y, {});
        // create the fields BEFORE applyPhase (which clears `enemy`)
        enemy = enemy || new BHField(bounds, { margin: 18 }); enemy.clear();
        shots = shots || new BHField(bounds, { margin: 18 }); shots.clear();
        items = []; shotState = { cd: 0 }; particles.clear();
        cards = makeCards(); phase = 0; applyPhase(0);
        lives = 3; bombs = 2; score = 0; captures = 0; faulted = false;
        invuln = 0; freeze = 0; trauma = 0; fx = null; flash = 0;
        ip = 0;
        if (forReplay) { mode = 'replay'; recording = false; state = 'play'; }
        else { mode = 'play'; recording = true; inputs = []; state = 'play'; }
    }
    reset(false);
    document.getElementById('bhDanmakuReset').addEventListener('click', () => reset(false));
    document.getElementById('bhDanmakuReplay').addEventListener('click', () => { if (inputs && inputs.length) reset(true); });

    function update(dt) {
        bhUpdateStars(stars, bounds, dt);
        particles.step(dt);
        trauma = Math.max(0, trauma - dt * 1.5);
        flash = Math.max(0, flash - dt);
        if (fx) { fx.r += 900 * dt; if (fx.r > bounds.w) fx = null; }
        for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; it.y += it.vy * dt; it.vy *= 0.96; it.age += dt; if (it.age >= it.life) items.splice(i, 1); }

        if (state !== 'play') { keys.endFrame(); return; }
        if (freeze > 0) { freeze -= dt; keys.endFrame(); return; }      // HITSTOP — sim paused, inputs not consumed

        // ---- gather this tick's input (live → record; replay → playback) ----
        let inp;
        if (mode === 'replay') {
            if (ip >= inputs.length) { state = boss.hp <= 0 ? 'win' : 'lose'; keys.endFrame(); return; }
            inp = inputs[ip++];
        } else {
            inp = { ax: keys.axis().x, ay: keys.axis().y, focus: keys.focus, shoot: keys.shoot, bomb: keys.bombPressed };
            if (recording) inputs.push(inp);
            ip++;
        }

        // ---- the deterministic simulation ----
        boss.move(dt, bounds); em.pos.set(boss.pos.x, boss.pos.y);
        if (phase === 0 && boss.hp <= boss.maxHp * 0.5) {           // phase 1 → 2
            clearPhaseBonus(); cancelToItems(); phase = 1; applyPhase(1);
            faulted = false; freeze = 0.14; trauma = Math.min(1, trauma + 0.7); flash = 0.4;
            particles.burst(boss.pos.x, boss.pos.y, 30, BH.warn);
        }
        cards[phase].step(dt, em, enemy); em.step(dt, enemy);

        bhApplyMove(player, inp.ax, inp.ay, inp.focus, bounds, dt);
        bhTickPlayerShots(shots, player, inp.shoot, dt, shotState);
        shots.step(dt);
        if (bhResolveShotsVsBoss(shots, boss, 7) && Math.random() < 0.5) particles.burst(boss.pos.x, boss.pos.y, 1, BH.bulletGold);
        if (boss.hp <= 0) { clearPhaseBonus(); cancelToItems(); state = 'win'; recording = false; freeze = 0.22; trauma = 1; particles.burst(boss.pos.x, boss.pos.y, 60, BH.warn); }

        enemy.step(dt);
        invuln = Math.max(0, invuln - dt);
        if (inp.bomb && bombs > 0) { bombs--; faulted = true; invuln = 1.6; trauma = Math.min(1, trauma + 0.6); fx = { x: player.pos.x, y: player.pos.y, r: 0 }; cancelToItems(); }
        for (let i = enemy.bullets.length - 1; i >= 0; i--) {
            const b = enemy.bullets[i];
            if (invuln <= 0 && bhHitTest(player, b)) {
                lives--; faulted = true; invuln = 1.5; freeze = 0.1; trauma = Math.min(1, trauma + 0.6);
                particles.burst(player.pos.x, player.pos.y, 24, BH.bad); cancelToItems();
                if (lives <= 0) { state = 'lose'; recording = false; }
                break;
            }
            if (!b.grazed && bhGrazeTest(player, b)) { b.grazed = true; score += 100; }
        }
        keys.endFrame();
    }
    function render() {
        const sx = (Math.random() - 0.5) * trauma * trauma * 20, sy = (Math.random() - 0.5) * trauma * trauma * 20;
        clearCanvas(ctx, W, H, BH.bg);
        ctx.save(); ctx.translate(sx, sy);
        bhDrawField(ctx, bounds);
        bhDrawStars(ctx, stars);
        for (const b of enemy.bullets) bhDrawBullet(ctx, b, b.grazed ? BH.bulletGold : undefined);
        for (const s of shots.bullets) bhDrawBullet(ctx, s, BH.ship);
        ctx.fillStyle = BH.target; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const it of items) { ctx.globalAlpha = Math.max(0, 1 - it.age / it.life); ctx.fillText('✦', it.x, it.y); }
        ctx.globalAlpha = 1;
        if (boss.alive) bhDrawBoss(ctx, boss);
        bhDrawHpBar(ctx, bounds, boss.hpFrac, boss.name + '  ·  ' + cards[phase].name, { color: phase === 0 ? BH.bad : BH.warn });
        if (fx) { ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, BH.TAU); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(124,242,200,${Math.max(0, 1 - fx.r / bounds.w).toFixed(2)})`; ctx.stroke(); }
        particles.draw(ctx);
        if (!(invuln > 0 && Math.floor(invuln * 12) % 2 === 0)) bhDrawPlayer(ctx, player);
        if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${(flash * 0.7).toFixed(2)})`; ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h); }
        ctx.restore();

        bhFocusHint(ctx, bounds, keys.focused, 'Click · move/Shift · Z shoot · X bomb');
        if (state !== 'play') {
            ctx.fillStyle = 'rgba(7,10,28,0.76)'; ctx.fillRect(bounds.x, bounds.y + bounds.h / 2 - 42, bounds.w, 84);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 24px sans-serif';
            ctx.fillStyle = state === 'win' ? BH.good : BH.bad;
            ctx.fillText(state === 'win' ? '🏆 DANMAKU CLEARED' : '💥 Game Over', bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 - 12);
            ctx.font = '13px monospace'; ctx.fillStyle = BH.text;
            ctx.fillText(`score ${score} · captures ${captures}/2 · ↻ New  /  ▶ Replay`, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2 + 16);
        }
        const modeTag = mode === 'replay' ? '<span style="color:#4fc3f7">▶ REPLAY</span>' : '<span style="color:#66bb6a">● live</span>';
        hud.innerHTML = `${modeTag} · lives <b style="color:#ff4d6d">${'♥'.repeat(Math.max(0, lives)) || '—'}</b>`
            + ` · bombs <b style="color:#7CF2C8">${'✸'.repeat(bombs) || '—'}</b> · score <b style="color:#7CF2C8">${score}</b> · `
            + `captures ${captures}/2 · HP ${Math.max(0, Math.ceil(boss.hp))}`;
    }
    bhLoop(update, render).start();
})();
