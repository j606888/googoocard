"use client";

import { Copy, Ellipsis, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import ResponsiveDialog, { ResponsiveDialogTitle } from "@/components/ResponsiveDialog";
import type { InstallState } from "@/hooks/useInstallState";

/**
 * 「加入主畫面」的步驟說明。iOS 沒有安裝提示 API，只能用圖文教老師自己按。
 * LINE 等內建瀏覽器沒有這個選項，要先引導到 Safari。
 */
const InstallGuideDialog = ({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: InstallState;
}) => (
  <ResponsiveDialog open={open} onClose={onClose}>
    <div
      className="flex flex-col gap-5 px-1 pt-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/apple-touch-icon.png" alt="" className="h-12 w-12 rounded-xl" />
        <div>
          <ResponsiveDialogTitle className="text-lg font-semibold text-neutral-900">
            把 Googoocard 加到主畫面
          </ResponsiveDialogTitle>
          <p className="text-sm text-neutral-500">
            像 App 一樣開啟，畫面更大、不會被瀏覽器工具列擋住
          </p>
        </div>
      </div>

      {state === "ios-in-app" ? <InAppSteps /> : <SafariSteps />}

      <button
        onClick={onClose}
        className="w-full rounded-xl bg-primary-500 py-3 font-medium text-white active:bg-primary-600"
      >
        知道了
      </button>
    </div>
  </ResponsiveDialog>
);

const SafariSteps = () => (
  <ol className="flex flex-col gap-3">
    <Step n={1}>
      點瀏覽器的
      <Chip>
        <Share className="h-4 w-4" />
        分享
      </Chip>
      按鈕
      <p className="mt-1 text-xs text-neutral-400">
        Safari 在網址列旁邊；如果沒看到，先點
        <Ellipsis className="mx-0.5 inline h-3.5 w-3.5 align-[-2px]" />
      </p>
    </Step>
    <Step n={2}>
      往下滑，選
      <Chip>
        <SquarePlus className="h-4 w-4" />
        加入主畫面
      </Chip>
    </Step>
    <Step n={3}>
      確認「以網頁 App 打開」是開著的，按右上角「加入」
    </Step>
    <Step n={4}>之後從主畫面的 Googoocard 圖示打開就可以了</Step>
  </ol>
);

const InAppSteps = () => {
  // LINE 認得 openExternalBrowser=1，會改用系統瀏覽器開啟這個網址
  const openInSafari = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("openExternalBrowser", "1");
    window.location.href = url.toString();
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("已複製網址，請貼到 Safari 開啟");
    } catch {
      toast.error("複製失敗，請點右上角選單改用 Safari 開啟");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-warning-100 px-4 py-3 text-sm text-neutral-700">
        你現在是在 LINE（或其他 App）裡面開啟，這裡沒辦法加到主畫面，
        要先用 Safari 打開。
      </p>
      <button
        onClick={openInSafari}
        className="flex items-center justify-center rounded-xl border border-primary-500 py-3 font-medium text-primary-700 active:bg-primary-50"
      >
        用 Safari 開啟
      </button>
      <button
        onClick={copyUrl}
        className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 py-3 text-sm text-neutral-600 active:bg-neutral-50"
      >
        <Copy className="h-4 w-4" />
        複製網址，自己貼到 Safari
      </button>
      <p className="text-xs text-neutral-400">
        在 Safari 打開後，再點一次「加到主畫面」看步驟。
      </p>
    </div>
  );
};

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
      {n}
    </span>
    <div className="pt-0.5 text-[15px] leading-relaxed text-neutral-700">{children}</div>
  </li>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="mx-1 inline-flex items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 align-[1px] text-sm font-medium text-neutral-800">
    {children}
  </span>
);

export default InstallGuideDialog;
