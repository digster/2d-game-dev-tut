// =============================================================================
// TOWER DEFENSE — SIMULATIONS TIER DEMOS ("The Whole Game & Balancing")
// =============================================================================
// The finale: a working, fast TD becomes a TUNABLE one. Six demos:
//   1. waveGenDemo   — procedural waves & difficulty curves
//   2. economyDemo   — income, interest & the eco-vs-rush curve
//   3. upgradeDemo   — upgrade scaling + the slow→DPS synergy
//   4. dpsDashboard  — DPS-per-gold & time-to-kill (the balancing table)
//   5. threatHeatmap — where the pressure is + seeded determinism
//   6. lastStand     — GRAND CAPSTONE: the complete tower defense
//
// Everything here is INLINE (the terminal consumer). The through-line is
// DETERMINISM: a seeded mulberry32 `tdRng` means a layout + seed reproduces a run
// exactly, which is what makes balancing measurements (and the heatmap) real.
//
// DEPENDENCIES: ../shared/utils.js, engine/loop.js, engine/render.js,
//   engine/world.js, engine/entities.js, engine/nav.js (tdAStar/tdBlocksPath).
// =============================================================================

// --- tdRng: a seeded PRNG (mulberry32) --------------------------------------
// Same family as the bullet-hell `BHRng` / roguelike `RogueRng`. A fixed seed
// gives the same stream every time → a run is reproducible → balancing is real.
function tdRng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// --- tdGenerateWave: a difficulty curve as a function of the wave number ------
// Count and HP grow each wave; fast creeps appear from wave 3; every 5th wave ends
// with a tanky "boss". Pure (no RNG) so wave N is always the same — the curve IS
// the design. Returns an array of creep specs the spawner feeds to TDEnemy.
function tdGenerateWave(n, opts = {}) {
    const base = opts.base ?? 6, growth = opts.growth ?? 0.20;
    const hpBase = opts.hpBase ?? 5, hpGrowth = opts.hpGrowth ?? 0.22;
    const count = Math.round(base * (1 + growth * (n - 1)));
    const hp = hpBase * Math.pow(1 + hpGrowth, n - 1);
    const speed = 58 + n * 1.5;
    const q = [];
    for (let i = 0; i < count; i++) {
        if (n % 5 === 0 && i === count - 1) q.push({ speed: speed * 0.6, hp: Math.round(hp * 6), color: TD.enemyTank, bounty: 28, radius: 13 });
        else if (n >= 3 && i % 4 === 0) q.push({ speed: speed * 1.7, hp: Math.round(hp * 0.6), color: TD.enemyFast, bounty: 5, radius: 7 });
        else q.push({ speed, hp: Math.round(hp), color: TD.enemy, bounty: 4 + Math.floor(n / 3), radius: 9 });
    }
    return q;
}
function tdWaveThreat(q) { let t = 0; for (const c of q) t += c.hp; return t; }    // total HP = the threat

// --- the tower roster (content) + balancing maths ---------------------------
const SIM_TOWERS = {
    gun:    { kind: 'gun',    label: 'Gun',    color: TD.tower,     damage: 2, fireRate: 1.8, range: 105, projSpeed: 280, cost: 40 },
    sniper: { kind: 'sniper', label: 'Sniper', color: TD.towerGold, damage: 8, fireRate: 0.6, range: 175, projSpeed: 520, cost: 70 },
    splash: { kind: 'splash', label: 'Splash', color: TD.towerGun,  damage: 2, fireRate: 1.1, range: 100, projSpeed: 240, cost: 60, splash: 36 },
    frost:  { kind: 'frost',  label: 'Frost',  color: TD.towerSlow, damage: 1, fireRate: 1.2, range: 110, projSpeed: 300, cost: 55, slow: { factor: 0.5, duration: 1.4 } },
};
const SIM_ENEMIES = { normal: { label: 'Normal', hp: 8, color: TD.enemy }, fast: { label: 'Fast', hp: 5, color: TD.enemyFast }, tank: { label: 'Tank', hp: 40, color: TD.enemyTank } };
// effective single-target-equivalent DPS (splash hits ~3 creeps in a wave).
function simDPS(t) { return t.damage * t.fireRate * (t.splash > 0 ? 3 : 1); }

