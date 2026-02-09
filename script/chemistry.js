// Toggle/display expandable containers when "view" buttons are clicked.
// Expected HTML patterns (examples):
// 1) Button references a selector: <button class="view-btn" data-target="#panel1">View</button>
//    Panel: <div id="panel1" class="expandable" style="display:none">...</div>
// 2) Or button is immediately before the panel: <button class="view-btn">View</button><div class="expandable" style="display:none">...</div>

document.addEventListener('DOMContentLoaded', () => {
    // accept multiple possible button classes used in the project
    const viewButtons = document.querySelectorAll('.view-btn, .toggle-btn, .btn.toggle-btn');
    const panelsSelector = '.expandable, .resource-content';

    const getAllPanels = () => Array.from(document.querySelectorAll(panelsSelector));

    // Hide all panels initially so they open (and push content down) when a button is clicked
    getAllPanels().forEach(p => {
        // ensure hidden even if CSS isn't set
        p.style.display = 'none';
        p.classList.remove('expanded');
    });

    function hidePanel(panel) {
        if (!panel) return;
        panel.style.display = 'none';
        panel.classList.remove('expanded');
        // update any associated opener button aria state
        const id = panel.id;
        if (id) {
            const buttons = document.querySelectorAll(
                `.view-btn[data-target="#${id}"], .view-btn[data-target="${id}"], .view-btn[data-panel="${id}"],` +
                `.toggle-btn[data-target="#${id}"], .toggle-btn[data-target="${id}"], .toggle-btn[data-panel="${id}"],` +
                `.btn.toggle-btn[data-target="#${id}"], .btn.toggle-btn[data-target="${id}"], .btn.toggle-btn[data-panel="${id}"]`
            );
            buttons.forEach(b => b.setAttribute('aria-expanded', 'false'));
        } else {
            // fallback: if opener is previous sibling, update it
            const prev = panel.previousElementSibling;
            if (prev && prev.matches && prev.matches('.view-btn, .toggle-btn, .btn.toggle-btn')) {
                prev.setAttribute('aria-expanded', 'false');
            }
        }
    }

    function showPanel(panel, openerBtn) {
        if (!panel) return;
        // close others so only one is open and content below is displaced
        getAllPanels().forEach(p => { if (p !== panel) hidePanel(p); });

        // place the panel directly after the clicked card so it pushes following cards down
        try {
            const card = openerBtn && openerBtn.closest && openerBtn.closest('.resource-card');
            if (card) card.insertAdjacentElement('afterend', panel);
        } catch (err) { /* ignore DOM insertion errors */ }

        panel.style.display = 'block';
        panel.classList.add('expanded');
        if (openerBtn) openerBtn.setAttribute('aria-expanded', 'true');
    }

    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent global click handler from immediately closing
            const dataTarget = btn.getAttribute('data-target') || btn.dataset.target;
            let panel = null;

            if (dataTarget) {
                try { panel = document.querySelector(dataTarget); } catch (err) { /* ignore invalid selector */ }
                if (!panel) panel = document.querySelector(`[data-panel="${dataTarget}"]`) || document.getElementById(dataTarget);
            }

            if (!panel) {
                // fallback: find next sibling panel with known classes
                let sibling = btn.nextElementSibling;
                while (sibling) {
                    if (sibling.matches && sibling.matches(panelsSelector)) { panel = sibling; break; }
                    sibling = sibling.nextElementSibling;
                }
            }

            if (!panel) return;

            const isVisible = window.getComputedStyle(panel).display !== 'none';
            if (isVisible) hidePanel(panel);
            else showPanel(panel, btn);
        });
    });

    // Close all open panels when clicking outside panels or buttons
    document.addEventListener('click', (e) => {
        if (e.target.closest && (e.target.closest('.view-btn, .toggle-btn, .btn.toggle-btn') || e.target.closest(panelsSelector))) {
            return; // click was on a control or inside a panel -> do nothing
        }
        getAllPanels().forEach(hidePanel);
    });

    // Optional: support close buttons inside panels with class "close-panel"
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest && e.target.closest('.close-panel');
        if (!closeBtn) return;
        const panel = closeBtn.closest && closeBtn.closest(panelsSelector);
        if (!panel) return;
        hidePanel(panel);
    });
});