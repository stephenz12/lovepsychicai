.then((data) => {
  if (data && data.email) {
    const emailSpan = document.getElementById("adminEmail");
    if (emailSpan) {
      emailSpan.textContent = "Logged in as: " + data.email;
    }
  }

  // block non-admins from admin pages
  if (data.role !== "admin") {
    alert("You do not have permission to view this page.");
    window.location.href = "/login.html";
    return;
  }
})
