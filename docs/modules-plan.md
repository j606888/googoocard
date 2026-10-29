# 模組化：權限 × 技能樹 × 水庫（規劃稿）

> 狀態：第 1～3 階段完成（2026-10-27，分支 `claude/modules`）。第 3 階段的水庫仍是示意資料；搬移時發現 water-tank 本身的不一致（§8.1 公式與範例不符、星期寫錯、月報水位變化算錯等）已在 `src/features/finance/mockData.ts` 修正或註明。
> 來源：`~/projects/teach-what`（課綱＋技能樹，開發中、沒有使用者）、`~/projects/water-tank`（水庫財務，只有 UI 殼＋mock data）。兩者都改成在 googoocard 裡重寫，不做資料搬遷、不沿用它們的帳號系統。

## 已確認決策

| 議題 | 決策 |
|---|---|
| 專案 | **一個 repo、一個 DB、一套帳號**。不做多專案互相串接 |
| 核心 | 點名＋課卡（現有全部功能）永遠開著，網址一個都不改（LIFF、iOS App、推播連結、門口 QR 都綁著） |
| 模組 | 技能樹（`curriculum`）、水庫（`finance`）是**教室層級的開關**。沒開的教室完全看不到，畫面跟現在一樣 |
| 權限 | **角色＝權限的預設組合**（寫在程式碼裡），可以對個人額外加／減權限 |
| 水庫 | 只給管理員（預設組合裡只有 owner／admin 有 `finance.*`） |
| 收入頁 | 開了水庫後 `/income` 照舊，只顯示教室收入；場地費、老師費、廣告等成本只在水庫 |
| teach-what | 沒人在用 → 在這裡**重寫**，只參考它的商業邏輯與畫面；它的 studios／memberships／classes／students／lessons、next-auth、學生帳號登入全部不搬 |
| water-tank | `docs/attendance-integration.md` 的 webhook／outbox／API 金鑰／版本號**不再需要**（同一個 DB 直接讀）；§8 入帳規則保留到第 4 階段 |
| 收費 | 暫不考慮。開關表不存方案或到期日 |

## 順序

| 階段 | 內容 | 這次做 |
|---|---|---|
| 1 | 權限＋模組開關 | ✅ |
| 2 | 技能樹：列出想教的東西＋留言板 | ✅ |
| 3 | 水庫前端介面（mock data） | ✅ |
| 4 | 其他：水庫接真資料、課綱地圖、備課、上課紀錄、學生自評（LIFF）… | 之後 |

## 共通架構規則

- **網址**：每個模組一個頂層前綴，放在 `(main)` route group 底下共用側欄。

  ```
  /curriculum                     技能樹入口（選舞種）
  /curriculum/[danceStyleId]      某舞種的技能樹（?skill=<id> 開抽屜）
  /curriculum/[danceStyleId]/talk 討論總覽
  /finance                        水庫儀表板
  /finance/ledger …    水庫子頁（見第 3 階段）
  /modules             開關模組
  ```

  不學 teach-what 的 `/s/[slug]`：googoocard 的「目前教室」在 JWT 裡，兩種做法混用會出錯。
- **資料夾**：沿用現在按層分的方式，各層開模組子資料夾：
  `src/app/(main)/curriculum/`、`src/app/api/curriculum/`、`src/features/curriculum/`、`src/service/curriculum/`、`src/domains/curriculum/`、`src/store/slices/curriculum.ts`（水庫同理換成 `finance`）。
- **依賴單向**：模組可以 import 核心；核心不 import 模組。用 ESLint `no-restricted-imports` 擋（第 1 階段加，見 §1.7）。
- **Prisma**：維持單一 `schema.prisma`，模組的 model 集中放在檔尾，用 `// ===== 模組：技能樹 =====` 分段。多檔 schema 等模組長大再說（要動 `scripts/` 裡的部署腳本，現在不值得）。
- **iOS App**：三個階段都不動。App 的課程／學生／收入是 WebView，原生「更多」不加模組入口。
- **設計系統**：用現有的 `Button`／`Field`／`EmptyState`／`Skeleton`／`StatusTag`／`Drawer`；桌面版照 `docs/ui-responsive.md`。teach-what 和 water-tank 的配色、字型、`ui.tsx` 都**不搬**，只搬版面與互動。**例外**：技能樹頁（`SkillTreeView`／`SkillNode`）照 teach-what 的樣子——分類分頁、黑底「一轉」標頭、圓形技能節點、金色留言泡泡，分類色用 teach-what 的調色盤（`src/features/curriculum/categoryColors.ts`，key 沿用 `DANCE_STYLE_COLORS`）；按鈕、篩選、抽屜仍用設計系統元件（2026-10-28）。

---

## 第 1 階段：權限＋模組開關

### 1.1 權限清單與角色預設組合

新檔 `src/lib/permissions.ts`（純函式，server 與 client 共用，跟 `src/lib/roles.ts` 放一起）。

```ts
export const MODULES = ["curriculum", "finance"] as const;

export const PERMISSIONS = {
  "members.manage":  { label: "管理成員",       group: "core" },        // 邀請、改角色與權限、移除
  "modules.manage":  { label: "開關功能模組",   group: "core" },
  "curriculum.view": { label: "看技能樹、留言", group: "curriculum" },
  "curriculum.edit": { label: "編輯技能樹",     group: "curriculum" },
  "finance.view":    { label: "看水庫",         group: "finance" },
  "finance.edit":    { label: "記帳、改水庫設定", group: "finance" },
} as const;
```

