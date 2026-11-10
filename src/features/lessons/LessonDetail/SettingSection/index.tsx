"use client";

import { Lesson } from "@/store/slices/lessons";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import InputField from "@/components/InputField";
import DanceStyleSelect from "@/features/lessons/newLesson/DanceStyleSelect";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import LevelSelect from "@/features/lessons/newLesson/LevelSelect";
import LessonKindSelect from "@/features/lessons/newLesson/LessonKindSelect";
import SessionsPerAttendanceSelect from "@/features/lessons/newLesson/SessionsPerAttendanceSelect";
import DropInPriceField, {
  type DropInPlans,
  buildDropInOptions,
  dropInPlansFrom,
  parseDropInPrice,
} from "@/features/lessons/newLesson/DropInPriceField";
import type { LessonKind } from "@/lib/lessonKind";
import TeacherSelect from "@/features/lessons/newLesson/TeacherSelect";
import AssistantSelect from "@/features/lessons/newLesson/AssistantSelect";
import CardSelect from "@/features/lessons/newLesson/CardSelect";
import LessonGroupSelect from "@/features/lessons/newLesson/LessonGroupSelect";
import LocationSelect from "@/features/lessons/newLesson/LocationSelect";
import SegmentedTabs from "@/components/SegmentedTabs";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import {
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useEndLessonMutation,
  useReopenLessonMutation,
} from "@/store/slices/lessons";
import { useRouter } from "next/navigation";

const validationErrors = {
  lessonName: "請輸入課程名稱",
  teachers: "請至少選擇一位老師",
  cards: "請至少選擇一張課卡",
  danceStyle: "請選擇舞種",
  dropInPrice: "請輸入單堂價",
};

type FormErrors = Partial<Record<keyof typeof validationErrors, string>>;

/**
 * The form is split into three tabs but saved as one — a lesson's settings
 * depend on each other across tabs (no cards is only valid with 單堂付費 on),
 * so per-tab saving would strand edits. A tab shows a dot when it has unsaved
 * changes and a red ! when the last save attempt failed there.
 */
export type SettingTab = "basic" | "cards" | "status";

const TAB_LABELS: Record<SettingTab, string> = {
  basic: "基本設定",
  cards: "課卡與老師",
  status: "課程狀態",
};

/** Which tab each validation error lives on — a failed save jumps there. */
const ERROR_TAB: Record<keyof FormErrors, SettingTab> = {
  lessonName: "basic",
  danceStyle: "basic",
  dropInPrice: "basic",
  teachers: "cards",
  cards: "cards",
};

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

