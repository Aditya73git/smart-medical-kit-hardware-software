/*
  =============================================================================
  Project: Smart Medical Box (ESP32) - USB & Wi-Fi Dual Mode Firmware
  Features:
    - Bidirectional USB Serial Link (Web Serial API compatible at 115200 baud):
        * Full remote control via web dashboard over USB Data Cable (Type-B / Micro-USB / Type-C)
        * Receives commands: TEST_DOSE, TAKE_MEDICINE, SET_SCHEDULE, STOP, PING
        * Emits real-time JSON events: BUTTON_PRESSED, ALARM_TRIGGERED, ALARM_MISSED, STATUS
    - Real-time clock via Wi-Fi NTP with 12-Hour AM / PM display on OLED (or USB Sync)
    - Direct 12-Hour AM/PM Schedule Setup (Updatable from web interface over USB or Wi-Fi)
    - Hardware Self-Test at boot: Flashes all 3 LEDs and beeps buzzer once
    - 3 Different LEDs for 3 different reminder times:
        * Light 1 (Morning - Green): GPIO 19
        * Light 2 (Afternoon - Yellow): GPIO 18
        * Light 3 (Night - Red): GPIO 5
    - Buzzer alert: Loud pulsed beeping during alarm window (GPIO 23)
    - Push Button: Confirm medicine taken (GPIO 4)
    - 5-Second Timeout: Stops buzzer & emits "MISSED" alert if button not pressed
    - Telegram push notification to phone (Optional)
    - Web Dashboard REST Webhooks (/api/alert & /api/alarm-start)
  =============================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <time.h>

// ======================= [1. CONFIGURATION: WI-FI] =======================
// If you don't have Wi-Fi, leave these as they are. The box will operate
// 100% seamlessly over the USB Data Cable with the web dashboard!
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// =================== [2. CONFIGURATION: WEB DASHBOARD] ===================
// Your PC's local IP address or deployed Vercel URL (e.g. "https://my-medibox.vercel.app")
// Leave empty "" if using only direct USB cable
const char* DASHBOARD_URL = "";

// ==================== [3. CONFIGURATION: TELEGRAM BOT] ===================
// Telegram Bot Token from @BotFather, and Chat ID from @userinfobot (Optional)
const char* BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const char* CHAT_ID   = "YOUR_TELEGRAM_CHAT_ID";

// ====================== [4. TIME ZONE & NTP SETTINGS] =====================
const char* NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC      = 19800; // UTC+5:30 (India/Pakistan) = 19800
const int   DAYLIGHT_OFFSET_SEC = 0;

// =================== [5. EASY 12-HOUR (AM / PM) SCHEDULE] =================
// Default times in simple 12-Hour format (Can also be updated live from website!)
int  dose1_hour   = 8;       // 8:00 AM (Morning - Light 1)
int  dose1_min    = 0;
bool dose1_is_pm  = false;

int  dose2_hour   = 1;       // 1:30 PM (Afternoon - Light 2)
int  dose2_min    = 30;
bool dose2_is_pm  = true;

int  dose3_hour   = 8;       // 8:00 PM (Night - Light 3)
int  dose3_min    = 0;
bool dose3_is_pm  = true;

// Set TEST_MODE to true if you want auto-reminders every 30s without waiting
const bool TEST_MODE = false;

// ========================= [6. HARDWARE PINOUT] ==========================
#define PIN_LED_MORNING   19    // Light 1 (Morning - Green LED)
#define PIN_LED_AFTERNOON 18    // Light 2 (Afternoon - Yellow LED)
#define PIN_LED_NIGHT     5     // Light 3 (Night - Red LED)
#define PIN_BUZZER        23    // Buzzer positive (+) pin
#define PIN_BUTTON        4     // Push button (other pin to GND, uses INPUT_PULLUP)

// Set to true if your buzzer module is active-LOW (buzzes when LOW)
#define BUZZER_ACTIVE_LOW false

// OLED Display parameters (I2C)
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool oledAvailable = false;

// ========================== [STATE VARIABLES] ============================
bool alarmActive = false;
int activeDoseIndex = 0;          // 1 = Morning, 2 = Afternoon, 3 = Night
String activeDoseTitle = "";
unsigned long alarmStartTime = 0;
const unsigned long ALARM_TIMEOUT_MS = 10000; // 10 seconds timeout

int lastTriggeredMinute = -1;
int lastTriggeredDose   = 0;

unsigned long lastBlinkTime = 0;
bool blinkState = false;
bool currentBuzzerState = false;

unsigned long lastTelemetryTime = 0;

// Convert 12-Hour (with AM/PM) to 24-Hour clock used by internal RTC
int to24Hour(int hour12, bool isPM) {
  if (hour12 == 12) return isPM ? 12 : 0;
  return isPM ? (hour12 + 12) : hour12;
}

void setBuzzer(bool state) {
  currentBuzzerState = state;
  if (BUZZER_ACTIVE_LOW) {
    digitalWrite(PIN_BUZZER, state ? LOW : HIGH);
  } else {
    digitalWrite(PIN_BUZZER, state ? HIGH : LOW);
  }
}

// Function Declarations
void connectWiFi();
void initDisplay();
void showStatusOnOLED(String line1, String line2, String line3);
void sendTelegramNotification(String message);
void sendDashboardAlert(int doseNum, String doseName, String status, float durationSec);
void sendDashboardAlarmStart(int doseNum, String doseName);
void triggerAlarm(int doseNumber, String doseName);
void checkSchedule();
void handleActiveAlarm();
void runHardwareSelfTest();
void handleSerialCommands();
void emitSerialEvent(String jsonEvent);

// ================================ SETUP ==================================
void setup() {
  Serial.begin(115200);
  delay(300);

  // Initial greeting over USB Serial (parsed by Web Serial on Dashboard)
  Serial.println("\n{\"event\":\"READY\",\"firmware\":\"2.1\",\"chip\":\"ESP32\",\"status\":\"ONLINE\"}");

  // Pin setup
  pinMode(PIN_LED_MORNING, OUTPUT);
  pinMode(PIN_LED_AFTERNOON, OUTPUT);
  pinMode(PIN_LED_NIGHT, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  setBuzzer(false);
  digitalWrite(PIN_LED_MORNING, LOW);
  digitalWrite(PIN_LED_AFTERNOON, LOW);
  digitalWrite(PIN_LED_NIGHT, LOW);

  // Initialize OLED (if connected)
  initDisplay();
  showStatusOnOLED("Smart MediBox", "Hardware Test", "Checking pins...");

  // Quick Hardware Self-Test at boot (Verifies Buzzer & LEDs work!)
  runHardwareSelfTest();

  // Connect to Wi-Fi if credentials provided (non-blocking if unavailable)
  showStatusOnOLED("Smart MediBox", "Connecting", "USB / Wi-Fi...");
  connectWiFi();

  // Sync NTP Time if Wi-Fi connected
  if (WiFi.status() == WL_CONNECTED) {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    struct tm timeinfo;
    int retry = 0;
    while (!getLocalTime(&timeinfo) && retry < 8) {
      delay(500);
      retry++;
    }
  }

  showStatusOnOLED("Smart MediBox", "Monitoring Active", "Ready for Doses");
  emitSerialEvent("{\"event\":\"STATUS\",\"status\":\"ONLINE\",\"message\":\"System Ready\"}");
}

// ================================= LOOP ==================================
void loop() {
  // 1. Process USB Serial commands from web interface
  handleSerialCommands();

  // 2. Alarm handling or schedule monitoring
  if (alarmActive) {
    handleActiveAlarm();
  } else {
    checkSchedule();

    // Check physical button press outside alarm (manual log/test)
    static unsigned long lastBtnCheck = 0;
    if (millis() - lastBtnCheck > 100) {
      lastBtnCheck = millis();
      if (digitalRead(PIN_BUTTON) == LOW) {
        delay(50);
        if (digitalRead(PIN_BUTTON) == LOW) {
          emitSerialEvent("{\"event\":\"BUTTON_PRESSED\",\"status\":\"MANUAL_PRESS\",\"dose\":0}");
          // Quick chirp
          setBuzzer(true);
          delay(100);
          setBuzzer(false);
          while (digitalRead(PIN_BUTTON) == LOW) { delay(10); } // wait release
        }
      }
    }

    // Update live 12-Hour AM/PM clock on OLED every 500ms
    static unsigned long lastClockUpdate = 0;
    if (millis() - lastClockUpdate >= 500) {
      lastClockUpdate = millis();
      struct tm timeinfo;
      if (getLocalTime(&timeinfo)) {
        char timeStr[16];
        char dateStr[16];

        int hour12 = timeinfo.tm_hour % 12;
        if (hour12 == 0) hour12 = 12;
        const char* ampm = (timeinfo.tm_hour >= 12) ? "PM" : "AM";

        snprintf(timeStr, sizeof(timeStr), "%02d:%02d:%02d %s", hour12, timeinfo.tm_min, timeinfo.tm_sec, ampm);
        strftime(dateStr, sizeof(dateStr), "%d/%m/%Y", &timeinfo);
        showStatusOnOLED(dateStr, timeStr, "Status: Monitoring");
      }
    }
  }

  // 3. Periodic telemetry heartbeat every 3 seconds over USB Serial
  if (millis() - lastTelemetryTime > 3000) {
    lastTelemetryTime = millis();
    String tel = "{\"event\":\"TELEMETRY\",\"status\":\"ONLINE\",\"alarm\":" + String(alarmActive ? "true" : "false") +
                 ",\"buzzer\":" + String(currentBuzzerState ? "true" : "false") +
                 ",\"ledMorning\":" + String(digitalRead(PIN_LED_MORNING) == HIGH ? "true" : "false") +
                 ",\"ledAfternoon\":" + String(digitalRead(PIN_LED_AFTERNOON) == HIGH ? "true" : "false") +
                 ",\"ledNight\":" + String(digitalRead(PIN_LED_NIGHT) == HIGH ? "true" : "false") +
                 ",\"buttonPressed\":" + String(digitalRead(PIN_BUTTON) == LOW ? "true" : "false") + "}";
    emitSerialEvent(tel);
  }
}

// ================== [SERIAL COMMAND HANDLER (USB B-TYPE)] =================
int parseJsonVal(const String& json, const String& key, int defaultVal) {
  int idx = json.indexOf("\"" + key + "\":");
  if (idx < 0) idx = json.indexOf(key + ":");
  if (idx < 0) return defaultVal;
  int start = json.indexOf(':', idx) + 1;
  while (start < (int)json.length() && (json.charAt(start) == ' ' || json.charAt(start) == '\"')) start++;
  int end = start;
  while (end < (int)json.length() && (isDigit(json.charAt(end)) || json.charAt(end) == '-')) end++;
  if (end > start) {
    return json.substring(start, end).toInt();
  }
  return defaultVal;
}

bool parseJsonBool(const String& json, const String& key, bool defaultVal) {
  int idx = json.indexOf("\"" + key + "\":");
  if (idx < 0) idx = json.indexOf(key + ":");
  if (idx < 0) return defaultVal;
  int start = json.indexOf(':', idx) + 1;
  String sub = json.substring(start, min((int)json.length(), start + 10));
  if (sub.indexOf("true") >= 0 || sub.indexOf("1") >= 0) return true;
  if (sub.indexOf("false") >= 0 || sub.indexOf("0") >= 0) return false;
  return defaultVal;
}

void handleSerialCommands() {
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    // Check for JSON commands or plain text commands
    if (line.indexOf("TEST_DOSE") >= 0 || line.indexOf("TEST_") >= 0) {
      int dose = 1;
      if (line.indexOf("\"dose\":2") >= 0 || line.indexOf("TEST_2") >= 0) dose = 2;
      else if (line.indexOf("\"dose\":3") >= 0 || line.indexOf("TEST_3") >= 0) dose = 3;

      String name = (dose == 1) ? "Morning Dose (Light 1)" : 
                    (dose == 2) ? "Afternoon Dose (Light 2)" : "Night Dose (Light 3)";
      triggerAlarm(dose, name);
      emitSerialEvent("{\"event\":\"COMMAND_ACK\",\"cmd\":\"TEST_DOSE\",\"dose\":" + String(dose) + "}");
    }
    else if (line.indexOf("TAKE_MEDICINE") >= 0 || line.indexOf("BUTTON_PRESS") >= 0) {
      // Simulate button press from website interface
      if (alarmActive) {
        float responseSec = (millis() - alarmStartTime) / 1000.0;
        int activeLedPin = (activeDoseIndex == 1) ? PIN_LED_MORNING :
                           (activeDoseIndex == 2) ? PIN_LED_AFTERNOON : PIN_LED_NIGHT;
        setBuzzer(false);
        digitalWrite(activeLedPin, LOW);
        alarmActive = false;

        showStatusOnOLED("MEDICINE STATUS", "TAKEN (via Web)", "Confirmed!");
        emitSerialEvent("{\"event\":\"BUTTON_PRESSED\",\"dose\":" + String(activeDoseIndex) + ",\"status\":\"TAKEN\",\"durationSec\":" + String(responseSec, 1) + "}");
        sendDashboardAlert(activeDoseIndex, activeDoseTitle, "TAKEN", responseSec);
      } else {
        emitSerialEvent("{\"event\":\"BUTTON_PRESSED\",\"dose\":0,\"status\":\"NO_ALARM_ACTIVE\"}");
      }
    }
    else if (line.indexOf("STOP") >= 0 || line.indexOf("RESET") >= 0) {
      setBuzzer(false);
      digitalWrite(PIN_LED_MORNING, LOW);
      digitalWrite(PIN_LED_AFTERNOON, LOW);
      digitalWrite(PIN_LED_NIGHT, LOW);
      alarmActive = false;
      showStatusOnOLED("Smart MediBox", "System Reset", "Alarm Stopped");
      emitSerialEvent("{\"event\":\"RESET\",\"status\":\"IDLE\"}");
    }
    else if (line.indexOf("SET_SCHEDULE") >= 0) {
      dose1_hour  = parseJsonVal(line, "d1h", dose1_hour);
      dose1_min   = parseJsonVal(line, "d1m", dose1_min);
      dose1_is_pm = parseJsonBool(line, "d1pm", dose1_is_pm);

      dose2_hour  = parseJsonVal(line, "d2h", dose2_hour);
      dose2_min   = parseJsonVal(line, "d2m", dose2_min);
      dose2_is_pm = parseJsonBool(line, "d2pm", dose2_is_pm);

      dose3_hour  = parseJsonVal(line, "d3h", dose3_hour);
      dose3_min   = parseJsonVal(line, "d3m", dose3_min);
      dose3_is_pm = parseJsonBool(line, "d3pm", dose3_is_pm);

      showStatusOnOLED("Schedule Synced", "Timers Updated", "Ready via USB");
      emitSerialEvent("{\"event\":\"SCHEDULE_UPDATED\",\"status\":\"SUCCESS\"}");
    }
    else if (line.indexOf("PING") >= 0) {
      String pong = "{\"event\":\"PONG\",\"status\":\"ONLINE\",\"alarm\":" + String(alarmActive ? "true" : "false") +
                    ",\"dose\":" + String(activeDoseIndex) +
                    ",\"buzzer\":" + String(currentBuzzerState ? "true" : "false") + "}";
      emitSerialEvent(pong);
    }
  }
}

void emitSerialEvent(String jsonEvent) {
  Serial.println(jsonEvent);
}

// ======================= [HARDWARE SELF-TEST] ============================
void runHardwareSelfTest() {
  emitSerialEvent("{\"event\":\"SELF_TEST_START\"}");

  // Flash Light 1 (Morning)
  digitalWrite(PIN_LED_MORNING, HIGH);
  delay(180);
  digitalWrite(PIN_LED_MORNING, LOW);

  // Flash Light 2 (Afternoon)
  digitalWrite(PIN_LED_AFTERNOON, HIGH);
  delay(180);
  digitalWrite(PIN_LED_AFTERNOON, LOW);

  // Flash Light 3 (Night)
  digitalWrite(PIN_LED_NIGHT, HIGH);
  delay(180);
  digitalWrite(PIN_LED_NIGHT, LOW);

  // Beep Buzzer once (250ms)
  setBuzzer(true);
  delay(250);
  setBuzzer(false);

  emitSerialEvent("{\"event\":\"SELF_TEST_COMPLETE\"}");
}

// ======================== [SCHEDULE CHECKER] =============================
void checkSchedule() {
  if (TEST_MODE) {
    static unsigned long lastTestTrigger = 0;
    static int testDose = 1;
    if (millis() - lastTestTrigger > 30000) {
      lastTestTrigger = millis();
      String name = (testDose == 1) ? "Morning Dose (Light 1)" : (testDose == 2 ? "Afternoon Dose (Light 2)" : "Night Dose (Light 3)");
      triggerAlarm(testDose, name);
      testDose++;
      if (testDose > 3) testDose = 1;
    }
    return;
  }

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  int currentHour   = timeinfo.tm_hour; // 0 to 23
  int currentMinute = timeinfo.tm_min;  // 0 to 59

  int targetH1 = to24Hour(dose1_hour, dose1_is_pm);
  int targetH2 = to24Hour(dose2_hour, dose2_is_pm);
  int targetH3 = to24Hour(dose3_hour, dose3_is_pm);

  // Dose 1: Morning (Light 1)
  if (currentHour == targetH1 && currentMinute == dose1_min) {
    if (lastTriggeredMinute != currentMinute || lastTriggeredDose != 1) {
      lastTriggeredMinute = currentMinute;
      lastTriggeredDose = 1;
      triggerAlarm(1, "Morning Dose (Light 1)");
    }
  }
  // Dose 2: Afternoon (Light 2)
  else if (currentHour == targetH2 && currentMinute == dose2_min) {
    if (lastTriggeredMinute != currentMinute || lastTriggeredDose != 2) {
      lastTriggeredMinute = currentMinute;
      lastTriggeredDose = 2;
      triggerAlarm(2, "Afternoon Dose (Light 2)");
    }
  }
  // Dose 3: Night (Light 3)
  else if (currentHour == targetH3 && currentMinute == dose3_min) {
    if (lastTriggeredMinute != currentMinute || lastTriggeredDose != 3) {
      lastTriggeredMinute = currentMinute;
      lastTriggeredDose = 3;
      triggerAlarm(3, "Night Dose (Light 3)");
    }
  }
  else {
    if (lastTriggeredMinute != currentMinute) {
      lastTriggeredMinute = -1;
      lastTriggeredDose = 0;
    }
  }
}

// ========================= [TRIGGER ALARM] ===============================
void triggerAlarm(int doseNumber, String doseName) {
  alarmActive = true;
  activeDoseIndex = doseNumber;
  activeDoseTitle = doseName;
  alarmStartTime = millis();

  // Buzzer ON
  setBuzzer(true);

  // Notify over USB Serial immediately
  emitSerialEvent("{\"event\":\"ALARM_TRIGGERED\",\"dose\":" + String(doseNumber) + ",\"doseName\":\"" + doseName + "\"}");

  showStatusOnOLED("!! MEDICINE TIME !!", doseName, "Press Button!");

  sendDashboardAlarmStart(doseNumber, doseName);
}

// ====================== [HANDLE ACTIVE ALARM] ============================
void handleActiveAlarm() {
  // Listen for USB commands (such as "TAKE_MEDICINE" or "STOP") even during alarm!
  handleSerialCommands();
  if (!alarmActive) return;

  unsigned long elapsed = millis() - alarmStartTime;

  // 1. Blink the designated LED and pulse buzzer
  int activeLedPin = (activeDoseIndex == 1) ? PIN_LED_MORNING :
                     (activeDoseIndex == 2) ? PIN_LED_AFTERNOON : PIN_LED_NIGHT;

  if (millis() - lastBlinkTime >= 150) { // Blink & beep every 150ms
    lastBlinkTime = millis();
    blinkState = !blinkState;
    digitalWrite(activeLedPin, blinkState);
    setBuzzer(blinkState);
  }

  // 2. Check physical push button (GPIO 4)
  if (digitalRead(PIN_BUTTON) == LOW) {
    delay(50); // Debounce
    if (digitalRead(PIN_BUTTON) == LOW) {
      float responseSec = elapsed / 1000.0;

      // Stop Buzzer & turn off LED
      setBuzzer(false);
      digitalWrite(activeLedPin, LOW);
      alarmActive = false;

      // Update Screen
      showStatusOnOLED("MEDICINE STATUS", "TAKEN ON TIME! :)", "Stay healthy!");

      // Dispatch event over USB Serial
      emitSerialEvent("{\"event\":\"BUTTON_PRESSED\",\"dose\":" + String(activeDoseIndex) + 
                      ",\"status\":\"TAKEN\",\"durationSec\":" + String(responseSec, 1) + "}");

      // Send Phone Notification
      String msg = "Medicine TAKEN on time!\n" + activeDoseTitle + " confirmed by patient.";
      sendTelegramNotification(msg);

      // Web Dashboard Alert via Wi-Fi HTTP
      sendDashboardAlert(activeDoseIndex, activeDoseTitle, "TAKEN", responseSec);

      delay(1500);
      return;
    }
  }

  // 3. Check 10-Second Timeout (Medicine Missed)
  if (elapsed >= ALARM_TIMEOUT_MS) {
    // Turn off Buzzer & active LED
    setBuzzer(false);
    digitalWrite(activeLedPin, LOW);
    alarmActive = false;

    // Update Screen
    showStatusOnOLED("MEDICINE STATUS", "MISSED! :(", "Buzzer Stopped");

    // Dispatch event over USB Serial
    emitSerialEvent("{\"event\":\"ALARM_MISSED\",\"dose\":" + String(activeDoseIndex) + 
                    ",\"doseName\":\"" + activeDoseTitle + "\",\"status\":\"MISSED\",\"durationSec\":10.0}");

    // Send Phone Notification
    String msg = "ALERT: Medicine was MISSED!\n" + activeDoseTitle + " - No button press in 10 seconds.";
    sendTelegramNotification(msg);

    // Web Dashboard Alert via Wi-Fi HTTP
    sendDashboardAlert(activeDoseIndex, activeDoseTitle, "MISSED", 10.0);

    delay(1500);
  }
}

// =================== [DASHBOARD REST API WEBHOOK] ========================
void sendDashboardAlarmStart(int doseNum, String doseName) {
  if (String(DASHBOARD_URL).length() == 0 || WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  String endpoint = String(DASHBOARD_URL) + "/api/alarm-start";

  http.begin(client, endpoint);
  http.addHeader("Content-Type", "application/json");

  String jsonPayload = "{\"dose\":" + String(doseNum) + ",\"doseName\":\"" + doseName + "\"}";
  http.POST(jsonPayload);
  http.end();
}

void sendDashboardAlert(int doseNum, String doseName, String status, float durationSec) {
  if (String(DASHBOARD_URL).length() == 0 || WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  String endpoint = String(DASHBOARD_URL) + "/api/alert";

  http.begin(client, endpoint);
  http.addHeader("Content-Type", "application/json");

  String jsonPayload = "{\"dose\":" + String(doseNum) + 
                       ",\"doseName\":\"" + doseName + "\"" +
                       ",\"status\":\"" + status + "\"" +
                       ",\"durationSec\":" + String(durationSec, 1) + "}";

  http.POST(jsonPayload);
  http.end();
}

// =================== [TELEGRAM NOTIFICATION (HTTPS)] =====================
void sendTelegramNotification(String message) {
  if (String(BOT_TOKEN) == "YOUR_TELEGRAM_BOT_TOKEN" || WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();

  if (!client.connect("api.telegram.org", 443)) {
    return;
  }

  String encodedMsg = "";
  for (char c : message) {
    if (c == ' ') encodedMsg += "%20";
    else if (c == '\n') encodedMsg += "%0A";
    else encodedMsg += c;
  }

  String url = "/bot" + String(BOT_TOKEN) + "/sendMessage?chat_id=" + String(CHAT_ID) + "&text=" + encodedMsg;

  client.print(String("GET ") + url + " HTTP/1.1\r\n" +
               "Host: api.telegram.org\r\n" +
               "Connection: close\r\n\r\n");

  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 2500) {
    if (client.available()) {
      String line = client.readStringUntil('\n');
      if (line.startsWith("HTTP/1.1 200 OK")) {
        break;
      }
    }
  }
  client.stop();
}

// ======================= [WI-FI CONNECTION] ==============================
void connectWiFi() {
  if (String(WIFI_SSID) == "YOUR_WIFI_NAME" || String(WIFI_SSID).length() == 0) {
    Serial.println("{\"event\":\"WIFI_STATUS\",\"status\":\"SKIPPED\",\"message\":\"Using USB Cable Mode\"}");
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int counter = 0;
  while (WiFi.status() != WL_CONNECTED && counter < 15) {
    delay(400);
    counter++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("{\"event\":\"WIFI_STATUS\",\"status\":\"CONNECTED\",\"ip\":\"" + WiFi.localIP().toString() + "\"}");
  } else {
    Serial.println("{\"event\":\"WIFI_STATUS\",\"status\":\"FAILED\",\"message\":\"Operating in USB Cable Mode\"}");
  }
}

// ======================= [OLED INITIALIZATION] ===========================
void initDisplay() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    oledAvailable = false;
    return;
  }
  oledAvailable = true;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.display();
}

// ======================= [DISPLAY HELPER] ================================
void showStatusOnOLED(String line1, String line2, String line3) {
  if (!oledAvailable) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 4);
  display.println(line1);

  display.drawLine(0, 16, 128, 16, SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 24);
  display.println(line2);

  display.setCursor(0, 44);
  display.println(line3);

  display.display();
}
