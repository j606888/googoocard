"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import { useSizeClass } from "@/hooks/useMediaQuery";
import FinancePageHeader from "../FinancePageHeader";
import { transactions } from "../mockData";
import type { Transaction } from "../types";
import { LaterAction } from "../ui";
import { EntryFormDrawer, EntryFormPanel, type TransactionDraft } from "./EntryForm";
import LedgerTable from "./LedgerTable";

/**
 * 流水帳：桌面左表格右「記一筆」；手機單欄，「記一筆」開抽屜。
 * 只掛一棵（useSizeClass）：表單有狀態，兩邊都掛會各自一份（docs/ui-responsive.md）。
 */
export default function Ledger() {
  const canEdit = useCan("finance.edit");
  const sizeClass = useSizeClass();
  const [rows, setRows] = useState<Transaction[]>(transactions);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 示意：新的一筆只加在畫面上，重新整理就不見。
  const add = (draft: TransactionDraft) =>
    setRows((current) => [{ ...draft, id: Math.max(0, ...current.map((tx) => tx.id)) + 1 }, ...current]);

  const sidePanel = canEdit && sizeClass === "expanded";

  return (
    <div className={sidePanel ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" : "flex flex-col"}>
      <div className="flex min-w-0 flex-col gap-4">
        <FinancePageHeader
          title="流水帳"
          description="每一筆錢的進出 · 只能新增與沖銷，不能修改"
          actions={
            <>
              <LaterAction size="sm">匯出 CSV</LaterAction>
              {canEdit && sizeClass === "compact" && (
                <Button onClick={() => setDrawerOpen(true)}>
                  <Plus className="size-4" />
                  記一筆
                </Button>
              )}
            </>
          }
        />
        <LedgerTable rows={rows} />
      </div>

      {sidePanel && (
        <div className="sticky top-6">
          <EntryFormPanel onSave={add} />
        </div>
      )}
      {canEdit && sizeClass === "compact" && (
        <EntryFormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSave={add} />
      )}
    </div>
  );
}
