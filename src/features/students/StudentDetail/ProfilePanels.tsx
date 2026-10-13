"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import type { ReactNode } from "react";
import {
  StudentWithDetail,
  useGetStudentLineBindLinkQuery,
  useUpdateStudentDanceLevelsMutation,
} from "@/store/slices/students";
import EditStudent from "./BasicSection/EditStudent";
import QualificationLevels, { applyLevelPick } from "./QualificationLevels";

export const publicPageUrl = (student: StudentWithDetail) =>
  `${window.location.origin}/public-students/${student.randomKey}`;

export const copyText = async (value: string, message = "已複製") => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error("無法複製，請手動選取");
  }
};

const Panel = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const linkButton =
  "text-xs font-semibold text-primary-900 hover:underline cursor-pointer px-1 py-1";

/** 舞種資格: each click saves (PATCH danceLevels) — no separate 儲存. */
const QualificationPanel = ({ student }: { student: StudentWithDetail }) => {
  const [updateLevels, { isLoading }] = useUpdateStudentDanceLevelsMutation();
  const levels = student.danceLevels ?? {};

  const handlePick = async (styleId: number, level: number, hasLevels: boolean) => {
    const next = applyLevelPick(levels, styleId, level, hasLevels);
    try {
      await updateLevels({ id: student.id, danceLevels: next }).unwrap();
    } catch {
      toast.error("舞種資格更新失敗，請稍後再試");
    }
  };

  return (
    <Panel title="舞種資格">
      <QualificationLevels levels={levels} onPick={handlePick} dense disabled={isLoading} />
      <p className="text-xs text-neutral-600">過課後才能買該舞種的複習卡，只能用在不高於這個程度的課。</p>
    </Panel>
  );
};

const LineStatus = ({ studentId }: { studentId: number }) => {
  const { data, isLoading } = useGetStudentLineBindLinkQuery({ id: studentId });
  if (isLoading || !data) return <span className="text-neutral-500">—</span>;
  if (data.bound) return <span>已綁定 · 收得到續卡提醒</span>;
  if (!data.deepLink) return <span className="text-neutral-600">尚未設定 LINE 官方帳號</span>;
  return (
    <span className="flex items-center gap-2 flex-wrap">
      <span className="text-neutral-600">未綁定</span>
      <button
        type="button"
        className={linkButton}
        onClick={() => copyText(data.deepLink!, "已複製 LINE 綁定連結")}
      >
        複製綁定連結
      </button>
    </span>
  );
};

const InfoPanel = ({ student }: { student: StudentWithDetail }) => {
  const tags = (student.tags ?? []).filter((tag) => tag.name !== "Needs Renewal");
  return (
    <Panel
      title="學生資料"
      action={
        <EditStudent
          student={student}
          trigger={(open) => (
            <button type="button" className={linkButton} onClick={open}>
              編輯
            </button>
          )}
        />
      }
    >
      <dl className="grid grid-cols-[56px_1fr] gap-x-3 gap-y-2 text-sm m-0">
        <dt className="text-neutral-600">加入</dt>
        <dd className="m-0">{format(new Date(student.createdAt), "yyyy/MM/dd")}</dd>
        <dt className="text-neutral-600">LINE</dt>
        <dd className="m-0">
          <LineStatus studentId={student.id} />
        </dd>
        {tags.length > 0 && (
          <>
            <dt className="text-neutral-600">標籤</dt>
            <dd className="m-0 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag.id} className="text-xs border border-neutral-300 rounded-full px-2 py-0.5">
                  {tag.name}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
      {student.note && (
        <p className="text-sm bg-neutral-50 rounded-xl px-3 py-2.5 text-neutral-700 whitespace-pre-line">
          備註：{student.note}
        </p>
      )}
    </Panel>
  );
};

const PublicPagePanel = ({ student }: { student: StudentWithDetail }) => (
  <Panel
    title="公開頁"
    action={
      <button
        type="button"
        className={linkButton}
        onClick={() => copyText(publicPageUrl(student), "已複製公開頁連結")}
      >
        複製連結
      </button>
    }
  >
    <p className="text-xs text-neutral-600">學生可以自己查剩餘堂數與出席紀錄。</p>
  </Panel>
);

/**
 * The teacher-facing side panels: 舞種資格／學生資料／公開頁. Shown as the
 * detail page's right column when the pane is wide enough, otherwise as its
 * own 「資料」 tab (see StudentDetail).
 */
const ProfilePanels = ({ student }: { student: StudentWithDetail }) => (
  <div className="flex flex-col gap-4">
    <QualificationPanel student={student} />
    <InfoPanel student={student} />
    <PublicPagePanel student={student} />
  </div>
);

export default ProfilePanels;
