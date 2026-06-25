#!/usr/bin/env node
/**
 * Bootstrap agents/.venv and install Python deps (incl. exa-py for web lane).
 * Usage: npm run agents:setup
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = path.join(root, "scripts", "python-bin.mjs");
const venvPython = path.join(root, "agents", ".venv", "Scripts", "python.exe");
const venvUnix = path.join(root, "agents", ".venv", "bin", "python");

if (!existsSync(venvPython) && !existsSync(venvUnix)) {
  console.log("[agents:setup] Creating virtualenv in agents/.venv …");
  const created = spawnSync("python", ["-m", "venv", path.join(root, "agents", ".venv")], {
    stdio: "inherit",
    cwd: root,
  });
  if (created.status !== 0) {
    process.exit(created.status ?? 1);
  }
}

console.log("[agents:setup] Ensuring pip …");
spawnSync("node", [python, "-m", "ensurepip", "--upgrade"], {
  stdio: "inherit",
  cwd: root,
});

console.log("[agents:setup] Installing agents/requirements.txt …");
const pip = spawnSync(
  "node",
  [python, "-m", "pip", "install", "-r", path.join(root, "agents", "requirements.txt")],
  { stdio: "inherit", cwd: root },
);
if (pip.status !== 0) {
  process.exit(pip.status ?? 1);
}

console.log("[agents:setup] Verifying exa_py …");
const verify = spawnSync("node", [python, "-c", "import exa_py; print('exa_py ok')"], {
  stdio: "inherit",
  cwd: root,
});
process.exit(verify.status ?? 0);
