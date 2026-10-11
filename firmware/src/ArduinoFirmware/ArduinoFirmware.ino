#include <Wire.h>
//===================
//Hardware Pins & Address Definitions
//===================================

const int ROTARY_PIN = A0; // analog pin connected to rotary angle sensor
const int BUTTON_PIN = 2; // digital pin connected to push button
const byte ACCEL_ADDRESS = 0x4c;  // hardware address for our accelerometer (MMA7660)

//===================
//Settings
//===================================
const long BAUD = 115200;            // must match BAUD in backend/rihab_server.py
const unsigned long SAMPLE_MS = 33;  // ~30 samples per second
const int FLEX_SIGN = 1;             // flip to -1 if bending the knee makes the angle go down
const float DEG_PER_COUNT = 300.0 / 1023.0; // Grove rotary sensor: 300 degrees over the 10-bit ADC
const float COUNTS_PER_G = 21.33;    // MMA7660 at +/-1.5g
const unsigned long DEBOUNCE_MS = 250;

int zeroAdc = 0;          // ADC reading with the leg straight = 0 degrees
bool isTracking = false;  // true while reps are being counted
char knee = 'H';          // H = healthy, I = injured (set by the server)

bool lastButtonState = LOW;
unsigned long lastButtonMs = 0;
unsigned long lastSampleMs = 0;
bool accelOk = false;

char cmd[24];   // one command line from the server
byte cmdLen = 0;

//===================
//Serial line protocol (see parse_line in backend/rihab_server.py)
//   S,<ms>,<angle>,<ax>,<ay>,<az>   live sample, sent ~30 times a second
//   B,1 / B,0                       button started / stopped tracking
//   I,<text>                        info message
// Commands from the server: START, STOP, K,H, K,I, c (calibrate: leg straight now)
//===================================

void setup(){
  Serial.begin(BAUD);
  Serial.println("I,RiHab brace booting");
  Wire.begin();
  Wire.setWireTimeout(3000, true); // a missing/miswired accelerometer must not freeze the board
  pinMode(BUTTON_PIN, INPUT);

  //wake up accelerometer: MODE register (0x07) = active
  Wire.beginTransmission(ACCEL_ADDRESS);
  Wire.write(0x07);
  Wire.write(0x01);
  accelOk = (Wire.endTransmission() == 0);

  delay(500); // let the hardware stabilize
  zeroAngle();

  Serial.println(accelOk ? "I,RiHab brace ready" : "I,RiHab brace ready (no accelerometer, angle only)");
}

void loop(){
  readCommands();
  readButton();

  unsigned long now = millis();
  if(now - lastSampleMs >= SAMPLE_MS){
    lastSampleMs = now;
    sendSample(now);
  }
}

//===================
//Sensors
//===================================

void zeroAngle(){
  // calibrate on whichever leg the brace is strapped to; keep the leg straight
  long sum = 0;
  for(int i = 0; i < 8; i++){
    sum += analogRead(ROTARY_PIN);
    delay(2);
  }
  zeroAdc = sum / 8;
}

float readAngle(){
  float angle = FLEX_SIGN * (analogRead(ROTARY_PIN) - zeroAdc) * DEG_PER_COUNT;
  return angle < 0 ? 0 : angle;
}

// Reads X, Y, Z in g. Returns false if the accelerometer didn't answer or was mid-update.
bool readAxes(float g[3]){
  Wire.beginTransmission(ACCEL_ADDRESS);
  Wire.write(0x00); // XOUT; the chip auto-increments to YOUT, ZOUT
  if(Wire.endTransmission() != 0) return false;
  if(Wire.requestFrom((int)ACCEL_ADDRESS, 3) != 3) return false;

  for(int i = 0; i < 3; i++){
    int v = Wire.read();
    if(v & 0x40) return false; // alert bit: value was being updated, skip this sample
    v &= 0x3F;
    if(v > 31) v -= 64; // convert 6-bit signed format
    g[i] = v / COUNTS_PER_G;
  }
  return true;
}

void sendSample(unsigned long now){
  float angle = readAngle();
  float g[3];

  Serial.print("S,");
  Serial.print(now);
  Serial.print(",");
  Serial.print(angle, 1);
  if(accelOk && readAxes(g)){
    for(int i = 0; i < 3; i++){
      Serial.print(",");
      Serial.print(g[i], 3);
    }
  }
  Serial.println();
}

//===================
//Button and server commands
//===================================

void setTracking(bool on){
  if(on && !isTracking){
    zeroAngle(); // tracking always starts from a straight leg
    Serial.println("I,Angle zeroed: leg straight = 0 deg");
  }
  isTracking = on;
}

void readButton(){
  bool currButtonState = digitalRead(BUTTON_PIN);
  unsigned long now = millis();

  // detect the press (transition from LOW to HIGH)
  if(lastButtonState == LOW && currButtonState == HIGH && now - lastButtonMs > DEBOUNCE_MS){
    lastButtonMs = now;
    setTracking(!isTracking);
    Serial.println(isTracking ? "B,1" : "B,0"); // the server answers with START / STOP
  }
  lastButtonState = currButtonState;
}

void handleCommand(const char *c){
  if(strcmp(c, "START") == 0){
    setTracking(true);
  } else if(strcmp(c, "STOP") == 0){
    setTracking(false);
  } else if(strcmp(c, "c") == 0){
    zeroAngle();
    Serial.println("I,Calibrated: leg straight = 0 deg");
  } else if(c[0] == 'K' && c[1] == ',' && (c[2] == 'H' || c[2] == 'I')){
    knee = c[2];
    Serial.println(knee == 'H' ? "I,Knee: healthy" : "I,Knee: injured");
  }
}

void readCommands(){
  while(Serial.available() > 0){
    char ch = Serial.read();
    if(ch == '\n' || ch == '\r'){
      if(cmdLen > 0){
        cmd[cmdLen] = '\0';
        handleCommand(cmd);
        cmdLen = 0;
      }
    } else if(cmdLen < sizeof(cmd) - 1){
      cmd[cmdLen++] = ch;
    }
  }
}
