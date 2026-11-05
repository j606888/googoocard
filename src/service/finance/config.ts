import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/lib/apiError";

/** keeper／付款人／到期歸屬人必須是這間教室的保管人（isCustodian），否則 400 NOT_FINANCE_MEMBER。 */
export async function assertCustodian(userId: number, classroomId: number) {
  const m = await prisma.membership.findUnique({
    where: { userId_classroomId: { userId, classroomId } },
    select: { isCustodian: true },
  });
  if (!m?.isCustodian) {
    throw new ApiError(400, "NOT_FINANCE_MEMBER", "User is not a custodian of this classroom");
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

/** 場地名稱在教室內唯一：撞名（P2002）→ 409 VENUE_NAME_TAKEN，其他錯誤原樣丟出。 */
export async function withVenueNameCheck<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "VENUE_NAME_TAKEN", "A venue with this name already exists");
    }
    throw e;
  }
}
