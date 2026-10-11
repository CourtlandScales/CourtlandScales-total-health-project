// knee_brace_uno.ino — Arduino Uno + Grove 3-Axis Digital Accelerometer + Grove LCD RGB Backlight
//
// What it does:
//   1. Reads the accelerometer 25x per second and turns it into a knee angle.
//   2. Shows the live angle, max bend and rep count on the Grove LCD (backlight color = how bent).
//   3. Sends every reading over USB as one text line to backend/rihab_server.py, which detects reps,
//      saves them to the database and streams them to the dashboard in app/.
//
// Wiring (Grove Base Shield on the Uno):
//   - Grove LCD RGB Backlight      -> any I2C port
//   - Grove 3-Axis Accelerometer   -> any other I2C port
//   - Strap the accelerometer to the SHIN, flat against it.
//
// Library needed (Arduino IDE: Tools > Manage Libraries...):
//   - "Grove - LCD RGB Backlight" by Seeed Studio
// The accelerometer needs NO library: this sketch talks to it directly and auto-detects
// the three common Grove versions (LIS3DHTR, ADXL345 ±16g, MMA7660 ±1.5g).
//
// USB text protocol (115200 baud) — see docs/serial-protocol.md
//   Arduino -> PC:  D,<seq>,<ms>,<angle_x10>,<emg_x10>,<temp_x100>,<battery>,<flags>
//                   # anything after a hash is a comment/log line
//   PC -> Arduino:  c = calibrate (leg straight now)   r = reset max/reps
//                   s = start streaming                 x = stop streaming

#include <Wire.h>
#include <math.h>
#include "rgb_lcd.h"

rgb_lcd lcd;

// ---------- settings you can tweak ----------
const unsigned long SAMPLE_MS = 40;   // 25 readings per second
const unsigned long LCD_MS    = 200;  // refresh LCD 5x per second (faster just flickers)
const float SMOOTHING = 0.25;         // 0..1, lower = smoother but slower
const float REP_UP    = 60.0;         // a rep starts when the knee bends past this...
const float REP_DOWN  = 20.0;         // ...and finishes when it straightens below this

// ---------- accelerometer auto-detect ----------
enum AccelType { ACCEL_NONE, ACCEL_LIS3DH, ACCEL_ADXL345, ACCEL_MMA7660 };
AccelType accelType = ACCEL_NONE;
uint8_t accelAddr = 0;

// ---------- state ----------
float gx = 0, gy = 0, gz = 0;       // smoothed gravity direction
float refX = 0, refY = 0, refZ = 1; // gravity direction when the leg was straight
bool calibrated = false;
bool streaming = true;
uint16_t seq = 0;
float kneeAngle = 0, maxAngle = 0;
int reps = 0;
bool midRep = false;
unsigned long lastSample = 0, lastLcd = 0;

// ================= I2C helpers =================
bool i2cPresent(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void writeReg(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

bool readRegs(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t n) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(addr, n) != n) return false;
  for (uint8_t i = 0; i < n; i++) buf[i] = Wire.read();
  return true;
}

uint8_t readReg(uint8_t addr, uint8_t reg) {
  uint8_t v = 0xFF;
  readRegs(addr, reg, &v, 1);
  return v;
}

// ================= accelerometer =================
void detectAccel() {
  // LIS3DHTR (Grove 3-Axis Digital Accelerometer LIS3DHTR) — WHO_AM_I = 0x33
  const uint8_t lisAddrs[] = {0x19, 0x18};
  for (uint8_t a : lisAddrs) {
    if (i2cPresent(a) && readReg(a, 0x0F) == 0x33) {
      accelType = ACCEL_LIS3DH; accelAddr = a;
      writeReg(a, 0x20, 0x57); // CTRL_REG1: 100 Hz, X/Y/Z on
      writeReg(a, 0x23, 0x88); // CTRL_REG4: block update, high-resolution
      return;
    }
  }
  // ADXL345 (Grove 3-Axis Digital Accelerometer ±16g) — DEVID = 0xE5
  const uint8_t adxlAddrs[] = {0x53, 0x1D};
  for (uint8_t a : adxlAddrs) {
    if (i2cPresent(a) && readReg(a, 0x00) == 0xE5) {
      accelType = ACCEL_ADXL345; accelAddr = a;
      writeReg(a, 0x31, 0x08); // DATA_FORMAT: full resolution
      writeReg(a, 0x2D, 0x08); // POWER_CTL: start measuring
      return;
    }
  }
  // MMA7660 (Grove 3-Axis Digital Accelerometer ±1.5g) — no ID register, just the address
  if (i2cPresent(0x4C)) {
    accelType = ACCEL_MMA7660; accelAddr = 0x4C;
    writeReg(0x4C, 0x07, 0x00); // standby (required before changing settings)
    writeReg(0x4C, 0x08, 0x00); // 120 samples/s
    writeReg(0x4C, 0x07, 0x01); // active
  }
}

