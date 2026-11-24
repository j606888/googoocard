"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, Banknote, Check, ChevronLeft, Clock, CreditCard, Info, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import KiwiMascot from "@/components/KiwiMascot";
import { cn } from "@/lib/utils";
import MyLessons from "@/features/liff/MyLessons";
import LiffSkeleton from "@/features/liff/LiffSkeleton";
import { StudentWithDetail } from "@/store/slices/students";
import { LiffAuthContext } from "@/app/liff/LiffStudentGate";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatMoney } from "@/lib/money";
import { isMockLiff, loadLiff } from "@/lib/liffClient";
import { lineOaChatUrl } from "@/lib/lineOa";
import LocationBadge from "@/components/LocationBadge";
import AddFriendPrompt from "@/features/liff/AddFriendPrompt";
import NoClassToday from "@/features/liff/NoClassToday";
import {
  CheckinResponse,
  TodayLesson,
  TodayResponse,
  dateFmt,
  groupSelectedByLesson,
  timeFmt,
} from "@/features/checkin/types";

// What pays for one lesson: one of the student's cards, one bought now, a drop-in,
// or「下課問老師」(no card yet — the teacher settles it after class).
type Payment =
  | { studentCardId: number }
  | { buyCardId: number }
  | { dropIn: true; dropInOption?: string }
  | { later: true };

/** Longest note for the teacher (STUDENT_NOTE_MAX on the server). */
const NOTE_MAX = 200;

type Done = {
  lessons: TodayLesson[];
  responses: { lessonId: number; response: CheckinResponse }[];
  /** Lessons paid「下課問老師」, and the note sent with them. */
  later: Set<number>;
  note: string;
};

