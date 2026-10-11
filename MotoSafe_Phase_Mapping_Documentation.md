# 🛡️ MotoSafe — Software Implementation Phase Mapping & Documentation

> **Project Name:** MotoSafe — Motor Health & Condition Monitoring System  
> **Architecture:** Vanilla HTML5/CSS3/JS + Node.js Express + WebSockets + MQTT + ESP32 C++ Firmware  
> **Dashboard URL:** [http://localhost:3000](http://localhost:3000)

---

## 📊 Summary Implementation Status

- **Total Planned Phases:** 24 Phases  
- **Completed Phases:** **17 Phases** ✅  
- **Pending / Next Phases:** **7 Phases** ⏳ (Hardware flashing, cloud security & final deployment)

---

## 🗺️ Complete Phase-by-Phase Technical Mapping

### Phase 1 — Finalize Software Architecture
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 7–21) & [`server.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/server.js) (Lines 50–70)
- **Where in Dashboard:** Top Header -> Connection Mode Indicator (`Data Mode: Simulated ESP32` / `ESP32 REST` / `MQTT`)
- **Functionality & How It Works:**  
  Defines standardized JSON schema payloads and data adapters (`mock`, `rest`, `websocket`, `mqtt`). Ensures seamless data translation between ESP32 hardware, Node.js backend, and the browser UI without rewriting dashboard code.

---

### Phase 2 — Prepare Existing Dashboard UI
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\index.html`](file:///c:/Users/pc4/Desktop/MotoSafe/index.html) & [`styles.css`](file:///c:/Users/pc4/Desktop/MotoSafe/styles.css)
- **Where in Dashboard:** Entire Web Dashboard UI at [http://localhost:3000](http://localhost:3000)
- **Functionality & How It Works:**  
  Built a clean single-page industrial dark theme dashboard with 6 tabs (*Overview*, *Live Sensors*, *Analytics*, *Motor Control*, *ESP32 Firmware*, *Maintenance & Logs*), glassmorphism cards, responsive navigation, and Chart.js integration.

---

### Phase 3 — Build Mock Data Layer
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 110–160)
- **Where in Dashboard:** **Overview Tab** -> Live Metric Cards & Combined Telemetry Chart
- **Functionality & How It Works:**  
  Generates realistic physics data every 1000ms simulating motor operating conditions (Temp ~36.5°C, RPM ~1450, Current ~2.35A, Voltage 12.1V, Vibration ~1.45g RMS, Sound ~38.5dB, Power 28.4W, Efficiency 92.5%, Torque 0.85Nm).

---

### Phase 4 — Build Node.js Backend
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\server\server.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/server.js)
- **Where in Dashboard:** Serves web dashboard on [http://localhost:3000](http://localhost:3000) and exposes REST API routes
- **Functionality & How It Works:**  
  Express HTTP server providing endpoints: `GET /api/telemetry/live`, `GET /api/telemetry/history`, `POST /api/telemetry` (ESP32 receiver), and `POST /api/control` (Motor command relay).

---

### Phase 5 — MQTT Implementation
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\server\mqttClient.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/mqttClient.js) & [`server.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/server.js) (Lines 19–33)
- **Where in Dashboard:** **Motor Control Tab** -> Connection Mode Selector (`MQTT Broker`)
- **Functionality & How It Works:**  
  Node.js MQTT Subscriber to topic `motosafe/motor/+/telemetry` and Publisher to `motosafe/motor/MOTOR-01/control` connected to public broker (`broker.hivemq.com:1883`).

---

### Phase 6 — Build ESP32 Firmware
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\MotoSafe_ESP32_Firmware.ino`](file:///c:/Users/pc4/Desktop/MotoSafe/MotoSafe_ESP32_Firmware.ino)
- **Where in Dashboard:** **ESP32 Firmware Tab** -> Live C++ Code Viewer with Copy Button
- **Functionality & How It Works:**  
  C++ sketch configured for Arduino IDE with pin assignments for DS18B20 (GPIO 4), MPU6050 I2C (GPIO 21/22), ACS712 (GPIO 34), Voltage Divider (GPIO 35), Tachometer (GPIO 18), Physical Switch (GPIO 27), and Motor Relay (GPIO 26).

---

### Phase 7 — ESP32 Wi-Fi Connection
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`MotoSafe_ESP32_Firmware.ino`](file:///c:/Users/pc4/Desktop/MotoSafe/MotoSafe_ESP32_Firmware.ino) (Lines 80–100)
- **Where in Dashboard:** Top Header -> Connection Indicator Badges
- **Functionality & How It Works:**  
  Configures ESP32 SoftAccessPoint (`MotoSafe_ESP32_AP`, password: `motosafe_pass`) assigning static IP `http://192.168.4.1` for standalone wireless monitoring.

---

### Phase 8 — ESP32 Telemetry Software
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`MotoSafe_ESP32_Firmware.ino`](file:///c:/Users/pc4/Desktop/MotoSafe/MotoSafe_ESP32_Firmware.ino) (Lines 190–225)
- **Where in Dashboard:** **Live Sensors Tab** & Overview Metrics Grid
- **Functionality & How It Works:**  
  ESP32 periodically collects sensor values, formats them into a standardized `ArduinoJson` buffer (`/api/telemetry`), and publishes JSON packets over Wi-Fi / MQTT.

---

### Phase 9 — Backend Telemetry Processing & Validation
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`server.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/server.js) (Lines 135–150)
- **Where in Dashboard:** Telemetry trend charts & metric displays
- **Functionality & How It Works:**  
  Validates incoming JSON payloads (sanitizes numeric ranges for temp, rpm, current, voltage) before broadcasting to browser clients.

---

### Phase 10 — Motor Health Calculation Algorithm
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 186–222)
- **Where in Dashboard:** **Overview Tab** -> Health Score Card (`94 / 100`) & RUL Estimate (`98% / 420 hrs`)
- **Functionality & How It Works:**  
  Weighted anomaly algorithm calculating 0–100 health index (Temp 30%, Vibration 30%, Current 20%, RPM slip 10%, Sound 10%) and assigns risk levels (`EXCELLENT`, `MODERATE`, `CRITICAL`).

---

### Phase 11 — Persistence & Hysteresis Logic
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 376–430)
- **Where in Dashboard:** **Overview Tab** -> Active System Alerts Box
- **Functionality & How It Works:**  
  Requires **3 consecutive seconds** of sustained parameter spike before raising alarms (filters 1s noise). Includes hysteresis clear bands (e.g., Temp clears only when cooling <43.0°C) to prevent alarm flickering.

---

### Phase 12 — Database Persistence
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`c:\Users\pc4\Desktop\MotoSafe\server\database.json`](file:///c:/Users/pc4/Desktop/MotoSafe/server/database.json) & [`server.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/server.js) (Lines 30–45)
- **Where in Dashboard:** **Maintenance & Logs Tab** -> Historical Event Log Table
- **Functionality & How It Works:**  
  Persists telemetry history and anomaly event logs to disk (`database.json`), allowing historical recovery across server restarts.

