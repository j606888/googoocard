"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
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

const LINKS = [
  {
    name: "Lessons",
    icon: BookOpenText,
    href: "/lessons",
  },
  {
    name: "Cards",
    icon: CreditCard,
    href: "/cards",
  },
  {
    name: "Teachers",
    icon: GraduationCap,
    href: "/teachers",
  },
  {
    name: "Students",
    icon: Users,
    href: "/students",
  },
  {
    name: "Teams",
    icon: Boxes,
    href: "/teams",
  },
  {
    name: "Income",
    icon: DollarSign,
    href: "/income",
    disabled: true,
  },
];

const Sidebar = () => {
  const [open, setOpen] = useState(false);
  const [switchClassroomOpen, setSwitchClassroomOpen] = useState(false);
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
    await logout();
    router.push("/login");
  };

  const handleSwitchClassroom = async (classroomId: number) => {
    await switchClassroom({ id: classroomId.toString() });
    router.push("/lessons");
    setOpen(false);
    setSwitchClassroomOpen(false);
  };

  if (!data) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="cursor-pointer">
        <Menu className="w-6 h-6 text-white" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/70 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed top-0 bottom-0 left-0 z-50 rounded-r-2xl bg-white shadow-xl p-6 w-80 flex flex-col"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
            >
              <div className="flex gap-4 items-center pb-4 border-b border-gray-200">
                <div className="w-9 h-9 font-bold flex items-center justify-center bg-primary-500 rounded-lg text-white">
                  {currentClassroom?.name.slice(0, 1)}
                </div>
                <h2 className="text-xl font-semibold">
                  {currentClassroom?.name}
                </h2>
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
                        className="flex gap-3 items-center"
                        onClick={() => handleSwitchClassroom(classroom.id)}
                      >
                        <div className="w-7 h-7 font-bold text-sm flex items-center justify-center bg-primary-500 rounded-sm text-white">
                          {classroom.name.slice(0, 1)}
                        </div>
                        <h2 className="text-lg font-semibold">
                          {classroom.name}
                        </h2>
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
                    href={link.disabled ? "#" : link.href}
                    key={link.name}
                    className={`flex gap-4 items-center p-3 hover:bg-gray-100 rounded-sm ${
                      pathname === link.href
                        ? "bg-primary-100 text-primary-900 font-semibold"
                        : "text-gray-700"
                    } ${link.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <link.icon className="w-6 h-6" />
                    <span>{link.name}</span>
                  </Link>
                ))}
              </div>
              <div className="flex flex-col items-start  rounded-sm mt-auto">
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
