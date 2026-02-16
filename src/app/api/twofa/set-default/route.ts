import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookie } from "@/lib/session";
import { validateCsrfToken } from "@/lib/csrf";
import { setDefaultMethod, type TwoFactorMethod } from "@/lib/twofa";

export const runtime = "nodejs";

const VALID_METHODS: TwoFactorMethod[] = ["totp", "email", "passkey"];

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const csrf = request.headers.get("x-csrf-token");
  if (!csrf || !validateCsrfToken(csrf)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  let body: { method?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const method = body.method as TwoFactorMethod;
  if (!method || !VALID_METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  const result = await setDefaultMethod(session.userDid, method);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
