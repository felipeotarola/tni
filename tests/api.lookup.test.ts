import { afterEach, describe, expect, it, vi } from "vitest";

function makeRequest(body: unknown, query = ""): Request {
  return new Request(`http://localhost/api/lookup${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/lookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid number format", async () => {
    const { POST } = await import("@/app/api/lookup/route");
    const response = await POST(makeRequest({ phone_number: "0311234567" }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Invalid Swedish mobile number");
  });

  it("returns lookup payload for a valid number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ number: "70-1234567", name: "Telia Sverige AB" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const { POST } = await import("@/app/api/lookup/route");
    const response = await POST(makeRequest({ phone_number: "0701234567" }));
    const payload = (await response.json()) as {
      operator: string;
      metadata: { sources: string[] };
      confidence: { operator: number };
    };

    expect(response.status).toBe(200);
    expect(payload.operator).toBe("Telia Sverige AB");
    expect(payload.metadata.sources).toContain("PTS_OPEN_DATA");
    expect(payload.confidence.operator).toBe(1);
  });

  it("falls back to range mapping when PTS fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream failure", { status: 503 })));

    const { POST } = await import("@/app/api/lookup/route");
    const response = await POST(makeRequest({ phone_number: "0702234567" }));
    const payload = (await response.json()) as {
      operator: string;
      metadata: { sources: string[] };
    };

    expect(response.status).toBe(200);
    expect(payload.operator).toBe("Tele2 Sverige AB");
    expect(payload.metadata.sources).toContain("NUMBER_RANGE_FALLBACK");
  });

  it("returns markdown table when format=table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ number: "70-1234567", name: "Telia Sverige AB" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const { POST } = await import("@/app/api/lookup/route");
    const response = await POST(makeRequest({ phone_number: "0701234567" }, "?format=table"));
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(payload).toContain("| Field | Value |");
    expect(payload).toContain("| operator | Telia Sverige AB |");
  });
});
