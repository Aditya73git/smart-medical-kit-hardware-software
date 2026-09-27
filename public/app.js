// =========================================================
// Smart Medical Box - Frontend Logic & Web Audio Controller
// =========================================================

// Audio Context for synthesized sound alerts (no external audio files needed)
let audioCtx = null;
let soundEnabled = true;
let buzzerOscillator = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Sound Synthesizers
function playAlarmBuzzerSound() {
  if (!soundEnabled) return;
  try {
    initAudio();
    stopAlarmBuzzerSound();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(850, audioCtx.currentTime); // Buzzer pitch
    // Pulse volume
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    buzzerOscillator = osc;
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

function stopAlarmBuzzerSound() {
  if (buzzerOscillator) {
    try {
      buzzerOscillator.stop();
      buzzerOscillator.disconnect();
    } catch(e) {}
    buzzerOscillator = null;
  }
}

function playSuccessChime() {
  if (!soundEnabled) return;
  try {
    initAudio();
    stopAlarmBuzzerSound();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {}
}

function playMissedTone() {
  if (!soundEnabled) return;
  try {
    initAudio();
    stopAlarmBuzzerSound();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {}
}

// ---------------------------------------------------------
// Global UI Elements
// ---------------------------------------------------------
const sseIndicator = document.getElementById('sse-indicator');
const sseText = document.getElementById('sse-text');
const liveClock = document.getElementById('live-clock');
const liveDate = document.getElementById('live-date');
const soundToggle = document.getElementById('sound-toggle');
const soundIcon = document.getElementById('sound-icon');

// Hardware Twin elements
const ledMorning = document.getElementById('led-morning');
const ledAfternoon = document.getElementById('led-afternoon');
const ledNight = document.getElementById('led-night');
const ledStatus1 = document.getElementById('led-status-1');
const ledStatus2 = document.getElementById('led-status-2');
const ledStatus3 = document.getElementById('led-status-3');

const cardLed1 = document.getElementById('card-led-1');
const cardLed2 = document.getElementById('card-led-2');
const cardLed3 = document.getElementById('card-led-3');

const oledLine1 = document.getElementById('oled-line1');
const oledLine2 = document.getElementById('oled-line2');
const oledLine3 = document.getElementById('oled-line3');
const oledClock = document.getElementById('oled-clock');

const buzzerBadge = document.getElementById('buzzer-badge');
const buzzerIcon = document.getElementById('buzzer-icon');
const buzzerStateText = document.getElementById('buzzer-state-text');

// Alarm Banner
const alarmBanner = document.getElementById('alarm-banner');
const alarmBannerIcon = document.getElementById('alarm-banner-icon');
const alarmBannerTitle = document.getElementById('alarm-banner-title');
const alarmBannerDesc = document.getElementById('alarm-banner-desc');
const alarmTimerBox = document.getElementById('alarm-timer-box');
const alarmCountdown = document.getElementById('alarm-countdown');
const btnPatientTake = document.getElementById('btn-patient-take');
const btnBannerOverride = document.getElementById('btn-banner-override');
const bannerOverrideText = document.getElementById('banner-override-text');
const hardwareBtnPress = document.getElementById('hardware-btn-press');

let lastAlertObject = null;

// Stats
const statTotal = document.getElementById('stat-total');
const statTaken = document.getElementById('stat-taken');
const statMissed = document.getElementById('stat-missed');
const statAdherence = document.getElementById('stat-adherence');
const cardAdherenceBtn = document.getElementById('card-adherence-btn');

// 3D Circular Diagram elements
const adherence3dSection = document.getElementById('adherence-3d-section');
const donut3dLayers = document.getElementById('donut-3d-layers');
const chart3dTooltip = document.getElementById('chart-3d-tooltip');
const tipBadge = document.getElementById('tip-badge');
const tipTitle = document.getElementById('tip-title');
const tipCount = document.getElementById('tip-count');
const tipPercent = document.getElementById('tip-percent');
const tipDesc = document.getElementById('tip-desc');
const centerAdherencePct = document.getElementById('center-adherence-pct');
const centerAdherenceLabel = document.getElementById('center-adherence-label');
const stage3d = document.getElementById('stage-3d');

// Legend Breakdown elements
const countTaken = document.getElementById('count-taken');
const pctTaken = document.getElementById('pct-taken');
const barTaken = document.getElementById('bar-taken');

const countMissed = document.getElementById('count-missed');
const pctMissed = document.getElementById('pct-missed');
const barMissed = document.getElementById('bar-missed');

const countManual = document.getElementById('count-manual');
const pctManual = document.getElementById('pct-manual');
const barManual = document.getElementById('bar-manual');

const legendCardTaken = document.getElementById('legend-card-taken');
const legendCardMissed = document.getElementById('legend-card-missed');
const legendCardManual = document.getElementById('legend-card-manual');

// Table & Controls
const historyTableBody = document.getElementById('history-table-body');
const doseRecordCountBadge = document.getElementById('dose-record-count-badge');
const btnResetStats = document.getElementById('btn-reset-stats');

// Simulator Buttons
const simDose1 = document.getElementById('sim-dose-1');
const simDose2 = document.getElementById('sim-dose-2');
const simDose3 = document.getElementById('sim-dose-3');
const copyEndpointBtn = document.getElementById('copy-endpoint-btn');
const endpointUrl = document.getElementById('endpoint-url');

// State
let currentAlarmDose = null;
let countdownTimer = null;
let remainingMs = 10000;
let alarmStartTime = 0;

// Setup Endpoint display
endpointUrl.textContent = window.location.origin + '/api/alert';

// Sound Toggle
if (soundToggle) {
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundIcon) {
      if (soundEnabled) {
        soundIcon.className = 'fa-solid fa-volume-high text-teal-600';
      } else {
        soundIcon.className = 'fa-solid fa-volume-xmark text-slate-400';
      }
    }
    if (!soundEnabled) {
      stopAlarmBuzzerSound();
    }
  });
}

// Live clock tick (12-hour AM/PM format)
setInterval(() => {
  const now = new Date();
  const time12 = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  if (liveClock) liveClock.textContent = time12;
  if (liveDate) liveDate.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (oledClock) oledClock.textContent = time12;

  // Keep OLED center updated with live digital clock when idle (No "SYSTEM READY")
  if (!currentAlarmDose && oledLine1 && oledLine1.textContent === 'SMART MEDIBOX') {
    if (oledLine2) oledLine2.textContent = time12;
    if (oledLine3) oledLine3.textContent = 'Status: Monitoring';
  }
}, 1000);

// ---------------------------------------------------------
// WEB SERIAL API (Direct USB Cable Link to ESP32)
// Works on Chrome, Edge, Brave, Opera (localhost, GitHub, Vercel)
// ---------------------------------------------------------
const btnUsbConnect = document.getElementById('btn-usb-connect');
const btnUsbConnectTwin = document.getElementById('btn-usb-connect-twin');
const btnUsbTwinText = document.getElementById('btn-usb-twin-text');
const usbStatusText = document.getElementById('usb-status-text');
const usbIndicator = document.getElementById('usb-indicator');
const hardwareLinkBadge = document.getElementById('hardware-link-badge');
const hardwareLinkDot = document.getElementById('hardware-link-dot');
const hardwareLinkText = document.getElementById('hardware-link-text');
const usbBanner = document.getElementById('usb-banner');
const usbBannerTitle = document.getElementById('usb-banner-title');
const usbBannerDesc = document.getElementById('usb-banner-desc');

let serialPort = null;
let serialWriter = null;
let serialReader = null;
let isUsbConnected = false;

async function sendSerialCommand(obj) {
  if (!serialWriter || !isUsbConnected) return false;
  try {
    const jsonStr = JSON.stringify(obj) + '\n';
    await serialWriter.write(jsonStr);
    appendLogLine({
      timestamp: new Date().toLocaleTimeString(),
      source: 'USB_TX',
      type: 'INFO',
      message: `Sent to ESP32: ${jsonStr.trim()}`
    });
    return true;
  } catch (err) {
    console.warn('[USB Serial] Failed to send command:', err);
    return false;
  }
}

function updateUsbUI(connected, portDetails = '') {
  isUsbConnected = connected;
  if (connected) {
    if (usbIndicator) usbIndicator.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    if (usbStatusText) usbStatusText.textContent = 'USB Linked';
    if (btnUsbConnect) {
      btnUsbConnect.className = 'px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer';
      btnUsbConnect.title = 'ESP32 is connected via USB Data Cable. Click to disconnect.';
    }
    if (hardwareLinkBadge) {
      hardwareLinkBadge.className = 'px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold text-[10px] flex items-center gap-1.5 shadow-2xs';
    }
    if (hardwareLinkDot) hardwareLinkDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse';
    if (hardwareLinkText) hardwareLinkText.textContent = portDetails ? `USB: ${portDetails}` : 'USB: 115200 Baud';

    if (usbBanner) {
      usbBanner.className = 'p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl flex items-center justify-between text-xs transition shadow-2xs';
    }
    if (usbBannerTitle) usbBannerTitle.textContent = 'Hardware Connected via USB Data Cable!';
    if (usbBannerDesc) usbBannerDesc.textContent = 'Real-time bidirectional link active at 115200 baud. Physical button and buzzer synced.';
    if (btnUsbTwinText) btnUsbTwinText.textContent = 'Unlink Cable';
  } else {
    if (usbIndicator) usbIndicator.className = 'w-2 h-2 rounded-full bg-slate-400';
    if (usbStatusText) usbStatusText.textContent = 'Connect USB';
    if (btnUsbConnect) {
      btnUsbConnect.className = 'px-2.5 py-1 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer';
      btnUsbConnect.title = 'Attach USB cable to ESP32 and click to link hardware directly!';
    }
    if (hardwareLinkBadge) {
      hardwareLinkBadge.className = 'px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono font-semibold text-[10px] flex items-center gap-1.5 shadow-2xs';
    }
    if (hardwareLinkDot) hardwareLinkDot.className = 'w-1.5 h-1.5 rounded-full bg-slate-400';
    if (hardwareLinkText) hardwareLinkText.textContent = 'USB: Ready';

    if (usbBanner) {
      usbBanner.className = 'p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between text-xs transition shadow-2xs';
    }
    if (usbBannerTitle) usbBannerTitle.textContent = 'Direct USB Data Cable Link';
    if (usbBannerDesc) usbBannerDesc.textContent = 'Attach USB data cable to ESP32 to control LEDs & buzzer directly from this website.';
    if (btnUsbTwinText) btnUsbTwinText.textContent = 'Link Cable';
  }
}

async function connectWebSerial() {
  if (!('serial' in navigator)) {
    alert(
      'Web Serial is supported in Google Chrome, Microsoft Edge, Opera, and Brave.\n\n' +
      'To connect directly to your ESP32 using the data transfer cable, please open this webpage in Chrome or Edge!'
    );
    return;
  }

  if (isUsbConnected) {
    await disconnectWebSerial();
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });

    const encoder = new TextEncoderStream();
    encoder.readable.pipeTo(serialPort.writable);
    serialWriter = encoder.writable.getWriter();

    updateUsbUI(true, 'Connected @ 115200');

    appendLogLine({
      timestamp: new Date().toLocaleTimeString(),
      source: 'USB',
      type: 'INFO',
      message: 'ESP32 USB Serial Port opened successfully at 115200 baud.'
    });

    readSerialStream(serialPort);

    // Send initial PING to verify handshake
    setTimeout(() => {
      sendSerialCommand({ cmd: 'PING' });
    }, 600);

  } catch (err) {
    if (err.name !== 'NotFoundError') {
      console.error('[Web Serial] Port open error:', err);
      alert('Could not open serial port: ' + err.message);
    }
    updateUsbUI(false);
  }
}

