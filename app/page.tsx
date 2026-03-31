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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_12%,white),white_60%)] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Card className="border-primary/25 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Telecom Number Intelligence</Badge>
              <Badge variant="outline">MVP Console</Badge>
            </div>
            <CardTitle className="text-3xl tracking-tight">API-testkonsol</CardTitle>
            <CardDescription>
              Testa enstaka och batch-flöden mot <code>/api/lookup</code> och <code>/api/batch-lookup</code>.
            </CardDescription>
          </CardHeader>
        </Card>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
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

          <Card className="shadow-sm">
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
    </main>
  );
}
