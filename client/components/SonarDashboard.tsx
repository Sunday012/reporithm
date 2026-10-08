import {
  AlertCircle,
  Bug,
  CheckCircle2,
  CircleGauge,
  CodeXml,
  FileWarning,
  FlaskConical,
  Gauge,
  ShieldAlert,
  Siren,
  Timer,
  Wrench,
  XCircle,
} from "lucide-react";
import type { SonarAnalysis } from "@/lib/types";
import { cn, formatCompactNumber, formatRelativeDate } from "@/lib/utils";

export default function SonarDashboard({ sonar, repositoryFullName }: { sonar: SonarAnalysis; repositoryFullName: string }) {
  if (sonar.status !== "available" || !sonar.metrics || !sonar.qualityGate || !sonar.issues) {
    return <SonarEmptyState sonar={sonar} repositoryFullName={repositoryFullName} />;
  }

  const { metrics, qualityGate, issues } = sonar;
  const passed = qualityGate.status === "OK";
  const metricsList = [
    { label: "Bugs", value: metrics.bugs, icon: Bug, tone: metrics.bugs ? "danger" : "good" },
    { label: "Vulnerabilities", value: metrics.vulnerabilities, icon: ShieldAlert, tone: metrics.vulnerabilities ? "danger" : "good" },
    { label: "Security hotspots", value: metrics.securityHotspots, icon: Siren, tone: metrics.securityHotspots ? "warn" : "good" },
    { label: "Code smells", value: metrics.codeSmells, icon: FileWarning, tone: metrics.codeSmells ? "warn" : "good" },
    { label: "Lines of code", value: metrics.linesOfCode, icon: CodeXml, tone: "neutral" },
    { label: "Cognitive complexity", value: metrics.cognitiveComplexity, icon: Gauge, tone: "neutral" },
    { label: "Tests", value: metrics.tests, icon: FlaskConical, tone: "neutral" },
    { label: "Technical debt", value: formatDuration(metrics.technicalDebtMinutes), icon: Timer, tone: metrics.technicalDebtMinutes ? "warn" : "good", formatted: true },
  ] as const;

  return (
    <section className="mt-12 overflow-hidden rounded-[2rem] border border-black/8 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex flex-col gap-5 border-b border-black/8 p-6 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h3 className="text-2xl font-semibold tracking-[-0.03em]">Verified code quality</h3>
          <p className="mt-1 text-sm text-zinc-500">Project {sonar.projectKey}{sonar.lastAnalysisAt ? ` · scanned ${formatRelativeDate(sonar.lastAnalysisAt)}` : ""}</p>
        </div>
        <div className={cn("flex items-center gap-3 self-start rounded-2xl px-4 py-3 sm:self-auto", passed ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200" : "bg-red-100 text-red-900 dark:bg-red-400/10 dark:text-red-200")}>
          {passed ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-65">Quality gate</p><p className="font-semibold">{passed ? "Passed" : qualityGate.status === "ERROR" ? "Failed" : qualityGate.status}</p></div>
        </div>
      </div>

      <div className="grid gap-px bg-black/8 dark:bg-white/10 sm:grid-cols-3">
        <RatingCard label="Reliability" value={metrics.reliabilityRating} />
        <RatingCard label="Security" value={metrics.securityRating} />
        <RatingCard label="Maintainability" value={metrics.maintainabilityRating} />
      </div>

      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metricsList.map(({ label, value, icon: Icon, tone, ...metric }) => (
            <div key={label} className="rounded-2xl border border-black/8 bg-zinc-50 p-4 dark:border-white/10 dark:bg-black/15">
              <Icon className={cn("h-4 w-4", tone === "danger" ? "text-red-500" : tone === "warn" ? "text-amber-500" : tone === "good" ? "text-emerald-500" : "text-zinc-400")} />
              <p className="mt-4 text-2xl font-semibold tracking-tight">{"formatted" in metric ? value : formatCompactNumber(value as number)}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MetricBar label="Test coverage" value={metrics.coverage} healthyAt={80} suffix="%" />
          <MetricBar label="Duplicated lines" value={metrics.duplicatedLinesDensity} healthyAt={3} suffix="%" inverse />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[.65fr_1.35fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Unresolved issues</p>
            <p className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{formatCompactNumber(issues.total)}</p>
            <div className="mt-5 space-y-3">
              <Severity label="Blocker" count={issues.blocker} color="bg-red-600" />
              <Severity label="Critical" count={issues.critical} color="bg-orange-500" />
              <Severity label="Major" count={issues.major} color="bg-amber-400" />
              <Severity label="Minor" count={issues.minor} color="bg-sky-400" />
              <Severity label="Info" count={issues.info} color="bg-zinc-400" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Highest-priority findings</p>
            {issues.top.length ? (
              <div className="mt-3 divide-y divide-black/8 dark:divide-white/10">
                {issues.top.slice(0, 5).map((issue) => (
                  <div key={issue.key} className="py-4 first:pt-2">
                    <div className="flex flex-wrap items-center gap-2"><span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider", issue.severity === "BLOCKER" || issue.severity === "CRITICAL" ? "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300")}>{issue.severity}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{issue.type.replaceAll("_", " ")}</span></div>
                    <p className="mt-2 text-sm font-medium leading-5">{issue.message}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">{issue.component}{issue.line ? `:${issue.line}` : ""} · {issue.rule}{issue.effort ? ` · ${issue.effort}` : ""}</p>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-zinc-500">No unresolved issues were returned by SonarQube.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function SonarEmptyState({ sonar, repositoryFullName }: { sonar: SonarAnalysis; repositoryFullName: string }) {
  const notConfigured = sonar.status === "not_configured";
  const Icon = notConfigured ? CircleGauge : sonar.status === "project_not_found" ? Wrench : AlertCircle;

  return (
    <section className="mt-12 rounded-[2rem] border border-dashed border-violet-300 bg-violet-50/60 p-6 dark:border-violet-400/25 dark:bg-violet-400/[0.045] sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300"><Icon className="h-5 w-5" /></span>
          <div>
            <h3 className="text-xl font-semibold">{notConfigured ? "Connect the code-quality engine" : sonar.status === "project_not_found" ? "Repository has not been scanned yet" : "SonarQube is temporarily unavailable"}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{sonar.message}</p>
          </div>
        </div>
        <div className="shrink-0 rounded-2xl border border-violet-200 bg-white/80 px-4 py-3 font-mono text-[11px] leading-5 text-zinc-600 dark:border-violet-400/15 dark:bg-black/20 dark:text-zinc-300">
          {notConfigured ? <><p>SONARQUBE_URL=...</p><p>SONARQUBE_TOKEN=...</p></> : <><p>Repository: {repositoryFullName}</p><p>Default key: {repositoryFullName.replace("/", "_")}</p></>}
        </div>
      </div>
    </section>
  );
}

function RatingCard({ label, value }: { label: string; value: string | null }) {
  const good = value === "A";
  return <div className="flex items-center justify-between bg-white px-6 py-4 dark:bg-[#171914] sm:px-8"><span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</span><span className={cn("grid h-8 w-8 place-items-center rounded-lg text-sm font-bold", value === null ? "bg-zinc-100 text-zinc-400 dark:bg-white/5" : good ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300")}>{value ?? "—"}</span></div>;
}

function MetricBar({ label, value, healthyAt, suffix, inverse = false }: { label: string; value: number | null; healthyAt: number; suffix: string; inverse?: boolean }) {
  const healthy = value !== null && (inverse ? value <= healthyAt : value >= healthyAt);
  const width = value === null ? 0 : Math.min(100, value);
  return <div className="rounded-2xl border border-black/8 p-5 dark:border-white/10"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{label}</p><p className={cn("font-mono text-sm font-semibold", value === null ? "text-zinc-400" : healthy ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300")}>{value === null ? "Not measured" : `${value.toFixed(1)}${suffix}`}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10"><div className={cn("h-full rounded-full", healthy ? "bg-emerald-500" : "bg-amber-400")} style={{ width: `${width}%` }} /></div></div>;
}

function Severity({ label, count, color }: { label: string; count: number; color: string }) {
  return <div className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", color)} /><span className="text-zinc-600 dark:text-zinc-400">{label}</span></div><span className="font-mono text-xs font-semibold">{count}</span></div>;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 480) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 480)}d`;
}
