import type { Metadata } from "next";
import { headers } from "next/headers";
import CheckinDisplay from "@/features/checkinDisplay";
import { getCheckinDisplay } from "@/service/checkin";

// iPad kiosk: the classroom's check-in QR full screen, no login, no app shell.
// Gated by the same key the wall poster carries. See "iPad 門口顯示" in
// docs/architecture.md.

type Props = { params: Promise<{ key: string }> };

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const display = await getCheckinDisplay(key, await requestOrigin());
  const title = display ? `${display.classroomName} 簽到` : "簽到";
  return {
    title,
    // Its own manifest so「加入主畫面」opens this page, not the teacher app at "/".
    manifest: `/checkin-display/${encodeURIComponent(key)}/manifest.webmanifest`,
    appleWebApp: { capable: true, title, statusBarStyle: "default" },
    robots: { index: false, follow: false },
  };
}

export default async function CheckinDisplayPage({ params }: Props) {
  const { key } = await params;
  const initial = await getCheckinDisplay(key, await requestOrigin());
  return <CheckinDisplay checkinKey={key} initial={initial} />;
}