| 權限 | owner | admin | teacher | assistant |
|---|---|---|---|---|
| `members.manage` | ✓ | ✓ | | |
| `modules.manage` | ✓ | ✓ | | |
| `curriculum.view` | ✓ | ✓ | ✓ | ✓ |
| `curriculum.edit` | ✓ | ✓ | ✓ | |
| `finance.view` | ✓ | ✓ | | |
| `finance.edit` | ✓ | ✓ | | |

- **只拆真的有人想限制的**。日常功能（點名、課卡、收入頁、課卡價格）維持「所有角色都能做」，這是之前刻意的決定（`docs/architecture.md`「教室生命週期與角色」）。哪天想讓某位小幫手看不到收入，再加 `income.view`——預設組合全部角色都有，行為不變，只是多了可以拿掉的選項。
- **owner 永遠擁有全部權限，不能被拿掉**。「封存教室」「轉移教室」維持 `requireOwner`，不做成可以給人的權限。
- 留言（`curriculum.view`）和改樹（`curriculum.edit`）分開：小幫手可以留言提想法，但不能直接改樹。

```ts
export function effectivePermissions(input: {
  role: string; grants: string[]; revokes: string[]; modules: string[];
}): Set<Permission>
// = owner → 全部；否則 (ROLE_BUNDLES[role] ∪ grants) − revokes
// 再濾掉「所屬模組沒開」的權限
```

### 1.2 資料表

```prisma
model Membership {
  // …現有欄位
  grants  String[] @default([])  // 角色預設以外多給的權限（src/lib/permissions.ts）
  revokes String[] @default([])  // 從角色預設拿掉的權限
}

model ClassroomModule {
  id          Int       @id @default(autoincrement())
  classroomId Int
  classroom   Classroom @relation(fields: [classroomId], references: [id])
  module      String    // MODULES 之一
  enabledAt   DateTime  @default(now())
  enabledById Int?
  enabledBy   User?     @relation(fields: [enabledById], references: [id])

  @@unique([classroomId, module])
}
```

- **關閉＝刪掉這一列**；模組自己的資料表完全不動，重新開啟資料就回來。
- 不存 `settings Json`：第 1～3 階段沒有模組需要設定，要用再加。
- 只存 grants／revokes，不存「完整權限清單」：預設組合在程式碼裡，新增權限時改一行，所有該角色的人就自動有，不用跑資料遷移。

### 1.3 Server 端把關

- `decodeAuthToken()`（`src/lib/auth.ts`）：原本查 membership 的那次 query 多選 `grants`、`revokes`，並 join `classroom.modules`。回傳多 `grants`、`revokes`、`modules`。仍然是**同一次 query**。
- `apiRoute(handler, options?)`（`src/lib/apiRoute.ts`）：
  - handler 的 ctx 多一個 `permissions: Set<Permission>` 和 `modules: Set<Module>`。
  - 新選項 `{ permission: "finance.view" }`：
    - 權限所屬的模組沒開 → **404 `MODULE_NOT_ENABLED`**（對這間教室來說，這功能不存在）
    - 模組有開但沒權限 → **403 `PERMISSION_DENIED`**（body 帶 `permission`）
  - 測試會 `vi.mock("@/lib/auth")`，mock 沒給新欄位時當成空陣列，所以既有測試不用改。
- `src/lib/authz.ts`：`assertAdmin(role)` 換成 `assertCan(ctx, "members.manage")`，用在：
  - `src/app/api/invite-tokens/route.ts`、`src/app/api/invite-tokens/[id]/route.ts`
  - `src/app/api/memberships/[id]/route.ts`
  - `src/app/api/classrooms/[id]/route.ts`（實作時確認它用的是 assertAdmin 還是 requireOwner）
  - 錯誤碼沿用 `NOT_CLASSROOM_ADMIN`？→ **改用 `PERMISSION_DENIED`**，`src/features/teams/TeamList/teamErrors.ts` 跟著改文案。`isAdminRole()` 保留給「畫面顯示管理員徽章」用。

### 1.4 API

| 方法 | 路徑 | 權限 | 用途 |
|---|---|---|---|
| GET | `/api/me/access` | 登入＋在教室 | `{ role, permissions: string[], modules: string[] }`，給前端藏導覽列與按鈕 |
| GET | `/api/classroom-modules` | 登入＋在教室 | 每個模組 `{ module, enabled, enabledAt, enabledBy }` |
| PUT | `/api/classroom-modules/[module]` | `modules.manage` | 開啟（已開就回 200，冪等） |
| DELETE | `/api/classroom-modules/[module]` | `modules.manage` | 關閉 |
| GET | `/api/memberships` | （現有） | 每位成員多回 `permissions`（實際權限）和 `customized: boolean` |
| PATCH | `/api/memberships/[id]` | `members.manage` | 多收 `permissions: string[]`（想要的完整清單），server 跟角色預設比對後存成 grants／revokes |

`PATCH /api/memberships/[id]` 的規則：

- 不能改 owner、不能改自己（沿用現在改角色的規則）。
- **只能給自己有的權限**，防止拿 `members.manage` 的人把自己沒有的水庫權限發給別人。
- **改角色時清掉個人調整**，套用新角色的預設；同一個請求裡同時帶 `role` 和 `permissions` 時，以新角色為基準計算。
- 不認得的權限字串 → 400。

