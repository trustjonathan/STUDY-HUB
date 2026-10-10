(() => {
  "use strict";

  const toggle = document.querySelector("#ai-study-toggle");
  const panel = document.querySelector("#ai-study-companion");
  const close = document.querySelector("#ai-study-close");
  const form = document.querySelector("#ai-study-form");
  const promptInput = document.querySelector("#ai-study-prompt");
  const submit = document.querySelector("#ai-study-submit");
  const messages = document.querySelector("#ai-study-messages");
  const status = document.querySelector("#ai-study-status");
  const pdfReader = document.querySelector("#pdf-reader");
  const pageInput = document.querySelector(".ela-pageinput input");
  const history = [];

  function getApiBase() {
    const configured = document.querySelector('meta[name="study-hub-api-base"]')?.content;
    if (!configured || configured === "__STUDY_HUB_API_BASE__") return null;
    try {
      const url = new URL(configured);
      const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        (url.protocol !== "https:" && !localHost) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) return null;
      return url.href.replace(/\/+$/, "");
    } catch {
      return null;
    }
  }

  const apiBase = getApiBase();

  function updateAvailability() {
    toggle.hidden = pdfReader.hidden;
  }

  function setOpen(open) {
    panel.dataset.open = String(open);
    panel.setAttribute("aria-hidden", String(!open));
    toggle.setAttribute("aria-expanded", String(open));
    if (open) promptInput.focus();
    else toggle.focus();
  }

  function appendInlineMarkdown(container, text) {
    const pattern = /(\*\*|__)(.+?)\1|(\*|_)([^*_]+?)\3|`([^`]+)`/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text))) {
      container.append(document.createTextNode(text.slice(lastIndex, match.index)));
      const element = document.createElement(match[5] ? "code" : match[1] ? "strong" : "em");
      element.textContent = match[5] || match[2] || match[4];
      container.append(element);
      lastIndex = pattern.lastIndex;
    }

    container.append(document.createTextNode(text.slice(lastIndex)));
  }

  function appendParagraph(container, lines) {
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, lines.join(" "));
    container.append(paragraph);
  }

  function renderMarkdown(container, text) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    let paragraphLines = [];
    let list = null;
    let codeLines = null;

    function flushParagraph() {
      if (paragraphLines.length) appendParagraph(container, paragraphLines);
      paragraphLines = [];
    }

    function closeList() {
      list = null;
    }

    for (const line of lines) {
      const trimmed = line.trim();
      const fence = trimmed.match(/^```/);

      if (fence) {
        flushParagraph();
        closeList();
        if (codeLines) {
          const pre = document.createElement("pre");
          const code = document.createElement("code");
          code.textContent = codeLines.join("\n");
          pre.append(code);
          container.append(pre);
          codeLines = null;
        } else {
          codeLines = [];
        }
        continue;
      }

      if (codeLines) {
        codeLines.push(line);
        continue;
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        const element = document.createElement(`h${heading[1].length}`);
        appendInlineMarkdown(element, heading[2]);
        container.append(element);
        continue;
      }

      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        const element = document.createElement("blockquote");
        appendInlineMarkdown(element, quote[1]);
        container.append(element);
        continue;
      }

      const item = trimmed.match(/^([-*+]|\d+[.)])\s+(.+)$/);
      if (item) {
        flushParagraph();
        const ordered = /^\d/.test(item[1]);
        if (!list || list.tagName !== (ordered ? "OL" : "UL")) {
          list = document.createElement(ordered ? "ol" : "ul");
          container.append(list);
        }
        const listItem = document.createElement("li");
        appendInlineMarkdown(listItem, item[2]);
        list.append(listItem);
        continue;
      }

      closeList();
      if (!trimmed) {
        flushParagraph();
      } else {
        paragraphLines.push(trimmed);
      }
    }

    flushParagraph();
    if (codeLines) {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.append(code);
      container.append(pre);
    }
  }

  function addMessage(text, role) {
    messages.querySelector(".ai-study-empty")?.remove();
    const message = document.createElement("div");
    message.className = "ai-study-message";
    message.dataset.role = role;
    message.setAttribute(
      "aria-label",
      role === "user" ? "Your question" : role === "model" ? "AI tutor response" : "Study companion error"
    );
    if (role === "model") renderMarkdown(message, text);
    else message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  }

  function currentPageImage() {
    const page = Number(pageInput.value);
    if (!Number.isInteger(page) || page < 1) {
      throw new Error("Choose a valid PDF page first.");
    }
    const section = document.querySelector(`.pdf-page[data-page="${page}"]`);
    const canvas = section?.querySelector("canvas");
    if (!canvas || !canvas.width || !canvas.height) {
      throw new Error("Wait for the current PDF page to finish rendering, then try again.");
    }

    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / canvas.width);
    const output = document.createElement("canvas");
    output.width = Math.round(canvas.width * scale);
    output.height = Math.round(canvas.height * scale);
    const context = output.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not prepare the PDF page image.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0, output.width, output.height);

    const dataUrl = output.toDataURL("image/jpeg", 0.72);
    if (dataUrl.length > 900_000) {
      throw new Error("This page image is too large to send. Try reducing the document zoom.");
    }
    return { page, base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
  }

  toggle.addEventListener("click", () => setOpen(panel.dataset.open !== "true"));
  close.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.dataset.open === "true") setOpen(false);
  });

  const observer = new MutationObserver(updateAvailability);
  observer.observe(pdfReader, { attributes: true, attributeFilter: ["hidden"] });
  updateAvailability();

  if (!apiBase) {
    submit.disabled = true;
    status.textContent = "The study companion is not connected. Configure the public backend API URL to enable it.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt || !apiBase) return;

    let pageImage;
    let pageNumber;
    try {
      ({ base64: pageImage, page: pageNumber } = currentPageImage());
    } catch (error) {
      status.textContent = error.message;
      return;
    }

    addMessage(prompt, "user");
    promptInput.value = "";
    status.textContent = `Asking about page ${pageNumber}…`;
    submit.disabled = true;

    try {
      const conversation = history.slice(-8);
      if (conversation[0]?.role === "model") conversation.shift();
      const response = await fetch(`${apiBase}/api/ai-study-companion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, pageNumber, pageImage, history: conversation })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "The study companion could not answer. Please try again.");
      }
      if (typeof result.reply !== "string" || !result.reply.trim()) {
        throw new Error("The study companion returned an empty answer. Please try again.");
      }
      addMessage(result.reply, "model");
      history.push(
        { role: "user", text: prompt },
        { role: "model", text: result.reply }
      );
      if (history.length > 10) history.splice(0, history.length - 10);
      status.textContent = `Answered using PDF page ${pageNumber}.`;
    } catch (error) {
      addMessage(error instanceof Error ? error.message : "The study companion could not answer.", "error");
      status.textContent = "Your question was not answered.";
    } finally {
      submit.disabled = false;
      promptInput.focus();
    }
  });
})();
