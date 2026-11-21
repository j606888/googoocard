"use client";

import { Check, Pipette } from "lucide-react";
import { DANCE_STYLE_PRESETS, HEX_COLOR_RE, type PaletteColor } from "@/lib/danceStyles";
import { danceStyleHex, danceStyleTones } from "@/lib/danceStyleColors";
import { COLOR_NAMES } from "./PaletteColorPicker";

const PRESETS: readonly string[] = DANCE_STYLE_PRESETS;

/**
 * A dance style's colour: the preset swatches, plus a last 自訂 swatch that opens
 * the system colour picker and stores a `#rrggbb`. A style still on a retired key
 * (orange/red) shows that colour in the 自訂 slot, so it stays selected until changed.
 */
const DanceStyleColorPicker = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) => {
  const isCustom = !PRESETS.includes(value);
  const customHex = danceStyleHex(value);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-neutral-900">顏色</legend>
      {/* p-1：選取外框（ring-2 + offset-2）會超出格子 4px，抽屜的捲動容器會把它切掉 */}
      <div className="grid grid-cols-6 gap-2 p-1">
        {DANCE_STYLE_PRESETS.map((key) => {
          const selected = key === value;
          const tones = danceStyleTones(key);
          return (
            <button
              key={key}
              type="button"
              aria-label={COLOR_NAMES[key as PaletteColor]}
              aria-pressed={selected}
              onClick={() => onChange(key)}
              className={`h-11 rounded-lg flex items-center justify-center cursor-pointer ${
                selected ? "ring-2 ring-offset-2 ring-neutral-900" : ""
              }`}
              style={tones.fill}
            >
              {selected && <Check className="w-5 h-5" style={tones.onFill} />}
            </button>
          );
        })}

        {/* 自訂：透明的 <input type="color"> 蓋在格子上，點了直接開系統調色盤 */}
        <label
          className={`relative h-11 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden ${
            isCustom ? "ring-2 ring-offset-2 ring-neutral-900" : ""
          }`}
          style={
            isCustom
              ? danceStyleTones(value).fill
              : { background: "conic-gradient(#f43f5e, #f59e0b, #84cc16, #10b981, #0ea5e9, #6366f1, #d946ef, #f43f5e)" }
          }
        >
          {isCustom ? (
            <Check className="w-5 h-5" style={danceStyleTones(value).onFill} />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-white/90">
              <Pipette className="size-4 text-neutral-700" />
            </span>
          )}
          <input
            type="color"
            aria-label="自訂顏色"
            value={customHex}
            onChange={(e) => {
              const hex = e.target.value.toLowerCase();
              if (HEX_COLOR_RE.test(hex)) onChange(hex);
            }}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      {isCustom && (
        <p className="text-[13px] text-neutral-500">
          自訂顏色 <span className="font-mono uppercase">{customHex}</span>
          <span className="ml-1">· 點最後一格可以再調</span>
        </p>
      )}
    </fieldset>
  );
};

export default DanceStyleColorPicker;
