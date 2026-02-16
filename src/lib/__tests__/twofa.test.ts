import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
  generateEmailOtp,
  addMethod,
  removeMethod,
  getMethodConfig,
  getEnabledMethods,
  type TwoFactorConfig,
  type MethodConfig,
} from "../twofa";
import { TOTP, Secret } from "otpauth";

describe("TOTP", () => {
  it("generates a valid base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("generates a valid otpauth URI", () => {
    const secret = generateTotpSecret();
    const uri = getTotpUri(secret, "test.user");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("Ma%20Earth");
    expect(uri).toContain("secret=");
    expect(uri).toContain("test.user");
  });

  it("verifies a valid TOTP code", () => {
    const secret = generateTotpSecret();
    const totp = new TOTP({
      issuer: "Ma Earth",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    const code = totp.generate();
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects an invalid TOTP code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "000000")).toBe(false);
    expect(verifyTotpCode(secret, "123456")).toBe(false);
  });

  it("rejects empty and malformed codes", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "")).toBe(false);
    expect(verifyTotpCode(secret, "abc")).toBe(false);
  });
});

describe("Email OTP", () => {
  it("generates a 6-digit code", () => {
    const code = generateEmailOtp();
    expect(code).toMatch(/^\d{6}$/);
    expect(code.length).toBe(6);
  });

  it("pads codes with leading zeros", () => {
    const codes = Array.from({ length: 100 }, () => generateEmailOtp());
    for (const code of codes) {
      expect(code.length).toBe(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("generates different codes", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateEmailOtp()));
    expect(codes.size).toBeGreaterThan(15);
  });
});

describe("Multi-method config", () => {
  const totpMethod: MethodConfig = {
    type: "totp",
    secret: "JBSWY3DPEHPK3PXP",
    enabledAt: 1000,
  };

  const emailMethod: MethodConfig = {
    type: "email",
    address: "test@example.com",
    enabledAt: 2000,
  };

  const passkeyMethod: MethodConfig = {
    type: "passkey",
    enabledAt: 3000,
  };

  it("addMethod creates new config when none exists", () => {
    const config = addMethod(null, totpMethod);
    expect(config.version).toBe(2);
    expect(config.defaultMethod).toBe("totp");
    expect(config.methods).toHaveLength(1);
    expect(config.methods[0]).toEqual(totpMethod);
  });

  it("addMethod adds to existing config", () => {
    const config = addMethod(null, totpMethod);
    const updated = addMethod(config, emailMethod);
    expect(updated.methods).toHaveLength(2);
    expect(updated.defaultMethod).toBe("totp"); // original default preserved
    expect(getEnabledMethods(updated)).toEqual(["totp", "email"]);
  });

  it("addMethod replaces same type", () => {
    const config = addMethod(null, totpMethod);
    const newTotp: MethodConfig = {
      type: "totp",
      secret: "NEWSECRET1234567",
      enabledAt: 9999,
    };
    const updated = addMethod(config, newTotp);
    expect(updated.methods).toHaveLength(1);
    expect((updated.methods[0] as { secret: string }).secret).toBe(
      "NEWSECRET1234567",
    );
  });

  it("addMethod supports all three methods", () => {
    let config = addMethod(null, totpMethod);
    config = addMethod(config, emailMethod);
    config = addMethod(config, passkeyMethod);
    expect(config.methods).toHaveLength(3);
    expect(getEnabledMethods(config)).toEqual(["totp", "email", "passkey"]);
  });

  it("removeMethod removes one method", () => {
    let config = addMethod(null, totpMethod);
    config = addMethod(config, emailMethod);
    const updated = removeMethod(config, "totp");
    expect(updated).not.toBeNull();
    expect(updated!.methods).toHaveLength(1);
    expect(updated!.methods[0].type).toBe("email");
  });

  it("removeMethod returns null when last method removed", () => {
    const config = addMethod(null, totpMethod);
    const result = removeMethod(config, "totp");
    expect(result).toBeNull();
  });

  it("removeMethod auto-switches default", () => {
    let config = addMethod(null, totpMethod);
    config = addMethod(config, emailMethod);
    expect(config.defaultMethod).toBe("totp");
    const updated = removeMethod(config, "totp")!;
    expect(updated.defaultMethod).toBe("email");
  });

  it("removeMethod preserves default when removing non-default", () => {
    let config = addMethod(null, totpMethod);
    config = addMethod(config, emailMethod);
    const updated = removeMethod(config, "email")!;
    expect(updated.defaultMethod).toBe("totp");
  });

  it("getMethodConfig returns correct config", () => {
    let config = addMethod(null, totpMethod);
    config = addMethod(config, emailMethod);
    const totp = getMethodConfig(config, "totp");
    expect(totp).toBeDefined();
    expect(totp!.type).toBe("totp");
    const email = getMethodConfig(config, "email");
    expect(email).toBeDefined();
    expect(email!.type).toBe("email");
    const passkey = getMethodConfig(config, "passkey");
    expect(passkey).toBeUndefined();
  });

  it("getEnabledMethods returns method types", () => {
    let config = addMethod(null, totpMethod);
    config = addMethod(config, passkeyMethod);
    expect(getEnabledMethods(config)).toEqual(["totp", "passkey"]);
  });
});
