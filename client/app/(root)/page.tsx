"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, GitBranch, Radar, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import AnalysisLoading from "@/components/AnalysisLoading";
import type { RepositoryAnalysis } from "@/lib/types";
import { parseGitHubRepository } from "@/lib/utils";

const examples = ["facebook/react", "vercel/next.js", "shadcn-ui/ui"];

export default function Home() {
  const [repository, setRepository] = useState("");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function analyze(value = repository) {
    const trimmed = value.trim();
    setError("");

    if (!parseGitHubRepository(trimmed)) {
      setError("Enter a valid GitHub URL or owner/repository.");
      return;
    }

    setRepository(trimmed);
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: trimmed }),
      });
      const payload = (await response.json()) as RepositoryAnalysis | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Analysis failed.");
      }

      setAnalysis(payload);
      window.setTimeout(() => document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (caught) {
      setAnalysis(null);
      setError(caught instanceof Error ? caught.message : "The repository could not be analyzed.");
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyze();
  }

  return (
    <main>
      <section className="relative overflow-hidden border-b border-black/8 px-5 pb-20 pt-20 dark:border-white/10 sm:px-8 sm:pb-28 sm:pt-28">
        <div className="hero-grid absolute inset-0 -z-10 opacity-60" />
        <div className="glow-orb absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full" />

        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-950/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-emerald-950 shadow-sm backdrop-blur dark:border-emerald-200/15 dark:bg-white/5 dark:text-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live repository intelligence
          </div>

          <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-zinc-950 dark:text-zinc-50 sm:text-7xl lg:text-[5.5rem]">
            Know what a repository is <span className="text-emerald-600 dark:text-emerald-400">really</span> telling you.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-balance text-base leading-7 text-zinc-600 dark:text-zinc-400 sm:text-lg">
            Reporithm turns public GitHub signals into a clear health score, contributor readiness check, and focused next steps—in seconds.
          </p>

          <form onSubmit={onSubmit} className="mx-auto mt-10 max-w-3xl text-left">
            <div className="group flex flex-col gap-2 rounded-2xl border border-zinc-300/90 bg-white p-2 shadow-[0_20px_70px_-28px_rgba(20,45,30,0.35)] transition-shadow focus-within:border-emerald-500 focus-within:shadow-[0_24px_80px_-28px_rgba(16,185,129,0.45)] dark:border-white/15 dark:bg-zinc-900 sm:flex-row">
              <label htmlFor="repository" className="sr-only">GitHub repository</label>
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <GitBranch className="h-5 w-5 shrink-0 text-zinc-400" />
                <input
                  id="repository"
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  placeholder="github.com/owner/repository"
                  autoComplete="url"
                  spellCheck={false}
                  className="h-12 w-full min-w-0 bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-zinc-50 sm:text-base"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-60 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300"
              >
                {isLoading ? "Reading signals…" : "Analyze repository"}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
            {error && <p role="alert" className="mt-3 pl-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
            <span>Try an example:</span>
            {examples.map((example) => (
              <button key={example} type="button" onClick={() => void analyze(example)} className="rounded-full border border-zinc-300 bg-white/60 px-2.5 py-1 font-mono transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:hover:text-emerald-300">
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="analysis" className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-24">
        {isLoading ? <AnalysisLoading /> : analysis ? <AnalysisDashboard analysis={analysis} /> : <ProductPrimer />}
      </section>
    </main>
  );
}

function ProductPrimer() {
  const features = [
    { icon: Radar, number: "01", title: "Read the pulse", copy: "Freshness, commits, contributors, issues, and pull requests—collected from live GitHub data." },
    { icon: ShieldCheck, number: "02", title: "Check the foundations", copy: "See whether licensing, security guidance, templates, and contributor docs are in place." },
    { icon: Sparkles, number: "03", title: "Know what to fix", copy: "Get a transparent 100-point score and recommendations ordered by impact, not noise." },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">A clearer repository review</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] text-zinc-950 dark:text-zinc-50 sm:text-4xl">Signal over vanity metrics.</h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">Every score is traceable to visible repository evidence. No opaque AI verdicts and no code upload required.</p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, number, title, copy }) => (
          <article key={title} className="group rounded-3xl border border-black/8 bg-white/70 p-6 shadow-sm transition-transform hover:-translate-y-1 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Icon className="h-5 w-5" /></span>
              <span className="font-mono text-xs text-zinc-400">{number}</span>
            </div>
            <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{copy}</p>
          </article>
        ))}
      </div>
      <div className="mt-10 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
        <ScanSearch className="h-4 w-4" /> Public repositories only · No sign-in required
      </div>
    </div>
  );
}