async function disconnectWebSerial() {
  try {
    isUsbConnected = false;
    if (serialReader) {
      await serialReader.cancel();
      serialReader = null;
    }
    if (serialWriter) {
      await serialWriter.close();
      serialWriter = null;
    }
    if (serialPort) {
      await serialPort.close();
      serialPort = null;
    }
    appendLogLine({
      timestamp: new Date().toLocaleTimeString(),
      source: 'USB',
      type: 'INFO',
      message: 'ESP32 USB Serial Port disconnected.'
    });
  } catch (err) {
    console.warn('[Web Serial] Error closing port:', err);
  }
  updateUsbUI(false);
}

async function readSerialStream(port) {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  serialReader = textDecoder.readable.getReader();

  let lineBuffer = '';

  try {
    while (true) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        lineBuffer += value;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length === 0) continue;
          handleIncomingSerialLine(trimmed);
        }
      }
    }
  } catch (err) {
    if (isUsbConnected) {
      console.warn('[Web Serial] Read loop error:', err);
    }
  } finally {
    if (serialReader) {
      serialReader.releaseLock();
      serialReader = null;
    }
    updateUsbUI(false);
  }
}

function handleIncomingSerialLine(line) {
  if (line.startsWith('{') && line.endsWith('}')) {
    try {
      const eventData = JSON.parse(line);
      processHardwareSerialEvent(eventData);
      return;
    } catch (e) {
      // fallback
    }
  }

  appendLogLine({
    timestamp: new Date().toLocaleTimeString(),
    source: 'ESP32_USB',
    type: 'INFO',
    message: line
  });
}

