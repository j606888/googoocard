import type { PaymentMethod, Prisma } from "@prisma/client";
import type { z } from "zod";
import prisma from "@/lib/prisma";
import { ApiError, badRequest, notFound } from "@/lib/apiError";
import { findMembership } from "@/lib/authz";
import { formatMoney } from "@/lib/money";
import type { registerEnrollmentSchema, updateEnrollmentSchema } from "@/lib/schemas";
import {
  enrollmentCoversIndex,
  termAttendanceStatus,
  termPerSession,
  termShareForPeriod,
} from "@/lib/termEnrollment";
import { createStudent, DEFAULT_STUDENT_AVATAR } from "@/service/student";
import { refreshNeedsRenewalTag } from "@/service/studentTag";

/**
 * 報名整期（`LessonEnrollment`）。規則見 src/lib/termEnrollment.ts：
 *   - 老師在這一期頁登記、記收款；學生端不賣。
 *   - 涵蓋這門課前 `sessions` 個時段：那幾堂來上課不扣卡（`AttendanceRecord.enrollmentId`），
 *     每點完一堂名認列 price / sessions，**不管有沒有來**。
 *   - 沒來的人老師標「請假」（`PeriodLeave`），其他就是曠課；不補課、不退費。
 */

type Db = Prisma.TransactionClient | typeof prisma;

const PAYMENT_LABEL = { CASH: "現金", TRANSFER: "轉帳" } as const;

/** 這門課的時段，照時間排（第幾堂 = index + 1）。 */
async function orderedPeriods(db: Db, lessonId: number) {
  return db.lessonPeriod.findMany({
    where: { lessonId },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
    select: { id: true, startTime: true, endTime: true, attendanceTakenAt: true },
  });
}

/**
 * 這個時段被哪些整期報名涵蓋：studentId → enrollment。點名引擎、自助簽到、預覽共用。
 */
export async function enrollmentsCoveringPeriod(db: Db, lessonId: number, periodId: number) {
  const [periods, enrollments] = await Promise.all([
    orderedPeriods(db, lessonId),
    db.lessonEnrollment.findMany({
      where: { lessonId },
      select: { id: true, studentId: true, sessions: true, price: true },
    }),
  ]);
  const index = periods.findIndex((p) => p.id === periodId);
  return new Map(
    enrollments.filter((e) => enrollmentCoversIndex(index, e)).map((e) => [e.studentId, { ...e, periodIndex: index }])
  );
}

/**
 * 整期攤進這些時段的收入（只算點過名的——呼叫端本來就只傳點過名的時段）。
 * 回傳 periodId → { amount, count }。跟 `periodRevenue()` 加起來就是這堂收入。
 */
export async function termRevenueByPeriod(periodIds: number[]) {
  const result = new Map<number, { amount: number; count: number }>();
  if (periodIds.length === 0) return result;

  const lessonIds = (
    await prisma.lessonPeriod.findMany({
      where: { id: { in: periodIds }, lesson: { termSessions: { not: null } } },
      select: { lessonId: true },
      distinct: ["lessonId"],
    })
  ).map((p) => p.lessonId);
  if (lessonIds.length === 0) return result;

  const lessons = await prisma.lesson.findMany({
    where: { id: { in: lessonIds } },
    select: {
      periods: {
        orderBy: [{ startTime: "asc" }, { id: "asc" }],
        select: { id: true, attendanceRecords: { where: PAID_OTHERWISE, select: { studentId: true } } },
      },
      enrollments: { select: { price: true, sessions: true, studentId: true } },
    },
  });
  const wanted = new Set(periodIds);
  for (const lesson of lessons) {
    if (lesson.enrollments.length === 0) continue;
    lesson.periods.forEach((period, index) => {
      if (!wanted.has(period.id)) return;
      const paidOtherwise = new Set(period.attendanceRecords.map((r) => r.studentId));
      result.set(period.id, termShareForPeriod(index, lesson.enrollments, paidOtherwise));
    });
  }
  return result;
}

/** 這筆出席已經用課卡或單堂付了——整期讓出這堂的份（見 termShareForPeriod）。 */
const PAID_OTHERWISE = {
  OR: [{ studentCardId: { not: null } }, { dropInCharge: { isNot: null } }],
} satisfies Prisma.AttendanceRecordWhereInput;

async function loadTermLesson(lessonId: number, classroomId: number) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, classroomId },
    select: { id: true, name: true, termPrice: true, termSessions: true },
  });
  if (!lesson) throw notFound("Lesson");
  return lesson;
}

