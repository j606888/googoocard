import { useEffect } from "react";
import { RiseLoader } from "react-spinners";
import { useRouter } from "next/navigation";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import Sidebar from "./Sidebar";
import UnpaidBell from "./UnpaidBell";

const Navbar = () => {
  const { data, isLoading, error } = useGetClassroomsQuery();
  const router = useRouter();

  const currentClassroom = data?.classrooms.find(
    (classroom) => classroom.id === data.currentClassroomId
  );

  useEffect(() => {
    if (isLoading) return;
    
    if (error) {
      router.push("/login");
      return
    }
    if (!data?.currentClassroomId) {
      router.push("/onboarding");
    }
  }, [isLoading, data?.currentClassroomId, error]);

  if (isLoading) return (
    <div className="w-full h-15 bg-primary-500 flex items-center px-5 gap-3 sticky top-0 z-10">
      <span className="text-white text-xl font-bold">
        <RiseLoader color="#fff" size={8} />
      </span>
    </div>
  )

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