function processHardwareSerialEvent(data) {
  appendLogLine({
    timestamp: new Date().toLocaleTimeString(),
    source: 'ESP32_EVENT',
    type: 'INFO',
    message: `Received: ${data.event || 'STATUS'}`,
    rawData: data
  });

  if (data.event === 'BUTTON_PRESSED') {
    if (currentAlarmDose) {
      const doseName = currentAlarmDose === 1 ? 'Morning Dose' : currentAlarmDose === 2 ? 'Afternoon Dose' : 'Night Dose';
      reportDoseResult(currentAlarmDose, doseName, 'TAKEN', data.durationSec || 1.5);
    } else {
      playSuccessChime();
    }
  } else if (data.event === 'ALARM_TRIGGERED') {
    const doseNum = Number(data.dose) || 1;
    const doseName = data.doseName || (doseNum === 1 ? 'Morning Dose (Light 1)' : doseNum === 2 ? 'Afternoon Dose (Light 2)' : 'Night Dose (Light 3)');
    startAlarmUI(doseNum, doseName);
  } else if (data.event === 'ALARM_MISSED') {
    const doseNum = Number(data.dose) || (currentAlarmDose || 1);
    const doseName = data.doseName || (doseNum === 1 ? 'Morning Dose' : doseNum === 2 ? 'Afternoon Dose' : 'Night Dose');
    reportDoseResult(doseNum, doseName, 'MISSED', 10.0);
  } else if (data.event === 'TELEMETRY' || data.event === 'STATUS' || data.event === 'PONG') {
    if (data.buzzer) {
      buzzerBadge.className = 'flex items-center space-x-1.5 text-xs text-rose-600 buzzer-buzz font-bold';
      buzzerIcon.className = 'fa-solid fa-volume-high text-rose-600';
      buzzerStateText.textContent = 'BUZZING (Active)';
    } else if (!currentAlarmDose) {
      buzzerBadge.className = 'flex items-center space-x-1.5 text-xs text-slate-400 font-medium';
      buzzerIcon.className = 'fa-solid fa-volume-xmark';
      buzzerStateText.textContent = 'Silent';
    }
  }
}

if (btnUsbConnect) btnUsbConnect.addEventListener('click', connectWebSerial);
if (btnUsbConnectTwin) btnUsbConnectTwin.addEventListener('click', connectWebSerial);

if ('serial' in navigator) {
  navigator.serial.addEventListener('connect', () => {
    appendLogLine({
      timestamp: new Date().toLocaleTimeString(),
      source: 'USB',
      type: 'INFO',
      message: 'ESP32 USB cable physically connected to computer. Click Connect USB to activate.'
    });
  });
  navigator.serial.addEventListener('disconnect', () => {
    updateUsbUI(false);
    appendLogLine({
      timestamp: new Date().toLocaleTimeString(),
      source: 'USB',
      type: 'WARN',
      message: 'ESP32 USB cable disconnected.'
    });
  });
}

// ---------------------------------------------------------
// SERVER SENT EVENTS (SSE) STREAM
// ---------------------------------------------------------
function connectSSE() {
  const evtSource = new EventSource('/api/stream');

  evtSource.onopen = () => {
    sseIndicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
    sseText.textContent = 'Live SSE Connected';
  };

  evtSource.onerror = () => {
    sseIndicator.className = 'w-2.5 h-2.5 rounded-full bg-rose-500';
    sseText.textContent = 'Reconnecting...';
  };

  evtSource.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      handleServerEvent(parsed);
    } catch (err) {
      console.error("SSE parse error:", err);
    }
  };
}

function handleServerEvent(event) {
  const { type, data } = event;

  switch (type) {
    case 'INITIAL_SNAPSHOT':
      updateStats(data.boxState.stats);
      renderHistoryTable(data.alertsHistory);
      if (data.boxState.schedule) {
        updateHardwareTwinSchedule(data.boxState.schedule);
      }
      if (data.logsStream) {
        data.logsStream.slice().reverse().forEach(log => appendLogLine(log));
      }
      break;

    case 'NEW_LOG':
      appendLogLine(data);
      break;

    case 'SCHEDULE_UPDATED':
      currentArmedSchedule = data;
      updateHardwareTwinSchedule(data);
      break;

    case 'ALERT_OVERRIDDEN':
      updateStats(data.boxState.stats);
      renderHistoryTable(data.alertsHistory);
      break;

    case 'ALARM_TRIGGERED':
      startAlarmUI(data.dose, data.doseName);
      break;

    case 'NEW_ALERT':
      updateStats(data.boxState.stats);
      addAlertToHistory(data.alert);
      finishAlarmUI(data.alert.status === 'TAKEN', data.alert.doseName, data.alert);
      break;

    case 'RESET':
      updateStats(data.boxState.stats);
      renderHistoryTable([]);
      resetHardwareTwin();
      break;
  }
}

