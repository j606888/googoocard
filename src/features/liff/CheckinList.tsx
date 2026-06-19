"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DanceType } from "@prisma/client";
import { toast } from "sonner";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { StudentWithDetail } from "@/store/slices/students";
import { LiffAuthContext } from "@/app/liff/LiffStudentGate";
import { DANCE_TYPE_META, danceTypeLabel } from "@/lib/danceTypes";

interface TodayPeriod {
  periodId: number;
  startTime: string;
  endTime: string;
  alreadyChecked: boolean;
}
interface TodayLesson {
  lessonId: number;
  lessonName: string;
  danceType: DanceType;
  periods: TodayPeriod[];
}
interface TodayResponse {
  date: string;
  today: TodayLesson[];
  nextLesson: { lessonName: string; startTime: string } | null;
}
interface CheckinResult {
  periodId: number;
  status: "checked" | "already_checked" | "no_card";
  cardName?: string;
  remainingSessions?: number;
  exhausted?: boolean;
}

const timeFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "long",
  day: "numeric",
  weekday: "short",
});

// LIFF self check-in. Shows today's lessons (Taipei) in the student's classroom;
// the student selects one or more periods and checks in. On success a summary
// screen reports each period and, when a card is missing or was just used up,
// nudges toward「購買課卡」. Auth uses the LIFF ID token (plain fetch).
export default function CheckinList({
  student,
  auth,
}: {
  student: StudentWithDetail;
  auth: LiffAuthContext;
}) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<CheckinResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/liff/today?studentId=${auth.studentId}`, {
          headers: { Authorization: `Bearer ${auth.idToken}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json: TodayResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("[liff] load today error", err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.idToken, auth.studentId]);

  // periodId → its lesson + period, for rendering the result screen.
  const periodIndex = useMemo(() => {
    const map = new Map<number, { lessonName: string; period: TodayPeriod }>();
    data?.today.forEach((lesson) =>
      lesson.periods.forEach((period) =>
        map.set(period.periodId, { lessonName: lesson.lessonName, period }),
      ),
    );
    return map;
  }, [data]);

  const toggle = (periodId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(periodId)) next.delete(periodId);
      else next.add(periodId);
      return next;
    });
  };

  const handleCheckin = async () => {
    if (!data || selected.size === 0) return;
    // Group selected periods by lesson — the API takes one lesson at a time.
    const byLesson = new Map<number, number[]>();
    data.today.forEach((lesson) => {
      const ids = lesson.periods
        .filter((p) => selected.has(p.periodId))
        .map((p) => p.periodId);
      if (ids.length) byLesson.set(lesson.lessonId, ids);
    });

    setSubmitting(true);
    try {
      const all: CheckinResult[] = [];
      for (const [lessonId, periodIds] of byLesson) {
        const res = await fetch("/api/liff/checkin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.idToken}`,
          },
          body: JSON.stringify({ studentId: auth.studentId, lessonId, periodIds }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json: { results: CheckinResult[] } = await res.json();
        all.push(...json.results);
      }
      setResults(all);
    } catch (err) {
      console.error("[liff] checkin error", err);
      toast.error("簽到失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <p className="px-5 py-8 text-center text-sm text-neutral-500">
        載入失敗，請稍後再試。
      </p>
    );
  }
  if (!data) {
    return <ListSkeleton />;
  }

  // ----- Result screen -----
  if (results) {
    const needsCard = results.some(
      (r) => r.status === "no_card" || r.exhausted,
    );
    return (
      <div className="flex flex-col gap-4 px-5 py-6">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-semibold">報到完成</h2>
          <p className="text-sm text-neutral-500">{student.name}，以下是這次的簽到結果</p>
        </div>

        <div className="flex flex-col gap-3">
          {results.map((r) => {
            const info = periodIndex.get(r.periodId);
            return (
              <div
                key={r.periodId}
                className="rounded-xl border border-neutral-200 p-4"
              >
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
                    <span className="text-amber-600">報到成功，但沒有可用課卡</span>
                  )}
                  {r.status === "checked" && (
                    <span className="text-green-600">
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

        {needsCard && (
          <div className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4">
            <p className="text-sm leading-relaxed text-amber-800">
              你的課卡不足或已用完，要不要現在購買課卡？
            </p>
            <Link
              href="/liff/buy?from=checkin"
              className="rounded-lg bg-primary-500 py-3 text-center font-medium text-white active:bg-primary-600"
            >
              立即購買課卡
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ----- No class today -----
  if (data.today.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <div className="text-4xl">📅</div>
        <h2 className="text-lg font-semibold">今天沒有課程</h2>
        {data.nextLesson ? (
          <p className="text-neutral-500">
            下次上課：{dateFmt.format(new Date(data.nextLesson.startTime))}{" "}
            {timeFmt.format(new Date(data.nextLesson.startTime))}
            <br />
            {data.nextLesson.lessonName}
          </p>
        ) : (
          <p className="text-neutral-500">目前沒有安排中的課程。</p>
        )}
      </div>
    );
  }

  // ----- Select periods -----
  return (
    <div className="px-5 py-5 pb-28">
      <div className="flex flex-col gap-4">
        {data.today.map((lesson) => (
          <div key={lesson.lessonId} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{lesson.lessonName}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${DANCE_TYPE_META[lesson.danceType].badge}`}
              >
                {danceTypeLabel(lesson.danceType)}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {lesson.periods.map((period) => {
                const isSelected = selected.has(period.periodId);
                const disabled = period.alreadyChecked;
                return (
                  <button
                    key={period.periodId}
                    disabled={disabled}
                    onClick={() => toggle(period.periodId)}
                    className={`flex items-center justify-between rounded-xl border p-4 text-left transition-colors ${
                      disabled
                        ? "border-neutral-200 bg-neutral-50 text-neutral-400"
                        : isSelected
                          ? "border-primary-500 bg-primary-50"
                          : "border-neutral-200 active:bg-neutral-50"
                    }`}
                  >
                    <span>
                      {timeFmt.format(new Date(period.startTime))} –{" "}
                      {timeFmt.format(new Date(period.endTime))}
                    </span>
                    <span className="text-sm">
                      {disabled ? (
                        "已簽到"
                      ) : isSelected ? (
                        <span className="font-medium text-primary-600">已選</span>
                      ) : (
                        "點選報到"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] border-t border-neutral-100 bg-white p-4">
        <button
          disabled={selected.size === 0 || submitting}
          onClick={handleCheckin}
          className="w-full rounded-lg bg-primary-500 py-3 font-medium text-white active:bg-primary-600 disabled:bg-neutral-300"
        >
          {submitting ? "報到中…" : `確認報到${selected.size ? `（${selected.size}）` : ""}`}
        </button>
      </div>
    </div>
  );
}
