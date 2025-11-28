const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regPassword2 = document.getElementById("regPassword2");
const registerBtn = document.getElementById("registerBtn");
const registerMessage = document.getElementById("registerMessage");

registerBtn.addEventListener("click", () => {
  const email = regEmail.value.trim();
  const password = regPassword.value;
  const password2 = regPassword2.value;

  if (!email || !password || !password2) {
    registerMessage.textContent = "Please fill in all fields.";
    registerMessage.style.color = "#ff6b6b";
    return;
  }

  if (password !== password2) {
    registerMessage.textContent = "Passwords do not match.";
    registerMessage.style.color = "#ff6b6b";
    return;
  }

  fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        registerMessage.textContent = data.error;
        registerMessage.style.color = "#ff6b6b";
        return;
      }

      registerMessage.textContent = "Account created! Redirecting to login...";
      registerMessage.style.color = "#00ffb7";

      setTimeout(() => {
        window.location.href = "/login.html";
      }, 1000);
    })
    .catch((err) => {
      console.error(err);
      registerMessage.textContent = "Error creating account.";
      registerMessage.style.color = "#ff6b6b";
    });
});
