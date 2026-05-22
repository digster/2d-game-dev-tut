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

### Game Tracks (end-to-end tutorials)

Vertical tracks that compose the fundamentals into a working game. Each track lives in its
own subdirectory with a per-tier file structure mirroring the Fundamentals layout.

- `isometric-strategy/` — build an AoE2 / Red Alert 2 style isometric RTS.
  See `isometric-strategy/index.html` for the track roadmap. Currently scaffolded;
  tier files are landing iteratively.
- `voxel-worlds/` — learn 2D voxel worlds and manipulation, Terraria-style.
  See `voxel-worlds/index.html` for the track roadmap. This track is unique in
  having **two sub-tracks**, each its own nested subdirectory with its own
  five-/three-tier file structure: `voxel-worlds/terraria/` (tile-grid voxels —
  block-discrete, player-edited) and `voxel-worlds/noita/` (cellular-pixel
  voxels — every pixel self-simulates). Currently scaffolded; the Terraria
  **Beginner, Intermediate, Expert and Advanced tiers are shipped** (4 of 5).
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
  + A* hunter + day/night + lighting). The Noita sub-track index deliberately
  covers only concepts *not* in Terraria. Demo IDs and helper bundles are
  prefixed `vox_`.
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

## Shared assets

All pages load CSS and JS from `shared/`:

- `shared/styles.css` — single source of truth for theme and layout
- `shared/utils.js` — `Vector2D`, `Matrix2D`, canvas helpers
- `shared/code-tabs.js` — JavaScript / TypeScript tab toggle inside code blocks
- `shared/export-demo.js` + `shared/demo-bundles*.js` — export-demo feature