---

### Phase 13 — WebSocket Implementation
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`server.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/server.js) (Lines 188–210) & [`app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js)
- **Where in Dashboard:** Real-time updating charts & numbers without page refreshes
- **Functionality & How It Works:**  
  WebSocket server on `ws://localhost:3000/ws` broadcasting 1000ms telemetry packets directly to all connected browser dashboards.

---

### Phase 14 — Dashboard Live-Data Integration
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 225–340)
- **Where in Dashboard:** Live metric cards, status badges, and sparkline charts
- **Functionality & How It Works:**  
  Unified `updateOverviewCards(telemetry)` pipeline updating values, progress bars, and percentage baseline deviations live.

---

### Phase 15 — Historical Graphs
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`index.html`](file:///c:/Users/pc4/Desktop/MotoSafe/index.html) & [`app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 720–850)
- **Where in Dashboard:** **Overview Tab** (Telemetry Trend Chart) & **Analytics Tab** (Correlation Graphs)
- **Functionality & How It Works:**  
  Chart.js integration displaying real-time temperature, vibration RMS, current, RPM, and motor health over time.

---

### Phase 16 — Alert System & Audio Warning
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 440–475) & Top Header (`#btn-toggle-audio`)
- **Where in Dashboard:** Top Header Audio Toggle & Active System Alerts Box
- **Functionality & How It Works:**  
  Displays alert warnings and triggers synthetic Web Audio API dual-tone warning chimes when high-risk anomalies occur.

---