// === tier-local helpers ======================================================
function tdRunWhenVisible(canvas, loop) {
    const io = new IntersectionObserver((es) => { for (const e of es) e.isIntersecting ? loop.start() : loop.stop(); }, { threshold: 0.01 });
    io.observe(canvas); return loop;
}
function tdInfo(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function tdCellEq(a, b) { return a && b && a.col === b.col && a.row === b.row; }
// A* cell list → TDPath (optionally starting at the creep's exact pos on a re-plan).
function tdAStarPath(grid, startCell, goalCell, fromPos) {
    const cells = tdAStar(grid, startCell, goalCell);
    if (!cells) return null;
    let pts = fromPos
        ? [{ x: fromPos.x, y: fromPos.y }, ...cells.slice(1).map((c) => grid.cellCenter(c.col, c.row))]
        : cells.map((c) => grid.cellCenter(c.col, c.row));
    if (pts.length < 2) pts = [pts[0] || grid.cellCenter(startCell.col, startCell.row), grid.cellCenter(goalCell.col, goalCell.row)];
    return new TDPath(pts);
}
// A simple labelled bar chart.
function tdBars(ctx, x, y, w, h, items, opts = {}) {
    const max = opts.max ?? Math.max(1, ...items.map((it) => it.v));
    const n = items.length, gap = 8, bw = (w - gap * (n - 1)) / n;
    ctx.save();
    ctx.font = '11px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < n; i++) {
        const bh = Math.max(1, (items[i].v / max) * (h - 24));
        const bx = x + i * (bw + gap);
        ctx.fillStyle = items[i].c || TD.accent;
        ctx.fillRect(bx, y + h - 18 - bh, bw, bh);
        ctx.fillStyle = TD.text;
        ctx.fillText(items[i].label, bx + bw / 2, y + h - 4);
        ctx.fillStyle = '#fff';
        ctx.fillText(items[i].t ?? items[i].v.toFixed(1), bx + bw / 2, y + h - 22 - bh);
    }
    ctx.restore();
}

// =============================================================================
// 1) waveGenDemo — procedural waves & difficulty curves
// =============================================================================
(function waveGenDemo() {
    const canvas = document.getElementById('tdWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let growth = 0.20, hpGrowth = 0.22, waveN = 8;
    const bind = (id, set) => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => set(+el.value)); };
    bind('tdWaveGrowth', (v) => { growth = v; tdInfo('tdWaveGrowthVal', '+' + Math.round(v * 100) + '%/wave'); });
    bind('tdWaveHp', (v) => { hpGrowth = v; tdInfo('tdWaveHpVal', '+' + Math.round(v * 100) + '%/wave'); });
    bind('tdWaveN', (v) => { waveN = v; tdInfo('tdWaveNVal', 'wave ' + v); });
    tdInfo('tdWaveGrowthVal', '+20%/wave'); tdInfo('tdWaveHpVal', '+22%/wave'); tdInfo('tdWaveNVal', 'wave 8');

    function render() {
        clearCanvas(ctx, W, H, TD.bg);
        // top: total-HP (threat) per wave, 1..15
        const waves = [];
        for (let n = 1; n <= 15; n++) waves.push({ label: '' + n, v: tdWaveThreat(tdGenerateWave(n, { growth, hpGrowth })), c: n % 5 === 0 ? TD.enemyTank : TD.accent });
        ctx.fillStyle = TD.dim; ctx.font = '12px monospace'; ctx.textAlign = 'left';
        ctx.fillText('Threat (total HP) per wave — every 5th is a boss wave', 12, 20);
        tdBars(ctx, 12, 26, W - 24, 150, waves.map((w) => ({ label: w.label, v: w.v, c: w.c, t: '' })));
        // bottom: composition of wave waveN as coloured dots
        const q = tdGenerateWave(waveN, { growth, hpGrowth });
        ctx.fillStyle = TD.dim; ctx.fillText('Wave ' + waveN + ' composition — ' + q.length + ' creeps, ' + tdWaveThreat(q) + ' total HP', 12, 210);
        let dx = 18, dy = 232;
        for (const c of q) { ctx.beginPath(); ctx.arc(dx, dy, c.radius * 0.8, 0, TD.TAU); ctx.fillStyle = c.color; ctx.fill(); dx += 26; if (dx > W - 20) { dx = 18; dy += 26; } }
    }
    tdRunWhenVisible(canvas, tdLoop(() => {}, render));
})();

