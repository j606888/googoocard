import { describe, it, expect, beforeEach, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  resetDb,
  createClassroom,
  createMember,
  createStudent,
  createCard,
  createStudentCard,
  createLesson,
  jsonRequest,
  routeParams,
  createDanceStyles,
  type DanceStyleIds,
} from "../factories";

const auth = vi.hoisted(() => ({ userId: 1, classroomId: 0 }));
vi.mock("@/lib/auth", () => ({
  decodeAuthToken: async () => auth,
}));

import { POST } from "@/app/api/students/[id]/student-cards/route";
import { POST as CONFIRM_PAYMENT } from "@/app/api/students/[id]/student-cards/[studentCardId]/confirm-payment/route";

// Dance style ids for the classroom under test, keyed by the old enum name.
let S: DanceStyleIds;

describe("POST /api/students/[id]/student-cards (購買驗證)", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    S = await createDanceStyles(classroomId);
    auth.classroomId = classroomId;
  });

  it("一般卡任何學生都能購買", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "一般卡" });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    const studentCards = await prisma.studentCard.findMany({
      where: { studentId: student.id },
    });
    expect(studentCards).toHaveLength(1);
    expect(studentCards[0].remainingSessions).toBe(6);
  });

  it("不符資格的學生買複習卡 → 403 STUDENT_NOT_QUALIFIED", async () => {
    const student = await createStudent(classroomId); // 無任何資格
    const card = await createCard(classroomId, {
      name: "Bachata 複習卡",
      isPracticeCard: true,
      danceStyleId: S.BACHATA,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("STUDENT_NOT_QUALIFIED");
    expect(
      await prisma.studentCard.count({ where: { studentId: student.id } })
    ).toBe(0);
  });

  it("資格不符的舞種也擋（有 Salsa 資格買 Bachata 複習卡）", async () => {
    const student = await createStudent(classroomId, {
      qualifications: [S.SALSA],
    });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceStyleId: S.BACHATA,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(403);
  });

  it("符合資格的學生可以買複習卡", async () => {
    const student = await createStudent(classroomId, {
      qualifications: [S.BACHATA],
    });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceStyleId: S.BACHATA,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(200);
    expect(
      await prisma.studentCard.count({ where: { studentId: student.id } })
    ).toBe(1);
  });

  it("legacy 複習卡（無舞種）且無課程上下文 → 422 CARD_MISSING_DANCE_TYPE", async () => {
    const student = await createStudent(classroomId, {
      qualifications: [S.BACHATA],
    });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceStyleId: null,
    });

    const res = await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 1500 }),
      routeParams({ id: String(student.id) })
    );

    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("CARD_MISSING_DANCE_TYPE");
  });

  it("legacy 複習卡帶 lessonId（課程內買卡）→ 用課程舞種驗證", async () => {
    const studentQualified = await createStudent(classroomId, {
      name: "qualified",
      qualifications: [S.BACHATA],
    });
    const studentNot = await createStudent(classroomId, { name: "not" });
    const card = await createCard(classroomId, {
      isPracticeCard: true,
      danceStyleId: null,
    });
    const { lesson } = await createLesson(classroomId, {
      danceStyleId: S.BACHATA,
      cardIds: [card.id],
    });

    const okRes = await POST(
      jsonRequest("POST", {
        cardId: card.id,
        sessions: 6,
        price: 1500,
        lessonId: lesson.id,
      }),
      routeParams({ id: String(studentQualified.id) })
    );
    expect(okRes.status).toBe(200);

    const blockedRes = await POST(
      jsonRequest("POST", {
        cardId: card.id,
        sessions: 6,
        price: 1500,
        lessonId: lesson.id,
      }),
      routeParams({ id: String(studentNot.id) })
    );
    expect(blockedRes.status).toBe(403);
  });

  it("卡片不存在 → 404", async () => {
    const student = await createStudent(classroomId);
    const res = await POST(
      jsonRequest("POST", { cardId: 9999, sessions: 6, price: 3000 }),
      routeParams({ id: String(student.id) })
    );
    expect(res.status).toBe(404);
  });

  it("預設購買 → 已付款，記錄購買者與確認者", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "一般卡" });

    await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000 }),
      routeParams({ id: String(student.id) })
    );

    const sc = await prisma.studentCard.findFirstOrThrow({
      where: { studentId: student.id },
    });
    expect(sc.isPaid).toBe(true);
    expect(sc.purchaseSource).toBe("STAFF");
    expect(sc.purchasedByUserId).toBe(auth.userId);
    expect(sc.paidByUserId).toBe(auth.userId);
    expect(sc.paidAt).not.toBeNull();
  });

  it("購買時標記 isPaid:false → 未付款且付款欄位留空，但卡片可用", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "一般卡" });

    await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000, isPaid: false }),
      routeParams({ id: String(student.id) })
    );

    const sc = await prisma.studentCard.findFirstOrThrow({
      where: { studentId: student.id },
    });
    expect(sc.isPaid).toBe(false);
    expect(sc.paidAt).toBeNull();
    expect(sc.paidByUserId).toBeNull();
    expect(sc.remainingSessions).toBe(6); // 仍可使用
  });
});

