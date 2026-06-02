## About

2d game concepts teaching aid!

## Contents

The guide has two categories of content, both linked from `index.html`:

### Fundamentals (tier-based reference)

Math and core systems organized by difficulty tier — read one tier per session.

- `beginner.html` — vectors, trigonometry, easing, basic game systems, matrix transforms
- `intermediate.html` — lerp, physics, collision, particles, raycasting, springs
- `advanced.html` — steering, pathfinding, flow fields, state machines, behavior trees, IK
- `expert.html` — spatial partitioning, ECS, tilemaps, noise, networking, fixed timestep
- `simulation.html` / `simulation-v2.html` — fluid dynamics, cloth, SPH water, RK4 physics

### Tracks (end-to-end tutorials)

Vertical tracks that compose the fundamentals into a working build. Two flavours coexist
under the same section: **genre tracks** (RTS, voxel, shaders, racing) compose the
fundamentals into a working game; **systems tracks** (netcode) build cross-cutting
machinery that any genre can adopt. Each track lives in its own subdirectory with a
per-tier file structure mirroring the Fundamentals layout.

- `isometric-strategy/` — build an AoE2 / Red Alert 2 style isometric RTS.
  See `isometric-strategy/index.html` for the track roadmap. Currently scaffolded;
  tier files are landing iteratively.
- `voxel-worlds/` — **fully shipped — all 8 tiers across both sub-tracks.**
  Learn 2D voxel worlds and manipulation, Terraria-style.
  See `voxel-worlds/index.html` for the track roadmap. This track is unique in
  having **two sub-tracks**, each its own nested subdirectory with its own
  five-/three-tier file structure: `voxel-worlds/terraria/` (tile-grid voxels —
  block-discrete, player-edited) and `voxel-worlds/noita/` (cellular-pixel
  voxels — every pixel self-simulates). The **Terraria sub-track is complete —
  all 5 tiers shipped**; the Noita sub-track is a preview index.
  Beginner (7 Canvas2D demos): tile coords, flat-`Uint8Array` storage,
  sprite-less grid rendering with a deterministic 2D hash, viewport culling,
  foreground/background wall layers. Intermediate (5 demos): mouse-to-tile
  picking with Chebyshev tool reach, mining/placing with a hotbar, a
  falling-sand cellular automaton, per-axis AABB player-vs-grid collision, and
  a side-scroll digger mini-project. Expert (6 demos): value-noise + fBm,
  surface-heightmap worldgen with biome zones, noise-iso-band cave carving +
  depth-graded ore, cellular-automaton water, BFS flood-fill tile lighting, and
  a chunked infinite world. Advanced (5 demos): run-length-encoded save/load,
  A* pathfinding on a destructible grid, a day/night cycle driving the skylight
  seed, offscreen-canvas render caching, and a "living world" capstone (player
  + A* hunter + day/night + lighting). Simulations (5 demos): deep-dive
  visualisers — cave-carving (noise iso-band vs worm-walk), biome blending,
  a ring-by-ring BFS light stepper, a liquid-flow stepper with per-cell
  decision arrows, and an ore-by-depth histogram. Terraria demo IDs and helper
  bundles are prefixed `vox_`.
  The **Noita sub-track is also complete — all 3 tiers shipped.** Beginner
  ("Falling Sand from Scratch", 4 demos): a 36,000-pixel `ImageData`-rendered
  falling-sand engine, a coarse rule-stepper with per-grain decision arrows, a
  scan-order demo that shows the top-down "teleport" bug live, and a
  paint-walls-and-pour-sand sandbox — teaching what's new vs Terraria: per-pixel
  cellular automata, `ImageData`/`Uint8ClampedArray` rendering, and
  update-order correctness. Intermediate ("Liquids, Gases, Fire & Reactions",
  5 demos): a multi-material CA engine (10 materials, 5 behaviour kinds
  dispatched from a table) — liquids with sideways flow and density layering,
  gases with inverted gravity, probabilistic fire propagation with burn timers,
  a data-driven reaction table, and a full material sandbox. Advanced
  ("Performance, Material Library & Sandbox", 4 demos): sleeping-chunk
  partitioning that skips settled regions (measurable step-time speedup), a
  `registerMaterial()` library that adds materials at runtime without engine
  edits, live rule tuning via a `CONFIG` object, and a 75,600-cell performant
  sandbox capstone. Noita demo IDs are prefixed `noi`.
