// `npm run build` — Vercel and CI both run this.
//
// On the `staging` custom environment (VERCEL_TARGET_ENV=staging) it first
// applies committed migrations to the staging Neon database, so pushing a
// branch to `staging` brings its schema along. Production and everything else
// just build: production migrations stay a deliberate `npm run db:deploy`.
//
// Neon's DATABASE_URL is the pooled (pgbouncer) endpoint; migrate needs a
// direct connection, hence DATABASE_URL_UNPOOLED.

import { execFileSync } from "node:child_process";

const run = (cmd, args, env = process.env) =>
  execFileSync(cmd, args, { stdio: "inherit", env });

if (process.env.VERCEL_TARGET_ENV === "staging") {
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) {
    console.error("✋ staging build: DATABASE_URL_UNPOOLED is not set.");
    process.exit(1);
  }
  const host = (url.match(/@([^:/?]+)/) ?? [])[1] ?? "(unknown host)";
  console.log(`\n▶ staging: deploying migrations to ${host}\n`);
  run("npx", ["prisma", "migrate", "deploy"], { ...process.env, DATABASE_URL: url });
}

run("npx", ["next", "build"]);
