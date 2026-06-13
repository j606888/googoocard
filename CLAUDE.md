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

**Env layout is fail-safe — local is the default, production is opt-in:**
- `.env` — local only (docker Postgres on `:54330`). Never put production credentials here.
- `.env.production` — production RDS `DATABASE_URL` (gitignored); used **only** by `npm run db:deploy`.
- `npm run db:migrate` runs `scripts/require-local-db.mjs` first, which **hard-refuses** to run `prisma migrate dev` against any non-localhost URL (it can reset data). So even if `DATABASE_URL` is accidentally pointed at production, migrate dev is blocked.
- `npm run db:deploy` runs `scripts/deploy-migrations.mjs`: resolves the prod URL from `.env.production` (or a real env var in CI), prints the masked target host, then runs `prisma migrate deploy`.

Tests are safe by construction: they run against a separate `googoocard_test` database (auto-created/migrated by `tests/global-setup.ts`) and `tests/test-db-url.ts` refuses any non-localhost URL.

## Architecture

**Googoocard** is a Next.js 15 App Router fullstack app for dance class management — lessons, student attendance, payment cards, and revenue analytics.

> 📖 **Detailed architecture doc: [`docs/architecture.md`](docs/architecture.md)** — full domain model, practice-card qualification rules, attendance flow, validation matrix, testing setup, and deployment cautions. Read it before touching attendance, card purchase, or qualification logic.

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
    ├── danceTypes.ts     # DANCE_TYPE_META: label + colors per dance type (single place to register a new dance type)
    └── lessonDraftStorage.ts  # Local storage draft persistence
tests/                    # Vitest integration tests (factories, test-DB setup) — unit tests live next to code (*.test.ts)
```

### Data Flow

1. **Auth**: Middleware (`src/middleware.ts`) guards all routes except `/`, `/login`, `/signup`, `/invitations`, `/api`, `/public-students`. Token decoded in every API handler via `decodeAuthToken()`.

2. **API**: Each resource has REST endpoints under `src/app/api/`. Handlers call Prisma directly or delegate to `src/service/`.

3. **State**: RTK Query handles all async data — no manual Redux slices for server state. Tag-based invalidation keeps UI in sync after mutations (see `TAG_TYPES` in `store/api.ts`).

4. **Attendance**: Complex card-deduction logic lives in `src/domains/attendance/`. A `StudentCard` is a payment package; `AttendanceRecord` tracks per-session consumption.

### Core Domain Model

- `Classroom` — top-level container; all other entities belong to one. Users track a `currentClassroomId` for multi-classroom context switching.
- `Student` — enrolled in a classroom
- `StudentDanceQualification` — (studentId, danceType) rows marking which dance types a student has completed Lv1 in, i.e. may buy/use practice cards for. APIs expose it as a flat `danceQualifications: DanceType[]`.
- `Card` — configurable card type (session limit, price). `isPracticeCard` + `danceType` define a practice (複習) card; `danceType` is required for practice cards, `null` on general cards (and on legacy practice cards, which fall back to the lesson's danceType).
- `StudentCard` — a student's instance of a Card (tracks `remainingSessions`, `expiredAt`)
- `Lesson` — has `status` (`inProgress` / `finished`) and `danceType` (`BACHATA`, `SALSA`, `ZOUK`, `HUSTLE`, `KIZOMBA`). Status is computed by `refreshLesson()` in `src/service/lesson.ts` after each attendance operation.
- `LessonPeriod` — a time slot within a Lesson; `attendanceTakenAt` marks when attendance was recorded
- `AttendanceRecord` — links a student + lessonPeriod + (optionally) a StudentCard; card session is decremented on creation, incremented on removal
- `LessonStudent` — join table created/upserted when attendance is first taken for a student in a lesson
- `Teacher` — a named instructor entity within a classroom (not a `User`)
- `Event` — audit log for student milestones (sign-in, card exhausted); `resourceType`/`resourceId` reference the source record
- `Tag` / `StudentTag` — classroom-scoped free-form student tags. The "Needs Renewal" tag is system-maintained by `refreshNeedsRenewalTag()` (`src/service/studentTag.ts`), refreshed on attendance/purchase/expire — don't add/remove it manually.

### Practice-Card Qualification (複習卡資格)

All qualification decisions go through **`src/domains/qualification/index.ts`** — pure functions shared by server and client (`isQualified`, `canUseCard`, `canBuyCard`, `cardMatchesLesson`). Never hardcode per-dance-type checks anywhere else. Core rule: a practice card's required dance type = `card.danceType ?? lesson.danceType ?? null`.

Enforcement (full matrix in `docs/architecture.md`):
- Unqualified student buying a practice card → **hard-blocked** (API 403 + UI disabled), in both the student-detail BuyCard and the in-lesson BuyAndUseForm.
- Qualified student buying/using a general card in a lesson that offers a practice card → **soft-blocked** (UI locks general cards, teacher can override).
- Attaching a practice card of another dance type to a lesson → API 400 + filtered out of the lesson card select.
- Manual card consumption (consume route) is intentionally never blocked.

**Adding a new dance type takes exactly 2 steps**: add the value to the `DanceType` enum in `prisma/schema.prisma` (+ migration), and add a label/colors entry to `DANCE_TYPE_META` in `src/lib/danceTypes.ts`. Everything else (qualification toggles, badges, filters, validation) is data-driven.

### Attendance Card Selection Logic

When taking attendance (`src/domains/attendance/attendance.service.ts`), a student's card is auto-selected by priority:
1. If the lesson has a practice card AND the student is qualified for it (via `canUseCard`), practice cards take priority.
2. Otherwise, among the student's usable cards (unqualified practice cards excluded), one is auto-picked only if exactly one exists; if multiple match, no card is auto-assigned (`uncheckedType: "multiple_cards"`).
3. The card with fewest remaining sessions (then earliest expiry) is preferred.

Unresolved attendance cases surface as `uncheckedType` on the `AttendanceRecord` response (`no_card` / `no_practice_card` / `multiple_cards` / `not_checked` / `not_qualified`) and must be manually resolved in the UI (`PendingStudents.tsx`).

### 學生自助簽到與老師定案的整合

學生可在 LIFF 自助簽到（`selfCheckIn` 建 `AttendanceRecord` 且 `source = STUDENT`，**不設** `attendanceTakenAt`，留給老師定案並即時扣卡）。老師後台點名（`CheckPeriod` / `PeriodAttendanceForm`）載入時會以 `GET .../attendance` 帶出該時段已存在的紀錄，**預設勾選**，並對 `source = STUDENT` 者標上「自助簽到」徽章。

`takeAttendance` 與 `updateAttendance` 共用 `reconcileAndFinalize`：送出的 `studentIds` 為準（authoritative）—新學生建紀錄並扣卡、已存在者保留不動（**不重複扣卡**）、被取消勾選者移除紀錄並退還課卡。

### Testing

- Unit tests for qualification rules: `src/domains/qualification/index.test.ts` (no DB).
- Integration tests for API routes & attendance service: `tests/api/*.test.ts` — run against a dedicated `googoocard_test` database on the local docker Postgres, auto-created by `tests/global-setup.ts`; seed data via `tests/factories.ts`; auth mocked with `vi.hoisted` + `vi.mock("@/lib/auth")`.

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

### Mobile-First

UI is constrained to max-width 480px throughout.