- `shaders/` — learn WebGL / GLSL fragment shaders for 2D game effects.
  See `shaders/index.html` for the track roadmap. **Fully shipped — all 8
  tiers:** Beginner (Shader Foundations), Intermediate (Patterns, Noise &
  Distortion), Expert (Textures & Sprite Shaders), **Raymarching (3D SDFs &
  Fractals)**, **Stylization (NPR)**, **Distortion (Glitch & Vertex FX)**,
  Advanced (Multi-Pass & Post-Processing), Simulations (GPU Compute-Style
  Effects). WebGL1 + GLSL ES 1.00 for most tiers (raymarching/fractals use
  `precision highp float`); Advanced shows every effect in WebGL1 *and*
  WebGL2; Simulations is WebGL2 + GLSL ES 3.00 with `RGBA16F` float textures
  (`EXT_color_buffer_float`, with graceful degradation). Demo IDs and helper
  bundles are prefixed `sh_`. The track was broadened for shader *mastery*
  variety: Intermediate gained IQ cosine palettes, Truchet/hex tiling and
  seamless/looping patterns; Expert gained cross-hatch/halftone and
  ASCII/Kuwahara sprite stylizers; Advanced gained chromatic aberration and
  datamosh (each WebGL1 + WebGL2); Simulations gained semi-Lagrangian smoke,
  Verlet GPU cloth and DLA. Three whole new tiers were added — a single-pass
  Raymarching renderer (SDFs, soft shadows, AO/fog, Mandelbrot/Julia,
  Mandelbulb), Stylization/NPR (toon, Sobel ink, hatching, halftone,
  Kuwahara, ASCII), and Distortion (swirl/lens/kaleidoscope, RGB-shift, VHS,
  datamosh) plus the track's only **vertex-shader** demo. That vertex demo
  runs on a second sibling harness, `makeMeshToy` (a real grid mesh + user
  vertex shader), alongside `makeAgentSim` and the gather-only `makeSim`;
  see `ARCHITECTURE.md` for the harness-contract extension seam.
- `racing-sim/` — **fully shipped — all 5 tiers, 26 demos.** Build a
  sim-leaning top-down 2D racing game from first principles. See
  `racing-sim/index.html` for the full five-tier roadmap.
  Beginner (5 demos): car-state slider diagram, kinematic WASD drive,
  dt-correct vs per-frame integrator comparison, rotating sprite, and a
  parking-lot sandbox with persistent offscreen-canvas skid marks.
  Intermediate (5 demos): a coast-down comparison across rolling-drag values,
  a draggable velocity-decomposition visualiser (forward + lateral basis
  projection), a grip-threshold bar diagram (input lateral → after one frame
  of grip), an oversteer-vs-understeer side-by-side on the same scripted
  input, and a drift-pad mini-project with tarmac / gravel / ice surface
  presets and a live GRIP / SLIDE telemetry HUD. **Advanced (5 demos): a
  drag-to-deform 4-cubic-Bézier closed-track builder with wall inflation, a
  car-vs-segment wall-collision demo with impact-point + normal + reflected
  velocity arrows, ordered-checkpoint lap counting on a fixed oval, a
  draggable-target steering-seek visualiser, and a headline race-against-AI
  mini-project (player WASD vs look-ahead-seek AI on the same physics, lap
  counting, walls bounce both cars, first to 3 laps wins). **Expert (6 demos):
  an interactive simplified Pacejka tire-curve plot (slip-angle slider plus
  B/C/D shape knobs, hard-clamp overlay for comparison), a weight-transfer
  visualiser (four wheel-load circles that grow/shrink as you toggle
  throttle/brake + steering), a race state-machine + lights animation
  (PRE_RACE → COUNTDOWN → RACING → FINISHED with an F1-style lights bar),
  a follow-camera side-by-side (rigid vs lerp vs lerp+lead, sliders for
  smoothness and lead time), a gamepad-API probe (live left-stick X + LT/RT
  bars), and a hot-lap mini-project on a world-scrolled track with the
  Pacejka integrator, follow-camera with lead, race state machine, gamepad-
  or-keyboard input, and a telemetry HUD (current / last / best lap times,
  live slip angle, throttle/brake bars). **Simulations (6 demos): a
  draggable friction-circle visualiser (lateral + longitudinal force bars
  with in/out-of-circle indicator), a tire heat-and-wear model (bell-curve
  grip multiplier with aggressive/smooth/cold-start modes), an aerodynamic-
  downforce calculator (real-world v² equation with speed and C_L·A
  sliders), a suspension spring-damper animation over a bumpy road (live
  ζ damping-ratio classification), a live g-g diagram + telemetry traces
  (drive a car with WASD, dot traces the friction circle, three time-series
  panels), and a procedural-track generator (seeded mulberry32 PRNG +
  polar-anchor jitter + cubic-Bézier smoothing with an auto-driver
  checking the line is drivable).** Demo IDs reserve
  the `rac_` namespace for the future per-tier bundles file. Tracks the
  established "one tier per commit" cadence used by voxel-worlds.