/** 這一期頁「整期」名單：每人每堂的出缺勤、收款狀態。 */
export async function getEnrollmentRoster(lessonId: number, classroomId: number) {
  const lesson = await loadTermLesson(lessonId, classroomId);
  const [periods, enrollments] = await Promise.all([
    orderedPeriods(prisma, lessonId),
    prisma.lessonEnrollment.findMany({
      where: { lessonId },
      orderBy: { createdAt: "asc" },
      include: {
        student: { select: { id: true, name: true, avatarUrl: true } },
        attendanceRecords: { select: { lessonPeriodId: true } },
        leaves: { select: { lessonPeriodId: true } },
      },
    }),
  ]);

  // 出席看「這個學生在這個時段有沒有紀錄」，不只看掛整期的——報名前就來過的那堂也算有來。
  const attended = await prisma.attendanceRecord.findMany({
    where: { lessonPeriod: { lessonId }, studentId: { in: enrollments.map((e) => e.studentId) } },
    select: { studentId: true, lessonPeriodId: true },
  });
  const attendedKey = new Set(attended.map((r) => `${r.studentId}:${r.lessonPeriodId}`));

  return {
    termPrice: lesson.termPrice,
    termSessions: lesson.termSessions,
    periods: periods.map((p, index) => ({
      id: p.id,
      index,
      startTime: p.startTime,
      attendanceTaken: p.attendanceTakenAt !== null,
    })),
    enrollments: enrollments.map((e) => {
      const leaveIds = new Set(e.leaves.map((l) => l.lessonPeriodId));
      const statuses = periods.map((p, index) =>
        termAttendanceStatus({
          periodIndex: index,
          sessions: e.sessions,
          attendanceTaken: p.attendanceTakenAt !== null,
          attended: attendedKey.has(`${e.studentId}:${p.id}`),
          onLeave: leaveIds.has(p.id),
        })
      );
      return {
        id: e.id,
        student: e.student,
        price: e.price,
        sessions: e.sessions,
        perSession: termPerSession(e.price, e.sessions),
        note: e.note,
        isPaid: e.isPaid,
        paymentMethod: e.paymentMethod,
        paymentReference: e.paymentReference,
        createdAt: e.createdAt,
        statuses,
        counts: {
          present: statuses.filter((s) => s === "present").length,
          leave: statuses.filter((s) => s === "leave").length,
          absent: statuses.filter((s) => s === "absent").length,
        },
      };
    }),
  };
}

export async function registerEnrollment({
  lessonId,
  classroomId,
  userId,
  input,
}: {
  lessonId: number;
  classroomId: number;
  userId: number;
  input: z.infer<typeof registerEnrollmentSchema>;
}) {
  const lesson = await loadTermLesson(lessonId, classroomId);
  if (lesson.termPrice === null || lesson.termSessions === null) {
    throw badRequest("TERM_NOT_OFFERED", "This lesson does not offer term enrollment");
  }
  // 報了就是整期：堂數一律 = 課程的（只能個別改價）。
  const sessions = lesson.termSessions;
  const price = input.price ?? lesson.termPrice;

  let studentId: number;
  if (input.studentId !== undefined) {
    const existing = await prisma.student.findFirst({
      where: { id: input.studentId, classroomId, archivedAt: null },
      select: { id: true },
    });
    if (!existing) throw notFound("Student");
    studentId = existing.id;
  } else {
    // 同名不擋——跟體驗名單一樣交給待處理的「可能重複」與合併學員。
    const created = await createStudent(classroomId, {
      name: input.newStudentName!,
      avatarUrl: DEFAULT_STUDENT_AVATAR,
    });
    studentId = created.id;
  }

  const isPaid = price === 0 || input.isPaid;
  const paymentMethod = isPaid && price > 0 ? input.paymentMethod ?? null : null;
  const paymentReference = paymentMethod === "TRANSFER" ? input.paymentReference || null : null;

  try {
    const enrollment = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.lessonEnrollment.create({
        data: {
          lessonId,
          studentId,
          price,
          sessions,
          note: input.note || null,
          enrolledByUserId: userId,
          isPaid,
          paidAt: isPaid ? new Date() : null,
          paidByUserId: isPaid && price > 0 ? userId : null,
          paymentMethod,
          paymentReference,
        },
      });
      // 名單上看得到他（跟點過名的人一樣）。
      await tx.lessonStudent.upsert({
        where: { lessonId_studentId: { lessonId, studentId } },
        update: {},
        create: { lessonId, studentId },
      });
      await adoptEarlierAttendanceInTx(tx, { lessonId, studentId, enrollmentId: enrollment.id, sessions });
      await tx.event.create({
        data: {
          title: "報名整期",
          description: [
            `${lesson.name} 整期 ${sessions} 堂 $${formatMoney(price)}`,
            price === 0 ? "免費" : isPaid ? "已收款" : "待付款",
            paymentMethod && PAYMENT_LABEL[paymentMethod],
          ]
            .filter(Boolean)
            .join(" · "),
          studentId,
          resourceType: "lessonEnrollment",
          resourceId: enrollment.id,
        },
      });
      return enrollment;
    });
    // 報名前用課卡上過的堂退了卡：「需續約」可能要拿掉。
    await refreshNeedsRenewalTag(studentId, classroomId);
    return enrollment;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw badRequest("ALREADY_ENROLLED", "Student already enrolled in this lesson");
    }
    throw e;
  }
}

