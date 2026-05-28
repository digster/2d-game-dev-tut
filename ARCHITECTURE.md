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
go in `shared/`.

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
