"use client";

import LiffStudentGate from "../LiffStudentGate";
import ComingSoon from "../ComingSoon";

// Opened from the student menu's「上課簽到」button. Placeholder for now — the
// real self-checkin flow lands later. Wrapped in LiffStudentGate so it still
// verifies identity (unbound → blocked, only the caller's own student).
export default function LiffCheckinPage() {
  return (
    <LiffStudentGate>
      {(student) => <ComingSoon title="上課簽到" name={student.name} />}
    </LiffStudentGate>
  );
}
