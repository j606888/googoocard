// The iOS App's WebView appends this to its user agent
// (`applicationNameForUserAgent` in mobile/), so the site can hide what the App
// already does natively — e.g. the "add to home screen" guide.
export const APP_USER_AGENT_MARKER = "GoogoocardApp";

// Inside the App's WebView, elements marked `data-in-app="hide"` (the bottom
// nav, the to-do bell, the classroom switcher — all native there) are hidden
// by a stylesheet the App injects before the page loads (mobile/src/lib/web.ts),
// so the page needs no client-side check and renders the same HTML.
// `data-in-app="flush-bottom"` drops a bar that is lifted above the web bottom
// nav back to `bottom: 0`, and `no-bottom-pad` removes the room kept for it.
export const isInApp = (userAgent: string) => userAgent.includes(APP_USER_AGENT_MARKER);
