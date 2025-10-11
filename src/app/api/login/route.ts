import { NextResponse } from "next/server";
import { createAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { joinClassroom } from "@/service/classroom";

export async function POST(request: Request) {
  try {
    const { email, password, token } = await request.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: "Email or password incorrect" },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Email or password incorrect" },
        { status: 401 }
      );
    }

    let classroomId: number | null = null;

    if (token) {
      classroomId = await joinClassroom({ userId: user.id, token });
    }

    const currentClassroomId = classroomId || user.currentClassroomId || user.memberships[0].classroomId;

    await createAuthSession(user.id, currentClassroomId);

    return NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
