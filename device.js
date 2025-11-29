// device.js

if (!document.getElementById("connect-btn")) {
    console.warn("device.js loaded on non-device page. Script skipped.");
} else {

  // ----------------------------------------------------
  // DOM ELEMENTS
  // ----------------------------------------------------
  const connectBtn = document.getElementById("connect-btn");
  const statusText = document.getElementById("device-status");
  const errorMessage = document.getElementById("error-message");
  const deviceInfo = document.getElementById("device-info");
  const loading = document.getElementById("loading");

  // ----------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------
  const backendURL = "https://semimaterialistic-hyperbolic-laverne.ngrok-free.dev";
  const esp32Proxy = `${backendURL}/esp32`; // Proxy endpoint on backend
  let isConnected = false;
  let pollInterval = null;

  // ----------------------------------------------------
  // HELPERS
  // ----------------------------------------------------
  const getUserId = () => localStorage.getItem("user_id");
  const getToken = () => localStorage.getItem("access_token");

  function updateDeviceInfoUI(data) {
      document.getElementById("hr-value").textContent = data.heart_rate ?? "--";
      document.getElementById("spo2-value").textContent = data.spo2 ?? "--";
      document.getElementById("ir-value").textContent = data.ir ?? "--";
      document.getElementById("red-value").textContent = data.red ?? "--";
      deviceInfo.classList.remove("hidden");
  }

  async function fetchJSON(url, options = {}) {
      options.headers = {
          ...(options.headers || {}),
          "Authorization": `Bearer ${getToken()}`,
          "ngrok-skip-browser-warning": "true",
      };
      try {
          const res = await fetch(url, options);
          const text = await res.text();
          try {
              return { ok: res.ok, data: JSON.parse(text) };
          } catch {
              console.error("❌ Backend returned invalid JSON:", text);
              return { ok: false, error: "Invalid JSON", raw: text };
          }
      } catch (err) {
          console.error("❌ Fetch failed:", err);
          return { ok: false, error: err.message };
      }
  }

  // ----------------------------------------------------
  // SEND READING TO BACKEND
  // ----------------------------------------------------
  async function sendReadingToBackend(payload) {
      if (!getToken()) return;
      const { ok, data, error } = await fetchJSON(`${backendURL}/sensor-readings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
      });

      if (!ok) {
          errorMessage.textContent = `Backend error: ${error || "Unknown"}`;
      } else {
          errorMessage.textContent = "";
          console.log("Backend stored reading:", data);
      }
  }

  // ----------------------------------------------------
  // POLL ESP32 THROUGH BACKEND PROXY
  // ----------------------------------------------------
  async function pollReadings() {
      try {
          const res = await fetchJSON(`${esp32Proxy}/readings`);
          if (!res.ok) throw new Error(res.error || "ESP32 proxy failed");
          const data = res.data;

          updateDeviceInfoUI(data);

          await sendReadingToBackend({
              user_id: Number(getUserId()) || 1,
              heart_rate: data.heart_rate ?? null,
              spo2: data.spo2 ?? null,
              ir: data.ir ?? null,
              red: data.red ?? null
          });

      } catch (err) {
          errorMessage.textContent = `Polling error: ${err.message}`;
      }
  }

  // ----------------------------------------------------
  // RESTORE CONNECTION ON PAGE LOAD
  // ----------------------------------------------------
  window.addEventListener("load", () => {
      if (!getToken() || !getUserId()) {
          window.location.href = "signin.html";
          return;
      }

      const savedStatus = localStorage.getItem("esp_connected");

      if (savedStatus === "true") {
          isConnected = true;
          statusText.textContent = "🟢 Connected";
          connectBtn.textContent = "Disconnect Device";
          deviceInfo.classList.remove("hidden");
          pollReadings();
          pollInterval = setInterval(pollReadings, 3000);
      }
  });

  // ----------------------------------------------------
  // CONNECT BUTTON HANDLER
  // ----------------------------------------------------
  connectBtn.addEventListener("click", async () => {

      if (!getToken() || !getUserId()) {
          alert("⚠️ You must log in first.");
          window.location.href = "signin.html";
          return;
      }

      if (isConnected) {
          if (pollInterval) clearInterval(pollInterval);
          localStorage.removeItem("esp_connected");
          isConnected = false;
          statusText.textContent = "🔴 Device disconnected";
          deviceInfo.classList.add("hidden");
          errorMessage.textContent = "";
          connectBtn.textContent = "Connect Device";
          return;
      }

      statusText.textContent = "🕐 Connecting to ESP32...";
      loading.classList.remove("hidden");
      errorMessage.textContent = "";
      connectBtn.disabled = true;
      connectBtn.textContent = "Connecting...";

      try {
          const res = await fetchJSON(`${esp32Proxy}/connect`);
          if (!res.ok) throw new Error(res.error || "ESP32 proxy failed");
          const data = res.data;

          if (data?.status === "connected") {
              isConnected = true;
              localStorage.setItem("esp_connected", "true");
              statusText.textContent = "🟢 Device Connected Successfully!";
              connectBtn.textContent = "Disconnect Device";
              deviceInfo.classList.remove("hidden");

              pollReadings();
              pollInterval = setInterval(pollReadings, 3000);
              return;
          }

          throw new Error("ESP32 did not confirm connection");

      } catch (err) {
          statusText.textContent = "⚠️ ESP32 unreachable";
          errorMessage.textContent = err.message;
          connectBtn.textContent = "Try Again";
      } finally {
          loading.classList.add("hidden");
          connectBtn.disabled = false;
      }
  });

} // END of device.js wrapper
