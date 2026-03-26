import { AppEnv } from "../config/env.js";
import { getOAuthClient } from "../google/auth.js";
import { GmailClient } from "../google/gmailClient.js";
import { SheetsClient } from "../google/sheetsClient.js";
import { logger } from "../lib/logger.js";
import { parseLinkedInEmail } from "../parsers/linkedinParser.js";
import { buildJobIdentity, normalizeUrlForIdentity } from "../parsers/shared.js";
import { parseWttjEmail } from "../parsers/wttjParser.js";
import { formatSheetDate } from "./dateRanges.js";
import { buildCombinedQuery } from "./gmailQueries.js";
import { JobRecord, ScanRange, SupportedSource } from "../types/job.js";

export interface RunSummary {
  scannedMessages: number;
  parsedRecords: number;
  insertedRows: number;
  skippedDuplicates: number;
  skippedMalformed: number;
}

function isSourceMessage(source: SupportedSource, from: string, subject: string): boolean {
  const fromLower = from.toLowerCase();
  if (source === "linkedin") {
    const isLinkedinSender =
      fromLower.includes("linkedin.com") ||
      fromLower.includes("linkedinmail.com") ||
      fromLower.includes("linkedin");
    return isLinkedinSender;
  }
  const subjectLower = subject.toLowerCase();
  return (
    (fromLower.includes("welcometothejungle") || fromLower.includes("otta")) &&
    (subjectLower.includes("new match") || subjectLower.includes("job"))
  );
}

function parseBySource(
  source: SupportedSource,
  htmlBody: string,
  emailDate: string,
): JobRecord[] {
  if (source === "linkedin") {
    return parseLinkedInEmail({ html: htmlBody, emailDate });
  }
  return parseWttjEmail({ html: htmlBody, emailDate });
}

export async function runScan(env: AppEnv, scanRange: ScanRange): Promise<RunSummary> {
  const auth = await getOAuthClient(env.googleOAuthCredentialsPath, env.googleOAuthTokenPath);
  const gmailClient = new GmailClient(auth, env.gmailUserId);
  const sheetsClient = new SheetsClient(auth, env.googleSpreadsheetId, env.googleWorksheetName);
  await sheetsClient.ensureHeaders();

  const existingRows = await sheetsClient.getExistingRows();
  const dedupeSet = new Set(
    existingRows.map((row) =>
      buildJobIdentity({
        source: row.applicationLink.includes("linkedin.com") ? "linkedin" : "wttj",
        jobTitle: row.jobTitle,
        company: row.company,
        location: row.location,
        applicationLink: row.applicationLink,
      }),
    ),
  );
  const candidates: JobRecord[] = [];

  let scannedMessages = 0;
  let skippedMalformed = 0;

  for (const source of ["linkedin", "wttj"] as const) {
    const query = buildCombinedQuery(source, scanRange.start, scanRange.end);
    logger.info(`Running Gmail query for ${source}`, { query });
    const messageIds = await gmailClient.listMessageIds(query);

    for (const messageId of messageIds) {
      scannedMessages += 1;
      try {
        const message = await gmailClient.getMessage(messageId);
        if (!isSourceMessage(source, message.from, message.subject)) {
          continue;
        }
        const emailDate = formatSheetDate(new Date(message.internalDateMs));
        const parsed = parseBySource(source, message.htmlBody, emailDate);
        candidates.push(...parsed);
      } catch {
        skippedMalformed += 1;
      }
    }
  }

  let skippedDuplicates = 0;
  const uniqueToInsert: JobRecord[] = [];
  for (const row of candidates) {
    if (!row.jobTitle || !row.applicationLink) {
      skippedMalformed += 1;
      continue;
    }
    const normalizedLink = normalizeUrlForIdentity(row.applicationLink);
    if (!normalizedLink) {
      skippedMalformed += 1;
      continue;
    }
    const identity = buildJobIdentity({ ...row, applicationLink: normalizedLink });
    if (dedupeSet.has(identity)) {
      skippedDuplicates += 1;
      continue;
    }
    dedupeSet.add(identity);
    uniqueToInsert.push({ ...row, applicationLink: normalizedLink, location: row.location || "" });
  }

  const insertedRows = await sheetsClient.appendRows(uniqueToInsert);
  return {
    scannedMessages,
    parsedRecords: candidates.length,
    insertedRows,
    skippedDuplicates,
    skippedMalformed,
  };
}
