"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink, Info, Tablet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const setupSteps = (classroomName: string) => [
  <>用 iPad 相機掃上面的 QR，在 <b>Safari</b> 打開</>,
  <>點網址列旁的「分享」按鈕 → 往下找「<b>加入主畫面</b>」→ 新增</>,
  <>關掉 Safari，從主畫面的「<b>{classroomName} 簽到</b>」圖示打開，就是全螢幕、沒有網址列</>,
  <>設定 → 螢幕顯示與亮度 → 自動鎖定 → <b>永不</b>，並接上充電線</>,
];

/**
 * 「iPad 門口顯示」: hands the public kiosk page (/checkin-display/[key]) to an
 * iPad. The small QR is for the iPad's camera — green and dashed so nobody
 * mistakes it for the students' check-in QR above. Setup steps sit behind ⓘ
 * but open inline, since the teacher follows them on the iPad at the same time.
 */
const IpadDisplayCard = ({ displayUrl, classroomName }: { displayUrl: string; classroomName: string }) => {
  const [showSteps, setShowSteps] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayUrl);
    toast.success("已複製顯示頁連結");
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary-100 bg-primary-50 p-5 print:hidden">
      <div className="flex items-center gap-2">
        <Tablet className="size-5 text-primary-900" aria-hidden />
        <h2 className="flex-1 text-base font-bold text-primary-900">iPad 門口顯示</h2>
        <button
          type="button"
          aria-label="設定步驟"
          aria-expanded={showSteps}
          onClick={() => setShowSteps((v) => !v)}
          className={cn(
            "grid size-9 cursor-pointer place-items-center rounded-full text-primary-900 hover:bg-primary-100",
            showSteps && "bg-primary-100"
          )}
        >
          <Info className="size-5" aria-hidden />
        </button>
      </div>
      <p className="-mt-2 text-sm leading-relaxed text-neutral-600">
        讓 iPad 整天顯示大大的簽到 QR，不用登入、沒有側邊欄。
      </p>

      <div className="flex items-center gap-4">
        <div className="flex flex-none flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-primary-300 bg-white p-2.5">
          <QRCodeSVG value={displayUrl} size={104} fgColor="#1B5E4A" />
          <span className="text-xs font-semibold text-primary-900">用 iPad 掃這個</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-900 text-sm font-semibold text-white hover:bg-primary-800"
          >
            <ExternalLink className="size-4" aria-hidden />
            開啟獨立顯示
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary-100 bg-white text-sm font-semibold text-primary-900 hover:bg-primary-50"
          >
            <Copy className="size-4" aria-hidden />
            複製顯示頁連結
          </button>
        </div>
      </div>

      {showSteps && (
        <div className="flex flex-col gap-3 rounded-xl bg-white p-4">
          <p className="text-sm font-bold text-primary-900">第一次設定（約 2 分鐘）</p>
          <ol className="flex flex-col gap-3 text-sm leading-relaxed text-neutral-700">
            {setupSteps(classroomName).map((step, i) => (
              <li key={i} className="flex gap-3">
                <StepNumber n={i + 1} />
                <span>{step}</span>
              </li>
            ))}
            <li className="flex gap-3">
              <StepNumber n={5} muted />
              <span>
                <span className="text-neutral-500">（選用）</span>設定 → 輔助使用 → <b>引導使用模式</b>
                打開；之後在簽到畫面連按三下頂端按鈕，學生就跳不出這個畫面
              </span>
            </li>
          </ol>
          <p className="border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
            按「重新產生 QR Code」後，iPad 上會顯示「已失效」，重新掃一次上面的 QR 即可。
          </p>
        </div>
      )}
    </section>
  );
};

const StepNumber = ({ n, muted }: { n: number; muted?: boolean }) => (
  <span
    className={cn(
      "grid size-6 flex-none place-items-center rounded-full text-xs font-bold",
      muted ? "bg-neutral-100 text-neutral-500" : "bg-primary-100 text-primary-900"
    )}
  >
    {n}
  </span>
);

export default IpadDisplayCard;
