"use client";

import { ReactNode, useMemo } from "react";
import { CheckinResult, TodayLesson, TodayPeriod, timeFmt } from "./types";

// Per-period outcome of a check-in submission, shared by the LIFF page and the
// public QR page. `needsCardNotice` is rendered only when at least one period
// came back without a usable card (or just used the last session) — the two
// entrances word that nudge differently: LIFF can link to 自助購卡, the
// unauthenticated QR page can only tell the student to find a 助教.
const CheckinResultList = ({
  results,
  lessons,
  needsCardNotice,
}: {
  results: CheckinResult[];
  lessons: TodayLesson[];
  needsCardNotice?: ReactNode;
}) => {
  const periodIndex = useMemo(() => {
    const map = new Map<number, { lessonName: string; period: TodayPeriod }>();
    lessons.forEach((lesson) =>
      lesson.periods.forEach((period) =>
        map.set(period.periodId, { lessonName: lesson.lessonName, period })
      )
    );
    return map;
  }, [lessons]);

  const needsCard = results.some((r) => r.status === "no_card" || r.exhausted);

  return (
    <>
      <div className="flex flex-col gap-3">
        {results.map((r) => {
          const info = periodIndex.get(r.periodId);
          return (
            <div key={r.periodId} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{info?.lessonName ?? "課程"}</span>
                <span className="text-sm text-neutral-500">
                  {info && timeFmt.format(new Date(info.period.startTime))}
                </span>
              </div>
              <div className="mt-1 text-sm">
                {r.status === "already_checked" && (
                  <span className="text-neutral-500">先前已簽到</span>
                )}
                {r.status === "no_card" && (
                  <span className="text-warning-600">報到成功，但沒有可用課卡</span>
                )}
                {r.status === "checked" && (
                  <span className="text-success-600">
                    報到成功 · 已扣 {r.cardName}
                    {typeof r.remainingSessions === "number" &&
                      `（剩 ${r.remainingSessions} 堂）`}
                    {r.exhausted && " · 已是最後一堂"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {needsCard && needsCardNotice}
    </>
  );
};

export default CheckinResultList;
