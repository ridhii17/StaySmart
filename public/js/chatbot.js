(() => {
  const panel = document.getElementById("chatPanel");
  const toggle = document.getElementById("chatToggle");
  const close = document.getElementById("chatClose");
  const messages = document.getElementById("chatMessages");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const quickPrompts = document.getElementById("chatQuickPrompts");

  if (!panel || !toggle || !close || !messages || !form || !input) return;

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  function addMessage(text, sender) {
    const message = document.createElement("div");
    message.className = `chat-message chat-message--${sender}`;

    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    message.appendChild(paragraph);

    const time = document.createElement("time");
    time.textContent = sender === "assistant" ? "StaySmart assistant" : "You";
    message.appendChild(time);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(rawMessage) {
    const message = rawMessage.trim();
    if (!message) return;

    addMessage(message, "user");
    if (quickPrompts) quickPrompts.remove();
    input.value = "";
    input.disabled = true;
    form.querySelector("button[type='submit']").disabled = true;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The assistant couldn't reply.");
      addMessage(result.reply, "assistant");
    } catch (error) {
      addMessage(error.message || "I couldn't connect just now. Please try again.", "assistant");
    } finally {
      input.disabled = false;
      form.querySelector("button[type='submit']").disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  if (quickPrompts) {
    quickPrompts.addEventListener("click", (event) => {
      const button = event.target.closest("[data-prompt]");
      if (button) sendMessage(button.dataset.prompt);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });
})();
