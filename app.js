/**
 * MotoSafe — Motor Condition & Health Monitoring Engine
 * Pure HTML, CSS, JavaScript Dashboard Architecture
 */

// Global System Configuration & Baselines
const CONFIG = {
    pollingIntervalMs: 1000,
    historyMaxLength: 30, // Keep 30 time points in live charts
    dataSource: 'rest',   // 'mock' | 'rest' | 'websocket' | 'mqtt'
    apiUrl: 'http://192.168.4.1/api/telemetry',
    
    // Motor Baseline Limits & Normal Operating Thresholds
    baselines: {
        temp: { min: 30.0, max: 40.0, warn: 45.0, critical: 52.0, targetMid: 35.0, unit: '°C' },
        rpm: { min: 1400, max: 1500, warnDev: 100, criticalDev: 250, targetMid: 1450, unit: 'RPM' },
        current: { min: 1.50, max: 3.00, warn: 3.50, critical: 4.20, targetMid: 2.25, unit: 'A' },
        voltage: { min: 11.5, max: 12.6, targetMid: 12.1, unit: 'V' },
        vibration: { min: 1.00, max: 1.80, warn: 2.30, critical: 3.20, targetMid: 1.40, unit: 'g RMS' },
        sound: { min: 35.0, max: 48.0, warn: 55.0, critical: 65.0, targetMid: 40.0, unit: 'dB' }
    }
};

// Application State
const state = {
    motorState: 'STOPPED', // 'RUNNING' | 'STOPPED' | 'CRITICAL'
    controlSource: 'dashboard',
    targetPwm: 0,
    runningSeconds: 0, // Real-time running hours accumulator
    healthScore: 100,
    faultInjected: null, // null | 'temp' | 'vibration' | 'current'
    audioAlertEnabled: false,
    lastAudioTime: 0,
    userRole: 'admin', // 'admin' | 'technician' | 'viewer'

    // Telemetry Buffer
    telemetryHistory: [],
    
    // Event Log History (Live dynamic logs only)
    eventLogs: []
};

// Active Live Chart References
let overviewChart = null;
let miniCharts = {};
let analyticsCharts = {};

// Web Audio API Context for Synthetic Alert Chimes
let audioCtx = null;

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    loadSavedThresholds();
    loadSavedDataSource();
    initClock();
    initTabNavigation();
    initControlEventListeners();
    initAuthRoleSystem();
    initCharts();
    
    // Start Data Loop
    startTelemetryLoop();
});

// --------------------------------------------------------------------------
// 1. Clock & UI Utilities
// --------------------------------------------------------------------------
function initClock() {
    const clockEl = document.getElementById('live-clock');
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toTimeString().split(' ')[0];
    }, 1000);
}

// --------------------------------------------------------------------------
// 2. Navigation Tabs Logic
// --------------------------------------------------------------------------
function initTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    const tabPages = document.querySelectorAll('.tab-page');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            navButtons.forEach(b => b.classList.remove('active'));
            tabPages.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const activePage = document.getElementById(`tab-${targetTab}`);
            if (activePage) activePage.classList.add('active');

            // Trigger chart resize on tab switch
            window.dispatchEvent(new Event('resize'));
        });
    });
}

// --------------------------------------------------------------------------
// 3. Telemetry Generation Engine (Mock Physics & Hardware Adapter)
// --------------------------------------------------------------------------
function startTelemetryLoop() {
    setInterval(async () => {
        const dataPoint = await fetchTelemetryData();
        if (dataPoint) {
            processTelemetry(dataPoint);
        }
    }, CONFIG.pollingIntervalMs);
}

