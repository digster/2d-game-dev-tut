// ===================================
// EXPORT DEMO FEATURE
// Generates standalone HTML files from code examples.
// Language-aware: exports JS or TS based on the active code tab.
// TS exports embed Sucrase to strip types at runtime in the browser.
// ===================================

const SUCRASE_CDN = 'https://unpkg.com/sucrase@3.34.0/dist/browser/sucrase.min.js';

/**
 * Expand a list of dependency names into its full transitive closure.
 *
 * A dependency can declare what *other* dependencies its source body calls by
 * adding an entry to the optional global `window.DEPENDENCY_REQUIRES`
 * (e.g. `DEPENDENCY_REQUIRES.pickTileFromMouse = ['isoToCart']`). The resolver
 * does a post-order depth-first walk so a dependency's requirements are always
 * emitted *before* it (callee-before-caller — matters for `const` palettes that
 * other top-level code reads), de-duplicates (a `class` reached twice would
 * otherwise be a redeclaration error), and is cycle-safe (`seen` is marked on
 * entry).
 *
 * Fully backward compatible: a dependency with no `DEPENDENCY_REQUIRES` entry
 * is treated as a leaf, so a `deps` list that is already a complete closure
 * (every requirement already precedes its dependant — as hand-written
 * `data-deps` strings are) resolves to the identical ordered list. The registry
 * is therefore a safety net + retroactive fix, not a behavioural change.
 *
 * @param {string[]} deps - Requested dependency names (original order preserved)
 * @returns {string[]}     - Full closure, requirements first, de-duplicated
 */
function resolveDepClosure(deps) {
    const REQ = (typeof DEPENDENCY_REQUIRES !== 'undefined') ? DEPENDENCY_REQUIRES : {};
    const seen = new Set();
    const ordered = [];
    function visit(name) {
        if (seen.has(name)) return;
        seen.add(name);
        const reqs = REQ[name] || [];
        for (const r of reqs) visit(r);   // requirements before the dependant
        ordered.push(name);
    }
    for (const d of deps) visit(d);
    return ordered;
}

/**
 * Generates a complete, self-contained HTML file for a demo.
 * @param {string} demoId - The demo identifier (e.g., 'raycasting')
 * @param {string[]} deps  - Dependency names (e.g., ['vector2d', 'clearCanvas'])
 * @param {'js'|'ts'} lang - Active language tab
 * @returns {string|null}  - HTML document, or null if the demo is missing
 */
