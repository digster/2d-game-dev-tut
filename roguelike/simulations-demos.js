// =============================================================================
// ROGUELIKE — SIMULATIONS TIER DEMOS ("The Whole Dungeon")
// =============================================================================
// The finale. Three teaching demos + the grand capstone that assembles every
// system the track built. Cave generation + level themes are this tier's
// lesson (top-level, testable); everything else comes from engine/.
//
//   caCave / caStep / wallNeighbours   — cellular-automata caves
//   THEMES / themeForDepth / generateThemed — depth → recipe
//
// DEPENDENCIES (loaded BEFORE this file by simulations.html):
//   shared/utils.js, engine/{seeded-rng,grid,actors,dungeon,vision,rpg}.js
//   (rpg.js gives Item/ACTION/attackDice/defenseOf/status*/speedOf/applyConsumable)
// =============================================================================

(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

// =============================================================================
// CAVE + THEME TOOLKIT (this tier's lesson)
// =============================================================================
function wallNeighbours(level, x, y) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
            if (!(dx === 0 && dy === 0) && level.get(x + dx, y + dy) === Tile.WALL) n++;
    return n;
}
function caStep(level) {
    const next = level.clone();
    for (let y = 1; y < level.height - 1; y++)
        for (let x = 1; x < level.width - 1; x++) {
            // Count the full 3x3 Moore neighbourhood INCLUDING the cell itself
            // (5-of-9 majority). This is the stable rule — it condenses noise
            // into caves; the 8-neighbour-only version erodes walls to nothing.
            const walls = wallNeighbours(level, x, y) + (level.get(x, y) === Tile.WALL ? 1 : 0);
            next.set(x, y, walls >= 5 ? Tile.WALL : Tile.FLOOR);
        }
    return next;
}
function caSeedNoise(level, rng, fill) {
    for (let y = 1; y < level.height - 1; y++)
        for (let x = 1; x < level.width - 1; x++)
            level.set(x, y, rng.next() < fill ? Tile.WALL : Tile.FLOOR);
}
function caCave(w, h, rng, { fill, iterations, connect = true }) {
    let level = new Level(w, h, Tile.WALL);
    caSeedNoise(level, rng, fill);
    for (let i = 0; i < iterations; i++) level = caStep(level);
    if (connect) dgKeepLargest(level);
    return level;
}

// Depth → recipe (generator + palette tint + monster table).
const THEMES = [
    { name: 'Upper Halls', maxDepth: 3, gen: 'rooms', tint: null, mobs: ['rat', 'kobold'] },
    { name: 'The Caverns', maxDepth: 6, gen: 'cave', tint: '#1a130a', mobs: ['bat', 'snake'] },
    { name: 'The Deep', maxDepth: 99, gen: 'cave', tint: '#160a14', mobs: ['ogre', 'wraith'] },
];
function themeForDepth(d) { return THEMES.find(t => d <= t.maxDepth) || THEMES[THEMES.length - 1]; }

// One entry point: pick the generator from the recipe; return level+spawn+stairs.
function generateThemed(w, h, rng, depth) {
    const theme = themeForDepth(depth);
    if (theme.gen === 'cave') {
        const level = caCave(w, h, rng, { fill: 0.45, iterations: 5 });
        const spawn = dgRandomFloorTile(level, rng);
        const dist = dijkstraFrom(level, [spawn]);          // stairs = farthest reachable tile
        let best = -1, sx = spawn.x, sy = spawn.y;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const d = dist[level.idx(x, y)];
            if (d !== Infinity && d > best) { best = d; sx = x; sy = y; }
        }
        level.set(sx, sy, Tile.STAIRS_DOWN);
        return { level, theme, spawn, stairs: { x: sx, y: sy } };
    }
    const d = generateDungeon(w, h, rng, { attempts: 30, minSize: 4, maxSize: 7 });
    return { level: d.level, theme, spawn: d.spawn, stairs: d.stairs };
}
function readSimSeed(el) { return Math.max(1, parseInt(el.value, 10) || 1); }

