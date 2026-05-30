// =============================================================================
// ROGUELIKE — BEGINNER TIER DEMOS ("The Grid & The Turn")
// =============================================================================
// Five demos, each an IIFE that early-returns if its canvas is absent (so this
// one file is safe to include on any page). Teaching order:
//
//   1. gridGlyphDemo   — a grid + ASCII glyphs you can walk around
//   2. turnLoopDemo    — turn-based vs real-time, side by side
//   3. bumpAttackDemo  — one keypress -> move OR attack
//   4. combatLogDemo   — turn order + a scrolling message log + seeded dice
//   5. oneRoomOneRatDemo — the capstone: a complete playable micro-roguelike
//
// DEPENDENCIES (loaded BEFORE this file by beginner.html):
//   ../shared/utils.js   — clearCanvas (and lerp/clamp, unused here)
//   engine/seeded-rng.js — window.RogueRng
//   engine/grid.js       — window.Tile, Level, RL, drawGlyphGrid
//   engine/actors.js     — the shared rl* toolkit: rlKeyToStep, rlTryMove,
//                          rlStepToward, rlInstallCanvasKeys, rlMakeRoom,
//                          rlDrawEntities, rlEntityList, rlHpBar, rlPushFlash,
//                          rlDrawFlashes, rlFocusHint, rlLog, rlManhattan,
//                          rlStepCandidates, rlActorAt
//
// COLLISION NOTE (ARCHITECTURE.md): demo-local names here are all `*Demo` or
// scoped inside the IIFEs, so nothing shadows a shared/utils.js global.
// =============================================================================

// ---- Scroll-to-top (identical on every tier page) --------------------------
(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
        btn.style.opacity = window.pageYOffset > 300 ? '1' : '0';
    });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// =============================================================================
