"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

type Method = "passkey" | "totp" | "email";
type SetupState =
  | "overview"
  | "select-method"
  | "passkey-setup"
  | "totp-setup"
  | "totp-verify"
  | "email-enter"
  | "email-verify"
  | "remove-confirm"
  | "complete";

const METHOD_LABELS: Record<Method, string> = {
  passkey: "Passkey",
  totp: "Authenticator app",
  email: "Second email",
};

const METHOD_DESCRIPTIONS: Record<Method, string> = {
  passkey: "Touch ID, Face ID, or security key",
  totp: "Google Authenticator, Authy, or similar",
  email: "Receive a code at a different email address",
};

export function TwoFactorSetup({
  enabledMethods: initialEnabledMethods,
  defaultMethod: initialDefaultMethod,
  currentEmail,
  userHandle,
  csrfToken,
}: {
  enabledMethods: Method[];
  defaultMethod: Method | null;
  currentEmail: string | null;
  userHandle: string;
  csrfToken: string;
}) {
  const [state, setState] = useState<SetupState>("overview");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [enabledMethods, setEnabledMethods] = useState<Method[]>(
    initialEnabledMethods,
  );
  const [defaultMethod, setDefaultMethod] = useState<Method | null>(
    initialDefaultMethod,
  );
  const [removingMethod, setRemovingMethod] = useState<Method | null>(null);
  const [disableEmailSent, setDisableEmailSent] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
  };

  // --- Styles ---

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
    padding: "12px 14px",
    fontSize: "14px",
    border: "1px solid #d4d0cb",
    borderRadius: "8px",
    outline: "none",
    boxSizing: "border-box",
    color: "#1A130F",
  };

  const codeInputStyle: React.CSSProperties = {
    ...inputStyle,
    fontSize: "20px",
    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
    textAlign: "center",
    letterSpacing: "8px",
  };

  const buttonStyle: React.CSSProperties = {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#faf9f6",
    background: "#1A130F",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "transparent",
    color: "#1A130F",
    border: "1px solid #d4d0cb",
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "#dc3545",
  };

  const methodCardStyle: React.CSSProperties = {
    padding: "16px",
    border: "1px solid #d4d0cb",
    borderRadius: "8px",
    cursor: "pointer",
    marginBottom: "8px",
    textAlign: "left",
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

  // --- Passkey setup ---
  const handlePasskeySetup = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const optionsRes = await fetch("/api/twofa/passkey-register-options", {
        method: "POST",
        headers,
      });
      if (!optionsRes.ok) throw new Error("Failed to get registration options");
      const options = await optionsRes.json();

      const attestation = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/twofa/passkey-register-verify", {
        method: "POST",
        headers,
        body: JSON.stringify(attestation),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "Registration failed");
      }

      setEnabledMethods((prev) =>
        prev.includes("passkey") ? prev : [...prev, "passkey"],
      );
      if (!defaultMethod) setDefaultMethod("passkey");
      setState("complete");
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Passkey setup failed");
      setStatus("error");
    }
  };

  // --- TOTP setup ---
  const handleTotpInit = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/totp-setup", {
        method: "POST",
        headers,
        body: JSON.stringify({ step: "init" }),
      });
      if (!res.ok) throw new Error("Failed to generate TOTP secret");
      const data = await res.json();
      setQrSvg(data.qrCodeSvg);
      setManualKey(data.secret);
      setState("totp-verify");
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "TOTP setup failed");
      setStatus("error");
    }
  };

  const handleTotpVerify = async () => {
    if (code.length < 6) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/totp-setup", {
        method: "POST",
        headers,
        body: JSON.stringify({ step: "verify", code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid code");
      }
      setEnabledMethods((prev) =>
        prev.includes("totp") ? prev : [...prev, "totp"],
      );
      if (!defaultMethod) setDefaultMethod("totp");
      setState("complete");
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Verification failed");
      setStatus("error");
    }
  };

  // --- Email setup ---
  const handleEmailSend = async () => {
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/email-setup", {
        method: "POST",
        headers,
        body: JSON.stringify({ step: "send", email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send code");
      }
      setState("email-verify");
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send code");
      setStatus("error");
    }
  };

  const handleEmailVerify = async () => {
    if (code.length < 6) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/email-setup", {
        method: "POST",
        headers,
        body: JSON.stringify({ step: "verify", code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid code");
      }
      setEnabledMethods((prev) =>
        prev.includes("email") ? prev : [...prev, "email"],
      );
      if (!defaultMethod) setDefaultMethod("email");
      setState("complete");
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Verification failed");
      setStatus("error");
    }
  };

  // --- Set default ---
  const handleSetDefault = async (method: Method) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/set-default", {
        method: "POST",
        headers,
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set default");
      }
      setDefaultMethod(method);
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to set default");
      setStatus("error");
    }
  };

  // --- Remove method ---
  const handleSendDisableCode = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/twofa/disable", {
        method: "POST",
        headers,
        body: JSON.stringify({ method: "email", step: "send-code" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send code");
      }
      setDisableEmailSent(true);
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send code");
      setStatus("error");
    }
  };

  const handleRemove = async () => {
    if (!removingMethod) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const body: Record<string, string> = { method: removingMethod };
      if (removingMethod === "totp" || removingMethod === "email") {
        body.code = code.trim();
      }
      const res = await fetch("/api/twofa/disable", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove method");
      }
      const newMethods = enabledMethods.filter((m) => m !== removingMethod);
      setEnabledMethods(newMethods);
      if (defaultMethod === removingMethod) {
        setDefaultMethod(newMethods.length > 0 ? newMethods[0] : null);
      }
      setRemovingMethod(null);
      setCode("");
      setDisableEmailSent(false);
      setState("overview");
      setStatus("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to remove");
      setStatus("error");
    }
  };

  // --- Overview ---
  if (state === "overview") {
    return (
      <div>
        <div style={labelStyle}>Two-Factor Authentication</div>
        {enabledMethods.length > 0 ? (
          <>
            <div style={{ marginTop: "8px", marginBottom: "16px" }}>
              {enabledMethods.map((method) => (
                <div
                  key={method}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    border: "1px solid #d4d0cb",
                    borderRadius: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#1A130F",
                      }}
                    >
                      {METHOD_LABELS[method]}
                      {method === "email" && currentEmail && (
                        <span
                          style={{
                            color: "#6b6b6b",
                            fontWeight: 400,
                            fontSize: "13px",
                          }}
                        >
                          {" "}
                          ({currentEmail.replace(/^(.).*@/, "$1***@")})
                        </span>
                      )}
                    </div>
                    {method === defaultMethod && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#166534",
                          background: "#f0fdf4",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          marginTop: "4px",
                          display: "inline-block",
                        }}
                      >
                        Default
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    {method !== defaultMethod && (
                      <button
                        onClick={() => handleSetDefault(method)}
                        disabled={status === "loading"}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#6b6b6b",
                          fontSize: "12px",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: "4px",
                        }}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setRemovingMethod(method);
                        setCode("");
                        setErrorMsg("");
                        setStatus("idle");
                        setDisableEmailSent(false);
                        setState("remove-confirm");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc3545",
                        fontSize: "12px",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {enabledMethods.length < 3 && (
              <button
                onClick={() => {
                  setState("select-method");
                  setErrorMsg("");
                  setStatus("idle");
                }}
                style={secondaryButtonStyle}
              >
                Add another method
              </button>
            )}
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: "13px",
                color: "#6b6b6b",
                margin: "4px 0 16px 0",
              }}
            >
              Add a second factor to protect your account.
            </p>
            <button
              onClick={() => {
                setState("select-method");
                setErrorMsg("");
                setStatus("idle");
              }}
              style={buttonStyle}
            >
              Enable 2FA
            </button>
          </>
        )}
      </div>
    );
  }

  // --- Method selection ---
  if (state === "select-method") {
    const availableMethods: Method[] = (
      ["passkey", "totp", "email"] as Method[]
    ).filter((m) => !enabledMethods.includes(m));

    return (
      <div>
        <div style={labelStyle}>Choose a method</div>
        {availableMethods.map((method) => (
          <div
            key={method}
            onClick={() => {
              if (method === "passkey") {
                setState("passkey-setup");
                handlePasskeySetup();
              } else if (method === "totp") {
                setState("totp-setup");
                handleTotpInit();
              } else {
                setState("email-enter");
                setEmail("");
                setCode("");
                setErrorMsg("");
              }
            }}
            style={methodCardStyle}
          >
            <div
              style={{ fontSize: "15px", fontWeight: 500, color: "#1A130F" }}
            >
              {METHOD_LABELS[method]}
            </div>
            <div
              style={{ fontSize: "13px", color: "#6b6b6b", marginTop: "4px" }}
            >
              {METHOD_DESCRIPTIONS[method]}
            </div>
          </div>
        ))}
        <button
          onClick={() => setState("overview")}
          style={{ ...secondaryButtonStyle, marginTop: "8px" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // --- Passkey setup (loading state) ---
  if (state === "passkey-setup") {
    return (
      <div>
        <div style={labelStyle}>Passkey setup</div>
        {errorBox}
        <p
          style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 16px 0" }}
        >
          {status === "loading"
            ? "Follow the prompt to register your passkey..."
            : "Registration failed. Try again."}
        </p>
        {status === "error" && (
          <button onClick={handlePasskeySetup} style={buttonStyle}>
            Try again
          </button>
        )}
        <button
          onClick={() => setState("select-method")}
          style={{ ...secondaryButtonStyle, marginTop: "8px" }}
        >
          Back
        </button>
      </div>
    );
  }

  // --- TOTP setup / verify ---
  if (state === "totp-setup") {
    return (
      <div>
        <div style={labelStyle}>Authenticator setup</div>
        {errorBox}
        <p
          style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 16px 0" }}
        >
          {status === "loading"
            ? "Generating..."
            : "Setting up authenticator app."}
        </p>
        <button
          onClick={() => setState("select-method")}
          style={secondaryButtonStyle}
        >
          Back
        </button>
      </div>
    );
  }

  if (state === "totp-verify") {
    return (
      <div>
        <div style={labelStyle}>Scan QR code</div>
        {errorBox}
        <p
          style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 12px 0" }}
        >
          Scan this QR code with your authenticator app.
        </p>
        {qrSvg && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "12px",
            }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
        <div
          style={{
            background: "#f8f7f5",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "11px",
            fontFamily: "'SF Mono', Menlo, Consolas, monospace",
            color: "#6b6b6b",
            wordBreak: "break-all",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          {manualKey}
        </div>
        <p style={{ fontSize: "13px", color: "#6b6b6b", margin: "0 0 8px 0" }}>
          Enter the 6-digit code from your app:
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
            disabled={status === "loading"}
            style={codeInputStyle}
            autoFocus
          />
        </div>
        <button
          onClick={handleTotpVerify}
          disabled={status === "loading" || code.length < 6}
          style={{
            ...buttonStyle,
            opacity: status === "loading" || code.length < 6 ? 0.7 : 1,
          }}
        >
          {status === "loading" ? "Verifying..." : "Verify & enable"}
        </button>
        <button
          onClick={() => setState("select-method")}
          style={{ ...secondaryButtonStyle, marginTop: "8px" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // --- Email enter ---
  if (state === "email-enter") {
    return (
      <div>
        <div style={labelStyle}>Second email</div>
        {errorBox}
        <p
          style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 12px 0" }}
        >
          Enter an email address to receive verification codes.
        </p>
        <div style={{ marginBottom: "12px" }}>
          <input
            type="email"
            placeholder="your-other-email@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            disabled={status === "loading"}
            style={inputStyle}
            autoFocus
          />
        </div>
        <button
          onClick={handleEmailSend}
          disabled={status === "loading" || !email.trim()}
          style={{
            ...buttonStyle,
            opacity: status === "loading" || !email.trim() ? 0.7 : 1,
          }}
        >
          {status === "loading" ? "Sending..." : "Send verification code"}
        </button>
        <button
          onClick={() => setState("select-method")}
          style={{ ...secondaryButtonStyle, marginTop: "8px" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // --- Email verify ---
  if (state === "email-verify") {
    return (
      <div>
        <div style={labelStyle}>Verify email</div>
        {errorBox}
        <p
          style={{ fontSize: "13px", color: "#6b6b6b", margin: "4px 0 12px 0" }}
        >
          Enter the 6-digit code sent to {email}.
        </p>
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
            disabled={status === "loading"}
            style={codeInputStyle}
            autoFocus
          />
        </div>
        <div style={{ textAlign: "right", marginBottom: "12px" }}>
          <button
            type="button"
            onClick={() => {
              setCode("");
              setErrorMsg("");
              setStatus("idle");
              handleEmailSend();
            }}
            disabled={status === "loading"}
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
          onClick={handleEmailVerify}
          disabled={status === "loading" || code.length < 6}
          style={{
            ...buttonStyle,
            opacity: status === "loading" || code.length < 6 ? 0.7 : 1,
          }}
        >
          {status === "loading" ? "Verifying..." : "Verify & enable"}
        </button>
        <button
          onClick={() => setState("select-method")}
          style={{ ...secondaryButtonStyle, marginTop: "8px" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // --- Remove confirm ---
  if (state === "remove-confirm" && removingMethod) {
    const isLastMethod = enabledMethods.length === 1;

    if (removingMethod === "passkey") {
      return (
        <div>
          <div style={labelStyle}>Remove Passkey</div>
          {errorBox}
          <p
            style={{
              fontSize: "13px",
              color: "#6b6b6b",
              margin: "4px 0 16px 0",
            }}
          >
            {isLastMethod
              ? "This is your only 2FA method. Removing it will disable 2FA entirely."
              : "Are you sure you want to remove passkey authentication?"}
          </p>
          <button
            onClick={handleRemove}
            disabled={status === "loading"}
            style={{
              ...dangerButtonStyle,
              opacity: status === "loading" ? 0.7 : 1,
            }}
          >
            {status === "loading" ? "Removing..." : "Confirm remove"}
          </button>
          <button
            onClick={() => {
              setState("overview");
              setRemovingMethod(null);
            }}
            style={{ ...secondaryButtonStyle, marginTop: "8px" }}
          >
            Cancel
          </button>
        </div>
      );
    }

    if (removingMethod === "totp") {
      return (
        <div>
          <div style={labelStyle}>Remove Authenticator</div>
          {errorBox}
          <p
            style={{
              fontSize: "13px",
              color: "#6b6b6b",
              margin: "4px 0 12px 0",
            }}
          >
            Enter your current authenticator code to confirm.
            {isLastMethod && " This will disable 2FA entirely."}
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
              disabled={status === "loading"}
              style={codeInputStyle}
              autoFocus
            />
          </div>
          <button
            onClick={handleRemove}
            disabled={status === "loading" || code.length < 6}
            style={{
              ...dangerButtonStyle,
              opacity: status === "loading" || code.length < 6 ? 0.7 : 1,
            }}
          >
            {status === "loading" ? "Removing..." : "Confirm remove"}
          </button>
          <button
            onClick={() => {
              setState("overview");
              setRemovingMethod(null);
              setCode("");
            }}
            style={{ ...secondaryButtonStyle, marginTop: "8px" }}
          >
            Cancel
          </button>
        </div>
      );
    }

    // Email removal — needs code sent first
    return (
      <div>
        <div style={labelStyle}>Remove Email 2FA</div>
        {errorBox}
        {!disableEmailSent ? (
          <>
            <p
              style={{
                fontSize: "13px",
                color: "#6b6b6b",
                margin: "4px 0 16px 0",
              }}
            >
              We need to verify your email to remove this method.
              {isLastMethod && " This will disable 2FA entirely."}
            </p>
            <button
              onClick={handleSendDisableCode}
              disabled={status === "loading"}
              style={{
                ...dangerButtonStyle,
                opacity: status === "loading" ? 0.7 : 1,
              }}
            >
              {status === "loading" ? "Sending..." : "Send verification code"}
            </button>
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: "13px",
                color: "#6b6b6b",
                margin: "4px 0 12px 0",
              }}
            >
              Enter the code sent to your email.
              {isLastMethod && " This will disable 2FA entirely."}
            </p>
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
                disabled={status === "loading"}
                style={codeInputStyle}
                autoFocus
              />
            </div>
            <div style={{ textAlign: "right", marginBottom: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  setErrorMsg("");
                  setStatus("idle");
                  handleSendDisableCode();
                }}
                disabled={status === "loading"}
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
              onClick={handleRemove}
              disabled={status === "loading" || code.length < 6}
              style={{
                ...dangerButtonStyle,
                opacity: status === "loading" || code.length < 6 ? 0.7 : 1,
              }}
            >
              {status === "loading" ? "Removing..." : "Confirm remove"}
            </button>
          </>
        )}
        <button
          onClick={() => {
            setState("overview");
            setRemovingMethod(null);
            setCode("");
            setDisableEmailSent(false);
          }}
          style={{ ...secondaryButtonStyle, marginTop: "8px" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  // --- Complete ---
  if (state === "complete") {
    return (
      <div>
        <div style={labelStyle}>Two-Factor Authentication</div>
        <div
          style={{
            background: "#f0fdf4",
            padding: "16px",
            borderRadius: "8px",
            fontSize: "14px",
            color: "#166534",
            marginTop: "8px",
            marginBottom: "16px",
          }}
        >
          Method added successfully.
        </div>
        <button
          onClick={() => {
            setState("overview");
            setCode("");
            setErrorMsg("");
          }}
          style={buttonStyle}
        >
          Done
        </button>
      </div>
    );
  }

  return null;
}
