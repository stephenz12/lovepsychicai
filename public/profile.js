// Read psychic ID from URL
const params = new URLSearchParams(window.location.search);
const psychicId = params.get("id");

// Assume your app stores logged-in user ID in localStorage (adjust if different)
const CURRENT_USER_ID = localStorage.getItem("userId");

// ===============================
// LOAD PSYCHIC INFO
// ===============================
fetch("psychics.json")
  .then((res) => res.json())
  .then((psychics) => {
    const psychic = psychics.find((p) => p.id === psychicId);

    if (!psychic) {
      document.getElementById("profile").innerHTML =
        "<p>Psychic not found.</p>";
      return;
    }

    // Render profile UI with Chat + Phone buttons
    document.getElementById("profile").innerHTML = `
      <div class="profile-header">
        <img src="${psychic.photo}" class="profile-photo" />
        <div>
          <h1>${psychic.name}</h1>
          <p class="profile-desc">${psychic.desc}</p>
          <p class="profile-rating">⭐ ${psychic.rating} (${psychic.reviews} reviews)</p>

          <!-- Chat & Phone Status Pills -->
          <div class="advisor-status-row">
            <div class="status-pill chat-status-pill">Chat: 
              <span id="chatStatusText">Checking...</span>
            </div>
            <div class="status-pill phone-status-pill">Phone: 
              <span id="phoneStatusTextPill">Checking...</span>
            </div>
          </div>

          <div class="profile-buttons">
            <button class="chat-btn" id="startChatBtn">Chat Reading</button>
            <button class="call-btn" id="startPhoneBtn">Phone Reading</button>
          </div>
        </div>
      </div>
    `;

    // Save for later use
    window.ACTIVE_PSYCHIC = psychic;

    // Load availability status
    updateAdvisorStatus(psychic.id);
  });

// ===============================
// LOAD REVIEWS
// ===============================
fetch(`/reviews/${psychicId}`)
  .then((res) => res.json())
  .then((reviews) => {
    const container = document.getElementById("reviews");

    if (reviews.length === 0) {
      container.innerHTML = "<p>No reviews yet.</p>";
      return;
    }

    let html = "";
    reviews.forEach((r) => {
      html += `
        <div class="review-card">
          <div class="rating-inline">⭐ ${r.rating}</div>
          <p>${r.comment}</p>
          <p class="review-name">— ${r.customerName}</p>

          ${
            r.rebuttal
              ? `<div class="rebuttal"><strong>Psychic Response:</strong> ${r.rebuttal.text}</div>`
              : ""
          }
        </div>
      `;
    });

    container.innerHTML = html;
  });

