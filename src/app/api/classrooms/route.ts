import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createAuthSession, decodeAuthToken } from '@/lib/auth';

export async function GET() {
  const { userId, classroomId } = await decodeAuthToken();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: userId,
    },
    include: {
      classroom: true,
    },
  });
  const classrooms = memberships.map((membership) => membership.classroom);

  return NextResponse.json({ classrooms, currentClassroomId: classroomId });
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    const { userId } = await decodeAuthToken();

    const classroom = await prisma.$transaction(async (tx) => {
      const classroom = await tx.classroom.create({
        data: {
          name,
          ownerId: userId!,
        },
      });

      await tx.membership.create({
        data: {
          userId: userId!,
          classroomId: classroom.id,
          role: 'owner',
        },
      });

      return classroom;
    });

    await createAuthSession(userId!, classroom.id);
    await prisma.user.update({
      where: { id: userId! },
      data: { currentClassroomId: classroom.id },
    });

    return NextResponse.json({ success: true, classroom });
  } catch (err) {
    console.error('[CREATE_CLASSROOM_ERROR]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
