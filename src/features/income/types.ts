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
