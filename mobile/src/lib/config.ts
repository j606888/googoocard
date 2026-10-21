// App 要打的伺服器（網頁版同一台，部署在 Vercel）。
// 本機開發要連 next dev 的話，在 mobile/.env.local 設 EXPO_PUBLIC_API_URL=http://<電腦的區網 IP>:3000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://googoocard.vercel.app').replace(/\/$/, '');

// Google 登入用的 iOS OAuth client（Google Cloud 專案 googoocard）。不是秘密；
// app.json 的 iosUrlScheme 是它反過來寫的版本，兩個要一起改。
export const GOOGLE_IOS_CLIENT_ID =
  '29973208530-efa918o4ilaqbtbvgkj7a54hiahpv4se.apps.googleusercontent.com';
