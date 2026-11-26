"use client";

import { useState } from "react";
import Navbar from "@/features/Navbar";
import Drawer from "@/components/Drawer";
import IncomeCalendar from "@/features/income/IncomeCalendar";
import UnpaidTab from "@/features/income/UnpaidTab";
import { useGetUnpaidStudentCardsQuery } from "@/store/slices/students";

const IncomePage = () => {
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const { data: unpaidCards, isLoading: unpaidLoading } = useGetUnpaidStudentCardsQuery();
  const unpaidCount = unpaidCards?.length ?? 0;
  const unpaidTotal = unpaidCards?.reduce((sum, card) => sum + card.finalPrice, 0) ?? 0;

  return (
    <>
      <Navbar />
      <div className="flex w-full flex-col px-5 pt-3 pb-10 lg:max-w-[1180px] lg:px-12 lg:pt-9">
        <IncomeCalendar
          unpaidCount={unpaidCount}
          unpaidTotal={unpaidTotal}
          unpaidLoading={unpaidLoading}
          onOpenUnpaid={() => setUnpaidOpen(true)}
        />
      </div>

      <Drawer
        open={unpaidOpen}
        onClose={() => setUnpaidOpen(false)}
        onSubmit={() => setUnpaidOpen(false)}
        title="未付款課卡"
        submitText="關閉"
      >
        <UnpaidTab />
      </Drawer>
    </>
  );
};

export default IncomePage;
