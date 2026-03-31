import { afterEach, describe, expect, it, vi } from "vitest";

import { runBrandVerifiers } from "@/lib/telecom/brand-verifiers";

describe("brand verifiers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BRAND_VERIFICATION_ENABLED;
    delete process.env.COMVIQ_VERIFIER_ENABLED;
  });

  it("returns no signals when verification is disabled", async () => {
    process.env.BRAND_VERIFICATION_ENABLED = "false";
    const result = await runBrandVerifiers({
      e164: "+46701234567",
      operatorKey: "tele2",
    });

    expect(result.enabled).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it("returns not_brand when comviq endpoint reports INVALID_BRAND", async () => {
    process.env.BRAND_VERIFICATION_ENABLED = "true";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              data: { problem: { errorCode: "RFIL0012", violation: "INVALID_BRAND" } },
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await runBrandVerifiers({
      e164: "+46701234567",
      operatorKey: "tele2",
    });

    expect(result.enabled).toBe(true);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].signal).toBe("not_brand");
    expect(result.signals[0].brand).toBe("Comviq");
  });

  it("returns possibly_brand when comviq endpoint returns success", async () => {
    process.env.BRAND_VERIFICATION_ENABLED = "true";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ result: {} }), { status: 200 })),
    );

    const result = await runBrandVerifiers({
      e164: "+46701234567",
      operatorKey: "tele2",
    });

    expect(result.signals[0].signal).toBe("possibly_brand");
    expect(result.signals[0].confidence).toBeGreaterThan(0.8);
  });
});

