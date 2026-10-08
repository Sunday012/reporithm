import type {
  CommunityHealth,
  HealthDimension,
  HealthGrade,
  LanguageShare,
  Recommendation,
  RepositoryAnalysis,
} from "@/lib/types";

const GITHUB_API = "https://api.github.com";

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  "C#": "#178600",
  "C++": "#f34b7d",
  C: "#555555",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
};

interface GitHubRepository {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  owner: { login: string; avatar_url: string };
  default_branch: string;
  archived: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  open_issues_count: number;
  license: { spdx_id: string; name: string } | null;
  topics: string[];
  size: number;
  language: string | null;
}

interface CommunityProfile {
  health_percentage?: number;
  files?: Record<string, { html_url?: string } | null>;
}

class GitHubApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Reporithm/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function githubFetch<T>(path: string, allowNotFound = false): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (allowNotFound && response.status === 404) {
    return { data: {} as T, headers: response.headers };
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (response.status === 403 || response.status === 429) {
      throw new GitHubApiError(
        "GitHub's API limit has been reached. Add a GITHUB_TOKEN to increase the limit, then try again.",
        response.status,
      );
    }
    throw new GitHubApiError(payload?.message ?? "GitHub could not return this repository.", response.status);
  }

  return { data: (await response.json()) as T, headers: response.headers };
}

function countFromResponse<T>(items: T[], headers: Headers) {
  const link = headers.get("link");
  const lastPage = link?.match(/[?&]page=(\d+)>; rel="last"/);
  return lastPage ? Number(lastPage[1]) : items.length;
}

function languageShares(languages: Record<string, number>): LanguageShare[] {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  if (!total) return [];

  return Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: Number(((bytes / total) * 100).toFixed(1)),
      color: languageColors[name] ?? "#7c8a98",
    }));
}

function getCommunity(profile: CommunityProfile, repository: GitHubRepository): CommunityHealth {
  const files = profile.files ?? {};
  const issueTemplate = Boolean(files.issue_template || files.issue_template_config);
  return {
    readme: Boolean(files.readme),
    license: Boolean(files.license || repository.license),
    contributing: Boolean(files.contributing),
    codeOfConduct: Boolean(files.code_of_conduct),
    securityPolicy: Boolean(files.security),
    issueTemplate,
    pullRequestTemplate: Boolean(files.pull_request_template),
    percentage: profile.health_percentage ?? 0,
  };
}

function activityScore(days: number) {
  if (days <= 7) return 25;
  if (days <= 30) return 22;
  if (days <= 90) return 17;
  if (days <= 180) return 11;
  if (days <= 365) return 5;
  return 1;
}

function gradeFor(score: number): HealthGrade {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Healthy";
  if (score >= 50) return "Developing";
  return "Needs attention";
}

function scoreAnalysis(input: {
  repository: GitHubRepository;
  community: CommunityHealth;
  contributors: number;
  commits: number;
  openIssues: number;
  openPullRequests: number;
  daysSinceLastPush: number;
}) {
  const { repository, community, contributors, commits, openIssues, openPullRequests, daysSinceLastPush } = input;

  const documentation =
    (community.readme ? 6 : 0) +
    (community.license ? 4 : 0) +
    (community.contributing ? 4 : 0) +
    (community.codeOfConduct ? 3 : 0) +
    (community.securityPolicy ? 4 : 0) +
    (community.issueTemplate ? 2 : 0) +
    (community.pullRequestTemplate ? 2 : 0);

  const maintenance =
    (!repository.archived ? 5 : 0) +
    (repository.description ? 3 : 0) +
    (repository.topics.length >= 3 ? 3 : repository.topics.length) +
    (repository.homepage ? 2 : 0) +
    (openIssues <= Math.max(10, repository.stargazers_count * 0.1) ? 4 : 1) +
    (repository.default_branch ? 3 : 0);

  const adoption = Math.min(
    15,
    (repository.stargazers_count >= 5000 ? 10 : repository.stargazers_count >= 500 ? 8 : repository.stargazers_count >= 50 ? 6 : repository.stargazers_count >= 5 ? 3 : 1) +
      (repository.forks_count >= 100 ? 5 : repository.forks_count >= 10 ? 4 : repository.forks_count > 0 ? 2 : 0),
  );

  const collaboration = Math.min(
    15,
    (contributors >= 50 ? 8 : contributors >= 10 ? 6 : contributors >= 3 ? 4 : contributors > 0 ? 2 : 0) +
      (commits >= 500 ? 5 : commits >= 100 ? 4 : commits >= 20 ? 3 : commits > 0 ? 1 : 0) +
      (openPullRequests > 0 ? 2 : repository.forks_count > 0 ? 1 : 0),
  );

  const dimensions: HealthDimension[] = [
    {
      key: "activity",
      label: "Activity",
      score: activityScore(daysSinceLastPush),
      max: 25,
      description: daysSinceLastPush === 0 ? "Updated today" : `Last pushed ${daysSinceLastPush} days ago`,
    },
    {
      key: "community",
      label: "Community standards",
      score: documentation,
      max: 25,
      description: `${Object.entries(community).filter(([key, value]) => key !== "percentage" && value).length} of 7 essentials found`,
    },
    {
      key: "maintenance",
      label: "Maintenance",
      score: maintenance,
      max: 20,
      description: repository.archived ? "Repository is archived" : "Repository is open for development",
    },
    {
      key: "adoption",
      label: "Adoption",
      score: adoption,
      max: 15,
      description: `${repository.stargazers_count.toLocaleString()} stars · ${repository.forks_count.toLocaleString()} forks`,
    },
    {
      key: "collaboration",
      label: "Collaboration",
      score: collaboration,
      max: 15,
      description: `${contributors.toLocaleString()} contributors · ${openPullRequests.toLocaleString()} open PRs`,
    },
  ];

  const score = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  const grade = gradeFor(score);
  const summary =
    score >= 85
      ? "Strong signals across maintenance, documentation, and community readiness."
      : score >= 70
        ? "A healthy repository with a few clear opportunities to improve contributor trust."
        : score >= 50
          ? "A promising foundation, but important project-health signals are still missing."
          : "Several fundamentals need attention before contributors can evaluate the project confidently.";

  return { score, grade, summary, dimensions };
}

