document.addEventListener("DOMContentLoaded", () => {
  const panels = Array.from(document.querySelectorAll(".resource-content, .expandable"));
  const controls = document.querySelectorAll(".toggle-btn[data-target]");

  panels.forEach((panel) => {
    panel.style.display = "none";
    panel.classList.remove("expanded");
  });

  controls.forEach((control) => {
    control.addEventListener("click", () => {
      const targetId = control.dataset.target.replace(/^#/, "");
      const panel = document.getElementById(targetId);
      if (!panel) return;

      const shouldOpen = window.getComputedStyle(panel).display === "none";
      panels.forEach((candidate) => {
        candidate.style.display = "none";
        candidate.classList.remove("expanded");
      });
      controls.forEach((button) => button.setAttribute("aria-expanded", "false"));

      if (shouldOpen) {
        panel.style.display = "block";
        panel.classList.add("expanded");
        control.setAttribute("aria-expanded", "true");
      }
    });
  });
});
