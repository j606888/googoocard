import { NextResponse } from "next/server";
import { createAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

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

    const firstClassroomId = user.memberships[0].classroomId;

    await createAuthSession(user.id, firstClassroomId);

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
