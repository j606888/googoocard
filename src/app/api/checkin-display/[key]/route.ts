import { publicApiRoute } from "@/lib/apiRoute";
import { ApiError } from "@/lib/apiError";
import { getCheckinDisplay } from "@/service/checkin";

// Public: the iPad kiosk page (/checkin-display/[key]) polls this to learn the
// classroom name and QR target, and to notice when the key has been rotated.
// Gated only by the key, which is already printed on the studio wall.
export const GET = publicApiRoute<{ key: string }>(async ({ request, params }) => {
  const display = await getCheckinDisplay(params.key, new URL(request.url).origin);
  if (!display) throw new ApiError(404, "invalid_key", "This check-in link is no longer valid");
  return display;
});
