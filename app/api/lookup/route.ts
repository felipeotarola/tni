import { formatLookupAsMarkdownTable, resolveOutputFormat } from "@/lib/telecom/response-format";
import { lookupPhoneNumber } from "@/lib/telecom/engine";

type LookupBody = {
  phone_number?: unknown;
  format?: unknown;
  force_refresh?: unknown;
  verification?: {
    tre_recaptcha_token?: unknown;
  };
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  let body: LookupBody;
  try {
    body = (await request.json()) as LookupBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.phone_number !== "string" || body.phone_number.trim().length === 0) {
    return Response.json({ error: "`phone_number` must be a non-empty string." }, { status: 400 });
  }

  try {
    const result = await lookupPhoneNumber(body.phone_number, {
      forceRefresh: body.force_refresh === true,
      treRecaptchaToken:
        typeof body.verification?.tre_recaptcha_token === "string"
          ? body.verification.tre_recaptcha_token
          : undefined,
    });
    const outputFormat = resolveOutputFormat({
      queryFormat: url.searchParams.get("format"),
      bodyFormat: body.format,
    });

    if (outputFormat === "table") {
      return new Response(formatLookupAsMarkdownTable(result), {
        status: 200,
        headers: { "content-type": "text/markdown; charset=utf-8" },
      });
    }

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed.";
    const status = message.toLowerCase().includes("invalid swedish mobile number") ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}
