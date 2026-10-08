import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CircleCheck,
  CircleX,
  Code2,
  Eye,
  GitCommitHorizontal,
  GitFork,
  GitPullRequest,
  Scale,
  Star,
  Users,
} from "lucide-react";
import type { Recommendation, RepositoryAnalysis } from "@/lib/types";
import { cn, formatCompactNumber, formatRelativeDate } from "@/lib/utils";
import SonarDashboard from "@/components/SonarDashboard";

interface AnalysisDashboardProps {
  analysis: RepositoryAnalysis;
}

export default function AnalysisDashboard({ analysis }: AnalysisDashboardProps) {
  const { repository, health, activity, languages, community, recommendations } = analysis;
  const stats = [
    { label: "Stars", value: repository.stars, icon: Star },
    { label: "Forks", value: repository.forks, icon: GitFork },
    { label: "Contributors", value: activity.contributors, icon: Users },
    { label: "Commits", value: activity.commits, icon: GitCommitHorizontal },
    { label: "Open issues", value: repository.openIssues, icon: AlertTriangle },
    { label: "Open PRs", value: repository.openPullRequests, icon: GitPullRequest },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-black/8 pb-8 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Analysis complete</p>
          <div className="mt-3 flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-emerald-400 dark:text-emerald-950">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold tracking-[-0.03em] sm:text-4xl">{repository.fullName}</h2>
              <p className="mt-1 text-sm text-zinc-500">Updated {formatRelativeDate(repository.pushedAt)} · {repository.defaultBranch} branch</p>
            </div>
          </div>
        </div>
        <a href={repository.url} target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-white/15 dark:bg-white/5 dark:hover:text-emerald-300 sm:self-auto">
          Open on GitHub <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.08fr_1.92fr]">
        <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-7 text-white shadow-xl dark:bg-zinc-900 sm:p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Repository health</p>
            <div className="mt-7 flex items-center gap-6">
              <div
                className="score-ring grid h-36 w-36 shrink-0 place-items-center rounded-full"
                style={{ "--score": `${health.score * 3.6}deg` } as React.CSSProperties}
                aria-label={`Health score ${health.score} out of 100`}
              >
                <div className="grid h-[7.25rem] w-[7.25rem] place-items-center rounded-full bg-zinc-950 dark:bg-zinc-900">
                  <div className="text-center"><span className="text-4xl font-semibold tracking-tight">{health.score}</span><span className="text-sm text-zinc-500">/100</span></div>
                </div>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight text-emerald-300">{health.grade}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{health.summary}</p>
              </div>
            </div>
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="line-clamp-3 text-sm leading-6 text-zinc-300">{repository.description ?? "This repository does not have a description yet."}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {repository.license && <Pill icon={Scale}>{repository.license}</Pill>}
                {repository.primaryLanguage && <Pill icon={Code2}>{repository.primaryLanguage}</Pill>}
                {repository.archived && <Pill icon={Activity}>Archived</Pill>}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <article key={label} className="rounded-3xl border border-black/8 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
              <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-6 text-3xl font-semibold tracking-[-0.04em]">{formatCompactNumber(value)}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</p>
            </article>
          ))}
        </section>
      </div>

      <SonarDashboard sonar={analysis.sonar} repositoryFullName={repository.fullName} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Score breakdown" eyebrow="Why this score">
          <div className="space-y-6">
            {health.dimensions.map((dimension) => {
              const percentage = (dimension.score / dimension.max) * 100;
              return (
                <div key={dimension.key}>
                  <div className="flex items-end justify-between gap-4">
                    <div><p className="text-sm font-semibold">{dimension.label}</p><p className="mt-1 text-xs text-zinc-500">{dimension.description}</p></div>
                    <p className="shrink-0 font-mono text-sm"><span className="font-semibold text-emerald-700 dark:text-emerald-300">{dimension.score}</span><span className="text-zinc-400">/{dimension.max}</span></p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Language mix" eyebrow="Code composition">
          {languages.length ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                {languages.map((language) => <div key={language.name} style={{ width: `${language.percentage}%`, backgroundColor: language.color }} title={`${language.name}: ${language.percentage}%`} />)}
              </div>
              <div className="mt-8 space-y-4">
                {languages.map((language) => (
                  <div key={language.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: language.color }} /><span className="font-medium">{language.name}</span></div>
                    <span className="font-mono text-xs text-zinc-500">{language.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-zinc-500">GitHub did not report any language data.</p>}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <Panel title="Recommended next moves" eyebrow="Prioritized actions">
          <div className="divide-y divide-black/8 dark:divide-white/10">
            {recommendations.map((recommendation, index) => <RecommendationRow key={recommendation.title} recommendation={recommendation} index={index + 1} />)}
          </div>
        </Panel>

        <Panel title="Community essentials" eyebrow={`${community.percentage}% GitHub profile`}>
          <div className="space-y-1">
            <CommunityItem label="README" present={community.readme} />
            <CommunityItem label="License" present={community.license} />
            <CommunityItem label="Contributing guide" present={community.contributing} />
            <CommunityItem label="Code of conduct" present={community.codeOfConduct} />
            <CommunityItem label="Security policy" present={community.securityPolicy} />
            <CommunityItem label="Issue template" present={community.issueTemplate} />
            <CommunityItem label="Pull request template" present={community.pullRequestTemplate} />
          </div>
        </Panel>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-zinc-400"><Eye className="h-3.5 w-3.5" /> Based on public GitHub metadata. Last analyzed {new Date(analysis.analyzedAt).toLocaleString()}.</p>
    </div>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-black/8 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-8"><p className="eyebrow">{eyebrow}</p><h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3><div className="mt-7">{children}</div></section>;
}

function Pill({ icon: Icon, children }: { icon: typeof Scale; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs text-zinc-300"><Icon className="h-3 w-3" />{children}</span>;
}

function CommunityItem({ label, present }: { label: string; present: boolean }) {
  const Icon = present ? CircleCheck : CircleX;
  return <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"><span className={cn("font-medium", !present && "text-zinc-500")}>{label}</span><span className={cn("flex items-center gap-1.5 text-xs font-semibold", present ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-400")}><Icon className="h-4 w-4" />{present ? "Found" : "Missing"}</span></div>;
}

function RecommendationRow({ recommendation, index }: { recommendation: Recommendation; index: number }) {
  return (
    <div className="flex gap-4 py-5 first:pt-0 last:pb-0">
      <span className="mt-0.5 font-mono text-xs text-zinc-400">{String(index).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{recommendation.title}</h4><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", recommendation.priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300" : recommendation.priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300")}>{recommendation.priority}</span></div>
        <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{recommendation.description}</p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">{recommendation.category}</p>
      </div>
    </div>
  );
}
