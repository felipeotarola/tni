"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Layers,
  Loader2,
  Phone,
  Search,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

const TRE_RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_TRE_RECAPTCHA_SITE_KEY?.trim() ?? "";
const TRE_RECAPTCHA_ACTION =
  process.env.NEXT_PUBLIC_TRE_RECAPTCHA_ACTION ?? "numberTransferField";

function loadTreRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!TRE_RECAPTCHA_SITE_KEY) {
    return Promise.resolve();
  }
  if (window.grecaptcha?.enterprise) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>("script[data-tre-recaptcha='1']");
  if (existing) {
    return new Promise((resolve) => {
      if (window.grecaptcha?.enterprise) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(
      TRE_RECAPTCHA_SITE_KEY,
    )}`;
    script.async = true;
    script.defer = true;
    script.dataset.treRecaptcha = "1";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

async function getTreRecaptchaTokenFromBrowser(): Promise<string | null> {
  try {
    if (!TRE_RECAPTCHA_SITE_KEY) {
      return null;
    }

    await loadTreRecaptchaScript();

    const enterprise = window.grecaptcha?.enterprise;
    if (!enterprise) {
      return null;
    }

    return await new Promise<string | null>((resolve) => {
      enterprise.ready(async () => {
        try {
          const token = await enterprise.execute(TRE_RECAPTCHA_SITE_KEY, {
            action: TRE_RECAPTCHA_ACTION,
          });
          resolve(token && token.length > 0 ? token : null);
        } catch {
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
}

type SingleLookupResponse = {
  number: string;
  number_type: "mobile";
  range_category: string;
  operator: string;
  brand_guess: string;
  brand_confidence: number;
  network: string;
  reasons: string[];
  verification: {
    enabled: boolean;
    signals: Array<{
      provider: string;
      signal: string;
      brand: string;
      confidence: number;
      reason: string;
    }>;
  };
  binding: {
    status: string;
    risk: string;
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

type BatchLookupResponse = {
  results: SingleLookupResponse[];
  errors: Array<{ phone_number: string; error: string }>;
  summary: {
    requested: number;
    successful: number;
    failed: number;
  };
};

function riskColor(risk: string) {
  switch (risk) {
    case "low":
      return "text-emerald-600 bg-emerald-500/10";
    case "medium":
      return "text-amber-600 bg-amber-500/10";
    case "high":
      return "text-red-600 bg-red-500/10";
    default:
      return "text-muted-foreground bg-muted";
  }
}

function getPossibleBrandsText(result: SingleLookupResponse): string {
  const candidate = result.reasons.find((reason) =>
    reason.toLowerCase().startsWith("multiple possible brands:"),
  );
  if (!candidate) {
    return result.brand_guess;
  }

  const value = candidate.split(":")[1]?.trim();
  return value && value.length > 0 ? value : result.brand_guess;
}

export default function Home() {
  const [singleNumber, setSingleNumber] = useState("0701234567");
  const [batchInput, setBatchInput] = useState(
    "0701234567\n0731234567\n0311234567",
  );
  const [singleLoading, setSingleLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [singleResult, setSingleResult] =
    useState<SingleLookupResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchLookupResponse | null>(
    null,
  );
  const [singleError, setSingleError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const batchNumbers = useMemo(
    () =>
      batchInput
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [batchInput],
  );

  async function runSingleLookup() {
    setSingleLoading(true);
    setSingleError(null);

    try {
      const treRecaptchaToken = await getTreRecaptchaTokenFromBrowser();
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone_number: singleNumber,
          force_refresh: true,
          verification: treRecaptchaToken
            ? { tre_recaptcha_token: treRecaptchaToken }
            : undefined,
        }),
      });

      const data = (await response.json()) as
        | SingleLookupResponse
        | { error: string };
      if (!response.ok) {
        setSingleResult(null);
        setSingleError(
          "error" in data ? data.error : "Uppslag misslyckades",
        );
        return;
      }

      setSingleResult(data as SingleLookupResponse);
    } catch {
      setSingleResult(null);
      setSingleError("Nätverksfel");
    } finally {
      setSingleLoading(false);
    }
  }

  async function runBatchLookup() {
    setBatchLoading(true);
    setBatchError(null);

    try {
      const response = await fetch("/api/batch-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numbers: batchNumbers }),
      });

      const data = (await response.json()) as
        | BatchLookupResponse
        | { error: string };
      if (!response.ok) {
        setBatchResult(null);
        setBatchError(
          "error" in data ? data.error : "Batch-uppslag misslyckades",
        );
        return;
      }

      setBatchResult(data as BatchLookupResponse);
    } catch {
      setBatchResult(null);
      setBatchError("Nätverksfel");
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Lead Intelligence
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Testa lookup API och se säljsignaler direkt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
            <Activity className="size-3" />
            /api/lookup
          </Badge>
          <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
            <Activity className="size-3" />
            /api/batch-lookup
          </Badge>
        </div>
      </div>

      <Separator />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 p-6 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              Senaste operatör
            </CardDescription>
            <CardTitle className="text-lg tabular-nums">
              {singleResult?.operator ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Hash className="size-3.5" />
              Brandgissning
            </CardDescription>
            <CardTitle className="text-lg tabular-nums">
              {singleResult?.brand_guess ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Batch lyckade
            </CardDescription>
            <CardTitle className="text-lg tabular-nums">
              {batchResult?.summary.successful ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <XCircle className="size-3.5 text-destructive" />
              Batch fel
            </CardDescription>
            <CardTitle className="text-lg tabular-nums">
              {batchResult?.summary.failed ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main content with tabs */}
      <div className="flex-1 px-6 pb-6">
        <Tabs defaultValue="single">
          <TabsList>
            <TabsTrigger value="single" className="gap-1.5">
              <Search className="size-3.5" />
              Enstaka uppslag
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-1.5">
              <Layers className="size-3.5" />
              Batch-uppslag
            </TabsTrigger>
          </TabsList>

          {/* Single lookup tab */}
          <TabsContent value="single">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Enstaka uppslag</CardTitle>
                  <CardDescription>
                    Skicka ett telefonnummer till lookup-endpointen och se
                    resultatet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefonnummer</Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        id="phone"
                        value={singleNumber}
                        onChange={(event) =>
                          setSingleNumber(event.target.value)
                        }
                        placeholder="0701234567"
                        className="font-mono"
                      />
                      <Button
                        onClick={runSingleLookup}
                        disabled={singleLoading}
                        className="shrink-0"
                      >
                        {singleLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                        Sök
                      </Button>
                    </div>
                  </div>

                  {singleError ? (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      <AlertTriangle className="size-4 shrink-0" />
                      {singleError}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {singleResult ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Resultat
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {singleResult.number}
                      </Badge>
                    </CardTitle>
                    <CardAction>
                      <Badge className={riskColor(singleResult.binding.risk)}>
                        {singleResult.binding.risk} risk
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Operatör
                        </p>
                        <p className="font-medium">
                          {singleResult.operator}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Brandgissning
                        </p>
                        <p className="font-medium">
                          {singleResult.brand_guess}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nät</p>
                        <p className="font-medium">
                          {singleResult.network}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Bindningsstatus
                        </p>
                        <p className="font-medium">
                          {singleResult.binding.status}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Porterat
                        </p>
                        <p className="font-medium">
                          {singleResult.metadata.is_ported ? "Ja" : "Nej"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Konfidens (operatör)
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${singleResult.confidence.operator * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {Math.round(
                              singleResult.confidence.operator * 100,
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Tabellvy
                    </p>
                    <div className="w-full overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fält</TableHead>
                            <TableHead>Värde</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>Nummer</TableCell>
                            <TableCell className="font-mono">{singleResult.number}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Number type</TableCell>
                            <TableCell>{singleResult.number_type}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Range category</TableCell>
                            <TableCell>{singleResult.range_category}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Operatör</TableCell>
                            <TableCell>{singleResult.operator}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Brand</TableCell>
                            <TableCell>{singleResult.brand_guess}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Möjliga brands</TableCell>
                            <TableCell>{getPossibleBrandsText(singleResult)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Brand confidence</TableCell>
                            <TableCell>{singleResult.brand_confidence}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Nät</TableCell>
                            <TableCell>{singleResult.network}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Verification enabled</TableCell>
                            <TableCell>{String(singleResult.verification.enabled)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Verification signals</TableCell>
                            <TableCell className="whitespace-pre-wrap">
                              {singleResult.verification.signals.length > 0
                                ? singleResult.verification.signals
                                    .map(
                                      (signal) =>
                                        `${signal.provider} | ${signal.signal} | ${signal.brand} | ${signal.confidence} | ${signal.reason}`,
                                    )
                                    .join("\n")
                                : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Binding status</TableCell>
                            <TableCell>{singleResult.binding.status}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Bindningsrisk</TableCell>
                            <TableCell>{singleResult.binding.risk}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Binding confidence</TableCell>
                            <TableCell>{singleResult.binding.confidence}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Porterad</TableCell>
                            <TableCell>{singleResult.metadata.is_ported ? "Ja" : "Nej"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Metadata sources</TableCell>
                            <TableCell>{singleResult.metadata.sources.join(", ") || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Metadata last_checked</TableCell>
                            <TableCell className="font-mono">{singleResult.metadata.last_checked}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Confidence operator</TableCell>
                            <TableCell>{singleResult.confidence.operator}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Confidence brand</TableCell>
                            <TableCell>{singleResult.confidence.brand}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Confidence binding</TableCell>
                            <TableCell>{singleResult.confidence.binding}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Rå JSON-respons
                    </p>
                    <pre className="max-h-56 w-full overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                      {JSON.stringify(singleResult, null, 2)}
                    </pre>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="flex items-center justify-center border-dashed">
                  <div className="py-12 text-center text-muted-foreground">
                    <Search className="mx-auto mb-3 size-10 opacity-30" />
                    <p className="text-sm">
                      Kör ett uppslag för att se resultat här.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Batch lookup tab */}
          <TabsContent value="batch">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Batch-uppslag</CardTitle>
                  <CardDescription>
                    Skicka rad- eller kommaseparerade nummer i batch.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="batchNumbers">Nummer</Label>
                    <Textarea
                      id="batchNumbers"
                      className="min-h-40 font-mono text-sm"
                      value={batchInput}
                      onChange={(event) => setBatchInput(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {batchNumbers.length} tolkade nummer
                    </p>
                  </div>

                  <Button onClick={runBatchLookup} disabled={batchLoading}>
                    {batchLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Layers className="size-4" />
                    )}
                    {batchLoading ? "Kör batch..." : "Kör batch-uppslag"}
                  </Button>

                  {batchError ? (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                      <AlertTriangle className="size-4 shrink-0" />
                      {batchError}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {batchResult ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Batch-resultat</CardTitle>
                    <CardDescription>
                      {batchResult.summary.requested} nummer skickade
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                        <p className="text-xs text-muted-foreground">
                          Skickade
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                          {batchResult.summary.requested}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-center">
                        <p className="text-xs text-emerald-600">Lyckade</p>
                        <p className="text-lg font-semibold tabular-nums text-emerald-700">
                          {batchResult.summary.successful}
                        </p>
                      </div>
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-center">
                        <p className="text-xs text-destructive">Misslyckade</p>
                        <p className="text-lg font-semibold tabular-nums text-destructive">
                          {batchResult.summary.failed}
                        </p>
                      </div>
                    </div>

                    {batchResult.results.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Individuella resultat
                        </p>
                        <div className="overflow-hidden rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nummer</TableHead>
                                <TableHead>Operatör</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Nät</TableHead>
                                <TableHead>Risk</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batchResult.results.map((r) => (
                                <TableRow key={r.number}>
                                  <TableCell className="font-mono">{r.number}</TableCell>
                                  <TableCell>{r.operator}</TableCell>
                                  <TableCell>{r.brand_guess}</TableCell>
                                  <TableCell>{r.network}</TableCell>
                                  <TableCell>
                                    <Badge className={riskColor(r.binding.risk)} variant="secondary">
                                      {r.binding.risk}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Rå JSON-respons
                    </p>
                    <pre className="max-h-56 w-full overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-300">
                      {JSON.stringify(batchResult, null, 2)}
                    </pre>
                  </CardFooter>
                </Card>
              ) : (
                <Card className="flex items-center justify-center border-dashed">
                  <div className="py-12 text-center text-muted-foreground">
                    <Layers className="mx-auto mb-3 size-10 opacity-30" />
                    <p className="text-sm">
                      Kör ett batch-uppslag för att se resultat här.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
