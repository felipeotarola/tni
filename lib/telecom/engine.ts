import { getDb } from "@/lib/db/client";
import { runBrandVerifiers } from "@/lib/telecom/brand-verifiers";
import { CACHE_TTL_MS, LEGAL_OPERATOR_KEYWORDS, NO_BINDING_BRANDS } from "@/lib/telecom/constants";
import type {
  BindingRisk,
  BindingStatus,
  BrandVerificationSignal,
  LookupResult,
  OperatorLookupResult,
} from "@/lib/telecom/types";

type CacheEntry = {
  result: LookupResult;
  expiresAt: number;
};

type OperatorMappingRecord = {
  brands: string[];
  network: string;
};

type BrandDecision = {
  brand: string;
  confidence: number;
  reasons: string[];
  verificationEnabled: boolean;
  verificationSignals: BrandVerificationSignal[];
};

const lookupCache = new Map<string, CacheEntry>();

function classifyNumber(e164: string): {
  numberType: "mobile";
  rangeCategory: "mobile_070" | "mobile_072" | "mobile_073" | "mobile_076" | "mobile_079" | "mobile_other";
} {
  const local = `0${e164.slice(3)}`; // +46701234567 -> 0701234567
  const prefix3 = local.slice(0, 3);

  switch (prefix3) {
    case "070":
      return { numberType: "mobile", rangeCategory: "mobile_070" };
    case "072":
      return { numberType: "mobile", rangeCategory: "mobile_072" };
    case "073":
      return { numberType: "mobile", rangeCategory: "mobile_073" };
    case "076":
      return { numberType: "mobile", rangeCategory: "mobile_076" };
    case "079":
      return { numberType: "mobile", rangeCategory: "mobile_079" };
    default:
      return { numberType: "mobile", rangeCategory: "mobile_other" };
  }
}

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
}): { status: BindingStatus; risk: BindingRisk; confidence: number; reason: string } {
  const { operator, brandGuess, isPorted } = args;
  const operatorKey = canonicalOperatorKey(operator);
  const brandKey = brandGuess.toLowerCase();

  if (operatorKey === "unknown") {
    return { status: "unknown", risk: "unknown", confidence: 0.3, reason: "Missing operator data." };
  }

  if (NO_BINDING_BRANDS.has(brandKey)) {
    return { status: "no_binding", risk: "low", confidence: 0.7, reason: "Known low-binding brand." };
  }

  if (isPorted) {
    return {
      status: "possible_binding",
      risk: "high",
      confidence: 0.65,
      reason: "Ported number increases uncertainty and lock-in risk.",
    };
  }

  return {
    status: "possible_binding",
    risk: "medium",
    confidence: 0.6,
    reason: "Default risk for major operator without stronger signals.",
  };
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

async function decideBrand(args: {
  number: string;
  operator: string;
  isPorted: boolean;
  treRecaptchaToken?: string;
}): Promise<BrandDecision> {
  const mapping = getOperatorMapping(args.operator);
  const operatorKey = canonicalOperatorKey(args.operator);
  const reasons: string[] = [];

  if (mapping.brands.length === 1) {
    reasons.push("Single known brand for this operator mapping.");
  } else {
    reasons.push(`Multiple possible brands: ${mapping.brands.join(", ")}.`);
  }

  let brand = mapping.brands[0] ?? "unknown";
  let confidence = mapping.brands.length > 1 ? 0.6 : mapping.brands[0] === "unknown" ? 0.3 : 0.8;

  if (args.isPorted) {
    confidence = Math.max(0.35, confidence - 0.1);
    reasons.push("Ported number can reduce brand certainty.");
  }

  const verification = await runBrandVerifiers({
    e164: args.number,
    operatorKey,
    treRecaptchaToken: args.treRecaptchaToken,
  });

  for (const signal of verification.signals) {
    reasons.push(`[${signal.provider}] ${signal.reason}`);

    const signalBrand = signal.brand.toLowerCase();
    const mappedSignalBrand = mapping.brands.find((entry) => entry.toLowerCase() === signalBrand);
    const alternatives = mapping.brands.filter((entry) => entry.toLowerCase() !== signalBrand);

    if (signal.signal === "possibly_brand" && mappedSignalBrand) {
      brand = mappedSignalBrand;
      confidence = Math.max(confidence, signal.confidence);
      continue;
    }

    if (signal.signal === "not_brand" && brand.toLowerCase() === signalBrand && alternatives.length > 0) {
      brand = alternatives[0];
      confidence = Math.max(confidence, 0.78);
    }
  }

  return {
    brand,
    confidence,
    reasons,
    verificationEnabled: verification.enabled,
    verificationSignals: verification.signals,
  };
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

export async function lookupPhoneNumber(
  raw: string,
  options?: { forceRefresh?: boolean; treRecaptchaToken?: string },
): Promise<LookupResult> {
  const number = normalizeSwedishMobile(raw);
  const classification = classifyNumber(number);
  const cached = options?.forceRefresh ? null : readCached(number);
  if (cached && !options?.forceRefresh) {
    return cached;
  }

  const operatorResult = await resolveOperator(number);
  const isPorted = detectPorting(number, operatorResult.operator);
  const brand = await decideBrand({
    number,
    operator: operatorResult.operator,
    isPorted,
    treRecaptchaToken: options?.treRecaptchaToken,
  });
  const network = detectNetwork(operatorResult.operator, brand.brand);
  const binding = runBindingRisk({
    operator: operatorResult.operator,
    brandGuess: brand.brand,
    isPorted,
  });

  const result: LookupResult = {
    number,
    number_type: classification.numberType,
    range_category: classification.rangeCategory,
    operator: operatorResult.operator,
    brand_guess: brand.brand,
    brand_confidence: brand.confidence,
    network,
    reasons: [...brand.reasons, `[binding] ${binding.reason}`],
    verification: {
      enabled: brand.verificationEnabled,
      signals: brand.verificationSignals,
    },
    binding: {
      status: binding.status,
      risk: binding.risk,
      confidence: binding.confidence,
    },
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
