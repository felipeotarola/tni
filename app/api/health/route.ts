import { getLookupCacheSize } from "@/lib/telecom/engine";

export function GET() {
  return Response.json({
    status: "ok",
    service: "telecom-number-intelligence",
    time: new Date().toISOString(),
    cache_entries: getLookupCacheSize(),
  });
}

