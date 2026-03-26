import { ScanMode, ScanRange } from "../types/job.js";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function parseYyyyMmDd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD`);
  }
  return new Date(year, month - 1, day);
}

export function getScanRange(mode: ScanMode, start?: string, end?: string): ScanRange {
  const now = new Date();
  const todayStart = startOfDay(now);

  if (mode === "full") {
    return {
      start: startOfDay(new Date(2025, 5, 1)),
      end: endOfDay(now),
    };
  }

  if (mode === "30d") {
    const startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 29);
    return { start: startDate, end: endOfDay(now) };
  }

  if (mode === "daily") {
    const startDate = new Date(todayStart);
    startDate.setDate(startDate.getDate() - 1);
    return { start: startDate, end: endOfDay(now) };
  }

  if (!start || !end) {
    throw new Error("Custom mode requires --start and --end in YYYY-MM-DD format.");
  }

  const customStart = startOfDay(parseYyyyMmDd(start));
  const customEnd = endOfDay(parseYyyyMmDd(end));

  if (customStart > customEnd) {
    throw new Error("Custom date range is invalid: start date is after end date.");
  }

  return { start: customStart, end: customEnd };
}

export function formatSheetDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}`;
}
