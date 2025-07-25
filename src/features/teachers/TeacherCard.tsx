import { EllipsisVertical, BookOpenText, Trash } from "lucide-react";
import Menu from "@/components/Menu";
import { useRef, useState } from "react";
import { useDeleteTeacherMutation } from "@/store/slices/teachers";
import { Teacher } from "@/store/slices/teachers";

const TeacherCard = ({
  teacher,
}: {
  teacher: Teacher
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [deleteTeacher] = useDeleteTeacherMutation();

  const handleDelete = async () => {
    await deleteTeacher({ id: teacher.id.toString() });
  };

  return (
    <div
      key={teacher.id}
      className="flex px-3 py-2 items-center border-b-1 border-gray-200"
    >
      <div className="flex flex-col mr-auto gap-1.5">
        <h4 className="text-xl font-semibold">{teacher.name}</h4>
        <div className="flex items-center gap-2">
          <BookOpenText className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">{teacher.activeLessonCount} active lessons</span>
        </div>
      </div>
      {teacher.lessonCount === 0 && (
        <button onClick={() => setMenuOpen(!menuOpen)} ref={buttonRef}>
          <EllipsisVertical
            className="w-6 h-6 text-gray-500"
        />
        </button>
      )}
      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        <button className='flex gap-2 items-center p-3 hover:bg-gray-100 rounded-sm' onClick={handleDelete}>
          <Trash className="w-4.5 h-4.5" />
          <span>Delete</span>
        </button>
      </Menu>
    </div>
  );
};

export default TeacherCard;
