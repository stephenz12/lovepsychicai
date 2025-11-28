// Load user identity
const token = localStorage.getItem("authToken");

async function loadUser() {
  const res = await fetch("/me", {
    headers: { Authorization: "Bearer " + token },
  });

  const me = await res.json();
  return me.userId;
}

async function loadHistory() {
  const userId = await loadUser();

  const res = await fetch("/phone-history/" + userId);
  const data = await res.json();

  const list = document.getElementById("historyList");

  if (data.length === 0) {
    list.textContent = "You have no past phone readings yet.";
    return;
  }

  list.innerHTML = "";

  data.forEach((session) => {
    const div = document.createElement("div");
    div.className = "history-item";

    const date = new Date(session.startTime).toLocaleString();

    div.innerHTML = `
      <div><strong>Advisor:</strong> ${session.advisorId}</div>
      <div class="time">${date}</div>
      <div>Duration: ${Math.floor(session.totalSeconds / 60)} minutes</div>
      <div class="cost">Cost: $${session.totalCost.toFixed(2)}</div>
    `;

    list.appendChild(div);
  });
}

loadHistory();
