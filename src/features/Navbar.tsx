import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import Sidebar from "./Sidebar";
import UnpaidBell from "./UnpaidBell";

const Navbar = () => {
  const { data } = useGetClassroomsQuery();

  const currentClassroom = data?.classrooms.find(
    (classroom) => classroom.id === data.currentClassroomId
  );

  return (
    <div className="w-full h-15 bg-primary-500 flex items-center px-5 gap-3 sticky top-0 z-10">
      <Sidebar />
      <span className="text-white text-xl font-bold">
        {currentClassroom?.name}
      </span>
      <UnpaidBell />
    </div>
  );
};

export default Navbar;
