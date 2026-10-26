import PoolDetail from "@/features/finance/funds/PoolDetail";

export default async function FinancePoolPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  return <PoolDetail poolId={poolId} />;
}
