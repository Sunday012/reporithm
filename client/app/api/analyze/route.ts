import { NextResponse } from "next/server";
import { analyzeGitHubRepository, GitHubApiError } from "@/lib/github-analysis";
import { parseGitHubRepository } from "@/lib/utils";

export const runtime = "nodejs";

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
    return NextResponse.json(analysis, {
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
