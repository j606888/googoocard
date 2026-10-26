"use client";

import LiffStudentGate from "../LiffStudentGate";
import ScheduleCalendar from "@/features/liff/ScheduleCalendar";
import LiffHeader, { StudentLiffHeader } from "@/features/liff/LiffHeader";

// Rich menu「課表」. Anyone can look — a bound student sees their classroom and
// gets「我的課」; an unbound visitor sees the public classroom (and can switch
// between public ones).
export default function LiffSchedulePage() {
  return (
    <LiffStudentGate
      guest={(idToken) => (
        <ScheduleCalendar
          idToken={idToken}
          header={({ classroom, classrooms, pickClassroom }) => (
            <LiffHeader
              title="課表"
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
        <ScheduleCalendar
          idToken={auth.idToken}
          studentId={auth.studentId}
          header={() => (
            <StudentLiffHeader
              title="課表"
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
