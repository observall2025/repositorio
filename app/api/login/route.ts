import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const admin = await authenticateAdmin(email, password);

    if (!admin) {
      return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
    }

    const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
    setSessionCookie(response, createSessionToken(admin.email));

    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }
}
