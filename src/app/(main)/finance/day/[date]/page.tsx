import { notFound } from "next/navigation";
import DayBookPage from "@/features/finance/split/DayBookPage";

export default async function FinanceDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  return <DayBookPage date={date} />;
}
