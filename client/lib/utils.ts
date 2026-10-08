import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseGitHubRepository(input: string) {
  const value = input.trim().replace(/\/$/, "");
  let path = value;

  if (/^git@github\.com:/i.test(value)) {
    path = value.replace(/^git@github\.com:/i, "");
  } else if (/^(https?:\/\/)?(www\.)?github\.com\//i.test(value)) {
    path = value.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  } else if (/^[\w.-]+\/[\w.-]+(?:\.git)?$/i.test(value)) {
    path = value;
  } else {
    return null;
  }

  const [owner, rawRepo, ...extra] = path.split("/");
  const repository = rawRepo?.replace(/\.git$/i, "");
  const validSegment = /^[A-Za-z0-9_.-]+$/;

  if (extra.length || !owner || !repository || !validSegment.test(owner) || !validSegment.test(repository)) {
    return null;
  }

  return { owner, repository, fullName: `${owner}/${repository}` };
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
