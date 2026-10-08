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
  recommendations: Recommendation[];
  analyzedAt: string;
}
