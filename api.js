// frontend/js/api.js
// ✅ Flask backend URL - CHANGE THIS TO YOUR COMPUTER'S IP
const BASE_URL = 'https://semimaterialistic-hyperbolic-laverne.ngrok-free.dev';

// Signup
async function signup(fullname, age, email, password) {
  const res = await fetch(`${BASE_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullname, age, email, password })
  });

  const data = await res.json();
  console.log("Signup response:", data);
  return data;
}

// Login
async function login(username, password) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  console.log("Login response:", data);

  if (res.ok && data.access_token) {
    // Save using standardized key "access_token"
    localStorage.setItem("access_token", data.access_token);
    // Save older key for compatibility (optional migration)
    localStorage.setItem("token", data.access_token);

    // Also store useful user info if provided
    if (data.username) localStorage.setItem("username", data.username);
    if (data.patient_id) localStorage.setItem("patient_id", data.patient_id);
  } else {
    console.error("Login failed:", data);
  }

  return data;
}

// Fetch health logs
async function getHealthLogs() {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("No access token stored");

  const res = await fetch(`${BASE_URL}/healthlogs`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    }
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Request failed: ${res.status} ${res.statusText} - ${errBody}`);
  }

  return await res.json();
}

// Generic API fetch helper
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("access_token") || localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  const res = await fetch(BASE_URL + endpoint, {
    ...options,
    headers
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error("Request failed: " + res.status + " - " + body);
  }

  // Try to parse JSON, but return raw text if not JSON
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}
