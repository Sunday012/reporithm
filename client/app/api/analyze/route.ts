import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { analyzeGitHubRepository, GitHubApiError } from "@/lib/github-analysis";
import { analyzeWithSonarQube } from "@/lib/sonarqube-analysis";
import {
  AnalysisQuotaError,
  automaticScanningEnabled,
  finishAnalysisQuota,
  reserveAnalysisQuota,
  scanGitHubRepository,
} from "@/lib/sonarqube-scanner";
import { parseGitHubRepository } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function visitorId(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const language = request.headers.get("accept-language") || "unknown";
  return createHash("sha256").update(`${address}\0${userAgent}\0${language}`).digest("hex");
}

function signupUrl() {
  return process.env.NEXT_PUBLIC_SIGN_UP_URL?.trim() || null;
}

export async function POST(request: Request) {
  let reservationId: string | null = null;
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

    reservationId = await reserveAnalysisQuota(visitorId(request));

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

    const completed = sonar.status === "available";
    await finishAnalysisQuota(reservationId, completed);
    reservationId = null;

    return NextResponse.json({ ...analysis, sonar, quota: { remaining: completed ? 0 : 1, signupUrl: signupUrl() } }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (reservationId) {
      await finishAnalysisQuota(reservationId, false).catch((releaseError) => {
        console.error("Could not release analysis quota reservation", releaseError);
      });
    }
    if (error instanceof AnalysisQuotaError) {
      return NextResponse.json(
        { code: "free_analysis_used", error: error.message, signupUrl: signupUrl() },
        { status: 429, headers: { "Cache-Control": "private, no-store" } },
      );
    }
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
