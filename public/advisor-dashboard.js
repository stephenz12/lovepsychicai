/***********************************************
 * ADVISOR DASHBOARD — LIVE ACTIVE SESSION VIEW
 ***********************************************/

console.log("📡 Loaded advisor-dashboard.js");

const activeSessionsDiv = document.getElementById("activeSessions");
const advisorEmailEl = document.getElementById("advisorEmail");

let advisorId = null;
let timers = {}; // sessionId → interval
let phoneSessionsCache = []; // NEW for Step 9 filters

/***********************************************
 * LOAD ADVISOR PROFILE
 ***********************************************/
async function loadAdvisor() {
  const token = localStorage.getItem("authToken");

  const me = await fetch("/me", {
    headers: { Authorization: "Bearer " + token },
  }).then((r) => r.json());

  if (me.error) {
    advisorEmailEl.textContent =
      "Error loading advisor profile. Please re-login.";
    return;
  }

  advisorEmailEl.textContent = "Logged in as: " + me.email;
  advisorId = me.userId;

  loadAdvisorStatus();
}

/***********************************************
 * FETCH ALL SESSIONS FROM BACKEND
 ***********************************************/
async function loadSessions() {
  const token = localStorage.getItem("authToken");

  const res = await fetch("/admin/sessions", {
    headers: { Authorization: "Bearer " + token },
  });

  if (!res.ok) {
    activeSessionsDiv.innerHTML =
      "<div class='no-sessions'>Error loading sessions.</div>";
    return;
  }

  const allSessions = await res.json();

  const mySessions = allSessions.filter((s) => s.advisorId === advisorId);
  const active = mySessions.filter((s) => !s.endTime);

  renderActiveSessions(active);
}

/***********************************************
 * RENDER ACTIVE SESSIONS
 ***********************************************/
function renderActiveSessions(sessions) {
  activeSessionsDiv.innerHTML = "";

  if (sessions.length === 0) {
    activeSessionsDiv.innerHTML =
      "<div class='no-sessions'>No active sessions.</div>";
    return;
  }

  sessions.forEach((s) => {
    const card = document.createElement("div");
    card.className = "session-card";

    const start = s.startTime;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - start) / 1000);

    card.innerHTML = `
      <div class="session-header">
        <span>Session: ${s.sessionId}</span>
        <span>User: ${s.userId}</span>
      </div>

      <div class="session-meta">
        <span class="timer" id="timer-${s.sessionId}">
          ${formatTime(elapsedSeconds)}
        </span>
        <span class="earning" id="earn-${s.sessionId}">
          $${calculateEarnings(elapsedSeconds, s.costPerMinute)}
        </span>
      </div>
    `;

    activeSessionsDiv.appendChild(card);

    if (!timers[s.sessionId]) {
      startLiveTimer(s.sessionId, s.startTime, s.costPerMinute);
    }
  });
}

/***********************************************
 * FORMAT TIME
 ***********************************************/
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/***********************************************
 * EARNINGS CALCULATION
 ***********************************************/
function calculateEarnings(seconds, costPerMinute) {
  const costPerSecond = costPerMinute / 60;
  return (seconds * costPerSecond).toFixed(2);
}

/***********************************************
 * LIVE TIMER
 ***********************************************/
function startLiveTimer(sessionId, startTime, costPerMinute) {
  timers[sessionId] = setInterval(() => {
    const now = Date.now();
    const sec = Math.floor((now - startTime) / 1000);

    const timerEl = document.getElementById("timer-" + sessionId);
    const earnEl = document.getElementById("earn-" + sessionId);

    if (timerEl) timerEl.textContent = formatTime(sec);
    if (earnEl)
      earnEl.textContent = "$" + calculateEarnings(sec, costPerMinute);
  }, 1000);
}

/***********************************************
 * OPEN CHAT WINDOW
 ***********************************************/
function openChatWindow() {
  window.location.href = "advisor-chat.html";
}

/***********************************************
 * AUTO REFRESH
 ***********************************************/
setInterval(loadSessions, 5000);

/***********************************************
 * INIT
 ***********************************************/
loadAdvisor().then(loadSessions);

/***********************************************
 * AVAILABILITY CONTROLS
 ***********************************************/
const chatStatusEl = document.getElementById("advisorChatStatusText");
const phoneStatusEl = document.getElementById("advisorPhoneStatusText");

