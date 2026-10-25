"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, Banknote, CalendarX, Check, ChevronLeft, CreditCard, Info } from "lucide-react";
import ListSkeleton from "@/components/skeletons/ListSkeleton";
import { StudentWithDetail } from "@/store/slices/students";
import { LiffAuthContext } from "@/app/liff/LiffStudentGate";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatMoney } from "@/lib/money";
import {
  CheckinResponse,
  TodayLesson,
  TodayResponse,
  dateFmt,
  groupSelectedByLesson,
  timeFmt,
} from "@/features/checkin/types";

// What pays for one lesson: one of the student's cards, or one bought now.
type Payment = { studentCardId: number } | { buyCardId: number };

type Done = {
  lessons: TodayLesson[];
  responses: { lessonId: number; response: CheckinResponse }[];
};

const timeRange = (p: { startTime: string; endTime: string }) =>
  `${timeFmt.format(new Date(p.startTime))} – ${timeFmt.format(new Date(p.endTime))}`;

const ERROR_MESSAGE: Record<string, string> = {
  card_required: "課卡堂數不夠這次報到，請少選幾堂或找小幫手",
  card_not_usable: "這張卡不能用在這堂課，請重新選擇",
  card_not_offered: "這張卡不能用在這堂課，請重新選擇",
  not_qualified: "還沒有這張複習卡的資格，請找小幫手",
};

