// =============================================================================
// shared/lazy-demo.js — lazy WebGL demo mounting + context teardown
// =============================================================================
// Pages in the shaders track place many interactive WebGL demos on one long
// scroll. Each demo's harness (makeShaderToy / makeFXChain / makeSim) acquires
// its own WebGL context eagerly at load. Browsers cap simultaneous WebGL
// contexts at ~16 and silently EVICT THE OLDEST when exceeded, leaving the
// first demos on the page rendering a dead/black canvas.
//
// `lazyToy` fixes that: a demo's harness is only created while its canvas is
// on screen, and is fully torn down (GL objects deleted + WEBGL_lose_context)
// when it scrolls away. So a page never holds more than the ~1–4 contexts that
// are actually visible.
//
// IMPORTANT WebGL constraint: a <canvas> element is bound to ONE WebGL context
// for its entire lifetime — once a context is lost, getContext() on that same
// canvas keeps returning the dead one; you cannot create a fresh context on it.
// So on tear-down we also REPLACE the <canvas> with a fresh clone (same id /
// size / classes), and the factory receives the *current* canvas to build on.
//
// Drop-in: replace
//     const toy = makeShaderToy(canvas, FRAG, { info });
// with
//     const toy = lazyToy(canvas, (cv) => makeShaderToy(cv, FRAG, { info }));
// (The factory MUST use its `cv` argument, not an outer `canvas`, because the
// element is swapped on every unmount.) Nothing else in the demo changes —
// the returned object mirrors the harness API
// (setFrag/setParam/setPaused/setTimeScale/rebuild/rebuildChain/reset/stop/
// destroy); button handlers attach ONCE to this stable proxy. The last call to
// each mutator is recorded and REPLAYED after a re-mount so button-driven
// visual state survives a scroll-away/scroll-back.
//
// Standalone Exports do NOT load this file — they have a single, always-visible
// canvas (one context), so they keep mounting eagerly. Harnesses still expose
// the additive `destroy()` for this wrapper to call; `stop()` is unchanged.
// =============================================================================

// Mutator methods the shaders harnesses expose. Recorded + replayed on remount.
// (Superset across makeShaderToy / makeFXChain / makeSim — a harness simply
// won't have the ones it doesn't implement; forwarding is guarded.)
var LAZY_DEMO_METHODS = ['setFrag', 'setParam', 'setPaused', 'setTimeScale',
                         'rebuild', 'rebuildChain', 'reset'];

function lazyToy(canvas, factory) {
    var currentCanvas = canvas;  // swapped for a fresh clone on every unmount
    var live = null;             // the real harness handle while mounted, else null
    var lastCalls = {};          // method name -> last args array
    var order = [];              // method names, first-seen order (replay order)

    function record(name, args) {
        if (!(name in lastCalls)) order.push(name);
        lastCalls[name] = args;
    }

    // Re-apply the last call to each mutator so a re-mounted demo looks exactly
    // as the user left it (e.g. last setFrag / chosen preset / param).
    function replay() {
        for (var i = 0; i < order.length; i++) {
            var n = order[i];
            if (live && typeof live[n] === 'function') {
                try { live[n].apply(live, lastCalls[n]); } catch (e) { /* harness no-op tolerated */ }
            }
        }
    }

    function mount() {
        if (live) return;
        try { live = factory(currentCanvas) || null; }
        catch (e) { console.error(e); live = null; }
        if (live) replay();
    }

    function unmount() {
        if (!live) return;
        try {
            if (typeof live.destroy === 'function') live.destroy();
            else if (typeof live.stop === 'function') live.stop();
        } catch (e) { /* ignore teardown errors */ }
        live = null;
        // The old canvas is now permanently tied to a lost context. Swap in a
        // fresh clone (attributes — id/width/height/class — copied; canvas has
        // no children) so the next mount can create a brand-new context.
        if (currentCanvas.parentNode) {
            var fresh = currentCanvas.cloneNode(false);
            currentCanvas.parentNode.replaceChild(fresh, currentCanvas);
            if (observer) observer.unobserve(currentCanvas);
            currentCanvas = fresh;
            if (observer) observer.observe(currentCanvas);
        }
    }

    // Stable proxy: every mutator records its latest args + forwards if mounted.
    var proxy = {};
    LAZY_DEMO_METHODS.forEach(function (name) {
        proxy[name] = function () {
            var args = Array.prototype.slice.call(arguments);
            record(name, args);
            if (live && typeof live[name] === 'function') {
                return live[name].apply(live, args);
            }
        };
    });
    proxy.stop = function () { if (live && typeof live.stop === 'function') live.stop(); };
    proxy.destroy = function () { if (observer) observer.disconnect(); unmount(); };

    var observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
        // rootMargin gives a head-start so the demo is already running by the
        // time it scrolls into view (no visible pop-in).
        observer = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) mount();
                else unmount();
            }
        }, { root: null, rootMargin: '300px 0px', threshold: 0 });
        observer.observe(currentCanvas);
    } else {
        // No IntersectionObserver (very old browsers): behave like before —
        // mount eagerly, never unmount. No worse than the pre-fix code.
        mount();
    }

    return proxy;
}
