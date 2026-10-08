import { DanceType } from "@prisma/client";
import { danceTypeLabel } from "@/lib/danceTypes";

// Course levels shared by every dance type. A student's qualification stores
// the highest level they have completed; a lesson stores the level it teaches.
// Single place to rename or add a level.
export const DANCE_LEVELS = [
  { value: 1, label: "初階" },
  { value: 2, label: "中階" },
  { value: 3, label: "進階" },
] as const;

export type DanceLevel = (typeof DANCE_LEVELS)[number]["value"];

export const DEFAULT_DANCE_LEVEL: DanceLevel = 1;

export function isValidDanceLevel(value: unknown): value is DanceLevel {
  return DANCE_LEVELS.some((level) => level.value === value);
}

export function danceLevelLabel(level: number): string {
  return DANCE_LEVELS.find((l) => l.value === level)?.label ?? `Lv${level}`;
}

// "Hustle" for 初階 (what every classroom without levels sees), "Hustle 中階" above it.
export function practiceQualificationLabel(danceType: DanceType, level: number): string {
  return level > DEFAULT_DANCE_LEVEL
    ? `${danceTypeLabel(danceType)} ${danceLevelLabel(level)}`
    : danceTypeLabel(danceType);
}
