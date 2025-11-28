console.log("LOGIN.JS LOADED");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

loginBtn.addEventListener("click", (event) => {
  event.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginMessage.textContent = "Please enter email and password.";
    loginMessage.style.color = "#ff6b6b";
    return;
  }

  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("LOGIN RESPONSE:", data);

      if (data.error) {
        loginMessage.textContent = data.error;
        loginMessage.style.color = "#ff6b6b";
        return;
      }

      localStorage.setItem("authToken", data.token);
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("userEmail", data.email);
      localStorage.setItem("userRole", data.role);

      // NEW: Store combined user info for wallet.js
      localStorage.setItem(
        "userInfo",
        JSON.stringify({
          userId: data.userId,
          email: data.email,
          role: data.role,
        })
      );

      loginMessage.textContent = "Login successful! Redirecting...";
      loginMessage.style.color = "#00ffb7";

      // Redirect based on role
      setTimeout(() => {
        if (data.role === "admin") {
          window.location.href = "admin.html"; // Admin dashboard
        } else if (data.role === "advisor") {
          window.location.href = "advisor-dashboard.html"; // Advisor dashboard
        } else {
          window.location.href = "index.html"; // Regular user home
        }
      }, 800);
    })
    .catch((err) => {
      console.error(err);
      loginMessage.textContent = "Error logging in.";
      loginMessage.style.color = "#ff6b6b";
    });
});
