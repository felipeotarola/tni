import { afterEach, describe, expect, it, vi } from "vitest";

import { runBrandVerifiers } from "@/lib/telecom/brand-verifiers";

describe("brand verifiers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BRAND_VERIFICATION_ENABLED;
    delete process.env.COMVIQ_VERIFIER_ENABLED;
    delete process.env.TRE_HALLON_VERIFIER_ENABLED;
    delete process.env.TRE_VERIFY_RECAPTCHA_TOKEN;
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

  it("returns Tre signal for hi3g when tre verifier endpoint succeeds", async () => {
    process.env.BRAND_VERIFICATION_ENABLED = "true";
    process.env.TRE_HALLON_VERIFIER_ENABLED = "true";
    process.env.TRE_VERIFY_RECAPTCHA_TOKEN = "dummy-token";

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));

    const result = await runBrandVerifiers({
      e164: "+46762560000",
      operatorKey: "hi3g",
    });

    expect(result.enabled).toBe(true);
    expect(result.signals[0].provider).toBe("tre_checkout_api");
    expect(result.signals[0].brand).toBe("Tre");
    expect(result.signals[0].signal).toBe("possibly_brand");
  });

  it("skips hi3g tre verifier when tre recaptcha token is missing", async () => {
    process.env.BRAND_VERIFICATION_ENABLED = "true";
    process.env.TRE_HALLON_VERIFIER_ENABLED = "true";

    const result = await runBrandVerifiers({
      e164: "+46762560000",
      operatorKey: "hi3g",
    });

    expect(result.enabled).toBe(false);
    expect(result.signals).toHaveLength(0);
  });
});
