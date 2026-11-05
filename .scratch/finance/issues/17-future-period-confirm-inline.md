# 17 還沒開始的時段點名：不用瀏覽器原生 confirm

Status: resolved
Type: task

點今天還沒開始的時段「點名」會跳 `window.confirm`「這個時段還沒開始，確定要點名嗎？」；過去的時段則是點名頁內的黃色提示。統一成頁面內提示（或共用的確認對話框），不要用原生對話框。

## Answer

拿掉 `PeriodSection` 的原生 confirm，直接進點名頁；點名頁的 `PeriodInfo` 和「不是今天」同一種黃色提示，多一種「這個時段 HH:mm 才開始，確定要現在點名嗎？」（判斷在 `PeriodAttendanceForm/periodNotice.ts`，有測試）。
