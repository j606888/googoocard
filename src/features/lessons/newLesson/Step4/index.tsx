import { useGetStudentsQuery } from "@/store/slices/students";
import Questions from "./Questions";
import { Answer } from "@/store/slices/lessons";
import StudentList from "./StudentList";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/Button";
import { useRouter } from "next/navigation";
import { getLessonDraft, updateLessonDraft } from "@/lib/lessonDraftStorage";
import ProgressHeader from "@/components/ProgressHeader";

const Step4 = () => {
  const { data: students } = useGetStudentsQuery();
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const selectedStudents =
    students?.filter((student) => selectedStudentIds.includes(student.id)) ||
    [];
  const [currentStudentId, setCurrentStudentId] = useState<number | null>(null);
  const currentStudent = selectedStudents.find(
    (student) => student.id === currentStudentId
  );
  const [answers, setAnswers] = useState<Answer[]>([]);
  const router = useRouter();

  const handleSubmit = useCallback(() => {
    const lessonDraft = JSON.parse(
      localStorage.getItem("lesson-draft") || "{}"
    );
    localStorage.setItem(
      "lesson-draft",
      JSON.stringify({
        ...lessonDraft,
        answers,
      })
    );
    router.push("/lessons/new/step-5");
  }, [router, answers]);

  const handleSubmitAnswer = useCallback(
    (answer: Answer) => {
      const studentId = answer.studentId;
      const existingAnswer = answers.find((a) => a.studentId === studentId);
      const newAnswers = existingAnswer
        ? answers.map((a) => (a.studentId === studentId ? answer : a))
        : [...answers, answer];
      setAnswers(newAnswers);
      updateLessonDraft({ answers: newAnswers });
      const nextStudentId =
        selectedStudentIds[selectedStudentIds.indexOf(studentId) + 1];
      setCurrentStudentId(nextStudentId);
    },
    [answers, selectedStudentIds]
  );

  const handleStudentClick = useCallback((studentId: number) => {
    setCurrentStudentId(studentId);
  }, []);

  useEffect(() => {
    const draft = getLessonDraft();
    setSelectedStudentIds(draft?.studentIds || []);
    setAnswers(draft?.answers || []);
    setCurrentStudentId(draft?.answers?.[0]?.studentId || draft?.studentIds[0] || null);
  }, []);

  return (
    <>
      <ProgressHeader currentStep={4} />
      <div className="px-5 py-1 pb-16 flex flex-col">
        <StudentList
          students={selectedStudents}
          answers={answers}
          currentStudentId={currentStudentId}
          onClick={handleStudentClick}
        />
        {currentStudent && (
          <Questions
            key={currentStudentId}
            student={currentStudent}
            firstStudent={selectedStudentIds.indexOf(currentStudent.id) === 0}
            defaultAnswers={
              answers.find((a) => a.studentId === currentStudent.id) ||
              undefined
            }
            onSubmit={handleSubmitAnswer}
            onBack={() => {
              if (selectedStudentIds.indexOf(currentStudent.id) > 0) {
                setCurrentStudentId(
                  selectedStudentIds[
                    selectedStudentIds.indexOf(currentStudent.id) - 1
                  ]
                );
              }
            }}
          />
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white flex gap-4 px-5 py-4">
        <Button outline onClick={() => router.push("/lessons/new/step-3")}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={answers.length !== selectedStudents.length}>
          Next
        </Button>
      </div>
    </>
  );
};

export default Step4;
