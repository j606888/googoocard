"use client";

import LiffStudentGate from "../LiffStudentGate";
import CheckinList from "@/features/liff/CheckinList";
import UnboundCheckin from "@/features/liff/UnboundCheckin";
import { StudentLiffHeader } from "@/features/liff/LiffHeader";

// Opened from the rich menu's「上課簽到」, or by scanning the studio's wall QR
// (`?key=<Classroom.checkinKey>`). Shows today's lessons with what the student can
// pay with, and every check-in is bound to a card (chosen, or bought on the spot).
// Identity is resolved by LiffStudentGate: via the wall QR an unbound LINE account
// can register itself as a newcomer; from the menu it gets UnboundCheckin (scan the
// door QR right here, or ask for a bind link).
export default function LiffCheckinPage() {
  return (
    <LiffStudentGate acceptCheckinKey guest={(idToken) => <UnboundCheckin idToken={idToken} />}>
      {(student, auth) => (
        <>
          <StudentLiffHeader
            title="上課簽到"
            student={student}
            boundStudents={auth.boundStudents}
            pickStudent={auth.pickStudent}
          />
          <CheckinList key={student.id} student={student} auth={auth} />
        </>
      )}
    </LiffStudentGate>
  );
}
