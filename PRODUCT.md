# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary — teachers and assistants (老師／小幫手) of small Taiwanese partner-dance studios** (Bachata, Salsa, Kizomba…; e.g. Bailamore, HustleHustle). Mid-class and at the door they use a phone to take attendance, sell and confirm payment for class cards, and resolve "待處理" items; after class they use a desktop to review income, students and settings. Studio owners/admins also manage members, permissions and classroom settings.
- **Secondary — students**, who only touch the product inside LINE (LIFF pages): self check-in at the door, today's schedule, card prices, their own cards. They never log into the website.

## Product Purpose

Run a dance studio's day-to-day without spreadsheets: lessons and their periods, attendance, class cards (prepaid session packages) and their deduction, payment collection, and revenue. Success = attendance and money reconcile without the teacher thinking about it, and a student checking in from LINE takes seconds.

## Positioning

Built around how partner-dance studios actually run: practice-card qualification by dance style and level, cards deducted per attendance (including multi-session lessons such as guest-teacher workshops), student self check-in through the studio's own LINE Official Account, and a per-classroom card serial ledger.

## Operating Context

- Teachers operate one-handed on a phone in a dim, noisy studio, often between songs; desktop is for review and admin.
- Students arrive at the door, scan a wall QR or tap the LINE rich menu, and check in inside LINE's in-app browser.
- Multiple classrooms per user; roles owner / admin / teacher / assistant.
- A teacher iOS App (Expo, `mobile/`) exists; it is out of scope for the current visual redesign and follows later.

## Capabilities and Constraints

- Next.js 15 App Router, React 19, Tailwind CSS v4 (tokens in `src/app/globals.css` `@theme`), Radix UI. Teacher app is mobile-first and goes full-width with a sidebar at `lg:` (see `docs/ui-responsive.md`); student LIFF pages are capped at 480px.
- Dance styles are classroom data with their own palette keys (`danceStyleMeta()`); teachers have palette colours too. These category colours must stay distinguishable alongside the brand palette.
- Terminology (Traditional Chinese UI): 課程, 時段, 點名, 課卡, 堂, 待處理, 收款, 體驗課, 複習卡, 分部.
- LINE green `#06C755` is used only for LINE marks/buttons.

## Brand Commitments

- Name **Googoocard** and its existing logo stay.
- **Kiwi-bird characters** stay: default student avatars are kiwi birds by role (`public/kiwi-bird.svg`, avatar set).
- The 水庫 (finance) module keeps its own game-style world, 「奇異鳥小鎮」 (`docs/finance-game-style.md`); the redesign does not touch it.
- UI copy is Traditional Chinese.
- The user prefers a clean interface: explanations tucked behind ⓘ, no decorative stat rows, no numbers written inside grid cells.

## Evidence on Hand

Real classroom data exists in production (lessons, cards, students). No testimonials, customer quotes or metrics have been provided; do not invent any.

## Product Principles

1. The teacher's in-class moment comes first: fast, thumb-reachable, legible at a glance.
2. Money and sessions must always read unambiguously — what was paid, by what, and what is left.
3. Quiet by default: show state, not decoration; detail on demand.
4. Classroom data (dance styles, teacher colours) carries meaning; the brand palette must not compete with it.

## Accessibility & Inclusion

Text contrast at least WCAG AA (4.5:1 body, 3:1 large); state never conveyed by colour alone; 44px touch targets on phone surfaces.