async function fetchTelemetryData() {
    const now = new Date();
    const timeLabel = now.toTimeString().split(' ')[0];

    // If simulating mock data
    if (CONFIG.dataSource === 'mock') {
        let temp, rpm, current, voltage, vibration, sound;

        if (state.motorState === 'STOPPED') {
            // Cooling / Idle physics
            temp = Math.max(25.0, (state.telemetryHistory.slice(-1)[0]?.temp || 36.5) - 0.2);
            rpm = 0;
            current = 0.05 + Math.random() * 0.02;
            voltage = 12.2 + (Math.random() - 0.5) * 0.1;
            vibration = 0.10 + Math.random() * 0.05;
            sound = 22.0 + Math.random() * 1.5;
        } else {
            // Normal Running physics with slight continuous noise
            const noise = () => (Math.random() - 0.5);
            
            const targetRpmMid = CONFIG.baselines.rpm.targetMid;
            rpm = Math.round(targetRpmMid * (state.targetPwm / 100) + noise() * 12);
            temp = Number((36.5 + noise() * 0.4).toFixed(1));
            current = Number((2.35 + noise() * 0.08).toFixed(2));
            voltage = Number((12.1 + noise() * 0.1).toFixed(1));
            vibration = Number((1.45 + noise() * 0.06).toFixed(2));
            sound = Number((38.5 + noise() * 1.2).toFixed(1));

            // Apply Fault Injections if triggered
            if (state.faultInjected === 'temp') {
                temp = Number((58.5 + Math.random() * 1.5).toFixed(1));
            } else if (state.faultInjected === 'vibration') {
                vibration = Number((3.85 + Math.random() * 0.3).toFixed(2));
            } else if (state.faultInjected === 'current') {
                current = Number((4.60 + Math.random() * 0.2).toFixed(2));
            }

            state.runningSeconds++;
        }

        const power = Number((voltage * current).toFixed(1));
        const efficiency = state.motorState === 'STOPPED' ? 0 : Number((92.5 - (vibration > 2.0 ? 15 : 0)).toFixed(1));
        const torque = state.motorState === 'STOPPED' ? 0 : Number((0.85 + (current - 2.35) * 0.1).toFixed(2));

        return { timestamp: timeLabel, temp, rpm, current, voltage, power, vibration, sound, efficiency, torque };
    } 
    
    // Hardware bridge interface (Live ESP32 REST API fetch)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(CONFIG.apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            const esp = await res.json();
            const temp = Number(parseFloat(esp.temp).toFixed(1));
            const rpm = parseInt(esp.rpm) || 0;
            const current = Number(parseFloat(esp.current).toFixed(2));
            const voltage = Number(parseFloat(esp.voltage).toFixed(1));
            const vibration = Number(parseFloat(esp.vibration).toFixed(2));
            const sound = Number(parseFloat(esp.sound).toFixed(1));
            const power = Number((voltage * current).toFixed(1));
            const efficiency = esp.motorState === 'STOPPED' ? 0 : Number((92.5 - (vibration > 2.0 ? 15 : 0)).toFixed(1));
            const torque = esp.motorState === 'STOPPED' ? 0 : Number((0.85 + (current - 2.35) * 0.1).toFixed(2));

            if (esp.motorState) {
                state.motorState = esp.motorState;
            }

            if (state.motorState === 'RUNNING') {
                state.runningSeconds++;
            }

            return { timestamp: timeLabel, temp, rpm, current, voltage, power, vibration, sound, efficiency, torque };
        }
    } catch (err) {
        console.warn('ESP32 REST hardware fetch offline:', err);
    }

    // If ESP32 hardware polling fails or sensors are unattached, return strict real hardware zero state
    return { 
        timestamp: timeLabel, 
        temp: 0.0, 
        rpm: 0, 
        current: 0.0, 
        voltage: 0.0, 
        power: 0.0, 
        vibration: 0.0, 
        sound: 0.0, 
        efficiency: 0.0, 
        torque: 0.0,
        offline: true
    };
}

// --------------------------------------------------------------------------
// 4. MotoSafe Health Score & Anomaly Detection Algorithm
// --------------------------------------------------------------------------
function processTelemetry(data) {
    // 1. Calculate Health Score
    const health = computeHealthScore(data);
    state.healthScore = health;
    data.healthScore = health;

    // 2. Append to history buffer
    state.telemetryHistory.push(data);
    if (state.telemetryHistory.length > CONFIG.historyMaxLength) {
        state.telemetryHistory.shift();
    }

    // 3. Update UI Elements
    updateOverviewCards(data);
    updateSystemStatusPill(health, data);
    updateActiveAlerts(data);
    updateCharts(data);
    updateMaintenanceTab();
}

function computeHealthScore(data) {
    if (state.motorState === 'STOPPED') return 100;

    let score = 100;
    const b = CONFIG.baselines;

    // 1. Temperature Penalty (30% max impact)
    if (data.temp > b.temp.warn) {
        const overflow = data.temp - b.temp.warn;
        score -= Math.min(30, overflow * 3.5);
    }

    // 2. Vibration Penalty (30% max impact)
    if (data.vibration > b.vibration.warn) {
        const overflow = data.vibration - b.vibration.warn;
        score -= Math.min(30, overflow * 20);
    }

    // 3. Current Penalty (20% max impact)
    if (data.current > b.current.warn) {
        const overflow = data.current - b.current.warn;
        score -= Math.min(20, overflow * 15);
    }

    // 4. RPM Slip / Speed Deviation (10% max impact)
    const rpmDev = Math.abs(data.rpm - b.rpm.targetMid);
    if (rpmDev > b.rpm.warnDev) {
        score -= Math.min(10, (rpmDev - b.rpm.warnDev) * 0.08);
    }

    // 5. Sound Penalty (10% max impact)
    if (data.sound > b.sound.warn) {
        score -= Math.min(10, (data.sound - b.sound.warn) * 0.5);
    }

    return Math.max(0, Math.round(score));
}

