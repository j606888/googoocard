"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetClassroomsQuery,
  useSwitchClassroomMutation,
} from "@/store/slices/classrooms";

const ClassroomSwitcher = () => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [switchClassroom] = useSwitchClassroomMutation();
  const { data } = useGetClassroomsQuery();

  const currentClassroom = data?.classrooms.find(
    (c) => c.id === data.currentClassroomId
  );
  const otherClassrooms = data?.classrooms.filter(
    (c) => c.id !== data?.currentClassroomId
  );

  const handleSwitch = async (id: number) => {
    await switchClassroom({ id: id.toString() });
    router.push("/lessons");
    setOpen(false);
  };

  if (!currentClassroom) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-white"
      >
        <span className="text-xl font-bold">{currentClassroom.name}</span>
        <ChevronDown
          className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-full z-50 mt-2 w-60 origin-top-left rounded-2xl border border-black/5 bg-white p-2 shadow-[0_12px_40px_-12px_rgba(27,94,74,0.45)]"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16 }}
            >
              {otherClassrooms && otherClassrooms.length > 0 ? (
                <>
                  <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-neutral-400">
                    Switch classroom
                  </p>
                  {otherClassrooms.map((classroom) => (
                    <button
                      key={classroom.id}
                      onClick={() => handleSwitch(classroom.id)}
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
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-2 rounded-xl border-t border-neutral-100 px-2 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
              >
                <Plus className="h-4 w-4" />
                Create another classroom
              </Link>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClassroomSwitcher;
