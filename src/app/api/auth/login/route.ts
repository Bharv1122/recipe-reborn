import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/db";
import { createToken, setAuthCookie } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { validateEmail, sanitizeString } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 login attempts per 10 minutes per IP (prevents brute force)
    const ip = getClientIp(request);
    const limit = await rateLimit(`login:${ip}`, 10, 600);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
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
    const { email, password } = body;

    // Validate inputs
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: "Invalid email or password" }, // generic for security
        { status: 401 }
      );
    }

    if (typeof password !== "string" || !password) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const cleanEmail = sanitizeString(email).toLowerCase();

    // Verify user
    const user = await verifyUser(cleanEmail, password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
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
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
