"use client";

import { Check } from "lucide-react";
import { DANCE_STYLE_COLORS, type DanceStyleColor } from "@/lib/danceStyles";
import { DANCE_STYLE_PALETTE } from "@/lib/danceStyleColors";

const COLOR_NAMES: Record<DanceStyleColor, string> = {
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
};

/** The palette swatches — dance styles and teachers pick their colour from the same keys. */
const PaletteColorPicker = ({
  value,
  onChange,
  label = "顏色",
  hint,
}: {
  value: DanceStyleColor;
  onChange: (color: DanceStyleColor) => void;
  label?: string;
  hint?: string;
}) => (
  <fieldset className="flex flex-col gap-2">
    <legend className="mb-2 font-medium">
      {label}
      {hint && <span className="ml-1 text-sm font-normal text-neutral-500">{hint}</span>}
    </legend>
    <div className="grid grid-cols-5 gap-2">
      {DANCE_STYLE_COLORS.map((key) => {
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
            } ${selected ? "ring-2 ring-offset-2 ring-neutral-800" : ""}`}
          >
            {selected && <Check className="w-5 h-5 text-white" />}
          </button>
        );
      })}
    </div>
  </fieldset>
);

export default PaletteColorPicker;
