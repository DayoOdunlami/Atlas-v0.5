#!/usr/bin/env node
/**
 * Cross-platform path to the agents virtualenv Python interpreter.
 * Usage: node scripts/python-bin.mjs [args...]
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const win = path.join(root, "agents", ".venv", "Scripts", "python.exe");
const unix = path.join(root, "agents", ".venv", "bin", "python");
const python = existsSync(win) ? win : unix;

const result = spawnSync(python, process.argv.slice(2), {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
process.exit(result.status ?? 1);
