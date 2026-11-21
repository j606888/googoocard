"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";

/**
 * Every top-level teacher page runs this once (through `Navbar`, or directly
 * when the page draws its own header): a failed classrooms request means the
 * session is gone → `/login`; no current classroom → `/onboarding`.
 */
export const useClassroomGuard = () => {
  const { data, isLoading, error } = useGetClassroomsQuery();
  const router = useRouter();
  const currentClassroomId = data?.currentClassroomId;

  useEffect(() => {
    if (isLoading) return;
    if (error) {
      router.push("/login");
      return;
    }
    if (!currentClassroomId) router.push("/onboarding");
  }, [isLoading, currentClassroomId, error, router]);

  const current = data?.classrooms.find((c) => c.id === currentClassroomId) ?? null;
  return { isLoading, current };
};
