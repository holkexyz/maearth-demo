import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookie } from "@/lib/session";
import { getTwoFactorConfig, getEnabledMethods } from "@/lib/twofa";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const config = await getTwoFactorConfig(session.userDid);

  if (!config || config.methods.length === 0) {
    return NextResponse.json({ enabled: false });
  }

  const methods = config.methods.map((m) => {
    if (m.type === "email") {
      return {
        type: m.type,
        address: m.address.replace(/^(.).*@/, "$1***@"),
        enabledAt: m.enabledAt,
      };
    }
    return { type: m.type, enabledAt: m.enabledAt };
  });

  return NextResponse.json({
    enabled: true,
    defaultMethod: config.defaultMethod,
    methods,
    enabledMethods: getEnabledMethods(config),
  });
}
