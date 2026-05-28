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
- `netcode/` — **scaffold + Beginner tier shipped — four more tiers to
  follow iteratively.** The project's first *systems* track (cross-cutting,
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
  Demo IDs reserve the `net_` namespace for the future per-tier bundles
  file. Tracks the established "one tier per commit" cadence used by
  racing-sim and voxel-worlds.

## Shared assets

All pages load CSS and JS from `shared/`:

- `shared/styles.css` — single source of truth for theme and layout
- `shared/utils.js` — `Vector2D`, `Matrix2D`, canvas helpers
- `shared/code-tabs.js` — JavaScript / TypeScript tab toggle inside code blocks
- `shared/export-demo.js` + `shared/demo-bundles*.js` — export-demo feature
