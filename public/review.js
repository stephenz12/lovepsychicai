// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session");

if (!sessionId) {
  document.getElementById("reviewArea").innerHTML =
    "<p>Invalid review link.</p>";
}

// STEP 1 — VERIFY SESSION WITH SERVER
fetch(`/sessions/verify/${sessionId}`)
  .then((res) => res.json())
  .then((data) => {
    if (!data.valid) {
      document.getElementById("reviewArea").innerHTML =
        "<p>This review link is invalid or already used.</p>";
      return;
    }

    // STEP 2 — Show Review Form
    document.getElementById("reviewArea").innerHTML = `
      <h3>Review for Psychic</h3>
      
      <form id="reviewForm">
        <input type="number" id="rating" min="1" max="5" placeholder="Rating (1-5)" required><br><br>
        <textarea id="comment" placeholder="Your Review" required></textarea><br><br>
        <button type="submit">Submit Review</button>
      </form>
    `;

    // STEP 3 — Submit Review
    document.getElementById("reviewForm").addEventListener("submit", (e) => {
      e.preventDefault();

      fetch("/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          psychicId: data.psychicId,
          customerName: data.customerEmail.split("@")[0], // use email username as name
          rating: document.getElementById("rating").value,
          comment: document.getElementById("comment").value,
        }),
      }).then(() => {
        // STEP 4 — Mark session link as used
        fetch(`/sessions/use/${sessionId}`, { method: "POST" });

        document.getElementById("reviewArea").innerHTML =
          "<p>Thank you! Your review has been submitted.</p>";
      });
    });
  });
