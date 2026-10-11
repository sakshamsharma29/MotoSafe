/**
 * MotoSafe — Node.js MQTT Publisher & Subscriber Module (Phase 5 & 8)
 * Connects Node.js Backend to MQTT Broker for ESP32 IoT Communication
 */

const mqtt = require('mqtt');

// Public MQTT Broker for testing (or local broker e.g. mqtt://localhost:1883)
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
const TELEMETRY_TOPIC = 'motosafe/motor/+/telemetry';
const CONTROL_TOPIC_PREFIX = 'motosafe/motor/';

class MotoSafeMQTTClient {
    constructor(onTelemetryCallback) {
        this.onTelemetryCallback = onTelemetryCallback;
        this.client = null;
    }

    connect() {
        console.log(`📡 Connecting Node.js MQTT Client to Broker: ${MQTT_BROKER}...`);
        this.client = mqtt.connect(MQTT_BROKER, {
            clientId: 'MotoSafe_Backend_' + Math.random().toString(16).substring(2, 8),
            keepalive: 60,
            reconnectPeriod: 2000
        });

        this.client.on('connect', () => {
            console.log('✅ MQTT Broker Connected Successfully!');
            this.client.subscribe(TELEMETRY_TOPIC, (err) => {
                if (!err) {
                    console.log(`📥 Subscribed to MQTT Topic: ${TELEMETRY_TOPIC}`);
                }
            });
        });

        this.client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                console.log(`📩 Received MQTT Telemetry on [${topic}]:`, payload);
                if (this.onTelemetryCallback) {
                    this.onTelemetryCallback(payload);
                }
            } catch (e) {
                console.warn('Failed to parse MQTT message:', e);
            }
        });

        this.client.on('error', (err) => {
            console.warn('MQTT Connection Error:', err.message);
        });
    }

    publishControlCommand(motorId, commandState, pwmValue) {
        if (!this.client || !this.client.connected) {
            console.warn('MQTT client not connected, skipping publish.');
            return;
        }

        const topic = `${CONTROL_TOPIC_PREFIX}${motorId}/control`;
        const payload = JSON.stringify({
            motorId,
            command: commandState,
            pwm: pwmValue,
            timestamp: new Date().toISOString()
        });

        this.client.publish(topic, payload, { qos: 1 }, (err) => {
            if (!err) {
                console.log(`📤 Published MQTT Control Command to [${topic}]:`, payload);
            }
        });
    }
}

module.exports = MotoSafeMQTTClient;
