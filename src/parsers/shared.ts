import { load } from "cheerio";
import { JobRecord } from "../types/job.js";

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

const REDIRECT_PARAM_KEYS = [
  "url",
  "u",
  "target",
  "to",
  "redirect",
  "redirect_url",
  "redirectUrl",
  "dest",
  "destination",
  "r",
  "q",
  "next",
] as const;

const TRACKING_HOST_PATTERNS = ["sendgrid.net", "google.com"];

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

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksLikeAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseDecodedUrl(value: string): URL | null {
  const direct = tryParseUrl(value);
  if (direct) {
    return direct;
  }

  const decodedOnce = safeDecode(value);
  const decoded = tryParseUrl(decodedOnce);
  if (decoded) {
    return decoded;
  }

  const decodedTwice = safeDecode(decodedOnce);
  return tryParseUrl(decodedTwice);
}

function isTrackingHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  return TRACKING_HOST_PATTERNS.some(
    (pattern) => lowerHost === pattern || lowerHost.endsWith(`.${pattern}`),
  );
}

export function extractRedirectTargetFromUrl(url: URL): string | null {
  for (const key of REDIRECT_PARAM_KEYS) {
    const value = url.searchParams.get(key);
    if (!value) {
      continue;
    }
    const decoded = safeDecode(value);
    if (looksLikeAbsoluteUrl(decoded) || looksLikeAbsoluteUrl(value)) {
      return decoded;
    }
  }

  return null;
}

export function unwrapTrackingUrl(rawLink: string): URL | null {
  const link = cleanText(rawLink).replace(/&amp;/g, "&");
  let workingLink = tryParseUrl(link);
  if (!workingLink) {
    return null;
  }

  for (let i = 0; i < 4; i += 1) {
    if (workingLink.hostname === "www.google.com" && workingLink.pathname === "/url") {
      const nested = parseDecodedUrl(extractGoogleRedirectTarget(workingLink));
      if (nested) {
        workingLink = nested;
        continue;
      }
    }

    const redirectTarget = extractRedirectTargetFromUrl(workingLink);
    if (!redirectTarget) {
      break;
    }

    const nested = parseDecodedUrl(redirectTarget);
    if (!nested) {
      break;
    }
    if (nested.toString() === workingLink.toString()) {
      break;
    }
    workingLink = nested;
  }

  return workingLink;
}

export function normalizeUrlForIdentity(rawLink: string): string {
  const workingLink = unwrapTrackingUrl(rawLink);
  if (!workingLink) {
    return cleanText(rawLink).replace(/&amp;/g, "&");
  }

  if (workingLink.hostname.includes("linkedin.com")) {
    const match =
      workingLink.pathname.match(/\/jobs\/view\/(\d+)/) ??
      workingLink.pathname.match(/\/comm\/jobs\/view\/(\d+)/) ??
      workingLink.pathname.match(/\/jobs-guest\/jobs\/view\/(\d+)/);
    if (match) {
      return `https://www.linkedin.com/jobs/view/${match[1]}`;
    }
  }

  const host = workingLink.hostname.toLowerCase();
  if (host === "www.welcometothejungle.com") {
    workingLink.hostname = "welcometothejungle.com";
  } else {
    workingLink.hostname = host;
  }

  workingLink.hash = "";
  for (const key of [...workingLink.searchParams.keys()]) {
    if (TRACKING_QUERY_PARAMS.has(key)) {
      workingLink.searchParams.delete(key);
    }
  }

  if (workingLink.pathname !== "/" && workingLink.pathname.endsWith("/")) {
    workingLink.pathname = workingLink.pathname.slice(0, -1);
  }

  return workingLink.toString();
}

export function normalizeApplicationLink(rawLink: string): string {
  return normalizeUrlForIdentity(rawLink);
}

export function normalizeIdentityText(value: string): string {
  const cleaned = cleanText(value || "").toLowerCase();
  return cleaned
    .replace(/[|/_-]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStableIdentifierFromUrl(rawLink: string): string | null {
  const normalizedUrl = normalizeUrlForIdentity(rawLink);
  const parsed = tryParseUrl(normalizedUrl);
  if (!parsed) {
    return null;
  }

  if (parsed.hostname.includes("linkedin.com")) {
    const linkedinId =
      parsed.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ??
      parsed.pathname.match(/\/comm\/jobs\/view\/(\d+)/)?.[1] ??
      parsed.pathname.match(/\/jobs-guest\/jobs\/view\/(\d+)/)?.[1];
    if (linkedinId) {
      return `linkedin:${linkedinId}`;
    }
  }

  if (parsed.hostname.includes("welcometothejungle.com")) {
    const slug = parsed.pathname
      .split("/")
      .filter(Boolean)
      .pop();
    if (slug && /^[a-z0-9-]{6,}$/i.test(slug)) {
      return `wttj:${slug.toLowerCase()}`;
    }
  }

  return null;
}

export function buildCompositeIdentityKey(
  input: Pick<JobRecord, "source" | "jobTitle" | "company" | "location">,
): string {
  const title = normalizeIdentityText(input.jobTitle) || "unknown-title";
  const company = normalizeIdentityText(input.company) || "unknown-company";
  const location = normalizeIdentityText(input.location) || "unknown-location";
  return `cmp:${input.source}:${title}|${company}|${location}`;
}

export function buildJobIdentity(
  input: Pick<JobRecord, "source" | "jobTitle" | "company" | "location" | "applicationLink">,
): string {
  const normalizedUrl = normalizeUrlForIdentity(input.applicationLink);
  const parsed = tryParseUrl(normalizedUrl);
  if (parsed && !isTrackingHost(parsed.hostname)) {
    return `url:${normalizedUrl}`;
  }

  const stableId = extractStableIdentifierFromUrl(input.applicationLink);
  if (stableId) {
    return `id:${input.source}:${stableId}`;
  }

  return buildCompositeIdentityKey(input);
}

export async function resolveRedirectedApplicationLink(rawLink: string): Promise<string> {
  const normalizedInput = normalizeUrlForIdentity(rawLink);
  const parsed = tryParseUrl(normalizedInput);
  if (!parsed) {
    return normalizedInput;
  }

  const host = parsed.hostname.toLowerCase();
  const isSendGridHost = host === "sendgrid.net" || host.endsWith(".sendgrid.net");
  if (!isSendGridHost) {
    return normalizedInput;
  }

  let currentUrl = parsed.toString();
  for (let i = 0; i < 5; i += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // A browser-like UA improves compatibility with some redirect services.
          "user-agent": "Mozilla/5.0 (compatible; JobParser/1.0)",
        },
      });
      clearTimeout(timeout);

      const location = response.headers.get("location");
      if (!location) {
        break;
      }

      const next = tryParseUrl(location) ?? tryParseUrl(new URL(location, currentUrl).toString());
      if (!next) {
        break;
      }

      currentUrl = next.toString();
      const nextHost = next.hostname.toLowerCase();
      if (nextHost !== "sendgrid.net" && !nextHost.endsWith(".sendgrid.net")) {
        break;
      }
    } catch {
      clearTimeout(timeout);
      break;
    }
  }

  return normalizeUrlForIdentity(currentUrl);
}

export function splitCompanyAndLocation(summaryText: string): { company: string; location: string } {
  const cleaned = cleanText(summaryText);
  const parts = cleaned.split("·").map((part) => cleanText(part));
  if (parts.length >= 2) {
    return { company: parts[0], location: parts.slice(1).join(" · ") };
  }
  return { company: cleaned, location: "" };
}
