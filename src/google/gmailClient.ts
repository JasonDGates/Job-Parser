import { gmail_v1, google } from "googleapis";
import { AppError } from "../errors/appErrors.js";
import { logger } from "../lib/logger.js";
import { ExtractedMessage } from "../types/job.js";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt += 1;
      const status = error?.code || error?.response?.status;
      const retryable = status === 429 || status === 500 || status === 503;
      if (!retryable || attempt > maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function pickHtmlPart(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) {
    return "";
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts || []) {
    const html = pickHtmlPart(part);
    if (html) {
      return html;
    }
  }
  return "";
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const found = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value || "";
}

export class GmailClient {
  private readonly gmail = google.gmail("v1");

  constructor(private readonly auth: any, private readonly userId: string) {}

  async listMessageIds(query: string): Promise<string[]> {
    try {
      const ids: string[] = [];
      let pageToken: string | undefined;
      do {
        const response = await withRetry(() =>
          this.gmail.users.messages.list({
            auth: this.auth,
            userId: this.userId,
            q: query,
            pageToken,
            maxResults: 500,
          }),
        );
        const batch = (response.data.messages?.map((m) => m.id).filter(Boolean) ?? []) as string[];
        ids.push(...batch);
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);
      return ids;
    } catch (error) {
      throw new AppError("Failed to list Gmail messages.", "GMAIL_API_ERROR", error);
    }
  }

  async getMessage(messageId: string): Promise<ExtractedMessage> {
    try {
      const response = await withRetry(() =>
        this.gmail.users.messages.get({
          auth: this.auth,
          userId: this.userId,
          id: messageId,
          format: "full",
        }),
      );
      const data = response.data;
      const htmlBody = pickHtmlPart(data.payload);
      const internalDateMs = Number(data.internalDate || 0);
      return {
        id: data.id || messageId,
        internalDateMs,
        from: getHeader(data.payload?.headers, "From"),
        subject: getHeader(data.payload?.headers, "Subject"),
        htmlBody,
      };
    } catch (error) {
      logger.warn("Skipping malformed Gmail message.", { messageId });
      throw new AppError(`Failed to fetch message ${messageId}.`, "GMAIL_API_ERROR", error);
    }
  }
}
