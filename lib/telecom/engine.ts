import { getDb } from "@/lib/db/client";
import { CACHE_TTL_MS, LEGAL_OPERATOR_KEYWORDS, NO_BINDING_BRANDS } from "@/lib/telecom/constants";
import type { BindingRisk, BindingStatus, LookupResult, OperatorLookupResult } from "@/lib/telecom/types";

type CacheEntry = {
  result: LookupResult;
  expiresAt: number;
};

type OperatorMappingRecord = {
  brands: string[];
  network: string;
};

const lookupCache = new Map<string, CacheEntry>();

export function normalizeSwedishMobile(raw: string): string {
  const compact = raw.replace(/[^\d+]/g, "");

  if (compact.startsWith("+")) {
    if (!compact.startsWith("+46")) {
      throw new Error("Only Swedish numbers are supported.");
    }

    const subscriber = compact.slice(3);
    if (!/^7\d{8}$/.test(subscriber)) {
      throw new Error("Invalid Swedish mobile number.");
    }
    return `+46${subscriber}`;
  }

  let digits = compact;
  if (digits.startsWith("0046")) {
    digits = `0${digits.slice(4)}`;
  } else if (digits.startsWith("46")) {
    digits = `0${digits.slice(2)}`;
  }

  if (!/^07\d{8}$/.test(digits)) {
    throw new Error("Invalid Swedish mobile number.");
  }

  return `+46${digits.slice(1)}`;
}

function canonicalOperatorKey(value: string): string {
  const lower = value.toLowerCase();
  const match = LEGAL_OPERATOR_KEYWORDS.find((entry) =>
    entry.words.some((word) => lower.includes(word)),
  );
  return match?.key ?? "unknown";
}

function getOperatorMapping(operator: string): OperatorMappingRecord {
  const db = getDb();
  const key = canonicalOperatorKey(operator);
  const row = db
    .prepare("SELECT brands_json, network FROM operator_mapping WHERE operator_name = ?")
    .get(key) as { brands_json: string; network: string } | undefined;

  if (!row) {
    return { brands: ["unknown"], network: "unknown" };
  }

  let brands: string[] = ["unknown"];
  try {
    const parsed = JSON.parse(row.brands_json) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      brands = parsed;
    }
  } catch {
    brands = ["unknown"];
  }

  return {
    brands,
    network: row.network ?? "unknown",
  };
}

function pickBrandGuess(operator: string): { brand: string; confidence: number } {
  const mapping = getOperatorMapping(operator);
  const brands = mapping.brands;

  if (brands.length === 1) {
    return { brand: brands[0], confidence: brands[0] === "unknown" ? 0.3 : 0.8 };
  }

  return { brand: brands[0], confidence: 0.6 };
}

function detectNetwork(operator: string, brandGuess: string): string {
  const brandMapping = getOperatorMapping(brandGuess);
  if (brandMapping.network !== "unknown") {
    return brandMapping.network;
  }

  const operatorMapping = getOperatorMapping(operator);
  return operatorMapping.network;
}

function getRangeOwner(e164: string): string | null {
  // +46701234567 -> 0701
  const local = `0${e164.slice(3)}`;
  const prefix = local.slice(0, 4);
  const db = getDb();
  const row = db
    .prepare("SELECT original_operator FROM number_ranges WHERE prefix = ?")
    .get(prefix) as { original_operator: string } | undefined;
  return row?.original_operator ?? null;
}

function detectPorting(e164: string, currentOperator: string): boolean {
  const rangeOwner = getRangeOwner(e164);
  if (!rangeOwner) {
    return false;
  }

  const currentKey = canonicalOperatorKey(currentOperator);
  const rangeKey = canonicalOperatorKey(rangeOwner);
  return currentKey !== "unknown" && rangeKey !== "unknown" && currentKey !== rangeKey;
}