RTK Query：新 `src/store/slices/access.ts`（`useGetAccessQuery`）、`src/store/slices/classroomModules.ts`；`TAG_TYPES` 加 `Access`、`ClassroomModule`。切換教室、開關模組、轉移教室都要 invalidate `Access`。

### 1.5 前端

- **Hook**：`src/hooks/useCan.ts` → `useCan(permission)`、`useModuleEnabled(module)`，都讀 `useGetAccessQuery`。載入中一律回 `false`（寧可晚一點出現，不要閃一下又消失）。
- **導覽列**（`src/features/nav/navConfig.ts`）：`NavLink` 加選填的 `permission`。
  - 新增 `MODULE_LINKS`：`{ name: "技能樹", href: "/curriculum", permission: "curriculum.view" }`、`{ name: "水庫", href: "/finance", permission: "finance.view" }`。
  - `SECONDARY_LINKS` 加 `{ name: "功能模組", href: "/modules", permission: "modules.manage" }`。
  - 桌面側欄（`src/features/SidebarContent.tsx`）：核心連結下面多一個「模組」分組標題，只有至少一個模組可見時才出現。
  - 手機：模組連結放進「更多」（`MoreSheet.tsx`）；底部列不動。
- **模組頁 `/modules`**（`src/app/(main)/modules/page.tsx` + `src/features/modules/`）：每個模組一張卡片——名稱、一句話說明、開了會多什麼、開關。關閉要確認：「資料會保留，重新開啟就回來」。
- **模組頁面守門**：`src/features/modules/ModuleGate.tsx`，放在 `src/app/(main)/curriculum/layout.tsx`、`src/app/(main)/finance/layout.tsx`。
  - 載入中 → `Skeleton`
  - 模組沒開 → `EmptyState`「這個教室沒有開啟技能樹」，有 `modules.manage` 的人多一個「去開啟」按鈕
  - 沒權限 → `EmptyState`「你沒有權限看這裡」
  - 這只是介面；真正的防線是 API 的 `permission` 選項。
- **團隊頁**（`src/features/teams/TeamList/`）：
  - `EditMemberDrawer.tsx`：角色選單下面加「權限」區塊，依 group 分組列出勾選框（核心／技能樹／水庫；沒開的模組不列）。角色預設的先勾好；跟預設不同的勾選框旁標「自訂」。底部有「恢復角色預設」。owner、自己的勾選框鎖住。
  - `MemberCard.tsx`：`customized` 為真時，在角色徽章旁多一個 `StatusTag`「自訂權限」。
  - 邀請（`InviteDrawer.tsx`）不動：邀請只帶角色，加入後再調。

### 1.6 測試

- `src/lib/permissions.test.ts`（不用 DB）：四種角色的預設組合、grants／revokes、owner 拿不掉、模組沒開時模組權限消失、不認得的字串。
- `tests/api/permissions.test.ts`：
  - `apiRoute` 的 `permission` 選項：模組沒開 404、沒權限 403、有權限 200
  - `PATCH /api/memberships/[id]`：改權限、不能改 owner／自己、只能給自己有的、改角色會清掉個人調整
  - `/api/classroom-modules`：只有 `modules.manage` 能開關、冪等、關掉後該模組的 API 變 404
  - `/api/me/access` 的內容
- `tests/api/team-roles.test.ts`：錯誤碼改成 `PERMISSION_DENIED`。

### 1.7 ESLint 邊界

`eslint.config.mjs` 加 `no-restricted-imports`：

- 對 `src/**` 全部：禁止 import `@/features/curriculum/*`、`@/service/curriculum/*`、`@/domains/curriculum/*`、`@/store/slices/curriculum*`（`finance` 同理）。
- override：檔案本身就在該模組資料夾（或 `src/app/(main)/curriculum/**`、`src/app/api/curriculum/**`）時放行。
- 以後核心頁面要嵌模組元件（例如課程頁的「備課」分頁）時，再針對那個檔案開例外，並寫在 `docs/architecture.md`。

### 1.8 文件

- `docs/architecture.md`：新增「權限與模組」一節；「教室生命週期與角色」的表格改寫成「角色預設組合」。
- `CLAUDE.md`：`Membership` 那條補 grants／revokes 與 `src/lib/permissions.ts`；`Classroom` 那條補 `ClassroomModule`；Data Flow 第 1 點補 `apiRoute` 的 `permission` 選項。

### 1.9 完成條件

- 沒開任何模組的教室：畫面、API 行為跟現在完全一樣（側欄只多出管理員看得到的「功能模組」）。
- 在 `/modules` 打開技能樹 → 側欄出現「技能樹」，進去是空的頁面殼；關掉 → 側欄消失、`/api/curriculum/*` 回 404。
- 在團隊頁把某位老師的 `finance.view` 打勾 → 他的側欄出現水庫。

---

## 第 2 階段：技能樹（想教的東西＋留言板）

目標：團隊能**列出想教的東西**（技能樹：分類 × 等級 × 技能，加上還沒定位置的「待定區」），並**針對每個技能留言討論**。teach-what 其他功能先不管。

### 2.1 範圍

