// logout.js

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) return; // Exit if no logout button on the page

  logoutBtn.addEventListener("click", (event) => {
    event.preventDefault();

    const confirmLogout = confirm("Are you sure you want to log out?");
    if (!confirmLogout) return;

    // Clear all user-related localStorage items
    const keysToRemove = [
      "access_token",
      "user_id",
      "username",
      "age",
      "email",
      "esp_connected"
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Redirect to sign-in page
    window.location.href = "signin.html";

    
  });
});
