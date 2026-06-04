# ARCHITECTURE

A **static, build-free** teaching site. Every page is a hand-written `.html`
file opened directly (or via any static server) — no bundler, no framework, no
package step. Learn-by-doing: each topic ships a live, asset-free WebGL/Canvas
demo next to its explanation.

## Big picture

```
index.html                     ← landing page, links to every track
shared/                        ← cross-track helpers (styles, utils, lazy mount, export)
<track>/                       ← one folder per track (e.g. shaders/, isometric-strategy/)
  index.html                   ← that track's clickable topic index (must stay in sync)
  <tier>.html                  ← one page per TIER (shaders: beginner, intermediate,
                                  expert, raymarching, stylization, distortion,
                                  advanced, simulations — 8 tiers)
  <tier>-demos.js              ← page-side interactive demos for that tier
  bundles-<tier>.js            ← standalone-export payload for that tier
memory/YYYY-MM-DD.md           ← running work log (see CLAUDE.md)
```

**Sub-tracks (voxel-worlds only).** Most tracks are flat. `voxel-worlds/` is the
exception: it teaches two distinct game styles, so its `index.html` links to two
**sub-track subdirectories** — `voxel-worlds/terraria/` and `voxel-worlds/noita/`
— and each sub-track is itself a normal track folder (own `index.html` +
`<tier>.html` + `<tier>-demos.js` + `bundles-<tier>.js`). Sub-track pages sit
**two** levels deep, so they reference shared assets as `../../shared/…` and
Fundamentals anchors as `../../<page>.html#…` (vs `../` for a flat track). The
root `index.html` TOC nests two `<ul>` levels for this track (track → sub-track →
tier) where flat tracks nest only one.

