import { generateAppToken, readBearerToken } from "@/lib/auth";
import { ApiError } from "@/lib/apiError";
import { sessionRoute } from "@/lib/apiRoute";

// The iOS App swaps its bearer token for a fresh one on launch, so a teacher
// who opens the App at least once a month never gets logged out. Bearer only:
// a page script holding the cookie must not be able to mint an App token.
export const POST = sessionRoute(async ({ userId }) => {
  if (!(await readBearerToken())) {
    throw new ApiError(401, "UNAUTHORIZED", "Bearer token required");
  }
  return { token: generateAppToken(userId) };
});