// =============================================================================
// 2) economyDemo — income, interest & the eco-vs-rush curve
// =============================================================================
(function economyDemo() {
    const canvas = document.getElementById('tdEcoCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let interest = 0.10, income = 30;
    const bind = (id, set) => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => set(+el.value)); };
    bind('tdEcoInterest', (v) => { interest = v; tdInfo('tdEcoInterestVal', Math.round(v * 100) + '%/wave'); });
    bind('tdEcoIncome', (v) => { income = v; tdInfo('tdEcoIncomeVal', '●' + v + '/wave'); });
    tdInfo('tdEcoInterestVal', '10%/wave'); tdInfo('tdEcoIncomeVal', '●30/wave');

    function curve(withInterest) {
        const pts = [200]; let g = 200;
        for (let n = 1; n <= 15; n++) { g += income; if (withInterest) g += Math.floor(g * interest); pts.push(g); }
        return pts;
    }
    function render() {
        clearCanvas(ctx, W, H, TD.bg);
        const flat = curve(false), comp = curve(true);
        const max = Math.max(comp[comp.length - 1], 1);
        const plot = (pts, color) => {
            ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
            pts.forEach((v, i) => { const x = 30 + (i / 15) * (W - 60), y = H - 30 - (v / max) * (H - 60); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            ctx.stroke();
        };
        // axes
        ctx.strokeStyle = TD.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, 10); ctx.lineTo(30, H - 30); ctx.lineTo(W - 20, H - 30); ctx.stroke();
        plot(flat, TD.dim); plot(comp, TD.good);
        ctx.font = '12px monospace'; ctx.textAlign = 'left';
        ctx.fillStyle = TD.dim; ctx.fillText('no interest → ●' + flat[15], 40, 24);
        ctx.fillStyle = TD.good; ctx.fillText('with ' + Math.round(interest * 100) + '% interest → ●' + comp[15], 40, 42);
        ctx.fillStyle = TD.text; ctx.fillText('gold over 15 waves (income banked vs spent)', 40, H - 10);
        const ratio = (comp[15] / flat[15]).toFixed(2);
        tdInfo('tdEcoInfo', `Compounding interest turns ●${flat[15]} into <b style="color:#66bb6a">●${comp[15]}</b> (${ratio}×) — but only if you survive while banking. That tension IS the eco-vs-rush decision.`);
    }
    tdRunWhenVisible(canvas, tdLoop(() => {}, render));
})();

