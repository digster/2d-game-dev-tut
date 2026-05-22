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
