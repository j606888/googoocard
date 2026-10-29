import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bearerToken, resolveOwnedStudent } from "@/lib/liffAuth";
import {
  SelfCheckInCardChoice,
  SelfCheckInError,
  selfCheckIn,
} from "@/domains/attendance/attendance.service";

// Student self check-in from the LIFF「上課簽到」page. Auth is a LIFF ID token;
// ownership enforced via resolveOwnedStudent. Records attendance for the chosen
// period(s) of a lesson (source = STUDENT, does NOT finalize the period — the
// teacher still reviews). Idempotent per period.
//
// Every self check-in is paid for: the student either has a card the engine
// picks, chooses one of theirs (`studentCardId`), buys one of the lesson's cards
// on the spot (`buyCardId`, unpaid — paid after class), or pays the lesson's
// drop-in price (`dropIn: true`, no card, paid after class). Anything that would
// leave a period unpaid for is refused with `card_required`.
export async function POST(request: Request) {
  const { studentId, lessonId, periodIds, studentCardId, buyCardId, dropIn } = await request.json();

  const resolved = await resolveOwnedStudent(bearerToken(request), studentId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { student } = resolved;

  if (!Array.isArray(periodIds) || periodIds.length === 0) {
    return NextResponse.json({ error: "missing_periodIds" }, { status: 400 });
  }

  // The lesson must belong to this student's classroom.
  const lesson = await prisma.lesson.findUnique({ where: { id: Number(lessonId) } });
  if (!lesson || lesson.classroomId !== student.classroomId) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  let card: SelfCheckInCardChoice | undefined;
  if (studentCardId) card = { studentCardId: Number(studentCardId) };
  else if (buyCardId) card = { buyCardId: Number(buyCardId) };
  else if (dropIn === true) card = { dropIn: true };

  let outcome;
  try {
    outcome = await selfCheckIn({
      studentId: student.id,
      lessonId: lesson.id,
      lessonPeriodIds: periodIds.map(Number),
      card,
      requireCard: true,
    });
  } catch (e) {
    if (e instanceof SelfCheckInError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    throw e;
  }

  // Everything this student still owes — the completion screen says「下課請找
  // 小幫手付款」for what was just bought and reminds about older unpaid cards.
  const unpaidCards = await prisma.studentCard.findMany({
    where: { studentId: student.id, isPaid: false },
    select: { id: true, serialNumber: true, finalPrice: true, card: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    results: outcome.results,
    purchased: outcome.purchased,
    amountDue:
      (outcome.purchased && !outcome.purchased.isPaid ? outcome.purchased.finalPrice : 0) + outcome.dropInDue,
    unpaidCards: unpaidCards.map((sc) => ({
      id: sc.id,
      serialNumber: sc.serialNumber,
      name: sc.card.name,
      finalPrice: sc.finalPrice,
    })),
  });
}
