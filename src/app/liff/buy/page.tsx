"use client";

import LiffStudentGate from "../LiffStudentGate";
import BuyCardList from "@/features/liff/BuyCardList";

// Opened from the student menu's「購買課卡」button. Lists the classroom's
// purchasable cards (hiding unqualified practice cards) and lets the student
// self-purchase; identity is resolved by LiffStudentGate.
export default function LiffBuyPage() {
  return (
    <LiffStudentGate>
      {(student, auth) => (
        <>
          <div className="relative flex h-16 w-full items-center justify-center bg-primary-500">
            <h2 className="text-lg font-semibold text-white">購買課卡</h2>
          </div>
          <BuyCardList student={student} auth={auth} />
        </>
      )}
    </LiffStudentGate>
  );
}