| 做 | 不做（第 4 階段以後） |
|---|---|
| 技能樹：分類（tab）× 等級（欄）× 技能（節點） | 學生自評、評分量表（rubric）、L/F 分邊（`pairs`、`scale`） |
| 新增／改名／描述／移到別的分類或等級／封存／還原 | 前置技能、目標、影片、份量（`size`） |
| 分類與等級的新增、改名、排序、刪除（技能要搬去哪） | 待定區的「提議位置」與投票（`treeDraftSpots`／`treeDraftVotes`） |
| 待定區：一次貼多行名字 → 勾選多張放進某分類／等級 | 「上次看過之後別人改了什麼」（`treeSeen`）、總覽表、Bachata 範本 |
| 每個技能的修改紀錄 | 課綱地圖、備課、上課紀錄、AI |
| 留言板：留言、一層回覆、表情、@成員、標成結論、未讀 | @ 到人時推播（之後接現有的老師推播） |
| 討論總覽頁（全部／討論中／有新留言／有結論） | |

### 2.2 跟 teach-what 不一樣的地方

- **一個舞種一棵樹**：teach-what 用自由文字 `dance` 分樹，這裡改成 `danceStyleId` 對到教室的 `DanceStyle`。舞種封存了，樹還在但入口不列。
- **待定也是技能**：teach-what 的待定卡是另一張表（`treeDrafts`），放進樹時要把留言、已讀從 draft id 搬到新的 skill id。這裡改成同一張 `Skill` 表，**`categoryId` 為 null 就是待定**；放進樹只是填上分類和等級，留言、已讀都不用搬，留言表也不需要「只能指向其中一個」的 CHECK。
- **已放進樹的技能一律封存，不刪除**（跟舞種、分部、老師同一套慣例）。teach-what 是「被用過才封存，否則刪掉」，這裡用不到那 9 張表的判斷。**待定的技能可以真的刪除**，有留言的話要二次確認，留言一起刪。
- **分類顏色走 `DANCE_STYLE_PALETTE`**（`src/lib/danceStyleColors.ts`），圖示從固定一組 lucide 圖示挑；teach-what 自己的 9 色 `PALETTE`、SVG `GLYPHS`、1,400 行 CSS 都不搬。
- **只留一個名稱欄位＋選填全名**：`name`（節點上顯示，≤60）、`fullName`（選填，≤120）、`description`（≤500）。
- id 用 googoocard 的自動遞增整數；成員就是 `Membership`＋`User`，@ 的候選名單是這間教室的所有成員。

### 2.3 資料表

```prisma
// ===== 模組：技能樹 =====

model SkillCategory {            // 分類（teach-what: treeSchools）
  id           Int      @id @default(autoincrement())
  classroomId  Int
  danceStyleId Int
  name         String   // ≤30
  color        String   // DANCE_STYLE_COLORS 之一
  icon         String   // SKILL_CATEGORY_ICONS 之一
  sortOrder    Int      @default(0)
  @@index([classroomId, danceStyleId])
}

model SkillTier {                // 等級欄（teach-what: treeTiers）；顯示名「一轉、二轉…」由位置決定
  id           Int      @id @default(autoincrement())
  classroomId  Int
  danceStyleId Int
  label        String   @default("")  // 自由標籤，例如 "Lv1"，≤20
  sortOrder    Int      @default(0)
  @@index([classroomId, danceStyleId])
}

model Skill {                    // 技能；categoryId = null 表示在待定區
  id           Int       @id @default(autoincrement())
  classroomId  Int
  danceStyleId Int
  categoryId   Int?      // onDelete: SetNull 不用——刪分類時由 service 先搬走
  tierId       Int?      // 待定的可以沒有等級；放進樹時必填（service 檢查）
  name         String
  fullName     String    @default("")
  description  String    @default("")
  sortOrder    Int       @default(0)   // 同一舞種一條流水號
  createdById  Int?
  createdAt    DateTime  @default(now())
  archivedAt   DateTime?
  @@index([classroomId, danceStyleId])
}

model SkillChange {              // 修改紀錄（teach-what: treeSkillChanges）
  id         Int      @id @default(autoincrement())
  skillId    Int
  skillName  String   // 當時的名字
  kind       String   // add | place | rename | describe | move_tier | move_category | archive | restore
  fromValue  String?
  toValue    String?
  actorId    Int?
  createdAt  DateTime @default(now())
  @@index([skillId, createdAt])
}

model SkillComment {
  id             Int       @id @default(autoincrement())
  skillId        Int       // 刪待定技能時 cascade
  parentId       Int?      // 只有一層回覆：回覆的回覆會被攤平到同一串
  authorId       Int?
  text           String    // ≤2000
  conclusionAt   DateTime? // 每個技能最多一則結論
  conclusionById Int?
  createdAt      DateTime  @default(now())
  editedAt       DateTime?
  @@index([skillId])
}

model SkillCommentReaction {     // 一人一則一個表情，換表情＝覆蓋
  commentId Int
  userId    Int
  kind      String   // like | love | haha | wow | think | down
  @@id([commentId, userId])
}

model SkillCommentMention {      // 被 @ 到、還沒打開那串討論
  commentId Int
  userId    Int
  seenAt    DateTime?
  @@id([commentId, userId])
  @@index([userId])
}

model SkillTalkRead {            // 每個人最後一次打開某技能討論的時間
  userId  Int
  skillId Int
  readAt  DateTime @default(now())
  @@id([userId, skillId])
}
```

- 留言相關的表不放 `classroomId`，一律經由 `skill.classroomId` 驗證（API 先用 `findSkillInClassroom()` 找技能，找不到 404）。
- 「這個舞種有樹」＝至少有一個 `SkillCategory`。

### 2.4 純邏輯（從 teach-what 搬，附測試）

