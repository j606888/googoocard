import Link from "next/link";
import { CreditCard } from "lucide-react";
import type { MyCardSummary, MyTermSummary } from "@/features/checkin/types";
import { formatCardSerial } from "@/lib/cardSerial";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * 「我的課」at the top of the LIFF check-in page (設計稿「簽到首頁」): the student's
 * unfinished 整期 with a progress bar, then their cards (usable or unpaid). Plain rows
 * on white with hairline dividers — read-only info, so no boxes and no controls.
 * Renders nothing when there's neither.
 */
export default function MyLessons({ terms, cards }: { terms: MyTermSummary[]; cards: MyCardSummary[] }) {
  if (terms.length === 0 && cards.length === 0) return null;
  return (
    <section aria-labelledby="my-lessons">
      <h2 id="my-lessons" className="px-5 pb-1 pt-5 text-[13px] font-medium text-neutral-600">
        我的課
      </h2>
      <ul className="divide-y divide-neutral-100">
        {terms.map((term) => (
          <li key={`t${term.lessonId}`}>
            <TermRow term={term} />
          </li>
        ))}
        {cards.map((card) => (
          <li key={`c${card.id}`}>
            <CardRow card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TermRow({ term }: { term: MyTermSummary }) {
  const meta = danceStyleMeta(term.danceStyle);
  // 下一堂（還沒點名的第一堂）= 這次要上的那一堂。
  const firstUpcoming = term.statuses.findIndex((s) => s === "upcoming");
  const next = firstUpcoming === -1 ? term.statuses.length : firstUpcoming;
  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="size-2 shrink-0 self-center rounded-full" style={meta.fill} />
        <span className="min-w-0 flex-1 truncate text-base font-bold">{term.lessonName}</span>
        <span className="shrink-0 text-sm text-neutral-600">
          整期 · 第 {Math.min(next + 1, term.sessions)} / {term.sessions} 堂
        </span>
      </div>
      <div
        className="grid gap-[3px] pl-4"
        style={{ gridTemplateColumns: `repeat(${term.sessions}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {/* 還沒排出來的堂數也畫格子（statuses 只到已排的時段）。 */}
        {Array.from({ length: term.sessions }, (_, index) => term.statuses[index] ?? "upcoming").map((status, index) => (
          <span
            key={index}
            className={cn(
              "h-1 rounded-full",
              status === "present" && "bg-primary-700",
              status === "leave" && "bg-warning-400",
              status === "absent" && "bg-neutral-400",
              status === "upcoming" && (index === next ? "bg-primary-400" : "bg-neutral-200")
            )}
          />
        ))}
      </div>
    </div>
  );
}

function CardRow({ card }: { card: MyCardSummary }) {
  return (
    <Link href="/liff/cards" className="flex items-baseline gap-2 px-5 py-3.5 active:bg-primary-50">
      <CreditCard aria-hidden className="size-4 shrink-0 self-center text-primary-700" />
      <span className="min-w-0 flex-1 truncate text-base font-bold">
        {card.name}{" "}
        <span className="text-[13px] font-normal text-neutral-600">{formatCardSerial(card.serialNumber)}</span>
      </span>
      <span className="shrink-0 text-sm text-neutral-600">
        {card.unpaidAmount !== null && (
          <span className="text-warning-800">未付 ${formatMoney(card.unpaidAmount)} · </span>
        )}
        剩 <b className="text-base text-neutral-900">{card.remainingSessions}</b> 堂
      </span>
    </Link>
  );
}
