import { describe, expect, it } from 'vitest';
import { dateStrToDate, dateToDateStr, todayStr } from '../../../src/utils/date';

describe('dateStrToDate / dateToDateStr', () => {
  it('round-trips a "YYYY-MM-DD" string through a Date and back unchanged', () => {
    expect(dateToDateStr(dateStrToDate('2026-08-16'))).toBe('2026-08-16');
  });

  it('dateStrToDate produces UTC midnight, immune to local-timezone drift', () => {
    const d = dateStrToDate('2026-01-01');
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });

  it('dateToDateStr formats as zero-padded YYYY-MM-DD', () => {
    expect(dateToDateStr(new Date('2026-03-05T12:00:00Z'))).toBe('2026-03-05');
  });
});

describe('todayStr', () => {
  it('matches the current UTC date in YYYY-MM-DD form', () => {
    expect(todayStr()).toBe(new Date().toISOString().slice(0, 10));
  });
});
