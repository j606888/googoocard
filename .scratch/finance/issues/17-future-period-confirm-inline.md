# 17 還沒開始的時段點名：不用瀏覽器原生 confirm

Status: ready-for-agent
Type: task

點今天還沒開始的時段「點名」會跳 `window.confirm`「這個時段還沒開始，確定要點名嗎？」；過去的時段則是點名頁內的黃色提示。統一成頁面內提示（或共用的確認對話框），不要用原生對話框。
