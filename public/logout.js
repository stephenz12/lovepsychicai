// GLOBAL LOGOUT HANDLER

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    const token = localStorage.getItem("authToken");

    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    fetch("/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(() => {
        localStorage.clear();
        window.location.href = "/login.html";
      })
      .catch(() => {
        localStorage.clear();
        window.location.href = "/login.html";
      });
  });
}
