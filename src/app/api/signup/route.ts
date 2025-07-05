import { NextResponse } from "next/server";
import { createAuthSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { joinClassroom } from "@/service/classroom";

export async function POST(request: Request) {
  try {
    const { name, email, password, token } = await request.json();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    let classroomId: number | null = null;

    if (token) {
      classroomId = await joinClassroom({ userId: user.id, token });
    }

    await createAuthSession(Number(user.id), classroomId ?? undefined);

    return NextResponse.json({
      message: "Signup successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
