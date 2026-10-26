import prisma from "@/lib/prisma";
import {
  buildMoreMenuFlex,
  buildStudentMenuFlex,
  liffPath,
  textMessage,
  type LineMessage,
  type LineWebhookEvent,
} from "@/lib/line";
import {
  groupByTaipeiDay,
  locationsFlex,
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
import { monthAttendanceCount } from "@/service/checkin";
import { bindStudentLine } from "@/service/lineBinding";

/**
 * The LINE bot — students only (teachers use the website): binding keys, the
 * student menu, and the rich-menu actions that answer right in the chat
 * (價目表／我的課卡／更多／教室地點; 課表 is also a LIFF page). The webhook route only
 * verifies the signature and hands each event here with a `reply` that calls
 * LINE; the /dev/line simulator passes one that collects the messages instead.
 *
 * Everything is a reply (never a push), so none of it counts against the
 * official account's message quota.
 */
export type Reply = (messages: LineMessage[]) => Promise<void>;

/** Postback `a=` actions — the rich menu (src/lib/lineRichMenu.json) sends these. */
export const BOT_ACTIONS = ["schedule", "prices", "mycards", "more", "bindhelp", "classrooms", "pick", "locations"] as const;
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
  課卡方案: "prices",
  切換教室: "more",
  教室地點: "locations",
  地點: "locations",
  地址: "locations",
};

const BIND_HELP =
  "綁定學生身分有兩種方式：\n1. 到教室時用手機相機掃門口的簽到 QR，第一次來可以直接登記。\n2. 請老師給你綁定連結，點開後把訊息傳出去就完成了。";

const SCHEDULE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Account state ───────────────────────────────────────────────────────────

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

const listedClassrooms = () =>
  prisma.classroom.findMany({
    where: { lineListed: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

export type ResolvedClassroom =
  | { kind: "classroom"; classroomId: number; via: "student" | "browse" | "listed" }
  | { kind: "pick"; classrooms: { id: number; name: string }[] }
  | { kind: "none" };

/**
 * Which classroom's 課表／價目表 this LINE account sees. The official account may
 * serve several classrooms, so in order:
 *  1. the bound student's classroom;
 *  2. the public classroom they picked before (`LineAccount.browseClassroomId`);
 *  3. the only public (`lineListed`) classroom — or, with several, ask them to pick.
 */
export async function resolveLineClassroom(lineUserId: string): Promise<ResolvedClassroom> {
  const student = await currentStudent(lineUserId);
  if (student) return { kind: "classroom", classroomId: student.classroomId, via: "student" };

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
      buyUri: student && student.classroomId === classroom.id ? liffPath("plans") : null,
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
      buyUri: liffPath("plans"),
      switchUri: studentCount > 1 ? liffPath("cards?switch=1") : null,
    }),
  ]);
}

