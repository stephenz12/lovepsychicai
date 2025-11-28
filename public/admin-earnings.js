const earningsList = document.getElementById("earningsList");
const refreshBtn = document.getElementById("refreshBtn");

function loadEarnings() {
  const token = localStorage.getItem("authToken");

  fetch("/admin/earnings", {
    headers: {
      Authorization: "Bearer " + token,
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (!Array.isArray(data) || data.length === 0) {
        earningsList.innerHTML = "<p>No advisor earnings found.</p>";
        return;
      }

      let html = `
        <table style="width:100%; border-collapse: collapse;">
          <tr>
            <th style="padding:8px; text-align:left;">Advisor ID</th>
            <th style="padding:8px; text-align:left;">Sessions</th>
            <th style="padding:8px; text-align:left;">Total Minutes</th>
            <th style="padding:8px; text-align:left;">Total Earnings</th>
          </tr>
      `;

      data.forEach((e) => {
        const totalMinutes = Math.round((e.totalSeconds || 0) / 60);

        html += `
          <tr>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${
              e.advisorId
            }</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${
              e.sessions
            }</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">${totalMinutes} min</td>
            <td style="padding:8px; border-top:1px solid #7f3bf5;">$${e.totalCost.toFixed(
              2
            )}</td>
          </tr>
        `;
      });

      html += "</table>";
      earningsList.innerHTML = html;
    })
    .catch((err) => {
      earningsList.innerHTML =
        "<p style='color:red;'>Error loading earnings.</p>";
      console.error(err);
    });
}

loadEarnings();
refreshBtn.addEventListener("click", loadEarnings);
