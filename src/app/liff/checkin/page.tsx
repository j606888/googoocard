"use client";

import LiffStudentGate from "../LiffStudentGate";
import CheckinList from "@/features/liff/CheckinList";

// Opened from the student menu's「上課簽到」button. Shows today's lessons and lets
// the student self check-in (single or multiple periods), then nudges toward
// 購買課卡 when a card is missing or used up. Identity is resolved by
// LiffStudentGate (unbound → blocked, only the caller's own student).
export default function LiffCheckinPage() {
  return (
    <LiffStudentGate>
      {(student, auth) => (
        <>
          <div className="relative flex h-16 w-full items-center justify-center bg-primary-500">
            <h2 className="text-lg font-semibold text-white">上課簽到</h2>
          </div>
          <CheckinList student={student} auth={auth} />
        </>
      )}
    </LiffStudentGate>
  );
}
