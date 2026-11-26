"use client";

import { Lesson } from "@/store/slices/lessons";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DropInPriceField, {
  type DropInPlans,
  buildDropInOptions,
  dropInPlansFrom,
  parseDropInPrice,
} from "@/features/lessons/newLesson/DropInPriceField";
import type { LessonKind } from "@/lib/lessonKind";
import TermPriceField, { type TermDraft, parseTermDraft, termDraftFrom } from "@/features/lessons/newLesson/TermPriceField";
import LessonGroupSelect from "@/features/lessons/newLesson/LessonGroupSelect";
import {
  CheckRow,
  DisclosureRow,
  GroupedLook,
  GroupedRow,
  GroupedSection,
  InlineInput,
  SegmentedControl,
} from "@/features/lessons/newLesson/grouped";
import {
  AssistantGroup,
  CardGroup,
  TeacherGroup,
  ToggleSwitch,
} from "@/features/lessons/newLesson/groupedFields";
import { useDanceStyles } from "@/hooks/useDanceStyles";
import { useLocations } from "@/hooks/useLocations";
import { useGetLessonGroupsQuery } from "@/store/slices/lessonGroups";
import { DANCE_LEVELS } from "@/lib/danceLevels";
import ConfirmDialog from "@/components/ConfirmDialog";
import DanceStyleDot from "@/components/DanceStyleDot";
import InfoTip from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import {
  useUpdateLessonMutation,
  useDeleteLessonMutation,
  useEndLessonMutation,
  useReopenLessonMutation,
  useGetLessonEnrollmentsQuery,
} from "@/store/slices/lessons";
import { useRouter } from "next/navigation";

const validationErrors = {
  lessonName: "請輸入課程名稱",
  teachers: "請至少選擇一位老師",
  cards: "請至少選擇一張課卡",
  danceStyle: "請選擇舞種",
  dropInPrice: "請輸入單堂價",
  term: "整期價要填金額，堂數 1–52 堂",
};

type FormErrors = Partial<Record<keyof typeof validationErrors, string>>;

/**
 * 課程頁「設定」分頁（去框線）：沒有底色、沒有白卡——幾組細線分隔的列，電腦排兩欄，
 * 大部分設定不用捲就看得到。先看再改：每一列就是目前的值，清單類（課種、舞種、分部、
 * 課卡、老師、小幫手）平常只顯示選到的，按「更改」才在原地展開。
 *
 * 整頁一起存（一門課的設定互相牽動：不收課卡只有開了單堂付費或整期才成立），
 * 有變更時底下才浮出「取消／儲存」。
 */
type Picker = "group" | "danceStyle" | "location";

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

