# Seed Storybox Parent Dashboard

This repository contains the standalone Parent Companion App for the **Seed Storybox IoT Device**. It is designed to run in parent-only mode, without the virtual hardware simulation interface, serving as a dedicated setting controller, health diagnostics monitor, and live analytics dashboard.

## Features

- **Device Settings Controller**:
  - **Speaker Volume**: Slider control (0-100%).
  - **Narrator Voice Selector**: Toggle between Female and Male voices.
  - **Narrator Language**: Select speech output language (English, Italian, Spanish, French).
  - **Sleep Timer**: Auto-shutdown duration selection (Off, 15m, 30m, 60m).
  - **Average Story Length**: Control generated narrative length (Short, Medium, Long).
  - **LED Ring Settings**: Direct control over Adafruit NeoPixel ring brightness (0-255), animation speeds, and color selection (picker + quick swatches).
  - **Wi-Fi Setup**: Form to push network credentials directly to the Arduino's flash memory.

- **Diagnostics & Status Monitor**:
  - **Real-time Telemetry Cards**: Monitor live Battery %, CPU Temperature, and Wi-Fi RSSI signal strength.
  - **Physical Bead Slot Reader (Read-Only)**: Visualizes the exact food bead counts (Animal, Grain, Dairy, Plant) currently detected on the physical box's resistor ladders.
  - **Computed Story Metadata**: Displays the dynamic protagonist and pacing computed by the story engine based on bead placement.

- **Diagnostics Console & AI compiler**:
  - **Event Logs Console**: A scrollable terminal console logging all outgoing transmission configurations (`[TX CONFIG]`) and incoming data receipts (`[RX TELEMETRY]` / `[ACK RX]`).
  - **AI Prompt Compiler**: A live viewport compiling the final system instructions and API user payloads (Seed v2.2) according to the physical bead distribution.

---

## File Structure

```
seed_parent_app/
├── index.html   # Main HTML structure and semantic panels
├── style.css    # Premium HSL light theme, layout grids, styling
├── app.js       # Core controllers, WebSocket, HTTP, & Mock connection bridges
└── README.md    # Documentation (this file)
```

---

## How to Run & Test

1. **Locally via Web Browser**:
   Double-click the `index.html` file or run a local development server (e.g. using VS Code's Live Server or `npx http-server`).
   
2. **Demo Mode (Simulated)**:
   By default, the dashboard starts in **Simulated Demo Mode**.
   - It will automatically connect and log connection activity.
   - It simulates periodic telemetry updates (temperature fluctuations, slow battery discharge, and signal noise).
   - It simulates a child inserting and ejecting beads every 12 seconds to demonstrate live read-only slot updates.
   - Adjusting volume or light settings will immediately output corresponding JSON TX packets in the log console.

3. **Connecting to a Physical Arduino via WebSockets**:
   - Change the **Connection Type** dropdown to `Remote WebSocket Server`.
   - Enter your Arduino's ESP8266/ESP32 WebSocket IP address (e.g., `ws://192.168.1.20:8080`).
   - Click **Connect Board**.
   - The app will bridge serial transmissions automatically.

4. **Connecting via HTTP REST API**:
   - Set connection to `Remote REST API Client`.
   - Input the server endpoint URL (e.g. `http://192.168.1.20:80`).
   - The dashboard will poll `/telemetry` every 1.5 seconds and post configuration changes to `/config`.