`src/domains/curriculum/skillTree.ts`（來源 `teach-what/src/lib/skilltree.ts`，只搬這些）：
`DEFAULT_CATEGORIES`（概念、單人腳步、Body Movement、Footwork、雙人招式）、`DEFAULT_TIERS`（Lv1～Lv3）、`tierName(index)`（一轉…十轉）、`sorted()`、`reorder(list, id, dir)`、`draftNames(text)`（一行一個、去清單符號、去重、截 60 字、最多 100 個）、`CHANGE_WORD`、`SKILL_CATEGORY_ICONS`。

`src/domains/curriculum/talk.ts`（來源 `teach-what/src/lib/talk.ts`，全部搬）：
`REACTIONS`、`talkMarks(talk, me)`（每個技能的留言數、有沒有結論、有沒有新的）、`isOpen()`（有留言、沒結論＝討論中）、`threadsOf()`、`mentionsIn(text, members)`、`typingMention(text)`。

- `mentionsIn` 是子字串比對，「@Ken Lee」會同時標到「Ken」和「Ken Lee」。teach-what 的測試就是這樣寫的，**照搬不修**，在測試名稱註明是已知行為。
- 測試：`talk.test.ts` 整份搬；`skilltree.test.ts` 只搬「structure」（`tierName`、`reorder`）和「待定區」（`draftNames`）兩段。

### 2.5 Server 端

`src/service/curriculum/`：

- `skillTree.ts`
  - `loadSkillTree(classroomId, danceStyleId)` → `{ categories, tiers, skills, drafts, archived }`
  - `createTree(…, template: "default" | "blank")`：已有分類就拒絕
  - `patchSkill(…)`：在同一個 `$transaction` 裡更新技能並寫 `SkillChange`（改名、描述、換分類、換等級，紀錄裡存人看得懂的分類名與「二轉」）
  - `placeDrafts(ids, categoryId, tierId)`：填上位置、寫 `place` 紀錄；樹上已有同名技能的跳過並回報
  - `deleteCategory(id, moveTo | null)`、`deleteTier(id, moveTo | null)`：有 `moveTo` 就把技能搬過去並記錄；`null` 就把技能封存。至少要留一個分類、一個等級。刪等級後重新編 `sortOrder`（三轉會變二轉）。
- `talk.ts`
  - `loadTalk(classroomId, danceStyleId, userId)` → `{ comments（含作者名、表情與按的人）, readAt, mentioned }`
  - `postComment`：回覆的回覆攤平；同一個 transaction 寫已讀＋`mentionsIn` 找到的 @
  - `editComment`：只有作者；新的 @ 補寫，舊的不刪
  - `deleteComment`：作者本人，或有 `members.manage` 的人（管理員）
  - `react`：同一個表情再按一次＝取消
  - `setConclusion`：先清掉這個技能其他留言的結論，再設這則
  - `markRead(skillId)`：寫已讀、把我在這串裡的 @ 標成已看

### 2.6 API

| 方法 | 路徑 | 權限 |
|---|---|---|
| GET | `/api/curriculum/styles` | view：每個舞種有沒有樹、技能數、討論中數、有沒有新留言 |
| GET | `/api/curriculum/[danceStyleId]/tree` | view |
| POST | `/api/curriculum/[danceStyleId]/tree` | edit：`{ template: "default" \| "blank" }` |
| POST | `/api/curriculum/[danceStyleId]/categories` | edit |
| PATCH／DELETE | `/api/curriculum/categories/[id]` | edit（DELETE 帶 `moveTo`） |
| POST | `/api/curriculum/categories/[id]/move` | edit：`{ dir: -1 \| 1 }` |
| POST | `/api/curriculum/[danceStyleId]/tiers` | edit（最多 10 個） |
| PATCH／DELETE | `/api/curriculum/tiers/[id]` | edit |
| POST | `/api/curriculum/tiers/[id]/move` | edit |
| POST | `/api/curriculum/[danceStyleId]/skills` | edit：有 `categoryId` 就放進樹，沒有就進待定區 |
| POST | `/api/curriculum/[danceStyleId]/drafts` | edit：`{ text }` 多行貼上，回 `{ added, skipped }` |
| POST | `/api/curriculum/[danceStyleId]/drafts/place` | edit：`{ ids, categoryId, tierId }` |
| PATCH | `/api/curriculum/skills/[id]` | edit |
| DELETE | `/api/curriculum/skills/[id]` | edit：樹上的封存、待定的刪除 |
| POST | `/api/curriculum/skills/[id]/restore` | edit |
| GET | `/api/curriculum/skills/[id]/history` | view |
| GET | `/api/curriculum/[danceStyleId]/talk` | view |
| POST | `/api/curriculum/skills/[id]/comments` | view |
| PATCH／DELETE | `/api/curriculum/comments/[id]` | view＋作者規則（見 2.5） |
| PUT | `/api/curriculum/comments/[id]/reaction` | view：`{ kind }` |
| PUT／DELETE | `/api/curriculum/comments/[id]/conclusion` | view |
| POST | `/api/curriculum/skills/[id]/read` | view |

view＝`curriculum.view`、edit＝`curriculum.edit`，都用第 1 階段 `apiRoute` 的 `permission` 選項，所以模組沒開一律 404。所有 `[danceStyleId]` 先過 `findDanceStyleInClassroom()`。

RTK Query：`src/store/slices/curriculum.ts`，tag `SkillTree`（樹的動作）、`SkillTalk`（留言的動作）。`markRead` 用 optimistic update 直接清掉紅點，不重抓。@ 候選名單用現有的 `useGetMembershipsQuery`。

