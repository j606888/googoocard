import ProgressBall from "@/components/ProgressBall";
import { useGetStudentsQuery } from "@/store/slices/students";
import Questions, { Answer } from "./Questions";
import StudentList from "./StudentList";
import { useCallback, useState } from "react";
import Button from "@/components/Button";
import { useRouter } from "next/navigation";

const Step4 = () => {
  const { data: students } = useGetStudentsQuery();
  const selectedStudents = students?.slice(0, 5) || [];
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const currentStudent = selectedStudents[currentStudentIndex];
  const [answers, setAnswers] = useState<Answer[]>([]);
  const router = useRouter();

  const handleSubmit = useCallback(() => {
    router.push("/lessons/new/step-5");
  }, [router]);

  const handleSubmitAnswer = useCallback((answer: Answer) => {
    const studentId = answer.studentId;
    const existingAnswer = answers.find((a) => a.studentId === studentId);
    if (existingAnswer) {
      setAnswers(answers.map((a) => (a.studentId === studentId ? answer : a)));
    } else {
      setAnswers([...answers, answer]);
    }
    setCurrentStudentIndex(currentStudentIndex + 1);
  }, [answers, currentStudentIndex]);

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-center">Class cards</h2>
      <ProgressBall currentStep={4} />
      <div>
        <StudentList students={selectedStudents} answers={answers} />
        {currentStudent && (
          <Questions
            key={currentStudentIndex}
            student={currentStudent}
            onSubmit={handleSubmitAnswer}
            onBack={() => {
              if (currentStudentIndex > 0) {
                setCurrentStudentIndex(currentStudentIndex - 1);
              }
            }}
          />
        )}
      </div>
      {answers.length === selectedStudents.length && (
        <div className="bg-white flex gap-4 px-5 py-4">
        <Button outline onClick={() => router.back()}>
          Back
          </Button>
          <Button onClick={handleSubmit}>Next</Button>
        </div>
      )}
    </div>
  );
};

export default Step4;
