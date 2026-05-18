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
