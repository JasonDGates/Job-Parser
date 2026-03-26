import { JobRecord } from "../types/job.js";
import { cleanText, getCheerio, normalizeApplicationLink, splitCompanyAndLocation } from "./shared.js";

interface LinkedInParseInput {
  html: string;
  emailDate: string;
}

export function parseLinkedInEmail(input: LinkedInParseInput): JobRecord[] {
  const $ = getCheerio(input.html);
  const results: JobRecord[] = [];
  const seenLinks = new Set<string>();

  $("a[href*='linkedin.com'][href*='/jobs']").each((_, el) => {
    const href = $(el).attr("href");
    const anchor = $(el);
    const title = cleanText(anchor.text() || anchor.attr("aria-label") || "");
    const fallbackTitle = cleanText(
      anchor.find("strong").first().text() || anchor.closest("table").find("strong").first().text(),
    );
    const resolvedTitle = title || fallbackTitle;
    if (!href || !resolvedTitle) {
      return;
    }

    const canonicalLink = normalizeApplicationLink(href);
    if (!canonicalLink || seenLinks.has(canonicalLink)) {
      return;
    }
    // Keep only concrete job posting links, not alert/search/manage pages.
    if (!/^https:\/\/www\.linkedin\.com\/jobs\/view\/\d+$/.test(canonicalLink)) {
      return;
    }

    const detailsNodeText = cleanText($(el).closest("table").find("p").first().text());
    const { company, location } = splitCompanyAndLocation(detailsNodeText);
    if (!resolvedTitle) {
      return;
    }

    seenLinks.add(canonicalLink);
    results.push({
      source: "linkedin",
      date: input.emailDate,
      jobTitle: resolvedTitle,
      company,
      location,
      applicationLink: canonicalLink,
    });
  });

  return results;
}
