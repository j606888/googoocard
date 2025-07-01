import { Lesson } from "@/store/slices/lessons";
import { SquarePen } from "lucide-react";

const SettingSection = ({ lesson }: { lesson: Lesson }) => {
  return (
    <div className="flex flex-col gap-4 px-5 relative">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Lesson name</div>
        <p>{lesson.name}</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Teachers</div>
        <div className="flex gap-2">
          {lesson.teachers.map((teacher) => (
            <div
              key={teacher.id}
              className="px-3 py-2 rounded-md bg-primary-300"
            >
              {teacher.name}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">Cards</div>
        <div className="flex gap-2">
          {lesson.cards.map((card) => (
            <div key={card.id} className="px-3 py-2 rounded-md bg-primary-300">
              {card.name}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 absolute top-0 right-5">
        <SquarePen className="w-5 h-5" />
      </div>
    </div>
  );
};

export default SettingSection;
