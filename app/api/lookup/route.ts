import { lookupPhoneNumber } from "@/lib/telecom/engine";

type LookupBody = {
  phone_number?: unknown;
};

export async function POST(request: Request) {
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
    const result = await lookupPhoneNumber(body.phone_number);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed.";
    const status = message.toLowerCase().includes("invalid swedish mobile number") ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}

