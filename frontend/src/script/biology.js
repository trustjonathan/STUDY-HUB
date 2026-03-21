document.addEventListener("DOMContentLoaded", () => {
    /* ============================================================
       PANEL TOGGLING SYSTEM (clean, unified, fast)
    ============================================================ */

    const controls = document.querySelectorAll(
        ".view-btn, .toggle-btn, .btn.toggle-btn, [data-target], a.btn[href^='#']"
    );

    const panelSelectors = ".resource-content, .expandable";
    const panels = () => Array.from(document.querySelectorAll(panelSelectors));

    // Hide all initially
    panels().forEach(p => {
        p.style.display = "none";
        p.classList.remove("expanded");
    });

    function hidePanel(panel) {
        if (!panel) return;
        panel.style.display = "none";
        panel.classList.remove("expanded");

        const id = panel.id;
        if (id) {
            document
                .querySelectorAll(`[data-target="#${id}"], [data-target="${id}"], a[href="#${id}"]`)
                .forEach(btn => btn.setAttribute("aria-expanded", "false"));
        }
    }

    function showPanel(panel, opener) {
        panels().forEach(p => p !== panel && hidePanel(p));

        // Reposition below resource-card
        const card = opener?.closest?.(".resource-card");
        if (card) card.insertAdjacentElement("afterend", panel);

        panel.style.display = "block";
        panel.classList.add("expanded");
        opener?.setAttribute("aria-expanded", "true");
    }

    controls.forEach(ctrl => {
        ctrl.addEventListener("click", e => {
            const href = ctrl.getAttribute("href");
            if (href?.startsWith("#")) e.preventDefault();
            e.stopPropagation();

            let target = ctrl.dataset.target || href;
            if (!target) return;
            if (!target.startsWith("#")) target = "#" + target;

            let panel = document.querySelector(target);

            if (!panel) {
                // fallback next sibling panel
                let sib = ctrl.nextElementSibling;
                while (sib) {
                    if (sib.matches(panelSelectors)) {
                        panel = sib;
                        break;
                    }
                    sib = sib.nextElementSibling;
                }
            }

            if (!panel) return;

            const visible = panel.style.display !== "none";
            visible ? hidePanel(panel) : showPanel(panel, ctrl);
        });
    });

    // Close when clicking outside
    document.addEventListener("click", e => {
        if (
            e.target.closest(".resource-card, .view-btn, .toggle-btn, .btn.toggle-btn") ||
            e.target.closest(panelSelectors)
        ) return;

        panels().forEach(hidePanel);
    });

    // Close inside panel
    document.addEventListener("click", e => {
        const closeBtn = e.target.closest(".close-panel");
        if (!closeBtn) return;
        const panel = closeBtn.closest(panelSelectors);
        hidePanel(panel);
    });

    /* ============================================================
       BIOGPT CHAT PANEL
    ============================================================ */

    const aiPanel = document.getElementById("bio-ai-panel");
    const aiOpen = document.querySelector(".bottom-nav a[href='#account']");
    const aiClose = document.getElementById("bio-ai-close");

    const aiSend = document.getElementById("bio-ai-send");
    const aiInput = document.getElementById("bio-ai-input");
    const aiMessages = document.getElementById("bio-ai-messages");

    // Open
    aiOpen?.addEventListener("click", e => {
        e.preventDefault();
        aiPanel.classList.add("open");
    });

    // Close
    aiClose?.addEventListener("click", () => aiPanel.classList.remove("open"));

    // Safe HTML escaping
    function escapeHTML(str) {
        return str.replace(/[&<>"']/g, m => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[m]));
    }

    // Send message
    aiSend.addEventListener("click", async () => {
        const question = aiInput.value.trim();
        if (!question) return;

        aiMessages.innerHTML += `
            <div class="user-msg"><strong>You:</strong> ${escapeHTML(question)}</div>
        `;

        aiInput.value = "";

        const loading = document.createElement("div");
        loading.className = "ai-msg";
        loading.textContent = "Thinking...";
        aiMessages.appendChild(loading);

        aiSend.disabled = true;

        try {
            const res = await fetch("/api/bio-gpt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userMessage: question })
            });

            const data = await res.json();
            loading.innerHTML = `<strong>BioGPT:</strong> ${escapeHTML(data.reply)}`;

        } catch (err) {
            loading.innerHTML = `<strong>BioGPT:</strong> Error fetching response.`;
        }

        aiSend.disabled = false;
        aiMessages.scrollTop = aiMessages.scrollHeight;
    });
});