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
