/**
 * MotoSafe — Node.js Backend Server (Express + WebSockets + Database)
 * Phases 4, 5, 12, 13 Implementation
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const MotoSafeMQTTClient = require('./mqttClient');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize MQTT PubSub Client
const mqttService = new MotoSafeMQTTClient((mqttPayload) => {
    // Received telemetry via MQTT from ESP32
    if (mqttPayload.temp !== undefined) latestTelemetry.temp = parseFloat(mqttPayload.temp);
    if (mqttPayload.temp_dht !== undefined) latestTelemetry.temp_dht = parseFloat(mqttPayload.temp_dht);
    if (mqttPayload.temp_ntc !== undefined) latestTelemetry.temp_ntc = parseFloat(mqttPayload.temp_ntc);
    if (mqttPayload.rpm !== undefined) latestTelemetry.rpm = parseInt(mqttPayload.rpm);
    if (mqttPayload.current !== undefined) latestTelemetry.current = parseFloat(mqttPayload.current);
    if (mqttPayload.voltage !== undefined) latestTelemetry.voltage = parseFloat(mqttPayload.voltage);
    if (mqttPayload.vibration !== undefined) latestTelemetry.vibration = parseFloat(mqttPayload.vibration);
    if (mqttPayload.sound !== undefined) latestTelemetry.sound = parseFloat(mqttPayload.sound);
    if (mqttPayload.motorState !== undefined) motorState = mqttPayload.motorState;

    latestTelemetry.timestamp = new Date().toTimeString().split(' ')[0];
    latestTelemetry.healthScore = computeHealth(latestTelemetry);
    broadcastWebSocket(latestTelemetry);
});
mqttService.connect();

// Serve MotoSafe Frontend Static Web Files
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// Database File Path
const DB_FILE = path.join(__dirname, 'database.json');

// System State
let motorState = 'STOPPED';
let targetPwm = 0;
let telemetryHistory = [];
let eventLogs = [
    { id: 1, timestamp: new Date().toISOString(), type: 'INFO', param: 'Backend Startup', val: 'Server Active', limit: 'N/A', status: 'Passed' }
];

// Load historical database if exists
if (fs.existsSync(DB_FILE)) {
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const dbData = JSON.parse(raw);
        if (dbData.telemetryHistory) telemetryHistory = dbData.telemetryHistory.slice(-50);
        if (dbData.eventLogs) eventLogs = dbData.eventLogs.slice(-30);
    } catch (e) {
        console.warn('Could not parse database.json, initializing fresh DB.');
    }
}

// Global Latest Telemetry Cache (Production Real Hardware Initial State)
let latestTelemetry = {
    timestamp: new Date().toTimeString().split(' ')[0],
    temp: 0.0,
    temp_dht: 0.0,
    temp_ntc: 0.0,
    rpm: 0,
    current: 0.0,
    voltage: 0.0,
    power: 0.0,
    vibration: 0.0,
    sound: 0.0,
    efficiency: 0.0,
    torque: 0.0,
    healthScore: 100,
    motorState: 'STOPPED',
    controlSource: 'HARDWARE_RIG_SWITCH'
};

// Baselines
const BASELINES = {
    temp: 45.0,
    vibration: 2.30,
    current: 3.50,
    rpmMid: 1450
};

// Telemetry Generator / Processor Engine
function generateMockPoint() {
    const timeLabel = new Date().toTimeString().split(' ')[0];
    const noise = () => (Math.random() - 0.5);

    if (motorState === 'STOPPED') {
        latestTelemetry.temp = Math.max(25.0, Number((latestTelemetry.temp - 0.2).toFixed(1)));
        latestTelemetry.temp_dht = latestTelemetry.temp;
        latestTelemetry.temp_ntc = 0.0;
        latestTelemetry.rpm = 0;
        latestTelemetry.current = Number((0.05 + Math.random() * 0.02).toFixed(2));
        latestTelemetry.vibration = Number((0.10 + Math.random() * 0.05).toFixed(2));
        latestTelemetry.sound = Number((22.0 + Math.random() * 1.5).toFixed(1));
    } else {
        latestTelemetry.rpm = Math.round(BASELINES.rpmMid * (targetPwm / 100) + noise() * 12);
        latestTelemetry.temp = Number((36.5 + noise() * 0.4).toFixed(1));
        latestTelemetry.temp_dht = latestTelemetry.temp;
        latestTelemetry.temp_ntc = Number((latestTelemetry.temp - 1.2 + noise() * 0.3).toFixed(1));
        latestTelemetry.current = Number((2.35 + noise() * 0.08).toFixed(2));
        latestTelemetry.voltage = Number((12.1 + noise() * 0.1).toFixed(1));
        latestTelemetry.vibration = Number((1.45 + noise() * 0.06).toFixed(2));
        latestTelemetry.sound = Number((38.5 + noise() * 1.2).toFixed(1));
    }

    latestTelemetry.timestamp = timeLabel;
    latestTelemetry.power = Number((latestTelemetry.voltage * latestTelemetry.current).toFixed(1));
    latestTelemetry.healthScore = computeHealth(latestTelemetry);
    latestTelemetry.motorState = motorState;

    telemetryHistory.push({ ...latestTelemetry });
    if (telemetryHistory.length > 50) telemetryHistory.shift();

    saveDatabase();
}

function computeHealth(d) {
    if (motorState === 'STOPPED') return 100;
    let score = 100;
    if (d.temp > BASELINES.temp) score -= (d.temp - BASELINES.temp) * 3.5;
    if (d.vibration > BASELINES.vibration) score -= (d.vibration - BASELINES.vibration) * 20;
    if (d.current > BASELINES.current) score -= (d.current - BASELINES.current) * 15;
    return Math.max(0, Math.round(score));
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify({ telemetryHistory, eventLogs }, null, 2));
    } catch (e) {
        console.error('Error writing database.json:', e);
    }
}

// --------------------------------------------------------------------------
// REST API ROUTES
// --------------------------------------------------------------------------

// 1. GET Live Telemetry
app.get('/api/telemetry/live', (req, res) => {
    res.json(latestTelemetry);
});

// 2. GET Telemetry History (Database logs)
app.get('/api/telemetry/history', (req, res) => {
    res.json(telemetryHistory);
});

// 3. POST ESP32 Telemetry Receiver (Hardware ESP32 Posts Here)
app.post('/api/telemetry', (req, res) => {
    const data = req.body;
    if (data.temp !== undefined) latestTelemetry.temp = parseFloat(data.temp);
    if (data.rpm !== undefined) latestTelemetry.rpm = parseInt(data.rpm);
    if (data.current !== undefined) latestTelemetry.current = parseFloat(data.current);
    if (data.voltage !== undefined) latestTelemetry.voltage = parseFloat(data.voltage);
    if (data.vibration !== undefined) latestTelemetry.vibration = parseFloat(data.vibration);
    if (data.sound !== undefined) latestTelemetry.sound = parseFloat(data.sound);
    if (data.motorState !== undefined) motorState = data.motorState;
    if (data.controlSource !== undefined) latestTelemetry.controlSource = data.controlSource;

    latestTelemetry.timestamp = new Date().toTimeString().split(' ')[0];
    latestTelemetry.healthScore = computeHealth(latestTelemetry);

    broadcastWebSocket(latestTelemetry);
    res.json({ status: 'success', message: 'ESP32 Telemetry Received' });
});

// 4. POST Motor Control Command (From Dashboard to ESP32 / Server)
app.post('/api/control', (req, res) => {
    const { state, pwm, source } = req.body;
    if (state) motorState = state;
    if (pwm !== undefined) targetPwm = parseInt(pwm);
    latestTelemetry.controlSource = source || 'DASHBOARD';

    // Publish MQTT control command to ESP32
    mqttService.publishControlCommand('MOTOR-01', motorState, targetPwm);

    // Direct HTTP bridge to ESP32 Access Point if connected
    fetch('http://192.168.4.1/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: motorState, pwm: targetPwm }),
        signal: AbortSignal.timeout(1000)
    }).catch(() => {});

    eventLogs.unshift({
        id: Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        type: 'INFO',
        param: 'Motor Command',
        val: motorState,
        limit: `${targetPwm}% PWM (${latestTelemetry.controlSource})`,
        status: 'Executed'
    });

    broadcastWebSocket({ type: 'CONTROL_UPDATE', motorState, targetPwm, controlSource: latestTelemetry.controlSource });
    res.json({ status: 'success', motorState, targetPwm, controlSource: latestTelemetry.controlSource });
});

// 5. GET Alerts & Event Logs
app.get('/api/alerts', (req, res) => {
    res.json(eventLogs);
});

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

function broadcastWebSocket(payload) {
    const message = JSON.stringify(payload);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// WebSocket Connection Event
wss.on('connection', (ws) => {
    console.log('⚡ Browser Dashboard Client Connected to WebSocket Stream');
    ws.send(JSON.stringify({ type: 'INIT', telemetry: latestTelemetry, history: telemetryHistory }));
});

// Mock telemetry generation disabled for real hardware operation

// Start Server
server.listen(PORT, () => {
    console.log('====================================================');
    console.log(` 🚀 MotoSafe Node.js Backend Server Running!`);
    console.log(` 🌐 Web Dashboard : http://localhost:${PORT}`);
    console.log(` ⚡ WebSocket Stream: ws://localhost:${PORT}/ws`);
    console.log(` 📡 REST API Route  : http://localhost:${PORT}/api/telemetry/live`);
    console.log('====================================================');
});
