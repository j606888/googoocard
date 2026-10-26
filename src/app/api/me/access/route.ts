import { apiRoute } from "@/lib/apiRoute";

/**
 * What the caller may do in the current classroom — the front end hides nav
 * links and buttons with it (`useCan`). Only a convenience: every route
 * enforces its own permission.
 */
export const GET = apiRoute(async ({ role, permissions, modules }) => ({
  role,
  permissions: [...permissions],
  modules: [...modules],
}));
