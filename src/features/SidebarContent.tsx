"use client";

import { LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useGetClassroomsQuery,
  useSwitchClassroomMutation,
} from "@/store/slices/classrooms";
import { useLogoutMutation } from "@/store/slices/me";
import { useGetStudentsQuery } from "@/store/slices/students";
import { LINKS } from "./nav/navConfig";

interface SidebarContentProps {
  onClose?: () => void;
}

const SidebarContent = ({ onClose }: SidebarContentProps) => {
  const [switchClassroomOpen, setSwitchClassroomOpen] = useState(false);
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
      <div className="flex gap-4 items-center pb-4 border-b border-gray-200">
        <div className="w-9 h-9 font-bold flex items-center justify-center bg-primary-500 rounded-lg text-white">
          {currentClassroom?.name.slice(0, 1)}
        </div>
        <h2 className="text-xl font-semibold">{currentClassroom?.name}</h2>
        <button
          className="ml-auto cursor-pointer"
          onClick={() => setSwitchClassroomOpen(!switchClassroomOpen)}
        >
          <ChevronDown
            className={`w-6 h-6 transition-transform ${
              switchClassroomOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
      {switchClassroomOpen && (
        <div className="flex flex-col gap-2 mb-2 py-3 px-2 border-b border-gray-200">
          <p className="text-xs text-[#999999] font-medium">
            Switch to other classroom
          </p>
          <div className="flex flex-col gap-2">
            {otherClassrooms?.map((classroom) => (
              <div
                key={classroom.id}
                className="flex gap-3 items-center py-2 cursor-pointer"
                onClick={() => handleSwitchClassroom(classroom.id)}
              >
                <div className="w-8 h-8 font-bold text-sm flex items-center justify-center bg-primary-500 rounded-sm text-white">
                  {classroom.name.slice(0, 1)}
                </div>
                <h2 className="text-lg font-semibold">{classroom.name}</h2>
              </div>
            ))}
          </div>
          <Link
            href="/onboarding"
            className="text-[#444444] font-medium text-sm underline"
          >
            <span>Create another classroom</span>
          </Link>
        </div>
      )}
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
                  : "text-gray-600 hover:bg-primary-50 hover:text-primary-900"
              }`}
            >
              <link.icon className="w-6 h-6" />
              <span>{link.name}</span>
              {link.name === "Students" && renewalCount > 0 && (
                <span
                  className={`ml-auto min-w-5 h-5 px-1 rounded-full text-xs font-semibold flex items-center justify-center ${
                    active
                      ? "bg-white text-primary-700"
                      : "bg-red-500 text-white"
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
          className="flex gap-4 items-center hover:bg-gray-100 w-full rounded-sm p-3 cursor-pointer"
          onClick={handleLogout}
        >
          <LogOut className="w-6 h-6" />
          <span>Logout</span>
        </div>
        <div className="text-gray-700 p-3">
          <span>@GOOGOOCARD</span>
        </div>
      </div>
    </>
  );
};

export default SidebarContent;