function safeText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function safeHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// --------------------------------------------------------------------------
// 5. Dynamic UI Updates
// --------------------------------------------------------------------------
function updateOverviewCards(d) {
    const b = CONFIG.baselines;

    // Values Display
    safeText('val-temp', d.temp.toFixed(1));
    safeText('val-rpm', d.rpm);
    safeText('val-current', d.current.toFixed(2));
    safeText('val-vibration', d.vibration.toFixed(2));
    safeText('val-sound', d.sound.toFixed(1));

    // Power & Voltage Display
    safeText('val-power-inline', `(${d.power} W)`);
    safeText('val-voltage-inline', `${d.voltage} V DC`);

    // Efficiency & Torque Display
    safeText('val-efficiency', d.efficiency.toFixed(1));
    safeText('val-torque-display', `${d.torque.toFixed(2)} Nm`);

    // Control Source Display
    if (d.controlSource) {
        state.controlSource = d.controlSource;
        const sourceLabel = d.controlSource === 'HARDWARE_RIG_SWITCH' ? 'Physical Rig Switch' : 'Web Dashboard';
        const sourceIcon = d.controlSource === 'HARDWARE_RIG_SWITCH' ? 'fa-toggle-on text-warning' : 'fa-gamepad text-info';
        safeHTML('sidebar-control-source', `<i class="fa-solid ${sourceIcon}"></i> Source: ${sourceLabel}`);
    }

    // Health & RUL Display
    safeText('health-score-display', d.healthScore);
    safeText('sidebar-health-val', `${d.healthScore}/100`);

    const healthBar = document.getElementById('sidebar-health-bar');
    if (healthBar) healthBar.style.width = `${d.healthScore}%`;

    const rulHours = Math.max(0, Math.round((d.healthScore / 100) * 450));
    const rulText = document.getElementById('val-rul-text');
    if (rulText) {
        rulText.textContent = `${d.healthScore}% (${rulHours} hrs)`;
        rulText.className = d.healthScore >= 70 ? 'text-success' : 'text-danger';
    }

    const healthBadge = document.getElementById('health-badge');
    const riskLevel = document.getElementById('risk-level-display');

    if (healthBadge && riskLevel) {
        if (d.healthScore >= 90) {
            healthBadge.className = 'badge badge-normal';
            healthBadge.textContent = 'EXCELLENT';
            riskLevel.className = 'risk-level text-success';
            riskLevel.innerHTML = '<i class="fa-solid fa-shield-check"></i> Low Risk';
        } else if (d.healthScore >= 70) {
            healthBadge.className = 'badge badge-warning';
            healthBadge.textContent = 'MODERATE';
            riskLevel.className = 'risk-level text-warning';
            riskLevel.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Moderate Risk';
        } else {
            healthBadge.className = 'badge badge-danger';
            healthBadge.textContent = 'CRITICAL';
            riskLevel.className = 'risk-level text-danger';
            riskLevel.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> High Alarm Risk';
        }
    }

    // Baseline Deviations calculations
    renderDeviation('dev-temp', 'temp-status-badge', d.temp, b.temp.targetMid, b.temp.warn, '°C');
    renderDeviation('dev-current', 'current-status-badge', d.current, b.current.targetMid, b.current.warn, 'A');
    renderDeviation('dev-vibration', 'vibration-status-badge', d.vibration, b.vibration.targetMid, b.vibration.warn, 'g');
    renderDeviation('dev-sound', 'sound-status-badge', d.sound, b.sound.targetMid, b.sound.warn, 'dB');
    
    // RPM speed deviation
    const rpmDev = d.rpm - b.rpm.targetMid;
    const rpmBadge = document.getElementById('rpm-status-badge');
    const rpmDevPill = document.getElementById('dev-rpm');
    if (rpmBadge && rpmDevPill) {
        if (state.motorState === 'STOPPED') {
            rpmBadge.className = 'badge badge-neutral';
            rpmBadge.textContent = 'OFF';
            rpmDevPill.className = 'deviation-pill neutral';
            rpmDevPill.innerHTML = '<i class="fa-solid fa-pause"></i> Standby';
        } else if (Math.abs(rpmDev) > b.rpm.warnDev) {
            rpmBadge.className = 'badge badge-warning';
            rpmBadge.textContent = 'SPEED DEVIATION';
            rpmDevPill.className = 'deviation-pill warn';
            rpmDevPill.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${rpmDev > 0 ? '+' : ''}${rpmDev} RPM slip`;
        } else {
            rpmBadge.className = 'badge badge-normal';
            rpmBadge.textContent = 'OPTIMAL';
            rpmDevPill.className = 'deviation-pill neutral';
            rpmDevPill.innerHTML = '<i class="fa-solid fa-check"></i> Optimal speed';
        }
    }

    // Sensors tab synchronization
    safeText('sensor-page-temp', `${d.temp.toFixed(1)} °C`);
    if (b.temp && b.temp.warn) safeText('sensor-page-temp-limit', `Max ${b.temp.warn.toFixed(1)} °C`);
    safeText('sensor-page-rpm', `${d.rpm} RPM`);
    safeText('sensor-page-current', `${d.current.toFixed(2)} A`);
    safeText('sensor-page-voltage', `${d.voltage.toFixed(1)} V`);
    safeText('sensor-page-power', `${d.power.toFixed(1)} W`);
    safeText('sensor-page-vib', `${d.vibration.toFixed(2)} g`);
}

function renderDeviation(devId, badgeId, currentVal, targetMid, warnVal, unit) {
    const devEl = document.getElementById(devId);
    const badgeEl = document.getElementById(badgeId);

    const devPct = Math.round(((currentVal - targetMid) / targetMid) * 100);
    const sign = devPct >= 0 ? '+' : '';

    if (currentVal >= warnVal) {
        badgeEl.className = 'badge badge-danger';
        badgeEl.textContent = 'ELEVATED';
        devEl.className = 'deviation-pill alert';
        devEl.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> ${sign}${devPct}% vs baseline!`;
    } else if (devPct > 15 || devPct < -15) {
        badgeEl.className = 'badge badge-warning';
        badgeEl.textContent = 'MODERATE';
        devEl.className = 'deviation-pill warn';
        devEl.innerHTML = `<i class="fa-solid fa-arrow-right-long"></i> ${sign}${devPct}% vs baseline`;
    } else {
        badgeEl.className = 'badge badge-normal';
        badgeEl.textContent = 'NORMAL';
        devEl.className = 'deviation-pill neutral';
        devEl.innerHTML = `<i class="fa-solid fa-check"></i> ${sign}${devPct}% vs baseline`;
    }
}

function updateSystemStatusPill(health, d) {
    const statusPill = document.getElementById('system-status-badge');
    const statusText = document.getElementById('system-status-text');

    if (state.motorState === 'STOPPED') {
        statusPill.className = 'system-status-pill badge-neutral';
        statusText.textContent = 'MOTOR OFF';
    } else if (health < 70 || state.faultInjected) {
        statusPill.className = 'system-status-pill badge-critical-mode';
        statusText.textContent = 'ANOMALY DETECTED';
        triggerAudioAlert();
    } else {
        statusPill.className = 'system-status-pill badge-healthy';
        statusText.textContent = 'SYSTEM NORMAL';
    }
}

// Phase 11 Persistence & Hysteresis Filtering Engine
const persistenceState = {
    counters: { temp: 0, vibration: 0, current: 0 },
    activeAlertsLatched: { temp: false, vibration: false, current: false },
    requiredTicks: 3 // Require 3 consecutive seconds before triggering alert
};

function updateActiveAlerts(d) {
    const alertsContainer = document.getElementById('alerts-container');
    const badgeCount = document.getElementById('alert-count-badge');
    const b = CONFIG.baselines;

    const activeAlerts = [];

    // 1. Temperature Persistence & Hysteresis Check
    const tempClearThresh = b.temp.warn - 2.0; // Hysteresis clear band
    if (d.temp > b.temp.warn || state.faultInjected === 'temp') {
        persistenceState.counters.temp++;
        if (persistenceState.counters.temp >= persistenceState.requiredTicks || state.faultInjected === 'temp') {
            persistenceState.activeAlertsLatched.temp = true;
        }
    } else if (d.temp < tempClearThresh) {
        persistenceState.counters.temp = 0;
        persistenceState.activeAlertsLatched.temp = false;
    }

    if (persistenceState.activeAlertsLatched.temp) {
        activeAlerts.push({
            title: 'High Temperature Warning (Persistent)',
            msg: `Temperature ${d.temp}°C exceeded baseline limit (${b.temp.warn}°C) for >3s. Hysteresis clear: <${tempClearThresh.toFixed(1)}°C.`,
            type: 'danger-alert',
            icon: 'fa-temperature-full text-danger'
        });
    }

    // 2. Vibration Persistence & Hysteresis Check
    const vibClearThresh = b.vibration.warn - 0.3;
    if (d.vibration > b.vibration.warn || state.faultInjected === 'vibration') {
        persistenceState.counters.vibration++;
        if (persistenceState.counters.vibration >= persistenceState.requiredTicks || state.faultInjected === 'vibration') {
            persistenceState.activeAlertsLatched.vibration = true;
        }
    } else if (d.vibration < vibClearThresh) {
        persistenceState.counters.vibration = 0;
        persistenceState.activeAlertsLatched.vibration = false;
    }

    if (persistenceState.activeAlertsLatched.vibration) {
        activeAlerts.push({
            title: 'Excessive Mechanical Vibration (Persistent)',
            msg: `Vibration peak ${d.vibration}g RMS sustained over threshold (${b.vibration.warn}g). Hysteresis clear: <${vibClearThresh.toFixed(1)}g.`,
            type: 'danger-alert',
            icon: 'fa-wave-square text-danger'
        });
    }

    // 3. Current Overload Persistence Check
    const currentClearThresh = b.current.warn - 0.4;
    if (d.current > b.current.warn || state.faultInjected === 'current') {
        persistenceState.counters.current++;
        if (persistenceState.counters.current >= persistenceState.requiredTicks || state.faultInjected === 'current') {
            persistenceState.activeAlertsLatched.current = true;
        }
    } else if (d.current < currentClearThresh) {
        persistenceState.counters.current = 0;
        persistenceState.activeAlertsLatched.current = false;
    }

    if (persistenceState.activeAlertsLatched.current) {
        activeAlerts.push({
            title: 'Electrical Overcurrent Detected (Persistent)',
            msg: `Motor current spiked to ${d.current}A (Threshold: ${b.current.warn}A). Hysteresis clear: <${currentClearThresh.toFixed(2)}A.`,
            type: 'warn-alert',
            icon: 'fa-bolt text-warning'
        });
    }

    badgeCount.textContent = `${activeAlerts.length} Alert${activeAlerts.length !== 1 ? 's' : ''}`;

    if (activeAlerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="empty-alerts">
                <i class="fa-solid fa-circle-check text-success"></i>
                <p>All telemetry parameters operating within normal baseline limits (Hysteresis & Persistence Filter Active).</p>
            </div>
        `;
        return;
    }

    alertsContainer.innerHTML = activeAlerts.map(a => `
        <div class="alert-item ${a.type}">
            <i class="fa-solid ${a.icon} style="font-size: 18px; margin-top: 2px;"></i>
            <div class="alert-content">
                <h5>${a.title}</h5>
                <p>${a.msg}</p>
                <div class="alert-time">${d.timestamp}</div>
            </div>
        </div>
    `).join('');
}

function updateMaintenanceTab() {
    const hrs = (state.runningSeconds / 3600).toFixed(1);
    const runtimeEl = document.getElementById('val-runtime');
    if (runtimeEl) runtimeEl.textContent = `${hrs} hrs`;

    // Dynamic anomaly count from real event logs
    const anomalyCount = state.eventLogs.filter(l => l.type === 'WARN' || l.type === 'CRITICAL').length;
    const anomalyEl = document.getElementById('val-total-anomalies');
    if (anomalyEl) anomalyEl.textContent = anomalyCount;

    const lastServicedEl = document.getElementById('val-last-serviced');
    if (lastServicedEl) {
        const today = new Date().toISOString().split('T')[0];
        lastServicedEl.textContent = today;
    }

    // Populate events table
    const tableBody = document.getElementById('events-table-body');
    if (!tableBody) return;

    if (state.eventLogs.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    <i class="fa-solid fa-circle-check text-success"></i> No anomalies logged. System operating normally.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = state.eventLogs.map(log => `
        <tr>
            <td>${log.timestamp}</td>
            <td><span class="badge ${log.type === 'WARN' ? 'badge-warning' : (log.type === 'CRITICAL' ? 'badge-danger' : 'badge-normal')}">${log.type}</span></td>
            <td>${log.param}</td>
            <td><strong>${log.val}</strong></td>
            <td>${log.limit}</td>
            <td>${log.status}</td>
        </tr>
    `).join('');
}

// --------------------------------------------------------------------------
// 6. Audio Warning Chime Engine (Web Audio API)
// --------------------------------------------------------------------------
function triggerAudioAlert() {
    if (!state.audioAlertEnabled) return;

    const now = Date.now();
    if (now - state.lastAudioTime < 4000) return; // Limit chime interval to 4 seconds
    state.lastAudioTime = now;

    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc2.frequency.setValueAtTime(1320, audioCtx.currentTime + 0.15); // E6 note

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start();
        osc2.start(audioCtx.currentTime + 0.15);
        osc1.stop(audioCtx.currentTime + 0.4);
        osc2.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
        console.warn('Audio Context play blocked:', e);
    }
}

// --------------------------------------------------------------------------
// 7. Interactive Controls & Threshold Configuration
// --------------------------------------------------------------------------
function initControlEventListeners() {
    // Audio alert toggle
    const audioBtn = document.getElementById('btn-toggle-audio');
    audioBtn.addEventListener('click', () => {
        state.audioAlertEnabled = !state.audioAlertEnabled;
        audioBtn.className = state.audioAlertEnabled ? 'btn btn-outline btn-sm active-audio' : 'btn btn-outline btn-sm';
        audioBtn.innerHTML = state.audioAlertEnabled ?
            '<i class="fa-solid fa-volume-high"></i> Audio On' :
            '<i class="fa-solid fa-volume-xmark"></i> Audio Off';
    });

    // Quick Start / Stop buttons
    document.getElementById('btn-quick-stop').addEventListener('click', () => setMotorState('STOPPED'));
    document.getElementById('btn-quick-start').addEventListener('click', () => setMotorState('RUNNING'));

    // Toggle switch in Control tab
    const toggleSwitch = document.getElementById('toggle-motor-state');
    toggleSwitch.addEventListener('change', (e) => {
        setMotorState(e.target.checked ? 'RUNNING' : 'STOPPED');
    });

    // Control source
    document.getElementById('select-control-source').addEventListener('change', (e) => {
        state.controlSource = e.target.value;
    });

    // PWM speed slider
    const pwmSlider = document.getElementById('range-motor-pwm');
    pwmSlider.addEventListener('input', (e) => {
        state.targetPwm = parseInt(e.target.value);
        document.getElementById('pwm-value-label').textContent = `Target: ${Math.round(CONFIG.baselines.rpm.targetMid * (state.targetPwm/100))} RPM (${state.targetPwm}% duty)`;
    });

    // Fault Injectors for mentor live demonstration
    document.getElementById('inject-overheat').addEventListener('click', () => injectFault('temp', 'Overheating Fault Injected (58°C)'));
    document.getElementById('inject-vibration').addEventListener('click', () => injectFault('vibration', 'High Vibration Fault Injected (3.8g)'));
    document.getElementById('inject-overcurrent').addEventListener('click', () => injectFault('current', 'Overcurrent Fault Injected (4.5A)'));
    document.getElementById('reset-faults').addEventListener('click', () => {
        state.faultInjected = null;
        logEvent('INFO', 'Fault Injection', 'Normal', 'Restored', 'Normal Operation');
    });

    // Custom Threshold Save Button
    document.getElementById('btn-save-thresholds').addEventListener('click', saveCustomThresholds);

    // Data Source mode selector
    document.getElementById('btn-toggle-source').addEventListener('click', () => {
        const modeSelect = document.getElementById('select-data-mode');
        const nextMode = modeSelect.value === 'mock' ? 'rest' : 'mock';
        modeSelect.value = nextMode;
        setDataSource(nextMode);
    });

    document.getElementById('select-data-mode').addEventListener('change', (e) => {
        setDataSource(e.target.value);
    });

    // ESP32 Code Copy
    document.getElementById('btn-copy-esp32-code').addEventListener('click', () => {
        const codeText = document.getElementById('esp32-code-snippet').textContent;
        navigator.clipboard.writeText(codeText).then(() => {
            const btn = document.getElementById('btn-copy-esp32-code');
            btn.innerHTML = '<i class="fa-solid fa-check text-success"></i> Copied to Clipboard!';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy C++ Code';
            }, 2500);
        });
    });

    // Export CSV & Printable Report
    document.getElementById('btn-export-csv').addEventListener('click', exportCsvLog);
    document.getElementById('btn-generate-report').addEventListener('click', () => window.print());
}

function saveCustomThresholds() {
    const tempLimit = parseFloat(document.getElementById('input-thresh-temp').value) || 45.0;
    const vibLimit = parseFloat(document.getElementById('input-thresh-vib').value) || 2.30;
    const currentLimit = parseFloat(document.getElementById('input-thresh-current').value) || 3.50;
    const rpmTarget = parseInt(document.getElementById('input-thresh-rpm').value) || 1450;
    const soundLimit = parseFloat(document.getElementById('input-thresh-sound').value) || 55.0;

    CONFIG.baselines.temp.warn = tempLimit;
    CONFIG.baselines.vibration.warn = vibLimit;
    CONFIG.baselines.current.warn = currentLimit;
    CONFIG.baselines.rpm.targetMid = rpmTarget;
    CONFIG.baselines.sound.warn = soundLimit;

    // Update labels
    document.getElementById('disp-temp-baseline').textContent = `30.0 – ${tempLimit.toFixed(1)} °C`;
    document.getElementById('disp-vib-baseline').textContent = `1.0 – ${vibLimit.toFixed(1)} g`;
    document.getElementById('disp-current-baseline').textContent = `1.50 – ${currentLimit.toFixed(2)} A`;
    document.getElementById('disp-rpm-baseline').textContent = `${rpmTarget - 50} – ${rpmTarget + 50} RPM`;

    // Persist to localStorage
    localStorage.setItem('motosafe_thresholds', JSON.stringify({
        temp: tempLimit, vib: vibLimit, current: currentLimit, rpm: rpmTarget, sound: soundLimit
    }));

    logEvent('INFO', 'Threshold Setup', 'Updated', 'Custom', 'Saved to Browser Storage');
    alert('✅ MotoSafe baseline safety thresholds updated and saved!');
}

function loadSavedThresholds() {
    const saved = localStorage.getItem('motosafe_thresholds');
    if (!saved) return;
    try {
        const t = JSON.parse(saved);
        if (t.temp) CONFIG.baselines.temp.warn = t.temp;
        if (t.vib) CONFIG.baselines.vibration.warn = t.vib;
        if (t.current) CONFIG.baselines.current.warn = t.current;
        if (t.rpm) CONFIG.baselines.rpm.targetMid = t.rpm;
        if (t.sound) CONFIG.baselines.sound.warn = t.sound;

        document.getElementById('input-thresh-temp').value = t.temp;
        document.getElementById('input-thresh-vib').value = t.vib;
        document.getElementById('input-thresh-current').value = t.current;
        document.getElementById('input-thresh-rpm').value = t.rpm;
        document.getElementById('input-thresh-sound').value = t.sound;
    } catch (e) {
        console.warn('Failed to parse saved thresholds:', e);
    }
}

function setMotorState(newState) {
    state.motorState = newState;
    const isRunning = newState === 'RUNNING';

    document.getElementById('sidebar-motor-state').textContent = isRunning ? 'RUNNING' : 'STOPPED';
    document.getElementById('sidebar-motor-state').style.color = isRunning ? 'var(--success)' : 'var(--danger)';
    document.getElementById('sidebar-motor-dot').className = isRunning ? 'status-indicator-dot online' : 'status-indicator-dot offline';
    document.getElementById('toggle-motor-state').checked = isRunning;

    // Send control command to Node.js backend
    fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState, pwm: state.targetPwm })
    }).catch(err => console.warn('Backend control sync:', err));

    logEvent(isRunning ? 'INFO' : 'WARN', 'Motor Relay State', isRunning ? 'RUNNING' : 'STOPPED', 'Remote Toggle', 'Success');
}

function injectFault(type, description) {
    state.faultInjected = type;
    logEvent('WARN', 'Demo Fault Injector', type.toUpperCase(), description, 'Active Fault');
}


function loadSavedDataSource() {
    const saved = localStorage.getItem('motosafe_data_source');
    if (!saved) return;
    // Update config
    CONFIG.dataSource = saved;
    // Update select dropdown if present
    const modeSelect = document.getElementById('select-data-mode');
    if (modeSelect) modeSelect.value = saved;
    // Update UI label
    const label = document.getElementById('data-source-label');
    if (label) {
        if (saved === 'mock') {
            label.textContent = 'Data Mode: Simulated ESP32';
        } else {
            label.textContent = `Data Mode: ESP32 Hardware (${saved.toUpperCase()})`;
        }
    }
}

function setDataSource(mode) {
    CONFIG.dataSource = mode;
    localStorage.setItem('motosafe_data_source', mode);
    const label = document.getElementById('data-source-label');
    if (mode === 'mock') {
        label.textContent = 'Data Mode: Simulated ESP32';
    } else {
        label.textContent = `Data Mode: ESP32 Hardware (${mode.toUpperCase()})`;
    }
}

function logEvent(type, param, val, limit, status) {
    const now = new Date();
    const ts = now.toISOString().replace('T', ' ').substring(0, 19);
    state.eventLogs.unshift({
        id: Date.now(),
        timestamp: ts,
        type, param, val, limit, status
    });
    if (state.eventLogs.length > 20) state.eventLogs.pop();
}

function exportCsvLog() {
    let csv = 'Timestamp,Event Type,Parameter,Recorded Value,Baseline Limit,Status\n';
    state.eventLogs.forEach(row => {
        csv += `"${row.timestamp}","${row.type}","${row.param}","${row.val}","${row.limit}","${row.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MotoSafe_Logs_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
}

// --------------------------------------------------------------------------
// 8. Chart.js Initialization & Real-time Stream Updates
// --------------------------------------------------------------------------
function initCharts() {
    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 } } } },
        scales: {
            x: { grid: { color: '#1e293b' }, ticks: { color: '#6b7280', font: { size: 10 } } },
            y: { grid: { color: '#1e293b' }, ticks: { color: '#6b7280', font: { size: 10 } } }
        }
    };

    // 1. Overview Combined Chart
    const ctxOverview = document.getElementById('overviewCombinedChart')?.getContext('2d');
    if (ctxOverview) {
        overviewChart = new Chart(ctxOverview, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Vibration (g RMS)',
                        data: [],
                        borderColor: '#8b5cf6',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Motor Health Index',
                        data: [],
                        borderColor: '#10b981',
                        borderDash: [4, 4],
                        borderWidth: 2,
                        tension: 0.2,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                ...chartDefaults,
                scales: {
                    x: chartDefaults.scales.x,
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: '#1e293b' },
                        ticks: { color: '#9ca3af' },
                        title: { display: true, text: 'Temp / Health', color: '#6b7280' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#8b5cf6' },
                        title: { display: true, text: 'Vibration (g)', color: '#8b5cf6' }
                    }
                }
            }
        });
    }

    // 2. Mini Sensor Sparkline Charts
    createMiniSparkline('miniTempChart', '#f59e0b');
    createMiniSparkline('miniRpmChart', '#06b6d4');
    createMiniSparkline('miniCurrentChart', '#3b82f6');
    createMiniSparkline('miniVibChart', '#8b5cf6');

    // 3. Analytics Tab Correlation Charts
    const ctxTempCorr = document.getElementById('chartTempCurrentCorr')?.getContext('2d');
    if (ctxTempCorr) {
        analyticsCharts.tempCurr = new Chart(ctxTempCorr, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Temperature (°C)', data: [], borderColor: '#f59e0b', yAxisID: 'y' },
                    { label: 'Motor Current (A)', data: [], borderColor: '#3b82f6', yAxisID: 'y1' }
                ]
            },
            options: chartDefaults
        });
    }

    const ctxVibRpm = document.getElementById('chartVibRpmCorr')?.getContext('2d');
    if (ctxVibRpm) {
        analyticsCharts.vibRpm = new Chart(ctxVibRpm, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Vibration (g)', data: [], borderColor: '#8b5cf6', yAxisID: 'y' },
                    { label: 'RPM Speed', data: [], borderColor: '#06b6d4', yAxisID: 'y1' }
                ]
            },
            options: chartDefaults
        });
    }
}

