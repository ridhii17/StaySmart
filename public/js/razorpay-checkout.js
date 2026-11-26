(() => {
  const button = document.getElementById("razorpayPayButton");
  const message = document.getElementById("paymentError");
  if (!button) return;

  function showError(text) {
    message.hidden = false;
    message.textContent = text;
    button.disabled = false;
    button.textContent = "Try payment again";
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Preparing secure checkout…";
    message.hidden = true;
    try {
      const orderResponse = await fetch(button.dataset.orderUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error || "Could not prepare payment.");
      if (typeof window.Razorpay !== "function") throw new Error("Secure checkout did not load. Refresh the page and try again.");

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        order_id: orderData.order.id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "StaySmart",
        description: `Reservation · ${orderData.listingTitle}`,
        prefill: { name: orderData.guestName, email: orderData.guestEmail },
        theme: { color: "#087f78" },
        handler: async (payment) => {
          button.textContent = "Verifying payment…";
          try {
            const verifyResponse = await fetch(button.dataset.verifyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(payment),
            });
            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verifyData.error || "Payment could not be verified.");
            window.location.assign(verifyData.redirectUrl || "/my-trips");
          } catch (error) {
            showError(error.message || "Payment could not be verified. Contact support before trying another payment.");
          }
        },
        modal: {
          ondismiss: () => {
            button.disabled = false;
            button.textContent = "Pay securely with Razorpay";
          },
        },
      });
      checkout.on("payment.failed", (event) => showError(event.error?.description || "Payment failed. You can try again."));
      checkout.open();
      button.textContent = "Complete payment in the secure checkout";
    } catch (error) {
      showError(error.message || "Could not open secure checkout.");
    }
  });
})();