// ---------------------------------------------------------
// ALARM LIFECYCLE (10-SECOND TIMEOUT LOGIC)
// ---------------------------------------------------------
function startAlarmUI(doseNum, doseName) {
  currentAlarmDose = doseNum;
  alarmStartTime = Date.now();
  remainingMs = 10000;

  // Buzzer ON
  playAlarmBuzzerSound();
  buzzerBadge.className = 'flex items-center space-x-1.5 text-xs text-rose-600 buzzer-buzz font-bold';
  buzzerIcon.className = 'fa-solid fa-volume-high text-rose-600';
  buzzerStateText.textContent = 'BUZZING (10s)';

  // Reset lights, then turn on specific LED
  resetLeds();
  if (doseNum === 1) {
    ledMorning.className = 'w-8 h-8 rounded-full bg-emerald-500 led-glow-green border-2 border-emerald-300 shadow-md mx-auto mb-1';
    ledStatus1.textContent = 'BLINKING';
    ledStatus1.className = 'text-[10px] mt-2 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block font-bold';
    cardLed1.className = 'bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-3.5 text-center transition-all shadow-md';
  } else if (doseNum === 2) {
    ledAfternoon.className = 'w-8 h-8 rounded-full bg-amber-500 led-glow-amber border-2 border-amber-300 shadow-md mx-auto mb-1';
    ledStatus2.textContent = 'BLINKING';
    ledStatus2.className = 'text-[10px] mt-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-block font-bold';
    cardLed2.className = 'bg-amber-50 border-2 border-amber-400 rounded-2xl p-3.5 text-center transition-all shadow-md';
  } else if (doseNum === 3) {
    ledNight.className = 'w-8 h-8 rounded-full bg-rose-500 led-glow-red border-2 border-rose-300 shadow-md mx-auto mb-1';
    ledStatus3.textContent = 'BLINKING';
    ledStatus3.className = 'text-[10px] mt-2 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 inline-block font-bold';
    cardLed3.className = 'bg-rose-50 border-2 border-rose-400 rounded-2xl p-3.5 text-center transition-all shadow-md';
  }

  // OLED Screen Update
  oledLine1.textContent = '!! ALARM ACTIVE !!';
  oledLine2.textContent = `TAKE ${doseName.toUpperCase()}`;
  oledLine3.textContent = 'Press button within 10s!';

  // Urgent Banner
  alarmBanner.className = 'rounded-2xl p-4 border border-rose-300 bg-rose-50 transition-all duration-300 shadow-md flex items-center justify-between text-slate-800';
  alarmBannerIcon.className = 'w-11 h-11 rounded-xl bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center text-xl font-bold animate-bounce shadow-2xs';
  alarmBannerTitle.textContent = `🚨 ${doseName.toUpperCase()} - ALARM TRIGGERED!`;
  alarmBannerTitle.className = 'text-base font-bold text-rose-900';
  alarmBannerDesc.textContent = 'Buzzer is active. The patient has 10 seconds to press the confirmation button.';
  alarmBannerDesc.className = 'text-xs text-rose-700 font-medium';
  alarmTimerBox.classList.remove('hidden');
  btnPatientTake.classList.remove('hidden');
  btnBannerOverride.classList.add('hidden');

  // Start 10-Second Countdown interval
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    const elapsed = Date.now() - alarmStartTime;
    remainingMs = Math.max(0, 10000 - elapsed);
    const secs = (remainingMs / 1000).toFixed(1);
    alarmCountdown.textContent = secs + 's';

    if (remainingMs <= 0) {
      clearInterval(countdownTimer);
      // Auto-trigger Missed timeout alert if still active
      if (currentAlarmDose !== null) {
        reportDoseResult(currentAlarmDose, doseName, 'MISSED', 10.0);
      }
    }
  }, 100);
}

function finishAlarmUI(isTaken, doseName, alertObj = null) {
  clearInterval(countdownTimer);
  stopAlarmBuzzerSound();

  if (alertObj) lastAlertObject = alertObj;

  // Reset Buzzer & LEDs
  buzzerBadge.className = 'flex items-center space-x-1.5 text-xs text-slate-400 font-medium';
  buzzerIcon.className = 'fa-solid fa-volume-xmark';
  buzzerStateText.textContent = 'Silent';
  resetLeds();

  alarmTimerBox.classList.add('hidden');
  btnPatientTake.classList.add('hidden');
  btnBannerOverride.classList.remove('hidden');
  btnBannerOverride.classList.add('flex');

  if (isTaken) {
    playSuccessChime();
    oledLine1.textContent = 'MEDICINE STATUS';
    oledLine2.textContent = doseName.toUpperCase();
    oledLine3.textContent = 'TAKEN ON TIME :)';

    alarmBanner.className = 'rounded-2xl p-4 border border-emerald-300 bg-emerald-50 transition-all duration-300 shadow-md flex items-center justify-between text-slate-800';
    alarmBannerIcon.className = 'w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center text-xl font-bold shadow-2xs';
    alarmBannerIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
    alarmBannerTitle.textContent = `✅ ${doseName} TAKEN!`;
    alarmBannerTitle.className = 'text-base font-bold text-emerald-900';
    alarmBannerDesc.textContent = 'Patient successfully confirmed medicine intake. Phone notification dispatched!';
    alarmBannerDesc.className = 'text-xs text-emerald-700 font-medium';

    bannerOverrideText.textContent = 'Manually Mark as MISSED';
    btnBannerOverride.className = 'flex px-4 py-2 bg-rose-600 hover:bg-rose-700 font-semibold text-white text-xs rounded-xl shadow-xs transition items-center space-x-2';
  } else {
    playMissedTone();
    oledLine1.textContent = 'MEDICINE STATUS';
    oledLine2.textContent = doseName.toUpperCase();
    oledLine3.textContent = 'MISSED! :( (Timeout)';

    alarmBanner.className = 'rounded-2xl p-4 border border-rose-300 bg-rose-50 transition-all duration-300 shadow-md flex items-center justify-between text-slate-800';
    alarmBannerIcon.className = 'w-11 h-11 rounded-xl bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center text-xl font-bold shadow-2xs';
    alarmBannerIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    alarmBannerTitle.textContent = `⚠️ ALERT: ${doseName} WAS MISSED!`;
    alarmBannerTitle.className = 'text-base font-bold text-rose-900';
    alarmBannerDesc.textContent = 'No button response in 10 seconds. Buzzer stopped & alert sent to phone!';
    alarmBannerDesc.className = 'text-xs text-rose-700 font-medium';

    bannerOverrideText.textContent = 'Manually Mark as TAKEN';
    btnBannerOverride.className = 'flex px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-semibold text-white text-xs rounded-xl shadow-xs transition items-center space-x-2';
  }

  currentAlarmDose = null;

  // Auto-hide alert banner after 10 seconds
  setTimeout(() => {
    if (!currentAlarmDose) {
      alarmBanner.classList.add('hidden');
      oledLine1.textContent = 'SMART MEDIBOX';
      oledLine2.textContent = liveClock ? liveClock.textContent : '--:--:--';
      oledLine3.textContent = 'Status: Monitoring';
    }
  }, 10000);
}

btnBannerOverride.addEventListener('click', () => {
  if (lastAlertObject) {
    toggleAlertStatus(lastAlertObject.id);
  }
});

function resetLeds() {
  ledMorning.className = 'w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-300 transition-all duration-200 shadow-inner mx-auto mb-1';
  ledAfternoon.className = 'w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-300 transition-all duration-200 shadow-inner mx-auto mb-1';
  ledNight.className = 'w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-300 transition-all duration-200 shadow-inner mx-auto mb-1';

  ledStatus1.textContent = 'OFF';
  ledStatus1.className = 'text-[10px] mt-2 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 inline-block font-medium';
  ledStatus2.textContent = 'OFF';
  ledStatus2.className = 'text-[10px] mt-2 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 inline-block font-medium';
  ledStatus3.textContent = 'OFF';
  ledStatus3.className = 'text-[10px] mt-2 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 inline-block font-medium';

  cardLed1.className = 'bg-emerald-50/30 border border-emerald-100/80 rounded-2xl p-3.5 text-center transition-all hover:shadow-xs';
  cardLed2.className = 'bg-amber-50/30 border border-amber-100/80 rounded-2xl p-3.5 text-center transition-all hover:shadow-xs';
  cardLed3.className = 'bg-rose-50/30 border border-rose-100/80 rounded-2xl p-3.5 text-center transition-all hover:shadow-xs';
}