- `netcode/` — **fully shipped — all 5 tiers, 23 demos.** The project's
  first *systems* track (cross-cutting,
  not genre-specific): teach the math and machinery of online multiplayer
  entirely over a **simulated network** with zero backend. All demos run
  inside one browser tab; two canvases play the role of "server" and
  "client" and a `FakeNetwork` object with sliders for RTT, jitter, packet
  loss, and reorder probability sits between them. The scaffold added
  `netcode/index.html` (five-tier roadmap) and two foundational helpers in
  `netcode/net/`: `seeded-rng.js` (mulberry32 — same PRNG racing-sim uses
  for procgen, so the same seed reproduces the same "network weather"
  twice) and `fake-network.js` (priority-queue scheduler with
  `connect(id)` → endpoint surface mirroring WebSocket/DataChannel). A
  self-check at the bottom of the landing page verifies both helpers load
  and behave (deterministic seed, end-to-end message delivery, statistical
  loss/reorder). **Beginner tier (Hello, Network — 4 demos):** an animated
  packet-lane visualiser with sliders for RTT/jitter/loss/reorder (packets
  rendered as labelled circles travelling at one-way latency, lost packets
  shown as a faded red ✕, reordered packets tinted purple with a halo);
  a tick-rate-vs-frame-rate demo (SIM ball on a tick rail, REN ball on a
  render rail, toggle that turns interpolation between ticks on/off —
  plants the seed the Intermediate tier's entity interpolation pays off);
  an interactive bandwidth tradeoff calculator (the `tickRate × players ×
  entities × bytes` equation with four sliders, four shipped-game presets,
  and a coloured severity meter that bands by network class); and a
  ping-pong mini-project where two clients (A and B) exchange messages
  through one `FakeNetwork` with a seed input — the visible proof of
  determinism (same seed + same actions = bit-identical stats every time).
  **Intermediate tier (Authority &amp; Movement — 5 demos):** a `naiveDemo`
  with a "wait for the server" client that lags by the full RTT (drag a
  direction button and watch the CLIENT ball trail your input by 200 ms);
  a `predictionDemo` that applies input locally + naively snaps to
  authoritative on each snapshot (toggle on/off to A/B against the naive
  version; a green dashed ghost shows the authoritative position so the
  snap distance is visible); an `interpolationDemo` focused on REMOTE
  entities that renders the entity at `now − interpDelay` lerping between
  the two snapshots that straddle it (a dashed orange "server-truth-right-now"
  overlay makes the cost of the interp buffer visible as a "behind reality
  by N px" annotation); a `snapVsSmoothDemo` showing two players hit by
  identical periodic corrections — LEFT snaps instantly, RIGHT smooths via
  frame-rate-correct `1 − exp(−k·dt)` exponential decay (sliders for
  smoothing time and correction interval); and a `arenaDemo` capstone with
  SERVER and CLIENT panels showing one local player (WASD) plus one remote
  bot orbiting a circle, with independent toggles for prediction,
  interpolation, and smoothing so the user can A/B each technique in
  isolation under harsh network sliders (RTT/jitter/loss). The whole tier
  hammers one discipline: server-state and client-state are SEPARATE
  objects in every demo, communicating ONLY through FakeNetwork messages,
  never via shared object references — the only way to teach this
  honestly inside one browser tab. An additive helper tweak landed with
  this tier: every in-flight FakeNetwork packet now carries `sentAt`,
  `delay`, and `reordered` metadata so demos can render packet progress
  along a lane (used heavily by the Beginner packet-lane demo already
  and reused here for the snapshot-arrival visualisation).
  **Advanced tier (Reconciliation, Lag Comp, Compression — 5 demos):**
  a `reconciliationDemo` that extends the Intermediate predict-and-snap
  loop with a client-side input ring buffer + per-snapshot ack-tick +
  replay (when reconcile is ON, the average snap distance over hundreds
  of snapshots collapses to ~0 px even at 500 ms RTT — that single
  number IS the proof); a `lagCompDemo` with two side-by-side panels
  showing the same auto-fired shots resolved with vs without
  server-side history rewind (the right panel renders a faint orange
  trail = the server's stored history = the "rewind buffer"; at default
  settings the no-comp panel scores 0% hits while the lag-comp panel
  scores 100%); a `deltaSnapshotDemo` (DOM-driven, no canvas) with
  sliders for entity count × tick rate × change fraction and a two-bar
  visualisation of full-snapshot vs delta bandwidth; a `quantizationDemo`
  with a Lissajous-curve true position vs a quantized position (drop the
  bit slider below ~10 and the quantized ball visibly snaps to a grid;
  worst-case error reported live); and a `shooterDemo` capstone — a
  2-player top-down shooter with WASD/mouse-aim/click-to-fire, an
  orbiting bot that fires back every 2 s with HP-based respawn on both
  sides, and four independent toggles for reconciliation / lag-comp /
  delta / quantization plus network sliders + live bandwidth readout in
  kbps. **Expert tier (Determinism, Lockstep, Rollback, AoI — 4 demos):**
  a `determinismDemo` with two double-pendulums started from identical
  conditions EXCEPT for a slider-controlled Δθ₀ perturbation (default
  1e-7 rad — about a ten-millionth of a degree); after ~10 seconds the
  two trails completely diverge, making the "1-bit float difference
  across machines explodes over time" lesson visceral — paired with a
  collapsible JS/TS code block showing the fixed-point/lookup-table
  pattern shipped lockstep games use to dodge this entirely; a
  `lockstepDemo` with 10–400 units flocking to a draggable waypoint
  and two coloured bars comparing lockstep bandwidth (one waypoint per
  tick, O(players)) against naive per-entity-snapshot bandwidth (O(N
  units × tick)) — at default 100 units / 20 Hz the readout shows
  "lockstep is 67× smaller"; a `rollbackDemo` that finally lands the
  cross-track stub the original plan promised — two top-down cars
  (cyan local controlled by WASD/buttons, purple bot driven through a
  FakeNetwork) using borrowed-from-racing-sim heading-based physics
  (the same units convention as racing-sim Intermediate's integrator)
  with a full GGPO-style ring buffer (90 ticks ≈ 1.5 s @ 60 Hz),
  input prediction ("same as last frame"), and rewind-and-resimulate
  when the real remote input arrives different from predicted — at
  default settings the right-side stats panel shows hundreds of
  rollbacks/minute with avg depth 4–6 ticks (= RTT/sim_dt) and a
  yellow flash on the bot whenever a rollback fires; an `aoiDemo`
  with 20–500 wandering entities, a mouse-cursor observer, a
  slider-controlled AoI radius, and a spatial-grid (cell = radius)
  overlay highlighting both the queried cells (faint green) and the
  visible entities (bright green vs dim) — at 100 entities / 120 px
  radius the readout shows "84% omitted, 9/18 cells scanned vs naive
  O(100)". Plus an HTML-only "Anti-cheat primer" section covering
  server authority, sanity bounds, and replay verification as the
  three legs every shipped multiplayer game needs.
  **Simulations tier (Everything On — 5 demos, track capstone):** a
  `masterArenaDemo` putting the entire client-side stack on one
  2-player scene with five independent toggles (prediction,
  reconciliation, interpolation, lag-comp, smoothing) plus All-on /
  All-off buttons — uses the CORRECT fixed-step architecture (client
  predicts in fixed `PRED_DT` steps; server is input-driven, consuming
  buffered inputs in tick order and lagging naturally by network delay)
  so reconciliation is exact: toggling reconcile drives the avg
  correction from ~6 px to ~1 px under sustained motion; a
  `budgetCalcDemo` folding every tier's bandwidth reductions into one
  calculator (base `tick × players × entities × bytes`, then ×delta
  ×quant ×AoI multipliers) — a 32-player example collapses 737 kbps to
  18 kbps (40×) with all three on; a `lockstepVsRollbackDemo` running
  the two determinism architectures side by side on the same scenario
  (lockstep stalls until the remote input arrives → RTT/2 input delay,
  0 corrections; rollback predicts + corrects → 0 input delay, N
  corrections); an `aoiHeatmapDemo` colouring a spatial grid by how
  many players' AoI circles overlap each cell, with a clustering slider
  that drives the peak-cell interest up (the server's worst case = a
  contested objective); and a `replayScrubberDemo` that records a
  deterministic seeded ball sim tick-by-tick, lets you scrub the
  timeline, and on "Verify replay" re-runs from the seed + tick count
  to assert a bit-identical reconstruction (max error 0.000000) — the
  determinism capstone that ties rollback, lockstep, AND anti-cheat
  replay-verification to a single mechanism. Demo IDs reserve the
  `net_` namespace for the future per-tier bundles file. The track
  followed the established "one tier per commit" cadence used by
  racing-sim and voxel-worlds.
- `roguelike/` — **fully shipped — all 5 tiers + grand capstone.** Build a
  complete, turn-based, deterministic grid roguelike (NetHack / Brogue / DCSS
  style) from an empty canvas to a playable, seed-shareable dungeon dive. This
  is the project's first **turn-based** content — the whole genre advances one
  turn at a time instead of on a real-time loop, which rewires the architecture.
  It is also the natural capstone genre: it composes Fundamentals already taught
  (procgen, shadow casting, A*, ECS, FSMs, behavior trees) into a game you can
  lose. See `roguelike/index.html` for the five-tier roadmap. The scaffold added
  the landing page (five-tier roadmap + Fundamentals prerequisites + a live
  self-check) and two foundational helpers in `roguelike/engine/` (the
  `netcode/net/` pattern, since they're shared across every tier):
  `seeded-rng.js` (`RogueRng` — mulberry32, the same PRNG the netcode and
  racing-sim tracks use, plus roguelike helpers `pick`/`shuffle`/`weighted`/
  `dice` for loot and spawn tables) and `grid.js` (the `Tile` enum, a flat
  `Uint8Array`-backed `Level` class with `isWalkable`/`isOpaque` queries, the
  shared `RL` palette + glyph table, and `drawGlyphGrid` — the ASCII renderer
  that paints a `Level` as monospace glyphs with optional entities and a
  fog-of-war visibility mask). The landing page's self-check proves determinism
  (seed 1337 → identical numbers), exercises the RNG/Level helpers, and renders
  a hand-built room (`#` walls, `·` floor, `>` stairs, `@` player, `r` rat) to
  prove the renderer. **Beginner tier (The Grid &amp; The Turn — 5 demos):** a
  walk-around grid (arrows / WASD / vi-keys, walls block, click-to-focus
  keyboard handling so multiple demos don't fight over the arrow keys); a
  turn-based-vs-real-time demo (two copies of one room — the left goblin steps
  on a 350 ms timer regardless of input, the right goblin steps once per player
  action, so "sit still and the real-time monster still closes in" lands
  viscerally); a bump-to-attack demo (one keypress resolves to move / attack /
  blocked against passive training dummies with HP bars + 1d6 hits); a
  combat-log duel with turn order, retaliation, death, and a seeded
  reproducible message log; and the capstone **"One Room, One Rat"** — a
  complete playable micro-roguelike (a pillared room, a sleeping rat that wakes
  on proximity and hunts via greedy step-toward, bump combat both ways, a live
  log, HP, win-by-descending-the-stairs / lose-by-death, all reproducible from
  a seed). The Beginner tier's shared turn/movement/combat/input/render toolkit
  was then promoted to **`roguelike/engine/actors.js`** (the `rl*` helpers:
  `rlTryMove`, `rlStepToward`, `rlInstallCanvasKeys`, `rlDrawEntities`, `rlLog`,
  …) so every later tier reuses one copy instead of re-declaring it.
  **Intermediate tier (Building the Dungeon — 6 demos):** procedural generation
  built up a layer per demo, each re-rollable from a seed — room scattering with
  overlap rejection (+ outline overlay); L-shaped corridor connection (+ a
  connection-graph overlay and a live flood-fill "all connected ✓" check); **BSP
  partitioning** (recursive longer-axis splits, one room per leaf, connect-on-
  the-way-up, with a partition-tree overlay and a max-depth slider); an
  **animated drunkard's-walk** cave carver (fill-% and walker-count sliders);
  a **population + connectivity** demo (seed-placed spawn/stairs/monsters/items
  with a BFS **flood-fill reachability overlay** — multi-walker caves show
  isolated pockets in red, and "keep largest region" walls them off); and the
  capstone **"Explore the Dungeon"** — a playable, multi-level rooms-and-corridors
  dungeon (bump combat with wandering rats, press `>` on the stairs to descend to
  a freshly generated deeper level via a depth-derived seed, reach depth 5 to
  win / die to lose). The generators (placeRooms/connectRooms/BSP/drunkard/
  floodFill/regions) live in `intermediate-demos.js` — they're the tier's lesson,
  not shared infrastructure. The connected rooms-and-corridors generator then
  graduated to **`roguelike/engine/dungeon.js`** (`generateDungeon` + `dg*`
  helpers) once the Advanced tier became its third consumer.
  **Advanced tier (Sight &amp; Pursuit — 6 demos):** the vision + pathing
  algorithms are defined as top-level globals (testable from the console, and
  shared by every demo): **`losLine`** (Bresenham line-of-sight), **`computeFOV`**
  (recursive shadowcasting, the 8-octant classic — the marquee new algorithm),
  **`aStarPath`** (binary-heap A*), **`dijkstraFrom`** (multi-source distance
  field). Demos: a mouse-driven LOS line (green/red, marks the blocking wall); a
  move-to-look-around FOV demo (sight-radius slider, walls cast shadows); fog of
  war with a remembered map (unseen / remembered / visible, monsters hidden
  outside the FOV); A* monster pathing (one chaser replans only while it has LOS,
  draws its path); Dijkstra "scent" maps (one flood fill drives many chasers down
  a distance gradient, with a heatmap + gradient-arrow overlay and a flee/negate
  toggle); and the capstone **"The Hunt"** — fog + FOV + LOS-based aggro + a
  shared Dijkstra chase map + a forget-after-losing-sight timer, so stealth
  (breaking line of sight to shake pursuers) emerges from the systems; reach the
  stairs to escape. The FOV shadow-casting was unit-tested (a wall is visible but
  the tiles behind it are correctly shadowed) before being trusted in the demos.
  Those vision algorithms then graduated to **`roguelike/engine/vision.js`**
  (`losLine`/`computeFOV`/`aStarPath`/`dijkstraFrom`/`stepDownhill`) once the
  Expert capstone became their second consumer.
  **Expert tier (Items, Effects &amp; Minds — 6 demos):** items as a tiny ECS
  (`Item` entities with a component bag + an `ItemWorld.query(comp)`); an
  inventory/equipment demo with **derived stats** (attack/defense computed from
  the equipped gear, never stored — equipping a sword shifts the attack die from
  1d3→1d8); **status effects + identification** (timed `{kind,turns,power}`
  records ticked each turn — poison/regen/haste — plus seed-shuffled unidentified
  potions revealed by quaffing); an **energy/speed scheduler** (every actor banks
  `speed` energy per tick and acts at 100, so a speed-200 snake acts exactly 2×
  and a speed-50 zombie ½× per player move); **monster AI variety** (an FSM brute
  sleep→chase→attack, an FSM coward that flees, and a **behavior-tree** archer
  that shoots / retreats / repositions / wanders); and the capstone **"Armed &amp;
  Dangerous"** — the Advanced fog+FOV+pursuit world plus floor loot you pick up
  and equip (number keys), unidentified potions, status effects, the energy
  scheduler (fast venomous snake, slow zombie), and derived-stat combat; reach
  the stairs alive. Inventory uses **number keys** (1–9) since the letter keys
  are movement. The Expert RPG systems were also packaged into
  **`roguelike/engine/rpg.js`** (`Item`/`attackDice`/`tickStatuses`/`speedOf`/
  `applyConsumable`, …) — the dungeon.js-style "teach inline, ship a lib copy"
  split — so the grand capstone can compose them (loaded only where the Expert
  inline copy isn't, to avoid a `class Item` redeclaration).
  **Simulations tier (The Whole Dungeon — 4 demos, track capstone):** an
  animated **cellular-automata cave** generator (5-of-9 majority rule over a 3×3
  Moore neighbourhood — the stable rule that condenses noise into caverns rather
  than eroding it — with initial-fill/iteration sliders and a flood-fill
  "keep largest region" connectivity guarantee); a **level-themes-by-depth**
  demo (a data-driven recipe table mapping depth → generator + palette tint +
  monster table: tidy rooms up top, cellular caves below); a **determinism
  record/replay** demo (every keypress recorded, then a fresh sim built from the
  same seed is fed the same inputs and its final-state hash compared — lands
  bit-identical, the property the netcode track's rollback also needs); and the
  grand capstone **"The Descent"** — a complete, permadeath, seed-shareable
  roguelike composing every system: themed procgen floors (rooms→caves by
  depth), FOV + fog of war, energy-scheduled monsters with LOS aggro + Dijkstra
  chase (fast venomous snake, slow zombie), floor loot you pick up and equip
  (number keys), unidentified potions, status effects, derived-stat combat,
  descent via `>` to depth 8, and a score. The cave/theme code lives in
  `simulations-demos.js` (the tier's lesson). **Tier arc:** Beginner (grid + turn loop + bump-to-attack),
  Intermediate (dungeon generation — rooms/corridors/BSP/drunkard's-walk),
  Advanced (recursive-shadowcasting FOV + fog of war + monster pathing/Dijkstra
  maps), Expert (items/inventory ECS + status effects + identification +
  energy-speed scheduling + AI variety), Simulations (cellular-automata caves +
  depth themes + the full playable game, "The Descent"). Demo IDs reserve the
  `rl_` namespace for future per-tier bundles. Follows the "one tier per commit"
  cadence.

- `platformer/` — **fully shipped — all 5 tiers, 28 demos.** Build a
  tight, juicy 2D platformer (Celeste / Hollow Knight style) — the repo's first
  **real-time character-control** track. Where the other genre tracks build a
  *world*, this one builds a *character* and teaches the "game feel" stack that has
  no home elsewhere in the repo: coyote time, jump buffering, variable jump height,
  apex hangtime, corner correction, wall-jump, dash, plus camera/parallax/juice and
  the perf work to make it scale. See `platformer/index.html` for the five-tier
  roadmap. The screenshots that prompted the track are inspiration only; their order
  is remapped into the repo's own difficulty order. **Tier arc:** Beginner
  (Ground & Gravity — the fixed-timestep loop + AABB-on-tilemap collision),
  Intermediate (Game Feel — coyote/buffer/variable-jump/apex/corner-correction + a
  player FSM), Advanced (Abilities & Moving Geometry — wall-slide/jump, dash,
  one-way platforms, slopes, moving platforms/conveyors), Expert (Camera, Parallax
  & Juice — follow camera with deadzone/look-ahead, screen shake, parallax,
  particles, squash-and-stretch), Simulations (Performance, Scale & the grand
  capstone "Summit" — viewport culling, particle pooling, broad-phase collision,
  chunked/streamed levels, render caching). The **scaffold** shipped three shared
  helpers in `platformer/engine/` (the netcode/net + roguelike/engine pattern,
  names on `window`, pre-checked vs `shared/utils.js`): `tilemap.js` (`PFTile`
  enum, `TileMap`, `PF` palette, `drawTileMap` with built-in viewport culling),
  `physics.js` (`AABB` + `moveAndCollide` — per-axis AABB-vs-tile resolution, the
  single most-reused primitive), and `input.js` (`pfInstallKeys` held-key input
  with edge detection + `pfLoop` fixed-timestep accumulator). **Beginner tier
  ("Ground &amp; Gravity", 5 demos):** a falling-box gravity/loop demo (fading
  trail shows acceleration; gravity slider; terminal-velocity clamp), a
  gravity-off per-axis collision demo (fly a box into solids, the
  `{left,right,up,down}` hit flags in the HUD, slide along walls), a grounded +
  simple-jump demo (jump only when `hit.down`, with a live `v²/2g` jump-height
  readout), a run-feel demo (the SAME input drives an INSTANT box vs an
  ACCEL+FRICTION box side by side, with velocity bars), and the capstone
  **"First Steps"** — a complete playable level composing run + jump + gravity +
  tilemap collision, reach the gold flag / fall in the pit and respawn.
  **Intermediate tier ("Game Feel", 6 demos):** every demo drives the SAME
  configurable `PlayerBody` controller with one feel feature flipped on — coyote
  time (jump just after a ledge), jump buffering (jump just before landing),
  variable jump height (release-to-cut, with short-hop/full-jump apex guides),
  apex hangtime + asymmetric rise/fall gravity + hold-↓ fast-fall, and corner
  correction (a head-bonk a small sideways nudge would clear is forgiven) — plus a
  physics-driven player FSM (idle/run/jump/fall/land) with squash-and-stretch. The
  capstone **"Feel Lab"** puts every assist on a toggle with Raw/Juiced presets so
  the same course can be felt stiff-then-forgiving. **Advanced tier ("Abilities &amp;
  Moving Geometry", 6 demos):** the Advanced tier is `PlayerBody`'s 2nd consumer,
  so the controller graduates to **`engine/player.js`** (a *move*, the actors.js
  rule) — extended there with the abilities (wall-slide/wall-jump, dash) behind the
  same zeroable-knob pattern and a swappable `resolve()` collision hook. The
  collision *extensions* are taught inline as a top-level `pfResolveWorld` (SOLID +
  one-way platforms + 45° slope tiles) plus `MovingPlatform`/`pfRidePlatforms`
  (relative-motion carrying). Demos: wall-slide + wall-jump (climb a shaft), dash
  (gravity-free burst, cooldown, one-per-ground/wall refresh), one-way platforms
  (land on top / rise through / drop through on ↓+jump), slopes (sample the ramp
  surface under the centre + downhill "stick"), moving platforms + a conveyor
  belt, and the capstone **the Gauntlet** — a vertical climb using every ability
  and geometry type in order. **Expert tier ("Camera, Parallax &amp; Juice", 6
  demos):** the first tier where the level is bigger than the screen. A `Camera`
  class (taught inline; flagged to promote to `engine/camera.js` when Simulations
  reuses it) does frame-rate-correct follow + deadzone + look-ahead + world-bounds
  clamp + trauma-based screen shake; the rest is the "juice" layer —
  `drawParallax` (layers scrolled by camera × depth factor), `pfDrawCharacter`
  (the controller's state machine drawn as procedural animated limbs),
  `ParticleField` (run dust + impact-scaled landing puffs), and hitstop (a few
  frozen frames on hard landings). Demos: the follow camera (rigid vs lerp,
  deadzone box + minimap), screen shake (`shake = trauma²`, decays), parallax
  (depth on/off), animation-from-FSM, particles, and the capstone **"Juice Lab"**
  — one scrolling level with every effect on a toggle (All on/off) so the same
  level can be felt lifeless-then-alive. The camera-space convention (clear →
  parallax in screen space → `ctx.translate(-cam.originX,-cam.originY)` → world →
  restore → HUD) is shared by every scrolling demo. **Simulations tier
  ("Performance, Scale &amp; The Whole Game", 5 demos):** the optimisation tier
  and the grand finale. `Camera` is promoted to **`engine/camera.js`** (this
  capstone is its 2nd consumer), so `engine/` now holds the full cross-tier core
  (tilemap, physics, input, player, camera). Four perf systems taught inline:
  viewport culling (drawTileMap's built-in cull, made the lesson — O(view) not
  O(world)), `ParticlePool` (a swap-remove object pool — zero per-frame
  allocation), `SpatialGrid` broad-phase (O(n²) pair checks → ~O(n); verified 386
  vs 7,140 at 120 balls), and `ChunkCache` (render each chunk to an offscreen
  canvas once, blit thereafter, re-render only dirty chunks). The grand capstone
  **"Summit"** is the complete playable platformer: a wide level composing tilemap
  collision + one-way platforms + a slope + a moving platform + the full feel kit
  + wall-jump + dash + follow camera + parallax + pooled particles + screen shake
  + hitstop + FSM animation, drawn with viewport culling, with a goal flag and a
  best-time timer. **Track total: 5 tiers, 28 demos, 5 engine modules** (tilemap,
  physics, input, player, camera) — from a falling box to a complete game. Demo IDs reserve the `pf_` namespace; demos are
  keyboard/canvas-driven so (like roguelike/netcode) they omit `data-demo-id` to
  opt out of the Export button for now.

- `physics-puzzle/` — **fully shipped — all 5 tiers, 30 demos, 5 engine modules.**
  Build the physics behind the genre's classics — Angry Birds (slingshot), Cut the
  Rope (ropes you sever), World of Goo (contraptions) — from one falling circle up
  to a chain-reaction puzzle game. This is the **applied home** for the repo's
  homeless physics content (`simulation.html` / `simulation-v2.html`'s verlet,
  springs, rigid bodies, SAT, SPH), re-taught puzzle-first. The screenshots that
  prompted the track are inspiration only; the tiers are remapped into the repo's
  own difficulty order and expanded. **Through-line:** the track teaches *two
  families* of 2D physics in one world — position-based **Verlet** (ropes, soft
  bodies) and velocity/**impulse**-based rigid bodies — bridged in the grand
  capstone. **Tier arc:** Beginner (Launch & Land — the World, slingshot, bounces,
  circle collisions), Intermediate (Ropes & Chains — Verlet + constraints + the
  cut), Advanced (Rigid Bodies & Joints — rotation, SAT, friction, breakable
  joints), Expert (Destruction & Debris — impact thresholds, Voronoi fracture,
  pooled debris, juice), Simulations (Soft Bodies, Ragdolls & Fluids — broadphase,
  sleeping, SPH + buoyancy, and the grand capstone **"Rube"**). The **scaffold**
  shipped three engine-core modules in `physics-puzzle/engine/` (names on `window`,
  `pz`/`PZ`-prefixed, pre-checked vs `shared/utils.js`, reusing its `Vector2D`):
  `world.js` (`PZWorld` integrator + `PZBody` circle body — gravity + semi-implicit
  Euler; collision is taught on top, not hidden), `loop.js` (`pzLoop`
  fixed-timestep accumulator + `pzInstallPointer` drag/touch input with pointer
  capture & correct canvas-local coords), and `render.js` (`PZ` palette +
  `pzDrawBody`/`pzDrawArena`/`pzDrawDots`). **Beginner tier ("Launch & Land", 6
  demos):** the World & gravity (falling ball, fading trail shows acceleration),
  walls/restitution (reflect-and-attenuate bounces), the slingshot (drag → impulse,
  clamped against tunneling), trajectory prediction (steps a throwaway clone — exact
  because the timestep is fixed), circle–circle momentum exchange (inverse-mass
  impulse), and the capstone **"Knock-Down"** (slingshot a 3-shot budget to knock a
  row of pins off a ledge — every mechanic on one world). The tier's three collision
  routines (`pzResolveStatic` circle-vs-arena, `pzResolveBlock` circle-vs-AABB,
  `pzCollideCircles`) are taught **inline** in `beginner-demos.js`; they stay inline
  (the Advanced tier *supersedes* rather than reuses them — see below — so their real
  2nd consumer is the grand-capstone slingshot). **Intermediate tier ("Ropes & Chains", 6 demos)** switches to the
  *other* physics family — position-based **Verlet** — taught entirely inline in
  `intermediate-demos.js`: Verlet vs Euler (store the previous position; velocity is
  the implicit `pos − prev`), the distance constraint (`PZConstraint.solve` = one
  nudge to rest length), a rope (`pzStepRope` = integrate then relax K times;
  iterations = stiffness), swinging (Verlet conserves the arc — momentum is release
  timing), the cut (`pzCutBlade`/`pzClickCut` flip a `broken` flag via
  `lineIntersection`), and the capstone **"Deliver"** (drag to build a swing, cut to
  fling a candy over a shelf into the goal; payload-vs-wall is Verlet depenetration,
  no velocity to reflect). `PZVerletPoint`/`PZConstraint` stay inline here, to be
  promoted to `engine/constraints.js` when the Simulations tier (soft bodies /
  ragdolls) reuses them. **Advanced tier ("Rigid Bodies & Joints", 6 demos)** adds the
  hard part — *rotation* — with a full convex-polygon impulse solver inline in
  `advanced-demos.js` (the standard Box2D-lite approach): `PZRigidBody` (mass + moment
  of inertia + angle + angular velocity), `pzPolyVsPoly` (SAT + reference/incident-face
  clipping → up to two contact points), `pzSolveManifold` (sequential impulses: normal
  with restitution + a Baumgarte penetration bias, and a Coulomb-clamped friction
  impulse, all with the `r × J` rotational term), and `PZJoint` (a velocity-level pivot
  constraint via the 2×2 effective-mass matrix, with a break threshold). Demos: an
  off-centre impulse that spins a box (the second integrator), SAT detection
  visualised, impulse response with rotation, **stable resting stacks** (friction +
  positional correction — verified: a box rests at 0.5px slop, a 3-box stack holds at
  0.2° tilt), breakable joint chains, and the capstone **"Contraption"** — a see-saw
  catapult (plank on a pivot joint, held level by a rest-pillar) that flings a ball into
  a basket goal (verified winnable by direct simulation). **Expert tier ("Destruction &
  Debris", 6 demos)** is the rigid engine's 2nd consumer, so that engine was **promoted**
  (a *move*) from inline into **`engine/rigid.js`** — both `advanced.html` and
  `expert.html` load it, `advanced-demos.js` no longer declares it, and the engine gains
  one feature the destruction tier needs: `body.impact` (the total normal impulse a body
  received last step, summed in `pzSolveManifold`). Expert teaches its destruction
  algorithms inline in `expert-demos.js`: impact thresholds (break when `impact` crosses a
  limit), **Voronoi pre-fracture** (`pzFractureBody` — a shard is the body's polygon
  clipped by the bisectors between random seeds; verified the cells tile the shape with
  zero area loss), a recycled **debris pool** (a capped budget), **structural stress**
  (colour blocks by `impact` — a resting block's support load — verified a 4-stack reads a
  clean 1176/840/504/168 top-to-bottom gradient; click the red keystone to collapse it),
  and **juice** (dust particles, trauma² screen shake, hitstop). Capstone **"Demolition"**:
  a stable brick wall (the orange blocks shatter into Voronoi debris on a hard wrecking-ball
  hit — a *contact-based* break that ignores resting load) brought down below a line on a
  3-shot budget (verified clearable). So `engine/` is now **4 modules** (world, loop,
  render, rigid). **Simulations tier ("Soft Bodies, Ragdolls & Fluids", 6 demos)** is the
  finale and the Verlet core's 2nd consumer, so `PZVerletPoint`/`PZConstraint`/`pzStepRope`/
  `pzVerletArena` were **promoted** (a *move*) from `intermediate-demos.js` into
  **`engine/constraints.js`** (intermediate.html + simulations.html both load it) — bringing
  `engine/` to **5 modules** (world, loop, render, rigid, constraints), the two physics
  families side by side. The tier's own new content is inline (terminal consumer): a
  `PZSpatialHash` broadphase (verified ~11× fewer pair tests — 859 vs 9730 at 140 balls),
  sleeping/island waking, a **pressure soft-body** (a closed Verlet mesh inflated by an area
  force — holds ~99% of rest area), a **ragdoll** (10 jointed `PZRigidBody`s — the Advanced
  toolkit applied), and a **position-based particle fluid** (`pzFluidStep` — neighbour
  repulsion as incompressibility + viscosity over the hash; verified it pools ~65px deep and
  floats a duck; full SPH kernels cross-linked to `simulation-v2.html`). Grand capstone
  **"Rube"**: slingshot a ball through a brittle (Voronoi-shattering) tower into a water tank
  where a duck bobs on the buoyancy — impulse-rigid and position-fluid families coexisting
  (verified winnable + stable; heavy bodies are kept out of / removed-on-entry to the water so
  the two families don't destabilise). **Track total: 5 tiers, 30 demos, 5 engine modules** —
  from a falling circle to a chain-reaction finale across two physics families. Demos are
  pointer/canvas-driven so (like platformer/roguelike) they omit `data-demo-id` to opt out of
  the Export button.

## Shared assets

All pages load CSS and JS from `shared/`:

- `shared/styles.css` — single source of truth for theme and layout
- `shared/utils.js` — `Vector2D`, `Matrix2D`, canvas helpers
- `shared/code-tabs.js` — JavaScript / TypeScript tab toggle inside code blocks
- `shared/export-demo.js` + `shared/demo-bundles*.js` — export-demo feature
