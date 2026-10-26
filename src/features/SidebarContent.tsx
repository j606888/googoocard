"use client";

import { LogOut, ChevronsUpDown, Plus } from "lucide-react";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useGetClassroomsQuery,
  useSwitchClassroomMutation,
} from "@/store/slices/classrooms";
import { useLogoutMutation } from "@/store/slices/me";
import { disableWebPushOnLogout } from "@/hooks/useWebPush";
import Menu from "@/components/Menu";
import KiwiLogo from "@/components/KiwiLogo";
import { Skeleton } from "@/components/ui/skeleton";
import { PRIMARY_LINKS, SECONDARY_LINKS, type NavLink } from "./nav/navConfig";
import TodoBell from "./TodoBell";

interface SidebarContentProps {
  onClose?: () => void;
}

const SidebarContent = ({ onClose }: SidebarContentProps) => {
  const [switchClassroomOpen, setSwitchClassroomOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [switchClassroom] = useSwitchClassroomMutation();
  const pathname = usePathname();
  const router = useRouter();
  const [logout] = useLogoutMutation();
  const { data } = useGetClassroomsQuery();
  const otherClassrooms = data?.classrooms.filter(
    (classroom) => classroom.id !== data.currentClassroomId
  );
  const currentClassroom = data?.classrooms.find(
    (classroom) => classroom.id === data.currentClassroomId
  );

  const handleLogout = async () => {
    await disableWebPushOnLogout();
    await logout();
    router.push("/login");
  };

  const handleSwitchClassroom = async (classroomId: number) => {
    await switchClassroom({ id: classroomId.toString() });
    router.push("/lessons");
    onClose?.();
    setSwitchClassroomOpen(false);
  };

  const renderLink = (link: NavLink) => {
    const active = pathname.startsWith(link.href);
    return (
      <Link
        href={link.href}
        key={link.href}
        onClick={onClose}
        className={`flex h-11 items-center gap-3.5 rounded-xl px-3 transition-colors ${
          active
            ? "bg-primary-100 font-semibold text-primary-900"
            : "text-neutral-600 hover:bg-primary-50 hover:text-primary-900"
        }`}
      >
        <link.icon className={`h-5 w-5 ${active ? "text-primary-700" : ""}`} />
        <span className="flex-1">{link.name}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="flex h-11 items-center justify-between pl-1.5 pr-0.5">
        <div className="flex items-center gap-2 text-primary-900">
          <KiwiLogo className="h-5 w-[26px]" />
          <span className="text-[13px] font-bold tracking-[0.14em]">GOOGOOCARD</span>
        </div>
        <TodoBell className="shrink-0" />
      </div>
      <div ref={anchorRef} className="mt-3.5">
        <button
          aria-label="切換教室"
          aria-expanded={switchClassroomOpen}
          aria-busy={!data}
          disabled={!data}
          onClick={() => setSwitchClassroomOpen(!switchClassroomOpen)}
          className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl bg-primary-900 p-3 text-left text-white shadow-[0_10px_28px_-14px_rgba(27,94,74,0.8)] transition-colors hover:bg-[#17523F]"
        >
          <KiwiLogo className="pointer-events-none absolute right-[22px] -bottom-3.5 h-[50px] w-16 text-white/[0.08]" />
          <div className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-white/15 font-bold">
            {data ? (
              currentClassroom?.name.slice(0, 1)
            ) : (
              <Skeleton className="h-full w-full rounded-lg bg-white/15" />
            )}
          </div>
          {data ? (
            <span className="relative line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug">
              {currentClassroom?.name}
            </span>
          ) : (
            <span className="relative flex h-[22px] min-w-0 flex-1 items-center">
              <Skeleton className="h-4 w-28 bg-white/15" />
            </span>
          )}
          <ChevronsUpDown className="relative h-4 w-4 shrink-0 text-primary-300" />
        </button>
      </div>
      <Menu
        open={switchClassroomOpen && !!data}
        anchorEl={anchorRef.current}
        onClose={() => setSwitchClassroomOpen(false)}
        className="w-60 rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] z-50 flex flex-col"
      >
        {otherClassrooms && otherClassrooms.length > 0 ? (
          <>
            <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-neutral-500">
              切換教室
            </p>
            {otherClassrooms.map((classroom) => (
              <button
                key={classroom.id}
                onClick={() => handleSwitchClassroom(classroom.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-neutral-50"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary-900 text-sm font-bold text-white">
                  {classroom.name.slice(0, 1)}
                </div>
                <span className="font-medium text-neutral-900">
                  {classroom.name}
                </span>
              </button>
            ))}
          </>
        ) : (
          <p className="px-2 py-2 text-sm text-neutral-500">
            沒有其他教室
          </p>
        )}
        <Link
          href="/onboarding"
          onClick={() => setSwitchClassroomOpen(false)}
          className="mt-1 flex items-center gap-2 rounded-lg border-t border-neutral-200 px-2 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
        >
          <Plus className="h-4 w-4" />
          建立新教室
        </Link>
      </Menu>
      <nav className="mt-5 flex flex-col gap-0.5">
        {PRIMARY_LINKS.map(renderLink)}
        <div className="mx-3 my-3 h-px bg-neutral-200/70" />
        {SECONDARY_LINKS.map(renderLink)}
      </nav>
      <div className="flex flex-col items-start mt-auto">
        <button
          type="button"
          className="flex h-11 w-full cursor-pointer items-center gap-3.5 rounded-xl px-3 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          <span>登出</span>
        </button>
      </div>
    </>
  );
};

export default SidebarContent;