const ERROR_MESSAGE: Record<string, string> = {
  card_required: "課卡堂數不夠這次報到，請少選幾堂或找小幫手",
  card_not_usable: "這張卡不能用在這堂課，請重新選擇",
  card_not_offered: "這張卡不能用在這堂課，請重新選擇",
  not_qualified: "還沒有這張複習卡的資格，請找小幫手",
  card_exhausted: "課卡剛好被用掉了，請重新整理再試一次",
  period_closed: "這堂已經點完名或不在今天，請找小幫手",
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
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 同步的防連點：setSubmitting 要等下一次 render 才生效，連點兩下會送兩次。
  const submittingRef = useRef(false);
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
  // 選的時段全都在整期裡的課不用付；其他沒卡的課才要選怎麼付。
  const lessonsToBuy = selectedLessons.filter(
    (l) => !coveredByTerm(l, selected) && (l.cardStatus?.usable.length ?? 0) === 0
  );
  // 好幾堂選同一種卡、而且剛買的那張還夠扣時只買一張（跟 submit 的做法一致）。
  const amountToPay = (() => {
    const remainingOf = new Map<number, number>();
    return lessonsToBuy.reduce((sum, l) => {
      const periods = l.periods.filter((p) => selected.has(p.periodId)).length;
      const option = dropInChoice(l, buyChoice[l.lessonId]);
      if (option) return sum + option.price * periods;
      const card = l.cardStatus?.buyable.find((c) => c.cardId === buyChoice[l.lessonId]);
      if (!card) return sum;
      const left = remainingOf.get(card.cardId) ?? 0;
      if (left >= periods) {
        remainingOf.set(card.cardId, left - periods);
        return sum;
      }
      remainingOf.set(card.cardId, card.sessions - periods);
      return sum + card.price;
    }, 0);
  })();

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
    if (!status || coveredByTerm(lesson, selected)) return null;
    if (status.usable.length > 0) {
      const id = cardChoice[lesson.lessonId] ?? status.autoPickId ?? status.usable[0].studentCardId;
      return { studentCardId: id };
    }
    const buy = buyChoice[lesson.lessonId];
    if (buy === LATER) return { later: true };
    const option = dropInChoice(lesson, buy);
    if (option) return { dropIn: true, dropInOption: option.name || undefined };
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
        if (next[l.lessonId]) return;
        if (l.cardStatus?.buyable[0]) next[l.lessonId] = l.cardStatus.buyable[0].cardId;
        else if (l.cardStatus?.dropInPrice != null) next[l.lessonId] = DROP_IN;
        else next[l.lessonId] = LATER;
      });
      return next;
    });
    setStep("buy");
  };

  const submit = async () => {
    if (!data || selected.size === 0 || submittingRef.current) return;
    const byLesson = groupSelectedByLesson(data.today, selected);

    submittingRef.current = true;
    setSubmitting(true);
    const responses: Done["responses"] = [];
    const later = new Set<number>();
    const trimmedNote = note.trim().slice(0, NOTE_MAX);
    // 這次報到已經買下的卡（cardId → 學生課卡 id＋剩幾堂）：後面的課選同一種卡、
    // 而且還夠扣，就直接用它，不再買第二張（單堂卡用完了才再買）。
    const boughtNow = new Map<number, { studentCardId: number; remaining: number }>();
    try {
      for (const [lessonId, periodIds] of byLesson) {
        const lesson = data.today.find((l) => l.lessonId === lessonId)!;
        let payment = paymentFor(lesson);
        const bought = payment && "buyCardId" in payment ? boughtNow.get(payment.buyCardId) : undefined;
        if (bought && bought.remaining >= periodIds.length) {
          payment = { studentCardId: bought.studentCardId };
        }
        // 備註只跟著這一步要選付款方式的課走（「想報整期，下課找老師」）。
        const withNote = trimmedNote && lessonsToBuy.some((l) => l.lessonId === lessonId);
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
            ...payment,
            ...(withNote ? { note: trimmedNote } : {}),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `status ${res.status}`);
        }
        const response: CheckinResponse = await res.json();
        if (payment && "buyCardId" in payment && response.purchased) {
          const left = response.results
            .filter((r) => r.status === "checked")
            .map((r) => r.remainingSessions ?? 0);
          boughtNow.set(payment.buyCardId, {
            studentCardId: response.purchased.id,
            remaining: left.length ? Math.min(...left) : 0,
          });
        }
        if (payment && "later" in payment) later.add(lessonId);
        responses.push({ lessonId, response });
      }
      setDone({ lessons: data.today, responses, later, note: trimmedNote });
    } catch (err) {
      console.error("[liff] checkin error", err);
      const code = err instanceof Error ? err.message : "";
      toast.error(ERROR_MESSAGE[code] ?? "報到失敗，請稍後再試");
      // Some lessons may already be recorded — show them rather than lose them.
      if (responses.length > 0) setDone({ lessons: data.today, responses, later, note: trimmedNote });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <p className="px-5 py-8 text-center text-sm text-neutral-500">載入失敗，請稍後再試。</p>
    );
  }
  if (!data) {
    return <LiffSkeleton rows={2} />;
  }

  if (done) {
    return <CheckinDone student={student} done={done} />;
  }

  // ----- No class today: what's next instead -----
  if (data.today.length === 0) {
    return <NoClassToday data={data} />;
  }

  // ----- How to pay for lessons with no usable card (設計稿「這堂怎麼付？」) -----
  if (step === "buy") {
    return (
      <div className="pb-44">
        <div className="px-5 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep("periods")}
            className="-ml-3 gap-1 px-3 text-sm text-neutral-600"
          >
            <ChevronLeft className="h-4 w-4" />
            重選課程
          </Button>
        </div>
        <div className="flex items-center gap-3 px-5 pb-2 pt-2">
          <KiwiMascot pose="card" className="w-14 shrink-0" />
          <p className="text-[15px] leading-relaxed text-neutral-600">
            {lessonsToBuy.length > 1 ? "這幾堂" : "這堂"}你沒有能用的課卡。選一個，下課再找老師付錢。
          </p>
        </div>

        {lessonsToBuy.map((lesson) => {
          const status = lesson.cardStatus!;
          const name = `pay-${lesson.lessonId}`;
          const choose = (value: number) => setBuyChoice((prev) => ({ ...prev, [lesson.lessonId]: value }));
          return (
            <fieldset key={lesson.lessonId} className="pt-4">
              <legend className="px-5 pb-1.5">
                <span className="block text-lg font-bold">{lesson.lessonName} 怎麼付？</span>
                {lesson.location && <span className="block text-[13px] text-neutral-600">{lesson.location.name}</span>}
              </legend>
              <div className="divide-y divide-neutral-100">
                {status.buyable.map((card) => (
                  <ChoiceRow
                    key={card.cardId}
                    name={name}
                    checked={buyChoice[lesson.lessonId] === card.cardId}
                    onSelect={() => choose(card.cardId)}
                    title={`買 ${card.name}`}
                    detail={
                      card.sessions > status.sessionsPerAttendance
                        ? `今天扣 ${status.sessionsPerAttendance} 堂，剩 ${card.sessions - status.sessionsPerAttendance} 堂`
                        : `${card.sessions} 堂`
                    }
                    price={card.price}
                  />
                ))}
                {(status.dropInOptions ?? []).map((option, index) => {
                  // 一個方案一個選項：「單人 $200」「雙人合報 $150」。只有一個沒名字的就是「單堂」。
                  const value = DROP_IN - index;
                  return (
                    <ChoiceRow
                      key={value}
                      name={name}
                      checked={buyChoice[lesson.lessonId] === value}
                      onSelect={() => choose(value)}
                      title={option.name || "單堂"}
                      detail={option.note ?? (option.name ? "單堂，不扣課卡" : "只付這一堂")}
                      price={option.price}
                    />
                  );
                })}
                <ChoiceRow
                  name={name}
                  checked={buyChoice[lesson.lessonId] === LATER}
                  onSelect={() => choose(LATER)}
                  title="還不確定，下課問老師"
                  detail="先簽到，老師幫你決定買卡、單堂或整期"
                />
              </div>
            </fieldset>
          );
        })}

        <div className="flex flex-col gap-2 px-5 pt-6">
          <label htmlFor="liff-checkin-note" className="text-sm font-medium">
            想跟老師說的 <span className="font-normal text-neutral-600">（選填）</span>
          </label>
          <textarea
            id="liff-checkin-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：想報整期，下課找老師付現"
            className="w-full resize-none rounded-xl bg-white px-3.5 py-3 text-base leading-normal shadow-[inset_0_0_0_1px_var(--color-neutral-300)] outline-none placeholder:text-neutral-400 focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary-700)]"
          />
          <p className="flex gap-2 pt-1 text-sm leading-relaxed text-neutral-600">
            <Banknote className="mt-0.5 h-4 w-4 shrink-0" />
            現在不用付錢，下課再找老師付現金或轉帳。
          </p>
        </div>

        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col gap-2 bg-white px-5 pb-6 pt-3.5 shadow-[0_-6px_16px_rgba(27,94,74,0.06)]">
          {amountToPay > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">下課要付</span>
              <span className="text-base font-bold">${formatMoney(amountToPay)}</span>
            </div>
          )}
          <Button
            size="lg"
            disabled={lessonsToBuy.some((l) => !buyChoice[l.lessonId])}
            isLoading={submitting}
            onClick={submit}
            className="w-full"
          >
            {submitting ? "簽到中…" : "簽到"}
          </Button>
        </div>
      </div>
    );
  }

  // ----- 我的課 + pick today's lessons, each saying what it will use (設計稿「簽到首頁」) -----
  const selectedPeriodCount = selected.size;
  const cardSessionsUsed = selectedLessons.reduce((sum, l) => {
    if (coveredByTerm(l, selected) || (l.cardStatus?.usable.length ?? 0) === 0) return sum;
    const periods = l.periods.filter((p) => selected.has(p.periodId) && p.termIndex === undefined).length;
    return sum + periods * (l.cardStatus?.sessionsPerAttendance ?? 1);
  }, 0);

  return (
    <div className="pb-36">
      <MyLessons terms={data.myTerms ?? []} cards={data.myCards ?? []} />
      {((data.myTerms?.length ?? 0) > 0 || (data.myCards?.length ?? 0) > 0) && (
        <div aria-hidden className="mt-2.5 h-2 bg-neutral-100" />
      )}

      <h2 className="px-5 pb-1 pt-5 text-lg font-bold">今天要上哪幾堂？</h2>
      <p className="px-5 pb-2 text-[13px] text-neutral-600">{dateFmt.format(new Date())}</p>
      <div className="flex flex-col">
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

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col gap-2.5 bg-white px-5 pb-6 pt-3.5 shadow-[0_-6px_16px_rgba(27,94,74,0.06)]">
        {selectedPeriodCount > 0 && (
          <p className="text-center text-sm text-neutral-600">
            已選 {selectedPeriodCount} 堂
            {cardSessionsUsed > 0 && ` · 扣課卡 ${cardSessionsUsed} 堂`}
          </p>
        )}
        <Button
          size="lg"
          disabled={selected.size === 0}
          isLoading={submitting}
          onClick={goNext}
          className="w-full"
        >
          {submitting ? "簽到中…" : lessonsToBuy.length > 0 ? "下一步：選怎麼付" : "簽到"}
        </Button>
      </div>
    </div>
  );
}

