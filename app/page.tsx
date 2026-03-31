"use client";

import { useMemo, useState } from "react";

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
        setSingleError("error" in data ? data.error : "Lookup failed");
        return;
      }

      setSingleResult(data as SingleLookupResponse);
    } catch {
      setSingleResult(null);
      setSingleError("Network error");
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
        setBatchError("error" in data ? data.error : "Batch lookup failed");
        return;
      }

      setBatchResult(data as BatchLookupResponse);
    } catch {
      setBatchResult(null);
      setBatchError("Network error");
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-cyan-50 via-white to-emerald-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Telecom Number Intelligence</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">API Test Console</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Testa single och batch lookup mot era endpoints i samma miljö.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Single Lookup</h2>
            <p className="mt-1 text-sm text-zinc-600">Skickar `POST /api/lookup` med ett nummer.</p>

            <label className="mt-4 block text-sm font-medium">Phone number</label>
            <input
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-cyan-200 transition focus:ring-2"
              value={singleNumber}
              onChange={(event) => setSingleNumber(event.target.value)}
              placeholder="0701234567"
            />

            <button
              className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={runSingleLookup}
              disabled={singleLoading}
            >
              {singleLoading ? "Running..." : "Run Single Lookup"}
            </button>

            {singleError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{singleError}</p>
            ) : null}

            {singleResult ? (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 rounded-md bg-zinc-50 p-3">
                  <span className="text-zinc-500">Operator</span>
                  <span className="font-medium">{singleResult.operator}</span>
                  <span className="text-zinc-500">Brand guess</span>
                  <span className="font-medium">{singleResult.brand_guess}</span>
                  <span className="text-zinc-500">Network</span>
                  <span className="font-medium">{singleResult.network}</span>
                  <span className="text-zinc-500">Binding risk</span>
                  <span className="font-medium">{singleResult.binding.risk}</span>
                </div>
                <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-950 p-3 text-xs text-zinc-100">
                  {JSON.stringify(singleResult, null, 2)}
                </pre>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Batch Lookup</h2>
            <p className="mt-1 text-sm text-zinc-600">Skickar `POST /api/batch-lookup` med flera nummer.</p>

            <label className="mt-4 block text-sm font-medium">Numbers (newline or comma separated)</label>
            <textarea
              className="mt-2 min-h-32 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none ring-emerald-200 transition focus:ring-2"
              value={batchInput}
              onChange={(event) => setBatchInput(event.target.value)}
            />
            <p className="mt-2 text-xs text-zinc-500">{batchNumbers.length} parsed numbers</p>

            <button
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={runBatchLookup}
              disabled={batchLoading}
            >
              {batchLoading ? "Running..." : "Run Batch Lookup"}
            </button>

            {batchError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{batchError}</p>
            ) : null}

            {batchResult ? (
              <div className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2 rounded-md bg-zinc-50 p-3">
                  <span className="text-zinc-500">Requested</span>
                  <span className="text-zinc-500">Successful</span>
                  <span className="text-zinc-500">Failed</span>
                  <span className="font-semibold">{batchResult.summary.requested}</span>
                  <span className="font-semibold text-emerald-700">{batchResult.summary.successful}</span>
                  <span className="font-semibold text-red-700">{batchResult.summary.failed}</span>
                </div>
                <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-950 p-3 text-xs text-zinc-100">
                  {JSON.stringify(batchResult, null, 2)}
                </pre>
              </div>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}