const classroomLocations = (classroomId: number) =>
  prisma.location.findMany({
    where: { classroomId, archivedAt: null },
    select: { name: true, address: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

/** 「更多」: the bound student's own menu, or how to become one (buildMoreMenuFlex). */
async function replyMore(lineUserId: string, reply: Reply) {
  const [student, studentCount, listed] = await Promise.all([
    currentStudent(lineUserId),
    prisma.student.count({ where: { lineUserId, archivedAt: null } }),
    listedClassrooms(),
  ]);
  if (student) {
    const [classroom, locations, monthAttendance] = await Promise.all([
      prisma.classroom.findUniqueOrThrow({ where: { id: student.classroomId }, select: { name: true } }),
      classroomLocations(student.classroomId),
      monthAttendanceCount(student.id),
    ]);
    await reply([
      buildMoreMenuFlex({
        student: { name: student.name, classroomName: classroom.name, monthAttendance },
        locationNames: locations.map((l) => l.name),
        studentSwitch: studentCount > 1,
      }),
    ]);
    return;
  }
  const resolved = await resolveLineClassroom(lineUserId);
  const locations = resolved.kind === "classroom" ? await classroomLocations(resolved.classroomId) : [];
  await reply([
    buildMoreMenuFlex({
      locationNames: locations.map((l) => l.name),
      classroomSwitch: listed.length > 1,
    }),
  ]);
}

/** 教室地點: the classroom's 分部 with their addresses, each opening Google Maps. */
async function replyLocations(lineUserId: string, reply: Reply) {
  const classroom = await classroomOrAsk(lineUserId, "locations", reply);
  if (!classroom) return;
  const locations = await classroomLocations(classroom.id);
  if (locations.length === 0) {
    await reply([textMessage(`${classroom.name} 還沒有設定教室地點，請直接問老師。`)]);
    return;
  }
  await reply([locationsFlex({ classroomName: classroom.name, locations })]);
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
  const then = params.get("then");
  if (then === "prices") await replyPrices(lineUserId, reply);
  else if (then === "locations") await replyLocations(lineUserId, reply);
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
    case "locations":
      return replyLocations(lineUserId, reply);
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
    // Buttons on older Flex menus (e.g. the retired 老師／學生 switch).
    return sendMenu(reply, lineUserId);
  }

  if (event.type === "follow") return replyWelcome(lineUserId, reply);

  if (event.type !== "message" || event.message?.type !== "text") return;

  // A binding key always takes priority, even if this LINE account is already
  // bound to another student.
  const text = event.message.text?.trim() ?? "";
  if (text) {
    const student = await prisma.student.findUnique({ where: { lineBindKey: text } });
    if (student) {
      const { previous } = await bindStudentLine(student, lineUserId, "學生用 LINE 送出綁定碼");
      await reply([
        textMessage(
          previous
            ? `綁定成功，已將本教室的綁定從「${previous.name}」切換為「${student.name}」！🎉`
            : `綁定成功，${student.name}！🎉`,
        ),
        buildStudentMenuFlex({
          name: student.name,
          showStudentSwitch: (await prisma.student.count({ where: { lineUserId } })) > 1,
        }),
      ]);
      return;
    }

    const keyword = KEYWORDS[text];
    if (keyword) return runAction(keyword, lineUserId, new URLSearchParams(), reply);
  }

  // Not a binding key — show the menu for whatever this account is bound to.
  await sendMenu(reply, lineUserId);
}

/**
 * A new (or returning) friend. Someone already bound — typically registered at the
 * door, then added the official account from the check-in page — is greeted by
 * name; anyone else gets what they can do and how to become a student.
 */
async function replyWelcome(lineUserId: string, reply: Reply) {
  const student = await currentStudent(lineUserId);
  if (!student) {
    await reply([
      quickReplyText(
        `歡迎！不用綁定也能看課表和價目表。\n\n第一次來上課？到教室用手機相機掃門口的簽到 QR Code 就能登記。`,
        [
          { label: "課表", data: "a=schedule", displayText: "課表" },
          { label: "價目表", data: "a=prices", displayText: "價目表" },
        ]
      ),
    ]);
    return;
  }
  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id: student.classroomId },
    select: { name: true },
  });
  await reply([
    quickReplyText(
      `${student.name}，歡迎！已經連上你在 ${classroom.name} 的學生資料。\n\n下次上課直接按下方選單的「上課簽到」，不用再掃門口 QR；課卡快用完時也會在這裡提醒你。`,
      [
        { label: "我的課卡", data: "a=mycards", displayText: "我的課卡" },
        { label: "課表", data: "a=schedule", displayText: "課表" },
      ]
    ),
  ]);
}

/**
 * Reply with the student menu (bound) or what an unbound account can still do.
 * The flex menu reflects one student for the title; switching between students
 * (one per classroom) happens in LIFF via「切換教室」.
 */
async function sendMenu(reply: Reply, lineUserId: string): Promise<void> {
  const [student, studentCount] = await Promise.all([
    currentStudent(lineUserId),
    prisma.student.count({ where: { lineUserId, archivedAt: null } }),
  ]);
  if (student) {
    await reply([buildStudentMenuFlex({ name: student.name, showStudentSwitch: studentCount > 1 })]);
    return;
  }

  await reply([
    quickReplyText(`嗨！還沒有綁定學生身分也可以看課表和價目表。\n\n${BIND_HELP}`, [
      { label: "課表", data: "a=schedule" },
      { label: "價目表", data: "a=prices" },
    ]),
  ]);
}
