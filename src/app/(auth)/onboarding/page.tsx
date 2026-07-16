"use client";

import { Store } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateClassroomMutation } from "@/store/slices/classrooms";
import AuthScaffold from "../AuthScaffold";

export default function OnboardingPage() {
  const [classroomName, setClassroomName] = useState("");
  const [error, setError] = useState("");
  const [createClassroom] = useCreateClassroomMutation();
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
      await createClassroom({ name: classroomName }).unwrap();
      router.push("/lessons");
    } catch (error) {
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold
      heroTitle={
        <>
          Welcome to GooGoocard!
          <br />
          Let&apos;s get started!
        </>
      }
    >
      <div className="w-full">
        <h2 className="text-[28px] font-semibold mb-4">
          What is your classroom name?
        </h2>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-neutral-500" />
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Your classroom name"
                className={`w-full border-b-2 ${
                  error ? "border-danger-500" : "border-neutral-300"
                } px-1.5 py-3 text-base focus:outline-none focus:border-primary-500`}
                value={classroomName}
                onChange={(e) => setClassroomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit(e);
                  }
                }}
              />
              {error && (
                <p className="text-danger-500 text-sm mt-1 absolute -bottom-5 left-0">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto lg:mt-10 w-full">
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
    </AuthScaffold>
  );
}
