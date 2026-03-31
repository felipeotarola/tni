"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SingleLookupResponse = {
  number: string;
  operator: string;
  brand_guess: string;
  network: string;
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

export default function Home() {
  const [singleNumber, setSingleNumber] = useState("0701234567");
  const [batchInput, setBatchInput] = useState("0701234567\n0731234567\n0311234567");
  const [singleLoading, setSingleLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<SingleLookupResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchLookupResponse | null>(null);
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
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone_number: singleNumber }),
      });

      const data = (await response.json()) as SingleLookupResponse | { error: string };
      if (!response.ok) {
        setSingleResult(null);
        setSingleError("error" in data ? data.error : "Uppslag misslyckades");
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

      const data = (await response.json()) as BatchLookupResponse | { error: string };
      if (!response.ok) {
        setBatchResult(null);
        setBatchError("error" in data ? data.error : "Batch-uppslag misslyckades");
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold">Lead Intelligence</h2>
          <p className="text-sm text-muted-foreground">Testa lookup API och se säljsignaler direkt.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">/api/lookup</Badge>
          <Badge variant="outline">/api/batch-lookup</Badge>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Senaste operatör</CardDescription>
                  <CardTitle>{singleResult?.operator ?? "Ingen data"}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Brandgissning</CardDescription>
                  <CardTitle>{singleResult?.brand_guess ?? "-"}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Batch lyckade</CardDescription>
                  <CardTitle>{batchResult?.summary.successful ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Batch fel</CardDescription>
                  <CardTitle>{batchResult?.summary.failed ?? 0}</CardTitle>
                </CardHeader>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Enstaka uppslag</CardTitle>
                  <CardDescription>Skicka ett nummer till lookup-endpointen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Telefonnummer</label>
                    <Input
                      value={singleNumber}
                      onChange={(event) => setSingleNumber(event.target.value)}
                      placeholder="0701234567"
                    />
                  </div>

                  <Button onClick={runSingleLookup} disabled={singleLoading} className="w-full sm:w-auto">
                    {singleLoading ? "Kör..." : "Kör enstaka uppslag"}
                  </Button>

                  {singleError ? (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {singleError}
                    </p>
                  ) : null}

                  {singleResult ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                        <span className="text-muted-foreground">Operatör</span>
                        <span className="font-medium">{singleResult.operator}</span>
                        <span className="text-muted-foreground">Brandgissning</span>
                        <span className="font-medium">{singleResult.brand_guess}</span>
                        <span className="text-muted-foreground">Nät</span>
                        <span className="font-medium">{singleResult.network}</span>
                        <span className="text-muted-foreground">Bindningsrisk</span>
                        <span className="font-medium">{singleResult.binding.risk}</span>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded-lg border bg-black p-3 text-xs text-white">
                        {JSON.stringify(singleResult, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Batch-uppslag</CardTitle>
                  <CardDescription>Skicka rad- eller kommaseparerade nummer i batch.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Nummer</label>
                    <Textarea
                      className="min-h-40"
                      value={batchInput}
                      onChange={(event) => setBatchInput(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{batchNumbers.length} tolkade nummer</p>
                  </div>

                  <Button onClick={runBatchLookup} disabled={batchLoading} className="w-full sm:w-auto">
                    {batchLoading ? "Kör..." : "Kör batch-uppslag"}
                  </Button>

                  {batchError ? (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {batchError}
                    </p>
                  ) : null}

                  {batchResult ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-center text-sm">
                        <div>
                          <p className="text-muted-foreground">Skickade</p>
                          <p className="font-semibold">{batchResult.summary.requested}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Lyckade</p>
                          <p className="font-semibold text-emerald-700">{batchResult.summary.successful}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Misslyckade</p>
                          <p className="font-semibold text-destructive">{batchResult.summary.failed}</p>
                        </div>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded-lg border bg-black p-3 text-xs text-white">
                        {JSON.stringify(batchResult, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
  );
}
