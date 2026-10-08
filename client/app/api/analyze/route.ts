import { NextResponse } from "next/server";
import { analyzeGitHubRepository, GitHubApiError } from "@/lib/github-analysis";
import { analyzeWithSonarQube } from "@/lib/sonarqube-analysis";
import { automaticScanningEnabled, scanGitHubRepository } from "@/lib/sonarqube-scanner";
import { parseGitHubRepository } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { repository?: unknown };
    if (typeof body.repository !== "string") {
      return NextResponse.json({ error: "Enter a GitHub repository URL." }, { status: 400 });
    }

    const parsed = parseGitHubRepository(body.repository);
    if (!parsed) {
      return NextResponse.json(
        { error: "Use a GitHub URL or owner/repository, for example github.com/facebook/react." },
        { status: 400 },
      );
    }

    const analysis = await analyzeGitHubRepository(parsed.owner, parsed.repository);
    let sonar = await analyzeWithSonarQube(analysis.repository.owner, analysis.repository.name);

    if (sonar.status === "project_not_found" && automaticScanningEnabled()) {
      const projectKey = `${analysis.repository.owner}_${analysis.repository.name}`;

      try {
        await scanGitHubRepository(analysis.repository.url, projectKey);

        for (let attempt = 0; attempt < 12; attempt += 1) {
          sonar = await analyzeWithSonarQube(analysis.repository.owner, analysis.repository.name);
          if (sonar.status === "available" && sonar.lastAnalysisAt) break;
          await wait(1_500);
        }
      } catch (scanError) {
        console.error("Automatic SonarQube scan failed", scanError);
        sonar = {
          ...sonar,
          status: "unavailable",
          message: "The automatic SonarQube scan could not be completed. Check the scanner service and try again.",
        };
      }
    }

    return NextResponse.json({ ...analysis, sonar }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "The request body is not valid JSON." }, { status: 400 });
    }

    console.error("Repository analysis failed", error);
    return NextResponse.json(
      { error: "The analysis could not be completed. Please try again in a moment." },
      { status: 500 },
    );
  }
}