function runBindingRisk(args: {
  operator: string;
  brandGuess: string;
  isPorted: boolean;
}): { status: BindingStatus; risk: BindingRisk; confidence: number } {
  const { operator, brandGuess, isPorted } = args;
  const operatorKey = canonicalOperatorKey(operator);
  const brandKey = brandGuess.toLowerCase();

  if (operatorKey === "unknown") {
    return { status: "unknown", risk: "unknown", confidence: 0.3 };
  }

  if (NO_BINDING_BRANDS.has(brandKey)) {
    return { status: "no_binding", risk: "low", confidence: 0.7 };
  }

  if (isPorted) {
    return { status: "possible_binding", risk: "high", confidence: 0.65 };
  }

  return { status: "possible_binding", risk: "medium", confidence: 0.6 };
}

function readCached(e164: string): LookupResult | null {
  const cached = lookupCache.get(e164);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    lookupCache.delete(e164);
    return null;
  }

  return cached.result;
}

function writeCache(result: LookupResult): void {
  lookupCache.set(result.number, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function parseOperatorFromUnknownJson(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const asRecord = data as Record<string, unknown>;
  const candidates = [
    asRecord.name,
    asRecord.operator,
    asRecord.operator_name,
    asRecord.provider,
    asRecord.current_operator,
    asRecord.sp_name,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function toPtsNdcAndNumber(e164: string): { ndc: string; number: string } {
  const local = `0${e164.slice(3)}`; // +46701234567 -> 0701234567
  const ndc = local.slice(1, 3); // 70
  const number = local.slice(3); // 1234567
  return { ndc, number };
}

async function lookupOperatorViaPts(e164: string): Promise<OperatorLookupResult | null> {
  const baseUrl = process.env.PTS_BASE_URL ?? "https://data.pts.se";
  const { ndc, number } = toPtsNdcAndNumber(e164);
  const url = new URL(`/v1/operator/${ndc}/${number}`, baseUrl);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PTS lookup failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  const operator = parseOperatorFromUnknownJson(payload);
  if (!operator) {
    return null;
  }

  return {
    operator,
    source: "PTS",
    confidence: 1,
  };
}

function lookupOperatorViaRangeFallback(e164: string): OperatorLookupResult {
  const operator = getRangeOwner(e164) ?? "unknown";
  return {
    operator,
    source: "range_fallback",
    confidence: operator === "unknown" ? 0.2 : 0.7,
  };
}

async function resolveOperator(e164: string): Promise<OperatorLookupResult> {
  try {
    const ptsResult = await lookupOperatorViaPts(e164);
    if (ptsResult) {
      return ptsResult;
    }
  } catch {
    // Fall back to range owner mapping when PTS is unavailable.
  }

  return lookupOperatorViaRangeFallback(e164);
}

function persistLookup(result: LookupResult): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO lookups (
      phone_number, operator, brand_guess, network, is_ported, binding_status, binding_risk,
      operator_confidence, brand_confidence, binding_confidence, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    result.number,
    result.operator,
    result.brand_guess,
    result.network,
    result.metadata.is_ported ? 1 : 0,
    result.binding.status,
    result.binding.risk,
    result.confidence.operator,
    result.confidence.brand,
    result.confidence.binding,
    result.metadata.sources.join(","),
  );
}

export async function lookupPhoneNumber(raw: string): Promise<LookupResult> {
  const number = normalizeSwedishMobile(raw);
  const cached = readCached(number);
  if (cached) {
    return cached;
  }

  const operatorResult = await resolveOperator(number);
  const brand = pickBrandGuess(operatorResult.operator);
  const network = detectNetwork(operatorResult.operator, brand.brand);
  const isPorted = detectPorting(number, operatorResult.operator);
  const binding = runBindingRisk({
    operator: operatorResult.operator,
    brandGuess: brand.brand,
    isPorted,
  });

  const result: LookupResult = {
    number,
    operator: operatorResult.operator,
    brand_guess: brand.brand,
    network,
    binding,
    metadata: {
      is_ported: isPorted,
      sources: [operatorResult.source === "PTS" ? "PTS_OPEN_DATA" : "NUMBER_RANGE_FALLBACK"],
      last_checked: new Date().toISOString(),
    },
    confidence: {
      operator: operatorResult.confidence,
      brand: brand.confidence,
      binding: binding.confidence,
    },
  };

  writeCache(result);
  persistLookup(result);
  return result;
}

export function getLookupCacheSize(): number {
  return lookupCache.size;
}