// =============================================================================
// 3) upgradeDemo — upgrade scaling + the slow→DPS synergy
// =============================================================================
(function upgradeDemo() {
    const canvas = document.getElementById('tdUpgradeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let level, damage, range, invested, synergy;
    function reset() { level = 1; damage = 4; range = 90; invested = 40; synergy = false; sync(); }
    function upgradeCost() { return Math.round(30 * Math.pow(1.5, level - 1)); }
    function sync() {
        const dps = damage * 1.5;                          // fireRate 1.5
        const eff = synergy ? dps / 0.5 : dps;             // slowed creep (×0.5 speed) → 2× time in range → 2× effective DPS
        tdInfo('tdUpgradeInfo', `Lv <b>${level}</b> · DPS <b>${dps.toFixed(1)}</b>` + (synergy ? ` → <b style="color:#7CF2C8">${eff.toFixed(1)} effective</b> (frost ×2)` : '') + ` · invested <b>●${invested}</b> · DPS/●gold <b>${(dps / invested).toFixed(3)}</b>`);
        const btn = document.getElementById('tdUpgradeBtn'); if (btn) btn.textContent = 'Upgrade (●' + upgradeCost() + ')';
    }
    const up = document.getElementById('tdUpgradeBtn');
    if (up) up.addEventListener('click', () => { invested += upgradeCost(); level++; damage = Math.round(damage * 1.4); range = Math.round(range * 1.08); sync(); });
    const syn = document.getElementById('tdUpgradeSynergy');
    if (syn) syn.addEventListener('click', () => { synergy = !synergy; syn.textContent = synergy ? 'Frost synergy: ON' : 'Frost synergy: OFF'; sync(); });
    const rst = document.getElementById('tdUpgradeReset');
    if (rst) rst.addEventListener('click', reset);
    reset();

    // a small live sim: a creep crosses the tower's range, getting shot.
    const tx = 150, ty = H / 2;
    let creepX = -20, cd = 0;
    function update(dt) {
        const spd = synergy ? 55 : 110;
        creepX += spd * dt; if (creepX > W + 20) creepX = -20;
        cd -= dt; if (cd <= 0) cd = 1 / 1.5;
    }
    function render() {
        clearCanvas(ctx, W, H, TD.bg);
        ctx.fillStyle = TD.dim; ctx.font = '12px monospace'; ctx.textAlign = 'left';
        ctx.fillText('A slowed creep spends 2× as long in range → eats 2× the shots.', 12, 20);
        tdDrawRange(ctx, tx, ty, range);
        tdDrawTower(ctx, { x: tx, y: ty, color: TD.tower, angle: Math.atan2(ty - ty, creepX - tx), radius: 13 });
        const inRange = Math.abs(creepX - tx) < range;
        tdDrawEnemy(ctx, { x: creepX, y: ty, radius: 10, color: synergy ? TD.enemy : TD.enemy, slow: synergy, hp: 1, maxHp: 1 });
        if (inRange) { ctx.strokeStyle = TD.proj; ctx.lineWidth = 2; ctx.globalAlpha = (cd > 0.45 ? 1 : 0.2); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(creepX, ty); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();

// =============================================================================
// 4) dpsDashboard — DPS-per-gold & time-to-kill
// =============================================================================
(function dpsDashboard() {
    const canvas = document.getElementById('tdDpsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let enemy = 'normal';
    ['normal', 'fast', 'tank'].forEach((k) => { const b = document.getElementById('tdDps' + k[0].toUpperCase() + k.slice(1)); if (b) b.addEventListener('click', () => { enemy = k; highlight(); }); });
    function highlight() { ['normal', 'fast', 'tank'].forEach((k) => { const b = document.getElementById('tdDps' + k[0].toUpperCase() + k.slice(1)); if (b) b.style.outline = k === enemy ? '2px solid #4fc3f7' : 'none'; }); }
    highlight();

    const kinds = Object.values(SIM_TOWERS);
    function render() {
        clearCanvas(ctx, W, H, TD.bg);
        ctx.fillStyle = TD.dim; ctx.font = '12px monospace'; ctx.textAlign = 'left';
        ctx.fillText('DPS per ●gold (cost-efficiency)', 12, 18);
        tdBars(ctx, 12, 24, W / 2 - 24, H - 60,
            kinds.map((t) => ({ label: t.label, v: simDPS(t) / t.cost, c: t.color, t: (simDPS(t) / t.cost).toFixed(2) })));
        const ehp = SIM_ENEMIES[enemy].hp;
        ctx.fillStyle = TD.dim; ctx.fillText('Time-to-kill a ' + SIM_ENEMIES[enemy].label + ' (' + ehp + ' HP) — lower is better', W / 2 + 12, 18);
        tdBars(ctx, W / 2 + 12, 24, W / 2 - 24, H - 60,
            kinds.map((t) => ({ label: t.label, v: ehp / simDPS(t), c: t.color, t: (ehp / simDPS(t)).toFixed(1) + 's' })), { max: ehp / Math.min(...kinds.map(simDPS)) });
        tdInfo('tdDpsInfo', 'Splash wins cost-efficiency in crowds; the Sniper kills tanks fastest; Frost is low DPS but multiplies everyone else (see the synergy demo).');
    }
    tdRunWhenVisible(canvas, tdLoop(() => {}, render));
})();

// =============================================================================
// 5) threatHeatmap — where the pressure is + seeded determinism
// =============================================================================
(function threatHeatmap() {
    const canvas = document.getElementById('tdHeatCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const lane = (function () { const cells = [[-1, 1], [4, 1], [4, 6], [9, 6], [9, 2], [14, 2], [14, 7], [19, 7]]; return new TDPath(cells.map(([c, r]) => grid.cellCenter(c, r))); })();
    let heat = new Float64Array(grid.cols * grid.rows), maxHeat = 1, hottest = null, det = '';

    // Deterministically simulate one wave and accumulate per-cell HP-seconds.
    function simulate(seed) {
        const rng = tdRng(seed);
        const acc = new Float64Array(grid.cols * grid.rows);
        const q = tdGenerateWave(6);
        const creeps = q.map((spec, i) => new TDEnemy(lane, { ...spec, dist: -i * 22 - rng() * 10 }));   // seeded spacing
        const dt = 1 / 30;
        for (let step = 0; step < 600; step++) {
            for (const c of creeps) {
                if (!c.alive) continue;
                c.update(dt);
                const cell = grid.worldToCell(c.x, c.y);
                if (cell) acc[cell.row * grid.cols + cell.col] += c.hp * dt;   // HP-seconds spent here
            }
        }
        return acc;
    }
    function run(seed) {
        heat = simulate(seed);
        // determinism: a 2nd identical run must match bit-for-bit
        const again = simulate(seed);
        let diff = 0; for (let i = 0; i < heat.length; i++) diff = Math.max(diff, Math.abs(heat[i] - again[i]));
        det = diff === 0 ? '✓ two seeded runs identical' : '✗ diverged ' + diff;
        maxHeat = 1; hottest = null; let hv = -1;
        for (let i = 0; i < heat.length; i++) { if (heat[i] > maxHeat) maxHeat = heat[i]; if (heat[i] > hv) { hv = heat[i]; hottest = { col: i % grid.cols, row: Math.floor(i / grid.cols) }; } }
        tdInfo('tdHeatInfo', `Hottest cell = the most creep-HP-time = the best tower spot. <b style="color:#7CF2C8">${det}</b> — the property all balancing rests on.`);
    }
    const seedEl = document.getElementById('tdHeatSeed');
    const runBtn = document.getElementById('tdHeatRun');
    if (runBtn) runBtn.addEventListener('click', () => run((seedEl ? +seedEl.value : 1337) >>> 0));
    run(1337);

    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        // heatmap cells
        for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
            const v = heat[row * grid.cols + col]; if (v <= 0) continue;
            const t = Math.min(1, v / maxHeat);
            ctx.fillStyle = `rgba(${Math.round(120 + t * 135)},${Math.round(120 - t * 90)},${Math.round(60 - t * 40)},${0.25 + t * 0.6})`;
            ctx.fillRect(grid.originX + col * grid.tile, grid.originY + row * grid.tile, grid.tile, grid.tile);
        }
        tdDrawGrid(ctx, grid);
        tdDrawPath(ctx, lane, { grid });
        if (hottest) { const p = grid.cellCenter(hottest.col, hottest.row); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.strokeRect(p.x - grid.tile / 2 + 2, p.y - grid.tile / 2 + 2, grid.tile - 4, grid.tile - 4); }
        tdDrawHUD(ctx, grid, { msg: 'Threat heatmap of one seeded wave · white box = best build spot' });
    }
    tdRunWhenVisible(canvas, tdLoop(() => {}, render));
})();

// =============================================================================
// 6) lastStand — GRAND CAPSTONE: the complete tower defense
// =============================================================================
(function lastStand() {
    const canvas = document.getElementById('tdLastStandCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pointer = tdInstallPointer(canvas);
    const grid = new TDGrid(19, 9, 40, 0, 0);
    const spawn = { col: 0, row: 4 }, goal = { col: 18, row: 4 };
    const TOTAL_WAVES = 12;

    let towers, creeps, shots, pops, gold, lives, wave, status, selKind, mode, spawner, denyFlash, rng, seed;
    function reset(sd) {
        grid.clearOccupancy();
        seed = (sd ?? 1337) >>> 0; rng = tdRng(seed);
        towers = []; creeps = []; shots = []; pops = [];
        gold = 220; lives = 18; wave = 0; status = 'build'; selKind = 'gun'; mode = 'first'; denyFlash = 0;
        spawner = { queue: [], i: 0, timer: 0, interval: 0.55 };
        syncUi();
    }
    function replanAll() { for (const c of creeps) { const cell = grid.worldToCell(c.x, c.y); if (cell) { const np = tdAStarPath(grid, cell, goal, c.pos); if (np) { c.path = np; c.dist = 0; } } } }
    function startWave() { wave++; spawner.queue = tdGenerateWave(wave); spawner.i = 0; spawner.timer = 0; status = 'wave'; syncUi(); }

    const shopIds = { gun: 'tdLsGun', sniper: 'tdLsSniper', splash: 'tdLsSplash', frost: 'tdLsFrost' };
    Object.entries(shopIds).forEach(([k, id]) => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { selKind = k; syncUi(); }); });
    const modeIds = { first: 'tdLsFirst', closest: 'tdLsClose', strongest: 'tdLsStrong' };
    Object.entries(modeIds).forEach(([m, id]) => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { mode = m; for (const t of towers) t.targeting = m; syncUi(); }); });
    function syncUi() {
        Object.entries(shopIds).forEach(([k, id]) => { const b = document.getElementById(id); if (b) b.style.outline = k === selKind ? '2px solid #4fc3f7' : 'none'; });
        Object.entries(modeIds).forEach(([m, id]) => { const b = document.getElementById(id); if (b) b.style.outline = m === mode ? '2px solid #4fc3f7' : 'none'; });
        tdInfo('tdLsInfo', `seed <b>${seed}</b> · buy <b>${SIM_TOWERS[selKind].label}</b> (●${SIM_TOWERS[selKind].cost}) · click a tower to upgrade · targeting <b>${mode}</b>`);
    }
    const startBtn = document.getElementById('tdLsStart');
    if (startBtn) startBtn.addEventListener('click', () => { if (status === 'build') startWave(); else if (status === 'won' || status === 'lost') { reset(seed); } });
    const resetBtn = document.getElementById('tdLsReset');
    if (resetBtn) resetBtn.addEventListener('click', () => { const sEl = document.getElementById('tdLsSeed'); reset(sEl ? +sEl.value : 1337); });
    reset(1337);

    function towerAtCell(cell) { return towers.find((t) => { const tc = grid.worldToCell(t.x, t.y); return tdCellEq(tc, cell); }); }

    function update(dt) {
        // click: upgrade an existing tower, else place the selected kind
        if (pointer.justPressed && pointer.inside && status !== 'lost' && status !== 'won') {
            const c = grid.worldToCell(pointer.pos.x, pointer.pos.y);
            if (c) {
                const existing = towerAtCell(c);
                if (existing) {
                    const cost = Math.round(existing.cost * 0.8 * existing.level);
                    if (gold >= cost) { gold -= cost; existing.level++; existing.damage = Math.round(existing.damage * 1.4); existing.range = Math.round(existing.range * 1.08); }
                } else if (grid.isBuildable(c.col, c.row) && !tdCellEq(c, spawn) && !tdCellEq(c, goal)) {
                    const spec = SIM_TOWERS[selKind];
                    if (gold >= spec.cost) {
                        if (tdBlocksPath(grid, c.col, c.row, spawn, goal)) denyFlash = 0.6;
                        else { const p = grid.cellCenter(c.col, c.row); const t = new TDTower(p.x, p.y, { ...spec, targeting: mode }); t.level = 1; towers.push(t); grid.occupy(c.col, c.row, true); gold -= spec.cost; replanAll(); }
                    }
                }
            }
        }
        if (status === 'wave') {
            if (spawner.i < spawner.queue.length) {
                spawner.timer -= dt;
                if (spawner.timer <= 0) { spawner.timer = spawner.interval * (0.8 + rng() * 0.4); const path = tdAStarPath(grid, spawn, goal); if (path) creeps.push(new TDEnemy(path, spawner.queue[spawner.i])); spawner.i++; }
            }
            for (const c of creeps) c.update(dt);
            for (const t of towers) { const fired = t.update(dt, creeps); if (fired) shots.push(new TDProjectile(t.x, t.y, { target: fired, speed: t.projSpeed, damage: t.damage, color: t.color, splash: t.splash, slow: t.slow })); }
            for (const s of shots) s.update(dt, creeps);
            for (let i = creeps.length - 1; i >= 0; i--) {
                const c = creeps[i];
                if (c.leaked) { lives--; pops.push({ x: c.x, y: c.y, r: 13, life: 0.3, max: 0.3, color: TD.bad }); creeps.splice(i, 1); continue; }
                if (!c.alive) { gold += c.bounty; pops.push({ x: c.x, y: c.y, r: 11, life: 0.22, max: 0.22, color: TD.towerGold }); creeps.splice(i, 1); }
            }
            for (let i = shots.length - 1; i >= 0; i--) if (!shots[i].alive) shots.splice(i, 1);
            if (lives <= 0) { status = 'lost'; syncUi(); }
            else if (spawner.i >= spawner.queue.length && creeps.length === 0) {
                gold += 20 + Math.floor(gold * 0.1);        // wave-clear bonus + 10% interest
                status = wave >= TOTAL_WAVES ? 'won' : 'build';
                syncUi();
            }
        }
        for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= dt; if (pops[i].life <= 0) pops.splice(i, 1); }
        if (denyFlash > 0) denyFlash -= dt;
        pointer.endFrame();
    }
    function render() {
        clearCanvas(ctx, canvas.width, canvas.height, TD.bg);
        tdDrawGround(ctx, grid);
        const hover = (pointer.inside && status !== 'lost' && status !== 'won') ? grid.worldToCell(pointer.pos.x, pointer.pos.y) : null;
        tdDrawGrid(ctx, grid, { hover });
        for (const c of creeps) tdDrawEnemy(ctx, c);
        for (const s of shots) tdDrawProjectile(ctx, s);
        for (const t of towers) { tdDrawTower(ctx, t); if (t.level > 1) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('L' + t.level, t.x, t.y - 16); ctx.textAlign = 'start'; } }
        for (const p of pops) tdDrawPop(ctx, p);
        // hover range preview
        if (hover) { const t = towerAtCell(hover); if (t) tdDrawRange(ctx, t.x, t.y, t.range); else if (grid.isBuildable(hover.col, hover.row)) { const p = grid.cellCenter(hover.col, hover.row); tdDrawRange(ctx, p.x, p.y, SIM_TOWERS[selKind].range, { fill: 'rgba(124,242,200,0.05)' }); } }
        tdMarkerMini(ctx, grid, spawn, TD.spawn, 'S'); tdMarkerMini(ctx, grid, goal, TD.goal, 'G');
        const msg = denyFlash > 0 ? '⛔ That would seal the goal!'
            : status === 'build' ? (wave === 0 ? 'Build your maze, then Start Wave 1' : 'Wave ' + wave + ' cleared (+interest)! Build, then Start Wave ' + (wave + 1))
            : status === 'wave' ? 'Wave ' + wave + '/' + TOTAL_WAVES + ' — ' + (spawner.queue.length - spawner.i + creeps.length) + ' creeps left'
            : status === 'won' ? '🏆 You survived all ' + TOTAL_WAVES + ' waves — The Last Stand held!' : '💥 Overrun on wave ' + wave + ' — Reset to retry';
        tdDrawHUD(ctx, grid, { lives: Math.max(0, lives), gold, wave: Math.max(1, wave), waves: TOTAL_WAVES, msg });
    }
    function tdMarkerMini(ctx, grid, cell, color, label) {
        const p = grid.cellCenter(cell.col, cell.row);
        ctx.beginPath(); ctx.arc(p.x, p.y, grid.tile * 0.3, 0, TD.TAU); ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = '#0c1024'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, p.x, p.y); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
    tdRunWhenVisible(canvas, tdLoop(update, render));
})();