function generateStandaloneHTML(demoId, deps, lang) {
    const config = (typeof DEMO_HTML !== 'undefined') ? DEMO_HTML[demoId] : null;
    if (!config) {
        console.error(`Demo '${demoId}' not found in DEMO_HTML`);
        return null;
    }

    // Pick the right code/dep tables for this language. If a TS bundle
    // for this specific demo (or dependency) hasn't been authored yet,
    // fall back per-entry to the JS version so the export still works.
    let demoCode = (lang === 'ts' && typeof DEMO_CODE_TS !== 'undefined') ? DEMO_CODE_TS[demoId] : undefined;
    let effectiveLang = lang;
    if (!demoCode) {
        if (lang === 'ts') {
            console.info(`No TS bundle for demo '${demoId}', falling back to JS for export.`);
            effectiveLang = 'js';
        }
        demoCode = DEMO_CODE[demoId];
    }
    if (!demoCode) {
        console.error(`Demo '${demoId}' not found in DEMO_CODE`);
        return null;
    }

    const depTable = (effectiveLang === 'ts' && typeof DEPENDENCY_BUNDLES_TS !== 'undefined') ? DEPENDENCY_BUNDLES_TS : DEPENDENCY_BUNDLES;
    // Expand to the full transitive closure so authors only need to list a
    // demo's *direct* deps; helpers pull in their own requirements. No-op for
    // already-complete lists (see resolveDepClosure docs) → backward compatible.
    const depCode = resolveDepClosure(deps)
        .map(d => depTable[d] || DEPENDENCY_BUNDLES[d])    // per-dep fallback to JS
        .filter(Boolean)
        .join('\n\n');

    // Re-bind lang for the rest of the generator so the script block,
    // badge, and label all reflect the language we actually have code for.
    lang = effectiveLang;

    const controlsHTML = config.controls
        .map(c => `<button id="${c.id}">${c.text}</button>`)
        .join('\n            ');

    // The runnable script section depends on language:
    //   - JS: regular <script> with the JS source inline (works as before).
    //   - TS: an inert <script type="text/typescript"> source block plus
    //         a small bootstrap that loads Sucrase, strips types, and runs.
    const scriptBlock = (lang === 'ts')
        ? `<!-- TypeScript source (kept verbatim for readability) -->
    <script type="text/typescript" id="ts-source">
// ========== Dependencies (TypeScript) ==========
${depCode}

// ========== Demo Code (TypeScript) ==========
${demoCode}
    </script>

    <!-- Bootstrap: fetch Sucrase, strip TS types, evaluate. -->
    <script>
    (function () {
        const tsSrc = document.getElementById('ts-source').textContent;
        const s = document.createElement('script');
        s.src = '${SUCRASE_CDN}';
        s.onload = function () {
            try {
                const out = window.Sucrase.transform(tsSrc, { transforms: ['typescript'] });
                // eslint-disable-next-line no-new-func
                new Function(out.code)();
            } catch (e) {
                console.error('TypeScript transform failed:', e);
                document.body.insertAdjacentHTML('beforeend',
                    '<pre style="color:#ff7b72;background:#0d1117;padding:16px;border-radius:8px;">'
                    + 'TS compile error: ' + (e && e.message ? e.message : String(e)) + '</pre>');
            }
        };
        s.onerror = function () {
            console.error('Failed to load Sucrase from CDN');
        };
        document.head.appendChild(s);
    })();
    </script>`
        : `<script>
// ========== Dependencies ==========
${depCode}

// ========== Demo Code ==========
${demoCode}
    </script>`;

    const langLabel = lang === 'ts' ? 'TypeScript' : 'JavaScript';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: #0a0e27;
            color: #e0e0e0;
            font-family: system-ui, -apple-system, sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        }
        h2 { color: #4fc3f7; margin-bottom: 20px; }
        canvas {
            border: 2px solid #4fc3f7;
            background: #0d1117;
            border-radius: 8px;
            cursor: crosshair;
        }
        .controls {
            margin: 15px 0;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
        }
        button {
            background: #4fc3f7;
            color: #0a0e27;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.2s;
        }
        button:hover { background: #29b6f6; transform: translateY(-2px); }
        #info { color: #8b949e; font-size: 0.95em; margin-top: 10px; }
        .footer { margin-top: 30px; color: #555; font-size: 0.85em; }
        .footer a { color: #4fc3f7; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .lang-badge {
            display: inline-block;
            margin-left: 10px;
            padding: 2px 8px;
            border-radius: 4px;
            background: ${lang === 'ts' ? '#3178c6' : '#f7df1e'};
            color: ${lang === 'ts' ? '#ffffff' : '#000000'};
            font-size: 0.7em;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <h2>${config.title}<span class="lang-badge">${langLabel}</span></h2>
    <canvas id="canvas" width="${config.canvas.width}" height="${config.canvas.height}"></canvas>
    <div class="controls">
        ${controlsHTML}
    </div>
    <div id="info">${config.info}</div>
    <div class="footer">
        Exported from <a href="https://github.com/your-repo/2d-game-dev-tut">Game Dev Math Guide</a>
    </div>

    ${scriptBlock}
</body>
</html>`;
}

/**
 * Copy text to the clipboard with a graceful fallback.
 *
 * Prefers the async Clipboard API, which requires a *secure context*
 * (https:// or localhost). When that's unavailable — most commonly when the
 * guide is opened directly from disk via `file://` — it falls back to a hidden
 * `<textarea>` + the legacy `document.execCommand('copy')`. The fallback still
 * works because this runs synchronously inside the Export button's click
 * (a user gesture), which `execCommand('copy')` requires.
 *
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} true if the copy succeeded by either path.
 */
async function copyTextToClipboard(text) {
    // Preferred path: async Clipboard API in a secure context.
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Permission denied / blocked — fall through to the legacy path.
            console.warn('Clipboard API failed, trying execCommand fallback:', err);
        }
    }

    // Legacy fallback: works on file:// and older browsers.
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';   // avoid scrolling to the bottom
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (err) {
        console.error('Clipboard fallback failed:', err);
        return false;
    }
}

/**
 * Injects export buttons into code sections with data-demo-id attributes.
 */
function initExportButtons() {
    document.querySelectorAll('details[data-demo-id]').forEach(details => {
        const demoId = details.dataset.demoId;
        const deps = (details.dataset.deps || '').split(',').filter(Boolean);
        const summary = details.querySelector('summary');
        if (!summary) return;

        const btn = document.createElement('button');
        btn.className = 'export-demo-btn';
        btn.innerHTML = '📋 Export';
        btn.title = 'Copy complete working demo to clipboard (uses the active JS/TS tab)';

        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Look up the active language for this details block.
            const lang = (typeof window.getActiveLang === 'function')
                ? window.getActiveLang(details)
                : 'js';

            try {
                const html = generateStandaloneHTML(demoId, deps, lang);
                if (!html) {
                    btn.innerHTML = '✗ Not found';
                    setTimeout(() => btn.innerHTML = '📋 Export', 2000);
                    return;
                }

                const copied = await copyTextToClipboard(html);
                if (!copied) {
                    btn.innerHTML = '✗ Error';
                    setTimeout(() => btn.innerHTML = '📋 Export', 2000);
                    return;
                }
                btn.innerHTML = lang === 'ts' ? '✓ Copied (TS)!' : '✓ Copied (JS)!';
                btn.classList.add('success');
                setTimeout(() => {
                    btn.innerHTML = '📋 Export';
                    btn.classList.remove('success');
                }, 2000);
            } catch (err) {
                console.error('Export failed:', err);
                btn.innerHTML = '✗ Error';
                setTimeout(() => btn.innerHTML = '📋 Export', 2000);
            }
        };

        summary.appendChild(btn);
    });
}

document.addEventListener('DOMContentLoaded', initExportButtons);
