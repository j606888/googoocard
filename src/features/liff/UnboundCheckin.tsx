"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadLiff } from "@/lib/liffClient";
import { toTaipeiMonthKey } from "@/lib/taipei-date";
import { dateKeyOf, taipeiTime } from "./scheduleDates";

type TodayPeriod = { id: number; startTime: string; lessonName: string; location: { name: string } | null };

/** The wall-QR value → its checkinKey. New posters are LIFF links (`?key=`), old ones `/checkin/<key>`. */
export function checkinKeyFromQr(value: string): string | null {
  try {
    const url = new URL(value);
    const key = url.searchParams.get("key");
    if (key) return key;
    return url.pathname.match(/\/checkin\/([^/?#]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * 「上課簽到」opened from the rich menu by a LINE account that isn't a student yet.
 * Not a dead end: scan the door's QR right here (LINE's scanner, when the LIFF app
 * has「Scan QR」on) — that's the newcomer flow — or ask the teacher for a bind link.
 */
export default function UnboundCheckin({ idToken }: { idToken: string }) {
  const [canScan, setCanScan] = useState(false);
  const [today, setToday] = useState<TodayPeriod[]>([]);

  useEffect(() => {
    loadLiff()
      .then((liff) => setCanScan(!!liff.scanCodeV2 && (liff.isApiAvailable?.("scanCodeV2") ?? false)))
      .catch(() => setCanScan(false));
    // Today's lessons of the public classroom, if there's exactly one to show.
    fetch(`/api/liff/schedule?month=${toTaipeiMonthKey(new Date())}`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { periods: TodayPeriod[] } | null) => {
        const todayKey = dateKeyOf(new Date());
        setToday((data?.periods ?? []).filter((p) => dateKeyOf(p.startTime) === todayKey));
      })
      .catch(() => {});
  }, [idToken]);

  const scan = async () => {
    try {
      const liff = await loadLiff();
      const { value } = (await liff.scanCodeV2?.()) ?? { value: null };
      if (!value) return;
      const key = checkinKeyFromQr(value);
      if (!key) {
        toast.error("這不是教室的簽到 QR Code");
        return;
      }
      // Full reload: the gate reads ?key= once, on start.
      window.location.assign(`/liff/checkin?key=${encodeURIComponent(key)}`);
    } catch (err) {
      console.error("[liff] scan error", err);
      toast.error("無法開啟相機，請改用手機相機掃門口的 QR Code");
    }
  };

  return (
    <>
      <div className="flex h-16 w-full items-center justify-center bg-primary-900">
        <h2 className="text-lg font-semibold text-white">上課簽到</h2>
      </div>
      <div className="flex flex-col gap-6 px-5 pb-8 pt-8">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <span className="flex size-24 items-center justify-center rounded-full bg-primary-100">
            <QrCode className="size-11 text-primary-700" strokeWidth={1.8} aria-hidden />
          </span>
          <h3 className="text-xl font-semibold text-neutral-900">掃門口的 QR 就能簽到</h3>
          <p className="text-sm leading-relaxed text-neutral-700">
            你還沒登記成學生。到教室後掃門口的簽到 QR Code，第一次來會帶你填名字，接著就能選課簽到。
          </p>
        </div>

        {canScan && (
          <Button size="lg" onClick={scan}>
            <ScanLine aria-hidden />
            掃描簽到 QR Code
          </Button>
        )}

        {today.length > 0 && (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-neutral-200 bg-white p-3.5">
            <span className="text-xs font-medium text-neutral-500">今天有課</span>
            {today.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 text-sm">
                <span className="w-11 font-semibold text-neutral-900">{taipeiTime(p.startTime)}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-900">{p.lessonName}</span>
                {p.location && <span className="text-xs text-neutral-500">{p.location.name}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5 border-t border-neutral-200 pt-4">
          <p className="text-sm leading-relaxed text-neutral-700">
            已經在上課了？請老師傳<strong className="font-semibold">綁定連結</strong>給你，點開送出就完成。
          </p>
          <Button asChild variant="link" className="self-start">
            <Link href="/liff/schedule">先看課表</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