/**
 * buyChoice 裡代表「單堂付費」的值（真正的卡 id 都是正數）：第 i 個單堂方案 = DROP_IN - i，
 * 所以 -1 是第一個（預設）方案、-2 是第二個…（最多 4 個方案）
 */
const DROP_IN = -1;
/** buyChoice 裡代表「下課問老師」的值。 */
const LATER = -100;

/** buyChoice 的值 → 選到的單堂方案；不是單堂（買卡、下課問老師、還沒選）回 null。 */
function dropInChoice(lesson: TodayLesson, choice: number | undefined) {
  if (choice === undefined || choice > DROP_IN || choice === LATER) return null;
  return lesson.cardStatus?.dropInOptions?.[DROP_IN - choice] ?? null;
}

// Every lesson can be checked into now —「下課問老師」covers having no way to pay.
// Kept as a function so the preselect logic reads the same.
function canPay(lesson: TodayLesson) {
  return Boolean(lesson.cardStatus) || lesson.periods.some((p) => p.termIndex !== undefined);
}

/** 這門課選的時段全都在學生報的整期裡（不用付卡）。 */
function coveredByTerm(lesson: TodayLesson, selected: Set<number>) {
  const picked = lesson.periods.filter((p) => selected.has(p.periodId));
  return picked.length > 0 && picked.every((p) => p.termIndex !== undefined);
}

