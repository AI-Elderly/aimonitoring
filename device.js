// device.js - FIXED VERSION with correct data handling

if (!document.getElementById("connect-btn")) {
    console.warn("⚠️ device.js loaded on non-device page. Script skipped.");
} else {

  console.log("🚀 Device.js initialized");

  const connectBtn = document.getElementById("connect-btn");
  const statusText = document.getElementById("device-status");
  const errorMessage = document.getElementById("error-message");
  const deviceInfo = document.getElementById("device-info");
  const loading = document.getElementById("loading");

  const backendURL = "https://semimaterialistic-hyperbolic-laverne.ngrok-free.dev";
  const esp32Direct = "http://192.168.100.18";
  const esp32Proxy = `${backendURL}/esp32`;
  
  let isConnected = false;
  let pollInterval = null;
  let useProxy = false;
  let pollCount = 0;

  const getUserId = () => localStorage.getItem("user_id");
  const getToken = () => localStorage.getItem("access_token");

  console.log("User ID:", getUserId());
  console.log("Token exists:", !!getToken());

  function updateDeviceInfoUI(data) {
      console.log("📊 Updating UI with raw data:", JSON.stringify(data));
      
      // ⭐ Handle different possible data formats
      const hr = data.heart_rate || data.heartRate || data.bpm || data.hr || 0;
      const spo2 = data.spo2 || data.SpO2 || data.oxygen || 0;
      const ir = data.ir || data.IR || 0;
      const red = data.red || data.RED || 0;
      
      console.log(`📈 Parsed values - HR: ${hr}, SpO2: ${spo2}, IR: ${ir}, RED: ${red}`);
      
      document.getElementById("hr-value").textContent = hr;
      document.getElementById("spo2-value").textContent = spo2;
      document.getElementById("ir-value").textContent = ir;
      document.getElementById("red-value").textContent = red;
      deviceInfo.classList.remove("hidden");
      
      // ⭐ Return parsed values for backend storage
      return { heart_rate: hr, spo2: spo2, ir: ir, red: red };
  }

  async function fetchJSON(url, options = {}) {
      options.headers = {
          ...(options.headers || {}),
          "Authorization": `Bearer ${getToken()}`,
          "ngrok-skip-browser-warning": "true",
      };
      try {
          console.log(`🌐 Fetching: ${url}`);
          const res = await fetch(url, options);
          const text = await res.text();
          try {
              const data = JSON.parse(text);
              console.log(`✅ Response received:`, data);
              return { ok: res.ok, data };
          } catch {
              console.error("❌ Invalid JSON response:", text.substring(0, 200));
              return { ok: false, error: "Invalid JSON from backend", raw: text };
          }
      } catch (err) {
          console.error("❌ Fetch error:", err.message);
          return { ok: false, error: err.message };
      }
  }

  // ⭐ CRITICAL: Send reading to backend
  async function sendReadingToBackend(payload) {
      if (!getToken()) {
          console.warn("⚠️ No token - skipping backend send");
          return;
      }
      
      console.log("📤 SENDING TO BACKEND:", JSON.stringify(payload, null, 2));
      
      const { ok, data, error } = await fetchJSON(`${backendURL}/sensor-readings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
      });

      if (!ok) {
          console.error("❌ Backend storage FAILED:", error);
      } else {
          console.log(`✅ Backend stored successfully! Reading ID: ${data.reading_id}`);
      }
  }

  // ⭐ Poll ESP32 and send to backend
  async function pollReadings() {
      pollCount++;
      console.log(`\n📡 [Poll #${pollCount}] ================================`);
      
      try {
          const endpoint = useProxy ? `${esp32Proxy}/readings` : `${esp32Direct}/readings`;
          console.log(`Endpoint: ${endpoint}`);
          
          const res = await fetchJSON(endpoint);

          if (!res.ok) {
              if (!useProxy) {
                  console.log("Direct connection failed, switching to proxy...");
                  useProxy = true;
                  return await pollReadings();
              }
              throw new Error(res.error || "ESP32 unreachable");
          }

          const rawData = res.data;
          console.log("📦 RAW ESP32 Response:", JSON.stringify(rawData, null, 2));

          // Device is connected
          if (!isConnected) {
              isConnected = true;
              statusText.textContent = "🟢 Device Connected";
              statusText.classList.remove("status-disconnected");
              statusText.classList.add("status-normal");
              connectBtn.textContent = "Disconnect Device";
              console.log("✅ ESP32 connection established");
          }

          // ⭐ Update UI and get parsed values
          const parsedData = updateDeviceInfoUI(rawData);
          console.log("✨ Parsed for backend:", JSON.stringify(parsedData, null, 2));

          // ⭐ CRITICAL: Use the PARSED values, not raw data
          const payload = {
              user_id: Number(getUserId()) || 1,
              heart_rate: parsedData.heart_rate,
              spo2: parsedData.spo2,
              ir: parsedData.ir,
              red: parsedData.red
          };
          
          console.log("🎯 Final payload:", JSON.stringify(payload, null, 2));
          
          // Only send if we have valid readings (not all zeros)
          if (payload.heart_rate > 0 || payload.spo2 > 0) {
              await sendReadingToBackend(payload);
          } else {
              console.warn("⚠️ Skipping backend send - all values are 0 (sensor warming up?)");
          }

          errorMessage.textContent = "";

      } catch (err) {
          console.error("❌ ESP32 polling error:", err);
          isConnected = false;
          statusText.textContent = "🔴 Device Disconnected";
          statusText.classList.remove("status-normal");
          statusText.classList.add("status-disconnected");
          errorMessage.textContent = err.message;
          deviceInfo.classList.add("hidden");
          connectBtn.textContent = "Connect Device";
      }
      
      console.log(`================================ [End Poll #${pollCount}]\n`);
  }

  // Initialize on page load
  window.addEventListener("load", () => {
      console.log("🔄 Page loaded - checking credentials...");
      
      if (!getToken() || !getUserId()) {
          console.error("❌ Missing credentials, redirecting to signin");
          window.location.href = "signin.html";
          return;
      }

      const savedStatus = localStorage.getItem("esp_connected");
      console.log("Saved ESP status:", savedStatus);

      if (savedStatus === "true") {
          console.log("♻️ Auto-reconnecting to ESP32...");
          isConnected = true;
          statusText.textContent = "🟢 Connected";
          statusText.classList.add("status-normal");
          connectBtn.textContent = "Disconnect Device";
          deviceInfo.classList.remove("hidden");
          
          pollReadings();
          pollInterval = setInterval(pollReadings, 3000);
          console.log("✅ Polling started (every 3 seconds)");
      } else {
          console.log("ℹ️ Device not auto-connected. Click 'Connect Device' button.");
      }
  });

  // Connect/Disconnect button
  connectBtn.addEventListener("click", async () => {
      console.log("\n🔘 Connect button clicked");

      if (!getToken() || !getUserId()) {
          alert("⚠️ You must log in first.");
          window.location.href = "signin.html";
          return;
      }

      if (isConnected) {
          console.log("🔌 Disconnecting...");
          if (pollInterval) clearInterval(pollInterval);
          isConnected = false;
          localStorage.removeItem("esp_connected");
          statusText.textContent = "🔴 Device Disconnected";
          statusText.classList.remove("status-normal");
          statusText.classList.add("status-disconnected");
          deviceInfo.classList.add("hidden");
          errorMessage.textContent = "";
          connectBtn.textContent = "Connect Device";
          console.log("✅ Disconnected successfully");
          return;
      }

      // Try to connect
      console.log("🔗 Attempting to connect to ESP32...");
      statusText.textContent = "🕐 Connecting to ESP32...";
      loading.classList.remove("hidden");
      errorMessage.textContent = "";
      connectBtn.disabled = true;
      connectBtn.textContent = "Connecting...";

      try {
          const endpoint = `${esp32Direct}/connect`;
          console.log(`Trying direct connection: ${endpoint}`);
          
          let res = await fetchJSON(endpoint);
          
          if (!res.ok) {
              console.log("Direct failed, trying proxy...");
              useProxy = true;
              res = await fetchJSON(`${esp32Proxy}/connect`);
          }
          
          if (!res.ok) throw new Error(res.error || "ESP32 unreachable");

          const data = res.data;
          console.log("Connection response:", data);

          if (data?.status === "connected" || data) {
              isConnected = true;
              localStorage.setItem("esp_connected", "true");
              statusText.textContent = "🟢 Device Connected Successfully!";
              statusText.classList.remove("status-disconnected");
              statusText.classList.add("status-normal");
              connectBtn.textContent = "Disconnect Device";
              deviceInfo.classList.remove("hidden");

              console.log("✅ Connection successful! Starting polling...");
              pollReadings();
              pollInterval = setInterval(pollReadings, 3000);
              return;
          }

          throw new Error("ESP32 did not confirm connection");

      } catch (err) {
          console.error("❌ Connection failed:", err);
          statusText.textContent = "⚠️ ESP32 unreachable";
          statusText.classList.remove("status-normal");
          statusText.classList.add("status-disconnected");
          errorMessage.textContent = `${err.message}. Make sure ESP32 is on the same network.`;
          connectBtn.textContent = "Try Again";
      } finally {
          loading.classList.add("hidden");
          connectBtn.disabled = false;
      }
  });

  console.log("✅ Device.js setup complete - ready to connect");

}