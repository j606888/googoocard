import { Repeat } from "lucide-react";
import type { LessonKind } from "@/lib/lessonKind";

const OPTIONS: { value: LessonKind; title: string; body: string; outcome: string }[] = [
  {
    value: "fixed",
    title: "固定期數",
    body: "一期幾堂、先排好日期，例如 10 月班 5 堂。",
    outcome: "最後一堂點完名，自動移到「已結束」",
  },
  {
    value: "ongoing",
    title: "持續開課",
    body: "每週固定上，一堂一堂往下加，沒有結束日。",
    outcome: "點完名仍留在「進行中」，列表直接出現「＋下一堂」；不開了再手動結束",
  },
];

/** 課程型態：決定這門課什麼時候算「已結束」（src/lib/lessonKind.ts）。 */
const LessonKindSelect = ({
  kind,
  onChange,
}: {
  kind: LessonKind;
  onChange: (value: LessonKind) => void;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="mb-1.5 text-sm font-medium text-neutral-900">課程型態</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map((option) => {
        const selected = kind === option.value;
        return (
          <label
            key={option.value}
            className={`flex gap-3 p-3.5 rounded-2xl border-[1.5px] cursor-pointer transition-colors ${
              selected
                ? "bg-primary-50 border-primary-700"
                : "bg-white border-neutral-200 hover:border-primary-300"
            }`}
          >
            <input
              type="radio"
              name="lesson-kind"
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="mt-1 w-4 h-4 accent-primary-900 shrink-0"
            />
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 font-semibold text-neutral-900">
                {option.value === "ongoing" && <Repeat className="w-4 h-4" />}
                {option.title}
              </span>
              <span className="text-sm text-neutral-600">{option.body}</span>
              <span className="text-xs text-primary-700">{option.outcome}</span>
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export default LessonKindSelect;
