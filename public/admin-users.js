const usersList = document.getElementById("usersList");
const refreshBtn = document.getElementById("refreshBtn");

// Load users from backend
function loadUsers() {
  const token = localStorage.getItem("authToken");

  fetch("/admin/users", {
    headers: {
      Authorization: "Bearer " + token,
    },
  })
    .then((res) => res.json())
    .then((data) => {
      // data = array of users from server

      if (!Array.isArray(data) || data.length === 0) {
        usersList.innerHTML = `<p>No users found.</p>`;
        return;
      }

      let html = `
        <table style="width:100%; border-collapse: collapse;">
          <tr>
            <th style="text-align:left; padding:8px;">User ID</th>
            <th style="text-align:left; padding:8px;">Credits</th>
          </tr>
      `;

      data.forEach((user) => {
        html += `
          <tr>
            <td style="padding:8px; border-top: 1px solid #7f3bf5;">
              ${user.userId}
            </td>
            <td style="padding:8px; border-top: 1px solid #7f3bf5;">
              $${(user.credits || 0).toFixed(2)}
            </td>
          </tr>
        `;
      });

      html += `</table>`;
      usersList.innerHTML = html;
    })
    .catch((err) => {
      usersList.innerHTML = `<p style="color:red;">Error loading users.</p>`;
      console.error(err);
    });
}

// Initial load
loadUsers();

// Refresh button
refreshBtn.addEventListener("click", loadUsers);