function recommendationsFor(input: {
  repository: GitHubRepository;
  community: CommunityHealth;
  contributors: number;
  daysSinceLastPush: number;
}): Recommendation[] {
  const { repository, community, contributors, daysSinceLastPush } = input;
  const recommendations: Recommendation[] = [];

  if (!community.readme) recommendations.push({ title: "Add a useful README", description: "Explain the problem, setup, usage, and the fastest path to a successful first run.", priority: "high", category: "Documentation" });
  if (!community.license) recommendations.push({ title: "Choose an explicit license", description: "Without a license, others cannot confidently use, modify, or contribute to the project.", priority: "high", category: "Governance" });
  if (!community.securityPolicy) recommendations.push({ title: "Publish a security policy", description: "Give researchers a private reporting path and document supported release versions.", priority: "medium", category: "Security" });
  if (!community.contributing) recommendations.push({ title: "Create a contribution guide", description: "Document local setup, checks, branch expectations, and how maintainers review changes.", priority: "medium", category: "Community" });
  if (!community.issueTemplate || !community.pullRequestTemplate) recommendations.push({ title: "Standardize incoming work", description: "Issue and pull-request templates improve reports and shorten review cycles.", priority: "low", category: "Workflow" });
  if (daysSinceLastPush > 180 && !repository.archived) recommendations.push({ title: "Clarify the maintenance status", description: "The repository has been quiet for more than six months. Publish a roadmap or archive it if maintenance has ended.", priority: "high", category: "Maintenance" });
  if (!repository.description || repository.topics.length < 3) recommendations.push({ title: "Improve repository discovery", description: "Add a concise description and at least three relevant topics so the project is easier to understand and find.", priority: "low", category: "Discoverability" });
  if (contributors <= 1 && repository.forks_count > 0) recommendations.push({ title: "Lower the contribution barrier", description: "There is outside interest but little contributor participation. Add good-first-issue labels and a lightweight setup path.", priority: "medium", category: "Community" });

  if (!recommendations.length) {
    recommendations.push({ title: "Keep the project signals fresh", description: "The repository covers the essentials. Review policies and contributor documentation with each major release.", priority: "low", category: "Maintenance" });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5);
}

export async function analyzeGitHubRepository(owner: string, repositoryName: string): Promise<RepositoryAnalysis> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}`;
  const { data: repository } = await githubFetch<GitHubRepository>(path);

  const [languagesResult, communityResult, contributorsResult, commitsResult, pullsResult] = await Promise.all([
    githubFetch<Record<string, number>>(`${path}/languages`),
    githubFetch<CommunityProfile>(`${path}/community/profile`, true),
    githubFetch<Array<{ login: string }>>(`${path}/contributors?per_page=1&anon=true`),
    githubFetch<Array<{ sha: string }>>(`${path}/commits?per_page=1&sha=${encodeURIComponent(repository.default_branch)}`),
    githubFetch<Array<{ id: number }>>(`${path}/pulls?state=open&per_page=1`),
  ]);

  const contributors = countFromResponse(contributorsResult.data, contributorsResult.headers);
  const commits = countFromResponse(commitsResult.data, commitsResult.headers);
  const openPullRequests = countFromResponse(pullsResult.data, pullsResult.headers);
  const openIssues = Math.max(0, repository.open_issues_count - openPullRequests);
  const daysSinceLastPush = Math.max(0, Math.floor((Date.now() - new Date(repository.pushed_at).getTime()) / 86_400_000));
  const community = getCommunity(communityResult.data, repository);
  const health = scoreAnalysis({ repository, community, contributors, commits, openIssues, openPullRequests, daysSinceLastPush });

  return {
    repository: {
      owner: repository.owner.login,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      description: repository.description,
      homepage: repository.homepage,
      avatarUrl: repository.owner.avatar_url,
      defaultBranch: repository.default_branch,
      archived: repository.archived,
      isFork: repository.fork,
      createdAt: repository.created_at,
      updatedAt: repository.updated_at,
      pushedAt: repository.pushed_at,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      watchers: repository.subscribers_count,
      openIssues,
      openPullRequests,
      license: repository.license?.spdx_id === "NOASSERTION" ? repository.license.name : repository.license?.spdx_id ?? null,
      topics: repository.topics,
      sizeKb: repository.size,
      primaryLanguage: repository.language,
    },
    languages: languageShares(languagesResult.data),
    activity: { contributors, commits, daysSinceLastPush },
    community,
    health,
    recommendations: recommendationsFor({ repository, community, contributors, daysSinceLastPush }),
    analyzedAt: new Date().toISOString(),
  };
}

export { GitHubApiError };
