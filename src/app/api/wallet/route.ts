import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const walletUrl = process.env.WALLET_SERVICE_URL;
  const apiKey = process.env.WALLET_API_KEY;

  if (!walletUrl || !apiKey) {
    return NextResponse.json(
      { error: "Wallet service not configured" },
      { status: 503 },
    );
  }

  const res = await fetch(
    `${walletUrl}/wallet/${encodeURIComponent(session.userDid)}`,
    {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Wallet service error" },
      { status: 502 },
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
