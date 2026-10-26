import { nanoid } from "nanoid";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { apiRoute } from "@/lib/apiRoute";
import { ApiError, notFound } from "@/lib/apiError";
import { isLineMockEnabled, newMockLineUserId } from "@/lib/lineMock";
import { bindStudentLine } from "@/service/lineBinding";

// LINE 模擬器（/dev/line）的資料：這間教室的簽到 key，以及可以扮演的 LINE 身分。
// 只在模擬模式開放（src/lib/lineMock.ts）——它會回傳 lineUserId，正式環境絕不能有。

function requireMock() {
  if (!isLineMockEnabled()) throw notFound("Route");
}

export const GET = apiRoute(async ({ classroomId }) => {
  requireMock();

  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    select: { name: true, checkinKey: true },
  });
  let checkinKey = classroom.checkinKey;
  if (!checkinKey) {
    checkinKey = nanoid(10);
    await prisma.classroom.update({ where: { id: classroomId }, data: { checkinKey } });
  }

  const students = await prisma.student.findMany({
    where: { classroomId, archivedAt: null },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      avatarUrl: true,
      lineUserId: true,
      studentCards: {
        select: {
          remainingSessions: true,
          expiredAt: true,
          isPaid: true,
          finalPrice: true,
          card: { select: { isTrial: true } },
        },
      },
    },
  });

  const summarize = (s: (typeof students)[number]) => ({
    id: s.id,
    number: s.number,
    name: s.name,
    avatarUrl: s.avatarUrl,
    // Same rule as src/service/trial.ts isReturningStudent.
    returning: s.studentCards.some((c) => !c.card.isTrial),
    usableCards: s.studentCards.filter((c) => c.remainingSessions > 0 && c.expiredAt === null).length,
    unpaidAmount: s.studentCards.filter((c) => !c.isPaid).reduce((sum, c) => sum + c.finalPrice, 0),
  });

  // One persona per LINE account: a LINE bound to two students here gets the
  // LIFF「選擇身分」picker, exactly like the real thing.
  const accounts = new Map<string, ReturnType<typeof summarize>[]>();
  for (const s of students) {
    if (!s.lineUserId) continue;
    accounts.set(s.lineUserId, [...(accounts.get(s.lineUserId) ?? []), summarize(s)]);
  }

  return {
    classroomName: classroom.name,
    checkinKey,
    lineAccounts: [...accounts].map(([lineUserId, bound]) => ({ lineUserId, students: bound })),
    unbound: students.filter((s) => !s.lineUserId).map(summarize),
  };
});

const bindSchema = z.object({ studentId: z.number().int().positive() });

// Stand-in for the 綁定碼 → webhook flow: give an unbound student a fresh
// simulated LINE account so their existing cards can be tried from LIFF.
export const POST = apiRoute(async ({ request, classroomId }) => {
  requireMock();
  const { studentId } = bindSchema.parse(await request.json());

  const student = await prisma.student.findFirst({
    where: { id: studentId, classroomId, archivedAt: null },
    select: { id: true, name: true, classroomId: true, avatarUrl: true, lineUserId: true },
  });
  if (!student) throw notFound("Student");
  if (student.lineUserId) throw new ApiError(400, "ALREADY_BOUND", "Student already bound to LINE");

  const lineUserId = newMockLineUserId();
  // The simulator's persona for this account goes by the student's name.
  await bindStudentLine(student, lineUserId, "LINE 模擬器：模擬綁定", { displayName: student.name });
  return { lineUserId, name: student.name };
});
