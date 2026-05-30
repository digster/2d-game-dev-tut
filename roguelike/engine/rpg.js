// ===================================================================
// roguelike/engine/rpg.js
//
// The RPG systems the Expert tier teaches inline, packaged as a reusable
// library for the Simulations grand capstone (and any future consumer) —
// the same "teach inline, ship a lib copy in engine/" split used for
// dungeon.js. (NOTE: only loaded where the inline Expert copy ISN'T — a
// second `class Item` on the same page would be a redeclaration error.)
//
//   Item / ItemWorld + mkWeapon/mkArmor/mkPotion   — items as data (ECS)
//   attackDice / defenseOf                          — stats derived from gear
//   addStatus / tickStatuses / hasStatus / speedOf  — timed status effects
//   applyConsumable                                 — potion/scroll effects
//   ACTION                                          — energy cost of one action
//
// Depends on grid.js (RL palette). Bare declarations => global.
// ===================================================================

const ACTION = 100;   // every action costs 100 energy

// --- Items as data (a tiny ECS) ---------------------------------------------
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

// Apply a consumable's effect; returns a short log string.
function applyConsumable(actor, effect, power) {
    if (effect === 'heal') { actor.hp = Math.min(actor.maxHp, actor.hp + power); return `You feel better (+${power} HP).`; }
    if (effect === 'poison') { addStatus(actor, 'poison', 5, Math.max(1, power >> 2)); return `Ugh — that was poison!`; }
    if (effect === 'regen') { addStatus(actor, 'regen', 6, 2); return `Warmth spreads — you are regenerating.`; }
    if (effect === 'haste') { addStatus(actor, 'haste', 14, 0); return `The world slows around you — haste!`; }
    return 'Nothing happens.';
}
