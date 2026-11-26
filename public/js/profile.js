(() => {
  const tabs = [
    { button: document.getElementById("placesTab"), panel: document.getElementById("placesPanel") },
    { button: document.getElementById("reviewsTab"), panel: document.getElementById("reviewsPanel") },
  ].filter(({ button, panel }) => button && panel);

  tabs.forEach(({ button, panel }) => {
    button.addEventListener("click", () => {
      tabs.forEach((tab) => {
        const active = tab.button === button;
        tab.button.classList.toggle("is-active", active);
        tab.button.setAttribute("aria-selected", String(active));
        tab.panel.hidden = !active;
      });
    });
  });
})();
