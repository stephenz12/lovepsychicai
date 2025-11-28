console.log("📊 Loaded advisor-performance.js");

let advisorId = null;

async function loadAdvisor() {
  const token = localStorage.getItem("authToken");

  const me = await fetch("/me", {
    headers: { Authorization: "Bearer " + token },
  }).then((r) => r.json());

  advisorId = me.userId;

  loadAnalytics();
}

async function loadAnalytics() {
  const res = await fetch("/advisor/analytics/" + advisorId);
  const data = await res.json();

  renderMetrics(data.totals);
  renderCharts(data.daily);
}

/************ RENDER SUMMARY METRICS ************/
function renderMetrics(t) {
  const html = `
    <div class="metric-box">
      <div class="metric-title">Total Chat Sessions</div>
      <div class="metric-value">${t.totalChats}</div>
    </div>

    <div class="metric-box">
      <div class="metric-title">Total Phone Sessions</div>
      <div class="metric-value">${t.totalPhones}</div>
    </div>

    <div class="metric-box">
      <div class="metric-title">Avg Chat Duration</div>
      <div class="metric-value">${t.avgChatMinutes} min</div>
    </div>

    <div class="metric-box">
      <div class="metric-title">Avg Phone Duration</div>
      <div class="metric-value">${t.avgPhoneMinutes} min</div>
    </div>

    <div class="metric-box">
      <div class="metric-title">Unique Clients</div>
      <div class="metric-value">${t.uniqueClients}</div>
    </div>

    <div class="metric-box">
      <div class="metric-title">Returning Clients</div>
      <div class="metric-value">${t.returningClients}</div>
    </div>
  `;

  document.getElementById("metricsContainer").innerHTML = html;
}

/************ RENDER CHARTS ************/
function renderCharts(daily) {
  const labels = Object.keys(daily).reverse();
  const readings = labels.map((d) => daily[d].readings);
  const earnings = labels.map((d) => daily[d].earnings.toFixed(2));

  // Readings Chart
  new Chart(document.getElementById("readingsChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Readings",
          data: readings,
          borderColor: "#567bfb",
          borderWidth: 2,
          fill: false,
        },
      ],
    },
  });

  // Earnings Chart
  new Chart(document.getElementById("earningsChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Earnings ($)",
          data: earnings,
          borderColor: "green",
          borderWidth: 2,
          fill: false,
        },
      ],
    },
  });
}

loadAdvisor();
