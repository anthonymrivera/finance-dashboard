#!/usr/bin/env node
/**
 * Add Google sign-in credentials and the account allowlist to an existing .env.
 *
 * Separate from setup.mjs because Google is optional and set up later, once an
 * OAuth client exists in Google Cloud Console. Rewrites only the keys it owns
 * and leaves every other line untouched.
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

async function ask(question, { validate } = {}) {
  for (;;) {
    stdout.write(`${question} `);
    const answer = (await readLine()).trim();

    if (!validate) return answer;
    const result = validate(answer);
    if (result === true) return answer;

    console.log(red(`  ✗ ${result}`));
    console.log();
  }
}

console.log();
console.log(bold("Google sign-in setup"));
console.log(dim("From console.cloud.google.com → APIs & Services → Credentials"));
console.log();

const clientId = await ask("Client ID:", {
  validate: (v) =>
    v.endsWith(".apps.googleusercontent.com")
      ? true
      : "Google client IDs end with .apps.googleusercontent.com",
});

const clientSecret = await ask("Client secret:", {
  validate: (v) => (v.length >= 10 ? true : "That looks too short"),
});

console.log();
console.log(bold("Account allowlist"));
console.log(dim("Only these addresses can ever sign in or hold a session."));
console.log(dim("Use the Gmail address you will sign in with. Comma-separate to add more."));
console.log();

const allowed = await ask("Allowed email(s):", {
  validate: (v) => {
    if (!v) return "Required — this is what makes the app single-user";
    const all = v.split(",").map((e) => e.trim());
    const bad = all.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    return bad ? `"${bad}" is not a valid email address` : true;
  },
});

// Rewrite only our keys; leave everything else in the file exactly as it is.
const updates = {
  GOOGLE_CLIENT_ID: clientId,
  GOOGLE_CLIENT_SECRET: clientSecret,
  ALLOWED_EMAILS: allowed,
};

let env = readFileSync(ENV_PATH, "utf8");

for (const [key, value] of Object.entries(updates)) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}

writeFileSync(ENV_PATH, env, { mode: 0o600 });

console.log();
console.log(green("✓ Updated .env"));
console.log();
console.log(bold("Restart the dev server to pick up the change:"));
console.log("  npm run dev");
console.log();

rl.close();
