"use client";

import { LogOut, ChevronDown, Plus } from "lucide-react";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useGetClassroomsQuery,
  useSwitchClassroomMutation,
} from "@/store/slices/classrooms";
import { useLogoutMutation } from "@/store/slices/me";
import { useGetStudentsQuery } from "@/store/slices/students";
import Menu from "@/components/Menu";
import { LINKS } from "./nav/navConfig";

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
    await logout();
    router.push("/login");
  };

  const handleSwitchClassroom = async (classroomId: number) => {
    await switchClassroom({ id: classroomId.toString() });
    router.push("/lessons");
    onClose?.();
    setSwitchClassroomOpen(false);
  };

  if (!data) return null;

  return (
    <>
      <div
        ref={anchorRef}
        className="flex gap-3 items-center pb-4 border-b border-neutral-200"
      >
        <div className="w-9 h-9 shrink-0 font-bold flex items-center justify-center bg-primary-500 rounded-lg text-white">
          {currentClassroom?.name.slice(0, 1)}
        </div>
        <h2 className="min-w-0 flex-1 truncate text-base font-medium">
          {currentClassroom?.name}
        </h2>
        <button
          className="shrink-0 cursor-pointer"
          onClick={() => setSwitchClassroomOpen(!switchClassroomOpen)}
        >
          <ChevronDown
            className={`w-5 h-5 text-neutral-500 transition-transform ${
              switchClassroomOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
      <Menu
        open={switchClassroomOpen}
        anchorEl={anchorRef.current}
        onClose={() => setSwitchClassroomOpen(false)}
        className="w-60 rounded-2xl border border-black/5 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)] z-50 flex flex-col"
      >
        {otherClassrooms && otherClassrooms.length > 0 ? (
          <>
            <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-neutral-400">
              Switch classroom
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
            No other classrooms
          </p>
        )}
        <Link
          href="/onboarding"
          onClick={() => setSwitchClassroomOpen(false)}
          className="mt-1 flex items-center gap-2 rounded-xl border-t border-neutral-100 px-2 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
        >
          <Plus className="h-4 w-4" />
          Create another classroom
        </Link>
      </Menu>
      <div className="flex flex-col gap-1.5 mt-3">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              href={link.href}
              key={link.name}
              onClick={onClose}
              className={`group relative flex gap-4 items-center rounded-xl p-3 transition-colors ${
                active
                  ? "bg-primary-500 text-white font-semibold shadow-[0_6px_18px_-6px_rgba(43,142,110,0.7)]"
                  : "text-neutral-600 hover:bg-primary-50 hover:text-primary-900"
              }`}
            >
              <link.icon className="w-6 h-6" />
              <span>{link.name}</span>
              {link.name === "Students" && renewalCount > 0 && (
                <span
                  className={`ml-auto min-w-5 h-5 px-1 rounded-full text-xs font-semibold flex items-center justify-center ${
                    active
                      ? "bg-white text-primary-700"
                      : "bg-danger-500 text-white"
                  }`}
                >
                  {renewalCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col items-start rounded-sm mt-auto">
        <div
          className="flex gap-4 items-center hover:bg-neutral-100 w-full rounded-sm p-3 cursor-pointer"
          onClick={handleLogout}
        >
          <LogOut className="w-6 h-6" />
          <span>Logout</span>
        </div>
        <div className="text-neutral-700 p-3">
          <span>@GOOGOOCARD</span>
        </div>
      </div>
    </>
  );
};

export default SidebarContent;
