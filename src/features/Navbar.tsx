import { useEffect } from "react";
import { RiseLoader } from "react-spinners";
import { useRouter } from "next/navigation";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import ClassroomSwitcher from "./nav/ClassroomSwitcher";
import UnpaidBell from "./UnpaidBell";

const Navbar = () => {
  const { data, isLoading, error } = useGetClassroomsQuery();
  const router = useRouter();

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

  // Mobile only. On desktop the sidebar carries the classroom switcher and the
  // bell, so the bar would be an empty strip — but the component stays mounted
  // there for the login / onboarding redirect above.
  if (isLoading) return (
    <div className="lg:hidden w-full h-15 bg-white border-b border-neutral-200 flex items-center px-5 gap-3 sticky top-0 z-10">
      <RiseLoader color="#2b8e6e" size={8} />
    </div>
  )

  return (
    <div className="lg:hidden w-full h-15 bg-white border-b border-neutral-200 flex items-center px-5 gap-3 sticky top-0 z-10">
      <ClassroomSwitcher />
      <UnpaidBell />
    </div>
  );
};

export default Navbar;
