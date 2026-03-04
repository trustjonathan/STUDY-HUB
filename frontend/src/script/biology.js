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

// AI integration
const AI_PANEL = document.getElementById("bio-ai-panel");
const AI_CLOSE = document.getElementById("ai-close");
const CHAT_WINDOW = document.getElementById("ai-chat-window");
const USER_INPUT = document.getElementById("ai-user-input");
const SEND_BTN = document.getElementById("ai-send-btn");

// Bottom Nav AI Button
const AI_BTN = document.querySelector('.bottom-nav a[href="#account"]');

AI_BTN.addEventListener("click", () => AI_PANEL.classList.add("open"));
AI_CLOSE.addEventListener("click", () => AI_PANEL.classList.remove("open"));

// Client-side GPT call
SEND_BTN.addEventListener("click", async () => {
    const question = USER_INPUT.value.trim();
    if (!question) return;

    appendMessage("You", question);
    USER_INPUT.value = "";

    // Display "thinking" placeholder
    appendMessage("BioGPT", "Typing...");

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer YOUR_API_KEY_HERE" // replace with safe key
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are a helpful biology tutor. Only answer UACE biology questions." },
                    { role: "user", content: question }
                ],
                temperature: 0.5,
                max_tokens: 400
            })
        });

        const data = await response.json();
        const answer = data.choices[0].message.content;

        // Remove "Typing..." and show answer
        CHAT_WINDOW.lastChild.innerHTML = `<strong>BioGPT:</strong> ${answer}`;
        CHAT_WINDOW.scrollTop = CHAT_WINDOW.scrollHeight;

    } catch (err) {
        CHAT_WINDOW.lastChild.innerHTML = "<strong>BioGPT:</strong> Error fetching response.";
    }
});

function appendMessage(sender, message) {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${sender}:</strong> ${message}`;
    CHAT_WINDOW.appendChild(div);
    CHAT_WINDOW.scrollTop = CHAT_WINDOW.scrollHeight;
}

//memory
let chatHistory = [
    { role: "system", content: "You are a helpful biology tutor. Only answer UACE biology questions." }
];

SEND_BTN.addEventListener("click", async () => {
    const question = USER_INPUT.value.trim();
    if (!question) return;

    appendMessage("You", question);
    USER_INPUT.value = "";

    appendMessage("BioGPT", "Typing...");

    // Add user message to history
    chatHistory.push({ role: "user", content: question });

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer YOUR_API_KEY_HERE"
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: chatHistory,
                temperature: 0.5,
                max_tokens: 400
            })
        });

        const data = await response.json();
        const answer = data.choices[0].message.content;

        // Replace "Typing..." with actual answer
        CHAT_WINDOW.lastChild.innerHTML = `<strong>BioGPT:</strong> ${answer}`;
        CHAT_WINDOW.scrollTop = CHAT_WINDOW.scrollHeight;

        // Save AI answer to history
        chatHistory.push({ role: "assistant", content: answer });

    } catch (err) {
        CHAT_WINDOW.lastChild.innerHTML = "<strong>BioGPT:</strong> Error fetching response.";
    }
});

const suggestionButtons = document.querySelectorAll("#ai-suggestions button");

suggestionButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        USER_INPUT.value = btn.textContent;
        SEND_BTN.click();
    });
});