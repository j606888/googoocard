"use client";

import { useGetLineBindLinkQuery } from "@/store/slices/me";
import { Skeleton } from "@/components/ui/skeleton";

// Shown on the account page. Lets a logged-in teacher bind their LINE
// account: tapping the button opens the official-account chat with a one-time
// key pre-filled — they just send it, and the webhook completes the binding.
export default function LineBindButton() {
  const { data, isLoading } = useGetLineBindLinkQuery();

  if (isLoading) return <Skeleton className="h-11 w-full rounded-xl" />;

  if (data?.bound) {
    return (
      <div className="rounded-xl bg-primary-100 px-4 py-3 text-sm text-primary-900">
        ✓ 已綁定 LINE
      </div>
    );
  }

  if (!data?.deepLink) {
    return (
      <div className="rounded-xl border border-warning-300 bg-warning-50 px-4 py-3 text-sm text-warning-950">
        LINE 綁定尚未設定完成（缺少官方帳號 ID）。
      </div>
    );
  }

  return (
    <a
      href={data.deepLink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#06C755] px-5 text-[15px] font-bold text-white"
    >
      綁定 LINE
    </a>
  );
}
