"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMeQuery } from "@/store/slices/me";
import { useGetFinanceSettingQuery, type FinanceSettingState } from "@/store/slices/finance";
import { UnderConstruction } from "../setup/NotBuilt";
import { financeHref } from "../routes";
import BuildWizard, { BuildClosed } from "./BuildWizard";

/** /finance/build：建城。打開那一刻就決定看到什麼，之後蓋好、交出去都不會把畫面換掉。 */
export default function BuildPage() {
  const { data } = useGetFinanceSettingQuery();
  const { data: me } = useGetMeQuery();
  if (!data || !me) return <Skeleton className="h-[680px] w-full rounded-3xl" />;
  return <BuildGate state={data} meId={me.id} />;
}

function BuildGate({ state, meId }: { state: FinanceSettingState; meId: number }) {
  const [opened] = useState(() => ({
    ready: Boolean(state.setting?.setupCompletedAt),
    built: state.splitBuilt,
    canEdit: state.canEdit,
    allowed: state.canEdit || state.isRevenueOwner,
  }));
  if (!opened.ready && !opened.allowed) return <UnderConstruction state={state} />;
  if (opened.ready && opened.built) {
    return <BuildClosed title="主堡已經蓋好了" body="居民、場地、分帳都設好了。要改分帳到分帳規則，改老師身分到老師頁。" href={financeHref.rules} cta="分帳規則" />;
  }
  if (opened.ready && !opened.canEdit) {
    return <BuildClosed title="主堡能收錢了" body="居民、場地、分帳要請能改水庫設定的人來蓋。在那之前分帳先「不用算」，收入全部留在教室。" href={financeHref.home} cta="去小鎮" />;
  }
  return <BuildWizard state={state} meId={meId} />;
}