const SettingSection = ({
  lesson,
  onDirtyChange,
}: {
  lesson: Lesson;
  /** Lets the parent ask before throwing unsaved edits away. */
  onDirtyChange?: (dirty: boolean) => void;
}) => {
  /** 哪一列的選項正攤開（一次一列）。 */
  const [picker, setPicker] = useState<Picker | null>(null);
  const pickerProps = (name: Picker) => ({
    open: picker === name,
    onOpenChange: (open: boolean) => setPicker(open ? name : null),
  });
  const rootRef = useRef<HTMLDivElement>(null);

  const [lessonName, setLessonName] = useState(lesson.name);
  const [danceStyleId, setDanceStyleId] = useState<number | null>(lesson.danceStyleId);
  const { styles, byId } = useDanceStyles();
  const { all: allLocations, locations } = useLocations();
  const { data: groups } = useGetLessonGroupsQuery();
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
  const [termDraft, setTermDraft] = useState<TermDraft>(() => termDraftFrom(lesson));
  // 已有人報整期 → 整期價與堂數鎖住（伺服器 TERM_LOCKED）。
  const { data: enrollmentRoster } = useGetLessonEnrollmentsQuery(
    { id: lesson.id },
    { skip: lesson.termPrice == null || lesson.termSessions == null }
  );
  const enrolledCount = enrollmentRoster?.enrollments.length ?? 0;
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
  // (and refetches) clears it by itself.
  const isDirty = useMemo(() => {
    const savedDropIn = lesson.dropInPrice !== null ? String(lesson.dropInPrice) : "";
    return (
      lessonName !== lesson.name ||
      danceStyleId !== lesson.danceStyleId ||
      level !== lesson.level ||
      kind !== lesson.kind ||
      sessionsPerAttendance !== lesson.sessionsPerAttendance ||
      dropInEnabled !== (lesson.dropInPrice !== null) ||
      (dropInEnabled && dropInAmount !== savedDropIn) ||
      (dropInEnabled &&
        JSON.stringify(dropInPlans) !== JSON.stringify(dropInPlansFrom(lesson.dropInOptions))) ||
      !sameIds(selectedTeacherIds, lesson.teachers.map((t) => t.id)) ||
      !sameIds(selectedAssistantIds, lesson.assistants.map((a) => a.id)) ||
      !sameIds(selectedCardIds, lesson.cards.map((c) => c.id)) ||
      groupId !== lesson.groupId ||
      locationId !== (lesson.location?.id ?? null) ||
      JSON.stringify(termDraft) !== JSON.stringify(termDraftFrom(lesson))
    );
  }, [
    lesson, lessonName, danceStyleId, level, kind, sessionsPerAttendance, dropInEnabled,
    dropInAmount, dropInPlans, selectedTeacherIds, selectedAssistantIds, selectedCardIds, groupId,
    locationId, termDraft,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const errorCount = Object.values(errors).filter(Boolean).length;

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
      termEnabled: termDraft.enabled && kind !== "ongoing",
    });
    const term = kind === "ongoing" ? { termPrice: null, termSessions: null } : parseTermDraft(termDraft);
    if (term === undefined) next.term = validationErrors.term;
    const dropInOptions = buildDropInOptions(dropInEnabled, dropInAmount, dropInPlans);
    if (!next.dropInPrice && dropInOptions === undefined) {
      next.dropInPrice = "每個方案都要有名稱和金額，名稱不能重複";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // 錯誤寫在那一組下面——捲到第一個，不然可能在畫面外。
      requestAnimationFrame(() =>
        rootRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "center", behavior: "smooth" })
      );
      return;
    }
    if (danceStyleId === null || dropInPrice === undefined || dropInOptions === undefined || term === undefined) return;
    try {
      await updateLesson({
        id: lesson.id,
        draftLesson: {
          lessonName, teacherIds: selectedTeacherIds, assistantIds: selectedAssistantIds,
          cardIds: selectedCardIds, danceStyleId,
          level, kind, sessionsPerAttendance, dropInPrice, dropInOptions, groupId, locationId,
          ...term,
        },
      }).unwrap();
    } catch (error) {
      const code = (error as { data?: { error?: string } })?.data?.error;
      toast.error(
        code === "TERM_SESSIONS_EXCEEDED"
          ? "已經排的時段比整期堂數多，先刪掉多的時段"
          : code === "TERM_LOCKED"
            ? "已經有人報整期，整期價和堂數不能改"
            : code === "TERM_REQUIRES_FIXED"
              ? "報整期的課要是「固定期數」"
              : "儲存失敗，請再試一次"
      );
      return;
    }
    toast.success("已儲存");
    setPicker(null);
  };

  const handleCancel = () => {
    // 取消 = 回到已儲存的樣子。
    setLessonName(lesson.name);
    setDanceStyleId(lesson.danceStyleId);
    setLevel(lesson.level);
    setKind(lesson.kind);
    setSessionsPerAttendance(lesson.sessionsPerAttendance);
    setDropInEnabled(lesson.dropInPrice !== null);
    setDropInAmount(lesson.dropInPrice !== null ? String(lesson.dropInPrice) : "");
    setDropInPlans(dropInPlansFrom(lesson.dropInOptions));
    setTermDraft(termDraftFrom(lesson));
    setSelectedTeacherIds(lesson.teachers.map((t) => t.id));
    setSelectedAssistantIds(lesson.assistants.map((a) => a.id));
    setSelectedCardIds(lesson.cards.map((c) => c.id));
    setGroupId(lesson.groupId);
    setLocationId(lesson.location?.id ?? null);
    setErrors({});
    setPicker(null);
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
  };

  const handleDelete = () => {
    setConfirming(null);
    onDirtyChange?.(false);
    router.push("/lessons");
    deleteLesson(lesson.id);
  };

  const currentStyle = danceStyleId !== null ? (byId.get(danceStyleId) ?? lesson.danceStyle) : null;
  const currentLocation = allLocations.find((l) => l.id === locationId);
  // 封存的分部不給新選，但這門課已經掛著的照樣列出。
  const locationOptions = currentLocation?.archivedAt ? [...locations, currentLocation] : locations;
  const groupName = groupId !== null ? (groups?.find((g) => g.id === groupId)?.name ?? lesson.group?.name) : null;

  const footerMessage =
    errorCount > 0
      ? { text: `有 ${errorCount} 個地方要修正才能儲存`, className: "font-semibold text-danger-700" }
      : { text: "有還沒儲存的變更", className: "font-semibold text-warning-800" };

  const band = <div aria-hidden className="-mx-5 my-7 h-2 bg-band lg:hidden" />;

  return (
    <GroupedLook value="plain">
      <div ref={rootRef} className="flex flex-col px-5 pt-6 pb-28 lg:px-0 lg:pt-0 lg:pb-6">
        <div className="lg:grid lg:max-w-[1180px] lg:grid-cols-2 lg:items-start lg:gap-x-16">
          <div className="flex flex-col lg:gap-9">
            <section aria-labelledby="lesson-setting-basic">
              <h3 id="lesson-setting-basic" className={GROUP_HEADING}>
                基本
              </h3>
              <GroupedSection error={errors.lessonName ?? errors.danceStyle}>
                <DisclosureRow
                  label="課種"
                  value={groupName ?? <span className="text-ink-3">未分類</span>}
                  {...pickerProps("group")}
                >
                  <div className="py-3">
                    <LessonGroupSelect hideLabel groupId={groupId} onChange={setGroupId} />
                  </div>
                </DisclosureRow>
                <InlineInput
                  label="這一期的名稱"
                  placeholder="例：Bachata Lv1"
                  value={lessonName}
                  onChange={(value) => {
                    clearError("lessonName");
                    setLessonName(value);
                  }}
                />
                <DisclosureRow
                  label="舞種"
                  value={
                    currentStyle ? (
                      <>
                        <DanceStyleDot style={currentStyle} />
                        <span className="truncate">{currentStyle.name}</span>
                      </>
                    ) : (
                      <span className="text-ink-3">還沒選</span>
                    )
                  }
                  {...pickerProps("danceStyle")}
                >
                  {styles.map((style) => (
                    <CheckRow
                      key={style.id}
                      checked={style.id === danceStyleId}
                      leading={<DanceStyleDot style={style} />}
                      onToggle={() => {
                        setDanceStyleId(style.id);
                        clearError("danceStyle");
                        setPicker(null);
                      }}
                    >
                      {style.name}
                    </CheckRow>
                  ))}
                </DisclosureRow>
                {hasLevels && (
                  <GroupedRow label="階級">
                    <SegmentedControl
                      ariaLabel="階級"
                      className="w-56"
                      value={level}
                      onChange={setLevel}
                      options={DANCE_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                    />
                  </GroupedRow>
                )}
                <GroupedRow
                  label={
                    <span className="inline-flex items-center gap-0.5">
                      型態
                      <InfoTip label="課程型態說明">
                        固定堂數：先排好幾堂，上完自動結束。
                        <br />
                        持續開課：一堂一堂往下加，你按結束才結束。
                      </InfoTip>
                    </span>
                  }
                >
                  <SegmentedControl
                    ariaLabel="課程型態"
                    className="w-52"
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "fixed", label: "固定堂數" },
                      { value: "ongoing", label: "持續開課" },
                    ]}
                  />
                </GroupedRow>
                <GroupedRow label="每次扣幾格">
                  <SegmentedControl
                    ariaLabel="每次扣幾格"
                    className="w-40"
                    value={sessionsPerAttendance}
                    onChange={setSessionsPerAttendance}
                    options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
                  />
                </GroupedRow>
                {locationOptions.length > 0 && (
                  <DisclosureRow
                    label="分部"
                    value={currentLocation?.name ?? <span className="text-ink-3">不指定</span>}
                    {...pickerProps("location")}
                  >
                    {locationOptions.map((location) => (
                      <CheckRow
                        key={location.id}
                        checked={location.id === locationId}
                        onToggle={() => {
                          setLocationId(location.id);
                          setPicker(null);
                        }}
                      >
                        {location.name}
                      </CheckRow>
                    ))}
                    <CheckRow
                      checked={locationId === null}
                      onToggle={() => {
                        setLocationId(null);
                        setPicker(null);
                      }}
                    >
                      <span className="text-ink-3">不指定</span>
                    </CheckRow>
                  </DisclosureRow>
                )}
              </GroupedSection>
            </section>

            {band}

            <section aria-labelledby="lesson-setting-people">
              <h3 id="lesson-setting-people" className={GROUP_HEADING}>
                老師與小幫手
              </h3>
              <div className="flex flex-col gap-3">
                <TeacherGroup
                  selectedOnly
                  selectedTeacherIds={selectedTeacherIds}
                  onChange={(value) => {
                    setSelectedTeacherIds(value);
                    // 同一個人不能又是老師又是小幫手——選成老師就從小幫手拿掉。
                    setSelectedAssistantIds((prev) => prev.filter((id) => !value.includes(id)));
                    clearError("teachers");
                  }}
                  error={errors.teachers}
                />
                <AssistantGroup
                  selectedOnly
                  selectedAssistantIds={selectedAssistantIds}
                  teacherIds={selectedTeacherIds}
                  onChange={setSelectedAssistantIds}
                />
              </div>
            </section>
          </div>

          {band}

          <div className="flex flex-col lg:gap-9">
            <section aria-labelledby="lesson-setting-pay">
              <h3 id="lesson-setting-pay" className={GROUP_HEADING}>
                收費
              </h3>
              <div className="flex flex-col gap-3">
                <CardGroup
                  selectedOnly
                  selectedCardIds={selectedCardIds}
                  onChange={(value) => {
                    setSelectedCardIds(value);
                    clearError("cards");
                  }}
                  danceStyleId={danceStyleId}
                  error={errors.cards}
                />
                <div>
                  <GroupedSection error={errors.dropInPrice}>
                    <div className="py-3">
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
                      />
                    </div>
                  </GroupedSection>
                  <GroupedSection error={errors.term}>
                    <TermPriceField
                      draft={termDraft}
                      kind={kind}
                      periodCount={lesson.periods.length}
                      lockedReason={enrolledCount > 0 ? `已有 ${enrolledCount} 人報名，整期價和堂數不能改。` : undefined}
                      onChange={(draft) => {
                        setTermDraft(draft);
                        setErrors((prev) => ({ ...prev, term: undefined, cards: undefined }));
                      }}
                      toggle={(checked, onToggle) => <ToggleSwitch checked={checked} onChange={onToggle} label="報名整期" />}
                    />
                  </GroupedSection>
                </div>
              </div>
            </section>

            {band}

            {/* 結束／刪除：放最後、跟設定分開，文字按鈕。 */}
            <section aria-labelledby="lesson-setting-status">
              <h3 id="lesson-setting-status" className={GROUP_HEADING}>
                {isEndedByHand ? "重新開課" : "結束這門課"}
              </h3>
              <p className="text-[13px] leading-relaxed text-ink-3">
                {isEndedByHand
                  ? "這門課已手動結束；重新開課或排新時段都會回到「進行中」。"
                  : "紀錄都會保留，之後可以重新開課。"}
                {hasNoPeriods && "還沒排時段的課可以直接刪除，刪了無法復原。"}
              </p>
              <div className="-ml-2 mt-1 flex flex-wrap items-center gap-x-3">
                <button
                  type="button"
                  onClick={() => setConfirming("end")}
                  className={`${DANGER_TEXT_BUTTON} text-warning-800 hover:bg-warning-100`}
                >
                  {isEndedByHand ? "重新開課" : "結束課程"}
                </button>
                {hasNoPeriods && (
                  <button
                    type="button"
                    onClick={() => setConfirming("delete")}
                    disabled={isDeleting}
                    className={`${DANGER_TEXT_BUTTON} text-danger-700 hover:bg-danger-50 disabled:opacity-50`}
                  >
                    刪除課程
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>

        {(isDirty || errorCount > 0) && (
          <div
            data-in-app="flush-bottom"
            // Clears the floating BottomNav, like StudentDetail's action bar.
            className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 -mx-2 mt-6 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_-12px_rgba(16,28,23,0.25)] border border-line lg:bottom-6 lg:mx-0 lg:max-w-[1180px]"
          >
            <span className={`min-w-0 flex-1 text-[13px] ${footerMessage.className}`}>{footerMessage.text}</span>
            <Button variant="text" onClick={handleCancel} disabled={!isDirty}>
              取消
            </Button>
            <Button onClick={handleSubmit} isLoading={isLoading} disabled={!isDirty}>
              儲存
            </Button>
          </div>
        )}
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
    </GroupedLook>
  );
};

const GROUP_HEADING = "pb-1 text-[17px] font-semibold text-ink";
const DANGER_TEXT_BUTTON =
  "flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-300";

const validateForm = (data: {
  lessonName: string;
  teachers: number[];
  cards: number[];
  danceStyleId: number | null;
  dropInEnabled: boolean;
  dropInPrice: number | null | undefined;
  termEnabled: boolean;
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
  // 開了單堂付費或整期的課可以不收課卡。
  if (data.cards.length === 0 && !data.dropInEnabled && !data.termEnabled) {
    errors.cards = validationErrors.cards;
  }
  return errors;
};

export default SettingSection;
