import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Period } from "@/store/slices/lessons";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function periodInfo(period?: Period) {
  if (!period) return { date: "", startHour: "", endHour: "" };

  const startTime = new Date(period.startTime);
  const endTime = new Date(period.endTime);
  const date = format(startTime, "yyyy/MM/dd (EEE)", { locale: zhTW });
  const startHour = format(startTime, "a h:mm", { locale: zhTW });
  const endHour = format(endTime, "a h:mm", { locale: zhTW });
  return { date, startHour, endHour };
}

export function formatDate(dateNumber: number | string | null, formatString = 'yyyy/MM/dd') {
  if (!dateNumber) return "-";

  const date = new Date(dateNumber);
  return format(date, formatString);
}

export function buildUrlWithParams(basePath: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.append(key, value);
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}