const SettingSection = ({
  lesson,
  variant = "page",
  onClose,
  onDone,
  onDirtyChange,
}: {
  lesson: Lesson;
  /**
   * `drawer` — desktop: inside the right-hand sheet, with a title bar; saving,
   * ending or reopening closes it. `page` — the phone 設定 tab.
   */
  variant?: "page" | "drawer";
  /** Drawer only: the teacher asked to close (×, 取消) — the parent confirms if there are unsaved edits. */
  onClose?: () => void;
  /** Drawer only: close without asking — after a save, 結束課程 or 重新開課 went through. */
  onDone?: () => void;
  /** Lets the parent ask before throwing unsaved edits away. */
  onDirtyChange?: (dirty: boolean) => void;
}) => {
  const isDrawer = variant === "drawer";
  const [tab, setTab] = useState<SettingTab>("basic");

  const [lessonName, setLessonName] = useState(lesson.name);
  const [danceStyleId, setDanceStyleId] = useState<number | null>(lesson.danceStyleId);
  const { byId } = useDanceStyles();
  const hasLevels = danceStyleId !== null && (byId.get(danceStyleId)?.hasLevels ?? false);
  const [level, setLevel] = useState<number>(lesson.level);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>(lesson.teachers.map((teacher) => teacher.id));
  const [selectedAssistantIds, setSelectedAssistantIds] = useState<number[]>(
    lesson.assistants.map((assistant) => assistant.id)
  );
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>(lesson.cards.map((card) => card.id));
  const [groupId, setGroupId] = useState<number | null>(lesson.groupId);
  const [locationId, setLocationId] = useState<number | null>(lesson.location?.id ?? null);
  const [kind, setKind] = useState<LessonKind>(lesson.kind);
  const [sessionsPerAttendance, setSessionsPerAttendance] = useState<number>(
    lesson.sessionsPerAttendance
  );
  const [dropInEnabled, setDropInEnabled] = useState<boolean>(lesson.dropInPrice !== null);
  const [dropInAmount, setDropInAmount] = useState<string>(
    lesson.dropInPrice !== null ? String(lesson.dropInPrice) : ""
  );
  const [dropInPlans, setDropInPlans] = useState<DropInPlans>(() => dropInPlansFrom(lesson.dropInOptions));
  const [errors, setErrors] = useState<FormErrors>({});

  const [updateLesson, { isLoading }] = useUpdateLessonMutation();
  const [deleteLesson, { isLoading: isDeleting }] = useDeleteLessonMutation();
  const [endLesson, { isLoading: isEnding }] = useEndLessonMutation();
  const [reopenLesson, { isLoading: isReopening }] = useReopenLessonMutation();
  const router = useRouter();
  const isEndedByHand = lesson.endedAt !== null;
  const hasNoPeriods = lesson.periods.length === 0;
  const [confirming, setConfirming] = useState<"end" | "delete" | null>(null);

  // Compared against the lesson as it is on the server, so a save that lands
  // (and refetches) clears the dots by itself.
  const dirtyByTab: Record<SettingTab, boolean> = useMemo(() => {
    const savedDropIn = lesson.dropInPrice !== null ? String(lesson.dropInPrice) : "";
    return {
      basic:
        lessonName !== lesson.name ||
        danceStyleId !== lesson.danceStyleId ||
        level !== lesson.level ||
        kind !== lesson.kind ||
        sessionsPerAttendance !== lesson.sessionsPerAttendance ||
        dropInEnabled !== (lesson.dropInPrice !== null) ||
        (dropInEnabled && dropInAmount !== savedDropIn) ||
        (dropInEnabled &&
          JSON.stringify(dropInPlans) !== JSON.stringify(dropInPlansFrom(lesson.dropInOptions))),
      cards:
        !sameIds(selectedTeacherIds, lesson.teachers.map((t) => t.id)) ||
        !sameIds(selectedAssistantIds, lesson.assistants.map((a) => a.id)) ||
        !sameIds(selectedCardIds, lesson.cards.map((c) => c.id)) ||
        groupId !== lesson.groupId ||
        locationId !== (lesson.location?.id ?? null),
      status: false,
    };
  }, [
    lesson, lessonName, danceStyleId, level, kind, sessionsPerAttendance, dropInEnabled,
    dropInAmount, dropInPlans, selectedTeacherIds, selectedAssistantIds, selectedCardIds, groupId,
    locationId,
  ]);
  const dirtyTabCount = Object.values(dirtyByTab).filter(Boolean).length;
  const isDirty = dirtyTabCount > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const errorTabs = new Set(
    (Object.keys(errors) as (keyof FormErrors)[])
      .filter((key) => errors[key])
      .map((key) => ERROR_TAB[key])
  );

  const clearError = (key: keyof FormErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const handleSubmit = async () => {
    const dropInPrice = parseDropInPrice(dropInEnabled, dropInAmount);
    const next = validateForm({
      lessonName,
      teachers: selectedTeacherIds,
      cards: selectedCardIds,
      danceStyleId,
      dropInEnabled,
      dropInPrice,
    });
    const dropInOptions = buildDropInOptions(dropInEnabled, dropInAmount, dropInPlans);
    if (!next.dropInPrice && dropInOptions === undefined) {
      next.dropInPrice = "每個方案都要有名稱和金額，名稱不能重複";
    }
    setErrors(next);
    const firstError = (Object.keys(next) as (keyof FormErrors)[])[0];
    if (firstError) {
      setTab(ERROR_TAB[firstError]);
      return;
    }
    if (danceStyleId === null || dropInPrice === undefined || dropInOptions === undefined) return;
    try {
      await updateLesson({
        id: lesson.id,
        draftLesson: {
          lessonName, teacherIds: selectedTeacherIds, assistantIds: selectedAssistantIds,
          cardIds: selectedCardIds, danceStyleId,
          level, kind, sessionsPerAttendance, dropInPrice, dropInOptions, groupId, locationId,
        },
      }).unwrap();
    } catch {
      toast.error("儲存失敗，請再試一次");
      return;
    }
    toast.success("已儲存");
    if (isDrawer) onDone?.();
  };

  const handleCancel = () => {
    // The drawer asks before discarding (see its onClose); on the phone 取消 just reverts.
    if (isDrawer) {
      onClose?.();
      return;
    }
    setLessonName(lesson.name);
    setDanceStyleId(lesson.danceStyleId);
    setLevel(lesson.level);
    setKind(lesson.kind);
    setSessionsPerAttendance(lesson.sessionsPerAttendance);
    setDropInEnabled(lesson.dropInPrice !== null);
    setDropInAmount(lesson.dropInPrice !== null ? String(lesson.dropInPrice) : "");
    setDropInPlans(dropInPlansFrom(lesson.dropInOptions));
    setSelectedTeacherIds(lesson.teachers.map((t) => t.id));
    setSelectedAssistantIds(lesson.assistants.map((a) => a.id));
    setSelectedCardIds(lesson.cards.map((c) => c.id));
    setGroupId(lesson.groupId);
    setLocationId(lesson.location?.id ?? null);
    setErrors({});
  };

  const handleEndToggle = async () => {
    try {
      if (isEndedByHand) await reopenLesson(lesson.id).unwrap();
      else await endLesson(lesson.id).unwrap();
    } catch {
      toast.error("操作失敗，請再試一次");
      return;
    }
    setConfirming(null);
    toast.success(isEndedByHand ? "已重新開課" : "課程已結束");
    if (isDrawer) onDone?.();
  };

  const handleDelete = () => {
    setConfirming(null);
    onDirtyChange?.(false);
    router.push("/lessons");
    deleteLesson(lesson.id);
  };

  const tabOptions = (Object.keys(TAB_LABELS) as SettingTab[]).map((value) => ({
    value,
    label: (
      <span className="inline-flex items-center gap-1.5">
        {TAB_LABELS[value]}
        {errorTabs.has(value) ? (
          <span
            aria-label="有錯誤"
            className="grid size-4 place-items-center rounded-full bg-danger-600 text-[11px] font-bold text-white"
          >
            !
          </span>
        ) : dirtyByTab[value] ? (
          <span aria-label="有變更" className="size-1.5 rounded-full bg-warning-500" />
        ) : null}
      </span>
    ),
  }));

  const footerMessage =
    errorTabs.size > 0
      ? { text: `有 ${errorTabs.size} 個分頁要修正才能儲存`, className: "text-danger-700 font-semibold" }
      : isDirty
        ? { text: `${dirtyTabCount} 個分頁有變更`, className: "text-warning-900 font-semibold" }
        : { text: "尚未修改", className: "text-neutral-500" };

  const sectionTitle = "text-xs font-semibold tracking-wider text-neutral-500";

  return (
    <div className={isDrawer ? "flex h-full min-h-0 flex-col" : "flex flex-col"}>
      {isDrawer && (
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="min-w-0">
            <ResponsiveDialogTitle className="text-lg font-bold text-neutral-900">編輯課程</ResponsiveDialogTitle>
            <p className="truncate text-[13px] text-neutral-500">
              {[lesson.name, lesson.group?.name].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="關閉" className="text-neutral-500" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
      )}

      <SegmentedTabs
        variant="underline"
        fill={!isDrawer}
        ariaLabel="課程設定分頁"
        className={`border-b border-neutral-200 ${isDrawer ? "px-4" : "mx-5 mt-3"}`}
        value={tab}
        onChange={setTab}
        options={tabOptions}
      />

      <div className={isDrawer ? "min-h-0 flex-1 overflow-y-auto px-6 py-6" : "px-5 py-5"}>
        {tab === "basic" && (
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-4">
              <h3 className={sectionTitle}>基本資料</h3>
              <InputField
                label="課程名稱"
                placeholder="例：Bachata Lv1"
                value={lessonName}
                onChange={(e) => {
                  clearError("lessonName");
                  setLessonName(e.target.value);
                }}
                error={errors.lessonName}
              />
              <DanceStyleSelect
                danceStyleId={danceStyleId}
                onChange={(value) => {
                  setDanceStyleId(value);
                  clearError("danceStyle");
                }}
                error={errors.danceStyle}
              />
              {hasLevels && <LevelSelect level={level} onChange={setLevel} />}
            </section>
            <section className="flex flex-col gap-4 border-t border-neutral-100 pt-6">
              <h3 className={sectionTitle}>上課方式</h3>
              <LessonKindSelect kind={kind} onChange={setKind} />
              <SessionsPerAttendanceSelect value={sessionsPerAttendance} onChange={setSessionsPerAttendance} />
              <DropInPriceField
                enabled={dropInEnabled}
                amount={dropInAmount}
                onEnabledChange={(enabled) => {
                  setDropInEnabled(enabled);
                  setErrors((prev) => ({ ...prev, dropInPrice: undefined, cards: undefined }));
                }}
                onAmountChange={(amount) => {
                  setDropInAmount(amount);
                  clearError("dropInPrice");
                }}
                plans={dropInPlans}
                onPlansChange={(plans) => {
                  setDropInPlans(plans);
                  clearError("dropInPrice");
                }}
                error={errors.dropInPrice}
              />
            </section>
          </div>
        )}

        {tab === "cards" && (
          <div className="flex flex-col gap-7">
            <section className="flex flex-col gap-4">
              <h3 className={sectionTitle}>可用課卡</h3>
              <CardSelect
                error={errors.cards}
                onChange={(value) => {
                  setSelectedCardIds(value);
                  clearError("cards");
                }}
                selectedCardIds={selectedCardIds}
                danceStyleId={danceStyleId}
              />
            </section>
            <section className="flex flex-col gap-4 border-t border-neutral-100 pt-6">
              <h3 className={sectionTitle}>地點與老師</h3>
              <LocationSelect locationId={locationId} onChange={setLocationId} />
              <LessonGroupSelect groupId={groupId} onChange={setGroupId} />
              <TeacherSelect
                error={errors.teachers}
                onChange={(value) => {
                  setSelectedTeacherIds(value);
                  // 同一個人不能又是老師又是小幫手——選成老師就從小幫手拿掉。
                  setSelectedAssistantIds((prev) => prev.filter((id) => !value.includes(id)));
                  clearError("teachers");
                }}
                selectedTeacherIds={selectedTeacherIds}
              />
              <AssistantSelect
                selectedAssistantIds={selectedAssistantIds}
                teacherIds={selectedTeacherIds}
                onChange={setSelectedAssistantIds}
              />
            </section>
          </div>
        )}

        {tab === "status" && (
          <div className="flex flex-col gap-3">
            <p className="rounded-xl bg-neutral-100 px-3.5 py-2.5 text-[13px] text-neutral-700">
              這一頁的操作會先問一次，確認後馬上生效，不用按「儲存變更」。
            </p>
            <div className="flex items-center gap-4 rounded-xl border border-neutral-200 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">{isEndedByHand ? "重新開課" : "結束課程"}</p>
                <p className="text-[13px] text-neutral-500">
                  {isEndedByHand
                    ? "這門課已手動結束；重新開課或排新時段都會回到「進行中」"
                    : "移到「已結束」，紀錄都會保留，之後可以重新開課"}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setConfirming("end")}>
                {isEndedByHand ? "重新開課" : "結束課程"}
              </Button>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-danger-100 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-danger-700">刪除課程</p>
                <p className="text-[13px] text-neutral-500">
                  {hasNoPeriods
                    ? "刪除後無法復原"
                    : `已經有 ${lesson.periods.length} 個時段，不能刪除；要停開請用「結束課程」`}
                </p>
              </div>
              <Button
                variant="dangerSecondary"
                size="sm"
                onClick={() => setConfirming("delete")}
                disabled={!hasNoPeriods || isDeleting}
              >
                刪除
              </Button>
            </div>
          </div>
        )}
      </div>

      <div
        data-in-app={isDrawer ? undefined : "flush-bottom"}
        className={`flex items-center gap-2.5 border-t border-neutral-200 bg-white ${
          isDrawer
            ? "px-6 py-3.5"
            : // Clears the floating BottomNav, like StudentDetail's action bar.
              "sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mx-3 rounded-2xl border px-4 py-3 shadow-[0_8px_24px_-12px_rgba(16,28,23,0.25)]"
        }`}
      >
        <span className={`min-w-0 flex-1 text-[13px] ${footerMessage.className}`}>{footerMessage.text}</span>
        <Button variant="secondary" onClick={handleCancel} disabled={!isDrawer && !isDirty}>
          取消
        </Button>
        <Button onClick={handleSubmit} isLoading={isLoading} disabled={!isDirty}>
          儲存變更
        </Button>
      </div>

      <ConfirmDialog
        open={confirming === "end"}
        title={isEndedByHand ? "重新開課？" : "結束這門課程？"}
        message={[
          isEndedByHand ? "課程會回到「進行中」。" : "課程會移到「已結束」，紀錄都會保留，之後可以重新開課。",
          isDirty ? "還沒儲存的變更會被捨棄。" : "",
        ].join("")}
        confirmLabel={isEndedByHand ? "重新開課" : "結束課程"}
        isLoading={isEnding || isReopening}
        onConfirm={handleEndToggle}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        title="刪除這門課程？"
        message="刪除後無法復原。"
        confirmLabel="刪除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
};

const validateForm = (data: {
  lessonName: string;
  teachers: number[];
  cards: number[];
  danceStyleId: number | null;
  dropInEnabled: boolean;
  dropInPrice: number | null | undefined;
}) => {
  const errors: FormErrors = {};
  if (!data.lessonName) {
    errors.lessonName = validationErrors.lessonName;
  }
  if (data.danceStyleId === null) {
    errors.danceStyle = validationErrors.danceStyle;
  }
  if (data.dropInPrice === undefined) {
    errors.dropInPrice = validationErrors.dropInPrice;
  }
  if (data.teachers.length === 0) {
    errors.teachers = validationErrors.teachers;
  }
  // 開了單堂付費的課可以不收課卡（全場付現）。
  if (data.cards.length === 0 && !data.dropInEnabled) {
    errors.cards = validationErrors.cards;
  }
  return errors;
};

export default SettingSection;
