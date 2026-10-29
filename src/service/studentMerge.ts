import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError, notFound } from "@/lib/apiError";
import { refreshNeedsRenewalTag } from "@/service/studentTag";

type Db = Prisma.TransactionClient | typeof prisma;

/** Which side's LINE binding survives when both students have one. */
export type KeepLineFrom = "source" | "target";

const studentSummarySelect = {
  id: true,
  number: true,
  name: true,
  avatarUrl: true,
  lineUserId: true,
  lineDisplayName: true,
  createdAt: true,
  _count: { select: { studentCards: true, attendanceRecords: true } },
} satisfies Prisma.StudentSelect;

async function loadPair(db: Db, classroomId: number, sourceId: number, targetId: number) {
  if (sourceId === targetId) {
    throw new ApiError(400, "SAME_STUDENT", "Cannot merge a student into itself");
  }
  const [source, target] = await Promise.all(
    [sourceId, targetId].map((id) =>
      db.student.findFirst({
        where: { id, classroomId, archivedAt: null },
        select: studentSummarySelect,
      })
    )
  );
  if (!source || !target) throw notFound("Student");
  return { source, target };
}

// Periods both students were recorded in: only one record may survive the
// merge (@@unique([lessonPeriodId, studentId])). Keep the one that charged a
// card — the target's if both did — and refund the dropped one's session.
async function findAttendanceClashes(db: Db, sourceId: number, targetId: number) {
  const sourceRecords = await db.attendanceRecord.findMany({
    where: { studentId: sourceId },
    select: {
      id: true,
      lessonPeriodId: true,
      studentCardId: true,
      sessionsUsed: true,
      studentCard: { select: { card: { select: { name: true } }, serialNumber: true } },
      lessonPeriod: { select: { startTime: true, lesson: { select: { name: true } } } },
    },
  });
  const targetRecords = await db.attendanceRecord.findMany({
    where: { studentId: targetId, lessonPeriodId: { in: sourceRecords.map((r) => r.lessonPeriodId) } },
    select: {
      id: true,
      lessonPeriodId: true,
      studentCardId: true,
      sessionsUsed: true,
      studentCard: { select: { card: { select: { name: true } }, serialNumber: true } },
    },
  });
  const targetByPeriod = new Map(targetRecords.map((r) => [r.lessonPeriodId, r]));

  return sourceRecords.flatMap((src) => {
    const tgt = targetByPeriod.get(src.lessonPeriodId);
    if (!tgt) return [];
    const keepSource = tgt.studentCardId === null && src.studentCardId !== null;
    const keep = keepSource ? src : tgt;
    const drop = keepSource ? tgt : src;
    return [
      {
        lessonName: src.lessonPeriod.lesson.name,
        startTime: src.lessonPeriod.startTime,
        keepRecordId: keep.id,
        dropRecordId: drop.id,
        keepFrom: (keepSource ? "source" : "target") as KeepLineFrom,
        // Refunded back to this card (the dropped record had charged it).
        refundStudentCardId: drop.studentCardId,
        refundSessions: drop.sessionsUsed,
        refundCardName: drop.studentCard?.card.name ?? null,
        refundCardSerial: drop.studentCard?.serialNumber ?? null,
      },
    ];
  });
}

const summary = (s: Awaited<ReturnType<typeof loadPair>>["source"]) => ({
  id: s.id,
  number: s.number,
  name: s.name,
  avatarUrl: s.avatarUrl,
  // Only whether — never the LINE id itself.
  lineBound: s.lineUserId !== null,
  lineDisplayName: s.lineDisplayName,
  createdAt: s.createdAt,
  cardCount: s._count.studentCards,
  attendanceCount: s._count.attendanceRecords,
});

/** What merging `source` into `target` would do, for the confirm screen. */
export async function previewMerge(classroomId: number, sourceId: number, targetId: number) {
  const { source, target } = await loadPair(prisma, classroomId, sourceId, targetId);
  const clashes = await findAttendanceClashes(prisma, source.id, target.id);
  return {
    source: summary(source),
    target: summary(target),
    clashes: clashes.map((c) => ({
      lessonName: c.lessonName,
      startTime: c.startTime,
      keepFrom: c.keepFrom,
      refundCardName: c.refundCardName,
      refundCardSerial: c.refundCardSerial,
    })),
    lineConflict:
      source.lineUserId !== null &&
      target.lineUserId !== null &&
      source.lineUserId !== target.lineUserId,
  };
}

/**
 * Merge two records of the same person: everything on `source` moves to
 * `target` in one transaction, then `source` is archived with `mergedIntoId`
 * (kept, not deleted, so the merge can be traced).
 */
