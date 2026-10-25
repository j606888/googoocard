import { LineMenuMode } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  buildMenuFlex,
  buildMoreMenuFlex,
  buildStudentMenuFlex,
  liffPath,
  textMessage,
  SWITCH_TO_STUDENT,
  SWITCH_TO_TEACHER,
  type LineMessage,
  type LineWebhookEvent,
} from "@/lib/line";
import {
  groupByTaipeiDay,
  mapsUri,
  myCardsFlex,
  priceListFlex,
  quickReplyText,
  scheduleCarousel,
  type PriceGroup,
} from "@/lib/lineFlex";
import { formatCardSerial } from "@/lib/cardSerial";
import { lessonLevelLabel } from "@/lib/danceLevels";
import { parseTaipeiDateRange, toTaipeiDateKey } from "@/lib/taipei-date";

/**
 * The LINE bot: binding keys, the 老師/學生 menus, and the rich-menu actions that
 * answer right in the chat (課表／價目表／我的課卡／更多). The webhook route only
 * verifies the signature and hands each event here with a `reply` that calls
 * LINE; the /dev/line simulator passes one that collects the messages instead.
 *
 * Everything is a reply (never a push), so none of it counts against the
 * official account's message quota.
 */
export type Reply = (messages: LineMessage[]) => Promise<void>;

/** Postback `a=` actions — the rich menu (src/lib/lineRichMenu.json) sends these. */
export const BOT_ACTIONS = ["schedule", "prices", "mycards", "more", "bindhelp", "classrooms", "pick"] as const;
type BotAction = (typeof BOT_ACTIONS)[number];

// Typed keywords that do the same as the rich menu buttons.
const KEYWORDS: Record<string, BotAction> = {
  課表: "schedule",
  價目表: "prices",
  價目: "prices",
  價格: "prices",
  我的課卡: "mycards",
  課卡: "mycards",
  更多: "more",
};

const BIND_HELP =
  "綁定學生身分有兩種方式：\n1. 到教室時用手機相機掃門口的簽到 QR，第一次來可以直接登記。\n2. 請老師給你綁定連結，點開後把訊息傳出去就完成了。";

const SCHEDULE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Account state ───────────────────────────────────────────────────────────

/** Remembered default menu (老師/學生) for accounts bound to both. */
async function getMenuMode(lineUserId: string): Promise<LineMenuMode> {
  const account = await prisma.lineAccount.findUnique({ where: { lineUserId } });
  return account?.menuMode ?? LineMenuMode.TEACHER;
}
async function setMenuMode(lineUserId: string, menuMode: LineMenuMode): Promise<void> {
  await prisma.lineAccount.upsert({
    where: { lineUserId },
    update: { menuMode },
    create: { lineUserId, menuMode },
  });
}
/** Remember which student this account last selected (in LIFF or on bind). */
async function setSelectedStudent(lineUserId: string, selectedStudentId: number): Promise<void> {
  await prisma.lineAccount.upsert({
    where: { lineUserId },
    update: { selectedStudentId },
    create: { lineUserId, selectedStudentId },
  });
}

/**
 * The student this account is acting as: the LIFF-selected one when it's still
 * bound here, otherwise the first bound student (stable by id). Archived
 * students don't count — from LINE they look unbound.
 */
export async function currentStudent(lineUserId: string) {
  const account = await prisma.lineAccount.findUnique({ where: { lineUserId } });
  if (account?.selectedStudentId != null) {
    const selected = await prisma.student.findFirst({
      where: { id: account.selectedStudentId, lineUserId, archivedAt: null },
    });
    if (selected) return selected;
  }
  return prisma.student.findFirst({ where: { lineUserId, archivedAt: null }, orderBy: { id: "asc" } });
}

async function teacherFor(lineUserId: string) {
  return prisma.user.findFirst({ where: { lineUserId, deletedAt: null } });
}

