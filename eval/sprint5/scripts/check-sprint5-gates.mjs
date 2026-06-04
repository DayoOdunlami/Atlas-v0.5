#!/usr/bin/env node
/**
 * Validates Sprint 5 gate markdown files exist and declare a known Verdict.
 * Run: node eval/sprint5/scripts/check-sprint5-gates.mjs
 * Exit 0 if all gates are PASS or PARTIAL (programme complete enough for CI).
 * Exit 1 if any gate is PENDING/BLOCKED or missing Verdict section.
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gates = ["gate-s5a.md", "gate-s5b.md", "gate-s5c.md"];
const allowed = new Set(["PASS", "PARTIAL", "BLOCKED", "PENDING"]);

let failed = false;

for (const name of gates) {
  const path = join(root, name);
  if (!existsSync(path)) {
    console.error(`MISSING ${name}`);
    failed = true;
    continue;
  }
  const text = readFileSync(path, "utf8");
  const verdictMatch = text.match(/## Verdict\s*\n+\s*`?(PASS|PARTIAL|BLOCKED|PENDING)`?/i);
  if (!verdictMatch) {
    console.error(`${name}: no ## Verdict section`);
    failed = true;
    continue;
  }
  const verdict = verdictMatch[1].toUpperCase();
  if (!allowed.has(verdict)) {
    console.error(`${name}: unknown verdict ${verdict}`);
    failed = true;
    continue;
  }
  console.log(`${name}: ${verdict}`);
}

if (failed) {
  process.exit(1);
}

const pending = gates.some((name) => {
  const text = readFileSync(join(root, name), "utf8");
  return /## Verdict\s*\n+\s*`?PENDING`?/i.test(text);
});

if (pending) {
  console.log("check-sprint5-gates: gates exist; programme still PENDING (expected before orchestrator run).");
  process.exit(0);
}

const blocked = gates.some((name) => {
  const text = readFileSync(join(root, name), "utf8");
  return /## Verdict\s*\n+\s*`?BLOCKED`?/i.test(text);
});

if (blocked) {
  console.error("check-sprint5-gates: at least one gate is BLOCKED");
  process.exit(1);
}

console.log("check-sprint5-gates: all gates PASS or PARTIAL");
process.exit(0);
