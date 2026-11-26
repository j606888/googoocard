import type { DanceStyleSummary } from "@/lib/danceStyles";
import type { LocationSummary } from "@/lib/locations";

export interface IncomeRecord {
  id: number;
  createdAt: string;
  finalPrice: number;
  student: { name: string };
  card: { name: string };
}

export interface IncomeResponse {
  records: IncomeRecord[];
  hasMore: boolean;
}

export interface DailySummaryPeriod {
  lessonId: number;
  periodId: number;
  lessonName: string;
  /** 每次出席扣幾格（外師課 = 2）。 */
  sessionsPerAttendance: number;
  /** 這堂課的分部；沒指定是 null。 */
  location: LocationSummary | null;
  attendanceCount: number;
  revenue: number;
  pendingStudents: string[];
}

export interface DailySummaryResponse {
  selectedDate: string;
  totalRevenue: number;
  periods: DailySummaryPeriod[];
}

export interface DailySummaryOptionsResponse {
  years: number[];
  dates: string[];
}

export interface DailyTotal {
  date: string;
  totalRevenue: number;
}

export interface DailySummaryListResponse {
  years: number[];
  days: DailyTotal[];
}

export interface CardMonthlyTotal {
  month: string; // YYYY-MM
  totalRevenue: number;
  unpaidTotal: number;
  count: number;
}

export interface CardMonthlyListResponse {
  years: number[];
  months: CardMonthlyTotal[];
}

export interface CardPurchase {
  id: number;
  date: string; // YYYY-MM-DD
  studentId: number;
  studentName: string;
  cardName: string;
  finalPrice: number;
  isPaid: boolean;
}

export interface CardMonthlyDetailResponse {
  month: string;
  totalRevenue: number;
  unpaidTotal: number;
  purchases: CardPurchase[];
}

export interface SessionMonthlyResponse {
  month: string;
  totalRevenue: number;
  byDanceStyle: { danceStyle: DanceStyleSummary; revenue: number }[];
  /** 依分部（課程的分部），金額大的在前；`location: null` = 未指定分部。 */
  byLocation: { location: LocationSummary | null; revenue: number }[];
}
