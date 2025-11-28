console.log("Add Credits JS Loaded");

const userIdInput = document.getElementById("userIdInput");
const amountInput = document.getElementById("amountInput");
const addCreditsBtn = document.getElementById("addCreditsBtn");
const resultMessage = document.getElementById("resultMessage");

addCreditsBtn.addEventListener("click", () => {
  console.log("BUTTON CLICKED!");

  const userId = userIdInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!userId || isNaN(amount) || amount <= 0) {
    resultMessage.textContent = "⚠️ Please enter a valid user ID and amount.";
    resultMessage.style.color = "#ff6b6b";
    return;
  }

  fetch(`/user/${userId}/add-credits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  })
    .then((res) => res.json())
    .then((data) => {
      resultMessage.textContent = `✔️ Added $${amount.toFixed(
        2
      )} to "${userId}". New Balance: $${data.credits.toFixed(2)}`;
      resultMessage.style.color = "#00ffb7";
    })
    .catch((err) => {
      console.error(err);
      resultMessage.textContent = "❌ Failed to add credits.";
      resultMessage.style.color = "#ff6b6b";
    });
});
