import { formatBatchAsMarkdownTable, resolveOutputFormat } from "@/lib/telecom/response-format";
import { lookupPhoneNumber } from "@/lib/telecom/engine";

type BatchBody = {
  numbers?: unknown;
  format?: unknown;
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  let body: BatchBody;
  try {
    body = (await request.json()) as BatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.numbers) || body.numbers.length === 0) {
    return Response.json({ error: "`numbers` must be a non-empty array." }, { status: 400 });
  }

  const numbers = body.numbers.filter((value): value is string => typeof value === "string");
  if (numbers.length !== body.numbers.length) {
    return Response.json({ error: "Every value in `numbers` must be a string." }, { status: 400 });
  }

  if (numbers.length > 250) {
    return Response.json({ error: "Maximum 250 numbers per batch." }, { status: 400 });
  }

  const settled = await Promise.allSettled(numbers.map((number) => lookupPhoneNumber(number)));

  const results = settled
    .filter((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof lookupPhoneNumber>>> => item.status === "fulfilled")
    .map((item) => item.value);

  const errors = settled
    .map((item, index) => ({ item, index }))
    .filter(
      (entry): entry is { item: PromiseRejectedResult; index: number } => entry.item.status === "rejected",
    )
    .map((entry) => ({
      phone_number: numbers[entry.index],
      error: entry.item.reason instanceof Error ? entry.item.reason.message : "Lookup failed.",
    }));

  const responsePayload = {
    results,
    errors,
    summary: {
      requested: numbers.length,
      successful: results.length,
      failed: errors.length,
    },
  };

  const outputFormat = resolveOutputFormat({
    queryFormat: url.searchParams.get("format"),
    bodyFormat: body.format,
  });
  if (outputFormat === "table") {
    return new Response(formatBatchAsMarkdownTable(responsePayload), {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json(responsePayload);
}
