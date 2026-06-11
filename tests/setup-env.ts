import { TEST_DATABASE_URL, assertSafeTestUrl } from "./test-db-url";

// Runs before each test file, ahead of any prisma client import, so the
// singleton in src/lib/prisma.ts connects to the test database — never the
// DATABASE_URL in .env (which points at production).
assertSafeTestUrl(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
