import { describe, expect, it } from 'vitest';
import { getNextOccurrence } from '../../../src/utils/recurring';

describe('getNextOccurrence', () => {
  it('daily: advances by exactly one day', () => {
    expect(getNextOccurrence('2026-08-16', 'daily')).toBe('2026-08-17');
  });

  it('weekly: advances by exactly seven days', () => {
    expect(getNextOccurrence('2026-08-16', 'weekly')).toBe('2026-08-23');
  });

  it('monthly: advances by one calendar month', () => {
    expect(getNextOccurrence('2026-08-16', 'monthly')).toBe('2026-09-16');
  });

  it('monthly: rolls over when the target month is shorter (Jan 31 -> Mar 3, no Feb 31)', () => {
    expect(getNextOccurrence('2026-01-31', 'monthly')).toBe('2026-03-03');
  });

  it('weekdays: Friday advances to the following Monday, skipping the weekend', () => {
    expect(getNextOccurrence('2026-08-14', 'weekdays')).toBe('2026-08-17'); // Fri -> Mon
  });

  it('weekdays: Saturday advances to Monday', () => {
    expect(getNextOccurrence('2026-08-15', 'weekdays')).toBe('2026-08-17'); // Sat -> Mon
  });

  it('weekdays: Sunday advances to Monday', () => {
    expect(getNextOccurrence('2026-08-16', 'weekdays')).toBe('2026-08-17'); // Sun -> Mon
  });

  it('weekdays: a mid-week day just advances by one day', () => {
    expect(getNextOccurrence('2026-08-11', 'weekdays')).toBe('2026-08-12'); // Tue -> Wed
  });

  it("'none' returns the same date unchanged", () => {
    expect(getNextOccurrence('2026-08-16', 'none')).toBe('2026-08-16');
  });

  it('falls back to today when dueDate is undefined', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getNextOccurrence(undefined, 'none')).toBe(today);
  });
});
