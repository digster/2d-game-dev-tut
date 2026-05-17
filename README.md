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
  See `shaders/index.html` for the track roadmap. **Fully shipped — all 5
  tiers:** Beginner (Shader Foundations), Intermediate (Patterns, Noise &
  Distortion), Expert (Textures & Sprite Shaders), Advanced (Multi-Pass &
  Post-Processing), Simulations (GPU Compute-Style Effects). WebGL1 + GLSL
  ES 1.00 through Expert; Advanced shows every effect in WebGL1 *and* WebGL2;
  Simulations is WebGL2 + GLSL ES 3.00 with `RGBA16F` float textures
  (`EXT_color_buffer_float`, with graceful degradation). Demo IDs and helper
  bundles are prefixed `sh_`. Each tier was later expanded with extra
  examples: Beginner (2D transforms, polar coords, SDF boolean combine),
  Intermediate (gradient/Perlin noise, Voronoi, flow & scrolling), Expert
  (2D normal-map lighting, sprite-sheet animation, dither/posterize),
  Advanced (scene transitions, radial blur & god rays, pixelation — each in
  WebGL1 + WebGL2), Simulations (falling-sand Margolus CA, boids/flocking,
  2D wave equation).

## Shared assets

All pages load CSS and JS from `shared/`:

- `shared/styles.css` — single source of truth for theme and layout
- `shared/utils.js` — `Vector2D`, `Matrix2D`, canvas helpers
- `shared/code-tabs.js` — JavaScript / TypeScript tab toggle inside code blocks
- `shared/export-demo.js` + `shared/demo-bundles*.js` — export-demo feature
