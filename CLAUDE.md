# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Next.js default port, set NEXT_PUBLIC_HOST_URL in .env)
npm run build     # Production build
npm run lint      # ESLint via Next.js
npx prisma studio # Browse database
npx prisma db push # Push schema changes to DB
```

No test suite is configured.

### Local database

```bash
docker-compose up -d  # Starts Postgres on port 54330
```

Required env vars: `DATABASE_URL`, `JWT_SECRET`.

## Architecture

**Googoocard** is a Next.js 15 App Router fullstack app for dance class management — lessons, student attendance, payment cards, and revenue analytics.

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
├── service/              # Business logic (classroom.ts, lesson.ts)
├── domains/attendance/   # Attendance validation & card deduction logic
└── lib/
    ├── auth.ts           # JWT generation/verification + decodeAuthToken()
    ├── prisma.ts         # Prisma singleton
    └── lessonDraftStorage.ts  # Local storage draft persistence
```

### Data Flow

1. **Auth**: Middleware (`src/middleware.ts`) guards all routes except `/`, `/login`, `/signup`, `/invitations`, `/api`, `/public-students`. Token decoded in every API handler via `decodeAuthToken()`.

2. **API**: Each resource has REST endpoints under `src/app/api/`. Handlers call Prisma directly or delegate to `src/service/`.

3. **State**: RTK Query handles all async data — no manual Redux slices for server state. Tag-based invalidation keeps UI in sync after mutations (see `TAG_TYPES` in `store/api.ts`).

4. **Attendance**: Complex card-deduction logic lives in `src/domains/attendance/`. A `StudentCard` is a payment package; `AttendanceRecord` tracks per-session consumption.

### Core Domain Model

- `Classroom` — top-level container; all other entities belong to one. Users track a `currentClassroomId` for multi-classroom context switching.
- `Student` — enrolled in a classroom
- `Card` — configurable card type (session limit, price). Has `isPracticeCard` flag for practice-only sessions.
- `StudentCard` — a student's instance of a Card (tracks `remainingSessions`, `expiredAt`)
- `Lesson` — has `status` (`inProgress` / `finished`) and `danceType` (`BACHATA`, `SALSA`, `ZOUK`, `HUSTLE`). Status is computed by `refreshLesson()` in `src/service/lesson.ts` after each attendance operation.
- `LessonPeriod` — a time slot within a Lesson; `attendanceTakenAt` marks when attendance was recorded
- `AttendanceRecord` — links a student + lessonPeriod + (optionally) a StudentCard; card session is decremented on creation, incremented on removal
- `LessonStudent` — join table created/upserted when attendance is first taken for a student in a lesson
- `Teacher` — a named instructor entity within a classroom (not a `User`)
- `Event` — audit log for student milestones (sign-in, card exhausted); `resourceType`/`resourceId` reference the source record

### Attendance Card Selection Logic

When taking attendance (`src/domains/attendance/attendance.service.ts`), a student's card is auto-selected by priority:
1. If the lesson has a practice card AND the student is qualified (e.g., `hasCompletedBachataLv1` for Bachata), practice cards take priority.
2. Otherwise, a regular card is picked if only one valid card exists; if multiple match, no card is auto-assigned (`uncheckedType: "multiple_cards"`).
3. The card with fewest remaining sessions (then earliest expiry) is preferred.

Unresolved attendance cases surface as `uncheckedType` on the `AttendanceRecord` response and must be manually resolved in the UI.

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

### Mobile-First

UI is constrained to max-width 480px throughout.