// Raw readings. Units differ per chip, but that's fine: we only use the DIRECTION of gravity.
bool readAccel(float &x, float &y, float &z) {
  uint8_t b[6];
  switch (accelType) {
    case ACCEL_LIS3DH:
      if (!readRegs(accelAddr, 0x28 | 0x80, b, 6)) return false; // 0x80 = auto-increment
      x = (int16_t)(b[1] << 8 | b[0]); y = (int16_t)(b[3] << 8 | b[2]); z = (int16_t)(b[5] << 8 | b[4]);
      return true;
    case ACCEL_ADXL345:
      if (!readRegs(accelAddr, 0x32, b, 6)) return false;
      x = (int16_t)(b[1] << 8 | b[0]); y = (int16_t)(b[3] << 8 | b[2]); z = (int16_t)(b[5] << 8 | b[4]);
      return true;
    case ACCEL_MMA7660: {
      if (!readRegs(accelAddr, 0x00, b, 3)) return false;
      float *out[3] = {&x, &y, &z};
      for (uint8_t i = 0; i < 3; i++) {
        if (b[i] & 0x40) return false;      // "alert" bit = value was mid-update, skip this one
        int8_t v = b[i] & 0x3F;             // 6-bit signed number
        if (v & 0x20) v -= 64;
        *out[i] = v;
      }
      return true;
    }
    default:
      return false;
  }
}

// ================= knee angle =================
// Knee angle = angle between "gravity now" and "gravity when the leg was straight".
// Works however the sensor is rotated on the shin, as long as it stays put after calibrating.
float angleFromReference() {
  float dot = gx * refX + gy * refY + gz * refZ;
  float mag = sqrt(gx * gx + gy * gy + gz * gz) * sqrt(refX * refX + refY * refY + refZ * refZ);
  if (mag < 1e-6) return 0;
  float c = dot / mag;
  if (c > 1) c = 1;
  if (c < -1) c = -1;
  return acos(c) * 180.0 / PI;
}

void calibrateStraight() {
  refX = gx; refY = gy; refZ = gz;
  calibrated = true;
  maxAngle = 0; reps = 0; midRep = false;
  Serial.println(F("# calibrated: leg straight = 0 deg"));
}

void countReps() {
  if (!midRep && kneeAngle > REP_UP) midRep = true;
  if (midRep && kneeAngle < REP_DOWN) { midRep = false; reps++; }
  if (kneeAngle > maxAngle) maxAngle = kneeAngle;
}

// ================= output =================
void sendReading() {
  int angleX10 = (int)lround(kneeAngle * 10);
  uint8_t flags = calibrated ? 0x01 : 0x00;   // same flag bits as the BLE protocol
  // D,seq,ms,angle_x10,emg_x10,temp_x100,battery,flags  (no EMG/temp sensor yet -> 0)
  Serial.print(F("D,"));
  Serial.print(seq++);       Serial.print(',');
  Serial.print(millis());    Serial.print(',');
  Serial.print(angleX10);    Serial.print(',');
  Serial.print(0);           Serial.print(',');
  Serial.print(0);           Serial.print(',');
  Serial.print(100);         Serial.print(',');   // USB powered
  Serial.println(flags);
}

void updateLcd() {
  char line[17];
  int a10 = (int)lround(kneeAngle * 10);
  // Uno's snprintf can't print floats, so we print whole + tenths as two integers.
  snprintf(line, sizeof(line), "Knee %3d.%d deg  ", a10 / 10, a10 % 10);
  lcd.setCursor(0, 0); lcd.print(line);
  snprintf(line, sizeof(line), "Max %3d Reps %3d", (int)lround(maxAngle), reps);
  lcd.setCursor(0, 1); lcd.print(line);

  // Backlight: blue when straight -> green when deeply bent.
  float t = kneeAngle / 120.0;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  lcd.setRGB(0, (uint8_t)(80 + 175 * t), (uint8_t)(255 - 175 * t));
}

void showError(const char *l1, const char *l2) {
  lcd.setRGB(255, 0, 0);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l1);
  lcd.setCursor(0, 1); lcd.print(l2);
}

// ================= commands from the PC =================
void handleSerialCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'c') calibrateStraight();
    else if (c == 'r') { maxAngle = 0; reps = 0; midRep = false; }
    else if (c == 's') streaming = true;
    else if (c == 'x') streaming = false;
  }
}

// ================= setup / loop =================
void setup() {
  Serial.begin(115200);
  Wire.begin();
  lcd.begin(16, 2);
  lcd.setRGB(0, 80, 255);

  detectAccel();
  if (accelType == ACCEL_NONE) {
    showError("No accelerometer", "Check I2C port");
    Serial.println(F("# ERROR: no accelerometer found on I2C"));
    return;
  }
  const char *names[] = {"none", "LIS3DHTR", "ADXL345", "MMA7660"};
  Serial.print(F("# accelerometer: ")); Serial.println(names[accelType]);

  // Boot calibration: average ~1 second of readings while the leg is held straight.
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Hold leg");
  lcd.setCursor(0, 1); lcd.print("straight...");
  float sx = 0, sy = 0, sz = 0; int n = 0;
  for (int i = 0; i < 50; i++) {
    float x, y, z;
    if (readAccel(x, y, z)) { sx += x; sy += y; sz += z; n++; }
    delay(20);
  }
  if (n > 0) { gx = sx / n; gy = sy / n; gz = sz / n; calibrateStraight(); }
  lcd.clear();
}

void loop() {
  if (accelType == ACCEL_NONE) return;
  handleSerialCommands();

  unsigned long now = millis();
  if (now - lastSample >= SAMPLE_MS) {
    lastSample = now;
    float x, y, z;
    if (readAccel(x, y, z)) {
      // Low-pass filter: keeps gravity, removes jitter from small bumps.
      gx += SMOOTHING * (x - gx);
      gy += SMOOTHING * (y - gy);
      gz += SMOOTHING * (z - gz);
      kneeAngle = angleFromReference();
      countReps();
      if (streaming) sendReading();
    }
  }
  if (now - lastLcd >= LCD_MS) {
    lastLcd = now;
    updateLcd();
  }
}
