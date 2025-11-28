const DASHBOARD_PASSWORD = "lovepsychic"; // demo only; not secure for production

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("adminPassword");
const loadReviewsBtn = document.getElementById("loadReviewsBtn");
const psychicIdInput = document.getElementById("psychicIdInput");
const dashboardReviews = document.getElementById("dashboardReviews");

loginBtn.addEventListener("click", () => {
  if (passwordInput.value === DASHBOARD_PASSWORD) {
    loginSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
  } else {
    alert("Incorrect password.");
  }
});

loadReviewsBtn.addEventListener("click", () => {
  const psychicId = psychicIdInput.value.trim();
  if (!psychicId) {
    alert("Please enter a psychicId.");
    return;
  }

  fetch(`/reviews/${psychicId}`)
    .then((res) => res.json())
    .then((reviews) => {
      if (reviews.length === 0) {
        dashboardReviews.innerHTML = "<p>No reviews yet.</p>";
        return;
      }

      let html = "";
      reviews.forEach((r) => {
        html += `
          <div class="review-card admin-review">
            <div><strong>Rating:</strong> ${r.rating}</div>
            <p><strong>Customer:</strong> ${r.customerName}</p>
            <p>${r.comment}</p>
            <p><strong>Review ID:</strong> ${r._id}</p>

            ${
              r.rebuttal
                ? `<div class="rebuttal"><strong>Your existing response:</strong> ${r.rebuttal.text}</div>`
                : `<div class="rebuttal empty">No response yet.</div>`
            }

            <textarea placeholder="Write your rebuttal here..." data-review-id="${
              r._id
            }"></textarea>
            <button class="submit-rebuttal-btn" data-review-id="${r._id}">
              Submit / Update Rebuttal
            </button>
          </div>
        `;
      });

      dashboardReviews.innerHTML = html;
      attachRebuttalHandlers();
    });
});

function attachRebuttalHandlers() {
  const buttons = document.querySelectorAll(".submit-rebuttal-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const reviewId = btn.getAttribute("data-review-id");
      const textarea = document.querySelector(
        `textarea[data-review-id="${reviewId}"]`
      );
      const text = textarea.value.trim();

      if (!text) {
        alert("Please enter a rebuttal.");
        return;
      }

      fetch(`/reviews/rebuttal/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then((res) => res.json())
        .then(() => {
          alert("Rebuttal saved!");
        });
    });
  });
}
