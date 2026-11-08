import { getCheckinDisplay } from "@/service/checkin";

// Per-key web manifest for the iPad kiosk page. The root app/manifest.ts starts
// at "/" (the teacher app); this one keeps the home-screen icon on the kiosk.
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const display = await getCheckinDisplay(key, new URL(request.url).origin);
  const name = display ? `${display.classroomName} 簽到` : "簽到";
  const path = `/checkin-display/${encodeURIComponent(key)}`;
  return Response.json(
    {
      name,
      short_name: name,
      lang: "zh-Hant-TW",
      start_url: path,
      scope: path,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
