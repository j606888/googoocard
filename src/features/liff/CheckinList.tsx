"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { StudentWithDetail } from "@/store/slices/students";
import { LiffAuthContext } from "@/app/liff/LiffStudentGate";
import PeriodSelectList from "@/features/checkin/PeriodSelectList";
import CheckinResultList from "@/features/checkin/CheckinResultList";
import {
  CheckinResult,
  TodayResponse,
  dateFmt,
  groupSelectedByLesson,
  timeFmt,
} from "@/features/checkin/types";

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
    const byLesson = groupSelectedByLesson(data.today, selected);

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
    return (
      <div className="flex flex-col gap-4 px-5 py-6">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-semibold">報到完成</h2>
          <p className="text-sm text-neutral-500">{student.name}，以下是這次的簽到結果</p>
        </div>

        <CheckinResultList
          results={results}
          lessons={data.today}
          needsCardNotice={
            <div className="flex flex-col gap-3 rounded-xl bg-warning-50 p-4">
              <p className="text-sm leading-relaxed text-warning-800">
                你的課卡不足或已用完，要不要現在購買課卡？
              </p>
              <Link
                href="/liff/buy?from=checkin"
                className="rounded-lg bg-primary-500 py-3 text-center font-medium text-white active:bg-primary-600"
              >
                立即購買課卡
              </Link>
            </div>
          }
        />
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
      <PeriodSelectList lessons={data.today} selected={selected} onToggle={toggle} />

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
