import prisma from "@/lib/prisma";

export const joinClassroom = async ({
  userId,
  token,
}: {
  userId: number;
  token: string;
}): Promise<number | null> => {
  const inviteToken = await prisma.inviteToken.findUnique({
    where: {
      token,
    },
  });

  if (!inviteToken) return null;

  if (inviteToken.uses >= inviteToken.maxUses) return null;

  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId,
      classroomId: inviteToken.classroomId,
    },
  });

  if (existingMembership) return null;

  const classroom = await prisma.classroom.findUnique({
    where: {
      id: inviteToken.classroomId,
    },
  });

  if (!classroom) return null;

  await prisma.membership.create({
    data: {
      userId,
      classroomId: inviteToken.classroomId,
      role: "assistant",
    },
  });

  await prisma.inviteToken.update({
    where: {
      token,
    },
    data: {
      uses: {
        increment: 1,
      },
    },
  });

  return classroom.id;
};
