// Guard: refuse to run `prisma migrate dev` against a non-local database.
//
// `migrate dev` can RESET the database (it offers to wipe data on schema drift),
// so it must only ever touch the local docker Postgres. This script mirrors the
// DATABASE_URL resolution Prisma uses (process.env wins over .env) and aborts
// with a clear message if the target isn't localhost/127.0.0.1.

import { readFileSync } from "node:fs";

function fromEnvFile() {
  try {
    const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trimStart();
      if (line.startsWith("#")) continue;
      const m = line.match(/^DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env file — fall through to undefined
  }
  return undefined;
}

const url = process.env.DATABASE_URL ?? fromEnvFile() ?? "";
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

if (!isLocal) {
  const masked = url.replace(/:[^:@/]*@/, ":****@") || "(empty)";
  console.error(
    [
      "",
      "✋ Refusing to run `prisma migrate dev` against a non-local database.",
      `   DATABASE_URL = ${masked}`,
      "",
      "   `migrate dev` can RESET the database — it must only touch the local docker Postgres.",
      "   • Start it with:  docker-compose up -d",
      "   • To deploy schema changes to production, use:  npm run db:deploy",
      "",
    ].join("\n")
  );
  process.exit(1);
}
