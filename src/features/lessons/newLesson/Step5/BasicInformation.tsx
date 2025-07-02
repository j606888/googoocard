import { useGetCardsQuery } from "@/store/slices/cards";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const BasicInformation = () => {
  const [lessonName, setLessonName] = useState<string>("");
  const { data: teachers } = useGetTeachersQuery();
  const { data: cards } = useGetCardsQuery();
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const router = useRouter();

  const selectedTeachers = useMemo(() => {
    return teachers?.filter((teacher) => selectedTeacherIds.includes(teacher.id));
  }, [teachers, selectedTeacherIds]);

  const selectedCards = useMemo(() => {
    return cards?.activeCards.filter((card) => selectedCardIds.includes(card.id));
  }, [cards, selectedCardIds]);

  useEffect(() => {
    const draft = JSON.parse(localStorage.getItem("lesson-draft") || "{}");
    setLessonName(draft.lessonName);
    setSelectedTeacherIds(draft.teacherIds);
    setSelectedCardIds(draft.cardIds);
  }, []);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center border-b-1 border-gray-200 pb-2 mb-2">
        <h3 className="text-base font-bold">Basic Information</h3>
        <div className="flex items-center gap-2 text-primary-700" onClick={() => router.push("/lessons/new/step-1")}>
          <Pencil className="w-5 h-5" />
          <span className="text-sm font-medium">Edit</span>
        </div>
      </div>
      <div className="mb-2">
        <p className="text-sm mb-1 text-gray-600">Lesson name:</p>
        <p>{lessonName}</p>
      </div>
      <div className="mb-2">
        <p className="text-sm mb-1 text-gray-600">Teachers:</p>
        <ul className="list-disc list-inside">
          {selectedTeachers?.map((teacher) => (
            <li key={teacher.id}>{teacher.name}</li>
          ))}
        </ul>
      </div>
      <div className="mb-2">
        <p className="text-sm mb-1 text-gray-600">Cards:</p>
        <ul className="list-disc list-inside">
          {selectedCards?.map((card) => (
            <li key={card.id}>{card.name} / {card.sessions} sessions / ${card.price}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BasicInformation;
