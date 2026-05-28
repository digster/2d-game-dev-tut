// ===================================================================
// netcode/net/seeded-rng.js
//
// A tiny seeded pseudo-random number generator (PRNG) used by every
// netcode demo so a given (seed, sequence-of-actions) tuple ALWAYS
// produces the same outcome.
//
// Why we need this (and Math.random() doesn't cut it):
// -----------------------------------------------------
// 1. Reproducibility: when a learner says "look, my client predicted a
//    move and the server corrected it like this" — we want re-running
//    the demo to show the EXACT same correction, not a fresh dice roll.
// 2. Determinism for lockstep & rollback (Expert tier): two instances
//    given the same seed + same input stream must produce
//    pixel-identical results. That's the literal definition of
//    "deterministic simulation", and it's how shipped multiplayer
//    games (Skullgirls, SF6) detect desync.
// 3. The FakeNetwork's "drop this packet" / "delay by jitter ms" /
//    "reorder this message" decisions all consume from this RNG, so
//    the same seed reproduces the same network weather.
//
// Algorithm: mulberry32 — chosen because:
//   - tiny (a handful of bit-ops + one multiply)
//   - 2^32 period (plenty for any demo)
//   - well-distributed; passes the BigCrush statistical battery
//   - already used by racing-sim's procedural track generator, so
//     this is consistent with project convention.
//
// Author's note for learners:
// In production multiplayer code you may need a determinism stronger
// than 32-bit-float floor()/ceil() boundaries — fixed-point math or
// integer-only state. That's an Expert-tier topic. This RNG is fine
// for the visualisations.
// ===================================================================

class SeededRng {
    /**
     * @param {number} seed - any 32-bit integer. Defaults to 1 because
     *                        a seed of 0 with mulberry32 produces the
     *                        sequence 0, 0, 0... (known degenerate case).
     */
    constructor(seed = 1) {
        // |0 forces a 32-bit signed int — guards against fractional seeds.
        // The +1 nudge for seed=0 keeps the degenerate sequence at bay
        // while still letting learners type "0" as the seed and see
        // something move.
        this.state = (seed | 0) || 1;
    }

    /**
     * Returns a float in [0, 1). The hot path: every other method
     * builds on this.
     */
    next() {
        // mulberry32 — see https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
        // Step 1: advance state by a fixed prime increment.
        let t = (this.state += 0x6D2B79F5) | 0;
        // Step 2: scramble the bits with two xor-shift-multiplies.
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        // Step 3: take the top 32 bits, divide by 2^32 to land in [0,1).
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Integer in [0, max) — handy for picking array indices.
     */
    int(max) {
        return Math.floor(this.next() * max);
    }

    /**
     * Float in [min, max). Used by the FakeNetwork to pick a uniform
     * jitter value around the mean RTT.
     */
    range(min, max) {
        return min + this.next() * (max - min);
    }

    /**
     * Returns true with probability p (p in [0,1]). Used by the
     * FakeNetwork's per-packet "drop?" decision.
     */
    chance(p) {
        return this.next() < p;
    }

    /**
     * Reset to a known seed — useful for "rewind and replay" demos
     * and for the determinism check in the Expert tier (run the same
     * sequence twice, compare results).
     */
    reseed(seed) {
        this.state = (seed | 0) || 1;
    }
}

// Top-level expose so tier-demo files can `new SeededRng(...)` directly.
// This name is intentionally NOT defined in shared/utils.js — pre-checked.
window.SeededRng = SeededRng;