/**
 * 晚登記（第一堂之後才報）：這門課涵蓋範圍內、他**報名前**就有的出席改掛這筆報名。
 *   - 扣了卡 → 退卡（退 sessionsUsed 格），改算整期——整期本來就包含那一堂。
 *   - 沒收款的單堂 → 刪掉那筆單堂費，改算整期。
 *   - 已收款的單堂 → 不動（錢已經收了；那堂收入算單堂，整期讓出那一份，見 termShareForPeriod）。
 *   - 什麼都沒付的（出席沒綁課卡）→ 改算整期。
 */
async function adoptEarlierAttendanceInTx(
  tx: Prisma.TransactionClient,
  { lessonId, studentId, enrollmentId, sessions }: { lessonId: number; studentId: number; enrollmentId: number; sessions: number }
) {
  const covered = new Set((await orderedPeriods(tx, lessonId)).slice(0, sessions).map((p) => p.id));
  const records = await tx.attendanceRecord.findMany({
    where: { studentId, lessonPeriod: { lessonId }, enrollmentId: null },
    select: {
      id: true,
      lessonPeriodId: true,
      studentCardId: true,
      sessionsUsed: true,
      dropInCharge: { select: { id: true, isPaid: true } },
    },
  });
  for (const record of records) {
    if (!covered.has(record.lessonPeriodId)) continue;
    if (record.dropInCharge?.isPaid) continue;
    if (record.dropInCharge) {
      await tx.dropInCharge.delete({ where: { id: record.dropInCharge.id } });
    }
    if (record.studentCardId !== null) {
      await tx.studentCard.update({
        where: { id: record.studentCardId },
        data: { remainingSessions: { increment: record.sessionsUsed } },
      });
      // 卡又有剩了——拿掉過時的「課卡使用完畢」（同取消出席退卡）。
      await tx.event.deleteMany({
        where: { resourceType: "studentCard", title: "課卡使用完畢", resourceId: record.studentCardId },
      });
    }
    await tx.attendanceRecord.update({
      where: { id: record.id },
      data: { studentCardId: null, enrollmentId },
    });
  }
}

async function findEnrollment(id: number, classroomId: number) {
  const enrollment = await prisma.lessonEnrollment.findFirst({
    where: { id, lesson: { classroomId } },
    include: {
      lesson: { select: { name: true, termSessions: true } },
      _count: { select: { attendanceRecords: true } },
    },
  });
  if (!enrollment) throw notFound("Enrollment");
  return enrollment;
}

export async function updateEnrollment(
  id: number,
  classroomId: number,
  input: z.infer<typeof updateEnrollmentSchema>
) {
  const enrollment = await findEnrollment(id, classroomId);
  const priceChanged = input.price !== undefined && input.price !== enrollment.price;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.lessonEnrollment.update({
      where: { id },
      data: {
        price: input.price,
        note: input.note === undefined ? undefined : input.note || null,
      },
    });
    // 改價會回頭改已點名那幾堂的收入，所以留一筆紀錄；已收款的實收金額不跟著變。
    if (priceChanged) {
      await tx.event.create({
        data: {
          title: "整期改價",
          description: [
            `${enrollment.lesson.name} 整期 $${formatMoney(enrollment.price)} → $${formatMoney(input.price!)}`,
            enrollment.isPaid && "已收款，實收不變",
          ]
            .filter(Boolean)
            .join(" · "),
          studentId: enrollment.studentId,
          resourceType: "lessonEnrollment",
          resourceId: id,
        },
      });
    }
    return updated;
  });
}

