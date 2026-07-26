#!/usr/bin/env node
/**
 * Add a demo account to an existing .env.
 *
 * Appends the address to ALLOWED_EMAILS (so it may sign in at all) and to
 * DEMO_EMAILS (so it is pinned to Plaid Sandbox and can never reach a real
 * bank). Both lists are preserved — existing entries are never replaced.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

if (!existsSync(ENV_PATH)) {
  console.log(red("No .env found. Run `npm run setup` first."));
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const lines = rl[Symbol.asyncIterator]();

async function readLine() {
  const { value, done } = await lines.next();
  if (done) {
    console.log(red("\n  ✗ Input ended early. Nothing was written."));
    process.exit(1);
  }
  return value;
}

async function ask(question, validate) {
  for (;;) {
    stdout.write(`${question} `);
    const answer = (await readLine()).trim();
    const result = validate(answer);
    if (result === true) return answer;
    console.log(red(`  ✗ ${result}`));
    console.log();
  }
}

/** Read a comma-separated env value into a deduplicated list. */
function readList(env, key) {
  const match = env.match(new RegExp(`^${key}="?([^"\n]*)"?$`, "m"));
  return (match?.[1] ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function writeKey(env, key, value) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}

console.log();
console.log(bold("Demo account setup"));
console.log(dim("An address pinned to Plaid Sandbox — safe to show people."));
console.log();

let env = readFileSync(ENV_PATH, "utf8");

const allowed = readList(env, "ALLOWED_EMAILS");
const demos = readList(env, "DEMO_EMAILS");

console.log(dim(`  Currently allowed: ${allowed.join(", ") || "(none)"}`));
console.log(dim(`  Currently demo:    ${demos.join(", ") || "(none)"}`));
console.log();

const email = (
  await ask("Demo account email:", (v) => {
    if (!v) return "Required";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "That is not a valid email address";
    if (demos.includes(v.toLowerCase())) return "That address is already a demo account";
    return true;
  })
).toLowerCase();

if (!allowed.includes(email)) allowed.push(email);
demos.push(email);

env = writeKey(env, "ALLOWED_EMAILS", allowed.join(","));
env = writeKey(env, "DEMO_EMAILS", demos.join(","));

writeFileSync(ENV_PATH, env, { mode: 0o600 });

console.log();
console.log(green("✓ Updated .env"));
console.log(`  ALLOWED_EMAILS  ${allowed.join(", ")}`);
console.log(`  DEMO_EMAILS     ${demos.join(", ")}`);
console.log();
console.log(yellow("Two things left, in this order:"));
console.log(`  1. Add ${bold(email)} under Google Cloud → Audience → Test users.`);
console.log(dim("     Google blocks any account not on that list, before your app sees it."));
console.log("  2. Restart the dev server, then sign in as that account in a");
console.log("     private window to create it.");
console.log();

rl.close();
