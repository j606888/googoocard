"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import Field from "@/components/Field";
import InputField from "@/components/InputField";
import { Switch } from "@/components/ui/switch";
import { ABBREVIATION_MAX, DANCE_STYLE_PRESETS, defaultAbbreviation } from "@/lib/danceStyles";
import { danceStyleMeta } from "@/lib/danceStyleColors";
import { DANCE_LEVELS } from "@/lib/danceLevels";
import DanceStyleColorPicker from "./DanceStyleColorPicker";
import {
  useCreateDanceStyleMutation,
  useUpdateDanceStyleMutation,
  type DanceStyle,
} from "@/store/slices/danceStyles";

const LEVEL_NAMES = DANCE_LEVELS.map((level) => level.label).join("／");

/** First preset no style uses yet, so a new style starts distinguishable. */
function firstFreeColor(taken: DanceStyle[]): string {
  const used = new Set(taken.map((style) => style.color));
  return DANCE_STYLE_PRESETS.find((color) => !used.has(color)) ?? DANCE_STYLE_PRESETS[0];
}

/**
 * Create (`style` undefined) or edit a dance style. Mount it with a `key` per
 * open so the fields start from the style being edited.
 */
const DanceStyleForm = ({
  open,
  onClose,
  style,
  allStyles,
}: {
  open: boolean;
  onClose: () => void;
  style?: DanceStyle;
  /** Every style of the classroom, archived included — names are unique across all of them. */
  allStyles: DanceStyle[];
}) => {
  const [name, setName] = useState(style?.name ?? "");
  const [color, setColor] = useState<string>(style?.color ?? firstFreeColor(allStyles));
  const [abbreviation, setAbbreviation] = useState(style?.abbreviation ?? "");
  const [hasLevels, setHasLevels] = useState(style?.hasLevels ?? false);
  const [error, setError] = useState<string>();
  const [createDanceStyle, { isLoading: creating }] = useCreateDanceStyleMutation();
  const [updateDanceStyle, { isLoading: updating }] = useUpdateDanceStyleMutation();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("請輸入舞種名稱");
      return;
    }
    // Checked here for a friendly message; the DB unique still backs it (409).
    if (allStyles.some((other) => other.id !== style?.id && other.name === trimmed)) {
      setError("已經有同名的舞種了");
      return;
    }
    try {
      if (style) {
        await updateDanceStyle({ id: style.id, name: trimmed, color, abbreviation, hasLevels }).unwrap();
      } else {
        await createDanceStyle({ name: trimmed, color, abbreviation, hasLevels }).unwrap();
      }
      onClose();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const message = status === 409 ? "已經有同名的舞種了" : "儲存失敗，請稍後再試";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Drawer
      title={style ? `編輯 ${style.name}` : "新增舞種"}
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={creating || updating}
      submitText={style ? "儲存" : "建立"}
    >
      <form
        className="mb-6 flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <InputField
          label="名稱"
          value={name}
          placeholder="例如 Locking"
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(undefined);
          }}
        />

        <DanceStyleColorPicker value={color} onChange={setColor} />

        <div className="flex flex-col gap-2">
          <Field
            label="縮寫"
            hint={`（最多 ${ABBREVIATION_MAX} 個字，行事曆等放不下名稱的地方用）`}
            value={abbreviation}
            placeholder={defaultAbbreviation(name) || "Sa"}
            onChange={(e) => setAbbreviation(Array.from(e.target.value).slice(0, ABBREVIATION_MAX).join(""))}
          />
          <Preview name={name.trim() || "舞種"} color={color} abbreviation={abbreviation} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={hasLevels} onCheckedChange={setHasLevels} />
            <span className="text-sm font-medium text-neutral-900">分階</span>
          </label>
          <p className="text-[13px] text-neutral-500 leading-relaxed pl-10">
            開啟後，課程和學生資格可以設定 {LEVEL_NAMES}；複習卡只能用在不超過學生已完成階級的課。
            {style?.hasLevels && !hasLevels && (
              <span className="block mt-1 text-warning-950">
                關閉後已設定的階級會保留，但不再區分程度：有這個舞種資格的學生，任何課都能用複習卡。
              </span>
            )}
          </p>
        </div>
      </form>
    </Drawer>
  );
};

/** How the style will look: the calendar chip (縮寫) and the badge (名稱). */
const Preview = ({ name, color, abbreviation }: { name: string; color: string; abbreviation: string }) => {
  const meta = danceStyleMeta({ name, color, abbreviation });
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500" aria-hidden="true">
      預覽
      <span className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 leading-snug" style={meta.chip}>
        <span className="rounded-[3px] px-1 text-[10px] font-semibold leading-4" style={{ ...meta.fill, ...meta.onFill }}>
          {meta.abbr}
        </span>
        <span className="tabular-nums opacity-80">19:30</span>
      </span>
      <span className="rounded-full px-2 py-0.5 font-medium" style={meta.chip}>
        {meta.label}
      </span>
    </div>
  );
};

export default DanceStyleForm;
