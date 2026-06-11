// Single source of truth for the test database URL.
// Uses the existing docker-compose Postgres (port 54330) with a dedicated
// `googoocard_test` database so it never touches dev or production data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:password@localhost:54330/googoocard_test?schema=public";

export function assertSafeTestUrl(url: string) {
  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    throw new Error(
      `Refusing to run tests against a non-local database: ${url.replace(/:[^:@/]*@/, ":****@")}`
    );
  }
}
