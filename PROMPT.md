# original prompt
Create a game dev math guide based on the project guidelines.

An example would be the example.html in the folder. Take inspiration from it but we want to create something better than it. The example file is also buggy in some places and does not follow the best conventions and project guidelines. Keep this in mind before taking inspiration.

In case you are not sure of anything, ask.

# 2026-05-15 — Suggested-task triage: broken TS Copy-Code exports

The Claude app suggested a task for this repo. Is this still a viable issue?
(Suggested task: the isometric-strategy Copy-Code TS export variants in
`bundles-expert.js` and `bundles-advanced.js` reuse each JS body via a
`.split('\n').slice(K, -2).join('\n')` trick that drops the demo's final
bootstrap line; also verify the leading `K` per demo and fix any mismatch.)

# 2026-05-15 — Set up a separate learning track for learning shaders

Stand up a new, separate "shaders" learning track alongside the existing
isometric-strategy track. Decisions made with the user: real WebGL + GLSL
(not canvas-2D emulation); first pass scaffolds the whole track but only
ships the Beginner tier (other four tiers are locked "Coming soon" roadmap
cards, built iteratively later); content blends shader fundamentals with
concrete 2D-game effects, fundamentals → game effects across the tiers.

# 2026-05-16 — Make shader GLSL readable, then ship Shaders Intermediate tier

