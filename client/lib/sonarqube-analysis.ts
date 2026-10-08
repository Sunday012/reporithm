import type { SonarAnalysis, SonarMetricSet } from "@/lib/types";

const metricKeys = [
  "bugs",
  "vulnerabilities",
  "security_hotspots",
  "code_smells",
  "coverage",
  "duplicated_lines_density",
  "ncloc",
  "cognitive_complexity",
  "complexity",
  "sqale_index",
  "tests",
  "test_failures",
  "test_errors",
  "skipped_tests",
  "reliability_rating",
  "security_rating",
  "sqale_rating",
];

interface SonarProject {
  key: string;
  name: string;
  lastAnalysisDate?: string;
}

interface ProjectsResponse {
  components?: SonarProject[];
}

interface MeasuresResponse {
  component?: {
    measures?: Array<{ metric: string; value?: string }>; 
  };
}

interface QualityGateResponse {
  projectStatus?: {
    status?: string;
    conditions?: Array<{
      metricKey: string;
      status: string;
      actualValue?: string;
      errorThreshold?: string;
    }>;
  };
}

interface IssuesResponse {
  total?: number;
  issues?: Array<{
    key: string;
    message: string;
    severity: string;
    type: string;
    component: string;
    line?: number;
    effort?: string;
    rule: string;
  }>;
  facets?: Array<{
    property: string;
    values: Array<{ val: string; count: number }>;
  }>;
}

class SonarApiError extends Error {}

function emptyAnalysis(status: SonarAnalysis["status"], message: string): SonarAnalysis {
  return {
    status,
    projectKey: null,
    projectName: null,
    lastAnalysisAt: null,
    message,
    qualityGate: null,
    metrics: null,
    issues: null,
  };
}

function projectCandidates(owner: string, repository: string) {
  const template = process.env.SONARQUBE_PROJECT_KEY_TEMPLATE;
  const templated = template
    ?.replaceAll("{owner}", owner)
    .replaceAll("{repo}", repository)
    .replaceAll("{fullName}", `${owner}/${repository}`);

  return Array.from(new Set([
    templated,
    `${owner}_${repository}`,
    `${owner}:${repository}`,
    `${owner}/${repository}`,
    repository,
  ].filter((value): value is string => Boolean(value))));
}

function authHeaders(token?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
  return headers;
}

async function sonarFetch<T>(baseUrl: string, path: string, token?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new SonarApiError(`SonarQube request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function numeric(values: Map<string, string>, key: string) {
  const value = Number(values.get(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function optionalNumeric(values: Map<string, string>, key: string) {
  if (!values.has(key)) return null;
  const value = Number(values.get(key));
  return Number.isFinite(value) ? value : null;
}

function rating(values: Map<string, string>, key: string) {
  const value = optionalNumeric(values, key);
  if (value === null) return null;
  return ["A", "B", "C", "D", "E"][Math.max(0, Math.min(4, Math.round(value) - 1))] ?? null;
}

function normalizeMetrics(response: MeasuresResponse): SonarMetricSet {
  const values = new Map(
    (response.component?.measures ?? [])
      .filter((measure) => measure.value !== undefined)
      .map((measure) => [measure.metric, measure.value as string]),
  );

  return {
    bugs: numeric(values, "bugs"),
    vulnerabilities: numeric(values, "vulnerabilities"),
    securityHotspots: numeric(values, "security_hotspots"),
    codeSmells: numeric(values, "code_smells"),
    coverage: optionalNumeric(values, "coverage"),
    duplicatedLinesDensity: optionalNumeric(values, "duplicated_lines_density"),
    linesOfCode: numeric(values, "ncloc"),
    cognitiveComplexity: numeric(values, "cognitive_complexity"),
    complexity: numeric(values, "complexity"),
    technicalDebtMinutes: numeric(values, "sqale_index"),
    tests: numeric(values, "tests"),
    testFailures: numeric(values, "test_failures"),
    testErrors: numeric(values, "test_errors"),
    skippedTests: numeric(values, "skipped_tests"),
    reliabilityRating: rating(values, "reliability_rating"),
    securityRating: rating(values, "security_rating"),
    maintainabilityRating: rating(values, "sqale_rating"),
  };
}

export async function analyzeWithSonarQube(owner: string, repository: string): Promise<SonarAnalysis> {
  const configuredUrl = process.env.SONARQUBE_URL?.trim().replace(/\/$/, "");
  const token = process.env.SONARQUBE_TOKEN?.trim();

  if (!configuredUrl) {
    return emptyAnalysis("not_configured", "Connect SonarQube to unlock verified code-quality analysis.");
  }

  try {
    const candidates = projectCandidates(owner, repository);
    const query = new URLSearchParams({ projects: candidates.join(","), ps: String(candidates.length) });
    const projects = await sonarFetch<ProjectsResponse>(configuredUrl, `/api/projects/search?${query}`, token);
    const project = candidates
      .map((candidate) => projects.components?.find((component) => component.key === candidate))
      .find((component): component is SonarProject => Boolean(component));

    if (!project || !project.lastAnalysisDate) {
      return emptyAnalysis(
        "project_not_found",
        project
          ? `SonarQube project ${project.key} exists but has no completed analysis yet.`
          : `No SonarQube project matched this repository. Expected one of: ${candidates.join(", ")}.`,
      );
    }

    const component = encodeURIComponent(project.key);
    const [measures, qualityGate, issues] = await Promise.all([
      sonarFetch<MeasuresResponse>(configuredUrl, `/api/measures/component?component=${component}&metricKeys=${metricKeys.join(",")}`, token),
      sonarFetch<QualityGateResponse>(configuredUrl, `/api/qualitygates/project_status?projectKey=${component}`, token),
      sonarFetch<IssuesResponse>(configuredUrl, `/api/issues/search?componentKeys=${component}&resolved=false&ps=20&facets=severities&s=SEVERITY&asc=false`, token),
    ]);

    const severity = new Map(
      issues.facets?.find((facet) => facet.property === "severities")?.values.map((value) => [value.val, value.count]) ?? [],
    );

    return {
      status: "available",
      projectKey: project.key,
      projectName: project.name,
      lastAnalysisAt: project.lastAnalysisDate ?? null,
      message: "Verified code-quality results from SonarQube.",
      qualityGate: {
        status: qualityGate.projectStatus?.status ?? "NONE",
        conditions: (qualityGate.projectStatus?.conditions ?? []).map((condition) => ({
          metricKey: condition.metricKey,
          status: condition.status,
          actualValue: condition.actualValue ?? null,
          threshold: condition.errorThreshold ?? null,
        })),
      },
      metrics: normalizeMetrics(measures),
      issues: {
        total: issues.total ?? 0,
        blocker: severity.get("BLOCKER") ?? 0,
        critical: severity.get("CRITICAL") ?? 0,
        major: severity.get("MAJOR") ?? 0,
        minor: severity.get("MINOR") ?? 0,
        info: severity.get("INFO") ?? 0,
        top: (issues.issues ?? []).slice(0, 8).map((issue) => ({
          key: issue.key,
          message: issue.message,
          severity: issue.severity,
          type: issue.type,
          component: issue.component.replace(`${project.key}:`, ""),
          line: issue.line ?? null,
          effort: issue.effort ?? null,
          rule: issue.rule,
        })),
      },
    };
  } catch (error) {
    console.error("SonarQube analysis failed", error);
    return emptyAnalysis(
      "unavailable",
      "SonarQube is configured but could not be reached or did not authorize this request.",
    );
  }
}
