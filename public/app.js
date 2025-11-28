// Initialize socket.io for user side
const socket = io();

// Helper: render star rating
function renderStars(rating) {
  const fullStars = Math.round(rating);
  let stars = "";
  for (let i = 0; i < 5; i++) {
    stars += i < fullStars ? "★" : "☆";
  }
  return stars;
}

// Load psychic list
fetch("psychics.json")
  .then((res) => res.json())
  .then((psychics) => {
    const advisorGrid = document.getElementById("advisorGrid");

    psychics.forEach((psychic) => {
      const card = document.createElement("div");
      card.classList.add("advisor-card");

      card.innerHTML = `
        <div class="advisor-header">
          <img src="${psychic.photo}" class="photo" />
          <div class="advisor-info">
            <h3>${psychic.name}</h3>
            <p class="desc">${psychic.desc}</p>
            <div class="rating-row">
              <span class="stars">${renderStars(psychic.rating)}</span>
              <span class="rating-number">${psychic.rating.toFixed(2)} (${
        psychic.reviews
      } reviews)</span>
            </div>
          </div>
        </div>

        <div class="advisor-actions">
          <button class="call-btn">Call</button>
          <button class="chat-btn" onclick="startChat('${
            psychic.id
          }')">Chat</button>

          <button class="view-profile-btn"
            onclick="window.location.href='psychic.html?id=${psychic.id}'">
            View Profile
          </button>
          <button class="see-reviews-btn" data-psychic="${psychic.id}">
            See All Reviews
          </button>
        </div>

        <div class="reviews" id="reviews-${psychic.id}"></div>
      `;

      advisorGrid.appendChild(card);
      loadReviews(psychic.id);
    });

    setupSeeReviewsButtons();
  });

// Load reviews (existing code)
function loadReviews(psychicId) {
  fetch(`/reviews/${psychicId}`)
    .then((res) => res.json())
    .then((reviews) => {
      const container = document.getElementById(`reviews-${psychicId}`);
      if (!container) return;

      if (reviews.length === 0) {
        container.innerHTML = "<p class='no-reviews'>No reviews yet.</p>";
        return;
      }

      const topReviews = reviews.slice(0, 2);
      let html = "<h4>Recent Reviews</h4>";

      topReviews.forEach((r) => {
        html += `
          <div class="review-card">
            <div class="rating-inline">${renderStars(r.rating)}</div>
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

// Review modal code
function setupSeeReviewsButtons() {
  const buttons = document.querySelectorAll(".see-reviews-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const psychicId = btn.getAttribute("data-psychic");
      openReviewModal(psychicId);
    });
  });
}

function openReviewModal(psychicId) {
  const modal = document.getElementById("reviewModal");
  const modalContent = document.getElementById("modalReviews");
  modal.classList.remove("hidden");
  modalContent.innerHTML = "<p>Loading reviews...</p>";

  fetch(`/reviews/${psychicId}`)
    .then((res) => res.json())
    .then((reviews) => {
      if (reviews.length === 0) {
        modalContent.innerHTML = "<p>No reviews yet.</p>";
        return;
      }

      let html = "";
      reviews.forEach((r) => {
        html += `
          <div class="review-card">
            <div class="rating-inline">${renderStars(r.rating)}</div>
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

      modalContent.innerHTML = html;
    });
}

function closeReviewModal() {
  const modal = document.getElementById("reviewModal");
  modal.classList.add("hidden");
}

document.addEventListener("click", (e) => {
  const modal = document.getElementById("reviewModal");
  if (!modal) return;
  if (e.target.id === "reviewModal") {
    modal.classList.add("hidden");
  }
});

// ⭐⭐⭐ FIXED CHAT REQUEST SYSTEM ⭐⭐⭐
async function startChat(advisorId) {
  const token = localStorage.getItem("authToken");

  // 1. Must be logged in
  if (!token) {
    alert("Please log in before starting a chat.");
    window.location.href = "/login.html";
    return;
  }

  // 2. Load user details
  const me = await fetch("/me", {
    headers: { Authorization: "Bearer " + token },
  }).then((res) => res.json());

  // 3. Check credits
  if (!me.credits || me.credits <= 0) {
    alert("You do not have enough credits to start a chat.");
    return;
  }

  // 4. Send chat request to advisor dashboard
  socket.emit("requestChat", {
    userId: me.userId,
    advisorId: advisorId,
  });

  alert("Waiting for advisor to accept your request...");

  // 5. Advisor ACCEPTS
  socket.on("joinRoom", (data) => {
    console.log("Advisor accepted. Joining room:", data.roomId);
    localStorage.setItem("userRoomId", data.roomId);
    window.location.href = "chat.html";
  });

  // 6. Advisor DECLINES
  socket.on("chatDeclined", () => {
    alert("The advisor declined your chat request.");
  });
}
