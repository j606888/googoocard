"use client";

import LiffStudentGate from "../LiffStudentGate";
import PlansList from "@/features/liff/PlansList";
import LiffHeader, { StudentLiffHeader } from "@/features/liff/LiffHeader";

// Rich menu「課卡方案」= 價目表＋購買. A bound student can buy; an unbound visitor
// sees the prices and how to register. /liff/buy (older links, 續卡提醒) renders this too.
export default function LiffPlansPage() {
  return (
    <LiffStudentGate
      guest={(idToken) => (
        <PlansList
          idToken={idToken}
          header={({ classroom, classrooms, pickClassroom }) => (
            <LiffHeader
              title="課卡方案"
              label={classroom?.name}
              options={classrooms.map((c) => ({ id: c.id, title: c.name }))}
              selectedId={classroom?.id}
              onPick={pickClassroom}
            />
          )}
        />
      )}
    >
      {(student, auth) => (
        <PlansList
          key={student.id}
          idToken={auth.idToken}
          buyer={{
            studentId: auth.studentId,
            danceLevels: student.danceLevels ?? {},
            held: student.studentCards
              .filter((c) => c.remainingSessions > 0 && !c.expiredAt && !c.card.isTrial)
              .map((c) => ({ name: c.card.name, remainingSessions: c.remainingSessions })),
          }}
          header={() => (
            <StudentLiffHeader
              title="課卡方案"
              student={student}
              boundStudents={auth.boundStudents}
              pickStudent={auth.pickStudent}
            />
          )}
        />
      )}
    </LiffStudentGate>
  );
}
