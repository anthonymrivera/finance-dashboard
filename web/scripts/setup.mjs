#!/usr/bin/env node
/**
 * Interactive first-run setup.
 *
 * Prompts for the three values only you can supply, generates the two secrets
 * that should never be typed by a human, and writes .env. Nothing is printed
 * back to the terminal except the encryption key, which you must back up.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");

const rl = createInterface({ input: stdin, output: stdout });

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

/**
 * Read through one shared async iterator rather than rl.question().
 *
 * With piped input, readline buffers the whole stream and emits every line at
 * once; question() only listens for the first, so the rest are dropped and the
 * next prompt waits forever on a closed stdin. Pulling from the iterator keeps
 * unread lines queued, which behaves the same whether input is a terminal or a
 * pipe — and makes the script testable.
 */
const lines = rl[Symbol.asyncIterator]();

async function readLine() {
  const { value, done } = await lines.next();
  if (done) {
    console.log(red("\n  ✗ Input ended before setup finished. Nothing was written."));
    process.exit(1);
  }
  return value;
}

/** Keep asking until the answer passes validation. */
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

async function confirm(question) {
  stdout.write(`${question} ${dim("[y/N]")} `);
  const answer = (await readLine()).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

console.log();
console.log(bold("Finance Dashboard — setup"));
console.log(dim("Three values to collect. Takes about two minutes."));
console.log();

if (existsSync(ENV_PATH)) {
  const current = readFileSync(ENV_PATH, "utf8");
  const configured =
    !current.includes("replace_with_your") && !current.includes("ep-placeholder");

  if (configured) {
    console.log(yellow("A configured .env already exists."));
    if (!(await confirm("Overwrite it?"))) {
      console.log(dim("Left unchanged."));
      rl.close();
      process.exit(0);
    }
    console.log();
  }
}

// ── Database ────────────────────────────────────────────────────────────────

console.log(bold("1. Database"));
console.log(dim("   neon.tech → your project → Connection string"));
console.log(dim("   Turn ON connection pooling — the host must contain '-pooler'"));
console.log();

const databaseUrl = await ask("Connection string:", {
  validate: (value) => {
    if (!value) return "Required";
    if (!/^postgres(ql)?:\/\//.test(value)) return "Should start with postgresql://";
    if (!value.includes("-pooler")) {
      return "That looks like the direct string. Enable pooling and copy the one with '-pooler' in the host.";
    }
    return true;
  },
});

console.log(green("  ✓ Looks right"));
console.log();

// ── Plaid ───────────────────────────────────────────────────────────────────

console.log(bold("2. Plaid"));
console.log(dim("   dashboard.plaid.com → Developers → Keys"));
console.log();

const plaidClientId = await ask("Client ID:", {
  validate: (value) => (value.length >= 20 ? true : "That looks too short — check you copied all of it"),
});

const plaidSecret = await ask("Sandbox secret:", {
  validate: (value) => (value.length >= 20 ? true : "That looks too short — check you copied all of it"),
});

console.log(green("  ✓ Got both"));
console.log();

// ── Generated ───────────────────────────────────────────────────────────────

const encryptionKey = randomBytes(32).toString("base64");
const cronSecret = randomBytes(32).toString("hex");

const env = `# Written by scripts/setup.mjs. Never commit this file.

DATABASE_URL="${databaseUrl}"

# Encrypts Plaid access tokens and 2FA secrets at rest.
# BACK THIS UP. Losing it means relinking every bank.
ENCRYPTION_KEY="${encryptionKey}"

PLAID_CLIENT_ID="${plaidClientId}"
PLAID_SECRET="${plaidSecret}"
PLAID_ENV="sandbox"

APP_URL="http://localhost:3000"

CRON_SECRET="${cronSecret}"

# Optional — Google sign-in. See README step 4a.
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
`;

writeFileSync(ENV_PATH, env, { mode: 0o600 }); // owner-only: it holds live credentials

console.log(bold("Done."), dim("Wrote .env"));
console.log();
console.log(yellow("┌─ Back this up now ───────────────────────────────────────────┐"));
console.log(yellow("│ Put this in your password manager. If it is lost, every bank │"));
console.log(yellow("│ connection becomes unreadable and has to be relinked.         │"));
console.log(yellow("└──────────────────────────────────────────────────────────────┘"));
console.log();
console.log(`  ENCRYPTION_KEY=${bold(encryptionKey)}`);
console.log();
console.log(bold("Next:"));
console.log("  npm run db:migrate    " + dim("create the tables"));
console.log("  npm run dev           " + dim("start the app"));
console.log();

rl.close();
