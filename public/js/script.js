(() => {
  "use strict";

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll(".needs-validation");
  // Loop over them and prevent submission
  Array.from(forms).forEach((form) => {
    form.addEventListener(
      "submit",
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
          console.log("script.js = ", event);
        } else {
          document.querySelector("#loder").style.display = "inline";
          document.querySelector(".pageblur").style.opacity = ".5";
          event.submitter.disabled = true;
          event.submitter.innerHTML = "Loading..";
          event.submitter.style.fontSize = ".8rem";
        }
        form.classList.add("was-validated");
      },
      false
    );
  });

  document.querySelectorAll("[data-autodismiss-ms]").forEach((alert) => {
    const delay = Number(alert.dataset.autodismissMs) || 3000;
    window.setTimeout(() => {
      if (!alert.isConnected) return;
      if (window.bootstrap?.Alert) {
        window.bootstrap.Alert.getOrCreateInstance(alert).close();
      } else {
        alert.classList.remove("show");
        window.setTimeout(() => alert.remove(), 200);
      }
    }, delay);
  });
})();
