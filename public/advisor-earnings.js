console.log("📘 Loaded advisor-earnings.js");

let advisorId = null;

// Load advisor ID
async function loadAdvisor() {
  const token = localStorage.getItem("authToken");

  const me = await fetch("/me", {
    headers: { Authorization: "Bearer " + token },
  }).then((r) => r.json());

  advisorId = me.userId;

  loadEarnings();
}

async function loadEarnings(filters = {}) {
  const resChat = await fetch("/admin/sessions");
  const chatSessions = await resChat.json();

  const resPhone = await fetch("/advisor-phone-earnings/" + advisorId);
  const phoneData = await resPhone.json();
  const phoneSessions = phoneData.sessions;

  let combined = [];

  // Merge Chat Sessions
  chatSessions
    .filter((s) => s.advisorId === advisorId && s.endTime)
    .forEach((s) => {
      combined.push({
        type: "Chat",
        userId: s.userId,
        start: s.startTime,
        minutes: Math.floor(s.totalSeconds / 60),
        amount: s.totalCost,
      });
    });

  // Merge Phone Sessions
  phoneSessions.forEach((s) => {
    combined.push({
      type: "Phone",
      userId: s.userId,
      start: s.startTime,
      minutes: Math.floor(s.totalSeconds / 60),
      amount: s.totalCost,
    });
  });

  // FILTERING
  if (filters.from) {
    const fromDate = new Date(filters.from).getTime();
    combined = combined.filter((s) => s.start >= fromDate);
  }
  if (filters.to) {
    const toDate = new Date(filters.to).getTime() + 86400000;
    combined = combined.filter((s) => s.start <= toDate);
  }

  combined.sort((a, b) => b.start - a.start);

  renderTable(combined);
  updateTotals(combined);
}

// Render table
function renderTable(rows) {
  if (rows.length === 0) {
    document.getElementById("earningsTableContainer").innerHTML =
      "<p>No earnings found with these filters.</p>";
    return;
  }

  let html = `
    <table>
      <tr>
        <th>Type</th>
        <th>User</th>
        <th>Date</th>
        <th>Minutes</th>
        <th>Amount</th>
      </tr>
  `;

  rows.forEach((r) => {
    html += `
      <tr>
        <td>${r.type}</td>
        <td>${r.userId}</td>
        <td>${new Date(r.start).toLocaleString()}</td>
        <td>${r.minutes}</td>
        <td>$${r.amount.toFixed(2)}</td>
      </tr>
    `;
  });

  html += "</table>";
  document.getElementById("earningsTableContainer").innerHTML = html;
}

// Update totals
function updateTotals(rows) {
  let chatTotal = 0;
  let phoneTotal = 0;

  rows.forEach((r) => {
    if (r.type === "Chat") chatTotal += r.amount;
    else phoneTotal += r.amount;
  });

  document.getElementById("totalChat").textContent = "$" + chatTotal.toFixed(2);
  document.getElementById("totalPhone").textContent =
    "$" + phoneTotal.toFixed(2);
  document.getElementById("grandTotal").textContent =
    "$" + (chatTotal + phoneTotal).toFixed(2);
}

// Filter listeners
document.getElementById("applyFilters").addEventListener("click", () => {
  loadEarnings({
    from: document.getElementById("filterFrom").value,
    to: document.getElementById("filterTo").value,
  });
});

document.getElementById("resetFilters").addEventListener("click", () => {
  document.getElementById("filterFrom").value = "";
  document.getElementById("filterTo").value = "";
  loadEarnings();
});

// Export CSV
document.getElementById("downloadFullCSV").addEventListener("click", () => {
  const table = document.querySelector("table");
  if (!table) return;

  let csv = "";
  table.querySelectorAll("tr").forEach((row) => {
    const cells = [...row.children].map((td) => `"${td.textContent}"`);
    csv += cells.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "full_earnings.csv";
  a.click();

  URL.revokeObjectURL(url);
});

loadAdvisor();
