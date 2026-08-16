/**
 * The frontend represents dates as plain "YYYY-MM-DD" strings (no timezone —
 * a wall-clock date, not an instant). Prisma's `@db.Date` columns come back
 * as JS `Date` objects at UTC midnight; these helpers convert both ways so
 * the API's JSON matches what the frontend already expects.
 */

/** "YYYY-MM-DD" string -> UTC-midnight Date, for writing to a @db.Date column. */
export function dateStrToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** @db.Date column value -> "YYYY-MM-DD" string, for JSON responses. */
export function dateToDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today as "YYYY-MM-DD" in UTC. */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
