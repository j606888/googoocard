# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Next.js default port, set NEXT_PUBLIC_HOST_URL in .env)
npm run build      # Production build
npm run lint       # ESLint via Next.js
npm test           # Vitest (unit + integration; needs local docker Postgres running)
npm run test:watch # Vitest watch mode
npm run db:migrate # prisma migrate dev — NEVER use `prisma db push` (schema drift) or `migrate reset` (wipes data)
npm run db:deploy  # prisma migrate deploy (production)
npm run db:studio  # Browse database
```

### Local database & ⚠️ production safety

```bash
docker-compose up -d  # Starts Postgres on port 54330 (user/password: postgres/password)
```

Required env vars: `DATABASE_URL`, `JWT_SECRET`. For custom student avatar upload, also set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (see "Student Avatars" in `docs/architecture.md`); the preset avatars still work without them.

For the renewal-reminder cron route (⚠️ built but **not scheduled yet** — no `vercel.ts`; see "續卡提醒推播" in `docs/architecture.md`): `CRON_SECRET` (the route refuses everything when it's unset) and `RENEWAL_REMINDER_CLASSROOM_IDS` (comma-separated classroom ids; **unset = no classroom gets pushes**). Leave the allowlist empty locally — a real `LINE_CHANNEL_ACCESS_TOKEN` plus a non-empty allowlist means the cron sends real messages to real students. Use `?dryRun=1` to inspect the list without sending.

For teacher push (see "待處理與老師端 App 推播" in `docs/architecture.md`) — sent for **every** classroom, to whoever turned notifications on (no classroom allowlist): optionally `EXPO_ACCESS_TOKEN`. Web push needs a VAPID pair, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`; local and production use **different** pairs — changing production's pair silently orphans every browser subscription).

**Env layout is fail-safe — local is the default, production is opt-in:**
- `.env` — local only (docker Postgres on `:54330`). Never put production credentials here.
- `.env.production` — production RDS `DATABASE_URL` (gitignored); used **only** by `npm run db:deploy`.
- `npm run db:migrate` runs `scripts/require-local-db.mjs` first, which **hard-refuses** to run `prisma migrate dev` against any non-localhost URL (it can reset data). So even if `DATABASE_URL` is accidentally pointed at production, migrate dev is blocked.
- `npm run db:deploy` runs `scripts/deploy-migrations.mjs`: resolves the prod URL from `.env.production` (or a real env var in CI), prints the masked target host, then runs `prisma migrate deploy`.

Tests are safe by construction: they run against a separate `googoocard_test` database (auto-created/migrated by `tests/global-setup.ts`) and `tests/test-db-url.ts` refuses any non-localhost URL.

## Architecture

**Googoocard** is a Next.js 15 App Router fullstack app for dance class management — lessons, student attendance, payment cards, and revenue analytics.

> 📖 **Detailed architecture doc: [`docs/architecture.md`](docs/architecture.md)** — full domain model, practice-card qualification rules, attendance flow, validation matrix, testing setup, and deployment cautions. Read it before touching attendance, card purchase, or qualification logic.
>
> 🗺️ **Roadmap & known gaps: [`docs/roadmap.md`](docs/roadmap.md)** — audited security holes, tech debt, and the feature backlog. **Search it for the file you're about to change** before editing an API route or the Prisma schema; several routes have known-unfixed auth/scoping gaps, and it also records deliberate trade-offs so they don't get re-litigated.

### Stack

- **Frontend**: React 19, Redux Toolkit + RTK Query, Tailwind CSS v4, Radix UI
- **Backend**: Next.js API routes, Prisma 6 ORM, PostgreSQL (AWS RDS)
- **Auth**: JWT in httpOnly cookies, 30-day expiry with 2-week auto-refresh

### Key Directories

```
src/
├── app/
│   ├── login/, signup/   # Auth pages (no route group wrapper)
│   ├── lessons/          # Lesson management UI
│   ├── cards/            # Student card (payment package) UI
│   ├── students/         # Student management UI
│   ├── income/           # Revenue analytics UI
│   ├── teachers/, teams/, onboarding/
│   └── api/              # REST API endpoints
├── components/           # Shared UI components
├── features/             # Domain-specific UI modules (mirrors app/ pages)
├── store/
│   ├── slices/           # RTK Query endpoint definitions (one file per resource)
│   ├── api.ts            # RTK Query base + TAG_TYPES
│   └── store.ts          # Redux store
├── service/              # Business logic (classroom.ts, lesson.ts, studentTag.ts)
├── domains/
│   ├── attendance/       # Attendance validation & card deduction logic
│   └── qualification/    # Practice-card qualification rules (pure, shared by server & client)
└── lib/
    ├── auth.ts           # JWT generation/verification + decodeAuthToken()
    ├── prisma.ts         # Prisma singleton
    ├── danceStyles.ts    # DanceStyleSummary + danceStyleSummarySelect + palette keys (DANCE_STYLE_COLORS)
    ├── danceStyleColors.ts # palette key → static Tailwind classes; danceStyleMeta(style)
    └── lessonDraftStorage.ts  # Local storage draft persistence
tests/                    # Vitest integration tests (factories, test-DB setup) — unit tests live next to code (*.test.ts)
```