**Per-track `<track>/net/`-style helper subfolders.** Most tracks keep helpers
inline at the top of each `<tier>-demos.js`. The exception is when a helper has
to be **shared across multiple tier files** (and is too large or important to
copy-paste). `netcode/` introduces this pattern: `netcode/net/fake-network.js`
and `netcode/net/seeded-rng.js` are loaded by `netcode/index.html` and (later)
every `netcode/<tier>.html`. They expose their classes on `window` (`FakeNetwork`,
`SeededRng`), pre-checked to not collide with anything in `shared/utils.js`.
This is cheaper than promoting them to `shared/` because they're netcode-specific
— if a second track ever needed them, **that** would be the moment to elevate.
The general rule: helpers used by ≥ 2 tier files inside the same track go in a
sibling subfolder named after their concern; helpers used across multiple tracks
go in `shared/`. `roguelike/engine/` is the second instance of this pattern:
`seeded-rng.js` (`RogueRng` — a superset of netcode's `SeededRng`, deliberately
re-named and kept track-local rather than shared so the track is self-contained
and can teach roguelike-flavoured RNG helpers); `grid.js` (`Tile`/`Level`/`RL`/
`drawGlyphGrid` — the turn-based grid core + ASCII glyph renderer every roguelike
tier reuses); and `actors.js` (the `rl*` turn/movement/combat/input/render
toolkit — `rlTryMove`, `rlStepToward`, `rlInstallCanvasKeys`, `rlDrawEntities`,
`rlLog`, …). `actors.js` was extracted from the Beginner tier the moment the
Intermediate capstone became its second consumer — exactly the "≥ 2 tier files
⇒ promote to a sibling folder" trigger above. these expose their names on
`window`, pre-checked against `shared/utils.js`. A fourth, `dungeon.js`
(`generateDungeon` + `dg*` helpers), joined when the Advanced tier became the
third consumer of the rooms-and-corridors generator the Intermediate tier
teaches inline; a fifth, `vision.js`
(`losLine`/`computeFOV`/`aStarPath`/`dijkstraFrom`/`stepDownhill`), promoted out
of the Advanced tier's `advanced-demos.js` once the Expert capstone became a
second consumer; and a sixth, `rpg.js` (`Item`/`attackDice`/`tickStatuses`/
`speedOf`/`applyConsumable`, …), which packages the Expert tier's RPG systems
for the Simulations grand capstone. Note the two distinct promotion styles:
`actors.js`/`vision.js` were *moved* (the origin tier now loads the engine copy),
whereas `dungeon.js`/`rpg.js` are *lib copies* (the origin tier still teaches the
system inline) — so `rpg.js` is loaded only on `simulations.html`, never on
`expert.html`, since a second `class Item` on one page is a redeclaration error. Tier-*specific* algorithms still stay inline in their
`<tier>-demos.js` because they're the lesson, not shared infrastructure — e.g.
the Advanced tier's `losLine`/`computeFOV`/`aStarPath`/`dijkstraFrom` are
top-level functions in `advanced-demos.js` (top-level so they're unit-testable
from the console, not just usable by the demos). `platformer/engine/` is the
**third** instance of this per-track helper-folder pattern: `tilemap.js`
(`PFTile`/`TileMap`/`PF`/`drawTileMap`), `physics.js` (`AABB`/`moveAndCollide` —
per-axis AABB-vs-tile collision, the single most-reused platformer primitive),
and `input.js` (`pfInstallKeys` held-key input + `pfLoop` fixed-timestep
accumulator), all on `window`, pre-checked vs `shared/utils.js`. The platformer
differs from the roguelike in being **real-time, not turn-based** — a continuous
fixed-timestep loop (`pfLoop`) with held-key + edge-detected input, vs the
roguelike's one-action-per-keypress `rlInstallCanvasKeys`. Its taught,
tier-specific algorithms start inline in their tier and promote to `engine/` only
on the 2nd consumer. This already happened once: the **Intermediate** tier's
`PlayerBody` controller + feel kit was *moved* to **`engine/player.js`** when the
**Advanced** tier became its 2nd consumer (intermediate.html now loads the engine
copy; its demos file no longer declares the class — a `class PlayerBody` on both
the inline and engine copy on one page would be a redeclaration error). The
abilities (wall-slide/wall-jump, dash) live *in* `PlayerBody` behind the same
zeroable-knob pattern as the feel kit, while the **collision extensions** stay
inline in `advanced-demos.js` as the tier's lesson: `pfResolveWorld` (SOLID +
one-way platforms + 45° slope tiles — top-level + console-testable) and
`MovingPlatform`/`pfRidePlatforms`. The seam between them is `PlayerBody`'s
swappable **`resolve(box,dx,dy)` hook** (default = plain `moveAndCollide`; the
Advanced demos inject `pfResolveWorld`) — the controller learns one-ways and
slopes without a single edit. The **Expert** tier's `Camera` (follow + deadzone +
look-ahead + trauma shake), `ParticleField`, `pfDrawCharacter` and `drawParallax`
are likewise taught inline in `expert-demos.js`. `Camera` then **graduated to
`engine/camera.js`** when the Simulations capstone became its 2nd consumer (a
move: expert.html now loads it, expert-demos.js no longer declares the class) — so
`platformer/engine/` holds the full cross-tier core (tilemap, physics, input,
player, camera). The Simulations tier is self-contained the lib-copy way: it
**re-declares** the compact helpers its "Summit" capstone composes (`pfResolveWorld`,
`MovingPlatform`/`pfRidePlatforms`, `drawParallax`, `pfDrawCharacter`) verbatim
inline rather than loading the Advanced/Expert demos files, and teaches its four
performance systems (culling, `ParticlePool`, `SpatialGrid`, `ChunkCache`) as new
inline lessons. **The platformer track is complete — 5 tiers, 28 demos, 5 engine modules.**

