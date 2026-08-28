"use client";

import { useState } from "react";
import { CircleDollarSign, DollarSign, List } from "lucide-react";
import Navbar from "@/features/Navbar";
import Drawer from "@/components/Drawer";
import IncomeCalendar from "@/features/income/IncomeCalendar";
import RecordsTab from "@/features/income/RecordsTab";
import UnpaidTab from "@/features/income/UnpaidTab";
import { useGetUnpaidStudentCardsQuery } from "@/store/slices/students";

const IncomePage = () => {
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const { data: unpaidCards } = useGetUnpaidStudentCardsQuery();
  const unpaidCount = unpaidCards?.length ?? 0;

  return (
    <>
      <Navbar />
      <div className="px-5 py-3 lg:px-8 lg:py-6">
        <div className="flex items-center gap-2 mb-3 lg:mb-6">
          <DollarSign className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-semibold">收入</h2>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setRecordsOpen(true)}
              className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center cursor-pointer hover:bg-neutral-200 transition-colors"
              aria-label="課卡紀錄"
              title="課卡紀錄"
            >
              <List className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setUnpaidOpen(true)}
              className="relative w-10 h-10 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center cursor-pointer hover:bg-neutral-200 transition-colors"
              aria-label="未付款"
              title="未付款"
            >
              <CircleDollarSign className="w-[18px] h-[18px]" />
              {unpaidCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
                  {unpaidCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <IncomeCalendar />
      </div>

      <Drawer
        open={recordsOpen}
        onClose={() => setRecordsOpen(false)}
        onSubmit={() => setRecordsOpen(false)}
        title="課卡紀錄"
        submitText="關閉"
      >
        <RecordsTab />
      </Drawer>

      <Drawer
        open={unpaidOpen}
        onClose={() => setUnpaidOpen(false)}
        onSubmit={() => setUnpaidOpen(false)}
        title="未付款"
        submitText="關閉"
      >
        <UnpaidTab />
      </Drawer>
    </>
  );
};

export default IncomePage;
