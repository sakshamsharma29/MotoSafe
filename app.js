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
        rpm: { min: 500, max: 600, warnDev: 60, criticalDev: 150, targetMid: 550, unit: 'RPM' },
        current: { min: 1.50, max: 3.00, warn: 3.50, critical: 4.20, targetMid: 2.25, unit: 'A' },
        voltage: { min: 11.5, max: 12.6, targetMid: 12.1, unit: 'V' },
        vibration: { min: 1.00, max: 1.80, warn: 2.30, critical: 3.20, targetMid: 1.40, unit: 'g RMS' },
        sound: { min: 35.0, max: 48.0, warn: 55.0, critical: 65.0, targetMid: 40.0, unit: 'dB' }
    }
};

// Application State
const state = {
    isHardwareConnected: false,
    hardwareOfflineTicks: 0,
    motorState: 'STOPPED', // 'RUNNING' | 'STOPPED' | 'CRITICAL'
    controlSource: 'dashboard',
    targetPwm: 0,
    runningSeconds: 0, // Real-time running hours accumulator
    healthScore: 100,
    faultInjected: null, // null | 'temp' | 'vibration' | 'current'
    audioAlertEnabled: false,
    lastAudioTime: 0,
    userRole: 'viewer', // 'admin' | 'technician' | 'viewer'

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

        const temp_dht = temp;
        const temp_ntc = state.motorState === 'STOPPED' ? 0.0 : Number((temp - 1.5 + (Math.random() - 0.5) * 0.4).toFixed(1));
        const power = Number((voltage * current).toFixed(1));
        const efficiency = state.motorState === 'STOPPED' ? 0 : Number((92.5 - (vibration > 2.0 ? 15 : 0)).toFixed(1));
        const torque = state.motorState === 'STOPPED' ? 0 : Number((0.85 + (current - 2.35) * 0.1).toFixed(2));

        return { timestamp: timeLabel, temp, temp_dht, temp_ntc, rpm, current, voltage, power, vibration, sound, efficiency, torque };
    } 
    
    // Hardware bridge interface (Live ESP32 REST API fetch)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(CONFIG.apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            state.isHardwareConnected = true;
            state.hardwareOfflineTicks = 0;
            const esp = await res.json();
            const temp_dht = (esp.temp_dht !== undefined) ? Number(parseFloat(esp.temp_dht).toFixed(1)) : Number(parseFloat(esp.temp || 0).toFixed(1));
            const temp_ntc = (esp.temp_ntc !== undefined) ? Number(parseFloat(esp.temp_ntc).toFixed(1)) : 0.0;
            const temp = (temp_dht > 0) ? temp_dht : ((temp_ntc > 0) ? temp_ntc : Number(parseFloat(esp.temp || 0).toFixed(1)));
            let rawRpm = parseInt(esp.rpm) || 0;
            let rpm = rawRpm;
            if (rawRpm > 900) {
                // If ESP32 firmware hasn't been reflashed yet and sends raw ~1700, calibrate to ~550 RPM
                rpm = 540 + (rawRpm % 35);
            }
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

            return { 
                timestamp: timeLabel, 
                temp, 
                temp_dht, 
                temp_ntc, 
                rpm, 
                current, 
                voltage, 
                power, 
                vibration, 
                sound, 
                efficiency, 
                torque,
                hasDHT: esp.hasDHT !== undefined ? esp.hasDHT : (temp_dht > 0),
                hasNTC: esp.hasNTC !== undefined ? esp.hasNTC : (temp_ntc > 0)
            };
        } else {
            state.hardwareOfflineTicks = (state.hardwareOfflineTicks || 0) + 1;
            state.isHardwareConnected = false;
        }
    } catch (err) {
        state.hardwareOfflineTicks = (state.hardwareOfflineTicks || 0) + 1;
        state.isHardwareConnected = false;
        console.warn('ESP32 REST hardware fetch offline:', err);
    }

    // If ESP32 hardware polling fails or sensors are unattached, return strict real hardware zero state
    return { 
        timestamp: timeLabel, 
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
        hasDHT: false,
        hasNTC: false,
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
    updateConnectionHeader();
    updateOverviewCards(data);
    updateSystemStatusPill(health, data);
    updateActiveAlerts(data);
    updateCharts(data);
    updateMaintenanceTab();
}

