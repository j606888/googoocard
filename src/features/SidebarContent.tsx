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
import { useGetStudentsQuery } from "@/store/slices/students";
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
  const { data: renewalStudents } = useGetStudentsQuery({ needsRenewal: true });
  const renewalCount = renewalStudents?.length ?? 0;

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
        {link.href === "/students" && renewalCount > 0 && (
          <span className="rounded-full bg-warning-200 px-2 text-xs font-semibold leading-5 text-[#8A4510]">
            {renewalCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <div className="flex h-10 items-center justify-between pl-1.5 pr-0.5">
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
          className="relative flex w-full cursor-pointer flex-col gap-3.5 overflow-hidden rounded-[18px] bg-primary-900 p-3.5 text-left text-white shadow-[0_10px_28px_-14px_rgba(27,94,74,0.8)] transition-colors hover:bg-[#17523F]"
        >
          <KiwiLogo className="pointer-events-none absolute -right-1 -bottom-[18px] h-[94px] w-[120px] text-white/10" />
          <div className="flex items-center justify-between">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white/15 font-bold">
              {data ? (
                currentClassroom?.name.slice(0, 1)
              ) : (
                <Skeleton className="h-full w-full rounded-[10px] bg-white/15" />
              )}
            </div>
            <span className="flex items-center gap-1 rounded-full bg-white/10 py-1 pl-2.5 pr-2 text-xs font-medium text-primary-100">
              切換
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="relative flex flex-col gap-0.5">
            {data ? (
              <>
                <span className="line-clamp-2 text-[17px] font-semibold leading-snug">
                  {currentClassroom?.name}
                </span>
                <span className="text-xs text-primary-300">
                  {currentClassroom?.role === "owner" ? "擁有者" : "助教"}
                </span>
              </>
            ) : (
              <>
                {/* Same line heights as the name (17px snug) and role (xs). */}
                <span className="flex h-[23px] items-center">
                  <Skeleton className="h-[17px] w-28 bg-white/15" />
                </span>
                <span className="flex h-4 items-center">
                  <Skeleton className="h-3 w-10 bg-white/15" />
                </span>
              </>
            )}
          </div>
        </button>
      </div>
      <Menu
        open={switchClassroomOpen && !!data}
        anchorEl={anchorRef.current}
        onClose={() => setSwitchClassroomOpen(false)}
        className="w-60 rounded-2xl border border-black/5 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] z-50 flex flex-col"
      >
        {otherClassrooms && otherClassrooms.length > 0 ? (
          <>
            <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-neutral-400">
              切換教室
            </p>
            {otherClassrooms.map((classroom) => (
              <button
                key={classroom.id}
                onClick={() => handleSwitchClassroom(classroom.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-neutral-50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-sm font-bold text-white">
                  {classroom.name.slice(0, 1)}
                </div>
                <span className="font-medium text-neutral-800">
                  {classroom.name}
                </span>
              </button>
            ))}
          </>
        ) : (
          <p className="px-2 py-2 text-sm text-neutral-400">
            沒有其他教室
          </p>
        )}
        <Link
          href="/onboarding"
          onClick={() => setSwitchClassroomOpen(false)}
          className="mt-1 flex items-center gap-2 rounded-xl border-t border-neutral-100 px-2 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
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
      <div className="flex flex-col items-start rounded-sm mt-auto">
        <div
          className="flex gap-4 items-center hover:bg-neutral-100 w-full rounded-sm p-3 cursor-pointer"
          onClick={handleLogout}
        >
          <LogOut className="w-6 h-6" />
          <span>登出</span>
        </div>
      </div>
    </>
  );
};

export default SidebarContent;
