"use client";

import { useState } from "react";
import { Smartphone, X } from "lucide-react";
import { useInstallState } from "@/hooks/useInstallState";
import InstallGuideDialog from "./InstallGuideDialog";

/**
 * iPhone 上還沒加到主畫面時，在內容頂端顯示的一次性提示。
 * 關掉後記在 localStorage 不再出現；之後仍可從「更多」裡的入口打開說明。
 */
const InstallBanner = () => {
  const { state, canGuide, bannerDismissed, dismissBanner } = useInstallState();
  const [guideOpen, setGuideOpen] = useState(false);

  if (!canGuide || bannerDismissed) return null;

  return (
    <>
      <div className="lg:hidden mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-primary-50 py-2.5 pl-3 pr-1.5">
        <Smartphone className="h-5 w-5 shrink-0 text-primary-700" />
        <button
          onClick={() => setGuideOpen(true)}
          className="flex-1 text-left text-sm text-primary-900"
        >
          加到主畫面，像 App 一樣使用
          <span className="ml-1 font-semibold underline underline-offset-2">看怎麼做</span>
        </button>
        <button
          onClick={dismissBanner}
          aria-label="不再顯示"
          className="rounded-full p-2 text-primary-700 active:bg-primary-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <InstallGuideDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        state={state}
      />
    </>
  );
};

export default InstallBanner;
