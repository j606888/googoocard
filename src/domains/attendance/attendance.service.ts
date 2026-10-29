import { AttendanceSource, Prisma, StudentCard } from "@prisma/client";
import prisma from "@/lib/prisma";
import { refreshLesson } from "@/service/lesson";
import { refreshNeedsRenewalTags } from "@/service/studentTag";
import { notifyClassroom } from "@/service/push";
import { canBuyCard, canUseCard, cardMatchesLesson, isQualified, requiredDanceStyleFor, requiredLevelFor, toDanceLevels } from "@/domains/qualification";
import { createStudentCardInTx } from "@/service/studentCard";
import { createDropInChargeInTx } from "@/service/dropIn";
import { formatCardSerial } from "@/lib/cardSerial";
import { formatMoney } from "@/lib/money";
import {
  fetchStudentsWithValidCards,
  type StudentWithLessonCards,
} from "@/service/lessonCards";

// Local alias kept so the rest of this file reads unchanged.
type StudentWithCards = StudentWithLessonCards;

type LessonWithCards = Prisma.LessonGetPayload<{
  include: {
    danceStyle: true;
    cards: {
      include: {
        card: true;
      };
    };
  };
}>;


async function validateAttendanceRequest(
  lessonId: number,
  lessonPeriodId: number
): Promise<{ lesson: LessonWithCards; lessonPeriod: { id: number; attendanceTakenAt: Date | null } }> {
  const [lesson, lessonPeriod] = await Promise.all([
    prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        danceStyle: true,
        cards: {
          include: {
            card: true,
          },
        },
      },
    }),
    prisma.lessonPeriod.findUnique({
      where: { id: lessonPeriodId, lessonId },
    }),
  ]);

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  if (!lessonPeriod) {
    throw new Error("Lesson period not found");
  }

  if (lessonPeriod.attendanceTakenAt) {
    throw new Error("Attendance already taken");
  }

  return { lesson, lessonPeriod };
}

async function validateUpdateAttendanceRequest(
  lessonId: number,
  lessonPeriodId: number
): Promise<{ lesson: LessonWithCards; lessonPeriod: { id: number; attendanceTakenAt: Date | null } }> {
  const [lesson, lessonPeriod] = await Promise.all([
    prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        danceStyle: true,
        cards: {
          include: {
            card: true,
          },
        },
      },
    }),
    prisma.lessonPeriod.findUnique({
      where: { id: lessonPeriodId, lessonId },
    }),
  ]);

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  if (!lessonPeriod) {
    throw new Error("Lesson period not found");
  }

  return { lesson, lessonPeriod };
}



type CandidateCard = StudentWithCards["studentCards"][number];

/**
 * Which of the student's cards can pay for this lesson, best first, and the one
 * the engine would pick on its own (`autoPick`). Practice priority: when the
 * lesson accepts a practice card the student qualifies for, only practice cards
 * count and the recommended one is auto-picked even if there are several.
 * Otherwise a card is auto-picked only when it's the single usable one — with
 * several, staff (or, at self check-in, the student) has to choose.
 */
export function cardOptionsFor(
  student: StudentWithCards,
  lesson: LessonWithCards
): { usable: CandidateCard[]; autoPick: CandidateCard | null } {
  const levels = toDanceLevels(student.danceQualifications);

  // 手上有這堂課收的體驗卡 = 老師幫他登記了體驗（課程頁的體驗名單），
  // 那張就是這次要用的——舊生同時有一般卡時也不該變成「多張卡待選」。
  // 候選卡本來就只含這堂課收的卡（fetchStudentsWithValidCards）。
  const trialCards = sortRecommended(
    student.studentCards.filter(
      (studentCard) => studentCard.card.isTrial && canUseCard(studentCard.card, levels, lesson)
    )
  );
  if (trialCards.length > 0) {
    const others = sortRecommended(
      student.studentCards.filter(
        (studentCard) => !studentCard.card.isTrial && canUseCard(studentCard.card, levels, lesson)
      )
    );
    return { usable: [...trialCards, ...others], autoPick: trialCards[0] };
  }

  if (shouldUsePracticePriority(lesson, student)) {
    const practiceCards = sortRecommended(
      student.studentCards.filter(
        (studentCard) =>
          studentCard.card.isPracticeCard && canUseCard(studentCard.card, levels, lesson)
      )
    );
    return { usable: practiceCards, autoPick: practiceCards[0] ?? null };
  }

  const usable = sortRecommended(
    student.studentCards.filter((studentCard) => canUseCard(studentCard.card, levels, lesson))
  );
  return { usable, autoPick: usable.length === 1 ? usable[0] : null };
}

