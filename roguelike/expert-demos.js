// =============================================================================
// ROGUELIKE — EXPERT TIER DEMOS ("Items, Effects & Minds")
// =============================================================================
// Six demos. New SYSTEMS this tier (items/ECS, status effects, energy
// scheduler, behavior trees) are defined as shared helpers at the top; the
// capstone composes them on the Advanced tier's fog + pursuit.
//
// INPUT NOTE: inventory selection uses NUMBER keys (1–9), because the letter
// keys (a/d/w/s/h/j/k/l) are movement. Movement still flows through the shared
// rlInstallCanvasKeys; a separate keydown handles digits + g/x.
//
// DEPENDENCIES (loaded BEFORE this file by expert.html):
//   shared/utils.js, engine/{seeded-rng,grid,actors,dungeon,vision}.js
// =============================================================================

(function setupScrollToTop() {
    const btn = document.getElementById('scrollToTop');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => { btn.style.opacity = window.pageYOffset > 300 ? '1' : '0'; });
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 0.3s';
})();

const ACTION = 100;   // every action costs 100 energy

// --- A tiny item ECS --------------------------------------------------------
class Item {
    constructor(name, glyph, color) { this.name = name; this.glyph = glyph; this.color = color; this.comps = {}; }
    add(name, data) { this.comps[name] = data; return this; }
    has(name) { return name in this.comps; }
    get(name) { return this.comps[name]; }
}
class ItemWorld {
    constructor() { this.items = []; }
    add(it) { this.items.push(it); return it; }
    query(comp) { return this.items.filter(it => it.has(comp)); }
}
function mkWeapon(name, dice) { return new Item(name, '/', '#cfd8dc').add('equip', { slot: 'weapon' }).add('weapon', { dice }); }
function mkArmor(name, def) { return new Item(name, '[', RL.door).add('equip', { slot: 'armor' }).add('armor', { def }); }
function mkPotion(name, color, effect, power) { return new Item(name, '!', color).add('consume', { effect, power }); }

// --- Derived stats (store the gear, compute the totals) ---------------------
function attackDice(actor) { const w = actor.equip && actor.equip.weapon; return w ? w.get('weapon').dice : [1, 3]; }
function defenseOf(actor) { const a = actor.equip && actor.equip.armor; return a ? a.get('armor').def : 0; }

// --- Status effects ---------------------------------------------------------
function addStatus(actor, kind, turns, power) {
    const ex = actor.statuses.find(s => s.kind === kind);
    if (ex) { ex.turns = Math.max(ex.turns, turns); ex.power = Math.max(ex.power, power); }
    else actor.statuses.push({ kind, turns, power });
}
function tickStatuses(actor, log) {
    for (const s of actor.statuses) {
        if (s.kind === 'poison') { actor.hp -= s.power; if (log) log(`Poison bites you for ${s.power}.`, 'mob'); }
        else if (s.kind === 'regen') { actor.hp = Math.min(actor.maxHp, actor.hp + s.power); }
        s.turns--;
    }
    actor.statuses = actor.statuses.filter(s => s.turns > 0);
}
function hasStatus(actor, kind) { return (actor.statuses || []).some(s => s.kind === kind); }
function statusText(actor) {
    return (actor.statuses && actor.statuses.length) ? actor.statuses.map(s => `${s.kind}(${s.turns})`).join(' ') : 'none';
}
// Effective speed: player carries baseSpeed, monsters carry speed; haste adds 60.
function speedOf(actor) {
    const base = actor.baseSpeed != null ? actor.baseSpeed : (actor.speed != null ? actor.speed : 100);
    return hasStatus(actor, 'haste') ? base + 60 : base;
}

// --- Behavior-tree nodes (Selector = OR, Sequence = AND) --------------------
class BTSel { constructor(kids) { this.kids = kids; } run(c) { for (const k of this.kids) if (k.run(c)) return true; return false; } }
class BTSeq { constructor(kids) { this.kids = kids; } run(c) { for (const k of this.kids) if (!k.run(c)) return false; return true; } }
class BTCond { constructor(fn) { this.fn = fn; } run(c) { return !!this.fn(c); } }
class BTAct { constructor(fn) { this.fn = fn; } run(c) { this.fn(c); return true; } }

