"use client";

import { Check } from "lucide-react";
import { DANCE_STYLE_COLORS, type DanceStyleColor, type PaletteColor } from "@/lib/danceStyles";
import { DANCE_STYLE_PALETTE } from "@/lib/danceStyleColors";

const COLOR_NAMES: Record<PaletteColor, string> = {
  green: "綠",
  orange: "橘",
  slate: "灰藍",
  stone: "岩灰",
  purple: "紫",
  blue: "藍",
  pink: "粉紅",
  teal: "青綠",
  red: "紅",
  indigo: "靛藍",
  sky: "天藍",
  cyan: "青",
  emerald: "翡翠綠",
  periwinkle: "長春花藍",
  violet: "紫羅蘭",
  navy: "深藍",
  plum: "深紫",
  midnight: "午夜藍",
};

/**
 * The palette swatches. Dance styles pick from the default ten; teachers pass
 * `colors={TEACHER_COLORS}` to get the extra cool ones too.
 */
const PaletteColorPicker = <C extends PaletteColor = DanceStyleColor>({
  value,
  onChange,
  label = "顏色",
  hint,
  colors = DANCE_STYLE_COLORS as unknown as readonly C[],
}: {
  value: C;
  onChange: (color: C) => void;
  label?: string;
  hint?: string;
  colors?: readonly C[];
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="mb-2 text-sm font-medium text-neutral-900">
      {label}
      {hint && <span className="ml-1 text-sm font-normal text-neutral-500">{hint}</span>}
    </legend>
    {/* p-1：選取外框（ring-2 + offset-2）會超出格子 4px，抽屜的捲動容器會把它切掉 */}
    <div className={`grid gap-2 p-1 ${colors.length > 10 ? "grid-cols-6" : "grid-cols-5"}`}>
      {colors.map((key) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            aria-label={COLOR_NAMES[key]}
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={`h-11 rounded-lg flex items-center justify-center cursor-pointer ${
              DANCE_STYLE_PALETTE[key].bg
            } ${selected ? "ring-2 ring-offset-2 ring-neutral-900" : ""}`}
          >
            {selected && <Check className="w-5 h-5 text-white" />}
          </button>
        );
      })}
    </div>
  </fieldset>
);

export default PaletteColorPicker;
