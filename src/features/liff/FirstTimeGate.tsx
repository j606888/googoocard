"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldLabel, fieldControlClass } from "@/components/Field";
import { cn } from "@/lib/utils";
import KiwiMascot from "@/components/KiwiMascot";
import ClaimSelf, { ClaimCandidate, ClaimConfirm } from "./ClaimSelf";
import { timeFmt } from "@/features/checkin/types";

interface SuggestionGroup {
  lessonId: number;
  lessonName: string;
  startTime: string;
  students: (ClaimCandidate & { kind: "term" | "trial" | "booked" })[];
}
interface Suggestions {
  groups: SuggestionGroup[];
  bestMatchId: number | null;
}

export interface FirstTimePrefill {
  classroomName: string;
  lineName: string;
  linePicture: string | null;
}

/**
 * On-site QR, and this LINE account has no student in the classroom yet
 * (設計稿 B1 → B2). Teachers often create students before their first class, so it
 * opens on「老師已經幫你登記了嗎？」: today's lessons with their unbound 整期／體驗
 * registrants (`GET /api/liff/claim?suggest=1`), the best LINE-name match on top —
 * one tap → ClaimConfirm. With nobody to suggest it asks「第一次來嗎？」as before.
 * 「第一次來」registers with just a nickname; 「我來上過課」
 * searches the unbound roster and claims itself (ClaimSelf) — anyone could claim
 * anyone, so each claim waits in the teacher's 待處理 to be confirmed or undone.
 * Either way goes straight on to the lesson list (a toast confirms) — an extra
 *「完成」screen read like the end of the flow. Adding the OA is asked once the
 * check-in is done (CheckinDone / NoClassToday), where it can't interrupt.
 */