function resetHardwareTwin() {
  stopAlarmBuzzerSound();
  resetLeds();
  currentAlarmDose = null;
  alarmBanner.classList.add('hidden');
  oledLine1.textContent = 'SMART MEDIBOX';
  oledLine2.textContent = liveClock ? liveClock.textContent : '--:--:--';
  oledLine3.textContent = 'Status: Monitoring';
}

// ---------------------------------------------------------
// REPORT DOSE RESULT (POST TO BACKEND)
// ---------------------------------------------------------
async function reportDoseResult(doseNum, doseName, status, durationSec) {
  try {
    const res = await fetch('/api/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dose: doseNum,
        doseName: doseName,
        status: status,
        durationSec: durationSec
      })
    });
    return await res.json();
  } catch (err) {
    console.error("API error:", err);
  }
}

async function triggerAlarmOnServer(doseNum, doseName) {
  try {
    const res = await fetch('/api/alarm-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dose: doseNum, doseName })
    });
    return await res.json();
  } catch (err) {
    console.error("API error:", err);
  }
}

// ---------------------------------------------------------
// BUTTON ACTIONS & INTERACTION (Physical USB + Digital Twin)
// ---------------------------------------------------------
function handlePatientButtonPressed() {
  // If USB data cable is attached, immediately tell ESP32 to silence buzzer & confirm intake
  sendSerialCommand({ cmd: 'TAKE_MEDICINE' });

  if (currentAlarmDose) {
    const elapsedSec = ((Date.now() - alarmStartTime) / 1000).toFixed(1);
    const doseName = currentAlarmDose === 1 ? 'Morning Dose' : currentAlarmDose === 2 ? 'Afternoon Dose' : 'Night Dose';
    reportDoseResult(currentAlarmDose, doseName, 'TAKEN', elapsedSec);
  } else {
    appendLogLine({
      timestamp: new Date().toLocaleTimeString(),
      source: 'BUTTON',
      type: 'INFO',
      message: 'Button pressed by user (Signal dispatched to hardware & cloud).'
    });
  }
}

btnPatientTake.addEventListener('click', handlePatientButtonPressed);
hardwareBtnPress.addEventListener('click', handlePatientButtonPressed);

// Simulator buttons - Dispatch to physical ESP32 via USB and to server
simDose1.addEventListener('click', () => {
  sendSerialCommand({ cmd: 'TEST_DOSE', dose: 1 });
  triggerAlarmOnServer(1, 'Morning Dose (Light 1)');
});
simDose2.addEventListener('click', () => {
  sendSerialCommand({ cmd: 'TEST_DOSE', dose: 2 });
  triggerAlarmOnServer(2, 'Afternoon Dose (Light 2)');
});
simDose3.addEventListener('click', () => {
  sendSerialCommand({ cmd: 'TEST_DOSE', dose: 3 });
  triggerAlarmOnServer(3, 'Night Dose (Light 3)');
});

// Copy Endpoint
copyEndpointBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(endpointUrl.textContent);
  copyEndpointBtn.textContent = 'Copied!';
  setTimeout(() => copyEndpointBtn.textContent = 'Copy', 2000);
});

// Helper to safely handle log calls
function appendLogLine(log) {
  console.log(`[${log.source || 'SYS'}] ${log.message || ''}`);
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (cardAdherenceBtn && adherence3dSection) {
  cardAdherenceBtn.addEventListener('click', () => {
    adherence3dSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    adherence3dSection.classList.add('ring-2', 'ring-teal-500');
    setTimeout(() => adherence3dSection.classList.remove('ring-2', 'ring-teal-500'), 1500);
  });
}

btnResetStats.addEventListener('click', async () => {
  if (confirm("Are you sure you want to reset all reminder history and stats?")) {
    sendSerialCommand({ cmd: 'RESET' });
    await fetch('/api/clear-history', { method: 'POST' });
  }
});

// ---------------------------------------------------------
// 3D CIRCULAR ADHERENCE DIAGRAM ENGINE (SVG 3D Isometric)
// ---------------------------------------------------------
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180.0;
  return {
    x: cx + (r * Math.cos(rad)),
    y: cy + (r * Math.sin(rad))
  };
}

function describeDonutSlice(cx, cy, rOuter, rInner, startAngle, endAngle) {
  let angleDiff = endAngle - startAngle;
  if (angleDiff >= 359.99) angleDiff = 359.99;
  const adjEnd = startAngle + angleDiff;

  const p1 = polarToCartesian(cx, cy, rOuter, adjEnd);
  const p2 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p3 = polarToCartesian(cx, cy, rInner, startAngle);
  const p4 = polarToCartesian(cx, cy, rInner, adjEnd);
  const largeArcFlag = angleDiff <= 180 ? "0" : "1";

  return [
    "M", p1.x, p1.y,
    "A", rOuter, rOuter, 0, largeArcFlag, 0, p2.x, p2.y,
    "L", p3.x, p3.y,
    "A", rInner, rInner, 0, largeArcFlag, 1, p4.x, p4.y,
    "Z"
  ].join(" ");
}

function describeOuterSideWall(cx, cy, rOuter, startAngle, endAngle, depth) {
  let angleDiff = endAngle - startAngle;
  if (angleDiff >= 359.99) angleDiff = 359.99;
  const adjEnd = startAngle + angleDiff;

  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, adjEnd);
  const largeArcFlag = angleDiff <= 180 ? "0" : "1";

  return [
    "M", p1.x, p1.y,
    "A", rOuter, rOuter, 0, largeArcFlag, 1, p2.x, p2.y,
    "L", p2.x, p2.y + depth,
    "A", rOuter, rOuter, 0, largeArcFlag, 0, p1.x, p1.y + depth,
    "Z"
  ].join(" ");
}

