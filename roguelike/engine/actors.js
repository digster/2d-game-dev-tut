// ===================================================================
// roguelike/engine/actors.js
//
// The shared "turn-based actor + input + UI" layer that sits on top of
// grid.js. Every tier's demos lean on this exact toolkit, so it lives in
// engine/ (loaded on every tier page) rather than being copy-pasted into
// each <tier>-demos.js — the same reasoning ARCHITECTURE.md gives for any
// helper used by ≥ 2 tier files.
//
// What's here:
//   • rlKeyToStep        — keyboard -> {dx,dy} | {wait} action
//   • rlInstallCanvasKeys — click-to-focus keyboard handling (per canvas)
//   • rlTryMove          — the move / attack / blocked resolver
//   • rlStepToward       — greedy one-tile pursuit (NOT pathfinding; the
//                          Advanced tier upgrades this to A* / Dijkstra)
//   • rlMakeRoom         — a quick rectangular room Level
//   • rlDrawEntities / rlEntityList / rlHpBar / flashes / rlFocusHint
//   • rlLog              — append to a scrolling message-log panel
//
// STYLE: these are bare `function` declarations (like shared/utils.js's
// drawVector/lerp/...), so they're global and callable from any tier file
// without an explicit window assignment. They're all `rl`-prefixed, which
// keeps them clear of the shared/utils.js globals (lerp/clamp/map/Vector2D).
// They depend on grid.js's Tile/Level/RL and shared/utils.js's clearCanvas,
// both loaded before this file.
// ===================================================================

// Map a keydown to an action. Supports arrows, WASD, and the classic
// roguelike vi-keys (h/j/k/l). '.' or space = "wait" (spend a turn in place).
function rlKeyToStep(e) {
    switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': case 'k': case 'K': return { dx: 0, dy: -1 };
        case 'ArrowDown':  case 's': case 'S': case 'j': case 'J': return { dx: 0, dy: 1 };
        case 'ArrowLeft':  case 'a': case 'A': case 'h': case 'H': return { dx: -1, dy: 0 };
        case 'ArrowRight': case 'd': case 'D': case 'l': case 'L': return { dx: 1, dy: 0 };
        case '.': case ' ': return { dx: 0, dy: 0, wait: true };
        default: return null;
    }
}

// Manhattan distance — the natural "how many cardinal steps apart" metric.
function rlManhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

// A rectangular room: solid rock with a hollowed-out floor interior.
function rlMakeRoom(w, h) {
    const lvl = new Level(w, h, Tile.WALL);
    for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++)
            lvl.set(x, y, Tile.FLOOR);
    return lvl;
}

// First LIVING actor on a tile (corpses don't block), optionally excluding one.
function rlActorAt(actors, x, y, exclude) {
    for (const a of actors)
        if (a !== exclude && !a.dead && a.x === x && a.y === y) return a;
    return null;
}

// The move-or-attack resolution. Returns 'moved' | 'attacked' | 'blocked'.
// Only 'moved'/'attacked' should cost a turn — 'blocked' (a wall) is a free retry.
function rlTryMove(level, actor, step, actors, onAttack) {
    const tx = actor.x + step.dx, ty = actor.y + step.dy;
    const target = rlActorAt(actors, tx, ty, actor);
    if (target) { if (onAttack) onAttack(actor, target); return 'attacked'; }
    if (level.isWalkable(tx, ty)) { actor.x = tx; actor.y = ty; return 'moved'; }
    return 'blocked';
}

// Ordered cardinal steps from `from` toward `to` (bigger axis first).
function rlStepCandidates(from, to) {
    const dx = Math.sign(to.x - from.x), dy = Math.sign(to.y - from.y);
    const c = [];
    if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
        if (dx) c.push({ dx, dy: 0 }); if (dy) c.push({ dx: 0, dy });
    } else {
        if (dy) c.push({ dx: 0, dy }); if (dx) c.push({ dx, dy: 0 });
    }
    return c;
}

