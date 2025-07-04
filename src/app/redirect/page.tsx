"use client";

import { useGetClassroomsQuery } from "@/store/slices/classrooms";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const RedirectPage = () => {
  const { data, isLoading } = useGetClassroomsQuery();
  const router = useRouter();
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots === ".") return "..";
        if (prevDots === "..") return "...";
        return ".";
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (data?.currentClassroomId) {
      router.push("/lessons");
    } else {
      router.push("/onboarding");
    }
  }, [data, isLoading, router]);

  return (
    <div className="flex flex-col items-center justify-center left-0 right-0 top-0 bottom-0 absolute bg-primary-500 overflow-hidden">
      <div className="relative w-full flex flex-col items-center justify-center h-[40vh] gap-4">
        <h2
          className="text-white text-center text-xl font-semibold w-30
         mx-auto"
        >
          Redirecting{dots}
        </h2>
      </div>
    </div>
  );
};

export default RedirectPage;