function render3DDonut(taken, missed, manual) {
  if (!donut3dLayers) return;
  donut3dLayers.innerHTML = '';

  const total = taken + missed + manual;

  // If no records yet, render default sample circle (100% Taken representation)
  const isSample = (total === 0);
  const tCount = isSample ? 1 : taken;
  const mCount = isSample ? 0 : missed;
  const cCount = isSample ? 0 : manual;
  const displayTotal = isSample ? 1 : total;

  const categories = [
    {
      id: 'taken',
      title: 'Medicine Taken On Time',
      count: taken,
      rawCount: tCount,
      gradTop: 'url(#grad-taken-top)',
      gradSide: 'url(#grad-taken-side)',
      stroke: '#10b981',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badgeText: 'TAKEN ON TIME',
      countColor: 'text-emerald-700',
      desc: 'Patient confirmed dose on time via button press.'
    },
    {
      id: 'missed',
      title: 'Medicine Missed',
      count: missed,
      rawCount: mCount,
      gradTop: 'url(#grad-missed-top)',
      gradSide: 'url(#grad-missed-side)',
      stroke: '#ef4444',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      badgeText: 'MISSED DOSE',
      countColor: 'text-rose-700',
      desc: '10-second timeout reached with no button response.'
    },
    {
      id: 'manual',
      title: 'Manually Changed / Overridden',
      count: manual,
      rawCount: cCount,
      gradTop: 'url(#grad-manual-top)',
      gradSide: 'url(#grad-manual-side)',
      stroke: '#0284c7',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      badgeText: 'MANUALLY EDITED',
      countColor: 'text-sky-700',
      desc: 'Dose status adjusted manually by user on the dashboard.'
    }
  ];

  const cx = 200, cy = 200, rOuter = 140, rInner = 75, depth = 28;
  let currentAngle = 0;

  categories.forEach(cat => {
    if (cat.rawCount <= 0) return;
    const sliceAngle = (cat.rawCount / displayTotal) * 360.0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    const midAngle = startAngle + (sliceAngle / 2.0);
    const pct = ((cat.count / (total || 1)) * 100).toFixed(1);

    // Group for this 3D slice
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "cursor-pointer transition-all duration-300 slice-3d-group");
    g.setAttribute("id", `slice-3d-${cat.id}`);
    g.style.transformOrigin = `${cx}px ${cy}px`;

    // 1. 3D Side extrusion (Cylinder wall)
    const sidePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    sidePath.setAttribute("d", describeOuterSideWall(cx, cy, rOuter, startAngle, endAngle, depth));
    sidePath.setAttribute("fill", cat.gradSide);
    sidePath.setAttribute("opacity", "0.95");
    g.appendChild(sidePath);

    // 2. 3D Top Cap (Donut ring surface)
    const topPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    topPath.setAttribute("d", describeDonutSlice(cx, cy, rOuter, rInner, startAngle, endAngle));
    topPath.setAttribute("fill", cat.gradTop);
    topPath.setAttribute("stroke", cat.stroke);
    topPath.setAttribute("stroke-width", "1.5");
    topPath.setAttribute("filter", "url(#shadow-3d)");
    g.appendChild(topPath);

    // Interactive Hover Events on the 3D Slice
    const showTooltip = (e) => {
      // 3D elevation along bisector angle
      const rad = (midAngle - 90) * Math.PI / 180.0;
      const elevDist = 14;
      const dx = Math.cos(rad) * elevDist;
      const dy = Math.sin(rad) * elevDist;
      g.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;

      tipBadge.className = `text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border inline-block mb-1 ${cat.badgeClass}`;
      tipBadge.textContent = cat.badgeText;
      tipTitle.textContent = cat.title;
      tipTitle.className = 'text-xs font-bold text-slate-800';
      tipCount.className = `text-xl font-bold font-mono my-0.5 ${cat.countColor}`;
      tipCount.textContent = `${cat.count} Doses`;
      tipPercent.textContent = `${pct}% of total adherence`;
      tipPercent.className = 'text-xs text-slate-500 font-mono';
      tipDesc.textContent = cat.desc;
      tipDesc.className = 'text-[11px] text-slate-500 mt-1 border-t border-slate-100 pt-1 font-sans';

      if (e) {
        const rect = stage3d.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        chart3dTooltip.style.left = `${Math.min(Math.max(mouseX - 90, 10), rect.width - 220)}px`;
        chart3dTooltip.style.top = `${Math.max(mouseY - 120, -10)}px`;
      }
      chart3dTooltip.style.opacity = '1';
    };

    const hideTooltip = () => {
      g.style.transform = '';
      chart3dTooltip.style.opacity = '0';
    };

    g.addEventListener("mouseenter", showTooltip);
    g.addEventListener("mousemove", showTooltip);
    g.addEventListener("mouseleave", hideTooltip);

    // Link Legend Cards hover to this slice
    const cardEl = document.getElementById(`legend-card-${cat.id}`);
    if (cardEl) {
      cardEl.onmouseenter = () => showTooltip(null);
      cardEl.onmouseleave = hideTooltip;
    }

    donut3dLayers.appendChild(g);
    currentAngle += sliceAngle;
  });
}

// ---------------------------------------------------------
// HISTORY TABLE & STATS UPDATE
// ---------------------------------------------------------
function updateStats(stats) {
  if (!stats) return;
  const taken = stats.takenCount || 0;
  const missed = stats.missedCount || 0;
  const manual = stats.manuallyChangedCount || 0;
  const total = taken + missed;

  statTotal.textContent = stats.totalReminders || 0;
  statTaken.textContent = taken;
  statMissed.textContent = missed;

  const rate = total === 0 ? 100 : Math.round((taken / total) * 100);
  statAdherence.textContent = rate + '%';
  centerAdherencePct.textContent = rate + '%';

  if (rate >= 80) {
    centerAdherenceLabel.textContent = 'Optimal (Good)';
    centerAdherenceLabel.className = 'text-[10px] text-emerald-600 font-bold truncate max-w-[95px]';
  } else if (rate >= 50) {
    centerAdherenceLabel.textContent = 'Moderate';
    centerAdherenceLabel.className = 'text-[10px] text-amber-600 font-bold truncate max-w-[95px]';
  } else {
    centerAdherenceLabel.textContent = 'Low Adherence';
    centerAdherenceLabel.className = 'text-[10px] text-rose-600 font-bold truncate max-w-[95px]';
  }

  // Update Legend Breakdown Cards
  const totalDoses = (taken + missed + manual) || 1;
  const pTaken = Math.round((taken / totalDoses) * 100);
  const pMissed = Math.round((missed / totalDoses) * 100);
  const pManual = Math.round((manual / totalDoses) * 100);

  countTaken.textContent = `${taken} Doses`;
  pctTaken.textContent = `${pTaken}%`;
  barTaken.style.width = `${pTaken}%`;

  countMissed.textContent = `${missed} Doses`;
  pctMissed.textContent = `${pMissed}%`;
  barMissed.style.width = `${pMissed}%`;

  countManual.textContent = `${manual} Edits`;
  pctManual.textContent = `${pManual}%`;
  barManual.style.width = `${pManual}%`;

  // Render the 3D circular donut with current values
  render3DDonut(taken, missed, manual);
}

function updateDoseRecordCountBadge(count) {
  if (doseRecordCountBadge) {
    doseRecordCountBadge.textContent = `${count} ${count === 1 ? 'Record' : 'Records'} Stored`;
  }
}

