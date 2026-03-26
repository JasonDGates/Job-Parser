import fs from "node:fs/promises";
import path from "node:path";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import { AppError } from "../errors/appErrors.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

export async function getOAuthClient(credentialsPath: string, tokenPath: string) {
  try {
    const tokenAbs = path.resolve(tokenPath);
    const tokenBuffer = await fs.readFile(tokenAbs).catch(() => null);
    if (tokenBuffer) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials(JSON.parse(tokenBuffer.toString()));
      return auth;
    }

    const client = await authenticate({
      scopes: SCOPES,
      keyfilePath: path.resolve(credentialsPath),
    });

    await fs.writeFile(tokenAbs, JSON.stringify(client.credentials, null, 2), "utf8");
    return client;
  } catch (error) {
    throw new AppError("Google OAuth authentication failed.", "AUTH_ERROR", error);
  }
}
