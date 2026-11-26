(() => {
  const form = document.getElementById("availabilityForm");
  if (!form) return;

  const checkIn = document.getElementById("bookingCheckIn");
  const checkOut = document.getElementById("bookingCheckOut");
  const status = document.getElementById("availabilityStatus");
  let sequence = 0;
  let timer;

  function setStatus(state, message) {
    status.dataset.state = state;
    status.textContent = message;
  }

  async function refreshAvailability() {
    const currentSequence = ++sequence;
    if (!checkIn.value || !checkOut.value) {
      setStatus("idle", "Choose dates to check live availability.");
      return;
    }
    if (checkOut.value <= checkIn.value) {
      setStatus("unavailable", "Choose a check-out date after check-in.");
      return;
    }

    setStatus("checking", "Checking availability…");
    try {
      const url = new URL(form.dataset.availabilityUrl, window.location.origin);
      url.searchParams.set("checkIn", checkIn.value);
      url.searchParams.set("checkOut", checkOut.value);
      const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json();
      if (currentSequence !== sequence) return;
      if (!response.ok) throw new Error(data.error || "Availability could not be checked.");
      setStatus(data.available ? "available" : "unavailable", data.available
        ? "Available for your selected dates."
        : "Those dates are already booked. Choose another range.");
    } catch (error) {
      if (currentSequence !== sequence) return;
      setStatus("unknown", error.message || "Could not refresh availability. It will be checked again before checkout.");
    }
  }

  function restartPolling() {
    window.clearInterval(timer);
    refreshAvailability();
    timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && checkIn.value && checkOut.value) refreshAvailability();
    }, 15000);
  }

  checkIn.addEventListener("change", () => {
    checkOut.min = checkIn.value || checkOut.min;
    restartPolling();
  });
  checkOut.addEventListener("change", restartPolling);
  form.addEventListener("submit", (event) => {
    if (status.dataset.state === "unavailable") {
      event.preventDefault();
      return;
    }
    if (status.dataset.state === "checking") {
      event.preventDefault();
    }
  });

  if (checkIn.value && checkOut.value) restartPolling();
})();
