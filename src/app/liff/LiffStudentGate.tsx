"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { StudentWithDetail } from "@/store/slices/students";
import ListSkeleton from "@/components/skeletons/ListSkeleton";

// Shared identity gate for student LIFF pages. Authenticates with LIFF (ID
// token, no cookie), resolves the bound student via /api/liff/me, and only
// renders `children(student)` once a single student is resolved. A LINE account
// may be bound to several students (different classrooms) → shows a picker,
// remembering the last choice. Unbound accounts are blocked, and the gate only
// ever hands over the caller's own student — no admin / other-student access.

const LAST_STUDENT_KEY = "liff:lastStudentId";

interface StudentOption {
  id: number;
  name: string;
  avatarUrl: string;
  classroom: { id: number; name: string };
}

type MeResponse =
  | { needsSelection: true; students: StudentOption[] }
  | StudentWithDetail;

export default function LiffStudentGate({
  children,
}: {
  children: (student: StudentWithDetail) => ReactNode;
}) {
  const [status, setStatus] = useState("登入中…");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [options, setOptions] = useState<StudentOption[] | null>(null);
  const [student, setStudent] = useState<StudentWithDetail | null>(null);

  // Fetch /api/liff/me with the ID token, optionally for a specific student.
  const loadMe = useCallback(async (token: string, studentId?: number) => {
    setStudent(null);
    setOptions(null);
    setStatus("載入中…");
    const qs = studentId ? `?studentId=${studentId}` : "";
    const res = await fetch(`/api/liff/me${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      // not_bound, or a remembered student that no longer belongs here.
      if (studentId) {
        localStorage.removeItem(LAST_STUDENT_KEY);
        await loadMe(token); // retry without the stale id
        return;
      }
      setStatus("此 LINE 帳號尚未綁定學生，請使用老師提供的綁定連結。");
      return;
    }
    if (!res.ok) {
      setStatus("載入失敗，請稍後再試。");
      return;
    }

    const data: MeResponse = await res.json();
    if ("needsSelection" in data) {
      setOptions(data.students);
      return;
    }
    setStudent(data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setStatus("尚未設定 LIFF ID");
        return;
      }
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const token = liff.getIDToken();
        if (!token) {
          setStatus("無法取得 LINE 身分，請重新開啟。");
          return;
        }
        if (cancelled) return;
        setIdToken(token);

        const remembered = Number(localStorage.getItem(LAST_STUDENT_KEY)) || undefined;
        await loadMe(token, remembered);
      } catch (err) {
        console.error("[liff] init error", err);
        if (!cancelled) setStatus("LIFF 初始化失敗。");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  const pickStudent = (id: number) => {
    if (!idToken) return;
    localStorage.setItem(LAST_STUDENT_KEY, String(id));
    loadMe(idToken, id);
  };

  // Multi-student picker.
  if (options) {
    return (
      <div className="mx-auto max-w-[480px] px-5 py-6">
        <h2 className="mb-4 text-lg font-semibold">選擇身分</h2>
        <div className="flex flex-col gap-3">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => pickStudent(opt.id)}
              className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left active:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={opt.avatarUrl}
                alt={opt.name}
                className="h-11 w-11 rounded-full object-cover"
              />
              <div>
                <div className="font-medium">{opt.name}</div>
                <div className="text-sm text-gray-500">{opt.classroom.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Resolved a single student → hand it to the caller.
  if (student) {
    return <>{children(student)}</>;
  }

  // Loading / error.
  if (status === "載入中…") {
    return <ListSkeleton />;
  }
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-primary-500 text-white">
      <div className="text-lg font-semibold">googoocard</div>
      <div className="text-sm opacity-90">{status}</div>
    </div>
  );
}
