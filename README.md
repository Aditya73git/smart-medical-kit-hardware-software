# 🏥 Smart Medical Box (ESP32 IoT + Real-Time Web Platform)

A full-stack, cloud-ready IoT Medicine Reminder System featuring:
- **Direct USB Cable Hardware Link (Web Serial API)**: Plug any ESP32 into your PC/Laptop using a standard USB cable (Type-B / Micro-USB / Type-C), click **Connect USB**, and control the physical hardware directly from the web interface — works whether running on `localhost`, **GitHub Pages**, or **Vercel**!
- **Visual & Audio Alarms**: 3 physical LEDs for Morning (GPIO 19), Afternoon (GPIO 18), and Night (GPIO 5), plus Active Buzzer (GPIO 23) and I2C OLED display (SSD1306).
- **Patient Confirmation Button**: Tactile push button (GPIO 4) with 10-second response window.
- **Interactive 3D Adherence Donut**: Isometric 3D SVG adherence breakdown that updates in real time.
- **Sliding Schedule Drawer**: Adjust dose times in simple 12-Hour AM/PM format; automatically syncs to the physical ESP32 timers.
- **Dual-Mode Connectivity**: Works offline via direct USB cable link or wirelessly over Wi-Fi with Telegram bot notifications.

---

## 🔌 Circuit Diagram & Hardware Pinout

