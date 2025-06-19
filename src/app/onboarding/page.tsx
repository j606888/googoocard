"use client";

import {  Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGetClassroomsQuery } from "@/store/slices/classrooms";

export default function OnboardingPage() {
  const { data } = useGetClassroomsQuery();
  const [classroomName, setClassroomName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!classroomName.trim()) {
      setError("Classroom name is required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/classrooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: classroomName }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        router.push("/teachers");
      } else {
        console.error(data);
      }
    } catch (error) {
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data?.currentClassroomId) {
      router.push("/lessons");
    }
  }, [data]);

  return (
    <div className="flex flex-col items-center justify-center left-0 right-0 top-0 bottom-0 absolute bg-primary-500 overflow-hidden">
      <div className="relative w-full flex items-center justify-center h-[40vh]">
        <h2 className="text-white text-center text-2xl font-semibold">
          Welcome to GooGoocard!
          <br />
          Let&apos;s get started!
        </h2>
        <div className="w-30 h-30 rounded-full bg-primary-50 absolute -bottom-15 -left-15"></div>
        <div className="w-30 h-30 rounded-full bg-primary-50 absolute -top-15 -right-15"></div>
      </div>
      <div className="h-[60vh] bg-white rounded-t-3xl w-full p-6 flex flex-col items-center z-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="w-full">
          <h2 className="text-[28px] font-semibold mb-4">
            What is your classroom name?
          </h2>
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6 text-gray-500" />
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Your classroom name"
                  className={`w-full border-b-2 ${
                    error ? "border-red-500" : "border-gray-300"
                  } px-1.5 py-3 text-base focus:outline-none`}
                  value={classroomName}
                  onChange={(e) => setClassroomName(e.target.value)}
                />
                {error && (
                  <p className="text-red-500 text-sm mt-1 absolute -bottom-5 left-0">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto w-full">
          <button
            className={`bg-primary-500 w-full text-white px-4 py-3 rounded-md font-bold text-lg ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={loading}
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