// =======================================================
// ADVISOR STATUS FETCHER
// =======================================================
function updateAdvisorStatus(advisorId) {
  fetch(`/advisor-status/${advisorId}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data) return;

      // CHAT STATUS
      const chatPill = document.getElementById("chatStatusText");
      if (data.availableForChat) {
        chatPill.textContent = "Available";
        chatPill.parentElement.classList.add("available");
      } else {
        chatPill.textContent = "Busy";
        chatPill.parentElement.classList.add("busy");
        document.getElementById("startChatBtn").disabled = true;
      }

      // PHONE STATUS
      const phonePill = document.getElementById("phoneStatusTextPill");
      if (data.availableForPhone) {
        phonePill.textContent = "Available";
        phonePill.parentElement.classList.add("available");
      } else {
        phonePill.textContent = "Busy";
        phonePill.parentElement.classList.add("busy");
        document.getElementById("startPhoneBtn").disabled = true;
      }
    });
}

// =======================================================
// CHAT READING BUTTON
// =======================================================
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "startChatBtn") {
    const psychic = window.ACTIVE_PSYCHIC;
    window.location.href = `/chat.html?advisor=${psychic.id}`;
  }
});

// =======================================================
// PHONE READING LOGIC
// =======================================================
let activePhoneAdvisorId = null;
let phoneTimerInterval = null;
let phoneStartTime = null;

function formatDuration(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startPhoneTimer() {
  phoneStartTime = Date.now();
  phoneTimerInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - phoneStartTime) / 1000);
    document.getElementById("phoneCallTimer").textContent =
      formatDuration(diff);
  }, 1000);
}

function stopPhoneTimer() {
  clearInterval(phoneTimerInterval);
  phoneTimerInterval = null;
}

function openPhoneModal(name, advisorId) {
  activePhoneAdvisorId = advisorId;
  document.getElementById("phoneAdvisorName").textContent = name;
  document.getElementById("phoneModal").classList.remove("hidden");
  startPhoneTimer();
}

function closePhoneModal() {
  document.getElementById("phoneModal").classList.add("hidden");
  stopPhoneTimer();
  activePhoneAdvisorId = null;
}

// START PHONE READING
document.addEventListener("click", async (e) => {
  if (e.target && e.target.id === "startPhoneBtn") {
    const psychic = window.ACTIVE_PSYCHIC;

    try {
      const res = await fetch("/start-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advisorId: psychic.id,
          userId: CURRENT_USER_ID,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Unable to start phone reading.");
        return;
      }

      openPhoneModal(psychic.name, psychic.id);
    } catch (err) {
      alert("Error starting phone reading.");
      console.error(err);
    }
  }
});

// END PHONE READING
document
  .getElementById("endPhoneReadingBtn")
  .addEventListener("click", async () => {
    if (!activePhoneAdvisorId) return;

    await fetch("/end-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId: activePhoneAdvisorId }),
    });

    closePhoneModal();
  });

document
  .getElementById("phoneModalClose")
  .addEventListener("click", closePhoneModal);

/***********************************************
 * STEP 4 — LIVE ADVISOR STATUS UPDATES (USER)
 ***********************************************/
const socket = io();

socket.on("advisorStatusUpdate", (data) => {
  // Only update if this is the psychic being viewed
  if (!window.ACTIVE_PSYCHIC) return;
  if (data.advisorId !== window.ACTIVE_PSYCHIC.id) return;

  console.log("🔔 Live update on user page:", data);

  // Update Chat Status
  const chatText = document.getElementById("chatStatusText");
  if (data.availableForChat) {
    chatText.textContent = "Available";
    chatText.parentElement.classList.remove("busy");
    chatText.parentElement.classList.add("available");
    document.getElementById("startChatBtn").disabled = false;
  } else {
    chatText.textContent = "Busy";
    chatText.parentElement.classList.remove("available");
    chatText.parentElement.classList.add("busy");
    document.getElementById("startChatBtn").disabled = true;
  }

  // Update Phone Status
  const phoneText = document.getElementById("phoneStatusTextPill");
  if (data.availableForPhone) {
    phoneText.textContent = "Available";
    phoneText.parentElement.classList.remove("busy");
    phoneText.parentElement.classList.add("available");
    document.getElementById("startPhoneBtn").disabled = false;
  } else {
    phoneText.textContent = "Busy";
    phoneText.parentElement.classList.remove("available");
    phoneText.parentElement.classList.add("busy");
    document.getElementById("startPhoneBtn").disabled = true;
  }
});

/****************************************************
 * PHONE READING FUNCTIONS
 ****************************************************/

let phoneCallTimerInterval = null;
let phoneCallSeconds = 0;

function formatTime(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// --------------------------------------------------
// ⭐ SHOW PHONE MODAL + START CALL
// --------------------------------------------------
async function openPhoneModal(advisor) {
  const modal = document.getElementById("phoneModal");
  const phoneAdvisorName = document.getElementById("phoneAdvisorName");
  const phoneStatusText = document.getElementById("phoneStatusText");
  const timer = document.getElementById("phoneCallTimer");

  phoneAdvisorName.textContent = advisor.name || advisor.userId;
  phoneStatusText.textContent = "Connecting…";

  modal.classList.remove("hidden");

  // Reset timer UI
  phoneCallSeconds = 0;
  timer.textContent = "00:00";

  // Ask for user's phone number
  const userPhone = prompt(
    "Enter the phone number to call you (+1XXXXXXXXXX):"
  );
  if (!userPhone) {
    phoneStatusText.textContent = "Canceled.";
    return;
  }

  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("You must be logged in to start a phone reading.");
    return;
  }

  // --------------------------------------------------
  // ⭐ CALL SERVER TO START PHONE SESSION
  // --------------------------------------------------
  try {
    const res = await fetch("/start-phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        advisorId: advisor.userId,
        userId,
        userPhone,
        costPerMinute: advisor.costPerMinute || 1.99,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      phoneStatusText.textContent = "Call failed. Try again.";
      console.error(data);
      return;
    }

    phoneStatusText.textContent = "Call in progress…";

    // Start timer
    phoneCallTimerInterval = setInterval(() => {
      phoneCallSeconds++;
      timer.textContent = formatTime(phoneCallSeconds);
    }, 1000);
  } catch (err) {
    console.error(err);
    phoneStatusText.textContent = "Error starting phone reading.";
  }
}

// --------------------------------------------------
// ⭐ END PHONE READING
// --------------------------------------------------
document.getElementById("endPhoneReadingBtn").onclick = async () => {
  const advisorId = localStorage.getItem("currentAdvisor");

  if (!advisorId) return;

  clearInterval(phoneCallTimerInterval);

  await fetch("/end-phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ advisorId }),
  });

  document.getElementById("phoneModal").classList.add("hidden");
  alert("Phone reading ended.");
};

// Close modal if user clicks X
document.getElementById("phoneModalClose").onclick = () => {
  document.getElementById("phoneModal").classList.add("hidden");
};
