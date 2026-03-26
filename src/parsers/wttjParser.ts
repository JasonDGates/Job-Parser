import { JobRecord } from "../types/job.js";
import {
  buildJobIdentity,
  cleanText,
  getCheerio,
  normalizeIdentityText,
  normalizeUrlForIdentity,
} from "./shared.js";

interface WttjParseInput {
  html: string;
  emailDate: string;
}

function parseCompanyFromTitleFallback(subjectOrTitle: string): string {
  const match = subjectOrTitle.match(/\sat\s(.+)$/i);
  return match ? cleanText(match[1]) : "";
}

const NON_JOB_TITLE_PATTERNS = [
  /see all top matches/i,
  /manage job alerts/i,
  /change email frequency/i,
  /manage email notifications/i,
  /unsubscribe/i,
  /^daily$/i,
  /^weekly$/i,
  /^never$/i,
];

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map((v) => cleanText(v)).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function pickBestTitle(
  candidateTitles: string[],
  companyHint: string,
): string {
  const normalizedCompany = normalizeIdentityText(companyHint);
  const candidates = uniqueNonEmpty(candidateTitles);

  const nonCompany = candidates.filter((candidate) => {
    const normalizedCandidate = normalizeIdentityText(candidate);
    const isNonJob = NON_JOB_TITLE_PATTERNS.some((pattern) => pattern.test(candidate));
    return normalizedCandidate && normalizedCandidate !== normalizedCompany && !isNonJob;
  });

  // Prefer more descriptive role-like text (usually longer than company names).
  const ranked = (nonCompany.length ? nonCompany : candidates).sort(
    (a, b) => b.length - a.length,
  );
  return ranked[0] || "";
}

export function parseWttjEmail(input: WttjParseInput): JobRecord[] {
  const $ = getCheerio(input.html);
  const results: JobRecord[] = [];
  const seenIdentity = new Set<string>();

  $("a[href*='sendgrid.net/ls/click'], a[href*='welcometothejungle.com']").each((_, linkEl) => {
    const anchor = $(linkEl);
    const href = anchor.attr("href");
    if (!href) {
      return;
    }

    const cardRoot = anchor.find("strong").first().length ? anchor : anchor.closest("table");
    const location = cleanText(cardRoot.find("em").first().text());
    const logoAlt = cleanText(cardRoot.find("img[alt*='logo']").first().attr("alt") || "");
    const companyFromLogo = logoAlt.replace(/\s+logo$/i, "").trim();
    const strongCandidates = cardRoot
      .find("strong")
      .map((_, el) => cleanText($(el).text()))
      .get();
    const textCandidates = [
      ...strongCandidates,
      cleanText(anchor.attr("title") || ""),
    ];
    const title = pickBestTitle(textCandidates, companyFromLogo);
    const companyFromTitle = parseCompanyFromTitleFallback(title);
    const company =
      companyFromLogo ||
      companyFromTitle ||
      strongCandidates.find((value) => normalizeIdentityText(value) !== normalizeIdentityText(title)) ||
      "";
    const normalizedLink = normalizeUrlForIdentity(href);
    const isLikelyJobCard = strongCandidates.length > 0 && (Boolean(location) || Boolean(companyFromLogo));
    const isControlRow = NON_JOB_TITLE_PATTERNS.some((pattern) => pattern.test(title));
    const candidate: JobRecord = {
      source: "wttj",
      date: input.emailDate,
      jobTitle: title,
      company,
      location,
      applicationLink: normalizedLink,
    };
    const identity = buildJobIdentity(candidate);

    if (!title || !normalizedLink || !isLikelyJobCard || isControlRow || seenIdentity.has(identity)) {
      return;
    }

    seenIdentity.add(identity);
    results.push(candidate);
  });

  return results.filter((record) => Boolean(record.jobTitle) && Boolean(record.applicationLink));
}