`physics-puzzle/engine/` is the **fourth** instance of the per-track helper-folder
pattern, scaffolded the same way (names on `window`, `pz`/`PZ`-prefixed, pre-checked
vs `shared/utils.js`, and deliberately reusing utils' `Vector2D` rather than
rebuilding vectors). It splits the core three ways by concern: `world.js`
(`PZWorld`/`PZBody`) is a **pure integrator** — gravity + semi-implicit Euler only;
`loop.js` (`pzLoop` fixed-timestep accumulator, a sibling of `pfLoop`, +
`pzInstallPointer` for drag/touch input); `render.js` (`PZ` palette +
`pzDrawBody`/`pzDrawArena`/`pzDrawDots`). The deliberate design choice mirrors the
platformer's "one shared primitive, lessons on top": collision is **not** in the
engine — the Beginner tier teaches it inline in `beginner-demos.js` as three
top-level (console-testable) routines `pzResolveStatic` (circle-vs-arena),
`pzResolveBlock` (circle-vs-AABB) and `pzCollideCircles` (impulse along the normal,
inverse-mass weighted). **A key subtlety drove the actual tier outcomes: each tier
brings its OWN collision family, so the early "promotes in the next tier" guesses were
wrong twice.** The **Intermediate** tier teaches **position-based Verlet** inline
(`PZVerletPoint`/`PZConstraint`/`pzStepRope`, the cut via `pzCutBlade`/`pzClickCut` +
`lineIntersection`, payload-vs-wall as plain `pos`-depenetration — a Verlet point has no
velocity to reflect), so it does NOT consume the Beginner circle routines. The
**Advanced** tier teaches **convex-polygon rigid bodies** inline (`PZRigidBody`,
`pzPolyVsPoly` = SAT + reference/incident-face clipping, `pzSolveManifold` = sequential
impulses with `r × J` + Coulomb friction + Baumgarte bias, `PZJoint` = a 2×2
effective-mass pivot constraint with a break threshold) — a *different, more general*
collision family that **supersedes** the Beginner circle solver rather than reusing it.
The **Expert** tier ("Destruction & Debris") is the rigid engine's genuine 2nd consumer
(debris are rigid fragments; demolition reads the impact impulse) — so that engine was
**promoted** from inline into **`engine/rigid.js`** (a *move*: `advanced.html` +
`expert.html` both load it, `advanced-demos.js` no longer declares it), and the engine
gained one reporting feature the tier needs: `body.impact` (the total normal impulse a
body received last step, summed in `pzSolveManifold` and reset each step). Expert teaches
its own destruction algorithms inline (`pzFractureBody` Voronoi shatter + the convex-clip
helpers, a debris pool, dust/trauma-shake/hitstop juice). The Beginner circle routines
(`pzResolveStatic`/`pzCollideCircles`) and the Intermediate Verlet classes still have a
single consumer each and **stay inline** — their 2nd consumers come in Simulations (the
grand-capstone slingshot for circles; soft-bodies/ragdolls for Verlet → a future
`engine/constraints.js`). So `engine/` is now **4 modules** (world, loop, render, rigid).
This is the honest application of "promote on the 2nd consumer" — never promote on a
guess (the earlier "promotes in the next tier" notes were wrong twice because each tier
brings its own collision family). Two
track-specific footguns are load-bearing here: (1)
`Vector2D` **mutates in place** (`add`/`multiply`/`divide`/`normalize`/`limit` change
`this`; only `subtract`/`copy` return new), so all engine maths `.copy()`s a shared
vector before mutating — corrupting the shared `gravity` vector is the classic bug
this avoids; (2) launch speed is clamped so a fast shot still steps less than its
radius, honouring the per-step resolver's sub-tile contract (high-speed tunneling is a
deferred Simulations topic). Demos are pointer-driven, so (like platformer/roguelike)
they omit `data-demo-id`. The **Simulations** tier (the finale) is the Verlet core's 2nd
consumer, so `PZVerletPoint`/`PZConstraint`/`pzStepRope`/`pzVerletArena` were **promoted**
(a *move*) from `intermediate-demos.js` into **`engine/constraints.js`** — so the engine
ends at **5 modules** (world, loop, render, rigid, constraints), the two physics families
(position-based Verlet + impulse-based rigid) side by side, each promoted on its genuine
2nd consumer. The tier's own content (a `PZSpatialHash` broadphase, sleeping/islands, a
pressure soft-body on the Verlet core, a ragdoll on the rigid core, and a position-based
particle fluid `pzFluidStep` with emergent buoyancy) is inline (terminal consumer); the
grand capstone "Rube" runs both families in one world (heavy rigid bodies are kept out of /
removed-on-entry to the fluid so the position-based water stays stable). **Status: the
Physics Puzzle track is COMPLETE — 5 tiers, 30 demos, 5 engine modules.**

