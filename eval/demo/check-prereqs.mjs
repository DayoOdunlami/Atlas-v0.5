#!/usr/bin/env node
/**
 * Exit 1 if demo recording prerequisites are missing.
 * Does not print secret values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envLocal = path.join(root, ".env.local");

if (fs.existsSync(envLocal)) {
  const text = fs.readFileSync(envLocal, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const required = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  POSTGRES_URL: process.env.POSTGRES_URL,
  LANGGRAPH_API_URL: process.env.LANGGRAPH_API_URL ?? "http://localhost:2024",
};

const missing = Object.entries(required)
  .filter(([, v]) => !v || String(v).includes("sk-ant-...") || String(v).includes("<password>"))
  .map(([k]) => k);

if (missing.length) {
  console.error("Missing or placeholder demo prerequisites:", missing.join(", "));
  console.error("Add real values to .env.local (gitignored) or cloud Secrets.");
  process.exit(1);
}

console.log("Demo prerequisites OK (values not shown).");
process.exit(0);
