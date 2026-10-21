// App 要打的伺服器（網頁版同一台，部署在 Vercel）。
// 本機開發要連 next dev 的話，在 mobile/.env.local 設 EXPO_PUBLIC_API_URL=http://<電腦的區網 IP>:3000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://googoocard.vercel.app').replace(/\/$/, '');
