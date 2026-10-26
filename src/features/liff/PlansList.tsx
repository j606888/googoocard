"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, QrCode } from "lucide-react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import LiffSkeleton from "@/features/liff/LiffSkeleton";
import ClassroomPicker from "@/features/liff/ClassroomPicker";
import { useLiffClassroomData, type ClassroomChoice } from "@/features/liff/useLiffClassroomData";
import { canBuyCard, type DanceLevels } from "@/domains/qualification";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import type { DanceStyleSummary } from "@/lib/danceStyles";
import { formatMoney } from "@/lib/money";
import { loadLiff } from "@/lib/liffClient";
import { cn } from "@/lib/utils";

type PlanCard = {
  id: number;
  name: string;
  price: number;
  sessions: number;
  isTrial: boolean;
  isPracticeCard: boolean;
  danceStyleId: number | null;
  danceStyle: (DanceStyleSummary & { sortOrder: number }) | null;
};

type PricesResponse = { classroom: ClassroomChoice; classrooms: ClassroomChoice[]; cards: PlanCard[] };

type Group = { key: string; title: string; note?: string; style?: DanceStyleSummary | null; cards: PlanCard[] };

/** 一般 → 各舞種複習卡（照教室的舞種順序）→ 體驗課。 */
function groupCards(cards: PlanCard[]): Group[] {
  const general = cards.filter((c) => !c.isTrial && !c.isPracticeCard);
  const trial = cards.filter((c) => c.isTrial);
  const practice = new Map<string, Group & { order: number }>();
  for (const c of cards.filter((c) => !c.isTrial && c.isPracticeCard)) {
    const key = `p${c.danceStyleId ?? 0}`;
    const group = practice.get(key) ?? {
      key,
      title: c.danceStyle ? `${c.danceStyle.name} 複習卡` : "複習卡",
      note: "上完這個舞種的課才能買",
      style: c.danceStyle,
      order: c.danceStyle?.sortOrder ?? 999,
      cards: [],
    };
    group.cards.push(c);
    practice.set(key, group);
  }
  return [
    ...(general.length ? [{ key: "general", title: "課卡", cards: general }] : []),
    ...[...practice.values()].sort((a, b) => a.order - b.order),
  ].concat(trial.length ? [{ key: "trial", title: "體驗課", note: "報名請洽老師；買過正式課卡的舊生免費。", cards: trial }] : []);
}

/** The student's cards still usable — for「你手上的卡」. */
export type HeldCard = { name: string; remainingSessions: number };

/**
 * LIFF「課卡方案」= 價目表＋購買。綁定的學生（`buyer`）每張可買的卡有「購買」，
 * 還沒資格的複習卡停用並寫原因；沒綁定的訪客只看價格，最上面告訴他怎麼登記。
 * 體驗課只列價格，報名由老師在課程頁登記。
 */