### 2.7 畫面

```
/curriculum                     選舞種：每個舞種一張卡（技能數、討論中、紅點）；沒樹的顯示「建立技能樹」（有 edit 才有按鈕）
/curriculum/[danceStyleId]      技能樹
/curriculum/[danceStyleId]/talk 討論總覽
```

**技能樹頁**（`src/features/curriculum/`）：

- **頁首**：舞種名稱、切換舞種、「討論」（討論中數量＋紅點，連到總覽）、「分類與等級」（edit）、「已封存 N」。
- **分類分頁**：`SegmentedTabs`，每個分頁有顏色圓點＋圖示、名稱、技能數、橘色的討論中數。
- **篩選**：`FilterChip` 全部／討論中 N／有新留言 N（不符合的技能變淡）；「待定區 N」chip（有新留言時帶紅點）。
- **等級欄**：桌面是並排的欄（一轉＋標籤＋技能數 → 技能節點 → 「＋ 新增技能」）；手機改成上下堆疊的區塊，同一份元件只換 grid 排法（照 `docs/ui-responsive.md`，不寫兩套）。
- **技能節點**：分類色的圓＋圖示＋名稱，右上角留言數徽章（有新的就換成提醒色）。
- **點節點 → 技能抽屜**（`Drawer`：桌面置中彈窗、手機底部面板），網址同步 `?skill=<id>`，總覽頁和之後的推播都能直接連進來。抽屜分兩個分頁：
  - **內容**：名稱／全名／描述（離開欄位就存）、分類 chip、等級 chip、修改紀錄（先 5 筆，可展開）、「從樹上移除」（`dangerSecondary`，二次確認）。沒有 edit 權限時全部唯讀。
  - **討論**：見下。
- **分類與等級抽屜**（edit）：分類列表（↑↓ 排序、顏色＋圖示＋名稱編輯、刪除時選「技能搬到哪個分類」或「一起封存」），等級列表（↑↓、標籤、刪除）、「新增第 N 轉」。
- **待定區抽屜**：貼上框（Enter 加一個、按鈕一次加多行）、待定卡列表（名稱、等級、留言數與紅點、誰加的）、多選 → 選分類與等級 → 「N 張放進樹」。點卡片打開同一個技能抽屜（待定時分類 chip 顯示「還沒放進樹」）。
- **已封存**：列表＋「還原」。
- **空樹**：`EmptyState kind="page"`「{舞種} 還沒有技能樹」，兩個選項：「用預設的五個分類、一轉到三轉」、「完全空白，自己建」。沒樹時也可以先開待定區丟名字。沒有 edit 的人只看到「還沒有建立技能樹」。

**留言板**（`src/features/curriculum/talk/`，抽屜「討論」分頁與待定卡共用）：

- 最上面釘著結論卡（內容、作者、誰標的、何時；結論是回覆時有「看討論串」）。
- 輸入框：打 `@` 跳出最多 6 位成員，選了插入「@名字 」；⌘／Ctrl+Enter 送出。
- 留言由舊到新：頭像字、名字（自己顯示「你」）、相對時間、「· 已編輯」、結論標籤、⋯ 選單（標成結論／取消、編輯（自己的）、刪除（自己的或管理員，二次確認））、表情列（數量，hover 看是誰）、😊 選表情、回覆數＋回覆者頭像。
- 點留言進討論串：返回、主留言、回覆、回覆輸入框。內文的 @名字 會標色。
- 打開討論就呼叫 `markRead`。

**討論總覽**：`FilterChip` 全部／討論中／有新留言／有結論（帶數量）；每列是技能名＋「分類 · 等級」（待定顯示「待定 · 還沒放進樹」，封存顯示「已從樹上移除」）、結論或最新一則留言、作者、日期、留言數。未讀排前面，再依最新留言排序。點了進技能樹並打開那個技能的討論分頁。

### 2.8 測試

- `src/domains/curriculum/skillTree.test.ts`、`talk.test.ts`（見 2.4）。
- `tests/api/curriculum-tree.test.ts`：
  - 模組沒開 404、沒有 edit 不能改樹（403）、有 view 可以讀
  - 別間教室的舞種／技能／分類 404
  - 預設樹建立、已有樹時拒絕
  - 刪分類：搬到別的分類／一起封存，留下最後一個時拒絕
  - 刪等級後順序重排
  - 貼上待定：去重、跳過樹上已有的名字、上限 100
  - 待定放進樹後留言還在、已讀還在
  - 封存／還原寫進修改紀錄
- `tests/api/curriculum-talk.test.ts`：
  - 只有 view 的人可以留言、按表情、標結論
  - 回覆的回覆被攤平
  - 只有作者能編輯；作者或管理員能刪除
  - 同表情再按一次＝取消
  - 每個技能只有一則結論
  - @ 寫進 mention、`markRead` 後紅點和 @ 都清掉

### 2.9 完成條件

- 開了技能樹的教室，在某個舞種建立預設樹，加幾個技能、貼一串待定、放進樹、封存再還原，修改紀錄都對。
- 兩個帳號互相留言、@、按表情、標結論，對方看到紅點；打開後紅點消失。
- 小幫手（預設只有 view）看得到樹、能留言，但沒有任何編輯按鈕，直接打 API 也是 403。

---

## 第 3 階段：水庫前端介面

目標：把 water-tank 的畫面搬進 `/finance`，**仍然用假資料**，先把流程和版面定下來。這個階段沒有資料表、沒有 API。

