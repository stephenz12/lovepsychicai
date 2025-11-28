const sessionsList = document.getElementById("sessionsList");
const refreshBtn = document.getElementById("refreshBtn");

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString();
}

function loadSessions() {
  const token = localStorage.getItem("authToken");

  fetch("/admin/sessions", {
    headers: {
      Authorization: "Bearer " + token,
    },
  })
    .then((res) => res.json())
    .then((sessions) => {
      if (!Array.isArray(sessions) || sessions.length === 0) {
        sessionsList.innerHTML = `<p>No sessions found.</p>`;
        return;
      }

      let html = `
        <table style="width:100%; border-collapse: collapse;">
          <tr>
            <th style="padding:8px; text-align:left;">Session ID</th>
            <th style="padding:8px; text-align:left;">User</th>
            <th style="padding:8px; text-align:left;">Advisor</th>
            <th style="padding:8px; text-align:left;">Duration</th>
            <th style="padding:8px; text-align:left;">Cost</th>
            <th style="padding:8px; text-align:left;">Date</th>
          </tr>
      `;

      sessions.forEach((s) => {
        html += `
          <tr>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${
              s.sessionId
            }</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${
              s.userId
            }</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${
              s.advisorId
            }</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${
              s.totalSeconds
            }s</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">$${s.totalCost.toFixed(
              2
            )}</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${formatDate(
              s.startTime
            )}</td>
          </tr>
        `;
      });

      html += `</table>`;
      sessionsList.innerHTML = html;
    })
    .catch((err) => {
      sessionsList.innerHTML = `<p style="color:red;">Error loading sessions.</p>`;
      console.error(err);
    });
}

loadSessions();

refreshBtn.addEventListener("click", loadSessions);
