// start.mjs: one command, from the repo root, for the whole app.
//
//   npm start                 Arduino (port auto-detected)
//   npm start -- --port COM5  any rihab_server.py option after the --
//
// First run sets things up: creates backend/.venv and installs requirements.txt (again whenever it changes),
// and runs `npm install` in app/. Then it starts the server and the dashboard together; Ctrl+C stops both.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const app = path.join(root, "app");
const isWin = process.platform === "win32";
const venvPython = path.join(backend, ".venv", isWin ? "Scripts/python.exe" : "bin/python");

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function run(cmd, args, cwd, label) {
  console.log(`> ${label}`);
  // npm is a .cmd script on Windows, so it needs a shell; pass one command string so nothing is half-escaped.
  const r = cmd === "npm" ? spawnSync(["npm", ...args].join(" "), { cwd, stdio: "inherit", shell: true })
    : spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) fail(`"${label}" failed. Fix the error above and run this again.`);
}

/** A Python 3.10+ on PATH, as [command, ...leading args]. */
function findPython() {
  const candidates = isWin ? [["py", "-3"], ["python"], ["python3"]] : [["python3"], ["python"]];
  for (const [cmd, ...pre] of candidates) {
    const r = spawnSync(cmd, [...pre, "-c", "import sys; print(sys.version_info >= (3, 10))"], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim() === "True") return [cmd, ...pre];
  }
  fail("Python 3.10 or newer wasn't found. Install it from https://www.python.org/downloads/ (tick \"Add to PATH\").");
}

function setupBackend() {
  if (!existsSync(venvPython)) {
    const [cmd, ...pre] = findPython();
    run(cmd, [...pre, "-m", "venv", ".venv"], backend, "Creating backend/.venv");
  }
  const requirements = path.join(backend, "requirements.txt");
  const marker = path.join(backend, ".venv", ".rihab-requirements");
  const hash = createHash("sha1").update(readFileSync(requirements)).digest("hex");
  if (!existsSync(marker) || readFileSync(marker, "utf8") !== hash) {
    run(venvPython, ["-m", "pip", "install", "-q", "-r", "requirements.txt"], backend, "Installing Python packages");
    writeFileSync(marker, hash);
  }
}

function setupApp() {
  if (!existsSync(path.join(app, "node_modules"))) run("npm", ["install"], app, "Installing app packages (npm install)");
}

setupBackend();
setupApp();

const children = [
  // -u: print immediately (e.g. the "using SQLite" notice) instead of buffering because stdout isn't a terminal.
  spawn(venvPython, ["-u", "rihab_server.py", ...process.argv.slice(2)], { cwd: backend, stdio: "inherit" }),
  spawn("npm run dev", { cwd: app, stdio: "inherit", shell: true }),
];
console.log("\nDashboard: http://localhost:8443   API docs: http://localhost:8000/docs   (Ctrl+C to stop)\n");

let stopping = false;
const stopAll = (code) => {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exitCode = code ?? 0;
};
for (const c of children) c.on("exit", (code) => stopAll(code));
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
