"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGetFinanceTeachersQuery, useLinkFinanceTeacherMutation } from "@/store/slices/finance";
import { financeErrorText } from "./financeUi";

/**
 * 付款人在老師名單裡有同名、沒連帳號的老師：「這位老師是 X 本人嗎？」一鍵連結帳號。
 * 開帳清單付款人那一步、財務設定的老師付款人都用這個。沒有就什麼都不顯示。
 */
export default function TeacherLinkSuggestions({ className }: { className?: string }) {
  const { data } = useGetFinanceTeachersQuery();
  const [link, { isLoading, originalArgs }] = useLinkFinanceTeacherMutation();
  const suggestions = (data?.teachers ?? []).filter((t) => t.linkSuggestion);
  if (suggestions.length === 0) return null;

  return (
    <ul className={className}>
      {suggestions.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[13px] text-neutral-700">
          <span className="min-w-0">
            老師「{t.name}」是 {t.linkSuggestion!.name} 本人嗎？
          </span>
          <Button
            size="sm"
            variant="secondary"
            isLoading={isLoading && originalArgs?.id === t.id}
            onClick={async () => {
              try {
                await link({ id: t.id, userId: t.linkSuggestion!.userId }).unwrap();
                toast.success(`已把老師「${t.name}」連到 ${t.linkSuggestion!.name} 的帳號`);
              } catch (e) {
                toast.error(financeErrorText(e, "連結不了，請到團隊頁設定"));
              }
            }}
          >
            連結帳號
          </Button>
        </li>
      ))}
    </ul>
  );
}
