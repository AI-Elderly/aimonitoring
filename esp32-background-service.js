// esp32-background-service.js
// Include this script in dashboard.html and healthlogs.html to auto-connect to ESP32

(function() {
  'use strict';

  console.log("🤖 ESP32 Background Service initialized");

  const backendURL = "https://semimaterialistic-hyperbolic-laverne.ngrok-free.dev";
  const esp32Proxy = `${backendURL}/esp32`;
  
  let isConnected = false;
  let pollInterval = null;
  let pollCount = 0;
  let connectionAttempts = 0;
  const MAX_RETRY = 3;

  const getUserId = () => localStorage.getItem("user_id");
  const getToken = () => localStorage.getItem("access_token");

  // Check if auto-connect is enabled
  const isAutoConnectEnabled = () => {
    return localStorage.getItem("esp_auto_connect") === "true";
  };

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
              return { ok: false, error: "Invalid JSON" };
          }
      } catch (err) {
          return { ok: false, error: err.message };
      }
  }

  // Send reading to backend
  async function sendReadingToBackend(payload) {
      if (!getToken()) return;
      
      const { ok, data, error } = await fetchJSON(`${backendURL}/sensor-readings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
      });

      if (ok) {
          console.log(`📊 [Background] Stored reading ID: ${data.reading_id}`);
      } else {
          console.error("❌ [Background] Backend error:", error);
      }
  }

  // Poll ESP32 readings
  async function pollReadings() {
      if (!isAutoConnectEnabled()) {
          console.log("⏸️ [Background] Auto-connect disabled, stopping polling");
          stopPolling();
          return;
      }

      pollCount++;
      
      try {
          // ✅ ALWAYS use proxy endpoint
          const endpoint = `${esp32Proxy}/readings`;
          const res = await fetchJSON(endpoint);

          if (!res.ok) {
              throw new Error(res.error || "ESP32 unreachable");
          }

          const rawData = res.data;
          
          // Reset connection attempts on success
          connectionAttempts = 0;

          if (!isConnected) {
              isConnected = true;
              console.log("✅ [Background] ESP32 connected");
          }

          // Parse and send data
          const hr = rawData.heart_rate || rawData.heartRate || rawData.bpm || 0;
          const spo2 = rawData.spo2 || rawData.SpO2 || 0;
          const ir = rawData.ir || rawData.IR || 0;
          const red = rawData.red || rawData.RED || 0;

          if (hr > 0 || spo2 > 0) {
              const payload = {
                  user_id: Number(getUserId()) || 1,
                  heart_rate: hr,
                  spo2: spo2,
                  ir: ir,
                  red: red
              };

              if (pollCount % 10 === 0) {
                  console.log(`📡 [Background Poll #${pollCount}] HR: ${hr}, SpO2: ${spo2}`);
              }

              await sendReadingToBackend(payload);
          }

      } catch (err) {
          if (isConnected) {
              console.warn(`⚠️ [Background] Connection lost: ${err.message}`);
              isConnected = false;
          }

          connectionAttempts++;
          
          if (connectionAttempts >= MAX_RETRY) {
              console.error(`❌ [Background] Max retries (${MAX_RETRY}) reached, stopping auto-connect`);
              stopPolling();
              localStorage.removeItem("esp_auto_connect");
          }
      }
  }

  // Start polling
  function startPolling() {
      if (pollInterval) return;
      console.log("✅ [Background] Started ESP32 polling (every 3s)");
      pollInterval = setInterval(pollReadings, 3000);
  }

  // Stop polling
  function stopPolling() {
      if (!pollInterval) return;
      console.log("⏸️ [Background] Stopped ESP32 polling");
      clearInterval(pollInterval);
      pollInterval = null;
      isConnected = false;
  }

  // Attempt initial connection
  async function attemptConnection() {
      if (!isAutoConnectEnabled()) {
          console.log("ℹ️ [Background] Auto-connect disabled");
          return;
      }

      console.log("🔗 [Background] Attempting ESP32 connection via proxy...");

      try {
          // ✅ ALWAYS use proxy endpoint
          const endpoint = `${esp32Proxy}/connect`;
          const res = await fetchJSON(endpoint);
          
          if (!res.ok) throw new Error("ESP32 unreachable");

          console.log("✅ [Background] ESP32 connected successfully");
          isConnected = true;
          
          // Start polling
          pollReadings();
          startPolling();

      } catch (err) {
          console.warn(`⚠️ [Background] Initial connection failed: ${err.message}`);
          console.log("ℹ️ [Background] Will retry on next page visit or manual connection");
      }
  }

  // Visibility change handling
  document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
          // Page hidden - continue polling but reduce frequency
          if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = setInterval(pollReadings, 10000); // 10 seconds when hidden
              console.log("⏸️ [Background] Reduced polling frequency (page hidden)");
          }
      } else {
          // Page visible - restore normal frequency
          if (isAutoConnectEnabled() && !pollInterval) {
              startPolling();
          } else if (pollInterval) {
              clearInterval(pollInterval);
              startPolling(); // Restore 3 second interval
              console.log("▶️ [Background] Restored polling frequency (page visible)");
          }
      }
  });

  // Initialize on load
  window.addEventListener("load", () => {
      if (!getToken() || !getUserId()) {
          console.log("⚠️ [Background] No credentials, skipping auto-connect");
          return;
      }

      // Auto-connect if enabled
      if (isAutoConnectEnabled()) {
          attemptConnection();
      } else {
          console.log("ℹ️ [Background] Auto-connect not enabled. Connect via device.html first.");
      }
  });

  // Expose global control functions
  window.ESP32BackgroundService = {
    start: () => {
      localStorage.setItem("esp_auto_connect", "true");
      if (!pollInterval) attemptConnection();
    },
    stop: () => {
      localStorage.removeItem("esp_auto_connect");
      stopPolling();
    },
    status: () => ({
      connected: isConnected,
      polling: !!pollInterval,
      autoConnect: isAutoConnectEnabled(),
      pollCount: pollCount
    })
  };

})();