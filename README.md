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
  See `shaders/index.html` for the track roadmap. The Beginner (Shader
  Foundations), Intermediate (Patterns, Noise & Distortion), Expert
  (Textures & Sprite Shaders), and Advanced (Multi-Pass & Post-Processing)
  tiers are shipped; later tiers land iteratively. WebGL1 + GLSL ES 1.00
  throughout, with the Advanced tier additionally showing every effect in
  WebGL2 + GLSL ES 3.00. Demo IDs and helper bundles are prefixed `sh_`.

## Shared assets

All pages load CSS and JS from `shared/`:

- `shared/styles.css` — single source of truth for theme and layout
- `shared/utils.js` — `Vector2D`, `Matrix2D`, canvas helpers
- `shared/code-tabs.js` — JavaScript / TypeScript tab toggle inside code blocks
- `shared/export-demo.js` + `shared/demo-bundles*.js` — export-demo feature
