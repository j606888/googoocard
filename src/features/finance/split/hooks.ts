"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { useGetTeachersQuery } from "@/store/slices/teachers";
import { useVerifyLessonsMutation, type LessonSplitRow } from "@/store/slices/finance";
import { errorText } from "../format";

/** 老師 id → 名字；null ＝ 外面的場地。 */
export function useTeacherNames() {
  const { data: teachers } = useGetTeachersQuery();
  return useMemo(() => {
    const names = new Map((teachers ?? []).map((t) => [t.id, t.name]));
    return (id: number | null) => (id === null ? "場地" : names.get(id) ?? "？");
  }, [teachers]);
}

/** 驗收一批堂；回傳 run 跟忙碌狀態。 */
export function useVerify() {
  const [verify, { isLoading }] = useVerifyLessonsMutation();
  const run = async (periodIds: number[], batch: boolean) => {
    try {
      const result = await verify({ periodIds, batch }).unwrap();
      if (result.verified.length > 0) toast.success(`驗收了 ${result.verified.length} 堂`);
      else toast.error("沒有可以驗收的堂");
    } catch (error) {
      toast.error(errorText(error));
    }
  };
  return { run, busy: isLoading };
}

export const isClean = (r: LessonSplitRow) => (r.status === "PENDING" || r.status === "CHANGED") && r.flags.length === 0;
