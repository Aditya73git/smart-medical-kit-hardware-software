const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory state store
let alertsHistory = [];
let logsStream = [];
let clients = []; // Connected SSE browser clients
let boxState = {
  status: 'ONLINE',
  lastSeen: new Date().toISOString(),
  currentAlarm: null, // null or { dose: 1, name: 'Morning Dose', triggeredAt: ... }
  leds: { morning: false, afternoon: false, night: false },
  buzzer: false,
  buttonPressed: false,
  stats: {
    totalReminders: 0,
    takenCount: 0,
    missedCount: 0,
    manuallyChangedCount: 0
  },
  schedule: {
    dose1: { hour12: 8, minute: 0, ampm: 'AM', hour24: 8, timeStr: '08:00 AM', name: 'Morning Dose (Light 1)' },
    dose2: { hour12: 1, minute: 30, ampm: 'PM', hour24: 13, timeStr: '01:30 PM', name: 'Evening / Afternoon Dose (Light 2)' },
    dose3: { hour12: 8, minute: 0, ampm: 'PM', hour24: 20, timeStr: '08:00 PM', name: 'Night Dose (Light 3)' }
  }
};

// Helper: Broadcast event to all connected browser clients via SSE
function broadcast(eventType, data) {
  const payload = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });
  clients.forEach(client => {
    client.res.write(`data: ${payload}\n\n`);
  });
}

// Helper: Add log to terminal code output
function addLog(source, type, message, rawData = null) {
  const logEntry = {
    id: Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
    source,
    type, // 'INFO', 'WARN', 'ERROR', 'ALERT_TAKEN', 'ALERT_MISSED', 'ALARM_START'
    message,
    rawData
  };
  logsStream.unshift(logEntry);
  if (logsStream.length > 200) logsStream.pop(); // keep last 200 logs
  broadcast('NEW_LOG', logEntry);
}