### Data Flow

1. **Auth**: Middleware (`src/middleware.ts`) guards all routes except `/`, `/login`, `/signup`, `/invitations`, `/api`, `/public-students`. Token decoded in every API handler via `decodeAuthToken()`, which also re-verifies membership and returns `NO_CLASSROOM` (`-1`, from `src/lib/authz.ts`) when there is none — **never `undefined`**, because Prisma reads `where: { classroomId: undefined }` as "no filter" and would return every classroom's rows. Route wrappers in `src/lib/apiRoute.ts`: `apiRoute` (needs a live membership), `sessionRoute` (login only — for the classroom-management routes), `publicApiRoute` (no auth).

2. **API**: Each resource has REST endpoints under `src/app/api/`. Handlers call Prisma directly or delegate to `src/service/`.

3. **State**: RTK Query handles all async data — no manual Redux slices for server state. Tag-based invalidation keeps UI in sync after mutations (see `TAG_TYPES` in `store/api.ts`).

4. **Attendance**: Complex card-deduction logic lives in `src/domains/attendance/`. A `StudentCard` is a payment package; `AttendanceRecord` tracks per-session consumption.

### Core Domain Model

- `Classroom` — top-level container; all other entities belong to one. Users track a `currentClassroomId` for multi-classroom context switching. Deletion is a **soft delete** (`deletedAt`) — see "教室生命週期與角色" in `docs/architecture.md`.
- `Membership` — (user, classroom, role) join. `role` is `"owner"` (creator) or `"assistant"` (joined via invite). Owners delete a classroom; assistants leave it. `decodeAuthToken()` re-reads this row on **every** request, so removals take effect immediately — don't bypass it.
- `Student` — enrolled in a classroom
- `DanceStyle` — a classroom's own dance style (`name`, palette-key `color`, `hasLevels`, `sortOrder`, `archivedAt`), managed on `/dance-styles`. Replaced the old `DanceType` enum (2026-10). Archived, never deleted. Validate any incoming `danceStyleId` with `findDanceStyleInClassroom()` (`src/lib/authz.ts`).
- `StudentDanceQualification` — (studentId, danceStyleId, level) rows: the highest level (1 初階 / 2 中階 / 3 進階, `src/lib/danceLevels.ts`) a student has completed in a dance style. Level ≥ 1 = may buy practice cards; a practice card is usable only in lessons with `Lesson.level` ≤ that level — **only when the style `hasLevels`**; otherwise every level counts as 1. APIs expose both `danceQualifications: number[]` (style ids) and `danceLevels: { [danceStyleId]: level }`.
- `Card` — configurable card type (session limit, price). `isPracticeCard` + `danceStyleId` define a practice (複習) card; `danceStyleId` is required for practice cards, `null` on general cards (and on legacy practice cards, which fall back to the lesson's style).
- `StudentCard` — a student's instance of a Card (tracks `remainingSessions`, `expiredAt`). `serialNumber` is a per-classroom sequence shown as `#A0001`…`#A9999` → `#B0001` (`src/lib/cardSerial.ts`); issue it only via `nextCardSerial(tx, classroomId)` inside the creating transaction — there is no DB unique constraint. Conversion rules (value-based default sessions, unpaid cards blocked) live in `src/domains/cardConversion` — see "課卡轉換" / "卡片編號" in `docs/architecture.md`.
- `Lesson` — has `status` (`inProgress` / `finished`), a `kind` (`fixed` / `ongoing`), an optional `endedAt` (ended by hand), a required `danceStyleId` and a `level`. Status is computed by `refreshLesson()` in `src/service/lesson.ts` via `deriveLessonStatus()` (`src/lib/lessonKind.ts`): ended by hand → finished; ongoing → never auto-finishes; fixed → finished once every period is checked. See "課程型態" in `docs/architecture.md`.
- `LessonPeriod` — a time slot within a Lesson; `attendanceTakenAt` marks when attendance was recorded
- `AttendanceRecord` — links a student + lessonPeriod + (optionally) a StudentCard; card session is decremented on creation, incremented on removal
- `LessonStudent` — join table created/upserted when attendance is first taken for a student in a lesson
- `Teacher` — a named instructor entity within a classroom (not a `User`)
- `Event` — audit log for student milestones (sign-in, card exhausted); `resourceType`/`resourceId` reference the source record
- `PushToken` / `WebPushSubscription` / `NotificationPreference` — teacher push (App via Expo, browsers via Web Push). The "待處理" list itself has no table: it's derived live by `src/service/todos.ts` (unpaid cards, Needs Renewal tag, attendance with no card).
- `Tag` / `StudentTag` — classroom-scoped free-form student tags. The "Needs Renewal" tag is system-maintained by `refreshNeedsRenewalTag()` (`src/service/studentTag.ts`), refreshed on attendance/purchase/expire — don't add/remove it manually.

### Practice-Card Qualification (複習卡資格)

All qualification decisions go through **`src/domains/qualification/index.ts`** — pure functions shared by server and client (`isQualified`, `canUseCard`, `canBuyCard`, `cardMatchesLesson`). Never hardcode per-dance-type checks anywhere else. Core rule: a practice card's required dance style = `card.danceStyleId ?? lesson.danceStyleId ?? null`. Required level = `lesson.level` when a lesson is in context (using, or buying inside a lesson) **and its style `hasLevels`**, otherwise 1 (`requiredLevelFor`).

Enforcement (full matrix in `docs/architecture.md`):
- Unqualified student buying a practice card → **hard-blocked** (API 403 + UI disabled), in both the student-detail BuyCard and the in-lesson BuyAndUseForm.
- Qualified student buying/using a general card in a lesson that offers a practice card → **soft-blocked** (UI locks general cards, teacher can override).
- Attaching a practice card of another dance type to a lesson → API 400 + filtered out of the lesson card select.
- Manual card consumption (consume route) is intentionally never blocked.

**Dance styles are classroom data, not code**: a classroom adds/renames/archives its styles on `/dance-styles` (new classrooms start with none). Never hardcode a style name or id; everything (qualification toggles, badges, filters, validation) is data-driven. Embed styles in responses via `danceStyleSummarySelect` (`src/lib/danceStyles.ts`), and map colours only through `danceStyleMeta()` (`src/lib/danceStyleColors.ts`).

### Attendance Card Selection Logic

When taking attendance (`src/domains/attendance/attendance.service.ts`), a student's card is auto-selected by priority:
1. If the lesson has a practice card AND the student is qualified for it (via `canUseCard`), practice cards take priority.
2. Otherwise, among the student's usable cards (unqualified practice cards excluded), one is auto-picked only if exactly one exists; if multiple match, no card is auto-assigned (`uncheckedType: "multiple_cards"`).
3. The card with fewest remaining sessions (then earliest expiry) is preferred.

Unresolved attendance cases surface as `uncheckedType` on the `AttendanceRecord` response (`no_card` / `no_practice_card` / `multiple_cards` / `not_checked` / `not_qualified`) and must be manually resolved in the UI (`PendingStudents.tsx`).

### 學生自助簽到與老師定案的整合

學生自助簽到有**兩個入口、同一顆引擎**：LINE LIFF（`/liff/checkin`，以 LINE ID Token 驗身分）與教室現場 QR 看板（`/checkin/[key]`，**不驗身分**，只靠 `Classroom.checkinKey` 界定教室）。兩者都呼叫 `selfCheckIn` 建 `AttendanceRecord` 且 `source = STUDENT`，**不設** `attendanceTakenAt`，留給老師定案；卡在自助簽到當下就扣。「今天有哪些課」由 `src/service/checkin.ts` 的 `getTodayLessons()` 統一定義。QR 入口的邊界防護是「教室 + 今天」（跨教室 403/404、非今日時段 400），課卡不足不擋簽到、只提醒。老師端 `/checkin-qr` 產生／輪替金鑰。老師後台點名（`CheckPeriod` / `PeriodAttendanceForm`）載入時會以 `GET .../attendance` 帶出該時段已存在的紀錄，**預設勾選**，並對 `source = STUDENT` 者標上「自助簽到」徽章。

`takeAttendance` 與 `updateAttendance` 共用 `reconcileAndFinalize`：送出的 `studentIds` 為準（authoritative）—新學生建紀錄並扣卡、已存在者保留不動（**不重複扣卡**）、被取消勾選者移除紀錄並退還課卡。

### Testing

- Unit tests for qualification rules: `src/domains/qualification/index.test.ts` (no DB).
- Integration tests for API routes & attendance service: `tests/api/*.test.ts` — run against a dedicated `googoocard_test` database on the local docker Postgres, auto-created by `tests/global-setup.ts`; seed data via `tests/factories.ts`; auth mocked with `vi.hoisted` + `vi.mock("@/lib/auth")`.

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

### Mobile-First, but not 480px-only

Mobile-first, but the **teacher-facing app goes full-width with a sidebar on desktop** — the layout-mode switch is `lg:` (content) while the nav shell still switches at `md:` (a known inconsistency). `max-w-[480px]` now only applies to the student-facing entry points (LIFF, on-site QR check-in) and to `Drawer`.

⚠️ Five mobile/desktop divergence mechanisms coexist (one of them has already cost a bug); which one a screen may use is now a written rule, not a judgment call. **Read [`docs/ui-responsive.md`](docs/ui-responsive.md) before adding a desktop layout to any screen** — it states the rule (one 1024px size class, logic in hooks, `variant` props over parallel trees, four adaptive primitives), and records the deliberate trade-offs so they don't get re-litigated.
