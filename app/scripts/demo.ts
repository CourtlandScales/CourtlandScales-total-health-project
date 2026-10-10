// demo.ts — run in a terminal, no browser or hardware needed:
//   npx tsx scripts/demo.ts            (healthy knee)
//   npx tsx scripts/demo.ts stiff      (limited bend)
//   npx tsx scripts/demo.ts weakQuad   (low muscle activation)
//
// It checks the decoder against the worked example in docs/ble-protocol.md, then streams
// fake readings for 5 seconds, printing the raw bytes AND what they decode to.

import { FakeBrace, type Scenario } from "../src/mock/fakeBrace";
import { decodeSensorPacket, droppedBetween, toHex } from "../src/lib/protocol";

// 1. Sanity check: the exact bytes from §6 of the protocol doc.
const example = new Uint8Array([0x01, 0x03, 0x12, 0x04, 0x42, 0xef, 0x00, 0x00,
                                0xc4, 0x01, 0x77, 0x01, 0xf0, 0x0c, 0x57, 0x00]);
const ex = decodeSensorPacket(example);
console.log("Worked example →", ex);
if (ex.seq !== 1042 || ex.kneeAngleDeg !== 45.2 || ex.emgPercent !== 37.5 || ex.skinTempC !== 33.12) {
  throw new Error("Decoder does not match the spec!");
}
console.log("✓ decoder matches the spec\n");

// 2. Stream from the fake brace.
const scenario = (process.argv[2] as Scenario) ?? "healthy";
const brace = new FakeBrace({ scenario, seed: 42 });
let lastSeq: number | null = null, count = 0, dropped = 0, maxAngle = 0;

brace.onRawPacket = (bytes) => { if (count % 10 === 0) process.stdout.write(`raw  ${toHex(bytes)}\n`); };
brace.onReading((r) => {
  if (lastSeq !== null) dropped += droppedBetween(lastSeq, r.seq);
  lastSeq = r.seq;
  maxAngle = Math.max(maxAngle, r.kneeAngleDeg);
  if (count++ % 10 === 0) {
    console.log(`  →  seq ${String(r.seq).padStart(4)}  t=${(r.timestampMs / 1000).toFixed(2)}s  ` +
      `angle ${r.kneeAngleDeg.toFixed(1).padStart(6)}°  emg ${r.emgPercent.toFixed(1).padStart(5)}%  ` +
      `temp ${r.skinTempC.toFixed(2)}°C  batt ${r.batteryPct}%`);
  }
});

async function main() {
  await brace.connect();
  await brace.sendCommand("startStream");
}
main();
setTimeout(async () => {
  await brace.disconnect();
  console.log(`\n[${scenario}] received ${count} packets, ${dropped} dropped, max bend ${maxAngle.toFixed(1)}°`);
}, 5000);
