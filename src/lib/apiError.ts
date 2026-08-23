/**
 * An error a route handler raises deliberately, carrying the HTTP status and
 * the machine-readable code the client already switches on (e.g.
 * `STUDENT_NOT_QUALIFIED`, `PRACTICE_CARD_REQUIRES_DANCE_TYPE`).
 *
 * Throwing this beats returning a NextResponse from deep inside a service:
 * `apiRoute` turns it into the response, so business logic doesn't need to know
 * it's running in an HTTP handler.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Optional human-readable text; falls back to `code`. */
    message?: string
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

/** 404 with the "don't confirm it exists" wording used for cross-classroom ids. */
export const notFound = (what: string) => new ApiError(404, `${what} not found`);

/** 400 for a request the client could fix. */
export const badRequest = (code: string, message?: string) =>
  new ApiError(400, code, message);
