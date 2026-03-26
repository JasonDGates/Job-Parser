import { SupportedSource } from "../types/job.js";

function toEpochDay(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function buildSourceQuery(source: SupportedSource): string {
  if (source === "linkedin") {
    return "(from:jobalerts-noreply@linkedin.com OR from:linkedin.com OR from:linkedinmail.com)";
  }
  return "(from:welcometothejungle.com OR from:email.welcometothejungle.com OR from:otta.com) (subject:\"New match\" OR subject:\"job\")";
}

export function buildRangeQuery(start: Date, end: Date): string {
  const inclusiveEndPlusOne = new Date(end);
  inclusiveEndPlusOne.setDate(inclusiveEndPlusOne.getDate() + 1);
  return `after:${toEpochDay(start)} before:${toEpochDay(inclusiveEndPlusOne)}`;
}

export function buildCombinedQuery(source: SupportedSource, start: Date, end: Date): string {
  return `${buildSourceQuery(source)} ${buildRangeQuery(start, end)}`;
}
