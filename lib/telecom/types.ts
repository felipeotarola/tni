export type BindingRisk = "low" | "medium" | "high" | "unknown";

export type BindingStatus = "no_binding" | "possible_binding" | "unknown";

export type OperatorLookupResult = {
  operator: string;
  source: "PTS" | "range_fallback";
  confidence: number;
};

export type BrandVerificationSignal = {
  provider: string;
  signal: "possibly_brand" | "not_brand" | "unknown";
  brand: string;
  confidence: number;
  reason: string;
};

export type LookupResult = {
  number: string;
  number_type: "mobile";
  range_category: "mobile_070" | "mobile_072" | "mobile_073" | "mobile_076" | "mobile_079" | "mobile_other";
  operator: string;
  brand_guess: string;
  brand_confidence: number;
  network: string;
  reasons: string[];
  verification: {
    enabled: boolean;
    signals: BrandVerificationSignal[];
  };
  binding: {
    status: BindingStatus;
    risk: BindingRisk;
    confidence: number;
  };
  metadata: {
    is_ported: boolean;
    sources: string[];
    last_checked: string;
  };
  confidence: {
    operator: number;
    brand: number;
    binding: number;
  };
};