> 2026-10-27：水庫先鎖起來（`LOCKED_MODULES`），專心把技能樹做完上線，免得推一個沒做完的水庫出去。畫面和程式都留著，要繼續做時把 `finance` 從 `LOCKED_MODULES` 拿掉。

> 搬的是 water-tank 的**工作目錄**，不是 HEAD：`src/lib/settlement.ts`、`src/components/close/` 尚未 commit，`close/page.tsx`、`mock-data.ts` 有未 commit 的改動（`payroll[].cashOnHand` 已換成 `closeHoldings`／`closeTank`＋`planSettlement`）。

### 3.1 網址與頁面

| googoocard | water-tank | 內容 |
|---|---|---|
| `/finance` | `/` | 儀表板：水庫水位（帳上餘額＋未認列預收）、本月收入／支出／流入水庫／距發薪日、每週收支長條、錢在誰手上、待處理、最近交易 |
| `/finance/ledger` | `/ledger` | 流水帳：依日期分組；「記一筆」「轉移」按了才彈出表單；點一列看誰記的、修改紀錄，可編輯（要寫原因）、封存（不算收支、可還原），不會真的刪掉 |
| `/finance/funds` | `/funds` | 資金與繳回：大水庫、各據點小水庫、轉帳中待確認、繳回規則、繳回紀錄 |
| `/finance/funds/settings` | `/funds/settings` | 各據點資金模式（集中繳回／直接入帳）、保管人、零用金、提醒門檻 |
| `/finance/funds/[poolId]` | `/funds/tainan` | 單一小水庫：餘額／零用金／可繳回、現金在誰手上、上次繳回後的進出。**原本寫死台南，改成動態路由** |
| `/finance/funds/[poolId]/remit` | `/funds/remit` | 繳回大水庫表單（轉帳／現金／抵薪） |
| `/finance/sessions` | `/sessions` | 單一場次分帳試算（收入、場租、取整 → 每人分多少、流入水庫多少） |
| `/finance/rules` | `/rules` | 分帳規則：錢怎麼流、分配對象、取整、版本紀錄 |
| `/finance/close` | `/close` | 月結與發薪：步驟、薪資表、逐堂明細、結算計畫（核准 → 轉帳 → 確認收到）、據點間拆帳、月報摘要 |

**不搬 `/members`**。水庫的「成員」就是 googoocard 已經有的 `Teacher`（含外師，不一定是使用者）和 `Membership`（會經手現金的人），第 4 階段接真資料時直接用，不另做名單。

### 3.2 外框與導覽

- `src/app/(main)/finance/layout.tsx`：`ModuleGate module="finance" permission="finance.view"` → 頁首標題「水庫」＋子分頁 → `children`。
- 子分頁 `src/features/finance/FinanceTabs.tsx`：用 `SegmentedTabs`（`underline`）。分頁依序為儀表板、流水帳、資金、場次分帳、分帳規則、月結；手機上可以橫向捲動。
- **不搬 water-tank 的深色側欄**，用 googoocard 自己的側欄（第 1 階段加的「水庫」連結）。
- 版面頂端放一條「示意資料」提示（`primary-50` 說明提示區）：「這裡的數字是假的，第 4 階段接上點名與課卡資料後才會是真的」。避免有人拿去當真帳。
- 所有連結用 `src/features/finance/routes.ts` 的 `financeHref()` 組，不在元件或假資料裡寫死 `/finance/...`。

### 3.3 檔案配置

```
src/app/(main)/finance/
  layout.tsx  page.tsx
  ledger/page.tsx
  funds/page.tsx  funds/settings/page.tsx
  funds/[poolId]/page.tsx  funds/[poolId]/remit/page.tsx
  sessions/page.tsx  rules/page.tsx  close/page.tsx
src/features/finance/
  mockData.ts         ← water-tank src/lib/mock-data.ts（工作目錄版）
  routes.ts           ← financeHref()
  FinanceTabs.tsx
  Money.tsx           ← water-tank ui.tsx 的 Money，內部用 src/lib/money.ts 的 formatMoney
  dashboard/  ledger/  funds/  sessions/  rules/  close/   ← 對應 water-tank src/components/**
src/domains/finance/
  split.ts            ← calculateSplit（純函式）
  settlement.ts       ← planSettlement（純函式）
  split.test.ts  settlement.test.ts   ← water-tank 沒有測試，這裡補
```

- `settlement.ts` 現在會 import `formatMoney` 拼 `note` 字串，搬的時候改成回傳結構化欄位，由畫面組字，讓 domain 保持純計算。
- 用到 `typeof session`、`typeof branchSettings`、`typeof mainPool` 當 props 型別的地方，改成在 `src/features/finance/types.ts` 定義具名型別。第 4 階段換成 API 回傳時就不用再改元件。
- 不搬 Next 16 的東西（`LayoutProps<"/">`、`cacheComponents`、`partialPrefetching`）。

### 3.4 換成 googoocard 的設計系統

