// Deploy committed migrations to production via `prisma migrate deploy`.
//
// Production DATABASE_URL is NOT kept in `.env` (which is local-only). It comes
// from either a real environment variable (CI / host) or, for manual deploys,
// `.env.production` (gitignored). We resolve it, print the masked target so the
// operator can confirm, then run `prisma migrate deploy` (never `migrate dev`).

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

function fromProdEnvFile() {
  try {
    const text = readFileSync(new URL("../.env.production", import.meta.url), "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trimStart();
      if (line.startsWith("#")) continue;
      const m = line.match(/^DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.production — fall through
  }
  return undefined;
}

const url = process.env.DATABASE_URL ?? fromProdEnvFile();

if (!url) {
  console.error(
    [
      "",
      "✋ No production DATABASE_URL found.",
      "   Set it as an environment variable, or create `.env.production` with:",
      '   DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB"',
      "",
    ].join("\n")
  );
  process.exit(1);
}

const host = (url.match(/@([^:/?]+)/) ?? [])[1] ?? "(unknown host)";
console.log(`\n▶ Deploying migrations to: ${host}\n`);

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
