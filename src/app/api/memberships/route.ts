import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

import { decodeAuthToken } from "@/lib/auth";
export async function GET() {
  const { classroomId } = await decodeAuthToken()
  const memberships = await prisma.membership.findMany({
    where: {
      classroomId,
    },
    include: {
      user: true,
    },
  })

  const result = memberships.map((membership) => ({
    ...membership,
    user: {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
    },
  }));

  return NextResponse.json(result)
}