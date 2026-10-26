import Remit from "@/features/finance/funds/Remit";

export default async function FinanceRemitPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  return <Remit poolId={poolId} />;
}
