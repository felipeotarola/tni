import { afterEach, describe, expect, it, vi } from "vitest";

function makeRequest(body: unknown, query = ""): Request {
  return new Request(`http://localhost/api/batch-lookup${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/batch-lookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 when numbers is missing", async () => {
    const { POST } = await import("@/app/api/batch-lookup/route");
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns 400 when numbers contains non-strings", async () => {
    const { POST } = await import("@/app/api/batch-lookup/route");
    const response = await POST(makeRequest({ numbers: ["0701234567", 123] }));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("must be a string");
  });

  it("returns partial success with explicit errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ number: "70-1234567", name: "Telia Sverige AB" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const { POST } = await import("@/app/api/batch-lookup/route");
    const response = await POST(makeRequest({ numbers: ["0701234567", "0312345678"] }));
    const payload = (await response.json()) as {
      results: unknown[];
      errors: Array<{ phone_number: string; error: string }>;
      summary: { requested: number; successful: number; failed: number };
    };

    expect(response.status).toBe(200);
    expect(payload.results).toHaveLength(1);
    expect(payload.errors).toHaveLength(1);
    expect(payload.errors[0].phone_number).toBe("0312345678");
    expect(payload.summary).toEqual({ requested: 2, successful: 1, failed: 1 });
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

    const { POST } = await import("@/app/api/batch-lookup/route");
    const response = await POST(makeRequest({ numbers: ["0701234567", "0312345678"] }, "?format=table"));
    const payload = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(payload).toContain("## Summary");
    expect(payload).toContain("| Number | Operator | Brand Guess |");
  });
});
