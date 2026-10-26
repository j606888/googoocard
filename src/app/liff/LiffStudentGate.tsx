"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { StudentWithDetail } from "@/store/slices/students";
import { Button } from "@/components/ui/button";
import LiffSkeleton from "@/features/liff/LiffSkeleton";
import FirstTimeGate, { FirstTimePrefill } from "@/features/liff/FirstTimeGate";
import { getLiffId, loadLiff } from "@/lib/liffClient";

// Shared identity gate for student LIFF pages. Authenticates with LIFF (ID
// token, no cookie), resolves the bound student via /api/liff/me, and only
// renders `children(student)` once a single student is resolved. A LINE account
// may be bound to several students (different classrooms) → shows a picker,
// remembering the last choice. Unbound accounts are blocked — except on the
// on-site check-in entry (`checkinKey`, from the wall QR), where a LINE account
// with no student in that classroom gets「第一次來嗎？」and can register itself.
// The gate only ever hands over the caller's own student.

const LAST_STUDENT_KEY = "liff:lastStudentId";

interface StudentOption {
  id: number;
  name: string;
  avatarUrl: string;
  classroom: { id: number; name: string };
}

type MeResponse =
  | { needsSelection: true; students: StudentOption[] }
  | (StudentWithDetail & { boundStudents?: StudentOption[] });

export interface LiffAuthContext {
  idToken: string;
  studentId: number;
}

export default function LiffStudentGate({
  children,
  acceptCheckinKey = false,
}: {
  children: (student: StudentWithDetail, auth: LiffAuthContext) => ReactNode;
  /**
   * Read `?key=` (Classroom.checkinKey, from the on-site QR) once LIFF has
   * restored the real URL: scopes to that classroom and allows self-registration.
   */
  acceptCheckinKey?: boolean;
}) {
  const [status, setStatus] = useState("登入中…");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [options, setOptions] = useState<StudentOption[] | null>(null);
  const [student, setStudent] = useState<StudentWithDetail | null>(null);
  const [boundStudents, setBoundStudents] = useState<StudentOption[]>([]);
  const [firstTime, setFirstTime] = useState<FirstTimePrefill | null>(null);
  const [checkinKey, setCheckinKey] = useState<string | null>(null);

  // Fetch /api/liff/me with the ID token, optionally for a specific student.
  const loadMe = useCallback(async (token: string, studentId?: number, key?: string | null) => {
    setStudent(null);
    setOptions(null);
    setFirstTime(null);
    setStatus("載入中…");
    const params = new URLSearchParams();
    if (studentId) params.set("studentId", String(studentId));
    if (key) params.set("key", key);
    const qs = params.toString() ? `?${params}` : "";
    const res = await fetch(`/api/liff/me${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      // not_bound, or a remembered student that no longer belongs here.
      if (studentId) {
        localStorage.removeItem(LAST_STUDENT_KEY);
        await loadMe(token, undefined, key); // retry without the stale id
        return;
      }
      if (key) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "not_bound") {
          setFirstTime({
            classroomName: body.classroomName ?? "",
            lineName: body.lineName ?? "",
            linePicture: body.linePicture ?? null,
          });
          return;
        }
      }
      setStatus("此 LINE 帳號尚未綁定學生，請使用老師提供的綁定連結。");
      return;
    }
    if (res.status === 404 && key) {
      setStatus("簽到 QR Code 已失效，請找老師或小幫手確認最新的 QR Code。");
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
    setBoundStudents(data.boundStudents ?? []);
    setStudent(data);

    // Mirror the LIFF selection server-side so the LINE bot's menu shows the same
    // student (the webhook reads LineAccount.selectedStudentId). Fire-and-forget.
    fetch("/api/liff/select-student", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studentId: data.id }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const liffId = getLiffId();
      if (!liffId) {
        setStatus("尚未設定 LIFF ID");
        return;
      }
      try {
        const liff = await loadLiff();
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

        // ?switch=1 (from the「切換學生」menu button) forces the picker by
        // ignoring the remembered choice.
        const search = new URLSearchParams(window.location.search);
        const key = acceptCheckinKey ? search.get("key") : null;
        setCheckinKey(key);
        const forcePick = search.has("switch");
        if (forcePick) localStorage.removeItem(LAST_STUDENT_KEY);
        const remembered = forcePick
          ? undefined
          : Number(localStorage.getItem(LAST_STUDENT_KEY)) || undefined;
        await loadMe(token, remembered, key);
      } catch (err) {
        console.error("[liff] init error", err);
        if (!cancelled) setStatus("LIFF 初始化失敗。");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadMe, acceptCheckinKey]);

  const pickStudent = (id: number) => {
    if (!idToken) return;
    localStorage.setItem(LAST_STUDENT_KEY, String(id));
    loadMe(idToken, id, checkinKey);
  };

  // Drop the remembered choice and re-show the picker (cross-classroom switch).
  const switchStudent = () => {
    if (!idToken) return;
    localStorage.removeItem(LAST_STUDENT_KEY);
    setStudent(null);
    loadMe(idToken, undefined, checkinKey);
  };

  // On-site QR, no student in this classroom yet →「第一次來嗎？」
  if (firstTime && idToken && checkinKey) {
    return (
      <FirstTimeGate
        prefill={firstTime}
        idToken={idToken}
        checkinKey={checkinKey}
        onRegistered={() => loadMe(idToken, undefined, checkinKey)}
      />
    );
  }

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
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 text-left active:bg-neutral-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={opt.avatarUrl}
                alt={opt.name}
                className="h-11 w-11 rounded-full object-cover"
              />
              <div>
                <div className="font-medium">{opt.name}</div>
                <div className="text-sm text-neutral-500">{opt.classroom.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Resolved a single student → hand it to the caller, along with the auth
  // context (ID token + resolved studentId) needed for student-scoped LIFF APIs.
  // When the account is bound to more than one student, show a switch bar.
  if (student && idToken) {
    return (
      <>
        {boundStudents.length > 1 && (
          <div className="flex items-center justify-between gap-2 bg-neutral-50 px-4 py-2 text-sm">
            <span className="truncate text-neutral-600">
              目前：{student.name}（{student.classroom.name}）
            </span>
            <Button variant="secondary" size="sm" onClick={switchStudent} className="shrink-0">
              切換學生
            </Button>
          </div>
        )}
        {children(student, { idToken, studentId: student.id })}
      </>
    );
  }

  // Loading / error.
  if (status === "載入中…") {
    return (
      <>
        <div className="h-16 w-full bg-primary-900" />
        <LiffSkeleton />
      </>
    );
  }
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-primary-900 text-white">
      <div className="text-lg font-semibold">googoocard</div>
      <div className="text-sm opacity-90">{status}</div>
    </div>
  );
}
