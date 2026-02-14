document.addEventListener('DOMContentLoaded', () => {
    const controls = document.querySelectorAll('.view-btn, .toggle-btn, .btn.toggle-btn, .btn[data-target], a.btn[href^="#"]');
    const panelsSelector = '.resource-content, .expandable';
    const getAllPanels = () => Array.from(document.querySelectorAll(panelsSelector));

    // hide panels initially
    getAllPanels().forEach(p => {
        p.style.display = 'none';
        p.classList.remove('expanded');
    });

    function hidePanel(panel) {
        if (!panel) return;
        panel.style.display = 'none';
        panel.classList.remove('expanded');
        const id = panel.id;
        if (id) {
            const btns = document.querySelectorAll(
                `[data-target="#${id}"], [data-target="${id}"], a[href="#${id}"], a[href="${id}"]`
            );
            btns.forEach(b => b.setAttribute('aria-expanded', 'false'));
        }
    }

    function showPanel(panel, opener) {
        if (!panel) return;
        // close others
        getAllPanels().forEach(p => { if (p !== panel) hidePanel(p); });

        // move panel after the clicked resource-card so it pushes following cards down
        try {
            const card = opener && opener.closest && opener.closest('.resource-card');
            if (card) card.insertAdjacentElement('afterend', panel);
        } catch (err) { /* ignore */ }

        panel.style.display = 'block';
        panel.classList.add('expanded');
        if (opener) opener.setAttribute('aria-expanded', 'true');
    }

    controls.forEach(ctrl => {
        ctrl.addEventListener('click', (e) => {
            const href = ctrl.getAttribute('href');
            // prevent navigation for in-page anchors
            if (href && href.startsWith('#')) e.preventDefault();

            e.stopPropagation();

            let target = ctrl.dataset.target || ctrl.getAttribute('data-panel') || href || ctrl.getAttribute('href');
            if (!target) return;

            // normalize to selector string
            if (!target.startsWith('#')) target = '#' + target.replace(/^#/, '');

            let panel = null;
            try { panel = document.querySelector(target); } catch (err) { /* ignore invalid */ }
            if (!panel) {
                // fallback: next sibling panel
                let sib = ctrl.nextElementSibling;
                while (sib) {
                    if (sib.matches && sib.matches(panelsSelector)) { panel = sib; break; }
                    sib = sib.nextElementSibling;
                }
            }
            if (!panel) return;

            const visible = window.getComputedStyle(panel).display !== 'none';
            if (visible) hidePanel(panel);
            else showPanel(panel, ctrl);
        });
    });

    // click outside closes open panels
    document.addEventListener('click', (e) => {
        if (e.target.closest && (e.target.closest('.resource-card, .view-btn, .toggle-btn, .btn.toggle-btn') || e.target.closest(panelsSelector))) {
            return;
        }
        getAllPanels().forEach(hidePanel);
    });

    // support close buttons inside panels
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest && e.target.closest('.close-panel');
        if (!closeBtn) return;
        const panel = closeBtn.closest && closeBtn.closest(panelsSelector);
        if (!panel) return;
        hidePanel(panel);
    });
});