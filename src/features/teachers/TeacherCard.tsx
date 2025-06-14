import { EllipsisVertical, BookOpenText, Pencil, Trash } from "lucide-react";
import Menu from "@/components/Menu";
import { useRef, useState } from "react";

const TeacherCard = ({
  teacher,
}: {
  teacher: { id: string; name: string };
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      key={teacher.id}
      className="flex border-1 border-gray-200 rounded-sm px-3 py-2 items-center"
    >
      <div className="flex flex-col mr-auto gap-1.5">
        <h4 className="text-xl font-semibold">{teacher.name}</h4>
        <div className="flex items-center gap-2">
          <BookOpenText className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">0 Lessons</span>
        </div>
      </div>
      <button onClick={() => setMenuOpen(true)} ref={buttonRef}>
        <EllipsisVertical
          className="w-6 h-6 text-gray-500"
      />
      </button>
      <Menu
        open={menuOpen}
        anchorEl={buttonRef.current}
        onClose={() => setMenuOpen(false)}
      >
        <button className='flex gap-3 items-center p-3 hover:bg-gray-100 rounded-sm'>
          <Pencil className="w-5 h-5" />
          <span>Edit</span>
        </button>
        <button className='flex gap-3 items-center p-3 hover:bg-gray-100 rounded-sm'>
          <Trash className="w-5 h-5" />
          <span>Delete</span>
        </button>
      </Menu>
    </div>
  );
};

export default TeacherCard;
