(() => {
  const tabs = Array.from(document.querySelectorAll("[data-settings-tab]"));
  if (!tabs.length) return;

  const panels = tabs
    .map((tab) => document.getElementById(tab.dataset.settingsTab))
    .filter(Boolean);

  function activate(tab) {
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== tab.dataset.settingsTab;
    });
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab)));
})();
