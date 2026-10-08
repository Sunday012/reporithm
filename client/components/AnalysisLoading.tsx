export default function AnalysisLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-live="polite" aria-label="Analyzing repository">
      <div className="h-5 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-5 h-10 w-72 max-w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="h-80 rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 rounded-3xl bg-zinc-200 dark:bg-zinc-800" />)}
        </div>
      </div>
      <p className="mt-5 text-sm text-zinc-500">Reading repository, contribution, and community signals…</p>
    </div>
  );
}
