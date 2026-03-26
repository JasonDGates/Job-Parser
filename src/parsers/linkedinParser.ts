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

  $("a[href*='linkedin.com'][href*='/jobs/view/'], a[href*='linkedin.com'][href*='/comm/jobs/view/']").each((_, el) => {
    const href = $(el).attr("href");
    const title = cleanText($(el).text());
    if (!href || !title) {
      return;
    }

    const canonicalLink = normalizeApplicationLink(href);
    if (!canonicalLink || seenLinks.has(canonicalLink)) {
      return;
    }

    const detailsNodeText = cleanText($(el).closest("table").find("p").first().text());
    const { company, location } = splitCompanyAndLocation(detailsNodeText);
    if (!title || !company) {
      return;
    }

    seenLinks.add(canonicalLink);
    results.push({
      source: "linkedin",
      date: input.emailDate,
      jobTitle: title,
      company,
      location,
      applicationLink: canonicalLink,
    });
  });

  return results;
}
