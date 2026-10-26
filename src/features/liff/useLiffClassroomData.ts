"use client";

import { useEffect, useState } from "react";

export type ClassroomChoice = { id: number; name: string };

type State<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "pick"; classrooms: ClassroomChoice[] }
  | { status: "none" }
  | { status: "error" };

/**
 * GET a classroom-scoped LIFF endpoint (`/api/liff/schedule`, `/api/liff/prices`)
 * that also serves unbound visitors. A bound student passes `studentId`; a visitor
 * may pass the public classroom they picked. 409 `pick_classroom` → the caller shows
 * the choices and retries with `classroomId`.
 */
export function useLiffClassroomData<T>(
  path: string,
  opts: { idToken: string; studentId?: number; classroomId?: number; params?: Record<string, string> }
) {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  const { idToken, studentId, classroomId } = opts;
  const params = new URLSearchParams(opts.params);
  if (studentId) params.set("studentId", String(studentId));
  if (classroomId) params.set("classroomId", String(classroomId));
  const url = `${path}?${params}`;

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    (async () => {
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setState({ status: "ready", data: body as T });
        else if (res.status === 409) setState({ status: "pick", classrooms: body.classrooms ?? [] });
        else if (body.error === "no_public_classroom") setState({ status: "none" });
        else setState({ status: "error" });
      } catch (err) {
        console.error("[liff] load error", err);
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, idToken]);

  return state;
}
