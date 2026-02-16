import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookie, createUserSessionCookie } from "@/lib/session";
import { validateCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  getTwoFactorConfig,
  deleteTwoFactorConfig,
  saveTwoFactorConfig,
  removeMethod,
  getMethodConfig,
  verifyTotpCode,
  verifyPendingCode,
  generateEmailOtp,
  sendEmailOtp,
  savePendingCode,
  deletePasskeyCredentials,
  type TwoFactorMethod,
} from "@/lib/twofa";

export const runtime = "nodejs";

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

  const rl = await checkRateLimit(`twofa:${session.userDid}`, 10, 60000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const config = await getTwoFactorConfig(session.userDid);
  if (!config) {
    return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
  }

  let body: { method?: TwoFactorMethod; code?: string; step?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetMethod = body.method;

  // Email disable: send code step
  if (targetMethod === "email" && body.step === "send-code") {
    const emailConfig = getMethodConfig(config, "email");
    if (!emailConfig) {
      return NextResponse.json(
        { error: "Email 2FA not configured" },
        { status: 400 },
      );
    }
    const code = generateEmailOtp();
    await savePendingCode(
      session.userDid,
      code,
      "email-disable",
      emailConfig.address,
    );
    try {
      await sendEmailOtp(emailConfig.address, code);
    } catch (err) {
      console.error("[2fa] Failed to send disable email OTP:", err);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  }

  // Verify code for TOTP or email removal
  if (targetMethod === "totp") {
    const totpConfig = getMethodConfig(config, "totp");
    if (!totpConfig) {
      return NextResponse.json(
        { error: "TOTP not configured" },
        { status: 400 },
      );
    }
    const code = (body.code || "").trim();
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }
    if (!verifyTotpCode(totpConfig.secret, code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }
  } else if (targetMethod === "email") {
    const code = (body.code || "").trim();
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }
    const result = await verifyPendingCode(session.userDid, code);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Invalid code" },
        { status: 400 },
      );
    }
  }
  // Passkey: no code needed

  // Remove specific method or all
  if (targetMethod) {
    const updated = removeMethod(config, targetMethod);
    if (updated) {
      // Clean up passkey credentials if removing passkey
      if (targetMethod === "passkey") {
        await deletePasskeyCredentials(session.userDid);
      }
      await saveTwoFactorConfig(session.userDid, updated);
    } else {
      // Last method removed — delete everything
      await deleteTwoFactorConfig(session.userDid);
    }
  } else {
    // No method specified — remove all (backward compat)
    await deleteTwoFactorConfig(session.userDid);
  }

  // Refresh session cookie
  const newCookie = createUserSessionCookie({
    userDid: session.userDid,
    userHandle: session.userHandle,
    createdAt: session.createdAt,
    verified: true,
  });

  cookieStore.set(newCookie.name, newCookie.value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
