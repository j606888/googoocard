import { execSync } from "child_process";
import { TEST_DATABASE_URL, assertSafeTestUrl } from "./test-db-url";

// Creates the test database (if missing) and applies all migrations once
// before the test run.
export default function setup() {
  assertSafeTestUrl(TEST_DATABASE_URL);

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