/**
 * LIFF self check-in (設計稿 B3–B7). Today's lessons with what the student can
 * pay with; every check-in is bound to a card — the engine's pick, one the
 * student chooses, or one bought on the spot (paid after class). The ending
 * says how much to pay and reminds about older unpaid cards. No push.
 */
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
  // Per-lesson choice among the student's own cards (when there are several).
  const [cardChoice, setCardChoice] = useState<Record<number, number>>({});
  // Per-lesson card to buy (when they have none).
  const [buyChoice, setBuyChoice] = useState<Record<number, number>>({});
  const [step, setStep] = useState<"periods" | "buy">("periods");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/liff/today?studentId=${auth.studentId}`, {
          headers: { Authorization: `Bearer ${auth.idToken}` },
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json: TodayResponse = await res.json();
        if (cancelled) return;
        setData(json);
        // Preselect when there's exactly one open period and a way to pay.
        const open = json.today.flatMap((l) =>
          l.periods.filter((p) => !p.alreadyChecked).map((p) => ({ lesson: l, period: p }))
        );
        if (open.length === 1 && canPay(open[0].lesson)) {
          setSelected(new Set([open[0].period.periodId]));
        }
      } catch (err) {
        console.error("[liff] load today error", err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.idToken, auth.studentId]);

  const selectedLessons = useMemo(
    () =>
      (data?.today ?? []).filter((l) => l.periods.some((p) => selected.has(p.periodId))),
    [data, selected]
  );
  const lessonsToBuy = selectedLessons.filter((l) => (l.cardStatus?.usable.length ?? 0) === 0);
  const amountToPay = lessonsToBuy.reduce((sum, l) => {
    const card = l.cardStatus?.buyable.find((c) => c.cardId === buyChoice[l.lessonId]);
    return sum + (card?.price ?? 0);
  }, 0);

  const toggle = (periodId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(periodId)) next.delete(periodId);
      else next.add(periodId);
      return next;
    });
  };

  const paymentFor = (lesson: TodayLesson): Payment | null => {
    const status = lesson.cardStatus;
    if (!status) return null;
    if (status.usable.length > 0) {
      const id = cardChoice[lesson.lessonId] ?? status.autoPickId ?? status.usable[0].studentCardId;
      return { studentCardId: id };
    }
    const buy = buyChoice[lesson.lessonId];
    return buy ? { buyCardId: buy } : null;
  };

  const goNext = () => {
    if (lessonsToBuy.length === 0) {
      submit();
      return;
    }
    // Default each lesson to its first offer (cheapest).
    setBuyChoice((prev) => {
      const next = { ...prev };
      lessonsToBuy.forEach((l) => {
        if (!next[l.lessonId] && l.cardStatus?.buyable[0]) {
          next[l.lessonId] = l.cardStatus.buyable[0].cardId;
        }
      });
      return next;
    });
    setStep("buy");
  };

  const submit = async () => {
    if (!data || selected.size === 0) return;
    const byLesson = groupSelectedByLesson(data.today, selected);

    setSubmitting(true);
    const responses: Done["responses"] = [];
    try {
      for (const [lessonId, periodIds] of byLesson) {
        const lesson = data.today.find((l) => l.lessonId === lessonId)!;
        const res = await fetch("/api/liff/checkin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.idToken}`,
          },
          body: JSON.stringify({
            studentId: auth.studentId,
            lessonId,
            periodIds,
            ...paymentFor(lesson),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `status ${res.status}`);
        }
        responses.push({ lessonId, response: await res.json() });
      }
      setDone({ lessons: data.today, responses });
    } catch (err) {
      console.error("[liff] checkin error", err);
      const code = err instanceof Error ? err.message : "";
      toast.error(ERROR_MESSAGE[code] ?? "報到失敗，請稍後再試");
      // Some lessons may already be recorded — show them rather than lose them.
      if (responses.length > 0) setDone({ lessons: data.today, responses });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <p className="px-5 py-8 text-center text-sm text-neutral-500">載入失敗，請稍後再試。</p>
    );
  }
  if (!data) {
    return <ListSkeleton />;
  }

  if (done) {
    return <CheckinDone student={student} done={done} />;
  }

  // ----- No class today -----
  if (data.today.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
        <CalendarX className="h-10 w-10 text-neutral-400" />
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

  // ----- Pick a card to buy (B4) -----
  if (step === "buy") {
    return (
      <div className="px-5 py-5 pb-40">
        <button
          type="button"
          onClick={() => setStep("periods")}
          className="-ml-2 mb-2 inline-flex h-11 items-center gap-1 px-2 text-sm text-neutral-600"
        >
          <ChevronLeft className="h-4 w-4" />
          重選時段
        </button>
        <div className="flex flex-col gap-6">
          {lessonsToBuy.map((lesson) => (
            <fieldset key={lesson.lessonId} className="flex flex-col gap-3">
              <legend className="mb-3">
                <span className="block text-lg font-semibold">這堂要用哪張卡？</span>
                <span className="block text-sm text-neutral-500">{lesson.lessonName}</span>
              </legend>
              {lesson.cardStatus!.buyable.map((card) => {
                const checked = buyChoice[lesson.lessonId] === card.cardId;
                return (
                  <label
                    key={card.cardId}
                    className={`flex items-center gap-3 rounded-2xl border bg-white p-4 ${
                      checked ? "border-2 border-primary-700" : "border-neutral-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`buy-${lesson.lessonId}`}
                      checked={checked}
                      onChange={() =>
                        setBuyChoice((prev) => ({ ...prev, [lesson.lessonId]: card.cardId }))
                      }
                      className="h-5 w-5 accent-primary-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{card.name}</span>
                      <span className="block text-sm text-neutral-500">
                        {card.sessions} 堂{card.sessions > 1 ? " · 今天先扣 1 堂" : ""}
                      </span>
                    </span>
                    <span className="text-lg font-bold">
                      {card.price === 0 ? "免費" : `$${formatMoney(card.price)}`}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          <p className="flex gap-2 text-sm leading-relaxed text-neutral-600">
            <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
            現在不用付錢，下課再找小幫手付現金或轉帳。
          </p>
        </div>

        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col gap-2 border-t border-neutral-100 bg-white p-4">
          {amountToPay > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-600">下課要付</span>
              <span className="font-bold">${formatMoney(amountToPay)}</span>
            </div>
          )}
          <button
            disabled={submitting || lessonsToBuy.some((l) => !buyChoice[l.lessonId])}
            onClick={submit}
            className="w-full rounded-lg bg-primary-700 py-3 font-medium text-white active:bg-primary-900 disabled:bg-neutral-300"
          >
            {submitting ? "報到中…" : "確認報到"}
          </button>
        </div>
      </div>
    );
  }

  // ----- Select periods, with each lesson's card status (B3 / B6) -----
  return (
    <div className="px-5 py-5 pb-28">
      <p className="mb-4 text-sm text-neutral-500">
        {dateFmt.format(new Date())} · {student.name}
      </p>
      <div className="flex flex-col gap-4">
        {data.today.map((lesson) => (
          <LessonBlock
            key={lesson.lessonId}
            lesson={lesson}
            selected={selected}
            onToggle={toggle}
            chosenCardId={cardChoice[lesson.lessonId]}
            onChooseCard={(id) => setCardChoice((prev) => ({ ...prev, [lesson.lessonId]: id }))}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[480px] border-t border-neutral-100 bg-white p-4">
        <button
          disabled={selected.size === 0 || submitting}
          onClick={goNext}
          className="w-full rounded-lg bg-primary-700 py-3 font-medium text-white active:bg-primary-900 disabled:bg-neutral-300"
        >
          {submitting
            ? "報到中…"
            : lessonsToBuy.length > 0
              ? "下一步：選課卡"
              : `確認報到${selected.size ? `（${selected.size}）` : ""}`}
        </button>
      </div>
    </div>
  );
}

// A lesson the student can pay for — with a card they hold, or one they can buy.
function canPay(lesson: TodayLesson) {
  const status = lesson.cardStatus;
  return Boolean(status && (status.usable.length > 0 || status.buyable.length > 0));
}

function LessonBlock({
  lesson,
  selected,
  onToggle,
  chosenCardId,
  onChooseCard,
}: {
  lesson: TodayLesson;
  selected: Set<number>;
  onToggle: (periodId: number) => void;
  chosenCardId: number | undefined;
  onChooseCard: (studentCardId: number) => void;
}) {
  const status = lesson.cardStatus;
  const payable = canPay(lesson);
  const isSelected = lesson.periods.some((p) => selected.has(p.periodId));
  const usable = status?.usable ?? [];
  const currentCard = chosenCardId ?? status?.autoPickId ?? usable[0]?.studentCardId;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 ${
        isSelected ? "border-2 border-primary-700" : "border-neutral-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold">{lesson.lessonName}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${danceStyleMeta(lesson.danceStyle).badge}`}
        >
          {danceStyleMeta(lesson.danceStyle).label}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {lesson.periods.map((period) => {
          const checked = selected.has(period.periodId);
          const disabled = period.alreadyChecked || !payable;
          return (
            <label
              key={period.periodId}
              className={`flex items-center gap-3 rounded-xl px-1 py-1.5 ${disabled ? "text-neutral-400" : ""}`}
            >
              <input
                type="checkbox"
                checked={period.alreadyChecked || checked}
                disabled={disabled}
                onChange={() => onToggle(period.periodId)}
                className="h-5 w-5 accent-primary-700"
              />
              <span className="flex-1">{timeRange(period)}</span>
              {period.alreadyChecked && <span className="text-sm">已簽到</span>}
            </label>
          );
        })}
      </div>

      {!payable && (
        <p className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          <Info className="h-4 w-4 shrink-0" />
          這堂課沒有你能用的課卡，請找小幫手
        </p>
      )}

      {payable && usable.length === 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          還沒有能用的課卡，下一步選一張
        </p>
      )}

      {usable.length === 1 && (
        <p className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-900">
          <CreditCard className="h-4 w-4 shrink-0" />
          使用 {usable[0].name}（剩 {usable[0].remainingSessions} 堂）
        </p>
      )}

      {usable.length > 1 && (
        <fieldset className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
          <legend className="mb-2 text-sm font-medium text-neutral-600">
            你有 {usable.length} 張卡能用，選一張：
          </legend>
          {usable.map((card) => {
            const checked = currentCard === card.studentCardId;
            return (
              <label
                key={card.studentCardId}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${
                  checked ? "border-2 border-primary-700 bg-primary-50" : "border-neutral-200"
                }`}
              >
                <input
                  type="radio"
                  name={`card-${lesson.lessonId}`}
                  checked={checked}
                  onChange={() => onChooseCard(card.studentCardId)}
                  className="h-5 w-5 accent-primary-700"
                />
                <span className="flex-1">
                  {card.name}{" "}
                  <span className="text-xs text-neutral-500">{formatCardSerial(card.serialNumber)}</span>
                </span>
                <span className="text-sm text-neutral-500">剩 {card.remainingSessions} 堂</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

// ----- Completion (B5 / B7) -----
function CheckinDone({ student, done }: { student: StudentWithDetail; done: Done }) {
  const periodInfo = new Map<number, { lessonName: string; start: string }>();
  done.lessons.forEach((l) =>
    l.periods.forEach((p) => periodInfo.set(p.periodId, { lessonName: l.lessonName, start: p.startTime }))
  );
  const results = done.responses.flatMap((r) => r.response.results);
  const checkedCount = results.filter((r) => r.status === "checked").length;
  const amountDue = done.responses.reduce((sum, r) => sum + r.response.amountDue, 0);
  const justBought = new Set(done.responses.map((r) => r.response.purchased?.id).filter(Boolean));
  // The latest response has the most up-to-date unpaid list.
  const unpaid = done.responses[done.responses.length - 1]?.response.unpaidCards ?? [];
  const olderUnpaid = unpaid.filter((c) => !justBought.has(c.id));
  const runningLow = results.find(
    (r) => r.status === "checked" && typeof r.remainingSessions === "number" && r.remainingSessions <= 1
  );

  const handleClose = async () => {
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient()) {
        liff.closeWindow();
        return;
      }
    } catch (err) {
      console.error("[liff] close window error", err);
    }
    window.close();
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-3 bg-neutral-50 px-5 py-6">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-700">
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold">
          {checkedCount > 1 ? `已報到 ${checkedCount} 堂` : checkedCount === 1 ? "已報到" : "先前已簽到"}
        </h2>
        <p className="text-sm text-neutral-500">{student.name}</p>
      </div>

      <div className="rounded-2xl bg-white px-4 py-1">
        {results.map((r) => {
          const info = periodInfo.get(r.periodId);
          return (
            <div
              key={r.periodId}
              className="flex items-center justify-between border-b border-neutral-100 py-3 last:border-b-0"
            >
              <div>
                <p className="font-semibold">{info?.lessonName ?? "課程"}</p>
                <p className="text-sm text-primary-900">
                  {r.status === "already_checked"
                    ? "先前已簽到"
                    : r.status === "checked"
                      ? `${r.cardName}${typeof r.remainingSessions === "number" ? ` · 剩 ${r.remainingSessions} 堂` : ""}`
                      : "沒有綁到課卡，請找小幫手"}
                </p>
              </div>
              <span className="text-sm text-neutral-500">
                {info && timeFmt.format(new Date(info.start))}
              </span>
            </div>
          );
        })}
      </div>

      {amountDue > 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-warning-200 bg-warning-50 p-4">
          <p className="text-sm text-warning-800">下課請找小幫手付款</p>
          <p className="text-3xl font-bold text-warning-900">${formatMoney(amountDue)}</p>
          <p className="text-sm text-warning-800">現金或轉帳都可以</p>
        </div>
      )}

      {olderUnpaid.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm leading-relaxed text-warning-900">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            你有 {olderUnpaid.length > 1 ? `${olderUnpaid.length} 張` : "一張"}課卡還沒付款：
            {olderUnpaid.map((c) => (
              <span key={c.id} className="block font-semibold">
                {c.name} {formatCardSerial(c.serialNumber)}　${formatMoney(c.finalPrice)}
              </span>
            ))}
            請跟小幫手確認一下
          </div>
        </div>
      )}

      {runningLow && amountDue === 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
          <Info className="h-5 w-5 shrink-0 text-primary-700" />
          <p className="flex-1 text-sm">
            {runningLow.cardName}
            {runningLow.remainingSessions === 0 ? "已經用完了" : `只剩 ${runningLow.remainingSessions} 堂`}
            ，要先續卡嗎？
          </p>
          <Link href="/liff/buy" className="px-1 py-2 text-sm font-medium text-primary-900">
            續卡
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={handleClose}
        className="mt-auto rounded-xl border border-neutral-200 bg-white py-3.5 font-medium"
      >
        關閉
      </button>
    </div>
  );
}
