export type BindingRisk = "low" | "medium" | "high" | "unknown";

export type BindingStatus = "no_binding" | "possible_binding" | "unknown";

export type OperatorLookupResult = {
  operator: string;
  source: "PTS" | "range_fallback";
  confidence: number;
};

export type LookupResult = {
  number: string;
  operator: string;
  brand_guess: string;
  network: string;
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

