import { google } from "googleapis";
import { AppError } from "../errors/appErrors.js";
import { JobRecord } from "../types/job.js";

const EXPECTED_HEADERS = [
  "Date MM-DD-YYYY",
  "Job Title",
  "Company",
  "Location",
  "Link to the application",
];

export class SheetsClient {
  private readonly sheets = google.sheets("v4");

  constructor(
    private readonly auth: any,
    private readonly spreadsheetId: string,
    private readonly worksheetName: string,
  ) {}

  private rangeA1(range: string): string {
    return `'${this.worksheetName}'!${range}`;
  }

  async ensureHeaders(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: this.rangeA1("A1:E1"),
      });
      const headers = (response.data.values?.[0] || []).map((v) => String(v));
      if (headers.length === 0) {
        await this.sheets.spreadsheets.values.update({
          auth: this.auth,
          spreadsheetId: this.spreadsheetId,
          range: this.rangeA1("A1:E1"),
          valueInputOption: "RAW",
          requestBody: { values: [EXPECTED_HEADERS] },
        });
        return;
      }

      const mismatch = EXPECTED_HEADERS.some((header, idx) => headers[idx] !== header);
      if (mismatch) {
        throw new AppError(
          `Worksheet header mismatch. Expected: ${EXPECTED_HEADERS.join(" | ")}`,
          "VALIDATION_ERROR",
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to access or validate Google Sheet.", "SHEETS_ACCESS_ERROR", error);
    }
  }

  async getExistingLinks(): Promise<string[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: this.rangeA1("E2:E"),
      });
      return (response.data.values || []).flat().map((v) => String(v).trim()).filter(Boolean);
    } catch (error) {
      throw new AppError("Failed to read existing sheet links.", "SHEETS_ACCESS_ERROR", error);
    }
  }

  async appendRows(rows: JobRecord[]): Promise<number> {
    if (!rows.length) {
      return 0;
    }
    const values = rows.map((row) => [
      row.date,
      row.jobTitle,
      row.company,
      row.location,
      row.applicationLink,
    ]);

    try {
      await this.sheets.spreadsheets.values.append({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: this.rangeA1("A:E"),
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
      return values.length;
    } catch (error) {
      throw new AppError("Failed to append rows into Google Sheet.", "SHEETS_ACCESS_ERROR", error);
    }
  }
}
