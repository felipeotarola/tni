import type { LookupResult } from "@/lib/telecom/types";

export type OutputFormat = "json" | "table";

export function resolveOutputFormat(args: {
  queryFormat: string | null;
  bodyFormat: unknown;
}): OutputFormat {
  const query = args.queryFormat?.toLowerCase();
  const body = typeof args.bodyFormat === "string" ? args.bodyFormat.toLowerCase() : null;

  if (query === "table" || body === "table") {
    return "table";
  }
  return "json";
}

export function formatLookupAsMarkdownTable(result: LookupResult): string {
  const rows: Array<[string, string]> = [
    ["number", result.number],
    ["operator", result.operator],
    ["brand_guess", result.brand_guess],
    ["brand_confidence", result.brand_confidence.toFixed(2)],
    ["network", result.network],
    ["binding.status", result.binding.status],
    ["binding.risk", result.binding.risk],
    ["binding.confidence", result.binding.confidence.toFixed(2)],
    ["metadata.is_ported", String(result.metadata.is_ported)],
    ["metadata.sources", result.metadata.sources.join(", ")],
    ["metadata.last_checked", result.metadata.last_checked],
    ["reasons", result.reasons.join(" | ")],
  ];

  const header = "| Field | Value |\n|---|---|";
  const body = rows.map(([field, value]) => `| ${field} | ${escapePipes(value)} |`).join("\n");
  return `${header}\n${body}\n`;
}

export function formatBatchAsMarkdownTable(args: {
  results: LookupResult[];
  errors: Array<{ phone_number: string; error: string }>;
  summary: { requested: number; successful: number; failed: number };
}): string {
  const summaryTable = [
    "| Requested | Successful | Failed |",
    "|---:|---:|---:|",
    `| ${args.summary.requested} | ${args.summary.successful} | ${args.summary.failed} |`,
  ].join("\n");

  const resultsHeader =
    "| Number | Operator | Brand Guess | Brand Confidence | Network | Ported | Binding Risk |\n|---|---|---|---:|---|---|---|";
  const resultsBody =
    args.results.length === 0
      ? "| - | - | - | - | - | - | - |"
      : args.results
          .map(
            (item) =>
              `| ${escapePipes(item.number)} | ${escapePipes(item.operator)} | ${escapePipes(item.brand_guess)} | ${item.brand_confidence.toFixed(2)} | ${escapePipes(item.network)} | ${item.metadata.is_ported} | ${item.binding.risk} |`,
          )
          .join("\n");

  const errorsHeader = "| Phone Number | Error |\n|---|---|";
  const errorsBody =
    args.errors.length === 0
      ? "| - | - |"
      : args.errors.map((item) => `| ${escapePipes(item.phone_number)} | ${escapePipes(item.error)} |`).join("\n");

  return [
    "## Summary",
    summaryTable,
    "",
    "## Results",
    resultsHeader,
    resultsBody,
    "",
    "## Errors",
    errorsHeader,
    errorsBody,
    "",
  ].join("\n");
}

function escapePipes(value: string): string {
  return value.replaceAll("|", "\\|");
}

