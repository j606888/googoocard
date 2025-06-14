import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (user) {
      return NextResponse.json(
        { success: false, error: "User already exists" },
        { status: 400 }
      );
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });
    return NextResponse.json({ success: true, user: newUser });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: "DB error" },
      { status: 500 }
    );
  }
}