### Phase 17 — Motor ON/OFF Remote Control
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`index.html`](file:///c:/Users/pc4/Desktop/MotoSafe/index.html) & [`app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 600–620)
- **Where in Dashboard:** **Overview Tab** (Quick Start/Stop Buttons) & **Motor Control Tab** (Power Switch & PWM Slider)
- **Functionality & How It Works:**  
  Issues POST requests to `/api/control` relaying motor power states (`RUNNING` / `STOPPED`) to the Node.js backend & ESP32.

---

### Phase 18 — Physical Switch Synchronization
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`MotoSafe_ESP32_Firmware.ino`](file:///c:/Users/pc4/Desktop/MotoSafe/MotoSafe_ESP32_Firmware.ino) (Lines 140–160) & [`index.html`](file:///c:/Users/pc4/Desktop/MotoSafe/index.html) (Line 91)
- **Where in Dashboard:** Sidebar Quick Summary Widget (`Source: Physical Rig Switch` / `Source: Web Dashboard`)
- **Functionality & How It Works:**  
  Monitors physical switch toggle on GPIO 27 of the ESP32 and updates the dashboard UI switch automatically to match true hardware state.

---

### Phase 19 — Role-Based Access Control (RBAC)
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`index.html`](file:///c:/Users/pc4/Desktop/MotoSafe/index.html) (Lines 708–740), [`styles.css`](file:///c:/Users/pc4/Desktop/MotoSafe/styles.css), [`app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 860–940)
- **Where in Dashboard:** Top Header -> Role Badge (`Role: Admin` / `Role: Technician` / `Role: Viewer`) & Login Modal
- **Functionality & How It Works:**  
  Provides 3 roles: **Admin** (Full control), **Technician** (Operator control), and **Viewer** (Read-only monitoring mode with controls locked).

---

### Phase 20 — Security & Token Authentication
- **Status:** ⏳ **NEXT PENDING PHASE**
- **Target File Location:** [`server.js`](file:///c:/Users/pc4/Desktop/MotoSafe/server/server.js)
- **Where in Dashboard:** Backend API middleware
- **Functionality to Implement:**  
  Add API rate limiting, JWT session tokens, and input sanitization to protect backend REST endpoints.

---

### Phase 21 — Testing Without Hardware (Fault Injectors)
- **Status:** ✅ **COMPLETED**
- **Exact File Location:** [`index.html`](file:///c:/Users/pc4/Desktop/MotoSafe/index.html) (Lines 455–477) & [`app.js`](file:///c:/Users/pc4/Desktop/MotoSafe/app.js) (Lines 620–630)
- **Where in Dashboard:** **Motor Control Tab** -> Demo Fault Injector Panel
- **Functionality & How It Works:**  
  Allows live demo testing by injecting simulated faults (*Overheating 58°C*, *High Vibration 3.8g*, *Overcurrent 4.5A*) to test alert popups without hardware.

---

### Phase 22 — Real ESP32 Integration
- **Status:** ⏳ **PENDING HARDWARE HANDOVER**
- **Target File Location:** Physical ESP32 Board
- **Where in Dashboard:** **Motor Control Tab** -> Connection Mode (`ESP32 REST / MQTT`)
- **Functionality to Execute:**  
  Flash `MotoSafe_ESP32_Firmware.ino` onto physical ESP32 via USB and connect sensors.

---

### Phase 23 — End-to-End System Testing
- **Status:** ⏳ **PENDING HARDWARE INTEGRATION**
- **Target File Location:** Full System Test
- **Where in Dashboard:** All Tabs & Physical Rig
- **Functionality to Execute:**  
  Test complete loop: Sensor -> ESP32 -> Wi-Fi -> MQTT/REST -> Backend -> WebSockets -> Dashboard.

---

### Phase 24 — Deployment & Final Project Presentation Package
- **Status:** ⏳ **READY TO GENERATE**
- **Target File Location:** Documentation & Cloud Host
- **Where in Dashboard:** Project Technical Manual & Final Demo
- **Functionality to Execute:**  
  Generate full technical documentation, PDF manual, and deploy backend to cloud host.

---

## 🛠️ Summary File Matrix

| File Name | Location | Primary Purpose |
| :--- | :--- | :--- |
| **`index.html`** | `c:\Users\pc4\Desktop\MotoSafe\index.html` | Frontend Dashboard UI structure & 6 tabs |
| **`styles.css`** | `c:\Users\pc4\Desktop\MotoSafe\styles.css` | Industrial dark theme styling & responsive layout |
| **`app.js`** | `c:\Users\pc4\Desktop\MotoSafe\app.js` | Dynamic telemetry engine, health algorithm, fault injectors, RBAC & Chart.js |
| **`server.js`** | `c:\Users\pc4\Desktop\MotoSafe\server\server.js` | Node.js Express server, REST API, WebSocket stream & DB logger |
| **`mqttClient.js`** | `c:\Users\pc4\Desktop\MotoSafe\server\mqttClient.js` | MQTT Publisher & Subscriber module |
| **`database.json`** | `c:\Users\pc4\Desktop\MotoSafe\server\database.json` | Persistent JSON database for historical telemetry logs |
| **`MotoSafe_ESP32_Firmware.ino`** | `c:\Users\pc4\Desktop\MotoSafe\MotoSafe_ESP32_Firmware.ino` | C++ Arduino sketch for ESP32 with HTTP REST & MQTT PubSub |
