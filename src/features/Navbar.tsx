import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { Skeleton } from "@/components/ui/skeleton";
import ClassroomSwitcher from "./nav/ClassroomSwitcher";
import TodoBell from "./TodoBell";

/**
 * `actions`: icon buttons for this page, shown left of the bell (the lessons
 * list puts its search there).
 */
const Navbar = ({ actions }: { actions?: React.ReactNode } = {}) => {
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
      {/* Same shape as ClassroomSwitcher: name (text-xl) + chevron. */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-6 w-32" />
        <div className="h-5 w-5" />
      </div>
      <TodoBell />
    </div>
  )

  return (
    <div className="lg:hidden w-full h-15 bg-white border-b border-neutral-200 flex items-center px-5 gap-3 sticky top-0 z-10">
      <ClassroomSwitcher />
      {actions ? (
        <div className="ml-auto flex items-center">
          {actions}
          <TodoBell className="" />
        </div>
      ) : (
        <TodoBell />
      )}
    </div>
  );
};

export default Navbar;
