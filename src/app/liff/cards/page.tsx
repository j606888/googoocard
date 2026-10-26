"use client";

import StudentDetail from "@/features/students/StudentDetail";
import LiffStudentGate from "../LiffStudentGate";
import { StudentLiffHeader } from "@/features/liff/LiffHeader";

// Opened from the「我的課卡」card in the chat. Identity is resolved by
// LiffStudentGate; here we just render the student's cards/attendance via the
// same StudentDetail UI as the public share page.
export default function LiffCardsPage() {
  return (
    <LiffStudentGate>
      {(student, auth) => (
        <>
          <StudentLiffHeader
            title="我的課卡"
            student={student}
            boundStudents={auth.boundStudents}
            pickStudent={auth.pickStudent}
          />
          <StudentDetail student={student} isPublic />
        </>
      )}
    </LiffStudentGate>
  );
}
