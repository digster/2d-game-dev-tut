// ===================================
// CODE TABS (JavaScript / TypeScript)
// - Adds click handling for the tab strip injected into every
//   .code-container[data-code-tabs].
// - Lazily re-runs Prism on TS panes the first time they are shown
//   (Prism only auto-highlights elements present on initial load).
// - Exposes getActiveLang(detailsEl) for the export-demo feature.
// ===================================

(function () {
    // Highlight a <code> element once, marking it so we don't repaint.
    function highlightOnce(codeEl) {
        if (!codeEl || codeEl.dataset.highlighted === 'true') return;
        if (typeof Prism !== 'undefined' && typeof Prism.highlightElement === 'function') {
            Prism.highlightElement(codeEl);
        }
        codeEl.dataset.highlighted = 'true';
    }

    // Switch the active language inside one .code-container.
    function activateLang(container, lang) {
        const tabs = container.querySelectorAll(':scope > .code-tabs > .code-tab');
        const panes = container.querySelectorAll(':scope > .code-pane');

        tabs.forEach(tab => {
            const isActive = tab.dataset.lang === lang;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panes.forEach(pane => {
            const isActive = pane.dataset.lang === lang;
            pane.classList.toggle('active', isActive);
            if (isActive) {
                // Highlight TS (or JS) the first time it becomes visible.
                highlightOnce(pane.querySelector('code'));
            }
        });
    }

    // Public helper used by export-demo.js — finds the language of the
    // code-container nearest to the clicked details element.
    window.getActiveLang = function (detailsEl) {
        if (!detailsEl) return 'js';
        const container = detailsEl.querySelector('.code-container[data-code-tabs]');
        if (!container) return 'js';
        const activeTab = container.querySelector(':scope > .code-tabs > .code-tab.active');
        return activeTab ? (activeTab.dataset.lang || 'js') : 'js';
    };

    // Single delegated click handler for every tab on the page.
    document.addEventListener('click', (e) => {
        const tab = e.target.closest('.code-tab');
        if (!tab) return;
        const container = tab.closest('.code-container[data-code-tabs]');
        if (!container) return;
        e.preventDefault();
        e.stopPropagation();    // don't toggle the surrounding <details>
        activateLang(container, tab.dataset.lang);
    });

    // First-paint Prism pass for the JS panes that are visible by default.
    // (Prism's auto-init handles language-javascript already, but this
    // guards against any container that started with TS active.)
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.code-container[data-code-tabs]').forEach(container => {
            const activePane = container.querySelector(':scope > .code-pane.active');
            if (activePane) highlightOnce(activePane.querySelector('code'));
        });
    });
})();