// -------------------------------------------------------------
// [SSE STREAM] Real-time push to frontend browser clients
// -------------------------------------------------------------
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  addLog('SERVER', 'INFO', `Browser client connected [ID: ${clientId}]`);

  // Send initial snapshot to newly connected client
  res.write(`data: ${JSON.stringify({
    type: 'INITIAL_SNAPSHOT',
    data: {
      boxState,
      alertsHistory: alertsHistory,
      logsStream: logsStream.slice(0, 50)
    }
  })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
    addLog('SERVER', 'INFO', `Browser client disconnected [ID: ${clientId}]`);
  });
});

// -------------------------------------------------------------
// [POST /api/alert] - Called by ESP32 or Simulator
// Body: { dose: 1, doseName: "Morning Dose", status: "TAKEN" | "MISSED", time: "..." }
// -------------------------------------------------------------
app.post('/api/alert', (req, res) => {
  const { dose, doseName, status, durationSec, espTime } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Missing alert status' });
  }

  const doseNum = Number(dose) || 1;
  const doseLabel = doseName || (doseNum === 1 ? 'Morning Dose (Light 1)' : (doseNum === 2 ? 'Evening / Afternoon Dose (Light 2)' : 'Night Dose (Light 3)'));
  const isTaken = status.toUpperCase() === 'TAKEN';

  // Update Box State
  boxState.lastSeen = new Date().toISOString();
  boxState.currentAlarm = null;
  boxState.buzzer = false;
  boxState.leds = { morning: false, afternoon: false, night: false };
  boxState.buttonPressed = isTaken;
  boxState.stats.totalReminders++;
  if (isTaken) {
    boxState.stats.takenCount++;
  } else {
    boxState.stats.missedCount++;
  }

  const newAlert = {
    id: 'ALT-' + Date.now(),
    dose: doseNum,
    doseName: doseLabel,
    status: isTaken ? 'TAKEN' : 'MISSED',
    timestamp: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
    responseTime: durationSec ? `${durationSec}s` : (isTaken ? '< 10s' : 'Timeout (10s)'),
    espTime: espTime || null,
    actionDetails: isTaken ? 'Patient confirmed intake' : '10s alarm timeout (No button press)'
  };

  alertsHistory.unshift(newAlert);
  if (alertsHistory.length > 100) alertsHistory.pop();

  const logType = isTaken ? 'ALERT_TAKEN' : 'ALERT_MISSED';
  const logMsg = isTaken
    ? `✅ MEDICINE TAKEN: Patient confirmed ${doseLabel} on time!`
    : `⚠️ MEDICINE MISSED: Alarm timed out (10s)! ${doseLabel} was MISSED (No button press).`;

  addLog('ESP32_API', logType, logMsg, req.body);
  broadcast('NEW_ALERT', { alert: newAlert, boxState });

  return res.json({ success: true, message: 'Alert processed', alert: newAlert });
});

// -------------------------------------------------------------
// [POST /api/alarm-start] - Called by ESP32 when dose time triggers
// Body: { dose: 1, doseName: "Morning Dose" }
// -------------------------------------------------------------
app.post('/api/alarm-start', (req, res) => {
  const { dose, doseName } = req.body;
  const doseNum = Number(dose) || 1;
  const doseLabel = doseName || (doseNum === 1 ? 'Morning Dose' : doseNum === 2 ? 'Afternoon Dose' : 'Night Dose');

  boxState.lastSeen = new Date().toISOString();
  boxState.currentAlarm = {
    dose: doseNum,
    name: doseLabel,
    startedAt: Date.now()
  };
  boxState.buzzer = true;
  boxState.leds = {
    morning: doseNum === 1,
    afternoon: doseNum === 2,
    night: doseNum === 3
  };
  boxState.buttonPressed = false;

  addLog('ESP32_API', 'ALARM_START', `🚨 ALARM ACTIVE: ${doseLabel} - Buzzer ON, LED ${doseNum} Blinking, Waiting for button (5s limit)...`, req.body);
  broadcast('ALARM_TRIGGERED', { boxState, dose: doseNum, doseName: doseLabel });

  return res.json({ success: true, message: 'Alarm start registered', boxState });
});

// -------------------------------------------------------------
// [POST /api/heartbeat] - ESP32 periodically reports status
// -------------------------------------------------------------
app.post('/api/heartbeat', (req, res) => {
  boxState.lastSeen = new Date().toISOString();
  boxState.status = 'ONLINE';
  if (req.body.ip) boxState.espIp = req.body.ip;

  addLog('ESP32_PULSE', 'INFO', `Heartbeat received from ESP32 (${req.body.ip || 'Wi-Fi'})`, req.body);
  broadcast('HEARTBEAT', { boxState });
  return res.json({ success: true, serverTime: new Date().toISOString() });
});

// -------------------------------------------------------------
// [GET APIs] Fetch data
// -------------------------------------------------------------
app.get('/api/status', (req, res) => res.json(boxState));
app.get('/api/alerts', (req, res) => res.json(alertsHistory));
app.get('/api/logs', (req, res) => res.json(logsStream));
app.get('/api/schedule', (req, res) => res.json(boxState.schedule));

// Helper: Convert 12-hour + AM/PM to 24-hour format
function calc24Hour(h12, ampm) {
  let h = Number(h12) || 12;
  const isPM = (ampm || 'AM').toUpperCase() === 'PM';
  if (h === 12) return isPM ? 12 : 0;
  return isPM ? (h + 12) : h;
}

// [POST /api/schedule] - Update medicine schedule with AM / PM
app.post('/api/schedule', (req, res) => {
  const { dose1, dose2, dose3 } = req.body;

  if (dose1) {
    const h12 = Number(dose1.hour) || 8;
    const min = Number(dose1.minute) || 0;
    const ampm = (dose1.ampm || 'AM').toUpperCase();
    const h24 = calc24Hour(h12, ampm);
    const timeStr = `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
    boxState.schedule.dose1 = { hour12: h12, minute: min, ampm, hour24: h24, timeStr, name: 'Morning Dose (Light 1)' };
  }

  if (dose2) {
    const h12 = Number(dose2.hour) || 1;
    const min = Number(dose2.minute) || 30;
    const ampm = (dose2.ampm || 'PM').toUpperCase();
    const h24 = calc24Hour(h12, ampm);
    const timeStr = `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
    boxState.schedule.dose2 = { hour12: h12, minute: min, ampm, hour24: h24, timeStr, name: 'Afternoon Dose (Light 2)' };
  }

  if (dose3) {
    const h12 = Number(dose3.hour) || 8;
    const min = Number(dose3.minute) || 0;
    const ampm = (dose3.ampm || 'PM').toUpperCase();
    const h24 = calc24Hour(h12, ampm);
    const timeStr = `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;
    boxState.schedule.dose3 = { hour12: h12, minute: min, ampm, hour24: h24, timeStr, name: 'Night Dose (Light 3)' };
  }

  addLog('CONFIG', 'INFO', `AM/PM Schedule Armed: Dose 1 [${boxState.schedule.dose1.timeStr}], Dose 2 [${boxState.schedule.dose2.timeStr}], Dose 3 [${boxState.schedule.dose3.timeStr}]`, boxState.schedule);
  broadcast('SCHEDULE_UPDATED', boxState.schedule);

  res.json({ success: true, schedule: boxState.schedule });
});

