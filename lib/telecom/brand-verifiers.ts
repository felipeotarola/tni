import type { BrandVerificationSignal } from "@/lib/telecom/types";

function isEnabled(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

function toLocalSwedishNumber(e164: string): string {
  // +46701234567 -> 0701234567
  return `0${e164.slice(3)}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyComviqBrand(e164: string): Promise<BrandVerificationSignal> {
  const localNumber = toLocalSwedishNumber(e164);
  const payload = encodeURIComponent(JSON.stringify({ msisdn: localNumber }));
  const url = `https://api-online.comviq.se/purchase-api/trpc/refill.getRefillOptions?input=${payload}`;
  const timeoutMs = Number(process.env.COMVIQ_VERIFY_TIMEOUT_MS ?? "1800");

  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    const text = await response.text();

    if (response.ok) {
      return {
        provider: "comviq_refill_api",
        signal: "possibly_brand",
        brand: "Comviq",
        confidence: 0.85,
        reason: "Comviq refill endpoint accepted the number.",
      };
    }

    // RFIL0012 / INVALID_BRAND means the number cannot be topped up as Comviq.
    if (
      response.status === 400 &&
      (text.includes("RFIL0012") || text.includes("INVALID_BRAND") || text.includes("/problem/invalid-brand"))
    ) {
      return {
        provider: "comviq_refill_api",
        signal: "not_brand",
        brand: "Comviq",
        confidence: 0.9,
        reason: "Comviq refill endpoint rejected number with INVALID_BRAND (RFIL0012).",
      };
    }

    return {
      provider: "comviq_refill_api",
      signal: "unknown",
      brand: "Comviq",
      confidence: 0.3,
      reason: `Comviq verifier returned status ${response.status}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verifier error";
    return {
      provider: "comviq_refill_api",
      signal: "unknown",
      brand: "Comviq",
      confidence: 0.2,
      reason: `Comviq verifier failed: ${message}`,
    };
  }
}

export async function runBrandVerifiers(args: {
  e164: string;
  operatorKey: string;
}): Promise<{ enabled: boolean; signals: BrandVerificationSignal[] }> {
  const enabled = isEnabled(process.env.BRAND_VERIFICATION_ENABLED, false);
  if (!enabled) {
    return { enabled: false, signals: [] };
  }

  const signals: BrandVerificationSignal[] = [];
  const comviqVerifierEnabled = isEnabled(process.env.COMVIQ_VERIFIER_ENABLED, true);

  // Tele2 ranges can be Tele2 or Comviq, so this verifier is useful there.
  if (comviqVerifierEnabled && (operatorKey === "tele2" || operatorKey === "unknown")) {
    signals.push(await verifyComviqBrand(args.e164));
  }

  return { enabled: true, signals };
}

