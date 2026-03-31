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

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });
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

async function verifyTreVsHallonBrand(e164: string): Promise<BrandVerificationSignal> {
  const localNumber = toLocalSwedishNumber(e164);
  const baseUrl = process.env.TRE_VERIFY_BASE_URL ?? "https://www.tre.se";
  const timeoutMs = Number(process.env.TRE_VERIFY_TIMEOUT_MS ?? "2200");
  const recaptchaToken = process.env.TRE_VERIFY_RECAPTCHA_TOKEN;
  const url = `${baseUrl}/api/checkout/prolongable?msisdn=${encodeURIComponent(localNumber)}&customerType=consumer&subscriptionType=VOICE&prolongType=SOFT_BUNDLE`;

  try {
    const token = String(recaptchaToken);
    const response = await fetchWithTimeout(url, timeoutMs, {
      headers: {
        "recaptcha-token": token,
        referer: `${baseUrl}/handla/varukorg/nummer`,
        "user-agent": "Mozilla/5.0",
      },
    });
    const text = await response.text();
    const lower = text.toLowerCase();

    // Tre checkout accepted/recognized the number as a Tre customer number.
    if (response.ok || lower.includes("redan kund") || lower.includes("already customer")) {
      return {
        provider: "tre_checkout_api",
        signal: "possibly_brand",
        brand: "Tre",
        confidence: 0.85,
        reason: "Tre checkout recognizes number as Tre-customer flow.",
      };
    }

    // Explicit "not Tre" copy is treated as Hallon signal for Hi3G-family disambiguation.
    if (lower.includes("tillh") && lower.includes("inte 3")) {
      return {
        provider: "tre_checkout_api",
        signal: "possibly_brand",
        brand: "Hallon",
        confidence: 0.85,
        reason: "Tre checkout indicates number does not belong to Tre.",
      };
    }

    return {
      provider: "tre_checkout_api",
      signal: "unknown",
      brand: "Tre",
      confidence: 0.3,
      reason: `Tre verifier returned status ${response.status}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verifier error";
    return {
      provider: "tre_checkout_api",
      signal: "unknown",
      brand: "Tre",
      confidence: 0.2,
      reason: `Tre verifier failed: ${message}`,
    };
  }
}
async function verifyTreVsHallonBrandWithToken(
  e164: string,
  recaptchaToken: string,
): Promise<BrandVerificationSignal> {
  const localNumber = toLocalSwedishNumber(e164);
  const baseUrl = process.env.TRE_VERIFY_BASE_URL ?? "https://www.tre.se";
  const timeoutMs = Number(process.env.TRE_VERIFY_TIMEOUT_MS ?? "2200");
  const url = `${baseUrl}/api/checkout/prolongable?msisdn=${encodeURIComponent(localNumber)}&customerType=consumer&subscriptionType=VOICE&prolongType=SOFT_BUNDLE`;

  try {
    const response = await fetchWithTimeout(url, timeoutMs, {
      headers: {
        "recaptcha-token": recaptchaToken,
        referer: `${baseUrl}/handla/varukorg/nummer`,
        "user-agent": "Mozilla/5.0",
      },
    });
    const text = await response.text();
    const lower = text.toLowerCase();

    if (response.ok || lower.includes("redan kund") || lower.includes("already customer")) {
      return {
        provider: "tre_checkout_api",
        signal: "possibly_brand",
        brand: "Tre",
        confidence: 0.85,
        reason: "Tre checkout recognizes number as Tre-customer flow.",
      };
    }

    if (lower.includes("tillh") && lower.includes("inte 3")) {
      return {
        provider: "tre_checkout_api",
        signal: "possibly_brand",
        brand: "Hallon",
        confidence: 0.85,
        reason: "Tre checkout indicates number does not belong to Tre.",
      };
    }

    if (lower.includes("recaptcha_verification_failed")) {
      return {
        provider: "tre_checkout_api",
        signal: "unknown",
        brand: "Tre",
        confidence: 0.2,
        reason: "Tre checkout rejected provided reCAPTCHA token.",
      };
    }

    return {
      provider: "tre_checkout_api",
      signal: "unknown",
      brand: "Tre",
      confidence: 0.3,
      reason: `Tre verifier returned status ${response.status}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verifier error";
    return {
      provider: "tre_checkout_api",
      signal: "unknown",
      brand: "Tre",
      confidence: 0.2,
      reason: `Tre verifier failed: ${message}`,
    };
  }
}

const treBrowserCache = new Map<string, { expiresAt: number; signal: BrandVerificationSignal }>();

function getTreBrowserCache(e164: string): BrandVerificationSignal | null {
  const hit = treBrowserCache.get(e164);
  if (!hit) {
    return null;
  }
  if (Date.now() > hit.expiresAt) {
    treBrowserCache.delete(e164);
    return null;
  }
  return hit.signal;
}

function setTreBrowserCache(e164: string, signal: BrandVerificationSignal): void {
  const ttlMs = Number(process.env.TRE_BROWSER_CACHE_TTL_MS ?? "900000");
  treBrowserCache.set(e164, {
    expiresAt: Date.now() + ttlMs,
    signal,
  });
}

async function verifyTreVsHallonBrandViaBrowser(e164: string): Promise<BrandVerificationSignal> {
  const cached = getTreBrowserCache(e164);
  if (cached) {
    return cached;
  }

  const localNumber = toLocalSwedishNumber(e164);
  const timeoutMs = Number(process.env.TRE_BROWSER_VERIFY_TIMEOUT_MS ?? "15000");
  const startUrl =
    process.env.TRE_BROWSER_START_URL ??
    "https://www.tre.se/handla/mobilabonnemang/abonnemang?pricePlanId=686ClG6WeplmuHC-QYIT6Q==";

  try {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(timeoutMs);
      let checkoutApiPayload = "";

      page.on("response", async (response) => {
        if (response.url().includes("/api/checkout/prolongable")) {
          try {
            checkoutApiPayload = await response.text();
          } catch {
            checkoutApiPayload = "";
          }
        }
      });

      await page.goto(startUrl, { waitUntil: "domcontentloaded" });

      // Accept only necessary cookies if banner is shown.
      const cookieBtn = page.locator('[data-testid="cookie-accept-required"]');
      if (await cookieBtn.count()) {
        await cookieBtn.first().click().catch(() => undefined);
      }

      // Move to checkout number step.
      const placeOrderBtn = page.locator('[data-testid="place-order-button"]');
      if (await placeOrderBtn.count()) {
        await placeOrderBtn.first().click();
      }

      await page.waitForSelector('[data-testid="input-port-in-number"]', { timeout: timeoutMs });
      await page.fill('[data-testid="input-port-in-number"]', localNumber);
      await page.click('[data-testid="checkout-submit-button"]');
      await page.waitForTimeout(1200);

      const text = (await page.locator("body").innerText()).toLowerCase();
      const apiText = checkoutApiPayload.toLowerCase();
      let signal: BrandVerificationSignal;

      if (
        text.includes("du är redan kund hos oss") ||
        text.includes("du ar redan kund hos oss") ||
        apiText.includes("redan kund") ||
        apiText.includes("already customer")
      ) {
        signal = {
          provider: "tre_checkout_browser",
          signal: "possibly_brand",
          brand: "Tre",
          confidence: 0.85,
          reason: "Tre checkout flow identified number as existing Tre customer.",
        };
      } else if (
        text.includes("tillhör inte 3") ||
        text.includes("tillhor inte 3") ||
        apiText.includes("tillhör inte 3") ||
        apiText.includes("tillhor inte 3")
      ) {
        signal = {
          provider: "tre_checkout_browser",
          signal: "possibly_brand",
          brand: "Hallon",
          confidence: 0.8,
          reason: "Tre checkout flow indicates number does not belong to Tre.",
        };
      } else if (apiText.includes("recaptcha_verification_failed")) {
        signal = {
          provider: "tre_checkout_browser",
          signal: "unknown",
          brand: "Tre",
          confidence: 0.2,
          reason: "Tre checkout rejected automatic verification due to reCAPTCHA gate.",
        };
      } else {
        signal = {
          provider: "tre_checkout_browser",
          signal: "unknown",
          brand: "Tre",
          confidence: 0.3,
          reason: "Tre browser verifier could not classify Tre vs Hallon.",
        };
      }

      setTreBrowserCache(e164, signal);
      return signal;
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verifier error";
    return {
      provider: "tre_checkout_browser",
      signal: "unknown",
      brand: "Tre",
      confidence: 0.2,
      reason: `Tre browser verifier failed: ${message}`,
    };
  }
}

export async function runBrandVerifiers(args: {
  e164: string;
  operatorKey: string;
  treRecaptchaToken?: string;
}): Promise<{ enabled: boolean; signals: BrandVerificationSignal[] }> {
  const enabled = isEnabled(process.env.BRAND_VERIFICATION_ENABLED, true);
  if (!enabled) {
    return { enabled: false, signals: [] };
  }

  const signals: BrandVerificationSignal[] = [];
  const comviqVerifierEnabled = isEnabled(process.env.COMVIQ_VERIFIER_ENABLED, true);
  const treHallonVerifierEnabled = isEnabled(process.env.TRE_HALLON_VERIFIER_ENABLED, true);
  const treHallonBrowserVerifierEnabled = isEnabled(
    process.env.TRE_HALLON_BROWSER_VERIFIER_ENABLED,
    process.env.NODE_ENV !== "test",
  );
  const tokenFromRequest = args.treRecaptchaToken?.trim();
  const tokenFromEnv = process.env.TRE_VERIFY_RECAPTCHA_TOKEN?.trim();
  const treToken = tokenFromRequest && tokenFromRequest.length > 0 ? tokenFromRequest : tokenFromEnv;
  const hasTreToken = Boolean(treToken);
  const canRunComviq = comviqVerifierEnabled && (args.operatorKey === "tele2" || args.operatorKey === "unknown");
  const canRunTreHallon =
    treHallonVerifierEnabled &&
    hasTreToken &&
    (args.operatorKey === "tre" || args.operatorKey === "hi3g" || args.operatorKey === "unknown");
  const canRunTreHallonBrowser =
    treHallonBrowserVerifierEnabled &&
    (args.operatorKey === "tre" || args.operatorKey === "hi3g" || args.operatorKey === "unknown");

  if (!canRunComviq && !canRunTreHallon && !canRunTreHallonBrowser) {
    return { enabled: false, signals: [] };
  }

  // Tele2 ranges can be Tele2 or Comviq, so this verifier is useful there.
  if (canRunComviq) {
    signals.push(await verifyComviqBrand(args.e164));
  }
  if (canRunTreHallon) {
    signals.push(await verifyTreVsHallonBrandWithToken(args.e164, String(treToken)));
  } else if (canRunTreHallonBrowser) {
    signals.push(await verifyTreVsHallonBrandViaBrowser(args.e164));
  }

  return { enabled: true, signals };
}
