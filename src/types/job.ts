export type SupportedSource = "linkedin" | "wttj";

export type ScanMode = "full" | "30d" | "daily" | "custom";

export interface ScanRange {
  start: Date;
  end: Date;
}

export interface JobRecord {
  source: SupportedSource;
  date: string;
  jobTitle: string;
  company: string;
  location: string;
  applicationLink: string;
}

export interface ExtractedMessage {
  id: string;
  internalDateMs: number;
  from: string;
  subject: string;
  htmlBody: string;
}
