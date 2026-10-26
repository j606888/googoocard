"use client";

import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import FinancePageHeader from "../FinancePageHeader";
import { branchPools, payroll } from "../mockData";
import { financeHref } from "../routes";
import RemitForm from "./RemitForm";

/** 繳回大水庫頁：找到小水庫，帶入保管人這個月的分潤（抵薪用）。 */
export default function Remit({ poolId }: { poolId: string }) {
  const canEdit = useCan("finance.edit");
  const pool = branchPools.find((p) => p.id === poolId);

  if (!pool) {
    return (
      <EmptyState
        title="找不到這個小水庫"
        description="可能已經改名或移除了，回資金頁看全部的小水庫。"
        action={
          <Button asChild>
            <Link href={financeHref("funds")}>回資金與繳回</Link>
          </Button>
        }
      />
    );
  }

  const keeperPayout = payroll.find((p) => p.name === pool.keeper)?.total ?? 0;

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <FinancePageHeader
        crumbs={[
          { label: "資金與繳回", href: financeHref("funds") },
          { label: pool.name, href: financeHref("pool", pool.id) },
        ]}
        title="繳回大水庫"
        description={`保管人 ${pool.keeper}`}
      />
      <RemitForm pool={pool} keeperPayout={keeperPayout} canEdit={canEdit} />
    </div>
  );
}
