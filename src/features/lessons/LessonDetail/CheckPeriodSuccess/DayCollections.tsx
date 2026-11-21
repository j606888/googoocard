"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatCardSerial } from "@/lib/cardSerial";
import { toTaipeiDateKey } from "@/lib/taipei-date";
import { useGetDayCollectionsQuery } from "@/store/slices/students";
import { useGetMeQuery } from "@/store/slices/me";
import ConfirmPaymentDrawer, {
  ConfirmPaymentTarget,
} from "@/features/students/ConfirmPaymentDrawer";
import { Button } from "@/components/ui/button";

const METHOD_LABEL = { CASH: "現金", TRANSFER: "轉帳" } as const;

/**
 * 下課對帳（設計稿 C3）：這天誰收了多少（收款人跟手上的現金對一下），以及今天
 * 來上課、還欠款的學生——下課逐一收，收完就從清單消失。
 */
const DayCollections = ({ date }: { date: string }) => {
  const { data } = useGetDayCollectionsQuery({ date });
  const { data: me } = useGetMeQuery();
  const [paying, setPaying] = useState<ConfirmPaymentTarget | null>(null);

  if (!data || (data.collected.length === 0 && data.unpaid.length === 0)) return null;

  const isToday = date === toTaipeiDateKey(new Date());
  const myCash = data.collected.find(
    (c) => c.receiverUserId === me?.id && c.paymentMethod === "CASH"
  );

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-200 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Banknote className="h-5 w-5 shrink-0 self-center text-primary-700" />
          {isToday ? "今天實際收到的錢" : `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} 收到的錢`}
        </h3>
        {data.collected.length > 0 && (
          <span className="text-xl font-bold tabular-nums text-primary-900">
            ${formatMoney(data.collectedTotal)}
          </span>
        )}
      </div>
      {/* 兩個數字並排卻不一樣，沒講清楚的話每次都會被問。 */}
      <p className="rounded-xl bg-neutral-50 px-3 py-2 text-xs leading-[17px] text-neutral-700">
        「這堂收入」是出席的人各扣一堂的價值；這裡是整間教室{isToday ? "今天" : "這一天"}
        買卡、付單堂實際收到的錢{data.collectedCount > 0 ? `（共 ${data.collectedCount} 筆）` : ""}。
      </p>

      {myCash && (
        <div className="rounded-xl bg-neutral-50 px-4 py-3">
          <p className="text-xs text-neutral-600">你{isToday ? "今天" : "這一天"}收到現金</p>
          <p className="text-2xl font-bold">${formatMoney(myCash.total)}</p>
          <p className="text-xs text-neutral-500">共 {myCash.count} 筆 · 跟手上的錢對一下</p>
        </div>
      )}

      {data.collected.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {data.collected.map((c) => (
            <li
              key={`${c.receiverUserId}-${c.paymentMethod}`}
              className="flex justify-between py-2 text-sm"
            >
              <span>
                {c.receiverName ?? "未記錄收款人"} ·{" "}
                {c.paymentMethod ? METHOD_LABEL[c.paymentMethod] : "未記錄方式"}
                <span className="text-neutral-500">（{c.count} 筆）</span>
              </span>
              <span className="font-semibold">${formatMoney(c.total)}</span>
            </li>
          ))}
        </ul>
      )}

      {data.unpaid.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-warning-900">還沒付款 · {data.unpaid.length} 筆</p>
          <ul className="divide-y divide-neutral-100">
            {data.unpaid.map((u) => (
              <li key={u.studentCardId} className="flex items-center gap-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.student.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.student.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {u.cardName} {formatCardSerial(u.serialNumber)}
                    {u.usedSessions > 0 ? ` · 已用 ${u.usedSessions} 堂` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold">${formatMoney(u.finalPrice)}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPaying({
                      studentId: u.student.id,
                      studentCardId: u.studentCardId,
                      studentName: u.student.name,
                      cardName: u.cardName,
                      serialNumber: u.serialNumber,
                      finalPrice: u.finalPrice,
                    })
                  }
                >
                  收款
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmPaymentDrawer target={paying} onClose={() => setPaying(null)} />
    </section>
  );
};

export default DayCollections;
