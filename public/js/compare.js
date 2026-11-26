(function setupCompareSelection() {
  const boxes = Array.from(document.querySelectorAll(".compare-place"));
  if (!boxes.length) return;
  const status = document.getElementById("compareSelection");
  const link = document.getElementById("compareLink");
  function update() {
    const selected = boxes.filter((box) => box.checked);
    if (selected.length > 4) {
      selected[selected.length - 1].checked = false;
      return update();
    }
    boxes.forEach((box) => { box.disabled = !box.checked && selected.length >= 4; });
    if (status) status.firstChild.textContent = `${selected.length}/4 selected · `;
    if (link) {
      link.href = selected.length ? `/compare?ids=${selected.map((box) => encodeURIComponent(box.value)).join(",")}` : "/compare";
      link.setAttribute("aria-disabled", selected.length < 2 ? "true" : "false");
    }
  }
  boxes.forEach((box) => box.addEventListener("change", update));
  update();
})();