export async function mergeStudents(
  classroomId: number,
  sourceId: number,
  targetId: number,
  { keepLineFrom }: { keepLineFrom?: KeepLineFrom } = {}
) {
  await prisma.$transaction(async (tx) => {
    // Lock both rows so a concurrent check-in / second merge can't interleave.
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id IN (${sourceId}, ${targetId}) FOR UPDATE`;
    const { source, target } = await loadPair(tx, classroomId, sourceId, targetId);

    const lineConflict =
      source.lineUserId !== null && target.lineUserId !== null && source.lineUserId !== target.lineUserId;
    if (lineConflict && !keepLineFrom) {
      throw new ApiError(400, "LINE_CONFLICT", "Both students are bound to different LINE accounts");
    }

    // ----- Attendance: resolve clashes, then move the rest -----
    const clashes = await findAttendanceClashes(tx, source.id, target.id);
    for (const clash of clashes) {
      await tx.attendanceRecord.delete({ where: { id: clash.dropRecordId } });
      if (clash.refundStudentCardId !== null) {
        await tx.studentCard.update({
          where: { id: clash.refundStudentCardId },
          data: { remainingSessions: { increment: clash.refundSessions } },
        });
      }
    }
    await tx.attendanceRecord.updateMany({
      where: { studentId: source.id },
      data: { studentId: target.id },
    });

    // ----- Plain moves -----
    await tx.studentCard.updateMany({ where: { studentId: source.id }, data: { studentId: target.id } });
    await tx.event.updateMany({ where: { studentId: source.id }, data: { studentId: target.id } });
    await tx.renewalReminder.updateMany({ where: { studentId: source.id }, data: { studentId: target.id } });

    // ----- Unique-keyed joins: move what target lacks, drop the rest -----
    const targetLessons = new Set(
      (await tx.lessonStudent.findMany({ where: { studentId: target.id }, select: { lessonId: true } })).map(
        (l) => l.lessonId
      )
    );
    await tx.lessonStudent.deleteMany({
      where: { studentId: source.id, lessonId: { in: [...targetLessons] } },
    });
    await tx.lessonStudent.updateMany({ where: { studentId: source.id }, data: { studentId: target.id } });

    const targetTags = new Set(
      (await tx.studentTag.findMany({ where: { studentId: target.id }, select: { tagId: true } })).map(
        (t) => t.tagId
      )
    );
    await tx.studentTag.deleteMany({ where: { studentId: source.id, tagId: { in: [...targetTags] } } });
    await tx.studentTag.updateMany({ where: { studentId: source.id }, data: { studentId: target.id } });

    // Qualifications: same style on both → keep the higher level.
    const targetQuals = new Map(
      (await tx.studentDanceQualification.findMany({ where: { studentId: target.id } })).map((q) => [
        q.danceStyleId,
        q,
      ])
    );
    for (const q of await tx.studentDanceQualification.findMany({ where: { studentId: source.id } })) {
      const existing = targetQuals.get(q.danceStyleId);
      if (existing) {
        if (q.level > existing.level) {
          await tx.studentDanceQualification.update({ where: { id: existing.id }, data: { level: q.level } });
        }
        await tx.studentDanceQualification.delete({ where: { id: q.id } });
      } else {
        await tx.studentDanceQualification.update({ where: { id: q.id }, data: { studentId: target.id } });
      }
    }

    // ----- LINE binding -----
    const useSourceLine =
      source.lineUserId !== null && (target.lineUserId === null || keepLineFrom === "source");
    const keptLine = useSourceLine ? source.lineUserId : target.lineUserId;
    await tx.student.update({
      where: { id: source.id },
      data: { archivedAt: new Date(), mergedIntoId: target.id, lineUserId: null, lineDisplayName: null, lineBindKey: null },
    });
    if (useSourceLine) {
      await tx.student.update({
        where: { id: target.id },
        data: { lineUserId: keptLine, lineDisplayName: source.lineDisplayName, lineBindKey: null },
      });
    }
    // The LINE bot menu pointed at the archived record → follow the merge.
    await tx.lineAccount.updateMany({
      where: { selectedStudentId: source.id },
      data: { selectedStudentId: target.id },
    });

    await tx.event.create({
      data: {
        title: "合併學員",
        description: `併入了「${source.name}」#${source.number} 的課卡與出席紀錄`,
        studentId: target.id,
        resourceType: "student",
        resourceId: source.id,
      },
    });
  });

  await refreshNeedsRenewalTag(targetId, classroomId);
}