function createMiniSparkline(canvasId, color) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    miniCharts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: color,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

function updateCharts(d) {
    if (!overviewChart) return;

    const labels = state.telemetryHistory.map(h => h.timestamp);
    const temps = state.telemetryHistory.map(h => h.temp);
    const vibs = state.telemetryHistory.map(h => h.vibration);
    const healths = state.telemetryHistory.map(h => h.healthScore);
    const rpms = state.telemetryHistory.map(h => h.rpm);
    const currents = state.telemetryHistory.map(h => h.current);

    // Overview Chart
    overviewChart.data.labels = labels;
    overviewChart.data.datasets[0].data = temps;
    overviewChart.data.datasets[1].data = vibs;
    overviewChart.data.datasets[2].data = healths;
    overviewChart.update('none');

    // Mini Charts
    updateMiniChart('miniTempChart', labels, temps);
    updateMiniChart('miniRpmChart', labels, rpms);
    updateMiniChart('miniCurrentChart', labels, currents);
    updateMiniChart('miniVibChart', labels, vibs);

    // Analytics Charts
    if (analyticsCharts.tempCurr) {
        analyticsCharts.tempCurr.data.labels = labels;
        analyticsCharts.tempCurr.data.datasets[0].data = temps;
        analyticsCharts.tempCurr.data.datasets[1].data = currents;
        analyticsCharts.tempCurr.update('none');
    }

    if (analyticsCharts.vibRpm) {
        analyticsCharts.vibRpm.data.labels = labels;
        analyticsCharts.vibRpm.data.datasets[0].data = vibs;
        analyticsCharts.vibRpm.data.datasets[1].data = rpms;
        analyticsCharts.vibRpm.update('none');
    }
}