// [POST /api/override-alert] - Manually change a dose status between TAKEN and MISSED
app.post('/api/override-alert', (req, res) => {
  const { alertId, newStatus } = req.body;
  const alert = alertsHistory.find(a => a.id === alertId);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  const oldStatus = alert.status;
  const targetStatus = newStatus ? newStatus.toUpperCase() : (oldStatus === 'TAKEN' ? 'MISSED' : 'TAKEN');

  alert.status = targetStatus;
  alert.manuallyOverridden = true;
  alert.actionDetails = `Manually changed to ${targetStatus} by user`;

  // Recalculate stats
  const taken = alertsHistory.filter(a => a.status === 'TAKEN').length;
  const missed = alertsHistory.filter(a => a.status === 'MISSED').length;
  boxState.stats.takenCount = taken;
  boxState.stats.missedCount = missed;
  boxState.stats.totalReminders = alertsHistory.length;
  boxState.stats.manuallyChangedCount = (boxState.stats.manuallyChangedCount || 0) + 1;

  const logType = targetStatus === 'TAKEN' ? 'ALERT_TAKEN' : 'ALERT_MISSED';
  addLog('USER_OVERRIDE', logType, `✏️ MANUAL OVERRIDE: ${alert.doseName} changed from ${oldStatus} ➔ ${targetStatus} on dashboard`, { alertId, oldStatus, newStatus: targetStatus });

  broadcast('ALERT_OVERRIDDEN', { alert, boxState, alertsHistory });
  res.json({ success: true, alert, boxState });
});

// -------------------------------------------------------------
// [RESET DATA]
// -------------------------------------------------------------
app.post('/api/clear-history', (req, res) => {
  alertsHistory = [];
  logsStream = [];
  boxState.stats = { totalReminders: 0, takenCount: 0, missedCount: 0, manuallyChangedCount: 0 };
  addLog('SYSTEM', 'INFO', 'Alert history and logs reset by user.');
  broadcast('RESET', { boxState, alertsHistory, logsStream });
  res.json({ success: true });
});

// Get local IPv4 address so the user knows what IP to put in ESP32 code
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` Smart Medical Box Dashboard Server Running!`);
    console.log(` Local Dashboard URL : http://localhost:${PORT}`);
    console.log(` Network URL for ESP32: http://${localIP}:${PORT}`);
    console.log(`======================================================\n`);
    addLog('SERVER', 'INFO', `Server initialized on http://${localIP}:${PORT}`);
  });
}

module.exports = app;
