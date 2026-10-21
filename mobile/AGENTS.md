# Googoocard 老師端 iOS App

Expo 混合式 App：原生畫面是登入、待處理（`src/app/(tabs)/index.tsx`）、更多（`more.tsx`）；課程／學生／收入和其他頁用 WebView 開網站（`src/components/WebScreen.tsx`）。
伺服器就是本 repo 的 Next.js；App 怎麼登入、WebView 怎麼拿到 cookie、網頁在 App 裡藏哪些東西，見 `../docs/architecture.md` 的「老師端 iOS App」。

## 這個 App 的規則

- **App 內不能出現價格、方案、升級或付款**（App Store 3.1.3(f)）。WebView 顯示整個網站，網站加付費功能時要用 `src/lib/inApp.ts` 在 App 裡藏起來。
- 打 API 一律走 `src/lib/api.ts`（帶 bearer 和 `X-Googoocard-Client: app`）。不要在 App 裡用 cookie。
- 網站和 App 的「目前教室」是同一個（`User.currentClassroomId`）。App 這邊換教室用 `switchClassroom()`，它會 bump `epoch` 讓 WebView 重新進站。
- 本機開發：`mobile/.env.local` 設 `EXPO_PUBLIC_API_URL=http://localhost:3000`（模擬器）或電腦的區網 IP（實機），再 `npx expo run:ios`。正式網址在 `eas.json`。
- 推播要實機加 development build 才收得到（伺服器對所有教室都發，沒有白名單了）。
- 出新版：只改 JS（畫面、文字、邏輯）→ `npx eas-cli@latest update --channel production --message "…"`，約一分鐘，App 重開後套用。改到原生（新套件、權限、圖示、`app.json` 外掛）→ 一定要 `eas build --platform ios --profile production --auto-submit` 走 TestFlight。`runtimeVersion` 用 fingerprint：原生一變，舊 build 就收不到新的 OTA，不會裝到不相容的 JS。頻道：production／preview／development 對應 `eas.json` 的 profile。網頁分頁（WebView）只要部署網站就好。

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
