// Read psychic ID from URL
const urlParams = new URLSearchParams(window.location.search);
const psychicId = urlParams.get("id");

// ======================
// 1. Load psychic details
// ======================
fetch("psychics.json")
  .then((res) => res.json())
  .then((psychics) => {
    const psychic = psychics.find((p) => p.id === psychicId);

    if (!psychic) {
      document.getElementById("profile").innerHTML =
        "<p>Psychic not found.</p>";
      return;
    }

    document.getElementById("profile").innerHTML = `
      <div class="profile-header">
        <img src="${psychic.photo}" class="profile-photo" />

        <div>
          <h1>${psychic.name}</h1>
          <p class="profile-desc">${psychic.desc}</p>
          <p class="profile-rating">⭐ ${psychic.rating} (${psychic.reviews} reviews)</p>

          <div class="profile-buttons">
            <button class="call-btn">Call</button>

            <button class="chat-btn"
              onclick="window.location.href='chat.html?id=${psychicId}&role=customer'">
              Chat
            </button>
          </div>
        </div>
      </div>
    `;
  });

// ======================
// 2. Load all reviews
// ======================
function loadReviews() {
  fetch(`/reviews/${psychicId}`)
    .then((res) => res.json())
    .then((reviews) => {
      const container = document.getElementById("reviews");

      if (!reviews.length) {
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
}

loadReviews();

// ======================
// REMOVED:
// - reviewForm
// - rebuttalForm
// Because your site now uses:
//   ✔ Verified review links
//   ✔ Admin dashboard for rebuttals
// ======================

/****************************************************
 * ⭐ STEP 2 — PHONE READING LOGIC
 ****************************************************/

let phoneTimerInterval = null;
let phoneStartTimestamp = null;

// -----------------------------
// OPEN PHONE MODAL
// -----------------------------
function openPhoneModal(advisor) {
  document.getElementById("phoneAdvisorName").textContent =
    advisor.displayName || advisor.email || "Advisor";

  document.getElementById("phoneStatusText").textContent = "Connecting…";

  document.getElementById("phoneModal").classList.remove("hidden");

  startPhoneCall(advisor);
}

// -----------------------------
// START PHONE CALL (send to server)
// -----------------------------
async function startPhoneCall(advisor) {
  const userId = localStorage.getItem("userId");
  const userPhone = prompt("Enter your phone number:");

  if (!userPhone) {
    alert("Phone number required.");
    return;
  }

  const body = {
    advisorId: advisor.userId,
    userId,
    costPerMinute: advisor.costPerMinute || 1.99,
    userPhone,
  };

  try {
    const res = await fetch("/start-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.success) {
      alert("Could not start phone reading: " + data.error);
      return;
    }

    document.getElementById("phoneStatusText").textContent =
      "Call In Progress…";

    // Start timer
    phoneStartTimestamp = Date.now();
    phoneTimerInterval = setInterval(updatePhoneTimer, 1000);
  } catch (err) {
    console.error(err);
    alert("Phone call failed.");
  }
}

// -----------------------------
// UPDATE CALL TIMER
// -----------------------------
function updatePhoneTimer() {
  const span = document.getElementById("phoneCallTimer");
  if (!span || !phoneStartTimestamp) return;

  const elapsed = Math.floor((Date.now() - phoneStartTimestamp) / 1000);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  span.textContent = `${mins}:${secs}`;
}

// -----------------------------
// END PHONE SESSION
// -----------------------------
document
  .getElementById("endPhoneReadingBtn")
  .addEventListener("click", async () => {
    const advisorId = localStorage.getItem("currentAdvisor");

    if (!advisorId) return;

    await fetch("/end-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ advisorId }),
    });

    clearInterval(phoneTimerInterval);
    phoneTimerInterval = null;

    document.getElementById("phoneModal").classList.add("hidden");
  });

// Close modal button
document.getElementById("phoneModalClose").addEventListener("click", () => {
  document.getElementById("phoneModal").classList.add("hidden");
});
