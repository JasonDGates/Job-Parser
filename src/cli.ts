import { Command } from "commander";
import { loadEnv } from "./config/env.js";
import { toAppError } from "./errors/appErrors.js";
import { logger } from "./lib/logger.js";
import { getScanRange } from "./scan/dateRanges.js";
import { runScan } from "./scan/runner.js";
import { ScanMode } from "./types/job.js";

interface CliOptions {
  mode: ScanMode;
  start?: string;
  end?: string;
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("gmail-job-sheet")
    .description("Scan Gmail job emails and append deduplicated rows into Google Sheets.")
    .requiredOption("--mode <mode>", "full | 30d | daily | custom")
    .option("--start <YYYY-MM-DD>", "custom mode start date")
    .option("--end <YYYY-MM-DD>", "custom mode end date")
    .parse(argv);

  const options = program.opts<CliOptions>();
  const mode = options.mode;
  if (!["full", "30d", "daily", "custom"].includes(mode)) {
    throw new Error("Invalid --mode. Use one of: full, 30d, daily, custom.");
  }

  const env = loadEnv();
  const scanRange = getScanRange(mode, options.start, options.end);
  logger.info("Starting scan", {
    mode,
    start: scanRange.start.toISOString(),
    end: scanRange.end.toISOString(),
  });

  const summary = await runScan(env, scanRange);
  logger.info("Scan complete", summary);
}

export async function runCliSafe(argv: string[]): Promise<void> {
  try {
    await runCli(argv);
  } catch (error) {
    const appError = toAppError(error, "CLI run failed.");
    logger.error(appError.message, { code: appError.code });
    process.exitCode = 1;
  }
}
