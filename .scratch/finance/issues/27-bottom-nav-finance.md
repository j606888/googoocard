# 27 底部導覽：開財務的教室把 $ 換成財務，圖示加文字

Status: needs-triage
Type: grilling

來源：2026-11-06 Sean 試用（AI 扮演），報告 https://claude.ai/artifact/5gSa77UNRB4wLPmgJr3azX

底部導覽只有圖示沒有字，Sean 找不到財務（在「更多」裡）；底部的 $ 是舊的「收入」頁，兩個跟錢有關的入口。

影響全站導覽（`app/(main)/layout.tsx` 的 BottomNav／sidebar）與 iOS App 的 WebView 導覽，先讀 `docs/ui-responsive.md` 與 `mobile/AGENTS.md`。要決定：收入頁在開財務後還要不要留、圖示加字後的高度、沒開財務的教室維持原樣。
