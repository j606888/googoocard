import HolderPage from "@/features/finance/holder/HolderPage";

export default async function FinanceHolderPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <HolderPage userId={Number(userId)} />;
}
