"use client";

import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  StudentWithDetail,
  useGetStudentLineBindLinkQuery,
  useUpdateStudentDanceLevelsMutation,
} from "@/store/slices/students";
import EditStudent from "./BasicSection/EditStudent";
import LineBindQrButton from "./LineBindQrButton";
import UnbindLineDialog from "./UnbindLineDialog";
import QualificationLevels, { applyLevelPick } from "./QualificationLevels";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import StatusTag from "@/components/StatusTag";
import { cn } from "@/lib/utils";

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

export const Panel = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex min-h-11 items-center justify-between gap-2">
      <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

/** 手機上大區塊之間的 8px 淺底帶（不是框）；桌面靠留白分開。 */
export const Band = () => <div aria-hidden="true" className="-mx-5 my-7 h-2 bg-band lg:hidden" />;

const linkButton = cn(buttonVariants({ variant: "text", size: "sm" }), "-mx-2");

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
      <p className="text-[13px] text-ink-3">過課後才能買該舞種的複習卡，只能用在不高於這個程度的課。</p>
    </Panel>
  );
};

const LineStatus = ({ studentId, studentName }: { studentId: number; studentName: string }) => {
  const { data, isLoading } = useGetStudentLineBindLinkQuery({ id: studentId });
  const [confirmUnbind, setConfirmUnbind] = useState(false);
  if (isLoading || !data) return <span className="text-ink-3">—</span>;
  if (data.bound) {
    return (
      <span className="flex items-center gap-2 flex-wrap">
        <span>已綁定 · 收得到續卡提醒</span>
        <button type="button" className={linkButton} onClick={() => setConfirmUnbind(true)}>
          解除綁定
        </button>
        <UnbindLineDialog
          student={{ id: studentId, name: studentName }}
          open={confirmUnbind}
          onClose={() => setConfirmUnbind(false)}
        />
      </span>
    );
  }
  if (!data.deepLink) return <span className="text-ink-2">尚未設定 LINE 官方帳號</span>;
  return (
    <span className="flex items-center gap-2 flex-wrap">
      <span className="text-ink-2">未綁定</span>
      <button
        type="button"
        className={linkButton}
        onClick={() => copyText(data.deepLink!, "已複製 LINE 綁定連結")}
      >
        複製綁定連結
      </button>
      <LineBindQrButton deepLink={data.deepLink} studentName={studentName} className={linkButton} />
    </span>
  );
};

/** 學生資料的一列：左邊標籤、右邊內容，列與列之間一條細線。 */
const InfoRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid min-h-12 grid-cols-[72px_minmax(0,1fr)] items-center gap-3 py-2">
    <dt className="text-[13px] text-ink-3">{label}</dt>
    <dd className="m-0 min-w-0">{children}</dd>
  </div>
);

const InfoPanel = ({ student }: { student: StudentWithDetail }) => {
  const tags = (student.tags ?? []).filter((tag) => tag.name !== "Needs Renewal");
  const { data: lineBind } = useGetStudentLineBindLinkQuery({ id: student.id });
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
      <dl className="m-0 divide-y divide-line border-y border-line text-[15px] text-ink">
        <InfoRow label="加入">
          <span className="tabular-nums">{format(new Date(student.createdAt), "yyyy/MM/dd")}</span>
        </InfoRow>
        <InfoRow label="LINE">
          <LineStatus studentId={student.id} studentName={student.name} />
        </InfoRow>
        {lineBind?.bound && (
          <InfoRow label="LINE 名稱">
            {lineBind.lineDisplayName ?? <span className="text-ink-3">學生下次打開 LINE 裡的頁面時會帶入</span>}
          </InfoRow>
        )}
        {tags.length > 0 && (
          <InfoRow label="標籤">
            <span className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <StatusTag key={tag.id} tone="neutral">
                  {tag.name}
                </StatusTag>
              ))}
            </span>
          </InfoRow>
        )}
        {student.note && (
          <InfoRow label="備註">
            <span className="whitespace-pre-line text-ink-2">{student.note}</span>
          </InfoRow>
        )}
      </dl>
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
    <p className="text-[13px] text-ink-3">學生可以自己查剩餘堂數與出席紀錄。</p>
  </Panel>
);

