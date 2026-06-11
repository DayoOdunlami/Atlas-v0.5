#!/usr/bin/env node
/**
 * Cross-platform LangGraph CLI launcher (agents/.venv).
 * Usage: node scripts/langgraph-dev.mjs [langgraph args...]
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = path.join(root, "agents");
const win = path.join(agentsDir, ".venv", "Scripts", "langgraph.exe");
const unix = path.join(agentsDir, ".venv", "bin", "langgraph");
const langgraph = existsSync(win) ? win : unix;

if (!existsSync(langgraph)) {
  console.error(
    "LangGraph CLI not found. Create agents/.venv and install deps (see agents/requirements.txt).",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync(langgraph, args.length ? args : ["dev", "--port", "2024"], {
  stdio: "inherit",
  cwd: agentsDir,
  env: process.env,
  shell: false,
});
process.exit(result.status ?? 1);
