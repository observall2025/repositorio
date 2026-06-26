import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { requireEnv } from "./env";

const SESSION_COOKIE = "document_repository_session";
const SESSION_HOURS = 12;

type SessionPayload = {
  user: string;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-session-secret-change-me";
  }

  throw new Error("SESSION_SECRET nao configurado.");
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sign(value: string) {
  return base64Url(createHmac("sha256", getSessionSecret()).update(value).digest());
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getAdminEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL || "admin@repo.com");
}

export async function authenticateAdmin(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password || normalizedEmail !== getAdminEmail()) {
    return null;
  }

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error || normalizeEmail(data.user?.email ?? "") !== getAdminEmail()) {
    return null;
  }

  return {
    email: normalizedEmail,
    id: data.user.id
  };
}

export function createSessionToken(user: string) {
  const payload: SessionPayload = {
    user: normalizeEmail(user),
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000
  };
  const encodedPayload = base64Url(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function readSessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as SessionPayload;

    if (!payload.user || payload.exp < Date.now() || normalizeEmail(payload.user) !== getAdminEmail()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const store = await cookies();
  const payload = readSessionToken(store.get(SESSION_COOKIE)?.value);

  return payload?.user ?? null;
}

export function getCurrentUserFromRequest(request: NextRequest) {
  const payload = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  return payload?.user ?? null;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_HOURS * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}
