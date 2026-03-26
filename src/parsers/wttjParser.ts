import { JobRecord } from "../types/job.js";
import { buildJobIdentity, cleanText, getCheerio, normalizeUrlForIdentity } from "./shared.js";

interface WttjParseInput {
  html: string;
  emailDate: string;
}

function parseCompanyFromTitleFallback(subjectOrTitle: string): string {
  const match = subjectOrTitle.match(/\sat\s(.+)$/i);
  return match ? cleanText(match[1]) : "";
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
    const title = cleanText(cardRoot.find("strong").first().text());
    const location = cleanText(cardRoot.find("em").first().text());
    const logoAlt = cleanText(cardRoot.find("img[alt*='logo']").first().attr("alt") || "");
    const companyFromLogo = logoAlt.replace(/\s+logo$/i, "").trim();
    const company = companyFromLogo || parseCompanyFromTitleFallback(title);
    const normalizedLink = normalizeUrlForIdentity(href);
    const candidate: JobRecord = {
      source: "wttj",
      date: input.emailDate,
      jobTitle: title,
      company,
      location,
      applicationLink: normalizedLink,
    };
    const identity = buildJobIdentity(candidate);

    if (!title || !normalizedLink || seenIdentity.has(identity)) {
      return;
    }

    seenIdentity.add(identity);
    results.push(candidate);
  });

  return results.filter((record) => Boolean(record.jobTitle) && Boolean(record.applicationLink));
}