// Apply a consumable's effect to an actor; returns a short log string.
function applyConsumable(actor, effect, power) {
    if (effect === 'heal') { actor.hp = Math.min(actor.maxHp, actor.hp + power); return `You feel better (+${power} HP).`; }
    if (effect === 'poison') { addStatus(actor, 'poison', 5, power); return `Ugh — that was poison!`; }
    if (effect === 'regen') { addStatus(actor, 'regen', 6, power); return `Warmth spreads — you are regenerating.`; }
    if (effect === 'haste') { addStatus(actor, 'haste', 12, 0); return `The world slows around you — haste!`; }
    return 'Nothing happens.';
}
function readExpSeed(el) { return Math.max(1, parseInt(el.value, 10) || 1); }

// =============================================================================
// DEMO 1 — itemsEcsDemo : items as entities; pick up / drop
// =============================================================================
(function itemsEcsDemo() {
    const canvas = document.getElementById('rlItemsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 22, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const level = rlMakeRoom(cols, rows);
    const invEl = document.getElementById('rlItemsInv');
    const hud = document.getElementById('rlItemsHud');
    const player = { x: 2, y: rows >> 1, inv: [] };
    let floor;

    function reset() {
        player.x = 2; player.y = rows >> 1; player.inv = [];
        floor = [
            { x: 8, y: 3, item: mkWeapon('dagger', [1, 4]) },
            { x: 14, y: rows - 4, item: mkWeapon('short sword', [1, 8]) },
            { x: 20, y: 4, item: mkArmor('leather armor', 1) },
            { x: 24, y: rows - 3, item: mkPotion('murky potion', RL.item, 'heal', 8) },
            { x: 11, y: rows >> 1, item: (new Item('bread', '%', RL.door)).add('food', { nutrition: 50 }) },
        ].filter(f => f.x < cols - 1);
        render(); refreshInv();
    }
    function refreshInv() {
        if (!player.inv.length) { invEl.innerHTML = '<div class="muted">(empty — walk onto an item)</div>'; return; }
        const tag = it => Object.keys(it.comps).join(', ');
        invEl.innerHTML = player.inv.map(it =>
            `<div class="row"><span class="key" style="color:${it.color}">${it.glyph}</span>`
            + `<span>${it.name}</span> <span class="muted">[${tag(it)}]</span></div>`).join('')
            + `<div class="muted" style="margin-top:6px;">query('equip') → ${player.inv.filter(i => i.has('equip')).length}`
            + ` · query('consume') → ${player.inv.filter(i => i.has('consume')).length}</div>`;
    }
    function pickupAt(x, y) {
        const i = floor.findIndex(f => f.x === x && f.y === y);
        if (i < 0) return;
        const f = floor.splice(i, 1)[0];
        player.inv.push(f.item);
        hud.textContent = `Picked up ${f.item.name}. (x to drop · inventory ${player.inv.length})`;
        refreshInv();
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (action.wait) return;
        if (rlTryMove(level, player, action, [player]) === 'moved') pickupAt(player.x, player.y);
    });
    canvas.addEventListener('keydown', (e) => {
        if (e.key !== 'x') return;
        e.preventDefault();
        if (!player.inv.length) return;
        if (floor.some(f => f.x === player.x && f.y === player.y)) { hud.textContent = 'Something is already here.'; return; }
        const it = player.inv.pop();
        floor.push({ x: player.x, y: player.y, item: it });
        hud.textContent = `Dropped ${it.name}. (inventory ${player.inv.length})`;
        refreshInv();
    });
    document.getElementById('rlItemsHud'); // (kept for clarity)
    reset();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        const ents = floor.map(f => ({ x: f.x, y: f.y, ch: f.item.glyph, color: f.item.color }));
        ents.push({ x: player.x, y: player.y, ch: '@', color: RL.player });
        rlDrawEntities(ctx, 0, 0, cell, ents);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 2 — inventoryUiDemo : equip gear, derive attack/defense
// =============================================================================
(function inventoryUiDemo() {
    const canvas = document.getElementById('rlInvCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 22;
    const panel = document.getElementById('rlInvPanel');
    const hud = document.getElementById('rlInvHud');
    const player = {
        x: 3, y: 2, baseAtk: 1, equip: { weapon: null, armor: null },
        inv: [mkWeapon('dagger', [1, 4]), mkWeapon('short sword', [1, 8]), mkArmor('leather armor', 1), mkArmor('chain mail', 3)],
    };
    function isEquipped(it) { return player.equip.weapon === it || player.equip.armor === it; }
    function toggle(i) {
        const it = player.inv[i];
        if (!it || !it.has('equip')) return;
        const slot = it.get('equip').slot;
        player.equip[slot] = (player.equip[slot] === it) ? null : it;
        refresh();
    }
    function refresh() {
        panel.innerHTML = player.inv.map((it, i) =>
            `<div class="row"><span class="key">${i + 1})</span>`
            + `<span style="color:${it.color}">${it.glyph}</span> <span>${it.name}</span>`
            + (isEquipped(it) ? ' <span class="eq">[equipped]</span>' : '')
            + ` <span class="muted">${it.has('weapon') ? it.get('weapon').dice.join('d') : 'def +' + it.get('armor').def}</span></div>`).join('');
        const [n, s] = attackDice(player);
        hud.textContent = `attack ${player.baseAtk}+${n}d${s}  ·  defense ${defenseOf(player)}`
            + `  ·  weapon: ${player.equip.weapon ? player.equip.weapon.name : '—'}`
            + `  ·  armor: ${player.equip.armor ? player.equip.armor.name : '—'}`;
    }
    const focus = rlInstallCanvasKeys(canvas, () => { });   // focus only (no movement needed)
    canvas.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9') { e.preventDefault(); toggle(+e.key - 1); }
    });
    refresh();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        ctx.font = '64px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = RL.player; ctx.fillText('@', canvas.width / 2, canvas.height / 2 - 16);
        ctx.font = '13px "Courier New", monospace'; ctx.fillStyle = RL.labelMuted;
        ctx.fillText((player.equip.weapon ? player.equip.weapon.name : 'unarmed')
            + ' / ' + (player.equip.armor ? player.equip.armor.name : 'no armor'), canvas.width / 2, canvas.height / 2 + 40);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 3 — statusIdentDemo : status effects + identify-by-use
// =============================================================================
(function statusIdentDemo() {
    const canvas = document.getElementById('rlStatusCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 22, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const level = rlMakeRoom(cols, rows);
    const panel = document.getElementById('rlStatusInv');
    const log = document.getElementById('rlStatusLog');
    const hud = document.getElementById('rlStatusHud');
    const player = { x: cols >> 1, y: rows >> 1, hp: 20, maxHp: 20, statuses: [] };
    let potions;

    function reset() {
        const rng = new RogueRng(Date.now() & 0xffff);   // re-roll the mapping each reset
        player.hp = 20; player.statuses = []; player.x = cols >> 1; player.y = rows >> 1;
        const colours = [['murky', '#ab47bc'], ['fizzy', '#4fc3f7'], ['glowing', '#66bb6a']];
        const effects = rng.shuffle(['heal', 'poison', 'regen']);
        potions = colours.map((c, i) => ({ colour: c[0], color: c[1], effect: effects[i], known: false }));
        log.innerHTML = '';
        rlLog(log, '— Three unlabelled potions. Quaff one to learn what it does. —', 'dim');
        refresh();
    }
    function refresh() {
        panel.innerHTML = potions.map((p, i) =>
            `<div class="row"><span class="key">${i + 1})</span>`
            + `<span style="color:${p.color}">!</span> <span class="uid">${p.colour} potion</span>`
            + (p.known ? ` <span class="muted">→ ${p.effect}</span>` : ' <span class="muted">→ ???</span>')
            + `</div>`).join('') || '<div class="muted">(all quaffed)</div>';
        hud.textContent = `HP ${Math.max(0, player.hp)}/${player.maxHp} · effects: ${statusText(player)} · move to pass turns (statuses tick)`;
    }
    function quaff(i) {
        const p = potions[i];
        if (!p) return;
        p.known = true;
        // reveal every potion of that colour (here, each colour is unique)
        const msg = applyConsumable(player, p.effect, p.effect === 'heal' ? 8 : p.effect === 'poison' ? 2 : 2);
        rlLog(log, `You quaff the ${p.colour} potion. ${msg}`, p.effect === 'poison' ? 'mob' : 'good');
        potions.splice(i, 1);
        refresh();
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        // Any step (or wait) passes a turn → statuses tick.
        if (!action.wait) rlTryMove(level, player, action, [player]);
        tickStatuses(player, (m, c) => rlLog(log, m, c));
        if (player.hp <= 0) { rlLog(log, 'You succumb to the poison! (press New mix)', 'warn'); }
        refresh();
    });
    canvas.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9') { e.preventDefault(); if (player.hp > 0) quaff(+e.key - 1); }
    });
    document.getElementById('rlStatusReset').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        rlDrawEntities(ctx, 0, 0, cell, [{ x: player.x, y: player.y, ch: '@', color: player.hp > 0 ? RL.player : RL.dim }]);
        if (player.hp > 0) rlHpBar(ctx, 0, 0, cell, player.x, player.y, player.hp / player.maxHp, RL.good);
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 4 — energyDemo : energy/speed scheduler (fast vs slow actors)
// =============================================================================
(function energyDemo() {
    const canvas = document.getElementById('rlEnergyCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 24, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const level = rlMakeRoom(cols, rows);
    const hud = document.getElementById('rlEnergyHud');
    let player, monsters, actors;

    function reset() {
        player = { x: 2, y: rows >> 1, ch: '@', color: RL.player, energy: ACTION, speed: 100, acts: 0, name: 'you' };
        monsters = [
            { x: cols - 4, y: 2, ch: 's', color: RL.bad, energy: 0, speed: 200, acts: 0, name: 'snake' },
            { x: cols - 4, y: rows >> 1, ch: 'r', color: RL.monster, energy: 0, speed: 100, acts: 0, name: 'rat' },
            { x: cols - 4, y: rows - 3, ch: 'Z', color: RL.monsterCalm, energy: 0, speed: 50, acts: 0, name: 'zombie' },
        ];
        actors = [player, ...monsters];
        updateHud();
    }
    function actOne(m) {                       // a monster's single action: a random wander step
        m.acts++;
        const s = m._rng ? m._rng.pick(VIS_DIRS4) : VIS_DIRS4[(m.acts) % 4];
        if (level.isWalkable(m.x + s[0], m.y + s[1]) && !rlActorAt(actors, m.x + s[0], m.y + s[1], m)) { m.x += s[0]; m.y += s[1]; }
    }
    function runScheduler() {
        player.energy -= ACTION;
        let guard = 2000;
        while (player.energy < ACTION && guard-- > 0) {
            for (const a of actors) a.energy += a.speed;
            for (const m of monsters) while (m.energy >= ACTION) { actOne(m); m.energy -= ACTION; }
        }
    }
    function updateHud() {
        hud.textContent = `you ×${player.acts} (spd 100) · snake ×${monsters[0].acts} (spd 200, 2×)`
            + ` · rat ×${monsters[1].acts} (spd 100) · zombie ×${monsters[2].acts} (spd 50, ½×)`;
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (!action.wait && rlTryMove(level, player, action, actors) === 'blocked') return;
        player.acts++;
        runScheduler();
        updateHud();
    });
    document.getElementById('rlEnergyReset').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        rlDrawEntities(ctx, 0, 0, cell, actors.map(a => ({ x: a.x, y: a.y, ch: a.ch, color: a.color })));
        for (const a of actors) {              // energy bars (cyan) under each actor
            const px = a.x * cell + 3, py = a.y * cell + cell - 5, w = cell - 6;
            ctx.fillStyle = '#000'; ctx.fillRect(px, py, w, 3);
            ctx.fillStyle = RL.accent; ctx.fillRect(px, py, Math.max(0, Math.round(w * Math.min(1, a.energy / ACTION))), 3);
        }
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 5 — aiVarietyDemo : FSM brute + FSM coward + behavior-tree archer
// =============================================================================
(function aiVarietyDemo() {
    const canvas = document.getElementById('rlAiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const seedEl = document.getElementById('rlAiSeed');
    const hud = document.getElementById('rlAiHud');
    let level, player, brute, coward, archer, monsters, shotLine;

    function reset() {
        const rng = new RogueRng(readExpSeed(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 22, minSize: 4, maxSize: 7 });
        level = d.level; player = { x: d.spawn.x, y: d.spawn.y, hp: 30, maxHp: 30 };
        const spots = [dgRandomFloorTile(level, rng), dgRandomFloorTile(level, rng), dgRandomFloorTile(level, rng)];
        brute = { x: spots[0].x, y: spots[0].y, ch: 'B', color: RL.bad, state: 'sleep', label: 'sleep' };
        coward = { x: spots[1].x, y: spots[1].y, ch: 'c', color: '#ffa726', state: 'idle', label: 'idle' };
        archer = { x: spots[2].x, y: spots[2].y, ch: 'a', color: '#4fc3f7', label: 'wander' };
        monsters = [brute, coward, archer];
        shotLine = null;
        updateHud();
    }
    function see(m) { return losLine(level, m.x, m.y, player.x, player.y).clear; }
    function moveToward(m, away) {
        const tgt = away ? { x: m.x + (m.x - player.x), y: m.y + (m.y - player.y) } : player;
        rlTryMove(level, m, rlStepToward(level, m, tgt, monsters.concat([player])), monsters.concat([player]));
    }
    // Archer behavior tree: shoot if able → back off if too close → hold range → wander.
    const archerTree = new BTSel([
        new BTSeq([new BTCond(() => see(archer) && rlManhattan(archer, player) >= 2 && rlManhattan(archer, player) <= 5),
                   new BTAct(() => { archer.label = 'shoot'; shotLine = { from: { ...archer }, to: { ...player } }; player.hp -= 1; })]),
        new BTSeq([new BTCond(() => rlManhattan(archer, player) < 3), new BTAct(() => { archer.label = 'retreat'; moveToward(archer, true); })]),
        new BTSeq([new BTCond(() => see(archer)), new BTAct(() => { archer.label = 'reposition'; moveToward(archer, false); })]),
        new BTAct(() => { archer.label = 'wander'; const s = VIS_DIRS4[Math.floor(Math.random() * 4)]; rlTryMove(level, archer, { dx: s[0], dy: s[1] }, monsters.concat([player])); }),
    ]);
    function bruteTurn() {
        const d = rlManhattan(brute, player), s = see(brute);
        if (brute.state === 'sleep') { if (s && d <= 8) brute.state = 'chase'; }
        if (brute.state === 'chase') {
            if (d === 1) { brute.state = 'attack'; }
            else moveToward(brute, false);
        }
        if (brute.state === 'attack') { if (d === 1) { player.hp -= 2; } else brute.state = 'chase'; }
        brute.label = brute.state;
    }
    function cowardTurn() {
        const d = rlManhattan(coward, player), s = see(coward);
        if (s && d <= 5) { coward.state = 'flee'; coward.label = 'flee!'; moveToward(coward, true); }
        else { coward.state = 'idle'; coward.label = 'idle'; }
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        const r = action.wait ? 'moved' : rlTryMove(level, player, action, monsters.concat([player]));
        if (r === 'blocked') return;
        shotLine = null;
        bruteTurn(); cowardTurn(); archerTree.run();
        if (player.hp < 0) player.hp = 0;
        updateHud();
    });
    function updateHud() {
        hud.textContent = `HP ${player.hp}/30 · brute: ${brute.label} · coward: ${coward.label} · archer: ${archer.label}`;
    }
    seedEl.addEventListener('change', reset);
    document.getElementById('rlAiReset').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell });
        if (shotLine) {                        // draw the archer's shot
            ctx.strokeStyle = 'rgba(79,195,247,0.8)'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(shotLine.from.x * cell + cell / 2, shotLine.from.y * cell + cell / 2);
            ctx.lineTo(shotLine.to.x * cell + cell / 2, shotLine.to.y * cell + cell / 2);
            ctx.stroke();
        }
        rlDrawEntities(ctx, 0, 0, cell, monsters.map(m => ({ x: m.x, y: m.y, ch: m.ch, color: m.color }))
            .concat([{ x: player.x, y: player.y, ch: '@', color: RL.player }]));
        // state labels above each monster
        ctx.font = '10px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        for (const m of monsters) { ctx.fillStyle = m.color; ctx.fillText(m.label, m.x * cell + cell / 2, m.y * cell - 1); }
        rlFocusHint(ctx, canvas.width, canvas.height, focus.focused);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
})();

// =============================================================================
// DEMO 6 — armedDangerousDemo : CAPSTONE — everything at once
// =============================================================================
(function armedDangerousDemo() {
    const canvas = document.getElementById('rlArmedCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cell = 20, cols = Math.floor(canvas.width / cell), rows = Math.floor(canvas.height / cell);
    const log = document.getElementById('rlArmedLog');
    const hud = document.getElementById('rlArmedHud');
    const invEl = document.getElementById('rlArmedInv');
    const seedEl = document.getElementById('rlArmedSeed');
    const flashes = [];
    const RADIUS = 8, SIGHT = 9;
    let rng, level, player, monsters, actors, stairs, floorItems, vis, explored, scent, turn, state;

    function recompute() {
        vis = computeFOV(level, player.x, player.y, RADIUS);
        for (let i = 0; i < vis.length; i++) if (vis[i]) explored[i] = 1;
        scent = dijkstraFrom(level, [player]);
    }
    function reset() {
        rng = new RogueRng(readExpSeed(seedEl));
        const d = generateDungeon(cols, rows, rng, { attempts: 30, minSize: 4, maxSize: 7 });
        level = d.level; stairs = d.stairs;
        player = { x: d.spawn.x, y: d.spawn.y, hp: 30, maxHp: 30, baseAtk: 1, baseSpeed: 100, energy: ACTION,
                   equip: { weapon: null, armor: null }, inv: [], statuses: [], name: 'you' };
        // Scatter loot on the floor.
        floorItems = [];
        const loot = [mkWeapon('short sword', [1, 8]), mkArmor('leather armor', 1), mkArmor('chain mail', 3),
                      mkPotion('murky potion', '#ab47bc', rng.pick(['heal', 'haste', 'regen']), 9),
                      mkPotion('fizzy potion', '#4fc3f7', 'heal', 9)];
        for (const it of loot) { const p = dgRandomFloorTile(level, rng); floorItems.push({ x: p.x, y: p.y, item: it }); }
        // Monsters with varied speed + AI.
        monsters = [];
        const defs = [
            { ch: 'r', name: 'rat', hp: 6, speed: 100, dice: [1, 3], poison: false },
            { ch: 's', name: 'snake', hp: 7, speed: 170, dice: [1, 3], poison: true },
            { ch: 'Z', name: 'zombie', hp: 12, speed: 55, dice: [1, 5], poison: false },
            { ch: 'r', name: 'rat', hp: 6, speed: 100, dice: [1, 3], poison: false },
        ];
        for (const dfn of defs) {
            const p = dgRandomFloorTile(level, rng);
            if (p.x === player.x && p.y === player.y) continue;
            monsters.push({ ...dfn, x: p.x, y: p.y, maxHp: dfn.hp, energy: 0, awake: false, color: RL.monsterCalm });
        }
        actors = [player, ...monsters];
        explored = new Uint8Array(level.width * level.height);
        turn = 0; state = 'play'; flashes.length = 0;
        log.innerHTML = '';
        rlLog(log, `— Armed & Dangerous. (seed ${readExpSeed(seedEl)}) Loot up and reach the stairs (>). —`, 'dim');
        rlLog(log, 'Walk onto items to grab them; press 1–9 to equip/quaff. The snake (s) is fast and venomous.', 'dim');
        recompute(); refreshInv(); updateHud();
    }
    function refreshInv() {
        if (!player.inv.length) { invEl.innerHTML = '<div class="muted">(empty)</div>'; return; }
        invEl.innerHTML = player.inv.map((it, i) => {
            const eq = (player.equip.weapon === it || player.equip.armor === it) ? ' <span class="eq">[E]</span>' : '';
            const sub = it.has('weapon') ? it.get('weapon').dice.join('d')
                      : it.has('armor') ? 'def +' + it.get('armor').def
                      : it.has('consume') ? 'drink' : '';
            return `<div class="row"><span class="key">${i + 1})</span><span style="color:${it.color}">${it.glyph}</span>`
                + ` <span>${it.name}</span> <span class="muted">${sub}</span>${eq}</div>`;
        }).join('');
    }
    function updateHud() {
        const [n, s] = attackDice(player);
        const tail = state === 'win' ? ' · 🏆 escaped — you win!' : state === 'dead' ? ' · 💀 you died — New run' : '';
        hud.textContent = `turn ${turn} · HP ${Math.max(0, player.hp)}/${player.maxHp}`
            + ` · atk ${player.baseAtk}+${n}d${s} def ${defenseOf(player)} · ${statusText(player)}` + tail;
    }
    function useItem(i) {
        const it = player.inv[i];
        if (!it || state !== 'play') return;
        if (it.has('equip')) {
            const slot = it.get('equip').slot;
            player.equip[slot] = (player.equip[slot] === it) ? null : it;
            rlLog(log, `${player.equip[slot] === it ? 'You equip' : 'You remove'} the ${it.name}.`, 'you');
            refreshInv(); updateHud();
        } else if (it.has('consume')) {
            const c = it.get('consume');
            rlLog(log, `You quaff the ${it.name}. ${applyConsumable(player, c.effect, c.power)}`, c.effect === 'poison' ? 'mob' : 'good');
            player.inv.splice(i, 1);
            refreshInv(); updateHud();
        }
    }
    function playerAttack(_, target) {
        const [n, s] = attackDice(player);
        const dmg = player.baseAtk + rng.dice(n, s);
        target.hp -= dmg; rlPushFlash(flashes, target.x, target.y);
        rlLog(log, `You hit the ${target.name} for ${dmg}.`, 'you');
        if (target.hp <= 0) { target.dead = true; rlLog(log, `The ${target.name} dies.`, 'good'); }
    }
    function monsterAct(m) {
        if (m.dead || player.dead || state !== 'play') return;
        const los = losLine(level, m.x, m.y, player.x, player.y).clear && rlManhattan(m, player) <= SIGHT;
        if (los) { m.awake = true; m.color = RL.monster; }
        if (!m.awake) return;
        if (rlManhattan(m, player) === 1) {
            const raw = rng.dice(m.dice[0], m.dice[1]);
            const dmg = Math.max(1, raw - defenseOf(player));
            player.hp -= dmg; rlPushFlash(flashes, player.x, player.y);
            rlLog(log, `The ${m.name} hits you for ${dmg}.`, 'mob');
            if (m.poison) { addStatus(player, 'poison', 4, 1); rlLog(log, 'You are poisoned!', 'warn'); }
            if (player.hp <= 0) { player.dead = true; state = 'dead'; rlLog(log, 'You die, far from the surface.', 'warn'); }
        } else {
            const step = stepDownhill(level, m, scent, actors);
            if (step) { m.x += step.dx; m.y += step.dy; }
        }
    }
    function runScheduler() {                  // energy loop — fast monsters act more
        player.energy -= ACTION;
        let guard = 3000;
        while (player.energy < ACTION && guard-- > 0 && state === 'play') {
            for (const a of actors) if (!a.dead) a.energy += speedOf(a);
            for (const m of monsters) while (!m.dead && m.energy >= ACTION && state === 'play') { monsterAct(m); m.energy -= ACTION; }
        }
    }
    const focus = rlInstallCanvasKeys(canvas, (action) => {
        if (state !== 'play') return;
        const acted = action.wait ? true : rlTryMove(level, player, action, actors, playerAttack) !== 'blocked';
        if (!acted) return;
        // Auto-pickup loot on the player's tile.
        const fi = floorItems.findIndex(f => f.x === player.x && f.y === player.y);
        if (fi >= 0) { const f = floorItems.splice(fi, 1)[0]; player.inv.push(f.item); rlLog(log, `You pick up the ${f.item.name}.`, 'you'); refreshInv(); }
        if (level.get(player.x, player.y) === Tile.STAIRS_DOWN) {
            state = 'win'; rlLog(log, 'You climb the stairs and escape — alive and armed. (You win!)', 'good');
            recompute(); updateHud(); return;
        }
        tickStatuses(player, (m, c) => rlLog(log, m, c));
        if (player.hp <= 0 && state === 'play') { player.dead = true; state = 'dead'; rlLog(log, 'The poison finishes you.', 'warn'); }
        recompute();
        runScheduler();
        turn++;
        updateHud();
    });
    canvas.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '9') { e.preventDefault(); useItem(+e.key - 1); }
    });
    document.getElementById('rlArmedRestart').addEventListener('click', () => { reset(); canvas.focus(); });
    reset();

    function render(now) {
        clearCanvas(ctx, canvas.width, canvas.height, RL.bg);
        drawGlyphGrid(ctx, level, { cell, visible: (x, y) => vis[level.idx(x, y)], explored: (x, y) => explored[level.idx(x, y)] });
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
