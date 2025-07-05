import { useState } from "react";
import { Bell } from "lucide-react";
import { useUnpaidStudentCardsQuery } from "@/store/slices/cards";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Sidebar from "./Sidebar";
import { useRouter } from "next/navigation";

const Navbar = () => {
  const { data } = useGetClassroomsQuery();
  const { data: unpaidStudentCards } = useUnpaidStudentCardsQuery();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const currentClassroom = data?.classrooms.find(
    (classroom) => classroom.id === data.currentClassroomId
  );

  const handleStudentCardClick = (studentId: number) => {
    router.push(`/students/${studentId}?tab=cards`);
  };

  return (
    <div className="w-full h-15 bg-primary-500 flex items-center px-5 gap-3">
      <Sidebar />
      <span className="text-white text-xl font-bold">
        {currentClassroom?.name}
      </span>
      {unpaidStudentCards && unpaidStudentCards.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="ml-auto">
            <div className="mr-1 flex items-center gap-2 ml-auto relative">
              <Bell className="w-6 h-6 text-white" />
              <span className="absolute -right-1 -top-1 bg-red-500 text-white text-xs font-medium rounded-full w-4 h-4 flex items-center justify-center">
                {unpaidStudentCards.length}
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="mr-3 mt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-medium w-full text-center mb-4  pb-2">
                Unpaid Cards
              </h4>
            </div>
            <div className="flex flex-col gap-2">
              {unpaidStudentCards.map((studentCard) => (
                <div
                  key={studentCard.id}
                  className="flex justify-between pt-2 border-t border-gray-200"
                  onClick={() => handleStudentCardClick(studentCard.student.id)}
                >
                  <div className="text-sm font-medium">
                    {studentCard.student.name}
                  </div>
                  <span className="text-sm text-gray-500">
                    {studentCard.card.name}
                  </span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default Navbar;