/** A square check (multi-select): filled green with a white tick, or an empty grey frame. */
function CheckMark({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px]",
        checked
          ? disabled
            ? "bg-neutral-300"
            : "bg-primary-700"
          : "shadow-[inset_0_0_0_2px_var(--color-neutral-400)]"
      )}
    >
      {checked && <Check className="size-4 text-white" strokeWidth={3} />}
    </span>
  );
}

/** A round radio (pick one): thick green ring when chosen, thin grey ring otherwise. */
function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-6 shrink-0 rounded-full bg-white",
        checked
          ? "shadow-[inset_0_0_0_7px_var(--color-primary-700)]"
          : "shadow-[inset_0_0_0_2px_var(--color-neutral-400)]"
      )}
    />
  );
}

/** One option of「怎麼付」: a whole-row radio, tinted when chosen. */
function ChoiceRow({
  name,
  checked,
  onSelect,
  title,
  detail,
  price,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  price?: number;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[68px] cursor-pointer items-center gap-3.5 px-5 py-3.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-primary-700",
        checked && "bg-primary-50"
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <RadioMark checked={checked} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-base", checked ? "font-bold" : "font-medium")}>{title}</span>
        <span className="text-[13px] text-neutral-600">{detail}</span>
      </span>
      {price !== undefined && (
        <span className="text-base font-bold tabular-nums">{price === 0 ? "免費" : `$${formatMoney(price)}`}</span>
      )}
    </label>
  );
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
  const usable = status?.usable ?? [];
  const spa = status?.sessionsPerAttendance ?? 1;
  const currentCard = usable.find(
    (c) => c.studentCardId === (chosenCardId ?? status?.autoPickId ?? usable[0]?.studentCardId)
  );
  const meta = danceStyleMeta(lesson.danceStyle);
  const isSelected = lesson.periods.some((p) => selected.has(p.periodId));
  // 選了幾個要付卡的時段（整期涵蓋的不算）：「扣 X 堂，剩 Y 堂」照這個算。
  const pickedPaid = lesson.periods.filter((p) => selected.has(p.periodId) && p.termIndex === undefined).length;

  /** What checking into this period will use — the line under each row. */
  const usageLine = (period: TodayLesson["periods"][number]) => {
    if (period.alreadyChecked) return { text: "已簽到", tone: "muted" as const };
    if (period.termIndex !== undefined && lesson.term) {
      return { text: `整期第 ${period.termIndex} / ${lesson.term.sessions} 堂，不扣課卡`, tone: "ok" as const };
    }
    if (currentCard) {
      const count = Math.max(pickedPaid, 1) * spa;
      const left = currentCard.remainingSessions - count;
      return {
        text: `扣 ${currentCard.name} ${count} 堂，剩 ${Math.max(left, 0)} 堂`,
        tone: left < 0 ? ("warn" as const) : ("ok" as const),
      };
    }
    return { text: "沒有能用的課卡，勾選後選怎麼付", tone: "warn" as const };
  };

  return (
    <div className="flex flex-col">
      {lesson.periods.map((period) => {
        const checked = selected.has(period.periodId);
        const disabled = period.alreadyChecked;
        const usage = usageLine(period);
        return (
          <label
            key={period.periodId}
            className={cn(
              "flex items-start gap-3.5 px-5 py-3.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-primary-700",
              disabled ? "cursor-default" : "cursor-pointer",
              checked && "bg-primary-50"
            )}
          >
            <input
              type="checkbox"
              checked={disabled || checked}
              disabled={disabled}
              onChange={() => onToggle(period.periodId)}
              className="sr-only"
            />
            <CheckMark checked={disabled || checked} disabled={disabled} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={cn("text-[17px] font-bold", disabled && "text-neutral-500")}>
                {timeFmt.format(new Date(period.startTime))} {lesson.lessonName}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full" style={meta.fill} />
                  {meta.label}
                </span>
                <span>到 {timeFmt.format(new Date(period.endTime))}</span>
                <LocationBadge location={lesson.location} />
              </span>
              <span
                className={cn(
                  "pt-0.5 text-sm",
                  usage.tone === "ok" && "text-primary-900",
                  usage.tone === "warn" && "text-warning-800",
                  usage.tone === "muted" && "text-neutral-500"
                )}
              >
                {usage.text}
              </span>
            </span>
            {disabled && <StatusTag tone="neutral">已簽到</StatusTag>}
          </label>
        );
      })}

      {spa > 1 && (
        <p className="flex items-center gap-2 px-5 pb-2 text-sm text-warning-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          這堂課每次扣 {spa} 堂
        </p>
      )}

      {isSelected && usable.length > 1 && pickedPaid > 0 && (
        <fieldset className="pb-2">
          <legend className="px-5 pb-1 pt-2 text-[13px] font-medium text-neutral-600">
            你有 {usable.length} 張卡能用在這堂，選一張：
          </legend>
          <div className="divide-y divide-neutral-100">
            {usable.map((card) => {
              const checked = currentCard?.studentCardId === card.studentCardId;
              return (
                <label
                  key={card.studentCardId}
                  className="flex min-h-14 cursor-pointer items-center gap-3.5 py-2.5 pl-[58px] pr-5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-primary-700"
                >
                  <input
                    type="radio"
                    name={`card-${lesson.lessonId}`}
                    checked={checked}
                    onChange={() => onChooseCard(card.studentCardId)}
                    className="sr-only"
                  />
                  <RadioMark checked={checked} />
                  <span className={cn("flex-1", checked && "font-bold")}>
                    {card.name}{" "}
                    <span className="text-xs font-normal text-neutral-600">{formatCardSerial(card.serialNumber)}</span>
                  </span>
                  <span className="text-sm text-neutral-600">剩 {card.remainingSessions} 堂</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

// ----- Completion (設計稿「簽到完成」) -----
function CheckinDone({ student, done }: { student: StudentWithDetail; done: Done }) {
  const periodInfo = new Map<number, { lessonId: number; lessonName: string; start: string }>();
  done.lessons.forEach((l) =>
    l.periods.forEach((p) =>
      periodInfo.set(p.periodId, { lessonId: l.lessonId, lessonName: l.lessonName, start: p.startTime })
    )
  );
  const results = done.responses.flatMap((r) => r.response.results);
  const checkedCount = results.filter((r) => r.status !== "already_checked").length;
  const amountDue = done.responses.reduce((sum, r) => sum + r.response.amountDue, 0);
  const justBought = new Set(done.responses.map((r) => r.response.purchased?.id).filter(Boolean));
  // The latest response has the most up-to-date unpaid list.
  const unpaid = done.responses[done.responses.length - 1]?.response.unpaidCards ?? [];
  const olderUnpaid = unpaid.filter((c) => !justBought.has(c.id));
  const runningLow = results.find(
    (r) => r.status === "checked" && typeof r.remainingSessions === "number" && r.remainingSessions <= 1
  );
  const askLater = [...new Set(
    results
      .filter((r) => r.status === "no_card")
      .map((r) => periodInfo.get(r.periodId))
      .filter((info): info is NonNullable<typeof info> => Boolean(info && done.later.has(info.lessonId)))
      .map((info) => info.lessonName)
  )];

  const chatUrl = lineOaChatUrl();

  const handleClose = async () => {
    try {
      const liff = await loadLiff();
      if (liff.isInClient()) {
        liff.closeWindow();
        return;
      }
    } catch (err) {
      console.error("[liff] close window error", err);
    }
    window.close();
  };

  const resultLine = (r: (typeof results)[number], lessonId: number | undefined) => {
    switch (r.status) {
      case "already_checked":
        return { detail: "先前已簽到", tag: null };
      case "checked":
        return {
          detail: `${r.cardName}${typeof r.remainingSessions === "number" ? ` · 剩 ${r.remainingSessions} 堂` : ""}`,
          tag: { text: "已扣卡", tone: "ok" as const },
        };
      case "drop_in":
        return {
          detail: `${r.dropInOptionName ?? "單堂"} $${formatMoney(r.dropInAmount ?? 0)} · 下課付`,
          tag: { text: "單堂", tone: "ok" as const },
        };
      case "enrolled":
        return { detail: `整期 · 第 ${r.termIndex} / ${r.termSessions} 堂`, tag: { text: "不扣卡", tone: "ok" as const } };
      default:
        return lessonId !== undefined && done.later.has(lessonId)
          ? {
              detail: done.note ? `「${done.note}」` : "下課問老師怎麼付",
              tag: { text: "待老師處理", tone: "warn" as const },
            }
          : { detail: "沒有綁到課卡，請找老師", tag: { text: "待老師處理", tone: "warn" as const } };
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-white pb-7">
      <div className="flex flex-col items-center gap-2 px-5 pb-6 pt-10 text-center">
        <KiwiMascot pose="dance" className="mb-2 w-[120px]" />
        <h2 className="text-[22px] font-bold">
          {checkedCount > 0 ? `簽到好了，${student.name}` : "先前已簽到"}
        </h2>
        <p className="text-[15px] text-neutral-600">
          {checkedCount > 1 ? `已簽到 ${checkedCount} 堂 · ` : ""}老師點名時會看到你
        </p>
      </div>

      <ul className="divide-y divide-neutral-100">
        {results.map((r) => {
          const info = periodInfo.get(r.periodId);
          const line = resultLine(r, info?.lessonId);
          return (
            <li key={r.periodId} className="flex items-baseline gap-3 px-5 py-3.5">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-bold">
                  {info && `${timeFmt.format(new Date(info.start))} `}
                  {info?.lessonName ?? "課程"}
                </span>
                <span className="text-[13px] text-neutral-600">{line.detail}</span>
              </span>
              {line.tag && (
                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap text-sm",
                    line.tag.tone === "ok" ? "text-primary-900" : "text-warning-800"
                  )}
                >
                  {line.tag.text}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 px-5 pt-5">
        {askLater.length > 0 && (
          <div className="flex gap-2.5 rounded-2xl bg-warning-100 px-4 py-3.5">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning-900" aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold text-warning-950">下課記得找老師</span>
              <span className="text-sm text-warning-900">{askLater.join("、")} 怎麼付還沒決定</span>
            </span>
          </div>
        )}

        {amountDue > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl bg-warning-100 px-4 py-3.5 text-warning-950">
            <p className="text-sm">下課請找老師付款</p>
            <p className="text-3xl font-bold tabular-nums">${formatMoney(amountDue)}</p>
            <p className="text-sm text-warning-900">現金或轉帳都可以</p>
          </div>
        )}

        {olderUnpaid.length > 0 && (
          <div className="flex gap-2.5 text-sm leading-relaxed text-warning-900">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              你有 {olderUnpaid.length > 1 ? `${olderUnpaid.length} 張` : "一張"}課卡還沒付款：
              {olderUnpaid.map((c) => (
                <span key={c.id} className="block font-semibold">
                  {c.name} {formatCardSerial(c.serialNumber)}　${formatMoney(c.finalPrice)}
                </span>
              ))}
              請跟老師確認一下
            </div>
          </div>
        )}

        {runningLow && amountDue === 0 && (
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 shrink-0 text-primary-700" aria-hidden />
            <p className="flex-1 text-sm">
              {runningLow.cardName}
              {runningLow.remainingSessions === 0 ? "已經用完了" : `只剩 ${runningLow.remainingSessions} 堂`}
              ，要先續卡嗎？
            </p>
            <Button asChild variant="link" className="px-1 py-2 text-sm text-primary-900">
              <Link href="/liff/plans">續卡</Link>
            </Button>
          </div>
        )}

        <AddFriendPrompt />
      </div>

      <div className="mt-auto px-5 pt-6">
        {chatUrl ? (
          // 「關閉」從相機掃 QR 進來時沒有地方可回；改成直接開聊天室（看課卡、選單都在那）。
          <a
            href={chatUrl}
            target={isMockLiff() ? "_blank" : undefined}
            rel="noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] text-base font-bold text-white active:brightness-95"
          >
            <MessageCircle className="size-5" aria-hidden />
            回到 LINE 聊天室
          </a>
        ) : (
          <Button type="button" variant="secondary" size="lg" onClick={handleClose} className="w-full">
            關閉
          </Button>
        )}
      </div>
    </div>
  );
}