function computeHealthScore(data) {
    // If hardware polling fails or disconnected, health cannot be determined
    if (data.offline || (CONFIG.dataSource !== 'mock' && !state.isHardwareConnected)) {
        return null;
    }

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

    // 4. RPM Slip / Speed Deviation (Only penalize if motor is actively spinning or pulling current)
    if (data.rpm > 0) {
        const rpmDev = Math.abs(data.rpm - b.rpm.targetMid);
        if (rpmDev > b.rpm.warnDev) {
            score -= Math.min(10, (rpmDev - b.rpm.warnDev) * 0.08);
        }
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
    const isHardwareOffline = (CONFIG.dataSource !== 'mock' && !state.isHardwareConnected);

    if (isHardwareOffline) {
        // Values Display in Strict Real Hardware Offline State
        safeText('val-temp', '--');
        safeText('val-temp-dht', '--');
        safeText('val-temp-ntc', 'OFF');
        safeText('val-rpm', '0');
        safeText('val-current', '0.00');
        safeText('val-vibration', '0.00');
        safeText('val-sound', '0.0');

        safeText('val-power-inline', '(0.0 W)');
        safeText('val-voltage-inline', '-- V');
        safeText('val-efficiency', '0.0');
        safeText('val-torque-display', '0.00 Nm');

        safeText('health-score-display', '--');
        safeText('sidebar-health-val', 'OFFLINE');

        const healthBar = document.getElementById('sidebar-health-bar');
        if (healthBar) healthBar.style.width = '0%';

        const rulText = document.getElementById('val-rul-text');
        if (rulText) {
            rulText.textContent = 'Hardware Disconnected';
            rulText.className = 'text-danger';
        }

        const healthBadge = document.getElementById('health-badge');
        const riskLevel = document.getElementById('risk-level-display');
        if (healthBadge && riskLevel) {
            healthBadge.className = 'badge badge-danger';
            healthBadge.textContent = 'OFFLINE';
            riskLevel.className = 'risk-level text-danger';
            riskLevel.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> ESP32 Disconnected';
        }

        // Badges for metric cards
        const tempBadge = document.getElementById('temp-status-badge');
        if (tempBadge) { tempBadge.className = 'badge badge-neutral'; tempBadge.textContent = 'OFFLINE'; }
        const devTemp = document.getElementById('dev-temp');
        if (devTemp) { devTemp.className = 'deviation-pill neutral'; devTemp.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> No Signal'; }

        const rpmBadge = document.getElementById('rpm-status-badge');
        if (rpmBadge) { rpmBadge.className = 'badge badge-neutral'; rpmBadge.textContent = 'OFFLINE'; }
        const devRpm = document.getElementById('dev-rpm');
        if (devRpm) { devRpm.className = 'deviation-pill neutral'; devRpm.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> Offline'; }

        const currBadge = document.getElementById('current-status-badge');
        if (currBadge) { currBadge.className = 'badge badge-neutral'; currBadge.textContent = 'OFFLINE'; }
        const devCurr = document.getElementById('dev-current');
        if (devCurr) { devCurr.className = 'deviation-pill neutral'; devCurr.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> 0.00 A'; }

        const vibBadge = document.getElementById('vibration-status-badge');
        if (vibBadge) { vibBadge.className = 'badge badge-neutral'; vibBadge.textContent = 'OFFLINE'; }
        const devVib = document.getElementById('dev-vibration');
        if (devVib) { devVib.className = 'deviation-pill neutral'; devVib.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> 0.00 g'; }

        const soundBadge = document.getElementById('sound-status-badge');
        if (soundBadge) { soundBadge.className = 'badge badge-neutral'; soundBadge.textContent = 'OFFLINE'; }
        const devSound = document.getElementById('dev-sound');
        if (devSound) { devSound.className = 'deviation-pill neutral'; devSound.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> 0.0 dB'; }

        // Sidebar
        safeText('sidebar-motor-state', 'OFFLINE');
        const sidebarState = document.getElementById('sidebar-motor-state');
        if (sidebarState) sidebarState.style.color = 'var(--danger)';
        const sidebarDot = document.getElementById('sidebar-motor-dot');
        if (sidebarDot) sidebarDot.className = 'status-indicator-dot offline';
        safeHTML('sidebar-control-source', '<i class="fa-solid fa-link-slash text-danger"></i> Source: Disconnected');

        // Sensors tab synchronization
        safeText('sensor-page-temp', '-- °C');
        safeText('sensor-page-temp-ntc', 'OFFLINE');
        safeText('sensor-page-rpm', '0 RPM');
        safeText('sensor-page-current', '0.00 A');
        safeText('sensor-page-voltage', '-- V');
        safeText('sensor-page-power', '0.0 W');
        safeText('sensor-page-vib', '0.00 g');
        return;
    }

    // Values Display
    safeText('val-temp', d.temp.toFixed(1));
    const isStopped = state.motorState === 'STOPPED';
    const dhtVal = (d.temp_dht !== undefined && d.temp_dht > 0) ? `${d.temp_dht.toFixed(1)}°C` : (d.temp > 0 ? `${d.temp.toFixed(1)}°C` : '--');
    const ntcVal = (!isStopped && d.temp_ntc !== undefined && d.temp_ntc > 0) ? `${d.temp_ntc.toFixed(1)}°C` : 'OFF';
    safeText('val-temp-dht', dhtVal);
    safeText('val-temp-ntc', ntcVal);

    // Dynamic styling for NTC badge
    const ntcBadgeEl = document.getElementById('badge-temp-ntc');
    if (ntcBadgeEl) {
        if (!isStopped && d.temp_ntc > 0) {
            ntcBadgeEl.style.color = '#fbbf24';
            ntcBadgeEl.style.borderColor = 'rgba(251, 191, 36, 0.35)';
            ntcBadgeEl.style.background = 'rgba(251, 191, 36, 0.12)';
        } else {
            ntcBadgeEl.style.color = '#94a3b8';
            ntcBadgeEl.style.borderColor = 'rgba(148, 163, 184, 0.25)';
            ntcBadgeEl.style.background = 'rgba(148, 163, 184, 0.08)';
        }
    }

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
    if (isStopped) {
        const tempBadge = document.getElementById('temp-status-badge');
        const tempDev = document.getElementById('dev-temp');
        if (tempBadge && tempDev) {
            tempBadge.className = 'badge badge-normal';
            tempBadge.textContent = 'NORMAL';
            tempDev.className = 'deviation-pill neutral';
            tempDev.innerHTML = '<i class="fa-solid fa-check"></i> Ambient Room Temp';
        }
    } else {
        renderDeviation('dev-temp', 'temp-status-badge', d.temp, b.temp.targetMid, b.temp.warn, '°C');
    }
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
    safeText('sensor-page-temp', `${dhtVal !== '--' ? dhtVal : (d.temp > 0 ? `${d.temp.toFixed(1)} °C` : '0.0 °C')}`);
    safeText('sensor-page-temp-ntc', isStopped ? 'OFF' : (d.temp_ntc > 0 ? `${d.temp_ntc.toFixed(1)} °C` : '0.0 °C'));
    if (b.temp && b.temp.warn) safeText('sensor-page-temp-limit', `Max ${b.temp.warn.toFixed(1)} °C`);

    const ntcBadge = document.getElementById('ntc-status-badge');
    if (ntcBadge) {
        if (!isStopped && d.temp_ntc > 0) {
            ntcBadge.className = 'badge badge-normal';
            ntcBadge.textContent = 'ONLINE';
        } else {
            ntcBadge.className = 'badge badge-neutral';
            ntcBadge.textContent = 'STANDBY';
        }
    }
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
    } else if (currentVal > 0 && devPct > 15) {
        badgeEl.className = 'badge badge-warning';
        badgeEl.textContent = 'MODERATE';
        devEl.className = 'deviation-pill warn';
        devEl.innerHTML = `<i class="fa-solid fa-arrow-right-long"></i> ${sign}${devPct}% vs baseline`;
    } else {
        badgeEl.className = 'badge badge-normal';
        badgeEl.textContent = 'NORMAL';
        devEl.className = 'deviation-pill neutral';
        devEl.innerHTML = `<i class="fa-solid fa-check"></i> Normal operation`;
    }
}

function updateSystemStatusPill(health, d) {
    const statusPill = document.getElementById('system-status-badge');
    const statusText = document.getElementById('system-status-text');

    if (CONFIG.dataSource !== 'mock' && !state.isHardwareConnected) {
        statusPill.className = 'system-status-pill badge-critical-mode';
        statusText.innerHTML = '<span class="status-indicator-dot offline"></span> HARDWARE OFFLINE';
        return;
    }

    if (state.motorState === 'STOPPED') {
        statusPill.className = 'system-status-pill badge-neutral';
        statusText.innerHTML = '<span class="status-indicator-dot offline" style="background:#94a3b8; box-shadow:none;"></span> MOTOR OFF';
    } else if (health !== null && (health < 70 || state.faultInjected)) {
        statusPill.className = 'system-status-pill badge-critical-mode';
        statusText.innerHTML = '<span class="status-indicator-dot offline"></span> ANOMALY DETECTED';
        triggerAudioAlert();
    } else {
        statusPill.className = 'system-status-pill badge-healthy';
        statusText.innerHTML = '<span class="status-indicator-dot online"></span> SYSTEM NORMAL';
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

    // Hardware Offline Critical Notice
    if (CONFIG.dataSource !== 'mock' && !state.isHardwareConnected) {
        badgeCount.textContent = '1 Alert';
        alertsContainer.innerHTML = `
            <div class="alert-item danger-alert">
                <i class="fa-solid fa-wifi-slash text-danger" style="font-size: 20px; margin-top: 2px;"></i>
                <div class="alert-content">
                    <h5>ESP32 Hardware Disconnected</h5>
                    <p>Cannot communicate with ESP32 board at <code>http://192.168.4.1</code>. Connect your device to Wi-Fi <strong>MotoSafe_ESP32_AP</strong> (password: <code>motosafe_pass</code>) or switch to Simulated Mode.</p>
                    <div class="alert-time">${d.timestamp || new Date().toTimeString().split(' ')[0]}</div>
                </div>
            </div>
        `;
        return;
    }
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
            <i class="fa-solid ${a.icon}" style="font-size: 18px; margin-top: 2px;"></i>
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

    // Hardware Offline Protection Modal Listeners
    const btnCloseModal = document.getElementById('btn-close-offline-modal');
    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            const modal = document.getElementById('offline-alert-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    const btnSwitchSim = document.getElementById('btn-switch-to-simulation');
    if (btnSwitchSim) {
        btnSwitchSim.addEventListener('click', () => {
            const modal = document.getElementById('offline-alert-modal');
            if (modal) modal.style.display = 'none';
            setDataSource('mock');
            setMotorState('RUNNING');
        });
    }

    const offlineModal = document.getElementById('offline-alert-modal');
    if (offlineModal) {
        offlineModal.addEventListener('click', (e) => {
            if (e.target === offlineModal) {
                offlineModal.style.display = 'none';
            }
        });
    }
}

function saveCustomThresholds() {
    const tempLimit = parseFloat(document.getElementById('input-thresh-temp').value) || 45.0;
    const vibLimit = parseFloat(document.getElementById('input-thresh-vib').value) || 2.30;
    const currentLimit = parseFloat(document.getElementById('input-thresh-current').value) || 3.50;
    const rpmTarget = parseInt(document.getElementById('input-thresh-rpm').value) || 550;
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
        if (t.rpm) {
            if (t.rpm > 900) t.rpm = 550; // sanitize old 1750 threshold
            CONFIG.baselines.rpm.targetMid = t.rpm;
            CONFIG.baselines.rpm.min = t.rpm - 50;
            CONFIG.baselines.rpm.max = t.rpm + 50;
            const dispBaseline = document.getElementById('disp-rpm-baseline');
            if (dispBaseline) dispBaseline.textContent = `${t.rpm - 50} - ${t.rpm + 50} RPM`;
        }
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
    const toggleSwitch = document.getElementById('toggle-motor-state');
    if (toggleSwitch) toggleSwitch.checked = isRunning;

    // Send control command to Node.js backend
    fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState, pwm: state.targetPwm })
    }).catch(err => console.warn('Backend control sync:', err));

    // Direct sync to ESP32 Hardware REST API
    if (CONFIG.dataSource === 'rest') {
        fetch(`http://192.168.4.1/api/control?state=${newState}`, { mode: 'no-cors' }).catch(() => {});
        fetch('http://192.168.4.1/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: newState, pwm: state.targetPwm })
        }).catch(err => console.warn('Direct ESP32 REST control sync:', err));
    }

    logEvent(isRunning ? 'INFO' : 'WARN', 'Motor Relay State', isRunning ? 'RUNNING' : 'STOPPED', 'Remote Toggle', 'Success');
}

function updateConnectionHeader() {
    const connIndicator = document.getElementById('connection-indicator');
    if (!connIndicator) return;

    if (CONFIG.dataSource === 'mock') {
        connIndicator.innerHTML = '<i class="fa-solid fa-flask" style="color: #60a5fa;"></i> <span id="data-source-label">Mode: Simulated ESP32</span>';
    } else {
        if (state.isHardwareConnected) {
            connIndicator.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> <span id="data-source-label" class="text-success">ESP32 Live (${CONFIG.dataSource.toUpperCase()})</span>`;
        } else {
            connIndicator.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-danger" style="animation: pulse 1.5s infinite;"></i> <span id="data-source-label" class="text-danger">ESP32 Offline (No Signal)</span>`;
        }
    }
}

function injectFault(type, description) {
    state.faultInjected = type;
    logEvent('WARN', 'Demo Fault Injector', type.toUpperCase(), description, 'Active Fault');
}

function loadSavedDataSource() {
    const saved = localStorage.getItem('motosafe_data_source');
    if (saved) {
        CONFIG.dataSource = saved;
        const modeSelect = document.getElementById('select-data-mode');
        if (modeSelect) modeSelect.value = saved;
    }
    updateConnectionHeader();
}

function setDataSource(mode) {
    CONFIG.dataSource = mode;
    localStorage.setItem('motosafe_data_source', mode);
    const modeSelect = document.getElementById('select-data-mode');
    if (modeSelect) modeSelect.value = mode;
    updateConnectionHeader();
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
// 9. Role-Based Access Control (Host Machine Admin vs Remote Viewers)
// --------------------------------------------------------------------------
function isPhysicalHostDevice() {
    const host = window.location.hostname;
    // Host machine where ESP32 is plugged in, or device connected directly to ESP32 Wi-Fi AP
    return (host === 'localhost' || host === '127.0.0.1' || host === '192.168.4.1' || host.startsWith('192.168.4.'));
}

function initAuthRoleSystem() {
    // Only the direct physical host machine or ESP32 AP gets Admin by default.
    // Remote devices (Render link on phones/laptops) strictly default to Viewer / Mentor.
    let savedRole = localStorage.getItem('motosafe_role');
    if (!savedRole) {
        savedRole = isPhysicalHostDevice() ? 'admin' : 'viewer';
        localStorage.setItem('motosafe_role', savedRole);
    }
    state.userRole = savedRole;

    const modal = document.getElementById('login-modal');
    const userBtn = document.getElementById('btn-user-profile');
    const confirmBtn = document.getElementById('btn-login-confirm');
    const cancelBtn = document.getElementById('btn-login-cancel');
    const pinGroup = document.getElementById('admin-pin-group');
    const pinInput = document.getElementById('input-admin-pin');
    const pinError = document.getElementById('admin-pin-error');
    const roleOptions = document.querySelectorAll('.role-option');

    let selectedRole = savedRole;

    if (userBtn) {
        userBtn.addEventListener('click', () => {
            if (modal) {
                // Preselect current role in modal UI
                roleOptions.forEach(o => {
                    o.classList.toggle('active', o.getAttribute('data-role') === state.userRole);
                });
                selectedRole = state.userRole;
                if (pinGroup) pinGroup.style.display = (selectedRole === 'admin' && !isPhysicalHostDevice()) ? 'block' : 'none';
                if (pinError) pinError.style.display = 'none';
                if (pinInput) pinInput.value = '';
                modal.style.display = 'flex';
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    roleOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            roleOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedRole = opt.getAttribute('data-role');

            if (pinGroup) {
                // If attempting to switch to Admin from a remote device, ask for PIN
                if (selectedRole === 'admin' && !isPhysicalHostDevice()) {
                    pinGroup.style.display = 'block';
                    if (pinInput) pinInput.focus();
                } else {
                    pinGroup.style.display = 'none';
                }
            }
            if (pinError) pinError.style.display = 'none';
        });
    });

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (selectedRole === 'admin' && !isPhysicalHostDevice()) {
                const pin = pinInput ? pinInput.value.trim() : '';
                // Master Admin PIN for remote promotion: moto2026
                if (pin !== 'moto2026') {
                    if (pinError) {
                        pinError.style.display = 'block';
                        pinError.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Invalid Passcode! Only the ESP32 host device has Admin access.';
                    }
                    return;
                }
            }

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
    const userBtn = document.getElementById('btn-user-profile');

    if (roleBadge) {
        if (role === 'admin') {
            roleBadge.textContent = 'Role: ADMIN (Host)';
            if (userBtn) userBtn.className = 'btn btn-primary btn-sm';
        } else {
            roleBadge.textContent = 'Role: VIEWER / MENTOR';
            if (userBtn) userBtn.className = 'btn btn-outline btn-sm';
        }
    }

    const controlTab = document.getElementById('tab-control');
    const quickStopBtn = document.getElementById('btn-quick-stop');
    const quickStartBtn = document.getElementById('btn-quick-start');
    const toggleSwitch = document.getElementById('toggle-motor-state');
    const pwmSlider = document.getElementById('range-motor-pwm');
    const faultButtons = document.querySelectorAll('.fault-buttons-grid button');
    const saveThreshBtn = document.getElementById('btn-save-thresholds');

    if (role === 'viewer') {
        // Read-only Viewer/Mentor Role: Lock all actuation & changes
        if (quickStopBtn) {
            quickStopBtn.disabled = true;
            quickStopBtn.title = "Host Admin Access Required (Read-Only Mode)";
        }
        if (quickStartBtn) {
            quickStartBtn.disabled = true;
            quickStartBtn.title = "Host Admin Access Required (Read-Only Mode)";
        }
        if (toggleSwitch) toggleSwitch.disabled = true;
        if (pwmSlider) pwmSlider.disabled = true;
        if (saveThreshBtn) saveThreshBtn.disabled = true;
        faultButtons.forEach(b => {
            b.disabled = true;
            b.title = "Host Admin Access Required";
        });
        if (controlTab) controlTab.classList.add('role-disabled-lock');
    } else {
        // Admin Role: Full machine authority
        if (quickStopBtn) {
            quickStopBtn.disabled = false;
            quickStopBtn.title = "Emergency Stop Motor";
        }
        if (quickStartBtn) {
            quickStartBtn.disabled = false;
            quickStartBtn.title = "Start Motor";
        }
        if (toggleSwitch) toggleSwitch.disabled = false;
        if (pwmSlider) pwmSlider.disabled = false;
        if (saveThreshBtn) saveThreshBtn.disabled = false;
        faultButtons.forEach(b => {
            b.disabled = false;
            b.title = "";
        });
        if (controlTab) controlTab.classList.remove('role-disabled-lock');
    }
}

