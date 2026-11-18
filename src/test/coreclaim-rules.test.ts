import { describe, expect, it } from "vitest";
import { allowedSection, canWriteOff, parseCoreQr } from "@/lib/coreclaim";

describe("QR parsing", () => {
  it("accepts CORECLAIM:<code>", () => expect(parseCoreQr("CORECLAIM:4821")).toEqual({ kind: "code", value: "4821" }));
  it("accepts raw 5-digit code", () => expect(parseCoreQr("12345")).toEqual({ kind: "code", value: "12345" }));
  it("accepts a core UUID", () => expect(parseCoreQr("0F8FAD5B-D9CB-469F-A165-70867728950E")?.kind).toBe("id"));
  it("rejects junk", () => expect(parseCoreQr("hello")).toBeNull());
});

describe("write-off thresholds", () => {
  it("bookkeeper can write off $50.00", () => expect(canWriteOff("super_user", 50)).toBe(true));
  it("bookkeeper cannot write off $50.01", () => expect(canWriteOff("super_user", 50.01)).toBe(false));
  it("admin can write off any amount", () => expect(canWriteOff("admin", 5000)).toBe(true));
  it("counter staff cannot write off", () => expect(canWriteOff("shop_user", 1)).toBe(false));
});

describe("role lockdown", () => {
  it("mechanic only reaches the bay scanner", () => {
    expect(allowedSection("mechanic", "scan")).toBe(true);
    expect(allowedSection("mechanic", "dashboard")).toBe(false);
    expect(allowedSection("mechanic", "statements")).toBe(false);
  });
  it("statements are for bookkeepers and admins", () => {
    expect(allowedSection("shop_user", "statements")).toBe(false);
    expect(allowedSection("super_user", "statements")).toBe(true);
  });
  it("admin hub is admin-only", () => expect(allowedSection("super_user", "admin")).toBe(false));
});