| water-tank | googoocard |
|---|---|
| `Card` | `rounded-2xl border border-neutral-200 bg-white`（照設計系統，不加陰影） |
| `PageHeader` | 現有頁面標題寫法（`text-2xl font-bold`）；麵包屑用 `Button variant="link"` |
| `Badge`（water／expense／indigo／neutral／ok） | `StatusTag`（positive／warning／danger／neutral／outline） |
| `buttonPrimary`／`buttonSecondary` | `Button` primary／secondary（`Link` 外面包按鈕樣式的方式照現有頁面） |
| `fieldClass` | `Field`／`fieldControlClass()` |
| 收入藍、支出橘 | 收入 `primary-900`、支出 `warning-950`（淡底＋深字成對）。**不新增 water／expense 色票** |
| 深色水位卡 | `primary-900` 底＋白字（設計系統允許的唯一深底） |
| `.num`＋IBM Plex Mono | `tabular-nums`，不換字型 |
| 每週收支 CSS 長條 | 照搬成 CSS 長條，顏色用 `primary-500`（裝飾填色）和 `warning-300` |
| 空的表格列 | `EmptyState kind="filtered"` |

water-tank 的 `globals.css` 主題（`ink`、`line`、`muted`、`field`…）**一個都不搬**。`muted` 在這裡會跟 shadcn 的語意相反，`--font-sans`、`body` 也是全域規則，搬進來會影響整個 app。

### 3.5 寫死的東西

- 「BAILAMORE」「早安，丁丁」：改成目前教室名稱、目前使用者名稱（現有的 classrooms／me query）。
- 台南／高雄／共用、老師 B／C／D、外師 E、老闆、會計：假資料裡保留，但集中在 `mockData.ts`，元件裡不出現。
- 「10 月」「2026/10/24」：從 `mockData.ts` 的 `month` 推，不散落在元件裡。
- `entry-form` 的收入／支出分類跟 `categories` 不一致（缺「教師費」）：統一成 `mockData.ts` 的一份 `INCOME_CATEGORIES`／`EXPENSE_CATEGORIES`。

### 3.6 互動與權限

- 表單、切換、核准流程照 water-tank 用元件內的 state 做（例如記一筆後顯示「（示意）已記錄」），不打 API。
- 會改東西的按鈕（記一筆、發布規則、核准發薪、繳回、存進銀行、據點設定的儲存）只在 `useCan("finance.edit")` 時顯示。假資料階段就先接好，第 4 階段才不用回頭補。
- 原本沒反應的按鈕（匯出 CSV、預覽月報 PDF、上傳收據）改成 `disabled`，旁邊標「之後」，不要留按了沒反應的按鈕。

### 3.7 桌面／手機

照 `docs/ui-responsive.md`：water-tank 多是桌面雙欄（例如月結左薪資右結算），在 `lg:` 以下改單欄。流水帳表格用 `DataView`（手機卡片、電腦表格）；「記一筆」「轉移」一律按了才開 `Drawer`（桌面置中、手機底部），一筆的詳細桌面用 `SideSheet`。

### 3.8 完成條件

- 開了水庫、有 `finance.view` 的人：每個分頁都能點、版面完整、手機不破版。
- 沒有 `finance.edit` 的人：看得到但沒有任何會改東西的按鈕。
- `split.test.ts`、`settlement.test.ts` 通過（6 堂 2,000 元、取整到 10、多據點持有現金抵薪等案例）。
- 沒開水庫的教室：`/finance` 顯示「沒有開啟水庫」，側欄沒有入口。

---

## 第 4 階段以後（不在這次範圍）

只列方向和已知要決定的事，動工前再各自寫規劃。

### 水庫接真資料

- **收入只有一套定義**：直接用 `src/lib/income.ts` 的 `periodRevenue`（依上課攤提）＋`card-monthly`（依購買日，即預收）。water-tank §8.1 的「最後一堂補零頭」公式要併進 `periodRevenue`，否則收入頁和水庫會差幾分錢；併進去會讓收入頁的數字小幅變動，要先確認。
- **錢在誰手上**：`StudentCard.paidByUserId`、`paymentMethod` 已經有了；缺「代收交接給誰、何時確認」，要在 `StudentCard` 加欄位（對應 §2.1 的 `handed_over_to`／`handed_over_confirmed_at`）。
- **水庫自己的表**：流水帳（可編輯、封存，每次改動留歷程；金錢轉移要收的人確認）、支出分類、資金池與保管人（以 `Location` 為據點）、繳回紀錄、分帳規則與版本、月結快照與薪資單。
- 自動帶入的列（課卡收款、點名認列）在水庫裡唯讀，標「來源：點名系統」，要改回核心改。
- 月結後核心資料被改 → 在目前未關帳月份記調整分錄（§8.4）。
- 待決定：欠卡暫估單價（§8.3）、課卡**轉換與轉讓**怎麼認列（原規格沒寫到）、退費、過期未用完的堂數、跨據點上課的拆帳（§10）。
- `/income` 頂端給有 `finance.view` 的人一個「本月損益 → 水庫」連結。

### 課綱其他部分（teach-what 剩下的）

- 課綱地圖：`curriculumLevels` 對應到 `DanceStyle`＋`Lesson.level`（1 初階／2 中階／3 進階），不另做一套等級。
- 備課與上課紀錄：掛在 `LessonPeriod` 上；出席直接用核心的 `AttendanceRecord`，**不搬 teach-what 的 `lessons.attendance` jsonb**。
- 學生自評、看自己的技能樹：走 LIFF（`/liff/skills`），不給學生帳號登入。
- 影片、草稿投票、前置技能、目標、評分量表、AI 整理。
- 嵌進核心頁面：課程頁的「備課」分頁、學生抽屜的「技能」區（需要 §1.7 的 ESLint 例外）。

### 其他

- iOS App 的模組入口。
- 模組長大後，Prisma schema 拆成多檔。
