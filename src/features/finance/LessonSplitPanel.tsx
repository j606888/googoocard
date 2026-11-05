"use client";

import { useState } from "react";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import InfoTip from "@/components/InfoTip";
import Select from "@/components/Select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { splitRuleSchema } from "@/domains/finance/types";
import type { Lesson, LessonStudent } from "@/store/slices/lessons";
import {
  useCopyLessonRuleMutation,
  useDeletePeriodRuleMutation,
  useGetLessonPeriodFinanceQuery,
  useGetLessonRuleQuery,
  useGetRuledLessonsQuery,
  useLazyGetPeriodRuleQuery,
  useSaveLessonRuleMutation,
  useSavePeriodRuleMutation,
} from "@/store/slices/finance";
import { RuleEditorDrawer } from "./RuleEditor";
import PeriodSplitRow from "./PeriodSplitRow";
import { describeRow, emptyRows, rowsToRule, ruleToRows, type RuleRow } from "./ruleEditorModel";
import { useSplitNames } from "./useSplitNames";

/** 課程頁的「分帳」：規則（一門課設一次）＋每堂的明細。只有財務能改。 */
export default function LessonSplitPanel({ lesson, students }: { lesson: Lesson; students: LessonStudent[] }) {
  const names = useSplitNames();
  const { data: ruleData, isLoading: ruleLoading } = useGetLessonRuleQuery(lesson.id);
  const { data: periods, isLoading: periodsLoading } = useGetLessonPeriodFinanceQuery(lesson.id);
  // 只列有分帳規則的課，沒規則的複製了也沒用。
  const { data: lessonsData } = useGetRuledLessonsQuery();
  const [saveLesson, { isLoading: savingLesson }] = useSaveLessonRuleMutation();
  const [copyRule, { isLoading: copying }] = useCopyLessonRuleMutation();
  const [savePeriod, { isLoading: savingPeriod }] = useSavePeriodRuleMutation();
  const [resetPeriod] = useDeletePeriodRuleMutation();
  const [fetchPeriodRule] = useLazyGetPeriodRuleQuery();
  const [seed, setSeed] = useState<RuleRow[] | null>(null);
  const [editing, setEditing] = useState<"lesson" | number | null>(null);
  const [copyFrom, setCopyFrom] = useState<number | null>(null);

  const parsed = ruleData?.rule ? splitRuleSchema.safeParse(ruleData.rule) : null;
  const rule = parsed?.success ? parsed.data : null;
  const defaultFund = lesson.locationId ?? names.locations[0]?.id ?? 0;
  const startRows = seed ?? (rule ? ruleToRows(rule) : emptyRows(defaultFund));
  const studentName = (id: number) => students.find((s) => s.id === id)?.name ?? "學員";

  if (ruleLoading || periodsLoading || !names.ready) {
    return (
      <div className="flex flex-col gap-3 px-5 py-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  const close = () => {
    setEditing(null);
    setSeed(null);
  };
  const run = async (p: Promise<unknown>, ok: string): Promise<boolean> => {
    try {
      await p;
      toast.success(ok);
      close();
      return true;
    } catch (e) {
      const code = (e as { data?: { code?: string } })?.data?.code;
      toast.error(code === "NO_RULE" ? "那門課還沒設分帳規則" : "儲存失敗，請再試一次");
      return false;
    }
  };
  const openOverride = async (p: { periodId: number; ruleSource: string }) => {
    if (p.ruleSource === "override") {
      try {
        const r = await fetchPeriodRule(p.periodId).unwrap();
        const parsedOverride = r.rule ? splitRuleSchema.safeParse(r.rule) : null;
        if (parsedOverride?.success) setSeed(ruleToRows(parsedOverride.data));
      } catch {
        toast.error("讀不到這一堂的規則");
        return;
      }
    }
    setEditing(p.periodId);
  };
  const onSave = (rows: RuleRow[]) => {
    const next = rowsToRule(rows);
    return editing === "lesson"
      ? run(saveLesson({ lessonId: lesson.id, rule: next }).unwrap(), "已儲存分帳規則")
      : run(savePeriod({ periodId: editing as number, rule: next }).unwrap(), "這一堂已改用特別的規則");
  };

  const copyOptions = (lessonsData?.lessons ?? [])
    .filter((l) => l.id !== lesson.id)
    .map((l) => ({ value: l.id, label: l.name }));

  return (
    <section className="flex flex-col gap-4 px-5 py-4">
      <div className="flex items-center gap-1">
        <h3 className="text-base font-bold text-neutral-900">分帳規則</h3>
        <InfoTip label="分帳說明">規則設一次，套用到這門課的每一堂。收到錢才算收入；沒付的和沒決定的會標在每堂下面。</InfoTip>
        {names.canEdit && (
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setEditing("lesson")}>
            {rule ? "編輯規則" : "設定規則"}
          </Button>
        )}
      </div>

      {rule ? (
        <ol className="flex flex-col gap-1 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-800">
          {ruleToRows(rule).map((row, i) => (
            <li key={i}>{describeRow(row, names)}</li>
          ))}
        </ol>
      ) : (
        <EmptyState kind="inline" title="這門課還沒設分帳" description="設好之前，已收的錢先放在未分配。" />
      )}

      {names.canEdit && copyOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            size="sm"
            aria-label="從另一門課複製"
            className="min-w-0 flex-1"
            placeholder="從另一門課複製規則"
            value={copyFrom ?? undefined}
            options={copyOptions}
            onChange={setCopyFrom}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={copyFrom === null}
            isLoading={copying}
            onClick={() =>
              copyFrom !== null &&
              run(copyRule({ lessonId: lesson.id, fromLessonId: copyFrom }).unwrap(), "已複製規則").then(
                (ok) => ok && setCopyFrom(null)
              )
            }
          >
            複製
          </Button>
        </div>
      )}

      <h3 className="text-base font-bold text-neutral-900">每一堂</h3>
      {periods && periods.length > 0 ? (
        <ul className="flex flex-col">
          {periods.map((p) => (
            <PeriodSplitRow
              key={p.periodId}
              period={p}
              names={names}
              studentName={studentName}
              canEdit={names.canEdit}
              onOverride={() => openOverride(p)}
              onResetOverride={() => run(resetPeriod({ periodId: p.periodId }).unwrap(), "已還原成課程規則")}
            />
          ))}
        </ul>
      ) : (
        <EmptyState kind="inline" title="還沒有點名的時段" description="點完名才會有分帳。" />
      )}

      {editing !== null && (
        <RuleEditorDrawer
          open
          title={editing === "lesson" ? "分帳規則" : "只改這一堂"}
          subtitle={editing === "lesson" ? lesson.name : "其他堂不受影響"}
          initialRows={startRows}
          names={names}
          isLoading={savingLesson || savingPeriod}
          onClose={close}
          onSave={onSave}
        />
      )}
    </section>
  );
}
