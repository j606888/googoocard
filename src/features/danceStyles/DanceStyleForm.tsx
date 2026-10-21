"use client";

import { useState } from "react";
import { toast } from "sonner";
import Drawer from "@/components/Drawer";
import InputField from "@/components/InputField";
import { Switch } from "@/components/ui/switch";
import { DANCE_STYLE_COLORS, type DanceStyleColor } from "@/lib/danceStyles";
import { DANCE_LEVELS } from "@/lib/danceLevels";
import PaletteColorPicker from "./PaletteColorPicker";
import {
  useCreateDanceStyleMutation,
  useUpdateDanceStyleMutation,
  type DanceStyle,
} from "@/store/slices/danceStyles";

const LEVEL_NAMES = DANCE_LEVELS.map((level) => level.label).join("／");

/** First palette key no style uses yet, so a new style starts distinguishable. */
function firstFreeColor(taken: DanceStyle[]): DanceStyleColor {
  const used = new Set(taken.map((style) => style.color));
  return DANCE_STYLE_COLORS.find((color) => !used.has(color)) ?? DANCE_STYLE_COLORS[0];
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
  const [color, setColor] = useState<DanceStyleColor>(
    (style?.color as DanceStyleColor | undefined) ?? firstFreeColor(allStyles)
  );
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
        await updateDanceStyle({ id: style.id, name: trimmed, color, hasLevels }).unwrap();
      } else {
        await createDanceStyle({ name: trimmed, color, hasLevels }).unwrap();
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

        <PaletteColorPicker value={color} onChange={setColor} />

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={hasLevels} onCheckedChange={setHasLevels} />
            <span className="font-medium">分階</span>
          </label>
          <p className="text-xs text-neutral-500 leading-relaxed pl-[40px]">
            開啟後，課程和學生資格可以設定 {LEVEL_NAMES}；複習卡只能用在不超過學生已完成階級的課。
            {style?.hasLevels && !hasLevels && (
              <span className="block mt-1 text-warning-900">
                關閉後已設定的階級會保留，但不再區分程度：有這個舞種資格的學生，任何課都能用複習卡。
              </span>
            )}
          </p>
        </div>
      </form>
    </Drawer>
  );
};

export default DanceStyleForm;
