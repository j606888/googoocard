"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import FinanceTabs from "./FinanceTabs";

/** 水庫每一頁的外框：頁面標題、子分頁、「示意資料」提示。 */
export default function FinanceShell({ children }: { children: ReactNode }) {
  const { data } = useGetClassroomsQuery();
  const classroom = data?.classrooms.find((c) => c.id === data.currentClassroomId);

  return (
    <div className="flex w-full max-w-[1280px] flex-col gap-5 px-4 py-4 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-neutral-900">水庫</h1>
        <p className="text-sm text-neutral-500">
          {classroom ? `${classroom.name}的` : ""}收支、資金與月結
        </p>
      </div>

      <FinanceTabs />

      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl bg-primary-50 px-4 py-3 text-sm leading-relaxed text-primary-900"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-bold">示意資料</strong>
          ：這裡的數字都是假的，之後接上點名與課卡資料才會是真的。按下去的動作也不會真的存下來。
        </p>
      </div>

      {children}
    </div>
  );
}
