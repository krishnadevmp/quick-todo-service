// Ported from quick-todo's src/utils/recurringUtils.ts so the server can
// spawn the next occurrence in POST /api/tasks/:id/complete the same way
// the frontend used to do it locally against Dexie.

export type RecurringPattern = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

/**
 * Returns the "YYYY-MM-DD" string for the next occurrence after a given due
 * date. If dueDate is undefined, advances from today.
 */
export function getNextOccurrence(dueDate: string | undefined, pattern: RecurringPattern): string {
  const base = dueDate ? new Date(dueDate + 'T00:00:00Z') : new Date();

  switch (pattern) {
    case 'daily':
      base.setUTCDate(base.getUTCDate() + 1);
      break;

    case 'weekdays':
      base.setUTCDate(base.getUTCDate() + 1);
      if (base.getUTCDay() === 6) base.setUTCDate(base.getUTCDate() + 2); // Sat -> Mon
      if (base.getUTCDay() === 0) base.setUTCDate(base.getUTCDate() + 1); // Sun -> Mon
      break;

    case 'weekly':
      base.setUTCDate(base.getUTCDate() + 7);
      break;

    case 'monthly':
      base.setUTCMonth(base.getUTCMonth() + 1);
      break;

    default:
      break;
  }

  return base.toISOString().slice(0, 10);
}
