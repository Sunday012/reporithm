export type HealthGrade = "Excellent" | "Healthy" | "Developing" | "Needs attention";

export interface RepositorySummary {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  homepage: string | null;
  avatarUrl: string;
  defaultBranch: string;
  archived: boolean;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  openPullRequests: number;
  license: string | null;
  topics: string[];
  sizeKb: number;
  primaryLanguage: string | null;
}

export interface LanguageShare {
  name: string;
  bytes: number;
  percentage: number;
  color: string;
}

export interface CommunityHealth {
  readme: boolean;
  license: boolean;
  contributing: boolean;
  codeOfConduct: boolean;
  securityPolicy: boolean;
  issueTemplate: boolean;
  pullRequestTemplate: boolean;
  percentage: number;
}

export interface HealthDimension {
  key: string;
  label: string;
  score: number;
  max: number;
  description: string;
}

export interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
}

export type SonarStatus = "available" | "not_configured" | "project_not_found" | "unavailable";

export interface SonarMetricSet {
  bugs: number;
  vulnerabilities: number;
  securityHotspots: number;
  codeSmells: number;
  coverage: number | null;
  duplicatedLinesDensity: number | null;
  linesOfCode: number;
  cognitiveComplexity: number;
  complexity: number;
  technicalDebtMinutes: number;
  tests: number;
  testFailures: number;
  testErrors: number;
  skippedTests: number;
  reliabilityRating: string | null;
  securityRating: string | null;
  maintainabilityRating: string | null;
}

export interface SonarIssue {
  key: string;
  message: string;
  severity: string;
  type: string;
  component: string;
  line: number | null;
  effort: string | null;
  rule: string;
}

export interface SonarAnalysis {
  status: SonarStatus;
  projectKey: string | null;
  projectName: string | null;
  lastAnalysisAt: string | null;
  message: string;
  qualityGate: {
    status: string;
    conditions: Array<{
      metricKey: string;
      status: string;
      actualValue: string | null;
      threshold: string | null;
    }>;
  } | null;
  metrics: SonarMetricSet | null;
  issues: {
    total: number;
    blocker: number;
    critical: number;
    major: number;
    minor: number;
    info: number;
    top: SonarIssue[];
  } | null;
}

export interface RepositoryAnalysis {
  repository: RepositorySummary;
  languages: LanguageShare[];
  activity: {
    contributors: number;
    commits: number;
    daysSinceLastPush: number;
  };
  community: CommunityHealth;
  health: {
    score: number;
    grade: HealthGrade;
    summary: string;
    dimensions: HealthDimension[];
  };
  sonar: SonarAnalysis;
  recommendations: Recommendation[];
  analyzedAt: string;
  quota?: {
    remaining: number;
    signupUrl: string | null;
  };
}
