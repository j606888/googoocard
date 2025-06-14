// app/api/test/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: 'DB error' }, { status: 500 });
  }
}
