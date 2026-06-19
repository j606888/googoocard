"use client";

import { useGetLineBindLinkQuery } from "@/store/slices/me";

// Shown on the teams/settings page. Lets a logged-in teacher bind their LINE
// account: tapping the button opens the official-account chat with a one-time
// key pre-filled — they just send it, and the webhook completes the binding.
export default function LineBindButton() {
  const { data, isLoading } = useGetLineBindLinkQuery();

  if (isLoading) return null;

  if (data?.bound) {
    return (
      <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
        ✓ 已綁定 LINE
      </div>
    );
  }

  if (!data?.deepLink) {
    return (
      <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        LINE 綁定尚未設定完成（缺少官方帳號 ID）。
      </div>
    );
  }

  return (
    <a
      href={data.deepLink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-3 font-semibold text-white"
    >
      綁定 LINE
    </a>
  );
}
