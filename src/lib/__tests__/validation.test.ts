import { describe, it, expect } from "vitest";
import { validateEmail, validateHandle, sanitizeForLog } from "../validation";

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("user+tag@sub.domain.com")).toBe(true);
    expect(validateEmail("a@b.co")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(validateEmail("")).toBe(false);
    expect(validateEmail("no-at-sign")).toBe(false);
    expect(validateEmail("@no-local.com")).toBe(false);
    expect(validateEmail("no-domain@")).toBe(false);
    expect(validateEmail("has spaces@example.com")).toBe(false);
  });
});

describe("validateHandle", () => {
  it("accepts valid ATProto handles", () => {
    expect(validateHandle("alice.bsky.social")).toBe(true);
    expect(validateHandle("user.example.com")).toBe(true);
    expect(validateHandle("my-handle.pds.certs.network")).toBe(true);
  });

  it("rejects invalid handles", () => {
    expect(validateHandle("")).toBe(false);
    expect(validateHandle("single")).toBe(false);
    expect(validateHandle(".leading-dot.com")).toBe(false);
    expect(validateHandle("trailing-dot.")).toBe(false);
    expect(validateHandle("has spaces.com")).toBe(false);
    expect(validateHandle("-starts-with-dash.com")).toBe(false);
  });
});

describe("sanitizeForLog", () => {
  it("redacts DIDs", () => {
    const result = sanitizeForLog("did:plc:abcdefghijklmnop");
    expect(result).toBe("did:plc:abcdefgh...");
    expect(result).not.toContain("abcdefghijklmnop");
  });

  it("redacts emails", () => {
    const result = sanitizeForLog("alice@example.com");
    expect(result).toBe("a***@example.com");
  });

  it("truncates long strings", () => {
    const result = sanitizeForLog("a-very-long-string-that-needs-truncation");
    expect(result.length).toBeLessThan(
      "a-very-long-string-that-needs-truncation".length,
    );
    expect(result).toContain("...");
  });

  it("returns short strings unchanged", () => {
    expect(sanitizeForLog("short")).toBe("short");
  });

  it("handles empty strings", () => {
    expect(sanitizeForLog("")).toBe("");
  });
});
