"use client";

import LiffStudentGate from "../LiffStudentGate";
import ComingSoon from "../ComingSoon";

// Opened from the student menu's「購買課卡」button. Placeholder for now — the
// real purchase / payment-reconciliation flow (Phase 3) lands later. Wrapped in
// LiffStudentGate so it still verifies identity.
export default function LiffBuyPage() {
  return (
    <LiffStudentGate>
      {(student) => <ComingSoon title="購買課卡" name={student.name} />}
    </LiffStudentGate>
  );
}