function createDoseRowElement(alert) {
  const row = document.createElement('tr');
  row.id = 'row-' + alert.id;
  row.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-slate-700';

  const isTaken = alert.status === 'TAKEN';
  const badgeClass = isTaken
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-rose-50 text-rose-700 border border-rose-200';
  const icon = isTaken ? '<i class="fa-solid fa-check mr-1 text-emerald-600"></i>' : '<i class="fa-solid fa-xmark mr-1 text-rose-600"></i>';

  row.innerHTML = `
    <td class="px-5 py-3 text-slate-600">${alert.date || ''} ${alert.timestamp || ''}</td>
    <td class="px-5 py-3 font-semibold text-slate-800">
      <span class="px-2 py-0.5 rounded bg-slate-100 text-teal-800 mr-2 border border-slate-200 text-[11px]">Dose ${alert.dose}</span>
      ${escapeHTML(alert.doseName || '')}
    </td>
    <td class="px-5 py-3">
      <div class="flex items-center space-x-2">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeClass}">
          ${icon}${alert.status}
        </span>
        <button onclick="toggleAlertStatus('${alert.id}')" class="px-2.5 py-1 rounded-lg ${isTaken ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300' : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300'} border text-[10px] font-mono font-semibold transition shadow-2xs" title="Manually change status">
          <i class="fa-solid fa-arrows-rotate mr-1"></i>Switch to ${isTaken ? 'MISSED' : 'TAKEN'}
        </button>
      </div>
    </td>
    <td class="px-5 py-3 text-slate-500 font-mono">${alert.responseTime || '-'}</td>
    <td class="px-5 py-3 text-slate-600 text-[11px]">
      ${escapeHTML(alert.actionDetails || (isTaken ? 'Patient confirmed intake' : '10s alarm timeout (No button press)'))}
      ${alert.manuallyOverridden ? '<span class="ml-1.5 px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-[9px] font-mono font-bold">MANUALLY EDITED</span>' : ''}
    </td>
  `;
  return row;
}

function addAlertToHistory(alert) {
  if (!historyTableBody) return;

  // If empty placeholder is shown, remove it
  const emptyPlaceholder = historyTableBody.querySelector('td[colspan="5"]');
  if (emptyPlaceholder) {
    historyTableBody.innerHTML = '';
  }

  // If a row for this alert already exists (e.g. from override or replay), update it in place
  const existingRow = document.getElementById('row-' + alert.id);
  const newRow = createDoseRowElement(alert);
  if (existingRow) {
    existingRow.replaceWith(newRow);
  } else {
    // Prepend the new buzzer record so latest is at top while storing ALL buzzer records
    historyTableBody.prepend(newRow);
  }

  const count = historyTableBody.querySelectorAll('tr[id^="row-"]').length;
  updateDoseRecordCountBadge(count);
}

