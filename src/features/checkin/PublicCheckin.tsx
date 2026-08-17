"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import PeriodSelectList from "./PeriodSelectList";
import CheckinResultList from "./CheckinResultList";
import StudentPicker, { CheckinStudent } from "./StudentPicker";
import {
  CheckinResult,
  TodayResponse,
  dateFmt,
  groupSelectedByLesson,
  timeFmt,
} from "./types";

interface BoardResponse extends TodayResponse {
  classroomName: string;
}

// Walk-up self check-in from the QR code posted on the studio wall.
//
// Three steps: pick yourself from the roster → pick which of today's periods you
// are attending → confirm. Identity is NOT verified: the studio trusts students
// to only sign themselves in, and the 助教 reviews the roster on the teacher-side
// check screen before finalizing the period. A missing/used-up card never blocks
// the check-in, it only raises a「去買課卡」reminder on the result screen.
const PublicCheckin = ({ checkinKey }: { checkinKey: string }) => {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [students, setStudents] = useState<CheckinStudent[] | null>(null);
  const [invalidKey, setInvalidKey] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [student, setStudent] = useState<CheckinStudent | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<CheckinResult[] | null>(null);

  const loadBoard = useCallback(
    async (studentId?: number): Promise<BoardResponse | null> => {
      const suffix = studentId ? `?studentId=${studentId}` : "";
      const res = await fetch(`/api/checkin/${checkinKey}${suffix}`);
      if (res.status === 404) {
        setInvalidKey(true);
        return null;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    [checkinKey]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [boardJson, studentsRes] = await Promise.all([
          loadBoard(),
          fetch(`/api/checkin/${checkinKey}/students`),
        ]);
        if (cancelled || !boardJson) return;
        if (!studentsRes.ok) throw new Error(`status ${studentsRes.status}`);
        const { students: list } = await studentsRes.json();
        setBoard(boardJson);
        setStudents(list);
      } catch (err) {
        console.error("[checkin] load error", err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkinKey, loadBoard]);

  // Picking a student re-reads the board so periods they already signed for show
  // as「已簽到」instead of being offered again.
  const handleSelectStudent = async (picked: CheckinStudent) => {
    setStudent(picked);
    try {
      const refreshed = await loadBoard(picked.id);
      if (!refreshed) return;
      setBoard(refreshed);

      // A single period today is the common case — pre-select it so the student
      // only has to press the confirm button.
      const periods = refreshed.today.flatMap((l) => l.periods);
      setSelected(
        periods.length === 1 && !periods[0].alreadyChecked
          ? new Set([periods[0].periodId])
          : new Set()
      );
    } catch (err) {
      console.error("[checkin] load board error", err);
      toast.error("載入失敗，請稍後再試");
      setStudent(null);
    }
  };

  const toggle = (periodId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(periodId)) next.delete(periodId);
      else next.add(periodId);
      return next;
    });
  };

  const handleCheckin = async () => {
    if (!board || !student || selected.size === 0) return;
    const byLesson = groupSelectedByLesson(board.today, selected);

    setSubmitting(true);
    try {
      const all: CheckinResult[] = [];
      for (const [lessonId, periodIds] of byLesson) {
        const res = await fetch(`/api/checkin/${checkinKey}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: student.id, lessonId, periodIds }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json: { results: CheckinResult[] } = await res.json();
        all.push(...json.results);
      }
      setResults(all);
    } catch (err) {
      console.error("[checkin] submit error", err);
      toast.error("簽到失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  const restart = async () => {
    setResults(null);
    setStudent(null);
    setSelected(new Set());
    try {
      const refreshed = await loadBoard();
      if (refreshed) setBoard(refreshed);
    } catch (err) {
      console.error("[checkin] reload error", err);
    }
  };

  const Header = ({ subtitle }: { subtitle?: string }) => (
    <div className="flex h-16 w-full flex-col items-center justify-center bg-primary-500 text-white">
      <h1 className="text-lg font-semibold">{board?.classroomName ?? "上課簽到"}</h1>
      {subtitle && <span className="text-xs opacity-90">{subtitle}</span>}
    </div>
  );

  if (invalidKey) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-semibold">簽到連結已失效</h2>
        <p className="text-neutral-500">請找老師或助教確認最新的簽到 QR Code。</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="px-5 py-8 text-center text-sm text-neutral-500">
        載入失敗，請稍後再試。
      </p>
    );
  }

  if (!board || !students) {
    return <ListSkeleton />;
  }

  // ----- No class today -----
  if (board.today.length === 0) {
    return (
      <>
        <Header />
        <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
          <div className="text-4xl">📅</div>
          <h2 className="text-lg font-semibold">今天沒有課程</h2>
          {board.nextLesson ? (
            <p className="text-neutral-500">
              下次上課：{dateFmt.format(new Date(board.nextLesson.startTime))}{" "}
              {timeFmt.format(new Date(board.nextLesson.startTime))}
              <br />
              {board.nextLesson.lessonName}
            </p>
          ) : (
            <p className="text-neutral-500">目前沒有安排中的課程。</p>
          )}
        </div>
      </>
    );
  }

  // ----- Result screen -----
  if (results && student) {
    return (
      <>
        <Header subtitle="報到完成" />
        <div className="flex flex-col gap-4 px-5 py-6">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-semibold">報到完成</h2>
            <p className="text-sm text-neutral-500">
              {student.name}，以下是這次的簽到結果
            </p>
          </div>

          <CheckinResultList
            results={results}
            lessons={board.today}
            needsCardNotice={
              <div className="rounded-xl bg-warning-50 p-4">
                <p className="text-sm leading-relaxed text-warning-800">
                  你的課卡不足或已用完，記得找助教購買新的課卡喔！
                </p>
              </div>
            }
          />

          <button
            onClick={restart}
            className="rounded-lg border border-neutral-200 py-3 font-medium active:bg-neutral-50"
          >
            完成，換下一位同學
          </button>
        </div>
      </>
    );
  }

  // ----- Step 1: who are you -----
  if (!student) {
    return (
      <>
        <Header subtitle={board.date} />
        <StudentPicker students={students} onSelect={handleSelectStudent} />
      </>
    );
  }

  // ----- Step 2: which periods -----
  return (
    <>
      <Header subtitle={board.date} />
      <div className="px-5 py-5 pb-28">
        <button
          onClick={() => {
            setStudent(null);
            setSelected(new Set());
          }}
          className="mb-4 flex items-center gap-1 text-sm text-neutral-500"
        >
          <ChevronLeft className="h-4 w-4" />
          {student.name}（不是我）
        </button>

        <h2 className="mb-3 text-lg font-semibold">要簽到哪幾堂課？</h2>
        <PeriodSelectList lessons={board.today} selected={selected} onToggle={toggle} />

        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] border-t border-neutral-100 bg-white p-4">
          <button
            disabled={selected.size === 0 || submitting}
            onClick={handleCheckin}
            className="w-full rounded-lg bg-primary-500 py-3 font-medium text-white active:bg-primary-600 disabled:bg-neutral-300"
          >
            {submitting
              ? "報到中…"
              : `確認報到${selected.size ? `（${selected.size}）` : ""}`}
          </button>
        </div>
      </div>
    </>
  );
};

export default PublicCheckin;
