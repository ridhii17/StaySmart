document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-gallery-delete]");
  if (!button || !window.confirm("Remove this gallery photo?")) return;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = button.dataset.galleryDelete;
  document.body.append(form);
  form.submit();
});
