import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/db";
import { createToken, setAuthCookie } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  validateEmail,
  validatePassword,
  validateName,
  sanitizeString,
} from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 signups per 10 minutes per IP
    const ip = getClientIp(request);
    const limit = await rateLimit(`signup:${ip}`, 5, 600);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.reset),
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": String(limit.remaining),
          },
        }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    // Validate inputs
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json({ error: emailCheck.error }, { status: 400 });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      );
    }

    const nameCheck = validateName(name);
    if (!nameCheck.valid) {
      return NextResponse.json({ error: nameCheck.error }, { status: 400 });
    }

    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanName = sanitizeString(name);

    // Create user
    const user = await createUser(cleanEmail, password, cleanName);
    if (!user) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