/**
 * 取消報名——只給「登記錯了」用：已經有出席掛在這筆報名上就不能刪（不退費，
 * 中途不來就讓他一直是曠課）。
 */
export async function deleteEnrollment(id: number, classroomId: number) {
  const enrollment = await findEnrollment(id, classroomId);
  if (enrollment._count.attendanceRecords > 0) {
    throw new ApiError(409, "ENROLLMENT_IN_USE", "Enrollment already has attendance");
  }
  await prisma.$transaction([
    prisma.lessonEnrollment.delete({ where: { id } }),
    prisma.event.create({
      data: {
        title: "取消整期報名",
        description: `${enrollment.lesson.name} 取消整期報名`,
        studentId: enrollment.studentId,
        resourceType: "lessonEnrollment",
        resourceId: id,
      },
    }),
  ]);
  // 不再是整期學生：手上沒卡的話要回到「需續約」。
  await refreshNeedsRenewalTag(enrollment.studentId, classroomId);
}

export async function confirmEnrollmentPayment({
  classroomId,
  userId,
  enrollmentId,
  paymentMethod,
  paymentReference,
  receiverUserId,
}: {
  classroomId: number;
  userId: number;
  enrollmentId: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string | null;
  receiverUserId?: number;
}) {
  const enrollment = await findEnrollment(enrollmentId, classroomId);
  if (enrollment.isPaid) throw badRequest("ALREADY_PAID");
  const receiver = receiverUserId ?? userId;
  if (receiver !== userId && !(await findMembership(receiver, classroomId))) {
    throw badRequest("RECEIVER_NOT_MEMBER", "Receiver is not a member of this classroom");
  }
  const method = paymentMethod ?? null;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.lessonEnrollment.update({
      where: { id: enrollmentId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paidByUserId: receiver,
        paymentMethod: method,
        paymentReference: method === "TRANSFER" ? paymentReference || null : null,
      },
    });
    await tx.event.create({
      data: {
        title: "確認付款",
        description: [
          `確認付款 ${enrollment.lesson.name} 整期（$${formatMoney(enrollment.price)}）`,
          method && PAYMENT_LABEL[method],
        ]
          .filter(Boolean)
          .join(" · "),
        studentId: enrollment.studentId,
        resourceType: "lessonEnrollment",
        resourceId: enrollmentId,
      },
    });
    return updated;
  });
}

/**
 * 點名送出時寫這堂的請假（交易內）。只接受涵蓋這堂、而且這次沒來的整期學生；
 * 有來的人一律清掉請假。`leaveStudentIds` 省略 = 只清有來的人，其他不動。
 */
export async function syncPeriodLeavesInTx(
  tx: Prisma.TransactionClient,
  {
    lessonId,
    periodId,
    presentStudentIds,
    leaveStudentIds,
  }: { lessonId: number; periodId: number; presentStudentIds: number[]; leaveStudentIds?: number[] }
) {
  const covering = await enrollmentsCoveringPeriod(tx, lessonId, periodId);
  const present = new Set(presentStudentIds);
  const presentEnrollmentIds = [...covering.values()].filter((e) => present.has(e.studentId)).map((e) => e.id);

  if (leaveStudentIds === undefined) {
    await tx.periodLeave.deleteMany({
      where: { lessonPeriodId: periodId, enrollmentId: { in: presentEnrollmentIds } },
    });
    return;
  }

  const leaveEnrollmentIds = [...new Set(leaveStudentIds)]
    .filter((id) => !present.has(id))
    .map((id) => covering.get(id)?.id)
    .filter((id): id is number => id !== undefined);

  await tx.periodLeave.deleteMany({
    where: { lessonPeriodId: periodId, enrollmentId: { notIn: leaveEnrollmentIds } },
  });
  if (leaveEnrollmentIds.length > 0) {
    await tx.periodLeave.createMany({
      data: leaveEnrollmentIds.map((enrollmentId) => ({ enrollmentId, lessonPeriodId: periodId })),
      skipDuplicates: true,
    });
  }
}

/**
 * 點名頁：這堂的整期學生（預設勾選）、誰已經請假，以及**上一堂**誰請假
 * （提醒老師請他們提早來補進度——沒有補課機制）。
 */
