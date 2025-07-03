import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns";
import { Period } from "@/store/slices/lessons";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function periodInfo(period?: Period) {
  if (!period) return { date: "", startHour: "", endHour: "" };

  const startTime = new Date(period.startTime);
  const endTime = new Date(period.endTime);
  const date = format(startTime, "yyyy/MM/dd, EEE");
  const startHour = format(startTime, "h:mm a");
  const endHour = format(endTime, "h:mm a");
  return { date, startHour, endHour };
}

export function formatDate(dateNumber: number | string | null, formatString = 'yyyy/MM/dd') {
  if (!dateNumber) return "-";

  const date = new Date(dateNumber);
  return format(date, formatString);
}