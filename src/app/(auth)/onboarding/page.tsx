"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateClassroomMutation } from "@/store/slices/classrooms";
import AuthScaffold from "../AuthScaffold";
import { Button } from "@/components/ui/button";
import Field from "@/components/Field";

export default function OnboardingPage() {
  const [classroomName, setClassroomName] = useState("");
  const [error, setError] = useState("");
  const [createClassroom] = useCreateClassroomMutation();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!classroomName.trim()) {
      setError("請輸入教室名稱");
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
    <AuthScaffold title="最後一步" subtitle="幫你的教室取個名字，學生在 LINE 上會看到">
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4">
        <Field
          label="教室名稱"
          placeholder="例如：小鳥舞蹈教室"
          value={classroomName}
          onChange={(e) => setClassroomName(e.target.value)}
          error={error || undefined}
        />
        <div className="mt-auto lg:mt-4 pt-4">
          <Button type="submit" size="lg" className="w-full" isLoading={loading}>
            建立教室
          </Button>
        </div>
      </form>
    </AuthScaffold>
  );
}
