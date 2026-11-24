import { describe, expect, it, vi } from "vitest";
import { confirmRecoveryCode } from "@/lib/password-reset";

describe("password recovery code", () => {
  it("verifies the email code as a recovery code", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    await confirmRecoveryCode({ verifyOtp }, "citizen@example.test", "482931");
    expect(verifyOtp).toHaveBeenCalledWith({ email: "citizen@example.test", token: "482931", type: "recovery" });
  });
});