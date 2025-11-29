document.addEventListener("DOMContentLoaded", () => {
    const espConnected = localStorage.getItem("esp_connected") === "true";
    const espIP = localStorage.getItem("esp32_ip");

    if (!espConnected || !espIP) {
        alert("⚠️ ESP32 is not connected. Please connect it first.");
        window.location.href = "device.html";
        return;
    }

    const backendURL = "https://semimaterialistic-hyperbolic-laverne.ngrok-free.dev";
    const userId = 1;

    const heart = document.getElementById("live-heart-rate");
    const spo2 = document.getElementById("live-spo2");
    const timestamp = document.getElementById("live-timestamp");

    async function pollESP() {
        try {
            const res = await fetch(`${espIP}/readings`);
            const data = await res.json();

            // Update UI
            heart.textContent = data.heart_rate ?? "—";
            spo2.textContent = data.spo2 ?? "—";
            timestamp.textContent = new Date().toLocaleTimeString();

            // Send to backend
            await fetch(backendURL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: userId,
                    heart_rate: data.heart_rate,
                    spo2: data.spo2,
                    ir: data.ir,
                    red: data.red
                })
            });

            console.log("📩 ESP32 → UI → Backend OK");

        } catch (err) {
            console.error("ESP Polling Error:", err);
        }
    }

    // Poll every 3 seconds
    pollESP();
    setInterval(pollESP, 3000);
});