`bullet-hell/engine/` is the **fifth** instance of the per-track helper-folder pattern (names
on `window`, `bh`/`BH`-prefixed, pre-checked vs `shared/utils.js`, and deliberately reusing
utils' `Vector2D` — especially `Vector2D.fromAngle(θ, len)`, since a danmaku bullet's velocity
is a polar coordinate). It is a **vertical danmaku (Touhou/Cave) shooter** track, scaffolded the
same way the physics-puzzle was — and split by the same "one shared primitive, lessons on top"
principle. The **scaffold ships three modules**: `loop.js` (`bhLoop`, a fixed-timestep
accumulator that is a near-verbatim sibling of `pzLoop`/`pfLoop` — patterns are equations in
time and a replay must reproduce a run exactly, so both need a constant `dt`; plus
`bhInstallKeys`, **canvas-scoped** held-key + edge-detected input, and `bhInstallPointer` for the
editor); `render.js` (the `BH` palette + a parallax `bhMakeStars`/`bhUpdateStars`/`bhDrawStars`
starfield, `bhDrawField`, `bhDrawPlayer`, `bhDrawBullet`); and `field.js` (`BHField` + `BHBullet`
— a pure **bullet container/integrator**: spawn, advance positions, cull off-screen, **no
collision**). The deliberate omission mirrors physics-puzzle keeping `PZWorld` a pure integrator:
hit/graze detection is the *lesson* of the Beginner tier (the tiny **hitbox** vs larger
**graze-box** is the genre's whole identity), taught inline there as `bhHitTest`/`bhGrazeTest`,
not hidden in the engine. Two design choices worth flagging: (1) input is **canvas-scoped, not
window-global** — a danmaku tier page stacks many keyboard demos on one scroll, so each canvas is
made focusable (`tabIndex`) and only swallows the arrow/space keys (to stop page-scroll) **while
focused**, clearing all held keys on `blur` so nothing sticks (the roguelike's
`rlInstallCanvasKeys` made the same call; the platformer's window-global `pfInstallKeys` works
only because it ships one demo per page); (2) `BHBullet` carries **inert** `turn` (angular
velocity on the heading) and `accel` (speed change along it) knobs — zero by default so a plain
bullet flies straight — which the Intermediate "curved paths" lesson simply switches on, the same
way `PZBody`'s `angle`/`angularVel` sat inert until the Advanced rigid tier. The same
**Vector2D-mutates-in-place footgun** applies (a bullet owns its `pos`/`vel`, so mutating those is
safe, but the integrator still `.copy()`s `vel` before scaling it for the position update).
**Promotions (on the genuine 2nd consumer, never on a guess):** the Intermediate `BHEmitter` +
`bhFireRing`/`bhFireFan` pattern primitives were **moved** to `engine/emitter.js` when the Advanced
boss tier became their 2nd consumer (intermediate-demos.js no longer declares them; both pages load
the engine copy). `engine/render.js` gained `bhDrawBoss`/`bhDrawHpBar` with the Advanced tier. The
Advanced spell-card/timeline runtime (`BHSpellCard`) stays inline, earmarked for `engine/script.js`
when the Simulations boss-rush reuses it. **A planned promotion that was correctly NOT taken:** the
early plan said the Expert tier would "upgrade `field.js` in place" to a Struct-of-Arrays store —
but that would shatter the **object API** (`field.bullets` as objects with `.pos`/`.grazed`) that
Beginner→Advanced teach against and iterate. So the engine's `BHField` stays the object-based
*teaching* store, and the Expert tier instead teaches the **production** stores **inline** as its
lesson: `BHBulletPool` (free-list, plain-number fields, zero-alloc), `BHSoaBullets` (flat
`Float32Array`s + O(1) swap-remove cull), `BHSpatialHash` (uniform grid; N hit-checks → ~k), plus
batched rendering (one `beginPath`/`fill` for the whole store) — each with a live work-ms meter
proving 10k+ bullets at 60 fps. This is the honest "promote-on-a-guess was wrong" correction the
physics-puzzle ARCHITECTURE already documents; the SoA store + spatial hash would promote to
`engine/` only if the Simulations capstone genuinely reuses them. The track `index.html` carries a
**scaffold self-check** that proves integration, off-screen culling, and **bit-for-bit determinism**
across two identically-seeded runs — the guarantee the Simulations replay tier rests on. Demos are
keyboard/pointer-driven so they omit `data-demo-id` (opt out of the Export button), like
platformer/roguelike/physics-puzzle. **Status: Beginner → Expert shipped (4 tiers, 25 demos, engine
= loop/render/field/emitter); Simulations finale next.**

**Why tiers are separate files:** content is split beginner → intermediate →
expert → raymarching → stylization → distortion → advanced → simulations so each
file stays editable without hitting length limits, and the per-track
`index.html` is the single source of truth that links them. **Any content add/edit must keep that index consistent** (project
rule). For long pages, the in-page `<div class="toc">` is also a clickable
index.

## Critical workflows

- **Run / preview:** open the `.html` directly or serve statically
  (`python3 -m http.server`). No build.
- **Verify a demo:** open the tier page in a real browser; the DevTools console
  must be **error-free** (hard project rule — shaders compile at runtime, so a
  GLSL typo only shows in the console).
- **Add a topic:** edit the tier `.html` (section + collapsible code + canvas)
  **and** the tier `<demos>.js`, **and** update the track `index.html` + in-page
  TOC. Keep code examples bug-free.

## Shaders track — the demo harness pattern (the key design)

The shaders track renders many WebGL demos on one long scroll. Browsers cap
simultaneous WebGL contexts (~16) and silently evict the oldest, so demos are
**lazy-mounted**.

**The extension seam is the harness contract**, consumed by
[`lazyToy`](shared/lazy-demo.js):

```
lazyToy(canvas, factory)
  factory: (canvas) => harness
  harness contract: { destroy(), stop(),
                      setParam?, setPaused?, reset?, rebuild?, … }
```

`lazyToy` is **harness-agnostic**: it only mounts the factory while the canvas
is on-screen and calls `destroy()` (free GL objects + lose context) when it
scrolls away, replaying the last mutator calls on re-mount. Any engine that
returns that object shape Just Works — page demos and standalone exports alike.

Engines that conform (all in the tier `*-demos.js` files):

| Harness        | Model                                   | Use for |
|----------------|-----------------------------------------|---------|
| `makeShaderToy`| single fragment shader (fullscreen quad) | most effects, NPR, UV-warps, raymarching |
| `makeMeshToy`  | a real triangulated grid mesh + **user vertex shader** (a_position/a_uv) | vertex-stage geometry FX (jelly/wind/flag) — `distortion-demos.js` |
| `makeFXChain`  | multi-pass post-processing chain        | bloom, blur, … |
| `makeSim`      | **one** ping-pong float grid, one step, gather-only (RGBA channels packed) | Life, RD, fluid, wave, particles/boids (`points` display) |
| `makeAgentSim` | **two** coupled buffer pairs (small agents + screen trail), multi-pass, **scatter** (`gl.POINTS` additive deposit) | Physarum/slime-mold-class agent sims |

**Rule of thumb:** a new *example* of an existing class ⇒ add only shaders to a
new demo IIFE. A new *class* of simulation that the existing harnesses can't
express ⇒ add a **sibling harness** (do not retrofit a working one — `makeSim`
powers 9 demos). Two worked examples: `makeAgentSim`
([shaders/simulations-demos.js](shaders/simulations-demos.js)) exists because
`makeSim`'s single-grid gather model can't represent agents sensing a
separately-diffused trail; `makeMeshToy`
([shaders/distortion-demos.js](shaders/distortion-demos.js)) exists because
`makeShaderToy`'s fullscreen quad has no geometry — a vertex-stage effect needs
a real mesh. Both still return the `lazyToy` handle shape (`makeMeshToy` adds
`rebuild({vert,frag})`, already in `LAZY_DEMO_METHODS`) so the shared runtime is
untouched.

### makeAgentSim per-frame pipeline

```
①  agentStep   (quad, agent grid)   agents sense trail @3 sensors → steer → move
②  trailStep   (quad, trail grid)   3×3 blur (diffuse) × decay
③  deposit     (gl.POINTS → trail)  one point/agent, additive blend ONTO ②'s result
④  display     (quad, screen)       colourise the trail
```
Two RGBA16F ping-pong pairs (agents NEAREST/CLAMP, trail LINEAR/REPEAT for a
toroidal world). Float blending into the trail is covered by
`EXT_color_buffer_float` (RGBA16F); `EXT_float_blend` is only needed for 32-bit
targets. Uniform convention shared with `makeSim`: `u_time/u_frame/u_mouse/
u_mouseDown/u_param`, plus `u_agents` (unit 0), `u_trail` (unit 1), `u_trailRes`.

## Standalone export (shaders track)

[`shared/export-demo.js`](shared/export-demo.js) injects an **Export** button
into every `<details data-demo-id="…" data-deps="…">`, assembling a single-file
copy from `bundles-<tier>.js` (`DEPENDENCY_BUNDLES` = verbatim helper source,
`DEMO_CODE`/`DEMO_HTML` = the demo). This bundle is a **hand-maintained,
lazy-free copy** (standalone pages have one always-visible canvas), separate
from the live source. A demo is exportable **only** if registered there;
omitting `data-demo-id` cleanly opts a demo out (no broken button). The Physarum
demo currently ships page-only — registering `sh_makeAgentSim` + `sh_slime` for
export is a clean follow-up iteration.

The **game-math track** (`beginner`→`simulations`) shares one pair of registries —
[`shared/demo-bundles.js`](shared/demo-bundles.js) (`DEMO_CODE`/`DEMO_HTML`) +
[`shared/dependency-bundles.js`](shared/dependency-bundles.js) (`DEPENDENCY_BUNDLES`) —
instead of per-tier `bundles-*.js`. As of this iteration the **Beginner page is fully
exportable**: its last 5 unwired demos (`vectorBasics`, `vectorPlayground`,
`advancedVector`, `advancedTrig`, `matrix`) are now registered, matching
`intermediate`→`simulation-v2` (already 100% wired). **Mirror-drift caveat:**
`DEPENDENCY_BUNDLES` is a hand-copied mirror of `shared/utils.js` and can silently lag
it — wiring `advancedVector` first required adding the missing `Vector2D.project`/
`.reflect`, and `matrix` required a brand-new `matrix2d` bundle (whose `transformPoint`
returns a `Vector2D`, so `vector2d` must precede `matrix2d` in `data-deps`). When
registering a demo, verify every class/method it calls exists in the *mirror*, not just
in `utils.js`, or the exported file throws at runtime while the page demo still works.
(The `vector2d`/`matrix2d` bundles are now exact mirrors of `utils.js`.) The Export button
itself copies via the async Clipboard API with a hidden-`<textarea>` + `execCommand('copy')`
fallback (`copyTextToClipboard` in `export-demo.js`), so it still works when the guide is
opened from `file://` (no secure context) instead of failing with "✗ Error".

## Conventions that differ from common practice

- GLSL lives in JS template literals; **every shader's first line is literally
  `#version 300 es`** (WebGL2). Shared GLSL kit is module-level consts
  (`SIM_HEAD`, `SIM_LIB`, `AGENT_HEAD`, `AGENT_LIB`, `DEPOSIT_*`, …).
- Demos are IIFEs that early-`return` if their canvas id is absent (one demos
  file is safely shared by a whole tier page).
- **Each `<tier>-demos.js` is self-contained** — it re-declares the core
  helpers it needs (palette, `TileWorld`, noise, …) rather than importing,
  because only one tier's demos file loads per page. **Caveat:** a tier file's
  *top-level* `const`/`let`/`class` must not shadow a global already defined by
  `shared/utils.js` (e.g. `lerp`, `clamp`, `map`). A script-level `const lerp`
  colliding with utils.js's `function lerp` throws an "already declared" error
  at *instantiation* — silently killing the whole file (every IIFE included).
  Such helpers must live *inside* an IIFE, or just reuse the utils.js global.
- Harnesses degrade gracefully (`fail()` paints the error onto a 2D canvas)
  rather than throwing — feature gaps are a message, not a crash.
- Other tracks (`isometric-strategy/`, `voxel-worlds/`) follow the same
  tier-file + per-track-index structure but are plain Canvas2D, not the WebGL
  harness stack. Their `bundles-<tier>.js` only needs to register demos whose
  controls are buttons — the export scaffold (`shared/export-demo.js`) renders
  `controls` entries as `<button>` only, so a demo using sliders/checkboxes/
  radios omits `data-demo-id` to cleanly opt out of the Export button.
