// Load current user's wallet

function getUserId() {
  const data = localStorage.getItem("userInfo");
  if (!data) return null;
  try {
    const info = JSON.parse(data);
    return info.userId;
  } catch {
    return null;
  }
}

const creditAmount = document.getElementById("creditAmount");

// Step 1: Load credits when page loads
function loadCredits() {
  const userId = getUserId();

  if (!userId) {
    creditAmount.textContent = "Not logged in.";
    return;
  }

  fetch(`/user/${userId}/wallet`)
    .then((res) => res.json())
    .then((data) => {
      creditAmount.textContent = `$${data.credits.toFixed(2)}`;
    })
    .catch((err) => {
      creditAmount.textContent = "Error loading credits.";
      console.error(err);
    });
}

loadCredits();

// Step 2: Add credits
function addCredits(amount) {
  const userId = getUserId();

  if (!userId) {
    alert("You must be logged in to add credits.");
    return;
  }

  fetch(`/user/${userId}/add-credits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  })
    .then((res) => res.json())
    .then((data) => {
      creditAmount.textContent = `$${data.credits.toFixed(2)}`;
      alert(`Added $${amount} to your wallet.`);
    })
    .catch((err) => {
      alert("Error adding credits.");
      console.error(err);
    });
}
