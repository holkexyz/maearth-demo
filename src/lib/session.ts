import * as crypto from "crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-session-secret-change-in-production";

// --- Types ---

export interface OAuthSession {
  state: string;
  codeVerifier: string;
  dpopPrivateJwk: crypto.JsonWebKey;
  tokenEndpoint: string;
  email?: string;
  expectedDid?: string;
  expectedPdsUrl?: string;
}

export interface UserSession {
  userDid: string;
  userHandle: string;
  createdAt: number;
}

type SessionData =
  | { type: "oauth"; data: OAuthSession; expiresAt: number }
  | { type: "user"; data: UserSession; expiresAt: number };

// --- Store ---

const sessions = new Map<string, SessionData>();

const OAUTH_TTL_MS = 10 * 60 * 1000; // 10 minutes
const USER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

// Periodic cleanup of expired sessions
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(id);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent Node.js from exiting
  if (cleanupTimer.unref) cleanupTimer.unref();
}

// --- HMAC Signing ---

function sign(sessionId: string): string {
  const hmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${hmac}`;
}

export function verifySignedId(signed: string): string | null {
  const dotIndex = signed.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const sessionId = signed.substring(0, dotIndex);
  const providedHmac = signed.substring(dotIndex + 1);
  const expectedHmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(sessionId)
    .digest("base64url");
  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sessionId;
}

// --- OAuth Sessions ---

export function createOAuthSession(data: OAuthSession): string {
  ensureCleanup();
  const sessionId = crypto.randomBytes(32).toString("base64url");
  sessions.set(sessionId, {
    type: "oauth",
    data,
    expiresAt: Date.now() + OAUTH_TTL_MS,
  });
  return sign(sessionId);
}

export function getOAuthSession(signedId: string): OAuthSession | null {
  const sessionId = verifySignedId(signedId);
  if (!sessionId) return null;
  const entry = sessions.get(sessionId);
  if (!entry || entry.type !== "oauth" || entry.expiresAt <= Date.now())
    return null;
  return entry.data;
}

export function deleteOAuthSession(signedId: string): void {
  const sessionId = verifySignedId(signedId);
  if (sessionId) sessions.delete(sessionId);
}

// --- User Sessions ---

export function createUserSession(data: UserSession): string {
  ensureCleanup();
  const sessionId = crypto.randomBytes(32).toString("base64url");
  sessions.set(sessionId, {
    type: "user",
    data,
    expiresAt: Date.now() + USER_TTL_MS,
  });
  return sign(sessionId);
}

export function getUserSession(signedId: string): UserSession | null {
  const sessionId = verifySignedId(signedId);
  if (!sessionId) return null;
  const entry = sessions.get(sessionId);
  if (!entry || entry.type !== "user" || entry.expiresAt <= Date.now())
    return null;
  return entry.data;
}

export function deleteUserSession(signedId: string): void {
  const sessionId = verifySignedId(signedId);
  if (sessionId) sessions.delete(sessionId);
}

// --- Cookie Helper ---

const SESSION_COOKIE = "session_id";

export async function getSessionFromCookie(cookieStore: {
  get(name: string): { value: string } | undefined;
}): Promise<UserSession | null> {
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie) return null;
  return getUserSession(cookie.value);
}

export { SESSION_COOKIE };
