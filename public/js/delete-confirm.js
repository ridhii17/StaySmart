const deleteTriggers = document.querySelectorAll(".delete-confirm-trigger");

deleteTriggers.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();

    const wrapper = btn.parentElement.querySelector(".fnx-fixed-dis");
    if (wrapper) wrapper.style.display = "flex";
  });
});

document.querySelectorAll(".cancle-confirm").forEach((cancelBtn) => {
  cancelBtn.addEventListener("click", () => {
    const wrapper = cancelBtn.closest(".fnx-fixed-dis");
    if (wrapper) wrapper.style.display = "none";
  });
});