async function loadAdvisorStatus() {
  if (!advisorId) return;

  const res = await fetch(`/advisor-status/${advisorId}`);
  const data = await res.json();

  chatStatusEl.textContent = data.availableForChat ? "Online" : "Offline";
  phoneStatusEl.textContent = data.availableForPhone ? "Online" : "Offline";
}

document
  .getElementById("advisorGoOnlineChat")
  .addEventListener("click", async () => {
    await fetch("/advisor/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId, availableForChat: true }),
    });
    loadAdvisorStatus();
  });

document
  .getElementById("advisorGoOfflineChat")
  .addEventListener("click", async () => {
    await fetch("/advisor/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId, availableForChat: false }),
    });
    loadAdvisorStatus();
  });

document
  .getElementById("advisorGoOnlinePhone")
  .addEventListener("click", async () => {
    await fetch("/advisor/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId, availableForPhone: true }),
    });
    loadAdvisorStatus();
  });

document
  .getElementById("advisorGoOfflinePhone")
  .addEventListener("click", async () => {
    await fetch("/advisor/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId, availableForPhone: false }),
    });
    loadAdvisorStatus();
  });

/***********************************************
 * LIVE STATUS UPDATES
 ***********************************************/
const socket = io();

socket.on("advisorStatusUpdate", (data) => {
  if (data.advisorId !== advisorId) return;

  chatStatusEl.textContent = data.availableForChat ? "Online" : "Offline";
  phoneStatusEl.textContent = data.availableForPhone ? "Online" : "Offline";
});

/***********************************************
 * STEP 9 — FILTER HELPER
 ***********************************************/
function applyPhoneFilter(sessions) {
  const filter = document.getElementById("phoneFilterRange").value;
  const now = new Date();

  return sessions.filter((s) => {
    const d = new Date(s.startTime);

    if (filter === "today") {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    if (filter === "week") {
      const diff = now - d;
      return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    }
    if (filter === "month") {
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    }
    return true; // all
  });
}

/***********************************************
 * RENDER PHONE EARNINGS WITH FILTERS
 ***********************************************/
function renderPhoneEarnings() {
  const sessions = applyPhoneFilter(phoneSessionsCache);

  const totalMinutes = Math.floor(
    sessions.reduce((sum, s) => sum + s.totalSeconds, 0) / 60
  );

  const totalMoney = sessions
    .reduce((sum, s) => sum + s.totalCost, 0)
    .toFixed(2);

  document.getElementById("phoneMinutes").textContent = totalMinutes;
  document.getElementById("phoneMoney").textContent = "$" + totalMoney;

  const list = document.getElementById("phoneEarningsList");

  if (sessions.length === 0) {
    list.innerHTML = "<p>No phone readings in this range.</p>";
    return;
  }

  list.innerHTML = "";

  sessions
    .slice(-5)
    .reverse()
    .forEach((s) => {
      const div = document.createElement("div");
      div.className = "session-card";
      const date = new Date(s.startTime).toLocaleString();

      div.innerHTML = `
        <div><strong>Client:</strong> ${s.userId}</div>
        <div>${date}</div>
        <div>Duration: ${Math.floor(s.totalSeconds / 60)} minutes</div>
        <div>Earnings: $${s.totalCost.toFixed(2)}</div>
      `;

      list.appendChild(div);
    });
}

/***********************************************
 * LOAD PHONE EARNINGS FROM SERVER
 ***********************************************/
async function loadPhoneEarnings() {
  if (!advisorId) return;

  const res = await fetch("/advisor-phone-earnings/" + advisorId);
  const data = await res.json();

  phoneSessionsCache = data.sessions || [];
  renderPhoneEarnings();
}

// Load earnings after advisor loads
setTimeout(loadPhoneEarnings, 1500);

// Re-render when dropdown changes
document
  .getElementById("phoneFilterRange")
  .addEventListener("change", renderPhoneEarnings);

/***********************************************
 * STEP 8 — CSV EXPORT (filtered)
 ***********************************************/
document.getElementById("downloadPhoneCSV").addEventListener("click", () => {
  const sessions = applyPhoneFilter(phoneSessionsCache);

  if (sessions.length === 0) {
    alert("No phone earnings available to export in this range.");
    return;
  }

  let csv = "Date,User ID,Duration (minutes),Earnings ($)\n";

  sessions.forEach((s) => {
    const date = new Date(s.startTime).toLocaleString();
    const minutes = Math.floor(s.totalSeconds / 60);
    csv += `"${date}",${s.userId},${minutes},${s.totalCost.toFixed(2)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "phone_earnings.csv";
  a.click();

  URL.revokeObjectURL(url);
});
