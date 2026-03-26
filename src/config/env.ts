import dotenv from "dotenv";

dotenv.config();

export interface AppEnv {
  googleOAuthCredentialsPath: string;
  googleOAuthTokenPath: string;
  googleSpreadsheetId: string;
  googleWorksheetName: string;
  gmailUserId: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function loadEnv(): AppEnv {
  return {
    googleOAuthCredentialsPath: requiredEnv("GOOGLE_OAUTH_CREDENTIALS_PATH"),
    googleOAuthTokenPath: process.env.GOOGLE_OAUTH_TOKEN_PATH?.trim() || "token.json",
    googleSpreadsheetId: requiredEnv("GOOGLE_SPREADSHEET_ID"),
    googleWorksheetName: requiredEnv("GOOGLE_WORKSHEET_NAME"),
    gmailUserId: process.env.GMAIL_USER_ID?.trim() || "me",
  };
}
