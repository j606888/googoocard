"use client";

import {
  BookOpenText,
  CreditCard,
  GraduationCap,
  Users,
  Boxes,
  DollarSign,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useGetClassroomsQuery,
  useSwitchClassroomMutation,
} from "@/store/slices/classrooms";
import { useLogoutMutation } from "@/store/slices/me";
import { useGetStudentsQuery } from "@/store/slices/students";

export const LINKS = [
  { name: "Lessons", icon: BookOpenText, href: "/lessons" },
  { name: "Cards", icon: CreditCard, href: "/cards" },
  { name: "Teachers", icon: GraduationCap, href: "/teachers" },
  { name: "Students", icon: Users, href: "/students" },
  { name: "Teams", icon: Boxes, href: "/teams" },
  { name: "Income", icon: DollarSign, href: "/income" },
];

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
      <div className="flex flex-col gap-2 mt-3">
        {LINKS.map((link) => (
          <Link
            href={link.href}
            key={link.name}
            onClick={onClose}
            className={`flex gap-4 items-center p-3 hover:bg-gray-100 rounded-sm ${
              pathname === link.href
                ? "bg-primary-100 text-primary-900 font-semibold"
                : "text-gray-700"
            }`}
          >
            <link.icon className="w-6 h-6" />
            <span>{link.name}</span>
            {link.name === "Students" && renewalCount > 0 && (
              <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {renewalCount}
              </span>
            )}
          </Link>
        ))}
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
