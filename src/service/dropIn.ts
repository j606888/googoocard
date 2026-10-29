import type { PaymentMethod, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/apiError";
import { findMembership } from "@/lib/authz";
import { formatMoney } from "@/lib/money";

/**
 * 單堂付費：一筆出席不扣課卡，改收 `Lesson.dropInPrice`（DropInCharge）。
 * 跟課卡一樣可以當場收或下課付；沒付的進「待處理」。老師可以改金額（特價），
 * 牌價只是預設，`amount` 記的是實收。
 */

/** 還沒解決的出席：沒綁課卡、也沒付單堂。待處理、未扣卡名單都用這個。 */
export const UNRESOLVED_ATTENDANCE = {
  studentCardId: null,
  dropInCharge: { is: null },
} satisfies Prisma.AttendanceRecordWhereInput;

const PAYMENT_METHOD_LABEL = { CASH: "現金", TRANSFER: "轉帳" } as const;

/** 「$500（原價 $900）」——改過價才標原價，動態裡看得出是特價。 */
function amountLabel(amount: number, listPrice: number | null) {
  const label = `$${formatMoney(amount)}`;
  return listPrice !== null && listPrice !== amount ? `${label}（原價 $${formatMoney(listPrice)}）` : label;
}

export type DropInPaymentInput = {
  isPaid: boolean;
  paymentMethod?: PaymentMethod | null;
  paymentReference?: string | null;
};

/** 收款欄位：沒付就全空；末五碼只對轉帳有意義。 */
function paymentFields(payment: DropInPaymentInput, receiverUserId: number | null) {
  if (!payment.isPaid) {
    return { isPaid: false, paidAt: null, paidByUserId: null, paymentMethod: null, paymentReference: null };
  }
  const method = payment.paymentMethod ?? null;
  return {
    isPaid: true,
    paidAt: new Date(),
    paidByUserId: receiverUserId,
    paymentMethod: method,
    paymentReference: method === "TRANSFER" ? payment.paymentReference || null : null,
  };
}

/**
 * 寫一筆單堂費到出席紀錄上（交易內）。`receiverUserId` = 收款人（已付時）。
 * 呼叫端要先確認這堂課開放單堂、紀錄還沒綁卡也沒付過單堂。
 */
export async function createDropInChargeInTx(
  tx: Prisma.TransactionClient,
  {
    attendanceRecordId,
    studentId,
    lessonName,
    amount,
    listPrice = null,
    payment,
    receiverUserId,
  }: {
    attendanceRecordId: number;
    studentId: number;
    lessonName: string;
    amount: number;
    /** 課程牌價；跟 amount 不同時動態寫「原價」。 */
    listPrice?: number | null;
    payment: DropInPaymentInput;
    receiverUserId: number | null;
  }
) {
  const charge = await tx.dropInCharge.create({
    data: { attendanceRecordId, amount, ...paymentFields(payment, receiverUserId) },
  });
  await tx.event.create({
    data: {
      title: "單堂付費",
      description: [
        `${lessonName} 單堂 ${amountLabel(amount, listPrice)}`,
        payment.isPaid ? payment.paymentMethod && PAYMENT_METHOD_LABEL[payment.paymentMethod] : "待付款",
      ]
        .filter(Boolean)
        .join(" · "),
      studentId,
      resourceType: "attendanceRecord",
      resourceId: attendanceRecordId,
    },
  });
  return charge;
}

/**
 * 老師把一筆沒綁卡的出席改成付單堂（點名結果頁、待處理）。`amount` 省略 = 課程單堂價。
 * 這堂沒開放單堂、紀錄已經綁卡或付過單堂都擋掉。
 */
export async function chargeDropIn({
  classroomId,
  userId,
  lessonId,
  lessonPeriodId,
  studentId,
  amount,
  payment,
}: {
  classroomId: number;
  userId: number;
  lessonId: number;
  lessonPeriodId: number;
  studentId: number;
  amount?: number;
  payment: DropInPaymentInput;
}) {
  const record = await prisma.attendanceRecord.findFirst({
    where: {
      lessonPeriodId,
      studentId,
      lessonPeriod: { lessonId, lesson: { classroomId } },
    },
    include: {
      dropInCharge: { select: { id: true } },
      lessonPeriod: { select: { lesson: { select: { name: true, dropInPrice: true } } } },
    },
  });
  if (!record) throw notFound("Attendance record");
  const { lesson } = record.lessonPeriod;
  const listPrice = lesson.dropInPrice;
  if (listPrice === null) {
    throw badRequest("DROP_IN_NOT_OFFERED", "This lesson does not take drop-in payments");
  }
  if (record.studentCardId !== null || record.dropInCharge) {
    throw badRequest("ALREADY_RESOLVED", "Attendance already paid by card or drop-in");
  }

  return prisma.$transaction((tx) =>
    createDropInChargeInTx(tx, {
      attendanceRecordId: record.id,
      studentId,
      lessonName: lesson.name,
      amount: amount ?? listPrice,
      listPrice,
      payment,
      receiverUserId: userId,
    })
  );
}

/**
 * 確認單堂費已收款。收款人預設是確認的人，也可以指定本教室其他成員。
 * `amount` = 實收（收的時候才給特價）；省略 = 照記帳時的金額。
 */
export async function confirmDropInPayment({
  classroomId,
  userId,
  chargeId,
  amount,
  paymentMethod,
  paymentReference,
  receiverUserId,
}: {
  classroomId: number;
  userId: number;
  chargeId: number;
  amount?: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string | null;
  receiverUserId?: number;
}) {
  const charge = await prisma.dropInCharge.findFirst({
    where: { id: chargeId, attendanceRecord: { student: { classroomId } } },
    include: {
      attendanceRecord: {
        select: { studentId: true, lessonPeriod: { select: { lesson: { select: { name: true } } } } },
      },
    },
  });
  if (!charge) throw notFound("Drop-in charge");
  if (charge.isPaid) throw badRequest("ALREADY_PAID");

  const receiver = receiverUserId ?? userId;
  if (receiver !== userId && !(await findMembership(receiver, classroomId))) {
    throw badRequest("RECEIVER_NOT_MEMBER", "Receiver is not a member of this classroom");
  }

  return prisma.$transaction(async (tx) => {
    const finalAmount = amount ?? charge.amount;
    const updated = await tx.dropInCharge.update({
      where: { id: charge.id },
      data: { amount: finalAmount, ...paymentFields({ isPaid: true, paymentMethod, paymentReference }, receiver) },
    });
    await tx.event.create({
      data: {
        title: "確認付款",
        description: [
          `確認付款 ${charge.attendanceRecord.lessonPeriod.lesson.name} 單堂（${amountLabel(finalAmount, charge.amount)}）`,
          paymentMethod && PAYMENT_METHOD_LABEL[paymentMethod],
        ]
          .filter(Boolean)
          .join(" · "),
        studentId: charge.attendanceRecord.studentId,
        resourceType: "attendanceRecord",
        resourceId: charge.attendanceRecordId,
      },
    });
    return updated;
  });
}