| Component | Pin / Terminal | ESP32 Pin | Details & Wiring |
|---|---|---|---|
| **OLED Display (0.96" SSD1306)** | VCC | **3.3V or 5V** | Power rail |
| | GND | **GND** | Ground rail |
| | SCL | **GPIO 22** | I2C Clock |
| | SDA | **GPIO 21** | I2C Data |
| **LED 1 (Morning - Green)** | Anode (+) | **GPIO 19** | Connect via 220Ω resistor to GPIO 19 |
| | Cathode (-) | **GND** | Connect to ground rail |
| **LED 2 (Afternoon - Yellow)** | Anode (+) | **GPIO 18** | Connect via 220Ω resistor to GPIO 18 |
| | Cathode (-) | **GND** | Connect to ground rail |
| **LED 3 (Night - Red)** | Anode (+) | **GPIO 5** | Connect via 220Ω resistor to GPIO 5 |
| | Cathode (-) | **GND** | Connect to ground rail |
| **Active Buzzer** | Positive (+) | **GPIO 23** | Alarm sound |
| | Negative (-) | **GND** | Ground rail |
| **Push Button** | Terminal 1 | **GPIO 4** | Uses internal pull-up (`INPUT_PULLUP`) |
| | Terminal 2 | **GND** | When pressed, pulls GPIO 4 to LOW |
| **USB Data Cable** | Type-B / Micro / Type-C | **USB Port** | Connect to computer running Chrome/Edge |

---

## ⚡ Direct USB Cable Control (How It Works)

Cloud platforms like **Vercel** cannot open local COM ports on your machine because code runs in the cloud. We solved this with the browser-native **Web Serial API**:

1. Plug your ESP32 into your computer using a **data transfer USB cable**.
2. Open your website on **Google Chrome, Microsoft Edge, Brave, or Opera** (on localhost or `https://your-app.vercel.app`).
3. Click the **"Connect USB"** button in the top header or in the **Hardware Digital Twin** panel.
4. Select your ESP32's COM port (e.g. `CP2102 USB to UART Bridge` or `CH340`) and click **Connect**.
5. You're linked! You can now:
   - Click **Simulate Dose 1 / 2 / 3**: Lights up physical LEDs on your breadboard and sounds the physical buzzer.
   - Press the **physical push button on your ESP32**: The web dashboard registers "Medicine Taken" in real time.
   - Adjust schedule in the **sliding drawer**: Uploads your timer settings to the ESP32.
   - Click **Take Medicine** in browser: Stops the physical buzzer immediately.

---

## 🚀 How to Flash the ESP32 Code

### 1. Arduino IDE Setup
1. Download and open [Arduino IDE](https://www.arduino.cc/en/software).
2. Install the **ESP32 Board Package**:
   - Go to **File** -> **Preferences** -> paste into *Additional Boards Manager URLs*:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to **Tools** -> **Board** -> **Boards Manager**, search for `esp32` and install.
3. Install required libraries:
   - Go to **Sketch** -> **Include Library** -> **Manage Libraries...**
   - Search & install **Adafruit SSD1306**
   - Search & install **Adafruit GFX Library**
4. Open [`SmartMedicalBox/SmartMedicalBox.ino`](SmartMedicalBox/SmartMedicalBox.ino).
5. Select your board: **Tools** -> **Board** -> **ESP32 Dev Module**.
6. Select your COM Port: **Tools** -> **Port**.
7. Click **Upload** (Arrow icon).

*(Note: The ESP32 works immediately over the USB cable even if Wi-Fi credentials are empty or disconnected).*

---

## 💻 Local Running & Development

To test the server locally on your machine:

```bash
# 1. Install dependencies
npm install

# 2. Start the local server
npm start
# (or node server.js)

# 3. Open browser
http://localhost:5000
```

---

## 🌐 Deploy to Vercel (Step-by-Step)

This repository includes configured files (`vercel.json`, `api/index.js`, and `.gitignore`) for seamless one-click Vercel deployment.

### Method 1: Deploy via GitHub (Recommended)
1. Initialize git and push the project to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Smart Medical Box"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **"Add New..."** -> **"Project"**.
4. Select your GitHub repository.
5. Keep default settings (Framework Preset: *Other*, Root Directory: `./`).
6. Click **Deploy**.
7. Vercel will give you a live production URL: `https://your-project.vercel.app`.
8. Open the URL on Chrome/Edge, plug in your ESP32 via USB cable, click **Connect USB**, and control your hardware from anywhere!

### Method 2: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
```

---

## 📡 Bidirectional USB Serial Protocol Reference

Commands and telemetry stream over the USB cable at **115200 baud** using clean JSON packets:

### Browser ➔ ESP32 (Commands)
- **Trigger Dose Alarm**: `{"cmd":"TEST_DOSE","dose":1}` (Dose 1, 2, or 3)
- **Confirm Intake / Silence Alarm**: `{"cmd":"TAKE_MEDICINE"}`
- **Update Timers**: `{"cmd":"SET_SCHEDULE","d1h":8,"d1m":0,"d1pm":false,"d2h":1,"d2m":30,"d2pm":true,"d3h":8,"d3m":0,"d3pm":true}`
- **Reset System**: `{"cmd":"RESET"}`
- **Ping Status**: `{"cmd":"PING"}`

### ESP32 ➔ Browser (Events)
- **Button Pressed**: `{"event":"BUTTON_PRESSED","dose":1,"status":"TAKEN","durationSec":1.8}`
- **Alarm Fired**: `{"event":"ALARM_TRIGGERED","dose":1,"doseName":"Morning Dose (Light 1)"}`
- **Timeout (Missed)**: `{"event":"ALARM_MISSED","dose":1,"status":"MISSED"}`
- **Telemetry Heartbeat**: `{"event":"TELEMETRY","status":"ONLINE","alarm":false,"buzzer":false,...}`
- **Status Acknowledgement**: `{"event":"STATUS","status":"ONLINE","message":"System Ready"}`

---

## 📱 Optional: Free Phone Notifications (Telegram)

If you configure your Wi-Fi SSID and password in `SmartMedicalBox.ino`:
1. Message `@BotFather` on Telegram to create a bot and copy the **HTTP Token**.
2. Message `@userinfobot` on Telegram to get your numeric **Chat ID**.
3. Put both in `SmartMedicalBox.ino`:
   ```cpp
   const char* BOT_TOKEN = "YOUR_TOKEN";
   const char* CHAT_ID   = "YOUR_CHAT_ID";
   ```
4. The ESP32 will send instant Telegram alerts to your phone whenever a dose is taken or missed!
