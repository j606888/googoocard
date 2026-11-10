"use client";

import { useCallback, useEffect, useState } from "react";

export interface LessonScope {
  /** 只看我教的＋我當小幫手的課。帳號沒連到老師時不生效。 */
  mine: boolean;
  locationId: number | null;
}

const DEFAULT_SCOPE: LessonScope = { mine: true, locationId: null };
const scopeKey = (classroomId: number) => `lesson-scope:${classroomId}`;

/** 課程列表最上面的「我的課／全部」與分部：記在這台裝置上，下次打開維持上次的選擇。 */
export const useLessonScope = (classroomId: number | undefined) => {
  const [scope, setScope] = useState<LessonScope>(DEFAULT_SCOPE);

  useEffect(() => {
    if (classroomId == null) return;
    try {
      const saved = JSON.parse(localStorage.getItem(scopeKey(classroomId)) ?? "null");
      if (saved && typeof saved === "object") {
        setScope({
          mine: saved.mine !== false,
          locationId: typeof saved.locationId === "number" ? saved.locationId : null,
        });
      }
    } catch {
      // Storage unavailable — the scope just won't survive a reload.
    }
  }, [classroomId]);

  const update = useCallback(
    (patch: Partial<LessonScope>) =>
      setScope((prev) => {
        const next = { ...prev, ...patch };
        if (classroomId != null) {
          try {
            localStorage.setItem(scopeKey(classroomId), JSON.stringify(next));
          } catch {
            // ignore
          }
        }
        return next;
      }),
    [classroomId]
  );

  return [scope, update] as const;
};
