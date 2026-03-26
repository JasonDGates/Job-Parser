import { JobRecord } from "../types/job.js";
import { cleanText, getCheerio, normalizeApplicationLink } from "./shared.js";

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
  const seen = new Set<string>();

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
    const normalizedLink = normalizeApplicationLink(href);

    if (!title || !normalizedLink || seen.has(normalizedLink)) {
      return;
    }

    seen.add(normalizedLink);
    results.push({
      source: "wttj",
      date: input.emailDate,
      jobTitle: title,
      company,
      location,
      applicationLink: normalizedLink,
    });
  });

  return results.filter((record) => Boolean(record.jobTitle) && Boolean(record.applicationLink));
}
