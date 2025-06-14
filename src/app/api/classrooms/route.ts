import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    console.log({token});

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const userId = +decoded.id;

    console.log({userId});

    // Create classroom + membership in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const classroom = await tx.classroom.create({
        data: {
          name,
          ownerId: userId,
        },
      });

      await tx.membership.create({
        data: {
          userId,
          classroomId: classroom.id,
          role: 'owner',
        },
      });

      return classroom;
    });

    return NextResponse.json({ success: true, classroom: result });
  } catch (err) {
    console.error('[CREATE_CLASSROOM_ERROR]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
