import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";

/** keeper／付款人／到期歸屬人必須是這間教室有財務權限的成員，否則 400 NOT_FINANCE_MEMBER。 */
export async function assertFinanceMember(userId: number, classroomId: number) {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { isFinance: true },
  });
  if (!m?.isFinance) {
    throw new ApiError(400, "NOT_FINANCE_MEMBER", "User is not a finance member of this classroom");
  }
}

export async function findVenueInClassroom(venueId: number, classroomId: number) {
  return prisma.venue.findFirst({ where: { id: venueId, classroomId } });
}

export async function requireVenueInClassroom(venueId: number, classroomId: number) {
  const v = await findVenueInClassroom(venueId, classroomId);
  if (!v) throw new ApiError(404, "NOT_FOUND", "Venue not found");
  return v;
}
