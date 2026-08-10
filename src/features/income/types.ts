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
