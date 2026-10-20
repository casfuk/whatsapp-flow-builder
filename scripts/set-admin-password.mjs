#!/usr/bin/env node
// Sets the FunnelChat admin password in Vercel (production + preview).
// Run it yourself in a terminal: node scripts/set-admin-password.mjs
// The password is typed with hidden input, hashed locally with scrypt, and only
// the hash is sent to Vercel. Redeploy afterwards for it to take effect.
import { randomBytes, scrypt } from "node:crypto";
import { spawnSync } from "node:child_process";

const KEY_LENGTH = 64;
const N = 2 ** 15, r = 8, p = 1;

function promptHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      console.error("Run this in an interactive terminal.");
      process.exit(1);
    }
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (buf) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") process.exit(130); // Ctrl+C
        if (ch === "\u007f") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join(":"))
    )
  );
}

const password = await promptHidden("New admin password (min 12 chars): ");
if (password.length < 12) {
  console.error("Too short.");
  process.exit(1);
}
if ((await promptHidden("Repeat password: ")) !== password) {
  console.error("Passwords do not match.");
  process.exit(1);
}

const hash = await hashPassword(password);
for (const target of ["production", "preview"]) {
  const res = spawnSync("vercel", ["env", "add", "ADMIN_PASSWORD_HASH", target, "--sensitive", "--force"], {
    input: hash,
    stdio: ["pipe", "ignore", "inherit"],
  });
  if (res.status !== 0) {
    console.error(`Failed to set ADMIN_PASSWORD_HASH for ${target}`);
    process.exit(1);
  }
}
console.log("ADMIN_PASSWORD_HASH updated. Redeploy production for it to take effect.");
