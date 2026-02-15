import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookie } from "@/lib/session";
import { checkRateLimit } from "@/lib/ratelimit";
import { validateCsrfToken } from "@/lib/csrf";

export const runtime = "nodejs";
export const maxDuration = 30;

const RATE_LIMIT_TX = Number(process.env.RATE_LIMIT_TRANSACTION) || 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_TX_AMOUNT = Number(process.env.MAX_TRANSACTION_AMOUNT) || 0.1;
const MAX_DAILY_AMOUNT = Number(process.env.MAX_DAILY_AMOUNT) || 1.0;

// Daily spending tracker per DID
const dailyTotals = new Map<string, { total: number; date: string }>();

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getDailyTotal(did: string): number {
  const entry = dailyTotals.get(did);
  if (!entry || entry.date !== getTodayStr()) return 0;
  return entry.total;
}

function addDailyTotal(did: string, amount: number): void {
  const today = getTodayStr();
  const entry = dailyTotals.get(did);
  if (!entry || entry.date !== today) {
    dailyTotals.set(did, { total: amount, date: today });
  } else {
    entry.total += amount;
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // CSRF validation
  const csrfToken = request.headers.get("x-csrf-token");
  if (!csrfToken || !validateCsrfToken(csrfToken)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // Rate limit per user
  const rl = checkRateLimit(
    `tx:${session.userDid}`,
    RATE_LIMIT_TX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many transactions" },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      },
    );
  }

  const walletUrl = process.env.WALLET_SERVICE_URL;
  const apiKey = process.env.WALLET_API_KEY;

  if (!walletUrl || !apiKey) {
    return NextResponse.json(
      { error: "Wallet service not configured" },
      { status: 503 },
    );
  }

  let body: { to?: string; amount?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = (body.to || "").trim();
  if (!to || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address" },
      { status: 400 },
    );
  }

  const amount = (body.amount || "0").trim();
  const amountNum = Number(amount);
  if (isNaN(amountNum) || amountNum < 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Per-transaction limit
  if (amountNum > MAX_TX_AMOUNT) {
    return NextResponse.json(
      { error: `Exceeds transaction limit of ${MAX_TX_AMOUNT} ETH` },
      { status: 400 },
    );
  }

  // Daily limit
  const dailyTotal = getDailyTotal(session.userDid);
  if (dailyTotal + amountNum > MAX_DAILY_AMOUNT) {
    return NextResponse.json(
      { error: `Exceeds daily limit of ${MAX_DAILY_AMOUNT} ETH` },
      { status: 400 },
    );
  }

  const res = await fetch(`${walletUrl}/wallet/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ did: session.userDid, to, amount }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  // Track daily spending after successful transaction
  addDailyTotal(session.userDid, amountNum);

  return NextResponse.json(data);
}