function renderHistoryTable(alerts) {
  if (!historyTableBody) return;

  if (!alerts || alerts.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="px-5 py-8 text-center text-slate-400 font-sans text-xs">
          No buzzer dose records stored yet. Trigger a dose or wait for scheduled time.
        </td>
      </tr>
    `;
    updateDoseRecordCountBadge(0);
    return;
  }

  historyTableBody.innerHTML = '';
  // Store and render ALL records done by the buzzer
  alerts.forEach(alert => {
    historyTableBody.appendChild(createDoseRowElement(alert));
  });
  updateDoseRecordCountBadge(alerts.length);
}

// ---------------------------------------------------------
// MANUAL OVERRIDE HANDLER (Switch between MISSED and TAKEN)
// ---------------------------------------------------------
window.toggleAlertStatus = async function(alertId) {
  try {
    const res = await fetch('/api/override-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId })
    });
    const data = await res.json();
    if (data.success) {
      updateStats(data.boxState.stats);
      const resAlerts = await fetch('/api/alerts');
      const alerts = await resAlerts.json();
      renderHistoryTable(alerts);

      const isTaken = data.alert.status === 'TAKEN';
      oledLine1.textContent = 'MANUAL OVERRIDE';
      oledLine2.textContent = data.alert.doseName.toUpperCase();
      oledLine3.textContent = isTaken ? 'STATUS: TAKEN :)' : 'STATUS: MISSED :(';

      if (lastAlertObject && lastAlertObject.id === alertId) {
        lastAlertObject = data.alert;
        finishAlarmUI(isTaken, data.alert.doseName, data.alert);
      }
    }
  } catch (err) {
    console.error("Toggle error:", err);
  }
};

// ---------------------------------------------------------
// MEDICINE SCHEDULE CONTROLLER (12-HOUR AM / PM)
// ---------------------------------------------------------
const hDose1 = document.getElementById('h-dose-1');
const mDose1 = document.getElementById('m-dose-1');
const ampmDose1 = document.getElementById('ampm-dose-1');

const hDose2 = document.getElementById('h-dose-2');
const mDose2 = document.getElementById('m-dose-2');
const ampmDose2 = document.getElementById('ampm-dose-2');

const hDose3 = document.getElementById('h-dose-3');
const mDose3 = document.getElementById('m-dose-3');
const ampmDose3 = document.getElementById('ampm-dose-3');

const btnSaveSchedule = document.getElementById('btn-save-schedule');
const scheduleSaveStatus = document.getElementById('schedule-save-status');

// Sliding Drawer Elements
const scheduleDrawer = document.getElementById('schedule-drawer');
const scheduleDrawerBackdrop = document.getElementById('schedule-drawer-backdrop');
const btnOpenScheduleDrawer = document.getElementById('btn-open-schedule-drawer');
const btnOpenScheduleDrawerCard = document.getElementById('btn-open-schedule-drawer-card');
const btnCloseScheduleDrawer = document.getElementById('btn-close-schedule-drawer');
const btnCancelScheduleDrawer = document.getElementById('btn-cancel-schedule-drawer');

function openScheduleDrawer() {
  if (!scheduleDrawer || !scheduleDrawerBackdrop) return;
  scheduleDrawerBackdrop.classList.remove('hidden');
  requestAnimationFrame(() => {
    scheduleDrawerBackdrop.classList.remove('opacity-0');
    scheduleDrawer.classList.remove('translate-x-full');
  });
}

function closeScheduleDrawer() {
  if (!scheduleDrawer || !scheduleDrawerBackdrop) return;
  scheduleDrawer.classList.add('translate-x-full');
  scheduleDrawerBackdrop.classList.add('opacity-0');
  setTimeout(() => {
    scheduleDrawerBackdrop.classList.add('hidden');
  }, 300);
}

if (btnOpenScheduleDrawer) btnOpenScheduleDrawer.addEventListener('click', openScheduleDrawer);
if (btnOpenScheduleDrawerCard) btnOpenScheduleDrawerCard.addEventListener('click', openScheduleDrawer);
if (btnCloseScheduleDrawer) btnCloseScheduleDrawer.addEventListener('click', closeScheduleDrawer);
if (btnCancelScheduleDrawer) btnCancelScheduleDrawer.addEventListener('click', closeScheduleDrawer);
if (scheduleDrawerBackdrop) scheduleDrawerBackdrop.addEventListener('click', closeScheduleDrawer);

let currentArmedSchedule = null;
let lastAutoTriggerMinute = -1;

function updateHardwareTwinSchedule(schedule) {
  if (!schedule) return;
  if (schedule.dose1) {
    const t = schedule.dose1.timeStr || `${String(schedule.dose1.hour12).padStart(2, '0')}:${String(schedule.dose1.minute).padStart(2, '0')} ${schedule.dose1.ampm}`;
    const el = document.getElementById('led-time-1');
    if (el) el.textContent = `GPIO 19 • ${t}`;
    const sim = document.getElementById('sim-time-1');
    if (sim) sim.textContent = t;
    const sum = document.getElementById('summary-time-1');
    if (sum) sum.textContent = t;
  }
  if (schedule.dose2) {
    const t = schedule.dose2.timeStr || `${String(schedule.dose2.hour12).padStart(2, '0')}:${String(schedule.dose2.minute).padStart(2, '0')} ${schedule.dose2.ampm}`;
    const el = document.getElementById('led-time-2');
    if (el) el.textContent = `GPIO 18 • ${t}`;
    const sim = document.getElementById('sim-time-2');
    if (sim) sim.textContent = t;
    const sum = document.getElementById('summary-time-2');
    if (sum) sum.textContent = t;
  }
  if (schedule.dose3) {
    const t = schedule.dose3.timeStr || `${String(schedule.dose3.hour12).padStart(2, '0')}:${String(schedule.dose3.minute).padStart(2, '0')} ${schedule.dose3.ampm}`;
    const el = document.getElementById('led-time-3');
    if (el) el.textContent = `GPIO 5 • ${t}`;
    const sim = document.getElementById('sim-time-3');
    if (sim) sim.textContent = t;
    const sum = document.getElementById('summary-time-3');
    if (sum) sum.textContent = t;
  }
}

async function loadSchedule() {
  try {
    const res = await fetch('/api/schedule');
    const schedule = await res.json();
    currentArmedSchedule = schedule;

    if (schedule.dose1) {
      if (schedule.dose1.hour12) hDose1.value = schedule.dose1.hour12;
      if (schedule.dose1.minute !== undefined) mDose1.value = schedule.dose1.minute;
      if (schedule.dose1.ampm) ampmDose1.value = schedule.dose1.ampm;
    }
    if (schedule.dose2) {
      if (schedule.dose2.hour12) hDose2.value = schedule.dose2.hour12;
      if (schedule.dose2.minute !== undefined) mDose2.value = schedule.dose2.minute;
      if (schedule.dose2.ampm) ampmDose2.value = schedule.dose2.ampm;
    }
    if (schedule.dose3) {
      if (schedule.dose3.hour12) hDose3.value = schedule.dose3.hour12;
      if (schedule.dose3.minute !== undefined) mDose3.value = schedule.dose3.minute;
      if (schedule.dose3.ampm) ampmDose3.value = schedule.dose3.ampm;
    }

    updateHardwareTwinSchedule(schedule);
  } catch (e) {
    console.warn("Could not load schedule:", e);
  }
}

btnSaveSchedule.addEventListener('click', async () => {
  scheduleSaveStatus.textContent = 'Arming...';
  scheduleSaveStatus.className = 'text-[10px] text-amber-700 bg-amber-50 border border-amber-200 font-mono font-bold px-2.5 py-0.5 rounded-full';

  const payload = {
    dose1: { hour: Number(hDose1.value), minute: Number(mDose1.value), ampm: ampmDose1.value },
    dose2: { hour: Number(hDose2.value), minute: Number(mDose2.value), ampm: ampmDose2.value },
    dose3: { hour: Number(hDose3.value), minute: Number(mDose3.value), ampm: ampmDose3.value }
  };

  // Send schedule directly to connected ESP32 hardware via USB cable
  sendSerialCommand({
    cmd: 'SET_SCHEDULE',
    d1h: Number(hDose1.value),
    d1m: Number(mDose1.value),
    d1pm: ampmDose1.value === 'PM',
    d2h: Number(hDose2.value),
    d2m: Number(mDose2.value),
    d2pm: ampmDose2.value === 'PM',
    d3h: Number(hDose3.value),
    d3m: Number(mDose3.value),
    d3pm: ampmDose3.value === 'PM'
  });

  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      currentArmedSchedule = data.schedule;
      updateHardwareTwinSchedule(data.schedule);

      scheduleSaveStatus.textContent = 'Armed!';
      scheduleSaveStatus.className = 'text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-mono font-bold px-2.5 py-0.5 rounded-full';
      
      // Smoothly hide the drawer after saving
      setTimeout(() => {
        closeScheduleDrawer();
      }, 500);
    }
  } catch (err) {
    scheduleSaveStatus.textContent = 'Error!';
    scheduleSaveStatus.className = 'text-[10px] text-rose-700 bg-rose-50 border border-rose-200 font-mono font-bold px-2.5 py-0.5 rounded-full';
  }
});

// Automatic schedule checker: Runs every second to check if it's medicine time!
function checkLiveScheduleAgainstClock(now) {
  if (!currentArmedSchedule || currentAlarmDose !== null) return;

  let h12 = now.getHours() % 12;
  if (h12 === 0) h12 = 12;
  const min = now.getMinutes();
  const sec = now.getSeconds();
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';

  if (sec > 2) return;
  if (lastAutoTriggerMinute === min) return;

  // Check Dose 1 (Morning)
  const d1 = currentArmedSchedule.dose1;
  if (d1 && d1.hour12 === h12 && d1.minute === min && d1.ampm === ampm) {
    lastAutoTriggerMinute = min;
    triggerAlarmOnServer(1, 'Morning Dose (Light 1)');
    return;
  }

  // Check Dose 2 (Evening / Afternoon)
  const d2 = currentArmedSchedule.dose2;
  if (d2 && d2.hour12 === h12 && d2.minute === min && d2.ampm === ampm) {
    lastAutoTriggerMinute = min;
    triggerAlarmOnServer(2, 'Evening / Afternoon Dose (Light 2)');
    return;
  }

  // Check Dose 3 (Night)
  const d3 = currentArmedSchedule.dose3;
  if (d3 && d3.hour12 === h12 && d3.minute === min && d3.ampm === ampm) {
    lastAutoTriggerMinute = min;
    triggerAlarmOnServer(3, 'Night Dose (Light 3)');
    return;
  }
}

// Hook checkLiveScheduleAgainstClock into clock tick
setInterval(() => {
  const now = new Date();
  checkLiveScheduleAgainstClock(now);
}, 1000);

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  connectSSE();
  loadSchedule();
});