function selectStudentCard(student: StudentWithCards, lesson: LessonWithCards): CandidateCard | null {
  return cardOptionsFor(student, lesson).autoPick;
}

function shouldUsePracticePriority(
  lesson: LessonWithCards,
  student: StudentWithCards
) {
  const levels = toDanceLevels(student.danceQualifications);

  // Practice priority applies when the lesson accepts a practice card the
  // student is qualified to use at this lesson's level.
  return lesson.cards.some(({ card }) => {
    if (!card.isPracticeCard || !cardMatchesLesson(card, lesson.danceStyleId)) {
      return false;
    }
    const required = requiredDanceStyleFor(card, lesson);
    return required !== null && isQualified(levels, required, requiredLevelFor(lesson));
  });
}

// Fewest sessions left first (use it up), then earliest expiry, then oldest.
function sortRecommended(cards: CandidateCard[]): CandidateCard[] {
  return [...cards].sort((a, b) => {
    if (a.remainingSessions !== b.remainingSessions) {
      return a.remainingSessions - b.remainingSessions;
    }

    if (a.expiredAt && b.expiredAt) {
      return new Date(a.expiredAt).getTime() - new Date(b.expiredAt).getTime();
    }

    if (a.expiredAt) {
      return -1;
    }

    if (b.expiredAt) {
      return 1;
    }

    return a.id - b.id;
  });
}

async function createAttendanceRecord(
  tx: Prisma.TransactionClient,
  lessonId: number,
  lessonPeriodId: number,
  studentId: number,
  studentCardId: number | null,
  sessionsUsed: number,
  source: AttendanceSource = AttendanceSource.TEACHER
) {
  // Ensure lesson-student relationship exists
  await tx.lessonStudent.upsert({
    where: {
      lessonId_studentId: {
        lessonId,
        studentId,
      },
    },
    update: {},
    create: {
      lessonId,
      studentId,
    },
  });

  // Create attendance record
  const attendanceRecord = await tx.attendanceRecord.create({
    data: {
      lessonPeriodId,
      studentId,
      studentCardId,
      sessionsUsed,
      source,
    },
  });

  return attendanceRecord;
}

async function createAttendanceEvent(
  tx: Prisma.TransactionClient,
  lessonName: string,
  studentId: number,
  attendanceRecordId: number
) {
  await tx.event.create({
    data: {
      title: "簽到",
      description: `${lessonName} 簽到成功`,
      studentId,
      resourceType: "attendanceRecord",
      resourceId: attendanceRecordId,
    },
  });
}

async function processStudentCardUsage(
  tx: Prisma.TransactionClient,
  studentCard: StudentCard,
  studentId: number,
  sessions: number
) {
  // Guarded decrement: only deduct while enough sessions remain, so a card can
  // never be driven negative by a concurrent deduction (race between self
  // check-in and teacher finalize, or two requests on the same card).
  const { count } = await tx.studentCard.updateMany({
    where: { id: studentCard.id, remainingSessions: { gte: sessions } },
    data: {
      remainingSessions: { decrement: sessions },
    },
  });

  // The card was already exhausted by a concurrent op — nothing deducted.
  if (count === 0) {
    return;
  }

  const updatedStudentCard = await tx.studentCard.findUnique({
    where: { id: studentCard.id },
    include: { card: true },
  });

  // Create event if card is exhausted
  if (updatedStudentCard && updatedStudentCard.remainingSessions === 0) {
    await tx.event.create({
      data: {
        title: "課卡使用完畢",
        description: `課卡 ${updatedStudentCard.card.name} 使用完畢`,
        studentId,
        resourceType: "studentCard",
        resourceId: updatedStudentCard.id,
      },
    });
  }
}

async function processStudentAttendance(
  tx: Prisma.TransactionClient,
  lesson: LessonWithCards,
  lessonPeriodId: number,
  student: StudentWithCards
) {
  const studentCard = selectStudentCard(student, lesson);

  const attendanceRecord = await createAttendanceRecord(
    tx,
    lesson.id,
    lessonPeriodId,
    student.id,
    studentCard?.id ?? null,
    lesson.sessionsPerAttendance
  );

  await createAttendanceEvent(tx, lesson.name, student.id, attendanceRecord.id);

  if (studentCard) {
    await processStudentCardUsage(tx, studentCard, student.id, lesson.sessionsPerAttendance);
  }
}

