"use client";

import { useState } from "react";
import Navbar from "@/features/Navbar";
import Drawer from "@/components/Drawer";
import IncomeCalendar from "@/features/income/IncomeCalendar";
import UnpaidTab from "@/features/income/UnpaidTab";
import { useGetUnpaidStudentCardsQuery } from "@/store/slices/students";

const IncomePage = () => {
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const { data: unpaidCards } = useGetUnpaidStudentCardsQuery();
  const unpaidCount = unpaidCards?.length ?? 0;

  return (
    <>
      <Navbar />
      <div className="px-5 py-3 lg:px-8 lg:py-6 w-full max-w-[1240px] mx-auto">
        <IncomeCalendar unpaidCount={unpaidCount} onOpenUnpaid={() => setUnpaidOpen(true)} />
      </div>

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
