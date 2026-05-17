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