const listedClassrooms = () =>
  prisma.classroom.findMany({
    where: { lineListed: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

export type ResolvedClassroom =
  | { kind: "classroom"; classroomId: number; via: "student" | "teacher" | "browse" | "listed" }
  | { kind: "pick"; classrooms: { id: number; name: string }[] }
  | { kind: "none" };

/**
 * Which classroom's 課表／價目表 this LINE account sees. The official account may
 * serve several classrooms, so in order:
 *  1. the bound student's classroom;
 *  2. the bound teacher's current classroom (if still a member);
 *  3. the public classroom they picked before (`LineAccount.browseClassroomId`);
 *  4. the only public (`lineListed`) classroom — or, with several, ask them to pick.
 */
export async function resolveLineClassroom(lineUserId: string): Promise<ResolvedClassroom> {
  const student = await currentStudent(lineUserId);
  if (student) return { kind: "classroom", classroomId: student.classroomId, via: "student" };

  const teacher = await teacherFor(lineUserId);
  if (teacher?.currentClassroomId) {
    const membership = await prisma.membership.findFirst({
      where: { userId: teacher.id, classroomId: teacher.currentClassroomId, classroom: { deletedAt: null } },
    });
    if (membership) return { kind: "classroom", classroomId: teacher.currentClassroomId, via: "teacher" };
  }

  const listed = await listedClassrooms();
  const account = await prisma.lineAccount.findUnique({ where: { lineUserId } });
  if (account?.browseClassroomId && listed.some((c) => c.id === account.browseClassroomId)) {
    return { kind: "classroom", classroomId: account.browseClassroomId, via: "browse" };
  }
  if (listed.length === 1) return { kind: "classroom", classroomId: listed[0].id, via: "listed" };
  if (listed.length > 1) return { kind: "pick", classrooms: listed };
  return { kind: "none" };
}

// ── Actions ─────────────────────────────────────────────────────────────────

function classroomPicker(classrooms: { id: number; name: string }[], then: string) {
  return quickReplyText(
    "要看哪一間教室？",
    classrooms.map((c) => ({ label: c.name, data: `a=pick&c=${c.id}&then=${then}` }))
  );
}

/** Resolve the classroom, or reply with the picker / "nothing public" and return null. */
async function classroomOrAsk(lineUserId: string, then: string, reply: Reply) {
  const resolved = await resolveLineClassroom(lineUserId);
  if (resolved.kind === "classroom") {
    return prisma.classroom.findUniqueOrThrow({
      where: { id: resolved.classroomId },
      select: { id: true, name: true },
    });
  }
  if (resolved.kind === "pick") await reply([classroomPicker(resolved.classrooms, then)]);
  else await reply([textMessage(`目前還沒有公開的課表。\n\n${BIND_HELP}`)]);
  return null;
}

async function replySchedule(lineUserId: string, loc: string | null, reply: Reply) {
  const classroom = await classroomOrAsk(lineUserId, "schedule", reply);
  if (!classroom) return;

  const locations = await prisma.location.findMany({
    where: { classroomId: classroom.id, archivedAt: null },
    select: { id: true, name: true, address: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  // Several 分部 and no choice yet → ask which one first.
  if (loc === null && locations.length > 1) {
    await reply([
      quickReplyText("要看哪個分部的課表？", [
        ...locations.map((l) => ({ label: l.name, data: `a=schedule&loc=${l.id}`, displayText: `${l.name}課表` })),
        { label: "全部", data: "a=schedule&loc=all", displayText: "全部課表" },
      ]),
    ]);
    return;
  }
  const location = loc && loc !== "all" ? locations.find((l) => String(l.id) === loc) ?? null : null;

  const { start } = parseTaipeiDateRange(toTaipeiDateKey(new Date()));
  const periods = await prisma.lessonPeriod.findMany({
    where: {
      startTime: { gte: start, lt: new Date(start.getTime() + SCHEDULE_DAYS * DAY_MS) },
      lesson: {
        classroomId: classroom.id,
        endedAt: null,
        ...(location ? { locationId: location.id } : {}),
      },
    },
    orderBy: { startTime: "asc" },
    select: {
      startTime: true,
      endTime: true,
      lesson: {
        select: {
          name: true,
          level: true,
          danceStyle: { select: { name: true, hasLevels: true } },
          location: { select: { name: true } },
          teachers: { select: { teacher: { select: { name: true } } }, orderBy: { id: "asc" } },
        },
      },
    },
  });

  const days = groupByTaipeiDay(
    periods.map((p) => ({
      startTime: p.startTime,
      endTime: p.endTime,
      lessonName: p.lesson.name,
      styleLabel: [p.lesson.danceStyle.name, lessonLevelLabel(p.lesson.danceStyle, p.lesson.level)]
        .filter(Boolean)
        .join(" "),
      teacherNames: p.lesson.teachers.map((t) => t.teacher.name),
      locationName: p.lesson.location?.name ?? null,
    }))
  );
  await reply([
    scheduleCarousel({
      classroomName: classroom.name,
      locationName: location?.name ?? null,
      days,
      mapUri: location?.address ? mapsUri(location.address) : null,
    }),
  ]);
}

async function replyPrices(lineUserId: string, reply: Reply) {
  const classroom = await classroomOrAsk(lineUserId, "prices", reply);
  if (!classroom) return;

  const cards = await prisma.card.findMany({
    where: { classroomId: classroom.id, expiredAt: null },
    select: {
      name: true,
      price: true,
      sessions: true,
      isTrial: true,
      isPracticeCard: true,
      danceStyle: { select: { name: true, sortOrder: true } },
    },
    orderBy: [{ price: "asc" }, { id: "asc" }],
  });
  const general = cards.filter((c) => !c.isTrial && !c.isPracticeCard);
  const practice = cards.filter((c) => !c.isTrial && c.isPracticeCard);
  const trial = cards.filter((c) => c.isTrial);

  const practiceByStyle = new Map<string, { order: number; cards: typeof practice }>();
  for (const c of practice) {
    const key = c.danceStyle?.name ?? "";
    const entry = practiceByStyle.get(key) ?? { order: c.danceStyle?.sortOrder ?? 999, cards: [] };
    entry.cards.push(c);
    practiceByStyle.set(key, entry);
  }

  const toPrice = (c: (typeof cards)[number]) => ({ name: c.name, sessions: c.sessions, price: c.price });
  const groups: PriceGroup[] = [
    { title: "課卡", note: "各分部通用", cards: general.map(toPrice) },
    ...[...practiceByStyle.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([style, g]) => ({
        title: style ? `${style} 複習卡` : "複習卡",
        note: "完成該舞種課程的學生才能購買",
        cards: g.cards.map(toPrice),
      })),
    { title: "體驗課", note: "買過正式課卡的舊生體驗課免費。報名請洽老師。", cards: trial.map(toPrice) },
  ];

  const student = await currentStudent(lineUserId);
  await reply([
    priceListFlex({
      classroomName: classroom.name,
      groups,
      buyUri: student && student.classroomId === classroom.id ? liffPath("buy") : null,
    }),
  ]);
}

async function replyMyCards(lineUserId: string, reply: Reply) {
  const student = await currentStudent(lineUserId);
  if (!student) {
    await reply([
      quickReplyText(`還沒有綁定學生身分，所以看不到課卡。\n\n${BIND_HELP}`, [
        { label: "看課表", data: "a=schedule", displayText: "課表" },
        { label: "看價目表", data: "a=prices", displayText: "價目表" },
      ]),
    ]);
    return;
  }
  const [classroom, cards, studentCount] = await Promise.all([
    prisma.classroom.findUniqueOrThrow({ where: { id: student.classroomId }, select: { name: true } }),
    prisma.studentCard.findMany({
      where: {
        studentId: student.id,
        OR: [{ remainingSessions: { gt: 0 }, expiredAt: null }, { isPaid: false }],
      },
      select: {
        serialNumber: true,
        remainingSessions: true,
        totalSessions: true,
        isPaid: true,
        finalPrice: true,
        card: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.student.count({ where: { lineUserId, archivedAt: null } }),
  ]);

  await reply([
    myCardsFlex({
      studentName: student.name,
      classroomName: classroom.name,
      cards: cards.map((c) => ({
        name: c.card.name,
        serial: formatCardSerial(c.serialNumber),
        remainingSessions: c.remainingSessions,
        totalSessions: c.totalSessions,
        unpaidAmount: c.isPaid ? null : c.finalPrice,
      })),
      cardsUri: liffPath("cards"),
      buyUri: liffPath("buy"),
      switchUri: studentCount > 1 ? liffPath("cards?switch=1") : null,
    }),
  ]);
}

async function replyMore(lineUserId: string, reply: Reply) {
  const [student, teacher, studentCount, listed] = await Promise.all([
    currentStudent(lineUserId),
    teacherFor(lineUserId),
    prisma.student.count({ where: { lineUserId, archivedAt: null } }),
    listedClassrooms(),
  ]);
  await reply([
    buildMoreMenuFlex({
      studentSwitch: studentCount > 1,
      teacher: !!teacher,
      classroomSwitch: !student && !teacher && listed.length > 1,
    }),
  ]);
}

async function replyClassrooms(reply: Reply) {
  const listed = await listedClassrooms();
  if (listed.length === 0) await reply([textMessage("目前還沒有公開的教室。")]);
  else await reply([classroomPicker(listed, "schedule")]);
}

/** A public classroom was picked: remember it, then carry on with what they asked for. */
async function pickClassroom(lineUserId: string, params: URLSearchParams, reply: Reply) {
  const id = Number(params.get("c"));
  const listed = await listedClassrooms();
  if (!listed.some((c) => c.id === id)) {
    await reply([textMessage("這間教室目前沒有公開課表。")]);
    return;
  }
  await prisma.lineAccount.upsert({
    where: { lineUserId },
    update: { browseClassroomId: id },
    create: { lineUserId, browseClassroomId: id },
  });
  if (params.get("then") === "prices") await replyPrices(lineUserId, reply);
  else await replySchedule(lineUserId, null, reply);
}

async function runAction(action: BotAction, lineUserId: string, params: URLSearchParams, reply: Reply) {
  switch (action) {
    case "schedule":
      return replySchedule(lineUserId, params.get("loc"), reply);
    case "prices":
      return replyPrices(lineUserId, reply);
    case "mycards":
      return replyMyCards(lineUserId, reply);
    case "more":
      return replyMore(lineUserId, reply);
    case "bindhelp":
      return reply([textMessage(BIND_HELP)]);
    case "classrooms":
      return replyClassrooms(reply);
    case "pick":
      return pickClassroom(lineUserId, params, reply);
  }
}

const isBotAction = (value: string | null): value is BotAction =>
  value !== null && (BOT_ACTIONS as readonly string[]).includes(value);

// ── Event entry ─────────────────────────────────────────────────────────────

export async function handleLineEvent(event: LineWebhookEvent, reply: Reply): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  if (event.type === "postback") {
    const data = event.postback?.data ?? "";
    const params = new URLSearchParams(data);
    const action = params.get("a");
    if (isBotAction(action)) return runAction(action, lineUserId, params, reply);
    // Older Flex menus: 老師／學生 switch buttons.
    return sendMenu(reply, lineUserId, data || null);
  }

  // A new friend: say what the bot can do.
  if (event.type === "follow") {
    await reply([
      quickReplyText(
        "歡迎！點下方選單就能看課表、價目表和自己的課卡。",
        [
          { label: "課表", data: "a=schedule" },
          { label: "價目表", data: "a=prices" },
          { label: "我的課卡", data: "a=mycards" },
        ]
      ),
    ]);
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") return;

  // A binding key always takes priority, even if this LINE account is already
  // bound to something else. Teacher and student bindings live on separate
  // tables (User.lineUserId / Student.lineUserId), so one LINE account can be
  // both — e.g. a teacher binding their own student profile via the link.
  const text = event.message.text?.trim() ?? "";
  if (text) {
    const user = await prisma.user.findUnique({ where: { randomKey: text } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lineUserId, randomKey: null },
      });
      await setMenuMode(lineUserId, LineMenuMode.TEACHER);
      await reply([
        textMessage(`綁定成功，${user.name}！傳任何訊息即可叫出選單。`),
        buildMenuFlex({ showSwitch: await isStudent(lineUserId) }),
      ]);
      return;
    }

    const student = await prisma.student.findUnique({ where: { lineBindKey: text } });
    if (student) {
      // One LINE account can bind multiple students across DIFFERENT classrooms,
      // but only one per classroom. If this account already has another student
      // in the same classroom, auto-rebind: release the old one, bind the new.
      // Consuming the one-time lineBindKey keeps re-sending the same key idempotent.
      const previous = await prisma.student.findFirst({
        where: { lineUserId, classroomId: student.classroomId, id: { not: student.id } },
      });
      if (previous) {
        await prisma.student.update({
          where: { id: previous.id },
          data: { lineUserId: null },
        });
      }
      await prisma.student.update({
        where: { id: student.id },
        data: { lineUserId, lineBindKey: null },
      });
      await setMenuMode(lineUserId, LineMenuMode.STUDENT);
      await setSelectedStudent(lineUserId, student.id);
      await reply([
        textMessage(
          previous
            ? `綁定成功，已將本教室的綁定從「${previous.name}」切換為「${student.name}」！🎉`
            : `綁定成功，${student.name}！🎉`,
        ),
        buildStudentMenuFlex({
          name: student.name,
          showSwitch: await isTeacher(lineUserId),
          showStudentSwitch: (await prisma.student.count({ where: { lineUserId } })) > 1,
        }),
      ]);
      return;
    }

    const keyword = KEYWORDS[text];
    if (keyword) return runAction(keyword, lineUserId, new URLSearchParams(), reply);
  }

  // Not a binding key — show the menu for whatever this account is bound to.
  await sendMenu(reply, lineUserId, null);
}

async function isTeacher(lineUserId: string): Promise<boolean> {
  return (await prisma.user.findUnique({ where: { lineUserId } })) !== null;
}

async function isStudent(lineUserId: string): Promise<boolean> {
  return (await prisma.student.findFirst({ where: { lineUserId, archivedAt: null } })) !== null;
}

/**
 * Reply with the appropriate menu. `requested` is a switch postback value, or
 * null to pick the default. For accounts bound to BOTH a teacher and a student,
 * the default follows the remembered `menuMode` (set on switch / bind) so a
 * switch to the student menu sticks across messages. Each menu exposes a switch
 * button only when the account holds the other identity; the student menu also
 * offers「切換學生」when the account is bound to more than one student.
 */
async function sendMenu(reply: Reply, lineUserId: string, requested: string | null): Promise<void> {
  // A LINE account may be bound to multiple students (across classrooms). The
  // flex menu reflects one student for the title; real multi-student switching
  // happens in LIFF via the「切換學生」button.
  const [teacher, student, studentCount] = await Promise.all([
    prisma.user.findUnique({ where: { lineUserId } }),
    currentStudent(lineUserId),
    prisma.student.count({ where: { lineUserId } }),
  ]);
  const isBoth = !!teacher && !!student;
  const studentMenu = () =>
    buildStudentMenuFlex({
      name: student!.name,
      showSwitch: isBoth,
      showStudentSwitch: studentCount > 1,
    });

  if (requested === SWITCH_TO_STUDENT && student) {
    await setMenuMode(lineUserId, LineMenuMode.STUDENT);
    await reply([studentMenu()]);
    return;
  }
  if (requested === SWITCH_TO_TEACHER && teacher) {
    await setMenuMode(lineUserId, LineMenuMode.TEACHER);
    await reply([buildMenuFlex({ showSwitch: isBoth })]);
    return;
  }

  // Default: for both-bound accounts follow the remembered mode; otherwise the
  // only identity they have.
  if (isBoth) {
    const mode = await getMenuMode(lineUserId);
    await reply([mode === LineMenuMode.STUDENT ? studentMenu() : buildMenuFlex({ showSwitch: true })]);
    return;
  }
  if (teacher) {
    await reply([buildMenuFlex({ showSwitch: false })]);
    return;
  }
  if (student) {
    await reply([studentMenu()]);
    return;
  }

  // Unbound: what they can still do without an identity.
  await reply([
    quickReplyText(`嗨！還沒有綁定學生身分也可以看課表和價目表。\n\n${BIND_HELP}`, [
      { label: "課表", data: "a=schedule" },
      { label: "價目表", data: "a=prices" },
    ]),
  ]);
}