async function markAttendanceTaken(
  tx: Prisma.TransactionClient,
  lessonPeriodId: number
) {
  await tx.lessonPeriod.update({
    where: { id: lessonPeriodId },
    data: {
      attendanceTakenAt: new Date(),
    },
  });
}

async function getAttendanceDifferences(
  lessonPeriodId: number,
  newStudentIds: number[]
): Promise<{
  newStudentIds: number[];
  removedStudentIds: number[];
}> {
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { lessonPeriodId },
    include: { studentCard: true },
  });

  const existingStudentIds = existingRecords.map((r) => r.studentId);
  const newIds = newStudentIds.filter((id) => !existingStudentIds.includes(id));
  const removedIds = existingStudentIds.filter((id) => !newStudentIds.includes(id));

  return {
    newStudentIds: newIds,
    removedStudentIds: removedIds,
  };
}

async function removeAttendanceRecord(
  tx: Prisma.TransactionClient,
  attendanceRecord: { id: number; studentCardId: number | null; sessionsUsed: number }
) {
  // Refund what this record deducted (sessionsUsed, not the lesson's current setting)
  if (attendanceRecord.studentCardId) {
    await tx.studentCard.update({
      where: { id: attendanceRecord.studentCardId },
      data: {
        remainingSessions: { increment: attendanceRecord.sessionsUsed },
      },
    });

    // The card is no longer exhausted — drop its stale "課卡使用完畢" event.
    await tx.event.deleteMany({
      where: {
        resourceType: "studentCard",
        title: "課卡使用完畢",
        resourceId: attendanceRecord.studentCardId,
      },
    });
  }

  // Delete the attendance record + its "簽到" audit event
  await tx.event.deleteMany({
    where: {
      resourceType: "attendanceRecord",
      resourceId: attendanceRecord.id,
    },
  });
  await tx.attendanceRecord.delete({
    where: { id: attendanceRecord.id },
  });
}

/**
 * Reconcile a period's attendance to the given student set, then finalize it.
 *
 * `studentIds` is authoritative: students not yet recorded are added (card
 * deducted), students whose existing record is no longer selected are removed
 * (card refunded), and students that already have a record are left untouched.
 *
 * Leaving existing records untouched is what makes this safe to run on a period
 * that students already self-checked-in to (`source = STUDENT`): re-finalizing
 * with that student still selected neither duplicates the record nor
 * double-charges the card.
 */
async function reconcileAndFinalize(
  lesson: LessonWithCards,
  lessonPeriodId: number,
  studentIds: number[]
) {
  // Get valid card IDs for this lesson
  const validCardIds = lesson.cards.map((card) => card.cardId);

  // Calculate which students to add and remove
  const { newStudentIds, removedStudentIds } = await getAttendanceDifferences(
    lessonPeriodId,
    studentIds
  );

  // Fetch new students with their valid cards
  const newStudents =
    newStudentIds.length > 0
      ? await fetchStudentsWithValidCards(
          newStudentIds,
          validCardIds,
          lesson.classroomId,
          lesson.sessionsPerAttendance
        )
      : [];

  // Any id that didn't come back belongs to another classroom (or no longer
  // exists). Reject the whole batch rather than silently skipping it — a
  // partial success here would leave the teacher's roster out of sync.
  if (newStudents.length !== newStudentIds.length) {
    throw new Error("Student not found in this classroom");
  }

  // Process updates in a transaction
  await prisma.$transaction(async (tx) => {
    // Add new attendance records
    for (const student of newStudents) {
      await processStudentAttendance(tx, lesson, lessonPeriodId, student);
    }

    // Remove attendance records and refund cards
    if (removedStudentIds.length > 0) {
      const removedAttendanceRecords = await tx.attendanceRecord.findMany({
        where: {
          lessonPeriodId,
          studentId: { in: removedStudentIds },
        },
      });

      for (const attendanceRecord of removedAttendanceRecords) {
        await removeAttendanceRecord(tx, attendanceRecord);
      }
    }

    // Mark attendance as taken
    await markAttendanceTaken(tx, lessonPeriodId);
  });

  // Refresh lesson status
  await refreshLesson(lesson.id);

  // Refresh Needs Renewal tags for all affected students
  const affectedStudentIds = [...new Set([...newStudentIds, ...removedStudentIds])];
  if (affectedStudentIds.length > 0) {
    await refreshNeedsRenewalTags(affectedStudentIds, lesson.classroomId);
  }
}