// Greedy one-tile step toward a target, avoiding walls and other living actors
// (but allowed to step ONTO the target itself, i.e. attack it). Returns the
// chosen {dx,dy}, or {0,0} if boxed in. NOT real pathfinding — that's Advanced.
function rlStepToward(level, from, to, actors) {
    for (const c of rlStepCandidates(from, to)) {
        const nx = from.x + c.dx, ny = from.y + c.dy;
        const occ = rlActorAt(actors, nx, ny, from);
        if (occ === to) return c;                                   // step = attack target
        if (level.isWalkable(nx, ny) && !occ) return c;             // step onto open floor
    }
    return { dx: 0, dy: 0 };
}

// Click-to-focus keyboard handling. Each canvas listens only while focused, so
// multiple demos on one page never fight over the arrow keys, and we
// preventDefault so the page doesn't scroll. Returns a {focused} state object
// the render loop reads to draw the "click to focus" hint.
function rlInstallCanvasKeys(canvas, onAction) {
    const state = { focused: false };
    canvas.addEventListener('mousedown', () => canvas.focus());
    canvas.addEventListener('focus', () => { state.focused = true; });
    canvas.addEventListener('blur', () => { state.focused = false; });
    canvas.addEventListener('keydown', (e) => {
        const action = rlKeyToStep(e);
        if (!action) return;
        e.preventDefault();   // arrows/space would otherwise scroll the page
        onAction(action);
    });
    return state;
}

// Draw glyphs for a list of entities ({x,y,ch,color}). Kept separate from
// drawGlyphGrid so attack flashes can be drawn BETWEEN terrain and glyphs.
function rlDrawEntities(ctx, ox, oy, cell, ents) {
    ctx.font = Math.floor(cell * 0.82) + 'px "Courier New", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const e of ents) {
        ctx.fillStyle = e.color;
        ctx.fillText(e.ch, ox + e.x * cell + cell / 2, oy + e.y * cell + cell / 2);
    }
}

// Build the render list: corpses (%) first, then living monsters, player on top.
function rlEntityList(actors, player) {
    const ents = [];
    for (const a of actors) if (a.dead) ents.push({ x: a.x, y: a.y, ch: '%', color: RL.dim });
    for (const a of actors) if (!a.dead && a !== player) ents.push({ x: a.x, y: a.y, ch: a.ch, color: a.color });
    if (player && !player.dead) ents.push({ x: player.x, y: player.y, ch: '@', color: RL.player });
    return ents;
}

// A 3px HP bar pinned to the top of an actor's cell.
function rlHpBar(ctx, ox, oy, cell, x, y, frac, color) {
    const px = ox + x * cell + 3, py = oy + y * cell + 2, w = cell - 6;
    ctx.fillStyle = '#000';
    ctx.fillRect(px, py, w, 3);
    ctx.fillStyle = color;
    ctx.fillRect(px, py, Math.max(0, Math.round(w * frac)), 3);
}

// Transient red highlight on a cell when it's hit. Stored as {x,y,until}.
function rlPushFlash(flashes, x, y) { flashes.push({ x, y, until: performance.now() + 250 }); }
function rlDrawFlashes(ctx, ox, oy, cell, flashes, now) {
    for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i], left = f.until - now;
        if (left <= 0) { flashes.splice(i, 1); continue; }
        ctx.fillStyle = 'rgba(239,83,80,' + (0.6 * left / 250).toFixed(3) + ')';
        ctx.fillRect(ox + f.x * cell, oy + f.y * cell, cell, cell);
    }
}

// The "click here, then use the keys" overlay shown until the canvas has focus.
function rlFocusHint(ctx, w, h, focused) {
    if (focused) return;
    ctx.fillStyle = 'rgba(13,17,23,0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7CF2C8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('▶ Click to play', w / 2, h / 2 - 10);
    ctx.fillStyle = '#9e9e9e';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('then: arrows · WASD · hjkl', w / 2, h / 2 + 12);
}

// Append a line to a scrolling message-log panel. textContent (not innerHTML)
// keeps it injection-proof and frees us from HTML-escaping the dice text.
function rlLog(panel, text, cls) {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = text;
    panel.appendChild(div);
    while (panel.childNodes.length > 80) panel.removeChild(panel.firstChild);
    panel.scrollTop = panel.scrollHeight;
}