describe("POST .../confirm-payment", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    S = await createDanceStyles(classroomId);
    auth.classroomId = classroomId;
    auth.userId = 1;
  });

  it("確認付款 → isPaid 變 true，記錄確認者（可不同於購買者）並寫 Event", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "一般卡" });

    // 助教（user 1）開未付款卡
    await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000, isPaid: false }),
      routeParams({ id: String(student.id) })
    );
    const sc = await prisma.studentCard.findFirstOrThrow({
      where: { studentId: student.id },
    });

    // 老闆（user 2）確認收款
    const owner = await createMember(classroomId, {
      email: "boss@test.local",
      name: "Boss",
      role: "owner",
    });
    auth.userId = owner.id;

    const res = await CONFIRM_PAYMENT(
      jsonRequest("POST"),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(200);

    const updated = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(updated.isPaid).toBe(true);
    expect(updated.paidByUserId).toBe(owner.id);
    expect(updated.purchasedByUserId).toBe(1); // 開卡者不變
    expect(updated.paidAt).not.toBeNull();

    const event = await prisma.event.findFirst({
      where: { studentId: student.id, title: "確認付款", resourceId: sc.id },
    });
    expect(event).not.toBeNull();
  });

  it("跨教室：確認他人教室課卡的付款 → 404（不洩漏存在性、不改動）", async () => {
    const otherUser = await prisma.user.create({
      data: { email: "other@test.local", name: "Other", password: "x" },
    });
    const otherClassroom = await prisma.classroom.create({
      data: { ownerId: otherUser.id, name: "Other Classroom" },
    });
    const otherStudent = await createStudent(otherClassroom.id, { name: "別人" });
    const otherCard = await createCard(otherClassroom.id);
    const otherSc = await createStudentCard(otherStudent.id, otherCard.id, { isPaid: false });

    // auth.classroomId 仍是自己的教室
    const res = await CONFIRM_PAYMENT(
      jsonRequest("POST"),
      routeParams({
        id: String(otherStudent.id),
        studentCardId: String(otherSc.id),
      })
    );
    expect(res.status).toBe(404);

    const untouched = await prisma.studentCard.findUniqueOrThrow({
      where: { id: otherSc.id },
    });
    expect(untouched.isPaid).toBe(false);
  });

  it("重複確認已付款的卡 → 400 ALREADY_PAID", async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "一般卡" });

    await POST(
      jsonRequest("POST", { cardId: card.id, sessions: 6, price: 3000 }), // 預設已付款
      routeParams({ id: String(student.id) })
    );
    const sc = await prisma.studentCard.findFirstOrThrow({
      where: { studentId: student.id },
    });

    const res = await CONFIRM_PAYMENT(
      jsonRequest("POST"),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ALREADY_PAID");
  });
});

describe("POST .../confirm-payment（付款方式與收款人）", () => {
  let classroomId: number;

  beforeEach(async () => {
    await resetDb();
    const classroom = await createClassroom();
    classroomId = classroom.id;
    auth.classroomId = classroomId;
    auth.userId = 1;
  });

  const unpaidCard = async () => {
    const student = await createStudent(classroomId);
    const card = await createCard(classroomId, { name: "10 堂卡" });
    const sc = await createStudentCard(student.id, card.id, { isPaid: false, finalPrice: 2000 });
    return { student, sc };
  };

  it("記錄付款方式、末五碼，收款人可改選其他成員", async () => {
    const { student, sc } = await unpaidCard();
    const teacher = await createMember(classroomId, { email: "t@test.local", name: "林老師" });

    const res = await CONFIRM_PAYMENT(
      jsonRequest("POST", {
        paymentMethod: "TRANSFER",
        paymentReference: " 38215 ",
        receiverUserId: teacher.id,
      }),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(200);

    const updated = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(updated.paymentMethod).toBe("TRANSFER");
    expect(updated.paymentReference).toBe("38215");
    expect(updated.paidByUserId).toBe(teacher.id);

    const event = await prisma.event.findFirstOrThrow({
      where: { studentId: student.id, title: "確認付款" },
    });
    expect(event.description).toContain("轉帳");
    expect(event.description).toContain("38215");
  });

  it("不帶 body（舊版 App）→ 照樣確認，收款人是自己、方式留空", async () => {
    const { student, sc } = await unpaidCard();
    const res = await CONFIRM_PAYMENT(
      new Request("http://localhost/test", { method: "POST" }),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(200);
    const updated = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(updated.isPaid).toBe(true);
    expect(updated.paidByUserId).toBe(1);
    expect(updated.paymentMethod).toBeNull();
  });

  it("收款人不是本教室成員 → 400，不改動", async () => {
    const { student, sc } = await unpaidCard();
    const outsider = await prisma.user.create({
      data: { email: "out@test.local", name: "Out", password: "x" },
    });
    const res = await CONFIRM_PAYMENT(
      jsonRequest("POST", { paymentMethod: "CASH", receiverUserId: outsider.id }),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(400);
    const untouched = await prisma.studentCard.findUniqueOrThrow({ where: { id: sc.id } });
    expect(untouched.isPaid).toBe(false);
  });

  it("付款方式不合法 → 400", async () => {
    const { student, sc } = await unpaidCard();
    const res = await CONFIRM_PAYMENT(
      jsonRequest("POST", { paymentMethod: "LINE_PAY" }),
      routeParams({ id: String(student.id), studentCardId: String(sc.id) })
    );
    expect(res.status).toBe(400);
  });
});