(1) Refactor: the Beginner tier wrote GLSL as line-by-line JS string
concatenation, which was unintuitive — convert to multi-line template
literals (plain in *-demos.js; escaped-backtick nested literals in
bundles-*.js). Pure readability, behavior byte-identical.
(2) Continue with the next phase: ship the Shaders track's Intermediate
tier (Patterns, Noise & Distortion) — tiling, the hash, value noise, fbm,
domain warping, UV distortion, animated fire/smoke mini-project — and flip
its roadmap card to Ready.
(3) Continue with the next phase: ship the Shaders track's Expert tier
(Textures & Sprite Shaders) — sampling a procedural sprite texture, tint,
palette-swap, dissolve/burn, outline, hit-flash/blink, a fully-shaded-sprite
mini-project — extend makeShaderToy with a backward-compatible texture
branch, and flip its roadmap card to Ready.
(4) Continue: ship the Shaders track's Advanced tier (Multi-Pass &
Post-Processing) — render-to-texture/FBOs, ping-pong, separable blur, bloom,
colour grade + CRT, post-process-stack mini-project. User chose to show BOTH
WebGL1 (GLSL ES 1.00) and WebGL2 (GLSL ES 3.00) as paired demos with a
page-local section toggle; new makeFXChain multi-pass runner; flip card.
(5) Continue (final tier): ship the Shaders track's Simulations tier
(GPU Compute-Style Effects) — state-in-a-texture loop, Conway's Life,
Gray-Scott reaction-diffusion, GPU particles, 2D fluid/ink, interactive
fluid playground. User chose WebGL2-only + RGBA16F float textures; new
makeSim persistent double-buffer runner; flip card → all 5 tiers shipped,
shaders track complete.
(6) "See what more examples can be added across the phases in the shaders
track." User chose: all five tiers, comprehensive 3–4 new lessons each, one
plan up front then build. Added 15 lessons (additive only, no removals),
each as the full 5-file transaction (tier .html section + TOC, {tier}-demos.js
IIFE, bundles-{tier}.js DEMO_HTML/CODE[/TS], shaders/index.html roadmap card):
Beginner — 2D transforms, polar coords, SDF boolean combine; Intermediate —
gradient/Perlin noise, Voronoi/cellular, flow & scrolling; Expert — 2D
normal-map lighting, sprite-sheet animation, dither/posterize/1-bit; Advanced
— scene transitions, radial blur & god rays, pixelation/mosaic (each a
WebGL1+WebGL2 pair via the kit/chainFor extension); Simulations — falling
sand (conservative Margolus 1×2 CA), boids/flocking (16-sample agents),
2D wave equation. Slime-mold was swapped for the wave equation because
makeSim is single-buffer (Physarum needs agents that sense a separately
diffused trail — two coupled fields the harness can't feed back). Every
tier verified in a real browser: zero GLSL console errors, all controls
exercised, and the 📋 Export standalone HTML run for the riskiest demos
(JS path; TS path proven via byte-identical GLSL parity since the sandbox
blocks the Sucrase CDN for all repo exports).
(7) Bug report (regression from #6): "The first example in the advanced
section is not working." Root cause: every shaders tier eagerly creates one
WebGL context per demo canvas; advanced.html has 9 effects × {GL1,GL2} = 18
contexts at load, the browser caps ~16 and evicts the OLDEST (rttGL1) with no
recovery → blank canvas; the +6 contexts from #6 tipped it over. User chose
the robust fix (lazy mount + real teardown) applied to ALL five tiers. Added
shared/lazy-demo.js — a stable proxy + IntersectionObserver that mounts a
demo's harness only while its canvas is on screen and tears it down when it
scrolls away; because a <canvas> is permanently bound to its one context, the
wrapper also REPLACES the canvas element on unmount so a fresh context can be
made, and replays the last mutator call so button state survives. Added a real
destroy() (delete GL programs/buffers/textures/FBOs + WEBGL_lose_context, remove
listeners) to makeFXChain, all three makeShaderToy copies, and makeSim; wrapped
every demo call site (and mountFX) with lazyToy; added the script include to all
5 tier pages. Bundles/Exports untouched (standalone = one always-visible
canvas; verified byte-identical + still runs). Accepted trade-off: stateful
sims/feedback demos re-seed when scrolled fully away and back. Verified per
tier in a real browser: rttGL1 renders, ZERO "too many WebGL contexts"
warnings even after scrolling the whole page and back, api-tab GL1↔GL2
mount/unmount works, state replayed.

# 2026-05-17 — Slime-mold scope flag: explain, then make the project support it

Re the part-1 "scope deviation" flag (2D wave shipped instead of slime mold
because `makeSim` is single-buffer ping-pong and Physarum needs agents that
sense a separately-diffused trail — two coupled fields the harness can't feed
back): "Explain in a very simple way what this means and why this could not be
done. And if we had to do this, what do we have to do?" Then: "How can we set
up the project to support examples like slime mould in the future while at the
same time support the current example infrastructure as well?" Decided
(plan-mode): sibling harness `makeAgentSim` (no `makeSim` refactor — zero
regression risk) + ship the Physarum demo as its first consumer + document the
harness-contract extension seam in a new `ARCHITECTURE.md`. Built and verified
in a real browser (vein network forms & is stable, 0 console errors, lazy
teardown frees the context, makeSim demos unaffected). Standalone-export
bundle registration deliberately deferred (avoids duplicating a ~180-line
harness as a brittle string) and flagged in ARCHITECTURE.md.

# shaders track — mastery-variety expansion
"In terms of mastering shaders, the examples in the shaders track lack
variety — have a look and improve it by adding the appropriate examples."
Planned, approved, and implemented as +34 console-verified demos.
Existing tiers extended (+12): Intermediate (IQ cosine palettes,
Truchet/hex tiling, seamless/looping patterns), Expert (cross-hatch/
halftone, ASCII/Kuwahara sprite stylizers), Advanced (chromatic
aberration, datamosh — each WebGL1 + WebGL2), Simulations (semi-Lagrangian
smoke, Verlet GPU cloth, DLA dendritic growth). Three new tiers added
between Expert and Advanced: Raymarching/3D/Fractals (8 — march loop, SDF
smin, lighting + soft shadows, AO/fog, Mandelbrot/Julia, Mandelbulb,
domain repetition, composed scene), Stylization/NPR (7 — toon, Sobel/
Roberts ink, cross-hatch, halftone, Kuwahara oil, ASCII/dither, stack),
Distortion/Glitch/Vertex-FX (7 — swirl/pinch/bulge, fisheye/barrel,
kaleidoscope, RGB-shift, VHS, datamosh, vertex-FX). A second sibling
harness, makeMeshToy (real grid mesh + user vertex shader, returns the
lazyToy handle shape + rebuild({vert,frag})), added with zero edits to
shared/ — it powers the track's only vertex-shader demo. Every demo
browser-verified console-clean across all presets (one GLSL ES 1.00
int*float bug — bare ${rim} → ${rim}.0 — caught by screenshot and fixed);
all export bundles syntax-validated. Both index files, the 8-card roadmap,
in-page TOCs and the expert↔raymarching↔…↔distortion↔advanced prev/next
chain kept consistent. ARCHITECTURE.md & README.md updated.

---

## 2026-05-18 (pt.2) — Fix two broken simulation demos

> Two issues on the simulation page —
> * Can't see anything in the GPU verlet cloth example
> * All the options in the reaction-diffusion example give the same output

Diagnosed in plan mode and fixed in both `shaders/simulations-demos.js` and
`shaders/bundles-simulations.js`: cloth pin-row inversion + WIND pin gate,
Gray-Scott unstable Laplacian (normalized kernel), canonical RD seed +
coarser state grid, and cloth-local point shaders for visibility. All
browser-verified console-clean.

## 2026-05-21 — New track: Voxel Worlds (scaffold + Terraria Beginner tier)

> - I want to learn everything about 2D voxel worlds and manipulation(similar to Terraria)
> - Add as a new track in the game section

Planned in plan mode (→ approved). Added a new `voxel-worlds/` track — the
first with nested sub-tracks: `terraria/` (tile-grid voxels) and `noita/`
(cellular-pixel voxels), the latter scoped to only concepts not in Terraria.
Iteration 1 shipped the scaffold (3 index pages) plus the fully-implemented
Terraria Beginner tier: 7 interactive Canvas2D demos (tile coords, flat-array
storage, sprite-less rendering, viewport culling, fg/bg wall layers). Root
`index.html` got a VOXEL nav button + two-level nested TOC. All browser-verified
console-clean. README.md + ARCHITECTURE.md updated.

## 2026-05-21 (pt.2) — Voxel Worlds: Terraria Intermediate tier

> Okay, work on the next iteration.

Built the Terraria sub-track Intermediate tier: `intermediate.html` (5 sections
+ recap), `intermediate-demos.js` (5 demos — picking & tool reach, mine/place &
hotbar, falling-sand cellular automaton, player AABB collision, side-scroll
digger mini-project), and `bundles-intermediate.js`. Unlocked the Intermediate
tier across all cross-tier links. Caught and fixed a player-jitter bug during
verification (AABB→tile-range off-by-one — `ceil(end)-1`, not `floor(end-1)`).
All browser-verified console-clean. README.md updated.

## 2026-05-21 (pt.3) — Voxel Worlds: Terraria Expert tier

> Okay, work on the next iteration.

Built the Terraria sub-track Expert tier (World Generation & Liquids):
`expert.html` (6 sections + recap), `expert-demos.js` (6 demos — value-noise/fBm,
surface+biome worldgen, caves & ore, cellular-automaton water, BFS flood-fill
tile lighting, chunked infinite worlds), and `bundles-expert.js`. Unlocked the
Expert tier across all cross-tier links. Fixed a torch-seeding weakness during
verification (probe more columns so 4 torches reliably seed). All
browser-verified console-clean. README.md updated.

## 2026-05-21 (pt.4) — Voxel Worlds: Terraria Advanced tier

> Okay, work on the next iteration.

Built the Terraria sub-track Advanced tier (Persistence, AI & Lighting Polish):
`advanced.html` (5 sections + recap), `advanced-demos.js` (5 demos — RLE
save/load, A* on a destructible grid, day/night & weather, offscreen-canvas
tile caching, a living-world capstone with a player + roaming A* hunter), and
`bundles-advanced.js`. Unlocked the Advanced tier across all cross-tier links.
Fixed a pathfinding demo that opened on "no path" (now guarantees a reachable
goal). All browser-verified console-clean. README.md updated.

## 2026-05-21 (pt.5) — Voxel Worlds: Terraria Simulations tier (sub-track complete)

> Yes, continue with the next iteration.

Built the Terraria sub-track Simulations tier — the 5th and final tier:
`simulations.html` (5 sections + recap), `simulations-demos.js` (5 deep-dive
visualisers — cave-carving noise/worm comparison, biome blend playground,
ring-by-ring BFS light stepper, liquid-flow stepper with per-cell decision
arrows, ore-by-depth histogram), and `bundles-simulations.js`. Unlocked the
Simulations tier and marked the Terraria sub-track complete (5/5 tiers). Fixed
a blank-canvas bug — a top-level `const lerp` collided with shared/utils.js's
global `function lerp`, killing the whole demos file at instantiation. All
browser-verified console-clean. README.md + ARCHITECTURE.md updated.

## 2026-05-21 (pt.6) — Voxel Worlds: Noita Beginner tier

> Okay. Work on the next iteration.

Started the Noita sub-track with its Beginner tier ("Falling Sand from
Scratch"): `noita/beginner.html` (4 sections + recap), `noita/beginner-demos.js`
(4 demos — a 36k-pixel ImageData-rendered falling-sand engine, a coarse
rule-stepper with decision arrows, a scan-order demo showing the top-down
teleport bug live, and a paint-walls-and-pour-sand sandbox), and
`noita/bundles-beginner.js`. Introduced ImageData/Uint8ClampedArray rendering
(new technique for the track). Unlocked the Noita Beginner tier across all
cross-tier links. All browser-verified console-clean. README.md updated.

## 2026-05-21 (pt.7) — Voxel Worlds: Noita Intermediate tier

> Okay, work on the next iteration.

Built the Noita sub-track Intermediate tier ("Liquids, Gases, Fire &
Reactions"): `noita/intermediate.html` (5 sections + recap),
`noita/intermediate-demos.js` (a multi-material cellular-automaton engine — 10
materials, 5 behaviour kinds dispatched from a table, a per-cell moved flag,
density-ordered liquid swaps, fire burn timers, a reaction table — plus 5
demos), and `noita/bundles-intermediate.js`. Unlocked the Noita Intermediate
tier across all cross-tier links. Fixed two demo issues found in verification
(gas dissipating too fast; the fire structure's pillar being free-standing).
All browser-verified console-clean. README.md updated.

## 2026-05-21 (pt.8) — Voxel Worlds: Noita Advanced (WHOLE TRACK COMPLETE)

> Okay, work on the next iteration.

Built the final tier — Noita Advanced ("Performance, Material Library &
Sandbox"): `noita/advanced.html` (4 sections + recap), `noita/advanced-demos.js`
(a chunked CA engine, a registerMaterial / registerReaction library, a live
CONFIG, and 4 demos including a 75,600-cell sandbox), and
`noita/bundles-advanced.js`. Marked the Noita sub-track complete (3/3) and the
whole Voxel Worlds track complete (8 tiers, 41 demos). During verification:
made the chunking perf win measurable by reporting `step ms` alongside FPS
(2.5× speedup at the test grid). All browser-verified console-clean. README.md
updated.

## 2026-05-23 — New track: Racing Sim (scaffold + Beginner tier)

> Add a new game track for a top-down 2D racing simulation

Plan mode → approved. Clarified with the user:
- Style: **sim-leaning** (real driving math — vehicle state separated from
  velocity, dt-correct integration, ramps toward grip/slip in later tiers, a
  simplified Pacejka tire curve in Expert/Sims). Not arcade.
- Scope: **Beginner tier only this iteration** + landing page with the full
  five-tier roadmap visible (Intermediate→Sims as `.locked` "Coming soon"
  cards). Mirrors how voxel-worlds and shaders were built — one tier per PR.
- Directory: `racing-sim/`.

Delivered: `racing-sim/index.html` (landing with 5 tier cards), `racing-sim/
beginner.html` (7 sections + recap), `racing-sim/beginner-demos.js` (5 IIFE
demos: car-state slider diagram, kinematic WASD drive, dt-correct vs
per-frame integrator comparison, rotating sprite, parking-lot sandbox with
offscreen-canvas skid marks). Root `index.html` gained a 4th Game Tracks
nav-button (RACE / level-expert badge) + a fourth Game Tracks TOC entry with
five tier links (only Beginner exists; the other four 404 intentionally
until each tier ships). README.md updated. ARCHITECTURE.md unchanged —
racing-sim is a flat 5-tier track, which is the pattern already documented;
no new structural shape. `racing-sim/bundles-beginner.js` deferred to a
future Export commit (matches iso track's history); the export-demo script
is still wired in beginner.html and stays silent without bundles.

## 2026-05-23 (pt.2) — Racing Sim: Intermediate tier (Driving Feel)

> Okay, work on the next iteration.

Continued the per-tier cadence. Shipped the second tier of `racing-sim/`:
Driving Feel. Topics: friction & drag (multiplicative decay along forward
only), lateral-vs-longitudinal velocity decomposition (forward = cos/sin h,
lateral = perpendicular), the grip threshold ("cancel lateral up to
gripLimit*dt; the rest slides"), oversteer vs understeer (one car with low
rear grip + yaw kick, one with damped steering effectiveness), surface
presets (tarmac / gravel / ice), and a drift-pad mini-project with the
surface picker, persistent skid layer (marks only stamp while sliding now),
and a live GRIP / SLIDE telemetry HUD.

Delivered: `racing-sim/intermediate.html` (7 sections + recap),
`racing-sim/intermediate-demos.js` (5 IIFE demos + an `integrateWithGrip`
that's a strict superset of the Beginner integrator). Flipped the
Intermediate roadmap card to Ready on `racing-sim/index.html`. Removed the
"(coming soon)" marker from the root TOC's intermediate link. README,
PROMPT, and memory/2026-05-23.md updated. ARCHITECTURE.md still unchanged.

## 2026-05-23 (pt.3) — Racing Sim: Advanced tier (Track & Race Loop)

> Okay, work on the next iteration.

Continued the per-tier cadence. Shipped the third tier of `racing-sim/`:
Track & Race Loop. The pivot in this tier is **the track becomes data** —
a centerline (sampled points from chained cubic Béziers) plus an
inflation step to produce left/right wall segments. Three apparently
different features fall out of that one data structure: wall collision
(car-circle vs inflated segments, with `Vector2D.reflect`), ordered
checkpoint lap counting (`lineIntersection` against perpendicular cross
segments), and AI driving (look-ahead seek along the same sampled array).

Delivered: `racing-sim/advanced.html` (7 sections + recap),
`racing-sim/advanced-demos.js` (5 IIFE demos + `sampleCubic`,
`buildCenterline`, `inflateWalls`, `buildCheckpoints`,
`closestPointOnSegment`, `collideCarWithWall`,
`collideCarWithPolyline`, `tickCheckpoints`, `aiDrive`, `makeOvalTrack`).
Reuses `Vector2D.reflect` and `lineIntersection` from `shared/utils.js`
— no copy-paste of those.

Demos: drag-to-deform 4-Bézier closed track with walls/samples/handles
toggles; car-vs-segment wall bounce with impact + normal + reflected
arrows; ordered-checkpoint lap counter (step forward / backward / auto);
draggable-target steering seek; race-against-one-AI mini-project (player
WASD vs look-ahead seek AI, both on the same `integrateWithGrip` from
Intermediate, walls bounce both, first to 3 laps wins, HUD shows lap
counts and a winner banner).

Flipped the Advanced roadmap card to Ready on `racing-sim/index.html`.
Removed the "(coming soon)" marker from the root TOC's Advanced link.
README, PROMPT, and memory/2026-05-23.md updated. ARCHITECTURE.md still
unchanged.

## 2026-05-23 (pt.4) — Racing Sim: Expert tier (Sim Polish)

> Okay, work on the next iteration.

Fourth iteration on racing-sim. Topics fixed by the landing-page Expert
tier card: simplified Pacejka tire curve, weight transfer, counter-steer,
race state machine, smooth follow camera with lead, gamepad API, hot-lap
mini-project with telemetry.

The central pivot: `integrateWithPacejka` replaces the Intermediate hard
grip clamp with a smooth slip-angle → lateral-force lookup using
F = D·sin(C·atan(B·α)). Same surface tables work (gripLimit becomes the
peak factor D). Counter-steer becomes a meaningful action because the
curve falls past peak — pushing harder makes things worse.

Delivered: `racing-sim/expert.html` (8 sections + recap),
`racing-sim/expert-demos.js` (6 IIFE demos + pacejka() helper +
integrateWithPacejka + readGamepad + all track/wall/checkpoint helpers
carried forward verbatim).

Demos: interactive Pacejka curve plot (α slider + B/C/D shape knobs +
hard-clamp overlay for comparison), weight-transfer visualiser (4 wheel
load circles, throttle/brake + steer buttons), race state-machine with
F1 lights animation, follow-camera side-by-side (rigid vs lerp vs
lerp+lead with smoothness + lead-time sliders), live gamepad probe
(left-stick X + LT/RT bars + pad name), hot-lap with world-scrolling
camera, race state machine, telemetry HUD (current/last/best lap times,
slip-angle gauge, throttle/brake bars), 3-lap race.

Flipped the Expert roadmap card to Ready on `racing-sim/index.html`.
Removed the "(coming soon)" marker from the root TOC's Expert link.
README, PROMPT, and memory/2026-05-23.md updated. ARCHITECTURE.md still
unchanged.

## 2026-05-23 (pt.5) — Racing Sim: Simulations tier — TRACK COMPLETE

> Okay, work on the next iteration.

Fifth and final iteration on racing-sim. Topics from the landing-page
Simulations card: slip ratio + friction circle, tire heat & wear,
aerodynamic downforce, suspension spring-damper, live g-g diagram,
procedural track generator. Standalone deep-dive toys — no shared state
across demos, no integration into the hot-lap. Same pattern as the
voxel-worlds Simulations tier.

Delivered: `racing-sim/simulations.html` (7 sections + completion banner),
`racing-sim/simulations-demos.js` (6 IIFE demos + mulberry32 PRNG +
startFrameLoop + drawArrow). No grid/track/wall helpers carried forward —
the procgen demo builds its own track in-place because its constraint
(closed centerline from polar anchors) differs slightly from
makeOvalTrack.

Demos: draggable friction-circle (drag a cyan dot inside a normalised
unit circle, see lateral+longitudinal force bars, in/out indicator);
tire heat & wear (single tire icon colour-shifts cold→good→hot, bell-
curve grip multiplier plot with the current temp's dot, three mode
buttons); aerodynamic downforce calculator (real-world equation
0.5·ρ·v²·A·C_L; bar chart of downforce, normal load, cornering grip; the
car-weight reference line on the normal-load bar; sliders for speed in
km/h and C_L·A in m²); suspension spring-damper animation (car body
rides over bumpy road at constant speed; sliders for k and c; live ζ
damping ratio with regime classification UNDER/CRITICAL/OVER); live g-g
diagram (drive WASD on an empty pad, dot traces the friction circle in
real time, fading trail, three telemetry time-series panels for speed/
lat-g/long-g); procgen track generator (seeded mulberry32 + N polar
anchors with radial jitter + cubic-Bézier handles tangent to local
circle direction; auto-driver follows the centerline so you see if it's
drivable).

Flipped the Simulations roadmap card to Ready. Removed the
"(coming soon)" marker from the root TOC's Simulations link. README
updated to mark the whole `racing-sim/` track as "fully shipped — all 5
tiers, 26 demos." PROMPT and memory/2026-05-23.md updated. ARCHITECTURE.md
still unchanged — flat 5-tier pattern already documented.

**Track total: 5 tiers, 26 interactive demos.**

# 2026-05-28 — New track: Netcode & Multiplayer (scaffold)

"I want to look into multiplayer or netcode. Could it be a track on its
own? Don't make a plan yet."

Plan-mode conversation → AskUserQuestion (track category, existing-seed
handling, transport, cross-links) → ExitPlanMode approved → ship the
**scaffold only** following the racing-sim cadence.

## Decisions taken with the user

- **Index integration:** rename the root index "🏰 Game Tracks" section to
  "🏰 Tracks" (no sub-groups); genre + systems tracks coexist flat.
- **Existing seed:** `expert.html#network` is left untouched; both surfaces
  stand alone and diverge.
- **Transport:** simulated network only. A `FakeNetwork` with sliders for
  RTT, jitter, loss, reorder. No backend, no WebRTC, no BroadcastChannel.
- **Cross-links:** the netcode track's later tiers reuse the racing-sim car
  internally; genre tracks (`racing-sim/`, `isometric-strategy/`) are NOT
  edited.

## Shipped this commit

```
netcode/
  index.html              ← landing: 5 tier cards all locked "Coming soon",
                            scaffold self-check at the bottom
  net/
    seeded-rng.js         ← mulberry32, on window.SeededRng
    fake-network.js       ← priority-queue simulator on window.FakeNetwork
```

Root `index.html` — 4 edits:
- "Game Tracks" → "Tracks" (heading + TOC heading + intro paragraph
  broadened for systems tracks).
- New NETCODE nav-button after RACE.
- New TOC `<li>` after racing-sim with 5 "(coming soon)" tier links.

Docs — README adds netcode entry (scaffold-only status); ARCHITECTURE
documents the new `<track>/net/`-style helper-subfolder convention; this
memory log + PROMPT append.

## Verification

`python3 -m http.server 8765` via the existing `.claude/launch.json`.

- `netcode/index.html` loads with **zero** console errors. The self-check
  panel prints three green ticks (SeededRng deterministic, FakeNetwork
  delivers, stats correct).
- Programmatic stress test from the page: 200 packets @ 50% loss → 87
  dropped (43.5%); 50 packets @ 30% reorder → 23 of 50 arrived out of
  sequence; seed=42 twice → bit-identical stats {delivered: 86,
  dropped: 14, reordered: 6}.
- Root `index.html` integration verified: heading renamed, old heading
  gone, NETCODE nav-button links, TOC entry plus 5 sublinks render.
- No regression at `expert.html#network` — section + heading + canvas
  still render, anchor still scrolls.

**Tier-by-tier landing follows on the racing-sim cadence: Beginner →
Intermediate → Advanced → Expert → Simulations, one commit each.**

# 2026-05-28 (pt.2) — Netcode: Beginner tier (Hello, Network)

"Continue with the next iteration." — second iteration on netcode,
following the racing-sim cadence (one tier per commit).

## Shipped this commit

```
netcode/
  beginner.html         ← 6 sections + recap (intro, anatomy, packet
                          lane, tick vs frame, bandwidth, ping-pong)
  beginner-demos.js     ← 4 IIFE demos + NET_COLORS palette + fmt helpers
```

Additive helper tweak — `netcode/net/fake-network.js` now stamps each
in-flight packet with `sentAt`, `delay`, and `reordered: bool` so demos
can render progress along a lane. Pure addition; scaffold self-check
still passes.

`netcode/index.html` — Beginner tier card flipped to `.active + .ready
+ "Ready"`. Landing roadmap intro updated.

Root `index.html` — "(coming soon)" marker removed from netcode
Beginner TOC sublink.

## The four demos

1. **packetLaneDemo** — animated CLIENT→SERVER lane, auto-sending. Each
   in-flight packet drawn as a labelled circle at progress = (now−sentAt)/
   delay. Sliders: RTT/jitter/loss/reorder. Lost packets shown as faded
   red ✕; reordered packets tinted purple with a halo.
2. **tickVsFrameDemo** — orange SIM ball on tick rail, cyan REN ball on
   render rail. Toggle for interp between ticks. Slider for tick rate
   (2–60 Hz). Live gap |sim−ren| in the info bar.
3. **bandwidthCalcDemo** — DOM-driven. Four sliders for the tick × players
   × entities × bytes equation. Four shipped-game presets. Logarithmic
   coloured meter banded by network class.
4. **pingPongDemo** (capstone) — two clients exchanging messages through
   one FakeNetwork. Send / burst buttons. Seed input + Reset = visible
   proof of determinism.

## Verification

`python3 -m http.server 8765` via existing launch.json.

- netcode/index.html scaffold self-check still 3 green ticks (additive
  FakeNetwork tweak non-breaking).
- netcode/beginner.html loads with zero console errors.
- All 3 canvases render, all 32 control elements wired.
- Bandwidth: defaults give 30.7 kbps; Valorant preset gives 122.9 kbps
  ("Fine for mobile data and ADSL"); bytes-slider drag to 128 grows to
  655.4 kbps with live label update.
- Ping-pong: seed=42 + burst A + burst B → 10 sent, 9 delivered, 1
  dropped, 0 reordered. Reset and repeat → bit-identical stats. **The
  Expert tier's determinism story already provable by hand.**
- Receive log shows out-of-order arrivals from jitter alone (5 sends in
  ~1ms get spread by ±20 ms jitter), proving "burst send + jitter
  shuffles order even at 0% reorder" — a teaching point worth surfacing
  in the Intermediate tier.
- Root index Beginner sublink: "(coming soon)" gone.
- expert.html#network unchanged — section + canvas + anchor still work.

## Next

- **Intermediate tier — Authority & Movement.** Authoritative server vs
  P2P; naive (input → wait → move) → client-side prediction → entity
  interpolation for remote players; snap vs smooth correction. The
  tick-vs-frame demo from THIS tier is the template for Intermediate's
  entity-interpolation demo (same toggle, different data source).

# 2026-05-28 (pt.3) — Netcode: Intermediate tier (Authority & Movement)

"Okay, work on the next iteration." — third iteration on netcode,
following the racing-sim cadence (one tier per commit).

## Shipped this commit

```
netcode/
  intermediate.html        ← 6 sections + recap (intro/authority,
                             naive, prediction, interpolation,
                             snap-vs-smooth, arena mini-project)
  intermediate-demos.js    ← 5 IIFE demos + Player + helpers
```

`netcode/index.html` — Intermediate tier card → `.active + .ready + "Ready"`.
Root `index.html` — "(coming soon)" removed from Intermediate sublink.

## The five demos

1. **naiveDemo** — split SERVER | CLIENT panels. Wait-for-server client
   lags by full RTT. The cornerstone "feel the pain" demo.
2. **predictionDemo** — apply input locally + naive snap on snapshot.
   Toggle on/off for A/B vs naive. Green dashed ghost shows the
   authoritative position so the snap distance is visible.
3. **interpolationDemo** — remote entity orbits a circle on the
   server. LEFT renders latest snapshot (stutters); RIGHT renders
   at `now − interpDelay` lerping between buffered snapshots.
   Dashed orange "server truth" outline makes the "behind reality
   by N px" cost explicit.
4. **snapVsSmoothDemo** — two players hit by identical periodic
   corrections. LEFT snaps, RIGHT smooths with frame-rate-correct
   `1 − exp(−k·dt)` exponential decay (links back to racing-sim's
   follow camera which uses the same formula).
5. **arenaDemo** (capstone) — SERVER + CLIENT panels with one local
   player (WASD/buttons) + one remote bot. Three independent toggles
   for prediction/interpolation/smoothing under harsh network sliders.
   A/B each technique in isolation.

## Discipline locked in

Server-state and client-state are SEPARATE objects in every demo;
communication ONLY through FakeNetwork messages. Typed verbatim into the
demos file header. If a demo reads server state from a client renderer,
the technique it's teaching becomes invisible.

## Verification

`python3 -m http.server 8765`.
- intermediate.html loads with zero console errors.
- All 5 canvases + 41 controls present.
- Every demo's info bar populated with live data.
- Interaction tests pass: prediction toggle, interp slider, arena
  toggles + reset, naive button input all wire correctly.
- Visual screenshots:
  - naive at rest: both balls centred.
  - naive after right-hold: both balls on right side of panels.
  - interpolation: LEFT stuttery purple, RIGHT smooth green WITH
    server-truth outline visibly ahead of it.
  - arena (all toggles on, RTT 350 / jitter 20 / loss 2): both
    panels show near-identical positions — the technique stack
    works under brutal conditions.

## Next

- **Advanced tier — Reconciliation, Lag Comp, Compression.** The
  arena from this tier extends into a tiny 2-player shooter scene.
  Server reconciliation fixes the visible snap from this tier's
  predictionDemo. Lag compensation fixes the "behind reality" cost
  from interpolationDemo. Delta compression + bit-packing attack
  the bandwidth equation from Beginner.

# 2026-05-28 (pt.4) — Netcode: Advanced tier (Reconciliation, Lag Comp, Compression)

"Okay, work on the next iteration." → "Continue." — fourth iteration on
netcode.

## Shipped this commit

```
netcode/
  advanced.html         ← 7 sections + recap
  advanced-demos.js     ← 5 IIFE demos + quantize/dequantize/estimateBytes
```

`netcode/index.html` — Advanced tier card → Ready.
Root `index.html` — "(coming soon)" removed from Advanced sublink.

Small permanent edit: `<script src="advanced-demos.js?v=2"></script>`
in advanced.html, to dodge `python3 -m http.server`'s aggressive cache
during verification (see Bugs).

## The five demos

1. **reconciliationDemo** — input ring buffer + replay. Toggle on/off.
   Avg snap distance over hundreds of snapshots → 0.0 px with reconcile
   ON, grows with RTT × velocity when OFF. The whole technique is in
   one displayed number.
2. **lagCompDemo** — two-panel A/B. LEFT no-lag-comp validates shots
   at current server time. RIGHT rewinds 2 s of history to client's
   render-time. Faint orange trail on the right shows the rewind
   buffer. Auto-fire defaults: 0/124 vs 124/124 hits.
3. **deltaSnapshotDemo** — DOM-driven bandwidth calculator: full vs
   delta. Two bars + verdict text bands. Defaults: 80% saved.
4. **quantizationDemo** — float vs k-bit int round-trip on a Lissajous
   path. Slider for bits (4-32). Visible quantization grid at low bits.
   Numeric error readout. Defaults (16 bits): 0.007 wu error.
5. **shooterDemo** (capstone) — 2-player shooter, WASD + mouse-aim +
   click-to-fire, bot orbits and fires every 2 s, both sides respawn
   at 5 HP. Four independent toggles for the four techniques. Live
   bandwidth kbps readout.

## Bugs caught & fixed mid-iteration

- **shooterDemo HP went negative.** No respawn logic; the bot kept
  firing forever and `sLocal.health` decremented to -75/5 over time.
  Fixed by resetting to 5 + random-teleport on `health <= 0`.
- **Browser cached `advanced-demos.js`.** Edits weren't picked up by
  preview reload. Verified via `performance.getEntriesByType('resource')`.
  Fixed by versioning the script src to `?v=2`. Future edits need a
  version bump.
- **Stray debug junk in lagCompDemo** (`let shotsL = null;` + a doubled
  ternary `drawShots` call). Removed before HTML wiring.

## Verification

`python3 -m http.server 8765`.
- All 4 canvases + 47 controls present; console clean.
- Every demo's info bar populated with the right teaching number:
  reconcile avg snap = 0.0 px; lag-comp 100% vs 0%; delta 80% saved;
  quant 0.007 wu error.
- HP respawn confirmed (3/5 after 16 s of bot fire).
- Visual: lag-comp orange history trail renders on the WITH panel.
- Root index Advanced sublink: marker gone.

## Next

- **Expert tier — Determinism, Lockstep, Rollback, AoI.** The
  architectural alternatives (lockstep RTS, rollback fighters) plus
  AoI filtering for big scenes. Cross-track stub demo reuses
  racing-sim car for the rollback section.

# 2026-05-28 (pt.5) — Netcode: Expert tier (Determinism, Lockstep, Rollback, AoI)

"Okay, work on the next iteration." — fifth iteration on netcode.

## Shipped this commit

```
netcode/
  expert.html          ← 8 sections + recap (intro, determinism,
                         lockstep, rollback, AoI, anti-cheat primer,
                         recap, next)
  expert-demos.js      ← 4 IIFE demos + double-pendulum solver +
                         flocking + GGPO ring buffer + spatial grid +
                         racing-sim car physics
```

`netcode/index.html` — Expert tier card → Ready. Only Simulations left.
Root `index.html` — "(coming soon)" removed.

## The four demos

1. **determinismDemo** — two double-pendulums diverging from a 1e-7 rad
   starting difference. After ~10 s the trails are completely different
   shapes. The chaos IS the teaching. Includes fixed-point/lookup-table
   code block as the "how shipped games avoid this" answer.
2. **lockstepDemo** — 10–400 units flocking to one waypoint. Two
   coloured bars compare lockstep bandwidth (O(players)) vs naive
   per-entity bandwidth (O(N × tick)). At 100 units/20 Hz: lockstep is
   67× smaller.
3. **rollbackDemo** — the headline. Two cars (cyan local, purple bot)
   borrowed-from-racing-sim physics. Full GGPO-style 90-tick ring
   buffer + predict + rewind-and-resimulate when real input differs
   from predicted. Yellow flash on the bot when rollback fires. Right
   panel shows live rollback count, avg depth, max depth. At RTT 120 +
   2 Hz bot changes: ~22 rollbacks/sec, avg depth 4.6 ticks = RTT/dt.
   **This is the cross-track stub the original plan promised between
   netcode and racing-sim.** Both tracks now link to each other in this
   section.
4. **aoiDemo** — 20-500 wandering entities, mouse cursor = observer,
   spatial grid overlay (cell = AoI radius) so radius queries touch
   ≤4 cells. Visible green / dim gray entities. At 100/120: 84%
   omitted, 9/18 cells scanned vs naive O(100).

Plus an HTML-only **Anti-cheat primer** (server authority + sanity
bounds + replay verification), no demo because the topic is principles
not animation.

## Bugs caught & fixed mid-iteration

- **Determinism slider used as raw value instead of exponent.**
  Slider value -7 meant Δθ₀ should be 1e-7, not -7. Wrapped in a
  `perturbValue()` helper + label-formatter.
- **Rollback handler on the WRONG endpoint.** Registered on `botEp`
  (sender) instead of `localEp` (receiver). The bot sends to local;
  local needs the onMessage handler. Symptom: 0 rollbacks ever, demo
  silently broken. Fixed + explicit comment in the file.
- **Cache-bust pattern reused** (`?v=2` on the script tag) — bumped
  once during this iteration after the rollback routing fix.

## Verification

`python3 -m http.server 8765`.

- expert.html: zero console errors, 4 canvases + 33 controls, all
  drawing content.
- determinism: drift 70.4 px after 8 s at Δθ₀=1e-7 → chaos confirmed.
- lockstep: 67× smaller bandwidth confirmed.
- rollback: ~22 rollbacks/sec, avg depth 4.6 ticks confirmed.
- aoi: 84% omitted, 9/18 cells scanned vs O(100) confirmed.
- Cache-bust `?v=2` loads with `fromCache: false`.
- Visual: two-trail divergence in determinism; cars + full stats
  panel in rollback.
- Root index Expert sublink: marker gone.

## Next

- **Simulations tier — Everything On.** The capstone master arena
  combining all techniques from all tiers, with a bandwidth budget
  calculator, lockstep-vs-rollback comparison panel, AoI heatmap, and
  a full-session replay scrubber. The "everything we've taught,
  composable" finale.

# 2026-05-28 (pt.6) — Netcode: Simulations tier — TRACK COMPLETE

"Okay, continue with the next iteration." — sixth and final netcode
iteration. (Model switched to opus-4-8 mid-session.)

## Shipped this commit

```
netcode/
  simulations.html         ← 6 sections + completion banner
  simulations-demos.js     ← 5 IIFE demos (capstone re-compositions)
```

`netcode/index.html` — Simulations card → Ready; **all 5 tiers Ready**;
landing intro rewritten to "all five complete, 23 demos".
Root `index.html` — last "(coming soon)" removed; every netcode link live.
README — netcode marked "fully shipped — all 5 tiers, 23 demos".

## The five demos

1. **masterArenaDemo** — whole client-side stack on one scene, 5
   independent toggles + All-on/All-off + network sliders.
2. **budgetCalcDemo** — every tier's reductions folded into one
   calculator (×delta ×quant ×AoI). 32-player: 737 → 18 kbps (40×).
3. **lockstepVsRollbackDemo** — the two determinism architectures side
   by side. Lockstep: RTT/2 delay, 0 corrections. Rollback: 0 delay,
   N corrections.
4. **aoiHeatmapDemo** — interest-load heatmap with a clustering slider.
   100% cluster → peak cell = all N players (server worst case).
5. **replayScrubberDemo** — record a deterministic seeded sim, scrub it,
   "Verify replay" asserts bit-identical reconstruction (max error
   0.000000). The determinism capstone.

## The big bug — reconciliation needs matched timesteps

First cut predicted at FRAME rate but buffered/replayed at INPUT rate →
mismatch → reconcile didn't reduce corrections (avg ~6 px both on and
off; one run showed reconcile WORSE due to reversal transients). Fixed
with the correct architecture: client predicts in fixed PRED_DT steps;
server is input-driven (consume buffered inputs in tick order, lag by
network delay); reconcile-replay uses the same PRED_DT. After fix:
avg correction 6 → 1 px when toggling reconcile on. Loss/reorder handled
with a +3-tick gap tolerance before declaring an input lost. Also fixed
a smoothing no-op (handler hard-snapped then frame loop lerped to the
same value) by routing the reconciled target through smoothTarget.

## Verification

`python3 -m http.server 8765` (cache-bust `?v=3` + `?cb=Date.now()`).
- simulations.html: zero console errors, 4 canvases + 51 controls.
- Reconcile A/B: predict-only avg 6/max 9; +reconcile avg 1/max 5.
  All-on: local gap 0, avg correction 0.
- Budget: 737 → 18 kbps (40×).
- Lockstep vs rollback: 80 ms/0 corr vs 0 ms/84 corr.
- Heatmap clustered: peak cell 40 players.
- Replay verify: bit-identical over 599 ticks, max error 0.000000.
- Screenshot: master arena renders both panels + full HUD.

## Track total

5 tiers, 23 demos, zero backend. From "what is RTT" to "prove a session
replays bit-identically". Determinism (scaffold SeededRng) was the
thread connecting FakeNetwork reproducibility, the rollback ring buffer,
and the replay verifier. Track COMPLETE.

## Next

Nothing on this track. Deferred: per-tier bundles-*.js Export files.
Future tracks: platformer/, roguelike/, or another systems track.


# 2026-05-30 — Roguelike: scaffold (engine + landing page)

Prompt (paraphrased): "A roguelike game track was suggested earlier
(screenshots: NetHack/Brogue/DCSS, tier arc Beginner→…→Simulations).
Use it to make the plan, but add anything required to make it
comprehensive and complete." Confirmed: deliver iteratively tier-by-tier
(one commit each); the screenshots are inspiration only, so the track
uses the repo's own B→I→A→E→S difficulty order (FOV/fog → Advanced;
items/AI/effects → Expert) rather than the screenshots' labels.

The project's first TURN-BASED track. The whole genre advances one turn
at a time instead of on a real-time loop — the architectural pivot the
Beginner tier will teach. It's also the natural capstone genre: it
composes Fundamentals already taught (procgen, shadow casting, A*, ECS,
FSMs, behavior trees) into a game you can lose.

## Shipped this commit (scaffold only — mirrors the netcode scaffold)

- `roguelike/engine/seeded-rng.js` — `RogueRng` on window. Superset of
  netcode's `SeededRng`: same mulberry32 core (so seeds are consistent
  repo-wide) + roguelike helpers `between`, `pick`, `shuffle` (in-place
  Fisher–Yates), `weighted` (loot/spawn tables), `dice(n,sides)`
  (tabletop NdS). Track-local on purpose (self-contained track + teaches
  roguelike RNG idioms) rather than elevated to shared/.
- `roguelike/engine/grid.js` — the shared turn-based grid core:
  `Tile` enum (WALL=0 so a fresh grid is solid rock that generators
  carve), flat-`Uint8Array` `Level` (idx/inBounds/get/set/isWalkable/
  isOpaque/clone/count; out-of-bounds reads as WALL so callers skip
  edge-casing), the `RL` palette + `TILE_GLYPH` table, and
  `drawGlyphGrid(ctx, level, opts)` — the ASCII renderer (monospace
  glyphs, optional entities, optional visible/explored fog mask for
  later tiers). Names pre-checked vs shared/utils.js.
- `roguelike/index.html` — landing page mirroring netcode/index.html:
  five-tier roadmap cards (Beginner = "Building next", rest "Coming
  soon"), Fundamentals prerequisites, and a self-check that proves
  determinism + the helpers + renders a hand-built room.
- Root `index.html` — ROGUE nav-button card (Tracks section) + nested
  TOC entry. README.md, ARCHITECTURE.md (engine/ = 2nd instance of the
  netcode/net/ per-track-helper pattern) updated.

## Verification

`python3 -m http.server 8765`, opened roguelike/index.html in-browser.
- Console: ZERO logs/errors.
- Self-check all green: RogueRng deterministic (seed 1337 →
  [0.1844, 0.1900, 0.8105]); dice/pick/weighted in range; Level
  queries agree.
- Renderer: scaffoldCanvas painted (65,045 non-bg px) — screenshot
  shows the room with #/·/>/@/r glyphs in the right palette.
- Links: root card + TOC resolve; roguelike/index.html → 200.

## Next

Beginner tier ("The Grid & The Turn"): beginner.html + beginner-demos.js
— grid&glyphs, turn loop (turn-based vs real-time), bump-to-attack,
message log + seeded combat, capstone "One Room, One Rat". Flip the
Beginner roadmap card to Ready and add its TOC sub-links.


# 2026-05-30 (pt.2) — Roguelike: Beginner tier (The Grid & The Turn)

Prompt: "Okay, work on the next iteration." (Continue the roguelike track,
tier by tier.)

## Shipped this commit

beginner.html + beginner-demos.js, 5 demos (4 teaching + capstone), built
on the scaffold's RogueRng + Level/drawGlyphGrid:

1. gridGlyphDemo — walk a @ around a hand-built room; walls block; toggle
   tile grid. Teaches Level + glyph rendering + "the player is a separate
   object, not in the tile array".
2. turnLoopDemo — TWO copies of one room side by side. LEFT goblin steps on
   a 350 ms real-time timer regardless of input; RIGHT goblin steps once per
   player action. The genre's defining inversion, made visceral by "sit still
   and watch only the real-time monster close in".
3. bumpAttackDemo — one keypress -> move / attack / blocked, against passive
   dummies (1d6, HP bars, corpses). Only move/attack cost a turn.
4. combatLogDemo — a duel with turn order + retaliation + death + a seeded,
   reproducible scrolling message log.
5. oneRoomOneRatDemo (CAPSTONE) — complete micro-roguelike: pillared room,
   sleeping rat that wakes on proximity and hunts via greedy step-toward,
   bump combat both ways, live log, HP, win (descend stairs) / lose (death),
   all reproducible from a seed.

Shared rl* toolkit in the demos file (collision-safe, no shadowing of
shared/utils.js globals): rlKeyToStep (arrows/WASD/hjkl + '.'/space wait),
rlTryMove (the move/attack/blocked resolver), rlStepToward/rlStepCandidates
(greedy cardinal pursuit — explicitly NOT pathfinding, that's Advanced),
rlInstallCanvasKeys (click-to-focus + preventDefault so demos don't fight
over arrow keys / scroll the page), rlLog, rlFocusHint, HP bars, flashes.

## Bug caught & fixed mid-iteration

turnLoopDemo's reset() reset the goblins + counters but NOT the player
position, so after earlier moves the real-time goblin spawned next to the
player and reported "caught you!" after one step. Fixed: reset() now
restores player to PSTART. (Verification also confirmed the real-time
goblin advances on its timer — the bug was purely the stale player pos.)

## Verification

`python3 -m http.server 8765`, beginner.html in-browser, console CLEAN
(zero logs/errors) throughout. Drove every demo via synthetic keydowns:
- Demo 1: (1,1)->(3,2) moves; wall bump clamps at x=1 with last='blocked'.
- Demo 2 (post-fix): 3 turns -> turn-based goblin 3 steps, player home; the
  real-time goblin stepped on its own timer between frames (rtSteps grew
  with wall-clock time, 0 with player input).
- Demo 3: bump destroys a dummy ("You hit the dummy for 4. It is destroyed!").
- Demo 4: played to "The rat dies! You win." AND proved determinism — same
  seed (7) + same inputs => byte-identical message log across two runs.
- Demo 5: marched to the rat (woke: "The rat notices you!"), killed it
  (rat dead 0/10), descended -> "🏆 you descended — you win!". Screenshot
  shows the pillared room, @ on >, rat corpse %, colour-coded combat log.
- code-tabs: 4 containers, JS/TS buttons, Prism highlighting active.

Indexes updated: roguelike/index.html (Beginner card -> Ready + nav link;
Intermediate -> "Building next"), root index.html TOC (Beginner sub-link),
README.md (Beginner tier documented).

## Next

Intermediate tier ("Building the Dungeon"): rooms + carving, corridors, BSP
partitioning, drunkard's walk, populate (spawn/stairs/monsters by seed +
flood-fill connectivity), capstone "Explore the Dungeon" (descend stairs to
a freshly generated level). Reuse RogueRng + Level; the generated map
replaces the hand-built room.


# 2026-05-30 (pt.3) — Roguelike: Intermediate tier (Building the Dungeon)

Prompt: "Okay, work on the next iteration." → continue tier by tier.

## Refactor first (DRY before duplicating into 4 tiers)

Promoted the Beginner tier's shared turn/movement/combat/input/render toolkit
out of beginner-demos.js into engine/actors.js (rlKeyToStep, rlTryMove,
rlStepToward/Candidates, rlActorAt, rlManhattan, rlMakeRoom,
rlInstallCanvasKeys, rlDrawEntities, rlEntityList, rlHpBar, rlPushFlash/
rlDrawFlashes, rlFocusHint, rlLog). beginner.html now loads engine/actors.js;
beginner-demos.js keeps only its 5 demo IIFEs. This is ARCHITECTURE.md's
"≥2 tier files ⇒ promote to sibling folder" rule firing (the Intermediate
capstone is the 2nd consumer). Re-verified Beginner still works post-refactor.

## Shipped this commit

intermediate.html + intermediate-demos.js, 6 demos. Generators live inline in
the tier file (they're the lesson): placeRooms (overlap reject), connectRooms
(L-corridors), bspBuild/bspMakeRooms/bspConnect (BSP), makeDrunkard/caveGen
(drunkard's walk), floodFill/regionsOf/keepLargestRegion (connectivity),
randomFloorIn/Tile, countWalkable.

1. roomsDemo — scatter rooms, reject overlaps (attempts slider, outline overlay).
2. corridorsDemo — L-corridors connect rooms; connection-graph overlay; live
   flood-fill "all connected ✓"; random-elbow toggle.
3. bspDemo — recursive longer-axis split, one room per leaf, connect-on-unwind;
   partition-tree overlay; max-depth slider.
4. drunkDemo — animated drunkard's-walk caves; fill-% + walker-count sliders.
5. populateDemo — seed-placed spawn/stairs/monsters/items + BFS flood-fill
   reachability overlay (green/red); generator toggle (rooms vs multi-walker
   cave); "keep largest region" connectivity repair.
6. exploreDungeonDemo (CAPSTONE) — playable multi-level dungeon; bump combat
   with wandering rats; press > on stairs to descend to a freshly generated
   deeper level (depth-derived seed); reach depth 5 to win / die to lose.

## Verification

`python3 -m http.server 8765`, intermediate.html, console CLEAN throughout.
- All generators connected on load: corridors 535/535, BSP 390/390, drunkard
  carved to target.
- Flood-fill teaching proven: cave seed 3 → 255/374 (⚠119 isolated); enable
  "keep largest region" → 255/255 (all reachable ✓).
- Capstone (seed 1337, randomised exploration): movement (turn 1346), combat
  (rat killed + rat bit player), DESCENT (depth 1→2, "You descend"), and the
  death terminal state (HP 0 → 💀). Win path is the same descend mechanism.
- Screenshot: BSP demo with partition overlay (15 leaves / 15 rooms, all
  connected).
- code-tabs: JS/TS toggles + Prism highlighting active on all 5 code blocks.

Indexes updated: roguelike/index.html (Intermediate → Ready + nav link;
Advanced → "Building next"), root index.html TOC (Intermediate sub-link),
README.md (Intermediate tier + actors.js documented), ARCHITECTURE.md
(engine/actors.js noted as the promotion-trigger example).

## Next

Advanced tier ("Sight & Pursuit"): Bresenham line-of-sight, recursive
shadowcasting FOV, fog of war / map memory, A* monster pathing (promote a
reusable dungeon generator to engine/ here — the 3rd consumer), Dijkstra
"scent" maps, capstone "The Hunt".


# 2026-05-30 (pt.4) — Roguelike: Advanced tier (Sight & Pursuit)

Prompt: "Okay, work on the next iteration." → continue tier by tier.

## Promote first

generateDungeon + dg* helpers (rooms+corridors, keepLargest, flood-fill) moved
to engine/dungeon.js — the Intermediate generator's 3rd consumer (FOV/fog/A*/
Dijkstra/capstone all need a dungeon). advanced.html loads engine/dungeon.js.

## Shipped this commit

advanced.html + advanced-demos.js, 6 demos. Vision/pathing algorithms are
TOP-LEVEL globals (shared by demos + unit-testable from the console):
- losLine(level,x0,y0,x1,y1) — Bresenham LOS {cells, clear, blockedAt}.
- computeFOV(level,ox,oy,radius) — recursive shadowcasting (8-octant classic,
  FOV_MULT + castLight). The marquee new algorithm.
- aStarPath(level,sx,sy,tx,ty) — A* with a binary heap (RLHeap), 4-connected.
- dijkstraFrom(level,sources) — multi-source BFS distance field; stepDownhill.

Demos: 1 losDemo (mouse-driven line, green/red, marks blocking wall);
2 fovDemo (move to look around, radius slider, whole map dim + lit FOV);
3 fogDemo (unseen/remembered/visible, monsters hidden outside FOV, explored %);
4 astarDemo (one chaser replans via A* only while it has LOS, draws path);
5 dijkstraDemo (one scent map → 2 chasers roll downhill; heatmap + arrow
overlay; flee/negate toggle); 6 huntDemo CAPSTONE (fog + FOV + LOS aggro +
shared Dijkstra chase + forget-after-FORGET-turns; stealth emerges; reach
stairs to escape / die).

## Verification

`python3 -m http.server 8765`, advanced.html, console CLEAN throughout.
- UNIT-TESTED the algorithms against a hand-built 11x11 room with one wall
  pillar at (7,5), player at (5,5):
  - FOV: wall (7,5) visible, tiles (8,5)/(9,5) BEHIND it correctly shadowed
    (fovShadowCorrect=true); open cells visible.
  - LOS: (5,5)->(9,5) blocked at (7,5); (5,5)->(5,9) clear.
  - Dijkstra: dist to (8,5) = 5 (routed around, not straight-line 3).
  - A*: path length 5, ends at (8,5) (routes around the wall).
- Demos init: FOV recomputes on move (68→63 visible); Dijkstra max dist 31;
  fog explored % grows; hunt 4 rats / HP 26.
- Capstone (seed 1337, randomised play): rats spotted ("A rat spots you"),
  hunted, bit, were killed (rats 0), and player ESCAPED via the stairs
  ("🏆 escaped — you win!", turn 1519). Death state also reachable.
- Screenshot: Dijkstra heatmap (warm near player → cool far, max 31) + arrows.

Indexes: roguelike/index.html (Advanced → Ready + nav; Expert → Building next),
root index.html TOC (Advanced sub-link), README.md (Advanced tier +
engine/dungeon.js), ARCHITECTURE.md (dungeon.js as 4th engine file; note the
"top-level so testable" pattern).

## Next

Expert tier ("Items, Effects & Minds"): items as ECS data (reuse the repo's
Entity/World pattern), inventory + equipment UI (keyboard-driven), status
effects + identification (unidentified potions/scrolls), energy/speed turn
scheduler (fast monsters act twice), monster AI variety (FSM + behavior trees),
capstone "Armed & Dangerous".


# 2026-05-30 (pt.5) — Roguelike: Expert tier (Items, Effects & Minds)

Prompt: "Okay, work on the next iteration." → continue tier by tier.

## Promote first

Moved losLine/computeFOV/aStarPath/dijkstraFrom/stepDownhill (+RLHeap/FOV_MULT/
VIS_DIRS4) from advanced-demos.js to engine/vision.js — the Expert capstone is
their 2nd consumer. advanced.html loads engine/vision.js; advanced-demos.js
keeps only its demos. Re-verified Advanced (FOV unit test still passes).

## Shipped this commit

expert.html + expert-demos.js, 6 demos. New systems as shared helpers:
item ECS (Item + ItemWorld.query), attackDice/defenseOf (derived stats),
addStatus/tickStatuses/hasStatus/speedOf (status effects), BTSel/BTSeq/BTCond/
BTAct (behavior trees), applyConsumable. Inventory uses NUMBER keys (1–9) since
letters are movement.

1. itemsEcsDemo — items as entities with components; walk to pick up, x to drop;
   panel queries by component.
2. inventoryUiDemo — press 1–9 to equip/unequip; attack/defense DERIVED from gear
   (1d3→1d8 with a sword; def 0→3 with mail).
3. statusIdentDemo — quaff seed-shuffled unidentified potions (heal/poison/regen),
   identify by use; statuses tick each turn (poison bleeds, regen heals).
4. energyDemo — energy/speed scheduler; snake (spd200) acts 2×, zombie (spd50) ½×
   per player move; live energy bars.
5. aiVarietyDemo — FSM brute (sleep→chase→attack), FSM coward (flee), behavior-tree
   archer (shoot/retreat/reposition/wander); state labels above each.
6. armedDangerousDemo (CAPSTONE) — Advanced fog+FOV+pursuit + floor loot/equip +
   unidentified potions + status effects + energy scheduler (fast venomous snake,
   slow zombie) + derived-stat combat; reach stairs to win / die.

## Bugs caught & fixed mid-iteration

- speedOf/hasStatus crashed on monsters (no .statuses array; monsters use `speed`
  not `baseSpeed`). Guarded statuses and made speedOf resolve baseSpeed ?? speed.
- coward referenced nonexistent RL.accent2; archer's wander branch was a no-op
  (truthy-array bug). Both fixed.
- status demo referenced a "New mix" reset that didn't exist → added the button +
  wiring. Switched all inventory prose from letters to numbers (movement clash).

## Verification

`python3 -m http.server 8765`, expert.html, console CLEAN throughout.
- Derived stats: equip sword+mail → "attack 1+1d8 · def 3" (from 1+1d3 · 0).
- Energy scheduler EXACT: 8 player acts → snake ×16 (2×), rat ×8, zombie ×4 (½×).
- Items: pick up + drop works. Status: quaff identifies (murky→regen), ticks.
- AI: brute saw sleep/chase/attack; coward idle/flee!; archer shoot/retreat/
  reposition — all transitions observed.
- Capstone (seed 1337, randomised play): pickup ✓, equip ✓ (atk→1+1d8), hit ✓,
  kill ✓, bitten ✓, poisoned-by-snake ✓, death terminal ✓ (win path = same
  stairs trigger verified in Advanced's hunt). Fog screenshot captured.

Indexes: roguelike/index.html (Expert → Ready + nav; Simulations → Building next),
root index.html TOC (Expert sub-link), README.md (Expert tier + engine/vision.js),
ARCHITECTURE.md (vision.js as 5th engine file).

## Next

Simulations tier ("The Whole Dungeon" — grand capstone): cellular-automata caves,
level themes by depth (rooms shallow, caves deep, themed palettes/spawn tables),
deterministic seed + record/replay proof, and "The Descent" — the complete
playable roguelike assembling every system (procgen levels, FOV+fog, energy AI,
items/equipment/identification, status effects, depth, permadeath, score,
shareable seed). Mark the track COMPLETE.


# 2026-05-30 (pt.6) — Roguelike: Simulations tier — TRACK COMPLETE

Prompt: "Okay. Work on the next iteration." → final tier.

## Promote first

Packaged the Expert RPG systems into engine/rpg.js (Item/ItemWorld/mk*,
attackDice/defenseOf, addStatus/tickStatuses/hasStatus/statusText/speedOf,
applyConsumable, ACTION) — the dungeon.js-style "teach inline + lib copy" split
(Expert keeps its inline copies; rpg.js loaded ONLY on simulations.html, since
two `class Item` on one page = redeclaration error). 6 engine files now.

## Shipped this commit

simulations.html + simulations-demos.js, 4 demos. New (the lesson): caCave/
caStep/wallNeighbours (cellular caves), THEMES/themeForDepth/generateThemed.

1. cellularCaveDemo — animated noise→cave condensation (fill/iteration sliders),
   5-of-9 majority rule, keep-largest connectivity.
2. themesDemo — depth→recipe (rooms shallow, caves deep) + palette tint + mob table.
3. determinismDemo — record every keypress, replay from same seed, compare a
   state hash → bit-identical.
4. theDescentDemo (GRAND CAPSTONE) — complete permadeath roguelike: themed procgen
   floors (rooms→caves), FOV+fog, energy-scheduled LOS-aggro + Dijkstra-chase
   monsters (fast venomous snake, slow zombie, theme bestiary), floor loot +
   equip (1–9) + unidentified potions + status effects + derived-stat combat,
   descend via > to depth 8, score.

## Bug caught & fixed mid-iteration

Cave CA eroded to ~89% floor: the pure 8-neighbour ">=5" rule, at 45% fill,
drives wall density toward ~4% each pass. Fixed to the STABLE 5-of-9 majority
(count the 3x3 INCLUDING the centre) → caves settle at ~45-69% floor. Updated
the teaching code block + prose to match.

## Verification

`python3 -m http.server 8765`, simulations.html, console CLEAN throughout.
- Cave (post-fix): seeds 42/7/99/1337 → floor 47-69%, ALL regions==1 (connected).
- Themes: generateThemed d1→rooms, d5→cave; themeForDepth d1/d5/d9 =
  Upper Halls/The Caverns/The Deep; spawns walkable.
- Determinism: 8 recorded moves → "✓ bit-identical" (live hash == replay hash).
- Grand capstone (seed 1337, randomised play): found loot, EQUIPPED (atk die
  changed, [E] shown), 8 kills, took damage, DESCENDED to depth 3, permadeath
  with score 500. (Theme switch to Caverns is depth 4+, unit-verified via
  generateThemed; random-walker died at depth 3 first.)
- Screenshot: cellular cave settled (floor 69%, regions 1, connected ✓).

Indexes: roguelike/index.html (Simulations → Ready + nav; roadmap "all five
complete"), root index.html (Simulations TOC link + card "all 5 tiers"),
README.md (track fully shipped + Simulations tier + engine/rpg.js),
ARCHITECTURE.md (rpg.js = 6th engine file; the two promotion styles).

## Track total

5 tiers, 27 demos, 6 engine modules (seeded-rng, grid, actors, dungeon, vision,
rpg). From a hand-typed room + one rat to a complete, deterministic,
seed-shareable dungeon crawler — grid, turns, procgen (rooms/BSP/drunkard/CA),
recursive-shadowcasting FOV, fog of war, A*/Dijkstra pursuit, items/ECS,
equipment, status effects, identification, energy/speed scheduling, AI variety,
depth themes, permadeath, score. Determinism (RogueRng + fixed update order) was
the thread from the scaffold self-check to the replay verifier. Track COMPLETE.

## Next

Nothing on this track. Deferred: per-tier bundles-rl_*.js Export files (demos are
keyboard/canvas-driven, so they currently opt out of the Export button).

# 2026-05-31 — New track: Platformer (Celeste / Hollow Knight style) — scaffold

Plan and build a Platformer "character feel" track, prompted by two screenshots from
an earlier session (Celeste / Hollow Knight style; side-scroll platformer). Treat the
screenshots as inspiration only — add/change whatever makes it a comprehensive,
complete track. Decisions (via AskUserQuestion): scaffold-first then one tier per
commit; tier split at my best judgment (remap the screenshots into the repo's own
Beginner→Intermediate→Advanced→Expert→Simulations order, abilities in Advanced);
Simulations tier = Performance & Optimization (not speedrun frame-rules). This pass
ships the scaffold: platformer/index.html (landing + roadmap + self-check) and three
platformer/engine/ helpers (tilemap, physics/AABB-collision, input + fixed-timestep
loop). Keep both indexes + README + ARCHITECTURE consistent; verify console-clean
in-browser before the commit message.

# 2026-05-31 (pt.2) — Platformer: Beginner tier ("Ground & Gravity")

"Okay, work on the next iteration." → "Continue." — second iteration on the
platformer track, following the scaffold + one-tier-per-commit cadence. Ship the
Beginner tier: platformer/beginner.html + beginner-demos.js, 5 IIFE demos
(gravity/loop, per-axis collision, grounded+jump, run accel/friction, and the
"First Steps" mini-project), each adding exactly one idea on top of the scaffold
engine. Flip the landing-page Beginner card to Ready + add a Beginner nav button;
drop the "(coming soon)" marker on the root index Beginner sublink. Keep docs in
sync and verify console-clean in-browser before the commit message.

# 2026-05-31 (pt.3) — Platformer: Intermediate tier ("Game Feel")

"Okay, work on the next iteration." → "Continue." — third platformer iteration,
one tier per commit. Topics fixed by the landing-page Intermediate card. Ship
platformer/intermediate.html + intermediate-demos.js, 6 demos all driving one
configurable PlayerBody controller (coyote time, jump buffering, variable jump
height, apex hangtime + asymmetric gravity + fast-fall, corner correction, and a
player FSM with squash-and-stretch), capped by the "Feel Lab" raw-vs-juiced
mini-project. Flip the landing Intermediate card to Ready + nav buttons; drop the
"(coming soon)" marker on the root index Intermediate sublink. Console-test each
feel mechanic headlessly, keep docs in sync, verify console-clean before the
commit message.

# 2026-05-31 (pt.4) — Platformer: Advanced tier ("Abilities & Moving Geometry")

"Okay, work on the next iteration." ×3 → "Continue." — fourth platformer
iteration, one tier per commit. Topics fixed by the landing-page Advanced card.
Promote PlayerBody → engine/player.js (the actors.js move, Advanced = 2nd
consumer) and extend it with wall-slide/wall-jump + dash behind zeroable knobs + a
swappable resolve() hook. Teach the collision extensions inline in
advanced-demos.js: pfResolveWorld (SOLID + one-way + 45° slopes, top-level +
console-testable) and MovingPlatform/pfRidePlatforms. Six demos: wall, dash,
one-way, slope, moving platforms/conveyor, and "the Gauntlet" capstone. Flip the
landing Advanced card to Ready + nav buttons; drop the "(coming soon)" marker on
the root index Advanced sublink. Console-test the new algorithms headlessly, keep
docs in sync, verify console-clean before the commit message.

# 2026-05-31 (pt.5) — Platformer: Expert tier ("Camera, Parallax & Juice")

"Okay, work on the next iteration." — fifth platformer iteration, one tier per
commit. Topics fixed by the landing-page Expert card. Ship platformer/expert.html
+ expert-demos.js, 6 demos: a Camera class (follow + deadzone + look-ahead +
world clamp + trauma screen shake, taught inline, flagged for engine/camera.js),
parallax scrolling, particles (dust + landing puffs), an animation FSM drawn as
procedural limbs, and the "Juice Lab" capstone (a scrolling level with camera +
parallax + shake + particles + hitstop on toggles). Flip the landing Expert card
to Ready + nav buttons; drop the "(coming soon)" marker on the root index Expert
sublink. Console-test the Camera headlessly, keep docs in sync, verify
console-clean before the commit message.

# 2026-05-31 (pt.6) — Platformer: Simulations tier — TRACK COMPLETE

"Okay, work on the next iteration." — sixth and final platformer iteration. Topics
fixed by the landing-page Simulations card. Promote Camera → engine/camera.js (2nd
consumer = the capstone; move). Ship platformer/simulations.html +
simulations-demos.js, 5 demos: viewport culling, object pooling (ParticlePool),
broad-phase collision (SpatialGrid), chunked render caching (ChunkCache), and the
GRAND CAPSTONE "Summit" — the complete platformer composing every prior system +
the perf techniques + a goal & timer. Flip the landing Simulations card to Ready +
nav; drop the last "(coming soon)" marker; mark the track COMPLETE in indexes +
README + ARCHITECTURE. Console-test the new perf systems headlessly, verify
console-clean on both expert (post-camera-move) and simulations pages before the
commit message.

# 2026-06-01 — New track: Physics Puzzle — scaffold + Beginner tier

Plan a new **Physics Puzzle track** (Angry Birds / Cut the Rope / World of Goo style),
prompted by a screenshot proposing a tiered physics-puzzle arc — "Take inspiration from
this to create a plan but do not copy it as is. Add and change whatever is required to
make it a comprehensive and a complete game track." Confirmed via AskUserQuestion:
scaffold + Beginner first then one tier per commit; grand capstone named **"Rube"**.
Remap the screenshot's order into the repo's Beginner→Intermediate→Advanced→Expert→
Simulations and expand it. This pass: ship `physics-puzzle/` with a 3-module engine core
(`world.js` = `PZWorld` integrator + `PZBody`; `loop.js` = `pzLoop` + `pzInstallPointer`;
`render.js` = `PZ` palette + draw helpers; all `pz`/`PZ`-prefixed, reusing utils
`Vector2D`), the landing page with a scaffold self-check, and the full Beginner tier
"Launch & Land" (6 demos: world/gravity, restitution bounce, slingshot impulse,
trajectory prediction, circle–circle momentum, capstone "Knock-Down"). Collision taught
inline (`pzResolveStatic`/`pzResolveBlock`/`pzCollideCircles`) for later promotion to
`engine/collide.js`. Register in root index (nav + nested TOC, later tiers "coming
soon"), update README + ARCHITECTURE. Verify console-clean + unit-test the collision math
headlessly + script a slingshot drag on the capstone before the commit message.

# 2026-06-01 (pt.2) — Physics Puzzle: Intermediate tier "Ropes & Chains"

"Okay, work on the next iteration." — the Intermediate tier (Cut the Rope). Build it
pure **Verlet** (position-based): ship `physics-puzzle/intermediate.html` +
`intermediate-demos.js`, 6 demos — Verlet vs Euler, the distance constraint, building a
rope (iterations = stiffness), swinging for momentum, the cut (swipe/click severs a
constraint via `lineIntersection`), and the capstone "Deliver" (swing + cut a candy over
a shelf into the goal; Verlet payload-vs-wall = depenetration). Teach `PZVerletPoint`/
`PZConstraint` inline (promote to engine/constraints.js when Simulations reuses). Decision
made during build: Intermediate does NOT consume the Beginner `pzResolveStatic`, so that
resolver's promotion to engine/collide.js slips to Advanced (the real 2nd PZBody
consumer) — fix the forward-looking note in README + ARCHITECTURE. Flip the landing
Intermediate card to Ready + nav; link it from beginner.html (drop "coming next commit");
promote the root-index TOC sublink from "(coming soon)" to a real link. Verify
console-clean, unit-test the Verlet math headlessly, and script an end-to-end rope-cut on
the cut demo before the commit message.

# 2026-06-01 (pt.3) — Physics Puzzle: Advanced tier "Rigid Bodies & Joints"

"Okay, work on the next iteration." — the Advanced tier (World of Goo). Build a full
convex-polygon rigid-body engine INLINE in `advanced-demos.js` (Box2D-lite style):
`PZRigidBody` (rotation + moment of inertia), `pzPolyVsPoly` (SAT + face clipping →
contact manifold), `pzSolveManifold` (sequential impulses with `r × J` + Coulomb friction
+ Baumgarte bias), `PZJoint` (2×2 pivot constraint + break threshold), `pzStepWorld`.
Ship `physics-puzzle/advanced.html` + the 6 demos: rotation/torque, SAT detection,
impulse-with-rotation, resting stacks (friction + correction), breakable joint chains,
capstone "Contraption" (see-saw catapult → ball into goal). Decision during build: each
tier brings its own collision family, so the rigid family SUPERSEDES (doesn't reuse) the
Beginner circle solver; no promotion fires through Advanced (engine stays 3 modules) —
fix the README/ARCHITECTURE promotion notes. Hammer-test the solver headlessly
(rest/stack/joint/inertia), fix the capstone (was broken — plank tipped over; add a
rest-pillar + a basket goal zone, prove winnable by simulation). Flip the landing Advanced
card to Ready + nav, link from intermediate.html, promote the root-index TOC sublink.
Verify console-clean before the commit message. (Note: preview rAF is paused/bursty, so
the grab-drag can't be scripted — verify via synchronous physics sim.)

# 2026-06-01 (pt.4) — Physics Puzzle: Expert tier "Destruction & Debris"

"Okay, continue with the next iteration." — the Expert tier. First do the PROMOTION: the
rigid engine's 2nd consumer is here, so MOVE the whole rigid engine from inline
advanced-demos.js into engine/rigid.js (advanced.html + expert.html load it; advanced-demos.js
deletes its copy), and add `body.impact` (total normal impulse last step) for the
destruction tier to read. Ship physics-puzzle/expert.html + expert-demos.js, 6 demos:
impact thresholds, Voronoi pre-fracture (pzFractureBody via half-plane clipping), debris
pool, structural stress (colour by impact = load), juice (dust + trauma shake + hitstop),
capstone "Demolition" (wrecking-ball slingshot brings a brittle tower below a line). Watch
out for: the floor-top is H-6 not H-26; stacked blocks have big RESTING impact so don't use
an absolute break/juice threshold on them (use static targets / the thrown ball's impact /
contact-with-fast-ball); keep structures stable (trilithon for stress, brick wall for
demolish) — stability-test them. Flip the landing Expert card to Ready + nav, link from
advanced.html, promote the root-index TOC sublink. Verify console-clean + the Voronoi/stress
math synchronously before the commit message.

# 2026-06-01 (pt.5) — Physics Puzzle: Simulations tier (TRACK COMPLETE)

"Okay, work on the next iteration." / "continue" — the FINAL tier. First the PROMOTION: soft
bodies are the Verlet core's 2nd consumer, so MOVE PZVerletPoint/PZConstraint/pzStepRope/
pzVerletArena from intermediate-demos.js into engine/constraints.js (both pages load it;
engine → 5 modules). Ship physics-puzzle/simulations.html + simulations-demos.js, 6 demos:
spatial-hash broadphase, sleeping + island wake, pressure soft-body (closed Verlet mesh),
ragdoll (jointed PZRigidBody), particle fluid + buoyancy, and the grand capstone "Rube".
Lib-copy dust + pzFractureBody into the file. Watch out: heavy rigid bodies in a position-based
fluid explode (NaN) — only buoy light objects, and remove rigid bodies on water entry (splash);
use position-based relaxation for the fluid (velocity-repulsion collapses to a puddle). Make the
capstone reliably winnable (slingshot a ball into the tank, smashing a brittle Voronoi tower).
Flip the landing Simulations card to Ready + nav; link from expert.html; root-index TOC + "all 5
tiers"; mark the track COMPLETE in README + ARCHITECTURE. Verify physics synchronously (rAF is
paused in preview); note the *.js cache needs a ?v= bump to refetch. Then the commit message.

# 2026-06-01 (pt.6) — Fix the Grand Capstone "Rube"

"There seems to be something wrong with the Grand Capstone 'Rube' project. Can you check
once." — investigate + fix rubeDemo. Found 4 issues: (1) the win/splash check read `b.radius`
on the slingshot ball, but it's a PZRigidBody POLYGON with no `.radius` → NaN → the win never
fired; fixed by computing the bounding radius from the body's verts. (2) win fired in mid-air
(tested the tank box top, not the water) → test "touches a fluid particle". (3) slingshot
unplayable: anchor in the bottom-left corner with no room to pull + POWER too strong (shots hit
the ceiling) → moved the anchor to (100,250), POWER 12→8, and added a dotted trajectory preview.
(4) intro said "six shots" but code gave 5 → shots=6. Verify a comfortable aimed shot wins at
the water (no NaN); confirm live (preview arc + Splashdown). Keep the committed simulations.html
script tag clean (no ?v=).

# 2026-06-03 — Wire up the 5 missing Export buttons (beginner math track)

"Why do some examples like these not have the code export option? Only identify such
examples in the foundational guide." [screenshot of the Matrix Transformations demo] —
then clarified: "When I said foundational, I meant the beginner's guide to game math
track (beginner to simulation). You just looked into the beginner section." → "Okay,
implement the plan." Surveyed the whole math track (canvas count vs data-demo-id count):
intermediate/advanced/expert/simulation/simulation-v2 already 100% wired; only beginner
had gaps (11 demos, 6 buttons). The Export button (shared/export-demo.js) only attaches
to `<details data-demo-id data-deps>` AND needs the id registered in DEMO_CODE/DEMO_HTML.
Wired all 5 gaps: vectorPlayground + advancedVector + advancedTrig + matrix on existing
<details>, and a NEW <details> for vectorBasics (it had no code-reveal block). Authored 3
new DEMO_CODE+DEMO_HTML bundles (advancedVector/advancedTrig/matrix) adapted from
beginner-demos.js. Key gotcha — DEPENDENCY_BUNDLES is a hand-copied mirror of utils.js and
had drifted: added the missing Vector2D.project/.reflect and a new matrix2d bundle
(transformPoint returns Vector2D → vector2d must precede matrix2d in data-deps). Verified
in real Chromium: 11 buttons, all 5 exports run with zero errors + render (incl. the new
project/reflect and Matrix2D paths); screenshot-confirmed the matrix export. Then the
commit message.

# 2026-06-03 (pt.2) — Fix the real issues from the edge-case review

"For all the five above edge cases and suggested tests, see if it's feasible implementing them."
→ then: "Ok, don't add any tests but see if you can fix issues that were mentioned." Triaged the 5
review items: #2 (TS→JS fallback) and #4 (no-mouse NaN) are non-bugs (graceful by design / already
guarded). Fixed the other three: (1) completed the vector2d/matrix2d dependency-bundle mirror vs
utils.js (added static subtract, distanceSquared, setLength, divide zero-warn, Matrix2D.copy) —
preventive, since none were called by a current export, verified 0 drift via a throwaway
getOwnPropertyNames compare; (2) added a clipboard fallback in export-demo.js (copyTextToClipboard:
async Clipboard API → hidden textarea + execCommand('copy')) so Export works on file://; (3) fixed
the advancedTrig FOV bug in both synced copies (beginner-demos.js + demo-bundles.js) — the enemy
snapped to face the cursor so the cone never gated detection; replaced with an independent sweep
(enemy.angle += 0.01). Verified in Chromium (FOV in-cone true/out-cone false vs old both-true;
exports regen clean; clipboard API+fallback+both-fail paths). Then the commit message.


# 2026-06-03 (pt.3) — New track: Bullet Hell / Danmaku

[two reference screenshots: "2. Bullet Hell / Shoot-'em-Up — Touhou / Cave style" and
"3. Bullet Hell / Twin-Stick — the combat track", describing pattern math, pooled projectiles,
spatial hash, graze & hitbox precision, juice & feedback]
"This is one of the game tracks suggested in an earlier session. Take inspiration from it to
create a plan, but do not copy it as is. Add and change whatever is required to make it
comprehensive and complete."

Clarifications answered during planning:
- Genre framing → Vertical danmaku (Touhou/Cave).
- Simulations finale → Both tooling + spectacle (pattern editor + deterministic replay +
  hitstop/juice AND a multi-phase boss-rush capstone).

Plan approved (plan file ~/.claude/plans/this-is-one-dynamic-snowglobe.md); delivery is iterative,
one tier per pass. Pass 1 (scaffold: bullet-hell/engine/ 3 modules + track-index self-check + root
index/README/ARCHITECTURE wiring) shipped and verified this session — see memory/2026-06-03.md pt.3.

Passes 2–6 each driven by the prompt "Okay, work on the next iteration." (one tier per pass,
verified in-browser with a commit message at the end of each):
- Pass 2 — Beginner ("One Ship, One Bullet", 6 demos). memory pt.4.
- Pass 3 — Intermediate ("Patterns Are Polar Equations", 7 demos). memory pt.5.
- Pass 4 — Advanced ("The Boss Fight", 6 demos; BHEmitter → engine/emitter.js). memory pt.6.
- Pass 5 — Expert ("Ten Thousand Bullets", 6 demos; SoA/pool/hash taught inline, not in the engine).
  memory pt.7.
- Pass 6 — Simulations FINALE ("Danmaku", 6 demos; BHBoss+BHSpellCard → engine/boss.js). memory pt.8.
🎉 TRACK COMPLETE — 5 tiers, 31 demos, 5 engine modules (loop/render/field/emitter/boss).

---

## Tower Defense track (Kingdom Rush / Bloons style)

Prompt: a prior-session screenshot sketch of a "Tower Defense Track" (Kingdom Rush /
Bloons style) — "Use it as an inspiration to create a plan, but do not copy it as is.
Add and change whatever is required to make it comprehensive and complete." The genre
is the applied home for the Fundamentals' flow fields + A* (today only demos).

Confirmed with user: cover **both** styles (Kingdom Rush fixed lanes + Bloons open-field/
maze); build **scaffold-first, then one tier per commit**. Tiers remapped into the repo's
strict B→I→A→E→S order (hard pathfinding → Advanced, scale → Expert, whole game + balancing
dashboards → Simulations). Plan file: `~/.claude/plans/this-is-a-soft-sundae.md`.

Build passes (each verified in-browser, console clean, with a commit message at the end):
- Pass 1 — SCAFFOLD: `tower-defense/engine/{loop,render,world}.js` (`tdLoop`/`tdInstall*`;
  `TD` palette + `tdDraw*`; `TDGrid` buildability + `TDPath` arc-length route), the track
  `index.html` landing page + scaffold self-check, and root `index.html` nav-button + TOC.
  Self-check caught & fixed a `blockAlongPath` rasterization bug (stamp the cells a segment
  crosses, not just its vertices). memory 2026-06-04.
- Pass 2 — Beginner ("The Path & The Tower", 6 demos; TDTower/TDEnemy/TDProjectile +
  tdPickTarget inline, console-tested; capstone "First Line of Defense"). memory 2026-06-04 pass 2.
- Pass 3 — Intermediate ("Tower Types & Targeting", 7 demos; entities + tdDrawPop PROMOTED →
  engine/entities.js + engine/render.js; lead-the-target intercept quadratic; capstone "Choke
  Point"). memory 2026-06-04 pass 3.
- Pass 4 — Advanced ("Mazing, Flow Fields & Sight", 6 demos; tdAStar/tdBlocksPath/tdFlowField/
  tdLineOfSight inline top-level + console-tested; maze creeps reuse TDEnemy on A*-TDPath, flow
  creeps are an inline open-field model; capstone "Build Your Maze"). memory 2026-06-04 pass 4.
- Pass 5 — Expert ("Ten Thousand Creeps", 6 demos; nav → engine/nav.js [5th module]; TDPool/
  TDSwarm-SoA/TDSpatialHash inline; capstone "Swarm" verified ~7,600 creeps @ 1.7ms/frame).
  memory 2026-06-04 pass 5.
- Pass 6 — Simulations FINALE ("The Whole Game & Balancing", 6 demos; seeded tdRng determinism +
  tdGenerateWave curve + economy/upgrade/synergy/DPS-dashboard/threat-heatmap; grand capstone "The
  Last Stand" — seeded 12-wave maze-TD). memory 2026-06-04 pass 6.
🎉 TRACK COMPLETE — 5 tiers, 31 demos (6/7/6/6/6), 5 engine modules (loop/render/world/entities/nav).
