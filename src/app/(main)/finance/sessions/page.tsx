import SplitCalculator from "@/features/finance/sessions/SplitCalculator";
import { session } from "@/features/finance/mockData";

export default function FinanceSessionsPage() {
  return <SplitCalculator session={session} />;
}
