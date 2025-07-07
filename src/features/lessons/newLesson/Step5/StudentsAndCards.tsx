import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Answer } from "@/store/slices/lessons";
import { Card, useGetCardsQuery } from "@/store/slices/cards";
import { Student, useGetStudentsQuery } from "@/store/slices/students";
import { useRouter } from "next/navigation";

const StudentsAndCards = () => {
  const { data: cards } = useGetCardsQuery();
  const { data: students } = useGetStudentsQuery();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const router = useRouter();

  useEffect(() => {
    const draft = JSON.parse(localStorage.getItem("lesson-draft") || "{}");
    setAnswers(draft.answers || []);
  }, []);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center border-b-1 border-gray-200 pb-2 mb-2">
        <h3 className="text-base font-bold">Students & Cards</h3>
        <div className="flex items-center gap-2 text-primary-700" onClick={() => router.push("/lessons/new/step-4")}>
          <Pencil className="w-5 h-5" />
          <span className="text-sm font-medium">Edit</span>
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-2">
        {answers.map((answer) => (
          <CardAnswer
            key={answer.studentId}
            card={cards?.activeCards.find(
              (card) => card.id === answer.selectedCardId
            )}
            student={students?.find((student) => student.id === answer.studentId)}
            answer={answer}
          />
        ))}
      </div>
    </div>
  );
};

const CardAnswer = ({
  card,
  student,
  answer,
}: {
  card: Card | undefined;
  student: Student | undefined;
  answer: Answer;
}) => {
  return (
    <div className="flex flex-col bg-primary-100 px-3 py-2 gap-2">
      <div className="flex gap-2">
        <h4 className="font-bold">{student?.name}</h4>
        <div
          className={`text-white px-2 py-1 rounded-full text-xs ${
            answer.createNewCard ? "bg-primary-500" : "bg-[#F4A15E]"
          }`}
        >
          {answer.createNewCard ? "Buy in" : "Card exist"}
        </div>
        <div className="ml-auto">
          {answer.createNewCard ? (
            <>
              {Number(answer.cardPrice) !== card?.price && (
                <span className="text-sm font-medium line-through text-gray-500 mr-1">
                  ${card?.price}
                </span>
              )}
              <span className="text-sm font-medium">${answer.cardPrice}</span>
            </>
          ) : (
            <span>-</span>
          )}
        </div>
      </div>
      {answer.createNewCard && (
        <div className="text-sm text-gray-500">
          <span>{card?.name}</span>
          {Number(answer.cardSessions) !== card?.sessions && ` - ${answer?.cardSessions} sessions left`}
        </div>
      )}
    </div>
  );
};

export default StudentsAndCards;