export async function getPeriodTermInfo(lessonId: number, periodId: number, classroomId: number) {
  const lesson = await loadTermLesson(lessonId, classroomId);
  const periods = await orderedPeriods(prisma, lessonId);
  const index = periods.findIndex((p) => p.id === periodId);
  if (index < 0) throw notFound("Lesson period");
  if (lesson.termSessions === null) {
    return { offered: false, periodIndex: index, termSessions: null, enrolled: [], previousLeaves: null };
  }

  const covering = await enrollmentsCoveringPeriod(prisma, lessonId, periodId);
  const enrollmentIds = [...covering.values()].map((e) => e.id);
  const [students, leaves, paidRecords, payment] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: [...covering.keys()] } },
      select: { id: true, name: true, avatarUrl: true },
    }),
    prisma.periodLeave.findMany({
      where: { lessonPeriodId: periodId, enrollmentId: { in: enrollmentIds } },
      select: { enrollment: { select: { studentId: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { lessonPeriodId: periodId, studentId: { in: [...covering.keys()] }, ...PAID_OTHERWISE },
      select: { studentId: true },
    }),
    prisma.lessonEnrollment.findMany({
      where: { id: { in: enrollmentIds } },
      select: { id: true, isPaid: true, price: true },
    }),
  ]);
  const onLeave = new Set(leaves.map((l) => l.enrollment.studentId));
  const paidOtherwise = new Set(paidRecords.map((r) => r.studentId));
  const paymentById = new Map(payment.map((p) => [p.id, p]));
  const byId = new Map(students.map((s) => [s.id, s]));

  // 上一堂：這一堂之前最近一個點過名的時段。
  const previous = periods
    .slice(0, index)
    .reverse()
    .find((p) => p.attendanceTakenAt !== null);
  let previousLeaves: { periodId: number; startTime: Date; students: { id: number; name: string }[] } | null = null;
  if (previous) {
    const prevLeaves = await prisma.periodLeave.findMany({
      where: { lessonPeriodId: previous.id },
      select: { enrollment: { select: { student: { select: { id: true, name: true } } } } },
      orderBy: { id: "asc" },
    });
    if (prevLeaves.length > 0) {
      previousLeaves = {
        periodId: previous.id,
        startTime: previous.startTime,
        students: prevLeaves.map((l) => l.enrollment.student),
      };
    }
  }

  return {
    offered: true,
    periodIndex: index,
    termSessions: lesson.termSessions,
    enrolled: [...covering.values()]
      .map((e) => {
        const student = byId.get(e.studentId);
        return student
          ? {
              enrollmentId: e.id,
              student,
              perSession: termPerSession(e.price, e.sessions),
              onLeave: onLeave.has(e.studentId),
              // 這堂已經用課卡／單堂付了：這堂收入算那邊，整期不算這一份。
              paidOtherwise: paidOtherwise.has(e.studentId),
              isPaid: paymentById.get(e.id)?.isPaid ?? false,
              price: e.price,
            }
          : null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.student.name.localeCompare(b.student.name, "zh-Hant")),
    previousLeaves,
  };
}

/**
 * 學生自己的整期進度（LIFF 簽到）：沒報 → null。`periodIndexById` 給「這堂是第幾堂」，
 * 不在他報的堂數內的時段不在裡面（那幾堂要付卡／單堂）。
 */
export async function studentTermProgress(lessonId: number, studentId: number) {
  const enrollment = await prisma.lessonEnrollment.findUnique({
    where: { lessonId_studentId: { lessonId, studentId } },
    select: { id: true, sessions: true, leaves: { select: { lessonPeriodId: true } } },
  });
  if (!enrollment) return null;
  const [periods, attended] = await Promise.all([
    orderedPeriods(prisma, lessonId),
    prisma.attendanceRecord.findMany({
      where: { studentId, lessonPeriod: { lessonId } },
      select: { lessonPeriodId: true },
    }),
  ]);
  const attendedIds = new Set(attended.map((r) => r.lessonPeriodId));
  const leaveIds = new Set(enrollment.leaves.map((l) => l.lessonPeriodId));
  const covered = periods.slice(0, enrollment.sessions);
  return {
    sessions: enrollment.sessions,
    periodIndexById: new Map(covered.map((p, index) => [p.id, index])),
    statuses: covered.map((p, index) =>
      termAttendanceStatus({
        periodIndex: index,
        sessions: enrollment.sessions,
        attendanceTaken: p.attendanceTakenAt !== null,
        attended: attendedIds.has(p.id),
        onLeave: leaveIds.has(p.id),
      })
    ),
  };
}
