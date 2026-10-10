// webBluetoothBrace.ts — the REAL brace, over Web Bluetooth.
// Works in Chrome/Edge (desktop + Android) on https:// or http://localhost. Not Safari/iOS.
// Needs `npm i -D @types/web-bluetooth` for TypeScript types.

import { Emitter, type BraceSource, type ConnectionState } from "./braceSource";
import {
  UUIDS,
  decodeSensorPacket,
  encodeCommand,
  ProtocolError,
  type BraceReading,
  type CommandName,
} from "./protocol";

export class WebBluetoothBrace implements BraceSource {
  readonly kind = "real" as const;
  private readings = new Emitter<BraceReading>();
  private states = new Emitter<ConnectionState>();
  private device?: BluetoothDevice;
  private dataChar?: BluetoothRemoteGATTCharacteristic;
  private controlChar?: BluetoothRemoteGATTCharacteristic;

  static isSupported() {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  /** MUST be called from a click handler — browsers block the pairing popup otherwise. */
  async connect() {
    if (!WebBluetoothBrace.isSupported()) {
      throw new Error("Web Bluetooth not supported. Use Chrome on desktop or Android.");
    }
    this.states.emit("connecting");
    try {
      // 1. Show the browser's device picker, filtered to our brace.
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "KneeBrace" }],
        optionalServices: [UUIDS.service],
      });
      this.device.addEventListener("gattserverdisconnected", () => this.states.emit("disconnected"));

      // 2. Connect → find our service → find our characteristics.
      const server = await this.device.gatt!.connect();
      const service = await server.getPrimaryService(UUIDS.service);
      this.dataChar = await service.getCharacteristic(UUIDS.sensorData);
      this.controlChar = await service.getCharacteristic(UUIDS.control);

      // 3. Every notification = one 16-byte packet → decode → emit.
      this.dataChar.addEventListener("characteristicvaluechanged", (e) => {
        const value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
        try {
          this.readings.emit(decodeSensorPacket(value));
        } catch (err) {
          if (err instanceof ProtocolError) console.warn("Bad packet:", err.message);
          else throw err;
        }
      });
      await this.dataChar.startNotifications();

      this.states.emit("connected");
    } catch (err) {
      this.states.emit("disconnected");
      throw err;
    }
  }

  async disconnect() {
    this.device?.gatt?.disconnect();
  }

  async sendCommand(name: CommandName, rateHz?: number) {
    if (!this.controlChar) throw new Error("Not connected");
    await this.controlChar.writeValueWithResponse(encodeCommand(name, rateHz));
  }

  onReading(cb: (r: BraceReading) => void) { return this.readings.on(cb); }
  onStateChange(cb: (s: ConnectionState) => void) { return this.states.on(cb); }
}