function updateMiniChart(chartId, labels, data) {
    if (miniCharts[chartId]) {
        miniCharts[chartId].data.labels = labels;
        miniCharts[chartId].data.datasets[0].data = data;
        miniCharts[chartId].update('none');
    }
}

// --------------------------------------------------------------------------
// 9. Role-Based Access Control (Phase 19)
// --------------------------------------------------------------------------
function initAuthRoleSystem() {
    const savedRole = localStorage.getItem('motosafe_role') || 'admin';
    state.userRole = savedRole;

    const modal = document.getElementById('login-modal');
    const userBtn = document.getElementById('btn-user-profile');
    const confirmBtn = document.getElementById('btn-login-confirm');
    const roleOptions = document.querySelectorAll('.role-option');

    let selectedRole = savedRole;

    if (userBtn) {
        userBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'flex';
        });
    }

    roleOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            roleOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedRole = opt.getAttribute('data-role');
        });
    });

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            state.userRole = selectedRole;
            localStorage.setItem('motosafe_role', selectedRole);
            if (modal) modal.style.display = 'none';
            applyRolePermissions();
            logEvent('INFO', 'User Authentication', 'Role Changed', selectedRole.toUpperCase(), 'Success');
        });
    }

    applyRolePermissions();
}

function applyRolePermissions() {
    const role = state.userRole;
    const roleBadge = document.getElementById('current-user-role');
    if (roleBadge) {
        roleBadge.textContent = `Role: ${role.toUpperCase()}`;
    }

    const controlTab = document.getElementById('tab-control');
    const quickStopBtn = document.getElementById('btn-quick-stop');
    const quickStartBtn = document.getElementById('btn-quick-start');
    const toggleSwitch = document.getElementById('toggle-motor-state');
    const pwmSlider = document.getElementById('range-motor-pwm');
    const faultButtons = document.querySelectorAll('.fault-buttons-grid button');
    const saveThreshBtn = document.getElementById('btn-save-thresholds');

    if (role === 'viewer') {
        // Read-only Viewer/Mentor Role: Lock controls
        if (quickStopBtn) quickStopBtn.disabled = true;
        if (quickStartBtn) quickStartBtn.disabled = true;
        if (toggleSwitch) toggleSwitch.disabled = true;
        if (pwmSlider) pwmSlider.disabled = true;
        if (saveThreshBtn) saveThreshBtn.disabled = true;
        faultButtons.forEach(b => b.disabled = true);
        if (controlTab) controlTab.classList.add('role-disabled-lock');
    } else if (role === 'technician') {
        // Operator Role: Can toggle motor, but cannot change thresholds or inject faults
        if (quickStopBtn) quickStopBtn.disabled = false;
        if (quickStartBtn) quickStartBtn.disabled = false;
        if (toggleSwitch) toggleSwitch.disabled = false;
        if (pwmSlider) pwmSlider.disabled = false;
        if (saveThreshBtn) saveThreshBtn.disabled = true;
        faultButtons.forEach(b => b.disabled = true);
        if (controlTab) controlTab.classList.remove('role-disabled-lock');
    } else {
        // Admin Role: Full Access
        if (quickStopBtn) quickStopBtn.disabled = false;
        if (quickStartBtn) quickStartBtn.disabled = false;
        if (toggleSwitch) toggleSwitch.disabled = false;
        if (pwmSlider) pwmSlider.disabled = false;
        if (saveThreshBtn) saveThreshBtn.disabled = false;
        faultButtons.forEach(b => b.disabled = false);
        if (controlTab) controlTab.classList.remove('role-disabled-lock');
    }
}