export default function FirstTimeGate({
  prefill,
  idToken,
  checkinKey,
  onRegistered,
}: {
  prefill: FirstTimePrefill;
  idToken: string;
  checkinKey: string;
  onRegistered: () => void;
}) {
  const [step, setStep] = useState<"ask" | "name" | "returning">("ask");
  const [name, setName] = useState(prefill.lineName.slice(0, 30));
  const [submitting, setSubmitting] = useState(false);
  // undefined = loading; null = couldn't load (fall back to the plain question).
  const [suggestions, setSuggestions] = useState<Suggestions | null | undefined>(undefined);
  const [picked, setPicked] = useState<ClaimCandidate | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ key: checkinKey, suggest: "1" });
        const res = await fetch(`/api/liff/claim?${params}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as Suggestions;
        if (!cancelled) setSuggestions(data);
      } catch (err) {
        console.error("[liff] claim suggestions error", err);
        if (!cancelled) setSuggestions(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idToken, checkinKey]);

  const claimed = () => {
    toast.success("綁定完成");
    onRegistered();
  };

  const handleRegister = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/liff/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ key: checkinKey, name: name.trim() }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success("登記完成");
      onRegistered();
    } catch (err) {
      console.error("[liff] register error", err);
      toast.error("登記失敗，請稍後再試或找小幫手");
      setSubmitting(false);
    }
  };

  const avatar = prefill.linePicture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={prefill.linePicture} alt="" className="h-20 w-20 rounded-full object-cover" />
  ) : (
    <div className="h-20 w-20 rounded-full bg-neutral-200" />
  );

  const header = (
    <div className="flex items-center gap-2 px-5 pt-5 text-sm">
      {(step !== "ask" || picked) && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="返回"
          onClick={() => {
            setPicked(null);
            setStep("ask");
          }}
          className="-ml-3"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      <span className="font-medium text-neutral-800">{prefill.classroomName}</span>
    </div>
  );

  if (step === "name") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!submitting) handleRegister();
        }}
        className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-neutral-50"
      >
        {header}
        <div className="flex flex-1 flex-col gap-6 px-5 py-6">
          <div className="flex flex-col items-center gap-2">
            {avatar}
            {prefill.linePicture && <p className="text-xs text-neutral-500">使用你的 LINE 頭像</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="liff-nickname">大家要怎麼叫你？</FieldLabel>
            <input
              id="liff-nickname"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              aria-describedby="liff-nickname-hint"
              className={cn(fieldControlClass(), "h-12")}
              placeholder="暱稱或中文名"
            />
            <p id="liff-nickname-hint" className="text-[13px] text-neutral-500">
              已先帶入你的 LINE 名稱，可以改成暱稱或中文名
            </p>
          </div>
          <div className="flex gap-2.5 rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-600">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
            以後打開 LINE 選單就能報到、看剩幾堂、買課卡，不用註冊帳號密碼。
          </div>
        </div>
        <div className="px-5 pb-6">
          <Button type="submit" size="lg" disabled={!name.trim()} isLoading={submitting} className="w-full">
            {submitting ? "登記中…" : "下一步：選今天的課"}
          </Button>
        </div>
      </form>
    );
  }

  if (step === "returning") {
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-neutral-50">
        {header}
        <ClaimSelf
          idToken={idToken}
          checkinKey={checkinKey}
          onClaimed={claimed}
          onFirstTime={() => setStep("name")}
        />
      </div>
    );
  }

  if (picked) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-white">
        {header}
        <ClaimConfirm
          candidate={picked}
          idToken={idToken}
          checkinKey={checkinKey}
          onClaimed={claimed}
          onCancel={() => setPicked(null)}
        />
      </div>
    );
  }

  if (suggestions === undefined) {
    return <div className="mx-auto min-h-screen max-w-[480px] bg-white" aria-busy="true" />;
  }

  if (suggestions && suggestions.groups.length > 0) {
    return (
      <SuggestionList
        classroomName={prefill.classroomName}
        lineName={prefill.lineName}
        suggestions={suggestions}
        onPick={setPicked}
        onSearch={() => setStep("returning")}
        onFirstTime={() => setStep("name")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-neutral-50">
      {header}
      <div className="flex flex-1 flex-col gap-6 px-5 py-8">
        <div className="flex flex-col items-center gap-3 pt-4 text-center">
          {avatar}
          <h1 className="text-2xl font-bold">{prefill.lineName ? `嗨，${prefill.lineName}` : "嗨"}</h1>
          <p className="leading-relaxed text-neutral-600">
            這個 LINE 還沒有在這間教室登記過。
            <br />
            你是第一次來上課嗎？
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setStep("name")}
            className="flex items-center gap-3.5 rounded-2xl border-2 border-primary-700 bg-white p-4 text-left active:bg-primary-50"
          >
            <UserPlus className="h-6 w-6 shrink-0 text-primary-700" />
            <span className="flex-1">
              <span className="block text-lg font-bold">是，第一次來</span>
              <span className="block text-sm text-neutral-600">填個暱稱就能報到</span>
            </span>
            <ChevronRight className="h-5 w-5 text-primary-700" />
          </button>
          <button
            type="button"
            onClick={() => setStep("returning")}
            className="flex items-center gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4 text-left active:bg-neutral-50"
          >
            <Users className="h-6 w-6 shrink-0 text-neutral-600" />
            <span className="flex-1">
              <span className="block text-lg font-bold">我來上過課</span>
              <span className="block text-sm text-neutral-600">找到自己、綁定 LINE 就能報到</span>
            </span>
            <ChevronRight className="h-5 w-5 text-neutral-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 *「老師已經幫你登記了嗎？」— today's registrants, grouped by lesson; the best LINE-name
 * match is pulled out on top (and not repeated below). 設計稿「這是你嗎？」.
 */
function SuggestionList({
  classroomName,
  lineName,
  suggestions,
  onPick,
  onSearch,
  onFirstTime,
}: {
  classroomName: string;
  lineName: string;
  suggestions: Suggestions;
  onPick: (candidate: ClaimCandidate) => void;
  onSearch: () => void;
  onFirstTime: () => void;
}) {
  const best =
    suggestions.bestMatchId !== null
      ? suggestions.groups.flatMap((g) => g.students).find((s) => s.id === suggestions.bestMatchId) ?? null
      : null;
  const bestLesson = best
    ? suggestions.groups.find((g) => g.students.some((s) => s.id === best.id)) ?? null
    : null;
  const groups = suggestions.groups
    .map((g) => ({ ...g, students: g.students.filter((s) => s.id !== best?.id) }))
    .filter((g) => g.students.length > 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-white">
      <header className="flex flex-col gap-1 bg-primary-900 px-5 pb-5 pt-4 text-white">
        <div className="text-[13px] text-primary-100">{classroomName}</div>
        <div className="text-xl font-bold">上課簽到</div>
      </header>

      <div className="flex items-center gap-3.5 px-5 pb-2 pt-6">
        <KiwiMascot pose="wave" className="w-[72px] shrink-0" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold leading-snug">老師已經幫你登記了嗎？</h1>
          <p className="text-sm leading-relaxed text-neutral-600">找到自己點一下，下次就不用再找了</p>
        </div>
      </div>

      {best && (
        <section>
          <h2 className="px-5 pb-1.5 pt-5 text-[13px] font-medium text-primary-700">
            最像你的 LINE 名稱「{lineName}」
          </h2>
          <SuggestionRow
            student={best}
            detail={`${bestLesson?.lessonName ?? ""} · ${best.kind === "term" ? "整期" : best.kind === "booked" ? "預約" : "體驗"}`}
            highlighted
            onPick={onPick}
          />
        </section>
      )}

      {groups.map((group) => (
        <section key={group.lessonId}>
          <h2 className="px-5 pb-1.5 pt-5 text-[13px] font-medium text-neutral-600">
            今天 {timeFmt.format(new Date(group.startTime))} {group.lessonName}
          </h2>
          <ul className="divide-y divide-neutral-100">
            {group.students.map((student) => (
              <li key={student.id}>
                <SuggestionRow student={student} onPick={onPick} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="mt-auto flex flex-col gap-1 border-t border-neutral-100 px-5 pb-7 pt-4">
        <p className="pb-1 text-sm text-neutral-600">名單上沒有你？</p>
        <button
          type="button"
          onClick={onSearch}
          className="flex min-h-12 items-center gap-2.5 text-base font-medium text-primary-900"
        >
          <Search className="h-5 w-5" />
          我來上過課，搜尋我的名字
        </button>
        <button
          type="button"
          onClick={onFirstTime}
          className="flex min-h-12 items-center gap-2.5 text-base font-medium text-primary-900"
        >
          <Plus className="h-5 w-5" />
          我是第一次來
        </button>
      </div>
    </div>
  );
}

function SuggestionRow({
  student,
  detail,
  highlighted = false,
  onPick,
}: {
  student: ClaimCandidate;
  detail?: string;
  highlighted?: boolean;
  onPick: (candidate: ClaimCandidate) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(student)}
      className={cn(
        "flex min-h-[60px] w-full items-center gap-3 px-5 py-2.5 text-left active:bg-primary-50",
        highlighted && "bg-primary-50"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={student.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-base", highlighted && "text-[17px] font-bold")}>{student.name}</span>
        {detail && <span className="truncate text-[13px] text-neutral-600">{detail}</span>}
      </span>
      {highlighted ? (
        <span className="text-[15px] font-bold text-primary-900">是我</span>
      ) : (
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
      )}
    </button>
  );
}
