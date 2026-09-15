"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * 左邊名單常駐、右邊換內容不換頁的分割檢視，外加「選取狀態鏡射到網址」。
 *
 * 選取狀態同時活在兩個地方，各有理由（這個行為是實測出來的，別改）：
 *   - React state 是**畫面的真相**。`router.replace` 只改 query 時不會讓
 *     `useSearchParams()` 重繪，靠網址驅動畫面會整個選不動；而且換一筆
 *     也不該等一次 soft navigation。
 *   - 網址是**可分享的鏡射**。用 `history.replaceState` 寫回，所以連續看
 *     十筆不會在瀏覽紀錄堆十筆，重新整理或把連結貼給別人也還是同一筆。
 *
 * 鍵盤操作（↑↓ / `/` / Enter）目前留在名單元件裡——它和列表語意綁得比較緊。
 */
export const useSelectionMirroredToUrl = (
  /** 網址上的參數名，例如 `"sel"`。 */
  param: string
) => {
  const searchParams = useSearchParams();
  const paramId = parseId(searchParams.get(param));
  const [selectedId, setSelectedId] = useState<number | null>(paramId);

  // 從外部帶進來的網址（分享連結、從完整頁面返回）要蓋掉目前選取
  useEffect(() => {
    if (paramId == null) return;
    setSelectedId((prev) => (prev === paramId ? prev : paramId));
  }, [paramId]);

  // 選取變動 → 鏡射到網址
  useEffect(() => {
    if (selectedId == null) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(param) === String(selectedId)) return;
    url.searchParams.set(param, String(selectedId));
    window.history.replaceState(null, "", url);
  }, [selectedId, param]);

  const select = useCallback((id: number) => setSelectedId(id), []);

  return { selectedId, select };
};

const parseId = (value: string | null): number | null =>
  value && /^\d+$/.test(value) ? Number(value) : null;

/** 版面外殼：固定寬度的左欄 ＋ 自適應的右欄。 */
const SplitView = ({
  list,
  detail,
  listWidth = "380px",
  className = "",
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  /** 左欄寬度。預設 380px——再窄名單那一列就擠了。 */
  listWidth?: string;
  className?: string;
}) => (
  <div className={cn("flex h-[calc(100vh-60px)] min-h-0", className)}>
    <aside
      className="shrink-0 border-r border-neutral-200 min-h-0"
      style={{ width: listWidth }}
    >
      {list}
    </aside>
    <section className="flex-1 min-w-0 flex flex-col min-h-0">{detail}</section>
  </div>
);

export default SplitView;