// DEMO 1 — gridGlyphDemo
// A hand-built room. Walk the @ around with the keys; walls stop you. Proves
// the Level + drawGlyphGrid core and the "player is a separate object" idea.
// =============================================================================
(function gridGlyphDemo() {
    const canvas = document.getElementById('rlGridCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 26;
    const W = canvas.width, H = canvas.height;
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell);

    const level = rlMakeRoom(cols, rows);
    // A couple of hand-placed interior walls so there's something to walk around.
    for (let y = 3; y <= 7; y++) level.set(7, y, Tile.WALL);
    for (let x = 10; x <= 14; x++) level.set(x, 4, Tile.WALL);
    level.set(cols - 2, rows - 2, Tile.STAIRS_DOWN);

    const start = { x: 1, y: 1 };
    const player = { x: start.x, y: start.y };
    const hud = document.getElementById('rlGridHud');
    const linesCb = document.getElementById('rlGridLines');
    let last = '—';

    function tileName(t) {
        return t === Tile.WALL ? 'wall' : t === Tile.STAIRS_DOWN ? 'stairs down' : 'floor';
    }
    function updateHud() {
        hud.textContent = `@ at (${player.x}, ${player.y}) · on ${tileName(level.get(player.x, player.y))}`
            + ` · last move: ${last} · keys: arrows / WASD / hjkl`;
    }

    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (action.wait) { last = 'waited'; updateHud(); return; }
        last = rlTryMove(level, player, action, [player]);
        updateHud();
    });
    document.getElementById('rlGridReset').addEventListener('click', () => {
        player.x = start.x; player.y = start.y; last = 'reset'; updateHud(); canvas.focus();
    });
    updateHud();

    function render() {
        clearCanvas(ctx, W, H, RL.bg);
        drawGlyphGrid(ctx, level, { cell, showGrid: linesCb.checked });
        rlDrawEntities(ctx, 0, 0, cell, rlEntityList([player], player));
        rlFocusHint(ctx, W, H, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 2 — turnLoopDemo
// Two copies of the same room. LEFT goblin steps on a timer (real-time); RIGHT
// goblin steps once per player action (turn-based). Sit still to feel the gap.
// =============================================================================
(function turnLoopDemo() {
    const canvas = document.getElementById('rlTurnCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 26, RW = 9, RH = 9;          // 9x9 rooms
    const W = canvas.width, H = canvas.height;
    const gridW = RW * cell, gridH = RH * cell;
    const gap = (W - gridW * 2) / 3;          // even margins between/around the two rooms
    const topY = 30;
    const leftOx = gap, rightOx = gap * 2 + gridW;

    const level = rlMakeRoom(RW, RH);         // identical terrain for both rooms
    const PSTART = { x: 2, y: 4 }, GSTART = { x: 6, y: 4 };
    const player = { x: PSTART.x, y: PSTART.y };
    let gobRT, gobTB, turns, rtSteps, tbSteps;

    function reset() {
        player.x = PSTART.x; player.y = PSTART.y;   // the player must return home too
        gobRT = { x: GSTART.x, y: GSTART.y, caught: false };
        gobTB = { x: GSTART.x, y: GSTART.y, caught: false };
        turns = 0; rtSteps = 0; tbSteps = 0; rtAccum = 0;
        updateHud();
    }
    function gobStep(g) {                       // terrain-only chase; may land ON the player ("caught")
        if (g.caught) return false;
        if (rlManhattan(g, player) === 0) { g.caught = true; return false; }
        for (const c of rlStepCandidates(g, player)) {
            if (level.isWalkable(g.x + c.dx, g.y + c.dy)) {
                g.x += c.dx; g.y += c.dy;
                if (rlManhattan(g, player) === 0) g.caught = true;
                return true;
            }
        }
        return false;
    }
    function updateHud() {
        const hud = document.getElementById('rlTurnHud');
        hud.textContent =
            `your turns: ${turns}  ·  real-time goblin: ${rtSteps} steps`
            + (gobRT.caught ? ' (caught you!)' : ' (moves while you think!)')
            + `  ·  turn-based goblin: ${tbSteps} steps`
            + (gobTB.caught ? ' (caught you!)' : '');
    }

    const focus = rlInstallCanvasKeys(canvas, (action) => {
        // Player movement checks terrain only (the two rooms are identical, and
        // here goblins don't block — being on your tile just means "caught").
        let acted = false;
        if (action.wait) { acted = true; }
        else if (level.isWalkable(player.x + action.dx, player.y + action.dy)) {
            player.x += action.dx; player.y += action.dy; acted = true;
        }
        if (!acted) return;                     // walked into a wall: no turn
        turns++;
        if (gobStep(gobTB)) tbSteps++;          // the turn-based goblin gets exactly one step
        updateHud();
    });
    document.getElementById('rlTurnReset').addEventListener('click', () => { reset(); canvas.focus(); });

    let rtAccum = 0, lastT = performance.now();
    const RT_INTERVAL = 350;                    // ms between real-time goblin steps
    reset();

    function panel(ox, label, labelColor, goblin) {
        ctx.fillStyle = labelColor;
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, ox + gridW / 2, topY - 10);
        drawGlyphGrid(ctx, level, { cell, originX: ox, originY: topY });
        const ents = [{ x: goblin.x, y: goblin.y, ch: 'g', color: goblin.caught ? RL.bad : RL.monster },
                      { x: player.x, y: player.y, ch: '@', color: RL.player }];
        rlDrawEntities(ctx, ox, topY, cell, ents);
    }

    function render(now) {
        const dt = now - lastT; lastT = now;
        // Real-time goblin only advances once the demo is focused (so it doesn't
        // catch you before you've read the instructions), but then it ignores input.
        if (focus.focused && !gobRT.caught) {
            rtAccum += dt;
            while (rtAccum >= RT_INTERVAL) {
                rtAccum -= RT_INTERVAL;
                if (gobStep(gobRT)) { rtSteps++; updateHud(); }
            }
        }
        clearCanvas(ctx, W, H, RL.bg);
        panel(leftOx, 'REAL-TIME', RL.bad, gobRT);
        panel(rightOx, 'TURN-BASED', RL.accent, gobTB);
        rlFocusHint(ctx, W, H, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 3 — bumpAttackDemo
// Passive training dummies. Bumping one attacks it (1d6); empty floor moves.
// Shows the move-or-attack branch and HP bars, no retaliation yet.
// =============================================================================
(function bumpAttackDemo() {
    const canvas = document.getElementById('rlBumpCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 26;
    const W = canvas.width, H = canvas.height;
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
    const level = rlMakeRoom(cols, rows);
    const hud = document.getElementById('rlBumpHud');
    const flashes = [];
    const rng = new RogueRng(20240530);
    let player, dummies, actors;

    function reset() {
        rng.reseed(20240530);
        player = { x: 2, y: Math.floor(rows / 2) };
        dummies = [
            { x: 8, y: 2, hp: 10, maxHp: 10, name: 'dummy' },
            { x: 8, y: rows - 3, hp: 10, maxHp: 10, name: 'dummy' },
            { x: 13, y: Math.floor(rows / 2), hp: 10, maxHp: 10, name: 'dummy' },
        ];
        dummies.forEach(d => { d.ch = 'd'; d.color = RL.monster; });
        actors = [player, ...dummies];
        flashes.length = 0;
        hud.textContent = 'click, then bump a dummy — each hit rolls 1d6';
    }
    function onAttack(attacker, target) {
        const dmg = rng.dice(1, 6);
        target.hp -= dmg;
        rlPushFlash(flashes, target.x, target.y);
        if (target.hp <= 0) {
            target.dead = true;
            hud.textContent = `You hit the ${target.name} for ${dmg}. It is destroyed!`;
        } else {
            hud.textContent = `You hit the ${target.name} for ${dmg}. (${target.hp}/${target.maxHp} HP left)`;
        }
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (action.wait) return;
        rlTryMove(level, player, action, actors, onAttack);
    });
    document.getElementById('rlBumpReset').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render(now) {
        clearCanvas(ctx, W, H, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        rlDrawFlashes(ctx, 0, 0, cell, flashes, now);
        rlDrawEntities(ctx, 0, 0, cell, rlEntityList(actors, player));
        for (const d of dummies) if (!d.dead) rlHpBar(ctx, 0, 0, cell, d.x, d.y, d.hp / d.maxHp, RL.bad);
        rlFocusHint(ctx, W, H, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 4 — combatLogDemo
// A duel with turn order: you act, then the rat acts. A scrolling message log
// narrates it; the seed makes the dice reproducible.
// =============================================================================
(function combatLogDemo() {
    const canvas = document.getElementById('rlLogCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 26;
    const W = canvas.width, H = canvas.height;
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
    const level = rlMakeRoom(cols, rows);
    const panel = document.getElementById('rlLogPanel');
    const hud = document.getElementById('rlLogHud');
    const seedInput = document.getElementById('rlLogSeed');
    const flashes = [];
    let rng, player, rat, actors, turn, over;

    function reset() {
        const seed = Math.max(1, parseInt(seedInput.value, 10) || 1);
        rng = new RogueRng(seed);
        player = { x: 2, y: Math.floor(rows / 2), hp: 20, maxHp: 20, name: 'you' };
        rat = { x: cols - 3, y: Math.floor(rows / 2), hp: 8, maxHp: 8, name: 'rat', ch: 'r', color: RL.monster };
        actors = [player, rat];
        turn = 0; over = false; flashes.length = 0;
        panel.innerHTML = '';
        rlLog(panel, `— A rat blocks your way. (seed ${seed}) —`, 'dim');
        updateHud();
    }
    function updateHud() {
        hud.textContent = `turn ${turn} · you ${Math.max(0, player.hp)}/${player.maxHp} HP · rat ${Math.max(0, rat.hp)}/${rat.maxHp} HP`;
    }
    function playerHit(_, target) {
        if (target !== rat) return;
        const dmg = rng.dice(1, 6);
        rat.hp -= dmg; rlPushFlash(flashes, rat.x, rat.y);
        rlLog(panel, `You hit the rat for ${dmg}.`, 'you');
        if (rat.hp <= 0) { rat.dead = true; over = true; rlLog(panel, 'The rat dies! You win.', 'good'); }
    }
    function ratTurn() {
        if (over || rat.dead || player.dead) return;
        if (rlManhattan(rat, player) === 1) {
            const dmg = rng.dice(1, 4);
            player.hp -= dmg; rlPushFlash(flashes, player.x, player.y);
            rlLog(panel, `The rat bites you for ${dmg}.`, 'mob');
            if (player.hp <= 0) { player.dead = true; over = true; rlLog(panel, 'You die!', 'warn'); }
            return;
        }
        rlTryMove(level, rat, rlStepToward(level, rat, player, actors), actors);
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (over) return;
        let acted = false;
        if (action.wait) { acted = true; rlLog(panel, 'You wait.', 'dim'); }
        else acted = rlTryMove(level, player, action, actors, playerHit) !== 'blocked';
        if (!acted) return;
        if (!over) ratTurn();
        turn++;
        updateHud();
    });
    document.getElementById('rlLogReset').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render(now) {
        clearCanvas(ctx, W, H, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        rlDrawFlashes(ctx, 0, 0, cell, flashes, now);
        rlDrawEntities(ctx, 0, 0, cell, rlEntityList(actors, player));
        if (!rat.dead) rlHpBar(ctx, 0, 0, cell, rat.x, rat.y, rat.hp / rat.maxHp, RL.bad);
        if (!player.dead) rlHpBar(ctx, 0, 0, cell, player.x, player.y, player.hp / player.maxHp, RL.good);
        rlFocusHint(ctx, W, H, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 5 — oneRoomOneRatDemo  (CAPSTONE)
// A room with pillars, a sleeping rat that wakes and hunts you, bump combat
// both ways, a message log, win/lose, and a shareable seed. The whole tier in
// one playable loop.
// =============================================================================
(function oneRoomOneRatDemo() {
    const canvas = document.getElementById('rlCapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 24;
    const W = canvas.width, H = canvas.height;
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
    const log = document.getElementById('rlCapLog');
    const hud = document.getElementById('rlCapHud');
    const seedInput = document.getElementById('rlCapSeed');
    const flashes = [];
    let rng, level, player, rat, actors, turn, state;  // state: 'play' | 'win' | 'dead'

    const PSTART = { x: 2, y: 2 };
    const stairs = { x: cols - 2, y: rows - 2 };

    function buildRoom() {
        level = rlMakeRoom(cols, rows);
        level.set(stairs.x, stairs.y, Tile.STAIRS_DOWN);
        const ratStart = { x: cols - 3, y: rows - 3 };
        // Scatter a few pillars (deterministic from the seed), keeping the
        // player start, the rat start, and the stairs clear.
        const avoid = [PSTART, ratStart, stairs];
        let placed = 0, tries = 0;
        while (placed < 7 && tries < 200) {
            tries++;
            const x = rng.between(2, cols - 3), y = rng.between(2, rows - 3);
            if (avoid.some(p => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1)) continue;
            if (level.get(x, y) !== Tile.FLOOR) continue;
            level.set(x, y, Tile.WALL); placed++;
        }
        return ratStart;
    }
    function reset() {
        const seed = Math.max(1, parseInt(seedInput.value, 10) || 1);
        rng = new RogueRng(seed);
        const ratStart = buildRoom();
        player = { x: PSTART.x, y: PSTART.y, hp: 20, maxHp: 20, name: 'you' };
        rat = { x: ratStart.x, y: ratStart.y, hp: 10, maxHp: 10, name: 'rat',
                ch: 'r', color: RL.monsterCalm, asleep: true, senseRange: 5 };
        actors = [player, rat];
        turn = 0; state = 'play'; flashes.length = 0;
        log.innerHTML = '';
        rlLog(log, `— You enter the room. A rat dozes in the far corner. (seed ${seed}) —`, 'dim');
        rlLog(log, 'Kill it, then take the stairs (>) down.', 'dim');
        updateHud();
    }
    function updateHud() {
        const ratStatus = rat.dead ? 'dead' : rat.asleep ? 'asleep' : 'AWAKE';
        const tail = state === 'win' ? ' · 🏆 you descended — you win!'
                   : state === 'dead' ? ' · 💀 you died — press New room'
                   : rat.dead ? ' · step onto > to descend' : '';
        hud.textContent = `turn ${turn} · you ${Math.max(0, player.hp)}/${player.maxHp} HP`
            + ` · rat ${ratStatus} ${Math.max(0, rat.hp)}/${rat.maxHp}` + tail;
    }
    function playerHit(_, target) {
        if (target !== rat) return;
        const dmg = rng.dice(1, 6);
        rat.hp -= dmg; rlPushFlash(flashes, rat.x, rat.y);
        rlLog(log, `You hit the rat for ${dmg}.`, 'you');
        if (rat.hp <= 0) { rat.dead = true; rlLog(log, 'The rat dies! The way down is clear.', 'good'); }
    }
    function ratTurn() {
        if (rat.dead || player.dead) return;
        const d = rlManhattan(rat, player);
        if (rat.asleep) {
            if (d <= rat.senseRange) { rat.asleep = false; rat.color = RL.monster; rlLog(log, 'The rat notices you!', 'warn'); }
            else return;
        }
        if (d === 1) {
            const dmg = rng.dice(1, 4);
            player.hp -= dmg; rlPushFlash(flashes, player.x, player.y);
            rlLog(log, `The rat bites you for ${dmg}.`, 'mob');
            if (player.hp <= 0) { player.dead = true; state = 'dead'; rlLog(log, 'You die! The dungeon claims another.', 'warn'); }
            return;
        }
        rlTryMove(level, rat, rlStepToward(level, rat, player, actors), actors);
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (state !== 'play') return;
        let acted = false;
        if (action.wait) { acted = true; }
        else acted = rlTryMove(level, player, action, actors, playerHit) !== 'blocked';
        if (!acted) return;

        // Reaching the stairs after the rat is dead = victory.
        if (rat.dead && level.get(player.x, player.y) === Tile.STAIRS_DOWN) {
            state = 'win';
            rlLog(log, 'You descend the stairs into the dark. (You win!)', 'good');
            updateHud();
            return;
        }
        ratTurn();
        turn++;
        updateHud();
    });
    document.getElementById('rlCapRestart').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render(now) {
        clearCanvas(ctx, W, H, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        rlDrawFlashes(ctx, 0, 0, cell, flashes, now);
        rlDrawEntities(ctx, 0, 0, cell, rlEntityList(actors, player));
        if (!rat.dead) rlHpBar(ctx, 0, 0, cell, rat.x, rat.y, rat.hp / rat.maxHp, RL.bad);
        if (!player.dead) rlHpBar(ctx, 0, 0, cell, player.x, player.y, player.hp / player.maxHp, RL.good);
        rlFocusHint(ctx, W, H, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();
