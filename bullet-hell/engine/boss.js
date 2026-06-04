// ===================================================================
// bullet-hell/engine/boss.js
//
// The boss-fight core for the Bullet Hell track. PROMOTED here from the Advanced
// tier's demos once the Simulations boss-rush capstone became their 2nd consumer
// (the repo's "promote on the 2nd consumer" rule — a MOVE, not a copy: the
// Advanced demos no longer declare these; both advanced.html and simulations.html
// load this file). The Advanced page still TEACHES the source in its collapsible
// code blocks.
//
//   • BHBoss      — an entity that sweeps the top of the field (a Lissajous
//                   figure: two sines at different rates), plus HP. Its emitter is
//                   wired separately so the same boss can run any spell card.
//   • BHSpellCard — an attack as DATA: a list of timed `steps`, each applied once
//                   when the card's clock passes its `at`. A step can `set` the
//                   emitter's knobs (interval/spin/angle/fire) and/or fire a
//                   one-shot `burst`. This is exactly the structure the
//                   Simulations pattern editor emits.
//
// Reuses shared/utils.js's Vector2D and engine/emitter.js's BHEmitter (a card
// drives an emitter). Names pre-checked vs shared/utils.js. No ES modules.
// ===================================================================

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

// Expose on window (no ES modules; scripts load via <script src>).
if (typeof window !== 'undefined') {
    window.BHBoss = BHBoss;
    window.BHSpellCard = BHSpellCard;
}