export default function PlansList({
  idToken,
  buyer,
  header,
}: {
  idToken: string;
  buyer?: { studentId: number; danceLevels: DanceLevels; held: HeldCard[] };
  header: (ctx: { classroom: ClassroomChoice | null; classrooms: ClassroomChoice[]; pickClassroom: (id: number) => void }) => ReactNode;
}) {
  const [classroomId, setClassroomId] = useState<number | undefined>();
  const [selected, setSelected] = useState<PlanCard | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [purchased, setPurchased] = useState<PlanCard | null>(null);
  const state = useLiffClassroomData<PricesResponse>("/api/liff/prices", {
    idToken,
    studentId: buyer?.studentId,
    classroomId,
  });
  const data = state.status === "ready" ? state.data : null;

  const confirm = async () => {
    if (!selected || !buyer) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/liff/student-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ studentId: buyer.studentId, cardId: selected.id }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setPurchased(selected);
      setSelected(null);
    } catch (err) {
      console.error("[liff] buy card error", err);
      toast.error("購買失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  if (purchased) return <Purchased card={purchased} />;

  return (
    <>
      {header({ classroom: data?.classroom ?? null, classrooms: data?.classrooms ?? [], pickClassroom: setClassroomId })}

      {state.status === "pick" && <ClassroomPicker classrooms={state.classrooms} onPick={setClassroomId} />}
      {state.status === "none" && <EmptyState kind="inline" title="目前還沒有公開的課卡方案。" />}
      {state.status === "error" && <p className="px-5 py-8 text-center text-sm text-neutral-500">載入失敗，請稍後再試。</p>}
      {state.status === "loading" && <LiffSkeleton />}

      {data && (
        <div className="flex flex-col gap-5 px-4 pb-8 pt-4">
          {buyer ? <HeldSummary held={buyer.held} /> : <GuestIntro />}

          {data.cards.length === 0 && <EmptyState kind="inline" title="目前沒有上架的課卡。" />}

          {groupCards(data.cards).map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold text-neutral-900">
                  {group.style && <span className={cn("size-2 rounded-full", danceStyleMeta(group.style).dot)} />}
                  {group.title}
                </h3>
                {group.note && <span className="text-right text-xs text-neutral-500">{group.note}</span>}
              </div>
              <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {group.cards.map((card) => {
                  const buyable = buyer && !card.isTrial && canBuyCard(card, buyer.danceLevels).allowed;
                  const locked = buyer && card.isPracticeCard && !buyable;
                  return (
                    <div key={card.id} className="flex items-center gap-3 p-3.5">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={cn("font-semibold", locked ? "text-neutral-500" : "text-neutral-900")}>{card.name}</span>
                        <span className="text-xs text-neutral-500">
                          {card.sessions} 堂
                          {locked && card.danceStyle && `・上完 ${card.danceStyle.name} 的課後可以買`}
                        </span>
                      </div>
                      <span className={cn("shrink-0 font-bold", locked ? "text-neutral-500" : "text-neutral-900")}>
                        ${formatMoney(card.price)}
                      </span>
                      {buyer && !card.isTrial && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!buyable}
                          onClick={() => setSelected(card)}
                          className="shrink-0"
                        >
                          購買
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {buyer && (
            <p className="text-xs leading-relaxed text-neutral-500">購買後可以先上課，下課再付款給老師（現金或轉帳）。</p>
          )}
        </div>
      )}

      <Drawer
        title="確認購買"
        open={selected !== null}
        onClose={() => setSelected(null)}
        onSubmit={confirm}
        submitText="確認購買"
        isLoading={submitting}
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <CardSummary card={selected} />
            <p className="rounded-2xl bg-warning-50 p-4 text-sm leading-relaxed text-warning-950">
              請直接轉帳或拿現金給老師，我們會再幫你把這張卡標記為已付款。卡片在確認付款前仍可正常使用。
            </p>
          </div>
        )}
      </Drawer>
    </>
  );
}

function HeldSummary({ held }: { held: HeldCard[] }) {
  const first = held[0];
  return (
    <Link
      href="/liff/cards"
      className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 active:bg-neutral-50"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-neutral-500">你手上的卡</span>
        <span className="truncate font-semibold text-neutral-900">
          {first ? `${first.name}・剩 ${first.remainingSessions} 堂` : "目前沒有可以用的卡"}
          {held.length > 1 && <span className="font-normal text-neutral-500">（還有 {held.length - 1} 張）</span>}
        </span>
      </div>
      {first && first.remainingSessions <= 2 && (
        <span className="shrink-0 rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-950">
          快用完了
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-neutral-500" aria-hidden />
    </Link>
  );
}

function GuestIntro() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-primary-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
          <QrCode className="size-5 text-primary-700" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-neutral-900">第一次來？</span>
          <span className="text-sm leading-relaxed text-neutral-700">
            到教室用手機相機掃門口的簽到 QR Code 就能登記，之後在這裡直接買卡。已經在上課的話，請老師給你綁定連結。
          </span>
        </div>
      </div>
      <Button asChild variant="secondary" size="sm" className="self-start">
        <Link href="/liff/schedule">
          <CalendarDays aria-hidden />
          看哪幾天有課
        </Link>
      </Button>
    </div>
  );
}

function CardSummary({ card }: { card: PlanCard }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">{card.name}</span>
        {card.isPracticeCard && card.danceStyle && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${danceStyleMeta(card.danceStyle).badge}`}>
            {card.danceStyle.name}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
        <span>{card.sessions} 堂</span>
        <span className="text-lg font-bold text-primary-900">${formatMoney(card.price)}</span>
      </div>
    </div>
  );
}

function Purchased({ card }: { card: PlanCard }) {
  // Close the LIFF window in LINE; window.close() for desktop/testing.
  const close = async () => {
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
  return (
    <div className="flex flex-col gap-5 px-5 py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-semibold">購買課卡成功</h2>
      </div>
      <CardSummary card={card} />
      <p className="rounded-2xl bg-warning-50 p-4 text-sm leading-relaxed text-warning-950">
        待老師確認付款後，此課卡也會標記為已付款。卡片在確認付款前仍可正常使用，現在去上課吧！
      </p>
      <Button size="lg" onClick={close} className="w-full">
        關閉視窗
      </Button>
    </div>
  );
}
