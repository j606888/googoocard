"use client";

import LiffStudentGate from "../LiffStudentGate";
import CheckinList from "@/features/liff/CheckinList";

// Opened from the student menu's「上課簽到」button, or by scanning the studio's
// wall QR (`?key=<Classroom.checkinKey>`). Shows today's lessons with what the
// student can pay with, and every check-in is bound to a card (chosen, or bought
// on the spot). Identity is resolved by LiffStudentGate; via the wall QR an
// unbound LINE account can register itself as a newcomer.
export default function LiffCheckinPage() {
  return (
    <LiffStudentGate acceptCheckinKey>
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