export async function takeAttendance({
  lessonId,
  lessonPeriodId,
  studentIds,
}: {
  lessonId: number;
  lessonPeriodId: number;
  studentIds: number[];
}) {
  // Validate request (blocks re-finalizing an already-taken period)
  const { lesson, lessonPeriod } = await validateAttendanceRequest(
    lessonId,
    lessonPeriodId
  );

  await reconcileAndFinalize(lesson, lessonPeriod.id, studentIds);
}

export async function updateAttendance({
  lessonId,
  lessonPeriodId,
  studentIds,
}: {
  lessonId: number;
  lessonPeriodId: number;
  studentIds: number[];
}) {
  // Validate request
  const { lesson, lessonPeriod } = await validateUpdateAttendanceRequest(
    lessonId,
    lessonPeriodId
  );

  await reconcileAndFinalize(lesson, lessonPeriod.id, studentIds);
}

// A P2002 from the @@unique([lessonPeriodId, studentId]) constraint means a
// concurrent check-in already recorded this (student, period).
function isDuplicateAttendance(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

export type SelfCheckInResult = {
  periodId: number;
  /** drop_in = 不扣卡、記一筆單堂費（下課付） */
  status: "checked" | "already_checked" | "no_card" | "drop_in";
  dropInAmount?: number;
  cardName?: string;
  remainingSessions?: number;
  exhausted?: boolean;
};

/** How the student pays for this check-in: a card they hold, one bought now, or the lesson's drop-in price. */
export type SelfCheckInCardChoice =
  | { studentCardId: number }
  | { buyCardId: number }
  | { dropIn: true };

/**
 * A self check-in the engine refuses before writing anything. `status` is the
 * HTTP status the LIFF route answers with.
 */
export class SelfCheckInError extends Error {
  constructor(
    public code:
      | "card_required" // requireCard, and some period would end up without a card
      | "card_not_usable" // studentCardId isn't one of this lesson's usable cards
      | "card_not_offered" // buyCardId isn't attached to this lesson
      | "not_qualified" // buyCardId is a practice card the student can't buy
      | "drop_in_not_offered", // dropIn, but the lesson takes no drop-in payments
    public status: 400 | 403
  ) {
    super(code);
  }
}

export type SelfCheckInOutcome = {
  results: SelfCheckInResult[];
  /** The card bought during this check-in, if any. */
  purchased: { id: number; serialNumber: number; name: string; finalPrice: number; isPaid: boolean } | null;
  /** Drop-in fees recorded during this check-in (unpaid — paid after class). */
  dropInDue: number;
};

// The card each new period would be charged to, simulated on a copy of the
// student's cards: the chosen card while it has enough sessions, then the
// engine's own pick. Null = that period would go unbound.
function planPeriodCards(
  student: StudentWithCards,
  lesson: LessonWithCards,
  periodCount: number,
  chosenId: number | null
): (number | null)[] {
  const sim: StudentWithCards = {
    ...student,
    studentCards: student.studentCards.map((c) => ({ ...c })),
  };
  const need = lesson.sessionsPerAttendance;
  sim.studentCards = sim.studentCards.filter((c) => c.remainingSessions >= need);
  const plan: (number | null)[] = [];
  for (let i = 0; i < periodCount; i++) {
    const chosen = chosenId !== null ? sim.studentCards.find((c) => c.id === chosenId) : undefined;
    const pick = chosen ?? selectStudentCard(sim, lesson);
    plan.push(pick?.id ?? null);
    if (pick) {
      pick.remainingSessions -= need;
      if (pick.remainingSessions < need) {
        sim.studentCards = sim.studentCards.filter((c) => c.id !== pick.id);
      }
    }
  }
  return plan;
}

// Placeholder id for the card being bought, until it exists.
const BUYING = -1;

/**
 * Student self check-in (LIFF). Records attendance for one student across the
 * given periods of a lesson and deducts a card per period. Unlike `takeAttendance`
 * it:
 *   - marks each record `source: STUDENT`,
 *   - does NOT set `attendanceTakenAt` (the teacher still finalizes later),
 *   - is idempotent per (student, period) — an existing record is left untouched
 *     and reported as `already_checked` (no double-charge),
 *   - lets the student pick which card pays (`card.studentCardId`) or buy one of
 *     the lesson's cards on the spot (`card.buyCardId` — unpaid; never a trial
 *     card, those are registered by the teacher on the lesson page),
 *   - with `requireCard`, refuses (SelfCheckInError, nothing written) rather than
 *     leave any period unbound.
 */
export async function selfCheckIn({
  studentId,
  lessonId,
  lessonPeriodIds,
  card: choice,
  requireCard = false,
}: {
  studentId: number;
  lessonId: number;
  lessonPeriodIds: number[];
  card?: SelfCheckInCardChoice;
  requireCard?: boolean;
}): Promise<SelfCheckInOutcome> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { danceStyle: true, cards: { include: { card: true } } },
  });
  if (!lesson) {
    throw new Error("Lesson not found");
  }

  const validCardIds = lesson.cards.map((card) => card.cardId);
  // Scoped to the lesson's classroom, which also enforces the "student and
  // lesson must be in the same classroom" rule (LIFF resolves the student from
  // a LINE token).
  const [student] = await fetchStudentsWithValidCards(
    [studentId],
    validCardIds,
    lesson.classroomId,
    lesson.sessionsPerAttendance
  );
  if (!student) {
    throw new Error("Student not found");
  }

  // Only the requested periods that actually belong to this lesson, in order.
  const periods = await prisma.lessonPeriod.findMany({
    where: { id: { in: lessonPeriodIds }, lessonId },
    orderBy: { startTime: "asc" },
  });

  const existing = await prisma.attendanceRecord.findMany({
    where: { studentId, lessonPeriodId: { in: periods.map((p) => p.id) } },
    select: { lessonPeriodId: true },
  });
  const alreadyCheckedIds = new Set(existing.map((r) => r.lessonPeriodId));
  const newPeriods = periods.filter((p) => !alreadyCheckedIds.has(p.id));

  // ----- Validate the card choice and plan every period before writing -----
  let chosenId: number | null = null;
  let buying: (typeof lesson.cards)[number]["card"] | null = null;
  const dropIn = Boolean(choice && "dropIn" in choice);

  if (dropIn) {
    if (lesson.dropInPrice === null) throw new SelfCheckInError("drop_in_not_offered", 400);
  } else if (choice && "studentCardId" in choice) {
    const { usable } = cardOptionsFor(student, lesson);
    if (!usable.some((c) => c.id === choice.studentCardId)) {
      throw new SelfCheckInError("card_not_usable", 400);
    }
    chosenId = choice.studentCardId;
  } else if (choice && "buyCardId" in choice) {
    // 體驗卡不在自助簽到賣——體驗一律由老師在課程頁登記、上課前收費。
    buying =
      lesson.cards.find(
        (lc) => lc.cardId === choice.buyCardId && !lc.card.expiredAt && !lc.card.isTrial
      )?.card ?? null;
    if (!buying) throw new SelfCheckInError("card_not_offered", 400);
    if (!canBuyCard(buying, toDanceLevels(student.danceQualifications), lesson).allowed) {
      throw new SelfCheckInError("not_qualified", 403);
    }
    chosenId = BUYING;
    student.studentCards.push({
      id: BUYING,
      remainingSessions: buying.sessions,
      expiredAt: null,
      card: buying,
    } as CandidateCard);
  }

  // 單堂付費：每個時段都不扣卡，各記一筆單堂費。
  const plan = dropIn
    ? newPeriods.map(() => null)
    : planPeriodCards(student, lesson, newPeriods.length, chosenId);
  if (requireCard && !dropIn && plan.some((id) => id === null)) {
    throw new SelfCheckInError("card_required", 400);
  }

  // ----- Buy the card (only if some period actually uses it) -----
  let purchased: SelfCheckInOutcome["purchased"] = null;
  if (buying && plan.includes(BUYING)) {
    const card = buying;
    // 自助點名當場買的卡一律照牌價、下課付款。
    const finalPrice = card.price;
    const isPaid = false;
    const created = await prisma.$transaction((tx) =>
      createStudentCardInTx(tx, {
        studentId: student.id,
        card,
        finalPrice,
        sessions: card.sessions,
        purchaseSource: "STUDENT",
        isPaid,
        eventDescription: `自助點名時購買 ${card.name}（待付款）`,
      })
    );
    purchased = {
      id: created.id,
      serialNumber: created.serialNumber,
      name: card.name,
      finalPrice,
      isPaid,
    };
    const placeholder = student.studentCards.find((c) => c.id === BUYING);
    if (placeholder) Object.assign(placeholder, created, { card });
    for (let i = 0; i < plan.length; i++) if (plan[i] === BUYING) plan[i] = created.id;

    await notifyClassroom(lesson.classroomId, {
      type: "UNPAID_CARD",
      title: "待確認收款",
      body: `${student.name} 自助點名時買了「${card.name}」${formatCardSerial(created.serialNumber)}，NT$${formatMoney(finalPrice)}`,
      path: `/students/${student.id}`,
    });
  }
  student.studentCards = student.studentCards.filter((c) => c.id !== BUYING);

  // ----- Write: one transaction per period -----
  const results: SelfCheckInResult[] = periods
    .filter((p) => alreadyCheckedIds.has(p.id))
    .map((p) => ({ periodId: p.id, status: "already_checked" as const }));

  // One transaction per period so they're independent: a duplicate-rejection on
  // one period (unique constraint) doesn't abort the others, and each record +
  // its card deduction commit atomically together.
  for (const [index, period] of newPeriods.entries()) {
    const planned = plan[index];
    const studentCard =
      planned !== null ? student.studentCards.find((c) => c.id === planned) ?? null : null;

    try {
      await prisma.$transaction(async (tx) => {
        const attendanceRecord = await createAttendanceRecord(
          tx,
          lesson.id,
          period.id,
          student.id,
          studentCard?.id ?? null,
          lesson.sessionsPerAttendance,
          AttendanceSource.STUDENT
        );
        await createAttendanceEvent(tx, lesson.name, student.id, attendanceRecord.id);

        if (studentCard) {
          await processStudentCardUsage(tx, studentCard, student.id, lesson.sessionsPerAttendance);
        } else if (dropIn) {
          await createDropInChargeInTx(tx, {
            attendanceRecordId: attendanceRecord.id,
            studentId: student.id,
            lessonName: lesson.name,
            amount: lesson.dropInPrice!,
            payment: { isPaid: false },
            receiverUserId: null,
          });
        }
      });
    } catch (e) {
      // A concurrent check-in beat us to this (student, period): the unique
      // constraint rejected our insert and rolled back our deduction. Report it
      // idempotently rather than double-charging.
      if (isDuplicateAttendance(e)) {
        results.push({ periodId: period.id, status: "already_checked" });
        continue;
      }
      throw e;
    }

    if (!studentCard) {
      results.push(
        dropIn
          ? { periodId: period.id, status: "drop_in", dropInAmount: lesson.dropInPrice! }
          : { periodId: period.id, status: "no_card" }
      );
      continue;
    }

    // Keep the in-memory card in sync for the next period's result.
    studentCard.remainingSessions -= lesson.sessionsPerAttendance;
    results.push({
      periodId: period.id,
      status: "checked",
      cardName: studentCard.card.name,
      remainingSessions: studentCard.remainingSessions,
      exhausted: studentCard.remainingSessions === 0,
    });
  }

  await refreshNeedsRenewalTags([studentId], lesson.classroomId);

  // 簽到了但沒卡可扣：出席紀錄會掛在「待處理」等老師綁卡，推一則提醒。
  // 多個時段一起簽到也只推一次。
  const unbound = results.find((r) => r.status === "no_card");
  if (unbound) {
    await notifyClassroom(lesson.classroomId, {
      type: "UNBOUND_ATTENDANCE",
      title: "出席沒有課卡",
      body: `${student.name} 自助簽到了「${lesson.name}」，但沒有可用的課卡`,
      path: `/lessons/${lesson.id}/periods/${unbound.periodId}/check-success`,
    });
  }

  const dropInDue = results.reduce((sum, r) => sum + (r.status === "drop_in" ? r.dropInAmount ?? 0 : 0), 0);
  if (dropInDue > 0) {
    await notifyClassroom(lesson.classroomId, {
      type: "UNPAID_CARD",
      title: "待確認收款",
      body: `${student.name} 自助簽到「${lesson.name}」選了單堂，NT$${formatMoney(dropInDue)} 下課付`,
      path: `/lessons/${lesson.id}/periods/${newPeriods[0].id}/check-success`,
    });
  }

  results.sort(
    (a, b) => periods.findIndex((p) => p.id === a.periodId) - periods.findIndex((p) => p.id === b.periodId)
  );
  return { results, purchased, dropInDue };
}
