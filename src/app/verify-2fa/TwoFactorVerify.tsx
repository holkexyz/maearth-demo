"use client";

import { useState, useEffect, useCallback } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

type Method = "totp" | "email" | "passkey";

const METHOD_LABELS: Record<Method, string> = {
  passkey: "Passkey",
  totp: "Authenticator",
  email: "Email",
};

export function TwoFactorVerify({
  defaultMethod,
  enabledMethods,
  csrfToken,
}: {
  defaultMethod: Method;
  enabledMethods: Method[];
  csrfToken: string;
}) {
  const [activeMethod, setActiveMethod] = useState<Method>(defaultMethod);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "verifying" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const otherMethods = enabledMethods.filter((m) => m !== activeMethod);

  const headers = {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
  };

  const handlePasskey = useCallback(async () => {
    setStatus("verifying");
    setErrorMsg("");
    try {
      const optionsRes = await fetch("/api/twofa/passkey-auth-options", {
        method: "POST",
        headers,
      });
      if (!optionsRes.ok) throw new Error("Failed to get passkey options");
      const options = await optionsRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/twofa/passkey-verify", {
        method: "POST",
        headers,
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "Passkey verification failed");
      }

      window.location.href = "/welcome";
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Passkey verification failed",
      );
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csrfToken]);

  // Auto-trigger passkey on mount or when switching to passkey
  useEffect(() => {
    if (activeMethod === "passkey") {
      handlePasskey();
    }
  }, [activeMethod, handlePasskey]);

  const handleSendEmailCode = async () => {
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/send-email-code", {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send code");
      }
      setEmailSent(true);
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send code");
      setStatus("error");
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) return;
    setStatus("verifying");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ code: code.trim(), method: activeMethod }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid code");
      }
      window.location.href = "/welcome";
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Verification failed");
      setStatus("error");
    }
  };

  const switchMethod = (method: Method) => {
    setActiveMethod(method);
    setCode("");
    setErrorMsg("");
    setStatus("idle");
    setEmailSent(false);
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "6px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    fontSize: "20px",
    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
    border: "1px solid #d4d0cb",
    borderRadius: "8px",
    outline: "none",
    boxSizing: "border-box",
    textAlign: "center",
    letterSpacing: "8px",
    color: "#1A130F",
  };

  const buttonStyle: React.CSSProperties = {
    display: "flex",
    width: "100%",
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
  };

  const errorBox = errorMsg && status === "error" && (
    <div
      style={{
        background: "#fdf0f0",
        color: "#dc3545",
        padding: "12px 16px",
        borderRadius: "8px",
        fontSize: "13px",
        marginBottom: "16px",
      }}
    >
      {errorMsg}
    </div>
  );

  const methodSwitcher = otherMethods.length > 0 && (
    <div
      style={{
        marginTop: "20px",
        paddingTop: "16px",
        borderTop: "1px solid #eee",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "12px", color: "#999", margin: "0 0 8px 0" }}>
        Or verify with
      </p>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
        {otherMethods.map((m) => (
          <button
            key={m}
            onClick={() => switchMethod(m)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: "#1A130F",
              background: "transparent",
              border: "1px solid #d4d0cb",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {METHOD_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );

  // --- Passkey UI ---
  if (activeMethod === "passkey") {
    return (
      <div>
        <div style={labelStyle}>Passkey verification</div>
        {errorBox}
        <p
          style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 16px 0" }}
        >
          {status === "verifying"
            ? "Waiting for passkey..."
            : "Use your passkey to verify your identity."}
        </p>
        {status !== "verifying" && (
          <button onClick={handlePasskey} style={buttonStyle}>
            Try again
          </button>
        )}
        {methodSwitcher}
      </div>
    );
  }

  // --- Email OTP UI ---
  if (activeMethod === "email") {
    return (
      <div>
        <div style={labelStyle}>Email verification</div>
        {errorBox}
        <p
          style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 16px 0" }}
        >
          {emailSent
            ? "A code has been sent to your registered email."
            : "Click below to receive a verification code."}
        </p>
        {!emailSent ? (
          <button
            onClick={handleSendEmailCode}
            disabled={status === "sending"}
            style={{
              ...buttonStyle,
              opacity: status === "sending" ? 0.7 : 1,
            }}
          >
            {status === "sending" ? "Sending..." : "Send code"}
          </button>
        ) : (
          <>
            <div style={{ marginBottom: "4px" }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  if (status === "error") setStatus("idle");
                }}
                disabled={status === "verifying"}
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={{ textAlign: "right", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={handleSendEmailCode}
                disabled={status === "sending"}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6b6b6b",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: "4px 0",
                  textDecoration: "underline",
                }}
              >
                Resend code
              </button>
            </div>
            <button
              onClick={handleVerifyCode}
              disabled={status === "verifying" || code.length < 6}
              style={{
                ...buttonStyle,
                opacity: status === "verifying" || code.length < 6 ? 0.7 : 1,
              }}
            >
              {status === "verifying" ? "Verifying..." : "Verify"}
            </button>
          </>
        )}
        {methodSwitcher}
      </div>
    );
  }

  // --- TOTP UI ---
  return (
    <div>
      <div style={labelStyle}>Authenticator code</div>
      {errorBox}
      <p style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 16px 0" }}>
        Enter the 6-digit code from your authenticator app.
      </p>
      <div style={{ marginBottom: "12px" }}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            if (status === "error") setStatus("idle");
          }}
          disabled={status === "verifying"}
          style={inputStyle}
          autoFocus
        />
      </div>
      <button
        onClick={handleVerifyCode}
        disabled={status === "verifying" || code.length < 6}
        style={{
          ...buttonStyle,
          opacity: status === "verifying" || code.length < 6 ? 0.7 : 1,
        }}
      >
        {status === "verifying" ? "Verifying..." : "Verify"}
      </button>
      {methodSwitcher}
    </div>
  );
}
