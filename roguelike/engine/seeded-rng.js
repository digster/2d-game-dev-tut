// ===================================================================
// roguelike/engine/seeded-rng.js
//
// RogueRng — the deterministic random-number generator that every
// roguelike demo (and the final playable game) is built on.
//
// Why a roguelike NEEDS a seeded RNG (Math.random() will not do):
// ---------------------------------------------------------------
// 1. Reproducible dungeons. "Seed 1337" must carve the EXACT same
//    rooms, drop the EXACT same monsters, and shuffle the EXACT same
//    potion colours every single time. That's what lets players share
//    a seed ("try the daily challenge: 2026-05-30") and compare runs.
// 2. Reproducible teaching. When a demo says "watch the rat path around
//    this wall", re-running it must show the same path, not a fresh
//    dice roll each refresh.
// 3. Save/replay & determinism (the Simulations tier records an action
//    sequence and proves seed + inputs => bit-identical outcome).
//
// Algorithm: mulberry32 — the same tiny PRNG the netcode and racing-sim
// tracks use, so seeds are consistent across the whole repo:
//   - tiny (a few bit-ops + a multiply)
//   - 2^32 period (ample for any dungeon)
//   - well-distributed (passes the BigCrush battery)
//
// This class is intentionally named `RogueRng` so it does NOT collide
// with `SeededRng` (netcode) or anything in shared/utils.js. It is a
// superset: same core as netcode's SeededRng plus roguelike-flavoured
// helpers (pick / shuffle / weighted / dice) the dungeon and loot code
// lean on constantly.
// ===================================================================

class RogueRng {
    /**
     * @param {number} seed - any 32-bit integer. Defaults to 1 because a
     *   seed of 0 with mulberry32 produces 0, 0, 0... (degenerate case).
     */
    constructor(seed = 1) {
        // |0 forces a 32-bit signed int (guards against fractional seeds);
        // the `|| 1` nudge keeps seed=0 out of the degenerate sequence
        // while still letting a learner type "0" and see something happen.
        this.state = (seed | 0) || 1;
    }

    /** Float in [0, 1). The hot path — every other method builds on it. */
    next() {
        // mulberry32: advance state, then scramble with xor-shift-multiplies.
        let t = (this.state += 0x6D2B79F5) | 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** Integer in [0, max). Handy for array indices and grid coords. */
    int(max) {
        return Math.floor(this.next() * max);
    }

    /** Integer in [min, max] INCLUSIVE — the natural "roll a coord" range. */
    between(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    /** Float in [min, max). */
    range(min, max) {
        return min + this.next() * (max - min);
    }

    /** True with probability p (p in [0, 1]). The per-tile "spawn here?" coin. */
    chance(p) {
        return this.next() < p;
    }

    /** Return a random element of an array (does not mutate it). */
    pick(arr) {
        return arr[this.int(arr.length)];
    }

    /**
     * Fisher–Yates shuffle, IN PLACE, driven by this RNG so the order is
     * reproducible. Used to scramble unidentified potion/scroll appearances
     * and to randomise room-connection order.
     */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    /**
     * Weighted pick from a table of { value, weight } entries (or a plain
     * object { value: weight }). The loot/monster spawn tables use this:
     * common rats weigh 10, rare ogres weigh 1, etc.
     * @param {Array<{value:*,weight:number}>|Object} table
     */
    weighted(table) {
        // Normalise a plain { key: weight } object into entry form.
        const entries = Array.isArray(table)
            ? table
            : Object.keys(table).map(k => ({ value: k, weight: table[k] }));
        let total = 0;
        for (const e of entries) total += e.weight;
        let roll = this.next() * total;
        for (const e of entries) {
            roll -= e.weight;
            if (roll < 0) return e.value;
        }
        // Floating-point fallthrough guard.
        return entries[entries.length - 1].value;
    }

    /**
     * Roll dice in tabletop "NdS" notation — n dice of s sides each.
     * dice(2, 6) => 2..12. The classic way to express weapon damage
     * (a dagger is 1d4, a greatsword 2d6) with a nice bell-curve spread.
     */
    dice(n, sides) {
        let total = 0;
        for (let i = 0; i < n; i++) total += 1 + this.int(sides);
        return total;
    }

    /** Reset to a known seed — used by "regenerate" buttons and replay. */
    reseed(seed) {
        this.state = (seed | 0) || 1;
    }
}

// Expose on window so every tier-demo file can `new RogueRng(seed)` directly.
// Name pre-checked: not defined in shared/utils.js, distinct from SeededRng.
window.RogueRng = RogueRng;
