#!/usr/bin/env node
// Scans the built browser assets (.next/static) for credentials.
// Usage: node scripts/check-bundle-secrets.mjs [path/to/env-file]
// With an env file, also checks that no secret VALUE from it appears in the bundle.
// Prints only file names and variable names, never values.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(".next/static");
if (!fs.existsSync(dir)) {
  console.error("No .next/static found - run `npm run build` first");
  process.exit(2);
}

const patterns = {
  "Meta access token": /EAA[A-Za-z0-9]{20,}/,
  "OpenAI key": /sk-[A-Za-z0-9_-]{20,}/,
  "database URL": /postgres(?:ql)?:\/\/[^\s"']+:[^\s"'@]+@/,
  "Vercel Blob token": /vercel_blob_rw_[A-Za-z0-9]+/,
  "scrypt password hash": /scrypt:\d+:\d+:\d+:/,
  "server-only env name": /\b(SESSION_SECRET|ADMIN_PASSWORD_HASH|META_APP_SECRET|FACEBOOK_[A-Z_]*SECRET|WHATSAPP_(ACCESS|CLOUD_API)_TOKEN|CRON_SECRET|OPENAI_API_KEY|POSTGRES_[A-Z_]+|CLEANUP_TOKEN|BLOB_READ_WRITE_TOKEN)\b/,
};

const secretValues = [];
if (process.argv[2]) {
  for (const line of fs.readFileSync(process.argv[2], "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m || m[1].startsWith("NEXT_PUBLIC_")) continue;
    const value = m[2].replace(/^"|"$/g, "");
    if (/TOKEN|SECRET|KEY|PASSWORD|POSTGRES_(URL|PRISMA|DATABASE_URL)/.test(m[1]) && value.length >= 8) {
      secretValues.push([m[1], value]);
    }
  }
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(dir);

let findings = 0;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const [name, re] of Object.entries(patterns)) {
    if (re.test(text)) {
      findings++;
      console.log(`FOUND ${name} in ${path.relative(process.cwd(), file)}`);
    }
  }
  for (const [name, value] of secretValues) {
    if (text.includes(value)) {
      findings++;
      console.log(`FOUND value of ${name} in ${path.relative(process.cwd(), file)}`);
    }
  }
}

console.log(`Scanned ${files.length} files${secretValues.length ? ` against ${secretValues.length} secret values` : ""}: ${findings} finding(s)`);
process.exit(findings ? 1 : 0);
