"use client";

import StudentDetail from "@/features/students/StudentDetail";
import LiffStudentGate from "../LiffStudentGate";

// Opened from the student menu's「瀏覽我的課卡」button. Identity is resolved by
// LiffStudentGate; here we just render the student's cards/attendance via the
// same StudentDetail UI as the public share page.
export default function LiffCardsPage() {
  return (
    <LiffStudentGate>
      {(student) => (
        <>
          <div className="relative flex h-16 w-full items-center justify-center bg-primary-500">
            <h2 className="text-lg font-semibold text-white">
              {student.classroom.name} - {student.name}
            </h2>
          </div>
          <StudentDetail student={student} isPublic />
        </>
      )}
    </LiffStudentGate>
  );
}
