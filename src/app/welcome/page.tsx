import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WalletCard } from "./WalletCard";
import { SendTransaction } from "./SendTransaction";
import { getSessionFromCookie, SESSION_COOKIE } from "@/lib/session";
import { generateCsrfToken } from "@/lib/csrf";

async function signOut() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}

async function fetchWallet(did: string) {
  const walletUrl = process.env.WALLET_SERVICE_URL;
  const apiKey = process.env.WALLET_API_KEY;
  if (!walletUrl || !apiKey) return null;
  try {
    const res = await fetch(`${walletUrl}/wallet/${encodeURIComponent(did)}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function Welcome() {
  const cookieStore = await cookies();
  const session = await getSessionFromCookie(cookieStore);

  if (!session) {
    redirect("/");
  }

  // 2FA pending — must verify first
  if (session.verified === false) {
    redirect("/verify-2fa");
  }

  const walletData = await fetchWallet(session.userDid);
  const csrfToken = generateCsrfToken();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "20px",
        background: "#F2EBE4",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <img
          src="/logo.png"
          alt="Ma Earth"
          style={{ height: "80px", marginBottom: "8px" }}
        />
        <p
          style={{
            fontSize: "17px",
            color: "#6b6b6b",
            lineHeight: 1.6,
            margin: "0 0 20px 0",
          }}
        >
          You are signed in.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "12px",
          }}
        >
          <a
            href="/welcome/settings"
            title="Settings"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "1px solid #d4d0cb",
              background: "transparent",
              color: "#6b6b6b",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </a>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "28px 32px",
            textAlign: "left",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            marginBottom: "32px",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "4px",
              }}
            >
              Handle
            </div>
            <div style={{ fontSize: "17px", color: "#1A130F" }}>
              @{session.userHandle}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "4px",
              }}
            >
              DID
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#6b6b6b",
                fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                wordBreak: "break-all",
              }}
            >
              {session.userDid}
            </div>
          </div>
        </div>

        <WalletCard initial={walletData} />

        <SendTransaction
          smartAccountAddress={walletData?.smartAccountAddress ?? null}
          csrfToken={csrfToken}
        />

        <form action={signOut} style={{ textAlign: "center" }}>
          <button
            type="submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 28px",
              fontSize: "16px",
              fontWeight: 500,
              color: "#faf9f6",
              background: "#1A130F",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              letterSpacing: "0.3px",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
