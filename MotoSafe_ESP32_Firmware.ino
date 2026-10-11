/*
 * ============================================================================
 * MotoSafe — ESP32 Motor Health & Condition Monitoring Firmware (Production)
 * Strict Real-Time Hardware Telemetry Engine (Zero Mock / Zero Fallback Data)
 * ============================================================================
 * Hardware Pinout:
 *   - MOSFET Motor Driver PWM   : GPIO 25 (LEDC 5kHz Output -> Motor Gate)
 *   - INA219 (Voltage & Current): I2C SDA -> GPIO 21, SCL -> GPIO 22 (Address 0x24 / 0x40)
 *   - MPU6050 (Vibration)       : I2C SDA -> GPIO 21, SCL -> GPIO 22 (Address 0x68)
 *   - DHT22 Temp Sensor         : GPIO 4 (Digital 1-Wire Input)
 *   - NTC Thermistor Temp Sensor: GPIO 34 (ADC1 Analog Input)
 *   - Sound/Microphone Sensor   : GPIO 35 (ADC1 Input)
 *   - RPM Proximity Pulse Sensor: GPIO 27 (Input Pullup Interrupt)
 *   - Status LED Indicator      : GPIO 2 (Built-in LED)
 * ============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

const char* ssid         = "MotoSafe_ESP32_AP";
const char* password     = "motosafe_pass";
const char* mqttServer   = "broker.hivemq.com";
const int   mqttPort     = 1883;
const char* telemetryTopic = "motosafe/motor/MOTOR-01/telemetry";
const char* controlTopic   = "motosafe/motor/MOTOR-01/control";

WebServer server(80);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Sensor Pins
#define DHTPIN 4          // GPIO 4 connected to DHT22 DATA pin
#define DHTTYPE DHT22     // DHT22 digital sensor module
DHT dht(DHTPIN, DHTTYPE);

// Pin Definitions
const int PIN_NTC_TEMP        = 34; // NTC Thermistor temp sensor (GPIO 34 ADC1)
const int PIN_SOUND           = 35; // Sound/microphone analog input (GPIO 35)
const int PIN_MOSFET_PWM      = 25; // MOSFET motor PWM power pin (GPIO 25)
const int PIN_RPM_SENSOR      = 27; // Tachometer Proximity Pulse Sensor (GPIO 27)
const int PIN_STATUS_LED      = 2;  // Built-in status LED (onboard blue LED)

// Tachometer Variables
volatile unsigned long rpmPulseCount = 0;
unsigned long lastRpmCalcTime = 0;
int currentRealRPM = 0;

void IRAM_ATTR rpmPulseISR() {
  rpmPulseCount++;
}

// ESP32 LEDC PWM Configuration for Motor Driver on GPIO 25
const int PWM_FREQ       = 5000; // 5 kHz PWM frequency
const int PWM_CHANNEL    = 0;    // LEDC Channel 0
const int PWM_RESOLUTION = 8;    // 8-bit resolution (0-255)

// Hardware State Variables
unsigned long lastMqttPubTime = 0;
String activeControlSource = "WEB_DASHBOARD";
bool lastPhysicalSwitchState = HIGH;
bool motorIsOn = false;
int targetPwmPercent = 0;

// Dynamic I2C Device Addresses & Hardware Status
uint8_t activeInaAddr = 0;
uint8_t activeMpuAddr = 0;
bool hasINA219 = false;
bool hasMPU6050 = false;
bool hasLCD = false;

LiquidCrystal_I2C lcd(0x27, 16, 2);

// --------------------------------------------------------------------------
// Motor Power & Speed Control Function (GPIO 25 PWM)
// --------------------------------------------------------------------------
void setMotorPower(bool turnOn, int speedPercent = -1) {
  if (speedPercent >= 0) {
    targetPwmPercent = constrain(speedPercent, 0, 100);
  }
  motorIsOn = turnOn;
  
  if (motorIsOn) {
    int dutyCycle = map(targetPwmPercent > 0 ? targetPwmPercent : 95, 0, 100, 0, 255);
    ledcWrite(PWM_CHANNEL, dutyCycle);
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.print("⚡ [MOTOR ON] Speed: ");
    Serial.print(targetPwmPercent > 0 ? targetPwmPercent : 95);
    Serial.print("% | PWM Duty: ");
    Serial.println(dutyCycle);
  } else {
    ledcWrite(PWM_CHANNEL, 0); // Gate 0V
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("🛑 [MOTOR OFF] MOSFET Gate 0V");
  }
}

// --------------------------------------------------------------------------
// I2C Hardware Helper Functions
// --------------------------------------------------------------------------
bool checkI2CDevice(uint8_t addr) {
  Wire.beginTransmission(addr);
  return (Wire.endTransmission() == 0);
}

void initMPU6050() {
  uint8_t mpuAddrs[] = {0x68, 0x69, 0x24};
  for (int i = 0; i < 3; i++) {
    if (checkI2CDevice(mpuAddrs[i])) {
      activeMpuAddr = mpuAddrs[i];
      Wire.beginTransmission(activeMpuAddr);
      Wire.write(0x6B); // Power Management 1 register
      Wire.write(0x00); // Wake up MPU6050
      Wire.endTransmission();
      hasMPU6050 = true;
      Serial.print("✅ MPU6050 Vibration Sensor Active at I2C 0x");
      Serial.println(activeMpuAddr, HEX);
      return;
    }
  }
  hasMPU6050 = false;
  Serial.println("❌ MPU6050 Vibration Sensor NOT DETECTED on I2C (Status: Offline)");
}

void initINA219() {
  uint8_t inaAddrs[] = {0x24, 0x40, 0x41, 0x44, 0x45};
  for (int i = 0; i < 5; i++) {
    if (checkI2CDevice(inaAddrs[i])) {
      activeInaAddr = inaAddrs[i];
      hasINA219 = true;
      Serial.print("✅ INA219 Voltage/Current Sensor Active at I2C 0x");
      Serial.println(activeInaAddr, HEX);
      return;
    }
  }
  hasINA219 = false;
  Serial.println("❌ INA219 Voltage/Current Sensor NOT DETECTED on I2C (Status: Offline)");
}

void initLCD() {
  uint8_t lcdAddrs[] = {0x27, 0x3F, 0x20, 0x38};
  for (int i = 0; i < 4; i++) {
    if (checkI2CDevice(lcdAddrs[i])) {
      lcd = LiquidCrystal_I2C(lcdAddrs[i], 16, 2);
      lcd.init();
      lcd.backlight();
      lcd.setCursor(0, 0);
      lcd.print(" MotoSafe  v2.0 ");
      lcd.setCursor(0, 1);
      lcd.print(" Rig Ready     ");
      hasLCD = true;
      Serial.print("✅ I2C 16x2 LCD Display Active at 0x");
      Serial.println(lcdAddrs[i], HEX);
      return;
    }
  }
  hasLCD = false;
  Serial.println("ℹ️ I2C LCD Display not detected on I2C bus.");
}

void updateLCDDisplay(float tempDHT, float tempNTC, int rpm, float current) {
  if (!hasLCD) return;
  lcd.setCursor(0, 0);
  lcd.print("RPM:");
  lcd.print(rpm);

  if (!motorIsOn) {
    lcd.print(" T:");
    lcd.print(tempDHT > 0.0 ? tempDHT : tempNTC, 1);
    lcd.print("C  ");
  } else {
    // Alternate displaying DHT22 (D) and NTC (N) on LCD when motor runs
    static unsigned long lastLcdFlip = 0;
    static bool showNTC = false;
    if (millis() - lastLcdFlip > 2500) {
      lastLcdFlip = millis();
      showNTC = !showNTC;
    }

    if (showNTC && tempNTC > 0.0) {
      lcd.print(" N:");
      lcd.print(tempNTC, 1);
      lcd.print("C  ");
    } else {
      lcd.print(" D:");
      lcd.print(tempDHT, 1);
      lcd.print("C  ");
    }
  }

  lcd.setCursor(0, 1);
  lcd.print("I:");
  lcd.print(current, 2);
  lcd.print("A ");
  lcd.print(motorIsOn ? "RUNNING " : "STOPPED ");
}

// --------------------------------------------------------------------------
// Real Hardware Sensor Read Functions (Strict Real-Time - Zero Mock Data)
// --------------------------------------------------------------------------

// 1a. Temperature Read: DHT22 Digital Sensor on GPIO 4
float readTemperatureDHT() {
  float temp = dht.readTemperature();
  if (isnan(temp)) {
    return 0.0; // Sensor disconnected / reading failed
  }
  return temp;
}

// 1b. Temperature Read: NTC Thermistor Analog Sensor on GPIO 34
float readTemperatureNTC() {
  int rawADC = analogRead(PIN_NTC_TEMP);
  if (rawADC <= 50 || rawADC >= 4050) {
    return 0.0; // NTC disconnected or floating
  }

  // Standard 10k NTC with 10k fixed resistor (Beta 3950 Steinhart-Hart equation)
  float voltage = (rawADC / 4095.0) * 3.3;
  if (voltage >= 3.29 || voltage <= 0.01) return 0.0;

  float rNtc = 10000.0 * (voltage / (3.3 - voltage));
  if (rNtc <= 0.0) return 0.0;

  float steinhart = rNtc / 10000.0;            // (R/Ro)
  steinhart = log(steinhart);                  // ln(R/Ro)
  steinhart /= 3950.0;                         // 1/B * ln(R/Ro)
  steinhart += 1.0 / (25.0 + 273.15);          // + (1/To)
  steinhart = 1.0 / steinhart;                 // Invert
  float tempC = steinhart - 273.15;            // Convert to Celsius

  if (tempC < 0.0 || tempC > 120.0) return 0.0;
  return tempC;
}

// 1c. Primary Temperature (DHT22 priority, fallback to NTC)
float readTemperature() {
  float dhtT = readTemperatureDHT();
  if (dhtT > 0.0) return dhtT;
  return readTemperatureNTC();
}

// 2. Voltage Read (INA219 Bus Voltage)
float readVoltage() {
  if (hasINA219 && activeInaAddr != 0) {
    Wire.beginTransmission(activeInaAddr);
    Wire.write(0x02); // Bus voltage register
    if (Wire.endTransmission() == 0) {
      Wire.requestFrom((int)activeInaAddr, 2);
      if (Wire.available() >= 2) {
        int16_t raw = (Wire.read() << 8) | Wire.read();
        float busVoltage = (raw >> 3) * 0.004;
        return busVoltage;
      }
    }
  }
  return 0.0; // INA219 Not Connected
}

// 3. Current Read (INA219 Shunt Current Amperes)
float readCurrent() {
  if (!motorIsOn) return 0.0; // Motor stopped
  
  if (hasINA219 && activeInaAddr != 0) {
    Wire.beginTransmission(activeInaAddr);
    Wire.write(0x04); // Current register
    if (Wire.endTransmission() == 0) {
      Wire.requestFrom((int)activeInaAddr, 2);
      if (Wire.available() >= 2) {
        int16_t raw = (Wire.read() << 8) | Wire.read();
        float currentAmps = fabs(raw / 1000.0);
        return currentAmps;
      }
    }
  }
  return 0.0; // INA219 Not Connected
}

// 4. Vibration Read (MPU6050 3-Axis Accelerometer RMS Dynamic G-Force)
float readVibration() {
  if (hasMPU6050 && activeMpuAddr != 0) {
    Wire.beginTransmission(activeMpuAddr);
    Wire.write(0x3B); // Accel Xout H register
    if (Wire.endTransmission() == 0) {
      Wire.requestFrom((int)activeMpuAddr, 6);
      if (Wire.available() >= 6) {
        int16_t ax = (Wire.read() << 8) | Wire.read();
        int16_t ay = (Wire.read() << 8) | Wire.read();
        int16_t az = (Wire.read() << 8) | Wire.read();

        float gX = ax / 16384.0;
        float gY = ay / 16384.0;
        float gZ = az / 16384.0;

        float totalG = sqrt(gX * gX + gY * gY + gZ * gZ);
        // Net dynamic vibration (deviation from static 1.0g earth gravity)
        float dynamicVib = fabs(totalG - 1.0);
        return dynamicVib;
      }
    }
  }
  return 0.0; // MPU6050 Not Connected
}

// 5. Sound / Acoustic Read (Sound Sensor module on GPIO 35)
float readSound() {
  int rawADC = analogRead(PIN_SOUND);
  if (rawADC <= 5) {
    return 0.0; // Sound sensor disconnected
  }
  float soundDb = 35.0 + (rawADC / 4095.0) * 35.0;
  return soundDb;
}

// 6. Motor Speed (Real RPM from proximity pulse sensor on GPIO 27)
int calculateRPM() {
  unsigned long now = millis();
  unsigned long elapsed = now - lastRpmCalcTime;

  if (elapsed >= 1000) { // Recalculate every 1 second
    noInterrupts();
    unsigned long pulses = rpmPulseCount;
    rpmPulseCount = 0;
    interrupts();

    // Calculate RPM = (Pulses in elapsed time) * (60,000 ms / elapsed ms)
    currentRealRPM = (pulses * 60000UL) / elapsed;
    lastRpmCalcTime = now;
  }
  return currentRealRPM;
}

// --------------------------------------------------------------------------
// Telemetry Serialization & Network Handlers
// --------------------------------------------------------------------------
void publishMQTTTelemetry() {
  if (!mqttClient.connected()) return;

  float current  = readCurrent();
  float voltage  = readVoltage();
  float power    = current * voltage;
  float tempDHT  = readTemperatureDHT();
  float tempNTC  = readTemperatureNTC();
  float mainTemp = (tempDHT > 0.0) ? tempDHT : tempNTC;

  StaticJsonDocument<512> doc;
  doc["motorId"]       = "MOTOR-01";
  doc["temp"]          = mainTemp;
  doc["temp_dht"]      = tempDHT;
  doc["temp_ntc"]      = tempNTC;
  doc["rpm"]           = calculateRPM();
  doc["current"]       = current;
  doc["voltage"]       = voltage;
  doc["vibration"]     = readVibration();
  doc["sound"]         = readSound();
  doc["power"]         = power;
  doc["motorState"]    = motorIsOn ? "RUNNING" : "STOPPED";
  doc["controlSource"] = activeControlSource;

  // Real Hardware Detection Status Flags
  doc["hasINA219"]  = hasINA219;
  doc["hasMPU6050"] = hasMPU6050;
  doc["hasDHT"]     = (tempDHT > 0.0);
  doc["hasNTC"]     = (analogRead(PIN_NTC_TEMP) > 5);
  doc["hasSound"]   = (analogRead(PIN_SOUND) > 5);

  String jsonBuffer;
  serializeJson(doc, jsonBuffer);
  mqttClient.publish(telemetryTopic, jsonBuffer.c_str());
  Serial.println("📤 ESP32 Real Hardware Telemetry Published to MQTT.");
}

void handleTelemetry() {
  float current  = readCurrent();
  float voltage  = readVoltage();
  float power    = current * voltage;
  float tempDHT  = readTemperatureDHT();
  float tempNTC  = readTemperatureNTC();
  float mainTemp = (tempDHT > 0.0) ? tempDHT : tempNTC;

  StaticJsonDocument<512> doc;
  doc["motorId"]       = "MOTOR-01";
  doc["temp"]          = mainTemp;
  doc["temp_dht"]      = tempDHT;
  doc["temp_ntc"]      = tempNTC;
  doc["rpm"]           = calculateRPM();
  doc["current"]       = current;
  doc["voltage"]       = voltage;
  doc["vibration"]     = readVibration();
  doc["sound"]         = readSound();
  doc["power"]         = power;
  doc["motorState"]    = motorIsOn ? "RUNNING" : "STOPPED";
  doc["controlSource"] = activeControlSource;

  // Real Hardware Detection Status Flags
  doc["hasINA219"]  = hasINA219;
  doc["hasMPU6050"] = hasMPU6050;
  doc["hasDHT"]     = (tempDHT > 0.0);
  doc["hasNTC"]     = (analogRead(PIN_NTC_TEMP) > 5);
  doc["hasSound"]   = (analogRead(PIN_SOUND) > 5);

  updateLCDDisplay(tempDHT, tempNTC, doc["rpm"].as<int>(), current);

  String jsonResponse;
  serializeJson(doc, jsonResponse);

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", jsonResponse);
}

void handleControl() {
  if (server.hasArg("plain") == false) {
    server.send(400, "text/plain", "Body Missing");
    return;
  }

  StaticJsonDocument<128> inputDoc;
  deserializeJson(inputDoc, server.arg("plain"));

  activeControlSource = "REST_API";
  
  if (inputDoc.containsKey("pwm")) {
    int newPwm = inputDoc["pwm"];
    setMotorPower(motorIsOn, newPwm);
  }

  if (inputDoc.containsKey("state")) {
    String stateStr = inputDoc["state"];
    if (stateStr == "STOPPED") {
      setMotorPower(false);
    } else {
      setMotorPower(true);
    }
  }

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"status\":\"success\"}");
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  StaticJsonDocument<192> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (!error) {
    activeControlSource = "MQTT_REMOTE";
    if (doc.containsKey("pwm")) {
      int newPwm = doc["pwm"];
      setMotorPower(motorIsOn, newPwm);
    }
    if (doc.containsKey("command")) {
      String cmd = doc["command"];
      if (cmd == "STOPPED" || cmd == "STOP") {
        setMotorPower(false);
      } else {
        setMotorPower(true);
      }
    }
  }
}

// --------------------------------------------------------------------------
// Arduino Setup & Main Loop
// --------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  // 1. Initialize Wi-Fi Access Point immediately on boot
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();

  Serial.println("==========================================");
  Serial.println(" MotoSafe Real Hardware Firmware v2.0     ");
  Serial.println("==========================================");
  Serial.print("Access IP : http://"); Serial.println(IP);
  Serial.println("==========================================");

  // 2. Start HTTP WebServer Routes Immediately
  server.on("/api/telemetry", HTTP_GET, handleTelemetry);
  server.on("/api/control", HTTP_POST, handleControl);
  server.onNotFound([]() {
    server.send(404, "text/plain", "MotoSafe API 404 Not Found");
  });
  server.begin();
  Serial.println("✅ HTTP WebServer Active on Port 80");

  // 3. Configure Hardware Pins & MOSFET Motor Driver
  pinMode(PIN_STATUS_LED, OUTPUT);

  // Configure RPM Proximity Sensor Pin & Hardware Interrupt (GPIO 27)
  pinMode(PIN_RPM_SENSOR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_RPM_SENSOR), rpmPulseISR, FALLING);

  // Configure ESP32 LEDC PWM on GPIO 25
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PIN_MOSFET_PWM, PWM_CHANNEL);

  // Default Motor State to STOPPED on Boot (Controlled via Web Dashboard / REST / MQTT)
  activeControlSource = "WEB_DASHBOARD";
  setMotorPower(false, 95);

  // Initialize DHT22 Sensor on GPIO 4
  dht.begin();
  Serial.println("✅ DHT22 Sensor Initialized on GPIO 4");

  // 4. Safe I2C Bus Hardware Initialization (GPIO 21 SDA, GPIO 22 SCL)
  Wire.begin(21, 22);
  initLCD();
  initMPU6050();
  initINA219();

  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(mqttCallback);
}

void reconnectMQTT() {
  // Only attempt external MQTT if connected as a Wi-Fi station to internet
  if (WiFi.status() == WL_CONNECTED && !mqttClient.connected()) {
    String clientId = "ESP32_MotoSafe_" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("✅ ESP32 Connected to MQTT Broker!");
      mqttClient.subscribe(controlTopic);
    }
  }
}

void loop() {
  // Handle HTTP REST API requests instantly (http://192.168.4.1/api/telemetry)
  server.handleClient();
  // checkPhysicalSwitchState(); // Disabled: Motor controlled 100% by Web Dashboard / REST / MQTT

  // Handle MQTT background publishing only when connected to internet router
  if (WiFi.status() == WL_CONNECTED) {
    reconnectMQTT();
    if (mqttClient.connected()) {
      mqttClient.loop();
      unsigned long now = millis();
      if (now - lastMqttPubTime > 2000) {
        lastMqttPubTime = now;
        publishMQTTTelemetry();
      }
    }
  }
}