const SetupStep = ({
  index,
  done,
  title,
  hint,
  action,
}: {
  index: number;
  done: boolean;
  title: string;
  hint?: string;
  action?: ReactNode;
}) => (
  <li className="grid grid-cols-[24px_1fr] gap-2.5 items-start text-[15px]">
    <span
      aria-hidden="true"
      className={`w-[22px] h-[22px] rounded-full border-2 grid place-items-center text-xs ${
        done ? "bg-primary-900 border-primary-900 text-white" : "border-ink-3/40 text-ink-2"
      }`}
    >
      {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : index}
    </span>
    <div className="min-w-0">
      <div className={done ? "text-ink-3 line-through" : "font-semibold text-ink"}>
        {title}
        {done && <span className="sr-only">（已完成）</span>}
      </div>
      {!done && hint && <div className="text-[13px] text-ink-3 mt-0.5">{hint}</div>}
      {!done && action && <div className="mt-1">{action}</div>}
    </div>
  </li>
);

/** Placeholder for a SetupStep whose done state is still being fetched. */
const SetupStepSkeleton = () => (
  <li className="grid grid-cols-[24px_1fr] gap-2.5 items-start" aria-hidden="true">
    <Skeleton className="w-[22px] h-[22px] rounded-full" />
    <div className="flex flex-col gap-1.5 pt-0.5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-3.5 w-44" />
      <Skeleton className="h-5 w-24" />
    </div>
  </li>
);

/**
 * 新學生設定：還沒有任何課卡的學生，側欄最上面放一張依實際狀態打勾的清單——
 * 建立資料（永遠完成）、買第一張卡、綁 LINE、設定舞種資格。
 */
const SetupPanel = ({ student }: { student: StudentWithDetail }) => {
  const { data: lineBind, isLoading: isLineBindLoading } = useGetStudentLineBindLinkQuery({
    id: student.id,
  });
  const hasQualification = Object.keys(student.danceLevels ?? {}).length > 0;
  return (
    <Panel title="新學生設定">
      <ol className="m-0 p-0 list-none flex flex-col gap-3">
        <SetupStep index={1} done title="建立學生資料" />
        <SetupStep
          index={2}
          done={student.studentCards.length > 0}
          title="購買第一張課卡"
          hint="也可以等到點名時再買"
        />
        {isLineBindLoading ? (
          <SetupStepSkeleton />
        ) : (
          <SetupStep
            index={3}
            done={!!lineBind?.bound}
            title="綁定 LINE"
            hint="綁定後可以自助簽到、收續卡提醒"
            action={
              lineBind?.deepLink ? (
                <button
                  type="button"
                  className={linkButton}
                  onClick={() => copyText(lineBind.deepLink!, "已複製 LINE 綁定連結")}
                >
                  複製綁定連結
                </button>
              ) : undefined
            }
          />
        )}
        <SetupStep
          index={4}
          done={hasQualification}
          title="舞種資格"
          hint="上過課的舞種，才能買複習卡"
          action={
            <EditStudent
              student={student}
              trigger={(open) => (
                <button type="button" className={linkButton} onClick={open}>
                  設定
                </button>
              )}
            />
          }
        />
      </ol>
    </Panel>
  );
};

/**
 * The teacher-facing side panels: 舞種資格／學生資料／公開頁. Shown as the
 * detail page's right column when the pane is wide enough, otherwise as its
 * own 「資料」 tab (see StudentDetail). A student with no cards yet gets the
 * 新學生設定 checklist in place of the qualification panel (its step 4 opens
 * the edit form, which has the same level picker).
 */
const ProfilePanels = ({ student }: { student: StudentWithDetail }) => {
  const isNew = student.studentCards.length === 0;
  return (
    <div className="flex flex-col lg:gap-9">
      {isNew ? <SetupPanel student={student} /> : <QualificationPanel student={student} />}
      <Band />
      <InfoPanel student={student} />
      <Band />
      <PublicPagePanel student={student} />
    </div>
  );
};

export default ProfilePanels;
