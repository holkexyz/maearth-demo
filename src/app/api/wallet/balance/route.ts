import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SEPOLIA_RPCS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc2.sepolia.org",
  "https://rpc.sepolia.org",
];

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  for (const rpc of SEPOLIA_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = (await res.json()) as {
        result?: string;
        error?: { message: string };
      };
      if (data.result) {
        const wei = BigInt(data.result);
        const balance = (Number(wei) / 1e18).toString();
        return NextResponse.json({ balance });
      }
    } catch {
      /* try next RPC */
    }
  }

  return NextResponse.json(
    { error: "Failed to fetch balance" },
    { status: 502 },
  );
}