// =============================================================================
// DEMO 1 — cellularCaveDemo : watch random noise condense into caves
// =============================================================================
(function cellularCaveDemo() {
    const canvas = document.getElementById('rlCaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 14, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlCaSeed');
    const fillEl = document.getElementById('rlCaFill'), fillVal = document.getElementById('rlCaFillVal');
    const itersEl = document.getElementById('rlCaIters'), itersVal = document.getElementById('rlCaItersVal');
    const connectEl = document.getElementById('rlCaConnect');
    const hud = document.getElementById('rlCaHud');
    let level, iter, total, connected, accum;

    function start() {
        fillVal.textContent = fillEl.value + '%'; itersVal.textContent = itersEl.value;
        const rng = new RogueRng(readSimSeed(seedEl));
        level = new Level(cols, rows, Tile.WALL);
        caSeedNoise(level, rng, (+fillEl.value) / 100);
        iter = 0; total = +itersEl.value; connected = false; accum = 0;
        updateHud();
    }
    function updateHud() {
        const interior = (cols - 2) * (rows - 2);
        const pct = Math.round(100 * level.count(Tile.FLOOR) / interior);
        const regions = (iter >= total) ? dgRegions(level).length : '…';
        hud.textContent = `iteration ${Math.min(iter, total)}/${total} · floor ${pct}%`
            + ` · regions ${connected ? 1 : regions}` + (iter >= total ? (connected ? ' · connected ✓' : '') : ' · smoothing…');
    }
    [fillEl, itersEl].forEach(el => el.addEventListener('input', start));
    connectEl.addEventListener('change', start);
    seedEl.addEventListener('change', start);
    document.getElementById('rlCaGen').addEventListener('click', start);
    start();

    function render() {
        accum++;
        if (iter < total && accum % 12 === 0) { level = caStep(level); iter++; updateHud(); }
        else if (iter >= total && connectEl.checked && !connected) { dgKeepLargest(level); connected = true; updateHud(); }
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 2 — themesDemo : the depth → recipe table in action
// =============================================================================
(function themesDemo() {
    const canvas = document.getElementById('rlThemeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 14, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlThemeSeed');
    const depthEl = document.getElementById('rlThemeDepth'), depthVal = document.getElementById('rlThemeDepthVal');
    const hud = document.getElementById('rlThemeHud');
    let level, theme, spawn, stairs;

    function gen() {
        depthVal.textContent = depthEl.value;
        const depth = +depthEl.value;
        const rng = new RogueRng(readSimSeed(seedEl) + depth * 1009);
        const r = generateThemed(cols, rows, rng, depth);
        level = r.level; theme = r.theme; spawn = r.spawn; stairs = r.stairs;
        hud.textContent = `depth ${depth} · theme "${theme.name}" · generator: ${theme.gen}`
            + ` · monsters: ${theme.mobs.join(' / ')}`;
        draw();
    }
    function draw() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (theme.tint) { ctx.globalAlpha = 0.35; ctx.fillStyle = theme.tint; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
        rlDrawEntities(ctx, 0, 0, cell, [{ x: spawn.x, y: spawn.y, ch: '@', color: RL.player }]);
    }
    depthEl.addEventListener('input', gen);
    seedEl.addEventListener('change', gen);
    document.getElementById('rlThemeGen').addEventListener('click', gen);
    gen();
})();

// =============================================================================
// DEMO 3 — determinismDemo : same seed + same inputs ⇒ bit-identical
// =============================================================================
(function determinismDemo() {
    const canvas = document.getElementById('rlDetCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlDetSeed');
    const hud = document.getElementById('rlDetHud');
    const result = document.getElementById('rlDetResult');
    let live, recording;

    // A small, fully deterministic sim: a pure function of (seed, actions).
    function buildSim(seed) {
        const rng = new RogueRng(seed);
        const d = generateDungeon(cols, rows, rng, { attempts: 20, minSize: 4, maxSize: 6 });
        const player = { x: d.spawn.x, y: d.spawn.y, hp: 20, maxHp: 20, name: 'you' };
        const rats = [];
        for (let i = 0; i < 2; i++) { const p = dgRandomFloorTile(d.level, rng); rats.push({ x: p.x, y: p.y, hp: 5, maxHp: 5, name: 'rat', ch: 'r', color: RL.monster }); }
        return { rng, level: d.level, player, rats, actors: [player, ...rats], turn: 0 };
    }
    function step(sim, action) {                     // ALL randomness from sim.rng → reproducible
        if (action.wait) { /* pass */ }
        else rlTryMove(sim.level, sim.player, action, sim.actors, (_, t) => {
            const dmg = sim.rng.dice(1, 4); t.hp -= dmg; if (t.hp <= 0) t.dead = true;
        });
        for (const r of sim.rats) {
            if (r.dead) continue;
            if (rlManhattan(r, sim.player) === 1) { sim.player.hp -= sim.rng.dice(1, 3); if (sim.player.hp <= 0) sim.player.dead = true; }
            else if (losLine(sim.level, r.x, r.y, sim.player.x, sim.player.y).clear)
                rlTryMove(sim.level, r, rlStepToward(sim.level, r, sim.player, sim.actors), sim.actors);
            else { const s = sim.rng.pick(VIS_DIRS4); rlTryMove(sim.level, r, { dx: s[0], dy: s[1] }, sim.actors); }
        }
        sim.turn++;
    }
    function hash(sim) {
        return `${sim.turn}|@${sim.player.x},${sim.player.y},${sim.player.hp}|`
            + sim.rats.map(r => `${r.x},${r.y},${r.hp},${r.dead ? 1 : 0}`).join(';');
    }
    function reset() {
        live = buildSim(readSimSeed(seedEl));
        recording = [];
        result.textContent = '— no replay yet —'; result.style.color = '#c9d1d9';
        updateHud();
    }
    function updateHud() {
        hud.textContent = `turn ${live.turn} · HP ${Math.max(0, live.player.hp)}/20 · recorded ${recording.length} actions · move to play`;
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (live.player.dead) return;
        recording.push(action);
        step(live, action);
        updateHud();
    });
    document.getElementById('rlDetReset').addEventListener('click', () => { reset(); canvas.focus(); });
    document.getElementById('rlDetReplay').addEventListener('click', () => {
        const replay = buildSim(readSimSeed(seedEl));      // fresh sim, same seed
        for (const a of recording) step(replay, a);         // same inputs
        const a = hash(live), b = hash(replay);
        if (a === b) { result.style.color = '#66bb6a'; result.innerHTML = `✓ bit-identical after ${recording.length} actions<br><span style="color:#6b7488">${b}</span>`; }
        else { result.style.color = '#ef5350'; result.innerHTML = `✗ MISMATCH<br>live:&nbsp;&nbsp;${a}<br>replay: ${b}`; }
    });
    seedEl.addEventListener('change', () => reset());
    reset();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, live.level, { cell });
        rlDrawEntities(ctx, 0, 0, cell, rlEntityList(live.actors, live.player));
        for (const r of live.rats) if (!r.dead) rlHpBar(ctx, 0, 0, cell, r.x, r.y, r.hp / r.maxHp, RL.bad);
        if (!live.player.dead) rlHpBar(ctx, 0, 0, cell, live.player.x, live.player.y, live.player.hp / live.player.maxHp, RL.good);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 4 — theDescentDemo : GRAND CAPSTONE — the complete roguelike
// =============================================================================
(function theDescentDemo() {
    const canvas = document.getElementById('rlDescentCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const log = document.getElementById('rlDescentLog');
    const hud = document.getElementById('rlDescentHud');
    const invEl = document.getElementById('rlDescentInv');
    const seedEl = document.getElementById('rlDescentSeed');
    const flashes = [];
    const DEPTH_GOAL = 8, RADIUS = 8, SIGHT = 9;
    // Monster archetypes referenced by the theme tables.
    const BESTIARY = {
        rat: { ch: 'r', hp: 6, speed: 100, dice: [1, 3], poison: false },
        kobold: { ch: 'k', hp: 7, speed: 110, dice: [1, 4], poison: false },
        bat: { ch: 'b', hp: 5, speed: 150, dice: [1, 3], poison: false },
        snake: { ch: 's', hp: 7, speed: 170, dice: [1, 3], poison: true },
        ogre: { ch: 'O', hp: 16, speed: 80, dice: [1, 8], poison: false },
        wraith: { ch: 'w', hp: 12, speed: 120, dice: [1, 6], poison: false },
    };
    let baseSeed, rng, level, theme, player, monsters, actors, stairs, floorItems, vis, explored, scent, depth, turn, kills, state;

    function recompute() {
        vis = computeFOV(level, player.x, player.y, RADIUS);
        for (let i = 0; i < vis.length; i++) if (vis[i]) explored[i] = 1;
        scent = dijkstraFrom(level, [player]);
    }
    function genLevel() {
        rng = new RogueRng(baseSeed * 1000 + depth);
        const r = generateThemed(cols, rows, rng, depth);
        level = r.level; theme = r.theme; stairs = r.stairs;
        player.x = r.spawn.x; player.y = r.spawn.y; player.energy = ACTION;
        // Loot: a little on every floor, scaled by depth.
        floorItems = [];
        const loot = [];
        if (depth % 2 === 1) loot.push(mkWeapon(rng.pick(['dagger', 'short sword', 'war axe']), [1, 4 + depth]));
        if (depth % 3 === 0) loot.push(mkArmor(rng.pick(['leather armor', 'chain mail']), 1 + (depth >> 2)));
        loot.push(mkPotion(rng.pick(['murky', 'fizzy', 'glowing']) + ' potion', rng.pick(['#ab47bc', '#4fc3f7', '#66bb6a']), rng.pick(['heal', 'regen', 'haste']), 8 + depth));
        for (const it of loot) { const p = dgRandomFloorTile(level, rng); floorItems.push({ x: p.x, y: p.y, item: it }); }
        // Monsters: drawn from this depth's theme table, count grows with depth.
        monsters = [];
        const count = 2 + Math.min(5, depth);
        for (let i = 0; i < count; i++) {
            const def = BESTIARY[rng.pick(theme.mobs)];
            const p = dgRandomFloorTile(level, rng);
            if (p.x === player.x && p.y === player.y) continue;
            monsters.push({ ...def, name: Object.keys(BESTIARY).find(k => BESTIARY[k] === def), x: p.x, y: p.y, maxHp: def.hp, energy: 0, awake: false, color: RL.monsterCalm });
        }
        actors = [player, ...monsters];
        explored = new Uint8Array(level.width * level.height);
        recompute();
    }
    function reset() {
        baseSeed = readSimSeed(seedEl);
        depth = 1; turn = 0; kills = 0; state = 'play';
        player = { x: 0, y: 0, hp: 30, maxHp: 30, baseAtk: 1, baseSpeed: 100, energy: ACTION, equip: { weapon: null, armor: null }, inv: [], statuses: [], name: 'you' };
        genLevel();
        log.innerHTML = '';
        rlLog(log, `— The Descent. (seed ${baseSeed}) Reach depth ${DEPTH_GOAL} to escape. —`, 'dim');
        rlLog(log, `Depth 1 · ${theme.name}. Walk onto loot; 1–9 to equip/quaff; > on stairs to descend.`, 'dim');
        refreshInv(); updateHud();
    }
    function refreshInv() {
        if (!player.inv.length) { invEl.innerHTML = '<div class="muted">(empty)</div>'; return; }
        invEl.innerHTML = player.inv.map((it, i) => {
            const eq = (player.equip.weapon === it || player.equip.armor === it) ? ' <span class="eq">[E]</span>' : '';
            const sub = it.has('weapon') ? it.get('weapon').dice.join('d') : it.has('armor') ? 'def +' + it.get('armor').def : 'drink';
            return `<div class="row"><span class="key">${i + 1})</span><span style="color:${it.color}">${it.glyph}</span> <span>${it.name}</span> <span class="muted">${sub}</span>${eq}</div>`;
        }).join('');
    }
    function score() { return depth * 100 + kills * 25 + Math.max(0, player.hp) * 2; }
    function updateHud() {
        const [n, s] = attackDice(player);
        const tail = state === 'win' ? ` · 🏆 escaped! score ${score()}` : state === 'dead' ? ` · 💀 died at depth ${depth} · score ${score()}` : '';
        hud.textContent = `depth ${depth}/${DEPTH_GOAL} (${theme.name}) · turn ${turn} · HP ${Math.max(0, player.hp)}/${player.maxHp}`
            + ` · atk ${player.baseAtk}+${n}d${s} def ${defenseOf(player)} · kills ${kills} · ${statusText(player)}` + tail;
    }
    function useItem(i) {
        const it = player.inv[i];
        if (!it || state !== 'play') return;
        if (it.has('equip')) {
            const slot = it.get('equip').slot;
            player.equip[slot] = (player.equip[slot] === it) ? null : it;
            rlLog(log, `${player.equip[slot] === it ? 'You equip' : 'You remove'} the ${it.name}.`, 'you');
        } else if (it.has('consume')) {
            const c = it.get('consume');
            rlLog(log, `You quaff the ${it.name}. ${applyConsumable(player, c.effect, c.power)}`, c.effect === 'poison' ? 'mob' : 'good');
            player.inv.splice(i, 1);
        }
        refreshInv(); updateHud();
    }
    function playerAttack(_, target) {
        const [n, s] = attackDice(player);
        const dmg = player.baseAtk + rng.dice(n, s);
        target.hp -= dmg; rlPushFlash(flashes, target.x, target.y);
        rlLog(log, `You hit the ${target.name} for ${dmg}.`, 'you');
        if (target.hp <= 0) { target.dead = true; kills++; rlLog(log, `The ${target.name} dies.`, 'good'); }
    }
    function monsterAct(m) {
        if (m.dead || player.dead || state !== 'play') return;
        if (losLine(level, m.x, m.y, player.x, player.y).clear && rlManhattan(m, player) <= SIGHT) { m.awake = true; m.color = RL.monster; }
        if (!m.awake) return;
        if (rlManhattan(m, player) === 1) {
            const dmg = Math.max(1, rng.dice(m.dice[0], m.dice[1]) - defenseOf(player));
            player.hp -= dmg; rlPushFlash(flashes, player.x, player.y);
            rlLog(log, `The ${m.name} hits you for ${dmg}.`, 'mob');
            if (m.poison) { addStatus(player, 'poison', 4, 1); rlLog(log, 'You are poisoned!', 'warn'); }
            if (player.hp <= 0) { player.dead = true; state = 'dead'; rlLog(log, `You die at depth ${depth}.`, 'warn'); }
        } else {
            const step = stepDownhill(level, m, scent, actors);
            if (step) { m.x += step.dx; m.y += step.dy; }
        }
    }
    function runScheduler() {
        player.energy -= ACTION;
        let guard = 4000;
        while (player.energy < ACTION && guard-- > 0 && state === 'play') {
            for (const a of actors) if (!a.dead) a.energy += speedOf(a);
            for (const m of monsters) while (!m.dead && m.energy >= ACTION && state === 'play') { monsterAct(m); m.energy -= ACTION; }
        }
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (state !== 'play') return;
        const acted = action.wait ? true : rlTryMove(level, player, action, actors, playerAttack) !== 'blocked';
        if (!acted) return;
        const fi = floorItems.findIndex(f => f.x === player.x && f.y === player.y);
        if (fi >= 0) { const f = floorItems.splice(fi, 1)[0]; player.inv.push(f.item); rlLog(log, `You find ${f.item.name}.`, 'you'); refreshInv(); }
        tickStatuses(player, (m, c) => rlLog(log, m, c));
        if (player.hp <= 0 && state === 'play') { player.dead = true; state = 'dead'; rlLog(log, 'The poison takes you.', 'warn'); }
        recompute();
        runScheduler();
        turn++;
        updateHud();
    });
    canvas.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9') { e.preventDefault(); useItem(+e.key - 1); return; }
        if (e.key !== '>') return;
        e.preventDefault();
        if (state !== 'play') return;
        if (level.get(player.x, player.y) !== Tile.STAIRS_DOWN) { rlLog(log, 'No stairs here.', 'dim'); return; }
        if (depth >= DEPTH_GOAL) { state = 'win'; rlLog(log, `You climb into daylight from depth ${depth}. You escaped! Score ${score()}.`, 'good'); updateHud(); return; }
        depth++;
        genLevel();
        rlLog(log, `You descend to depth ${depth} · ${theme.name}.`, 'warn');
        updateHud();
    });
    document.getElementById('rlDescentRestart').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render(now) {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell, visible: (x, y) => vis[level.idx(x, y)], explored: (x, y) => explored[level.idx(x, y)] });
        if (theme.tint) { ctx.globalAlpha = 0.18; ctx.fillStyle = theme.tint; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
        rlDrawFlashes(ctx, 0, 0, cell, flashes, now);
        const items = floorItems.filter(f => vis[level.idx(f.x, f.y)]).map(f => ({ x: f.x, y: f.y, ch: f.item.glyph, color: f.item.color }));
        const mobs = monsters.filter(m => !m.dead && vis[level.idx(m.x, m.y)]).map(m => ({ x: m.x, y: m.y, ch: m.ch, color: m.color }));
        const ents = items.concat(mobs);
        if (!player.dead) ents.push({ x: player.x, y: player.y, ch: '@', color: RL.player });
        rlDrawEntities(ctx, 0, 0, cell, ents);
        for (const m of monsters) if (!m.dead && vis[level.idx(m.x, m.y)]) rlHpBar(ctx, 0, 0, cell, m.x, m.y, m.hp / m.maxHp, RL.bad);
        if (!player.dead) rlHpBar(ctx, 0, 0, cell, player.x, player.y, player.hp / player.maxHp, RL.good);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();
