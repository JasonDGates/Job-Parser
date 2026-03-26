import { load } from "cheerio";

const TRACKING_QUERY_PARAMS = new Set([
  "trk",
  "trkEmail",
  "lipi",
  "midToken",
  "midSig",
  "eid",
  "otpToken",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "source",
  "ust",
  "usg",
  "trackingId",
  "refId",
]);

export function getCheerio(html: string) {
  return load(html);
}

export function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").replace(/&nbsp;/g, " ").trim();
}

export function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function extractGoogleRedirectTarget(url: URL): string {
  const q = url.searchParams.get("q");
  return q ? decodeURIComponent(q) : url.toString();
}

export function normalizeApplicationLink(rawLink: string): string {
  const link = cleanText(rawLink).replace(/&amp;/g, "&");
  const initial = tryParseUrl(link);
  if (!initial) {
    return link;
  }

  let workingLink = initial;
  if (workingLink.hostname === "www.google.com" && workingLink.pathname === "/url") {
    const nested = tryParseUrl(extractGoogleRedirectTarget(workingLink));
    if (nested) {
      workingLink = nested;
    }
  }

  if (workingLink.hostname.includes("linkedin.com")) {
    const match = workingLink.pathname.match(/\/jobs\/view\/(\d+)/) ?? workingLink.pathname.match(/\/comm\/jobs\/view\/(\d+)/);
    if (match) {
      return `https://www.linkedin.com/jobs/view/${match[1]}`;
    }
  }

  workingLink.hash = "";
  for (const key of [...workingLink.searchParams.keys()]) {
    if (TRACKING_QUERY_PARAMS.has(key)) {
      workingLink.searchParams.delete(key);
    }
  }
  workingLink.hostname = workingLink.hostname.toLowerCase();
  return workingLink.toString();
}

export function splitCompanyAndLocation(summaryText: string): { company: string; location: string } {
  const cleaned = cleanText(summaryText);
  const parts = cleaned.split("·").map((part) => cleanText(part));
  if (parts.length >= 2) {
    return { company: parts[0], location: parts.slice(1).join(" · ") };
  }
  return { company: cleaned, location: "" };
}
