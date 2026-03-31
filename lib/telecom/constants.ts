export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const NO_BINDING_BRANDS = new Set([
  "comviq",
  "hallon",
  "vimla",
  "fello",
  "halebop",
  "chilimobil",
  "mybeat",
]);

export const LEGAL_OPERATOR_KEYWORDS: Array<{ key: string; words: string[] }> = [
  { key: "tele2", words: ["tele2", "comviq"] },
  { key: "telia", words: ["telia", "halebop", "fello"] },
  { key: "telenor", words: ["telenor", "vimla", "glocalnet"] },
  { key: "tre", words: ["hi3g", "3 sverige", "hallon", "tre"] },
  { key: "chilimobil", words: ["chilimobil"] },
  { key: "mybeat", words: ["mybeat"] },
];
